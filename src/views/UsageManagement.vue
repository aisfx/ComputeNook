<template>
  <div class="usage-management">
    <div class="page-header">
      <h3>⏱️ 机时管理</h3>
      <div class="header-actions">
        <button class="btn-secondary" @click="exportData">📊 导出数据</button>
        <button class="btn-primary" @click="refreshData">🔄 刷新</button>
      </div>
    </div>

    <!-- 查询条件 -->
    <div class="card query-panel">
      <h4>查询条件</h4>
      <div class="query-form">
        <div class="form-row">
          <div class="form-group">
            <label>查询类型</label>
            <select v-model="queryType" @change="onQueryTypeChange">
              <option value="user">用户查询</option>
              <option value="account">账户查询</option>
              <option value="cluster">集群概览</option>
            </select>
          </div>
          <div class="form-group" v-if="queryType === 'user'">
            <label>用户名</label>
            <input v-model="queryUser" placeholder="输入用户名" />
          </div>
          <div class="form-group" v-if="queryType === 'account'">
            <label>账户名</label>
            <input v-model="queryAccount" placeholder="输入账户名" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>开始时间</label>
            <input type="date" v-model="startDate" />
          </div>
          <div class="form-group">
            <label>结束时间</label>
            <input type="date" v-model="endDate" />
          </div>
          <div class="form-group">
            <label>快速选择</label>
            <select @change="onQuickSelect">
              <option value="">自定义</option>
              <option value="7">最近7天</option>
              <option value="30">最近30天</option>
              <option value="90">最近90天</option>
            </select>
          </div>
          <div class="form-group">
            <button class="btn-primary" @click="queryUsage">🔍 查询</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 账户机时状态 -->
    <div class="card" v-if="queryType === 'account' && accountUsage">
      <h4>💰 账户机时状态</h4>
      <div class="billing-status">
        <div class="billing-card" :class="getBillingStatusClass(accountUsage.status)">
          <div class="billing-header">
            <h5>{{ accountUsage.account }}</h5>
            <span class="status-badge" :class="getBillingStatusClass(accountUsage.status)">
              {{ getBillingStatusText(accountUsage.status) }}
            </span>
          </div>
          <div class="billing-details">
            <div class="billing-item">
              <span class="label">总分配机时:</span>
              <span class="value">{{ formatMinutes(accountUsage.total_billing) }}</span>
            </div>
            <div class="billing-item">
              <span class="label">已使用机时:</span>
              <span class="value">{{ formatMinutes(accountUsage.used_billing) }}</span>
            </div>
            <div class="billing-item">
              <span class="label">剩余机时:</span>
              <span class="value">{{ formatMinutes(accountUsage.remaining_billing) }}</span>
            </div>
            <div class="billing-item">
              <span class="label">使用率:</span>
              <span class="value">{{ accountUsage.usage_percent.toFixed(1) }}%</span>
            </div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" 
                 :style="{ width: Math.min(accountUsage.usage_percent, 100) + '%' }"
                 :class="getBillingStatusClass(accountUsage.status)">
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 使用汇总 -->
    <div class="card" v-if="summary">
      <h4>📈 使用汇总</h4>
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-label">总作业数</div>
          <div class="summary-value">{{ summary.total_jobs }}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">CPU 小时</div>
          <div class="summary-value">{{ formatHours(summary.total_cpu_hours) }}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">节点小时</div>
          <div class="summary-value">{{ formatHours(summary.total_node_hours) }}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">GPU 小时</div>
          <div class="summary-value">{{ formatHours(summary.total_gpu_hours) }}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">内存小时 (GB·h)</div>
          <div class="summary-value">{{ formatHours(summary.total_memory_hours) }}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">统计周期</div>
          <div class="summary-value">{{ summary.period }}</div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-if="error" class="error-message">{{ error }}</div>

    <!-- 详细数据表格 -->
    <div v-else class="card">
      <div class="table-header">
        <h4>📋 使用详情</h4>
        <div class="table-actions">
          <input 
            type="text" 
            v-model="searchText" 
            placeholder="搜索用户、账户或分区..." 
            class="search-input"
          />
        </div>
      </div>
      
      <table class="data-table">
        <thead>
          <tr>
            <th v-if="queryType !== 'user'">用户</th>
            <th v-if="queryType !== 'account'">账户</th>
            <th>集群</th>
            <th>分区</th>
            <th>QoS</th>
            <th>作业数</th>
            <th>CPU 小时</th>
            <th>节点小时</th>
            <th>GPU 小时</th>
            <th>内存小时 (GB·h)</th>
            <th>状态</th>
            <th>时间范围</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in filteredRecords" :key="getRecordKey(record)">
            <td v-if="queryType !== 'user'"><strong>{{ record.user || '-' }}</strong></td>
            <td v-if="queryType !== 'account'">{{ record.account }}</td>
            <td>{{ record.cluster }}</td>
            <td>{{ record.partition || '-' }}</td>
            <td>
              <span class="qos-badge" :class="getQoSClass(record.qos || 'default')">
                {{ record.qos || '-' }}
              </span>
            </td>
            <td>{{ record.job_count || 1 }}</td>
            <td>{{ formatHours(record.cpu_hours) }}</td>
            <td>{{ formatHours(record.node_hours) }}</td>
            <td>{{ formatHours(record.gpu_hours) }}</td>
            <td>{{ formatHours(record.memory_hours) }}</td>
            <td>
              <span class="state-badge" :class="getStateClass(record.state || record.status)">
                {{ record.state || record.status || 'SUMMARY' }}
              </span>
            </td>
            <td>{{ formatTimeRange(record) }}</td>
          </tr>
        </tbody>
      </table>
      
      <div v-if="filteredRecords.length === 0" class="empty-state">
        <p>暂无数据</p>
        <p class="hint">请调整查询条件后重试</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usageAPI } from '../api'
