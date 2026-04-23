#!/bin/bash
# 部署 shell 审计 wrapper 到登录节点
# 用法：bash deploy_shell_audit.sh <HPC_API_URL>
# 示例：bash deploy_shell_audit.sh http://192.168.1.100:8080

set -e

API_URL="${1:-http://localhost:8080}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="/etc/profile.d/hpc_audit.sh"

echo "==> 部署 HPC Shell 审计 wrapper"
echo "    API 地址: ${API_URL}"
echo "    目标路径: ${TARGET}"

# 写入脚本并替换 API URL
sed "s|http://localhost:8080|${API_URL}|g" "${SCRIPT_DIR}/shell_audit.sh" > "${TARGET}"
chmod 644 "${TARGET}"

echo "==> 部署完成"
echo ""
echo "说明："
echo "  1. 所有用户下次登录后自动生效"
echo "  2. 命令记录上报到: ${API_URL}/api/audit/shell"
echo "  3. 用户需要在 ~/.hpc_token 中存放有效的 JWT token"
echo "     或通过环境变量 HPC_SESSION_TOKEN 传入"
echo ""
echo "hpc-client 可在连接时自动写入 token："
echo "  export HPC_SESSION_TOKEN=<your-jwt-token>"
echo "  或 hpc-client 在建立隧道时写入 ~/.hpc_token"
