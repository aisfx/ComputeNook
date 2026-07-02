#!/bin/bash

echo "=========================================="
echo "ComputeNook 后端服务诊断"
echo "=========================================="
echo ""

# 服务器地址
SERVER="192.168.18.150"
PORT="8080"

echo "1. 检查后端服务进程"
echo "----------------------------------------"
ssh root@${SERVER} "ps aux | grep -E 'main|computenook|hpc-backend' | grep -v grep"
echo ""

echo "2. 检查端口监听状态"
echo "----------------------------------------"
ssh root@${SERVER} "netstat -tlnp 2>/dev/null | grep ${PORT} || ss -tlnp 2>/dev/null | grep ${PORT}"
echo ""

echo "3. 检查 systemd 服务状态"
echo "----------------------------------------"
ssh root@${SERVER} "systemctl status computenook 2>/dev/null || echo '服务未配置为 systemd 服务'"
echo ""

echo "4. 查看最近的后端日志 (最后50行)"
echo "----------------------------------------"
ssh root@${SERVER} "tail -50 /root/test/computenook/logs/compute-nook.log 2>/dev/null || tail -50 /var/log/computenook.log 2>/dev/null || echo '日志文件未找到'"
echo ""

echo "5. 测试 API 端点"
echo "----------------------------------------"
echo "测试 /config.js:"
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://${SERVER}:${PORT}/config.js
echo ""
echo "测试 /api/dashboard/stats:"
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://${SERVER}:${PORT}/api/dashboard/stats
echo ""

echo "6. 检查防火墙规则"
echo "----------------------------------------"
ssh root@${SERVER} "iptables -L -n 2>/dev/null | grep ${PORT} || firewall-cmd --list-all 2>/dev/null | grep ${PORT} || echo '无法检查防火墙'"
echo ""

echo "7. 检查后端工作目录"
echo "----------------------------------------"
ssh root@${SERVER} "ls -la /root/test/computenook/ 2>/dev/null || echo '后端目录未找到'"
echo ""

echo "=========================================="
echo "诊断完成"
echo "=========================================="
