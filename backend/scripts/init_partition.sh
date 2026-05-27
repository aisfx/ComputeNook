#!/bin/bash

# Slurm 分区配置初始化脚本
# 用于快速创建示例分区配置

set -e

# 配置变量
API_URL="${API_URL:-http://localhost:8080}"
TOKEN="${ADMIN_TOKEN}"

if [ -z "$TOKEN" ]; then
    echo "错误: 请设置 ADMIN_TOKEN 环境变量"
    echo "用法: ADMIN_TOKEN=your_token ./init_partition.sh"
    exit 1
fi

echo "=========================================="
echo "Slurm 分区配置初始化"
echo "=========================================="
echo "API URL: $API_URL"
echo ""

# 创建默认分区 "all"
echo "1. 创建默认分区 'all'..."
curl -X POST "$API_URL/api/partitions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "all",
    "nodes": "ALL",
    "over_subscribe": "Exclusive",
    "is_default": true,
    "max_time": "INFINITE",
    "state": "UP",
    "allow_groups": "root,test1,hpc-admin",
    "allow_accounts": "root,test1,hpc-admin",
    "tres_billing_weights": "node=0,CPU=1.0,mem=1.0G"
  }' | jq .

echo ""
echo "2. 创建 GPU 分区 'gpu'..."
curl -X POST "$API_URL/api/partitions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "gpu",
    "nodes": "gpu[01-04]",
    "over_subscribe": "NO",
    "is_default": false,
    "max_time": "7-00:00:00",
    "state": "UP",
    "allow_groups": "gpu-users,hpc-admin",
    "allow_accounts": "gpu-account,hpc-admin",
    "tres_billing_weights": "node=0,CPU=1.0,mem=1.0G,gres/gpu=10.0"
  }' | jq .

echo ""
echo "3. 创建高优先级分区 'high'..."
curl -X POST "$API_URL/api/partitions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "high",
    "nodes": "node[01-10]",
    "over_subscribe": "NO",
    "is_default": false,
    "max_time": "3-00:00:00",
    "state": "UP",
    "allow_groups": "vip-users,hpc-admin",
    "allow_accounts": "vip-account,hpc-admin",
    "tres_billing_weights": "node=0,CPU=2.0,mem=2.0G"
  }' | jq .

echo ""
echo "4. 查看所有分区配置..."
curl -X GET "$API_URL/api/partitions" \
  -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "5. 应用配置到 Slurm..."
curl -X POST "$API_URL/api/partitions/apply" \
  -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=========================================="
echo "分区配置初始化完成！"
echo "=========================================="
echo ""
echo "可以使用以下命令验证："
echo "  scontrol show partition"
echo ""
