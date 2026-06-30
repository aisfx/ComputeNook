# HPC Platform Backend API

基于 Go + Gin 构建的 HPC 集群管理后端，提供用户认证、作业调度、远程桌面、Web Shell、文件管理等完整 API。

## 快速启动

```bash
cd backend
cp ../.env.example ../.env   # 填写实际配置
go run main.go               # 默认监听 :8080
```

---

## API 总览

所有需要认证的接口请在 Header 中携带：
```
Authorization: Bearer <token>
```

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/login` | 登录，返回 JWT token |
| POST | `/api/logout` | 登出，吊销 token |
| GET  | `/api/me` | 获取当前用户信息 |
| POST | `/api/change-password` | 修改密码 |
| GET  | `/api/captcha` | 获取图形验证码 |

**登录请求：**
```json
POST /api/login
{
  "username": "alice",
  "password": "secret",
  "captcha_id": "xxx",      // 连续失败后必填
  "captcha_answer": "1234"
}
```

**登录响应：**
```json
{
  "token": "eyJhbGc...",
  "user": { "username": "alice", "uid": 1001, "isAdmin": false },
  "mfa_required": false,     // true 时需跳转 MFA 验证
  "force_change_password": false
}
```

---

### MFA 双因子认证

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/mfa/status` | 查询当前用户 MFA 状态 |
| POST | `/api/mfa/setup` | 生成 TOTP 密钥和二维码 |
| POST | `/api/mfa/confirm` | 确认绑定（输入 6 位验证码） |
| POST | `/api/mfa/verify` | 登录时验证 TOTP 码 |
| POST | `/api/admin/users/:username/reset-mfa` | 管理员重置用户 MFA（需管理员权限） |

---

### 用户管理（需管理员权限）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET    | `/api/users` | 获取所有用户 |
| GET    | `/api/users/:username` | 获取单个用户 |
| POST   | `/api/users` | 创建用户 |
| PUT    | `/api/users/:username` | 更新用户信息 |
| DELETE | `/api/users/:username` | 删除用户 |
| POST   | `/api/users/:username/reset-password` | 重置密码 |
| POST   | `/api/users/:username/lock` | 锁定账户 |
| POST   | `/api/users/:username/unlock` | 解锁账户 |

**创建用户：**
```json
POST /api/users
{
  "username": "alice",
  "uid": 1001,
  "gid": 1001,
  "cnName": "Alice",
  "email": "alice@example.com",
  "phone": "13800138000",
  "shell": "/bin/bash",
  "homeDir": "/home/alice",
  "password": "init-password"
}
```

---

### 用户组管理（需管理员权限）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET    | `/api/groups` | 获取所有用户组 |
| POST   | `/api/groups` | 创建用户组 |
| PUT    | `/api/groups/:gid` | 更新用户组 |
| DELETE | `/api/groups/:gid` | 删除用户组 |

---

### 作业管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET    | `/api/jobs` | 获取作业列表（普通用户只看自己） |
| GET    | `/api/jobs/:jobId` | 获取作业详情 |
| POST   | `/api/jobs` | 提交作业 |
| DELETE | `/api/jobs/:jobId` | 取消作业 |
| POST   | `/api/jobs/:jobId/suspend` | 暂停作业 |
| POST   | `/api/jobs/:jobId/resume` | 恢复作业 |

**提交作业：**
```json
POST /api/jobs
{
  "name": "my-job",
  "partition": "compute",
  "nodes": 1,
  "ntasks": 4,
  "memory": "8G",
  "time": "01:00:00",
  "script": "#!/bin/bash\n#SBATCH ...\nsrun ./my-program"
}
```

---

