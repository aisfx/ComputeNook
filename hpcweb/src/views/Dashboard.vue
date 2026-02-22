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
          <div class="stat-value">{{ stats.memory }} TB</div>
          <div class="stat-detail">可用: {{ stats.memoryFree }} TB</div>
        </div>
      </div>
    </div>

    <!-- 作业统计和存储配额 -->
    <div class="dashboard-row">
      <div class="card job-stats">
        <h3>📊 作业统计</h3>
        <div class="job-stats-grid">
          <div class="job-stat-item">
            <div class="job-stat-label">运行中</div>
            <div class="job-stat-value running">{{ jobStats.running }}</div>
          </div>
          <div class="job-stat-item">
            <div class="job-stat-label">等待中</div>
            <div class="job-stat-value pending">{{ jobStats.pending }}</div>
          </div>
          <div class="job-stat-item">
            <div class="job-stat-label">已完成</div>
            <div class="job-stat-value completed">{{ jobStats.completed }}</div>
          </div>
          <div class="job-stat-item">
            <div class="job-stat-label">失败</div>
            <div class="job-stat-value failed">{{ jobStats.failed }}</div>
          </div>
        </div>
      </div>

      <div class="card storage-quota">
        <h3>💾 存储配额</h3>
        <div class="quota-grid-compact">
          <div class="quota-section-compact">
            <div class="quota-header-compact">
              <h4>📦 容量配额</h4>
              <span class="quota-status" :class="storageQuota.capacity.percentage > 90 ? 'warning' : ''">
                {{ storageQuota.capacity.used }} / {{ storageQuota.capacity.total }}
              </span>
            </div>
            <div class="quota-bar">
              <div 
                class="quota-fill" 
                :class="{ warning: storageQuota.capacity.percentage > 80, danger: storageQuota.capacity.percentage > 90 }"
                :style="{ width: storageQuota.capacity.percentage + '%' }"
              >
                <span class="quota-percentage">{{ storageQuota.capacity.percentage }}%</span>
              </div>
            </div>
          </div>

          <div class="quota-section-compact">
            <div class="quota-header-compact">
              <h4>📄 文件数配额</h4>
              <span class="quota-status" :class="storageQuota.files.percentage > 90 ? 'warning' : ''">
                {{ storageQuota.files.used.toLocaleString() }} / {{ storageQuota.files.total.toLocaleString() }}
              </span>
            </div>
            <div class="quota-bar">
              <div 
                class="quota-fill" 
                :class="{ warning: storageQuota.files.percentage > 80, danger: storageQuota.files.percentage > 90 }"
                :style="{ width: storageQuota.files.percentage + '%' }"
              >
                <span class="quota-percentage">{{ storageQuota.files.percentage }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 机时信息 -->
    <div class="card machine-time-info">
      <h3>⏱️ 机时信息</h3>
      <div class="machine-time-grid">
        <div class="time-item">
          <div class="time-icon">📊</div>
          <div class="time-content">
            <span class="time-label">总机时配额</span>
            <span class="time-value">{{ machineTime.totalQuota }} 核时</span>
          </div>
        </div>
        <div class="time-item">
          <div class="time-icon">✅</div>
          <div class="time-content">
            <span class="time-label">已使用机时</span>
            <span class="time-value used">{{ machineTime.used }} 核时</span>
          </div>
        </div>
        <div class="time-item">
          <div class="time-icon">💰</div>
          <div class="time-content">
            <span class="time-label">剩余机时</span>
            <span class="time-value remaining">{{ machineTime.remaining }} 核时</span>
          </div>
        </div>
        <div class="time-item">
          <div class="time-icon">📈</div>
          <div class="time-content">
            <span class="time-label">使用率</span>
            <span class="time-value" :class="{ warning: machineTime.usageRate > 80 }">
              {{ machineTime.usageRate }}%
            </span>
          </div>
        </div>
      </div>
      <div class="time-progress">
        <div class="progress-label">
          <span>机时使用进度</span>
          <span>{{ machineTime.used }} / {{ machineTime.totalQuota }} 核时</span>
        </div>
        <div class="progress-bar-large">
          <div 
            class="progress-fill-large" 
            :style="{ width: machineTime.usageRate + '%' }"
            :class="{ warning: machineTime.usageRate > 70, danger: machineTime.usageRate > 90 }"
          ></div>
        </div>
      </div>
      <div class="time-details">
        <div class="detail-row">
          <span class="detail-label">本月已用:</span>
          <span class="detail-value">{{ machineTime.monthUsed }} 核时</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">今日已用:</span>
          <span class="detail-value">{{ machineTime.todayUsed }} 核时</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">配额有效期:</span>
          <span class="detail-value">{{ machineTime.expiryDate }}</span>
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
import { ref } from 'vue'

const stats = ref({
  nodes: 32,
  nodesOnline: 30,
  cpuCores: 2048,
  cpuUsage: 65,
  gpuCards: 128,
  gpuInUse: 96,
  memory: 64,
  memoryFree: 22
})

const jobStats = ref({
  running: 45,
  pending: 12,
  completed: 328,
  failed: 5
})

const nodes = ref([
  { name: 'node001', status: 'online', statusText: '在线', cpuUsage: 75, memUsage: 68, gpu: '4/4', jobs: 8 },
  { name: 'node002', status: 'online', statusText: '在线', cpuUsage: 45, memUsage: 52, gpu: '2/4', jobs: 4 },
  { name: 'node003', status: 'online', statusText: '在线', cpuUsage: 90, memUsage: 85, gpu: '4/4', jobs: 12 },
  { name: 'node004', status: 'idle', statusText: '空闲', cpuUsage: 5, memUsage: 12, gpu: '0/4', jobs: 0 },
  { name: 'node005', status: 'offline', statusText: '离线', cpuUsage: 0, memUsage: 0, gpu: '0/4', jobs: 0 }
])

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

@media (max-width: 768px) {
  .dashboard-row {
    grid-template-columns: 1fr;
  }
  
  .machine-time-grid {
    grid-template-columns: 1fr;
  }
  
  .job-stats-grid {
    grid-template-columns: 1fr 1fr;
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
