<template>
  <div class="audit-logs">
    <div class="page-header">
      <h3>📋 数据审计</h3>
      <div class="header-actions">
        <button class="btn-secondary" @click="loadStats">
          📊 统计信息
        </button>
        <button class="btn-primary" @click="exportLogs">
          📥 导出日志
        </button>
      </div>
    </div>

    <!-- 标签页切换 -->
    <div class="tab-bar">
      <button :class="['tab-btn', { active: activeTab === 'audit' }]" @click="activeTab = 'audit'">📋 操作审计</button>
      <button :class="['tab-btn', { active: activeTab === 'ssh' }]" @click="activeTab = 'ssh'; loadSSHLogs()">🔐 SSH 行为日志</button>
      <button :class="['tab-btn', { active: activeTab === 'report' }]" @click="activeTab = 'report'">📊 用量报表</button>
    </div>

    <!-- 统计卡片 -->
    <div v-if="activeTab === 'audit'">
    <div v-if="showStats" class="stats-section">
      <div class="stats-cards">
        <div class="stat-card">
          <div class="stat-icon">📝</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.total_logs || 0 }}</div>
            <div class="stat-label">总日志数</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">✅</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.by_status?.success || 0 }}</div>
            <div class="stat-label">成功操作</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">❌</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.by_status?.failed || 0 }}</div>
            <div class="stat-label">失败操作</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">👥</div>
          <div class="stat-content">
            <div class="stat-value">{{ Object.keys(stats.by_user || {}).length }}</div>
            <div class="stat-label">活跃用户</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 过滤器 -->
    <div class="filters-section">
      <div class="filters-bar">
        <input 
          v-model="filters.username" 
          placeholder="🔍 用户名..." 
          class="filter-input"
          @input="debouncedLoad"
        />
        
        <select v-model="filters.action" class="filter-select" @change="loadLogs">
          <option value="">全部操作</option>
          <option value="page_view">页面访问</option>
          <option value="shell_command">Shell 命令</option>
          <option value="shell_blocked">⛔ 被拦截命令</option>
          <option value="create">创建</option>
          <option value="update">更新</option>
          <option value="delete">删除</option>
          <option value="read">读取</option>
          <option value="login">登录</option>
          <option value="logout">登出</option>
        </select>
        
        <select v-model="filters.resource" class="filter-select" @change="loadLogs">
          <option value="">全部资源</option>
          <option value="user">用户</option>
          <option value="group">用户组</option>
          <option value="account">账户</option>
          <option value="association">关联</option>
          <option value="qos">QoS</option>
          <option value="job">作业</option>
        </select>
        
        <select v-model="filters.status" class="filter-select" @change="loadLogs">
          <option value="">全部状态</option>
          <option value="success">成功</option>
          <option value="failed">失败</option>
        </select>
        
        <select v-model="filters.timeRange" class="filter-select" @change="handleTimeRangeChange">
          <option value="">全部时间</option>
          <option value="1h">最近1小时</option>
          <option value="24h">最近24小时</option>
          <option value="7d">最近7天</option>
          <option value="30d">最近30天</option>
        </select>
        
        <button class="btn-secondary" @click="resetFilters">
          🔄 重置
        </button>
      </div>
    </div>

    <!-- 日志列表 -->
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="error" class="error-message">{{ error }}</div>
    
    <div v-else class="logs-section">
      <div class="logs-table-container">
        <table class="logs-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>用户</th>
              <th>操作</th>
              <th>资源</th>
              <th>资源ID</th>
              <th>状态</th>
              <th>客户端IP</th>
              <th>访问地址</th>
              <th>耗时</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in logs" :key="log.id" :class="{'failed-row': log.status === 'failed'}">
              <td class="time-cell">{{ formatTime(log.timestamp) }}</td>
              <td>
                <div class="user-cell">
                  <span class="username">{{ log.username }}</span>
                  <span class="user-role" :class="'role-' + log.user_role">{{ log.user_role }}</span>
                </div>
              </td>
              <td>
                <span class="action-badge" :class="'action-' + log.action">
                  {{ getActionLabel(log.action) }}
                </span>
              </td>
              <td>
                <span class="resource-badge">{{ getResourceLabel(log.resource) }}</span>
              </td>
              <td class="resource-id">{{ log.resource_id || '-' }}</td>
              <td>
                <span class="status-badge" :class="'status-' + log.status">
                  {{ log.status === 'success' ? '✅ 成功' : '❌ 失败' }}
                </span>
              </td>
              <td class="ip-cell">{{ log.ip_address }}</td>
              <td class="host-cell">{{ log.access_host || '-' }}</td>
              <td class="duration-cell">{{ log.duration }}ms</td>
              <td>
                <button class="btn-link" @click="viewDetails(log)">
                  👁️ 详情
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        
        <div v-if="logs.length === 0" class="empty-state">
          <p>暂无审计日志</p>
        </div>
      </div>
      
      <div class="pagination">
        <span class="total-count">共 {{ logs.length }} 条记录</span>
      </div>
    </div>
    </div> <!-- end audit tab -->

    <!-- SSH 行为日志面板 -->
    <div v-if="activeTab === 'ssh'" class="ssh-logs-panel">
      <div class="filters-bar" style="margin-bottom:1rem">
        <input v-model="sshFilter.username" placeholder="🔍 用户名..." class="filter-input" @input="loadSSHLogs" />
        <input v-model="sshFilter.date" type="date" class="filter-input" @change="loadSSHLogs" />
        <button class="btn-secondary" @click="sshFilter.username=''; sshFilter.date=''; loadSSHLogs()">🔄 重置</button>
      </div>

      <div v-if="sshLoading" class="loading">加载中...</div>
      <div v-else-if="sshLogs.length === 0" class="empty-state"><p>暂无 SSH 日志</p></div>
      <div v-else class="logs-table-container">
        <table class="logs-table">
          <thead>
            <tr>
              <th>用户</th>
              <th>文件名</th>
              <th>大小</th>
              <th>最后修改</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in sshLogs" :key="item.path">
              <td>{{ item.username }}</td>
              <td style="font-family:monospace;font-size:0.85rem">{{ item.file }}</td>
              <td>{{ formatSize(item.size) }}</td>
              <td>{{ item.mod_time }}</td>
              <td>
                <button class="btn-link" @click="viewSSHLog(item)">👁️ 查看</button>
                <a :href="`/api/audit/ssh-logs/download?username=${item.username}&file=${item.file}`" class="btn-link" style="margin-left:0.5rem">⬇️ 下载</a>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="pagination"><span class="total-count">共 {{ sshLogs.length }} 个日志文件</span></div>
      </div>
    </div>

    <!-- 用量报表面板（管理员查所有用户） -->
    <div v-if="activeTab === 'report'" class="report-panel">
      <div class="report-filter-bar">
        <div class="filter-item">
          <label>用户名</label>
          <input v-model="reportFilters.username" placeholder="留空查全部" class="filter-input-sm" />
        </div>
        <div class="filter-item">
          <label>开始日期</label>
          <input type="date" v-model="reportFilters.startDate" :max="reportFilters.endDate" class="filter-input-sm" />
        </div>
        <div class="filter-item">
          <label>结束日期</label>
          <input type="date" v-model="reportFilters.endDate" :min="reportFilters.startDate" class="filter-input-sm" />
        </div>
        <div class="filter-item">
          <label>队列</label>
          <select v-model="reportFilters.partition" class="filter-input-sm">
            <option value="">全部</option>
            <option v-for="p in reportPartitions" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>
        <button class="btn-primary" @click="loadAdminReport" :disabled="reportLoading">
          {{ reportLoading ? '查询中...' : '🔍 查询' }}
        </button>
        <button class="btn-secondary" @click="exportAdminExcel" :disabled="!reportHasData">
          📥 导出 Excel
        </button>
      </div>

      <div v-if="reportLoading" class="report-state">
        <div class="spinner"></div><span>加载中...</span>
      </div>
      <div v-else-if="reportError" class="report-state" style="color:#f5222d">⚠ {{ reportError }}</div>

      <template v-else-if="reportHasData">
        <!-- 月度作业折线图 -->
        <div class="rcard" v-if="rJobStats?.monthly_job_counts.length">
          <div class="rcard-title">每月各队列作业数趋势</div>
          <div ref="rLineRef" style="width:100%;height:260px"></div>
        </div>

        <!-- 作业规模 + 核时 -->
        <div class="rchart-row">
          <div class="rcard" v-if="rJobStats?.job_scale_distribution.length">
            <div class="rcard-title">作业规模分布</div>
            <div ref="rScaleRef" style="width:100%;height:240px"></div>
          </div>
          <div class="rcard" v-if="rUsageStats">
            <div class="rcard-title">GPU / CPU 核时用量</div>
            <div ref="rUsageRef" style="width:100%;height:240px"></div>
          </div>
        </div>

        <!-- 存储用量 -->
        <div class="rcard" v-if="rStorageStats?.length">
          <div class="rcard-title">存储配额使用情况</div>
          <div ref="rStorageRef" :style="{ width: '100%', height: Math.max(260, rStorageStats.length * 60) + 'px' }"></div>
        </div>

        <!-- 配额进度 -->
        <div class="rchart-row">
          <div class="rcard" v-if="rUsageStats">
            <div class="rcard-title">计费核时使用比例</div>
            <div v-if="rUsageStats.quota_billing_hours === 0" class="no-limit-info">ℹ 无配额限制，实际使用：{{ rUsageStats.billing_hours.toFixed(2) }} h</div>
            <template v-else>
              <div class="progress-info"><span>{{ rUsageStats.billing_hours.toFixed(2) }} / {{ rUsageStats.quota_billing_hours.toFixed(2) }} h</span><span :style="{ color: rStatusColor(rUsageStats.status) }">{{ rUsageStats.usage_percent.toFixed(1) }}%</span></div>
              <div class="progress-bar-wrap"><div class="progress-bar-fill" :style="{ width: Math.min(rUsageStats.usage_percent,100)+'%', background: rStatusColor(rUsageStats.status) }"></div></div>
              <span class="rstatus-badge" :style="{ background: rStatusBg(rUsageStats.status), color: rStatusColor(rUsageStats.status) }">{{ rStatusLabel(rUsageStats.status) }}</span>
            </template>
          </div>
          <div class="rcard" v-if="rQuotaStats?.account">
            <div class="rcard-title">配额使用率 <span class="account-tag">{{ rQuotaStats.account }}</span></div>
            <div class="progress-info"><span>{{ rQuotaStats.used_billing_hours.toFixed(2) }} / {{ rQuotaStats.total_billing_hours.toFixed(2) }} h</span><span :style="{ color: rStatusColor(rQuotaStats.status) }">{{ rQuotaStats.usage_percent.toFixed(1) }}%</span></div>
            <div class="progress-bar-wrap"><div class="progress-bar-fill" :style="{ width: Math.min(rQuotaStats.usage_percent,100)+'%', background: rStatusColor(rQuotaStats.status) }"></div></div>
            <span class="rstatus-badge" :style="{ background: rStatusBg(rQuotaStats.status), color: rStatusColor(rQuotaStats.status) }">{{ rStatusLabel(rQuotaStats.status) }}</span>
          </div>
        </div>
      </template>

      <div v-else-if="!reportLoading" class="report-state">
        <span style="font-size:2rem">📊</span><p>选择条件后点击查询</p>
      </div>
    </div>

  </div>
  <Teleport to="body">
    <!-- SSH 日志内容查看弹窗 -->
    <div v-if="showSSHLogModal" class="modal-overlay" @click.self="showSSHLogModal = false">
      <div class="modal modal-large">
        <div class="modal-header">
          <h3>🔐 SSH 行为日志 — {{ sshLogFile?.file }}</h3>
          <button class="btn-close" @click="showSSHLogModal = false">×</button>
        </div>
        <div class="modal-body">
          <pre class="ssh-log-content">{{ sshLogContent }}</pre>
        </div>
      </div>
    </div>
    <!-- 详情对话框 -->
    <div v-if="showDetailsDialog" class="modal-overlay" @click.self="closeDetails">
      <div class="modal modal-large">
        <div class="modal-header">
          <h3>📋 审计日志详情</h3>
          <button class="btn-close" @click="closeDetails">×</button>
        </div>
        <div class="modal-body">
          <div v-if="selectedLog" class="details-content">
            <div class="detail-row">
              <label>日志ID</label>
              <span>{{ selectedLog.id }}</span>
            </div>
            <div class="detail-row">
              <label>时间</label>
              <span>{{ formatFullTime(selectedLog.timestamp) }}</span>
            </div>
            <div class="detail-row">
              <label>用户</label>
              <span>{{ selectedLog.username }} ({{ selectedLog.user_role }})</span>
            </div>
            <div class="detail-row">
              <label>操作类型</label>
              <span class="action-badge" :class="'action-' + selectedLog.action">
                {{ getActionLabel(selectedLog.action) }}
              </span>
            </div>
            <div class="detail-row">
              <label>资源类型</label>
              <span class="resource-badge">{{ getResourceLabel(selectedLog.resource) }}</span>
            </div>
            <div class="detail-row">
              <label>资源ID</label>
              <span>{{ selectedLog.resource_id || '-' }}</span>
            </div>
            <div class="detail-row">
              <label>状态</label>
              <span class="status-badge" :class="'status-' + selectedLog.status">
                {{ selectedLog.status === 'success' ? '✅ 成功' : '❌ 失败' }}
              </span>
            </div>
            <div v-if="selectedLog.error_msg" class="detail-row">
              <label>错误信息</label>
              <span class="error-text">{{ selectedLog.error_msg }}</span>
            </div>
            <div class="detail-row">
              <label>客户端IP</label>
              <span>{{ selectedLog.ip_address }}</span>
            </div>
            <div class="detail-row">
              <label>访问地址</label>
              <span class="host-text">{{ selectedLog.access_host || '-' }}</span>
            </div>
            <div class="detail-row">
              <label>用户代理</label>
              <span class="user-agent">{{ selectedLog.user_agent }}</span>
            </div>
            <div class="detail-row">
              <label>耗时</label>
              <span>{{ selectedLog.duration }}ms</span>
            </div>
            <div class="detail-row full-width">
              <label>操作详情</label>
              <pre class="details-pre">{{ selectedLog.details }}</pre>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeDetails">关闭</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'
