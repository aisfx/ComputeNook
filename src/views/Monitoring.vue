<template>
  <div class="mon">
    <div class="mon-header">
      <div class="mon-header-left">
        <span class="refresh-tip">{{ lastRefresh ? `刷新于 ${lastRefresh}` : '' }}</span>
      </div>
      <button class="btn-sec" @click="loadAll" :disabled="loading">{{ loading ? '刷新中...' : '🔄 刷新' }}</button>
    </div>

    <!-- Tab 导航 -->

    <div class="page-section">
      <div v-if="mainTab==='cluster'" class="cluster-view">
        <div class="cluster-toolbar">
          <span class="cluster-count">{{ nodeMetrics.length }} 个节点</span>
          <div style="display:flex;align-items:center;gap:0.5rem;margin-left:auto">
            <span :class="['prom-badge', promOk ? 'prom-ok' : 'prom-na']">{{ promOk ? '已连接' : '未连接' }}</span>
          </div>
        </div>

        <!-- 卡片视图 -->
        <div class="node-card-grid">
          <div v-for="n in nodeMetrics" :key="n.instance"
            :class="['node-card', nodeCardCls(n)]">
            <div class="nc-header">
              <span class="nc-name">{{ shortName(n.instance) }}</span>
              <span :class="['nc-state', nodeStateCls(n)]">{{ nodeStateText(n) }}</span>
            </div>
            <div class="nc-metrics">
              <div class="nc-metric">
                <div class="nc-bar-label">
                  <span>CPU</span><span>{{ fmt1(n.cpu_usage) }}%</span>
                </div>
                <div class="nc-bar-bg">
                  <div class="nc-bar-fg" :class="barCls(n.cpu_usage, cfg.cpuWarn)"
                    :style="{ width: Math.min(n.cpu_usage||0,100)+'%' }"></div>
                </div>
              </div>
              <div class="nc-metric">
                <div class="nc-bar-label">
                  <span>内存</span><span>{{ fmt1(n.mem_usage) }}%</span>
                </div>
                <div class="nc-bar-bg">
                  <div class="nc-bar-fg" :class="barCls(n.mem_usage, cfg.memWarn)"
                    :style="{ width: Math.min(n.mem_usage||0,100)+'%' }"></div>
                </div>
              </div>
              <div class="nc-metric">
                <div class="nc-bar-label">
                  <span>磁盘</span><span>{{ fmt1(n.disk_usage) }}%</span>
                </div>
                <div class="nc-bar-bg">
                  <div class="nc-bar-fg" :class="barCls(n.disk_usage, 85)"
                    :style="{ width: Math.min(n.disk_usage||0,100)+'%' }"></div>
                </div>
              </div>
            </div>
            <div class="nc-footer">
              <span>负载 {{ fmt1(n.load1) }}</span>
              <span>{{ fmtBytes(n.net_rx_bps) }}</span>
              <span>{{ fmtBytes(n.net_tx_bps) }}</span>
              <span>{{ fmtUptime(n.uptime_seconds) }}</span>
            </div>
          </div>
          <div v-if="nodeMetrics.length===0" class="db-na" style="grid-column:1/-1;text-align:center;padding:3rem">
            暂无节点数据，请检查 Prometheus 连接
          </div>
        </div>
      </div>

      <!-- ── 告警 & 规则 ── -->
      <div v-if="mainTab==='alerts'">
        <!-- 二级 Tab 导航 -->
        <div class="alert-subtabs">
          <button :class="['alert-subtab', alertTab==='active' && 'active']" @click="alertTab='active'">
            🔔 活跃告警
            <span v-if="promAlerts.length" class="alert-badge" style="margin-left:4px">{{ promAlerts.length }}</span>
          </button>
          <button :class="['alert-subtab', alertTab==='rules' && 'active']" @click="alertTab='rules'">
            📋 告警规则
            <span v-if="allRules.length" class="nodes-count" style="margin-left:4px">{{ allRules.length }} 条</span>
          </button>
          <button :class="['alert-subtab', alertTab==='config' && 'active']" @click="alertTab='config'">
            ⚙️ 告警通知配置
          </button>
        </div>

        <!-- 活跃告警 -->
        <div v-if="alertTab==='active'" style="padding:1rem">
          <div class="alert-tab-toolbar">
            <span :class="['prom-badge', promAlertsOk ? 'prom-ok' : 'prom-na']">{{ promAlertsOk ? '已连接' : '未连接' }}</span>
          </div>
          <div v-if="!promAlertsOk" class="prom-tip">未配置 Prometheus 或无法连接</div>
          <div v-else-if="promAlerts.length===0" class="empty-sm">✅ 无活跃告警</div>
          <div v-else style="overflow-x:auto">
            <table class="mtable">
              <thead><tr><th>级别</th><th>告警名称</th><th>实例</th><th>摘要</th><th>触发时间</th></tr></thead>
              <tbody>
                <tr v-for="a in promAlerts" :key="a.fingerprint" :class="a.labels?.severity==='critical' ? 'tr-critical' : 'tr-warning'">
                  <td><span :class="['sev-badge', 'sev-'+(a.labels?.severity||'info')]">{{ a.labels?.severity || 'info' }}</span></td>
                  <td><code>{{ a.labels?.alertname || '-' }}</code></td>
                  <td class="small-text">{{ a.labels?.instance || a.labels?.job || '-' }}</td>
                  <td class="small-text">{{ a.annotations?.summary || a.annotations?.description || '-' }}</td>
                  <td class="small-text">{{ fmtTime(a.activeAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 告警规则 -->
        <div v-if="alertTab==='rules'" style="padding:1rem">
          <div class="alert-tab-toolbar">
            <span :class="['prom-badge', rulesConnected ? 'prom-ok' : 'prom-na']">{{ rulesConnected ? '已连接' : '未连接' }}</span>
            <input v-model="ruleSearch" placeholder="搜索规则..." class="rule-search" style="margin-left:auto" />
            <button class="btn-sec" @click="loadRules" :disabled="rulesLoading" style="font-size:0.78rem;padding:0.25rem 0.5rem">{{ rulesLoading ? '...' : '🔄' }}</button>
          </div>
          <div v-if="!rulesConnected" class="prom-tip">无法连接 Prometheus</div>
          <div v-else style="overflow-x:auto">
            <table class="mtable">
              <thead><tr><th>规则名</th><th>表达式</th><th>持续</th><th>级别</th><th>状态</th><th>摘要</th></tr></thead>
              <tbody>
                <template v-for="group in filteredRuleGroups" :key="group.name">
                  <tr v-for="r in group.rules" :key="r.name">
                    <td><code>{{ r.name }}</code></td>
                    <td class="expr-cell" :title="r.query">{{ r.query }}</td>
                    <td>{{ r.duration ? r.duration+'s' : '-' }}</td>
                    <td><span :class="['sev-badge', 'sev-'+(r.labels?.severity||'info')]">{{ r.labels?.severity || 'info' }}</span></td>
                    <td><span :class="['state-badge2', r.state==='firing' ? 'st-firing' : r.state==='pending' ? 'st-pending' : 'st-ok']">{{ r.state || 'inactive' }}</span></td>
                    <td class="small-text">{{ r.annotations?.summary || r.annotations?.description || '-' }}</td>
                  </tr>
                </template>
                <tr v-if="filteredRuleGroups.length===0"><td colspan="6" class="empty-sm">暂无告警规则</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 告警通知配置 -->
        <div v-if="alertTab==='config'" style="padding:1rem">
          <div class="local-cfg-card">
            <div class="lcc-row">
              <label>CPU 警告 <input type="number" v-model.number="cfg.cpuWarn" min="50" max="100" class="num-input" /> %</label>
              <label>内存警告 <input type="number" v-model.number="cfg.memWarn" min="50" max="100" class="num-input" /> %</label>
              <label>弹框通知 <label class="toggle"><input type="checkbox" v-model="cfg.popupEnabled" /><span class="toggle-slider"></span></label></label>
              <label>声音告警 <label class="toggle"><input type="checkbox" v-model="cfg.soundEnabled" /><span class="toggle-slider"></span></label></label>
              <label>告警间隔 <input type="number" v-model.number="cfg.alertInterval" min="30" max="3600" class="num-input" /> 秒</label>
            </div>
            <div class="sound-upload-row">
              <span class="lcc-title" style="margin:0">🎵 告警音乐</span>
              <div class="sound-upload-area">
                <label class="sound-upload-btn">📁 上传音频<input type="file" accept="audio/*" @change="onSoundUpload" style="display:none" /></label>
                <span v-if="customSoundName" class="sound-name">{{ customSoundName }}</span>
                <button v-if="customSoundUrl" class="btn-sec" style="font-size:0.78rem;padding:0.25rem 0.6rem" @click="testSound">▶ 试听</button>
                <button v-if="customSoundUrl" class="btn-sec" style="font-size:0.78rem;padding:0.25rem 0.6rem;color:#ef4444" @click="clearSound">✕</button>
                <span v-if="!customSoundUrl" class="sound-hint">支持 mp3/wav/ogg，未上传则用默认蜂鸣音</span>
              </div>
            </div>
            <div class="lcc-row" style="margin-top:0.5rem">
              <button class="btn-pri" @click="saveCfg">💾 保存</button>
              <span v-if="cfgSaved" class="save-tip">✅ 已保存</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- PromQL 探索已移除 -->

    <!-- 🚨 告警弹框 -->
    <Teleport to="body">
      <div v-if="alertPopup.show" class="alert-popup-overlay" @click.self="dismissPopup">
        <div :class="['alert-popup', alertPopup.level==='critical' ? 'ap-critical' : 'ap-warning']">
          <div class="ap-icon">{{ alertPopup.level==='critical' ? '🔴' : '🟡' }}</div>
          <div class="ap-body">
            <div class="ap-title">{{ alertPopup.title }}</div>
            <div class="ap-list">
              <div v-for="a in alertPopup.alerts" :key="a.id" class="ap-item">
                <span>{{ a.level==='critical' ? '🔴' : '🟡' }}</span><span>{{ a.title }}</span>
              </div>
            </div>
          </div>
          <button class="ap-close" @click="dismissPopup">知道了</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { getApiBase } from '../utils/auth'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, CanvasRenderer])

const loading = ref(false)
const lastRefresh = ref('')
const props = defineProps<{ activeTab?: string }>()
const emit = defineEmits<{ (e: 'tab-change', tab: string): void }>()
const mainTab = ref<'cluster'|'alerts'>(props.activeTab as any || 'cluster')
watch(() => props.activeTab, (v) => { if (v) mainTab.value = v as any }, { immediate: true })
const alertTab = ref<'active'|'rules'|'config'>('active')
const clusterTab = ref<'local'|'targets'>('local')

const clusterStats = ref<any>({})
const slurmNodes = ref<any[]>([])
const nodeMetrics = ref<any[]>([])
const promOk = ref(false)
const promAlerts = ref<any[]>([])
const promAlertsOk = ref(false)
const promTargets = ref<any[]>([])
const promTargetsOk = ref(false)
const localMetrics = ref<any>({ connected: false, hostname: '', cpu_usage: 0, mem_usage: 0, mem_total_gb: 0, mem_used_gb: 0, disk_usage: 0, disk_total_gb: 0, disk_used_gb: 0, net_rx_bps: 0, net_tx_bps: 0, load1: 0, load5: 0, load15: 0, uptime_seconds: 0 })

type HistoryPoint = {
  time: string
  nodes: Record<string, {
    cpu: number        // %
    mem: number        // % 
    mem_used: number   // GB
    mem_total: number  // GB
    disk: number       // %
    disk_used: number  // GB
    disk_total: number // GB
    net_rx: number     // bytes/s
    net_tx: number     // bytes/s
  }>
}
const history = ref<HistoryPoint[]>([])
const historyNode = ref('')
const cpuChartEl = ref<HTMLElement>()
const memChartEl = ref<HTMLElement>()
const diskChartEl = ref<HTMLElement>()
const netChartEl = ref<HTMLElement>()
let cpuChart: echarts.ECharts | null = null
let memChart: echarts.ECharts | null = null
let diskChart: echarts.ECharts | null = null
let netChart: echarts.ECharts | null = null

const rulesLoading = ref(false)
const rulesConnected = ref(false)
const ruleGroups = ref<any[]>([])
const ruleSearch = ref('')
const cfgSaved = ref(false)
const customSoundUrl = ref('')
const customSoundName = ref('')
let customAudio: HTMLAudioElement | null = null
const alertPopup = ref({ show: false, level: 'warning', title: '', alerts: [] as any[] })
let lastAlertKey = ''
let lastAlertTime = 0

const cfg = ref({ cpuWarn: 90, memWarn: 90, interval: 30, prometheusUrl: 'http://localhost:9090', popupEnabled: true, soundEnabled: true, alertInterval: 300 })
const token = () => localStorage.getItem('token') || sessionStorage.getItem('token') || ''

const nodesWithJobs = computed(() => slurmNodes.value.filter(n => n.running_jobs > 0).sort((a: any, b: any) => b.running_jobs - a.running_jobs))
const maxJobs = computed(() => Math.max(...slurmNodes.value.map((n: any) => n.running_jobs || 0), 1))

const slurmStateGroups = computed(() => {
  const g: Record<string, { label: string; cls: string; nodes: string[] }> = {
    idle: { label: '空闲 (idle)', cls: 'idle', nodes: [] },
    alloc: { label: '运行中 (alloc/mix)', cls: 'alloc', nodes: [] },
    down: { label: '离线 (down/drain)', cls: 'down', nodes: [] },
    other: { label: '其他', cls: 'other', nodes: [] },
  }
  for (const n of slurmNodes.value) {
    const s = (n.state || '').toLowerCase()
    if (s.includes('idle')) g.idle.nodes.push(n.name)
    else if (s.includes('alloc') || s.includes('mix')) g.alloc.nodes.push(n.name)
    else if (s.includes('down') || s.includes('drain')) g.down.nodes.push(n.name)
    else g.other.nodes.push(n.name)
  }
  return Object.values(g).filter(x => x.nodes.length > 0)
})

const targetsByJob = computed(() => {
  const m: Record<string, any[]> = {}
  for (const t of promTargets.value) {
    const job = t.job || 'unknown'
    if (!m[job]) m[job] = []
    m[job].push(t)
  }
  return m
})

const allRules = computed(() => ruleGroups.value.flatMap((g: any) => g.rules || []))
const filteredRuleGroups = computed(() => {
  if (!ruleSearch.value) return ruleGroups.value
  const q = ruleSearch.value.toLowerCase()
  return ruleGroups.value.map((g: any) => ({ ...g, rules: (g.rules || []).filter((r: any) => r.name?.toLowerCase().includes(q) || r.query?.toLowerCase().includes(q)) })).filter((g: any) => g.rules.length > 0)
})

const loadAll = async () => {
  loading.value = true
  try {
    const [sRes, nRes, mRes, lRes] = await Promise.allSettled([
      fetch(`${getApiBase()}/api/dashboard/stats`, { headers: { Authorization: `Bearer ${token()}` } }),
      fetch(`${getApiBase()}/api/dashboard/nodes`, { headers: { Authorization: `Bearer ${token()}` } }),
      fetch(`${getApiBase()}/api/monitoring/node-metrics`, { headers: { Authorization: `Bearer ${token()}` } }),
      fetch(`${getApiBase()}/api/monitoring/local-metrics`, { headers: { Authorization: `Bearer ${token()}` } }),
    ])
    if (sRes.status === 'fulfilled' && sRes.value.ok) clusterStats.value = (await sRes.value.json()).data || {}
    if (nRes.status === 'fulfilled' && nRes.value.ok) slurmNodes.value = (await nRes.value.json()).data || []
    if (mRes.status === 'fulfilled' && mRes.value.ok) { const d = await mRes.value.json(); nodeMetrics.value = d.nodes || []; promOk.value = d.connected === true }
    if (lRes.status === 'fulfilled' && lRes.value.ok) localMetrics.value = await lRes.value.json()
    lastRefresh.value = new Date().toLocaleTimeString('zh-CN')
    if (nodeMetrics.value.length > 0) {
      const point: HistoryPoint = { time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), nodes: {} }
      for (const n of nodeMetrics.value) point.nodes[n.instance] = {
          cpu: n.cpu_usage,
          mem: n.mem_usage,
          mem_used: n.mem_used_gb ?? (n.mem_total_gb * n.mem_usage / 100),
          mem_total: n.mem_total_gb ?? 0,
          disk: n.disk_usage,
          disk_used: n.disk_used_gb ?? (n.disk_total_gb * n.disk_usage / 100),
          disk_total: n.disk_total_gb ?? 0,
          net_rx: n.net_rx_bps,
          net_tx: n.net_tx_bps,
        }
      history.value.push(point)
      if (history.value.length > 60) history.value.shift()
    }
    await loadPromAlerts()
    checkAlerts()
    drawAllCharts()
  } finally { loading.value = false }
}

