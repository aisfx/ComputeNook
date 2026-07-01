# 算力小筑 - 前端

基于 React 18 + TypeScript + Vite + Ant Design 5 构建的 HPC 集群管理平台前端。

## 技术栈

- **框架**: React 18
- **语言**: TypeScript 5
- **构建工具**: Vite 5
- **UI 组件库**: Ant Design 5
- **路由**: React Router 6
- **HTTP 客户端**: Axios
- **图表**: ECharts 5
- **日期处理**: Day.js

## 项目结构

```
frontend/
├── src/
│   ├── pages/              # 页面组件
│   │   ├── login/          # 登录页
│   │   ├── mfa-setup/      # MFA 设置页
│   │   ├── force-change-password/  # 强制修改密码页
│   │   ├── user/           # 用户端页面
│   │   │   ├── dashboard/  # 仪表盘
│   │   │   ├── jobs/       # 作业管理
│   │   │   ├── webshell/   # Web Shell
│   │   │   ├── desktop/    # 远程桌面
│   │   │   ├── files/      # 文件管理
│   │   │   ├── monitoring/ # 集群监控
│   │   │   ├── ai/         # AI 助手
│   │   │   ├── profile/    # 个人信息
│   │   │   └── download/   # 客户端下载
│   │   └── admin/          # 管理员页面
│   │       ├── overview/   # 总览
│   │       ├── users/      # 用户管理
│   │       ├── groups/     # 用户组管理
│   │       ├── slurm-accounts/  # Slurm 账户
│   │       ├── slurm-users/     # Slurm 用户
│   │       ├── qos/        # QoS 管理
│   │       ├── associations/    # 资源绑定
│   │       ├── partitions/ # 分区管理
│   │       ├── billing/    # 机时管理
│   │       ├── quota/      # 存储配额
│   │       └── audit/      # 审计日志
│   ├── layouts/            # 布局组件
│   │   ├── UserLayout.tsx  # 用户端布局
│   │   └── AdminLayout.tsx # 管理员布局
│   ├── hooks/              # 自定义 Hooks
│   │   └── useTheme.ts     # 主题切换 Hook
│   ├── utils/              # 工具函数
│   │   └── auth.ts         # 认证相关工具
│   ├── styles/             # 全局样式
│   │   └── global.css      # 全局 CSS
│   ├── App.tsx             # 应用根组件
│   └── main.tsx            # 应用入口
├── public/                 # 静态资源
│   └── favicon.svg         # 网站图标
├── index.html              # HTML 模板
├── vite.config.ts          # Vite 配置
├── tsconfig.json           # TypeScript 配置
└── package.json            # 依赖配置
```

## 开发指南

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

开发模式下，API 请求会通过 Vite 代理转发到 `http://localhost:8080`。

### 构建生产版本

```bash
npm run build
```

构建产物会输出到 `../backend/static/` 目录。

### 预览生产构建

```bash
npm run preview
```

## 主要功能模块

### 用户端

1. **仪表盘** (`/dashboard`)
   - 展示用户资源使用情况
   - 快速访问常用功能
   - 作业统计和机时余额

2. **作业管理** (`/dashboard/jobs`)
   - 提交和管理 Slurm 作业
   - 查看作业状态和日志
   - 支持作业模板

3. **Web Shell** (`/dashboard/webshell`)
   - 浏览器内 SSH 终端
   - 支持多节点切换
   - 命令历史和会话持久化

4. **远程桌面** (`/dashboard/desktop`)
   - 创建和管理远程桌面会话
   - 支持浏览器和客户端连接
   - VNC/RDP 协议支持

5. **文件管理** (`/dashboard/files`)
   - 浏览、上传、下载文件
   - 文件重命名、删除操作
   - 支持拖拽上传

6. **集群监控** (`/dashboard/monitoring`)
   - 节点状态实时监控
   - 资源使用率图表
   - 作业运行统计

7. **AI 助手** (`/dashboard/ai`)
   - HPC 智能问答
   - 作业脚本生成
   - 知识库检索

