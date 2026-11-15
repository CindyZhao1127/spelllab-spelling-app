@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "PY=%~dp0..\.venv\Scripts\python.exe"
if not exist "%PY%" (
  where python >nul 2>nul
  if errorlevel 1 (
    echo 未找到 Python。请先安装 Python 3.9 或更高版本，或在项目根目录执行 python -m venv .venv
    pause
    exit /b 1
  )
  set "PY=python"
)
"%PY%" app.py %*
echo.
echo 程序已退出。
pause
