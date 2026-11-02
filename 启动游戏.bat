@echo off
chcp 65001 >nul
title 坦克大乱斗 - 本地服务器
cd /d "%~dp0game\diepcustom"

if not exist node_modules (
  echo [1/3] 首次运行，正在安装依赖（约 1-2 分钟）...
  call npm ci
  if errorlevel 1 call npm install
)
if not exist lib\index.js (
  echo [2/3] 首次运行，正在构建...
  call npm run build
)
if not exist lib\index.js (
  echo 构建失败，请检查上方报错信息。
  pause
  exit /b 1
)

echo [3/3] 启动服务器...
set PORT=8180
start "diep-server" /min cmd /c "node index.js"
timeout /t 3 >nul
start "" http://localhost:8180

echo.
echo  ================================================
echo   服务器已启动：http://localhost:8180
echo   浏览器应已自动打开游戏页面。
echo   停止服务器：任务栏找到 "diep-server" 窗口并关闭。
echo   本窗口可以关闭。
echo  ================================================
pause
