#!/bin/bash

echo "========================================="
echo "Starting File Manager Service"
echo "========================================="

# 检查 .env 文件是否存在
if [ ! -f .env ]; then
    echo "Error: .env file not found"
    echo "Please create .env file with required configuration"
    exit 1
fi

# 加载环境变量
source .env

# 显示配置
echo "Port: ${FILEMANAGER_PORT:-8081}"
echo "Base Path: ${FILEMANAGER_BASE_PATH:-/home}"
echo "========================================="

# 编译并运行
echo "Building..."
go build -o filemanager

if [ $? -eq 0 ]; then
    echo "Build successful!"
    echo "Starting service..."
    ./filemanager
else
    echo "Build failed!"
    exit 1
fi
