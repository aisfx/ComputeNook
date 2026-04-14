// API 配置

// 获取文件管理服务 URL
export const getFileManagerUrl = (): string => {
  // 优先使用环境变量配置
  const envUrl = import.meta.env.VITE_FILEMANAGER_URL
  if (envUrl) {
    return envUrl
  }
  
  // 默认使用独立的文件管理服务
  return 'http://localhost:8081'
}

// 获取主后端服务 URL
export const getApiUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) {
    return envUrl
  }
  
  return 'http://localhost:8080'
}

// 文件管理 API 端点
export const fileManagerApi = {
  list: () => `${getFileManagerUrl()}/api/files/list`,
  read: () => `${getFileManagerUrl()}/api/files/read`,
  download: () => `${getFileManagerUrl()}/api/files/download`,
  write: () => `${getFileManagerUrl()}/api/files/write`,
  upload: () => `${getFileManagerUrl()}/api/files/upload`,
  delete: () => `${getFileManagerUrl()}/api/files/delete`,
  mkdir: () => `${getFileManagerUrl()}/api/files/mkdir`,
  rename: () => `${getFileManagerUrl()}/api/files/rename`,
  copy: () => `${getFileManagerUrl()}/api/files/copy`,
  info: () => `${getFileManagerUrl()}/api/files/info`,
}

// 主后端 API 端点
export const mainApi = {
  login: () => `${getApiUrl()}/api/login`,
  jobs: () => `${getApiUrl()}/api/jobs`,
  users: () => `${getApiUrl()}/api/users`,
  // ... 其他 API
}

export default {
  getFileManagerUrl,
  getApiUrl,
  fileManagerApi,
  mainApi,
}
