<template>
  <div class="card">
    <div class="jobs-header">
      <div class="header-left">
        <h3>作业管理</h3>
        <div class="view-tabs">
          <button :class="['view-tab', { active: viewMode === 'my' }]" @click="viewMode = 'my'">我的作业</button>
          <button v-if="currentUserInfo?.isAdmin" :class="['view-tab', { active: viewMode === 'all' }]" @click="viewMode = 'all'">所有作业</button>
        </div>
      </div>
      <div class="header-right">
        <select v-model="statusFilter" class="filter-select" @change="pagination.page = 1">
          <option value="">全部状态</option>
          <option value="RUNNING">运行中</option>
          <option value="PENDING">等待中</option>
          <option value="COMPLETED">已完成</option>
          <option value="FAILED">失败</option>
        </select>
        <select v-model="partitionFilter" class="filter-select" @change="pagination.page = 1">
          <option value="">全部分区</option>
          <option v-for="p in partitions" :key="p" :value="p">{{ p }}</option>
        </select>
        <button class="btn-query" @click="() => { pagination.page = 1; loadJobs() }" :disabled="loading">
          {{ loading ? '查询中...' : '查询' }}
        </button>
        <button class="btn-icon-round" @click="() => { pagination.page = 1; loadJobs() }" title="刷新">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
        </button>
        <button class="btn-submit-job" @click="emit('submit-job')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          提交作业
        </button>
      </div>
    </div>

    <!-- 统计卡片 (仅在"我的作业"模式显示) -->
    <div v-if="viewMode === 'my'" class="job-summary">
      <div class="summary-item">
        <span class="summary-label">运行中</span>
        <span class="summary-value running">{{ summary.running }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">等待中</span>
        <span class="summary-value pending">{{ summary.pending }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">今日完成</span>
        <span class="summary-value completed">{{ summary.completed }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">失败</span>
        <span class="summary-value failed">{{ summary.failed }}</span>
      </div>
    </div>

    <!-- 作业列表 -->
    <div class="table-container">
      <table class="jobs-table">
        <thead>
          <tr>
            <th>作业ID</th>
            <th v-if="viewMode === 'all'">用户</th>
            <th>作业名称</th>
            <th>状态</th>
            <th>分区</th>
            <th>核心数</th>
            <th>提交时间</th>
            <th>开始时间</th>
            <th>运行时长</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(job, index) in filteredJobs" :key="job.id">
            <td><strong>{{ job.id }}</strong></td>
            <td v-if="viewMode === 'all'">{{ job.user }}</td>
            <td>{{ job.name }}</td>
            <td><span :class="['status', `status-${job.status.toLowerCase()}`]">{{ job.status }}</span></td>
            <td>{{ job.partition }}</td>
            <td>{{ job.cpus }}核</td>
            <td>{{ job.submitTime }}</td>
            <td>{{ job.startTime }}</td>
            <td>{{ job.runTime }}</td>
            <td>
              <div class="action-buttons">
                <button class="btn-link" @click="$emit('view-detail', job)" title="查看详情">
                  📋 详情
                </button>
                <button 
                  class="btn-link danger" 
                  v-if="(job.status === 'RUNNING' || job.status === 'PENDING') && canControlJob(job)"
                  @click="cancelJob(job)"
                  title="取消作业"
                >
                  ❌ 取消
                </button>
                <button 
                  class="btn-link" 
                  @click="openDirectory(job)"
                  title="打开作业目录"
                >
                  📁 目录
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="loading" class="empty-state">
        <div class="empty-icon">⏳</div>
        <p>查询中...</p>
      </div>
      <div v-else-if="!queried" class="empty-state">
        <div class="empty-icon">🔍</div>
        <p>选择条件后点击查询</p>
      </div>
      <div v-else-if="filteredJobs.length === 0" class="empty-state">
        <div class="empty-icon">📭</div>
        <p>暂无作业数据</p>
      </div>
    </div>

    <!-- 分页 -->
    <div class="pagination" v-if="pagination.total > 0">
      <button 
        class="page-btn" 
        :disabled="pagination.page <= 1"
        @click="changePage(pagination.page - 1)"
      >
        ‹ 上一页
      </button>

      <div class="page-numbers">
        <button
          v-for="p in pageRange"
          :key="p"
          class="page-num"
          :class="{ active: p === pagination.page, ellipsis: p === '...' }"
          :disabled="p === '...'"
          @click="p !== '...' && changePage(p as number)"
        >{{ p }}</button>
      </div>

      <button 
        class="page-btn" 
        :disabled="pagination.page >= pagination.totalPages"
        @click="changePage(pagination.page + 1)"
      >
        下一页 ›
      </button>

      <span class="pagination-info">共 {{ pagination.total }} 个作业</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getUser, getApiBase, isAdmin } from '../utils/auth'
import notification from '../utils/notification'
// import { jobAPI } from '../api' // TODO: 取消注释以启用真实API调用

const emit = defineEmits(['view-detail', 'open-directory', 'submit-job'])

const viewMode = ref<'my' | 'all'>('my')
const statusFilter = ref('')
const partitionFilter = ref('')
const partitions = ref<string[]>([])
const currentUserInfo = ref<any>(null)
const currentUser = computed(() => currentUserInfo.value?.username || '')
const loading = ref(false)
const error = ref('')

const summary = ref({
  running: 0,
  pending: 0,
  completed: 0,
  failed: 0
})

const allJobs = ref<any[]>([])
const queried = ref(true)
const pagination = ref({
  page: 1,
  pageSize: 15,
  total: 0,
  totalPages: 0
})

const pageRange = computed(() => {
  const cur = pagination.value.page
  const total = pagination.value.totalPages
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | string)[] = [1]
  if (cur > 3) pages.push('...')
  for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i)
  if (cur < total - 2) pages.push('...')
  pages.push(total)
  return pages
})