import * as echarts from 'echarts'
import notification from '../utils/notification'
import { reportAPI, type JobStatsResult, type UsageStatsResult, type StorageStatItem, type QuotaStatsResult } from '../api/report'

const loading = ref(false)
const error = ref('')
const logs = ref<any[]>([])
const stats = ref<any>({})
const showStats = ref(false)
const showDetailsDialog = ref(false)
const selectedLog = ref<any>(null)
const activeTab = ref<'audit' | 'ssh' | 'report'>('audit')

// SSH 日志
const sshLogs = ref<any[]>([])
const sshLoading = ref(false)
const sshFilter = ref({ username: '', date: '' })
const showSSHLogModal = ref(false)
const sshLogFile = ref<any>(null)
const sshLogContent = ref('')

const loadSSHLogs = async () => {
  sshLoading.value = true
  try {
    const params: any = {}
    if (sshFilter.value.username) params.username = sshFilter.value.username
    if (sshFilter.value.date) params.date = sshFilter.value.date
    const res = await axios.get('/audit/ssh-logs', { params })
    sshLogs.value = res.data.data || []
  } catch (e: any) {
    notification.error(e.response?.data?.error || e.message, '加载SSH日志失败')
  } finally {
    sshLoading.value = false
  }
}

const viewSSHLog = async (item: any) => {
  sshLogFile.value = item
  sshLogContent.value = '加载中...'
  showSSHLogModal.value = true
  try {
    const res = await axios.get(`/audit/ssh-logs/download`, {
      params: { username: item.username, file: item.file },
      responseType: 'text',
    })
    sshLogContent.value = res.data
  } catch (e: any) {
    sshLogContent.value = '加载失败: ' + (e.response?.data?.error || e.message)
  }
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

// 过滤器
const filters = ref({
  username: '',
  action: '',
  resource: '',
  status: '',
  timeRange: '24h',
  startTime: '',
  endTime: ''
})

// 防抖定时器
let debounceTimer: any = null

// 加载日志
const loadLogs = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const params: any = {
      limit: 1000
    }
    
    if (filters.value.username) params.username = filters.value.username
    if (filters.value.action) params.action = filters.value.action
    if (filters.value.resource) params.resource = filters.value.resource
    if (filters.value.status) params.status = filters.value.status
    if (filters.value.startTime) params.start_time = filters.value.startTime
    if (filters.value.endTime) params.end_time = filters.value.endTime
    
    const response = await axios.get('/audit/logs', { params })
    logs.value = response.data.data || []
  } catch (err: any) {
    error.value = err.response?.data?.error || '加载日志失败'
    console.error('Failed to load audit logs:', err)
  } finally {
    loading.value = false
  }
}

