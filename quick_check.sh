#!/bin/bash

# 快速检测脚本
SERVER=${1:-"192.168.18.150"}
PORT=${2:-"8081"}

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "快速检测 ${SERVER}:${PORT}"
echo "=============================="

# 登录
echo -n "登录测试... "
TOKEN=$(curl -s -X POST "http://${SERVER}:${PORT}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ 登录失败${NC}"
    exit 1
fi

# Dashboard API
echo -n "Dashboard API... "
DASH=$(curl -s "http://${SERVER}:${PORT}/api/dashboard" -H "Authorization: Bearer ${TOKEN}")
if echo "$DASH" | grep -q '"nodes"'; then
    NODES=$(echo "$DASH" | grep -o '"nodes":[0-9]*' | grep -o '[0-9]*')
    echo -e "${GREEN}✓${NC} (节点数: $NODES)"
else
    echo -e "${RED}✗${NC}"
    echo "响应: $DASH"
fi

# Monitoring Nodes API
echo -n "Monitoring Nodes API... "
MON=$(curl -s "http://${SERVER}:${PORT}/api/monitoring/nodes" -H "Authorization: Bearer ${TOKEN}")
if echo "$MON" | grep -q '"data"'; then
    COUNT=$(echo "$MON" | grep -o '"name"' | wc -l | tr -d ' ')
    echo -e "${GREEN}✓${NC} (节点: $COUNT)"
else
    echo -e "${RED}✗${NC}"
fi

# Jobs API
echo -n "Jobs API... "
JOBS=$(curl -s "http://${SERVER}:${PORT}/api/jobs?limit=5" -H "Authorization: Bearer ${TOKEN}")
if echo "$JOBS" | grep -q '"data"'; then
    JOB_COUNT=$(echo "$JOBS" | grep -o '"job_id"' | wc -l | tr -d ' ')
    echo -e "${GREEN}✓${NC} (作业: $JOB_COUNT)"
else
    echo -e "${RED}✗${NC}"
fi

# Usage API
echo -n "Usage Resources API... "
USAGE=$(curl -s "http://${SERVER}:${PORT}/api/usage/my-resources" -H "Authorization: Bearer ${TOKEN}")
if echo "$USAGE" | grep -q '"data"'; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

# Billing Summary API
echo -n "Billing Summary API... "
BILLING=$(curl -s "http://${SERVER}:${PORT}/api/usage/billing-summary" -H "Authorization: Bearer ${TOKEN}")
if echo "$BILLING" | grep -q '"data"'; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠${NC} (可能无数据)"
fi

# Quota API
echo -n "Quota API... "
QUOTA=$(curl -s "http://${SERVER}:${PORT}/api/quota" -H "Authorization: Bearer ${TOKEN}")
if echo "$QUOTA" | grep -q '"data"'; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠${NC} (可能无数据)"
fi

echo ""
echo "=============================="
echo -e "${GREEN}基础检测完成${NC}"
echo ""
echo "详细检查请运行: ./monitor_api.sh ${SERVER} ${PORT}"
