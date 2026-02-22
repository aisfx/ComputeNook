#!/bin/bash

# 给 LDAP 用户添加管理员权限的便捷脚本

set -e

if [ -z "$1" ]; then
    echo "用法: ./add_admin.sh <用户名>"
    echo "示例: ./add_admin.sh sunfx"
    exit 1
fi

USERNAME=$1
API_BASE="http://localhost:8080/api"

echo "=========================================="
echo "添加管理员权限"
echo "=========================================="
echo "用户名: $USERNAME"
echo ""

# 检查后端是否运行
if ! curl -s "$API_BASE/groups" > /dev/null 2>&1; then
    echo "错误: 后端服务未运行"
    echo "请先启动后端: cd backend && go run main.go"
    exit 1
fi

echo "1. 检查 admin 组是否存在..."
ADMIN_GROUP=$(curl -s "$API_BASE/groups/1000" 2>/dev/null || echo '{"error":"not found"}')

if echo "$ADMIN_GROUP" | grep -q '"error"'; then
    echo "   admin 组不存在，正在创建..."
    
    RESULT=$(curl -s -X POST "$API_BASE/groups" \
      -H "Content-Type: application/json" \
      -d "{
        \"groupName\": \"admin\",
        \"gid\": 1000,
        \"members\": [\"$USERNAME\"]
      }")
    
    if echo "$RESULT" | grep -q '"error"'; then
        echo "   错误: $(echo $RESULT | jq -r '.error')"
        exit 1
    fi
    
    echo "   ✓ admin 组创建成功，用户 $USERNAME 已添加"
else
    echo "   ✓ admin 组已存在"
    echo ""
    echo "2. 获取现有成员列表..."
    
    CURRENT_MEMBERS=$(echo "$ADMIN_GROUP" | jq -r '.data.members[]' 2>/dev/null | tr '\n' ' ')
    echo "   当前成员: $CURRENT_MEMBERS"
    
    # 检查用户是否已经是管理员
    if echo "$CURRENT_MEMBERS" | grep -q "\b$USERNAME\b"; then
        echo "   ✓ 用户 $USERNAME 已经是管理员"
        exit 0
    fi
    
    echo ""
    echo "3. 添加用户到 admin 组..."
    
    # 构建新的成员列表
    NEW_MEMBERS="[\"$(echo $CURRENT_MEMBERS $USERNAME | tr ' ' '\n' | grep -v '^$' | sort -u | paste -sd '","' -)\"]"
    
    RESULT=$(curl -s -X PUT "$API_BASE/groups/1000" \
      -H "Content-Type: application/json" \
      -d "{
        \"groupName\": \"admin\",
        \"gid\": 1000,
        \"members\": $NEW_MEMBERS
      }")
    
    if echo "$RESULT" | grep -q '"error"'; then
        echo "   错误: $(echo $RESULT | jq -r '.error')"
        exit 1
    fi
    
    echo "   ✓ 用户 $USERNAME 已添加到 admin 组"
fi

echo ""
echo "=========================================="
echo "✓ 完成！"
echo "=========================================="
echo ""
echo "用户 $USERNAME 现在拥有管理员权限。"
echo ""
echo "注意: 用户需要重新登录才能获得新权限。"
echo ""
echo "验证方法:"
echo "  curl -X POST $API_BASE/login \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"username\":\"$USERNAME\",\"password\":\"密码\"}' | jq '.user.isAdmin'"
echo ""
