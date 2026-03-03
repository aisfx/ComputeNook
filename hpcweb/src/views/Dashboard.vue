<template>
  <div class="dashboard">
    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">🖥️</div>
        <div class="stat-content">
          <div class="stat-label">计算节点</div>
          <div class="stat-value">{{ stats.nodes }}</div>
          <div class="stat-detail">在线: {{ stats.nodesOnline }}</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">⚡</div>
        <div class="stat-content">
          <div class="stat-label">CPU 核心</div>
          <div class="stat-value">{{ stats.cpuCores }}</div>
          <div class="stat-detail">使用率: {{ stats.cpuUsage }}%</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">🎮</div>
        <div class="stat-content">
          <div class="stat-label">GPU 卡数</div>
          <div class="stat-value">{{ stats.gpuCards }}</div>
          <div class="stat-detail">使用中: {{ stats.gpuInUse }}</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">💾</div>
        <div class="stat-content">
          <div class="stat-label">内存总量</div>
          <div class="stat-value">{{ formatMemory(stats.memory) }}</div>
          <div class="stat-detail">可用: {{ formatMemory(stats.memoryFree) }}</div>
        </div>
      </div>
    </div>

    <!-- 作业统计、存储配额、机时信息 - 饼图展示 -->
    <div class="charts-row">
      <!-- 作业统计饼图 -->
      <div class="card chart-card">
        <h3>📊 作业统计</h3>
        <div class="chart-container">
          <svg class="pie-chart" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="80" fill="none" stroke="#e5e7eb" stroke-width="40"/>
            <circle 
              v-if="jobStats.running > 0"
              cx="100" cy="100" r="80" 
              fill="none" 
              stroke="#3b82f6" 
              stroke-width="40"
              :stroke-dasharray="`${jobStatsPercentages.running * 5.03} 503`"
              :stroke-dashoffset="0"
              transform="rotate(-90 100 100)"
            />
            <circle 
              v-if="jobStats.pending > 0"
              cx="100" cy="100" r="80" 
              fill="none" 
              stroke="#f59e0b" 
              stroke-width="40"
              :stroke-dasharray="`${jobStatsPercentages.pending * 5.03} 503`"
              :stroke-dashoffset="`${-jobStatsPercentages.running * 5.03}`"
              transform="rotate(-90 100 100)"
            />
            <circle 
              v-if="jobStats.completed > 0"
              cx="100" cy="100" r="80" 
              fill="none" 
              stroke="#10b981" 
              stroke-width="40"
              :stroke-dasharray="`${jobStatsPercentages.completed * 5.03} 503`"
              :stroke-dashoffset="`${-(jobStatsPercentages.running + jobStatsPercentages.pending) * 5.03}`"
              transform="rotate(-90 100 100)"
            />
            <circle 
              v-if="jobStats.failed > 0"
              cx="100" cy="100" r="80" 
              fill="none" 
              stroke="#ef4444" 
              stroke-width="40"
              :stroke-dasharray="`${jobStatsPercentages.failed * 5.03} 503`"
              :stroke-dashoffset="`${-(jobStatsPercentages.running + jobStatsPercentages.pending + jobStatsPercentages.completed) * 5.03}`"
              transform="rotate(-90 100 100)"
            />
            <text x="100" y="95" text-anchor="middle" class="chart-total">{{ jobStatsTotal }}</text>
            <text x="100" y="115" text-anchor="middle" class="chart-label">总作业</text>
          </svg>
          <div class="chart-legend">
            <div class="legend-item">
              <span class="legend-color" style="background: #3b82f6"></span>
              <span class="legend-text">运行中: {{ jobStats.running }}</span>
            </div>
            <div class="legend-item">
              <span class="legend-color" style="background: #f59e0b"></span>
              <span class="legend-text">等待中: {{ jobStats.pending }}</span>
            </div>
            <div class="legend-item">
              <span class="legend-color" style="background: #10b981"></span>
              <span class="legend-text">已完成: {{ jobStats.completed }}</span>
            </div>
            <div class="legend-item">
              <span class="legend-color" style="background: #ef4444"></span>
              <span class="legend-text">失败: {{ jobStats.failed }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 存储配额饼图 -->
      <div class="card chart-card">
        <h3>💾 存储配额</h3>
        <div class="chart-container">
          <svg class="pie-chart" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="80" fill="none" stroke="#e5e7eb" stroke-width="40"/>
            <circle 
              cx="100" cy="100" r="80" 
              fill="none" 
              :stroke="storageQuota.capacity.percentage > 90 ? '#ef4444' : storageQuota.capacity.percentage > 80 ? '#f59e0b' : '#667eea'"
              stroke-width="40"
              :stroke-dasharray="`${storageQuota.capacity.percentage * 5.03} 503`"
              stroke-dashoffset="0"
              transform="rotate(-90 100 100)"
            />
            <text x="100" y="95" text-anchor="middle" class="chart-total">{{ storageQuota.capacity.percentage }}%</text>
            <text x="100" y="115" text-anchor="middle" class="chart-label">已使用</text>
          </svg>
          <div class="chart-legend">
            <div class="legend-item">
              <span class="legend-color" :style="{ background: storageQuota.capacity.percentage > 90 ? '#ef4444' : storageQuota.capacity.percentage > 80 ? '#f59e0b' : '#667eea' }"></span>
              <span class="legend-text">已用: {{ storageQuota.capacity.used }}</span>
            </div>
            <div class="legend-item">
              <span class="legend-color" style="background: #e5e7eb"></span>
              <span class="legend-text">总量: {{ storageQuota.capacity.total }}</span>
            </div>
            <div class="legend-item-full">
              <span class="legend-text-small">文件数: {{ storageQuota.files.used.toLocaleString() }} / {{ storageQuota.files.total.toLocaleString() }} ({{ storageQuota.files.percentage }}%)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 机时信息饼图 -->
      <div class="card chart-card">
        <h3>⏱️ 机时信息</h3>
        <div class="chart-container">
          <svg class="pie-chart" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="80" fill="none" stroke="#e5e7eb" stroke-width="40"/>
            <circle 
              cx="100" cy="100" r="80" 
              fill="none" 
              :stroke="machineTime.usageRate > 90 ? '#ef4444' : machineTime.usageRate > 70 ? '#f59e0b' : '#667eea'"
              stroke-width="40"
              :stroke-dasharray="`${machineTime.usageRate * 5.03} 503`"
              stroke-dashoffset="0"
              transform="rotate(-90 100 100)"
            />
            <text x="100" y="95" text-anchor="middle" class="chart-total">{{ machineTime.usageRate }}%</text>
            <text x="100" y="115" text-anchor="middle" class="chart-label">使用率</text>
          </svg>
          <div class="chart-legend">
            <div class="legend-item">
              <span class="legend-color" :style="{ background: machineTime.usageRate > 90 ? '#ef4444' : machineTime.usageRate > 70 ? '#f59e0b' : '#667eea' }"></span>
              <span class="legend-text">已用: {{ machineTime.used }} 核时</span>
            </div>
            <div class="legend-item">
              <span class="legend-color" style="background: #10b981"></span>
              <span class="legend-text">剩余: {{ machineTime.remaining }} 核时</span>
            </div>
            <div class="legend-item-full">
              <span class="legend-text-small">总配额: {{ machineTime.totalQuota }} 核时</span>
            </div>
            <div class="legend-item-full">
              <span class="legend-text-small">有效期: {{ machineTime.expiryDate }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 节点状态 -->
    <div class="card">
      <h3>🖥️ 节点状态</h3>
      <table class="nodes-table">
        <thead>
          <tr>
            <th>节点名称</th>
            <th>状态</th>
            <th>CPU 使用率</th>
            <th>内存使用率</th>
            <th>GPU</th>
            <th>运行作业</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="node in nodes" :key="node.name">
            <td><code>{{ node.name }}</code></td>
            <td><span :class="['status', `status-${node.status}`]">{{ node.statusText }}</span></td>
            <td>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: node.cpuUsage + '%' }"></div>
                <span class="progress-text">{{ node.cpuUsage }}%</span>
              </div>
            </td>
            <td>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: node.memUsage + '%' }"></div>
                <span class="progress-text">{{ node.memUsage }}%</span>
              </div>
            </td>
            <td>{{ node.gpu }}</td>
            <td>{{ node.jobs }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import notification from '../utils/notification'

const stats = ref({
  nodes: 0,
  nodesOnline: 0,
  cpuCores: 0,
  cpuUsage: 0,
  gpuCards: 0,
  gpuInUse: 0,
  memory: 0,
  memoryFree: 0
})

const jobStats = ref({
  running: 0,
  pending: 0,
  completed: 0,
  failed: 0
})

const nodes = ref<any[]>([])

const machineTime = ref({
  totalQuota: 50000,
  used: 32500,
  remaining: 17500,
  usageRate: 65,
  monthUsed: 8200,
  todayUsed: 450,
  expiryDate: '2026-12-31'
})

const storageQuota = ref({
  capacity: {
    used: '3.8 TB',
    total: '5.0 TB',
    available: '1.2 TB',
    percentage: 76
  },
  files: {
    used: 856420,
    total: 1000000,
    available: 143580,
    percentage: 86
  }
})

// 格式化内存显示（自动选择合适的单位）
const formatMemory = (memoryTB: number) => {
  if (!memoryTB || memoryTB === 0) {
    return '0 GB'
  }
  if (memoryTB >= 1) {
    return `${memoryTB.toFixed(1)} TB`
  } else {
    const memoryGB = memoryTB * 1024
    return `${memoryGB.toFixed(1)} GB`
  }
}

// 计算作业统计百分比
const jobStatsTotal = computed(() => {
  return jobStats.value.running + jobStats.value.pending + 
         jobStats.value.completed + jobStats.value.failed
})

const jobStatsPercentages = computed(() => {
  const total = jobStatsTotal.value
  if (total === 0) {
    return { running: 0, pending: 0, completed: 0, failed: 0 }
  }
  return {
    running: (jobStats.value.running / total) * 100,
    pending: (jobStats.value.pending / total) * 100,
    completed: (jobStats.value.completed / total) * 100,
    failed: (jobStats.value.failed / total) * 100
  }
})

// 加载仪表盘统计数据
const loadDashboardStats = async () => {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) {
      return
    }
    
    const response = await fetch('http://localhost:8080/api/dashboard/stats', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (!response.ok) {
      return
    }
    
    const result = await response.json()
    const data = result.data
    
    // 更新统计数据
    stats.value = {
      nodes: data.total_nodes || 0,
      nodesOnline: data.online_nodes || 0,
      cpuCores: data.total_cpus || 0,
      cpuUsage: Math.round(data.cpu_usage_percent || 0),
      gpuCards: data.total_gpus || 0,
      gpuInUse: data.allocated_gpus || 0,
      memory: data.total_memory_tb || 0,
      memoryFree: data.free_memory_tb || 0
    }
    
    console.log('Dashboard stats loaded:', stats.value)
  } catch (err: any) {
    console.error('Failed to load dashboard stats:', err)
    // 静默处理错误，不显示通知
  }
}

