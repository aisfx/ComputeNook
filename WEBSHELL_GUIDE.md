# Web Shell 功能使用指南

## 功能概述

Web Shell 是一个基于浏览器的SSH终端，允许用户通过Web界面安全地连接到HPC集群节点。该功能支持：

- 🔐 基于SSH私钥的安全认证
- 📊 实时会话管理和监控
- 📝 完整的用户行为日志记录
- 🖥️ 全功能终端模拟器
- ⚙️ 灵活的节点配置管理

## 系统架构

```
┌─────────────────┐    WebSocket    ┌─────────────────┐    SSH    ┌─────────────────┐
│   前端浏览器    │ ◄──────────────► │   后端服务器    │ ◄────────► │   HPC节点       │
│   (xterm.js)    │                 │   (Go + Gin)    │           │   (SSH Server)  │
└─────────────────┘                 └─────────────────┘           └─────────────────┘
                                            │
                                            ▼
                                    ┌─────────────────┐
                                    │   日志存储      │
                                    │   用户行为记录  │
                                    └─────────────────┘
```

## 配置说明

### 1. 后端配置 (.env)

**重要提示**: 
- `WEBSHELL_NODES` 必须是**单行JSON格式**，不能有换行符
- 开发环境设置 `DEV_MODE=true` 以跳过JWT认证
- 生产环境必须设置 `DEV_MODE=false` 并使用真实的JWT认证

```bash
# Web Shell 节点配置 (JSON格式 - 必须是单行)
WEBSHELL_NODES=[{"name":"login-node","host":"192.168.5.250","port":22,"description":"登录节点","enabled":true},{"name":"compute-node-1","host":"192.168.5.251","port":22,"description":"计算节点1","enabled":true}]

# Web Shell 会话超时时间（分钟）
WEBSHELL_SESSION_TIMEOUT=30

# Web Shell 日志保留天数
WEBSHELL_LOG_RETENTION_DAYS=30

# 开发模式配置（仅用于开发测试）
DEV_MODE=true
DEV_USER=admin
DEV_USER_UID=1000
DEV_USER_IS_ADMIN=true
```

### 2. 节点配置参数

| 参数 | 类型 | 说明 |
|------|------|------|
| name | string | 节点名称（唯一标识） |
| host | string | 节点IP地址或主机名 |
| port | int | SSH端口（通常为22） |
| description | string | 节点描述信息 |
| enabled | boolean | 是否启用该节点 |

### 3. 目录结构

```
backend/
├── keys/                    # 用户SSH私钥存储
│   └── {user_id}/
│       └── id_rsa          # 用户私钥文件
├── logs/                   # 会话日志存储
│   └── webshell/
│       └── {user_id}/
│           └── {timestamp}_{host}_{session_id}.log
└── webshell/               # Web Shell 模块
    ├── ssh_client.go       # SSH客户端
    ├── session_manager.go  # 会话管理
    └── session_logger.go   # 日志记录
```

## API 接口

### 1. 节点管理

```http
GET /api/webshell/nodes
```
获取可用节点列表

```http
POST /api/webshell/nodes/{node_name}/test
```
测试节点连接

### 2. 会话管理

```http
GET /api/webshell/connect?node={node_name}
```
WebSocket连接端点

```http
GET /api/webshell/sessions
```
获取用户会话列表

```http
DELETE /api/webshell/sessions/{session_id}
```
关闭指定会话

### 3. 日志管理

```http
GET /api/webshell/logs
```
获取会话日志列表

```http
GET /api/webshell/logs/{log_file}/download
```
下载日志文件

### 4. 密钥管理

```http
POST /api/webshell/keys/upload
```
上传SSH私钥

## 使用流程

### 1. 准备SSH密钥

用户需要准备SSH私钥文件，通常是 `id_rsa` 格式：

```bash
# 生成SSH密钥对
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# 将公钥添加到目标节点的 ~/.ssh/authorized_keys
ssh-copy-id username@node_host
```

### 2. 上传私钥

1. 在Web Shell界面点击"上传密钥"
2. 选择私钥文件（通常是 `~/.ssh/id_rsa`）
3. 系统会安全存储私钥到服务器

### 3. 连接节点

1. 点击"选择节点连接"
2. 选择要连接的节点
3. 系统会自动建立SSH连接
4. 在浏览器中使用完整的终端功能

### 4. 会话管理

- 查看活动会话：点击"会话管理"
- 关闭会话：在会话列表中点击"关闭会话"
- 会话会在30分钟无活动后自动超时

### 5. 日志查看

- 查看历史日志：点击"日志查看"
- 搜索日志内容：在搜索框中输入关键词
- 下载日志：点击日志文件的"下载"按钮

## 安全特性

### 1. 认证安全

- 使用SSH私钥认证，不传输密码
- 私钥在服务器端加密存储
- 支持用户级别的密钥隔离

### 2. 会话安全

- WebSocket连接使用JWT令牌认证
- 会话自动超时机制
- 实时会话状态监控

### 3. 日志审计

- 记录所有用户输入命令
- 记录命令输出结果
- 记录会话连接/断开事件
- 支持日志搜索和导出

### 4. 权限控制

- 基于用户身份的访问控制
- 节点级别的启用/禁用控制
- 管理员可查看所有用户会话

## 日志格式

每个会话的日志以JSON格式存储：

```json
{
  "timestamp": "2024-03-03T10:30:00Z",
  "type": "command",
  "content": "ls -la"
}
{
  "timestamp": "2024-03-03T10:30:01Z",
  "type": "output",
  "content": "total 12\ndrwxr-xr-x 3 user user 4096 Mar  3 10:30 .\n"
}
{
  "timestamp": "2024-03-03T10:30:05Z",
  "type": "event",
  "event": "session_end",
  "data": {"duration": 300.5}
}
```