// 防抖加载
const debouncedLoad = () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    loadLogs()
  }, 500)
}

// 加载统计信息
const loadStats = async () => {
  try {
    const response = await axios.get('/audit/stats')
    stats.value = response.data.data || {}
    showStats.value = !showStats.value
  } catch (err: any) {
    notification.error(err.response?.data?.error || err.message, '加载统计失败')
  }
}

// 处理时间范围变化
const handleTimeRangeChange = () => {
  const now = new Date()
  let startTime = new Date()
  
  switch (filters.value.timeRange) {
    case '1h':
      startTime.setHours(now.getHours() - 1)
      break
    case '24h':
      startTime.setHours(now.getHours() - 24)
      break
    case '7d':
      startTime.setDate(now.getDate() - 7)
      break
    case '30d':
      startTime.setDate(now.getDate() - 30)
      break
    default:
      filters.value.startTime = ''
      filters.value.endTime = ''
      loadLogs()
      return
  }
  
  filters.value.startTime = startTime.toISOString()
  filters.value.endTime = now.toISOString()
  loadLogs()
}

// 重置过滤器
const resetFilters = () => {
  filters.value = {
    username: '',
    action: '',
    resource: '',
    status: '',
    timeRange: '24h',
    startTime: '',
    endTime: ''
  }
  handleTimeRangeChange()
}

