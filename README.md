# HPC Web 管理平台

基于 Vue 3 + TypeScript + Go 构建的高性能计算集群统一管理平台，支持亮色/暗色双主题。

> 更新日志见 [CHANGELOG.md](./CHANGELOG.md)

## 项目对接

| | |
|---|---|
| 对接人 | sunfx |
| QQ | 598824458 |
| 邮箱 | 59882445@qq.com |

---

## 功能模块

### 用户功能

| 模块 | 说明 |
|---|---|
| 仪表盘 | 集群概览、节点状态、CPU/GPU/内存实时统计、作业统计、账户配额、机时信息、存储配额 |
| 作业管理 | 作业列表、提交作业、作业模板库（CFD/化学/AI/ML 等预设模板）、作业暂停/恢复/取消 |
| Web Shell | 浏览器内 SSH 终端，支持多节点连接，行为日志记录 |
| 远程桌面 | VNC 远程访问计算节点图形界面，支持 hpc-client 隧道连接 |
| 文件管理 | 集群文件系统浏览、上传下载、重命名删除、WebDAV 挂载支持 |
| 报表中心 | 机时使用统计与报表导出 |
| 主机资产 (CMDB) | 主机信息管理、Excel 批量导入导出、多 IP 支持、一键同步到机柜图 |
| HPC 应用助手 | 悬浮 AI 助手（孙大圣），解答并行计算/科学软件/作业脚本问题，内置紧箍咒拦截运维话题 |

### 管理员功能

| 模块 | 说明 |
|---|---|
| 用户管理 | LDAP 用户/用户组增删改查、禁用、强制改密 |
| 账户管理 | Slurm 账户/用户管理 |
| 资源管理 | QoS 配置、资源绑定（Association）、机时管理、存储配额 |
| 集群监控 | Prometheus 实时指标、告警规则、节点状态、机柜管理、网络拓扑 |
| AI 诊断 | 基于 Prometheus 实时数据的集群运维诊断，前端自动注入监控数据，AI 直接分析 |
| 数据审计 | API 操作审计、前端页面访问审计、SSH 行为日志，记录真实客户端 IP 和访问地址 |

---

## 近期整改项

### 安全与认证
- [x] 登出时后端吊销 JWT token（内存黑名单），hpc-client 隧道同步失效
- [x] 审计日志记录真实客户端公网 IP（支持 X-Real-IP / X-Forwarded-For / CF-Connecting-IP）
- [x] 审计日志新增 `access_host` 字段，记录用户通过哪个域名/地址访问平台
- [x] 前端页面访问行为纳入审计（页面切换自动上报，500ms 防抖）

### AI 功能
- [x] HPC 应用助手（AIAssistant）与 AI 诊断（AIDiagnostics）职责分离
  - 应用助手：聚焦 MPI/OpenMP/Python/作业脚本等用户侧问题
  - AI 诊断：聚焦 Prometheus 监控数据分析、告警根因、性能瓶颈
- [x] AI 诊断前端主动查询 Prometheus 并注入实时数据，不依赖 AI 主动调用工具
- [x] 问答知识库：每次问答异步写入 Obsidian Vault（Markdown 格式），启动时加载历史问答做 RAG 检索
- [x] 孙大圣紧箍咒系统：5 种拦截模式（紧箍咒/死机/害怕/困惑/生气），HPC 上下文白名单豁免，关键词精确化避免误触

### 资产管理
- [x] 新增独立 CMDB 主机资产模块（主导航直接访问）
- [x] 支持 Excel 批量导入，主机名去重自动更新
- [x] 多 IP 地址支持（业务口/管理口/IB口/BMC 等分类）
- [x] CMDB 一键同步到机柜图（自动解析 U 位、创建机柜、填充设备信息）

### SSH 行为审计
- [x] SSH 隧道日志过滤 ANSI 转义码和控制字符，解决乱码问题
- [x] 仅记录可见字符输入，纯控制字符（方向键等）不写入日志

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + TypeScript + Vite |
| 后端 | Go + Gin |
| 认证 | LDAP + JWT |
| 调度 | Slurm REST API |
| 监控 | Prometheus + node_exporter |
| AI | 兼容 OpenAI API 的任意模型（MiniMax/DeepSeek/GPT 等） |
| 知识库 | 本地 Markdown 文件（Obsidian Vault 兼容）+ 内存 2-gram 索引 |

---

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

---

## 主要配置项

```env
# 服务
SERVER_PORT=8080

# LDAP
LDAP_HOST=192.168.x.x
LDAP_PORT=389
LDAP_BASE_DN=dc=example,dc=com
LDAP_BIND_DN=cn=Manager,dc=example,dc=com
LDAP_BIND_PASSWORD=your-password

# JWT
JWT_SECRET=your-secret

# Slurm
SLURM_REST_URL=http://slurm-host:6820
SLURM_JWT_KEY=your-slurm-jwt-key

# Prometheus
PROMETHEUS_URL=http://localhost:9090

# AI
AI_API_URL=https://api.openai.com/v1/chat/completions
AI_API_KEY=your-api-key
AI_MODEL=gpt-4o-mini

# 知识库（Obsidian Vault 目录，留空默认 ./knowledge/vault）
OBSIDIAN_VAULT_DIR=./knowledge/vault
```

---

## 项目结构

```
├── src/                  # 前端源码
│   ├── views/            # 页面组件
│   ├── components/       # 通用组件（AIAssistant 等）
│   ├── utils/            # 工具函数（auth、diagnostics、knowledge）
│   └── styles/           # 全局样式
├── backend/
│   ├── handlers/         # API 处理器
│   ├── middleware/        # 认证、审计、CORS、token 黑名单
│   ├── models/           # 数据模型
│   ├── audit/            # 审计日志
│   ├── knowledge/        # AI 知识库（Obsidian 写入 + RAG 检索）
│   └── main.go
└── scripts/              # 部署脚本、nginx 配置
```
