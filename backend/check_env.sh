#!/bin/bash

echo "=========================================="
echo "检查环境变量"
echo "=========================================="
echo ""

cd "$(dirname "$0")"

if [ ! -f ".env" ]; then
    echo "❌ .env 文件不存在"
    exit 1
fi

echo "✓ .env 文件存在"
echo ""

echo ".env 文件内容:"
echo "----------------------------------------"
cat .env
echo "----------------------------------------"
echo ""

echo "加载环境变量后:"
echo "----------------------------------------"
source .env
echo "DEV_MODE=$DEV_MODE"
echo "DEV_USER=$DEV_USER"
echo "DEV_USER_UID=$DEV_USER_UID"
echo "DEV_USER_IS_ADMIN=$DEV_USER_IS_ADMIN"
echo "LDAP_HOST=$LDAP_HOST"
echo "LDAP_PORT=$LDAP_PORT"
echo "----------------------------------------"
echo ""

if [ "$DEV_MODE" = "true" ]; then
    echo "✓ 开发模式已启用"
else
    echo "⚠️  开发模式未启用 (DEV_MODE=$DEV_MODE)"
fi
