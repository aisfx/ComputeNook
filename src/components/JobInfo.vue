<template>
  <div class="job-info-wrap">
    <!-- 统计卡片区 -->
    <div class="stat-row">
      <!-- 作业总数 -->
      <div class="stat-block">
        <div class="stat-block-label">作业总数</div>
        <div class="stat-block-value">{{ totalJobs }}</div>
      </div>

      <!-- 等待资源 -->
      <div class="stat-block">
        <div class="stat-block-label">等待资源</div>
        <div class="stat-sub-row">
          <span class="stat-tag tag-pending">
            <span class="tag-dot dot-pending"></span>等待
          </span>
        </div>
        <div class="stat-block-value">{{ summary.pending }}</div>
      </div>

      <!-- 作业调度 -->
      <div class="stat-block">
        <div class="stat-block-label">作业调度</div>
        <div class="stat-sub-row">
          <span class="stat-tag tag-queue">
            <span class="tag-dot dot-queue"></span>排队
          </span>
        </div>
        <div class="stat-block-value">{{ summary.queued }}</div>
      </div>

      <!-- 作业执行 -->
      <div class="stat-block stat-block-wide">
        <div class="stat-block-label">作业执行</div>
        <div class="stat-exec-grid">
          <div class="stat-exec-item">
            <span class="stat-tag tag-running">
              <span class="tag-icon">▶</span>运行
            </span>
            <div class="stat-exec-val">{{ summary.running }}</div>
          </div>
          <div class="stat-exec-item">
            <span class="stat-tag tag-userheld">
              <span class="tag-icon">⏸</span>用户挂起
            </span>
            <div class="stat-exec-val">{{ summary.userHeld }}</div>
          </div>
          <div class="stat-exec-item">
            <span class="stat-tag tag-sysheld">
              <span class="tag-icon">⏸</span>系统挂起
            </span>
            <div class="stat-exec-val">{{ summary.sysHeld }}</div>
          </div>
        </div>
      </div>

      <!-- 作业完成 -->
      <div class="stat-block">
        <div class="stat-block-label">作业完成</div>
        <div class="stat-exec-grid">
          <div class="stat-exec-item">
            <span class="stat-tag tag-completed">
              <span class="tag-icon">✓</span>完成
            </span>
            <div class="stat-exec-val">{{ summary.completed }}</div>
          </div>
          <div class="stat-exec-item">
            <span class="stat-tag tag-failed">
              <span class="tag-icon">✕</span>失败
            </span>
            <div class="stat-exec-val">{{ summary.failed }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar-row">
      <div class="toolbar-left">
        <button class="btn-submit" @click="emit('submit-job')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          提交作业
        </button>
        <button class="btn-tool" @click="batchAction('restart')" :disabled="selectedIds.length === 0">重启</button>
        <button class="btn-tool" @click="batchAction('suspend')" :disabled="selectedIds.length === 0">挂起</button>
        <button class="btn-tool" @click="batchAction('resume')" :disabled="selectedIds.length === 0">恢复</button>
        <button class="btn-tool btn-tool-danger" @click="batchAction('cancel')" :disabled="selectedIds.length === 0">停止</button>
      </div>
      <div class="toolbar-right">
        <button class="btn-icon-sm" @click="loadJobs" :disabled="loading" title="刷新">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
        </button>
        <button class="btn-icon-sm" title="导出">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
      </div>
    </div>

    <!-- 搜索 + 筛选栏 -->
    <div class="filter-row">
      <div class="search-wrap">
        <svg class="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          v-model="searchText"
          class="search-input"
          placeholder="默认按照作业名称搜索"
          @input="pagination.page = 1"
        />
      </div>
      <div class="filter-right">
        <div class="view-switch">
          <button :class="['vs-btn', { active: viewMode === 'my' }]" @click="viewMode = 'my'; pagination.page = 1; loadJobs()">我的作业</button>
          <button :class="['vs-btn', { active: viewMode === 'all' }]" @click="viewMode = 'all'; pagination.page = 1; loadJobs()">所有作业</button>
        </div>
        <select v-model="statusFilter" class="filter-sel" @change="pagination.page = 1">
          <option value="">全部状态</option>
          <option value="RUNNING">运行中</option>
          <option value="PENDING">等待中</option>
          <option value="COMPLETED">已完成</option>
          <option value="FAILED">失败</option>
          <option value="SUSPENDED">已挂起</option>
        </select>
        <select v-model="partitionFilter" class="filter-sel" @change="pagination.page = 1">
          <option value="">全部分区</option>
          <option v-for="p in partitions" :key="p" :value="p">{{ p }}</option>
        </select>
      </div>
    </div>

    <!-- 表格 -->
    <div class="table-wrap">
      <table class="jobs-table">
        <thead>
          <tr>
            <th class="th-check">
              <input type="checkbox" :checked="allSelected" @change="toggleSelectAll" />
            </th>
            <th>作业ID</th>
            <th v-if="viewMode === 'all'">用户</th>
            <th>作业名称 <span class="sort-icon">↕</span></th>
            <th>状态 <span class="sort-icon">↕</span></th>
            <th>作业类型</th>
            <th>分区</th>
            <th>核心数 <span class="sort-icon">↕</span></th>
            <th>提交时间 <span class="sort-icon">↕</span></th>
            <th>开始时间 <span class="sort-icon">↕</span></th>
            <th>运行时长</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="job in filteredJobs" :key="job.id" :class="{ selected: selectedIds.includes(job.id) }">
            <td class="td-check">
              <input type="checkbox" :value="job.id" v-model="selectedIds" />
            </td>
            <td class="td-id">{{ job.id }}</td>
            <td v-if="viewMode === 'all'">{{ job.user }}</td>
            <td class="td-name">{{ job.name }}</td>
            <td><span :class="['job-status', `js-${job.status.toLowerCase()}`]">{{ statusLabel(job.status) }}</span></td>
            <td class="td-type">{{ job.jobType || 'batch' }}</td>
            <td>{{ job.partition }}</td>
            <td>{{ job.cpus }}</td>
            <td class="td-time">{{ job.submitTime }}</td>
            <td class="td-time">{{ job.startTime }}</td>
            <td>{{ job.runTime }}</td>
            <td>
              <div class="row-actions">
                <button class="ra-btn" @click="$emit('view-detail', job)" title="详情">详情</button>
                <button
                  class="ra-btn ra-danger"
                  v-if="(job.status === 'RUNNING' || job.status === 'PENDING') && canControlJob(job)"
                  @click="cancelJob(job)"
                  title="取消"
                >取消</button>
                <button class="ra-btn" @click="openDirectory(job)" title="目录">目录</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="loading" class="tbl-empty">
        <div class="spinner"></div>
        <span>查询中...</span>
      </div>
      <div v-else-if="filteredJobs.length === 0" class="tbl-empty">
        暂无作业数据
      </div>
    </div>

    <!-- 分页 -->
    <div class="pagination" v-if="pagination.total > 0">
      <button class="page-btn" :disabled="pagination.page <= 1" @click="changePage(pagination.page - 1)">‹ 上一页</button>
      <div class="page-numbers">
        <button
          v-for="p in pageRange" :key="p"
          :class="['page-num', { active: p === pagination.page, ellipsis: p === '...' }]"
          :disabled="p === '...'"
          @click="p !== '...' && changePage(p as number)"
        >{{ p }}</button>
      </div>
      <button class="page-btn" :disabled="pagination.page >= pagination.totalPages" @click="changePage(pagination.page + 1)">下一页 ›</button>
      <span class="page-info">共 {{ pagination.total }} 个作业</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getUser, getApiBase, isAdmin } from '../utils/auth'