import notification from '../utils/notification'

const loading = ref(false)
const error = ref('')
const searchText = ref('')

// 查询条件
const queryType = ref('user')
const queryUser = ref('')
const queryAccount = ref('')
const startDate = ref('')
const endDate = ref('')

// 数据
const usageRecords = ref<any[]>([])
const accountUsage = ref<any>(null)
const summary = ref<any>(null)

// 初始化日期
const initDates = () => {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  
  endDate.value = now.toISOString().split('T')[0]
  startDate.value = thirtyDaysAgo.toISOString().split('T')[0]
}

// 查询类型变化
const onQueryTypeChange = () => {
  usageRecords.value = []
  summary.value = null
  error.value = ''
}

// 快速选择时间范围
const onQuickSelect = (event: Event) => {
  const days = parseInt((event.target as HTMLSelectElement).value)
  if (days) {
    const now = new Date()
    const pastDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    
    endDate.value = now.toISOString().split('T')[0]
    startDate.value = pastDate.toISOString().split('T')[0]
  }
}

// 过滤记录
const filteredRecords = computed(() => {
  if (!searchText.value) return usageRecords.value
  
  const search = searchText.value.toLowerCase()
  return usageRecords.value.filter(record => 
    (record.user && record.user.toLowerCase().includes(search)) ||
    (record.account && record.account.toLowerCase().includes(search)) ||
    (record.partition && record.partition.toLowerCase().includes(search)) ||
    (record.qos && record.qos.toLowerCase().includes(search))
  )
})

