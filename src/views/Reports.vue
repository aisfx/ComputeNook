<template>
  <div class="reports-page">
    <!-- 顶部筛选栏 -->
    <div class="filter-bar">
      <span class="page-title">📊 报表中心</span>
      <div class="filter-bar-right">
        <div class="filter-item">
          <label>开始日期</label>
          <input type="date" v-model="filters.startDate" :max="filters.endDate" />
        </div>
        <div class="filter-item">
          <label>结束日期</label>
          <input type="date" v-model="filters.endDate" :min="filters.startDate" />
        </div>
        <div class="filter-item">
          <label>队列</label>
          <select v-model="filters.partition">
            <option value="">全部</option>
            <option v-for="p in partitions" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>
        <span v-if="dateError" class="date-error">⚠ {{ dateError }}</span>
        <button class="btn-primary" @click="loadAll" :disabled="loading || !!dateError">
          {{ loading ? '查询中...' : '🔍 查询' }}
        </button>
        <button class="btn-secondary" @click="exportExcel" :disabled="!hasAnyData">
          📥 导出 Excel
        </button>
      </div>
    </div>

    <div v-if="loading" class="state-card">
      <div class="spinner"></div><span>加载中...</span>
    </div>
    <div v-else-if="globalError" class="state-card error-state">⚠ {{ globalError }}</div>

    <!-- 图表区域：queried 后始终渲染，用 v-show 控制可见性保证 ref 有效 -->
    <template v-if="queried">
      <!-- 作业趋势折线图 -->
      <div class="card chart-card">
        <div class="card-title">每月各队列作业数趋势</div>
        <div ref="lineChartRef" style="width:100%;height:300px"></div>
      </div>

      <!-- 作业规模 + 核时柱状图 -->
      <div class="chart-row">
        <div class="card chart-card">
          <div class="card-title">作业规模分布</div>
          <div ref="scaleChartRef" style="width:100%;height:280px"></div>
        </div>
        <div class="card chart-card">
          <div class="card-title">GPU / CPU 核时用量</div>
          <div ref="usageChartRef" style="width:100%;height:280px"></div>
        </div>
      </div>

      <!-- 计费核时 + 配额使用进度 -->
      <div class="chart-row">
        <div class="card chart-card">
          <div class="card-title">计费核时使用比例</div>
          <div ref="billingChartRef" style="width:100%;height:280px"></div>
        </div>
        <div class="card chart-card">
          <div class="card-title">配额使用率 <span class="account-tag" v-if="quotaStats?.account">{{ quotaStats.account }}</span></div>
          <div ref="quotaChartRef" style="width:100%;height:280px"></div>
        </div>
      </div>

      <!-- 存储用量柱状图 -->
      <div class="card" v-show="storageStats && storageStats.length > 0">
        <div class="card-title">存储配额使用情况</div>
        <div ref="storageChartRef" :style="{ width:'100%', height: storageChartHeight + 'px' }"></div>
      </div>

      <!-- QoS 计费核时使用量 -->
      <div class="card chart-card">
        <div class="card-title">QoS 计费核时使用量</div>
        <div ref="qosChartRef" style="width:100%;height:280px"></div>
      </div>
    </template>

    <div v-else-if="!loading" class="state-card">
      <div class="empty-icon">📊</div>
      <p>暂无数据</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import * as echarts from 'echarts'
import axios from 'axios'
import { reportAPI, type JobStatsResult, type UsageStatsResult, type StorageStatItem, type QuotaStatsResult, type QoSUsageItem } from '../api/report'

function formatDate(d: Date) { return d.toISOString().split('T')[0] }
const today = new Date()
const thirtyDaysAgo = new Date(today)
thirtyDaysAgo.setDate(today.getDate() - 30)

const loading = ref(false)
const globalError = ref('')
const partitions = ref<string[]>([])

const filters = ref({
  startDate: formatDate(today),
  endDate: formatDate(today),
  partition: '',
})

const jobStats     = ref<JobStatsResult | null>(null)
const usageStats   = ref<UsageStatsResult | null>(null)
const storageStats = ref<StorageStatItem[] | null>(null)
const quotaStats   = ref<QuotaStatsResult | null>(null)
const qosUsage     = ref<QoSUsageItem[]>([])

