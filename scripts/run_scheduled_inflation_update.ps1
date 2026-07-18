param(
  [switch]$SkipPush
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot

$LogDir = Join-Path $ProjectRoot "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir ("scheduled-inflation-update-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))

function Write-Log {
  param([string]$Message)
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Write-Host $line
  Add-Content -Path $LogFile -Value $line
}

function Run-Step {
  param(
    [string]$Label,
    [string]$FilePath,
    [string[]]$Arguments
  )

  Write-Log $Label
  $output = & $FilePath @Arguments 2>&1
  foreach ($line in $output) {
    Add-Content -Path $LogFile -Value $line
  }
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE. See $LogFile"
  }
}

$BundledPython = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if (Test-Path $BundledPython) {
  $Python = $BundledPython
} else {
  $Python = "py"
}

try {
  Write-Log "Starting scheduled UK inflation update."
  Write-Log "Project root: $ProjectRoot"

  if ($Python -eq "py") {
    Run-Step "Downloading ONS workbook and updating Weights And Prices.xlsx..." $Python @("-3", "-u", "scripts\update_workbook_from_ons.py", "--download")
    Run-Step "Rebuilding web data..." $Python @("-3", "scripts\export_inflation_data.py")
  } else {
    Run-Step "Downloading ONS workbook and updating Weights And Prices.xlsx..." $Python @("-u", "scripts\update_workbook_from_ons.py", "--download")
    Run-Step "Rebuilding web data..." $Python @("scripts\export_inflation_data.py")
  }

  if ($SkipPush) {
    Write-Log "SkipPush supplied; data rebuilt but not committed or pushed."
    exit 0
  }

  Run-Step "Staging generated web data..." "git" @("add", "web\data\inflation.json", "web\data\inflation-data.js")

  & git diff --cached --quiet -- "web\data\inflation.json" "web\data\inflation-data.js"
  if ($LASTEXITCODE -eq 0) {
    Write-Log "No generated data changes to commit."
    exit 0
  }

  $today = Get-Date -Format "yyyy-MM-dd"
  Run-Step "Committing generated web data..." "git" @("commit", "-m", "Update inflation data $today")
  Run-Step "Pushing generated web data to GitHub..." "git" @("push")

  Write-Log "Scheduled UK inflation update complete."
} catch {
  Write-Log ("ERROR: " + $_.Exception.Message)
  exit 1
}