// 加载节点列表
const loadNodes = async () => {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) {
      throw new Error('请先登录系统')
    }
    
    const response = await fetch('http://localhost:8080/api/dashboard/nodes', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMsg = errorData.error || `HTTP ${response.status}: ${response.statusText}`
      throw new Error(errorMsg)
    }
    
    const result = await response.json()
    const nodeData = result.data || []
    
    console.log('Loaded nodes:', nodeData)
    
    // 转换节点数据
    nodes.value = nodeData.map((node: any) => {
      // 状态映射
      let status = 'idle'
      let statusText = '空闲'
      const state = (node.state || '').toUpperCase()
      
      if (state === 'ALLOCATED' || state === 'MIXED') {
        status = 'online'
        statusText = '在线'
      } else if (state === 'IDLE') {
        status = 'idle'
        statusText = '空闲'
      } else if (state === 'DOWN' || state === 'DRAIN' || state === 'DRAINING') {
        status = 'offline'
        statusText = '离线'
      } else {
        status = 'online'
        statusText = '在线'
      }
      
      // GPU 信息格式化
      let gpuInfo = '-'
      if (node.gpu_info && node.gpu_info !== '') {
        // 解析总GPU数
        const totalMatch = node.gpu_info.match(/gpu:(\w+:)?(\d+)/)
        const usedMatch = node.gpu_used ? node.gpu_used.match(/gpu:(\w+:)?(\d+)/) : null
        
        if (totalMatch) {
          const total = parseInt(totalMatch[2])
          const used = usedMatch ? parseInt(usedMatch[2]) : 0
          gpuInfo = `${used}/${total}`
        }
      }
      
      return {
        name: node.name,
        status: status,
        statusText: statusText,
        cpuUsage: Math.round(node.cpu_usage_percent || 0),
        memUsage: Math.round(node.memory_usage_percent || 0),
        gpu: gpuInfo,
        jobs: node.running_jobs || 0
      }
    })
  } catch (err: any) {
    console.error('Failed to load nodes:', err)
    // 只在控制台输出错误，不显示通知（避免干扰用户）
    // notification.error(err.message || '获取节点列表失败')
  }
}

