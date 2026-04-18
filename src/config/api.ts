// API 运行时配置
// 优先级: window.__CONFIG__（后端注入）> VITE_* 环境变量（构建时）> 默认值

declare global {
  interface Window {
    __CONFIG__?: {
      apiUrl?: string
      fileManagerUrl?: string
    }
  }
}

const isDev = import.meta.env.DEV
const { protocol, hostname } = window.location

export const getApiUrl = (): string => {
  if (window.__CONFIG__?.apiUrl) return window.__CONFIG__.apiUrl
  if (isDev) return `${protocol}//${hostname}:8080`
  return ''
}

// 文件管理已合并到主后端，URL 与主后端一致
export const getFileManagerUrl = (): string => {
  if (window.__CONFIG__?.fileManagerUrl) return window.__CONFIG__.fileManagerUrl
  if (isDev) return `${protocol}//${hostname}:8080`
  return ''
}

// 文件管理 API 端点
export const fileManagerApi = {
  list:     () => `${getFileManagerUrl()}/api/files/list`,
  read:     () => `${getFileManagerUrl()}/api/files/read`,
  download: () => `${getFileManagerUrl()}/api/files/download`,
  write:    () => `${getFileManagerUrl()}/api/files/write`,
  upload:   () => `${getFileManagerUrl()}/api/files/upload`,
  delete:   () => `${getFileManagerUrl()}/api/files/delete`,
  mkdir:    () => `${getFileManagerUrl()}/api/files/mkdir`,
  rename:   () => `${getFileManagerUrl()}/api/files/rename`,
  copy:     () => `${getFileManagerUrl()}/api/files/copy`,
  info:     () => `${getFileManagerUrl()}/api/files/info`,
  quota:    () => `${getFileManagerUrl()}/api/files/quota`,
  quotaAll: () => `${getFileManagerUrl()}/api/files/quota/all`,
  compress: () => `${getFileManagerUrl()}/api/files/compress`,
}

export default { getApiUrl, getFileManagerUrl, fileManagerApi }