const lineChartRef    = ref<HTMLElement | null>(null)
const scaleChartRef   = ref<HTMLElement | null>(null)
const usageChartRef   = ref<HTMLElement | null>(null)
const storageChartRef = ref<HTMLElement | null>(null)
const qosChartRef     = ref<HTMLElement | null>(null)
const billingChartRef = ref<HTMLElement | null>(null)
const quotaChartRef   = ref<HTMLElement | null>(null)
let lineChart: echarts.ECharts | null = null
let scaleChart: echarts.ECharts | null = null
let usageChart: echarts.ECharts | null = null
let storageChart: echarts.ECharts | null = null
let qosChart: echarts.ECharts | null = null
let billingChart: echarts.ECharts | null = null
let quotaChart: echarts.ECharts | null = null

const dateError = computed(() => {
  if (filters.value.startDate && filters.value.endDate && filters.value.startDate > filters.value.endDate)
    return '开始日期不能晚于结束日期'
  return ''
})

// 查询完成后始终显示图表区域（各图自带 mock 兜底）
const hasAnyData = computed(() => queried.value)
const queried = ref(false)

const storageChartHeight = computed(() =>
  Math.max(260, (storageStats.value?.length ?? 0) * 60)
)

async function loadPartitions() {
  try {
    const res = await axios.get<{ data: string[] }>('/jobs/partitions/list')
    partitions.value = res.data?.data ?? []
  } catch { partitions.value = [] }
}

async function loadAll() {
  if (dateError.value) return
  loading.value = true
  globalError.value = ''
  queried.value = false
  jobStats.value = null; usageStats.value = null
  storageStats.value = null; quotaStats.value = null; qosUsage.value = []
  disposeCharts()

  const params = {
    start_time: filters.value.startDate,
    end_time:   filters.value.endDate,
    partition:  filters.value.partition || undefined,
    // 不传 user 参数，后端强制查当前登录用户自己
  }

  try {
    const [jobRes, usageRes, storageRes, quotaRes, qosRes] = await Promise.allSettled([
      reportAPI.getJobStats(params),
      reportAPI.getUsageStats(params),
      reportAPI.getStorageStats(params),
      reportAPI.getQuotaStats(params),
      reportAPI.getQoSUsage(params),
    ])
    if (jobRes.status === 'fulfilled')     jobStats.value     = jobRes.value.data.data
    if (usageRes.status === 'fulfilled')   usageStats.value   = usageRes.value.data.data
    if (storageRes.status === 'fulfilled') storageStats.value = storageRes.value.data.data
    if (quotaRes.status === 'fulfilled')   quotaStats.value   = quotaRes.value.data.data
    // QoS 接口失败时用 mock 数据兜底，保证图表始终可见
    if (qosRes.status === 'fulfilled' && qosRes.value.data.data?.length) {
      qosUsage.value = qosRes.value.data.data
    } else {
      qosUsage.value = [
        { qos_name: 'normal',   used_billing_hours: 0, total_billing_hours: 0,    usage_percent: 0,  status: 'NORMAL' },
        { qos_name: 'high',     used_billing_hours: 0, total_billing_hours: 0,    usage_percent: 0,  status: 'NORMAL' },
        { qos_name: 'gpu',      used_billing_hours: 0, total_billing_hours: 0,    usage_percent: 0,  status: 'NORMAL' },
      ]
    }
    queried.value = true
    loading.value = false
  } catch (e: any) {
    globalError.value = e?.message || '查询失败'
  } finally {
    loading.value = false
  }
}

function disposeCharts() {
  lineChart?.dispose();    lineChart = null
  scaleChart?.dispose();   scaleChart = null
  usageChart?.dispose();   usageChart = null
  storageChart?.dispose(); storageChart = null
  qosChart?.dispose();     qosChart = null
  billingChart?.dispose(); billingChart = null
  quotaChart?.dispose();   quotaChart = null
}

function renderAllCharts() {
  console.log('[Charts] renderAllCharts called', {
    line: lineChartRef.value,
    scale: scaleChartRef.value,
    usage: usageChartRef.value,
  })
  renderLineChart()
  renderScaleChart()
  renderUsageChart()
  renderStorageChart()
  renderQoSChart()
  renderBillingChart()
  renderQuotaChart()
}

