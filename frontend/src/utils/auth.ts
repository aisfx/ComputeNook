import axios from 'axios'

// 运行时动态获取 API 地址
function getBaseURL(): string {
  const w = window as any
  if (w.__CONFIG__?.apiUrl) return w.__CONFIG__.apiUrl + '/api'
  if (import.meta.env.DEV) return `${location.protocol}//${location.hostname}:8080/api`
  return '/api'
}

// 供 fetch 直接使用的 API 根（不含 /api）
export function getApiBase(): string {
  const w = window as any
  if (w.__CONFIG__?.apiUrl) return w.__CONFIG__.apiUrl
  if (import.meta.env.DEV) return `${location.protocol}//${location.hostname}:8080`
  return ''
}

// WebSocket 根路径
export function getWsBase(): string {
  const httpBase = getApiBase()
  return httpBase.replace(/^http/, 'ws')
}

export interface UserInfo {
  username: string
  uid: number
  gid: number
  cnName?: string
  email?: string
  phone?: string
  shell?: string
  homeDir?: string
  groups?: string[]
  isAdmin: boolean
  passwordMustChange?: boolean
}

export function getToken(): string | null {
  return localStorage.getItem('token') || sessionStorage.getItem('token')
}

export function getUser(): UserInfo | null {
  const str = localStorage.getItem('user') || sessionStorage.getItem('user')
  if (!str) return null
  try {
    return JSON.parse(str) as UserInfo
  } catch {
    return null
  }
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

export function isAdmin(): boolean {
  return getUser()?.isAdmin === true
}

export function saveSession(token: string, user: UserInfo, remember: boolean) {
  const storage = remember ? localStorage : sessionStorage
  storage.setItem('token', token)
  storage.setItem('user', JSON.stringify(user))
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
}

export async function logout() {
  const token = getToken()
  if (token) {
    try {
      await fetch(`${getApiBase()}/api/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      // 网络失败也继续
    }
  }
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  sessionStorage.removeItem('token')
  sessionStorage.removeItem('user')
  delete axios.defaults.headers.common['Authorization']
}

// 初始化 axios —— 在 App 渲染前调用
export function setupAxios() {
  axios.defaults.baseURL = getBaseURL()

  axios.interceptors.request.use((config) => {
    const token = getToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })

  axios.interceptors.response.use(
    (res) => res,
    (error) => {
      const { status, data } = error.response ?? {}
      if (status === 401) {
        logout().then(() => {
          if (window.location.pathname !== '/login') window.location.href = '/login'
        })
      }
      if (status === 403 && data?.code === 'ACCOUNT_DISABLED') {
        logout().then(() => { window.location.href = '/login' })
      }
      if (status === 403 && data?.code === 'PASSWORD_MUST_CHANGE') {
        window.location.href = '/force-change-password'
      }
      return Promise.reject(error)
    }
  )
}

setupAxios()
