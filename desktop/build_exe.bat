@echo off
setlocal
cd /d "%~dp0"

rem Keep this file pure ASCII with CRLF line endings.
rem cmd.exe misreads UTF-8 batch files when the console code page is switched.
set "PY=%~dp0..\.venv\Scripts\python.exe"
if not exist "%PY%" (
  echo [SpellLab] Project venv not found: %~dp0..\.venv
  echo [SpellLab] Create it from the project root with: python -m venv .venv
  echo [SpellLab] Then run this batch file again. Do NOT use the Visual Studio Python 3.9.
  pause
  exit /b 1
)

echo [SpellLab] Python: "%PY%"
echo [SpellLab] Installing / updating PyInstaller - network needed on first run...
"%PY%" -m pip install --upgrade pyinstaller
if errorlevel 1 (
  echo [SpellLab] PyInstaller install failed. Run manually:
  echo     "%PY%" -m pip install pyinstaller
  pause
  exit /b 1
)

echo [SpellLab] Building SpellLab.exe ...
"%PY%" -m PyInstaller --noconfirm --onefile --windowed --name SpellLab --add-data "..\SpellLab.html;." app.py
if errorlevel 1 (
  echo [SpellLab] Build failed. See the PyInstaller output above.
  pause
  exit /b 1
)

echo.
echo [SpellLab] Done: dist\SpellLab.exe
echo [SpellLab] Database: data\spelllab.db next to the exe.
pause
exit /b 0
