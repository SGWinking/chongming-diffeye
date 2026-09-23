@echo off
cd /d "%~dp0"
echo Starting DiffEye...
echo Server will be available at http://localhost:5055

start "DiffEye Server" cmd /k "cd /d "%~dp0" && npm.cmd start"

echo Waiting for server to be ready...
set /a tries=0
:waitloop
timeout /t 1 /nobreak >nul
set /a tries+=1
powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://localhost:5055/health' -UseBasicParsing -TimeoutSec 2).StatusCode } catch { exit 1 }" >nul 2>nul
if errorlevel 1 (
  if %tries% lss 30 goto waitloop
  echo Server did not become ready in 30 seconds.
  echo Please check the DiffEye Server window for errors.
  pause
  exit /b 1
)

echo Server is ready. Opening browser...
start "" "http://localhost:5055"
echo.
echo DiffEye is running. Close the "DiffEye Server" window to stop it.
echo This window can be closed safely.
timeout /t 5 /nobreak >nul
