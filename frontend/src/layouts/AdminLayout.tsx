import React, { useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Avatar, Dropdown, Space, Button, Tooltip, App } from 'antd'
import type { MenuProps } from 'antd'
import {
  DashboardOutlined,
  UserOutlined,
  TeamOutlined,
  SettingOutlined,
  AuditOutlined,
  ClockCircleOutlined,
  HddOutlined,
  ApiOutlined,
  BranchesOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  DatabaseOutlined,
  SafetyOutlined,
  PartitionOutlined,
  BarChartOutlined,
  LineChartOutlined,
} from '@ant-design/icons'
import { logout, getUser } from '@/utils/auth'
import { useTheme } from '@/hooks/useTheme'
import { usePageTitle } from '@/hooks/usePageTitle'

// 页面组件（懒加载）
import AdminOverview from '@/pages/admin/overview'
import AdminUsers from '@/pages/admin/users'
import AdminGroups from '@/pages/admin/groups'
import AdminSlurmAccounts from '@/pages/admin/slurm-accounts'
import AdminSlurmUsers from '@/pages/admin/slurm-users'
import AdminQoS from '@/pages/admin/qos'
import AdminAssociations from '@/pages/admin/associations'
import AdminBilling from '@/pages/admin/billing'
import AdminQuota from '@/pages/admin/quota'
import AdminAudit from '@/pages/admin/audit'
import AdminPartitions from '@/pages/admin/partitions'
import AdminSSHLogs from '@/pages/admin/ssh-logs'
import AdminWebShellLogs from '@/pages/admin/webshell-logs'
import AdminReports from '@/pages/admin/reports'

const { Sider, Header, Content } = Layout

const LOGO_SVG = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10.5z" fill="white" opacity="0.15"/>
    <path d="M3 10.5L12 3l9 7.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4 10.5V21h16V10.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="7.5" y="12.5" width="9" height="7" rx="1" stroke="white" strokeWidth="1.5" fill="white" fillOpacity="0.1"/>
    <rect x="10" y="14.5" width="4" height="3" rx="0.5" fill="white"/>
  </svg>
)

type MenuItem = Required<MenuProps>['items'][number]

const menuItems: MenuItem[] = [
  {
    key: '/admin/overview',
    icon: <DashboardOutlined />,
    label: '总览',
  },
  {
    key: 'user-group',
    icon: <UserOutlined />,
    label: '用户管理',
    children: [
      { key: '/admin/users', icon: <UserOutlined />, label: '用户' },
      { key: '/admin/groups', icon: <TeamOutlined />, label: '用户组' },
    ],
  },
  {
    key: 'account-group',
    icon: <DatabaseOutlined />,
    label: '账户管理',
    children: [
      { key: '/admin/slurm-accounts', icon: <DatabaseOutlined />, label: '账户' },
      { key: '/admin/slurm-users', icon: <UserOutlined />, label: '用户' },
    ],
  },
  {
    key: 'resource-group',
    icon: <ApiOutlined />,
    label: '资源管理',
    children: [
      { key: '/admin/partitions', icon: <PartitionOutlined />, label: '分区' },
      { key: '/admin/qos', icon: <SafetyOutlined />, label: 'QoS' },
      { key: '/admin/associations', icon: <BranchesOutlined />, label: '资源绑定' },
      { key: '/admin/billing', icon: <ClockCircleOutlined />, label: '机时管理' },
      { key: '/admin/quota', icon: <HddOutlined />, label: '存储配额' },
    ],
  },
  {
    key: 'audit-group',
    icon: <AuditOutlined />,
    label: '审计日志',
    children: [
      { key: '/admin/audit', icon: <AuditOutlined />, label: '审计日志' },
      { key: '/admin/ssh-logs', icon: <SafetyOutlined />, label: 'SSH日志' },
      { key: '/admin/webshell-logs', icon: <DatabaseOutlined />, label: 'WebShell日志' },
    ],
  },
  {
    key: '/admin/reports',
    icon: <LineChartOutlined />,
    label: '报表中心',
  },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { modal } = App.useApp()
  const { mode, toggleTheme } = useTheme()
  usePageTitle('管理后台')
  const [collapsed, setCollapsed] = useState(false)
  const user = getUser()

  // 计算当前选中的菜单项
  const selectedKey = location.pathname
  // 展开父菜单
  const openKeys = menuItems
    .filter((item: any) => item?.children?.some((c: any) => c.key === selectedKey))
    .map((item: any) => item.key as string)

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key)
  }

  const handleLogout = () => {
    modal.confirm({
      title: '确认退出',
      content: '确定要退出登录吗？',
      okText: '退出',
      cancelText: '取消',
      onOk: async () => {
        await logout()
        navigate('/login')
      },
    })
  }

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
      onClick: () => navigate('/dashboard/profile'),
    },
    { type: 'divider' },
    {
      key: 'user-panel',
      icon: <DashboardOutlined />,
      label: '用户面板',
      onClick: () => navigate('/dashboard'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: handleLogout,
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={220}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          background: '#0f172a',
        }}
      >
        {/* Logo */}
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: collapsed ? '0 20px' : '0 20px',
            cursor: 'pointer',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
          onClick={() => navigate('/admin/overview')}
        >
          {LOGO_SVG}
          {!collapsed && (
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>
              算力小筑
            </span>
          )}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={openKeys}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ background: '#0f172a', borderRight: 0, marginTop: 8 }}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 220, transition: 'margin-left 0.2s' }}>
        <Header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 56,
            borderBottom: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#f0f0f0'}`,
            background: mode === 'dark' ? '#1e293b' : '#fff',
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16 }}
          />

          <Space>
            {/* 返回用户工作台 */}
            <Tooltip title="返回工作台">
              <Button
                type="text"
                icon={<DashboardOutlined />}
                onClick={() => navigate('/dashboard')}
                style={{ fontSize: 13, color: '#6366f1' }}
              >
                <span style={{ fontSize: 12 }}>工作台</span>
              </Button>
            </Tooltip>

            {/* 用户头像下拉 */}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer', marginLeft: 4 }}>
                <Avatar size="small" style={{ background: '#6366f1' }} icon={<UserOutlined />} />
                <span style={{ fontSize: 13 }}>{user?.cnName || user?.username}</span>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ padding: 24, minHeight: 'calc(100vh - 56px)' }}>
          <Routes>
            <Route path="/" element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="groups" element={<AdminGroups />} />
            <Route path="slurm-accounts" element={<AdminSlurmAccounts />} />
            <Route path="slurm-users" element={<AdminSlurmUsers />} />
            <Route path="qos" element={<AdminQoS />} />
            <Route path="associations" element={<AdminAssociations />} />
            <Route path="billing" element={<AdminBilling />} />
            <Route path="quota" element={<AdminQuota />} />
            <Route path="audit" element={<AdminAudit />} />
            <Route path="ssh-logs" element={<AdminSSHLogs />} />
            <Route path="webshell-logs" element={<AdminWebShellLogs />} />
            <Route path="partitions" element={<AdminPartitions />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="*" element={<Navigate to="overview" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}
