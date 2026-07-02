#!/bin/bash

# 编译并部署后端到服务器

SERVER="192.168.18.150"
REMOTE_DIR="/root/test/computenook"

echo "=========================================="
echo "ComputeNook 后端部署脚本"
echo "=========================================="
echo ""

# 1. 编译后端
echo "1. 编译后端..."
cd backend
echo "清理旧的编译文件..."
rm -f main
echo "编译 Go 程序..."
GOOS=linux GOARCH=amd64 go build -o main main.go

if [ ! -f "main" ]; then
    echo "❌ 编译失败"
    exit 1
fi
echo "✅ 编译成功"
cd ..

echo ""
echo "2. 停止远程后端服务..."
ssh root@${SERVER} "pkill -f main" 2>/dev/null || true
sleep 2

echo ""
echo "3. 创建远程目录..."
ssh root@${SERVER} "mkdir -p ${REMOTE_DIR}/backend/data"
ssh root@${SERVER} "mkdir -p ${REMOTE_DIR}/logs"
ssh root@${SERVER} "mkdir -p ${REMOTE_DIR}/logs/audit"

echo ""
echo "4. 上传后端文件..."
scp backend/main root@${SERVER}:${REMOTE_DIR}/backend/
scp .env root@${SERVER}:${REMOTE_DIR}/ 2>/dev/null || echo "⚠️  .env 文件不存在，使用服务器现有配置"

echo ""
echo "5. 设置权限..."
ssh root@${SERVER} "chmod +x ${REMOTE_DIR}/backend/main"

echo ""
echo "6. 启动后端服务..."
ssh root@${SERVER} "cd ${REMOTE_DIR}/backend && nohup ./main > ../logs/compute-nook.log 2>&1 &"
sleep 3

echo ""
echo "7. 检查服务状态..."
if ssh root@${SERVER} "pgrep -f main > /dev/null"; then
    PID=$(ssh root@${SERVER} "pgrep -f main")
    echo "✅ 后端服务启动成功 (PID: $PID)"
    echo ""
    echo "监听端口:"
    ssh root@${SERVER} "netstat -tlnp 2>/dev/null | grep 8080 || ss -tlnp 2>/dev/null | grep 8080"
    echo ""
    echo "最新日志:"
    ssh root@${SERVER} "tail -20 ${REMOTE_DIR}/logs/compute-nook.log"
else
    echo "❌ 后端服务启动失败"
    echo ""
    echo "错误日志:"
    ssh root@${SERVER} "tail -50 ${REMOTE_DIR}/logs/compute-nook.log"
    exit 1
fi

echo ""
echo "8. 测试 API 访问..."
sleep 2
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://${SERVER}:8080/config.js)
echo "GET /config.js - HTTP $HTTP_CODE"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://${SERVER}:8080/api/dashboard/stats)
echo "GET /api/dashboard/stats - HTTP $HTTP_CODE"

echo ""
echo "=========================================="
echo "部署完成！"
echo ""
echo "前端访问: http://${SERVER}:8080"
echo "查看日志: ssh root@${SERVER} tail -f ${REMOTE_DIR}/logs/compute-nook.log"
echo "停止服务: ssh root@${SERVER} pkill -f main"
echo "=========================================="