const loadTargets = async () => {
  try {
    const res = await fetch(`${getApiBase()}/api/monitoring/prom-targets`, { headers: { Authorization: `Bearer ${token()}` } })
    if (res.ok) { const d = await res.json(); promTargets.value = d.targets || []; promTargetsOk.value = d.connected === true; return }
  } catch {}
  promTargetsOk.value = false; promTargets.value = []
}

const loadPromAlerts = async () => {
  try {
    const res = await fetch(`${getApiBase()}/api/monitoring/prom-alerts`, { headers: { Authorization: `Bearer ${token()}` } })
    if (res.ok) { const d = await res.json(); promAlerts.value = d.alerts || []; promAlertsOk.value = d.connected !== false; return }
  } catch {}
  promAlertsOk.value = false; promAlerts.value = []
}

const loadRules = async () => {
  rulesLoading.value = true
  try {
    const res = await fetch(`${getApiBase()}/api/monitoring/prom-rules`, { headers: { Authorization: `Bearer ${token()}` } })
    if (res.ok) {
      const d = await res.json(); rulesConnected.value = d.connected === true
      if (d.data?.data?.groups) {
        ruleGroups.value = d.data.data.groups.map((g: any) => ({ name: g.name, file: g.file, rules: (g.rules || []).filter((r: any) => r.type === 'alerting').map((r: any) => ({ name: r.name, query: r.query, duration: r.duration, labels: r.labels, annotations: r.annotations, state: r.state })) })).filter((g: any) => g.rules.length > 0)
      }
      return
    }
  } catch {}
  rulesConnected.value = false; ruleGroups.value = []
  rulesLoading.value = false
}

