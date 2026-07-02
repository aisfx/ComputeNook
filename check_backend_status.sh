#!/bin/bash

# 快速检查后端状态

SERVER="192.168.18.150"
PORT="8080"

echo "后端服务状态检查 ($(date))"
echo "=========================================="

# 检查进程
if ssh root@${SERVER} "pgrep -f main > /dev/null 2>&1"; then
    PID=$(ssh root@${SERVER} "pgrep -f main")
    echo "✅ 进程运行中 (PID: $PID)"
else
    echo "❌ 后端进程未运行"
    echo ""
    echo "请运行以下命令启动:"
    echo "  ./start_backend.sh"
    exit 1
fi

# 检查端口
if ssh root@${SERVER} "netstat -tln 2>/dev/null | grep -q :${PORT} || ss -tln 2>/dev/null | grep -q :${PORT}"; then
    echo "✅ 端口 ${PORT} 正在监听"
else
    echo "❌ 端口 ${PORT} 未监听"
fi

# 测试 API
echo ""
echo "API 端点测试:"
echo "----------------------------------------"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://${SERVER}:${PORT}/config.js)
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ /config.js - HTTP $HTTP_CODE"
else
    echo "❌ /config.js - HTTP $HTTP_CODE"
fi

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://${SERVER}:${PORT}/api/dashboard/stats)
if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "200" ]; then
    echo "✅ /api/dashboard/stats - HTTP $HTTP_CODE (需要认证是正常的)"
else
    echo "❌ /api/dashboard/stats - HTTP $HTTP_CODE"
fi

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://${SERVER}:${PORT}/api/login)
if [ "$HTTP_CODE" = "405" ] || [ "$HTTP_CODE" = "400" ]; then
    echo "✅ /api/login - HTTP $HTTP_CODE (方法不允许是正常的)"
else
    echo "❌ /api/login - HTTP $HTTP_CODE"
fi

echo ""
echo "最新日志 (最后10行):"
echo "----------------------------------------"
ssh root@${SERVER} "tail -10 /root/test/computenook/logs/compute-nook.log 2>/dev/null || echo '日志文件不存在'"

echo ""
echo "=========================================="
