# Web Shell 问题修复总结

## 修复日期
2026年3月3日

## 问题描述

用户在使用Web Shell功能时遇到两个主要错误：

1. **JSON解析错误**: `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`
2. **认证错误**: `User not authenticated`

## 根本原因分析

### 问题1: JSON解析错误
- **原因**: 前端收到HTML响应而不是JSON，通常是因为后端未运行或路由配置错误
- **影响**: 无法加载节点列表

### 问题2: 认证错误
- **原因**: 认证中间件 (`middleware/auth.go`) 未正确设置用户对象到Gin上下文
- **具体问题**: 
  - 中间件只设置了单独的字段 (`username`, `uid`, `isAdmin`)
  - WebShell处理器期望获取完整的 `user` 对象
  - 导致 `c.Get("user")` 返回 `nil`

## 修复方案

### 1. 修复认证中间件 (middleware/auth.go)

**修改位置**: `slurm-web/backend/middleware/auth.go`

**开发模式部分**:
```go
// 设置用户对象和单独的字段（兼容两种访问方式）
c.Set("user", map[string]interface{}{
    "username": username,
    "uid":      strconv.Itoa(uid),
    "isAdmin":  isAdmin,
})
c.Set("username", username)
c.Set("uid", uid)
c.Set("isAdmin", isAdmin)
```

**生产模式部分**:
```go
uid := int(claims["uid"].(float64))
isAdmin := claims["isAdmin"].(bool)

// 设置用户对象和单独的字段（兼容两种访问方式）
c.Set("user", map[string]interface{}{
    "username": username,
    "uid":      strconv.Itoa(uid),
    "isAdmin":  isAdmin,
})
c.Set("username", username)
c.Set("uid", uid)
c.Set("isAdmin", isAdmin)
```

### 2. 添加日志包导入 (handlers/webshell.go)

**修改位置**: `slurm-web/backend/handlers/webshell.go`

```go
import (
    "encoding/json"
    "fmt"
    "log"  // 新增
    "net/http"
    "os"
    "path/filepath"
    "strconv"
    "time"
    // ...
)
```

### 3. 启用开发模式 (.env)

**修改位置**: `slurm-web/backend/.env`

```bash
# 开发模式配置
DEV_MODE=true
DEV_USER=admin
DEV_USER_UID=1000
DEV_USER_IS_ADMIN=true
```

**注意**: 生产环境必须设置 `DEV_MODE=false`

## 验证测试

### 测试1: 获取节点列表

```bash
# PowerShell命令
Invoke-WebRequest -Uri "http://localhost:8080/api/webshell/nodes" | Select-Object -ExpandProperty Content

# 预期输出
{"data":[{"name":"login-node","host":"192.168.5.250","port":22,"description":"登录节点","enabled":true},...]}
```

### 测试2: 上传私钥

```bash
# PowerShell命令
$boundary = [System.Guid]::NewGuid().ToString()
$headers = @{"Content-Type"="multipart/form-data; boundary=$boundary"}
$body = "--$boundary`r`nContent-Disposition: form-data; name=`"private_key`"; filename=`"test.key`"`r`nContent-Type: application/octet-stream`r`n`r`ntest key content`r`n--$boundary--`r`n"
Invoke-WebRequest -Uri "http://localhost:8080/api/webshell/keys/upload" -Method POST -Headers $headers -Body $body

# 预期输出
{"message":"Private key uploaded successfully"}
```

### 测试3: 前端集成测试

创建了测试页面 `slurm-web/test-webshell.html` 用于验证API功能。

## 后端日志确认

修复后的后端日志显示：

```
2026/03/03 13:50:32 DEV_MODE is enabled, skipping authentication
[GIN] 2026/03/03 - 13:50:32 | 200 | 3.837ms | ::1 | GET "/api/webshell/nodes"

2026/03/03 13:51:00 UploadPrivateKey: Processing upload for user 1000
2026/03/03 13:51:00 UploadPrivateKey: Received file test.key
2026/03/03 13:51:00 UploadPrivateKey: Successfully uploaded key for user 1000
[GIN] 2026/03/03 - 13:51:00 | 200 | 3.9427ms | ::1 | POST "/api/webshell/keys/upload"
```

## 修改的文件列表

1. `slurm-web/backend/middleware/auth.go` - 修复认证中间件
2. `slurm-web/backend/handlers/webshell.go` - 添加log包导入
3. `slurm-web/backend/.env` - 启用开发模式
4. `slurm-web/WEBSHELL_GUIDE.md` - 更新文档，添加故障排除章节
5. `slurm-web/test-webshell.html` - 新增API测试页面（用于验证）
6. `slurm-web/WEBSHELL_FIX_SUMMARY.md` - 本文档

## 关键要点

1. **认证对象设置**: 中间件必须同时设置 `user` 对象和单独字段，以兼容不同的访问方式
2. **开发模式**: 开发环境使用 `DEV_MODE=true` 简化测试，生产环境必须使用JWT认证
3. **JSON格式**: `.env` 中的 `WEBSHELL_NODES` 必须是单行JSON格式
4. **路由注册**: 确认所有WebShell路由已正确注册到 `/api/webshell/*`
5. **Vite代理**: 前端开发服务器需要配置代理转发API请求到后端

## 后续建议

1. **生产部署**: 部署到生产环境前，务必设置 `DEV_MODE=false`
2. **JWT配置**: 确保 `JWT_SECRET` 使用强随机字符串
3. **HTTPS**: 生产环境使用HTTPS保护WebSocket连接
4. **密钥安全**: 定期审计用户私钥存储，确保文件权限正确（0600）
5. **日志监控**: 监控会话日志，及时发现异常行为
6. **性能优化**: 根据实际使用情况调整会话超时和日志保留策略

## 测试清单

- [x] 后端编译成功
- [x] 后端服务启动正常
- [x] 获取节点列表API正常
- [x] 上传私钥API正常
- [x] 认证中间件正确设置用户对象
- [x] 开发模式跳过JWT认证
- [ ] 前端页面加载节点列表
- [ ] 前端上传私钥功能
- [ ] WebSocket连接建立
- [ ] SSH连接到实际节点
- [ ] 会话日志记录
- [ ] 生产环境JWT认证

## 联系信息

如有问题，请查看：
- 详细文档: `WEBSHELL_GUIDE.md`
- 后端日志: 运行 `go run main.go` 查看实时日志
- API测试: 使用 `test-webshell.html` 进行快速测试
