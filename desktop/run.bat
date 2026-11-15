@echo off
setlocal
cd /d "%~dp0"

rem Share the same database with the packaged exe (dist\SpellLab.exe).
if not defined SPELLLAB_DB set "SPELLLAB_DB=%~dp0dist\data\spelllab.db"

rem Keep this file pure ASCII with CRLF line endings.
rem cmd.exe misreads UTF-8 batch files when the console code page is switched.
set "PY=%~dp0..\.venv\Scripts\python.exe"
if not exist "%PY%" (
  echo [SpellLab] Project venv not found: %~dp0..\.venv
  echo [SpellLab] Create it from the project root with: python -m venv .venv
  where python >nul 2>nul
  if errorlevel 1 (
    echo [SpellLab] No Python on PATH. Install Python 3.9+ first.
    pause
    exit /b 1
  )
  set "PY=python"
)

echo [SpellLab] Python: "%PY%"
"%PY%" app.py %*
set "RC=%errorlevel%"
echo.
if not "%RC%"=="0" echo [SpellLab] Exited with code %RC%. Use --no-browser to keep only the server.
echo [SpellLab] Finished.
pause
exit /b %RC%
