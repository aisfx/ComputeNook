<template>
  <div class="reports-page">
    <div class="page-header">
      <h3>📊 报表中心</h3>
    </div>

    <!-- 筛选条件 -->
    <div class="card filters-card">
      <div class="filters-row">
        <div class="filter-group">
          <label>报表类型</label>
          <select v-model="filters.type">
            <option value="job">作业统计报表</option>
            <option value="machine-time">机时消耗报表</option>
            <option value="node">节点运行报表</option>
          </select>
        </div>
        <div class="filter-group">
          <label>开始日期</label>
          <input type="date" v-model="filters.startDate" />
        </div>
        <div class="filter-group">
          <label>结束日期</label>
          <input type="date" v-model="filters.endDate" />
        </div>
        <button class="btn-primary" @click="loadReport" :disabled="loading">
          {{ loading ? '查询中...' : '🔍 查询' }}
        </button>
        <button class="btn-secondary" @click="exportCSV" :disabled="!hasData">📥 导出 CSV</button>
      </div>
    </div>

    <div v-if="loading" class="card" style="text-align:center;padding:3rem;color:#9ca3af">加载中...</div>
    <div v-else-if="error" class="card" style="text-align:center;padding:3rem;color:#ef4444">{{ error }}</div>

    <!-- 作业统计报表 -->
    <template v-else-if="filters.type === 'job' && hasData">
      <div class="summary-cards">
        <div class="s-card">
          <div class="s-label">总作业数</div>
          <div class="s-val">{{ jobSummary.total }}</div>
        </div>
        <div class="s-card">
          <div class="s-label">已完成</div>
          <div class="s-val" style="color:#10b981">{{ jobSummary.completed }}</div>
        </div>
        <div class="s-card">
          <div class="s-label">失败</div>
          <div class="s-val" style="color:#ef4444">{{ jobSummary.failed }}</div>
        </div>
        <div class="s-card">
          <div class="s-label">取消</div>
          <div class="s-val" style="color:#f59e0b">{{ jobSummary.cancelled }}</div>
        </div>
        <div class="s-card">
          <div class="s-label">总 CPU 小时</div>
          <div class="s-val">{{ jobSummary.cpuHours.toFixed(1) }}</div>
        </div>
        <div class="s-card">
          <div class="s-label">总 GPU 小时</div>
          <div class="s-val">{{ jobSummary.gpuHours.toFixed(1) }}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">作业明细</div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>作业ID</th><th>作业名</th><th>用户</th><th>账户</th>
                <th>分区</th><th>状态</th><th>开始时间</th><th>运行时长</th>
                <th>CPU小时</th><th>GPU小时</th><th>计费核时</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in jobRecords" :key="r.job_id">
                <td><code>{{ r.job_id }}</code></td>
                <td>{{ r.job_name || '-' }}</td>
                <td>{{ r.user || '-' }}</td>
                <td>{{ r.account || '-' }}</td>
                <td>{{ r.partition || '-' }}</td>
                <td><span :class="['state-badge', `state-${(r.state||'').toLowerCase()}`]">{{ r.state || '-' }}</span></td>
                <td>{{ fmtTime(r.start_time) }}</td>
                <td>{{ fmtElapsed(r.elapsed_secs) }}</td>
                <td>{{ (r.cpu_hours||0).toFixed(2) }}</td>
                <td>{{ (r.gpu_hours||0).toFixed(2) }}</td>
                <td><strong>{{ (r.billing_mins||0).toFixed(1) }}</strong></td>
              </tr>
              <tr v-if="jobRecords.length === 0">
                <td colspan="11" class="empty-cell">暂无数据</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- 机时消耗报表 -->
    <template v-else-if="filters.type === 'machine-time' && hasData">
      <div class="summary-cards">
        <div class="s-card">
          <div class="s-label">账户数</div>
          <div class="s-val">{{ machineRecords.length }}</div>
        </div>
        <div class="s-card">
          <div class="s-label">总 CPU 小时</div>
          <div class="s-val">{{ machineTotals.cpuHours.toFixed(1) }}</div>
        </div>
        <div class="s-card">
          <div class="s-label">总 GPU 小时</div>
          <div class="s-val">{{ machineTotals.gpuHours.toFixed(1) }}</div>
        </div>
        <div class="s-card">
          <div class="s-label">总计费核时</div>
          <div class="s-val" style="color:#667eea">{{ machineTotals.billingMins.toFixed(1) }}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">账户机时消耗</div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>账户</th><th>作业数</th><th>CPU小时</th>
                <th>节点小时</th><th>GPU小时</th><th>计费核时</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in machineRecords" :key="r.account">
                <td><strong>{{ r.account }}</strong></td>
                <td>{{ r.job_count || r.jobs?.length || '-' }}</td>
                <td>{{ (r.cpu_hours||0).toFixed(2) }}</td>
                <td>{{ (r.node_hours||0).toFixed(2) }}</td>
                <td>{{ (r.gpu_hours||0).toFixed(2) }}</td>
                <td><strong style="color:#667eea">{{ (r.billing_mins||0).toFixed(1) }}</strong></td>
              </tr>
              <tr v-if="machineRecords.length === 0">
                <td colspan="6" class="empty-cell">暂无数据</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- 节点运行报表 -->
    <template v-else-if="filters.type === 'node' && hasData">
      <div class="summary-cards">
        <div class="s-card">
          <div class="s-label">总节点数</div>
          <div class="s-val">{{ nodeStats.total }}</div>
        </div>
        <div class="s-card">
          <div class="s-label">在线节点</div>
          <div class="s-val" style="color:#10b981">{{ nodeStats.online }}</div>
        </div>
        <div class="s-card">
          <div class="s-label">离线节点</div>
          <div class="s-val" style="color:#ef4444">{{ nodeStats.down }}</div>
        </div>
        <div class="s-card">
          <div class="s-label">总 CPU 核</div>
          <div class="s-val">{{ nodeStats.totalCPU }}</div>
        </div>
        <div class="s-card">
          <div class="s-label">已分配 CPU</div>
          <div class="s-val" style="color:#667eea">{{ nodeStats.allocCPU }}</div>
        </div>
        <div class="s-card">
          <div class="s-label">CPU 使用率</div>
          <div class="s-val">{{ nodeStats.cpuPct.toFixed(1) }}%</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">节点详情</div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>节点名</th><th>状态</th><th>CPU总/已分配</th>
                <th>CPU使用率</th><th>内存总/已分配</th><th>内存使用率</th>
                <th>GPU</th><th>运行作业</th><th>分区</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="n in nodeRecords" :key="n.name">
                <td><code>{{ n.name }}</code></td>
                <td><span :class="['state-badge', nodeStateClass(n.state)]">{{ n.state }}</span></td>
                <td>{{ n.cpu_total }} / {{ n.cpu_allocated }}</td>
                <td>
                  <div class="mini-bar">
                    <div class="mini-fill" :style="{ width: n.cpu_usage_percent + '%', background: n.cpu_usage_percent > 90 ? '#ef4444' : '#667eea' }"></div>
                    <span>{{ n.cpu_usage_percent.toFixed(0) }}%</span>
                  </div>
                </td>
                <td>{{ fmtMem(n.memory_total_mb) }} / {{ fmtMem(n.memory_allocated_mb) }}</td>
                <td>
                  <div class="mini-bar">
                    <div class="mini-fill" :style="{ width: n.memory_usage_percent + '%', background: n.memory_usage_percent > 90 ? '#ef4444' : '#10b981' }"></div>
                    <span>{{ n.memory_usage_percent.toFixed(0) }}%</span>
                  </div>
                </td>
                <td>{{ n.gpu_info || '-' }}</td>
                <td>{{ n.running_jobs }}</td>
                <td>{{ (n.partitions||[]).join(', ') || '-' }}</td>
              </tr>
              <tr v-if="nodeRecords.length === 0">
                <td colspan="9" class="empty-cell">暂无数据</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <div v-else-if="!loading && !error && !hasData" class="card" style="text-align:center;padding:3rem;color:#9ca3af">
      <div style="font-size:3rem;margin-bottom:1rem">📊</div>
      <p>选择报表类型和时间范围后点击查询</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getApiBase, isAdmin } from '../utils/auth'
