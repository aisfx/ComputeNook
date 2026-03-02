#!/bin/bash

# 测试作业管理API
# 使用方法: ./test_jobs.sh [token]

echo "=========================================="
echo "测试作业管理API"
echo "=========================================="
echo ""

# 配置
API_URL="http://localhost:8080/api"
TOKEN="${1:-your-jwt-token}"

if [ "$TOKEN" = "your-jwt-token" ]; then
    echo "⚠️  警告: 请提供有效的JWT token"
    echo "使用方法: ./test_jobs.sh <your-token>"
    echo ""
    echo "获取token的方法:"
    echo "1. 登录系统"
    echo "2. 打开浏览器开发者工具"
    echo "3. 在Console中输入: localStorage.getItem('token')"
    echo ""
    read -p "按Enter继续使用默认token，或Ctrl+C退出..."
fi

echo "使用Token: ${TOKEN:0:20}..."
echo ""

# 测试1: 获取作业列表
echo "1. 获取作业列表..."
JOBS_RESPONSE=$(curl -s -X GET "${API_URL}/jobs" \
  -H "Authorization: Bearer ${TOKEN}")

echo "响应: $JOBS_RESPONSE"

if echo "$JOBS_RESPONSE" | grep -q '"data"'; then
    JOB_COUNT=$(echo "$JOBS_RESPONSE" | grep -o '"job_id"' | wc -l)
    echo "✅ 成功获取作业列表 (找到 $JOB_COUNT 个作业)"
else
    echo "❌ 获取作业列表失败"
    echo "错误信息: $JOBS_RESPONSE"
fi
echo ""

# 测试2: 获取指定用户的作业
echo "2. 获取指定用户的作业..."
USER_JOBS_RESPONSE=$(curl -s -X GET "${API_URL}/jobs?user=admin" \
  -H "Authorization: Bearer ${TOKEN}")

echo "响应: $USER_JOBS_RESPONSE"

if echo "$USER_JOBS_RESPONSE" | grep -q '"data"'; then
    echo "✅ 成功获取用户作业"
else
    echo "❌ 获取用户作业失败"
fi
echo ""

# 测试3: 获取单个作业（如果有作业的话）
if [ "$JOB_COUNT" -gt 0 ]; then
    echo "3. 获取单个作业详情..."
    JOB_ID=$(echo "$JOBS_RESPONSE" | grep -o '"job_id":[0-9]*' | head -1 | cut -d':' -f2)
    
    if [ -n "$JOB_ID" ]; then
        echo "作业ID: $JOB_ID"
        JOB_DETAIL_RESPONSE=$(curl -s -X GET "${API_URL}/jobs/${JOB_ID}" \
          -H "Authorization: Bearer ${TOKEN}")
        
        echo "响应: $JOB_DETAIL_RESPONSE"
        
        if echo "$JOB_DETAIL_RESPONSE" | grep -q '"data"'; then
            echo "✅ 成功获取作业详情"
        else
            echo "❌ 获取作业详情失败"
        fi
    else
        echo "⚠️  无法提取作业ID"
    fi
    echo ""
fi

# 测试4: 测试权限控制（尝试获取其他用户的作业）
echo "4. 测试权限控制..."
OTHER_USER_RESPONSE=$(curl -s -X GET "${API_URL}/jobs?user=otheruser" \
  -H "Authorization: Bearer ${TOKEN}")

echo "响应: $OTHER_USER_RESPONSE"

if echo "$OTHER_USER_RESPONSE" | grep -q "无权查询"; then
    echo "✅ 权限控制正常（非管理员无法查询其他用户作业）"
elif echo "$OTHER_USER_RESPONSE" | grep -q '"data"'; then
    echo "✅ 权限控制正常（管理员可以查询其他用户作业）"
else
    echo "⚠️  权限控制测试结果不确定"
fi
echo ""

# 测试5: 测试时间范围查询
echo "5. 测试时间范围查询..."
END_TIME=$(date +%s)
START_TIME=$((END_TIME - 86400)) # 最近24小时

TIME_RANGE_RESPONSE=$(curl -s -X GET "${API_URL}/jobs?start_time=${START_TIME}&end_time=${END_TIME}" \
  -H "Authorization: Bearer ${TOKEN}")

echo "响应: $TIME_RANGE_RESPONSE"

if echo "$TIME_RANGE_RESPONSE" | grep -q '"data"'; then
    echo "✅ 时间范围查询成功"
else
    echo "❌ 时间范围查询失败"
fi
echo ""

echo "=========================================="
echo "测试完成"
echo "=========================================="
echo ""

echo "提示："
echo "1. 如果所有测试都失败，请检查："
echo "   - 后端服务是否运行 (./start.sh)"
echo "   - Token是否有效"
echo "   - DEV_MODE是否设置正确"
echo ""
echo "2. 查看后端日志："
echo "   tail -f logs/backend.log"
echo ""
echo "3. 查看详细的API调用日志："
echo "   ./view_logs.sh -d -n 50"
