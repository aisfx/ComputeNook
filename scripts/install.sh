#!/bin/bash
# 算力小筑 安装脚本
# 将服务安装到 /opt/computenook 并注册 systemd 服务
#
# 用法:
#   ./install.sh              # 安装
#   ./install.sh --uninstall  # 卸载

set -e

INSTALL_DIR="/opt/computenook"
SERVICE="computenook"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── 颜色输出 ──────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── 权限检查 ──────────────────────────────────────────────
[ "$(id -u)" -eq 0 ] || error "请使用 root 权限运行: sudo $0"

# ── 卸载 ──────────────────────────────────────────────────
if [ "$1" = "--uninstall" ]; then
  info "开始卸载 算力小筑..."
  if systemctl is-active --quiet "$SERVICE" 2>/dev/null; then
    systemctl stop "$SERVICE"
    info "已停止 $SERVICE"
  fi
  if systemctl is-enabled --quiet "$SERVICE" 2>/dev/null; then
    systemctl disable "$SERVICE"
  fi
  rm -f "/etc/systemd/system/${SERVICE}.service"
  systemctl daemon-reload
  rm -rf "$INSTALL_DIR"
  info "卸载完成"
  exit 0
fi

# ── 检查必要文件 ──────────────────────────────────────────
[ -f "$SCRIPT_DIR/computenook" ] || error "找不到 computenook，请在解压目录中运行此脚本"
[ -d "$SCRIPT_DIR/static" ]      || error "找不到 static/ 目录"

# ── 停止旧服务 ────────────────────────────────────────────
if systemctl is-active --quiet "$SERVICE" 2>/dev/null; then
  info "停止旧服务 $SERVICE..."
  systemctl stop "$SERVICE"
fi

# ── 创建安装目录并复制文件 ────────────────────────────────
info "创建安装目录 $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"

info "复制程序文件..."
cp -f "$SCRIPT_DIR/computenook" "$INSTALL_DIR/computenook"
chmod +x "$INSTALL_DIR/computenook"

info "复制前端静态文件..."
rm -rf "$INSTALL_DIR/static"
cp -r "$SCRIPT_DIR/static" "$INSTALL_DIR/static"

# ── 复制配置文件（不覆盖已有配置）────────────────────────
if [ ! -f "$INSTALL_DIR/.env" ]; then
  cp "$SCRIPT_DIR/.env.example" "$INSTALL_DIR/.env"
  warn "已创建 $INSTALL_DIR/.env，请根据实际环境修改配置"
else
  info ".env 已存在，跳过覆盖（如需更新请手动合并 .env.example）"
fi

# ── 安装 nginx 配置 ───────────────────────────────────────
if [ -f "$SCRIPT_DIR/nginx.conf" ]; then
  info "安装 nginx 配置..."
  if command -v nginx &>/dev/null; then
    NGINX_CONF_DIR="/etc/nginx/conf.d"
    mkdir -p "$NGINX_CONF_DIR"
    cp "$SCRIPT_DIR/nginx.conf" "$NGINX_CONF_DIR/computenook.conf"
    nginx -t && systemctl reload nginx || warn "nginx 配置检查失败，请手动检查 /etc/nginx/conf.d/computenook.conf"
    info "nginx 配置已安装"
  else
    warn "未检测到 nginx，跳过。配置文件已放在 $SCRIPT_DIR/nginx.conf，请手动安装"
  fi
fi

# ── 安装 systemd 服务 ─────────────────────────────────────
info "安装 systemd 服务..."

cat > /etc/systemd/system/computenook.service << 'EOF'
[Unit]
Description=算力小筑 Backend Service
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/computenook
EnvironmentFile=-/opt/computenook/.env
ExecStart=/opt/computenook/computenook
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=computenook

[Install]
WantedBy=multi-user.target
EOF

# ── 启用并启动服务 ────────────────────────────────────────
systemctl daemon-reload
systemctl enable "$SERVICE"
systemctl start  "$SERVICE"
sleep 1

if systemctl is-active --quiet "$SERVICE"; then
  info "$SERVICE 启动成功 ✓"
else
  warn "$SERVICE 启动失败，查看日志: journalctl -u $SERVICE -n 50"
fi

# ── 完成 ──────────────────────────────────────────────────
echo ""
info "安装完成！"
echo ""
echo "  安装目录: $INSTALL_DIR"
echo "  服务端口: $(grep SERVER_PORT $INSTALL_DIR/.env | cut -d= -f2) (默认 8080)"
echo ""
echo "  常用命令:"
echo "    systemctl status  computenook"
echo "    systemctl restart computenook"
echo "    journalctl -u computenook -f"
echo ""
echo "  卸载:"
echo "    sudo $0 --uninstall"
