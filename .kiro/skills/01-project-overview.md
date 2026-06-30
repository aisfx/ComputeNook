# ComputeNook（算力小筑）项目概览

## 项目定位
算力小筑是一套面向 HPC（高性能计算）集群的 Web 管理平台，提供用户自助、管理员运维、作业调度、资源监控等功能。

## 技术栈

### 后端
- **语言**: Go 1.25
- **Web 框架**: Gin v1.9.1
- **数据库**: SQLite（默认）/ MySQL，ORM 层自封装
- **认证**: JWT（golang-jwt/jwt v5）+ LDAP（go-ldap v3）
- **缓存**: Redis（go-redis v9）可选，支持降级到无缓存模式
- **WebSocket**: gorilla/websocket
- **HPC 调度器**: Slurm REST API（v0.0.43 ~ v0.0.44）
- **其他**: captcha、pquerna/otp（MFA）、excelize（Excel 导出）

### 前端
- **框架**: Vue 3.4 + TypeScript 5.3
- **构建**: Vite 7 + vue-tsc
- **路由**: Vue Router 4
- **图表**: ECharts 6 + ECharts-GL（3D 拓扑）
- **终端**: xterm.js 5
- **远程桌面**: noVNC 1.6、Xpra HTML5 Client
- **HTTP**: Axios 1.6
- **Excel**: xlsx 0.18

## 目录结构

```
ComputeNook/
├── backend/                  # Go 后端（主目录）
│   ├── main.go               # 入口、路由注册
│   ├── handlers/             # HTTP Handler（业务逻辑）
│   ├── models/               # 数据模型（SQLite/MySQL）
│   ├── slurm/                # Slurm REST API 客户端
│   ├── ldap/                 # LDAP 用户/组操作
│   ├── cache/                # Redis 缓存管理
│   ├── middleware/           # Gin 中间件
│   ├── audit/                # 审计日志
│   ├── knowledge/            # AI 知识库存储
│   ├── webshell/             # WebShell SSH 会话管理
│   ├── logger/               # 日志封装
│   ├── data/                 # SQLite 数据库文件
│   └── logs/                 # 运行日志 & 审计日志
├── frontend/                 # React (Ant Design Pro) 前端
│   ├── src/pages/            # 页面组件
│   ├── src/services/         # API 请求封装
│   ├── src/components/       # 可复用组件
│   └── src/utils/            # 工具函数
├── old/                      # 旧版代码（Vue3 前端 + 旧后端备份）
├── scripts/                  # 部署脚本、nginx 配置、systemd service
└── .env / .env.example       # 环境变量配置
```

## 部署架构
```
用户浏览器
    │
    ▼
Nginx（可选反代）
    │
    ▼
Go 后端 :8080
    ├── 静态文件（dist/）
    ├── /api/*  ──► Gin Router
    │                ├── LDAP Server
    │                ├── Slurm REST API
    │                ├── Redis（可选）
    │                └── SQLite/MySQL
    ├── /novnc  ──► noVNC 静态文件
    └── /xpra   ──► Xpra HTML5 静态文件
```

## 开发环境启动

```bash
# 后端（在 backend/ 目录）
cd backend
go run main.go

# 前端（在 frontend/ 目录）
cd frontend
npm run dev   # UmiJS dev server :8000，代理 /api 到 :8080
```

## 构建发布

```bash
# 前端构建
cd frontend
npm run build        # 产物在 frontend/dist/

# 后端构建
cd backend
go build -o computenook main.go

# 一键打包发布
cd frontend
npm run release      # 执行 scripts/release.cjs，打 zip 包
```

## 环境变量（关键配置）

| 变量 | 说明 | 默认值 |
|------|------|--------|
| SERVER_PORT | 监听端口 | 8080 |
| DB_TYPE | sqlite / mysql | sqlite |
| LDAP_HOST | LDAP 服务器 | - |
| JWT_SECRET | JWT 签名密钥（≥32字节） | - |
| SLURM_REST_URL | Slurm REST API 地址 | - |
| SLURM_API_VERSION | API 版本 | v0.0.44 |
| SLURM_JWT_KEY | Slurm JWT 密钥 | - |
| DEV_MODE | 开发模拟模式 | false |
| DEMO_READONLY | 只读演示模式 | false |
| REDIS_ENABLE | 启用 Redis 缓存 | false |
| PROMETHEUS_URL | Prometheus 地址 | - |
| AI_API_URL | AI 接口（OpenAI 兼容） | - |
| MFA_ENABLED | false/optional/global | false |
