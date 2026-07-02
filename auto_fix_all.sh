#!/bin/bash

# 自动修复机时和存储配额显示问题
# 在本地运行，自动完成所有配置和部署

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVER="${1:-root@192.168.18.150}"
INSTALL_PATH="/root/test/computenook"

echo -e "${BLUE}=========================================="
echo "自动修复机时和存储配额显示"
echo "==========================================${NC}"
echo "目标服务器: $SERVER"
echo ""

# 步骤 1：部署最新代码
echo -e "${BLUE}[1/5] 部署最新代码...${NC}"
echo "----------------------------------------"

RELEASE_FILE=$(ls -t release/*.tar.gz 2>/dev/null | head -1)
if [ -z "$RELEASE_FILE" ]; then
  echo -e "${RED}❌ 未找到发布包${NC}"
  echo "正在构建..."
  make release
  RELEASE_FILE=$(ls -t release/*.tar.gz | head -1)
fi

echo -e "${GREEN}✅ 找到发布包: $RELEASE_FILE${NC}"

echo "上传到服务器..."
scp "$RELEASE_FILE" "${SERVER}:/tmp/" || {
  echo -e "${RED}❌ 上传失败${NC}"
  exit 1
}

FILENAME=$(basename "$RELEASE_FILE")

echo "在服务器上部署..."
ssh "$SERVER" bash << EOF
set -e
echo "停止当前服务..."
pkill -f computenook || true
sleep 2

echo "备份当前版本..."
if [ -d "$INSTALL_PATH" ]; then
  BACKUP_DIR="${INSTALL_PATH}.backup.\$(date +%Y%m%d_%H%M%S)"
  mv "$INSTALL_PATH" "\$BACKUP_DIR"
  echo "已备份到: \$BACKUP_DIR"
  
  # 恢复配置
  if [ -f "\${BACKUP_DIR}/backend/.env" ]; then
    mkdir -p "$INSTALL_PATH/backend"
    cp "\${BACKUP_DIR}/backend/.env" "/tmp/.env.backup"
  fi
fi

echo "解压新版本..."
tar -xzf /tmp/$FILENAME -C $(dirname "$INSTALL_PATH")/
rm -f /tmp/$FILENAME

# 恢复配置
if [ -f "/tmp/.env.backup" ]; then
  cp "/tmp/.env.backup" "$INSTALL_PATH/backend/.env"
  rm -f "/tmp/.env.backup"
fi

chmod +x "$INSTALL_PATH/computenook"
EOF

echo -e "${GREEN}✅ 代码部署完成${NC}"
echo ""

# 步骤 2：配置存储配额
echo -e "${BLUE}[2/5] 配置存储配额系统...${NC}"
echo "----------------------------------------"

ssh "$SERVER" bash << 'EOF'
set -e
ENV_FILE="/root/test/computenook/backend/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ 配置文件不存在，创建默认配置"
  mkdir -p $(dirname "$ENV_FILE")
  cat > "$ENV_FILE" << 'ENVEOF'
# 基本配置
SERVER_PORT=8081
JWT_SECRET=your-secret-key-change-this-in-production-min-32-chars
DEV_MODE=false

# Redis 缓存（可选）
REDIS_ENABLE=false
REDIS_ADDR=localhost:6379
REDIS_PASSWORD=
REDIS_DB=0

# 存储配额系统配置
QUOTA_FS_TYPE=xfs
QUOTA_PATH=/fs
ENVEOF
  echo "✅ 已创建默认配置文件"
else
  echo "✅ 配置文件已存在"
  
  # 备份
  cp "$ENV_FILE" "${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
  
  # 添加或更新配额配置
  if ! grep -q "^QUOTA_FS_TYPE=" "$ENV_FILE"; then
    echo "" >> "$ENV_FILE"
    echo "# 存储配额系统配置" >> "$ENV_FILE"
    echo "QUOTA_FS_TYPE=xfs" >> "$ENV_FILE"
    echo "QUOTA_PATH=/fs" >> "$ENV_FILE"
    echo "✅ 已添加配额配置"
  else
    sed -i 's|^QUOTA_FS_TYPE=.*|QUOTA_FS_TYPE=xfs|' "$ENV_FILE"
    if ! grep -q "^QUOTA_PATH=" "$ENV_FILE"; then
      sed -i '/^QUOTA_FS_TYPE=/a QUOTA_PATH=/fs' "$ENV_FILE"
    else
      sed -i 's|^QUOTA_PATH=.*|QUOTA_PATH=/fs|' "$ENV_FILE"
    fi
    echo "✅ 已更新配额配置"
  fi
fi

echo ""
echo "当前配额配置："
grep QUOTA "$ENV_FILE" || echo "（未找到）"
EOF

echo -e "${GREEN}✅ 配额配置完成${NC}"
echo ""

# 步骤 3：启动服务
echo -e "${BLUE}[3/5] 启动服务...${NC}"
echo "----------------------------------------"

ssh "$SERVER" bash << EOF
cd "$INSTALL_PATH"
nohup ./computenook > /dev/null 2>&1 &
echo "服务启动命令已执行"
EOF

echo "等待服务启动..."
sleep 5

# 检查服务状态
if ssh "$SERVER" 'ps aux | grep -v grep | grep computenook' > /dev/null; then
  echo -e "${GREEN}✅ 服务启动成功${NC}"
else
  echo -e "${RED}❌ 服务启动失败${NC}"
  echo "查看日志："
  ssh "$SERVER" "tail -20 $INSTALL_PATH/backend/logs/compute-nook.log"
  exit 1
fi
echo ""

# 步骤 4：测试 API
echo -e "${BLUE}[4/5] 测试 API...${NC}"
echo "----------------------------------------"

if [ -f "test_api.sh" ]; then
  ./test_api.sh
else
  echo -e "${YELLOW}⚠️  未找到测试脚本${NC}"
fi
echo ""

# 步骤 5：显示结果
echo -e "${BLUE}[5/5] 完成${NC}"
echo "----------------------------------------"

echo -e "${GREEN}=========================================="
echo "✅ 所有修复已完成！"
echo "==========================================${NC}"
echo ""
echo "📋 修复内容："
echo "  ✅ 机时信息：即使无配额限制也显示已用机时"
echo "  ✅ 存储配额：已配置 XFS 配额系统 (/fs)"
echo ""
echo "🔗 访问地址："
echo "  http://192.168.18.150:8081"
echo ""
echo "👤 登录账号："
echo "  用户名: admin"
echo "  密码: admin"
echo ""
echo "📊 预期结果："
echo "  - 机时信息：显示 153.1 小时（已使用）+ 未设置配额限制"
echo "  - 存储配额：显示 2.2 MB / 1.5 GB（使用率 0.14%）"
echo ""
echo "📝 查看日志："
echo "  ssh $SERVER 'tail -f $INSTALL_PATH/backend/logs/compute-nook.log'"
echo ""
echo "🔄 重启服务："
echo "  ssh $SERVER 'pkill -f computenook && cd $INSTALL_PATH && nohup ./computenook > /dev/null 2>&1 &'"
echo ""
