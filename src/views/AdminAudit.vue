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

    <!-- 统计卡片 -->
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
              <th>IP地址</th>
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
              <label>IP地址</label>
              <span>{{ selectedLog.ip_address }}</span>
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'
import notification from '../utils/notification'

const loading = ref(false)
const error = ref('')
const logs = ref<any[]>([])
const stats = ref<any>({})
const showStats = ref(false)
const showDetailsDialog = ref(false)
const selectedLog = ref<any>(null)

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

onMounted(() => {
  handleTimeRangeChange()
})
</script>

<style scoped>
.audit-logs {
  padding: 2rem;
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-secondary {
  background: #e5e7eb;
  color: #374151;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.btn-secondary:hover {
  background: #d1d5db;
}

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
  .filters-bar {
    flex-direction: column;
  }
  
  .filter-input {
    min-width: auto;
  }
  
  .detail-row {
    grid-template-columns: 1fr;
  }
}
</style>
