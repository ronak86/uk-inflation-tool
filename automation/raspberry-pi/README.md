# Raspberry Pi release trigger

The Pi checks `automation/inflation-release-dates.txt` at 07:00:10 London time each day. On a listed date it dispatches the `Update inflation data` GitHub Action. GitHub remains responsible for downloading ONS data, rebuilding the app data, testing, committing, deploying and emailing the result.

## Token

Create a fine-grained GitHub personal access token restricted to `ronak86/uk-inflation-tool` with:

- Repository permission: **Actions — Read and write**
- Repository permission: **Metadata — Read-only**

Store it only on the Pi:

```bash
sudo install -d -m 0750 -o ronakpi -g ronakpi /etc/uk-inflation
sudo install -m 0600 -o ronakpi -g ronakpi /dev/null /etc/uk-inflation/github.env
sudo nano /etc/uk-inflation/github.env
```

The file should contain:

```bash
GITHUB_TOKEN=github_pat_REPLACE_ME
```

## Useful checks

```bash
systemctl list-timers uk-inflation-update.timer
sudo systemctl start uk-inflation-update.service
journalctl -u uk-inflation-update.service
```

Starting the service on a non-release date is a safe dry run: it exits without dispatching anything.
