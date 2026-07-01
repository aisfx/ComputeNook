import axios from 'axios'

// ─── 认证 ────────────────────────────────────────────────
export const authAPI = {
  login: async (username: string, password: string, captchaId?: string, captchaAnswer?: string) => {
    const res = await axios.post('/login', { username, password, captchaId, captchaAnswer })
    return res.data
  },
  getCurrentUser: async () => {
    const res = await axios.get('/me')
    return res.data.data
  },
  changePassword: async (oldPassword: string, newPassword: string) => {
    const res = await axios.post('/profile/change-password', { oldPassword, newPassword })
    return res.data
  },
  updateProfile: async (profile: { cnName?: string; email?: string; phone?: string }) => {
    const res = await axios.put('/profile', profile)
    return res.data
  },
  getCaptcha: async () => {
    const res = await axios.get('/captcha')
    return res.data
  },
}

// ─── MFA ────────────────────────────────────────────────
export const mfaAPI = {
  getStatus: async () => {
    const res = await axios.get('/mfa/status')
    return res.data.data
  },
  setup: async () => {
    const res = await axios.post('/mfa/setup')
    return res.data.data
  },
  confirm: async (code: string) => {
    const res = await axios.post('/mfa/confirm', { code })
    return res.data
  },
  setupAuth: async () => {
    const res = await axios.post('/mfa/setup-auth')
    return res.data.data
  },
  confirmAuth: async (code: string) => {
    const res = await axios.post('/mfa/confirm-auth', { code })
    return res.data
  },
  disable: async (code: string) => {
    const res = await axios.delete('/mfa', { data: { code } })
    return res.data
  },
  verifyLogin: async (tempToken: string, code: string) => {
    const res = await axios.post('/mfa/verify-login', { tempToken, code })
    return res.data
  },
  adminReset: async (username: string) => {
    const res = await axios.delete(`/mfa/admin/${username}`)
    return res.data
  },
}

// ─── 用户管理 ────────────────────────────────────────────
export const userAPI = {
  getUsers: async () => {
    const res = await axios.get('/users')
    return res.data.data
  },
  getUser: async (username: string) => {
    const res = await axios.get(`/users/${username}`)
    return res.data.data
  },
  getNextUID: async () => {
    const res = await axios.get('/users/next-uid')
    return res.data.uid
  },
  createUser: async (user: any) => {
    const res = await axios.post('/users', user)
    return res.data
  },
  updateUser: async (username: string, user: any) => {
    const res = await axios.put(`/users/${username}`, user)
    return res.data
  },
  deleteUser: async (username: string) => {
    const res = await axios.delete(`/users/${username}`)
    return res.data
  },
  resetPassword: async (username: string, newPassword: string) => {
    const res = await axios.post(`/users/${username}/reset-password`, { newPassword })
    return res.data
  },
  setUserDisabled: async (username: string, disabled: boolean) => {
    const res = await axios.post(`/users/${username}/set-disabled`, { disabled })
    return res.data
  },
  setPasswordMustChange: async (username: string, mustChange: boolean) => {
    const res = await axios.post(`/users/${username}/set-password-must-change`, { mustChange })
    return res.data
  },
}

// ─── 用户组管理 ──────────────────────────────────────────
export const groupAPI = {
  getGroups: async () => {
    const res = await axios.get('/groups')
    return res.data.data
  },
  getNextGID: async () => {
    const res = await axios.get('/groups/next-gid')
    return res.data.gid
  },
  createGroup: async (group: any) => {
    const res = await axios.post('/groups', group)
    return res.data
  },
  updateGroup: async (gid: number, group: any) => {
    const res = await axios.put(`/groups/${gid}`, group)
    return res.data
  },
  deleteGroup: async (gid: number) => {
    const res = await axios.delete(`/groups/${gid}`)
    return res.data
  },
}

// ─── Slurm QoS ──────────────────────────────────────────
export const qosAPI = {
  getQoSList: async () => {
    const res = await axios.get('/qos')
    return res.data.data
  },
  getQoS: async (name: string) => {
    const res = await axios.get(`/qos/${name}`)
    return res.data.data
  },
  createQoS: async (qos: any) => {
    const res = await axios.post('/qos', qos)
    return res.data
  },
  updateQoS: async (name: string, qos: any) => {
    const res = await axios.put(`/qos/${name}`, qos)
    return res.data
  },
  deleteQoS: async (name: string) => {
    const res = await axios.delete(`/qos/${name}`)
    return res.data
  },
}

