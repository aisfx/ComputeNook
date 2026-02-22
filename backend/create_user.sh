#!/bin/bash

echo "=========================================="
echo "创建 sunfx 用户"
echo "=========================================="
echo ""

# 检查服务器是否运行
if ! curl -s http://localhost:8080/api/login > /dev/null 2>&1; then
    echo "❌ 后端服务器未运行"
    echo "请先启动服务器: ./start.sh"
    exit 1
fi

echo "✓ 后端服务器正在运行"
echo ""

# 创建用户（开发模式下自动有管理员权限）
echo "创建用户 sunfx..."
curl -X POST http://localhost:8080/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "sunfx",
    "uid": 10001,
    "gid": 10001,
    "cnName": "孙凤霞",
    "email": "sunfx@thhpc.cn",
    "phone": "13800138000",
    "shell": "/bin/bash",
    "homeDir": "/home/sunfx",
    "password": "sunfx"
  }'

echo ""
echo ""
echo "=========================================="
echo "测试登录"
echo "=========================================="
echo ""

# 测试登录
curl -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "sunfx",
    "password": "sunfx"
  }'

echo ""
echo ""
echo "✓ 完成！"
