$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$Runner = Join-Path $ProjectRoot "scripts\run_scheduled_inflation_update.ps1"

if (-not (Test-Path $Runner)) {
  throw "Could not find scheduled runner: $Runner"
}

$ReleaseDates = @(
  "2026-07-22",
  "2026-08-19",
  "2026-09-16",
  "2026-10-21",
  "2026-11-18",
  "2026-12-16",
  "2027-01-20",
  "2027-02-17"
)

$User = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$TaskPath = "\UK Inflation Tool\"

foreach ($dateText in $ReleaseDates) {
  $at = [datetime]::ParseExact("$dateText 07:05", "yyyy-MM-dd HH:mm", $null)
  $taskName = "Update UK Inflation Data $($at.ToString('yyyy-MM-dd'))"

  $existing = Get-ScheduledTask -TaskPath $TaskPath -TaskName $taskName -ErrorAction SilentlyContinue
  if ($existing) {
    Unregister-ScheduledTask -TaskPath $TaskPath -TaskName $taskName -Confirm:$false
  }

  $action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Runner`""

  $trigger = New-ScheduledTaskTrigger -Once -At $at
  $settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -MultipleInstances IgnoreNew

  Register-ScheduledTask `
    -TaskPath $TaskPath `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -User $User `
    -RunLevel Limited `
    -Description "Downloads the latest ONS workbook, rebuilds the UK inflation app data, commits it, and pushes it to GitHub Pages." | Out-Null

  Write-Host ("Registered {0} at {1}" -f $taskName, $at.ToString("dd MMM yyyy HH:mm"))
}

Write-Host ""
Write-Host "Done. These tasks run as $User. The machine needs to be on and you normally need to be signed in."
Write-Host "Logs will be written to: $(Join-Path $ProjectRoot 'logs')"
