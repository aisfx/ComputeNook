#!/bin/bash

# ComputeNook 后端启动脚本

SERVER="192.168.18.150"
BACKEND_DIR="/root/test/computenook/backend"
LOG_FILE="/root/test/computenook/logs/compute-nook.log"

echo "=========================================="
echo "ComputeNook 后端启动脚本"
echo "=========================================="
echo ""

echo "1. 检查后端是否已运行"
RUNNING=$(ssh root@${SERVER} "pgrep -f 'main|computenook' | wc -l")
if [ "$RUNNING" -gt 0 ]; then
    echo "⚠️  后端服务已在运行 (PID: $(ssh root@${SERVER} 'pgrep -f main'))"
    echo "是否需要重启? (y/N)"
    read -r RESTART
    if [[ "$RESTART" =~ ^[Yy]$ ]]; then
        echo "停止现有服务..."
        ssh root@${SERVER} "pkill -f 'main|computenook'"
        sleep 2
    else
        echo "保持现有服务运行"
        exit 0
    fi
fi

echo ""
echo "2. 检查后端目录和文件"
ssh root@${SERVER} "if [ ! -d ${BACKEND_DIR} ]; then echo '❌ 后端目录不存在: ${BACKEND_DIR}'; exit 1; fi"
ssh root@${SERVER} "if [ ! -f ${BACKEND_DIR}/main ]; then echo '❌ 后端可执行文件不存在: ${BACKEND_DIR}/main'; exit 1; fi"
echo "✅ 后端文件检查通过"

echo ""
echo "3. 检查配置文件"
ssh root@${SERVER} "if [ ! -f /root/test/computenook/.env ]; then echo '⚠️  .env 文件不存在，将使用默认配置'; fi"

echo ""
echo "4. 创建日志目录"
ssh root@${SERVER} "mkdir -p /root/test/computenook/logs"
ssh root@${SERVER} "mkdir -p /root/test/computenook/backend/data"

echo ""
echo "5. 启动后端服务"
ssh root@${SERVER} "cd ${BACKEND_DIR} && nohup ./main > ${LOG_FILE} 2>&1 &"
sleep 3

echo ""
echo "6. 检查服务状态"
RUNNING=$(ssh root@${SERVER} "pgrep -f main | wc -l")
if [ "$RUNNING" -gt 0 ]; then
    echo "✅ 后端服务启动成功 (PID: $(ssh root@${SERVER} 'pgrep -f main'))"
    echo ""
    echo "监听端口:"
    ssh root@${SERVER} "netstat -tlnp 2>/dev/null | grep 8080 || ss -tlnp 2>/dev/null | grep 8080"
    echo ""
    echo "最新日志:"
    ssh root@${SERVER} "tail -20 ${LOG_FILE}"
else
    echo "❌ 后端服务启动失败"
    echo ""
    echo "错误日志:"
    ssh root@${SERVER} "tail -50 ${LOG_FILE}"
    exit 1
fi

echo ""
echo "7. 测试 API 访问"
sleep 2
echo "测试 /config.js:"
curl -s http://${SERVER}:8080/config.js | head -5
echo ""
echo "测试 /api/dashboard/stats:"
curl -s http://${SERVER}:8080/api/dashboard/stats

echo ""
echo "=========================================="
echo "后端启动完成！"
echo "访问地址: http://${SERVER}:8080"
echo "查看日志: ssh root@${SERVER} tail -f ${LOG_FILE}"
echo "=========================================="
