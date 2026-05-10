#!/usr/bin/env bash
# init_ldap.sh — Initialize LDAP with a first admin account
#
# Usage:
#   sudo ./init_ldap.sh                        # defaults: admin / admin
#   sudo ./init_ldap.sh --user alice --pass s3cr3t
#   sudo ./init_ldap.sh --user alice --pass s3cr3t --uid 2001

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Parse args ────────────────────────────────────────────────
ADMIN_USER="admin"
ADMIN_PASS="admin"
ADMIN_UID=2000
ADMIN_GID=2000

while [[ $# -gt 0 ]]; do
  case "$1" in
    --user) ADMIN_USER="$2"; shift 2 ;;
    --pass) ADMIN_PASS="$2"; shift 2 ;;
    --uid)  ADMIN_UID="$2";  shift 2 ;;
    --gid)  ADMIN_GID="$2";  shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Load .env ─────────────────────────────────────────────────
ENV_FILE=""
for f in "$SCRIPT_DIR/.env" "$SCRIPT_DIR/../.env" "/opt/computenook/.env"; do
  [ -f "$f" ] && ENV_FILE="$f" && break
done

if [ -n "$ENV_FILE" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    # Strip carriage return
    line="${line//$'\r'/}"
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line// }" ]] && continue
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      val="${BASH_REMATCH[2]}"
      val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
      export "$key=$val"
    fi
  done < "$ENV_FILE"
fi

# ── Defaults ──────────────────────────────────────────────────
LDAP_HOST="${LDAP_HOST:-localhost}"
LDAP_PORT="${LDAP_PORT:-389}"
LDAP_BIND_DN="${LDAP_BIND_DN:-cn=Manager,dc=example,dc=com}"
LDAP_BIND_PASSWORD="${LDAP_BIND_PASSWORD:-secret}"
LDAP_USER_BASE_DN="${LDAP_USER_BASE_DN:-ou=people,dc=example,dc=com}"
LDAP_GROUP_BASE_DN="${LDAP_GROUP_BASE_DN:-ou=group,dc=example,dc=com}"
HOME_BASE_PATH="${HOME_BASE_PATH:-/home}"

# Strip any stray whitespace / carriage returns from LDAP_HOST
LDAP_HOST="$(echo "$LDAP_HOST" | tr -d '[:space:]\r')"
LDAP_PORT="$(echo "$LDAP_PORT" | tr -d '[:space:]\r')"

LDAP_URL="ldap://${LDAP_HOST}:${LDAP_PORT}"
LDAP_AUTH=(-H "$LDAP_URL" -D "$LDAP_BIND_DN" -w "$LDAP_BIND_PASSWORD")

# ── Colors ────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

echo ""
echo "================================================"
echo "  ComputeNook — LDAP Init"
echo "================================================"
echo "  LDAP server : $LDAP_HOST:$LDAP_PORT"
echo "  Admin user  : $ADMIN_USER  (uid=$ADMIN_UID)"
echo "  User base   : $LDAP_USER_BASE_DN"
echo "  Group base  : $LDAP_GROUP_BASE_DN"
echo "================================================"
echo ""

# ── Check ldap tools ─────────────────────────────────────────
command -v ldapadd  &>/dev/null || error "ldapadd not found. Install: apt install ldap-utils  OR  yum install openldap-clients"
command -v ldapsearch &>/dev/null || error "ldapsearch not found."

# ── Helper: check if DN exists ───────────────────────────────
dn_exists() {
  ldapsearch "${LDAP_AUTH[@]}" -b "$1" -s base "(objectClass=*)" dn 2>/dev/null | grep -c "^dn:" || true
}

# ── 1. Ensure ou=people ──────────────────────────────────────
info "Checking ou=people..."
if [ "$(dn_exists "$LDAP_USER_BASE_DN")" -eq 0 ]; then
  info "Creating $LDAP_USER_BASE_DN..."
  ldapadd "${LDAP_AUTH[@]}" <<EOF
dn: ${LDAP_USER_BASE_DN}
objectClass: organizationalUnit
ou: people
EOF
  info "Created ou=people"
else
  info "ou=people already exists"
fi

# ── 2. Ensure ou=group ───────────────────────────────────────
info "Checking ou=group..."
if [ "$(dn_exists "$LDAP_GROUP_BASE_DN")" -eq 0 ]; then
  info "Creating $LDAP_GROUP_BASE_DN..."
  ldapadd "${LDAP_AUTH[@]}" <<EOF
dn: ${LDAP_GROUP_BASE_DN}
objectClass: organizationalUnit
ou: group
EOF
  info "Created ou=group"
else
  info "ou=group already exists"
fi

# ── 3. Hash password ─────────────────────────────────────────
info "Hashing password..."
if command -v slappasswd &>/dev/null; then
  HASHED_PASS=$(slappasswd -s "$ADMIN_PASS")
else
  HASHED_PASS=$(python3 - <<PYEOF
import hashlib, os, base64
salt = os.urandom(4)
h = hashlib.sha1(b"${ADMIN_PASS}" + salt).digest()
print("{SSHA}" + base64.b64encode(h + salt).decode())
PYEOF
)
fi

# ── 4. Create admin user ─────────────────────────────────────
ADMIN_DN="uid=${ADMIN_USER},${LDAP_USER_BASE_DN}"
info "Checking user $ADMIN_USER..."
if [ "$(dn_exists "$ADMIN_DN")" -gt 0 ]; then
  warn "User $ADMIN_USER already exists, skipping"
else
  info "Creating user $ADMIN_USER..."
  ldapadd "${LDAP_AUTH[@]}" <<EOF
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
mail: ${ADMIN_USER}@hpc.local
EOF
  info "User $ADMIN_USER created"
fi

# ── 5. Create admin group ────────────────────────────────────
ADMIN_GROUP_DN="cn=admin,${LDAP_GROUP_BASE_DN}"
info "Checking admin group..."
if [ "$(dn_exists "$ADMIN_GROUP_DN")" -gt 0 ]; then
  warn "Group admin already exists"
  # Add member if missing
  MEMBER_EXISTS=$(ldapsearch "${LDAP_AUTH[@]}" -b "$ADMIN_GROUP_DN" -s base "(memberUid=${ADMIN_USER})" dn 2>/dev/null | grep -c "^dn:" || true)
  if [ "$MEMBER_EXISTS" -eq 0 ]; then
    info "Adding $ADMIN_USER to admin group..."
    ldapmodify "${LDAP_AUTH[@]}" <<EOF
dn: ${ADMIN_GROUP_DN}
changetype: modify
add: memberUid
memberUid: ${ADMIN_USER}
EOF
    info "Added $ADMIN_USER to admin group"
  else
    info "$ADMIN_USER is already in admin group"
  fi
else
  info "Creating admin group..."
  ldapadd "${LDAP_AUTH[@]}" <<EOF
dn: ${ADMIN_GROUP_DN}
objectClass: posixGroup
cn: admin
gidNumber: ${ADMIN_GID}
memberUid: ${ADMIN_USER}
EOF
  info "Admin group created"
fi

# ── Done ─────────────────────────────────────────────────────
echo ""
echo "================================================"
echo "  Done!"
echo "================================================"
echo "  Username : $ADMIN_USER"
echo "  Password : $ADMIN_PASS"
echo "  DN       : $ADMIN_DN"
echo ""
echo "  Please change the password after first login."
echo "================================================"
echo ""
