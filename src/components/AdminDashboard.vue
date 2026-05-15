<template>
  <div class="admin-dashboard">
    <!-- 顶部操作栏 -->
    <div class="dash-header">
      <div class="dash-title">
        <h3>集群总览</h3>
        <span class="dash-time">最后更新: {{ lastUpdate }}</span>
      </div>
      <div class="dash-actions">
        <select v-model="timeRange" @change="loadAll" class="time-select">
          <option value="1h">最近 1 小时</option>
          <option value="24h">最近 24 小时</option>
          <option value="7d">最近 7 天</option>
          <option value="30d">最近 30 天</option>
        </select>
        <button class="btn-refresh" @click="loadAll" :disabled="loading">
          <span :class="{ spinning: loading }">⟳</span> 刷新
        </button>
      </div>
    </div>

    <!-- KPI 卡片行 -->
    <div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-icon">🖥️</div>
        <div class="kpi-body">
          <div class="kpi-value">{{ stats.totalNodes }}</div>
          <div class="kpi-label">总节点数</div>
          <div class="kpi-sub">
            <span class="ok">{{ stats.idleNodes }} 空闲</span> ·
            <span class="warn">{{ stats.allocNodes }} 占用</span> ·
            <span class="err">{{ stats.downNodes }} 故障</span>
          </div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon">⚡</div>
        <div class="kpi-body">
          <div class="kpi-value">{{ stats.runningJobs }}</div>
          <div class="kpi-label">运行中作业</div>
          <div class="kpi-sub">
            <span class="warn">{{ stats.pendingJobs }} 排队</span> ·
            <span class="muted">{{ stats.completedJobs }} 已完成</span>
          </div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon">🧮</div>
        <div class="kpi-body">
          <div class="kpi-value">{{ stats.cpuUtil }}%</div>
          <div class="kpi-label">CPU 利用率</div>
          <div class="kpi-bar">
            <div class="kpi-bar-fill" :style="{ width: stats.cpuUtil + '%', background: cpuColor(stats.cpuUtil) }"></div>
          </div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon">💾</div>
        <div class="kpi-body">
          <div class="kpi-value">{{ stats.memUtil }}%</div>
          <div class="kpi-label">内存利用率</div>
          <div class="kpi-bar">
            <div class="kpi-bar-fill" :style="{ width: stats.memUtil + '%', background: cpuColor(stats.memUtil) }"></div>
          </div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon">🎮</div>
        <div class="kpi-body">
          <div class="kpi-value">{{ stats.gpuUtil }}%</div>
          <div class="kpi-label">GPU 利用率</div>
          <div class="kpi-bar">
            <div class="kpi-bar-fill" :style="{ width: stats.gpuUtil + '%', background: '#8b5cf6' }"></div>
          </div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon">👥</div>
        <div class="kpi-body">
          <div class="kpi-value">{{ stats.activeUsers }}</div>
          <div class="kpi-label">活跃用户</div>
          <div class="kpi-sub"><span class="muted">共 {{ stats.totalUsers }} 用户</span></div>
        </div>
      </div>
    </div>

    <!-- 中间两列 -->
    <div class="dash-grid">
      <!-- 左：节点状态表 -->
      <div class="dash-card">
        <div class="card-header">
          <span>🖥️ 节点状态</span>
          <span class="card-badge">{{ nodes.length }} 个节点</span>
        </div>
        <div class="node-list">
          <div v-if="nodes.length === 0" class="empty-hint">暂无节点数据</div>
          <div v-for="node in nodes" :key="node.name" class="node-row">
            <div class="node-name">{{ node.name }}</div>
            <div class="node-state">
              <span :class="['node-badge', nodeStateClass(node.state)]">{{ node.state }}</span>
            </div>
            <div class="node-res">
              <span class="res-item">CPU {{ node.cpuAlloc }}/{{ node.cpuTotal }}</span>
              <span class="res-item">MEM {{ node.memAlloc }}G/{{ node.memTotal }}G</span>
              <span v-if="node.gpuTotal > 0" class="res-item gpu">GPU {{ node.gpuAlloc }}/{{ node.gpuTotal }}</span>
            </div>
            <div class="node-bar-wrap">
              <div class="node-bar">
                <div class="node-bar-fill cpu" :style="{ width: nodeUtil(node.cpuAlloc, node.cpuTotal) + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右：分区状态 + 作业队列 -->
      <div class="dash-right">
        <!-- 分区状态 -->
        <div class="dash-card">
          <div class="card-header">
            <span>📦 分区状态</span>
          </div>
          <table class="mini-table">
            <thead><tr><th>分区</th><th>状态</th><th>节点</th><th>运行</th><th>排队</th></tr></thead>
            <tbody>
              <tr v-if="partitions.length === 0"><td colspan="5" class="empty-hint">暂无数据</td></tr>
              <tr v-for="p in partitions" :key="p.name">
                <td><strong>{{ p.name }}</strong></td>
                <td><span :class="['part-badge', p.state === 'UP' ? 'up' : 'down']">{{ p.state }}</span></td>
                <td>{{ p.nodes }}</td>
                <td class="num-cell">{{ p.running }}</td>
                <td class="num-cell warn">{{ p.pending }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 最近作业 -->
        <div class="dash-card" style="margin-top:12px">
          <div class="card-header">
            <span>📋 最近作业</span>
            <span class="card-badge">{{ recentJobs.length }} 条</span>
          </div>
          <table class="mini-table">
            <thead><tr><th>ID</th><th>用户</th><th>名称</th><th>状态</th><th>运行时长</th></tr></thead>
            <tbody>
              <tr v-if="recentJobs.length === 0"><td colspan="5" class="empty-hint">暂无数据</td></tr>
              <tr v-for="job in recentJobs" :key="job.id">
                <td><code>{{ job.id }}</code></td>
                <td>{{ job.user }}</td>
                <td class="job-name">{{ job.name }}</td>
                <td><span :class="['job-badge', job.state.toLowerCase()]">{{ job.state }}</span></td>
                <td class="muted">{{ job.runtime }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 底部：用户机时排行 + 账户用量 -->
    <div class="dash-grid" style="margin-top:12px">
      <!-- 用户机时排行 -->
      <div class="dash-card">
        <div class="card-header">
          <span>🏆 用户机时排行 ({{ timeRange }})</span>
        </div>
        <div v-if="topUsers.length === 0" class="empty-hint">暂无数据</div>
        <div v-for="(u, i) in topUsers" :key="u.user" class="rank-row">
          <div class="rank-num" :class="i < 3 ? 'top' : ''">{{ i + 1 }}</div>
          <div class="rank-user">{{ u.user }}</div>
          <div class="rank-bar-wrap">
            <div class="rank-bar">
              <div class="rank-bar-fill" :style="{ width: (u.hours / (topUsers[0]?.hours || 1) * 100) + '%' }"></div>
            </div>
          </div>
          <div class="rank-val">{{ u.hours.toFixed(1) }}h</div>
          <div class="rank-jobs muted">{{ u.jobs }} 作业</div>
        </div>
      </div>

      <!-- 账户用量 -->
      <div class="dash-card">
        <div class="card-header">
          <span>💼 账户用量</span>
        </div>
        <div v-if="accountUsage.length === 0" class="empty-hint">暂无数据</div>
        <div v-for="acc in accountUsage" :key="acc.account" class="acc-row">
          <div class="acc-name">{{ acc.account }}</div>
          <div class="acc-bar-wrap">
            <div class="acc-bar">
              <div class="acc-bar-fill"
                :style="{
                  width: acc.total > 0 ? Math.min(acc.used / acc.total * 100, 100) + '%' : '0%',
                  background: acc.total > 0 && acc.used / acc.total > 0.9 ? '#ef4444' :
                              acc.total > 0 && acc.used / acc.total > 0.7 ? '#f59e0b' : '#22c55e'
                }">
              </div>
            </div>
          </div>
          <div class="acc-stat">
            <span v-if="acc.total > 0">{{ formatMins(acc.used) }} / {{ formatMins(acc.total) }}</span>
            <span v-else class="muted">{{ formatMins(acc.used) }} 已用</span>
          </div>
          <div class="acc-pct muted">
            {{ acc.total > 0 ? (acc.used / acc.total * 100).toFixed(0) + '%' : '—' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { getApiBase, getToken } from '../utils/auth'

const loading = ref(false)
const lastUpdate = ref('—')
const timeRange = ref('24h')
let timer: any = null

const stats = ref({
  totalNodes: 0, idleNodes: 0, allocNodes: 0, downNodes: 0,
  runningJobs: 0, pendingJobs: 0, completedJobs: 0,
  cpuUtil: 0, memUtil: 0, gpuUtil: 0,
  activeUsers: 0, totalUsers: 0,
})

const nodes = ref<any[]>([])
const partitions = ref<any[]>([])
const recentJobs = ref<any[]>([])
const topUsers = ref<any[]>([])
const accountUsage = ref<any[]>([])

const cpuColor = (v: number) =>
  v > 90 ? '#ef4444' : v > 70 ? '#f59e0b' : '#22c55e'

const nodeStateClass = (s: string) => {
  const st = (s || '').toLowerCase()
  if (st.includes('idle')) return 'idle'
  if (st.includes('alloc') || st.includes('mix')) return 'alloc'
  if (st.includes('down') || st.includes('drain')) return 'down'
  return 'unknown'
}

const nodeUtil = (alloc: number, total: number) =>
  total > 0 ? Math.round(alloc / total * 100) : 0

const formatMins = (mins: number) => {
  if (!mins) return '0m'
  if (mins < 60) return `${Math.round(mins)}m`
  return `${(mins / 60).toFixed(1)}h`
}

const timeRangeDays = () => {
  const map: Record<string, number> = { '1h': 0.04, '24h': 1, '7d': 7, '30d': 30 }
  return map[timeRange.value] || 1
}

const api = (path: string) =>
  fetch(`${getApiBase()}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } })
    .then(r => r.ok ? r.json() : null).catch(() => null)

const loadNodes = async () => {
  const data = await api('/api/monitoring/node-metrics')
  if (!data?.nodes) return
  const ns = data.nodes.map((n: any) => ({
    name: n.instance?.replace(/:\d+$/, '') || n.nodename || '—',
    state: n.state || 'UNKNOWN',
    cpuAlloc: n.cpu_alloc ?? 0,
    cpuTotal: n.cpu_total ?? n.cpus ?? 0,
    memAlloc: Math.round((n.mem_alloc ?? 0) / 1024),
    memTotal: Math.round((n.mem_total ?? n.memory ?? 0) / 1024),
    gpuAlloc: n.gpu_alloc ?? 0,
    gpuTotal: n.gpu_total ?? 0,
  }))
  nodes.value = ns

  // 汇总 KPI
  stats.value.totalNodes = ns.length
  stats.value.idleNodes = ns.filter((n: any) => nodeStateClass(n.state) === 'idle').length
  stats.value.allocNodes = ns.filter((n: any) => nodeStateClass(n.state) === 'alloc').length
  stats.value.downNodes = ns.filter((n: any) => nodeStateClass(n.state) === 'down').length

  const totalCpu = ns.reduce((s: number, n: any) => s + n.cpuTotal, 0)
  const allocCpu = ns.reduce((s: number, n: any) => s + n.cpuAlloc, 0)
  const totalMem = ns.reduce((s: number, n: any) => s + n.memTotal, 0)
  const allocMem = ns.reduce((s: number, n: any) => s + n.memAlloc, 0)
  const totalGpu = ns.reduce((s: number, n: any) => s + n.gpuTotal, 0)
  const allocGpu = ns.reduce((s: number, n: any) => s + n.gpuAlloc, 0)
  stats.value.cpuUtil = totalCpu > 0 ? Math.round(allocCpu / totalCpu * 100) : 0
  stats.value.memUtil = totalMem > 0 ? Math.round(allocMem / totalMem * 100) : 0
  stats.value.gpuUtil = totalGpu > 0 ? Math.round(allocGpu / totalGpu * 100) : 0
}

const loadPartitions = async () => {
  const data = await api('/api/jobs/partitions/list')
  if (!data?.data) return
  partitions.value = data.data.map((p: any) => ({
    name: p.name,
    state: p.state || 'UP',
    nodes: p.nodes || '—',
    running: 0,
    pending: 0,
  }))
}

const loadJobs = async () => {
  const data = await api('/api/jobs?page_size=20')
  if (!data?.data) return
  const jobs = data.data
  stats.value.runningJobs = jobs.filter((j: any) => j.job_state === 'RUNNING').length
  stats.value.pendingJobs = jobs.filter((j: any) => j.job_state === 'PENDING').length
  stats.value.completedJobs = jobs.filter((j: any) => j.job_state === 'COMPLETED').length

  // 更新分区作业数
  partitions.value.forEach((p: any) => {
    p.running = jobs.filter((j: any) => j.partition === p.name && j.job_state === 'RUNNING').length
    p.pending = jobs.filter((j: any) => j.partition === p.name && j.job_state === 'PENDING').length
  })

  recentJobs.value = jobs.slice(0, 10).map((j: any) => ({
    id: j.job_id,
    user: j.user_name || '—',
    name: j.name || '—',
    state: j.job_state || '—',
    runtime: formatRuntime(j.run_time),
  }))

  // 用户机时排行：按 run_time * cpus 估算
  const userMap: Record<string, { hours: number; jobs: number }> = {}
  for (const j of jobs) {
    const u = j.user_name || 'unknown'
    const h = ((j.run_time || 0) * (j.cpus || 1)) / 3600
    if (!userMap[u]) userMap[u] = { hours: 0, jobs: 0 }
    userMap[u].hours += h
    userMap[u].jobs++
  }
  topUsers.value = Object.entries(userMap)
    .map(([user, v]) => ({ user, ...v }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 8)

  // 活跃用户数
  stats.value.activeUsers = Object.keys(userMap).length
}

const loadUsers = async () => {
  const data = await api('/api/users')
  if (data?.data) stats.value.totalUsers = data.data.length
  else if (Array.isArray(data)) stats.value.totalUsers = data.length
}

const loadAccountUsage = async () => {
  const data = await api('/api/slurm/accounts')
  if (!data?.data && !Array.isArray(data)) return
  const accounts: any[] = data?.data || data || []
  const days = timeRangeDays()
  const end = Math.floor(Date.now() / 1000)
  const start = end - Math.round(days * 86400)

  const results = await Promise.all(
    accounts.slice(0, 10).map(async (acc: any) => {
      const name = acc.name || acc.Name
      const usage = await api(`/api/usage/account?account=${name}&start_time=${start}&end_time=${end}`)
      return {
        account: name,
        used: usage?.data?.used_billing ?? 0,
        total: usage?.data?.total_billing ?? 0,
      }
    })
  )
  accountUsage.value = results.filter(r => r.account)
}

const formatRuntime = (secs: number) => {
  if (!secs) return '0s'
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m`
  return `${Math.floor(secs / 3600)}h${Math.floor((secs % 3600) / 60)}m`
}

const loadAll = async () => {
  loading.value = true
  await Promise.all([loadNodes(), loadPartitions(), loadJobs(), loadUsers(), loadAccountUsage()])
  lastUpdate.value = new Date().toLocaleTimeString()
  loading.value = false
}

onMounted(() => {
  loadAll()
  timer = setInterval(loadAll, 30000)
})
onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.admin-dashboard { display: flex; flex-direction: column; gap: 12px; padding: 4px 0; }

.dash-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 4px;
}
.dash-title h3 { margin: 0; font-size: 1rem; font-weight: 700; }
.dash-time { font-size: 0.72rem; color: hsl(var(--muted-foreground)); margin-left: 8px; }
.dash-actions { display: flex; gap: 8px; align-items: center; }
.time-select {
  padding: 5px 10px; border: 1px solid hsl(var(--border));
  border-radius: 6px; font-size: 0.8rem;
  background: hsl(var(--background)); color: hsl(var(--foreground));
}
.btn-refresh {
  padding: 5px 12px; border: 1px solid hsl(var(--border));
  border-radius: 6px; font-size: 0.8rem; cursor: pointer;
  background: hsl(var(--background)); color: hsl(var(--foreground));
  transition: background 0.15s;
}
.btn-refresh:hover { background: hsl(var(--accent)); }
.spinning { display: inline-block; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* KPI */
.kpi-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
.kpi-card {
  background: hsl(var(--card)); border: 1px solid hsl(var(--border));
  border-radius: 10px; padding: 14px 12px;
  display: flex; gap: 10px; align-items: flex-start;
}
.kpi-icon { font-size: 1.4rem; line-height: 1; flex-shrink: 0; }
.kpi-body { flex: 1; min-width: 0; }
.kpi-value { font-size: 1.5rem; font-weight: 700; line-height: 1.1; }
.kpi-label { font-size: 0.72rem; color: hsl(var(--muted-foreground)); margin-top: 2px; }
.kpi-sub { font-size: 0.68rem; margin-top: 4px; }
.kpi-bar { height: 4px; background: hsl(var(--muted)); border-radius: 2px; margin-top: 6px; overflow: hidden; }
.kpi-bar-fill { height: 100%; border-radius: 2px; transition: width 0.4s; }
.ok { color: #22c55e; }
.warn { color: #f59e0b; }
.err { color: #ef4444; }
.muted { color: hsl(var(--muted-foreground)); }

/* Grid */
.dash-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.dash-right { display: flex; flex-direction: column; }
.dash-card {
  background: hsl(var(--card)); border: 1px solid hsl(var(--border));
  border-radius: 10px; padding: 14px;
}
.card-header {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 0.82rem; font-weight: 600; margin-bottom: 10px;
}
.card-badge {
  font-size: 0.7rem; background: hsl(var(--muted));
  color: hsl(var(--muted-foreground)); padding: 2px 8px; border-radius: 10px;
}
.empty-hint { font-size: 0.78rem; color: hsl(var(--muted-foreground)); text-align: center; padding: 16px 0; }

/* Node list */
.node-list { display: flex; flex-direction: column; gap: 6px; max-height: 320px; overflow-y: auto; }
.node-list::-webkit-scrollbar { width: 3px; }
.node-list::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 2px; }
.node-row {
  display: grid; grid-template-columns: 90px 70px 1fr 80px;
  align-items: center; gap: 8px; font-size: 0.78rem;
  padding: 5px 6px; border-radius: 6px;
  background: hsl(var(--muted) / 0.3);
}
.node-name { font-weight: 600; font-family: monospace; }
.node-badge {
  padding: 1px 7px; border-radius: 10px; font-size: 0.68rem; font-weight: 600;
}
.node-badge.idle { background: rgba(34,197,94,.12); color: #22c55e; }
.node-badge.alloc { background: rgba(245,158,11,.12); color: #f59e0b; }
.node-badge.down { background: rgba(239,68,68,.12); color: #ef4444; }
.node-badge.unknown { background: hsl(var(--muted)); color: hsl(var(--muted-foreground)); }
.node-res { display: flex; gap: 6px; flex-wrap: wrap; }
.res-item { font-size: 0.68rem; color: hsl(var(--muted-foreground)); }
.res-item.gpu { color: #8b5cf6; }
.node-bar-wrap { }
.node-bar { height: 4px; background: hsl(var(--muted)); border-radius: 2px; overflow: hidden; }
.node-bar-fill.cpu { height: 100%; background: #3b82f6; border-radius: 2px; transition: width 0.3s; }

/* Mini table */
.mini-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
.mini-table th {
  text-align: left; padding: 4px 6px;
  font-size: 0.68rem; font-weight: 600; text-transform: uppercase;
  color: hsl(var(--muted-foreground)); border-bottom: 1px solid hsl(var(--border));
}
.mini-table td { padding: 5px 6px; border-bottom: 1px solid hsl(var(--border) / 0.5); }
.mini-table tr:last-child td { border-bottom: none; }
.num-cell { text-align: right; font-variant-numeric: tabular-nums; }
.part-badge { padding: 1px 7px; border-radius: 10px; font-size: 0.68rem; font-weight: 600; }
.part-badge.up { background: rgba(34,197,94,.12); color: #22c55e; }
.part-badge.down { background: rgba(239,68,68,.12); color: #ef4444; }
.job-badge { padding: 1px 7px; border-radius: 10px; font-size: 0.68rem; font-weight: 600; }
.job-badge.running { background: rgba(59,130,246,.12); color: #3b82f6; }
.job-badge.pending { background: rgba(245,158,11,.12); color: #f59e0b; }
.job-badge.completed { background: rgba(34,197,94,.12); color: #22c55e; }
.job-badge.cancelled, .job-badge.failed { background: rgba(239,68,68,.12); color: #ef4444; }
.job-name { max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Rank */
.rank-row {
  display: grid; grid-template-columns: 24px 80px 1fr 52px 48px;
  align-items: center; gap: 8px; padding: 5px 4px;
  font-size: 0.78rem;
}
.rank-num { font-weight: 700; color: hsl(var(--muted-foreground)); text-align: center; }
.rank-num.top { color: #f59e0b; }
.rank-user { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-bar { height: 6px; background: hsl(var(--muted)); border-radius: 3px; overflow: hidden; }
.rank-bar-fill { height: 100%; background: hsl(var(--primary)); border-radius: 3px; transition: width 0.4s; }
.rank-val { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
.rank-jobs { text-align: right; font-size: 0.68rem; }

/* Account usage */
.acc-row {
  display: grid; grid-template-columns: 80px 1fr 90px 36px;
  align-items: center; gap: 8px; padding: 5px 4px; font-size: 0.78rem;
}
.acc-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.acc-bar { height: 6px; background: hsl(var(--muted)); border-radius: 3px; overflow: hidden; }
.acc-bar-fill { height: 100%; border-radius: 3px; transition: width 0.4s; }
.acc-stat { font-size: 0.7rem; color: hsl(var(--muted-foreground)); text-align: right; }
.acc-pct { text-align: right; font-size: 0.7rem; }

@media (max-width: 1200px) {
  .kpi-row { grid-template-columns: repeat(3, 1fr); }
  .dash-grid { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
  .kpi-row { grid-template-columns: repeat(2, 1fr); }
  /* 固定列宽的行表格改为横向滚动 */
  .node-list, .rank-list, .acc-list { overflow-x: auto; }
  .node-row  { grid-template-columns: 80px 60px 1fr 70px; font-size: 0.72rem; }
  .rank-row  { grid-template-columns: 20px 70px 1fr 46px 44px; font-size: 0.72rem; }
  .acc-row   { grid-template-columns: 70px 1fr 80px 32px; font-size: 0.72rem; }
}
@media (max-width: 400px) {
  .kpi-row { grid-template-columns: 1fr; }
}
</style>
