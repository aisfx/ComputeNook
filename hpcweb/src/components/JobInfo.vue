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
                  class="btn-link" 
                  v-if="job.status === 'RUNNING' && canControlJob(job)"
                  @click="pauseJob(job)"
                  title="暂停作业"
                >
                  ⏸️ 暂停
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
    <div class="pagination" v-if="filteredJobs.length > 0">
      <span class="pagination-info">
        共 {{ filteredJobs.length }} 个作业
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getUser, isAdmin } from '../utils/auth'
import notification from '../utils/notification'
// import { jobAPI } from '../api' // TODO: 取消注释以启用真实API调用

const emit = defineEmits(['view-detail'])

const viewMode = ref<'my' | 'all'>('my')
const statusFilter = ref('')
const partitionFilter = ref('')
const currentUserInfo = ref<any>(null)
const currentUser = computed(() => currentUserInfo.value?.username || '')
const loading = ref(false)
const error = ref('')

const summary = ref({
  running: 3,
  pending: 1,
  completed: 15,
  failed: 2
})

const allJobs = ref([
  { 
    id: '12345', 
    name: 'simulation_job', 
    status: 'RUNNING', 
    partition: 'compute', 
    nodes: 4,
    cpus: 32,
    submitTime: '2026-02-14 10:30',
    runTime: '2h 15m',
    directory: '/home/admin/jobs/simulation_job',
    user: 'admin'
  },
  { 
    id: '12346', 
    name: 'data_process', 
    status: 'PENDING', 
    partition: 'gpu', 
    nodes: 1,
    cpus: 8,
    submitTime: '2026-02-14 11:00',
    runTime: '-',
    directory: '/home/admin/jobs/data_process',
    user: 'admin'
  },
  { 
    id: '12347', 
    name: 'ml_training', 
    status: 'RUNNING', 
    partition: 'gpu', 
    nodes: 2,
    cpus: 16,
    submitTime: '2026-02-14 09:30',
    runTime: '3h 45m',
    directory: '/home/user01/jobs/ml_training',
    user: 'user01'
  },
  { 
    id: '12348', 
    name: 'cfd_analysis', 
    status: 'RUNNING', 
    partition: 'compute', 
    nodes: 8,
    cpus: 128,
    submitTime: '2026-02-14 08:00',
    runTime: '5h 20m',
    directory: '/home/user02/jobs/cfd_analysis',
    user: 'user02'
  },
  { 
    id: '12344', 
    name: 'quantum_calc', 
    status: 'COMPLETED', 
    partition: 'compute', 
    nodes: 2,
    cpus: 32,
    submitTime: '2026-02-14 06:00',
    runTime: '4h 30m',
    directory: '/home/admin/jobs/quantum_calc',
    user: 'admin'
  },
  { 
    id: '12343', 
    name: 'test_job', 
    status: 'FAILED', 
    partition: 'debug', 
    nodes: 1,
    cpus: 4,
    submitTime: '2026-02-14 11:30',
    runTime: '0h 5m',
    directory: '/home/user03/jobs/test_job',
    user: 'user03'
  },
  { 
    id: '12342', 
    name: 'deep_learning', 
    status: 'PENDING', 
    partition: 'gpu', 
    nodes: 1,
    cpus: 16,
    submitTime: '2026-02-14 11:45',
    runTime: '-',
    directory: '/home/user01/jobs/deep_learning',
    user: 'user01'
  }
])

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

const pauseJob = async (job: any) => {
  if (notification.confirmAction('暂停作业', `${job.id} - ${job.name}`)) {
    console.log('暂停作业:', job.id)
    
    // TODO: 取消下面的注释以启用真实API调用
    /*
    try {
      await jobAPI.pauseJob(job.id)
      notification.success(`作业 ${job.id} 已暂停`)
      await loadJobs() // 重新加载作业列表
    } catch (err: any) {
      notification.error(err.response?.data?.error || '暂停作业失败')
    }
    */
    
    notification.success(`作业 ${job.id} 已暂停`)
  }
}

const cancelJob = async (job: any) => {
  if (notification.confirm({
    title: '取消作业',
    message: `确定要取消作业 ${job.id} - ${job.name} 吗？\n\n此操作不可恢复。`
  })) {
    console.log('取消作业:', job.id)
    
    // TODO: 取消下面的注释以启用真实API调用
    /*
    try {
      await jobAPI.cancelJob(job.id)
      notification.success(`作业 ${job.id} 已取消`)
      await loadJobs() // 重新加载作业列表
    } catch (err: any) {
      notification.error(err.response?.data?.error || '取消作业失败')
    }
    */
    
    notification.success(`作业 ${job.id} 已取消`)
  }
}

const openDirectory = (job: any) => {
  console.log('打开作业目录:', job.directory)
  notification.info(`作业目录：\n${job.directory}`, '打开作业目录')
}

const loadJobs = async () => {
  console.log('刷新作业列表')
  
  // TODO: 取消下面的注释以启用真实API调用
  /*
  loading.value = true
  error.value = ''
  
  try {
    const username = viewMode.value === 'my' ? currentUser.value : undefined
    const response = await jobAPI.getJobs(username)
    allJobs.value = response
    updateSummary()
  } catch (err: any) {
    error.value = err.response?.data?.error || '加载作业列表失败'
    console.error('Failed to load jobs:', err)
  } finally {
    loading.value = false
  }
  */
  
  // 当前使用模拟数据
  updateSummary()
  notification.success('作业列表已刷新')
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
  
  // TODO: 取消下面的注释以在页面加载时自动获取作业列表
  // loadJobs()
  
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
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.pagination-info {
  font-size: 0.9rem;
  color: #666;
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
