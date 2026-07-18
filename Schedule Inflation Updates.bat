@echo off
setlocal

cd /d "%~dp0"

echo Registering scheduled UK inflation updates...
echo.
echo Note: January and February are registered as 2027 dates.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "scripts\register_inflation_update_schedule.ps1"

if errorlevel 1 (
  echo.
  echo Scheduling failed. Check the error above.
  pause
  exit /b 1
)

echo.
echo Scheduling complete.
pause
