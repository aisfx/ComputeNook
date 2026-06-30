# Bug 记录与前端重写指南

## 已知 Bug：QoS preempt 字段解析错误

### 错误信息
```
failed to parse qos response: json: cannot unmarshal object into Go struct field QoS.qos.preempt of type []string
```

### 根因
Slurm API 返回的 `preempt` 字段是一个对象：
```json
{ "list": ["normal", "low"], "mode": "requeue", "exempt_time": {"set":true,"number":3600} }
```
但旧版编译的二进制中 `Preempt` 字段类型为 `[]string`，导致反序列化失败。

### 当前源码状态
`backend/slurm/qos.go` 中 `Preempt` 已改为 `interface{}`：
```go
Preempt interface{} `json:"preempt,omitempty"`
```
**需要重新编译后端**才能生效：
```bash
cd backend
go build -o computenook main.go
```

### 辅助函数已处理多种格式
```go
func GetPreemptList(qos *QoS) []string    // 提取 preempt list
func GetPreemptMode(qos *QoS) string      // 提取 preempt mode
func GetPreemptExemptTime(qos *QoS) int   // 提取豁免时间
```

---

## 中间件说明

### 认证中间件（middleware/auth.go）
- 从 Header `Authorization: Bearer <token>` 解析 JWT
- 将 `username`、`uid`、`is_admin` 写入 gin.Context
- Token 黑名单检查（logout 后加入黑名单）

### 速率限制（middleware/ratelimit.go）
- `LoginRateLimitMiddleware`：登录接口防暴力破解

### 只读演示模式（middleware/readonly.go）
- `DEMO_READONLY=true` 时拦截 POST/PUT/DELETE，返回 403 + `code: "DEMO_READONLY"`

### 审计中间件（middleware/audit.go）
- 自动记录所有写操作到 audit_logs 表

### 参数净化（middleware/sanitize.go）
- 过滤非法查询参数，防注入

---

## 前端重写建议

### 保持不变的部分
1. **API 路径** — 所有 `/api/*` 路径完全不变
2. **认证流程** — JWT + Bearer Token，存 localStorage/sessionStorage
3. **路由结构** — 5 条路由（/login、/dashboard、/admin、/force-change-password、/download）
4. **WebSocket URL** — webshell/vnc/xpra/ssh-proxy 路径不变
5. **响应格式** — `{ "data": ... }` / `{ "error": ... }` / `{ "message": ... }`

### 推荐使用的库（与现有兼容）
- Vue 3 + TypeScript（已在使用）
- Vue Router 4（已在使用）
- Axios（已在使用，拦截器逻辑保持不变）
- xterm.js 5（WebShell 终端）
- noVNC（VNC 远程桌面）
- ECharts 6（图表）

### 可以替换的部分
- 组件库：可引入 Element Plus / Naive UI / shadcn-vue 等
- 样式方案：可用 Tailwind CSS 替代现有手写 CSS 变量方案
- 状态管理：可引入 Pinia（当前用 ref/reactive）

### 主题颜色规范（保持一致）
```css
主色（紫）:   #6366f1 ~ #8b5cf6
成功（绿）:   hsl(142 71% 45%)
危险（红）:   hsl(0 84% 60%)
警告（橙）:   hsl(38 92% 50%)
```

### 关键业务逻辑

#### 登录流程
```
POST /api/login
  ├── 成功 → 存 token/user → 跳转 /dashboard
  ├── mfa_required=true → 存 temp_token → 跳转 /mfa-setup
  └── passwordMustChange=true → 跳转 /force-change-password
```

#### WebShell 连接
```
1. GET /api/webshell/nodes → 获取节点列表
2. 选择节点 → 建立 WebSocket ws://host/api/webshell/connect?node=xxx
3. 首帧发送 { token: "Bearer xxx", node: "ln0" }
4. xterm.js 与 WebSocket 双向绑定
```

#### VNC 桌面连接
```
1. POST /api/desktop/sessions → 创建会话记录
2. POST /api/desktop/sessions/:id/start → 提交 Slurm 作业
3. 轮询 GET /api/desktop/sessions/:id/status 直到 running
4. 建立 WebSocket ws://host/api/desktop/sessions/:id/vnc-ws
5. noVNC RFB 连接该 WebSocket
```

