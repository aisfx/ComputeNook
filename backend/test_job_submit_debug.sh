#!/bin/bash

# 测试作业提交并输出详细日志
# 用于调试USER环境变量问题

echo "=========================================="
echo "测试作业提交 - 调试模式"
echo "=========================================="

# 配置
BACKEND_URL="http://localhost:8080"
USERNAME="sunfx"
PASSWORD="your_password"

# 1. 登录获取token
echo ""
echo "步骤1: 登录获取JWT token..."
LOGIN_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}")

echo "登录响应: $LOGIN_RESPONSE"

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ 登录失败，无法获取token"
    exit 1
fi

echo "✓ 登录成功"
echo "Token: ${TOKEN:0:50}..."

# 2. 提交作业
echo ""
echo "步骤2: 提交测试作业..."
JOB_SCRIPT='#!/bin/bash
echo "User: $USER"
echo "Home: $HOME"
whoami
id
env | grep USER
sleep 10
'

SUBMIT_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/jobs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"name\": \"debug_test\",
    \"partition\": \"slurm-bridge\",
    \"script\": \"${JOB_SCRIPT}\",
    \"nodes\": 1,
    \"cpus\": 1
  }")

echo "提交响应: $SUBMIT_RESPONSE"

JOB_ID=$(echo $SUBMIT_RESPONSE | grep -o '"job_id":[0-9]*' | cut -d':' -f2)

if [ -z "$JOB_ID" ]; then
    echo "❌ 作业提交失败"
    exit 1
fi

echo "✓ 作业提交成功: Job ID = $JOB_ID"

# 3. 查看后端日志
echo ""
echo "步骤3: 查看后端日志（最后50行）..."
echo "=========================================="
tail -50 logs/backend.log | grep -A 5 -B 5 "SUBMIT JOB\|JOB SUBMISSION\|USER environment"
echo "=========================================="

# 4. 等待作业运行
echo ""
echo "步骤4: 等待作业运行（5秒）..."
sleep 5

# 5. 查询作业详情
echo ""
echo "步骤5: 查询作业详情..."
JOB_DETAIL=$(curl -s -X GET "${BACKEND_URL}/api/jobs/${JOB_ID}" \
  -H "Authorization: Bearer ${TOKEN}")

echo "作业详情: $JOB_DETAIL"

# 6. 检查作业输出文件
echo ""
echo "步骤6: 检查作业输出文件..."
echo "注意: 需要在Slurm服务器上查看输出文件"
echo "输出文件位置: /fs/home/${USERNAME}/slurm-${JOB_ID}.out"
echo ""
echo "在Slurm服务器上运行:"
echo "  ssh root@192.168.5.250"
echo "  cat /fs/home/${USERNAME}/slurm-${JOB_ID}.out"

echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="
