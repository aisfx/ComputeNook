# 前端重写方案：Ant Design Pro

## 技术栈选型

| 层次 | 技术 | 版本 |
|------|------|------|
| UI 框架 | React | 18+ |
| UI 组件库 | Ant Design (antd) | v5/v6 |
| Pro 组件 | @ant-design/pro-components | ^2.x |
| 应用框架 | @umijs/max（内置于 Ant Design Pro） | ^4.x |
| 路由 | Umi 内置路由（基于 React Router） | - |
| 请求库 | @umijs/max 内置 `request`（基于 axios） | - |
| 状态管理 | @umijs/max 内置 `useModel` | - |
| 权限控制 | @umijs/max 内置 `access` | - |
| 语言 | TypeScript | ^5 |
| 构建工具 | Umi（内置 Webpack/Mako） | - |
| 终端组件 | xterm.js | ^5 |
| 图表 | Ant Design Charts / ECharts | - |
| VNC | @novnc/novnc | ^1.6 |

---

## 初始化项目

```bash
# 方式一：官方脚手架
npm create umi@latest
# 选择 "Ant Design Pro" 模板

# 方式二：直接克隆
git clone https://github.com/ant-design/ant-design-pro.git computenook-web
cd computenook-web
npm install
npm run dev
```

---

## 目录结构（标准 Ant Design Pro）

```
computenook-web/
├── config/
│   ├── config.ts          # Umi 主配置（路由、插件、代理）
│   ├── routes.ts          # 路由配置
│   ├── defaultSettings.ts # ProLayout 默认设置
│   └── proxy.ts           # 开发代理（/api → :8080）
├── mock/                  # Mock 数据（可选，对应后端 DEV_MODE）
├── public/
│   └── favicon.ico
├── src/
│   ├── access.ts          # 权限定义（isAdmin 等）
│   ├── app.tsx            # 运行时配置（layout、request 拦截器）
│   ├── global.ts          # 全局初始化
│   ├── global.less        # 全局样式
│   ├── assets/            # 静态资源
│   ├── components/        # 业务公共组件
│   │   ├── RightContent/  # 顶栏右侧（头像、主题切换）
│   │   ├── Footer/
│   │   └── ...
│   ├── layouts/           # 自定义布局（可选）
│   ├── models/            # 全局状态（useModel）
│   │   └── currentUser.ts
│   ├── pages/             # 页面（与路由对应）
│   │   ├── User/
│   │   │   └── Login/     # 登录页
│   │   ├── Dashboard/     # 仪表盘
│   │   ├── Jobs/          # 作业管理
│   │   ├── WebShell/      # Web Shell
│   │   ├── Desktop/       # 远程桌面
│   │   ├── Files/         # 文件管理
│   │   ├── Admin/         # 管理后台（嵌套路由）
│   │   │   ├── Users/
│   │   │   ├── QoS/
│   │   │   ├── Partitions/
│   │   │   ├── Associations/
│   │   │   ├── Billing/
│   │   │   ├── Quota/
│   │   │   ├── Audit/
│   │   │   ├── CMDB/
│   │   │   └── Monitoring/
│   │   └── ...
│   └── services/          # API 请求封装
│       ├── auth.ts
│       ├── user.ts
│       ├── job.ts
│       ├── qos.ts
│       ├── slurm.ts
│       ├── files.ts
│       ├── desktop.ts
│       ├── monitoring.ts
│       └── typings.d.ts   # 类型定义
├── .umirc.ts              # 或 config/config.ts
└── package.json
```

---

## 路由配置（config/routes.ts）

