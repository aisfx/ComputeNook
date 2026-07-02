#!/bin/bash

# 修复配额配置
# 在服务器上运行此脚本以配置存储配额功能

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "=========================================="
echo "配置存储配额系统"
echo "=========================================="

# 检测配额系统
echo ""
echo "1. 检测配额系统..."
echo "----------------------------------------"

if command -v xfs_quota &> /dev/null; then
    echo -e "${GREEN}✅ 检测到 XFS 配额系统${NC}"
    FS_TYPE="xfs"
    
    # 查找 XFS 挂载点
    echo ""
    echo "XFS 文件系统挂载点："
    df -T | grep xfs | awk '{print $1 " -> " $7}'
    
    echo ""
    read -p "请输入配额挂载点（例如 /fs）: " QUOTA_PATH
    
    if [ -z "$QUOTA_PATH" ]; then
        echo -e "${RED}❌ 挂载点不能为空${NC}"
        exit 1
    fi
    
    # 测试配额查询
    echo ""
    echo "2. 测试配额查询..."
    echo "----------------------------------------"
    
    # 尝试查询 admin 用户的配额
    if xfs_quota -x -c "report -ubih" "$QUOTA_PATH" 2>/dev/null | grep -q "admin"; then
        echo -e "${GREEN}✅ 配额查询成功${NC}"
        echo ""
        echo "admin 用户的配额信息："
        xfs_quota -x -c "report -ubih" "$QUOTA_PATH" | grep -A1 "^User ID"
    else
        echo -e "${YELLOW}⚠️  配额查询可能需要 root 权限${NC}"
    fi
    
elif command -v quota &> /dev/null; then
    echo -e "${GREEN}✅ 检测到通用配额系统（可能是 NFS）${NC}"
    FS_TYPE="nfs"
    
    echo ""
    read -p "请输入配额挂载点（例如 /home）: " QUOTA_PATH
    
    if [ -z "$QUOTA_PATH" ]; then
        echo -e "${RED}❌ 挂载点不能为空${NC}"
        exit 1
    fi
    
elif command -v lfs &> /dev/null; then
    echo -e "${GREEN}✅ 检测到 Lustre 文件系统${NC}"
    FS_TYPE="lustre"
    
    echo ""
    read -p "请输入 Lustre 挂载点（例如 /lustre）: " QUOTA_PATH
    
    if [ -z "$QUOTA_PATH" ]; then
        echo -e "${RED}❌ 挂载点不能为空${NC}"
        exit 1
    fi
    
else
    echo -e "${RED}❌ 未检测到配额系统${NC}"
    echo ""
    echo "请先安装配额工具："
    echo "  - XFS: xfsprogs"
    echo "  - NFS: quota"
    echo "  - Lustre: lustre-client"
    exit 1
fi

# 查找 .env 文件
echo ""
echo "3. 更新配置文件..."
echo "----------------------------------------"

ENV_FILE=""
if [ -f "/root/test/computenook/backend/.env" ]; then
    ENV_FILE="/root/test/computenook/backend/.env"
elif [ -f "backend/.env" ]; then
    ENV_FILE="backend/.env"
elif [ -f ".env" ]; then
    ENV_FILE=".env"
else
    echo -e "${RED}❌ 未找到 .env 配置文件${NC}"
    exit 1
fi

echo "找到配置文件: $ENV_FILE"

# 备份配置文件
cp "$ENV_FILE" "${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
echo "已备份配置文件"

# 更新或添加配额配置
if grep -q "^QUOTA_FS_TYPE=" "$ENV_FILE"; then
    sed -i "s|^QUOTA_FS_TYPE=.*|QUOTA_FS_TYPE=$FS_TYPE|" "$ENV_FILE"
    echo "已更新 QUOTA_FS_TYPE=$FS_TYPE"
else
    echo "" >> "$ENV_FILE"
    echo "# 存储配额系统配置" >> "$ENV_FILE"
    echo "QUOTA_FS_TYPE=$FS_TYPE" >> "$ENV_FILE"
    echo "已添加 QUOTA_FS_TYPE=$FS_TYPE"
fi

if grep -q "^QUOTA_PATH=" "$ENV_FILE"; then
    sed -i "s|^QUOTA_PATH=.*|QUOTA_PATH=$QUOTA_PATH|" "$ENV_FILE"
    echo "已更新 QUOTA_PATH=$QUOTA_PATH"
else
    echo "QUOTA_PATH=$QUOTA_PATH" >> "$ENV_FILE"
    echo "已添加 QUOTA_PATH=$QUOTA_PATH"
fi

echo ""
echo -e "${GREEN}=========================================="
echo "✅ 配置完成！"
echo "==========================================${NC}"
echo ""
echo "配置信息："
echo "  - 文件系统类型: $FS_TYPE"
echo "  - 挂载点: $QUOTA_PATH"
echo "  - 配置文件: $ENV_FILE"
echo ""
echo "下一步："
echo "  1. 重启服务: pkill -f computenook && cd /root/test/computenook && ./computenook"
echo "  2. 测试 API: curl -H 'Authorization: Bearer YOUR_TOKEN' http://localhost:8081/api/quota"
echo ""
