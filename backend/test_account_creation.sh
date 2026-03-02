#!/bin/bash

# 测试Slurm账户创建
# 使用方法: ./test_account_creation.sh

echo "=========================================="
echo "测试Slurm账户创建"
echo "=========================================="
echo ""

# 配置
API_URL="http://localhost:8080/api"
TEST_ACCOUNT="test_$(date +%s)"

echo "测试账户名: $TEST_ACCOUNT"
echo ""

# 测试1: 创建账户
echo "1. 创建Slurm账户..."
CREATE_RESPONSE=$(curl -s -X POST "${API_URL}/slurm/accounts" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"${TEST_ACCOUNT}\",
    \"description\": \"Test Account\",
    \"organization\": \"Test Org\"
  }")

echo "响应: $CREATE_RESPONSE"

if echo "$CREATE_RESPONSE" | grep -q "账户创建成功"; then
    echo "✅ 账户创建成功"
else
    echo "❌ 账户创建失败"
    echo "错误信息: $CREATE_RESPONSE"
    exit 1
fi
echo ""

# 等待一下，让Slurm处理
sleep 2

# 测试2: 验证账户存在
echo "2. 验证账户是否存在..."
ACCOUNT_RESPONSE=$(curl -s -X GET "${API_URL}/slurm/accounts")

if echo "$ACCOUNT_RESPONSE" | grep -q "\"$TEST_ACCOUNT\""; then
    echo "✅ 账户已创建: $TEST_ACCOUNT"
else
    echo "⚠️  警告: 在账户列表中未找到 $TEST_ACCOUNT"
fi
echo ""

# 测试3: 验证关联是否创建
echo "3. 验证root用户关联..."
ASSOC_RESPONSE=$(curl -s -X GET "${API_URL}/slurm/associations")

if echo "$ASSOC_RESPONSE" | grep -q "\"account\":\"$TEST_ACCOUNT\""; then
    echo "✅ 关联已创建"
    
    # 检查是否有root用户关联
    if echo "$ASSOC_RESPONSE" | grep -q "\"user\":\"root\".*\"account\":\"$TEST_ACCOUNT\""; then
        echo "✅ root用户关联已创建"
    else
        echo "⚠️  警告: 未找到root用户关联"
    fi
else
    echo "⚠️  警告: 未找到账户关联"
fi
echo ""

# 测试4: 创建用户关联
echo "4. 创建用户关联..."
USER_ASSOC_RESPONSE=$(curl -s -X POST "${API_URL}/slurm/associations" \
  -H "Content-Type: application/json" \
  -d "{
    \"account\": \"${TEST_ACCOUNT}\",
    \"user\": \"testuser\",
    \"cluster\": \"cluster\"
  }")

echo "响应: $USER_ASSOC_RESPONSE"

if echo "$USER_ASSOC_RESPONSE" | grep -q "资源绑定创建成功"; then
    echo "✅ 用户关联创建成功"
else
    echo "⚠️  用户关联创建失败（可能是testuser不存在）"
fi
echo ""

# 测试5: 清理（可选）
echo "5. 清理测试数据..."
read -p "是否删除测试账户 $TEST_ACCOUNT? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    DELETE_RESPONSE=$(curl -s -X DELETE "${API_URL}/slurm/accounts/${TEST_ACCOUNT}")
    echo "响应: $DELETE_RESPONSE"
    
    if echo "$DELETE_RESPONSE" | grep -q "账户删除成功"; then
        echo "✅ 测试账户已删除"
    else
        echo "⚠️  删除失败: $DELETE_RESPONSE"
    fi
else
    echo "保留测试账户: $TEST_ACCOUNT"
fi
echo ""

echo "=========================================="
echo "测试完成"
echo "=========================================="
echo ""
echo "提示："
echo "1. 查看后端日志以了解详细的API调用过程"
echo "2. 如果看到 [DEBUG] Fallback API request，说明使用了fallback机制"
echo "3. 如果没有看到fallback日志，说明accounts_association API工作正常"
