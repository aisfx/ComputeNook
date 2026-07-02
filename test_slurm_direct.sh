#!/bin/bash

# 直接测试 Slurm REST API
SERVER=${1:-"hpc"}

echo "直接测试 Slurm REST API"
echo "=============================="

# 生成 Slurm JWT Token
echo "[1] 生成 Slurm JWT Token..."
ssh root@${SERVER} '
export SLURM_JWT_KEY="YEoqs4yNYiqeL6X4CHmAokT0cm+yBr7qUT1bxsHGs2UMYI="
TOKEN=$(scontrol token lifespan=3600 username=admin 2>&1 | grep "SLURM_JWT=" | cut -d"=" -f2)
if [ -n "$TOKEN" ]; then
    echo "Token 生成成功 (前20字符): ${TOKEN:0:20}..."
    echo ""
    echo "[2] 测试 /slurm/v0.0.44/nodes API..."
    curl -s "http://localhost:6820/slurm/v0.0.44/nodes" \
        -H "X-SLURM-USER-NAME: admin" \
        -H "X-SLURM-USER-TOKEN: $TOKEN" | python3 -m json.tool | head -50
    echo ""
    echo "[3] 统计节点数..."
    NODE_COUNT=$(curl -s "http://localhost:6820/slurm/v0.0.44/nodes" \
        -H "X-SLURM-USER-NAME: admin" \
        -H "X-SLURM-USER-TOKEN: $TOKEN" | grep -o "\"name\"" | wc -l | tr -d " ")
    echo "节点总数: $NODE_COUNT"
else
    echo "Token 生成失败！"
    echo "错误信息:"
    scontrol token lifespan=3600 username=admin 2>&1
fi
'

echo ""
echo "=============================="
echo "[4] 检查后端如何生成 Token..."
ssh root@${SERVER} "cd /root/test/computenook && tail -50 logs/compute-nook.log | grep -i 'token\|slurm\|jwt' | tail -10"

echo ""
echo "=============================="
echo "提示："
echo "如果看到节点数据，说明 Slurm REST API 工作正常"
echo "问题可能在后端的 Token 生成或传递环节"