### 日志类型

- `command`: 用户输入的命令
- `output`: 命令执行输出
- `event`: 会话事件（连接、断开等）

## 故障排除

### 1. 连接失败

**问题**: 无法连接到节点
**解决方案**:
- 检查节点配置是否正确
- 确认SSH服务是否运行
- 验证网络连通性
- 检查私钥是否正确上传

### 2. 认证失败

**问题**: SSH认证失败
**解决方案**:
- 确认私钥格式正确
- 检查公钥是否已添加到目标节点
- 验证用户名是否正确
- 检查私钥文件权限

### 3. "User not authenticated" 错误

**问题**: 上传密钥或访问API时提示 "User not authenticated"

**原因**: 认证中间件未正确设置用户对象到上下文中

**解决方案**:
1. **开发环境**: 在 `.env` 文件中设置 `DEV_MODE=true`
   ```bash
   DEV_MODE=true
   DEV_USER=admin
   DEV_USER_UID=1000
   DEV_USER_IS_ADMIN=true
   ```

2. **生产环境**: 确保前端发送正确的JWT token
   ```javascript
   const token = localStorage.getItem('token') || sessionStorage.getItem('token');
   fetch('/api/webshell/nodes', {
     headers: {
       'Authorization': `Bearer ${token}`
     }
   });
   ```

3. **后端修复**: 确认 `middleware/auth.go` 正确设置用户对象
   ```go
   // 设置用户对象和单独的字段（兼容两种访问方式）
   c.Set("user", map[string]interface{}{
       "username": username,
       "uid":      strconv.Itoa(uid),
       "isAdmin":  isAdmin,
   })
   ```

### 4. JSON解析错误 "Unexpected token '<'"

**问题**: 前端加载节点列表时报错 `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`

**原因**: 
- 后端服务未运行或未监听正确端口
- 路由未正确注册
- 前端请求了错误的URL

**解决方案**:

1. **确认后端运行**:
   ```bash
   # 检查后端是否在8080端口运行
   curl http://localhost:8080/api/webshell/nodes
   
   # 应该返回JSON格式的节点列表
   {"data":[{"name":"login-node","host":"192.168.5.250",...}]}
   ```

2. **检查Vite代理配置** (`hpcweb/vite.config.ts`):
   ```typescript
   export default defineConfig({
     plugins: [vue()],
     server: {
       port: 3000,
       proxy: {
         '/api': {
           target: 'http://localhost:8080',
           changeOrigin: true,
           ws: true, // 支持WebSocket
         }
       }
     }
   })
   ```

3. **验证路由注册** (`backend/main.go`):
   ```go
   webshell := auth.Group("/webshell")
   {
       webshell.GET("/nodes", handlers.GetNodes)
       webshell.POST("/keys/upload", handlers.UploadPrivateKey)
       // ... 其他路由
   }
   ```

4. **测试API端点**:
   ```bash
   # 使用PowerShell测试
   Invoke-WebRequest -Uri "http://localhost:8080/api/webshell/nodes" | Select-Object -ExpandProperty Content
   ```

### 5. 会话断开

**问题**: 会话意外断开
**解决方案**:
- 检查网络连接稳定性
- 确认会话是否超时
- 查看服务器日志排查问题
- 重新建立连接

### 4. 日志问题

**问题**: 日志记录异常
**解决方案**:
- 检查日志目录权限
- 确认磁盘空间充足
- 查看服务器错误日志
- 重启Web Shell服务

## 性能优化

### 1. 会话管理

- 定期清理过期会话
- 限制单用户最大会话数
- 优化WebSocket连接池

### 2. 日志管理

- 定期清理过期日志
- 压缩历史日志文件
- 实现日志轮转机制

### 3. 资源监控

- 监控内存使用情况
- 监控网络连接数
- 监控磁盘空间使用

## 扩展功能

### 1. 文件传输

可以扩展支持文件上传/下载功能：

```bash
# 上传文件到节点
scp local_file user@node:/remote/path

# 从节点下载文件
scp user@node:/remote/path local_file
```

### 2. 端口转发

支持SSH端口转发功能：

```bash
# 本地端口转发
ssh -L local_port:remote_host:remote_port user@node

# 远程端口转发
ssh -R remote_port:local_host:local_port user@node
```

### 3. 多会话管理

支持同时连接多个节点：

- 标签页式会话管理
- 会话间快速切换
- 会话状态同步

## 维护指南

### 1. 定期维护

```bash
# 清理过期会话
find logs/webshell -name "*.log" -mtime +30 -delete

# 清理临时文件
find /tmp -name "webshell_*" -mtime +1 -delete

# 检查磁盘空间
df -h
```

### 2. 监控指标

- 活跃会话数量
- 日志文件大小
- 系统资源使用率
- 错误日志统计

### 3. 备份策略

- 定期备份用户私钥
- 备份重要会话日志
- 备份系统配置文件

## 最佳实践

1. **安全性**
   - 定期轮换SSH密钥
   - 使用强密码保护私钥
   - 限制节点访问权限

2. **性能**
   - 合理设置会话超时时间
   - 定期清理历史数据
   - 监控系统资源使用

3. **可用性**
   - 配置多个备用节点
   - 实现负载均衡
   - 建立故障恢复机制

4. **合规性**
   - 保留必要的审计日志
   - 实现数据加密传输
   - 遵循安全规范要求