// 导出日志
const exportLogs = async () => {
  try {
    const params: any = {}
    if (filters.value.username) params.username = filters.value.username
    if (filters.value.action) params.action = filters.value.action
    if (filters.value.resource) params.resource = filters.value.resource
    if (filters.value.status) params.status = filters.value.status
    if (filters.value.startTime) params.start_time = filters.value.startTime
    if (filters.value.endTime) params.end_time = filters.value.endTime
    
    const queryString = new URLSearchParams(params).toString()
    const url = `/audit/export${queryString ? '?' + queryString : ''}`
    
    window.open(axios.defaults.baseURL + url, '_blank')
    notification.success('导出任务已启动')
  } catch (err: any) {
    notification.error(err.response?.data?.error || err.message, '导出失败')
  }
}

// 查看详情
const viewDetails = (log: any) => {
  selectedLog.value = log
  showDetailsDialog.value = true
}

// 关闭详情
const closeDetails = () => {
  showDetailsDialog.value = false
  selectedLog.value = null
}

// 格式化时间
const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 格式化完整时间
const formatFullTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 获取操作标签
const getActionLabel = (action: string) => {
  const labels: any = {
    page_view: '📄 页面访问',
  shell_command: '💻 Shell命令',
  shell_blocked: '⛔ 被拦截',
  create: '创建',
    update: '更新',
    delete: '删除',
    read: '读取',
    login: '登录',
    logout: '登出',
    reset_password: '重置密码',
    change_password: '修改密码',
    set_disabled: '禁用/启用',
    export: '导出'
  }
  return labels[action] || action
}

// 获取资源标签
const getResourceLabel = (resource: string) => {
  const labels: any = {
    user: '用户',
    group: '用户组',
    account: '账户',
    association: '关联',
    qos: 'QoS',
    job: '作业',
    file: '文件',
    auth: '认证'
  }
  return labels[resource] || resource
}

