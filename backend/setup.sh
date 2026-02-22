#!/bin/bash

echo "=========================================="
echo "HPC Backend 设置"
echo "=========================================="
echo ""

cd "$(dirname "$0")"

# 1. 添加执行权限
echo "1. 添加脚本执行权限..."
chmod +x *.sh
echo "✓ 完成"
echo ""

# 2. 检查 Go
echo "2. 检查 Go 安装..."
if command -v go &> /dev/null; then
    echo "✓ Go 已安装: $(go version)"
else
    echo "✗ Go 未安装"
    echo "请访问 https://golang.org/dl/ 安装 Go"
    exit 1
fi
echo ""

# 3. 检查 .env
echo "3. 检查 .env 文件..."
if [ ! -f ".env" ]; then
    echo "⚠️  .env 文件不存在"
    if [ -f ".env.example" ]; then
        echo "从 .env.example 创建 .env..."
        cp .env.example .env
        echo "✓ .env 文件已创建"
        echo "请编辑 .env 文件配置你的环境"
    else
        echo "✗ .env.example 也不存在"
        exit 1
    fi
else
    echo "✓ .env 文件存在"
fi
echo ""

# 4. 安装依赖
echo "4. 安装 Go 依赖..."
go mod download
go mod tidy
echo "✓ 依赖安装完成"
echo ""

# 5. 运行诊断
echo "5. 运行系统诊断..."
echo ""
./diagnose.sh

echo ""
echo "=========================================="
echo "设置完成！"
echo "=========================================="
echo ""
echo "下一步:"
echo "1. 检查 .env 配置: cat .env"
echo "2. 测试环境变量: go run test_env.go"
echo "3. 启动服务器: go run main.go"
echo ""
echo "或者运行完整测试:"
echo "  ./run_tests.sh"
