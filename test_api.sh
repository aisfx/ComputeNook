#!/bin/bash

# 测试 ComputeNook API 是否返回正确的数据
# 使用方法: ./test_api.sh

SERVER="http://192.168.18.150:8081"
USERNAME="admin"
PASSWORD="admin"

echo "=========================================="
echo "测试 ComputeNook API"
echo "=========================================="

# 1. 登录获取 token
echo ""
echo "1. 登录..."
LOGIN_RESPONSE=$(curl -s -X POST "${SERVER}/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ 登录失败"
  echo "响应: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ 登录成功"
echo "Token: ${TOKEN:0:20}..."

# 2. 测试机时信息 API
echo ""
echo "2. 测试机时信息 API (/api/usage/billing-summary)..."
BILLING_RESPONSE=$(curl -s -X GET "${SERVER}/api/usage/billing-summary" \
  -H "Authorization: Bearer ${TOKEN}")

echo "响应:"
echo "$BILLING_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$BILLING_RESPONSE"

# 检查是否有数据
if echo "$BILLING_RESPONSE" | grep -q '"data"'; then
  DATA_COUNT=$(echo "$BILLING_RESPONSE" | grep -o '"qos_name"' | wc -l)
  if [ "$DATA_COUNT" -gt 0 ]; then
    echo "✅ 机时信息返回 $DATA_COUNT 条记录"
  else
    echo "⚠️  机时信息返回空数据"
  fi
else
  echo "❌ 机时信息 API 返回格式错误"
fi

# 3. 测试存储配额 API
echo ""
echo "3. 测试存储配额 API (/api/quota)..."
QUOTA_RESPONSE=$(curl -s -X GET "${SERVER}/api/quota" \
  -H "Authorization: Bearer ${TOKEN}")

echo "响应:"
echo "$QUOTA_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$QUOTA_RESPONSE"

# 检查是否有数据
if echo "$QUOTA_RESPONSE" | grep -q '"data"'; then
  if echo "$QUOTA_RESPONSE" | grep -q '"quota_used"'; then
    echo "✅ 存储配额有数据"
  else
    echo "⚠️  存储配额返回空数据"
  fi
else
  echo "❌ 存储配额 API 返回格式错误"
fi

# 4. 测试 Dashboard API
echo ""
echo "4. 测试 Dashboard API (/api/dashboard)..."
DASHBOARD_RESPONSE=$(curl -s -X GET "${SERVER}/api/dashboard" \
  -H "Authorization: Bearer ${TOKEN}")

echo "响应:"
echo "$DASHBOARD_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$DASHBOARD_RESPONSE"

if echo "$DASHBOARD_RESPONSE" | grep -q '"nodes"'; then
  echo "✅ Dashboard API 正常"
else
  echo "❌ Dashboard API 返回格式错误"
fi

# 5. 测试节点信息 API
echo ""
echo "5. 测试节点信息 API (/api/monitoring/nodes)..."
NODES_RESPONSE=$(curl -s -X GET "${SERVER}/api/monitoring/nodes" \
  -H "Authorization: Bearer ${TOKEN}")

echo "响应:"
echo "$NODES_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$NODES_RESPONSE"

if echo "$NODES_RESPONSE" | grep -q '"name"'; then
  NODE_COUNT=$(echo "$NODES_RESPONSE" | grep -o '"name"' | wc -l)
  echo "✅ 节点信息返回 $NODE_COUNT 个节点"
else
  echo "❌ 节点信息 API 返回格式错误"
fi

echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="
