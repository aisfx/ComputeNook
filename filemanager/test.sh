#!/bin/bash

echo "========================================="
echo "File Manager Service - Quick Test"
echo "========================================="

# 检查服务是否运行
echo "Checking if service is running..."
if curl -s http://localhost:8081/health > /dev/null; then
    echo "✓ Service is running"
else
    echo "✗ Service is not running"
    echo "Please start the service first: ./filemanager-linux-amd64"
    exit 1
fi

echo ""
echo "Testing API endpoints..."
echo ""

# 测试列出目录
echo "1. Testing list directory (/)..."
curl -s "http://localhost:8081/api/files/list?path=/" | jq '.' || echo "Failed"
echo ""

# 测试列出 /home
echo "2. Testing list directory (/home)..."
curl -s "http://localhost:8081/api/files/list?path=/home" | jq '.' || echo "Failed"
echo ""

# 测试健康检查
echo "3. Testing health check..."
curl -s "http://localhost:8081/health" | jq '.'
echo ""

echo "========================================="
echo "Test complete!"
echo "========================================="
echo ""
echo "Current configuration:"
echo "  BASE_PATH: ${FILEMANAGER_BASE_PATH:-/home}"
echo "  PORT: ${FILEMANAGER_PORT:-8081}"
echo ""
echo "To change configuration, edit .env file"
