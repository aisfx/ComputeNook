#!/bin/bash

# 测试资源绑定创建
# 使用方法: ./test_association.sh

echo "=== 测试资源绑定创建 ==="
echo ""

# 配置
API_URL="http://localhost:8080/api"
TOKEN="your-jwt-token-here"

# 测试1: 获取现有的Slurm用户
echo "1. 获取Slurm用户列表..."
curl -s -X GET "${API_URL}/slurm/users" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'
echo ""

# 测试2: 获取现有的Slurm账户
echo "2. 获取Slurm账户列表..."
curl -s -X GET "${API_URL}/slurm/accounts" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'
echo ""

# 测试3: 创建资源绑定（使用现有账户）
echo "3. 创建资源绑定（账户已存在）..."
curl -s -X POST "${API_URL}/slurm/associations" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "account": "root",
    "user": "testuser",
    "cluster": "cluster"
  }' \
  | jq '.'
echo ""

# 测试4: 创建资源绑定（账户不存在，应自动创建）
echo "4. 创建资源绑定（账户不存在，应自动创建）..."
curl -s -X POST "${API_URL}/slurm/associations" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "account": "test_auto_create",
    "user": "testuser",
    "cluster": "cluster"
  }' \
  | jq '.'
echo ""

# 测试5: 获取所有资源绑定
echo "5. 获取所有资源绑定..."
curl -s -X GET "${API_URL}/slurm/associations" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'
echo ""

echo "=== 测试完成 ==="