```ts
export default [
  // 公开路由
  {
    path: '/user',
    layout: false,
    routes: [
      { path: '/user/login', component: './User/Login' },
      { path: '/user/mfa-setup', component: './User/MFASetup' },
      { path: '/user/force-change-password', component: './User/ForceChangePassword' },
    ],
  },

  // 用户主界面（ProLayout 自动渲染侧边栏）
  { path: '/dashboard',  name: '仪表盘',   icon: 'dashboard',  component: './Dashboard' },
  { path: '/jobs',       name: '作业管理', icon: 'profile',    component: './Jobs' },
  { path: '/shell',      name: 'Web Shell', icon: 'code',      component: './WebShell' },
  { path: '/desktop',    name: '远程桌面', icon: 'desktop',    component: './Desktop' },
  { path: '/files',      name: '文件管理', icon: 'folder',     component: './Files' },
  { path: '/registry',   name: '镜像仓库', icon: 'database',   component: './Registry' },
  { path: '/ai-tasks',   name: 'AI 作业',  icon: 'robot',      component: './AITasks' },
  { path: '/reports',    name: '报表中心', icon: 'barChart',   component: './Reports' },

  // 管理后台（仅管理员，access 控制）
  {
    path: '/admin',
    name: '管理后台',
    icon: 'setting',
    access: 'isAdmin',
    routes: [
      { path: '/admin', redirect: '/admin/dashboard' },
      { path: '/admin/dashboard',   name: '总览',     component: './Admin/Dashboard' },
      { path: '/admin/users',       name: '用户管理', component: './Admin/Users' },
      { path: '/admin/groups',      name: '用户组',   component: './Admin/Groups' },
      { path: '/admin/slurm-accounts', name: 'Slurm账户', component: './Admin/SlurmAccounts' },
      { path: '/admin/slurm-users', name: 'Slurm用户', component: './Admin/SlurmUsers' },
      { path: '/admin/associations', name: '资源绑定', component: './Admin/Associations' },
      { path: '/admin/qos',         name: 'QoS配置',  component: './Admin/QoS' },
      { path: '/admin/partitions',  name: '分区配置', component: './Admin/Partitions' },
      { path: '/admin/billing',     name: '机时管理', component: './Admin/Billing' },
      { path: '/admin/quota',       name: '存储配额', component: './Admin/Quota' },
      { path: '/admin/monitoring',  name: '集群监控', component: './Admin/Monitoring' },
      { path: '/admin/rack',        name: '机柜管理', component: './Admin/Rack' },
      { path: '/admin/cmdb',        name: '主机资产', component: './Admin/CMDB' },
      { path: '/admin/audit',       name: '数据审计', component: './Admin/Audit' },
    ],
  },

  // 个人信息
  { path: '/profile',  component: './Profile',  menuRender: false },
  { path: '/download', component: './Download', menuRender: false },

  { path: '/', redirect: '/dashboard' },
  { path: '*', component: './404' },
]
```

---

## 权限控制（src/access.ts）

```ts
// src/access.ts
export default function access(initialState: { currentUser?: API.CurrentUser }) {
  const { currentUser } = initialState ?? {}
  return {
    isAdmin: currentUser?.isAdmin === true,
    isLogin: !!currentUser,
  }
}
```

---

## 运行时配置（src/app.tsx）

```tsx
import { history, RequestConfig, RunTimeLayoutConfig } from '@umijs/max'
import { AvatarDropdown } from './components/RightContent'

// 获取初始数据（当前用户）
export async function getInitialState() {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token')
  if (!token) return { currentUser: undefined }

  try {
    const res = await fetch('/api/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('unauthorized')
    const data = await res.json()
    return { currentUser: data.data }
  } catch {
    history.push('/user/login')
    return { currentUser: undefined }
  }
}

// ProLayout 配置
export const layout: RunTimeLayoutConfig = ({ initialState }) => ({
  logo: '/logo.png',
  title: '算力小筑',
  avatarProps: {
    render: () => <AvatarDropdown />,
  },
  // 未登录跳转
  onPageChange: () => {
    const { location } = history
    if (!initialState?.currentUser && location.pathname !== '/user/login') {
      history.push('/user/login')
    }
  },
})

// request 拦截器（统一加 JWT）
export const request: RequestConfig = {
  baseURL: '',  // 同域，nginx 代理 /api
  requestInterceptors: [
    (config) => {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token')
      if (token) {
        config.headers = { ...config.headers, Authorization: `Bearer ${token}` }
      }
      return config
    },
  ],
  responseInterceptors: [
    (response) => {
      const { data } = response
      // 处理特殊错误码
      if (response.status === 401) {
        localStorage.removeItem('token')
        history.push('/user/login')
      }
      if (response.status === 403) {
        const code = (data as any)?.code
        if (code === 'PASSWORD_MUST_CHANGE') history.push('/user/force-change-password')
        if (code === 'ACCOUNT_DISABLED') history.push('/user/login')
      }
      return response
    },
  ],
}
```

