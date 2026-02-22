#!/bin/bash

echo "=========================================="
echo "HPC Backend 启动"
echo "=========================================="
echo ""

# 检查 Go
if ! command -v go &> /dev/null; then
    echo "❌ Go 未安装"
    exit 1
fi

echo "✓ Go 版本: $(go version)"

# 检查 .env
if [ ! -f ".env" ]; then
    echo "❌ .env 文件不存在"
    exit 1
fi

echo "✓ .env 文件存在"
echo ""

# 安装依赖
echo "安装依赖..."
go mod download
go mod tidy

echo ""
echo "=========================================="
echo "启动服务器"
echo "=========================================="
echo ""

# 运行
go run main.go
