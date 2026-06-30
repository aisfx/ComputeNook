#!/bin/bash
# 重新编译并重启后端服务

echo "停止当前服务..."
pkill -f computenook

echo "编译新版本..."
cd /root/computenook/backend
go build -o computenook

echo "启动服务..."
nohup ./computenook > logs/computenook.log 2>&1 &

echo "等待服务启动..."
sleep 2

echo "检查服务状态..."
if pgrep -f computenook > /dev/null; then
    echo "✓ 服务启动成功"
    echo "进程信息:"
    ps aux | grep computenook | grep -v grep
else
    echo "✗ 服务启动失败"
    echo "查看日志:"
    tail -20 logs/computenook.log
fi
