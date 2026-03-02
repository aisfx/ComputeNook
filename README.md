# HPC Web 管理系统

一个基于Web的高性能计算（HPC）集群管理系统，提供用户管理、作业调度、资源监控等功能。

## 📋 项目概述

本系统是一个现代化的HPC集群管理平台，集成了LDAP用户认证、Slurm作业调度、资源配额管理等功能，为HPC集群提供友好的Web界面。

### 主要特性

- 🔐 **用户认证与授权**：基于LDAP的用户管理，支持JWT令牌认证
- 👥 **用户与组管理**：完整的用户、用户组CRUD操作
- 📊 **作业管理**：作业提交、监控、取消等操作
- 📝 **作业模板**：预定义的作业模板，支持自定义模板
- 💾 **资源管理**：Slurm账户、QoS、分区管理
- 📈 **审计日志**：完整的操作审计追踪
- 🎨 **现代化UI**：基于Vue 3的响应式界面

## 🏗️ 技术架构

### 后端技术栈

- **语言**：Go 1.21+
- **Web框架**：Gin
- **认证**：JWT (JSON Web Tokens)
- **LDAP客户端**：go-ldap
- **日志**：自定义日志系统
- **API文档**：内置API文档生成

### 前端技术栈

- **框架**：Vue 3 (Composition API)
- **构建工具**：Vite
- **语言**：TypeScript
- **路由**：Vue Router
- **HTTP客户端**：Axios
- **样式**：原生CSS

### 集成系统

- **LDAP**：用户认证和目录服务
- **Slurm**：作业调度和资源管理
- **Slurm REST API**：v0.0.40

## 📁 项目结构

```
.
├── backend/                    # 后端服务
│   ├── audit/                 # 审计日志模块
│   ├── handlers/              # HTTP请求处理器
│   │   ├── auth.go           # 认证相关
│   │   ├── user.go           # 用户管理
│   │   ├── group.go          # 用户组管理
│   │   ├── job.go            # 作业管理
│   │   ├── qos.go            # QoS管理
│   │   └── slurm_account.go  # Slurm账户管理
│   ├── ldap/                  # LDAP客户端
│   ├── logger/                # 日志系统
│   ├── middleware/            # 中间件
│   │   ├── auth.go           # 认证中间件
│   │   ├── audit.go          # 审计中间件
│   │   └── cors.go           # CORS中间件
│   ├── models/                # 数据模型
│   ├── slurm/                 # Slurm客户端
│   │   ├── client.go         # REST API客户端
│   │   ├── account.go        # 账户管理
│   │   ├── job.go            # 作业管理
│   │   └── qos.go            # QoS管理
│   ├── logs/                  # 日志文件目录
│   ├── .env                   # 环境配置
│   ├── main.go               # 程序入口
│   └── go.mod                # Go依赖管理
│
├── hpcweb/                    # 前端应用
│   ├── src/
│   │   ├── api/              # API接口定义
│   │   ├── components/       # Vue组件
│   │   │   ├── JobInfo.vue          # 作业信息
│   │   │   ├── JobSubmit.vue        # 作业提交
│   │   │   ├── JobTemplates.vue     # 作业模板
│   │   │   └── JobDetailModal.vue   # 作业详情
│   │   ├── data/             # 数据配置
│   │   │   └── jobTemplates.ts      # 作业模板数据
│   │   ├── router/           # 路由配置
│   │   ├── styles/           # 全局样式
│   │   ├── utils/            # 工具函数
│   │   │   ├── auth.ts              # 认证工具
│   │   │   └── notification.ts      # 通知工具
│   │   ├── views/            # 页面视图
│   │   │   ├── Login.vue            # 登录页
│   │   │   ├── Dashboard.vue        # 仪表盘
│   │   │   ├── JobManagement.vue    # 作业管理
│   │   │   ├── Admin*.vue           # 管理页面
│   │   │   └── Profile.vue          # 个人资料
│   │   ├── App.vue           # 根组件
│   │   └── main.ts           # 应用入口
│   ├── package.json          # NPM依赖
│   └── vite.config.ts        # Vite配置
│
└── README.md                  # 项目文档
```

## 🚀 快速开始

### 环境要求

- Go 1.21+
- Node.js 18+
- LDAP服务器
- Slurm集群（带REST API）

### 后端配置

1. **配置环境变量**

编辑 `backend/.env` 文件：

```bash
# LDAP配置
LDAP_HOST=192.168.5.250
LDAP_PORT=30833
LDAP_BIND_DN=cn=Manager,dc=thhpc,dc=cn
LDAP_BIND_PASSWORD=secret
LDAP_BASE_DN=dc=thhpc,dc=cn

# Slurm REST API配置
SLURM_REST_URL=http://192.168.5.250:30099
SLURM_REST_TOKEN=your_slurm_token_here
SLURM_API_VERSION=v0.0.40

# JWT配置
JWT_SECRET=your_secret_key_here

# 服务器配置
SERVER_PORT=8080
CORS_ALLOWED_ORIGINS=http://localhost:5173

# 开发模式（生产环境设为false）
DEV_MODE=false
```

2. **安装依赖**

```bash
cd backend
go mod download
```

3. **启动后端服务**

```bash
# 使用启动脚本（推荐）
./start.sh

# 或直接运行
go run main.go
```

后端服务将在 `http://localhost:8080` 启动

### 前端配置

1. **安装依赖**

```bash
cd hpcweb
npm install
```

2. **启动开发服务器**

```bash
npm run dev
```

前端应用将在 `http://localhost:5173` 启动

