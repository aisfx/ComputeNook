import axios from 'axios'

export interface ReportParams {
  start_time?: string // YYYY-MM-DD or Unix timestamp
  end_time?: string
  partition?: string
  user?: string // admin only
  account?: string // admin only for quota endpoint
}

export interface MonthlyJobCount {
  month: string
  partition: string
  count: number
}

export interface JobScaleItem {
  range: string
  count: number
}

export interface JobStatsResult {
  monthly_job_counts: MonthlyJobCount[]
  avg_wait_time_minutes: number
  job_scale_distribution: JobScaleItem[]
  total_jobs: number
}

export interface UsageStatsResult {
  gpu_hours: number
  cpu_hours: number
  billing_hours: number
  quota_billing_hours: number
  usage_percent: number
  status: 'NORMAL' | 'WARNING' | 'EXCEEDED'
}

export interface StorageStatItem {
  username: string
  filesystem: string
  used_gb: number
  soft_limit_gb: number
  hard_limit_gb: number
  usage_percent: number
  over_soft_limit: boolean
}

export interface QuotaStatsResult {
  account: string
  total_billing_hours: number
  used_billing_hours: number
  remaining_billing_hours: number
  usage_percent: number
  status: 'NORMAL' | 'WARNING' | 'EXCEEDED'
  message?: string
}

export interface QoSUsageItem {
  qos_name: string
  used_billing_hours: number
  total_billing_hours: number // 0 = unlimited
  usage_percent: number
  status: 'NORMAL' | 'WARNING' | 'EXCEEDED'
}

export const reportAPI = {
  getJobStats: async (params: ReportParams) => {
    const res = await axios.get<{ data: JobStatsResult }>('/reports/jobs', { params })
    return res.data
  },

  getUsageStats: async (params: ReportParams) => {
    const res = await axios.get<{ data: UsageStatsResult }>('/reports/usage', { params })
    return res.data
  },

  getStorageStats: async (params: ReportParams) => {
    const res = await axios.get<{ data: StorageStatItem[] }>('/reports/storage', { params })
    return res.data
  },

  getQuotaStats: async (params: ReportParams) => {
    const res = await axios.get<{ data: QuotaStatsResult }>('/reports/quota', { params })
    return res.data
  },

  getQoSUsage: async (params: ReportParams) => {
    const res = await axios.get<{ data: QoSUsageItem[] }>('/reports/qos-usage', { params })
    return res.data
  },
}