// queried 变为 true 时 DOM 已就绪，直接渲染
watch(queried, async (val) => {
  if (val) {
    await nextTick()
    await nextTick()
    console.log('[Charts] watch queried triggered, lineRef=', lineChartRef.value)
    renderAllCharts()
  }
})

// 统一颜色配置（浅色主题）
const C = {
  text:       '#374151',
  muted:      '#6b7280',
  axis:       '#d1d5db',
  split:      '#f3f4f6',
  colors:     ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'],
}

// 月度作业趋势折线图
function renderLineChart() {
  if (!lineChartRef.value) return
  if (!lineChart) lineChart = echarts.init(lineChartRef.value)
  const counts = jobStats.value?.monthly_job_counts ?? []
  const hasData = counts.length > 0
  const months = hasData ? [...new Set(counts.map(c => c.month))].sort() : ['2026-01','2026-02','2026-03','2026-04']
  const queues = hasData ? [...new Set(counts.map(c => c.partition))] : ['normal','gpu']

  lineChart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: '#fff', borderColor: '#e5e7eb', textStyle: { color: C.text } },
    legend: { data: queues, textStyle: { color: C.muted }, bottom: 4 },
    grid: { left: '3%', right: '4%', bottom: '14%', top: '6%', containLabel: true },
    xAxis: { type: 'category', data: months, boundaryGap: false, axisLabel: { color: C.muted, fontSize: 12 }, axisLine: { lineStyle: { color: C.axis } }, axisTick: { show: false } },
    yAxis: { type: 'value', name: '作业数', nameTextStyle: { color: C.muted }, axisLabel: { color: C.muted }, splitLine: { lineStyle: { color: C.split } }, axisLine: { show: false } },
    series: queues.map((q, i) => ({
      name: q, type: 'line' as const, smooth: true, symbol: 'circle', symbolSize: 7,
      lineStyle: { width: 2.5, color: C.colors[i % C.colors.length] },
      itemStyle: { color: C.colors[i % C.colors.length] },
      areaStyle: { color: C.colors[i % C.colors.length], opacity: 0.06 },
      data: hasData ? months.map(m => counts.find(c => c.month === m && c.partition === q)?.count ?? 0) : [0,0,0,0],
    })),
  })
}

// 作业规模柱状图
function renderScaleChart() {
  if (!scaleChartRef.value) return
  if (!scaleChart) scaleChart = echarts.init(scaleChartRef.value)
  const dist = jobStats.value?.job_scale_distribution ?? []
  const total = jobStats.value?.total_jobs ?? 0
  const ranges = dist.length > 0 ? dist : [
    { range: '1-4核', count: 0 }, { range: '5-16核', count: 0 },
    { range: '17-64核', count: 0 }, { range: '64核以上', count: 0 },
  ]
  scaleChart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: '#fff', borderColor: '#e5e7eb', textStyle: { color: C.text },
      formatter: (p: any) => { const pct = total > 0 ? (p[0].value / total * 100).toFixed(1) : 0; return `${p[0].name}<br/>作业数: <b>${p[0].value}</b>（${pct}%）` } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '6%', containLabel: true },
    xAxis: { type: 'category', data: ranges.map(d => d.range), axisLabel: { color: C.muted }, axisLine: { lineStyle: { color: C.axis } }, axisTick: { show: false } },
    yAxis: { type: 'value', name: '作业数', nameTextStyle: { color: C.muted }, axisLabel: { color: C.muted }, splitLine: { lineStyle: { color: C.split } }, axisLine: { show: false } },
    series: [{ type: 'bar', data: ranges.map(d => d.count), itemStyle: { color: C.colors[0], borderRadius: [6,6,0,0] }, label: { show: true, position: 'top', color: C.muted, fontSize: 12 }, barMaxWidth: 56 }],
  })
}

