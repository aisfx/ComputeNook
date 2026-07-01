#!/bin/bash

# 构建发布版本脚本 - 生成完整的安装包
set -e

echo "========================================"
echo "开始构建发布版本..."
echo "========================================"

# 获取项目根目录
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_DIR="${ROOT_DIR}/release"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"
SCRIPTS_DIR="${ROOT_DIR}/scripts"

# 清理并创建 release 目录
echo "清理 release 目录..."
rm -rf "${RELEASE_DIR}"
mkdir -p "${RELEASE_DIR}"

# 获取版本信息
VERSION=$(git describe --tags --always --dirty 2>/dev/null || echo "dev")
BUILD_TIME=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
SHORT_VERSION=$(echo ${VERSION} | cut -d'-' -f1)

echo "版本信息: ${VERSION}"

# 构建前端
echo "========================================"
echo "1. 构建前端..."
echo "========================================"
cd "${FRONTEND_DIR}"
npm run build:release

# 编译后端
echo "========================================"
echo "2. 编译后端..."
echo "========================================"
cd "${BACKEND_DIR}"
if command -v go &> /dev/null; then
    echo "编译 Linux AMD64 版本..."
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags "-s -w" -o "${RELEASE_DIR}/computenook" .
    
    echo "编译 macOS AMD64 版本..."
    CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -ldflags "-s -w" -o "${RELEASE_DIR}/computenook-darwin-amd64" .
    
    echo "编译 macOS ARM64 版本..."
    CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -ldflags "-s -w" -o "${RELEASE_DIR}/computenook-darwin-arm64" .
    
    echo "后端编译完成"
else
    echo "错误: 未找到 Go 编译器"
    exit 1
fi

# 复制静态文件（已经在 release/static 目录了，无需再复制）
echo "========================================"
echo "3. 静态文件已生成到 ${RELEASE_DIR}/static"
echo "========================================"

# 复制配置文件和脚本
echo "========================================"
echo "4. 复制配置文件和脚本..."
echo "========================================"

# 复制环境变量示例
if [ -f "${ROOT_DIR}/.env.example" ]; then
    cp "${ROOT_DIR}/.env.example" "${RELEASE_DIR}/.env.example"
else
    cp "${BACKEND_DIR}/.env.example" "${RELEASE_DIR}/.env.example" 2>/dev/null || true
fi

# 复制安装脚本
cp "${SCRIPTS_DIR}/install.sh" "${RELEASE_DIR}/install.sh"
chmod +x "${RELEASE_DIR}/install.sh"

# 复制 systemd 服务文件
if [ -f "${SCRIPTS_DIR}/computenook.service" ]; then
    cp "${SCRIPTS_DIR}/computenook.service" "${RELEASE_DIR}/"
fi

# 复制 nginx 配置
if [ -f "${SCRIPTS_DIR}/nginx.conf" ]; then
    cp "${SCRIPTS_DIR}/nginx.conf" "${RELEASE_DIR}/"
fi

# 复制客户端（如果存在）
if [ -d "${BACKEND_DIR}/clients" ]; then
    echo "复制客户端文件..."
    mkdir -p "${RELEASE_DIR}/clients"
    cp -r "${BACKEND_DIR}/clients/." "${RELEASE_DIR}/clients/"
fi

# 创建数据目录占位文件
mkdir -p "${RELEASE_DIR}/data"
touch "${RELEASE_DIR}/data/.gitkeep"

mkdir -p "${RELEASE_DIR}/logs"
touch "${RELEASE_DIR}/logs/.gitkeep"

# 创建版本信息
echo "========================================"
echo "5. 创建版本信息..."
echo "========================================"

cat > "${RELEASE_DIR}/VERSION.txt" <<EOF
ComputeNook Release Build
========================
Version:    ${VERSION}
Commit:     ${COMMIT}
Build Time: ${BUILD_TIME}
EOF

# 创建详细的 README
cat > "${RELEASE_DIR}/README.md" <<'EOFREADME'
# ComputeNook 安装包

## 📦 安装包内容

```
computenook-<version>/
├── computenook              # Linux AMD64 可执行文件
├── computenook-darwin-amd64 # macOS Intel 可执行文件
├── computenook-darwin-arm64 # macOS Apple Silicon 可执行文件
├── static/                  # 前端静态文件
├── data/                    # 数据目录（数据库文件存放位置）
├── logs/                    # 日志目录
├── clients/                 # 客户端工具（如果有）
├── install.sh               # 一键安装脚本
├── .env.example             # 环境变量配置示例
├── computenook.service      # systemd 服务文件
├── nginx.conf               # Nginx 配置示例
├── VERSION.txt              # 版本信息
└── README.md                # 本文件
```

