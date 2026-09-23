@echo off
setlocal
cd /d "%~dp0"

echo.
echo DiffEye DexiNed setup
echo =====================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo Git is required to clone DexiNed.
  echo Install Git from https://git-scm.com/
  pause
  exit /b 1
)

where python >nul 2>nul
if errorlevel 1 (
  echo Python is required.
  pause
  exit /b 1
)

if not exist third_party mkdir third_party

if not exist third_party\DexiNed (
  echo Cloning DexiNed...
  git clone https://github.com/xavysp/DexiNed.git third_party\DexiNed
  if errorlevel 1 (
    echo Failed to clone DexiNed.
    pause
    exit /b 1
  )
) else (
  echo DexiNed repository already exists.
)

echo.
echo Installing DexiNed Python dependencies...
python -m pip install torch torchvision opencv-python pillow numpy matplotlib kornia h5py
if errorlevel 1 (
  echo Failed to install Python dependencies.
  pause
  exit /b 1
)

if not exist third_party\DexiNed\checkpoints\BIPED\10 mkdir third_party\DexiNed\checkpoints\BIPED\10

echo.
echo Next step: download the official DexiNed checkpoint.
echo.
echo Official DexiNed README says to download "Checkpoint Pytorch" and place it here:
echo %cd%\third_party\DexiNed\checkpoints\BIPED\10\
echo.
echo Expected file name:
echo 10_model.pth
echo.
echo Official checkpoint browser link:
echo https://drive.google.com/file/d/1V56vGTsu7GYiQouCIKvTWl5UKCZ6yCNu/view?usp=sharing
echo.
echo Model size:
echo The official README does not list the exact file size. It is a small edge-detection checkpoint,
echo typically tens of MB, not a multi-GB vision-language model.
echo After downloading, right-click the file or run:
echo powershell -NoProfile -Command "Get-Item '%cd%\third_party\DexiNed\checkpoints\BIPED\10\10_model.pth' ^| Select-Object Name,@{Name='SizeMB';Expression={[math]::Round($_.Length/1MB,2)}}"
echo.
echo Official repository:
echo https://github.com/xavysp/DexiNed
echo.
echo After placing 10_model.pth there, restart DiffEye and choose:
echo Line mode / Edge mode: Fine DexiNed
echo.
pause
