import React, { useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Avatar, Dropdown, Space, Button, Tooltip, App } from 'antd'
import type { MenuProps } from 'antd'
import {
  DashboardOutlined,
  CodeOutlined,
  DesktopOutlined,
  FolderOutlined,
  BarChartOutlined,
  LineChartOutlined,
  UserOutlined,
  DownloadOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  SettingOutlined,
  DatabaseOutlined,
} from '@ant-design/icons'
import { logout, getUser, isAdmin } from '@/utils/auth'
import { useTheme } from '@/hooks/useTheme'

import UserDashboard from '@/pages/user/dashboard'
import JobManagement from '@/pages/user/jobs'
import ReportsPage from '@/pages/user/reports'
import WebShell from '@/pages/user/webshell'
import RemoteDesktop from '@/pages/user/desktop'
import FileManager from '@/pages/user/files'
import RegistryManagement from '@/pages/user/registry'
import AIAssistant from '@/components/AIAssistant'
import Profile from '@/pages/user/profile'
import DownloadPage from '@/pages/user/download'

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

const buildMenuItems = (admin: boolean): MenuItem[] => [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/dashboard/jobs', icon: <BarChartOutlined />, label: '作业管理' },
  { key: '/dashboard/webshell', icon: <CodeOutlined />, label: 'Web Shell' },
  { key: '/dashboard/desktop', icon: <DesktopOutlined />, label: '远程桌面' },
  { key: '/dashboard/files', icon: <FolderOutlined />, label: '文件管理' },
  { key: '/dashboard/registry', icon: <DatabaseOutlined />, label: '镜像仓库' },
  { key: '/dashboard/reports', icon: <LineChartOutlined />, label: '报表中心' },
]

export default function UserLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { modal } = App.useApp()
  const { mode, toggleTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const user = getUser()
  const admin = isAdmin()

  const selectedKey = location.pathname === '/dashboard' ? '/dashboard' : location.pathname

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
        width={200}
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
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 20px',
            cursor: 'pointer',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
          onClick={() => navigate('/dashboard')}
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
          items={buildMenuItems(admin)}
          onClick={handleMenuClick}
          style={{ background: '#0f172a', borderRight: 0, marginTop: 8 }}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'margin-left 0.2s' }}>
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
            {/* 客户端下载 */}
            <Tooltip title="客户端下载">
              <Button
                type="text"
                icon={<DownloadOutlined />}
                onClick={() => navigate('/dashboard/download')}
                style={{ fontSize: 13, color: '#52c41a' }}
              >
                <span style={{ fontSize: 12 }}>客户端</span>
              </Button>
            </Tooltip>

            {/* 管理后台（仅管理员） */}
            {admin && (
              <Tooltip title="管理后台">
                <Button
                  type="text"
                  icon={<SettingOutlined />}
                  onClick={() => navigate('/admin')}
                  style={{ fontSize: 13 }}
                >
                  <span style={{ fontSize: 12 }}>管理后台</span>
                </Button>
              </Tooltip>
            )}

            {/* 用户头像下拉（含个人信息、退出） */}
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
            <Route path="/" element={<UserDashboard />} />
            <Route path="jobs" element={<JobManagement />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="webshell" element={<WebShell />} />
            <Route path="desktop" element={<RemoteDesktop />} />
            <Route path="files" element={<FileManager />} />
            <Route path="registry" element={<RegistryManagement />} />
            <Route path="profile" element={<Profile />} />
            <Route path="download" element={<DownloadPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Content>
      </Layout>
      {/* AI 助手悬浮窗 - 全局挂载 */}
      <AIAssistant />
    </Layout>
  )
}