## 🚀 快速安装（推荐）

### Linux 服务器一键安装

```bash
# 1. 解压安装包
tar -xzf computenook-*.tar.gz
cd computenook-*/

# 2. 编辑配置文件
cp .env.example .env
vi .env  # 修改数据库、Redis 等配置

# 3. 运行安装脚本（需要 root 权限）
sudo ./install.sh

# 4. 查看服务状态
sudo systemctl status computenook
```

安装脚本会自动：
- 将文件安装到 `/opt/computenook`
- 创建并启动 systemd 服务
- 配置 nginx（如果已安装）

## 📖 手动安装

### 1. 准备环境

#### 必需依赖
- Linux 服务器（推荐 CentOS 7+/Ubuntu 18.04+）
- Slurm 集群管理系统
- SQLite 或 MySQL/PostgreSQL 数据库
- Redis（可选，用于缓存）

#### 可选依赖
- Nginx（用于反向代理）
- LDAP 服务器（用于用户认证）
- Docker（用于容器化部署）

### 2. 基础安装

```bash
# 创建安装目录
sudo mkdir -p /opt/computenook
sudo cp -r * /opt/computenook/
cd /opt/computenook

# 赋予执行权限
sudo chmod +x computenook

# 创建配置文件
cp .env.example .env
# 编辑 .env 配置数据库连接、端口等信息
```

### 3. 配置环境变量

编辑 `.env` 文件：

```bash
# 服务配置
PORT=8080
GIN_MODE=release

# 数据库配置
DB_TYPE=sqlite         # sqlite/mysql/postgres
DB_PATH=./data/computenook.db
# DB_HOST=localhost
# DB_PORT=3306
# DB_USER=root
# DB_PASSWORD=
# DB_NAME=computenook

# Redis 配置（可选）
REDIS_ENABLE=false
REDIS_ADDR=localhost:6379
REDIS_PASSWORD=
REDIS_DB=0

# Slurm 配置
SLURM_REST_URL=http://localhost:6820
SLURM_REST_VERSION=v0.0.40
SLURM_JWT_KEY=your_jwt_key

# LDAP 配置（可选）
LDAP_ENABLE=false
LDAP_URL=ldap://localhost:389
LDAP_BASE_DN=dc=example,dc=com

# 日志配置
LOG_LEVEL=info
LOG_FILE=./logs/computenook.log
```

### 4. 启动服务

#### 方式一：直接运行
```bash
cd /opt/computenook
./computenook
```

#### 方式二：使用 systemd（推荐）
```bash
# 复制 service 文件
sudo cp computenook.service /etc/systemd/system/

# 重载配置
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start computenook

# 设置开机自启
sudo systemctl enable computenook

# 查看状态
sudo systemctl status computenook

# 查看日志
sudo journalctl -u computenook -f
```

### 5. 配置 Nginx 反向代理（可选）

```bash
# 复制配置文件
sudo cp nginx.conf /etc/nginx/conf.d/computenook.conf

# 修改域名和端口
sudo vi /etc/nginx/conf.d/computenook.conf

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

## 🔧 常用命令

### 服务管理
```bash
# 启动服务
sudo systemctl start computenook

# 停止服务
sudo systemctl stop computenook

# 重启服务
sudo systemctl restart computenook

# 查看状态
sudo systemctl status computenook

# 查看日志
sudo journalctl -u computenook -f
sudo journalctl -u computenook -n 100
```

### 数据备份
```bash
# 备份数据库
cp /opt/computenook/data/computenook.db /backup/computenook.db.$(date +%Y%m%d)

# 备份配置文件
cp /opt/computenook/.env /backup/.env.$(date +%Y%m%d)
```

### 升级
```bash
# 停止服务
sudo systemctl stop computenook

# 备份
sudo cp /opt/computenook/computenook /opt/computenook/computenook.bak
sudo cp /opt/computenook/.env /opt/computenook/.env.bak

# 替换可执行文件
sudo cp computenook /opt/computenook/

# 更新静态文件
sudo rm -rf /opt/computenook/static
sudo cp -r static /opt/computenook/

# 重启服务
sudo systemctl start computenook
```

### 卸载
```bash
# 使用安装脚本卸载
cd /opt/computenook
sudo ./install.sh --uninstall

