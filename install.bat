@echo off
setlocal
cd /d "%~dp0"

echo.
echo Dayun Mural Toolkit - Chongming DiffEye installer
echo =================================================
echo.

set "PYCMD="
where py >nul 2>nul
if not errorlevel 1 set "PYCMD=py -3"
if not defined PYCMD (
  where python >nul 2>nul
  if not errorlevel 1 set "PYCMD=python"
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required.
  echo Please install Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Please reinstall Node.js with npm enabled.
  pause
  exit /b 1
)

echo Installing Node.js dependencies...
call npm.cmd install
if errorlevel 1 (
  echo npm install failed.
  pause
  exit /b 1
)

echo.
if not defined PYCMD (
  echo Python 3.9 or newer was not found.
  echo The mural-structure comparison mode needs Python with opencv-python and numpy.
  echo The pixel-diff mode works without Python, so DiffEye can still start.
  echo Install Python from https://www.python.org/downloads/ and run this script
  echo again to enable the mural mode.
) else (
  echo Installing Python image-processing dependencies...
  %PYCMD% -m pip install -r requirements.txt
  if errorlevel 1 (
    echo Python dependency installation failed.
    pause
    exit /b 1
  )
)

echo.
echo DiffEye is ready.
echo Run run.bat, then open http://127.0.0.1:5055
pause