// GPU / CPU 核时柱状图
function renderUsageChart() {
  if (!usageChartRef.value) return
  if (!usageChart) usageChart = echarts.init(usageChartRef.value)
  const u = usageStats.value
  usageChart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: '#fff', borderColor: '#e5e7eb', textStyle: { color: C.text } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '6%', containLabel: true },
    xAxis: { type: 'category', data: ['GPU 卡时', 'CPU 核时', '计费核时'], axisLabel: { color: C.muted }, axisLine: { lineStyle: { color: C.axis } }, axisTick: { show: false } },
    yAxis: { type: 'value', name: '小时(h)', nameTextStyle: { color: C.muted }, axisLabel: { color: C.muted }, splitLine: { lineStyle: { color: C.split } }, axisLine: { show: false } },
    series: [{
      type: 'bar',
      data: [
        { value: u ? +u.gpu_hours.toFixed(2) : 0,     itemStyle: { color: C.colors[0] } },
        { value: u ? +u.cpu_hours.toFixed(2) : 0,     itemStyle: { color: C.colors[1] } },
        { value: u ? +u.billing_hours.toFixed(2) : 0, itemStyle: { color: C.colors[2] } },
      ],
      label: { show: true, position: 'top', color: C.muted, fontSize: 12, formatter: (p: any) => `${p.value}h` },
      barMaxWidth: 56, itemStyle: { borderRadius: [6,6,0,0] },
    }],
  })
}

// 存储用量水平柱状图
function renderStorageChart() {
  if (!storageChartRef.value || !storageStats.value?.length) return
  if (!storageChart) storageChart = echarts.init(storageChartRef.value)
  const items = storageStats.value
  const labels = items.map(i => `${i.username}  ${i.filesystem}`)
  const barColors = items.map(i => i.over_soft_limit ? '#f59e0b' : '#10b981')
  storageChart.resize()
  storageChart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: '#fff', borderColor: '#e5e7eb', textStyle: { color: C.text },
      formatter: (params: any[]) => { const i = items[params[0].dataIndex]; return `<b>${i.username}</b> ${i.filesystem}<br/>已用: <b>${i.used_gb.toFixed(2)} GB</b><br/>软限制: ${i.soft_limit_gb.toFixed(2)} GB<br/>硬限制: ${i.hard_limit_gb.toFixed(2)} GB<br/>使用率: <b>${i.usage_percent.toFixed(1)}%</b>${i.over_soft_limit ? '<br/><span style="color:#f59e0b">⚠ 超软限制</span>' : ''}` },
    },
    legend: { data: ['已用量', '软限制', '硬限制'], textStyle: { color: C.muted }, top: 4 },
    grid: { left: '2%', right: '8%', top: 36, bottom: '2%', containLabel: true },
    xAxis: { type: 'value', name: 'GB', nameTextStyle: { color: C.muted }, axisLabel: { color: C.muted }, splitLine: { lineStyle: { color: C.split } }, axisLine: { show: false } },
    yAxis: { type: 'category', data: labels, axisLabel: { color: C.text, fontSize: 12 }, axisLine: { lineStyle: { color: C.axis } } },
    series: [
      { name: '已用量', type: 'bar', data: items.map((v, i) => ({ value: +v.used_gb.toFixed(2), itemStyle: { color: barColors[i] } })), label: { show: true, position: 'right', color: C.muted, fontSize: 11, formatter: (p: any) => `${p.value} GB` }, barMaxWidth: 28, z: 3 },
      { name: '软限制', type: 'bar', data: items.map(i => +i.soft_limit_gb.toFixed(2)), itemStyle: { color: 'rgba(245,158,11,0.15)', borderColor: '#f59e0b', borderWidth: 1 }, barMaxWidth: 28, barGap: '-100%', z: 2 },
      { name: '硬限制', type: 'bar', data: items.map(i => +i.hard_limit_gb.toFixed(2)), itemStyle: { color: 'rgba(107,114,128,0.08)', borderColor: '#d1d5db', borderWidth: 1 }, barMaxWidth: 28, barGap: '-100%', z: 1 },
    ],
  })
}