const onSoundUpload = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (customSoundUrl.value) URL.revokeObjectURL(customSoundUrl.value)
  customSoundUrl.value = URL.createObjectURL(file)
  customSoundName.value = file.name
  customAudio = new Audio(customSoundUrl.value)
}
const testSound = () => { if (customAudio) { customAudio.currentTime = 0; customAudio.play() } }
const clearSound = () => { if (customSoundUrl.value) URL.revokeObjectURL(customSoundUrl.value); customSoundUrl.value = ''; customSoundName.value = ''; customAudio = null }

const checkAlerts = () => {
  const all = promAlerts.value.map((a: any) => ({ id: a.fingerprint || a.labels?.alertname, level: a.labels?.severity === 'critical' ? 'critical' : 'warning', title: a.labels?.alertname || '未知告警' }))
  if (all.length === 0) return
  const key = all.map((a: any) => a.id).sort().join(',')
  const now = Date.now()
  if (key === lastAlertKey && now - lastAlertTime < cfg.value.alertInterval * 1000) return
  lastAlertKey = key; lastAlertTime = now
  const hasCritical = all.some((a: any) => a.level === 'critical')
  if (cfg.value.popupEnabled) alertPopup.value = { show: true, level: hasCritical ? 'critical' : 'warning', title: hasCritical ? ' 严重告警' : ' 告警通知', alerts: all.slice(0, 10) }
  if (cfg.value.soundEnabled) startAlertSound(hasCritical)
}

