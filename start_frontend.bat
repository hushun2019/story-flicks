@echo off
REM StoryFlicks 前端启动脚本
echo ========================================
echo      StoryFlicks 前端服务启动
echo ========================================

REM 检查是否在frontend目录
if not exist "package.json" (
    echo ❌ 错误：请在frontend目录中运行此脚本
    echo     当前目录：%CD%
    echo     请先执行：cd frontend
    pause
    exit /b 1
)

REM 检查Node.js是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误：Node.js未找到或未安装
    echo     请先安装Node.js并添加到PATH
    pause
    exit /b 1
)

REM 检查npm是否安装
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误：npm未找到或未安装
    echo     请先安装Node.js（包含npm）
    pause
    exit /b 1
)

REM 检查依赖是否安装
if not exist "node_modules" (
    echo 📦 检测到node_modules不存在，正在安装依赖...
    npm install
    if errorlevel 1 (
        echo ❌ npm install失败
        pause
        exit /b 1
    )
)

REM 启动开发服务器
echo 🚀 启动React开发服务器...
echo     访问地址：http://localhost:5173
echo.
echo 按 Ctrl+C 停止服务
echo ========================================
echo.

npm run dev

if errorlevel 1 (
    echo.
    echo ❌ 启动失败
    echo 可能原因：
    echo 1. 端口5173已被占用
    echo 2. npm依赖安装有问题
    echo 3. 缺少必要的配置文件
    echo.
    echo 💡 建议：
    echo 1. 删除node_modules并重新安装：rmdir /s /q node_modules && npm install
    echo 2. 检查package.json中的scripts配置
    echo 3. 尝试清理npm缓存：npm cache clean --force
    pause
)