#!/bin/bash

# 部署 ComputeNook 到远程服务器
# 使用方法: ./deploy_to_server.sh [server_address]

set -e

# 配置
SERVER="${1:-root@192.168.18.150}"
INSTALL_PATH="/root/test/computenook"
PORT="8081"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "=========================================="
echo "部署 ComputeNook 到远程服务器"
echo "=========================================="
echo "目标服务器: $SERVER"
echo "安装路径: $INSTALL_PATH"
echo "端口: $PORT"
echo ""

# 查找最新的发布包
RELEASE_FILE=$(ls -t release/*.tar.gz 2>/dev/null | head -1)

if [ -z "$RELEASE_FILE" ]; then
  echo -e "${RED}❌ 未找到发布包，请先运行 'make release' 构建${NC}"
  exit 1
fi

echo -e "${GREEN}✅ 找到发布包: $RELEASE_FILE${NC}"
FILE_SIZE=$(du -h "$RELEASE_FILE" | cut -f1)
echo "   大小: $FILE_SIZE"
echo ""

# 1. 上传发布包到服务器
echo "=========================================="
echo "1. 上传发布包到服务器..."
echo "=========================================="
scp "$RELEASE_FILE" "${SERVER}:/tmp/" || {
  echo -e "${RED}❌ 上传失败${NC}"
  exit 1
}
echo -e "${GREEN}✅ 上传完成${NC}"
echo ""

# 2. 在服务器上部署
echo "=========================================="
echo "2. 在服务器上部署..."
echo "=========================================="

FILENAME=$(basename "$RELEASE_FILE")

ssh "$SERVER" bash << EOF
set -e

echo "停止当前服务..."
pkill -f computenook || echo "服务未运行"
sleep 2

echo "备份当前版本..."
if [ -d "$INSTALL_PATH" ]; then
  BACKUP_DIR="${INSTALL_PATH}.backup.\$(date +%Y%m%d_%H%M%S)"
  mv "$INSTALL_PATH" "\$BACKUP_DIR"
  echo "已备份到: \$BACKUP_DIR"
fi

echo "解压新版本..."
mkdir -p $(dirname "$INSTALL_PATH")
tar -xzf /tmp/$FILENAME -C $(dirname "$INSTALL_PATH")/
rm -f /tmp/$FILENAME

echo "恢复配置文件..."
if [ -f "\${BACKUP_DIR}/backend/.env" ]; then
  cp "\${BACKUP_DIR}/backend/.env" "$INSTALL_PATH/backend/.env"
  echo "已恢复 .env 配置"
else
  echo "⚠️  未找到旧的 .env 配置文件"
fi

echo "设置权限..."
chmod +x "$INSTALL_PATH/computenook"
chmod +x "$INSTALL_PATH/install.sh" 2>/dev/null || true

echo ""
echo "=========================================="
echo "部署完成！"
echo "=========================================="
echo "安装路径: $INSTALL_PATH"
echo ""
echo "启动服务: cd $INSTALL_PATH && ./computenook"
echo "查看日志: tail -f $INSTALL_PATH/backend/logs/compute-nook.log"
echo "访问地址: http://\$(hostname -I | awk '{print \$1}'):$PORT"
echo ""
EOF

echo -e "${GREEN}✅ 部署完成！${NC}"
echo ""
echo "=========================================="
echo "下一步操作"
echo "=========================================="
echo "1. SSH 到服务器: ssh $SERVER"
echo "2. 启动服务: cd $INSTALL_PATH && ./computenook"
echo "3. 测试访问: http://192.168.18.150:$PORT"
echo ""
echo "或者使用一键启动命令："
echo "ssh $SERVER 'cd $INSTALL_PATH && nohup ./computenook > /dev/null 2>&1 &'"
echo ""
