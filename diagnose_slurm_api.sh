#!/bin/bash

# Slurm REST API 诊断脚本
SERVER=${1:-"hpc"}

echo "=========================================="
echo "Slurm REST API 诊断工具"
echo "=========================================="
echo "服务器: $SERVER"
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. 检查后端日志中的 Slurm 配置
echo -e "${BLUE}[1] 检查后端 Slurm 配置...${NC}"
ssh root@${SERVER} "cd /root/test/computenook && grep -E 'SLURM|SLURMRESTD' .env | grep -v '^#'"
echo ""

# 2. 检查 slurmrestd 服务状态
echo -e "${BLUE}[2] 检查 slurmrestd 服务...${NC}"
ssh root@${SERVER} "systemctl status slurmrestd 2>&1 | head -15"
echo ""

# 3. 检查 slurmrestd 端口
echo -e "${BLUE}[3] 检查端口监听...${NC}"
ssh root@${SERVER} "netstat -tlnp 2>/dev/null | grep 6820 || ss -tlnp | grep 6820"
echo ""

# 4. 测试 Slurm REST API 连接
echo -e "${BLUE}[4] 测试 Slurm REST API...${NC}"

# 尝试不同的可能地址
SLURM_URLS=(
    "http://localhost:6820"
    "http://127.0.0.1:6820"
    "http://hpc:6820"
)

for URL in "${SLURM_URLS[@]}"; do
    echo -n "测试 $URL ... "
    RESPONSE=$(ssh root@${SERVER} "curl -s -w '%{http_code}' -o /tmp/slurm_test.json $URL/slurm/v0.0.40/nodes 2>&1")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ 成功${NC}"
        NODE_COUNT=$(ssh root@${SERVER} "cat /tmp/slurm_test.json 2>/dev/null | grep -o '\"name\"' | wc -l | tr -d ' '")
        echo "  节点数: $NODE_COUNT"
        echo "  响应预览:"
        ssh root@${SERVER} "cat /tmp/slurm_test.json 2>/dev/null | head -c 300"
        echo ""
        echo ""
        WORKING_URL="$URL"
        break
    elif [ "$HTTP_CODE" = "000" ]; then
        echo -e "${RED}✗ 连接失败${NC}"
    else
        echo -e "${YELLOW}⚠ HTTP $HTTP_CODE${NC}"
    fi
done

if [ -z "$WORKING_URL" ]; then
    echo -e "${RED}所有 Slurm REST API 地址都无法访问${NC}"
    echo ""
    echo "可能的原因："
    echo "1. slurmrestd 服务未启动"
    echo "2. 端口配置不正确"
    echo "3. 防火墙阻止连接"
    echo "4. Slurm 未正确安装"
    echo ""
    echo "解决方案："
    echo "- 启动服务: systemctl start slurmrestd"
    echo "- 检查配置: cat /etc/slurm/slurm.conf"
    echo "- 查看日志: journalctl -u slurmrestd -n 50"
    exit 1
fi

echo ""

# 5. 检查后端日志中的 Slurm 错误
echo -e "${BLUE}[5] 检查后端日志中的 Slurm 错误...${NC}"
ssh root@${SERVER} "cd /root/test/computenook && tail -100 logs/compute-nook.log | grep -i 'slurm\|node\|GetNodes' | tail -20"
echo ""

# 6. 检查后端是否使用正确的 Slurm URL
echo -e "${BLUE}[6] 验证后端配置...${NC}"
BACKEND_SLURM_URL=$(ssh root@${SERVER} "cd /root/test/computenook && grep SLURM_REST_URL .env | cut -d'=' -f2")
echo "后端配置的 Slurm URL: $BACKEND_SLURM_URL"

if [ "$BACKEND_SLURM_URL" != "$WORKING_URL" ] && [ -n "$WORKING_URL" ]; then
    echo -e "${YELLOW}⚠ 配置不匹配！${NC}"
    echo -e "${YELLOW}建议修改 .env 文件中的 SLURM_REST_URL=${WORKING_URL}${NC}"
else
    echo -e "${GREEN}✓ 配置正确${NC}"
fi
echo ""

# 7. 测试 JWT Token 生成
echo -e "${BLUE}[7] 检查 Slurm JWT Token...${NC}"
ssh root@${SERVER} "cd /root/test/computenook && grep -E 'SLURM.*TOKEN|JWT' .env | grep -v '^#'"
echo ""

# 8. 总结和建议
echo "=========================================="
echo -e "${BLUE}诊断总结${NC}"
echo "=========================================="

if [ -n "$WORKING_URL" ]; then
    echo -e "${GREEN}✓ Slurm REST API 可访问${NC}"
    echo ""
    echo "下一步："
    echo "1. 确认后端 .env 中的 SLURM_REST_URL=$WORKING_URL"
    echo "2. 重启后端服务"
    echo "3. 检查后端日志: tail -f /root/test/computenook/logs/compute-nook.log"
    echo "4. 使用浏览器访问 Dashboard 查看是否有数据"
else
    echo -e "${RED}✗ Slurm REST API 不可用${NC}"
    echo ""
    echo "需要先解决 Slurm REST API 连接问题"
fi

echo ""