import axios from 'axios'

const loading = ref(false)
const error = ref('')

// 默认时间范围：本月
const now = new Date()
const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
const today = now.toISOString().split('T')[0]

const filters = ref({
  type: 'job',
  startDate: firstDay,
  endDate: today,
})

// 各类型数据
const jobRecords = ref<any[]>([])
const machineRecords = ref<any[]>([])
const nodeRecords = ref<any[]>([])

const hasData = computed(() => {
  if (filters.value.type === 'job') return jobRecords.value.length > 0
  if (filters.value.type === 'machine-time') return machineRecords.value.length > 0
  if (filters.value.type === 'node') return nodeRecords.value.length > 0
  return false
})

// 作业汇总
const jobSummary = computed(() => {
  const records = jobRecords.value
  return {
    total: records.length,
    completed: records.filter(r => (r.state||'').toUpperCase().includes('COMPLETED')).length,
    failed: records.filter(r => (r.state||'').toUpperCase().includes('FAILED')).length,
    cancelled: records.filter(r => (r.state||'').toUpperCase().includes('CANCEL')).length,
    cpuHours: records.reduce((s, r) => s + (r.cpu_hours || 0), 0),
    gpuHours: records.reduce((s, r) => s + (r.gpu_hours || 0), 0),
  }
})

