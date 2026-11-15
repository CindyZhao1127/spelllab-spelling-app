@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "PY=%~dp0..\.venv\Scripts\python.exe"
if not exist "%PY%" set "PY=python"
echo 正在准备打包环境（首次需要联网安装 PyInstaller）...
"%PY%" -m pip install --upgrade pyinstaller
if errorlevel 1 (
  echo PyInstaller 安装失败，请检查网络或手动执行 pip install pyinstaller
  pause
  exit /b 1
)
"%PY%" -m PyInstaller --noconfirm --onefile --windowed ^
  --name SpellLab ^
  --add-data "..\SpellLab.html;." ^
  app.py
if errorlevel 1 (
  echo 打包失败
  pause
  exit /b 1
)
echo.
echo 完成：dist\SpellLab.exe
echo 数据文件默认在 exe 同目录的 data\spelllab.db；若该目录不可写，会回退到 %%APPDATA%%\SpellLab\
pause