8. **个人信息** (`/dashboard/profile`)
   - 查看和修改个人资料
   - 修改密码
   - MFA 设置

9. **客户端下载** (`/dashboard/download`)
   - 下载桌面客户端
   - 支持 Windows/macOS/Linux

### 管理员端

1. **总览** (`/admin/overview`)
   - 系统整体状态
   - 用户和作业统计
   - 资源使用趋势

2. **用户管理** (`/admin/users`)
   - 创建、编辑、删除用户
   - 重置密码
   - 账户锁定/解锁

3. **用户组管理** (`/admin/groups`)
   - 管理用户组
   - 组成员管理

4. **Slurm 账户** (`/admin/slurm-accounts`)
   - Slurm 账户管理
   - 账户层级结构

5. **Slurm 用户** (`/admin/slurm-users`)
   - Slurm 用户绑定
   - 账户关联

6. **QoS 管理** (`/admin/qos`)
   - 服务质量策略
   - 资源限制配置

7. **资源绑定** (`/admin/associations`)
   - 用户-账户-分区关联
   - QoS 分配

8. **分区管理** (`/admin/partitions`)
   - 计算分区配置
   - 资源分配

9. **机时管理** (`/admin/billing`)
   - 机时充值和扣费
   - 使用记录查询

10. **存储配额** (`/admin/quota`)
    - 用户存储配额管理
    - 配额使用监控

11. **审计日志** (`/admin/audit`)
    - 操作日志查询
    - 日志导出

## 开发规范

### 代码风格

- 使用 TypeScript 严格模式
- 遵循 React Hooks 最佳实践
- 组件使用函数式组件
- 使用 Ant Design 组件保持 UI 一致性

### 命名规范

- 组件文件使用 PascalCase：`UserDashboard.tsx`
- 工具函数文件使用 camelCase：`auth.ts`
- 常量使用 UPPER_SNAKE_CASE：`API_BASE_URL`

### 状态管理

- 使用 React 内置状态管理（useState, useContext）
- 表单状态使用 Ant Design Form
- 全局状态（如主题）使用自定义 Hooks

### API 请求

- 使用 Axios 进行 HTTP 请求
- 统一错误处理和拦截器配置
- 请求携带 JWT Token

### 主题支持

- 支持亮色/暗色双主题
- 主题状态持久化到 localStorage
- 使用 Ant Design 主题配置系统

## 环境变量

开发环境配置通过 Vite 的环境变量系统管理。

```bash
# .env.development
VITE_API_BASE_URL=http://localhost:8080
```

生产环境下，API 地址通过运行时配置（`window.__CONFIG__`）动态获取。

## 浏览器支持

- Chrome >= 90
- Firefox >= 88
- Safari >= 14
- Edge >= 90

## 构建优化

- 代码分割（Code Splitting）
- 路由懒加载
- 第三方库独立打包
- Tree Shaking
- 生产环境压缩

## 调试技巧

### React DevTools

安装 React Developer Tools 浏览器插件进行组件调试。

### 网络请求

打开浏览器开发者工具的 Network 面板查看 API 请求。

### 代理配置

在 `vite.config.ts` 中配置 API 代理：

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
    },
  },
}
```

## 常见问题

### Q: 开发环境下 API 请求 401 错误？

A: 确保后端服务已启动，并且 Token 未过期。检查 `localStorage` 中的 `token` 值。

### Q: 构建后样式丢失？

A: 检查 `vite.config.ts` 中的 `base` 配置是否正确。

### Q: WebSocket 连接失败？

A: 确保后端 WebSocket 服务正常，检查浏览器控制台的错误信息。

## 参与开发

欢迎提交 Issue 和 Pull Request！

开发流程：

1. Fork 项目
2. 创建功能分支：`git checkout -b feature/xxx`
3. 提交代码：`git commit -m 'Add xxx feature'`
4. 推送分支：`git push origin feature/xxx`
5. 提交 Pull Request

## 许可证

MIT License
