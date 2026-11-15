@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo 未找到 python 命令。请先安装 Python 3.9 或更高版本，并勾选 "Add Python to PATH"。
  echo 也可以直接运行： py app.py
  pause
  exit /b 1
)
python app.py %*
echo.
echo 程序已退出。
pause