// 加载作业统计（从作业API获取）
const loadJobStats = async () => {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) {
      return
    }
    
    const response = await fetch('http://localhost:8080/api/jobs?page=1&page_size=1000', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (!response.ok) {
      return
    }
    
    const result = await response.json()
    const jobs = result.data || []
    
    // 统计作业状态
    jobStats.value = {
      running: jobs.filter((j: any) => j.job_state === 'RUNNING').length,
      pending: jobs.filter((j: any) => j.job_state === 'PENDING').length,
      completed: jobs.filter((j: any) => j.job_state === 'COMPLETED').length,
      failed: jobs.filter((j: any) => j.job_state === 'FAILED').length
    }
  } catch (err: any) {
    console.error('Failed to load job stats:', err)
  }
}

onMounted(() => {
  loadDashboardStats()
  loadNodes()
  loadJobStats()
  
  // 定时刷新（每30秒）
  setInterval(() => {
    loadDashboardStats()
    loadNodes()
    loadJobStats()
  }, 30000)
})
</script>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  font-size: 3rem;
}

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #667eea;
  margin-bottom: 0.25rem;
}

.stat-detail {
  font-size: 0.85rem;
  color: #999;
}

.dashboard-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.charts-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}

.chart-card {
  display: flex;
  flex-direction: column;
}