const filteredJobs = computed(() => {
  let jobs = allJobs.value

  // 根据视图模式筛选
  if (viewMode.value === 'my') {
    jobs = jobs.filter(job => job.user === currentUser.value)
  }

  // 根据状态筛选
  if (statusFilter.value) {
    jobs = jobs.filter(job => job.status === statusFilter.value)
  }

  // 根据分区筛选
  if (partitionFilter.value) {
    jobs = jobs.filter(job => job.partition === partitionFilter.value)
  }

  return jobs
})

// 更新统计数据
const updateSummary = () => {
  const myJobs = allJobs.value.filter(job => job.user === currentUser.value)
  const today = new Date().toISOString().split('T')[0]
  
  summary.value = {
    running: myJobs.filter(job => job.status === 'RUNNING').length,
    pending: myJobs.filter(job => job.status === 'PENDING').length,
    completed: myJobs.filter(job => 
      job.status === 'COMPLETED' && 
      job.submitTime.startsWith(today.replace(/-/g, '-'))
    ).length,
    failed: myJobs.filter(job => job.status === 'FAILED').length
  }
}

const canControlJob = (job: any) => {
  // 管理员可以控制所有作业，普通用户只能控制自己的作业
  return currentUserInfo.value?.isAdmin || job.user === currentUser.value
}

