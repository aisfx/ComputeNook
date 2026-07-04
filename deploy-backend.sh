#!/bin/bash
# 容器作业识别功能 - 后端快速部署脚本

set -e

# 配置
SERVER="192.168.18.150"
SERVER_USER="root"
SERVER_PATH="/opt/computenook"  # 修改为实际的服务器路径
SERVICE_NAME="computenook"

echo "🔨 编译后端..."
cd backend
go build -o computenook

echo "📦 准备部署文件..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🔄 连接到服务器 $SERVER..."

# 上传新二进制文件
echo "📤 上传新文件..."
scp computenook ${SERVER_USER}@${SERVER}:${SERVER_PATH}/computenook.new

# 在服务器上执行部署
echo "🚀 部署中..."
ssh ${SERVER_USER}@${SERVER} << 'ENDSSH'
cd /opt/computenook  # 修改为实际的服务器路径

# 备份旧文件
if [ -f computenook ]; then
    BACKUP_NAME="computenook.backup.$(date +%Y%m%d_%H%M%S)"
    echo "💾 备份旧文件为 $BACKUP_NAME"
    cp computenook $BACKUP_NAME
fi

# 停止服务
echo "⏹️  停止服务..."
systemctl stop computenook 2>/dev/null || pkill -f computenook || true
sleep 2

# 替换文件
echo "🔄 替换文件..."
mv computenook.new computenook
chmod +x computenook

# 启动服务
echo "▶️  启动服务..."
systemctl start computenook 2>/dev/null || nohup ./computenook > logs/backend.log 2>&1 &

# 等待服务启动
sleep 3

# 检查服务状态
if pgrep -f computenook > /dev/null; then
    echo "✅ 服务启动成功"
    ps aux | grep computenook | grep -v grep
else
    echo "❌ 服务启动失败"
    exit 1
fi
ENDSSH

echo ""
echo "🎉 部署完成！"
echo ""
echo "📋 下一步："
echo "1. 验证 API: curl http://$SERVER:8081/api/health"
echo "2. 检查日志: ssh $SERVER_USER@$SERVER 'tail -f $SERVER_PATH/logs/backend.log'"
echo "3. 刷新前端页面测试功能"
echo ""