let soundTimer: ReturnType<typeof setInterval> | null = null
let soundCritical = false
const startAlertSound = (critical: boolean) => {
  soundCritical = critical; stopAlertSound(); playAlertSound(critical)
  soundTimer = setInterval(() => { if (alertPopup.value.show) playAlertSound(soundCritical); else stopAlertSound() }, 3000)
}
const stopAlertSound = () => { if (soundTimer) { clearInterval(soundTimer); soundTimer = null }; if (customAudio) customAudio.pause() }
const playAlertSound = (critical: boolean) => {
  if (customAudio) { customAudio.currentTime = 0; customAudio.play().catch(() => {}); return }
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const beep = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination); osc.frequency.value = freq; osc.type = 'sine'
      gain.gain.setValueAtTime(0.3, ctx.currentTime + start); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      osc.start(ctx.currentTime + start); osc.stop(ctx.currentTime + start + dur)
    }
    if (critical) { beep(880,0,0.2); beep(660,0.25,0.2); beep(880,0.5,0.2); beep(660,0.75,0.3) }
    else { beep(660,0,0.15); beep(880,0.2,0.25) }
  } catch {}
}
const dismissPopup = () => { alertPopup.value.show = false; stopAlertSound() }

const initChart = (el: HTMLElement | undefined, instance: echarts.ECharts | null) => {
  if (!el) return instance
  if (instance) instance.dispose()
  return echarts.init(el, undefined, { renderer: 'canvas' })
}

// 多节点颜色池
const NODE_COLORS = ['#667eea','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16','#ec4899','#14b8a6']

type ChartKey = 'cpu' | 'mem' | 'disk' | 'net'

const chartMeta: Record<ChartKey, {
  label: string
  getVal: (n: HistoryPoint['nodes'][string]) => number | number[]
  fmt: (v: number) => string
  yFmt: (v: number) => string
  yMax?: number
  seriesNames?: (node: string) => string[]
}> = {
  cpu: {
    label: 'CPU%',
    getVal: n => n.cpu,
    fmt: v => v.toFixed(1) + '%',
    yFmt: v => v.toFixed(0) + '%',
    yMax: 100,
  },
  mem: {
    label: '内存 (GB)',
    getVal: n => n.mem_used,
    fmt: v => v.toFixed(2) + ' GB',
    yFmt: v => v.toFixed(1) + ' GB',
  },
  disk: {
    label: '磁盘 (GB)',
    getVal: n => n.disk_used,
    fmt: v => v.toFixed(2) + ' GB',
    yFmt: v => v.toFixed(1) + ' GB',
  },
  net: {
    label: '网络',
    getVal: n => [n.net_rx, n.net_tx],
    fmt: v => fmtBytes(v),
    yFmt: v => fmtBytes(v),
    seriesNames: node => [`${node} ↓`, `${node} ↑`],
  },
}

