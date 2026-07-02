#!/bin/bash

# 一键修复配额配置 - 在服务器上运行
# 使用方法: ssh root@192.168.18.150 'bash -s' < quick_fix_quota.sh

echo "=========================================="
echo "一键配置存储配额"
echo "=========================================="

ENV_FILE="/root/test/computenook/backend/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ 未找到配置文件: $ENV_FILE"
    exit 1
fi

echo "✅ 找到配置文件: $ENV_FILE"

# 备份
cp "$ENV_FILE" "${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
echo "✅ 已备份配置文件"

# 添加配额配置
if ! grep -q "^QUOTA_FS_TYPE=" "$ENV_FILE"; then
    echo "" >> "$ENV_FILE"
    echo "# 存储配额系统配置" >> "$ENV_FILE"
    echo "QUOTA_FS_TYPE=xfs" >> "$ENV_FILE"
    echo "QUOTA_PATH=/fs" >> "$ENV_FILE"
    echo "✅ 已添加配额配置"
else
    sed -i 's|^QUOTA_FS_TYPE=.*|QUOTA_FS_TYPE=xfs|' "$ENV_FILE"
    sed -i 's|^QUOTA_PATH=.*|QUOTA_PATH=/fs|' "$ENV_FILE"
    echo "✅ 已更新配额配置"
fi

echo ""
echo "当前配置："
grep -E "^QUOTA_" "$ENV_FILE" || echo "（未找到配额配置）"

echo ""
echo "=========================================="
echo "✅ 配置完成！"
echo "=========================================="
echo ""
echo "现在需要重启服务："
echo "  pkill -f computenook"
echo "  cd /root/test/computenook && nohup ./computenook > /dev/null 2>&1 &"
echo ""