// ── 用量报表（管理员） ──────────────────────────────────────
function fmtDate(d: Date) { return d.toISOString().split('T')[0] }
const rToday = new Date()
const r30ago = new Date(rToday); r30ago.setDate(rToday.getDate() - 30)

const reportLoading = ref(false)
const reportError   = ref('')
const reportPartitions = ref<string[]>([])
const reportFilters = ref({ username: '', startDate: fmtDate(r30ago), endDate: fmtDate(rToday), partition: '' })

const rJobStats    = ref<JobStatsResult | null>(null)
const rUsageStats  = ref<UsageStatsResult | null>(null)
const rStorageStats = ref<StorageStatItem[] | null>(null)
const rQuotaStats  = ref<QuotaStatsResult | null>(null)

const rLineRef    = ref<HTMLElement | null>(null)
const rScaleRef   = ref<HTMLElement | null>(null)
const rUsageRef   = ref<HTMLElement | null>(null)
const rStorageRef = ref<HTMLElement | null>(null)
let rLineChart: echarts.ECharts | null = null
let rScaleChart: echarts.ECharts | null = null
let rUsageChart: echarts.ECharts | null = null
let rStorageChart: echarts.ECharts | null = null

import { computed, nextTick } from 'vue'

const reportHasData = computed(() =>
  !!(rJobStats.value || rUsageStats.value || rStorageStats.value || rQuotaStats.value)
)

async function loadReportPartitions() {
  try {
    const res = await axios.get<{ data: string[] }>('/jobs/partitions/list')
    reportPartitions.value = res.data?.data ?? []
  } catch { reportPartitions.value = [] }
}

async function loadAdminReport() {
  reportLoading.value = true
  reportError.value = ''
  rJobStats.value = null; rUsageStats.value = null
  rStorageStats.value = null; rQuotaStats.value = null
  rLineChart?.dispose(); rLineChart = null
  rScaleChart?.dispose(); rScaleChart = null
  rUsageChart?.dispose(); rUsageChart = null
  rStorageChart?.dispose(); rStorageChart = null

  const params: any = {
    start_time: reportFilters.value.startDate,
    end_time:   reportFilters.value.endDate,
    partition:  reportFilters.value.partition || undefined,
  }
  if (reportFilters.value.username) params.user = reportFilters.value.username

  try {
    const [jobRes, usageRes, storageRes, quotaRes] = await Promise.allSettled([
      reportAPI.getJobStats(params),
      reportAPI.getUsageStats(params),
      reportAPI.getStorageStats(params),
      reportAPI.getQuotaStats(params),
    ])
    if (jobRes.status === 'fulfilled')     rJobStats.value     = jobRes.value.data.data
    if (usageRes.status === 'fulfilled')   rUsageStats.value   = usageRes.value.data.data
    if (storageRes.status === 'fulfilled') rStorageStats.value = storageRes.value.data.data
    if (quotaRes.status === 'fulfilled')   rQuotaStats.value   = quotaRes.value.data.data
    await nextTick()
    renderAdminCharts()
  } catch (e: any) {
    reportError.value = e?.message || '查询失败'
  } finally {
    reportLoading.value = false
  }
}