---

## 开发代理配置（config/proxy.ts）

```ts
export default {
  dev: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
      ws: true,  // 支持 WebSocket（WebShell/VNC）
    },
    '/config.js': {
      target: 'http://localhost:8080',
      changeOrigin: true,
    },
    '/novnc': {
      target: 'http://localhost:8080',
      changeOrigin: true,
    },
  },
}
```

---

## 服务层封装（src/services/）

```ts
// src/services/typings.d.ts
declare namespace API {
  type CurrentUser = {
    username: string
    uid: number
    gid: number
    cnName: string
    email?: string
    phone?: string
    isAdmin: boolean
    disabled: boolean
    passwordMustChange: boolean
  }

  type QoS = {
    name: string
    description?: string
    priority?: number
    max_jobs_pu?: number
    max_submit_pu?: number
    max_wall_pj?: number
    max_cpus_pu?: number
    max_gpus_pu?: number
    max_tres_pu?: string
    grp_tres_mins?: string
    preempt?: string[]
    preempt_mode?: string
    usage_factor?: number
  }

  type Job = {
    job_id: number
    name: string
    user_name: string
    account: string
    qos: string
    partition: string
    job_state: string  // PENDING/RUNNING/COMPLETED/FAILED/CANCELLED
    num_cpus: number
    submit_time: number
    start_time: number
    end_time: number
  }

  type Response<T> = {
    data: T
    message?: string
    error?: string
  }
}
```

```ts
// src/services/auth.ts
import { request } from '@umijs/max'

export async function login(params: {
  username: string
  password: string
  captchaId?: string
  captchaVal?: string
  rememberMe?: boolean
}) {
  return request<{ token: string; user: API.CurrentUser; mfa_required?: boolean }>('/api/login', {
    method: 'POST',
    data: params,
  })
}

export async function logout() {
  return request('/api/logout', { method: 'POST' })
}

export async function changePassword(data: { oldPassword: string; newPassword: string }) {
  return request('/api/profile/change-password', { method: 'POST', data })
}
```

```ts
// src/services/qos.ts
import { request } from '@umijs/max'

export async function getQoSList() {
  return request<API.Response<API.QoS[]>>('/api/qos')
}

export async function createQoS(data: API.QoS) {
  return request('/api/qos', { method: 'POST', data })
}

export async function updateQoS(name: string, data: API.QoS) {
  return request(`/api/qos/${name}`, { method: 'PUT', data })
}

export async function deleteQoS(name: string) {
  return request(`/api/qos/${name}`, { method: 'DELETE' })
}
```

```ts
// src/services/job.ts
import { request } from '@umijs/max'

export async function getJobs(params?: { user?: string }) {
  return request<API.Response<API.Job[]>>('/api/jobs', { params })
}

export async function submitJob(data: any) {
  return request('/api/jobs', { method: 'POST', data })
}

export async function cancelJob(id: string) {
  return request(`/api/jobs/${id}`, { method: 'DELETE' })
}
```

---

## 关键页面组件使用示例

### 列表页（ProTable）

```tsx
// src/pages/Admin/Users/index.tsx
import { ProTable, ProColumns } from '@ant-design/pro-components'
import { Button, Popconfirm, message } from 'antd'
import { getUsers, deleteUser } from '@/services/user'

export default function AdminUsers() {
  const columns: ProColumns[] = [
    { title: '用户名', dataIndex: 'username', copyable: true },
    { title: '姓名', dataIndex: 'cnName' },
    { title: 'UID', dataIndex: 'uid', width: 80 },
    { title: '邮箱', dataIndex: 'email' },
    {
      title: '状态',
      dataIndex: 'disabled',
      valueEnum: {
        false: { text: '正常', status: 'Success' },
        true: { text: '禁用', status: 'Error' },
      },
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, record) => [
        <a key="edit">编辑</a>,
        <Popconfirm key="delete" title="确认删除？" onConfirm={() => handleDelete(record.username)}>
          <a style={{ color: 'red' }}>删除</a>
        </Popconfirm>,
      ],
    },
  ]

  const handleDelete = async (username: string) => {
    await deleteUser(username)
    message.success('删除成功')
  }

  return (
    <ProTable
      columns={columns}
      request={async () => {
        const res = await getUsers()
        return { data: res.data, success: true }
      }}
      rowKey="username"
      toolBarRender={() => [<Button type="primary">新建用户</Button>]}
    />
  )
}
```