import notification from '../utils/notification'
import { dialog } from '../utils/dialog'

const emit = defineEmits(['view-detail', 'open-directory', 'submit-job'])

const viewMode = ref<'my' | 'all'>('my')
const statusFilter = ref('')
const partitionFilter = ref('')
const searchText = ref('')
const partitions = ref<string[]>([])
const currentUserInfo = ref<any>(null)
const currentUser = computed(() => currentUserInfo.value?.username || '')
const loading = ref(false)
const selectedIds = ref<any[]>([])

const summary = ref({ running: 0, pending: 0, queued: 0, completed: 0, failed: 0, userHeld: 0, sysHeld: 0 })
const allJobs = ref<any[]>([])
const pagination = ref({ page: 1, pageSize: 15, total: 0, totalPages: 0 })

const totalJobs = computed(() => allJobs.value.length)

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
  if (viewMode.value === 'my') jobs = jobs.filter(j => j.user === currentUser.value)
  if (statusFilter.value) jobs = jobs.filter(j => j.status === statusFilter.value)
  if (partitionFilter.value) jobs = jobs.filter(j => j.partition === partitionFilter.value)
  if (searchText.value.trim()) {
    const q = searchText.value.trim().toLowerCase()
    jobs = jobs.filter(j => j.name?.toLowerCase().includes(q) || String(j.id).includes(q))
  }
  return jobs
})