const buildOption = (seriesKey: ChartKey) => {
  const data = history.value
  const inst = historyNode.value
  const times = data.map(p => p.time)
  const meta = chartMeta[seriesKey]
  const isNet = seriesKey === 'net'
  const allNodes = Array.from(new Set(data.flatMap(p => Object.keys(p.nodes))))

  const markLine = seriesKey === 'cpu' ? {
    silent: true,
    lineStyle: { color: '#ef4444', type: 'dashed' as const, width: 1 },
    data: [{ yAxis: cfg.value.cpuWarn, label: { formatter: `${cfg.value.cpuWarn}%`, color: '#ef4444', fontSize: 10 } }]
  } : undefined

  let series: any[] = []
  const nodes = inst ? [inst] : allNodes

  nodes.forEach((node, i) => {
    const color = NODE_COLORS[i % NODE_COLORS.length]
    const name = shortName(node)
    if (isNet) {
      const rxColor = NODE_COLORS[i % NODE_COLORS.length]
      const txColor = NODE_COLORS[(i + 5) % NODE_COLORS.length]
      series.push({
        name: `${name} ↓`, type: 'line', smooth: true, symbol: 'none',
        lineStyle: { color: rxColor, width: 2 },
        areaStyle: { color: rxColor, opacity: 0.06 },
        data: data.map(p => +(p.nodes[node]?.net_rx ?? 0).toFixed(0)),
      })
      series.push({
        name: `${name} ↑`, type: 'line', smooth: true, symbol: 'none',
        lineStyle: { color: txColor, width: 2, type: 'dashed' as const },
        data: data.map(p => +(p.nodes[node]?.net_tx ?? 0).toFixed(0)),
      })
    } else {
      const getV = meta.getVal as (n: HistoryPoint['nodes'][string]) => number
      series.push({
        name, type: 'line', smooth: true, symbol: 'none',
        lineStyle: { color, width: 2 },
        areaStyle: { color, opacity: inst ? 0.1 : 0.05 },
        data: data.map(p => +((p.nodes[node] ? getV(p.nodes[node]) : 0)).toFixed(3)),
        markLine: i === 0 ? markLine : undefined,
      })
    }
  })

  // 计算 yAxis max：内存/磁盘用节点最大 total 值
  let yMax: number | undefined = meta.yMax
  if ((seriesKey === 'mem' || seriesKey === 'disk') && data.length > 0) {
    const totalKey = seriesKey === 'mem' ? 'mem_total' : 'disk_total'
    const maxTotal = Math.max(...data.flatMap(p => Object.values(p.nodes).map(n => n[totalKey] ?? 0)))
    if (maxTotal > 0) yMax = Math.ceil(maxTotal * 1.05)
  }

  return {
    backgroundColor: 'transparent',
    grid: { top: 32, right: 12, bottom: 32, left: 62 },
    tooltip: {
      trigger: 'axis' as const,
      confine: true,
      formatter: (params: any[]) => {
        const t = params[0]?.axisValue || ''
        return `<div style="font-size:12px;font-weight:600;margin-bottom:4px">${t}</div>` +
          params.map((p: any) => {
            const val = meta.fmt(p.value)
            return `<div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span><span>${p.seriesName}</span><b style="margin-left:auto;padding-left:12px">${val}</b></div>`
          }).join('')
      }
    },
    legend: {
      top: 2, right: 4,
      textStyle: { fontSize: 11 },
      itemWidth: 14, itemHeight: 6,
      type: 'scroll' as const,
    },
    xAxis: {
      type: 'category' as const, data: times,
      axisLabel: { fontSize: 10, color: '#9ca3af', interval: 'auto' as const },
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      max: yMax,
      min: 0,
      axisLabel: { fontSize: 10, color: '#9ca3af', formatter: meta.yFmt },
      splitLine: { lineStyle: { color: '#f3f4f6' } },
    },
    dataZoom: [{ type: 'inside' as const, start: 0, end: 100 }],
    series,
  }
}

const drawAllCharts = async () => {
  await nextTick()
  if (cpuChartEl.value) { cpuChart = initChart(cpuChartEl.value, cpuChart); cpuChart?.setOption(buildOption('cpu')) }
  if (memChartEl.value) { memChart = initChart(memChartEl.value, memChart); memChart?.setOption(buildOption('mem')) }
  if (diskChartEl.value) { diskChart = initChart(diskChartEl.value, diskChart); diskChart?.setOption(buildOption('disk')) }
  if (netChartEl.value) { netChart = initChart(netChartEl.value, netChart); netChart?.setOption(buildOption('net')) }
}

watch(historyNode, drawAllCharts)

const fmt1 = (v: any) => (v == null ? '0' : Number(v).toFixed(1))
const fmt0 = (v: any) => (v == null ? '0' : Math.round(Number(v)).toString())
const clamp = (v: number) => Math.min(100, Math.max(0, v || 0))
const shortName = (inst: string) => inst.replace(/:\d+$/, '')
const fmtBytes = (b: number) => { if (!b) return '0 B/s'; if (b > 1e9) return (b/1e9).toFixed(1)+' GB/s'; if (b > 1e6) return (b/1e6).toFixed(1)+' MB/s'; if (b > 1e3) return (b/1e3).toFixed(1)+' KB/s'; return Math.round(b)+' B/s' }
const fmtUptime = (s: number) => { if (!s) return '-'; const d = Math.floor(s/86400), h = Math.floor((s%86400)/3600); return d > 0 ? `${d}天${h}时` : `${h}时` }
const fmtTime = (t: string) => { try { return new Date(t).toLocaleString('zh-CN') } catch { return t } }
const pctColor = (v: number, warn: number) => v > warn ? '#ef4444' : v > warn * 0.8 ? '#f59e0b' : '#10b981'
const pctClass = (v: number, warn: number) => v > warn ? 'pct-crit' : v > warn * 0.8 ? 'pct-warn' : 'pct-ok'
const ringColor = (v: number, warn: number) => v > warn ? '#ef4444' : v > warn * 0.8 ? '#f59e0b' : '#10b981'
const clusterViewMode = ref<'card'|'table'>('card')
const nodeCardCls = (n: any) => { const v = Math.max(n.cpu_usage||0, n.mem_usage||0); return v > 85 ? 'nc-crit' : v > 70 ? 'nc-warn' : 'nc-ok' }
const nodeStateCls = (n: any) => { const v = Math.max(n.cpu_usage||0, n.mem_usage||0); return v > 85 ? 'ncs-crit' : v > 70 ? 'ncs-warn' : 'ncs-ok' }
const nodeStateText = (n: any) => { const v = Math.max(n.cpu_usage||0, n.mem_usage||0); return v > 85 ? '高负载' : v > 70 ? '繁忙' : '正常' }
const nodeRowCls = (n: any) => { const v = Math.max(n.cpu_usage||0, n.mem_usage||0); return v > 85 ? 'tr-critical' : v > 70 ? 'tr-warning' : '' }
const barCls = (v: number, warn: number) => v > warn ? 'bar-crit' : v > warn*0.8 ? 'bar-warn' : 'bar-ok'
const ringStyle = (v: number, warn: number) => ({ '--ring-color': ringColor(v, warn) })
const nsClass = (s: string) => { const l = (s||'').toLowerCase(); if (l.includes('idle')) return 'ns-idle'; if (l.includes('alloc')||l.includes('mix')) return 'ns-alloc'; if (l.includes('down')||l.includes('drain')) return 'ns-down'; return 'ns-unk' }

