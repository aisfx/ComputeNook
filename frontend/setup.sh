#!/bin/bash

# 算力小筑前端快速设置脚本

set -e

echo "=================================="
echo "  算力小筑 - 前端快速设置"
echo "=================================="
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未安装 Node.js"
    echo "请访问 https://nodejs.org/ 安装 Node.js"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✓ Node.js 版本: $NODE_VERSION"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 未安装 npm"
    exit 1
fi

NPM_VERSION=$(npm -v)
echo "✓ npm 版本: $NPM_VERSION"
echo ""

# 安装依赖
echo "📦 安装依赖包..."
echo ""

if npm install; then
    echo ""
    echo "✓ 依赖安装成功"
else
    echo ""
    echo "❌ 依赖安装失败"
    echo "尝试使用国内镜像:"
    echo "  npm config set registry https://registry.npmmirror.com"
    echo "  然后重新运行此脚本"
    exit 1
fi

echo ""
echo "=================================="
echo "  设置完成！"
echo "=================================="
echo ""
echo "启动开发服务器:"
echo "  npm run dev"
echo ""
echo "构建生产版本:"
echo "  npm run build"
echo ""
echo "预览构建结果:"
echo "  npm run preview"
echo ""
echo "访问地址: http://localhost:3000"
echo ""