const allSelected = computed(() =>
  filteredJobs.value.length > 0 && filteredJobs.value.every(j => selectedIds.value.includes(j.id))
)

const toggleSelectAll = () => {
  if (allSelected.value) {
    selectedIds.value = selectedIds.value.filter(id => !filteredJobs.value.find(j => j.id === id))
  } else {
    const ids = filteredJobs.value.map(j => j.id)
    selectedIds.value = [...new Set([...selectedIds.value, ...ids])]
  }
}

const statusLabel = (s: string) => {
  const map: Record<string, string> = {
    RUNNING: '运行中', PENDING: '等待中', COMPLETED: '已完成',
    FAILED: '失败', CANCELLED: '已取消', TIMEOUT: '超时',
    SUSPENDED: '已挂起', UNKNOWN: '未知'
  }
  return map[s] || s
}

const updateSummary = () => {
  const jobs = viewMode.value === 'my'
    ? allJobs.value.filter(j => j.user === currentUser.value)
    : allJobs.value
  summary.value = {
    running: jobs.filter(j => j.status === 'RUNNING').length,
    pending: jobs.filter(j => j.status === 'PENDING').length,
    queued: jobs.filter(j => j.status === 'PENDING').length,
    completed: jobs.filter(j => j.status === 'COMPLETED').length,
    failed: jobs.filter(j => j.status === 'FAILED').length,
    userHeld: jobs.filter(j => j.status === 'SUSPENDED').length,
    sysHeld: 0,
  }
}

const canControlJob = (job: any) => currentUserInfo.value?.isAdmin || job.user === currentUser.value

