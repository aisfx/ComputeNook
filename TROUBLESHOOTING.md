# ComputeNook 后端连接问题排查指南

## 问题症状

前端页面不断刷新，浏览器控制台显示所有 `/api/*` 请求返回 **404 错误**。

```
GET http://192.168.18.150:8080/api/dashboard/stats 404 (Not Found)
GET http://192.168.18.150:8080/config.js 404 (Not Found)
```

## 根本原因

**后端服务未运行或无法响应** - 这是唯一的可能原因。

✅ 前端正常（能看到登录界面）  
✅ 前端配置正确（请求发往正确地址）  
❌ **后端服务不可用**（所有 API 返回 404）

---

## 快速修复步骤

### 方法一：使用自动化脚本（推荐）

我已经为你创建了三个脚本：

#### 1. 检查后端状态
```bash
./check_backend_status.sh
```

这个脚本会：
- 检查后端进程是否运行
- 检查端口 8080 是否监听
- 测试主要 API 端点
- 显示最新日志

#### 2. 启动后端服务
```bash
./start_backend.sh
```

这个脚本会：
- 检查现有进程并可选重启
- 验证后端文件和目录
- 启动后端服务
- 测试 API 可用性

#### 3. 完整重新部署
```bash
./deploy_backend.sh
```

这个脚本会：
- 重新编译后端（Linux 版本）
- 上传到服务器
- 停止旧服务
- 启动新服务
- 验证运行状态

### 方法二：手动排查

#### 步骤 1：SSH 登录服务器
```bash
ssh 192.168.18.150
```

#### 步骤 2：检查后端进程
```bash
ps aux | grep -E 'main|computenook' | grep -v grep
```

**如果没有输出**，说明后端未运行 → 继续步骤 3  
**如果有输出**，说明后端在运行但可能有问题 → 跳到步骤 5

#### 步骤 3：检查端口占用
```bash
netstat -tlnp | grep 8080
# 或者
ss -tlnp | grep 8080
```

**如果没有输出**，确认端口 8080 未被监听 → 需要启动后端  
**如果有输出但不是你的后端**，说明端口被占用 → 需要换端口或停止占用进程

#### 步骤 4：启动后端服务

```bash
# 进入后端目录
cd /opt/computenook/backend

# 检查可执行文件是否存在
ls -la main

# 如果不存在，需要重新编译或上传
# 如果存在，启动服务
nohup ./main > ../logs/compute-nook.log 2>&1 &

# 等待几秒
sleep 3

# 检查进程
ps aux | grep main | grep -v grep
```

#### 步骤 5：查看日志
```bash
# 查看最新日志
tail -50 /opt/computenook/logs/compute-nook.log

# 实时监控日志
tail -f /opt/computenook/logs/compute-nook.log
```

**查找关键信息：**
- `Server starting on port 8080` - 正常启动
- `Failed to initialize database` - 数据库问题
- `Failed to start server` - 端口冲突或权限问题
- `panic:` - 程序崩溃

#### 步骤 6：测试 API
```bash
# 在服务器上测试
curl http://localhost:8080/config.js
curl http://localhost:8080/api/dashboard/stats

# 在本地测试
curl http://192.168.18.150:8080/config.js
curl http://192.168.18.150:8080/api/dashboard/stats
```

**预期结果：**
- `/config.js` 应该返回 JavaScript 配置
- `/api/dashboard/stats` 应该返回 401（需要认证）或数据

---

## 常见问题

### 问题 1：后端编译失败

**症状：** `deploy_backend.sh` 报错 "编译失败"

**解决方案：**
```bash
cd backend
go mod tidy
go build -o main main.go
```

检查是否缺少依赖或 Go 版本不兼容。

### 问题 2：数据库初始化失败

**症状：** 日志显示 `Failed to initialize database`

**解决方案：**
```bash
# 检查数据库目录权限
ls -la /opt/computenook/backend/data/

# 创建目录
mkdir -p /opt/computenook/backend/data/

# 设置权限
chmod 755 /opt/computenook/backend/data/
```

### 问题 3：端口被占用

**症状：** 日志显示 `bind: address already in use`

**解决方案：**
```bash
# 查找占用进程
netstat -tlnp | grep 8080

# 停止占用进程
kill <PID>

# 或者修改后端端口
echo "SERVER_PORT=8081" >> /opt/computenook/.env
```

### 问题 4：权限不足

**症状：** 日志显示 `permission denied`

**解决方案：**
```bash
# 修改可执行权限
chmod +x /opt/computenook/backend/main

# 修改目录权限
chown -R $(whoami) /opt/computenook/
```

### 问题 5：防火墙阻止

**症状：** 服务器本地能访问，外部无法访问

**解决方案：**
```bash
# CentOS/RHEL
firewall-cmd --add-port=8080/tcp --permanent
firewall-cmd --reload

# Ubuntu/Debian
ufw allow 8080/tcp
ufw reload

# 或临时关闭防火墙测试
systemctl stop firewalld  # CentOS
ufw disable              # Ubuntu
```

---

## 配置 systemd 服务（推荐）

为了让后端开机自启动并自动重启，建议配置为 systemd 服务。

### 创建服务文件

```bash
sudo tee /etc/systemd/system/computenook.service > /dev/null <<EOF
[Unit]
Description=ComputeNook HPC Platform Backend
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=/opt/computenook/backend
Environment="ENV_FILE=/opt/computenook/.env"
ExecStart=/opt/computenook/backend/main
Restart=always
RestartSec=10
StandardOutput=append:/opt/computenook/logs/compute-nook.log
StandardError=append:/opt/computenook/logs/compute-nook.log

[Install]
WantedBy=multi-user.target
EOF
```

### 启用服务

```bash
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

### 服务管理命令

```bash
# 启动
sudo systemctl start computenook

# 停止
sudo systemctl stop computenook

# 重启
sudo systemctl restart computenook

# 查看状态
sudo systemctl status computenook

# 查看日志
sudo journalctl -u computenook -n 100 --no-pager
```

---

## 验证修复

运行以下命令确认一切正常：

```bash
./check_backend_status.sh
```

**预期输出：**
```
✅ 进程运行中 (PID: 12345)
✅ 端口 8080 正在监听
✅ /config.js - HTTP 200
✅ /api/dashboard/stats - HTTP 401 (需要认证是正常的)
✅ /api/login - HTTP 405 (方法不允许是正常的)
```

然后在浏览器中访问：
```
http://192.168.18.150:8080
```

应该能看到登录界面，且不再无限刷新。

---

## 需要帮助？

如果上述方法都无法解决问题，请提供以下信息：

1. **进程状态：**
   ```bash
   ssh 192.168.18.150 "ps aux | grep main | grep -v grep"
   ```

2. **端口状态：**
   ```bash
   ssh 192.168.18.150 "netstat -tlnp | grep 8080"
   ```

3. **完整日志：**
   ```bash
   ssh 192.168.18.150 "tail -100 /opt/computenook/logs/compute-nook.log"
   ```

4. **systemd 状态（如果配置了）：**
   ```bash
   ssh 192.168.18.150 "systemctl status computenook"
   ```

5. **API 测试结果：**
   ```bash
   curl -v http://192.168.18.150:8080/config.js
   ```

把这些信息发给我，我会帮你进一步诊断。
