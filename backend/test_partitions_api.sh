#!/bin/bash

# 测试后端分区API

echo "=== 测试后端分区API ==="
echo ""

# 获取token（假设已经登录）
# 这里需要先登录获取token，或者使用已有的token
TOKEN="your_jwt_token_here"

echo "1. 测试 GET /api/partitions"
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/partitions | jq '.'

echo ""
echo "=== 直接测试 Slurm REST API ==="

source .env

echo "2. 测试 GET /slurm/$SLURM_API_VERSION/partitions"
curl -s -H "X-SLURM-USER-TOKEN: $SLURM_REST_TOKEN" \
  "$SLURM_REST_URL/slurm/$SLURM_API_VERSION/partitions" | jq '.'

echo ""
echo "=== 测试完成 ==="
