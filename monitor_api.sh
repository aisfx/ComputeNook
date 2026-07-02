#!/bin/bash

# API 监控脚本
# 用法: ./monitor_api.sh [服务器地址] [端口]

SERVER=${1:-"192.168.18.150"}
PORT=${2:-"8081"}
BASE_URL="http://${SERVER}:${PORT}"

echo "=========================================="
echo "ComputeNook API 监控工具"
echo "=========================================="
echo "目标服务器: ${BASE_URL}"
echo "开始时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. 检查服务是否可访问
echo -e "${BLUE}[1] 检查服务状态...${NC}"
if curl -s --connect-timeout 3 "${BASE_URL}" > /dev/null; then
    echo -e "${GREEN}✓ 服务可访问${NC}"
else
    echo -e "${RED}✗ 服务无法访问${NC}"
    exit 1
fi
echo ""

# 2. 获取登录 Token
echo -e "${BLUE}[2] 登录获取 Token...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin"}')

if echo "$LOGIN_RESPONSE" | grep -q "token"; then
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    echo -e "${GREEN}✓ 登录成功${NC}"
    echo "Token 前缀: ${TOKEN:0:20}..."
else
    echo -e "${RED}✗ 登录失败${NC}"
    echo "响应: $LOGIN_RESPONSE"
    exit 1
fi
echo ""

# 3. 测试 Dashboard API
echo -e "${BLUE}[3] 测试 Dashboard API...${NC}"
DASHBOARD_RESPONSE=$(curl -s "${BASE_URL}/api/dashboard" \
    -H "Authorization: Bearer ${TOKEN}")

if echo "$DASHBOARD_RESPONSE" | grep -q '"data"'; then
    echo -e "${GREEN}✓ Dashboard API 正常${NC}"
    echo "$DASHBOARD_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$DASHBOARD_RESPONSE" | head -c 200
else
    echo -e "${RED}✗ Dashboard API 异常${NC}"
    echo "响应: $DASHBOARD_RESPONSE"
fi
echo ""

# 4. 测试 Monitoring Nodes API
echo -e "${BLUE}[4] 测试 Monitoring Nodes API...${NC}"
NODES_RESPONSE=$(curl -s "${BASE_URL}/api/monitoring/nodes" \
    -H "Authorization: Bearer ${TOKEN}")

if echo "$NODES_RESPONSE" | grep -q '"data"'; then
    echo -e "${GREEN}✓ Monitoring Nodes API 正常${NC}"
    NODE_COUNT=$(echo "$NODES_RESPONSE" | grep -o '"name"' | wc -l)
    echo "节点数量: $NODE_COUNT"
else
    echo -e "${RED}✗ Monitoring Nodes API 异常${NC}"
    echo "响应: $NODES_RESPONSE"
fi
echo ""

# 5. 测试 Jobs API
echo -e "${BLUE}[5] 测试 Jobs API...${NC}"
JOBS_RESPONSE=$(curl -s "${BASE_URL}/api/jobs?limit=10" \
    -H "Authorization: Bearer ${TOKEN}")

if echo "$JOBS_RESPONSE" | grep -q '"data"'; then
    echo -e "${GREEN}✓ Jobs API 正常${NC}"
    JOB_COUNT=$(echo "$JOBS_RESPONSE" | grep -o '"job_id"' | wc -l)
    echo "作业数量: $JOB_COUNT"
else
    echo -e "${RED}✗ Jobs API 异常${NC}"
    echo "响应: $JOBS_RESPONSE"
fi
echo ""

# 6. 测试 Usage API
echo -e "${BLUE}[6] 测试 Usage API...${NC}"
USAGE_RESPONSE=$(curl -s "${BASE_URL}/api/usage/my-resources" \
    -H "Authorization: Bearer ${TOKEN}")

if echo "$USAGE_RESPONSE" | grep -q '"data"'; then
    echo -e "${GREEN}✓ Usage API 正常${NC}"
else
    echo -e "${RED}✗ Usage API 异常${NC}"
    echo "响应: $USAGE_RESPONSE"
fi
echo ""

# 7. 测试 Quota API
echo -e "${BLUE}[7] 测试 Quota API...${NC}"
QUOTA_RESPONSE=$(curl -s "${BASE_URL}/api/quota" \
    -H "Authorization: Bearer ${TOKEN}")

if echo "$QUOTA_RESPONSE" | grep -q '"data"'; then
    echo -e "${GREEN}✓ Quota API 正常${NC}"
else
    echo -e "${YELLOW}⚠ Quota API 可能未配置或无数据${NC}"
fi
echo ""

# 8. 测试 Billing Summary API
echo -e "${BLUE}[8] 测试 Billing Summary API...${NC}"
BILLING_RESPONSE=$(curl -s "${BASE_URL}/api/usage/billing-summary" \
    -H "Authorization: Bearer ${TOKEN}")

if echo "$BILLING_RESPONSE" | grep -q '"data"'; then
    echo -e "${GREEN}✓ Billing Summary API 正常${NC}"
else
    echo -e "${YELLOW}⚠ Billing Summary API 可能未配置或无数据${NC}"
fi
echo ""

# 9. 检测前端刷新频率
echo -e "${BLUE}[9] 监控前端请求频率 (10秒)...${NC}"
echo "监控 Dashboard API 调用..."

REQUEST_LOG="/tmp/computenook_requests_$$.log"
> "$REQUEST_LOG"

# 启动后台监控
ssh root@hpc "timeout 10 tcpdump -i any -n 'tcp port ${PORT} and (((ip[2:2] - ((ip[0]&0xf)<<2)) - ((tcp[12]&0xf0)>>2)) != 0)' 2>/dev/null | grep -o 'GET /api/dashboard' " > "$REQUEST_LOG" 2>&1 &
MONITOR_PID=$!

sleep 11
REQUEST_COUNT=$(wc -l < "$REQUEST_LOG" 2>/dev/null || echo "0")
rm -f "$REQUEST_LOG"

if [ "$REQUEST_COUNT" -gt 20 ]; then
    echo -e "${RED}✗ 前端刷新过于频繁！${NC}"
    echo "10秒内请求次数: $REQUEST_COUNT"
    echo -e "${YELLOW}建议检查前端 useEffect 依赖项${NC}"
else
    echo -e "${GREEN}✓ 前端刷新频率正常${NC}"
    echo "10秒内请求次数: $REQUEST_COUNT"
fi
echo ""

# 10. 总结
echo "=========================================="
echo -e "${BLUE}检测完成${NC}"
echo "=========================================="
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo "提示："
echo "- 如果发现前端刷新过快，请检查 useEffect 依赖项"
echo "- 如果 API 返回空数据，可能是 Slurm 未配置或无权限"
echo "- 查看服务器日志: ssh root@hpc 'tail -f /root/test/computenook/logs/compute-nook.log'"
echo ""