const saveCfg = () => { localStorage.setItem('mon_cfg', JSON.stringify(cfg.value)); cfgSaved.value = true; setTimeout(() => { cfgSaved.value = false }, 2000) }
const loadCfg = () => { const s = localStorage.getItem('mon_cfg'); if (s) try { cfg.value = { ...cfg.value, ...JSON.parse(s) } } catch {} }

let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => { loadCfg(); loadAll(); loadTargets(); loadRules(); timer = setInterval(loadAll, cfg.value.interval * 1000) })
onUnmounted(() => { if (timer) clearInterval(timer); stopAlertSound(); clearSound(); cpuChart?.dispose(); memChart?.dispose(); diskChart?.dispose(); netChart?.dispose() })
</script>


<style scoped>
/* ── 页面容器 ── */
.mon {
  padding: 1.25rem;
  background: hsl(var(--background));
  min-height: 100%;
}

/* ── Header ── */
.mon-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.mon-header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.mon-header-left h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.refresh-tip {
  font-size: 0.78rem;
  color: hsl(var(--muted-foreground));
}

/* ── Tab 导航 ── */
.mon-tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid hsl(var(--border));
  margin-bottom: 1rem;
}

.mon-tab {
  padding: 0.6rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.mon-tab:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 0.4);
}

.mon-tab.active {
  color: hsl(var(--primary));
  border-bottom-color: hsl(var(--primary));
  font-weight: 600;
}

/* ── Page section card ── */
.page-section {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-lg);
  overflow: hidden;
}

/* ── Tabs ── */
.page-section-title {
  padding: 0 1rem;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--card));
}

.cs-tabs {
  display: flex;
  gap: 0;
  flex-wrap: wrap;
}

.cs-tab {
  display: inline-flex;
  align-items: center;
  padding: 0.7rem 1rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.cs-tab:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 0.4);
}

.cs-tab.active {
  color: hsl(var(--primary));
  border-bottom-color: hsl(var(--primary));
  font-weight: 600;
}

/* ── Sub header (节点选择器) ── */
.tab-sub-header {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--muted) / 0.3);
  gap: 0.5rem;
}

.nodes-count {
  font-size: 0.82rem;
  color: hsl(var(--muted-foreground));
}

.history-node-sel {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: hsl(var(--muted-foreground));
}

.hist-sel {
  padding: 0.25rem 0.5rem;
  font-size: 0.82rem;
  border-radius: var(--radius-sm);
}

/* ── Charts grid ── */
.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  padding: 1rem;
}

.metric-section {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  padding: 0.75rem 1rem;
}

.ms-title {
  font-size: 0.82rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  margin-bottom: 0.5rem;
  letter-spacing: 0.01em;
}

.echarts-box {
  width: 100%;
  height: 240px;
}

/* ── Node table section ── */
.metric-section:not(.charts-grid .metric-section) {
  margin: 0 1rem 1rem;
}

/* ── Badges ── */
.prom-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  font-size: 0.7rem;
  font-weight: 500;
}

.prom-ok {
  background: hsl(var(--success) / 0.12);
  color: hsl(var(--success));
}

.prom-na {
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
}

.alert-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: var(--radius-full);
  font-size: 0.7rem;
  font-weight: 700;
  background: hsl(var(--destructive));
  color: hsl(var(--destructive-foreground));
}

.pct-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
}

.pct-ok { background: hsl(var(--success) / 0.1); color: hsl(var(--success)); }
.pct-warn { background: hsl(var(--warning) / 0.1); color: hsl(var(--warning)); }
.pct-crit { background: hsl(var(--destructive) / 0.1); color: hsl(var(--destructive)); }

/* ── Prom tip ── */
.prom-tip {
  margin: 0.75rem 1rem;
  padding: 0.6rem 0.9rem;
  background: hsl(var(--warning) / 0.08);
  border: 1px solid hsl(var(--warning) / 0.3);
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  color: hsl(var(--warning));
}

/* ── Buttons ── */
.btn-sec {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  font-size: 0.82rem;
  font-weight: 500;
  background: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}

.btn-sec:hover:not(:disabled) { background: hsl(var(--accent)); }
.btn-sec:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-pri {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  font-size: 0.82rem;
  font-weight: 500;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-pri:hover { opacity: 0.9; }

/* ── Table ── */
.mtable {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.mtable th {
  background: hsl(var(--muted) / 0.5);
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  font-weight: 600;
  padding: 8px 12px;
  border-bottom: 1px solid hsl(var(--border));
  text-align: left;
  white-space: nowrap;
}

.mtable td {
  padding: 10px 12px;
  border-bottom: 1px solid hsl(var(--border));
  color: hsl(var(--foreground));
}

.mtable tbody tr:last-child td { border-bottom: none; }
.mtable tbody tr:hover td { background: hsl(var(--muted) / 0.3); }

.tr-critical td { background: hsl(var(--destructive) / 0.05) !important; }
.tr-warning td { background: hsl(var(--warning) / 0.05) !important; }

.empty-sm {
  text-align: center;
  color: hsl(var(--muted-foreground));
  font-size: 0.82rem;
  padding: 1.5rem;
}

.small-text { font-size: 0.78rem; color: hsl(var(--muted-foreground)); }

/* ── Jobs tab ── */
.slurm-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  padding: 1rem;
}

.chart-panel {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  padding: 0.75rem 1rem;
}

.chart-panel-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: hsl(var(--foreground));
  margin-bottom: 0.75rem;
}

.slurm-state-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.5rem;
}

.slurm-state-card {
  border-radius: var(--radius-md);
  padding: 0.6rem 0.75rem;
  border: 1px solid hsl(var(--border));
}

.ssc-idle { background: hsl(var(--success) / 0.08); border-color: hsl(var(--success) / 0.2); }
.ssc-alloc { background: hsl(var(--primary) / 0.08); border-color: hsl(var(--primary) / 0.2); }
.ssc-down { background: hsl(var(--destructive) / 0.08); border-color: hsl(var(--destructive) / 0.2); }
.ssc-other { background: hsl(var(--muted)); border-color: hsl(var(--border)); }

