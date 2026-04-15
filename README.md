# HPC Web 管理平台

基于 Vue 3 + TypeScript + Go 构建的高性能计算集群统一管理平台，支持亮色/暗色双主题，参考 shadcn-admin 设计风格。

## 功能模块

- **仪表盘** — 集群概览、节点状态、CPU/GPU/内存实时统计、作业统计
- **作业管理** — 作业列表、提交作业、作业模板库（CFD/化学/AI/ML 等预设模板）
- **Web Shell** — 浏览器内 SSH 终端，支持多节点连接
- **远程桌面** — VNC 远程访问计算节点图形界面
- **文件管理** — 集群文件系统浏览、上传下载、重命名删除
- **报表中心** — 机时使用统计与报表导出
- **集群监控** — Grafana 集成（管理员）
- **系统管理** — 用户/用户组、Slurm 账户/用户、QoS、资源绑定、机时管理、存储配额、数据审计（管理员）

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + TypeScript + Vite |
| 后端 | Go + Gin |
| 认证 | LDAP + JWT |
| 调度 | Slurm REST API |
| 文件服务 | 独立 Go 文件管理服务 |

## 快速开始

### 前端

```bash
npm install
npm run dev        # 开发模式，访问 http://localhost:3000
npm run build      # 构建到 dist/
```

### 后端

```bash
cd backend
cp .env.example .env   # 配置 LDAP、Slurm、JWT 等参数
go run main.go         # 启动，默认端口 8080
```

后端会自动查找前端静态文件：优先 `backend/static/`，其次 `../dist/`。

### 文件管理服务

```bash
cd filemanager
go run main.go    # 默认端口 8081
```

## 配置说明

主要配置项（`backend/.env`）：

```env
LDAP_HOST=192.168.x.x
LDAP_PORT=389
LDAP_BASE_DN=dc=example,dc=com
JWT_SECRET=your-secret
SLURM_REST_URL=http://slurm-host:6820
SLURM_JWT_KEY=your-slurm-jwt-key
SERVER_PORT=8080
```

前端环境变量（`.env`）：

```env
VITE_API_URL=http://localhost:8080
VITE_FILEMANAGER_URL=http://localhost:8081
```

## 主题

右上角 🌙/☀️ 按钮切换亮色/暗色主题，设置自动保存到 localStorage。

## 项目结构

```
├── src/                  # 前端源码
│   ├── views/            # 页面组件
│   ├── components/       # 通用组件
│   ├── styles/           # 全局样式（CSS 变量系统）
│   ├── api/              # API 封装
│   ├── config/           # 配置
│   ├── data/             # 静态数据（作业模板等）
│   └── utils/            # 工具函数
├── backend/              # Go 后端
│   ├── handlers/         # API 处理器
│   ├── middleware/        # 中间件
│   ├── models/           # 数据模型
│   ├── slurm/            # Slurm 客户端
│   └── main.go
└── filemanager/          # 文件管理服务
```