const cancelJob = async (job: any) => {
  const confirmed = confirm(`取消作业\n\n确定要取消作业 ${job.id} - ${job.name} 吗？\n\n此操作不可恢复。`)
  
  if (!confirmed) {
    return
  }
  
  console.log('取消作业:', job.id)
  
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) {
      throw new Error('请先登录系统')
    }
    
    const response = await fetch(`${getApiBase()}/api/jobs/${job.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || '取消作业失败')
    }
    
    notification.success('作业取消成功')
    await loadJobs() // 重新加载作业列表
  } catch (err: any) {
    notification.error(err.message || '取消作业失败')
  }
}

const openDirectory = (job: any) => {
  if (!job.directory || job.directory === '-') {
    notification.error('作业目录不可用')
    return
  }
  
  console.log('打开作业目录:', job.directory)
  
  // 触发事件，通知父组件切换到文件管理并打开指定目录
  emit('open-directory', job.directory)
}

// 展开 Slurm hostlist 格式，如 cn[0-3,5] → ['cn0','cn1','cn2','cn3','cn5']
// 支持多组：mn0,cn[0-1] → ['mn0','cn0','cn1']
const expandHostList = (hostlist: string): string[] => {
  const result: string[] = []
  // 先按逗号分割，但要跳过括号内的逗号
  const parts: string[] = []
  let depth = 0, cur = ''
  for (const ch of hostlist) {
    if (ch === '[') { depth++; cur += ch }
    else if (ch === ']') { depth--; cur += ch }
    else if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = '' }
    else { cur += ch }
  }
  if (cur.trim()) parts.push(cur.trim())

  for (const part of parts) {
    const m = part.match(/^(.*?)\[([^\]]+)\](.*)$/)
    if (!m) {
      if (part) result.push(part)
      continue
    }
    const prefix = m[1], ranges = m[2], suffix = m[3]
    for (const seg of ranges.split(',')) {
      const range = seg.trim()
      const dash = range.match(/^(\d+)-(\d+)$/)
      if (dash) {
        const from = parseInt(dash[1]), to = parseInt(dash[2])
        const pad = dash[1].length > 1 ? dash[1].length : 0
        for (let i = from; i <= to; i++) {
          result.push(prefix + (pad ? String(i).padStart(pad, '0') : i) + suffix)
        }
      } else {
        result.push(prefix + range + suffix)
      }
    }
  }
  return result
}

const getTodayRange = () => {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  return {
    start: Math.floor(startOfDay.getTime() / 1000),
    end: Math.floor(endOfDay.getTime() / 1000)
  }
}

const loadJobs = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) {
      throw new Error('请先登录系统')
    }
    
    // 构建 API URL，不传时间范围，让后端返回所有作业（含运行中）
    let url = `${getApiBase()}/api/jobs?page=${pagination.value.page}&page_size=${pagination.value.pageSize}`
    
    // 如果是"我的作业"模式，添加用户名参数
    if (viewMode.value === 'my') {
      url += `&user=${encodeURIComponent(currentUser.value)}`
    }
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (!response.ok) {
      // 静默处理错误，不显示提示
      console.error('Failed to fetch jobs:', response.status, response.statusText)
      allJobs.value = []
      updateSummary()
      return
    }
    
    const result = await response.json()
    
    // 处理返回的数据
    if (result.data && Array.isArray(result.data)) {
      allJobs.value = result.data.map((job: any) => {
        // 计算运行时间
        let runTime = 0
        if (job.end_time && job.start_time && job.end_time > 0 && job.start_time > 0) {
          // 已完成的作业
          runTime = job.end_time - job.start_time
        } else if (job.start_time && job.start_time > 0) {
          // 正在运行的作业
          runTime = Math.floor(Date.now() / 1000) - job.start_time
        }
        
        // 解析节点数量和节点名称列表（支持 Slurm hostlist 格式，如 cn[0-3,5]）
        let nodeCount = 0
        let nodeNames: string[] = []
        if (typeof job.nodes === 'number') {
          nodeCount = job.nodes
        } else if (typeof job.nodes === 'string' && job.nodes) {
          if (job.nodes === 'None assigned' || job.nodes === '') {
            nodeCount = 0
          } else {
            nodeNames = expandHostList(job.nodes)
            nodeCount = nodeNames.length || 1
          }
        }
        // batch_host 是单节点作业的运行节点
        if (nodeNames.length === 0 && job.batch_host) {
          nodeNames = [job.batch_host]
          nodeCount = 1
        }
        
        return {
          id: job.job_id || job.id,
          user: job.user_name || job.user,
          name: job.name || `Job ${job.job_id || job.id}`,
          status: job.job_state || job.status || 'UNKNOWN',
          partition: job.partition || '-',
          nodes: nodeCount,
          nodeNames,
          cpus: job.cpus || 0,
          submitTime: formatTime(job.submit_time),
          startTime: formatTime(job.start_time),
          start_time: job.start_time || 0,
          runTime: formatDuration(runTime),
          directory: job.work_dir || job.directory || '-',
          account: job.account || '-',
          timeLimit: job.time_limit || 0
        }
      })
      
      // 更新分页信息
      if (result.pagination) {
        pagination.value = {
          page: result.pagination.page,
          pageSize: result.pagination.page_size,
          total: result.pagination.total,
          totalPages: result.pagination.total_pages
        }
      }
    } else {
      allJobs.value = []
    }
    
    updateSummary()
  } catch (err: any) {
    // 静默处理错误，只在控制台输出
    console.error('Failed to load jobs:', err)
    allJobs.value = []
    updateSummary()
  } finally {
    loading.value = false
    queried.value = true
  }
}

// 切换页码
const changePage = (newPage: number) => {
  if (newPage >= 1 && newPage <= pagination.value.totalPages) {
    pagination.value.page = newPage
    loadJobs()
  }
}

// 格式化时间
const formatTime = (timestamp: any): string => {
  if (!timestamp || timestamp === 0) return '-'
  
  try {
    // Unix 时间戳（秒）转换为毫秒
    const date = new Date(timestamp * 1000)
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) return '-'
    
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).replace(/\//g, '-')
  } catch {
    return '-'
  }
}

// 格式化持续时间
const formatDuration = (seconds: any): string => {
  if (!seconds || seconds === 0 || seconds < 0) return '-'
  
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (days > 0) {
    return `${days}天${hours}时${minutes}分`
  } else if (hours > 0) {
    return `${hours}时${minutes}分`
  } else if (minutes > 0) {
    return `${minutes}分`
  } else {
    return `${seconds}秒`
  }
}

// 初始化
onMounted(() => {
  currentUserInfo.value = getUser()
  if (!isAdmin()) {
    viewMode.value = 'my'
  }
  loadPartitions()
  // 自动加载当天作业
  loadJobs()
})

const loadPartitions = async () => {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) return
    const res = await fetch(`${getApiBase()}/api/jobs/partitions/list`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) return
    const result = await res.json()
    partitions.value = (result.data || []).map((p: any) => p.name).filter(Boolean)
  } catch {
    // 加载失败时使用默认值
    partitions.value = ['compute', 'gpu', 'memory', 'debug']
  }
}
</script>

<style scoped>
.jobs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.jobs-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
}

.view-tabs {
  display: flex;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}

.view-tab {
  padding: 5px 14px;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s;
  white-space: nowrap;
}
.view-tab:hover { color: #374151; }
.view-tab.active {
  background: #fff;
  color: #1e293b;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-select {
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.82rem;
  cursor: pointer;
  background: #fff;
  color: #374151;
  outline: none;
  transition: border-color 0.15s;
  height: 32px;
}
.filter-select:focus { border-color: #667eea; }

.btn-icon-round {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  color: #64748b;
  transition: all 0.2s;
  flex-shrink: 0;
}
.btn-icon-round:hover { background: #e2e8f0; color: #374151; }
.btn-icon-round:hover svg { transform: rotate(180deg); }
.btn-icon-round svg { transition: transform 0.3s; }

.btn-query {
  display: inline-flex;
  align-items: center;
  padding: 0 14px;
  height: 32px;
  background: #fff;
  color: #1e293b;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: all 0.15s;
}
.btn-query:hover:not(:disabled) { background: #f1f5f9; }
.btn-query:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-submit-job {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 14px;
  height: 32px;
  background: #fff;
  color: #1e293b;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: all 0.15s;
}
.btn-submit-job:hover { background: #f1f5f9; }

.job-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.summary-item {
  text-align: center;
  padding: 1.5rem;
  background: #f9fafb;
  border-radius: 8px;
}

.summary-label {
  display: block;
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.summary-value {
  display: block;
  font-size: 2.5rem;
  font-weight: 700;
}

.summary-value.running { color: #16a34a; }
.summary-value.pending { color: #d97706; }
.summary-value.completed { color: #2563eb; }
.summary-value.failed { color: #dc2626; }

.table-container {
  overflow-x: auto;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.action-buttons .btn-link {
  white-space: nowrap;
  font-size: 0.85rem;
}

.btn-link.danger {
  color: #dc2626;
}

/* 状态 badge */
.status {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.status-running   { background: #dcfce7; color: #15803d; }
.status-pending   { background: #fef9c3; color: #a16207; }
.status-completed { background: #dbeafe; color: #1d4ed8; }
.status-failed    { background: #fee2e2; color: #b91c1c; }
.status-cancelled { background: #f1f5f9; color: #64748b; }
.status-timeout   { background: #fce7f3; color: #9d174d; }
.status-unknown   { background: #f3f4f6; color: #6b7280; }


.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #999;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid #e5e7eb;
}

.page-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  color: #374151;
  font-size: 0.83rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.page-btn:hover:not(:disabled) {
  background: #f1f5f9;
  border-color: #94a3b8;
}
.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-numbers {
  display: flex;
  gap: 4px;
}

.page-num {
  min-width: 32px;
  height: 32px;
  padding: 0 6px;
  border: 1px solid #e2e8f0;
  border-radius: 7px;
  background: #fff;
  color: #374151;
  font-size: 0.83rem;
  cursor: pointer;
  transition: all 0.15s;
}
.page-num:hover:not(:disabled):not(.active) {
  background: #f1f5f9;
  border-color: #94a3b8;
}
.page-num.active {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  border-color: transparent;
  font-weight: 600;
}
.page-num.ellipsis {
  border: none;
  background: none;
  cursor: default;
  color: #94a3b8;
}

.pagination-info {
  font-size: 0.8rem;
  color: #94a3b8;
  margin-left: 0.5rem;
}

@media (max-width: 1024px) {
  .jobs-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-controls {
    align-items: stretch;
  }

  .filters {
    flex-wrap: wrap;
  }

  .job-summary {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .job-summary {
    grid-template-columns: 1fr;
  }

  .view-toggle {
    width: 100%;
  }

  .toggle-btn {
    flex: 1;
  }
}
</style>