### 表单弹窗（ProForm + ModalForm）

```tsx
import { ModalForm, ProFormText, ProFormDigit, ProFormSelect } from '@ant-design/pro-components'
import { createQoS } from '@/services/qos'

export function CreateQoSModal({ onSuccess }: { onSuccess: () => void }) {
  return (
    <ModalForm
      title="创建 QoS"
      trigger={<Button type="primary">新建 QoS</Button>}
      onFinish={async (values) => {
        await createQoS(values)
        onSuccess()
        return true  // 关闭弹窗
      }}
    >
      <ProFormText name="name" label="QoS 名称" rules={[{ required: true }]} />
      <ProFormText name="description" label="描述" />
      <ProFormDigit name="priority" label="优先级" min={0} max={65535} />
      <ProFormDigit name="max_jobs_pu" label="每用户最大作业数" />
      <ProFormDigit name="max_cpus_pu" label="每用户最大 CPU" />
      <ProFormDigit name="max_gpus_pu" label="每用户最大 GPU" />
      <ProFormDigit name="max_wall_pj" label="每作业最大时间(分钟)" />
      <ProFormSelect
        name="preempt_mode"
        label="抢占模式"
        options={[
          { label: '关闭', value: 'off' },
          { label: '挂起', value: 'suspend' },
          { label: '重排队', value: 'requeue' },
          { label: '取消', value: 'cancel' },
        ]}
      />
    </ModalForm>
  )
}
```

---

## 全局状态（src/models/currentUser.ts）

```ts
// src/models/currentUser.ts
import { useState } from 'react'

export default function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState<API.CurrentUser | null>(null)

  const saveUser = (user: API.CurrentUser, rememberMe = false) => {
    setCurrentUser(user)
    const store = rememberMe ? localStorage : sessionStorage
    store.setItem('user', JSON.stringify(user))
  }

  const clearUser = () => {
    setCurrentUser(null)
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    sessionStorage.removeItem('user')
    sessionStorage.removeItem('token')
  }

  return { currentUser, saveUser, clearUser }
}
```

使用：
```tsx
import { useModel } from '@umijs/max'

const { currentUser } = useModel('currentUser')
```

---

## WebShell 集成（xterm.js + WebSocket）

```tsx
// src/pages/WebShell/index.tsx
import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

export default function WebShell() {
  const termRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const term = new Terminal({ cursorBlink: true, theme: { background: '#1e1e2e' } })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(termRef.current!)
    fitAddon.fit()

    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${location.host}/api/webshell/connect`)

    ws.onopen = () => {
      // 首帧发送认证信息和节点
      ws.send(JSON.stringify({ token: `Bearer ${token}`, node: 'ln0' }))
    }
    ws.onmessage = (e) => term.write(e.data)
    term.onData((data) => ws.send(data))

    return () => { ws.close(); term.dispose() }
  }, [])

  return <div ref={termRef} style={{ height: 'calc(100vh - 120px)', background: '#1e1e2e' }} />
}
```

---

## VNC 集成（noVNC）

```tsx
// src/pages/Desktop/VNCViewer.tsx
import { useEffect, useRef } from 'react'

export default function VNCViewer({ sessionId }: { sessionId: number }) {
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 动态 import noVNC（避免 SSR 问题）
    import('@novnc/novnc/lib/rfb').then(({ default: RFB }) => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      const url = `${proto}://${location.host}/api/desktop/sessions/${sessionId}/vnc-ws`
      const rfb = new RFB(canvasRef.current!, url)
      rfb.scaleViewport = true
      rfb.resizeSession = true
    })
  }, [sessionId])

  return <div ref={canvasRef} style={{ width: '100%', height: '100%' }} />
}
```

---

## 主题配置（antd v5 CSS 变量 + ProLayout）

```ts
// config/defaultSettings.ts
import { ProLayoutProps } from '@ant-design/pro-components'