const cancelJob = async (job: any) => {
  if (!await dialog.confirm(`确定要取消作业 ${job.id} - ${job.name} 吗？`, { title: '取消作业', danger: true })) return
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    const res = await fetch(`${getApiBase()}/api/jobs/${job.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || '取消失败') }
    notification.success('作业取消成功')
    await loadJobs()
  } catch (e: any) { notification.error(e.message || '取消失败') }
}

const batchAction = async (action: string) => {
  if (selectedIds.value.length === 0) return
  const labels: Record<string, string> = { restart: '重启', suspend: '挂起', resume: '恢复', cancel: '停止' }
  if (!await dialog.confirm(`确定要${labels[action]}选中的 ${selectedIds.value.length} 个作业吗？`, { title: '批量操作' })) return
  notification.success(`已发送${labels[action]}指令`)
  selectedIds.value = []
}

const openDirectory = (job: any) => {
  if (!job.directory || job.directory === '-') { notification.error('作业目录不可用'); return }
  emit('open-directory', job.directory)
}

const expandHostList = (hostlist: string): string[] => {
  const result: string[] = []
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
    if (!m) { if (part) result.push(part); continue }
    const prefix = m[1], ranges = m[2], suffix = m[3]
    for (const seg of ranges.split(',')) {
      const range = seg.trim()
      const dash = range.match(/^(\d+)-(\d+)$/)
      if (dash) {
        const from = parseInt(dash[1]), to = parseInt(dash[2])
        const pad = dash[1].length > 1 ? dash[1].length : 0
        for (let i = from; i <= to; i++) result.push(prefix + (pad ? String(i).padStart(pad, '0') : i) + suffix)
      } else { result.push(prefix + range + suffix) }
    }
  }
  return result
}

const loadJobs = async () => {
  loading.value = true
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) throw new Error('请先登录')
    let url = `${getApiBase()}/api/jobs?page=${pagination.value.page}&page_size=${pagination.value.pageSize}`
    if (viewMode.value === 'my') url += `&user=${encodeURIComponent(currentUser.value)}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) { allJobs.value = []; updateSummary(); return }
    const result = await res.json()
    if (result.data && Array.isArray(result.data)) {
      allJobs.value = result.data.map((job: any) => {
        let runTime = 0
        if (job.end_time && job.start_time && job.end_time > 0 && job.start_time > 0) runTime = job.end_time - job.start_time
        else if (job.start_time && job.start_time > 0) runTime = Math.floor(Date.now() / 1000) - job.start_time
        let nodeNames: string[] = []
        if (typeof job.nodes === 'string' && job.nodes && job.nodes !== 'None assigned') nodeNames = expandHostList(job.nodes)
        if (nodeNames.length === 0 && job.batch_host) nodeNames = [job.batch_host]
        return {
          id: job.job_id || job.id,
          user: job.user_name || job.user,
          name: job.name || `Job ${job.job_id || job.id}`,
          status: job.job_state || job.status || 'UNKNOWN',
          partition: job.partition || '-',
          nodes: nodeNames.length || (typeof job.nodes === 'number' ? job.nodes : 0),
          nodeNames,
          cpus: job.cpus || 0,
          jobType: job.job_type || 'batch',
          submitTime: formatTime(job.submit_time),
          startTime: formatTime(job.start_time),
          start_time: job.start_time || 0,
          runTime: formatDuration(runTime),
          directory: job.work_dir || job.directory || '-',
          account: job.account || '-',
          timeLimit: job.time_limit || 0
        }
      })
      if (result.pagination) {
        pagination.value = {
          page: result.pagination.page,
          pageSize: result.pagination.page_size,
          total: result.pagination.total,
          totalPages: result.pagination.total_pages
        }
      }
    } else { allJobs.value = [] }
    updateSummary()
  } catch (e) {
    console.error('Failed to load jobs:', e)
    allJobs.value = []
    updateSummary()
  } finally { loading.value = false }
}

const changePage = (p: number) => {
  if (p >= 1 && p <= pagination.value.totalPages) { pagination.value.page = p; loadJobs() }
}

const formatTime = (ts: any): string => {
  if (!ts || ts === 0) return '-'
  try {
    const d = new Date(ts * 1000)
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\//g, '-')
  } catch { return '-' }
}