.ssc-count { font-size: 1.4rem; font-weight: 700; color: hsl(var(--foreground)); }
.ssc-label { font-size: 0.75rem; color: hsl(var(--muted-foreground)); margin-top: 2px; }
.ssc-nodes { font-size: 0.7rem; color: hsl(var(--muted-foreground)); margin-top: 4px; }

.bar-chart { display: flex; flex-direction: column; gap: 0.5rem; }
.bc-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; }
.bc-label { width: 60px; color: hsl(var(--foreground)); font-weight: 500; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bc-bar-wrap { flex: 1; display: flex; align-items: center; gap: 0.4rem; }
.bc-bar-bg { flex: 1; height: 8px; background: hsl(var(--muted)); border-radius: var(--radius-full); overflow: hidden; }
.bc-bar-fg { height: 100%; border-radius: var(--radius-full); transition: width 0.3s; }
.bc-val { font-size: 0.75rem; color: hsl(var(--muted-foreground)); white-space: nowrap; }

.ns-badge { font-size: 0.7rem; padding: 1px 6px; border-radius: var(--radius-full); font-weight: 500; }
.ns-idle { background: hsl(var(--success) / 0.1); color: hsl(var(--success)); }
.ns-alloc { background: hsl(var(--primary) / 0.1); color: hsl(var(--primary)); }
.ns-down { background: hsl(var(--destructive) / 0.1); color: hsl(var(--destructive)); }
.ns-unk { background: hsl(var(--muted)); color: hsl(var(--muted-foreground)); }

/* ── Alerts tab ── */
.local-cfg-card {
  margin: 1rem;
  padding: 1rem;
  background: hsl(var(--muted) / 0.3);
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
}

.lcc-title { font-size: 0.85rem; font-weight: 600; color: hsl(var(--foreground)); margin-bottom: 0.6rem; }
.lcc-row { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; font-size: 0.82rem; }

.num-input {
  width: 60px;
  padding: 3px 6px;
  font-size: 0.82rem;
  border-radius: var(--radius-sm);
  margin: 0 4px;
}

.toggle { position: relative; display: inline-block; width: 34px; height: 18px; margin-left: 4px; }
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute; inset: 0; cursor: pointer;
  background: hsl(var(--muted)); border-radius: var(--radius-full); transition: 0.2s;
}
.toggle-slider::before {
  content: ''; position: absolute; width: 12px; height: 12px;
  left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.2s;
}
.toggle input:checked + .toggle-slider { background: hsl(var(--primary)); }
.toggle input:checked + .toggle-slider::before { transform: translateX(16px); }

.sound-upload-row { display: flex; align-items: center; gap: 0.75rem; margin-top: 0.75rem; flex-wrap: wrap; }
.sound-upload-area { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.sound-upload-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; font-size: 0.78rem; cursor: pointer;
  background: hsl(var(--secondary)); border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm); color: hsl(var(--foreground));
}
.sound-name { font-size: 0.78rem; color: hsl(var(--muted-foreground)); }
.sound-hint { font-size: 0.75rem; color: hsl(var(--muted-foreground)); }
.save-tip { font-size: 0.78rem; color: hsl(var(--success)); }

.alerts-rules-title {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.75rem 1rem;
  font-size: 0.9rem; font-weight: 600; color: hsl(var(--foreground));
  border-bottom: 1px solid hsl(var(--border));
}

.alerts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  padding: 1rem;
}

.alert-card {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  overflow: hidden;
}

.alert-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--foreground));
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--muted) / 0.3);
}

.rule-search {
  padding: 4px 8px; font-size: 0.78rem;
  border-radius: var(--radius-sm); width: 180px;
}

.sev-badge { font-size: 0.72rem; padding: 1px 6px; border-radius: var(--radius-full); font-weight: 600; }
.sev-critical { background: hsl(var(--destructive) / 0.1); color: hsl(var(--destructive)); }
.sev-warning { background: hsl(var(--warning) / 0.1); color: hsl(var(--warning)); }
.sev-info { background: hsl(var(--primary) / 0.1); color: hsl(var(--primary)); }

.state-badge2 { font-size: 0.72rem; padding: 1px 6px; border-radius: var(--radius-full); font-weight: 600; }
.st-ok { background: hsl(var(--success) / 0.1); color: hsl(var(--success)); }
.st-firing { background: hsl(var(--destructive) / 0.1); color: hsl(var(--destructive)); }
.st-pending { background: hsl(var(--warning) / 0.1); color: hsl(var(--warning)); }

.expr-cell { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.75rem; font-family: monospace; }

/* ── Alert popup ── */
.alert-popup-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999;
}

.alert-popup {
  display: flex; flex-direction: column;
  width: 90%; max-width: 560px;
  background: hsl(var(--background));
  border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.25);
  border: 2px solid; overflow: hidden;
}

.ap-critical { border-color: hsl(var(--destructive) / 0.5); }
.ap-warning { border-color: hsl(var(--warning) / 0.5); }

/* 顶部色条 */
.alert-popup::before {
  content: ''; display: block; height: 5px; width: 100%;
}
.ap-critical::before { background: hsl(var(--destructive)); }
.ap-warning::before { background: hsl(var(--warning)); }

.ap-icon {
  font-size: 3.5rem; text-align: center;
  padding: 1.5rem 0 0.5rem;
}
.ap-body { flex: 1; padding: 0 2rem 1.5rem; }
.ap-title {
  font-size: 1.4rem; font-weight: 800;
  color: hsl(var(--foreground));
  text-align: center; margin-bottom: 1rem;
}
.ap-list {
  display: flex; flex-direction: column; gap: 0.5rem;
  max-height: 280px; overflow-y: auto;
}
.ap-item {
  display: flex; align-items: center; gap: 0.6rem;
  font-size: 0.95rem; color: hsl(var(--foreground));
  padding: 0.5rem 0.75rem;
  background: hsl(var(--muted) / 0.5);
  border-radius: 8px;
}
.ap-close {
  display: block; width: 100%;
  background: hsl(var(--muted)); border: none; cursor: pointer;
  font-size: 0.9rem; font-weight: 600;
  color: hsl(var(--muted-foreground));
  padding: 0.75rem; border-top: 1px solid hsl(var(--border));
  transition: background 0.15s;
}
.ap-close:hover { background: hsl(var(--accent)); color: hsl(var(--accent-foreground)); }