// 查询使用情况
const queryUsage = async () => {
  if (queryType.value === 'user' && !queryUser.value) {
    notification.error('请输入用户名')
    return
  }
  
  if (queryType.value === 'account' && !queryAccount.value) {
    notification.error('请输入账户名')
    return
  }
  
  if (!startDate.value || !endDate.value) {
    notification.error('请选择时间范围')
    return
  }

  loading.value = true
  error.value = ''
  
  try {
    let response
    
    if (queryType.value === 'user') {
      // 获取用户使用情况
      response = await usageAPI.getUserUsage(queryUser.value, startDate.value, endDate.value)
      usageRecords.value = response.data
      
      // 获取用户汇总
      const summaryResponse = await usageAPI.getUsageSummary(queryUser.value, '', startDate.value, endDate.value)
      summary.value = summaryResponse.data
      
    } else if (queryType.value === 'account') {
      // 获取账户机时使用情况（包含 billing 限制）
      const accountResponse = await usageAPI.getAccountUsage(queryAccount.value, startDate.value, endDate.value)
      accountUsage.value = accountResponse.data
      
      // 对于账户查询，显示账户汇总信息而不是详细记录
      usageRecords.value = accountUsage.value ? [accountUsage.value] : []
      
      // 设置汇总数据
      if (accountUsage.value) {
        summary.value = {
          total_jobs: accountUsage.value.job_count,
          total_cpu_hours: accountUsage.value.cpu_hours,
          total_node_hours: accountUsage.value.node_hours,
          total_gpu_hours: accountUsage.value.gpu_hours,
          total_memory_hours: accountUsage.value.memory_hours,
          period: `${startDate.value} - ${endDate.value}`
        }
      }
      
    } else if (queryType.value === 'cluster') {
      // 获取集群使用情况
      const clusterResponse = await usageAPI.getAllAccountsUsage(startDate.value, endDate.value)
      
      // 转换为数组格式
      const clusterData = clusterResponse.data
      usageRecords.value = Object.values(clusterData)
      
      // 计算总汇总
      summary.value = {
        total_jobs: usageRecords.value.reduce((sum, record) => sum + (record.job_count || 0), 0),
        total_cpu_hours: usageRecords.value.reduce((sum, record) => sum + (record.cpu_hours || 0), 0),
        total_node_hours: usageRecords.value.reduce((sum, record) => sum + (record.node_hours || 0), 0),
        total_gpu_hours: usageRecords.value.reduce((sum, record) => sum + (record.gpu_hours || 0), 0),
        total_memory_hours: usageRecords.value.reduce((sum, record) => sum + (record.memory_hours || 0), 0),
        period: `${startDate.value} - ${endDate.value}`
      }
    }
    
    notification.success('查询完成')
    
  } catch (err: any) {
    console.error('Query usage error:', err)
    error.value = err.response?.data?.error || err.message || '查询失败'
  } finally {
    loading.value = false
  }
}

// 刷新数据
const refreshData = () => {
  if (usageRecords.value.length > 0) {
    queryUsage()
  }
}