const formatDuration = (s: any): string => {
  if (!s || s <= 0) return '-'
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}天${h}时${m}分`
  if (h > 0) return `${h}时${m}分`
  if (m > 0) return `${m}分`
  return `${s}秒`
}

const loadPartitions = async () => {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) return
    const res = await fetch(`${getApiBase()}/api/jobs/partitions/list`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return
    const result = await res.json()
    partitions.value = (result.data || []).map((p: any) => p.name).filter(Boolean)
  } catch { partitions.value = ['compute', 'gpu', 'memory', 'debug'] }
}

onMounted(() => {
  currentUserInfo.value = getUser()
  if (!isAdmin()) viewMode.value = 'my'
  loadPartitions()
  loadJobs()
})

defineExpose({ loadJobs })
</script>

<style scoped>
.job-info-wrap {
  display: flex;
  flex-direction: column;
  gap: 0;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-lg);
  overflow: hidden;
}

/* ===== 统计卡片区 ===== */
.stat-row {
  display: flex;
  gap: 0;
  border-bottom: 1px solid hsl(var(--border));
}

.stat-block {
  flex: 1;
  padding: 14px 20px;
  border-right: 1px solid hsl(var(--border));
  min-width: 0;
}
.stat-block:last-child { border-right: none; }
.stat-block-wide { flex: 2; }

.stat-block-label {
  font-size: 0.72rem;
  color: hsl(var(--muted-foreground));
  font-weight: 500;
  margin-bottom: 8px;
  white-space: nowrap;
}

.stat-block-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: hsl(var(--foreground));
  line-height: 1;
  margin-top: 4px;
}

.stat-sub-row {
  margin-bottom: 6px;
}

/* 标签 */
.stat-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
}
.tag-dot {
  width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
}
.tag-icon { font-size: 0.65rem; }

.tag-pending  { background: hsl(var(--warning) / 0.12); color: hsl(var(--warning)); }
.dot-pending  { background: hsl(var(--warning)); }
.tag-queue    { background: hsl(220 60% 55% / 0.12); color: hsl(220 60% 55%); }
.dot-queue    { background: hsl(220 60% 55%); }
.tag-running  { background: hsl(var(--success) / 0.12); color: hsl(var(--success)); }
.tag-userheld { background: hsl(220 60% 55% / 0.12); color: hsl(220 60% 55%); }
.tag-sysheld  { background: hsl(220 60% 55% / 0.12); color: hsl(220 60% 55%); }
.tag-completed{ background: hsl(var(--success) / 0.12); color: hsl(var(--success)); }
.tag-failed   { background: hsl(var(--destructive) / 0.12); color: hsl(var(--destructive)); }

.stat-exec-grid {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 2px;
}
.stat-exec-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-exec-val {
  font-size: 1.5rem;
  font-weight: 700;
  color: hsl(var(--foreground));
  line-height: 1;
}

/* ===== 工具栏 ===== */
.toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid hsl(var(--border));
  gap: 8px;
  background: hsl(var(--background));
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-submit {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.btn-submit:hover { background: hsl(var(--primary) / 0.88); }

.btn-tool {
  padding: 5px 12px;
  background: hsl(var(--card));
  color: hsl(var(--foreground));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.btn-tool:hover:not(:disabled) { background: hsl(var(--accent)); }
.btn-tool:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-tool-danger { color: hsl(var(--destructive)); border-color: hsl(var(--destructive) / 0.3); }
.btn-tool-danger:hover:not(:disabled) { background: hsl(var(--destructive) / 0.08); }

.btn-icon-sm {
  width: 30px; height: 30px;
  display: inline-flex; align-items: center; justify-content: center;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  transition: all 0.15s;
}
.btn-icon-sm:hover:not(:disabled) { background: hsl(var(--accent)); color: hsl(var(--foreground)); }
.btn-icon-sm:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-icon-sm svg { transition: transform 0.3s; }
.btn-icon-sm:hover svg { transform: rotate(180deg); }

/* ===== 搜索 + 筛选 ===== */
.filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid hsl(var(--border));
  gap: 12px;
  background: hsl(var(--background));
}

.search-wrap {
  position: relative;
  flex: 1;
  max-width: 320px;
}
.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: hsl(var(--muted-foreground));
  pointer-events: none;
}
.search-input {
  width: 100%;
  padding: 6px 10px 6px 30px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  color: hsl(var(--foreground));
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.search-input:focus { border-color: hsl(var(--ring)); box-shadow: 0 0 0 2px hsl(var(--ring) / 0.15); }
.search-input::placeholder { color: hsl(var(--muted-foreground)); }

.filter-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.view-switch {
  display: flex;
  background: hsl(var(--muted));
  border-radius: var(--radius-md);
  padding: 2px;
  gap: 2px;
}
.vs-btn {
  padding: 4px 12px;
  border: none;
  background: transparent;
  color: hsl(var(--muted-foreground));
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  border-radius: calc(var(--radius-md) - 2px);
  transition: all 0.15s;
  white-space: nowrap;
}
.vs-btn.active {
  background: hsl(var(--card));
  color: hsl(var(--foreground));
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.filter-sel {
  padding: 5px 10px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  font-size: 0.8rem;
  color: hsl(var(--foreground));
  cursor: pointer;
  outline: none;
  height: 30px;
}
.filter-sel:focus { border-color: hsl(var(--ring)); }

/* ===== 表格 ===== */
.table-wrap {
  overflow-x: auto;
  flex: 1;
}

.jobs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.jobs-table thead tr {
  background: hsl(var(--muted) / 0.4);
}

.jobs-table th {
  padding: 9px 12px;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  border-bottom: 1px solid hsl(var(--border));
  white-space: nowrap;
}

.th-check, .td-check { width: 36px; padding: 9px 8px 9px 16px !important; }

.sort-icon { font-size: 0.65rem; opacity: 0.5; }

.jobs-table td {
  padding: 9px 12px;
  color: hsl(var(--foreground));
  border-bottom: 1px solid hsl(var(--border));
  white-space: nowrap;
}

.jobs-table tbody tr:last-child td { border-bottom: none; }
.jobs-table tbody tr:hover { background: hsl(var(--muted) / 0.25); }
.jobs-table tbody tr.selected { background: hsl(var(--primary) / 0.05); }

.td-id { font-weight: 600; }
.td-name { max-width: 160px; overflow: hidden; text-overflow: ellipsis; }
.td-time { color: hsl(var(--muted-foreground)); font-size: 0.78rem; }
.td-type { color: hsl(var(--muted-foreground)); }

/* 状态 badge */
.job-status {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
}
.js-running   { background: hsl(var(--success) / 0.12); color: hsl(var(--success)); }
.js-pending   { background: hsl(var(--warning) / 0.12); color: hsl(var(--warning)); }
.js-completed { background: hsl(220 60% 55% / 0.12); color: hsl(220 60% 55%); }
.js-failed    { background: hsl(var(--destructive) / 0.12); color: hsl(var(--destructive)); }
.js-cancelled { background: hsl(var(--muted)); color: hsl(var(--muted-foreground)); }
.js-suspended { background: hsl(var(--warning) / 0.12); color: hsl(var(--warning)); }
.js-timeout   { background: hsl(var(--destructive) / 0.12); color: hsl(var(--destructive)); }
.js-unknown   { background: hsl(var(--muted)); color: hsl(var(--muted-foreground)); }

/* 行操作按钮 */
.row-actions { display: flex; gap: 4px; }
.ra-btn {
  padding: 3px 8px;
  background: transparent;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);
  font-size: 0.72rem;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
}
.ra-btn:hover { background: hsl(var(--accent)); color: hsl(var(--foreground)); }
.ra-danger { color: hsl(var(--destructive)); border-color: hsl(var(--destructive) / 0.3); }
.ra-danger:hover { background: hsl(var(--destructive) / 0.08); }

/* 空状态 */
.tbl-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 24px;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

/* 分页 */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 16px;
  border-top: 1px solid hsl(var(--border));
}

.page-btn {
  padding: 5px 12px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  background: hsl(var(--card));
  color: hsl(var(--foreground));
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s;
}
.page-btn:hover:not(:disabled) { background: hsl(var(--accent)); }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.page-numbers { display: flex; gap: 3px; }
.page-num {
  min-width: 30px; height: 30px;
  padding: 0 6px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);
  background: hsl(var(--card));
  color: hsl(var(--foreground));
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s;
}
.page-num:hover:not(:disabled):not(.active) { background: hsl(var(--accent)); }
.page-num.active {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-color: hsl(var(--primary));
  font-weight: 600;
}
.page-num.ellipsis { border: none; background: none; cursor: default; color: hsl(var(--muted-foreground)); }

.page-info { font-size: 0.78rem; color: hsl(var(--muted-foreground)); margin-left: 4px; }

/* spinner */
.spinner {
  width: 16px; height: 16px;
  border: 2px solid hsl(var(--border));
  border-top-color: hsl(var(--primary));
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 900px) {
  .stat-row { flex-wrap: wrap; }
  .stat-block { min-width: 50%; border-bottom: 1px solid hsl(var(--border)); }
  .filter-row { flex-wrap: wrap; }
  .search-wrap { max-width: 100%; }
}
</style>