.chart-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  margin-top: 1rem;
}

.pie-chart {
  width: 200px;
  height: 200px;
}

.chart-total {
  font-size: 2rem;
  font-weight: 700;
  fill: #333;
}

.chart-label {
  font-size: 0.9rem;
  fill: #666;
}

.chart-legend {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.legend-item-full {
  display: flex;
  align-items: center;
  padding-top: 0.5rem;
  border-top: 1px solid #e5e7eb;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  flex-shrink: 0;
}

.legend-text {
  font-size: 0.9rem;
  color: #666;
}

.legend-text-small {
  font-size: 0.85rem;
  color: #999;
}

.job-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
  margin-top: 1.5rem;
}

.job-stat-item {
  text-align: center;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
}

.job-stat-label {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.job-stat-value {
  font-size: 2rem;
  font-weight: 700;
}

.job-stat-value.running { color: #3b82f6; }
.job-stat-value.pending { color: #f59e0b; }
.job-stat-value.completed { color: #10b981; }
.job-stat-value.failed { color: #ef4444; }

/* 机时信息 */
.machine-time-info {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.machine-time-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.time-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: #f9fafb;
  border-radius: 8px;
  border: 2px solid #e5e7eb;
  transition: all 0.3s;
}

.time-item:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
}

.time-icon {
  font-size: 2.5rem;
}

.time-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.time-label {
  font-size: 0.9rem;
  color: #666;
}

.time-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #333;
}

.time-value.used {
  color: #3b82f6;
}

.time-value.remaining {
  color: #10b981;
}

.time-value.warning {
  color: #f59e0b;
}

.time-progress {
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
  color: #666;
  font-weight: 600;
}

.progress-bar-large {
  width: 100%;
  height: 32px;
  background: #e5e7eb;
  border-radius: 16px;
  overflow: hidden;
}

.progress-fill-large {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  transition: width 0.5s ease;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 1rem;
  color: white;
  font-weight: 700;
  font-size: 0.9rem;
}

.progress-fill-large.warning {
  background: linear-gradient(90deg, #f59e0b 0%, #f97316 100%);
}

.progress-fill-large.danger {
  background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
}

.time-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.95rem;
}

.detail-label {
  color: #666;
}

.detail-value {
  font-weight: 600;
  color: #333;
}

.chart-placeholder {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: 200px;
  margin-top: 1.5rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
}

.chart-bar {
  width: 60px;
  background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px 8px 0 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 0.5rem;
  color: white;
  font-weight: 600;
  font-size: 0.85rem;
}

@media (max-width: 1024px) {
  .charts-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .dashboard-row {
    grid-template-columns: 1fr;
  }
  
  .charts-row {
    grid-template-columns: 1fr;
  }
}

.nodes-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

.nodes-table th {
  background: #f9fafb;
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #555;
  border-bottom: 2px solid #e5e7eb;
}

.nodes-table td {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.nodes-table tbody tr:hover {
  background: #f9fafb;
}

.status-online { background: #d1fae5; color: #065f46; }
.status-idle { background: #dbeafe; color: #1e40af; }
.status-offline { background: #fee2e2; color: #991b1b; }

.progress-bar {
  position: relative;
  width: 100%;
  height: 24px;
  background: #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  transition: width 0.3s;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.75rem;
  font-weight: 600;
  color: #333;
}

/* 存储配额样式 - 紧凑版 */
.storage-quota {
  display: flex;
  flex-direction: column;
}

.quota-grid-compact {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-top: 1.5rem;
}

.quota-section-compact {
  background: #f9fafb;
  padding: 1.25rem;
  border-radius: 8px;
}

.quota-header-compact {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.quota-header-compact h4 {
  font-size: 1rem;
  color: #333;
  margin: 0;
}

.quota-status {
  font-size: 0.85rem;
  font-weight: 600;
  color: #667eea;
}

.quota-status.warning {
  color: #f59e0b;
}

.quota-bar {
  position: relative;
  width: 100%;
  height: 28px;
  background: #e5e7eb;
  border-radius: 14px;
  overflow: hidden;
}

.quota-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  transition: width 0.5s ease;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 1rem;
}

.quota-fill.warning {
  background: linear-gradient(90deg, #f59e0b 0%, #f97316 100%);
}

.quota-fill.danger {
  background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
}

.quota-percentage {
  font-size: 0.8rem;
  font-weight: 700;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

/* 存储配额样式 - 原版（已删除，使用紧凑版） */
</style>
