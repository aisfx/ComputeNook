#!/bin/bash

# 测试获取Slurm分区列表

source .env

echo "=== 测试 Slurm 分区 API ==="
echo "SLURM_REST_URL: $SLURM_REST_URL"
echo "SLURM_API_VERSION: $SLURM_API_VERSION"
echo ""

# 测试 /slurm/v0.0.40/partitions
echo "1. 测试 GET /slurm/$SLURM_API_VERSION/partitions"
curl -s -H "X-SLURM-USER-TOKEN: $SLURM_REST_TOKEN" \
  -H "Content-Type: application/json" \
  "$SLURM_REST_URL/slurm/$SLURM_API_VERSION/partitions" | jq '.'

echo ""
echo "=== 使用 sinfo 命令查看分区 ==="
sinfo -o "%P %a %l %D %T %N"

echo ""
echo "=== 测试完成 ==="
