#!/bin/bash
# HPC 平台初始化脚本
# 在 LDAP 中创建 admin 用户（用户名/密码均为 admin），并赋予管理员权限

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 修复 CRLF
sed -i 's/\r//' "$SCRIPT_DIR/.env" 2>/dev/null || true

# 安全加载 .env（逐行解析，避免 xargs 对特殊字符的误处理）
if [ -f "$SCRIPT_DIR/.env" ]; then
    while IFS= read -r line || [ -n "$line" ]; do
        # 跳过注释和空行
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${line// }" ]] && continue
        # 只处理 KEY=VALUE 格式
        if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
            key="${BASH_REMATCH[1]}"
            val="${BASH_REMATCH[2]}"
            # 去掉首尾引号
            val="${val%\"}"
            val="${val#\"}"
            val="${val%\'}"
            val="${val#\'}"
            export "$key=$val"
        fi
    done < "$SCRIPT_DIR/.env"
fi

# 默认值
LDAP_HOST="${LDAP_HOST:-localhost}"
LDAP_PORT="${LDAP_PORT:-389}"
LDAP_BIND_DN="${LDAP_BIND_DN:-cn=Manager,dc=example,dc=com}"
LDAP_BIND_PASSWORD="${LDAP_BIND_PASSWORD:-secret}"
LDAP_USER_BASE_DN="${LDAP_USER_BASE_DN:-ou=people,dc=example,dc=com}"
LDAP_GROUP_BASE_DN="${LDAP_GROUP_BASE_DN:-ou=group,dc=example,dc=com}"
HOME_BASE_PATH="${HOME_BASE_PATH:-/home}"

ADMIN_USER="admin"
ADMIN_PASS="admin"
ADMIN_UID=1000
ADMIN_GID=1000

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

echo ""
echo "=========================================="
echo "  HPC 平台初始化 - 创建管理员账户"
echo "=========================================="
echo "  LDAP 服务器: $LDAP_HOST:$LDAP_PORT"
echo "  管理员用户:  $ADMIN_USER"
echo "  用户 Base DN: $LDAP_USER_BASE_DN"
echo "=========================================="
echo ""

# 检查 ldapadd / ldapmodify 是否可用
if ! command -v ldapadd &>/dev/null; then
    error "ldapadd 未安装，请先安装 ldap-utils：\n  apt-get install -y ldap-utils\n  或\n  yum install -y openldap-clients"
fi

LDAP_OPTS="-H ldap://${LDAP_HOST}:${LDAP_PORT} -D \"${LDAP_BIND_DN}\" -w \"${LDAP_BIND_PASSWORD}\""

# ── 1. 确保 ou=people 存在 ──────────────────
info "检查 ou=people 是否存在..."
OU_EXISTS=$(ldapsearch -H "ldap://${LDAP_HOST}:${LDAP_PORT}" \
    -D "${LDAP_BIND_DN}" -w "${LDAP_BIND_PASSWORD}" \
    -b "${LDAP_USER_BASE_DN}" -s base "(objectClass=*)" dn 2>/dev/null | grep -c "dn:" || true)

if [ "$OU_EXISTS" -eq 0 ]; then
    info "创建 ou=people..."
    # 从 USER_BASE_DN 提取父 DN
    PARENT_DN=$(echo "$LDAP_USER_BASE_DN" | cut -d',' -f2-)
    ldapadd -H "ldap://${LDAP_HOST}:${LDAP_PORT}" \
        -D "${LDAP_BIND_DN}" -w "${LDAP_BIND_PASSWORD}" <<EOF
dn: ${LDAP_USER_BASE_DN}
objectClass: organizationalUnit
ou: people
EOF
    info "ou=people 创建成功"
else
    info "ou=people 已存在"
fi

# ── 2. 确保 ou=group 存在 ───────────────────
info "检查 ou=group 是否存在..."
GOU_EXISTS=$(ldapsearch -H "ldap://${LDAP_HOST}:${LDAP_PORT}" \
    -D "${LDAP_BIND_DN}" -w "${LDAP_BIND_PASSWORD}" \
    -b "${LDAP_GROUP_BASE_DN}" -s base "(objectClass=*)" dn 2>/dev/null | grep -c "dn:" || true)

if [ "$GOU_EXISTS" -eq 0 ]; then
    info "创建 ou=group..."
    ldapadd -H "ldap://${LDAP_HOST}:${LDAP_PORT}" \
        -D "${LDAP_BIND_DN}" -w "${LDAP_BIND_PASSWORD}" <<EOF
dn: ${LDAP_GROUP_BASE_DN}
objectClass: organizationalUnit
ou: group
EOF
    info "ou=group 创建成功"
else
    info "ou=group 已存在"
fi

# ── 3. 生成密码哈希 ─────────────────────────
info "生成密码哈希..."
if command -v slappasswd &>/dev/null; then
    HASHED_PASS=$(slappasswd -s "$ADMIN_PASS")
else
    # fallback: 使用 Python 生成 SSHA
    HASHED_PASS=$(python3 -c "
import hashlib, os, base64
salt = os.urandom(4)
h = hashlib.sha1('${ADMIN_PASS}'.encode() + salt).digest()
print('{SSHA}' + base64.b64encode(h + salt).decode())
" 2>/dev/null || echo "{CLEARTEXT}${ADMIN_PASS}")
fi
info "密码哈希生成完成"

# ── 4. 创建 admin 用户 ──────────────────────
ADMIN_DN="uid=${ADMIN_USER},${LDAP_USER_BASE_DN}"

info "检查 admin 用户是否已存在..."
USER_EXISTS=$(ldapsearch -H "ldap://${LDAP_HOST}:${LDAP_PORT}" \
    -D "${LDAP_BIND_DN}" -w "${LDAP_BIND_PASSWORD}" \
    -b "${ADMIN_DN}" -s base "(objectClass=*)" dn 2>/dev/null | grep -c "dn:" || true)

if [ "$USER_EXISTS" -gt 0 ]; then
    warn "admin 用户已存在，跳过创建"
else
    info "创建 admin 用户..."
    ldapadd -H "ldap://${LDAP_HOST}:${LDAP_PORT}" \
        -D "${LDAP_BIND_DN}" -w "${LDAP_BIND_PASSWORD}" <<EOF
dn: ${ADMIN_DN}
objectClass: inetOrgPerson
objectClass: posixAccount
objectClass: shadowAccount
uid: ${ADMIN_USER}
cn: Administrator
sn: Admin
givenName: Admin
uidNumber: ${ADMIN_UID}
gidNumber: ${ADMIN_GID}
homeDirectory: ${HOME_BASE_PATH}/${ADMIN_USER}
loginShell: /bin/bash
userPassword: ${HASHED_PASS}
mail: admin@hpc.local
EOF
    info "admin 用户创建成功"
fi

# ── 5. 创建 admin 组并加入用户 ──────────────
ADMIN_GROUP_DN="cn=admin,${LDAP_GROUP_BASE_DN}"

info "检查 admin 组是否已存在..."
GROUP_EXISTS=$(ldapsearch -H "ldap://${LDAP_HOST}:${LDAP_PORT}" \
    -D "${LDAP_BIND_DN}" -w "${LDAP_BIND_PASSWORD}" \
    -b "${ADMIN_GROUP_DN}" -s base "(objectClass=*)" dn 2>/dev/null | grep -c "dn:" || true)

if [ "$GROUP_EXISTS" -gt 0 ]; then
    warn "admin 组已存在，检查成员..."
    MEMBER_EXISTS=$(ldapsearch -H "ldap://${LDAP_HOST}:${LDAP_PORT}" \
        -D "${LDAP_BIND_DN}" -w "${LDAP_BIND_PASSWORD}" \
        -b "${ADMIN_GROUP_DN}" -s base "(memberUid=${ADMIN_USER})" dn 2>/dev/null | grep -c "dn:" || true)
    if [ "$MEMBER_EXISTS" -eq 0 ]; then
        info "将 admin 用户加入 admin 组..."
        ldapmodify -H "ldap://${LDAP_HOST}:${LDAP_PORT}" \
            -D "${LDAP_BIND_DN}" -w "${LDAP_BIND_PASSWORD}" <<EOF
dn: ${ADMIN_GROUP_DN}
changetype: modify
add: memberUid
memberUid: ${ADMIN_USER}
EOF
        info "admin 用户已加入 admin 组"
    else
        info "admin 用户已在 admin 组中"
    fi
else
    info "创建 admin 组..."
    ldapadd -H "ldap://${LDAP_HOST}:${LDAP_PORT}" \
        -D "${LDAP_BIND_DN}" -w "${LDAP_BIND_PASSWORD}" <<EOF
dn: ${ADMIN_GROUP_DN}
objectClass: posixGroup
cn: admin
gidNumber: ${ADMIN_GID}
memberUid: ${ADMIN_USER}
EOF
    info "admin 组创建成功"
fi

echo ""
echo "=========================================="
echo "  ✓ 初始化完成"
echo "=========================================="
echo "  用户名: admin"
echo "  密  码: admin"
echo "  DN:     ${ADMIN_DN}"
echo ""
echo "  请登录后立即修改密码！"
echo "=========================================="
echo ""
