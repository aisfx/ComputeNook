# 文件管理服务配置说明

## 环境变量配置

### FILEMANAGER_PORT

服务监听端口。

```env
FILEMANAGER_PORT=8081
```

**默认值**: `8081`

### FILEMANAGER_BASE_PATH

文件管理的基础路径，用户只能访问此路径及其子目录。

```env
# 允许访问所有目录（开发环境）
FILEMANAGER_BASE_PATH=/

# 只允许访问 /home 目录（推荐）
FILEMANAGER_BASE_PATH=/home

# 只允许访问特定用户目录
FILEMANAGER_BASE_PATH=/home/username
```

**默认值**: `/home`

**安全建议**:
- 开发环境可以设置为 `/` 方便测试
- 生产环境建议设置为 `/home` 或更具体的路径
- 永远不要在生产环境设置为 `/` 除非有特殊需求

### CORS_ALLOWED_ORIGINS

允许跨域访问的源地址列表，用逗号分隔。

```env
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,https://hpc.example.com
```

**默认值**: `*` (允许所有源)

## 配置示例

### 开发环境配置

```env
# 开发环境 - 允许访问所有目录
FILEMANAGER_PORT=8081
FILEMANAGER_BASE_PATH=/
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### 生产环境配置

```env
# 生产环境 - 限制访问范围
FILEMANAGER_PORT=8081
FILEMANAGER_BASE_PATH=/home
CORS_ALLOWED_ORIGINS=https://hpc.example.com,https://files.example.com
```

### 多用户环境配置

如果需要为不同用户提供不同的基础路径，可以部署多个实例：

**用户组 A**:
```env
FILEMANAGER_PORT=8081
FILEMANAGER_BASE_PATH=/data/groupa
```

**用户组 B**:
```env
FILEMANAGER_PORT=8082
FILEMANAGER_BASE_PATH=/data/groupb
```

## 路径验证规则

1. **禁止 `..` 路径**
   - 任何包含 `..` 的路径都会被拒绝
   - 防止目录遍历攻击

2. **基础路径限制**
   - 用户只能访问 `FILEMANAGER_BASE_PATH` 及其子目录
   - 超出范围的路径会返回 "访问被拒绝" 错误

3. **系统目录保护**
   - 禁止删除 `/`, `/home`, `/etc`, `/usr`, `/var` 等系统目录
   - 即使在基础路径范围内也不允许

## 常见问题

### Q: 为什么提示 "访问被拒绝：路径超出允许范围"？

**A**: 检查以下几点：

1. 确认 `.env` 文件中的 `FILEMANAGER_BASE_PATH` 设置
2. 确认访问的路径在基础路径范围内
3. 查看服务日志了解详细信息

示例：
```bash
# 如果 FILEMANAGER_BASE_PATH=/home
# 可以访问: /home/user1, /home/user2/documents
# 不能访问: /var/log, /etc/passwd
```

### Q: 如何允许访问所有目录？

**A**: 设置基础路径为根目录：

```env
FILEMANAGER_BASE_PATH=/
```

**警告**: 这会允许访问系统所有目录，仅用于开发环境！

### Q: 如何限制特定用户只能访问自己的目录？

**A**: 有两种方式：

**方式 1**: 为每个用户部署独立实例
```env
FILEMANAGER_BASE_PATH=/home/username
```

**方式 2**: 在应用层实现权限控制（需要修改代码）

### Q: Windows 系统如何配置路径？

**A**: Windows 使用反斜杠或正斜杠都可以：

```env
# 方式 1
FILEMANAGER_BASE_PATH=C:\Users

# 方式 2
FILEMANAGER_BASE_PATH=C:/Users
```

### Q: 如何查看当前配置？

**A**: 启动服务时会在日志中显示配置：

```bash
./filemanager-linux-amd64
# 输出:
# =========================================
# File Manager Service Starting
# =========================================
# SERVICE_PORT: 8081
# BASE_PATH: /home
# =========================================
```

## 测试配置

使用测试脚本验证配置：

```bash
# Linux/macOS
./test.sh

# Windows
test.bat
```

或手动测试：

```bash
# 健康检查
curl http://localhost:8081/health

# 列出目录
curl "http://localhost:8081/api/files/list?path=/home"

# 查看日志
# 服务会输出详细的路径验证信息
```

## 安全最佳实践

1. **最小权限原则**
   - 只授予必要的目录访问权限
   - 使用最具体的基础路径

2. **使用专用用户运行**
   ```bash
   sudo useradd -r -s /bin/false filemanager
   sudo chown -R filemanager:filemanager /opt/filemanager
   ```

3. **启用 HTTPS**
   - 生产环境必须使用 HTTPS
   - 使用 Nginx 反向代理

4. **限制文件大小**
   - 在 Nginx 中配置 `client_max_body_size`
   - 防止大文件上传攻击

5. **定期审计**
   - 检查访问日志
   - 监控异常访问模式

6. **备份配置**
   - 定期备份 `.env` 文件
   - 使用版本控制管理配置

## 更新配置

修改配置后需要重启服务：

```bash
# systemd
sudo systemctl restart filemanager

# 直接运行
# 按 Ctrl+C 停止，然后重新启动
./filemanager-linux-amd64
```

## 配置验证

启动服务后，检查日志确认配置已生效：

```bash
# 查看 systemd 日志
sudo journalctl -u filemanager -n 50

# 或查看标准输出
# 服务启动时会显示当前配置
```
