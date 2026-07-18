@echo off
setlocal

cd /d "%~dp0"

set "BUNDLED_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

echo Updating "Weights And Prices.xlsx" from ONS detailed reference tables...
echo.

if "%~1"=="" (
  echo No local ONS workbook was supplied.
  echo Downloading the latest ONS workbook from the standard ONS URL.
  echo.
  if exist "%BUNDLED_PYTHON%" (
    "%BUNDLED_PYTHON%" scripts\update_workbook_from_ons.py --download
  ) else (
    py -3 scripts\update_workbook_from_ons.py --download
  )
) else (
  echo Using local ONS workbook:
  echo %~1
  echo.
  if exist "%BUNDLED_PYTHON%" (
    "%BUNDLED_PYTHON%" scripts\update_workbook_from_ons.py --ons "%~1"
  ) else (
    py -3 scripts\update_workbook_from_ons.py --ons "%~1"
  )
)

if errorlevel 1 (
  echo.
  echo Workbook update failed. Check the error above.
  pause
  exit /b 1
)

echo.
echo Workbook update complete.
echo A timestamped backup was created before saving.
echo.
echo To push the website live, run:
echo Update Inflation Data.bat
pause