// 导出数据
const exportData = () => {
  if (usageRecords.value.length === 0) {
    notification.warning('暂无数据可导出')
    return
  }
  
  // 构建 CSV 数据
  const headers = ['用户', '账户', '集群', '分区', 'QoS', '作业数', 'CPU小时', '节点小时', 'GPU小时', '内存小时', '状态']
  const csvData = [
    headers.join(','),
    ...usageRecords.value.map(record => [
      record.user || '',
      record.account || '',
      record.cluster || '',
      record.partition || '',
      record.qos || '',
      record.job_count || record.total_jobs || 1,
      record.cpu_hours || record.total_cpu_hours || 0,
      record.node_hours || record.total_node_hours || 0,
      record.gpu_hours || record.total_gpu_hours || 0,
      record.memory_hours || record.total_memory_hours || 0,
      record.state || 'SUMMARY'
    ].join(','))
  ].join('\n')
  
  // 下载文件
  const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `usage_report_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  notification.success('数据导出成功')
}

// 格式化小时数
const formatHours = (hours: number): string => {
  if (!hours || hours === 0) return '0'
  if (hours < 1) return hours.toFixed(2)
  return hours.toFixed(1)
}

// 格式化时间范围
const formatTimeRange = (record: any): string => {
  if (record.period) return record.period
  if (record.start_time && record.end_time) {
    const start = new Date(record.start_time).toLocaleDateString()
    const end = new Date(record.end_time).toLocaleDateString()
    return `${start} - ${end}`
  }
  if (record.last_updated) {
    return `截至 ${new Date(record.last_updated).toLocaleDateString()}`
  }
  return `${startDate.value} - ${endDate.value}`
}

// 获取记录键
const getRecordKey = (record: any): string => {
  return `${record.user || 'unknown'}-${record.account || 'unknown'}-${record.partition || 'unknown'}-${record.qos || 'unknown'}`
}

// 获取 QoS 样式
const getQoSClass = (qos: string): string => {
  switch (qos?.toLowerCase()) {
    case 'high': return 'qos-high'
    case 'normal': return 'qos-normal'
    case 'low': return 'qos-low'
    default: return 'qos-default'
  }
}

// 获取状态样式
const getStateClass = (state: string): string => {
  switch (state?.toUpperCase()) {
    case 'RUNNING': return 'state-running'
    case 'COMPLETED': return 'state-completed'
    case 'FAILED': return 'state-failed'
    case 'CANCELLED': return 'state-cancelled'
    case 'TIMEOUT': return 'state-timeout'
    default: return 'state-default'
  }
}

// 格式化分钟数为小时
const formatMinutes = (minutes: number): string => {
  if (!minutes || minutes === 0) return '0 小时'
  const hours = minutes / 60
  if (hours < 1) return `${minutes} 分钟`
  return `${hours.toFixed(1)} 小时`
}

// 获取计费状态样式
const getBillingStatusClass = (status: string): string => {
  switch (status?.toUpperCase()) {
    case 'NORMAL': return 'billing-normal'
    case 'WARNING': return 'billing-warning'
    case 'EXCEEDED': return 'billing-exceeded'
    default: return 'billing-normal'
  }
}

// 获取计费状态文本
const getBillingStatusText = (status: string): string => {
  switch (status?.toUpperCase()) {
    case 'NORMAL': return '正常'
    case 'WARNING': return '警告'
    case 'EXCEEDED': return '超额'
    default: return '正常'
  }
}

onMounted(() => {
  initDates()
})
</script>

<style scoped>
.usage-management {
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
  gap: 1rem;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  margin-bottom: 2rem;
}

.card h4 {
  margin: 0 0 1rem 0;
  color: #374151;
}

.query-panel {
  margin-bottom: 2rem;
}

.query-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  align-items: end;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #374151;
}

.form-group input,
.form-group select {
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}

.summary-item {
  text-align: center;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
}

.summary-label {
  font-size: 0.9rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.summary-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.table-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.search-input {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  width: 250px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  background: #f9fafb;
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #555;
  border-bottom: 2px solid #e5e7eb;
}

.data-table td {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.data-table tbody tr:hover {
  background: #f9fafb;
}

.qos-badge,
.state-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.qos-high {
  background: #fef3c7;
  color: #92400e;
}

.qos-normal {
  background: #dbeafe;
  color: #1e40af;
}

.qos-low {
  background: #e5e7eb;
  color: #374151;
}

.qos-default {
  background: #f3f4f6;
  color: #6b7280;
}

.state-running {
  background: #dcfce7;
  color: #15803d;
}

.state-completed {
  background: #dbeafe;
  color: #1d4ed8;
}

.state-failed {
  background: #fee2e2;
  color: #b91c1c;
}

.state-cancelled {
  background: #f1f5f9;
  color: #64748b;
}

.state-timeout {
  background: #fce7f3;
  color: #9d174d;
}

.state-default {
  background: #f3f4f6;
  color: #6b7280;
}

.billing-status {
  margin-bottom: 1rem;
}

.billing-card {
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
  background: white;
}

.billing-card.billing-normal {
  border-color: #10b981;
  background: #f0fdf4;
}

.billing-card.billing-warning {
  border-color: #f59e0b;
  background: #fffbeb;
}

.billing-card.billing-exceeded {
  border-color: #ef4444;
  background: #fef2f2;
}

.billing-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.billing-header h5 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.status-badge.billing-normal {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.billing-warning {
  background: #fef3c7;
  color: #92400e;
}

.status-badge.billing-exceeded {
  background: #fee2e2;
  color: #991b1b;
}

.billing-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.billing-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.billing-item .label {
  font-weight: 500;
  color: #6b7280;
}

.billing-item .value {
  font-weight: 600;
  color: #1f2937;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.progress-fill.billing-normal {
  background: #10b981;
}

.progress-fill.billing-warning {
  background: #f59e0b;
}

.progress-fill.billing-exceeded {
  background: #ef4444;
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

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #6b7280;
}

.empty-state .hint {
  margin-top: 0.5rem;
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .table-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .search-input {
    width: 100%;
  }
}
</style>