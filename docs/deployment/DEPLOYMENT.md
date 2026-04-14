# HPC 平台部署指南

## 架构说明

系统由三个部分组成：

1. **前端服务** (`hpcweb/`) - Vue 3 + TypeScript
2. **主后端服务** (`backend/`) - Go + Gin
3. **文件管理服务** (`filemanager/`) - Go + Gin（可选独立部署）

## 部署方式

### 方式一：完全集成部署（推荐用于开发环境）

所有服务运行在同一台服务器上。

#### 1. 启动主后端服务

```bash
cd backend
go build -o hpc-backend
./hpc-backend
# 服务运行在 http://localhost:8080
```

#### 2. 启动前端服务

```bash
cd hpcweb
npm install
npm run dev
# 服务运行在 http://localhost:5173
```

#### 3. 配置前端环境变量

编辑 `hpcweb/.env`：

```env
# 使用集成在主服务中的文件管理 API
VITE_FILEMANAGER_URL=http://localhost:8080
VITE_API_URL=http://localhost:8080
```

### 方式二：独立文件管理服务（推荐用于生产环境）

文件管理服务独立部署，提供更好的隔离性和可扩展性。

#### 1. 编译文件管理服务

```bash
cd filemanager

# Linux 版本
make linux-amd64
# 或使用脚本
./build.sh

# Windows 版本
build.bat
```

编译后的文件在 `build/` 目录：
- `filemanager-linux-amd64` - Linux 64位
- `filemanager-linux-arm64` - Linux ARM64
- `filemanager-windows-amd64.exe` - Windows 64位
- `filemanager-darwin-amd64` - macOS Intel
- `filemanager-darwin-arm64` - macOS Apple Silicon

#### 2. 部署文件管理服务

将编译好的文件复制到目标服务器：

```bash
# 复制文件
scp build/filemanager-linux-amd64 user@fileserver:/opt/filemanager/
scp .env user@fileserver:/opt/filemanager/

# 登录服务器
ssh user@fileserver

# 设置权限
cd /opt/filemanager
chmod +x filemanager-linux-amd64

# 配置环境变量
vi .env
```

`.env` 配置示例：

```env
# 服务端口
FILEMANAGER_PORT=8081

# 基础路径（用户只能访问此路径及其子目录）
FILEMANAGER_BASE_PATH=/home

# CORS 配置
CORS_ALLOWED_ORIGINS=http://your-frontend-domain.com
```

#### 3. 启动文件管理服务

**方式 A：直接运行**

```bash
./filemanager-linux-amd64
```

**方式 B：使用 systemd（推荐）**

创建 `/etc/systemd/system/filemanager.service`：

```ini
[Unit]
Description=File Manager Service
After=network.target

[Service]
Type=simple
User=filemanager
WorkingDirectory=/opt/filemanager
ExecStart=/opt/filemanager/filemanager-linux-amd64
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable filemanager
sudo systemctl start filemanager
sudo systemctl status filemanager
```

#### 4. 配置前端连接独立服务

编辑 `hpcweb/.env`：

```env
# 使用独立的文件管理服务
VITE_FILEMANAGER_URL=http://fileserver:8081
VITE_API_URL=http://backend-server:8080
```

#### 5. 启动主后端和前端

```bash
# 主后端
cd backend
./hpc-backend

# 前端
cd hpcweb
npm run build
npm run preview
# 或使用 nginx 部署
```

## 生产环境部署

### 1. 使用 Nginx 反向代理

创建 `/etc/nginx/sites-available/hpc-platform`：

```nginx
# 前端
server {
    listen 80;
    server_name hpc.example.com;

    root /var/www/hpc-platform/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 主后端 API
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 文件管理服务
server {
    listen 80;
    server_name files.example.com;

    location /api/files/ {
        proxy_pass http://localhost:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 文件上传大小限制
        client_max_body_size 100M;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/hpc-platform /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 2. 配置 HTTPS（使用 Let's Encrypt）

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d hpc.example.com -d files.example.com
```

