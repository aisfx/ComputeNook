<template>
  <div class="admin-dashboard">
    <!-- 顶部信息栏 -->
    <div class="dash-header">
      <div class="header-left">
        <div class="header-title">
          <span class="cluster-dot"></span>
          <h2>集群总览</h2>
          <span class="cluster-tag">{{ clusterName }}</span>
        </div>
        <span class="update-time">最后更新 {{ currentTime }}</span>
      </div>
      <div class="header-right">
        <div :class="['status-pill', alertCount > 0 ? 'alert' : 'ok']">
          <span class="pill-dot"></span>
          {{ alertCount > 0 ? `${alertCount} 条告警` : '系统正常' }}
        </div>
        <button class="btn-refresh" @click="refreshAll" :disabled="loading">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          刷新
        </button>
      </div>
    </div>

    <!-- 核心指标卡片 -->
    <div class="metrics-row">
      <div class="metric-card">
        <div class="metric-icon blue">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        </div>
        <div class="metric-body">
          <div class="metric-label">节点</div>
          <div class="metric-value">{{ stats.nodesOnline }}<span class="metric-total">/{{ stats.nodes }}</span></div>
          <div class="metric-sub">在线 / 总数</div>
        </div>
        <svg class="metric-ring" width="56" height="56" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="22" fill="none" stroke="#e5e7eb" stroke-width="4"/>
          <circle cx="28" cy="28" r="22" fill="none" stroke="#3b82f6" stroke-width="4"
            :stroke-dasharray="`${stats.nodes > 0 ? (stats.nodesOnline/stats.nodes)*138.2 : 0} 138.2`"
            stroke-dashoffset="0" transform="rotate(-90 28 28)" stroke-linecap="round"/>
          <text x="28" y="33" text-anchor="middle" style="font-size:10px;font-weight:700;fill:#1f2937">
            {{ stats.nodes > 0 ? Math.round(stats.nodesOnline/stats.nodes*100) : 0 }}%
          </text>
        </svg>
      </div>

      <div class="metric-card">
        <div class="metric-icon green">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>
        </div>
        <div class="metric-body">
          <div class="metric-label">CPU</div>
          <div class="metric-value">{{ stats.cpuUsage }}<span class="metric-total">/{{ stats.cpuCores }}</span></div>
          <div class="metric-sub">已分配 / 总核数</div>
        </div>
        <svg class="metric-ring" width="56" height="56" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="22" fill="none" stroke="#e5e7eb" stroke-width="4"/>
          <circle cx="28" cy="28" r="22" fill="none" stroke="#10b981" stroke-width="4"
            :stroke-dasharray="`${stats.cpuCores > 0 ? (stats.cpuUsage/stats.cpuCores)*138.2 : 0} 138.2`"
            stroke-dashoffset="0" transform="rotate(-90 28 28)" stroke-linecap="round"/>
          <text x="28" y="33" text-anchor="middle" style="font-size:10px;font-weight:700;fill:#1f2937">
            {{ stats.cpuCores > 0 ? Math.round(stats.cpuUsage/stats.cpuCores*100) : 0 }}%
          </text>
        </svg>
      </div>

      <div class="metric-card">
        <div class="metric-icon purple">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M11 3L8 9l4 13 4-13-3-6"/><line x1="2" y1="9" x2="22" y2="9"/></svg>
        </div>
        <div class="metric-body">
          <div class="metric-label">GPU</div>
          <div class="metric-value">{{ stats.gpuInUse }}<span class="metric-total">/{{ stats.gpuCards }}</span></div>
          <div class="metric-sub">已使用 / 总卡数</div>
        </div>
        <svg class="metric-ring" width="56" height="56" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="22" fill="none" stroke="#e5e7eb" stroke-width="4"/>
          <circle cx="28" cy="28" r="22" fill="none" stroke="#8b5cf6" stroke-width="4"
            :stroke-dasharray="`${stats.gpuCards > 0 ? (stats.gpuInUse/stats.gpuCards)*138.2 : 0} 138.2`"
            stroke-dashoffset="0" transform="rotate(-90 28 28)" stroke-linecap="round"/>
          <text x="28" y="33" text-anchor="middle" style="font-size:10px;font-weight:700;fill:#1f2937">
            {{ stats.gpuCards > 0 ? Math.round(stats.gpuInUse/stats.gpuCards*100) : 0 }}%
          </text>
        </svg>
      </div>

      <div class="metric-card">
        <div class="metric-icon cyan">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
        </div>
        <div class="metric-body">
          <div class="metric-label">内存</div>
          <div class="metric-value">{{ formatMem(stats.memory - stats.memoryFree) }}<span class="metric-total">/{{ formatMem(stats.memory) }}</span></div>
          <div class="metric-sub">已用 / 总量</div>
        </div>
        <svg class="metric-ring" width="56" height="56" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="22" fill="none" stroke="#e5e7eb" stroke-width="4"/>
          <circle cx="28" cy="28" r="22" fill="none" stroke="#06b6d4" stroke-width="4"
            :stroke-dasharray="`${stats.memory > 0 ? ((stats.memory-stats.memoryFree)/stats.memory)*138.2 : 0} 138.2`"
            stroke-dashoffset="0" transform="rotate(-90 28 28)" stroke-linecap="round"/>
          <text x="28" y="33" text-anchor="middle" style="font-size:10px;font-weight:700;fill:#1f2937">
            {{ stats.memory > 0 ? Math.round((stats.memory-stats.memoryFree)/stats.memory*100) : 0 }}%
          </text>
        </svg>
      </div>

      <div class="metric-card">
        <div class="metric-icon orange">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        </div>
        <div class="metric-body">
          <div class="metric-label">运行作业</div>
          <div class="metric-value">{{ jobStats.running }}</div>
          <div class="metric-sub">
            <span class="tag-pending">等待 {{ jobStats.pending }}</span>
            <span class="tag-done">完成 {{ jobStats.completed }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="main-grid">
      <!-- 左列：作业统计 + 节点列表 -->
      <div class="left-col">
        <!-- 作业状态分布 -->
        <div class="card">
          <div class="card-header">
            <h4>作业状态</h4>
          </div>
          <div class="job-stats-row">
            <div class="job-stat-item" v-for="item in jobStatItems" :key="item.label">
              <div class="job-stat-bar-wrap">
                <div class="job-stat-bar" :style="{ height: item.pct + '%', background: item.color }"></div>
              </div>
              <div class="job-stat-num" :style="{ color: item.color }">{{ item.value }}</div>
              <div class="job-stat-label">{{ item.label }}</div>
            </div>
          </div>
        </div>

        <!-- 节点状态 -->
        <div class="card">
          <div class="card-header">
            <h4>节点状态</h4>
            <span class="badge-count">{{ nodes.length }} 个节点</span>
          </div>
          <div class="nodes-grid">
            <div v-for="node in nodes" :key="node.name" class="node-card" :class="`node-${node.status}`">
              <div class="node-name">{{ node.name }}</div>
              <div class="node-bars">
                <div class="node-bar-row">
                  <span>CPU</span>
                  <div class="node-bar"><div class="node-bar-fill cpu" :style="{ width: node.cpu + '%' }"></div></div>
                  <span>{{ node.cpu }}%</span>
                </div>
                <div class="node-bar-row">
                  <span>MEM</span>
                  <div class="node-bar"><div class="node-bar-fill mem" :style="{ width: node.mem + '%' }"></div></div>
                  <span>{{ node.mem }}%</span>
                </div>
              </div>
              <div class="node-status-label">{{ node.statusText }}</div>
            </div>
            <div v-if="nodes.length === 0" class="empty-hint">暂无节点数据</div>
          </div>
        </div>
      </div>

      <!-- 右列：告警 + 运行中作业 -->
      <div class="right-col">
        <!-- 告警信息 -->
        <div class="card" v-if="alerts.length > 0">
          <div class="card-header">
            <h4>告警信息</h4>
            <span class="badge-alert">{{ alerts.length }}</span>
          </div>
          <div class="alert-list">
            <div v-for="alert in alerts" :key="alert.id" :class="['alert-item', `alert-${alert.severity}`]">
              <span class="alert-icon">{{ alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : '🔵' }}</span>
              <span class="alert-msg">{{ alert.message }}</span>
            </div>
          </div>
        </div>

        <!-- 运行中作业 -->
        <div class="card">
          <div class="card-header">
            <h4>运行中作业</h4>
            <span class="badge-count">{{ runningJobs.length }} 个</span>
          </div>
          <div v-if="runningJobs.length === 0" class="empty-hint">暂无运行中的作业</div>
          <table v-else class="mini-table">
            <thead>
              <tr>
                <th>作业ID</th>
                <th>用户</th>
                <th>分区</th>
                <th>CPU</th>
                <th>已运行</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="job in runningJobs.slice(0, 15)" :key="job.job_id">
                <td><code>{{ job.job_id }}</code></td>
                <td>{{ job.user_name || job.user || '-' }}</td>
                <td>{{ job.partition || '-' }}</td>
                <td>{{ job.cpus || '-' }}</td>
                <td>{{ formatElapsed(job.run_time) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const clusterName = ref('HPC集群')
const currentTime = ref('')
const alertCount = ref(0)
const loading = ref(false)

const stats = ref({ nodes: 0, nodesOnline: 0, cpuCores: 0, cpuUsage: 0, gpuCards: 0, gpuInUse: 0, memory: 0, memoryFree: 0 })
const jobStats = ref({ running: 0, pending: 0, completed: 0, failed: 0 })
const nodes = ref<any[]>([])
const alerts = ref<any[]>([])
const runningJobs = ref<any[]>([])

const jobStatItems = computed(() => {
  const total = jobStats.value.running + jobStats.value.pending + jobStats.value.completed + jobStats.value.failed || 1
  return [
    { label: '运行中', value: jobStats.value.running, color: '#3b82f6', pct: Math.max(4, jobStats.value.running / total * 100) },
    { label: '等待中', value: jobStats.value.pending, color: '#f59e0b', pct: Math.max(4, jobStats.value.pending / total * 100) },
    { label: '已完成', value: jobStats.value.completed, color: '#10b981', pct: Math.max(4, jobStats.value.completed / total * 100) },
    { label: '失败', value: jobStats.value.failed, color: '#ef4444', pct: Math.max(4, jobStats.value.failed / total * 100) },
  ]
})

const formatMem = (tb: number) => {
  if (!tb) return '0 GB'
  if (tb >= 1) return `${tb.toFixed(1)} TB`
  return `${(tb * 1024).toFixed(0)} GB`
}

const formatElapsed = (secs: number) => {
  if (!secs) return '-'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const getApiBase = () => ''

const loadDashboardStats = async () => {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) return
    const res = await fetch(`${getApiBase()}/api/dashboard/stats`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return
    const result = await res.json()
    const data = result.data || result || {}
    stats.value = {
      nodes: data.total_nodes || 0, nodesOnline: data.online_nodes || 0,
      cpuCores: data.total_cpus || 0, cpuUsage: Math.round(data.cpu_usage_percent || 0),
      gpuCards: data.total_gpus || 0, gpuInUse: data.allocated_gpus || 0,
      memory: data.total_memory_tb || 0, memoryFree: data.free_memory_tb || 0
    }
  } catch (e) { console.error(e) }
}

const loadNodes = async () => {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) return
    const res = await fetch(`${getApiBase()}/api/dashboard/nodes`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return
    const result = await res.json()
    const data = Array.isArray(result.data) ? result.data : []
    nodes.value = data.map((node: any) => {
      const state = (node.state || '').toUpperCase()
      let status = 'idle', statusText = '空闲'
      if (state === 'ALLOCATED' || state === 'MIXED') { status = 'online'; statusText = '在线' }
      else if (state === 'DOWN' || state === 'DRAIN' || state === 'DRAINING') { status = 'offline'; statusText = '离线' }
      return { name: node.name, status, statusText, cpu: Math.round(node.cpu_usage_percent || 0), mem: Math.round(node.memory_usage_percent || 0), jobs: node.running_jobs || 0 }
    })
  } catch (e) { console.error(e) }
}

const loadJobStats = async () => {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) return
    const res = await fetch(`${getApiBase()}/api/jobs?page=1&page_size=5000`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return
    const result = await res.json()
    const jobs = result.data || []
    jobStats.value = {
      running: jobs.filter((j: any) => j.job_state === 'RUNNING').length,
      pending: jobs.filter((j: any) => j.job_state === 'PENDING').length,
      completed: jobs.filter((j: any) => j.job_state === 'COMPLETED').length,
      failed: jobs.filter((j: any) => ['FAILED', 'CANCELLED', 'TIMEOUT', 'NODE_FAIL'].includes(j.job_state)).length,
    }
    runningJobs.value = jobs.filter((j: any) => j.job_state === 'RUNNING').sort((a: any, b: any) => (b.submit_time || 0) - (a.submit_time || 0))
    updateAlerts()
  } catch (e) { console.error(e) }
}

const updateAlerts = () => {
  const list: any[] = []
  const offlineNodes = nodes.value.filter(n => n.status === 'offline')
  if (offlineNodes.length > 0) list.push({ id: 'nodes', message: `${offlineNodes.length} 个节点离线: ${offlineNodes.map(n => n.name).join(', ')}`, severity: 'critical' })
  if (stats.value.cpuCores > 0 && stats.value.cpuUsage / stats.value.cpuCores > 0.9) list.push({ id: 'cpu', message: `CPU 使用率过高: ${Math.round(stats.value.cpuUsage / stats.value.cpuCores * 100)}%`, severity: 'warning' })
  if (jobStats.value.pending > 10) list.push({ id: 'queue', message: `作业队列积压: ${jobStats.value.pending} 个作业等待中`, severity: 'info' })
  alerts.value = list
  alertCount.value = list.length
}

const refreshAll = async () => {
  loading.value = true
  await Promise.all([loadDashboardStats(), loadNodes(), loadJobStats()])
  currentTime.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  loading.value = false
}

let refreshTimer: ReturnType<typeof setInterval>
let timeTimer: ReturnType<typeof setInterval>

onMounted(() => {
  currentTime.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  refreshAll()
  refreshTimer = setInterval(refreshAll, 30000)
  timeTimer = setInterval(() => {
    currentTime.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }, 1000)
})

onUnmounted(() => {
  clearInterval(refreshTimer)
  clearInterval(timeTimer)
})
</script>

<style scoped>
.admin-dashboard {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
  height: 100%;
  overflow-y: auto;
  background: #f8fafc;
}

/* 顶部栏 */
.dash-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 0.9rem 1.25rem;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.header-left { display: flex; flex-direction: column; gap: 0.2rem; }
.header-title { display: flex; align-items: center; gap: 0.6rem; }
.header-title h2 { margin: 0; font-size: 1.1rem; font-weight: 700; color: #1e293b; }
.cluster-dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,0.2); }
.cluster-tag { background: #dbeafe; color: #1e40af; padding: 0.15rem 0.6rem; border-radius: 20px; font-size: 0.78rem; font-weight: 600; }
.update-time { font-size: 0.78rem; color: #94a3b8; }

.header-right { display: flex; align-items: center; gap: 0.75rem; }
.status-pill { display: flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.85rem; border-radius: 20px; font-size: 0.82rem; font-weight: 600; }
.status-pill.ok { background: #d1fae5; color: #065f46; }
.status-pill.alert { background: #fee2e2; color: #991b1b; }
.pill-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

.btn-refresh {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.4rem 0.9rem; border: 1px solid #e2e8f0; background: white;
  border-radius: 7px; font-size: 0.82rem; cursor: pointer; color: #475569;
  transition: all 0.15s;
}
.btn-refresh:hover { background: #f1f5f9; border-color: #94a3b8; }
.btn-refresh:disabled { opacity: 0.5; cursor: not-allowed; }

/* 指标卡片行 */
.metrics-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.75rem;
}

.metric-card {
  background: white;
  border-radius: 10px;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.metric-icon {
  width: 40px; height: 40px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.metric-icon.blue { background: #dbeafe; color: #2563eb; }
.metric-icon.green { background: #d1fae5; color: #059669; }
.metric-icon.purple { background: #ede9fe; color: #7c3aed; }
.metric-icon.cyan { background: #cffafe; color: #0891b2; }
.metric-icon.orange { background: #ffedd5; color: #ea580c; }

.metric-body { flex: 1; min-width: 0; }
.metric-label { font-size: 0.75rem; color: #94a3b8; font-weight: 500; }
.metric-value { font-size: 1.2rem; font-weight: 700; color: #1e293b; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.metric-total { font-size: 0.85rem; font-weight: 500; color: #94a3b8; }
.metric-sub { font-size: 0.72rem; color: #94a3b8; margin-top: 0.1rem; display: flex; gap: 0.4rem; }
.metric-ring { flex-shrink: 0; }

.tag-pending { background: #fef3c7; color: #92400e; padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.7rem; }
.tag-done { background: #d1fae5; color: #065f46; padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.7rem; }

/* 主内容网格 */
.main-grid {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 0.75rem;
  flex: 1;
  min-height: 0;
}

.left-col, .right-col { display: flex; flex-direction: column; gap: 0.75rem; }

/* 卡片 */
.card {
  background: white;
  border-radius: 10px;
  padding: 1rem;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.card-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 0.85rem;
}
.card-header h4 { margin: 0; font-size: 0.9rem; font-weight: 600; color: #1e293b; }
.badge-count { background: #f1f5f9; color: #64748b; padding: 0.15rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
.badge-alert { background: #fee2e2; color: #dc2626; padding: 0.15rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; }

/* 作业状态柱状图 */
.job-stats-row {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
  height: 100px;
  padding: 0 0.5rem;
}
.job-stat-item { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; flex: 1; }
.job-stat-bar-wrap { width: 100%; flex: 1; display: flex; align-items: flex-end; }
.job-stat-bar { width: 100%; border-radius: 4px 4px 0 0; min-height: 4px; transition: height 0.3s; }
.job-stat-num { font-size: 1rem; font-weight: 700; }
.job-stat-label { font-size: 0.72rem; color: #94a3b8; }

/* 节点网格 */
.nodes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 0.5rem;
  max-height: 320px;
  overflow-y: auto;
}

.node-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.6rem;
  font-size: 0.78rem;
}
.node-card.node-online { border-color: #a7f3d0; background: #f0fdf4; }
.node-card.node-offline { border-color: #fca5a5; background: #fff5f5; }
.node-card.node-idle { border-color: #e5e7eb; background: #fafafa; }

.node-name { font-weight: 600; color: #1e293b; margin-bottom: 0.4rem; font-size: 0.8rem; }
.node-bars { display: flex; flex-direction: column; gap: 0.25rem; }
.node-bar-row { display: flex; align-items: center; gap: 0.3rem; font-size: 0.7rem; color: #64748b; }
.node-bar { flex: 1; height: 4px; background: #e5e7eb; border-radius: 2px; overflow: hidden; }
.node-bar-fill { height: 100%; border-radius: 2px; transition: width 0.3s; }
.node-bar-fill.cpu { background: #3b82f6; }
.node-bar-fill.mem { background: #10b981; }
.node-status-label { margin-top: 0.35rem; font-size: 0.68rem; color: #94a3b8; }

/* 告警列表 */
.alert-list { display: flex; flex-direction: column; gap: 0.4rem; }
.alert-item { display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.5rem 0.75rem; border-radius: 7px; font-size: 0.82rem; }
.alert-item.alert-critical { background: #fff5f5; color: #991b1b; }
.alert-item.alert-warning { background: #fffbeb; color: #92400e; }
.alert-item.alert-info { background: #eff6ff; color: #1e40af; }
.alert-msg { flex: 1; }

/* 作业表格 */
.mini-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.mini-table th { background: #f8fafc; padding: 0.5rem 0.6rem; text-align: left; font-weight: 600; color: #64748b; border-bottom: 1px solid #e5e7eb; white-space: nowrap; }
.mini-table td { padding: 0.5rem 0.6rem; border-bottom: 1px solid #f1f5f9; color: #374151; white-space: nowrap; }
.mini-table tbody tr:hover { background: #f8fafc; }
.mini-table code { font-size: 0.78rem; background: #f1f5f9; padding: 0.1rem 0.35rem; border-radius: 4px; }

.empty-hint { color: #94a3b8; font-size: 0.85rem; padding: 1rem 0; text-align: center; }

@media (max-width: 1200px) {
  .metrics-row { grid-template-columns: repeat(3, 1fr); }
  .main-grid { grid-template-columns: 1fr; }
}
</style>