/*  Dashboard Grid  */
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  padding: 0.5rem 0;
}
.db-card {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.db-span2 { grid-column: span 2; }
.db-card-hd {
  font-size: 0.85rem;
  font-weight: 700;
  color: hsl(var(--foreground));
  display: flex;
  align-items: center;
  border-bottom: 1px solid hsl(var(--border));
  padding-bottom: 0.5rem;
}
.db-na { color: hsl(var(--muted-foreground)); font-size: 0.82rem; padding: 0.5rem 0; }

/* 资源环形图 */
.db-metrics-row { display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; }
.db-metric { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; }
.db-metric-ring { position: relative; width: 80px; height: 80px; }
.db-metric-ring svg { width: 100%; height: 100%; }
.db-ring-val {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.9rem; font-weight: 700; color: hsl(var(--foreground));
}
.db-metric-label { font-size: 0.72rem; color: hsl(var(--muted-foreground)); text-align: center; }
.db-stat-col { display: flex; flex-direction: column; gap: 0.35rem; flex: 1; min-width: 160px; }
.db-stat-row { display: flex; gap: 0.5rem; font-size: 0.8rem; }
.db-stat-k { color: hsl(var(--muted-foreground)); min-width: 60px; }
.db-stat-v { color: hsl(var(--foreground)); font-weight: 500; }

/* 节点状态分布 */
.db-state-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 0.5rem; }
.db-state-item { border-radius: 8px; padding: 0.6rem 0.4rem; text-align: center; border: 1px solid transparent; }
.dsi-count { font-size: 1.6rem; font-weight: 800; line-height: 1; }
.dsi-label { font-size: 0.68rem; margin-top: 0.2rem; }
.dsi-idle { background: #d1fae5; border-color: #6ee7b7; color: #065f46; }
.dsi-alloc { background: #dbeafe; border-color: #93c5fd; color: #1e40af; }
.dsi-mix { background: #fef3c7; border-color: #fcd34d; color: #92400e; }
.dsi-down { background: #fee2e2; border-color: #fca5a5; color: #991b1b; }
.dsi-drain { background: #f3f4f6; border-color: #d1d5db; color: #374151; }
.dsi-default { background: #f3f4f6; border-color: #e5e7eb; color: #6b7280; }

/* 作业统计 */
.db-job-stats { display: flex; flex-direction: column; gap: 0.4rem; }
.db-job-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.78rem; }
.db-job-name { min-width: 60px; color: hsl(var(--foreground)); font-weight: 500; }
.db-job-bar-wrap { flex: 1; height: 8px; background: hsl(var(--muted)); border-radius: 4px; overflow: hidden; }
.db-job-bar { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); border-radius: 4px; transition: width 0.3s; }
.db-job-val { min-width: 24px; text-align: right; color: hsl(var(--muted-foreground)); }

/* 服务状态 */
.db-targets-grid { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.db-target {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.35rem 0.75rem; border-radius: 20px;
  font-size: 0.78rem; border: 1px solid transparent;
}
.dt-up { background: #d1fae5; border-color: #6ee7b7; color: #065f46; }
.dt-down { background: #fee2e2; border-color: #fca5a5; color: #991b1b; }
.dt-dot { font-size: 0.6rem; }
.dt-job { font-weight: 600; }
.dt-inst { opacity: 0.75; }

/*  Cluster View  */
.cluster-view { display: flex; flex-direction: column; gap: 0.75rem; padding: 0.5rem 0; }
.cluster-toolbar { display: flex; align-items: center; gap: 0.75rem; }
.cluster-count { font-size: 0.82rem; color: hsl(var(--muted-foreground)); }

.node-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.75rem;
}
.node-card {
  border-radius: 10px; padding: 0.85rem;
  border: 1.5px solid hsl(var(--border));
  background: hsl(var(--card));
  transition: box-shadow 0.15s, transform 0.15s;
}
.node-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); transform: translateY(-1px); }
.nc-ok  { border-color: #6ee7b7; }
.nc-warn { border-color: #fcd34d; }
.nc-crit { border-color: #fca5a5; }

.nc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; }
.nc-name { font-size: 0.88rem; font-weight: 700; color: hsl(var(--foreground)); font-family: monospace; }
.nc-state { font-size: 0.7rem; font-weight: 600; padding: 0.15rem 0.5rem; border-radius: 10px; }
.ncs-ok   { background: #d1fae5; color: #065f46; }
.ncs-warn { background: #fef3c7; color: #92400e; }
.ncs-crit { background: #fee2e2; color: #991b1b; }

.nc-metrics { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 0.6rem; }
.nc-metric {}
.nc-bar-label { display: flex; justify-content: space-between; font-size: 0.72rem; color: hsl(var(--muted-foreground)); margin-bottom: 0.15rem; }
.nc-bar-bg { height: 6px; background: hsl(var(--muted)); border-radius: 3px; overflow: hidden; }
.nc-bar-fg { height: 100%; border-radius: 3px; transition: width 0.4s; }
.bar-ok   { background: #10b981; }
.bar-warn { background: #f59e0b; }
.bar-crit { background: #ef4444; }

.nc-footer { display: flex; gap: 0.5rem; flex-wrap: wrap; font-size: 0.68rem; color: hsl(var(--muted-foreground)); border-top: 1px solid hsl(var(--border)); padding-top: 0.4rem; }

/* ── Alerts sub-tabs ── */
.alert-subtabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid hsl(var(--border));
  background: hsl(var(--card));
  padding: 0 1rem;
}

.alert-subtab {
  display: inline-flex;
  align-items: center;
  padding: 0.65rem 1.1rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.alert-subtab:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 0.4);
}

.alert-subtab.active {
  color: hsl(var(--primary));
  border-bottom-color: hsl(var(--primary));
  font-weight: 600;
}

.alert-tab-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

/* ── Responsive ── */
@media (max-width: 900px) {
  .charts-grid, .slurm-grid, .alerts-grid { grid-template-columns: 1fr; }
}
</style>


