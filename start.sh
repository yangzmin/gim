#!/bin/bash

echo "======================================"
echo "启动 GoWebSocket IM 系统"
echo "======================================"

# 检查Go环境
if ! command -v go &> /dev/null; then
    echo "错误: 未找到Go环境，请先安装Go"
    exit 1
fi

# 检查Redis是否运行
if ! command -v redis-cli &> /dev/null; then
    echo "警告: 未找到Redis，请确保Redis已安装并运行"
fi

# 检查配置文件
if [ ! -f "config/app.yaml" ]; then
    echo "错误: 配置文件 config/app.yaml 不存在"
    exit 1
fi

echo "1. 检查依赖..."
go mod tidy

echo "2. 启动后端服务..."
echo "   - HTTP服务: http://127.0.0.1:8080"
echo "   - WebSocket服务: ws://127.0.0.1:8089/acc"
echo "   - 原有页面: http://127.0.0.1:8080/home/index"

# 后台启动Go服务
nohup go run main.go > log/server.log 2>&1 &
GO_PID=$!
echo "后端服务已启动 (PID: $GO_PID)"

# 等待服务启动
sleep 3

# 检查服务是否启动成功
if curl -s http://127.0.0.1:8080/system/state > /dev/null; then
    echo "✓ 后端服务启动成功"
else
    echo "✗ 后端服务启动失败，请检查日志"
    exit 1
fi

echo ""
echo "3. 启动前端开发服务器..."
echo "   注意: 请确保已安装Node.js和npm"

cd frontend

if [ ! -f "package.json" ]; then
    echo "错误: 前端项目未初始化"
    exit 1
fi

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo "   安装前端依赖..."
    npm install
fi

echo "   Vue前端服务: http://localhost:3000"
npm run serve

echo ""
echo "======================================"
echo "系统启动完成！"
echo "======================================"
echo "API接口测试:"
echo "  登录: curl -X POST http://127.0.0.1:8080/api/auth/login -d 'userID=10001&appID=101'"
echo "  用户列表: curl http://127.0.0.1:8080/user/list?appID=101"
echo ""
echo "前端页面:"
echo "  原有界面: http://127.0.0.1:8080/home/index"
echo "  Vue2界面: http://localhost:3000"
echo ""
echo "按 Ctrl+C 停止服务"