function renderAdminCharts() {
  // 折线图
  if (rLineRef.value && rJobStats.value?.monthly_job_counts.length) {
    if (!rLineChart) rLineChart = echarts.init(rLineRef.value, 'dark')
    const counts = rJobStats.value.monthly_job_counts
    const months = [...new Set(counts.map(c => c.month))].sort()
    const queues = [...new Set(counts.map(c => c.partition))]
    rLineChart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { data: queues, textStyle: { color: '#ccc' }, bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '12%', top: '8%', containLabel: true },
      xAxis: { type: 'category', data: months, boundaryGap: false, axisLabel: { color: '#aaa' }, axisLine: { lineStyle: { color: '#444' } } },
      yAxis: { type: 'value', name: '作业数', nameTextStyle: { color: '#aaa' }, axisLabel: { color: '#aaa' }, splitLine: { lineStyle: { color: '#333' } } },
      series: queues.map(q => ({ name: q, type: 'line' as const, smooth: true, symbol: 'circle', symbolSize: 6, areaStyle: { opacity: 0.08 }, data: months.map(m => counts.find(c => c.month === m && c.partition === q)?.count ?? 0) })),
    })
  }
  // 规模柱状图
  if (rScaleRef.value && rJobStats.value?.job_scale_distribution.length) {
    if (!rScaleChart) rScaleChart = echarts.init(rScaleRef.value, 'dark')
    const dist = rJobStats.value.job_scale_distribution
    const total = rJobStats.value.total_jobs
    rScaleChart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].name}<br/>作业数: <b>${p[0].value}</b>（${total > 0 ? (p[0].value/total*100).toFixed(1) : 0}%）` },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '8%', containLabel: true },
      xAxis: { type: 'category', data: dist.map(d => d.range), axisLabel: { color: '#aaa' }, axisLine: { lineStyle: { color: '#444' } } },
      yAxis: { type: 'value', name: '作业数', nameTextStyle: { color: '#aaa' }, axisLabel: { color: '#aaa' }, splitLine: { lineStyle: { color: '#333' } } },
      series: [{ type: 'bar', data: dist.map(d => d.count), itemStyle: { borderRadius: [4,4,0,0] }, label: { show: true, position: 'top', color: '#ccc', fontSize: 11 }, barMaxWidth: 60 }],
    })
  }
  // 核时柱状图
  if (rUsageRef.value && rUsageStats.value) {
    if (!rUsageChart) rUsageChart = echarts.init(rUsageRef.value, 'dark')
    const u = rUsageStats.value
    rUsageChart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '8%', containLabel: true },
      xAxis: { type: 'category', data: ['GPU 卡时', 'CPU 核时', '计费核时'], axisLabel: { color: '#aaa' }, axisLine: { lineStyle: { color: '#444' } } },
      yAxis: { type: 'value', name: '小时(h)', nameTextStyle: { color: '#aaa' }, axisLabel: { color: '#aaa' }, splitLine: { lineStyle: { color: '#333' } } },
      series: [{ type: 'bar', data: [{ value: +u.gpu_hours.toFixed(2), itemStyle: { color: '#5470c6' } }, { value: +u.cpu_hours.toFixed(2), itemStyle: { color: '#91cc75' } }, { value: +u.billing_hours.toFixed(2), itemStyle: { color: '#fac858' } }], label: { show: true, position: 'top', color: '#ccc', fontSize: 11, formatter: (p: any) => `${p.value}h` }, barMaxWidth: 60, itemStyle: { borderRadius: [4,4,0,0] } }],
    })
  }
  // 存储柱状图
  if (rStorageRef.value && rStorageStats.value?.length) {
    if (!rStorageChart) rStorageChart = echarts.init(rStorageRef.value, 'dark')
    const items = rStorageStats.value
    const labels = items.map(i => `${i.username}  ${i.filesystem}`)
    const barColors = items.map(i => i.over_soft_limit ? '#fa8c16' : '#52c41a')
    rStorageChart.resize()
    rStorageChart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (params: any[]) => { const i = items[params[0].dataIndex]; return `<b>${i.username}</b> ${i.filesystem}<br/>已用: <b>${i.used_gb.toFixed(2)} GB</b><br/>软限制: ${i.soft_limit_gb.toFixed(2)} GB<br/>硬限制: ${i.hard_limit_gb.toFixed(2)} GB<br/>使用率: <b>${i.usage_percent.toFixed(1)}%</b>${i.over_soft_limit ? '<br/><span style="color:#fa8c16">⚠ 超软限制</span>' : ''}` } },
      legend: { data: ['已用量', '软限制', '硬限制'], textStyle: { color: '#ccc' }, top: 4 },
      grid: { left: '2%', right: '8%', top: 36, bottom: '2%', containLabel: true },
      xAxis: { type: 'value', name: 'GB', nameTextStyle: { color: '#aaa' }, axisLabel: { color: '#aaa' }, splitLine: { lineStyle: { color: '#2a2a2a' } } },
      yAxis: { type: 'category', data: labels, axisLabel: { color: '#ccc', fontSize: 12 }, axisLine: { lineStyle: { color: '#444' } } },
      series: [
        { name: '已用量', type: 'bar', data: items.map((v, i) => ({ value: +v.used_gb.toFixed(2), itemStyle: { color: barColors[i] } })), label: { show: true, position: 'right', color: '#ccc', fontSize: 11, formatter: (p: any) => `${p.value} GB` }, barMaxWidth: 28, z: 3 },
        { name: '软限制', type: 'bar', data: items.map(i => +i.soft_limit_gb.toFixed(2)), itemStyle: { color: 'rgba(250,140,22,0.25)', borderColor: '#fa8c16', borderWidth: 1 }, barMaxWidth: 28, barGap: '-100%', z: 2 },
        { name: '硬限制', type: 'bar', data: items.map(i => +i.hard_limit_gb.toFixed(2)), itemStyle: { color: 'rgba(100,100,100,0.18)', borderColor: '#555', borderWidth: 1 }, barMaxWidth: 28, barGap: '-100%', z: 1 },
      ],
    })
  }
}

function rStatusColor(s: string) { return s === 'EXCEEDED' ? '#f5222d' : s === 'WARNING' ? '#fa8c16' : '#52c41a' }
function rStatusBg(s: string)    { return s === 'EXCEEDED' ? 'rgba(245,34,45,0.12)' : s === 'WARNING' ? 'rgba(250,140,22,0.12)' : 'rgba(82,196,26,0.12)' }
function rStatusLabel(s: string) { return s === 'EXCEEDED' ? '已超限' : s === 'WARNING' ? '警告' : '正常' }

function exportAdminExcel() {
  import('xlsx').then(XLSX => {
    const wb = XLSX.utils.book_new()
    const { startDate, endDate, username } = reportFilters.value
    if (rJobStats.value) {
      const j = rJobStats.value
      const ws1 = XLSX.utils.aoa_to_sheet([['月份','队列','作业数'], ...j.monthly_job_counts.map(r => [r.month, r.partition, r.count])])
      ws1['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 10 }]
      XLSX.utils.book_append_sheet(wb, ws1, '月度作业趋势')
      const ws2 = XLSX.utils.aoa_to_sheet([['规模范围','作业数','占比(%)'], ...j.job_scale_distribution.map(r => [r.range, r.count, j.total_jobs > 0 ? +(r.count/j.total_jobs*100).toFixed(1) : 0]), ['合计', j.total_jobs, 100]])
      ws2['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 10 }]
      XLSX.utils.book_append_sheet(wb, ws2, '作业规模分布')
    }
    if (rUsageStats.value) {
      const u = rUsageStats.value
      const ws = XLSX.utils.aoa_to_sheet([['指标','数值','单位'],['统计周期',`${startDate} ~ ${endDate}`,''],[`GPU 卡时`,+u.gpu_hours.toFixed(2),'h'],['CPU 核时',+u.cpu_hours.toFixed(2),'h'],['计费核时',+u.billing_hours.toFixed(2),'h'],['配额总量',u.quota_billing_hours===0?'无限制':+u.quota_billing_hours.toFixed(2),u.quota_billing_hours===0?'':'h'],['使用率',+u.usage_percent.toFixed(2),'%'],['状态',rStatusLabel(u.status),'']])
      ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 8 }]
      XLSX.utils.book_append_sheet(wb, ws, '核时使用')
    }
    if (rStorageStats.value?.length) {
      const ws = XLSX.utils.aoa_to_sheet([['用户名','文件系统','已用量(GB)','软限制(GB)','硬限制(GB)','使用率(%)','超软限制'], ...rStorageStats.value.map(r => [r.username, r.filesystem, +r.used_gb.toFixed(2), +r.soft_limit_gb.toFixed(2), +r.hard_limit_gb.toFixed(2), +r.usage_percent.toFixed(2), r.over_soft_limit?'是':'否'])])
      ws['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }]
      XLSX.utils.book_append_sheet(wb, ws, '存储用量')
    }
    if (rQuotaStats.value?.account) {
      const q = rQuotaStats.value
      const ws = XLSX.utils.aoa_to_sheet([['指标','数值','单位'],['统计周期',`${startDate} ~ ${endDate}`,''],[`账户`,q.account,''],['配额总量',+q.total_billing_hours.toFixed(2),'h'],['已用量',+q.used_billing_hours.toFixed(2),'h'],['剩余量',+q.remaining_billing_hours.toFixed(2),'h'],['使用率',+q.usage_percent.toFixed(2),'%'],['状态',rStatusLabel(q.status),'']])
      ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 8 }]
      XLSX.utils.book_append_sheet(wb, ws, '配额情况')
    }
    if (wb.SheetNames.length === 0) return
    const uLabel = username ? `_${username}` : '_全部用户'
    XLSX.writeFile(wb, `用量报表${uLabel}_${startDate}_${endDate}.xlsx`)
  })
}

onMounted(() => {
  handleTimeRangeChange()
  loadReportPartitions()
})
</script>

<style scoped>
.audit-logs {
  padding: 2rem;
}

.tab-bar {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #e5e7eb;
  padding-bottom: 0;
}

.tab-btn {
  padding: 0.6rem 1.2rem;
  border: none;
  background: none;
  font-size: 0.95rem;
  cursor: pointer;
  color: #6b7280;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.15s;
}

.tab-btn.active {
  color: #667eea;
  border-bottom-color: #667eea;
  font-weight: 600;
}

.ssh-log-content {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 1rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-family: 'Courier New', monospace;
  max-height: 500px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.page-header h3 {
  margin: 0;
  font-size: 1.5rem;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.stats-section {
  margin-bottom: 2rem;
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.stat-icon {
  font-size: 2.5rem;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #667eea;
}

.stat-label {
  font-size: 0.9rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.filters-section {
  margin-bottom: 1.5rem;
}

.filters-bar {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.filter-input,
.filter-select {
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.95rem;
}

.filter-input {
  flex: 1;
  min-width: 200px;
}

.filter-input:focus,
.filter-select:focus {
  outline: none;
  border-color: #667eea;
}

.filter-select {
  cursor: pointer;
  background: white;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: #666;
}

.error-message {
  padding: 1rem;
  background: #fee;
  color: #c00;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.logs-section {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.logs-table-container {
  overflow-x: auto;
}

.logs-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 1200px;
}

.logs-table th {
  background: #f9fafb;
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #555;
  border-bottom: 2px solid #e5e7eb;
  white-space: nowrap;
}

.logs-table td {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.logs-table tbody tr:hover {
  background: #f9fafb;
}

.logs-table tbody tr.failed-row {
  background: #fef2f2;
}

.time-cell {
  color: #6b7280;
  font-size: 0.9rem;
  white-space: nowrap;
}

.user-cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.username {
  font-weight: 600;
}

.user-role {
  font-size: 0.8rem;
  padding: 0.15rem 0.5rem;
  border-radius: 8px;
  width: fit-content;
}

.role-admin {
  background: #fef3c7;
  color: #92400e;
}

.role-user {
  background: #dbeafe;
  color: #1e40af;
}

.action-badge,
.resource-badge,
.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
}

.action-page_view {
  background: #f0fdf4;
  color: #166534;
}

.action-shell_command {
  background: #eff6ff;
  color: #1d4ed8;
}

.action-shell_blocked {
  background: #fef2f2;
  color: #991b1b;
  font-weight: 700;
}

.action-create {
  background: #d1fae5;
  color: #065f46;
}

.action-update {
  background: #dbeafe;
  color: #1e40af;
}

.action-delete {
  background: #fee2e2;
  color: #991b1b;
}

.action-read {
  background: #e5e7eb;
  color: #374151;
}

.action-login,
.action-logout {
  background: #fef3c7;
  color: #92400e;
}

.resource-badge {
  background: #e0e7ff;
  color: #4338ca;
}

.status-success {
  background: #d1fae5;
  color: #065f46;
}

.status-failed {
  background: #fee2e2;
  color: #991b1b;
}

.resource-id {
  color: #6b7280;
  font-family: monospace;
  font-size: 0.9rem;
}

.ip-cell {
  color: #6b7280;
  font-family: monospace;
  font-size: 0.9rem;
}

.host-cell {
  color: #4338ca;
  font-family: monospace;
  font-size: 0.85rem;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.host-text {
  color: #4338ca;
  font-family: monospace;
  font-size: 0.9rem;
  word-break: break-all;
}

.duration-cell {
  color: #6b7280;
  font-size: 0.9rem;
  text-align: right;
}

.btn-link {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0.25rem 0.5rem;
}

.btn-link:hover {
  text-decoration: underline;
}

.btn-primary {
  background: #fff;
  color: #1e293b;
  border: 1px solid #e2e8f0;
  padding: 7px 16px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.875rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: all 0.15s;
}
.btn-primary:hover { background: #f1f5f9; }

.btn-secondary {
  background: #fff;
  color: #1e293b;
  border: 1px solid #e2e8f0;
  padding: 7px 16px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.875rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: all 0.15s;
}
.btn-secondary:hover { background: #f1f5f9; }

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #6b7280;
}

.pagination {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: center;
}

.total-count {
  color: #6b7280;
  font-size: 0.9rem;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 700px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-large {
  max-width: 900px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
}

.btn-close {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #9ca3af;
  line-height: 1;
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.details-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.detail-row {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 1rem;
  align-items: start;
}

.detail-row.full-width {
  grid-template-columns: 1fr;
}

.detail-row label {
  font-weight: 600;
  color: #374151;
}

.detail-row span {
  color: #1f2937;
}

.error-text {
  color: #dc2626;
  font-weight: 500;
}

.user-agent {
  font-size: 0.85rem;
  color: #6b7280;
  word-break: break-all;
}

.details-pre {
  background: #f9fafb;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  font-family: monospace;
  font-size: 0.9rem;
  white-space: pre-wrap;
  word-break: break-all;
}

@media (max-width: 768px) {
  .filters-bar { flex-direction: column; }
  .filter-input { min-width: auto; }
  .detail-row { grid-template-columns: 1fr; }
}

/* ── 用量报表面板 ── */
.report-panel { display: flex; flex-direction: column; gap: 1rem; }
.report-filter-bar { display: flex; align-items: flex-end; gap: 0.75rem; flex-wrap: wrap; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 0.75rem 1rem; }
.filter-item { display: flex; flex-direction: column; gap: 0.2rem; }
.filter-item label { font-size: 0.72rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.filter-input-sm { padding: 0.4rem 0.65rem; border: 1px solid #e5e7eb; border-radius: 7px; font-size: 0.85rem; background: #fff; color: #1e293b; outline: none; }
.filter-input-sm:focus { border-color: #667eea; }
.report-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; padding: 3rem; color: #6b7280; text-align: center; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; }
.rcard { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 1.25rem 1.5rem; }
.rcard-title { font-size: 0.9rem; font-weight: 700; color: #1e293b; margin-bottom: 1rem; }
.rchart-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
@media (max-width: 900px) { .rchart-row { grid-template-columns: 1fr; } }
.account-tag { font-size: 0.75rem; font-weight: 500; color: #6b7280; background: #f1f5f9; padding: 2px 8px; border-radius: 10px; }
.progress-info { display: flex; justify-content: space-between; font-size: 0.875rem; color: #1e293b; margin-bottom: 0.5rem; }
.progress-bar-wrap { width: 100%; height: 10px; background: #e5e7eb; border-radius: 5px; overflow: hidden; margin-bottom: 0.75rem; }
.progress-bar-fill { height: 100%; border-radius: 5px; transition: width 0.4s ease; }
.rstatus-badge { display: inline-block; padding: 3px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; }
.no-limit-info { color: #6b7280; font-size: 0.875rem; }
.spinner { width: 26px; height: 26px; border: 3px solid #e5e7eb; border-top-color: #667eea; border-radius: 50%; animation: spin2 0.7s linear infinite; }
@keyframes spin2 { to { transform: rotate(360deg); } }
</style>
