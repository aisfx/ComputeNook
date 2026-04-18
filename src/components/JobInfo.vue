<template>
  <div class="card">
    <div class="jobs-header">
      <h3>📊 作业管理</h3>
      <div class="header-controls">
        <div class="view-toggle" v-if="currentUserInfo?.isAdmin">
          <button 
            :class="['toggle-btn', { active: viewMode === 'my' }]"
            @click="viewMode = 'my'"
          >
            👤 我的作业
          </button>
          <button 
            :class="['toggle-btn', { active: viewMode === 'all' }]"
            @click="viewMode = 'all'"
          >
            🌐 所有作业
          </button>
        </div>
        <div class="view-toggle" v-else>
          <div class="current-view-label">
            👤 我的作业
          </div>
        </div>
        <div class="filters">
          <select v-model="statusFilter" class="filter-select">
            <option value="">全部状态</option>
            <option value="RUNNING">运行中</option>
            <option value="PENDING">等待中</option>
            <option value="COMPLETED">已完成</option>
            <option value="FAILED">失败</option>
          </select>
          <select v-model="partitionFilter" class="filter-select">
            <option value="">全部分区</option>
            <option value="compute">compute</option>
            <option value="gpu">gpu</option>
            <option value="memory">memory</option>
            <option value="debug">debug</option>
          </select>
          <button class="btn-secondary" @click="loadJobs">🔄 刷新</button>
        </div>
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
            <th>作业 ID</th>
            <th v-if="viewMode === 'all'">用户</th>
            <th>作业名称</th>
            <th>状态</th>
            <th>分区</th>
            <th>节点/CPU</th>
            <th>提交时间</th>
            <th>运行时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="job in filteredJobs" :key="job.id">
            <td><code>{{ job.id }}</code></td>
            <td v-if="viewMode === 'all'">{{ job.user }}</td>
            <td>{{ job.name }}</td>
            <td><span :class="['status', `status-${job.status.toLowerCase()}`]">{{ job.status }}</span></td>
            <td>{{ job.partition }}</td>
            <td>{{ job.nodes }}N / {{ job.cpus }}C</td>
            <td>{{ job.submitTime }}</td>
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

      <div v-if="filteredJobs.length === 0" class="empty-state">
        <div class="empty-icon">📭</div>
        <p>暂无作业数据</p>
      </div>
    </div>

    <!-- 分页 -->
    <div class="pagination" v-if="pagination.total > 0">
      <button 
        class="btn-secondary" 
        :disabled="pagination.page <= 1"
        @click="changePage(pagination.page - 1)"
      >
        « 上一页
      </button>
      
      <span class="pagination-info">
        第{{ pagination.page }} / {{ pagination.totalPages }} 页，共{{ pagination.total }} 个作业
      </span>
      
      <button 
        class="btn-secondary" 
        :disabled="pagination.page >= pagination.totalPages"
        @click="changePage(pagination.page + 1)"
      >
        下一页 »
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getUser, getApiBase, isAdmin } from '../utils/auth'
import notification from '../utils/notification'
// import { jobAPI } from '../api' // TODO: 取消注释以启用真实API调用

const emit = defineEmits(['view-detail', 'open-directory'])

const viewMode = ref<'my' | 'all'>('my')
const statusFilter = ref('')
const partitionFilter = ref('')
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
const pagination = ref({
  page: 1,
  pageSize: 15,
  total: 0,
  totalPages: 0
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

const loadJobs = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) {
      throw new Error('请先登录系统')
    }
    
    // 构建 API URL
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
        
        // 解析节点数量
        let nodeCount = 0
        if (typeof job.nodes === 'number') {
          nodeCount = job.nodes
        } else if (typeof job.nodes === 'string' && job.nodes) {
          // 节点字符串可能是 "node01,node02" 或 "node[01-04]" 或 "cn1"
          if (job.nodes === 'None assigned' || job.nodes === '') {
            nodeCount = 0
          } else {
            const nodeList = job.nodes.split(',')
            nodeCount = nodeList.length
          }
        }
        
        return {
          id: job.job_id || job.id,
          user: job.user_name || job.user,
          name: job.name || `Job ${job.job_id || job.id}`,
          status: job.job_state || job.status || 'UNKNOWN',
          partition: job.partition || '-',
          nodes: nodeCount,
          cpus: job.cpus || 0,
          submitTime: formatTime(job.submit_time),
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
  // 获取当前用户信息
  currentUserInfo.value = getUser()
  
  // 如果不是管理员，强制显示"我的作业"
  if (!isAdmin()) {
    viewMode.value = 'my'
  }
  
  // 更新统计数据
  updateSummary()
  
  // 自动加载作业列表
  loadJobs()
  
  console.log('当前用户:', currentUser.value, '是否管理员:', currentUserInfo.value?.isAdmin)
})
</script>

<style scoped>
.jobs-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  gap: 1rem;
}

.jobs-header h3 {
  margin: 0;
}

.header-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: flex-end;
}

.view-toggle {
  display: flex;
  gap: 0.5rem;
  background: #f9fafb;
  padding: 0.25rem;
  border-radius: 8px;
}

.toggle-btn {
  padding: 0.625rem 1.5rem;
  border: none;
  background: transparent;
  color: #666;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.3s;
  white-space: nowrap;
}

.toggle-btn:hover {
  background: #e5e7eb;
}

.toggle-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.current-view-label {
  padding: 0.625rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 0.95rem;
  font-weight: 600;
  border-radius: 6px;
  white-space: nowrap;
}

.filters {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.filter-select {
  padding: 0.5rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
  background: white;
}

.filter-select:focus {
  outline: none;
  border-color: #667eea;
}

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

.summary-value.running { color: #3b82f6; }
.summary-value.pending { color: #f59e0b; }
.summary-value.completed { color: #10b981; }
.summary-value.failed { color: #ef4444; }

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
  color: #ef4444;
}

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
  gap: 1rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.pagination-info {
  font-size: 0.9rem;
  color: #666;
}

.pagination .btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
