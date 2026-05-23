@echo off
setlocal

cd /d "%~dp0"

set "BUNDLED_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
set "DATA_JSON=web\data\inflation.json"
set "DATA_JS=web\data\inflation-data.js"

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
echo   - %DATA_JSON%
echo   - %DATA_JS%
echo.
echo Then it commits and pushes those data files to GitHub Pages.
echo.

if exist "%BUNDLED_PYTHON%" (
  "%BUNDLED_PYTHON%" scripts\export_inflation_data.py
) else (
  py -3 scripts\export_inflation_data.py
)

if errorlevel 1 (
  echo.
  echo Update failed. Check the error above.
  pause
  exit /b 1
)

where git >nul 2>&1
if errorlevel 1 (
  echo.
  echo Git was not found on PATH, so the data was rebuilt but not pushed.
  echo Please commit and push %DATA_JSON% and %DATA_JS% manually.
  pause
  exit /b 1
)

git diff --cached --quiet
if errorlevel 1 (
  echo.
  echo There are already staged git changes.
  echo Commit or unstage those first, then run this update again.
  pause
  exit /b 1
)

git add "%DATA_JSON%" "%DATA_JS%"
if errorlevel 1 (
  echo.
  echo Could not stage the generated data files.
  pause
  exit /b 1
)

git diff --cached --quiet -- "%DATA_JSON%" "%DATA_JS%"
if not errorlevel 1 (
  echo.
  echo Data rebuilt successfully, but there are no changes to push.
  echo Refresh the app in your browser:
  echo http://127.0.0.1:8000/?v=latest
  pause
  exit /b 0
)

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set "TODAY=%%i"

git commit -m "Update inflation data %TODAY%"
if errorlevel 1 (
  echo.
  echo Could not commit the generated data files.
  pause
  exit /b 1
)

git push
if errorlevel 1 (
  echo.
  echo Commit succeeded, but push failed.
  echo Run "git push" from this folder when your connection is working.
  pause
  exit /b 1
)

echo.
echo Done. Data rebuilt, committed, and pushed.
echo Refresh the app in your browser:
echo http://127.0.0.1:8000/?v=latest
pause