// 计费核时使用比例 — 仪表盘图
function renderBillingChart() {
  if (!billingChartRef.value || !usageStats.value) return
  if (!billingChart) billingChart = echarts.init(billingChartRef.value)
  const u = usageStats.value
  const noLimit = u.quota_billing_hours === 0
  const used = +u.billing_hours.toFixed(2)
  const total = noLimit ? Math.max(used * 1.5, 100) : +u.quota_billing_hours.toFixed(2)
  const pct = noLimit ? 0 : +u.usage_percent.toFixed(1)
  const color = noLimit ? C.colors[0] : statusColor(u.status)
  billingChart.setOption({
    backgroundColor: 'transparent',
    series: [{
      type: 'gauge', startAngle: 200, endAngle: -20, min: 0, max: 100, radius: '88%',
      pointer: { show: !noLimit, length: '60%', width: 4, itemStyle: { color } },
      progress: { show: true, width: 16, itemStyle: { color } },
      axisLine: { lineStyle: { width: 16, color: [[1, '#f3f4f6']] } },
      axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
      detail: { valueAnimation: true, formatter: noLimit ? `${used}h` : `{value}%`, color: C.text, fontSize: 22, fontWeight: 700, offsetCenter: [0, '15%'] },
      title: { show: true, offsetCenter: [0, '50%'], color: C.muted, fontSize: 13, formatter: noLimit ? '无配额限制' : `${used} / ${total} h` },
      data: [{ value: noLimit ? 0 : pct, name: noLimit ? '无配额限制' : `${used} / ${total} h` }],
    }],
  })
}

// 配额使用率 — 仪表盘图
function renderQuotaChart() {
  if (!quotaChartRef.value) return
  if (!quotaChart) quotaChart = echarts.init(quotaChartRef.value)
  const q = quotaStats.value
  const used = q ? +q.used_billing_hours.toFixed(2) : 0
  const total = q ? +q.total_billing_hours.toFixed(2) : 0
  const pct = q ? +q.usage_percent.toFixed(1) : 0
  const color = q ? statusColor(q.status) : '#d1d5db'
  const noData = !q?.account
  quotaChart.setOption({
    backgroundColor: 'transparent',
    series: [{
      type: 'gauge', startAngle: 200, endAngle: -20, min: 0, max: 100, radius: '88%',
      pointer: { show: !noData, length: '60%', width: 4, itemStyle: { color } },
      progress: { show: true, width: 16, itemStyle: { color } },
      axisLine: { lineStyle: { width: 16, color: [[1, '#f3f4f6']] } },
      axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
      detail: { valueAnimation: true, formatter: noData ? '-' : `{value}%`, color: noData ? '#d1d5db' : C.text, fontSize: 22, fontWeight: 700, offsetCenter: [0, '15%'] },
      title: { show: true, offsetCenter: [0, '50%'], color: C.muted, fontSize: 13, formatter: noData ? '暂无配额数据' : `${used} / ${total} h` },
      data: [{ value: pct, name: noData ? '暂无配额数据' : `${used} / ${total} h` }],
    }],
  })
}

// QoS 计费核时使用量柱状图
function renderQoSChart() {
  if (!qosChartRef.value || !qosUsage.value.length) return
  if (!qosChart) qosChart = echarts.init(qosChartRef.value)
  const items = qosUsage.value
  const names = items.map(i => i.qos_name)
  const usedData = items.map(i => +i.used_billing_hours.toFixed(2))
  const totalData = items.map(i => i.total_billing_hours > 0 ? +i.total_billing_hours.toFixed(2) : 0)
  const barColors = items.map(i => statusColor(i.status))
  qosChart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: '#fff', borderColor: '#e5e7eb', textStyle: { color: C.text },
      formatter: (params: any[]) => { const idx = params[0].dataIndex; const item = items[idx]; const quota = item.total_billing_hours > 0 ? `配额: ${item.total_billing_hours.toFixed(2)} h<br/>使用率: <b>${item.usage_percent.toFixed(1)}%</b>` : '配额: 无限制'; return `<b>${item.qos_name}</b><br/>已用: <b>${item.used_billing_hours.toFixed(2)} h</b><br/>${quota}` },
    },
    legend: { data: ['已用核时', '配额上限'], textStyle: { color: C.muted }, bottom: 4 },
    grid: { left: '3%', right: '4%', bottom: '14%', top: '6%', containLabel: true },
    xAxis: { type: 'category', data: names, axisLabel: { color: C.muted }, axisLine: { lineStyle: { color: C.axis } }, axisTick: { show: false } },
    yAxis: { type: 'value', name: '核时(h)', nameTextStyle: { color: C.muted }, axisLabel: { color: C.muted }, splitLine: { lineStyle: { color: C.split } }, axisLine: { show: false } },
    series: [
      { name: '已用核时', type: 'bar', data: usedData.map((v, i) => ({ value: v, itemStyle: { color: barColors[i], borderRadius: [6,6,0,0] } })), label: { show: true, position: 'top', color: C.muted, fontSize: 12, formatter: (p: any) => `${p.value}h` }, barMaxWidth: 56, z: 2 },
      { name: '配额上限', type: 'bar', data: totalData, itemStyle: { color: 'rgba(99,102,241,0.08)', borderColor: '#c7d2fe', borderWidth: 1, borderRadius: [6,6,0,0] }, barMaxWidth: 56, barGap: '-100%', z: 1 },
    ],
  })
}