### Slurm 账户管理（需管理员权限）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET    | `/api/slurm/accounts` | 获取所有 Slurm 账户 |
| POST   | `/api/slurm/accounts` | 创建账户 |
| DELETE | `/api/slurm/accounts/:name` | 删除账户 |
| GET    | `/api/slurm/users` | 获取 Slurm 用户列表 |
| POST   | `/api/slurm/users` | 添加 Slurm 用户 |
| DELETE | `/api/slurm/users/:name` | 删除 Slurm 用户 |
| GET    | `/api/associations` | 获取资源绑定列表 |
| POST   | `/api/associations` | 创建资源绑定 |
| DELETE | `/api/associations` | 删除资源绑定 |
| GET    | `/api/qos` | 获取 QoS 列表 |
| POST   | `/api/qos` | 创建 QoS |
| PUT    | `/api/qos/:name` | 更新 QoS |
| DELETE | `/api/qos/:name` | 删除 QoS |

---

### Web Shell

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/webshell/nodes` | 获取可连接节点列表 |
| WS   | `/api/webshell/connect?node=<name>&token=<jwt>` | 建立 WebSocket SSH 会话 |
| GET  | `/api/webshell/keys/check` | 检查是否已上传 SSH 私钥 |
| POST | `/api/webshell/keys/upload` | 上传 SSH 私钥 |
| POST | `/api/webshell/keys/generate` | 自动生成 ED25519 密钥对 |
| POST | `/api/webshell/keys/deploy` | 部署公钥到节点 |

**SSH 隧道代理（供 hpc-client 使用）：**

| 方法 | 路径 | 说明 |
|------|------|------|
| WS   | `/api/ssh/proxy?host=<host>&port=22&user=<user>&token=<jwt>` | TCP 透传，给 ssh/PuTTY 使用 |

节点列表通过环境变量配置：
```env
WEBSHELL_NODES=[{"name":"ln0","host":"192.168.1.10","port":22,"enabled":true}]
```

---

### 远程桌面

| 方法 | 路径 | 说明 |
|------|------|------|
| GET    | `/api/desktop/sessions` | 获取桌面会话列表 |
| POST   | `/api/desktop/sessions` | 创建新桌面会话 |
| DELETE | `/api/desktop/sessions/:id` | 停止并删除会话 |
| WS     | `/api/desktop/sessions/:id/xpra-ws` | Xpra WebSocket 代理 |
| WS     | `/api/desktop/sessions/:id/rdp-ws` | RDP WebSocket 代理（供 hpc-client） |
| WS     | `/api/desktop/sessions/:id/vnc-ws` | VNC WebSocket 代理（供 hpc-client） |
| GET    | `/api/desktop/sessions/:id/client-signal` | 轮询退出信号（hpc-client 心跳） |

---

### 文件管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET    | `/api/files?path=<path>` | 列出目录内容 |
| GET    | `/api/files/download?path=<path>` | 下载文件 |
| POST   | `/api/files/upload?path=<path>` | 上传文件（multipart） |
| POST   | `/api/files/mkdir` | 创建目录 |
| POST   | `/api/files/rename` | 重命名 |
| DELETE | `/api/files?path=<path>` | 删除文件/目录 |
| GET    | `/api/webdav/*path` | WebDAV 挂载入口 |

---

### 存储配额

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/quota` | 获取当前用户配额 |
| GET  | `/api/admin/quotas` | 获取所有用户配额（管理员） |
| POST | `/api/admin/quotas/:username` | 设置用户配额（管理员） |

---

### 集群监控

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/monitoring/nodes` | 节点状态列表 |
| GET  | `/api/monitoring/metrics?query=<promql>` | Prometheus 查询 |
| GET  | `/api/dashboard` | 仪表盘汇总数据 |
| GET  | `/api/usage` | 机时使用统计 |
| GET  | `/api/reports` | 报表数据 |

---

### 主机资产（CMDB）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET    | `/api/cmdb/hosts` | 获取主机列表 |
| POST   | `/api/cmdb/hosts` | 新增主机 |
| PUT    | `/api/cmdb/hosts/:id` | 更新主机 |
| DELETE | `/api/cmdb/hosts/:id` | 删除主机 |
| POST   | `/api/cmdb/import` | Excel 批量导入 |
| GET    | `/api/cmdb/rack` | 获取机柜布局 |

---

### AI 助手

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai/chat` | 发送对话消息（流式 SSE） |
| GET  | `/api/ai/knowledge?q=<query>` | 知识库检索 |

**对话请求：**
```json
POST /api/ai/chat
{
  "message": "如何写一个 MPI 并行作业脚本？",
  "history": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}
```

响应为 SSE 流，每行格式：`data: <text chunk>`

---

### 审计日志（需管理员权限）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/audit/logs` | 查询审计日志 |
| GET  | `/api/audit/logs/export` | 导出 CSV |

查询参数：`username`, `action`, `start_time`, `end_time`, `page`, `page_size`

---

### 客户端下载

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET  | `/download` | 下载页面（HTML） | 无需 |
| GET  | `/api/download/:file` | 下载客户端二进制 | 需要 |

可下载文件：`hpc-client-windows.exe` / `hpc-client-mac` / `hpc-client-linux`

客户端文件存放在后端同级 `clients/` 目录，通过 `npm run release` 自动编译生成。

---

## hpc-client 客户端

`backend/tools/rdp-tunnel/` 下的 Go 程序，支持 Windows / macOS / Linux。

**功能：**
- 注册 `hpcc://` 自定义协议，网页一键拉起
- SSH 隧道：将节点 SSH 端口映射到本地，供 ssh/PuTTY 连接
- RDP 隧道：将远程桌面端口映射到本地，自动启动 mstsc
- Xpra 隧道：将 Xpra 端口映射到本地，自动启动 Xpra 客户端
- VNC 隧道：将 VNC 端口映射到本地，自动启动 VNC Viewer
- WebDAV 挂载：将 HPC 文件系统挂载到本地磁盘

**安装：**
```bash
# macOS / Linux
chmod +x hpc-client-mac && ./hpc-client-mac install

# Windows（管理员 PowerShell）
.\hpc-client-windows.exe install
```

**编译：**
```bash
cd backend/tools/rdp-tunnel
make all        # 编译三平台（macOS 需要 lipo 合并 universal binary）
make windows    # 仅 Windows
make linux      # 仅 Linux
make mac        # macOS universal binary (amd64 + arm64)
```

---

## 环境变量速查

| 变量 | 说明 |
|------|------|
| `SERVER_PORT` | 监听端口，默认 8080 |
| `JWT_SECRET` | JWT 签名密钥 |
| `JWT_EXPIRE_HOURS` | Token 有效期（小时），默认 8 |
| `LDAP_HOST` / `LDAP_PORT` | LDAP 服务器 |
| `LDAP_BIND_DN` / `LDAP_BIND_PASSWORD` | LDAP 管理员凭据 |
| `LDAP_BASE_DN` | LDAP 基础 DN |
| `SLURM_REST_URL` | slurmrestd 地址 |
| `SLURM_API_VERSION` | Slurm REST API 版本 |
| `PROMETHEUS_URL` | Prometheus 地址 |
| `WEBSHELL_NODES` | 可连接节点 JSON 数组 |
| `FILEMANAGER_BASE_PATH` | 文件管理根目录 |
| `QUOTA_FS_TYPE` | 配额类型：xfs / nfs / lustre |
| `DESKTOP_PARTITION` | 远程桌面 Slurm 分区 |
| `DESKTOP_SSH_KEY` | 后端连接计算节点的 SSH 私钥路径 |
| `AI_API_URL` / `AI_API_KEY` / `AI_MODEL` | AI 接口配置 |
| `MFA_ENABLED` | MFA 模式：false / optional / global |
| `DEV_MODE` | 开发模式，跳过 LDAP |
| `DEMO_READONLY` | 演示只读模式 |
| `CORS_ORIGINS` | 允许的跨域来源（逗号分隔） |