# 或手动卸载
sudo systemctl stop computenook
sudo systemctl disable computenook
sudo rm /etc/systemd/system/computenook.service
sudo systemctl daemon-reload
sudo rm -rf /opt/computenook
```

## 🔍 故障排查

### 1. 服务无法启动

```bash
# 查看详细日志
sudo journalctl -u computenook -n 100 --no-pager

# 检查端口占用
sudo netstat -tlnp | grep 8080

# 检查配置文件
cat /opt/computenook/.env

# 手动运行查看错误
cd /opt/computenook
./computenook
```

### 2. 前端无法访问

```bash
# 检查 Nginx 状态
sudo systemctl status nginx

# 检查 Nginx 配置
sudo nginx -t

# 查看 Nginx 日志
sudo tail -f /var/log/nginx/error.log
```

### 3. 数据库连接失败

```bash
# 检查数据库文件权限
ls -la /opt/computenook/data/

# SQLite 数据库完整性检查
sqlite3 /opt/computenook/data/computenook.db "PRAGMA integrity_check;"
```

### 4. Slurm 连接失败

```bash
# 测试 Slurm REST API
curl http://localhost:6820/slurm/v0.0.40/diag

# 检查 JWT 密钥
scontrol token
```

## 📞 获取帮助

- 📖 文档: [项目文档链接]
- 🐛 问题反馈: [GitHub Issues]
- 💬 讨论: [Discussion/论坛]

## 📝 版本历史

查看 `VERSION.txt` 文件了解当前版本信息。

## ⚖️ 许可证

查看 `LICENSE` 文件。
EOFREADME

# 打包成 tar.gz
echo "========================================"
echo "6. 创建压缩包..."
echo "========================================"

ARCHIVE_NAME="computenook-${SHORT_VERSION}-$(uname -s | tr '[:upper:]' '[:lower:]')-$(date +%Y%m%d-%H%M%S).tar.gz"
ARCHIVE_PATH="${RELEASE_DIR}/${ARCHIVE_NAME}"

# 创建临时目录用于打包
TEMP_DIR="${RELEASE_DIR}/temp_pack"
mkdir -p "${TEMP_DIR}/computenook"

# 复制所有文件到临时目录
echo "准备打包文件..."
cp -r "${RELEASE_DIR}"/* "${TEMP_DIR}/computenook/" 2>/dev/null || true
rm -rf "${TEMP_DIR}/computenook/temp_pack"

# 创建压缩包
cd "${TEMP_DIR}"
tar -czf "${ARCHIVE_PATH}" computenook/

# 清理临时目录
cd "${ROOT_DIR}"
rm -rf "${TEMP_DIR}"

# 生成 SHA256 校验和
echo "生成校验和..."
if command -v shasum &> /dev/null; then
    shasum -a 256 "${ARCHIVE_PATH}" | sed "s|${RELEASE_DIR}/||" > "${ARCHIVE_PATH}.sha256"
elif command -v sha256sum &> /dev/null; then
    sha256sum "${ARCHIVE_PATH}" | sed "s|${RELEASE_DIR}/||" > "${ARCHIVE_PATH}.sha256"
fi

# 清理 release 目录中的其他文件，只保留压缩包和校验和
echo "========================================"
echo "7. 清理临时文件..."
echo "========================================"

cd "${RELEASE_DIR}"
# 删除除了 .tar.gz 和 .sha256 之外的所有文件和目录
find . -maxdepth 1 ! -name '*.tar.gz' ! -name '*.sha256' ! -name '.' -exec rm -rf {} + 2>/dev/null || true

echo "清理完成，release 目录只保留压缩包"

echo "========================================"
echo "✅ 发布版本构建完成！"
echo "========================================"
echo ""
echo "📦 压缩包信息:"
echo "   文件: ${ARCHIVE_NAME}"
echo "   大小: $(du -h "${ARCHIVE_PATH}" | cut -f1)"
echo "   位置: ${RELEASE_DIR}/"
echo ""
if [ -f "${ARCHIVE_PATH}.sha256" ]; then
    echo "🔒 SHA256 校验和:"
    cat "${ARCHIVE_PATH}.sha256"
    echo ""
fi
echo "📂 Release 目录内容:"
ls -lh "${RELEASE_DIR}"
echo ""
echo "🎉 构建完成！"
echo "   - 解压: tar -xzf ${ARCHIVE_NAME}"
echo "   - 安装: sudo ./computenook/install.sh"
echo ""