function statusColor(s: string) { return s === 'EXCEEDED' ? '#ef4444' : s === 'WARNING' ? '#f59e0b' : '#10b981' }
function statusBg(s: string)    { return s === 'EXCEEDED' ? 'rgba(239,68,68,0.1)' : s === 'WARNING' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)' }
function statusLabel(s: string) { return s === 'EXCEEDED' ? '已超限' : s === 'WARNING' ? '警告' : '正常' }

function exportExcel() {
  import('xlsx').then(XLSX => {
    const wb = XLSX.utils.book_new()
    const { startDate, endDate } = filters.value

    if (jobStats.value) {
      const j = jobStats.value
      const ws1 = XLSX.utils.aoa_to_sheet([
        ['月份', '队列', '作业数'],
        ...j.monthly_job_counts.map(r => [r.month, r.partition, r.count]),
      ])
      ws1['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 10 }]
      XLSX.utils.book_append_sheet(wb, ws1, '月度作业趋势')

      const ws2 = XLSX.utils.aoa_to_sheet([
        ['规模范围', '作业数', '占比(%)'],
        ...j.job_scale_distribution.map(r => [r.range, r.count, j.total_jobs > 0 ? +(r.count / j.total_jobs * 100).toFixed(1) : 0]),
        ['合计', j.total_jobs, 100],
      ])
      ws2['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 10 }]
      XLSX.utils.book_append_sheet(wb, ws2, '作业规模分布')
    }

    if (usageStats.value) {
      const u = usageStats.value
      const ws = XLSX.utils.aoa_to_sheet([
        ['指标', '数值', '单位'],
        ['统计周期', `${startDate} ~ ${endDate}`, ''],
        ['GPU 卡时', +u.gpu_hours.toFixed(2), 'h'],
        ['CPU 核时', +u.cpu_hours.toFixed(2), 'h'],
        ['计费核时', +u.billing_hours.toFixed(2), 'h'],
        ['配额总量', u.quota_billing_hours === 0 ? '无限制' : +u.quota_billing_hours.toFixed(2), u.quota_billing_hours === 0 ? '' : 'h'],
        ['使用率', +u.usage_percent.toFixed(2), '%'],
        ['状态', statusLabel(u.status), ''],
      ])
      ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 8 }]
      XLSX.utils.book_append_sheet(wb, ws, '核时使用')
    }

    if (storageStats.value?.length) {
      const ws = XLSX.utils.aoa_to_sheet([
        ['用户名', '文件系统', '已用量(GB)', '软限制(GB)', '硬限制(GB)', '使用率(%)', '超软限制'],
        ...storageStats.value.map(r => [r.username, r.filesystem, +r.used_gb.toFixed(2), +r.soft_limit_gb.toFixed(2), +r.hard_limit_gb.toFixed(2), +r.usage_percent.toFixed(2), r.over_soft_limit ? '是' : '否']),
      ])
      ws['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }]
      XLSX.utils.book_append_sheet(wb, ws, '存储用量')
    }

    if (quotaStats.value?.account) {
      const q = quotaStats.value
      const ws = XLSX.utils.aoa_to_sheet([
        ['指标', '数值', '单位'],
        ['统计周期', `${startDate} ~ ${endDate}`, ''],
        ['账户', q.account, ''],
        ['配额总量', +q.total_billing_hours.toFixed(2), 'h'],
        ['已用量', +q.used_billing_hours.toFixed(2), 'h'],
        ['剩余量', +q.remaining_billing_hours.toFixed(2), 'h'],
        ['使用率', +q.usage_percent.toFixed(2), '%'],
        ['状态', statusLabel(q.status), ''],
      ])
      ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 8 }]
      XLSX.utils.book_append_sheet(wb, ws, '配额情况')
    }

    if (wb.SheetNames.length === 0) return
    XLSX.writeFile(wb, `报表中心_${startDate}_${endDate}.xlsx`)
  })
}