// ─── 机时充值 ─────────────────────────────────────────────
export const billingAPI = {
  getAccounts: async () => {
    const res = await axios.get('/billing/v2/accounts')
    return res.data.data as any[]
  },
  recharge: async (params: { qos_name: string; amount: number; notes?: string }) => {
    const res = await axios.post('/billing/recharge', params)
    return res.data
  },
  getRechargeHistory: async (qosName?: string, limit?: number) => {
    const res = await axios.get('/billing/recharge/history', {
      params: { qos_name: qosName, limit },
    })
    return res.data.data as any[]
  },
  syncFromSlurm: async () => {
    const res = await axios.post('/billing/v2/sync')
    return res.data
  },
}

// ─── Slurm 账户 ──────────────────────────────────────────
export const slurmAccountAPI = {
  getAccounts: async () => {
    const res = await axios.get('/slurm/accounts')
    return res.data.data
  },
  createAccount: async (account: any) => {
    const res = await axios.post('/slurm/accounts', account)
    return res.data
  },
  updateAccount: async (name: string, account: any) => {
    const res = await axios.put(`/slurm/accounts/${name}`, account)
    return res.data
  },
  deleteAccount: async (name: string) => {
    const res = await axios.delete(`/slurm/accounts/${name}`)
    return res.data
  },
}

// ─── Slurm 用户 ──────────────────────────────────────────
export const slurmUserAPI = {
  getUsers: async () => {
    const res = await axios.get('/slurm/users')
    return res.data.data
  },
  createUser: async (user: any) => {
    const res = await axios.post('/slurm/users', user)
    return res.data
  },
  updateUser: async (name: string, user: any) => {
    const res = await axios.put(`/slurm/users/${name}`, user)
    return res.data
  },
  deleteUser: async (name: string) => {
    const res = await axios.delete(`/slurm/users/${name}`)
    return res.data
  },
}

// ─── 资源绑定 ─────────────────────────────────────────────
export const associationAPI = {
  getAll: async () => axios.get('/slurm/associations'),
  create: async (data: any) => axios.post('/slurm/associations', data),
  update: async (account: string, user: string, cluster: string, data: any) => {
    const params = new URLSearchParams({ account, user, ...(cluster ? { cluster } : {}) })
    return axios.put(`/slurm/associations?${params}`, data)
  },
  delete: async (account: string, user: string, cluster: string, partition?: string) => {
    const params = new URLSearchParams({ account, user, ...(cluster ? { cluster } : {}), ...(partition ? { partition } : {}) })
    return axios.delete(`/slurm/associations?${params}`)
  },
}

// ─── 作业 ────────────────────────────────────────────────
export const jobAPI = {
  getJobs: async (username?: string) => {
    const res = await axios.get('/jobs', { params: username ? { user: username } : {} })
    return res.data.data
  },
  submitJob: async (script: any) => {
    const res = await axios.post('/jobs', script)
    return res.data
  },
  cancelJob: async (jobId: string) => {
    const res = await axios.post(`/jobs/${jobId}/cancel`)
    return res.data
  },
  pauseJob: async (jobId: string) => {
    const res = await axios.post(`/jobs/${jobId}/pause`)
    return res.data
  },
  resumeJob: async (jobId: string) => {
    const res = await axios.post(`/jobs/${jobId}/resume`)
    return res.data
  },
}

// ─── 审计日志 ─────────────────────────────────────────────
export const auditAPI = {
  getLogs: async (params?: any) => {
    const res = await axios.get('/audit/logs', { params })
    return res.data.data
  },
  getStats: async () => {
    const res = await axios.get('/audit/stats')
    return res.data.data
  },
}

// ─── 仪表盘 ──────────────────────────────────────────────
export const dashboardAPI = {
  getStats: async () => {
    const res = await axios.get('/dashboard/stats')
    return res.data.data
  },
  getNodeMetrics: async () => {
    const res = await axios.get('/dashboard/node-metrics')
    return res.data.data
  },
  getAlerts: async () => {
    const res = await axios.get('/dashboard/alerts')
    return res.data.data
  },
}

// ─── 机时使用统计 ─────────────────────────────────────────
export const usageAPI = {
  getUserUsage: async (user: string, startTime: string, endTime: string) => {
    const res = await axios.get('/usage/user', { params: { user, start_time: startTime, end_time: endTime } })
    return res.data
  },
  getAllUsersRecords: async (startTime: string, endTime: string) => {
    const res = await axios.get('/usage/all-records', { params: { start_time: startTime, end_time: endTime } })
    return res.data
  },
}