#### 文件上传（分块/进度）
```
POST /api/files/upload（multipart/form-data）
Headers: Authorization: Bearer xxx, X-Upload-Path: /home/user/
Body: file=<binary>
全局进度通过 uploadManager.ts 中的 uploadTasks reactive 数组管理
```

## Slurm API 版本兼容说明

当前支持：Slurm REST API **v0.0.43 ~ v0.0.44**

环境变量：`SLURM_API_VERSION=v0.0.44`

### v0.0.43+ 数据结构变化

**QoS limits 嵌套结构**（新）：
```json
{
  "limits": {
    "max": {
      "tres": {
        "per": { "user": [{"type":"cpu","count":128},{"type":"gres/gpu","count":4}] },
        "minutes": { "total": [{"type":"billing","count":100000}] }
      },
      "jobs": { "per": { "user": {"set":true,"number":100} } },
      "wall_clock": { "per": { "job": {"set":true,"number":1440} } }
    }
  }
}
```

**Priority 字段**（新格式）：
```json
{ "set": true, "infinite": false, "number": 100 }
```

**Preempt 字段**（新格式）：
```json
{ "list": ["normal","low"], "mode": ["REQUEUE"] }
```

Go 代码中通过 `interface{}` + switch case 处理新旧两种格式。

### Slurm JWT 认证

```go
// slurm/jwt.go
// 使用 SLURM_JWT_KEY 生成 HS256 JWT
// 每次请求重新生成（SLURM_JWT_LIFESPAN 秒）
// 以 X-SLURM-USER-TOKEN Header 发送
```

---

## 构建与发布

### 后端构建
```bash
cd backend
go build -o computenook main.go          # Linux/Mac
go build -o computenook.exe main.go      # Windows
```

### 前端构建
```bash
npm run build    # 产物在 dist/
```

### 一键发布包
```bash
npm run release     # x86_64
npm run release:x86 # x86_64
npm run release:arm # ARM64
# 产物：release/computenook.zip
# 包含：computenook 二进制 + dist/ 静态文件 + 配置示例
```

### 部署结构
```
/opt/computenook/
├── computenook          # 后端二进制
├── static/              # 前端构建产物（dist/ 复制过来）
│   ├── index.html
│   ├── assets/
│   └── novnc-lib/
├── data/
│   └── computenook.db   # SQLite 数据库
├── logs/
│   ├── compute-nook.log
│   └── audit/
├── knowledge/           # AI 知识库
│   └── vault/
└── .env                 # 配置文件
```

### Systemd Service
```ini
# scripts/computenook.service
[Unit]
Description=ComputeNook HPC Platform
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/computenook
ExecStart=/opt/computenook/computenook
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Nginx 配置（scripts/nginx.conf）
```nginx
server {
    listen 80;
    server_name hpc.example.com;

    location /api {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location /novnc {
        proxy_pass http://127.0.0.1:8080;
    }

    location / {
        proxy_pass http://127.0.0.1:8080;
    }
}
```

---

## 常见问题

### Q: 前端 API 请求 404
检查 `window.__CONFIG__.apiUrl` 是否正确注入。
生产环境由 `/config.js` 动态注入，开发环境直连 `:8080`。

### Q: WebSocket 连接失败
确保 nginx 配置了 `Upgrade` 和 `Connection` 头，且 `proxy_http_version 1.1`。

### Q: Slurm API 超时
检查 `SLURM_REST_URL` 是否可达，`SLURM_JWT_KEY` 是否正确。
可临时设置 `DEV_MODE=true` 使用 mock 数据测试前端。

### Q: LDAP 连接失败
检查 `LDAP_HOST`、`LDAP_BIND_DN`、`LDAP_BIND_PASSWORD`。
`LDAP_SKIP_VERIFY=true` 可跳过 TLS 证书验证（仅测试用）。

### Q: Redis 缓存不生效
确认 `REDIS_ENABLE=true` 且 `REDIS_ADDR` 正确。
后端启动日志会显示 "Redis connected successfully" 或警告。

### Q: QoS 列表报错 "failed to parse qos response"
**需要重新编译后端**，旧二进制的 `Preempt` 字段类型为 `[]string`，
新源码已改为 `interface{}`，重新编译即可解决。
