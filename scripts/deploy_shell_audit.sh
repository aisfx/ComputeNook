#!/usr/bin/env bash
# 閮ㄧ讲 shell 瀹¤ wrapper 鍒扮櫥褰曡妭鐐?# 鐢ㄦ硶锛歜ash deploy_shell_audit.sh <HPC_API_URL>
# 绀轰緥锛歜ash deploy_shell_audit.sh http://192.168.1.100:8080

set -e

API_URL="${1:-http://localhost:8080}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="/etc/profile.d/hpc_audit.sh"

echo "==> 閮ㄧ讲 HPC Shell 瀹¤ wrapper"
echo "    API 鍦板潃: ${API_URL}"
echo "    鐩爣璺緞: ${TARGET}"

# 鍐欏叆鑴氭湰骞舵浛鎹?API URL
sed "s|http://localhost:8080|${API_URL}|g" "${SCRIPT_DIR}/shell_audit.sh" > "${TARGET}"
chmod 644 "${TARGET}"

echo "==> 閮ㄧ讲瀹屾垚"
echo ""
echo "璇存槑锛?
echo "  1. 鎵€鏈夌敤鎴蜂笅娆＄櫥褰曞悗鑷姩鐢熸晥"
echo "  2. 鍛戒护璁板綍涓婃姤鍒? ${API_URL}/api/audit/shell"
echo "  3. 鐢ㄦ埛闇€瑕佸湪 ~/.hpc_token 涓瓨鏀炬湁鏁堢殑 JWT token"
echo "     鎴栭€氳繃鐜鍙橀噺 HPC_SESSION_TOKEN 浼犲叆"
echo ""
echo "hpc-client 鍙湪杩炴帴鏃惰嚜鍔ㄥ啓鍏?token锛?
echo "  export HPC_SESSION_TOKEN=<your-jwt-token>"
echo "  鎴?hpc-client 鍦ㄥ缓绔嬮毀閬撴椂鍐欏叆 ~/.hpc_token"
