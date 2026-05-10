#!/usr/bin/env bash
# ComputeNook install script
# Usage:
#   sudo ./install.sh              # install
#   sudo ./install.sh --uninstall  # uninstall

set -e

INSTALL_DIR="/opt/computenook"
SERVICE="computenook"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

[ "$(id -u)" -eq 0 ] || error "Please run with root: sudo $0"

# Uninstall
if [ "$1" = "--uninstall" ]; then
  info "Uninstalling $SERVICE..."
  systemctl is-active --quiet "$SERVICE" 2>/dev/null && systemctl stop "$SERVICE"
  systemctl is-enabled --quiet "$SERVICE" 2>/dev/null && systemctl disable "$SERVICE"
  rm -f "/etc/systemd/system/${SERVICE}.service"
  systemctl daemon-reload
  rm -rf "$INSTALL_DIR"
  info "Uninstall complete"
  exit 0
fi

# Check required files
[ -f "$SCRIPT_DIR/computenook" ] || error "computenook binary not found, run this script from the extracted directory"
[ -d "$SCRIPT_DIR/static" ]      || error "static/ directory not found"

# Stop old service
if systemctl is-active --quiet "$SERVICE" 2>/dev/null; then
  info "Stopping $SERVICE..."
  systemctl stop "$SERVICE"
fi

# Copy files
info "Creating $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"

info "Copying binary..."
cp -f "$SCRIPT_DIR/computenook" "$INSTALL_DIR/computenook"
chmod +x "$INSTALL_DIR/computenook"

info "Copying frontend static files..."
rm -rf "$INSTALL_DIR/static"
cp -r "$SCRIPT_DIR/static" "$INSTALL_DIR/static"

# Copy clients if present
if [ -d "$SCRIPT_DIR/clients" ]; then
  info "Copying client binaries..."
  mkdir -p "$INSTALL_DIR/clients"
  cp -r "$SCRIPT_DIR/clients/." "$INSTALL_DIR/clients/"
fi

# Config file (do not overwrite existing)
if [ ! -f "$INSTALL_DIR/.env" ]; then
  if [ -f "$SCRIPT_DIR/.env.example" ]; then
    cp "$SCRIPT_DIR/.env.example" "$INSTALL_DIR/.env"
    warn "Created $INSTALL_DIR/.env — please edit it before starting the service"
  else
    warn ".env.example not found, please create $INSTALL_DIR/.env manually"
  fi
else
  info ".env already exists, skipping (merge .env.example manually if needed)"
fi

# nginx config
if [ -f "$SCRIPT_DIR/nginx.conf" ]; then
  if command -v nginx &>/dev/null; then
    info "Installing nginx config..."
    mkdir -p /etc/nginx/conf.d
    cp "$SCRIPT_DIR/nginx.conf" /etc/nginx/conf.d/computenook.conf
    nginx -t && systemctl reload nginx || warn "nginx config check failed, please verify /etc/nginx/conf.d/computenook.conf"
  else
    warn "nginx not found, skipping. Config saved at $SCRIPT_DIR/nginx.conf"
  fi
fi

# systemd service
info "Installing systemd service..."
cat > /etc/systemd/system/computenook.service << 'EOF'
[Unit]
Description=ComputeNook Backend Service
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

systemctl daemon-reload
systemctl enable "$SERVICE"
systemctl start  "$SERVICE"
sleep 1

if systemctl is-active --quiet "$SERVICE"; then
  info "$SERVICE started successfully"
else
  warn "$SERVICE failed to start — check logs: journalctl -u $SERVICE -n 50"
fi

echo ""
info "Installation complete!"
echo ""
echo "  Install dir : $INSTALL_DIR"
echo "  Config file : $INSTALL_DIR/.env"
echo ""
echo "  Commands:"
echo "    systemctl status  $SERVICE"
echo "    systemctl restart $SERVICE"
echo "    journalctl -u $SERVICE -f"
echo ""
echo "  Uninstall:"
echo "    sudo $0 --uninstall"
