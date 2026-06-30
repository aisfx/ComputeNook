# 前端页面与组件参考

## 路由结构

```
/ → /dashboard（重定向）
/login          → Login.vue（公开）
/mfa-setup      → MFASetup.vue（公开）
/force-change-password → ForceChangePassword.vue（需登录）
/dashboard      → Layout.vue（需登录）
/admin          → AdminLayout.vue（需登录 + 管理员）
/download       → Download.vue（需登录）
```

路由守卫逻辑：
- 未登录 → 重定向 `/login`
- `passwordMustChange=true` → 强制跳转 `/force-change-password`
- 非管理员访问 `/admin` → 重定向 `/dashboard`

## 用户界面（Layout.vue）

单页应用，通过 `currentView` ref 控制内容区渲染，**不切换路由**。

### 侧边栏导航

| currentView 值 | 页面名称 | 组件 |
|----------------|---------|------|
| dashboard | 仪表盘 | Dashboard.vue |
| jobs | 作业管理 | JobManagement.vue |
| shell | Web Shell | WebShell.vue（KeepAlive） |
| desktop | 远程桌面 | Desktop.vue |
| files | 文件管理 | FileManager.vue |
| registry | 镜像仓库 | Registry.vue |
| reports | 报表中心 | Reports.vue |
| ai-tasks | AI 作业 | AITasks.vue |
| profile | 个人信息 | Profile.vue |
| download | 客户端下载 | Download.vue |
| monitoring | 集群监控 | Monitoring.vue（仅管理员） |

### 顶栏功能
- 主题切换（light / dark / ocean，循环切换，存 localStorage）
- 告警铃铛（AlertNotification 组件）
- 管理后台按钮（管理员可见，跳转 `/admin`）
- 客户端下载按钮
- 个人信息、退出按钮

### 特殊组件
- **AIAssistant**：悬浮 AI 聊天窗口，`hide-trigger=true`，由桌面宠物触发
- **DesktopPet**：右下角桌面宠物，可快速跳转功能页
- **全局上传面板**：`Teleport to="body"`，切换页面不消失

## 管理员界面（AdminLayout.vue）

独立路由 `/admin`，通过 `adminTab` ref 控制内容区。

### 侧边栏分组

| 分组 | adminTab 值 | 组件 |
|------|------------|------|
| 总览 | dashboard | AdminDashboard + Monitoring + Reports |
| 用户管理 | users / groups | AdminUsers / AdminGroups |
| 账户管理 | slurm-accounts / slurm-users | AdminSlurmAccounts / AdminSlurmUsers |
| 资源管理 | associations / qos / partitions / hours / quota | 对应 Admin 组件 |
| 基础设施 | rack / cmdb | RackView / AdminCMDB |
| AI 诊断 | ai-diagnostics | AIDiagnostics |
| 数据审计 | audit | AdminAudit |

### 总览页子标签（dashSubTab）

| dashSubTab | 展示内容 |
|-----------|---------|
| overview | AdminDashboard 组件 |
| mon-mgmt | Monitoring active-tab="mgmt" |
| mon-cluster | Monitoring active-tab="cluster" |
| mon-network | Monitoring active-tab="network" |
| mon-jobs | Monitoring active-tab="jobs" |
| mon-alerts | Monitoring active-tab="alerts" |
| reports | Reports 组件 |

## 所有视图组件（src/views/）

| 文件 | 功能说明 |
|------|---------|
| Login.vue | 登录页（用户名密码 + 验证码 + MFA 二步验证）|
| ForceChangePassword.vue | 强制修改密码页 |
| MFASetup.vue | MFA 绑定引导页 |
| Layout.vue | 用户主界面壳层（含侧边栏、顶栏） |
| AdminLayout.vue | 管理员界面壳层 |
| Dashboard.vue | 用户仪表盘（集群状态卡片、节点状态） |
| JobManagement.vue | 作业管理（列表、提交、详情、模板） |
| WebShell.vue | 基于 xterm.js + WebSocket 的 SSH 终端 |
| Desktop.vue | 远程桌面管理（创建/启动/停止 VNC 会话） |
| FileManager.vue | 文件管理器（浏览、上传、下载、预览） |
| Registry.vue | Harbor 镜像仓库浏览 |
| AITasks.vue | AI 训练/推理任务管理 |
| Reports.vue | 报表中心（作业统计、存储、配额） |
| Profile.vue | 个人信息（修改密码、绑定/解绑 MFA） |
| Download.vue | 客户端下载页 |
| Monitoring.vue | 集群监控（Prometheus 指标、告警） |
| RackView.vue | 机柜 3D 可视化 |
| NetworkTopology.vue | 网络拓扑图 |
| CustomDashboard.vue | 用户自定义监控看板 |
| AIDiagnostics.vue | AI 故障诊断（管理员） |
| Admin.vue | 旧版管理入口（已迁移到 AdminLayout） |
| AdminUsers.vue | 用户管理 CRUD |
| AdminGroups.vue | 用户组管理 CRUD |
| AdminQoS.vue | QoS 配置管理 |
| AdminPartitions.vue | 分区配置管理 |
| AdminAssociations.vue | 资源绑定管理 |
| AdminHours.vue | 机时管理（充值、查看使用量） |
| AdminQuota.vue | 存储配额设置 |
| AdminAudit.vue | 审计日志查看 |
| AdminSlurmAccounts.vue | Slurm 账户管理 |
| AdminSlurmUsers.vue | Slurm 用户管理 |
| AdminCMDB.vue | 主机资产管理（CMDB） |

