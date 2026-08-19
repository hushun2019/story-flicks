@echo off
REM StoryFlicks 后端启动脚本
echo ========================================
echo      StoryFlicks 后端服务启动
echo ========================================

REM 检查是否在正确的目录
if not exist "main.py" (
    echo ❌ 错误：请在backend目录中运行此脚本
    echo     当前目录：%CD%
    echo     请先执行：cd backend
    pause
    exit /b 1
)

REM 检查Python环境
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误：Python未找到或未安装
    echo     请先安装Python并添加到PATH
    pause
    exit /b 1
)

REM 检查uvicorn是否安装
python -c "import uvicorn" >nul 2>&1
if errorlevel 1 (
    echo ⚠️  uvicorn未安装，正在安装...
    pip install uvicorn fastapi
    if errorlevel 1 (
        echo ❌ 安装失败
        pause
        exit /b 1
    )
)

REM 检查依赖是否安装
if exist "requirements.txt" (
    echo 📦 检查Python依赖...
    python -c "import app" >nul 2>&1
    if errorlevel 1 (
        echo ⚠️  依赖可能未安装，建议运行：pip install -r requirements.txt
    )
)

REM 启动服务
echo 🚀 启动FastAPI服务...
echo     访问地址：http://localhost:8000
echo     API文档：http://localhost:8000/docs
echo.
echo 按 Ctrl+C 停止服务
echo ========================================
echo.

uvicorn main:app --reload --host 0.0.0.0 --port 8000

if errorlevel 1 (
    echo.
    echo ❌ 启动失败
    echo 可能原因：
    echo 1. 端口8000已被占用
    echo 2. 依赖包未正确安装
    echo 3. .env配置文件缺失
    echo.
    echo 💡 建议：
    echo 1. 运行：pip install -r requirements.txt
    echo 2. 检查 .env 文件是否存在
    echo 3. 尝试其他端口：uvicorn main:app --reload --port 8001
    pause
)