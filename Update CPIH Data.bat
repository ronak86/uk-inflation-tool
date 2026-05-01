@echo off
setlocal

cd /d "%~dp0"

set "BUNDLED_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

if not exist "Weights And Prices.xlsx" (
  echo Could not find "Weights And Prices.xlsx" in:
  echo %CD%
  echo.
  pause
  exit /b 1
)

echo Updating UK Inflation app data from "Weights And Prices.xlsx"...
echo.
echo This rebuilds:
echo   - CPI, CPIH and RPI weights/prices
echo   - 3dp headline overall indices
echo   - Definitions flags: Services, Goods, RPI Housing, Non Core, BoE Measure
echo   - web\data\cpih.json
echo   - web\data\cpih-data.js
echo.

if exist "%BUNDLED_PYTHON%" (
  "%BUNDLED_PYTHON%" scripts\export_cpih_data.py
) else (
  py -3 scripts\export_cpih_data.py
)

if errorlevel 1 (
  echo.
  echo Update failed. Check the error above.
  pause
  exit /b 1
)

echo.
echo Done. Refresh the app in your browser:
echo http://127.0.0.1:8000/?v=latest
pause