// 机时汇总
const machineTotals = computed(() => ({
  cpuHours: machineRecords.value.reduce((s, r) => s + (r.cpu_hours || 0), 0),
  gpuHours: machineRecords.value.reduce((s, r) => s + (r.gpu_hours || 0), 0),
  billingMins: machineRecords.value.reduce((s, r) => s + (r.billing_mins || 0), 0),
}))

// 节点汇总
const nodeStats = computed(() => {
  const nodes = nodeRecords.value
  return {
    total: nodes.length,
    online: nodes.filter(n => !n.state?.toLowerCase().includes('down')).length,
    down: nodes.filter(n => n.state?.toLowerCase().includes('down')).length,
    totalCPU: nodes.reduce((s, n) => s + (n.cpu_total || 0), 0),
    allocCPU: nodes.reduce((s, n) => s + (n.cpu_allocated || 0), 0),
    cpuPct: nodes.length ? nodes.reduce((s, n) => s + (n.cpu_usage_percent || 0), 0) / nodes.length : 0,
  }
})

const token = () => localStorage.getItem('token') || sessionStorage.getItem('token') || ''

const loadReport = async () => {
  loading.value = true
  error.value = ''
  jobRecords.value = []
  machineRecords.value = []
  nodeRecords.value = []

  try {
    const { startDate, endDate, type } = filters.value

    if (type === 'job') {
      // 管理员拉全量，普通用户拉自己的
      const userParam = isAdmin() ? '' : `&user=${encodeURIComponent(getUserName())}`
      let url = `${getApiBase()}/api/jobs?page=1&page_size=2000&start_time=${startDate}&end_time=${endDate}${userParam}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } })
      if (!res.ok) throw new Error((await res.json()).error || '获取作业数据失败')
      const data = await res.json()
      // jobs API 返回的是 job_state 字段，需要映射到 state
      jobRecords.value = (data.data || []).map((j: any) => ({
        job_id: j.job_id,
        job_name: j.name,
        user: j.user_name || j.user_id || j.user,
        account: j.account,
        partition: j.partition,
        state: j.job_state,
        start_time: j.start_time,
        elapsed_secs: j.run_time,
        cpu_hours: j.cpus ? (j.run_time || 0) * (j.cpus || 0) / 3600 : 0,
        gpu_hours: 0,
        billing_mins: 0,
      }))
      // 尝试用 usage API 补充机时数据
      try {
        const uRes = await fetch(
          `${getApiBase()}/api/usage/user?user=${encodeURIComponent(getUserName())}&start_time=${startDate}&end_time=${endDate}`,
          { headers: { Authorization: `Bearer ${token()}` } }
        )
        if (uRes.ok) {
          const uData = await uRes.json()
          const usageMap: Record<string, any> = {}
          for (const r of (uData.data || [])) usageMap[r.job_id] = r
          jobRecords.value = jobRecords.value.map((j: any) => {
            const u = usageMap[j.job_id]
            if (u) return { ...j, cpu_hours: u.cpu_hours, gpu_hours: u.gpu_hours, billing_mins: u.billing_mins || u.billing_hours * 60 }
            return j
          })
        }
      } catch { /* 忽略，用基础数据 */ }

    } else if (type === 'machine-time') {
      const res = await fetch(
        `${getApiBase()}/api/usage/accounts?start_time=${startDate}&end_time=${endDate}`,
        { headers: { Authorization: `Bearer ${token()}` } }
      )
      if (!res.ok) throw new Error((await res.json()).error || '获取机时数据失败')
      const data = await res.json()
      machineRecords.value = data.data || []

    } else if (type === 'node') {
      const res = await fetch(`${getApiBase()}/api/dashboard/nodes`, {
        headers: { Authorization: `Bearer ${token()}` }
      })
      if (!res.ok) throw new Error((await res.json()).error || '获取节点数据失败')
      const data = await res.json()
      nodeRecords.value = data.data || []
    }
  } catch (e: any) {
    error.value = e.message || '查询失败'
  } finally {
    loading.value = false
  }
}

const getUserName = () => {
  try {
    const u = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}')
    return u.username || ''
  } catch { return '' }
}

// 导出 CSV
const exportCSV = () => {
  let rows: string[] = []
  const { type, startDate, endDate } = filters.value

  if (type === 'job') {
    rows = [
      '作业ID,作业名,用户,账户,分区,状态,开始时间,运行时长(秒),CPU小时,GPU小时,计费核时',
      ...jobRecords.value.map(r =>
        [r.job_id, `"${r.job_name||''}"`, r.user||'', r.account||'', r.partition||'',
         r.state||'', fmtTime(r.start_time), r.elapsed_secs||0,
         (r.cpu_hours||0).toFixed(2), (r.gpu_hours||0).toFixed(2), (r.billing_mins||0).toFixed(1)].join(',')
      )
    ]
  } else if (type === 'machine-time') {
    rows = [
      '账户,作业数,CPU小时,节点小时,GPU小时,计费核时',
      ...machineRecords.value.map(r =>
        [r.account, r.job_count||0, (r.cpu_hours||0).toFixed(2),
         (r.node_hours||0).toFixed(2), (r.gpu_hours||0).toFixed(2), (r.billing_mins||0).toFixed(1)].join(',')
      )
    ]
  } else if (type === 'node') {
    rows = [
      '节点名,状态,CPU总数,已分配CPU,CPU使用率%,内存总MB,已分配内存MB,内存使用率%,运行作业,分区',
      ...nodeRecords.value.map(n =>
        [n.name, n.state, n.cpu_total, n.cpu_allocated, n.cpu_usage_percent.toFixed(1),
         n.memory_total_mb, n.memory_allocated_mb, n.memory_usage_percent.toFixed(1),
         n.running_jobs, (n.partitions||[]).join(';')].join(',')
      )
    ]
  }

  const bom = '\uFEFF'
  const blob = new Blob([bom + rows.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `report_${type}_${startDate}_${endDate}.csv`
  a.click()
}

// 格式化工具
const fmtTime = (ts: any) => {
  if (!ts || ts === 0) return '-'
  try { return new Date(ts * 1000).toLocaleString('zh-CN') } catch { return '-' }
}

const fmtElapsed = (secs: any) => {
  if (!secs || secs <= 0) return '-'
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
  return h > 0 ? `${h}时${m}分` : m > 0 ? `${m}分${s}秒` : `${s}秒`
}

const fmtMem = (mb: number) => {
  if (!mb) return '-'
  return mb >= 1024 ? (mb / 1024).toFixed(1) + ' GB' : mb + ' MB'
}

const nodeStateClass = (state: string) => {
  const s = (state || '').toLowerCase()
  if (s.includes('idle')) return 'state-idle'
  if (s.includes('alloc') || s.includes('mix')) return 'state-running'
  if (s.includes('down') || s.includes('drain')) return 'state-failed'
  return 'state-unknown'
}

onMounted(() => loadReport())
</script>

<style scoped>
.reports-page { display: flex; flex-direction: column; gap: 1.5rem; }

.page-header { display: flex; justify-content: space-between; align-items: center; }
.page-header h3 { margin: 0; font-size: 1.3rem; color: #333; }

.filters-card { padding: 1.25rem 1.5rem; }
.filters-row { display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; }
.filter-group { display: flex; flex-direction: column; gap: 0.4rem; min-width: 140px; }
.filter-group label { font-size: 0.85rem; color: #666; font-weight: 600; }
.filter-group select, .filter-group input {
  padding: 0.55rem 0.75rem; border: 2px solid #e5e7eb;
  border-radius: 6px; font-size: 0.9rem; background: #fff;
}
.filter-group select:focus, .filter-group input:focus { outline: none; border-color: #667eea; }

.summary-cards {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1rem;
}
.s-card {
  background: #fff; border-radius: 10px; padding: 1.25rem 1rem;
  box-shadow: 0 1px 4px rgba(0,0,0,.06); text-align: center;
}
.s-label { font-size: 0.8rem; color: #9ca3af; margin-bottom: 0.5rem; }
.s-val { font-size: 1.6rem; font-weight: 700; color: #1f2937; }

.card-title { font-size: 1rem; font-weight: 700; color: #374151; margin-bottom: 1rem; }

.table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.data-table th {
  padding: 0.65rem 0.9rem; background: #f8f9fc; text-align: left;
  font-size: 0.78rem; font-weight: 700; color: #6b7280;
  border-bottom: 1.5px solid #e8eaf0; white-space: nowrap;
}
.data-table td { padding: 0.6rem 0.9rem; border-bottom: 1px solid #f3f4f8; color: #374151; }
.data-table tbody tr:hover { background: #f8f9fc; }
.empty-cell { text-align: center; color: #9ca3af; padding: 2rem !important; }

.state-badge {
  display: inline-block; padding: 0.2rem 0.55rem; border-radius: 10px;
  font-size: 0.75rem; font-weight: 600;
}
.state-completed, .state-idle { background: #d1fae5; color: #065f46; }
.state-running, .state-alloc { background: #dbeafe; color: #1e40af; }
.state-failed, .state-down { background: #fee2e2; color: #991b1b; }
.state-cancelled, .state-cancel { background: #fef3c7; color: #92400e; }
.state-unknown { background: #f3f4f6; color: #6b7280; }

.mini-bar {
  display: flex; align-items: center; gap: 0.4rem;
  min-width: 100px;
}
.mini-fill {
  height: 6px; border-radius: 3px; min-width: 2px;
  transition: width 0.3s;
}
.mini-bar span { font-size: 0.78rem; color: #6b7280; white-space: nowrap; }
</style>
