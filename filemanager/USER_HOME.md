# 用户家目录配置说明

## 功能说明

文件管理服务现在支持基于用户身份的家目录访问：

1. **自动识别用户**：从 JWT token 中提取用户名
2. **默认家目录**：自动使用 `/home/用户名` 作为默认路径
3. **安全隔离**：每个用户只能访问自己的目录（可配置）

## 工作原理

### 1. JWT 认证

服务从 HTTP 请求头中获取 JWT token：

```
Authorization: Bearer <token>
```

JWT token 包含用户信息：
```json
{
  "username": "sunfx",
  "uid": 24135,
  "isAdmin": true
}
```

### 2. 默认路径

当前端不指定路径时，后端自动使用用户家目录：

```go
// 如果没有指定路径
if path == "" {
    // 使用用户家目录
    path = "/home/" + username
}
```

### 3. 路径验证

所有路径都会经过安全验证：
- 禁止 `..` 路径遍历
- 限制在 `FILEMANAGER_BASE_PATH` 范围内
- 保护系统关键目录

## 配置示例

### 开发环境（允许访问所有用户目录）

```env
# 允许访问所有 /home 下的目录
FILEMANAGER_BASE_PATH=/
JWT_SECRET=xK8hL9mP2qR5sV7wY4zN6bE3tA1cF9gJ2dM4nP6rS8uV
```

### 生产环境（限制访问范围）

```env
# 只允许访问 /home 目录
FILEMANAGER_BASE_PATH=/home
JWT_SECRET=your-production-secret-key
```

### 单用户环境

```env
# 只允许访问特定用户目录
FILEMANAGER_BASE_PATH=/home/sunfx
JWT_SECRET=your-secret-key
```

## 用户体验

### 前端行为

1. **登录后**：自动进入用户家目录 `/home/用户名`
2. **返回主目录**：点击 🏠 按钮返回家目录
3. **路径导航**：可以在路径栏输入任意路径（受权限限制）

### 示例流程

```
用户登录 (sunfx)
  ↓
自动进入 /home/sunfx
  ↓
可以浏览子目录
  ├─ /home/sunfx/documents
  ├─ /home/sunfx/projects
  └─ /home/sunfx/downloads
  ↓
点击 🏠 返回 /home/sunfx
```

## API 调用示例

### 列出用户家目录

```bash
# 不指定路径，使用默认家目录
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8081/api/files/list"

# 响应
{
  "path": "/home/sunfx",
  "files": [...]
}
```

### 列出指定目录

```bash
# 指定路径
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8081/api/files/list?path=/home/sunfx/documents"
```

### 上传文件到家目录

```bash
# 不指定路径，上传到家目录
curl -H "Authorization: Bearer <token>" \
  -F "file=@test.txt" \
  "http://localhost:8081/api/files/upload"

# 文件保存到: /home/sunfx/test.txt
```

## 权限控制

### 管理员用户

管理员可以访问所有用户的目录（受 `FILEMANAGER_BASE_PATH` 限制）：

```bash
# 管理员可以访问其他用户目录
curl -H "Authorization: Bearer <admin-token>" \
  "http://localhost:8081/api/files/list?path=/home/user2"
```

### 普通用户

普通用户只能访问自己的目录：

```bash
# 普通用户访问自己的目录 - 成功
curl -H "Authorization: Bearer <user-token>" \
  "http://localhost:8081/api/files/list?path=/home/sunfx"

# 普通用户访问其他用户目录 - 失败（如果实现了权限检查）
curl -H "Authorization: Bearer <user-token>" \
  "http://localhost:8081/api/files/list?path=/home/other"
```

## 安全建议

### 1. JWT 密钥管理

```env
# 生产环境使用强密钥
JWT_SECRET=$(openssl rand -base64 32)
```

### 2. 基础路径限制

```env
# 限制在用户目录
FILEMANAGER_BASE_PATH=/home

# 或更严格的限制
FILEMANAGER_BASE_PATH=/data/users
```

### 3. 文件权限

确保文件系统权限正确设置：

```bash
# 设置用户目录权限
chmod 700 /home/username
chown username:username /home/username
```

### 4. 日志审计

服务会记录所有文件操作：

```
2024-01-01 12:00:00 Authenticated user: sunfx (uid=24135, admin=true)
2024-01-01 12:00:01 ListDirectory: user=sunfx, path=/home/sunfx
2024-01-01 12:00:02 UploadFile: user=sunfx, filename=test.txt, size=1024
```

## 故障排查

### 问题：无法访问家目录

**检查项**：
1. JWT token 是否有效
2. 用户名是否正确
3. 目录是否存在
4. 文件系统权限

```bash
# 检查目录
ls -la /home/sunfx

# 检查 JWT
echo "<token>" | base64 -d
```

### 问题：路径被拒绝

**检查项**：
1. `FILEMANAGER_BASE_PATH` 配置
2. 路径是否在允许范围内
3. 查看服务日志

```bash
# 查看日志
journalctl -u filemanager -f

# 或查看标准输出
./filemanager-linux-amd64
```

### 问题：JWT 验证失败

**检查项**：
1. JWT_SECRET 是否与主服务一致
2. Token 是否过期
3. Token 格式是否正确

```bash
# 测试 token
curl -H "Authorization: Bearer <token>" \
  http://localhost:8081/health
```

## 与主服务集成

确保文件管理服务的 JWT_SECRET 与主后端服务一致：

**主后端 (.env)**:
```env
JWT_SECRET=xK8hL9mP2qR5sV7wY4zN6bE3tA1cF9gJ2dM4nP6rS8uV
```

**文件管理服务 (.env)**:
```env
JWT_SECRET=xK8hL9mP2qR5sV7wY4zN6bE3tA1cF9gJ2dM4nP6rS8uV
```

## 测试

### 1. 获取 token

```bash
# 登录获取 token
TOKEN=$(curl -s -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"sunfx","password":"123123"}' \
  | jq -r '.token')
```

### 2. 测试文件管理

```bash
# 列出家目录
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8081/api/files/list"

# 创建文件夹
curl -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:8081/api/files/mkdir" \
  -d '{"path":"/home/sunfx/test"}'

# 上传文件
curl -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.txt" \
  "http://localhost:8081/api/files/upload"
```

## 总结

✅ **自动家目录**：用户登录后自动进入自己的家目录
✅ **JWT 认证**：安全的用户身份验证
✅ **路径验证**：防止未授权访问
✅ **灵活配置**：可根据需求调整访问范围
✅ **审计日志**：记录所有文件操作
