@echo off
setlocal

cd /d "%~dp0web"

set "BUNDLED_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

echo Starting CPI/CPIH Contributions app...
echo.
echo Keep this window open while using the app.
echo Open: http://127.0.0.1:8000/?v=cpi-enabled-2
echo.

if exist "%BUNDLED_PYTHON%" (
  "%BUNDLED_PYTHON%" -m http.server 8000 --bind 127.0.0.1
) else (
  py -3 -m http.server 8000 --bind 127.0.0.1
)

echo.
echo Server stopped.
pause
