#!/bin/bash

# API对应关系测试脚本
# 用途: 验证前后端API路由是否完全对应
# 使用: bash test_api_alignment.sh

BASE_URL="http://localhost:8080"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "前后端API对应关系测试"
echo "========================================"
echo ""

# 测试函数
test_route() {
    local method=$1
    local path=$2
    local expected=$3
    local desc=$4
    
    echo -n "测试 $method $path ... "
    
    if [ "$method" = "GET" ]; then
        status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$path" 2>/dev/null)
    elif [ "$method" = "POST" ]; then
        status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL$path" 2>/dev/null)
    elif [ "$method" = "DELETE" ]; then
        status=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL$path" 2>/dev/null)
    fi
    
    if [ "$status" = "$expected" ]; then
        echo -e "${GREEN}✓${NC} [$status] $desc"
        return 0
    else
        echo -e "${RED}✗${NC} [$status, 期望:$expected] $desc"
        return 1
    fi
}

passed=0
failed=0

echo "1. 测试已移除的路由 (应该返回404)"
echo "----------------------------------------"
test_route GET "/api/cmdb/hosts" "404" "CMDB已移除" && ((passed++)) || ((failed++))
echo ""

echo "2. 测试文件管理别名路由 (应该返回403需认证)"
echo "----------------------------------------"
test_route GET "/api/filemanager/list" "403" "文件管理别名" && ((passed++)) || ((failed++))
test_route GET "/api/files/list" "403" "文件管理主路由" && ((passed++)) || ((failed++))
echo ""

echo "3. 测试WebShell别名路由 (开发模式可能返回200)"
echo "----------------------------------------"
status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/webshell/has-key" 2>/dev/null)
if [ "$status" = "200" ] || [ "$status" = "403" ]; then
    echo -e "${GREEN}✓${NC} [$status] WebShell has-key别名"
    ((passed++))
else
    echo -e "${RED}✗${NC} [$status] WebShell has-key别名"
    ((failed++))
fi

status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/webshell/keys/check" 2>/dev/null)
if [ "$status" = "200" ] || [ "$status" = "403" ]; then
    echo -e "${GREEN}✓${NC} [$status] WebShell主路由"
    ((passed++))
else
    echo -e "${RED}✗${NC} [$status] WebShell主路由"
    ((failed++))
fi
echo ""

echo "4. 测试报表中心API (应该返回200/500,不是404)"
echo "----------------------------------------"
status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/reports/jobs" 2>/dev/null)
if [ "$status" != "404" ]; then
    echo -e "${GREEN}✓${NC} [$status] 报表-作业统计"
    ((passed++))
else
    echo -e "${RED}✗${NC} [$status] 报表-作业统计"
    ((failed++))
fi

status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/reports/usage" 2>/dev/null)
if [ "$status" != "404" ]; then
    echo -e "${GREEN}✓${NC} [$status] 报表-核时统计"
    ((passed++))
else
    echo -e "${RED}✗${NC} [$status] 报表-核时统计"
    ((failed++))
fi

status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/reports/storage" 2>/dev/null)
if [ "$status" != "404" ]; then
    echo -e "${GREEN}✓${NC} [$status] 报表-存储统计"
    ((passed++))
else
    echo -e "${RED}✗${NC} [$status] 报表-存储统计"
    ((failed++))
fi
echo ""

echo "5. 测试核心功能路由 (开发模式返回200正常)"
echo "----------------------------------------"
status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/me" 2>/dev/null)
if [ "$status" = "200" ] || [ "$status" = "403" ]; then
    echo -e "${GREEN}✓${NC} [$status] 当前用户信息"
    ((passed++))
else
    echo -e "${RED}✗${NC} [$status] 当前用户信息"
    ((failed++))
fi

status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/jobs" 2>/dev/null)
if [ "$status" = "200" ] || [ "$status" = "403" ]; then
    echo -e "${GREEN}✓${NC} [$status] 作业列表"
    ((passed++))
else
    echo -e "${RED}✗${NC} [$status] 作业列表"
    ((failed++))
fi

status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/dashboard/stats" 2>/dev/null)
if [ "$status" != "404" ]; then
    echo -e "${GREEN}✓${NC} [$status] 仪表盘统计"
    ((passed++))
else
    echo -e "${RED}✗${NC} [$status] 仪表盘统计"
    ((failed++))
fi

status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/desktop/sessions" 2>/dev/null)
if [ "$status" = "200" ] || [ "$status" = "403" ]; then
    echo -e "${GREEN}✓${NC} [$status] 远程桌面会话"
    ((passed++))
else
    echo -e "${RED}✗${NC} [$status] 远程桌面会话"
    ((failed++))
fi
echo ""

echo "6. 测试管理员路由 (开发模式返回200正常)"
echo "----------------------------------------"
status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/users" 2>/dev/null)
if [ "$status" = "200" ] || [ "$status" = "403" ]; then
    echo -e "${GREEN}✓${NC} [$status] 用户管理"
    ((passed++))
else
    echo -e "${RED}✗${NC} [$status] 用户管理"
    ((failed++))
fi

status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/groups" 2>/dev/null)
if [ "$status" = "200" ] || [ "$status" = "403" ]; then
    echo -e "${GREEN}✓${NC} [$status] 用户组管理"
    ((passed++))
else
    echo -e "${RED}✗${NC} [$status] 用户组管理"
    ((failed++))
fi

status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/slurm/accounts" 2>/dev/null)
if [ "$status" = "200" ] || [ "$status" = "403" ]; then
    echo -e "${GREEN}✓${NC} [$status] Slurm账户"
    ((passed++))
else
    echo -e "${RED}✗${NC} [$status] Slurm账户"
    ((failed++))
fi

status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/qos" 2>/dev/null)
if [ "$status" = "200" ] || [ "$status" = "403" ]; then
    echo -e "${GREEN}✓${NC} [$status] QoS管理"
    ((passed++))
else
    echo -e "${RED}✗${NC} [$status] QoS管理"
    ((failed++))
fi

status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/partitions" 2>/dev/null)
if [ "$status" = "200" ] || [ "$status" = "403" ]; then
    echo -e "${GREEN}✓${NC} [$status] 分区管理"
    ((passed++))
else
    echo -e "${RED}✗${NC} [$status] 分区管理"
    ((failed++))
fi
echo ""

echo "========================================"
echo "测试结果汇总"
echo "========================================"
echo -e "通过: ${GREEN}$passed${NC}"
echo -e "失败: ${RED}$failed${NC}"
total=$((passed + failed))
percentage=$((passed * 100 / total))
echo "通过率: $percentage%"
echo ""

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✓ 所有测试通过! 前后端API完全对应!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠ 有 $failed 个测试失败,请检查!${NC}"
    exit 1
fi