## 可复用组件（src/components/）

| 文件 | 功能说明 |
|------|---------|
| AdminDashboard.vue | 管理总览仪表盘（集群资源卡片、节点状态） |
| AdminHouseDashboard.vue | 机房总览 |
| AIAssistant.vue | AI 悬浮助手（聊天窗口） |
| AIJobSubmit.vue | AI 智能作业提交表单 |
| AlertNotification.vue | 告警通知铃铛组件 |
| Cluster3DTopology.vue | 集群 3D 拓扑（ECharts-GL） |
| ContainerJobSubmit.vue | 容器作业提交表单 |
| DesktopPet.vue | 桌面宠物（触发 AI 助手和快捷跳转） |
| JobDetail.vue | 作业详情展示 |
| JobDetailModal.vue | 作业详情弹窗 |
| JobInfo.vue | 作业信息卡片 |
| JobList.vue | 作业列表表格 |
| JobSubmit.vue | 普通作业提交表单 |
| JobTemplates.vue | 作业模板选择 |
| PromChart.vue | Prometheus 图表（ECharts） |
| PromExplorer.vue | PromQL 查询探索器 |
| XpraViewer.vue | Xpra HTML5 桌面查看器 |

### 通用基础组件（src/components/common/）

| 文件 | 说明 |
|------|------|
| Badge.vue | 徽章/标签 |
| Button.vue | 按钮 |
| Card.vue | 卡片容器 |
| DialogProvider.vue | 全局对话框提供者 |
| Modal.vue | 模态框 |
| Table.vue | 表格 |
| index.ts | 统一导出 |

## 工具函数（src/utils/）

| 文件 | 说明 |
|------|------|
| auth.ts | 认证工具：isAuthenticated、getUser、isAdmin、logout、setupAxiosInterceptors |
| dialog.ts | 全局对话框：dialog.confirm / dialog.error / dialog.warning / dialog.info |
| notification.ts | 全局通知提示 |
| theme.ts | 主题管理 |
| uploadManager.ts | 全局上传队列（reactive uploadTasks、showUploadPanel） |
| desktopLaunch.ts | 桌面会话启动辅助 |
| diagnostics.ts | 诊断工具 |
| rfb-wrapper.ts | noVNC RFB 封装 |

### auth.ts 核心函数

```typescript
isAuthenticated(): boolean    // 检查 localStorage/sessionStorage 是否有 token
getUser(): User | null        // 解析 localStorage.user JSON
isAdmin(): boolean            // user.isAdmin === true
logout(): void                // 清空 token/user，调用 /api/logout
setupAxiosInterceptors()      // 设置 axios 拦截器（401 跳登录页等）
```

### dialog.ts 用法

```typescript
// 确认对话框（返回 Promise<boolean>）
const ok = await dialog.confirm('确定要删除吗？', { title: '删除确认' })

// 提示框
dialog.error('操作失败：xxx')
dialog.warning('注意：xxx')
dialog.info('提示：xxx')
```

## 主题系统（CSS 变量）

三套主题：`light`（默认）、`dark`（暗色）、`ocean`（海洋蓝）

通过 `document.documentElement.setAttribute('data-theme', theme)` 切换。

主要 CSS 变量（定义在 `src/styles/variables.css`）：
```css
--background        /* 页面背景 */
--foreground        /* 主文字颜色 */
--card              /* 卡片背景 */
--border            /* 边框 */
--muted             /* 弱化背景 */
--muted-foreground  /* 弱化文字 */
--accent            /* 强调/悬浮背景 */
--primary           /* 主色 */
--success           /* 成功绿 */
--destructive       /* 危险红 */
--sidebar-bg        /* 侧边栏背景 */
--sidebar-foreground
--sidebar-accent
--sidebar-border
--sidebar-primary
```

Logo 渐变色：`linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)`（靛蓝紫）

## 前端与后端通信约定

```typescript
// axios baseURL 配置
// 开发：http://localhost:8080/api
// 生产：/api（nginx 代理）
// 跨域部署：window.__CONFIG__.apiUrl + '/api'

// WebSocket URL（Web Shell）
ws://host/api/webshell/connect

// WebSocket URL（VNC）
ws://host/api/desktop/sessions/:id/vnc-ws

// WebSocket URL（Xpra）
ws://host/api/desktop/sessions/:id/xpra-ws

// WebSocket URL（SSH 隧道）
ws://host/api/ssh/proxy
```

## 重写前端注意事项

1. **保持 API 路径完全一致**，后端路由不会改变
2. **WebSocket 连接**需处理 token 认证（通过 query param 或首帧消息）
3. **主题系统**通过 CSS 变量实现，重写时保持变量名不变
4. **上传功能**使用全局队列，切换页面不中断
5. **WebShell 使用 KeepAlive**，切换页面时保持 SSH 连接
6. **路由结构简单**：只有 5 个路由，内容切换用 `currentView` ref
7. **管理员判断**：`user.isAdmin === true`
8. **DEV_MODE=true** 时后端返回 mock 数据，前端无需特殊处理