onMounted(() => {
  loadPartitions()
  loadAll()
})
</script>

<style scoped>
.reports-page { display: flex; flex-direction: column; gap: 1rem; padding: 1rem 1.25rem; box-sizing: border-box; }

.filter-bar {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;
  background: hsl(var(--card)); border: 1px solid hsl(var(--border)); border-radius: 10px; padding: 0.75rem 1.25rem;
}
.page-title { font-size: 1.1rem; font-weight: 700; color: hsl(var(--foreground)); }
.filter-bar-right { display: flex; align-items: flex-end; gap: 0.75rem; flex-wrap: wrap; }
.filter-item { display: flex; flex-direction: column; gap: 0.25rem; }
.filter-item label { font-size: 0.72rem; font-weight: 600; color: hsl(var(--muted-foreground)); text-transform: uppercase; letter-spacing: 0.04em; }
.filter-item select, .filter-item input[type="date"] {
  padding: 0.45rem 0.7rem; border: 1px solid hsl(var(--border)); border-radius: 7px;
  font-size: 0.85rem; background: hsl(var(--background)); color: hsl(var(--foreground)); outline: none;
}
.filter-item select:focus, .filter-item input[type="date"]:focus { border-color: hsl(var(--foreground) / 0.4); }
.date-error { font-size: 0.8rem; color: #f5222d; align-self: center; }

.btn-primary, .btn-secondary {
  padding: 7px 16px; border-radius: 7px; font-size: 0.85rem; font-weight: 600;
  cursor: pointer; border: 1px solid hsl(var(--border)); white-space: nowrap; align-self: flex-end;
}
.btn-primary { background: hsl(var(--foreground)); color: hsl(var(--background)); border-color: hsl(var(--foreground)); }
.btn-primary:hover:not(:disabled) { opacity: 0.85; }
.btn-secondary { background: hsl(var(--card)); color: hsl(var(--foreground)); }
.btn-secondary:hover:not(:disabled) { background: hsl(var(--accent)); }
.btn-primary:disabled, .btn-secondary:disabled { opacity: 0.4; cursor: not-allowed; }

.state-card {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.75rem; padding: 3rem; color: hsl(var(--muted-foreground)); text-align: center;
  background: hsl(var(--card)); border: 1px solid hsl(var(--border)); border-radius: 10px;
}
.error-state { color: #f5222d; }
.empty-icon { font-size: 2.5rem; }
.spinner { width: 26px; height: 26px; border: 3px solid hsl(var(--border)); border-top-color: hsl(var(--foreground)); border-radius: 50%; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.card { background: hsl(var(--card)); border: 1px solid hsl(var(--border)); border-radius: 10px; padding: 1.25rem 1.5rem; }
.card-title { font-size: 0.9rem; font-weight: 700; color: hsl(var(--foreground)); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
.account-tag { font-size: 0.75rem; font-weight: 500; color: hsl(var(--muted-foreground)); background: hsl(var(--muted)); padding: 2px 8px; border-radius: 10px; }

.chart-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
@media (max-width: 900px) { .chart-row { grid-template-columns: 1fr; } }

.chart-card { min-height: 300px; }
.chart-container { width: 100%; height: 260px; }

.progress-card { display: flex; flex-direction: column; gap: 0.75rem; }
.progress-info { display: flex; justify-content: space-between; font-size: 0.875rem; color: hsl(var(--foreground)); }
.progress-bar-wrap { width: 100%; height: 10px; background: hsl(var(--muted)); border-radius: 5px; overflow: hidden; }
.progress-bar-fill { height: 100%; border-radius: 5px; transition: width 0.4s ease; }
.status-badge { display: inline-block; padding: 3px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; width: fit-content; }
.no-limit-info { color: hsl(var(--muted-foreground)); font-size: 0.875rem; }
.quota-message { font-size: 0.8rem; color: hsl(var(--muted-foreground)); }

.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; color: hsl(var(--muted-foreground)); gap: 0.5rem; }
</style>
