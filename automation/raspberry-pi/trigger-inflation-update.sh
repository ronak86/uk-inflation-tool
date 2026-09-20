#!/usr/bin/env bash
set -euo pipefail

readonly REPOSITORY="ronak86/uk-inflation-tool"
readonly WORKFLOW="update-inflation-data.yml"
readonly RELEASE_DATES_URL="https://raw.githubusercontent.com/${REPOSITORY}/main/automation/inflation-release-dates.txt"
readonly API_URL="https://api.github.com/repos/${REPOSITORY}/actions/workflows/${WORKFLOW}/dispatches"
readonly TOKEN_FILE="${UK_INFLATION_TOKEN_FILE:-/etc/uk-inflation/github.env}"

today="$(TZ=Europe/London date +%F)"
release_dates="$(curl --fail --silent --show-error --location --retry 3 --max-time 30 "${RELEASE_DATES_URL}")"

if ! grep --fixed-strings --line-regexp --quiet "${today}" <<<"${release_dates}"; then
  echo "${today} is not an inflation release date; no action dispatched."
  exit 0
fi

if [[ ! -r "${TOKEN_FILE}" ]]; then
  echo "GitHub token file is missing or unreadable: ${TOKEN_FILE}" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "${TOKEN_FILE}"
: "${GITHUB_TOKEN:?Set GITHUB_TOKEN in ${TOKEN_FILE}}"

payload='{"ref":"main","inputs":{"force":"false","trigger_source":"raspberry-pi"}}'
response_file="$(mktemp)"
trap 'rm -f "${response_file}"' EXIT

status="$({
  curl --silent --show-error --location \
    --output "${response_file}" \
    --write-out '%{http_code}' \
    --request POST \
    --header "Accept: application/vnd.github+json" \
    --header "Authorization: Bearer ${GITHUB_TOKEN}" \
    --header "X-GitHub-Api-Version: 2022-11-28" \
    --data "${payload}" \
    "${API_URL}"
} || true)"

if [[ "${status}" != "204" ]]; then
  echo "GitHub dispatch failed with HTTP ${status}." >&2
  cat "${response_file}" >&2
  exit 1
fi

echo "Dispatched ${WORKFLOW} for ${today}."