const Settings: ProLayoutProps = {
  navTheme: 'light',           // light | dark | realDark
  colorPrimary: '#6366f1',     // 主色（与现有品牌色对齐）
  layout: 'side',              // side | top | mix
  contentWidth: 'Fluid',
  fixedHeader: true,
  fixSiderbar: true,
  colorWeak: false,
  title: '算力小筑',
  logo: '/logo.png',
  // Ant Design v5 token 覆盖
  token: {
    colorPrimary: '#6366f1',
    colorSuccess: '#22c55e',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    borderRadius: 8,
    fontFamily: `-apple-system, BlinkMacSystemFont, 'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif`,
  },
}

export default Settings
```

---

## 登录页关键逻辑

```tsx
// src/pages/User/Login/index.tsx
import { login } from '@/services/auth'
import { history, useModel } from '@umijs/max'
import { LoginForm, ProFormText, ProFormCheckbox } from '@ant-design/pro-components'

export default function LoginPage() {
  const { saveUser } = useModel('currentUser')  // 可选，用 initialState 也行

  const handleSubmit = async (values: any) => {
    const res = await login(values)

    // MFA 第二步
    if (res.mfa_required) {
      sessionStorage.setItem('temp_token', res.temp_token)
      history.push('/user/mfa-setup')
      return
    }

    // 正常登录
    const store = values.rememberMe ? localStorage : sessionStorage
    store.setItem('token', res.token)
    store.setItem('user', JSON.stringify(res.user))

    // 强制改密
    if (res.user.passwordMustChange) {
      history.push('/user/force-change-password')
      return
    }

    history.push('/dashboard')
  }

  return (
    <LoginForm title="算力小筑" subTitle="HPC 集群管理平台" onFinish={handleSubmit}>
      <ProFormText name="username" placeholder="用户名" rules={[{ required: true }]} />
      <ProFormText.Password name="password" placeholder="密码" rules={[{ required: true }]} />
      <ProFormCheckbox name="rememberMe">记住我</ProFormCheckbox>
    </LoginForm>
  )
}
```

---

## 对照表：Vue 组件 → Ant Design Pro 组件

| 原 Vue 组件 | Ant Design Pro 替代 |
|-------------|---------------------|
| 手写表格 | `<ProTable>` |
| 手写表单弹窗 | `<ModalForm>` / `<DrawerForm>` |
| 手写详情展示 | `<ProDescriptions>` |
| 手写侧边栏导航 | `<ProLayout>`（自动根据 routes 生成） |
| 手写面包屑 | `<PageContainer>`（自动生成） |
| 手写卡片统计 | `<StatisticCard>` |
| ECharts 图表 | `@ant-design/charts`（基于 G2） |
| xterm.js | 直接使用（不变） |
| noVNC | 直接使用（不变） |
| dialog.confirm | antd `Modal.confirm()` |
| dialog.error | antd `message.error()` / `notification.error()` |

---

## 与现有后端完全兼容

1. **API 路径不变** — 所有 `/api/*` 路径与后端完全一致
2. **认证方式不变** — `Authorization: Bearer <token>`，存 localStorage/sessionStorage
3. **WebSocket 路径不变** — webshell / vnc-ws / xpra-ws / ssh/proxy
4. **响应格式不变** — `{ "data": ... }` / `{ "error": ... }`
5. **开发代理** — `/api` 代理到 `:8080`，与原 Vite 配置一致

---

## 快速开始命令

```bash
# 1. 创建项目
npm create umi@latest computenook-web
# 选择 Ant Design Pro

# 2. 安装依赖
cd computenook-web
npm install

# 3. 安装额外依赖
npm install xterm xterm-addon-fit xterm-addon-web-links @novnc/novnc echarts @ant-design/charts

# 4. 启动开发（后端需在 :8080 运行）
npm run dev

# 5. 构建
npm run build
# 产物在 dist/，复制到 backend/static/ 即可被 Go 服务直接提供
```