3. **构建生产版本**

```bash
npm run build
```

## 📖 功能说明

### 1. 用户管理

- **用户CRUD**：创建、查看、编辑、删除用户
- **密码管理**：重置密码、强制修改密码
- **账户状态**：启用/禁用账户
- **UID/GID管理**：自动分配或手动指定

### 2. 用户组管理

- **组CRUD**：创建、查看、编辑、删除用户组
- **成员管理**：添加/移除组成员
- **GID管理**：自动分配或手动指定

### 3. 作业管理

#### 作业提交
- 支持多种资源配置（CPU、内存、GPU、节点）
- 自动获取可用分区和QoS
- 作业模板快速提交
- 自定义脚本路径和输出文件

#### 作业监控
- 实时查看作业状态（运行中、等待中、已完成）
- 作业详情查看
- 作业取消操作
- 作业历史记录（最近1年）

#### 作业模板
- **内置模板**：
  - GPU训练模板
  - CPU计算模板
  - 数据分析模板
  - 快速调试模板
- **专业应用模板**：
  - Fluent流体仿真
  - Gaussian量子化学
  - LAMMPS分子动力学
  - PyTorch深度学习
  - OpenFOAM CFD
  - VASP第一性原理
- **自定义模板**：支持创建、编辑、删除自定义模板

### 4. Slurm资源管理

#### 账户管理
- Slurm账户创建（支持层级结构）
- 账户关联管理
- 资源配额设置

#### QoS管理
- QoS策略配置
- 优先级设置
- 资源限制配置

#### 分区管理
- 查看可用分区
- 分区状态监控
- 节点信息查看

### 5. 审计日志

- 完整的操作记录
- 按用户、操作类型、时间筛选
- 日志导出功能
- 统计分析

## 🔒 安全特性

- **JWT认证**：基于令牌的无状态认证
- **密码加密**：LDAP密码安全存储
- **权限控制**：基于角色的访问控制（RBAC）
- **审计追踪**：所有操作记录审计日志
- **CORS保护**：跨域请求控制
- **Token过期**：自动处理过期令牌

## 🛠️ 开发工具

### 后端测试脚本

```bash
# 测试分区API
./backend/test_partitions.sh

# 测试作业提交
./backend/test_job_submit.sh

# 测试作业查询
./backend/test_jobs.sh

# 查看日志
./backend/view_logs.sh
```

### API文档

访问 `http://localhost:8080/api` 查看完整的API文档

## 📊 API端点

### 认证相关
- `POST /api/login` - 用户登录
- `GET /api/me` - 获取当前用户信息
- `POST /api/profile/change-password` - 修改密码

### 用户管理
- `GET /api/users` - 获取用户列表
- `POST /api/users` - 创建用户
- `GET /api/users/:username` - 获取用户详情
- `PUT /api/users/:username` - 更新用户
- `DELETE /api/users/:username` - 删除用户

### 作业管理
- `GET /api/jobs` - 获取作业列表
- `POST /api/jobs` - 提交作业
- `GET /api/jobs/:id` - 获取作业详情
- `DELETE /api/jobs/:id` - 取消作业
- `GET /api/partitions` - 获取分区列表

### Slurm管理
- `GET /api/slurm/accounts` - 获取Slurm账户
- `POST /api/slurm/accounts` - 创建Slurm账户
- `GET /api/qos` - 获取QoS列表
- `POST /api/qos` - 创建QoS

## 🐛 故障排查

### 常见问题

1. **无法连接LDAP**
   - 检查LDAP服务器地址和端口
   - 验证绑定DN和密码
   - 检查网络连接

2. **Slurm API错误**
   - 确认Slurm REST API服务运行
   - 检查Token是否过期（使用`scontrol token`生成新Token）
   - 验证API版本匹配

3. **分区名称无效**
   - 使用`sinfo`命令查看实际分区名称
   - 确保前端获取的分区列表正确

4. **前端无法连接后端**
   - 检查CORS配置
   - 确认后端服务运行在正确端口
   - 查看浏览器控制台错误

### 日志查看

```bash
# 查看后端日志
tail -f backend/logs/backend.log

# 查看审计日志
tail -f backend/logs/audit/audit-$(date +%Y-%m-%d).log

# 使用日志查看工具
./backend/view_logs.sh -f
```

## 📝 开发指南

### 添加新的API端点

1. 在 `backend/handlers/` 中创建handler函数
2. 在 `backend/main.go` 中注册路由
3. 在 `hpcweb/src/api/index.ts` 中添加API调用
4. 在相应的Vue组件中使用

### 添加新的作业模板

编辑 `hpcweb/src/data/jobTemplates.ts`：

```typescript
export const customTemplates: JobTemplate[] = [
  {
    id: 201,
    name: '我的自定义模板',
    icon: '🎯',
    category: 'general',
    nodes: 2,
    cpus: 16,
    memory: 32,
    gpus: 0,
    time: 4,
    // ... 其他配置
  }
]
```

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

## 📄 许可证

本项目采用 MIT 许可证

## 👥 联系方式

- 项目维护者：sunfx
- 邮箱：598824458@qq.com

## 🙏 致谢

- [Gin](https://github.com/gin-gonic/gin) - Go Web框架
- [Vue.js](https://vuejs.org/) - 渐进式JavaScript框架
- [Slurm](https://slurm.schedmd.com/) - 作业调度系统
- [OpenLDAP](https://www.openldap.org/) - 目录服务

---

**注意**：本系统仅供学习和研究使用，生产环境部署前请进行充分的安全评估和测试。