### 3. 前端生产构建

```bash
cd hpcweb

# 配置生产环境变量
cat > .env.production << EOF
VITE_FILEMANAGER_URL=https://files.example.com
VITE_API_URL=https://hpc.example.com
EOF

# 构建
npm run build

# 部署到 nginx
sudo cp -r dist/* /var/www/hpc-platform/
```

## 服务器要求

### 最低配置

- **CPU**: 2 核
- **内存**: 4GB
- **磁盘**: 50GB
- **操作系统**: Linux (Ubuntu 20.04+, CentOS 7+)

### 推荐配置

- **CPU**: 4 核+
- **内存**: 8GB+
- **磁盘**: 100GB+ SSD
- **操作系统**: Ubuntu 22.04 LTS

## 端口说明

- **8080**: 主后端服务
- **8081**: 文件管理服务
- **5173**: 前端开发服务器
- **80/443**: Nginx (生产环境)

## 安全建议

1. **防火墙配置**
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

2. **文件权限**
   ```bash
   # 创建专用用户
   sudo useradd -r -s /bin/false filemanager
   sudo chown -R filemanager:filemanager /opt/filemanager
   ```

3. **限制文件访问路径**
   
   在 `.env` 中设置 `FILEMANAGER_BASE_PATH` 限制用户只能访问特定目录。

4. **启用 HTTPS**
   
   生产环境必须使用 HTTPS。

5. **定期更新**
   ```bash
   # 更新系统
   sudo apt update && sudo apt upgrade
   
   # 更新服务
   # 重新编译并替换二进制文件
   ```

## 监控和日志

### 查看服务状态

```bash
# systemd 服务
sudo systemctl status filemanager
sudo systemctl status hpc-backend

# 查看日志
sudo journalctl -u filemanager -f
sudo journalctl -u hpc-backend -f
```

### 日志文件位置

- 主后端: `backend/logs/`
- 文件管理: 标准输出（通过 systemd 管理）
- Nginx: `/var/log/nginx/`

## 故障排查

### 文件管理服务无法启动

1. 检查端口是否被占用
   ```bash
   sudo netstat -tlnp | grep 8081
   ```

2. 检查配置文件
   ```bash
   cat /opt/filemanager/.env
   ```

3. 检查权限
   ```bash
   ls -la /opt/filemanager/
   ```

### 前端无法连接服务

1. 检查环境变量配置
   ```bash
   cat hpcweb/.env
   ```

2. 检查 CORS 配置
   
   确保后端服务的 CORS 配置包含前端域名。

3. 检查网络连接
   ```bash
   curl http://localhost:8081/health
   ```

## 备份和恢复

### 备份

```bash
# 备份配置文件
tar -czf hpc-backup-$(date +%Y%m%d).tar.gz \
    backend/.env \
    filemanager/.env \
    hpcweb/.env

# 备份数据库（如果有）
# ...
```

### 恢复

```bash
# 解压配置文件
tar -xzf hpc-backup-20240101.tar.gz

# 重启服务
sudo systemctl restart filemanager
sudo systemctl restart hpc-backend
```

## 性能优化

1. **启用 Gzip 压缩**（Nginx）
2. **使用 CDN** 加速静态资源
3. **数据库连接池**优化
4. **缓存策略**配置

## 更新升级

```bash
# 1. 备份当前版本
cp filemanager-linux-amd64 filemanager-linux-amd64.bak

# 2. 上传新版本
scp build/filemanager-linux-amd64 user@server:/opt/filemanager/

# 3. 重启服务
sudo systemctl restart filemanager

# 4. 验证
curl http://localhost:8081/health
```

## 联系支持

如有问题，请查看：
- 项目文档: `README.md`
- 文件管理服务文档: `filemanager/README.md`
- 问题追踪: GitHub Issues
