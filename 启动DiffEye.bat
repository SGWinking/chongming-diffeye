@echo off
setlocal
cd /d "%~dp0"

set "PYTHON310=%~dp0runtime\python\python.exe"
set "PYTHONPATH=%~dp0runtime\python"
set "PATH=%~dp0runtime\node;%PATH%"
set "PORT=5055"

title DiffEye Launcher

if not exist "%~dp0runtime\node\node.exe" (
  echo [ERROR] Node.js not found: %~dp0runtime\node\node.exe
  echo Please re-download or fully extract the DiffEye folder.
  pause
  exit /b 1
)

if not exist "%~dp0runtime\python\python.exe" (
  echo [ERROR] Python not found: %~dp0runtime\python\python.exe
  echo Please re-download or fully extract the DiffEye folder.
  pause
  exit /b 1
)

echo ====================================
echo   DiffEye  ChongMing  V0.4
echo ====================================
echo.
echo Starting server...
echo Browser will open at http://localhost:5055
echo.

start "DiffEye Server" /min "%~dp0runtime\node\node.exe" "%~dp0server.js"

set /a tries=0
:waitloop
timeout /t 1 /nobreak >nul
set /a tries+=1
powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://localhost:5055/health' -UseBasicParsing -TimeoutSec 2).StatusCode } catch { exit 1 }" >nul 2>nul
if errorlevel 1 (
  if %tries% lss 40 goto waitloop
  echo.
  echo [ERROR] Server did not start within 40 seconds.
  echo The DiffEye Server window may show an error. Please check it.
  pause
  exit /b 1
)

echo Server is ready. Opening browser...
start "" "http://localhost:5055"
echo.
echo ====================================
echo  DiffEye is running in the background.
echo  Browser: http://localhost:5055
echo  Press any key to STOP and exit.
echo ====================================
pause >nul

echo Stopping server...
powershell -NoProfile -Command "Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*DiffEye*' -or $_.Path -like '%~dp0*' } | Stop-Process -Force"
taskkill /FI "WINDOWTITLE eq DiffEye Server" /F >nul 2>nul
echo Stopped.
timeout /t 2 /nobreak >nul
