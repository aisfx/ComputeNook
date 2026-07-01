import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, App as AntApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { isAuthenticated, isAdmin } from '@/utils/auth'
import { useThemeToken } from '@/hooks/useTheme'
import LoginPage from '@/pages/login'
import ForceChangePasswordPage from '@/pages/force-change-password'
import MFASetupPage from '@/pages/mfa-setup'
import UserLayout from '@/layouts/UserLayout'
import AdminLayout from '@/layouts/AdminLayout'

dayjs.locale('zh-cn')

// 设置默认标题
if (!document.title || document.title === 'Vite + React + TS') {
  document.title = '算力小筑'
}

// 路由守卫
function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  if (!isAdmin()) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/force-change-password"
        element={
          <RequireAuth>
            <ForceChangePasswordPage />
          </RequireAuth>
        }
      />
      <Route path="/mfa-setup" element={<MFASetupPage />} />
      <Route
        path="/dashboard/*"
        element={
          <RequireAuth>
            <UserLayout />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/*"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  const { token } = useThemeToken()

  return (
    <ConfigProvider
      locale={zhCN}
      theme={token}
    >
      <AntApp>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  )
}
