@echo off
echo ======================================
echo 启动 GoWebSocket IM 系统
echo ======================================

REM 检查Go环境
where go >nul 2>nul
if errorlevel 1 (
    echo 错误: 未找到Go环境，请先安装Go
    pause
    exit /b 1
)

REM 检查配置文件
if not exist "config\app.yaml" (
    echo 错误: 配置文件 config\app.yaml 不存在
    pause
    exit /b 1
)

echo 1. 检查依赖...
go mod tidy

echo 2. 启动后端服务...
echo    - HTTP服务: http://127.0.0.1:8080
echo    - WebSocket服务: ws://127.0.0.1:8089/acc
echo    - 原有页面: http://127.0.0.1:8080/home/index

REM 启动Go服务
start "GoWebSocket Backend" go run main.go

echo 后端服务已启动

REM 等待服务启动
timeout /t 3 /nobreak >nul

echo.
echo 3. API接口测试:
echo    登录: curl -X POST http://127.0.0.1:8080/api/auth/login -d "userID=10001&appID=101"
echo    用户列表: curl http://127.0.0.1:8080/user/list?appID=101
echo.
echo 前端页面:
echo    原有界面: http://127.0.0.1:8080/home/index
echo    Vue2界面: http://localhost:3000 (需要手动启动)
echo.
echo ======================================
echo 系统启动完成！
echo ======================================
echo 若要启动Vue2前端，请在frontend目录下运行:
echo    npm install
echo    npm run serve
echo.
pause