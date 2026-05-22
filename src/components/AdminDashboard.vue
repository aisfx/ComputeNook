<template>
  <div class="db" ref="dashEl" :style="{
    '--db-bg': themeVars.bg,
    '--db-header-bg': themeVars.headerBg,
    '--db-header-border': themeVars.headerBorder,
    '--db-card-bg': themeVars.cardBg,
    '--db-card-border': themeVars.cardBorder,
    '--db-kpi-bg': themeVars.kpiBg,
    '--db-text': themeVars.text,
    '--db-sub': themeVars.subText,
    '--db-res-bg': themeVars.resBg,
  }">
    <!-- 顶部标题栏 -->
    <div class="db-header">
      <div class="db-header-left">
        <div class="db-logo"></div>
        <div>
          <div class="db-title">算力小筑集群监控大屏</div>
          <div class="db-subtitle">High Performance Computing Cluster</div>
        </div>
      </div>
      <div class="db-header-center">
        <div class="db-time">{{ currentTime }}</div>
        <div class="db-date">{{ currentDate }}</div>
      </div>
      <div class="db-header-right">
        <div :class="['db-status', alertCount>0 ? 'db-status-warn' : 'db-status-ok']">
          <span class="db-status-dot"></span>{{ alertCount>0 ? alertCount+' 条告警' : '系统正常' }}
        </div>
        <button class="db-btn" @click="loadAll" :disabled="loading">🔄</button>
        <button class="db-btn" @click="toggleFullscreen">{{ isFullscreen ? '⊠' : '⛶' }}</button>
      </div>
    </div>

    <!-- KPI 行 -->
    <div class="db-kpi-row">
      <div class="db-kpi" v-for="k in kpiList" :key="k.label" :style="{'--kc':k.color}">
        <div class="db-kpi-accent"></div>
        <div class="db-kpi-val">{{ k.val }}</div>
        <div class="db-kpi-label">{{ k.label }}</div>
        <div class="db-kpi-bar"><div class="db-kpi-bar-fill" :style="{width:k.pct+'%'}"></div></div>
      </div>
    </div>

    <!-- 主内容：三列 -->
    <div class="db-main">

      <!-- 左列 -->
      <div class="db-col db-col-left">
        <!-- 算力统计 -->
        <div class="db-card db-card-fixed">
          <div class="db-card-title">⚡ 算力统计</div>
          <!-- CPU 算力 -->
          <div class="db-compute-section">
            <div class="db-compute-type">CPU 算力</div>
            <div class="db-compute-items">
              <div class="db-compute-item">
                <div class="db-compute-label">FP64 双精度</div>
                <div class="db-compute-val" style="color:#3b82f6">{{ cpuCompute.fp64 }}</div>
                <div class="db-compute-unit">TFLOPS</div>
              </div>
              <div class="db-compute-item">
                <div class="db-compute-label">FP32 单精度</div>
                <div class="db-compute-val" style="color:#60a5fa">{{ cpuCompute.fp32 }}</div>
                <div class="db-compute-unit">TFLOPS</div>
              </div>
            </div>
            <div class="db-compute-used">
              <span class="db-compute-used-label">已用核数</span>
              <span class="db-compute-used-val">{{ clusterRes.cpuTotal - clusterRes.cpuFree }} / {{ clusterRes.cpuTotal }}</span>
            </div>
          </div>
          <div class="db-compute-divider"></div>
          <!-- GPU 算力 -->
          <div class="db-compute-section">
            <div class="db-compute-type">GPU 算力</div>
            <div class="db-compute-items db-compute-items-3">
              <div class="db-compute-item">
                <div class="db-compute-label">FP32</div>
                <div class="db-compute-val" style="color:#10b981">{{ gpuCompute.fp32 }}</div>
                <div class="db-compute-unit">TFLOPS</div>
              </div>
              <div class="db-compute-item">
                <div class="db-compute-label">FP16</div>
                <div class="db-compute-val" style="color:#34d399">{{ gpuCompute.fp16 }}</div>
                <div class="db-compute-unit">TFLOPS</div>
              </div>
              <div class="db-compute-item">
                <div class="db-compute-label">INT8</div>
                <div class="db-compute-val" style="color:#6ee7b7">{{ gpuCompute.int8 }}</div>
                <div class="db-compute-unit">TOPS</div>
              </div>
            </div>
            <div class="db-compute-used">
              <span class="db-compute-used-label">已用GPU</span>
              <span class="db-compute-used-val">{{ clusterRes.gpuTotal - clusterRes.gpuFree }} / {{ clusterRes.gpuTotal }}</span>
            </div>
          </div>
        </div>
        <!-- 资源统计 -->
        <div class="db-card db-card-fixed">
          <div class="db-card-title">🖥️ 资源统计</div>
          <div class="db-res-grid">
            <div class="db-res-item"><div class="db-res-val">{{ clusterRes.cpuTotal }}</div><div class="db-res-label">CPU总核数</div></div>
            <div class="db-res-item"><div class="db-res-val" style="color:#10b981">{{ clusterRes.cpuFree }}</div><div class="db-res-label">空闲核数</div></div>
            <div class="db-res-item"><div class="db-res-val">{{ clusterRes.memTotal }}</div><div class="db-res-label">内存总量(GB)</div></div>
            <div class="db-res-item"><div class="db-res-val" style="color:#10b981">{{ clusterRes.memFree }}</div><div class="db-res-label">空闲内存(GB)</div></div>
            <div class="db-res-item"><div class="db-res-val" style="color:#8b5cf6">{{ clusterRes.gpuTotal }}</div><div class="db-res-label">GPU总卡数</div></div>
            <div class="db-res-item"><div class="db-res-val" style="color:#10b981">{{ clusterRes.gpuFree }}</div><div class="db-res-label">空闲GPU</div></div>
          </div>
        </div>
        <!-- 作业类型 -->
        <div class="db-card db-card-fill">
          <div class="db-card-title">📊 作业类型分布</div>
          <div ref="jobPieEl" class="db-chart-fill"></div>
        </div>
      </div>

      <!-- 中列：网络拓扑图 -->
      <div class="db-col db-col-center">
        <div class="db-card db-card-fill">
          <div class="db-card-header">
            <span class="db-card-title">🌐 集群网络拓扑</span>
            <div class="db-legend">
              <span class="db-leg"><i style="background:#10b981"></i>空闲</span>
              <span class="db-leg"><i style="background:#f59e0b"></i>繁忙</span>
              <span class="db-leg"><i style="background:#ef4444"></i>故障</span>
              <span class="db-leg"><i style="background:#6366f1"></i>正常</span>
            </div>
          </div>
          <div class="db-topo-wrap">
            <div ref="topoEl" class="db-chart-fill"></div>
            <canvas ref="topoFlowEl" class="db-topo-flow"></canvas>
          </div>
          <div class="db-node-stats">
            <div class="db-ns-item"><div class="db-ns-num" style="color:#ef4444">{{ clusterNodeStates.unschedulable }}</div><div class="db-ns-label">不可调度</div></div>
            <div class="db-ns-item"><div class="db-ns-num" style="color:#f59e0b">{{ clusterNodeStates.busy }}</div><div class="db-ns-label">繁忙</div></div>
            <div class="db-ns-item"><div class="db-ns-num" style="color:#6366f1">{{ clusterNodeStates.normal }}</div><div class="db-ns-label">正常</div></div>
            <div class="db-ns-item"><div class="db-ns-num" style="color:#10b981">{{ clusterNodeStates.idle }}</div><div class="db-ns-label">空闲</div></div>
          </div>
        </div>
      </div>

      <!-- 右列：排行榜 -->
      <div class="db-col db-col-right">
        <!-- 用户活跃排行 -->
        <div class="db-card db-card-rank">
          <div class="db-card-header">
            <span class="db-card-title">🏆 用户活跃 TOP10</span>
            <span class="db-rank-meta">作业数</span>
          </div>
          <div class="db-rank-list-bar">
            <div v-if="userRankList.length === 0" class="db-rank-empty">暂无数据</div>
            <div v-for="(u, i) in userRankList.slice(0,10)" :key="u.name" class="db-rank-bar-item">
              <div class="db-rank-badge" :class="'rank-'+(i+1)">{{ i+1 }}</div>
              <div class="db-rank-bar-label">{{ u.name }}</div>
              <div class="db-rank-bar-container">
                <div class="db-rank-bar-fill" :style="{
                  width: (u.count/userRankList[0].count*100)+'%',
                  background: `linear-gradient(90deg, ${i===0?'#f59e0b':'#3b82f6'}, ${i===0?'#fb923c':'#60a5fa'})`
                }">
                  <div class="db-rank-bar-shine"></div>
                </div>
                <div class="db-rank-bar-value">{{ u.count }}</div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 节点使用排行 -->
        <div class="db-card db-card-rank">
          <div class="db-card-header">
            <span class="db-card-title">🖥️ 节点使用 TOP10</span>
            <span class="db-rank-meta">节点数</span>
          </div>
          <div class="db-rank-list-bar">
            <div v-if="userNodeRankList.length === 0" class="db-rank-empty">暂无数据</div>
            <div v-for="(u, i) in userNodeRankList.slice(0,10)" :key="u.name" class="db-rank-bar-item">
              <div class="db-rank-badge" :class="'rank-'+(i+1)">{{ i+1 }}</div>
              <div class="db-rank-bar-label">{{ u.name }}</div>
              <div class="db-rank-bar-container">
                <div class="db-rank-bar-fill" :style="{
                  width: (u.nodes/userNodeRankList[0].nodes*100)+'%',
                  background: `linear-gradient(90deg, ${i===0?'#10b981':'#3b82f6'}, ${i===0?'#34d399':'#60a5fa'})`
                }">
                  <div class="db-rank-bar-shine"></div>
                </div>
                <div class="db-rank-bar-value">{{ u.nodes }}</div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 存储使用排行 -->
        <div class="db-card db-card-rank">
          <div class="db-card-header">
            <span class="db-card-title">💾 存储使用 TOP10</span>
            <span class="db-rank-meta">GB</span>
          </div>
          <div ref="storageChartEl" class="db-chart-fill"></div>
        </div>
      </div>
    </div>

    <!-- 底部：作业信息和告警 -->
    <div class="db-bottom">
      <!-- 作业运行曲线 -->
      <div class="db-card db-card-bottom">
        <div class="db-card-header">
          <span class="db-card-title">📈 作业运行曲线</span>
          <div class="db-legend">
            <span class="db-leg"><i style="background:#3b82f6"></i>运行</span>
            <span class="db-leg"><i style="background:#f59e0b"></i>排队</span>
          </div>
        </div>
        <div ref="jobCurveEl" class="db-chart-bottom"></div>
      </div>
      
      <!-- 资源趋势 -->
      <div class="db-card db-card-bottom">
        <div class="db-card-header">
          <span class="db-card-title">⚡ 资源趋势</span>
          <div class="db-tabs">
            <button :class="['db-tab',trendTab==='cpu'&&'active']" @click="trendTab='cpu';drawTrend()">CPU</button>
            <button :class="['db-tab',trendTab==='mem'&&'active']" @click="trendTab='mem';drawTrend()">内存</button>
            <button :class="['db-tab',trendTab==='gpu'&&'active']" @click="trendTab='gpu';drawTrend()">GPU</button>
          </div>
        </div>
        <div ref="trendEl" class="db-chart-bottom"></div>
      </div>
      
      <!-- 告警监控 -->
      <div class="db-card db-card-bottom">
        <div class="db-card-header">
          <span class="db-card-title">🔔 告警监控</span>
          <span class="db-rank-meta">实时</span>
        </div>
        <div class="db-alert-list">
          <div v-if="recentAlerts.length===0" class="db-alert-empty">
            <div class="db-alert-ok-icon">✓</div>
            <div class="db-alert-ok-text">系统正常</div>
            <div class="db-alert-ok-sub">无异常告警</div>
          </div>
          <div v-for="a in recentAlerts" :key="a.id" :class="['db-alert-item','db-alert-'+a.level]">
            <div class="db-alert-icon">
              <span v-if="a.level==='error'">⚠️</span>
              <span v-else-if="a.level==='warning'">⚡</span>
              <span v-else>ℹ️</span>
            </div>
            <div class="db-alert-content">
              <span class="db-alert-name">{{ a.name }}</span>
              <span class="db-alert-time">{{ a.time }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { getApiBase, getToken } from '../utils/auth'
import * as echarts from 'echarts/core'
import { PieChart, BarChart, LineChart, ScatterChart, GaugeChart, GraphChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
echarts.use([PieChart, BarChart, LineChart, ScatterChart, GaugeChart, GraphChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

// ── 主题感知 ──────────────────────────────────────────────
const currentTheme = ref(document.documentElement.getAttribute('data-theme') || 'light')
let themeObserver: MutationObserver | null = null

const isDark = computed(() => currentTheme.value === 'dark' || currentTheme.value === 'ocean')

const themeVars = computed(() => {
  if (currentTheme.value === 'dark') return {
    bg: 'linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f172a 100%)',
    headerBg: 'rgba(15,23,42,.8)', headerBorder: 'rgba(99,102,241,.3)',
    cardBg: 'rgba(30,41,59,.7)', cardBorder: 'rgba(255,255,255,.06)',
    kpiBg: 'rgba(30,41,59,.8)', text: '#e2e8f0', subText: '#64748b',
    splitLine: '#1e293b', axisLine: '#334155', chartText: '#64748b',
    resBg: 'rgba(255,255,255,.03)', gaugeTrack: 'rgba(255,255,255,0.06)',
  }
  if (currentTheme.value === 'ocean') return {
    bg: 'linear-gradient(135deg,#0a1628 0%,#0d2137 50%,#0a1628 100%)',
    headerBg: 'rgba(10,22,40,.9)', headerBorder: 'rgba(56,189,248,.3)',
    cardBg: 'rgba(13,33,55,.8)', cardBorder: 'rgba(56,189,248,.08)',
    kpiBg: 'rgba(13,33,55,.9)', text: '#e0f2fe', subText: '#4a7fa5',
    splitLine: '#0d2137', axisLine: '#1e3a5f', chartText: '#4a7fa5',
    resBg: 'rgba(56,189,248,.04)', gaugeTrack: 'rgba(56,189,248,0.06)',
  }
  // light
  return {
    bg: 'linear-gradient(135deg,#f0f4ff 0%,#e8edf8 50%,#f0f4ff 100%)',
    headerBg: 'rgba(255,255,255,.9)', headerBorder: 'rgba(99,102,241,.2)',
    cardBg: 'rgba(255,255,255,.9)', cardBorder: 'rgba(0,0,0,.08)',
    kpiBg: 'rgba(255,255,255,.95)', text: '#1e293b', subText: '#64748b',
    splitLine: '#e2e8f0', axisLine: '#cbd5e1', chartText: '#64748b',
    resBg: 'rgba(0,0,0,.03)', gaugeTrack: 'rgba(0,0,0,0.06)',
  }
})

const loading = ref(false)
const currentTime = ref('')
const currentDate = ref('')
const isFullscreen = ref(false)
const dashEl = ref<HTMLElement>()
type TrendTab = 'cpu' | 'mem' | 'gpu'
const trendTab = ref<TrendTab>('cpu')
let clockTimer: any = null
let refreshTimer: any = null

const stats = ref({ totalNodes:0, runningJobs:0, pendingJobs:0, completedJobs:0, cpuUtil:0, memUtil:0, activeUsers:0, totalUsers:0,
  totalGpus:0, allocGpus:0,
  totalCpus:0, allocCpus:0, totalMemGb:0, freeMemGb:0,
  jobTypes:{ mpi:0, openmp:0, gpu:0, array:0, serial:0 } })
const nodes = ref<any[]>([])
const trendData = ref<{time:string;cpu:number;mem:number}[]>([])
const recentAlerts = ref<{id:number;name:string;level:string;time:string}[]>([])
const jobHistoryForRank = ref<any[]>([])
const alertCount = computed(() => recentAlerts.value.length)

// 用户7天活跃排行（按作业数降序，取前8）
const userRankList = computed(() => {
  const map: Record<string, number> = {}
  for (const j of jobHistoryForRank.value) {
    const u = j.user_name || j.user_id || j.user || ''
    if (u) map[u] = (map[u] || 0) + 1
  }
  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
})

// 用户使用节点数量排名（按节点数降序，取前8）
const userNodeRankList = computed(() => {
  const map: Record<string, number> = {}
  for (const j of jobHistoryForRank.value) {
    const u = j.user_name || j.user_id || j.user || ''
    const nodeCount = j.num_nodes || j.nodes || 1
    if (u) map[u] = (map[u] || 0) + nodeCount
  }
  return Object.entries(map)
    .map(([name, nodes]) => ({ name, nodes }))
    .sort((a, b) => b.nodes - a.nodes)
    .slice(0, 8)
})

// 用户存储使用排名（模拟数据，实际需要从API获取）
const userStorageRankList = computed(() => {
  // TODO: 从 /api/users 或 /api/files/quota 获取真实存储数据
  // 这里先用模拟数据展示
  const mockData = [
    { name: 'admin', storage: 1024 },
    { name: 'user1', storage: 856 },
    { name: 'user2', storage: 642 },
    { name: 'user3', storage: 512 },
    { name: 'user4', storage: 384 },
    { name: 'user5', storage: 256 },
    { name: 'user6', storage: 128 },
    { name: 'user7', storage: 96 },
    { name: 'user8', storage: 64 },
    { name: 'user9', storage: 32 },
  ]
  return mockData.sort((a, b) => b.storage - a.storage)
})

const clusterNodeStates = computed(() => {
  const r = { unschedulable:0, busy:0, normal:0, idle:0 }
  for (const n of nodes.value) {
    const s = (n.state||'').toLowerCase()
    if (s.includes('down')||s.includes('drain')) { r.unschedulable++; continue }
    const u = n.cpuTotal>0 ? n.cpuAlloc/n.cpuTotal : 0
    if (u>=0.7) r.busy++; else if (u>=0.2) r.normal++; else r.idle++
  }
  return r
})
const clusterRes = computed(() => {
  // 优先用 dashboard/stats 的聚合数据，fallback 到 node-metrics 累加
  const cpuTotal = stats.value.totalCpus || nodes.value.reduce((s:number,n:any)=>s+(n.cpuTotal||0),0)
  const cpuFree  = Math.max(0, (stats.value.totalCpus || 0) - (stats.value.allocCpus || 0))
  const memTotal = stats.value.totalMemGb > 0 ? stats.value.totalMemGb : nodes.value.reduce((s:number,n:any)=>s+(n.memTotal||0),0)
  const memFree  = stats.value.freeMemGb > 0 ? stats.value.freeMemGb : nodes.value.reduce((s:number,n:any)=>s+Math.max(0,(n.memTotal||0)-(n.memAlloc||0)),0)
  return { cpuTotal: Math.round(cpuTotal), cpuFree: Math.round(cpuFree), memTotal: memTotal.toFixed(0), memFree: memFree.toFixed(0), gpuTotal: stats.value.totalGpus, gpuFree: Math.max(0, stats.value.totalGpus - stats.value.allocGpus) }
})

const totalCpuHours = computed(() => nodes.value.reduce((s:number,n:any)=>s+(n.cpuAlloc||0),0))

// 算力估算：CPU FP64 ≈ 核数 × 16 GFLOPS，FP32 ≈ 核数 × 32 GFLOPS
// GPU FP32 ≈ GPU卡数 × 10 TFLOPS，FP16 × 2，INT8 × 4（典型A100/V100估算）
const cpuCompute = computed(() => {
  const cores = stats.value.totalCpus || nodes.value.reduce((s:number,n:any)=>s+(n.cpuTotal||0),0)
  return {
    fp64: cores > 0 ? (cores * 16 / 1000).toFixed(1) : '--',
    fp32: cores > 0 ? (cores * 32 / 1000).toFixed(1) : '--',
  }
})
const gpuCompute = computed(() => {
  const gpus = stats.value.totalGpus
  return {
    fp32: gpus > 0 ? (gpus * 10).toFixed(1) : '--',
    fp16: gpus > 0 ? (gpus * 20).toFixed(1) : '--',
    int8: gpus > 0 ? (gpus * 40).toFixed(1) : '--',
  }
})
const kpiList = computed(() => [
  { icon:'', label:'总节点数',   val:stats.value.totalNodes,  pct:100, color:'#3b82f6' },
  { icon:'', label:'CPU利用率',  val:stats.value.cpuUtil+'%', pct:stats.value.cpuUtil, color:'#10b981' },
  { icon:'', label:'内存利用率', val:stats.value.memUtil+'%', pct:stats.value.memUtil, color:'#8b5cf6' },
  { icon:'', label:'运行作业',   val:stats.value.runningJobs, pct:Math.min(100,stats.value.runningJobs*5), color:'#f97316' },
  { icon:'', label:'活跃用户',   val:stats.value.activeUsers + ' / ' + stats.value.totalUsers, pct: stats.value.totalUsers>0 ? Math.round(stats.value.activeUsers/stats.value.totalUsers*100) : 0, color:'#06b6d4' },
])

const toggleFullscreen = () => {
  if (!dashEl.value) return
  if (!document.fullscreenElement) { dashEl.value.requestFullscreen(); isFullscreen.value=true }
  else { document.exitFullscreen(); isFullscreen.value=false }
}

const jobPieEl   = ref<HTMLElement>()
const queueEl    = ref<HTMLElement>()
const clusterEl  = ref<HTMLElement>()
const topoEl     = ref<HTMLElement>()
const topoFlowEl = ref<HTMLCanvasElement>()
const jobCurveEl = ref<HTMLElement>()
const trendEl    = ref<HTMLElement>()
const storageChartEl = ref<HTMLElement>()
let jobPie:      echarts.ECharts|null=null
let queueChart:  echarts.ECharts|null=null
let clusterChart:echarts.ECharts|null=null
let topoChart:   echarts.ECharts|null=null
let storageChart: echarts.ECharts|null=null
// 流量粒子动画
let flowRaf: number = 0
type FlowLink = { x1:number; y1:number; x2:number; y2:number; color:string; active:boolean }
type Particle = { link:FlowLink; t:number; speed:number }
let flowLinks: FlowLink[] = []
let particles: Particle[] = []
let jobCurve:    echarts.ECharts|null=null
let trendChart:  echarts.ECharts|null=null
let gaugeCpu:    echarts.ECharts|null=null
let gaugeMem:    echarts.ECharts|null=null
let gaugeGpu:    echarts.ECharts|null=null

const drawTopo = async () => {
  await nextTick()
  if (!topoEl.value) return
  if (!topoChart) { topoChart = echarts.init(topoEl.value) }
  topoChart.resize()

  const W = topoEl.value.clientWidth  || 400
  const H = topoEl.value.clientHeight || 500

  const graphNodes: any[] = []
  const graphLinks: any[] = []
  const rawLinks: {src:string; tgt:string; active:boolean}[] = []

  const aggCount = Math.min(4, Math.max(2, Math.ceil(nodes.value.length / 8)))

  // 以 (0,0) 为中心的相对坐标，半径根据容器尺寸计算
  const AGG_R  = Math.min(W, H) * 0.22
  const NODE_R = Math.min(W, H) * 0.42

  graphNodes.push({
    id:'core', name:'核心交换机', x:0, y:0, symbolSize:38,
    itemStyle:{color:'#6366f1',shadowBlur:20,shadowColor:'#6366f1'},
    label:{show:true,color:'#e2e8f0',fontSize:10,position:'inside'},
  })

  for (let i = 0; i < aggCount; i++) {
    const angle = (i / aggCount) * Math.PI * 2 - Math.PI / 2
    const id = `agg${i}`
    graphNodes.push({
      id, name:`汇聚${i+1}`,
      x: Math.cos(angle) * AGG_R,
      y: Math.sin(angle) * AGG_R,
      symbolSize:26,
      itemStyle:{color:'#3b82f6',shadowBlur:15,shadowColor:'#3b82f6'},
      label:{show:true,color:'#e2e8f0',fontSize:9,position:'inside'},
    })
    graphLinks.push({ source:'core', target:id, lineStyle:{color:'rgba(99,102,241,0.5)',width:2} })
    rawLinks.push({ src:'core', tgt:id, active:true })

    const myNodes = nodes.value.length > 0
      ? nodes.value.filter((_,idx) => idx % aggCount === i)
      : Array.from({length:4}, (_,j) => ({name:`node${i*4+j+1}`,state:'idle',cpuAlloc:0,cpuTotal:8}))
    const sliced = myNodes.slice(0, 8)
    const spread = Math.min(Math.PI * 0.55, sliced.length * 0.2)
    sliced.forEach((n, j) => {
      const na = angle + (sliced.length > 1 ? (j / (sliced.length - 1) - 0.5) * spread : 0)
      const nid = `n_${i}_${j}`
      const nc = nodeColor(n.state)
      const hasTraffic = (n.cpuAlloc||0) > 0
        || n.state?.toLowerCase().includes('alloc')
        || n.state?.toLowerCase().includes('mix')
      graphNodes.push({
        id:nid, name:n.name||`node${j+1}`,
        x: Math.cos(na) * NODE_R,
        y: Math.sin(na) * NODE_R,
        symbolSize:14,
        itemStyle:{color:nc,shadowBlur:8,shadowColor:nc},
        label:{show:false},
      })
      graphLinks.push({
        source:id, target:nid,
        lineStyle:{color: hasTraffic ? 'rgba(59,130,246,0.6)' : 'rgba(59,130,246,0.2)', width: hasTraffic ? 1.5 : 1},
      })
      rawLinks.push({ src:id, tgt:nid, active:hasTraffic })
    })
  }

  // 先渲染节点数据，zoom/center 在 setTimeout 里修正
  topoChart.setOption({
    backgroundColor:'transparent',
    tooltip:{ formatter:(p:any) => p.data?.name || '' },
    series:[{
      type:'graph', layout:'none', roam:true,
      zoom:0.8, center:['50%','50%'],
      nodes:graphNodes, edges:graphLinks,
      lineStyle:{curveness:0.06},
      emphasis:{focus:'adjacency'},
      animationDuration:1000, animationEasing:'elasticOut' as const,
    }],
  })

  // 延迟读取容器尺寸，确保 DOM 已稳定渲染
  await nextTick()
  setTimeout(() => {
    if (!topoChart || !topoEl.value) return
    topoChart.resize()
    const RW = topoEl.value.clientWidth  || 400
    const RH = topoEl.value.clientHeight || 500

    const xs = graphNodes.map((n:any) => n.x)
    const ys = graphNodes.map((n:any) => n.y)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const spanX = maxX - minX || 1
    const spanY = maxY - minY || 1
    const gcx = (minX + maxX) / 2
    const gcy = (minY + maxY) / 2
    const zoom = Math.min((RW * 0.75) / spanX, (RH * 0.75) / spanY)

    topoChart.setOption({
      series:[{ zoom, center:[gcx, gcy] }]
    })
    startFlowAnimation(graphNodes, rawLinks)
  }, 150)
}

// 将图坐标系转换为 canvas 像素坐标 —— 使用 ECharts convertToPixel 精确对齐
const topoCoordToPixel = (nx:number, ny:number) => {
  if (!topoChart) return { x:0, y:0 }
  const pt = topoChart.convertToPixel({ seriesIndex:0 }, [nx, ny]) as [number, number]
  return { x: pt[0], y: pt[1] }
}

const startFlowAnimation = (graphNodes: any[], rawLinks: {src:string;tgt:string;active:boolean}[]) => {
  cancelAnimationFrame(flowRaf)
  const canvas = topoFlowEl.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // canvas 尺寸与 echarts 容器保持一致
  const syncSize = () => {
    const parent = canvas.parentElement
    if (parent) { canvas.width = parent.clientWidth; canvas.height = parent.clientHeight }
  }
  syncSize()

  // 节点 id -> 图坐标
  const nodeMap: Record<string, {x:number;y:number}> = {}
  graphNodes.forEach(n => { nodeMap[n.id] = {x:n.x, y:n.y} })

  // 只对有流量的链路生成粒子，存储图坐标（每帧用 convertToPixel 转换）
  flowLinks = rawLinks
    .filter(l => l.active && nodeMap[l.src] && nodeMap[l.tgt])
    .map(l => {
      const s = nodeMap[l.src], t = nodeMap[l.tgt]
      return { x1:s.x, y1:s.y, x2:t.x, y2:t.y, color:'#60a5fa', active:true }
    })

  // 初始化粒子，错开初始位置
  particles = []
  flowLinks.forEach(link => {
    const count = 2 + Math.floor(Math.random()*2)
    for (let i=0;i<count;i++) {
      particles.push({ link, t: i/count, speed: 0.004 + Math.random()*0.003 })
    }
  })

  const draw = () => {
    syncSize()
    const w = canvas.width, h = canvas.height
    ctx.clearRect(0, 0, w, h)

    particles.forEach(p => {
      p.t += p.speed
      if (p.t > 1) p.t -= 1

      const { x1, y1, x2, y2 } = p.link
      // 每帧通过 ECharts API 获取精确像素坐标
      const gx = x1 + (x2 - x1) * p.t
      const gy = y1 + (y2 - y1) * p.t
      const px = topoCoordToPixel(gx, gy)

      if (px.x === 0 && px.y === 0) return

      // 粒子光晕
      const grad = ctx.createRadialGradient(px.x, px.y, 0, px.x, px.y, 6)
      grad.addColorStop(0, 'rgba(96,165,250,0.95)')
      grad.addColorStop(0.4, 'rgba(96,165,250,0.5)')
      grad.addColorStop(1, 'rgba(96,165,250,0)')
      ctx.beginPath()
      ctx.arc(px.x, px.y, 6, 0, Math.PI*2)
      ctx.fillStyle = grad
      ctx.fill()

      // 粒子核心
      ctx.beginPath()
      ctx.arc(px.x, px.y, 2.5, 0, Math.PI*2)
      ctx.fillStyle = '#e0f2fe'
      ctx.fill()
    })

    flowRaf = requestAnimationFrame(draw)
  }
  draw()
}

const nodeColor = (s:string) => {
  const st=(s||'').toLowerCase()
  if (st.includes('down')||st.includes('drain')) return '#ef4444'
  if (st.includes('alloc')||st.includes('mix')) return '#f59e0b'
  if (st.includes('idle')) return '#10b981'
  return '#6366f1'
}

const drawCluster = async () => {
  await nextTick()
  if (!clusterEl.value) return
  if (!clusterChart) clusterChart = echarts.init(clusterEl.value)
  const cols = Math.max(4, Math.ceil(Math.sqrt(nodes.value.length||16)))
  const data = nodes.value.length > 0
    ? nodes.value.map((n,i) => ({ value:[i%cols, Math.floor(i/cols), Math.random()*60+20], name:n.name, itemStyle:{color:nodeColor(n.state), shadowBlur:8, shadowColor:nodeColor(n.state)} }))
    : Array.from({length:16},(_,i)=>({ value:[i%4,Math.floor(i/4),Math.random()*80+10], name:'node'+(i+1), itemStyle:{color:'#10b981',shadowBlur:8,shadowColor:'#10b981'} }))
  clusterChart.setOption({
    backgroundColor:'transparent',
    tooltip:{ formatter:(p:any)=>`${p.name}` },
    grid:{top:5,right:5,bottom:5,left:5},
    xAxis:{type:'value',show:false,min:-0.5,max:cols-0.5},
    yAxis:{type:'value',show:false,min:-0.5},
    series:[{ type:'scatter', data, symbolSize:(v: any)=>Math.max(14,Math.min(32,v[2]/2.8)), emphasis:{scale:1.6}, animationDuration:1000, animationEasing:'elasticOut' as const }],
  })
}

const drawJobPie = async () => {
  await nextTick()
  if (!jobPieEl.value) return
  if (!jobPie) jobPie = echarts.init(jobPieEl.value)
  const tv = themeVars.value
  const t = stats.value.jobTypes
  const data = [
    { name:'MPI',    value:t.mpi,    color:'#3b82f6' },
    { name:'OpenMP', value:t.openmp, color:'#8b5cf6' },
    { name:'GPU',    value:t.gpu,    color:'#10b981' },
    { name:'Array',  value:t.array,  color:'#f59e0b' },
    { name:'Serial', value:t.serial, color:'#64748b' },
  ]
  // 无数据时显示占位
  const chartData = data.some(d => d.value > 0) ? data : [
    { name:'MPI',    value:3, color:'#3b82f6' },
    { name:'OpenMP', value:2, color:'#8b5cf6' },
    { name:'GPU',    value:2, color:'#10b981' },
    { name:'Array',  value:1, color:'#f59e0b' },
    { name:'Serial', value:4, color:'#64748b' },
  ]
  jobPie.setOption({
    backgroundColor:'transparent',
    tooltip:{ trigger:'axis', axisPointer:{type:'shadow'} },
    grid:{top:10,right:10,bottom:25,left:35},
    xAxis:{
      type:'category',
      data:chartData.map(d=>d.name),
      axisLabel:{fontSize:9,color:tv.chartText},
      axisLine:{lineStyle:{color:tv.axisLine}},
      axisTick:{show:false}
    },
    yAxis:{
      type:'value',
      axisLabel:{fontSize:9,color:tv.chartText},
      splitLine:{lineStyle:{color:tv.splitLine,type:'dashed'}},
      axisLine:{show:false}
    },
    series:[{
      type:'bar',
      data:chartData.map(d=>({value:d.value,itemStyle:{color:d.color}})),
      barWidth:'50%',
      label:{show:true,position:'top',fontSize:10,color:tv.chartText,fontWeight:600},
      animationDelay:(idx:number)=>idx*100
    }],
  })
}

const drawQueue = async () => {
  await nextTick()
  if (!queueEl.value) return
  if (!queueChart) queueChart = echarts.init(queueEl.value)
  const times = trendData.value.map(d=>d.time)
  const tv = themeVars.value
  queueChart.setOption({
    backgroundColor:'transparent',
    grid:{top:5,right:5,bottom:18,left:28},
    tooltip:{trigger:'axis' as const},
    xAxis:{type:'category' as const,data:times,axisLabel:{fontSize:9,color:tv.chartText},axisLine:{lineStyle:{color:tv.axisLine}},splitLine:{show:false}},
    yAxis:{type:'value' as const,axisLabel:{fontSize:9,color:tv.chartText},splitLine:{lineStyle:{color:tv.splitLine}},axisLine:{show:false}},
    series:[{type:'bar',data:trendData.value.map(()=>stats.value.pendingJobs),itemStyle:{color:'#f59e0b',borderRadius:[3,3,0,0]},barMaxWidth:16}],
  })
}

const drawJobCurve = async () => {
  await nextTick()
  if (!jobCurveEl.value) return
  if (!jobCurve) jobCurve = echarts.init(jobCurveEl.value)
  jobCurve.resize()
  const times = trendData.value.map(d=>d.time)
  const tv = themeVars.value
  // 如果没有数据，生成一些默认时间点
  const displayTimes = times.length > 0 ? times : Array.from({length:10}, (_,i) => {
    const d = new Date(Date.now() - (9-i)*60000)
    return d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})
  })
  jobCurve.setOption({
    backgroundColor:'transparent',
    tooltip:{trigger:'axis' as const},
    legend:{top:2,right:4,textStyle:{color:tv.chartText,fontSize:9},itemWidth:10,itemHeight:6,itemGap:8},
    grid:{top:28,right:10,bottom:25,left:35},
    xAxis:{type:'category' as const,data:displayTimes,axisLabel:{fontSize:9,color:tv.chartText},axisLine:{lineStyle:{color:tv.axisLine}},splitLine:{show:false}},
    yAxis:{type:'value' as const,axisLabel:{fontSize:9,color:tv.chartText},splitLine:{lineStyle:{color:tv.splitLine}},axisLine:{show:false}},
    series:[
      {name:'运行',type:'line',smooth:true,symbol:'circle',symbolSize:4,data:trendData.value.length>0?trendData.value.map(()=>stats.value.runningJobs):Array(10).fill(stats.value.runningJobs),lineStyle:{color:'#3b82f6',width:2},areaStyle:{color:'#3b82f6',opacity:0.15}},
      {name:'排队',type:'line',smooth:true,symbol:'circle',symbolSize:4,data:trendData.value.length>0?trendData.value.map(()=>stats.value.pendingJobs):Array(10).fill(stats.value.pendingJobs),lineStyle:{color:'#f59e0b',width:2},areaStyle:{color:'#f59e0b',opacity:0.15}},
    ],
  })
}

const drawTrend = async () => {
  await nextTick()
  if (!trendEl.value) return
  if (!trendChart) trendChart = echarts.init(trendEl.value)
  trendChart.resize()
  const times = trendData.value.map(d=>d.time)
  const tv = themeVars.value
  const colorMap = {cpu:'#3b82f6',mem:'#8b5cf6',gpu:'#10b981'}
  const dataMap = {cpu:trendData.value.map(d=>d.cpu),mem:trendData.value.map(d=>d.mem),gpu:trendData.value.map(()=>stats.value.cpuUtil)}
  const color = colorMap[trendTab.value]
  // 如果没有数据，生成一些默认时间点
  const displayTimes = times.length > 0 ? times : Array.from({length:10}, (_,i) => {
    const d = new Date(Date.now() - (9-i)*60000)
    return d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})
  })
  const displayData = dataMap[trendTab.value].length > 0 ? dataMap[trendTab.value] : Array(10).fill(stats.value.cpuUtil)
  trendChart.setOption({
    backgroundColor:'transparent',
    grid:{top:28,right:10,bottom:25,left:35},
    tooltip:{trigger:'axis' as const},
    xAxis:{type:'category' as const,data:displayTimes,axisLabel:{fontSize:9,color:tv.chartText},axisLine:{lineStyle:{color:tv.axisLine}},splitLine:{show:false}},
    yAxis:{type:'value' as const,axisLabel:{fontSize:9,color:tv.chartText},splitLine:{lineStyle:{color:tv.splitLine}},axisLine:{show:false}},
    series:[{type:'line',smooth:true,symbol:'circle',symbolSize:4,data:displayData,lineStyle:{color,width:2},areaStyle:{color,opacity:0.15}}],
  })
}

const drawStorageChart = async () => {
  await nextTick()
  if (!storageChartEl.value) return
  if (!storageChart) storageChart = echarts.init(storageChartEl.value)
  const tv = themeVars.value
  const data = userStorageRankList.value.slice(0, 10)
  if (data.length === 0) return
  
  storageChart.setOption({
    backgroundColor:'transparent',
    tooltip:{ trigger:'axis', axisPointer:{type:'shadow'} },
    grid:{top:15,right:15,bottom:30,left:45},
    xAxis:{
      type:'category',
      data:data.map(d=>d.name),
      axisLabel:{fontSize:9,color:tv.chartText,rotate:0,interval:0},
      axisLine:{lineStyle:{color:tv.axisLine}},
      axisTick:{show:false}
    },
    yAxis:{
      type:'value',
      name:'GB',
      nameTextStyle:{fontSize:9,color:tv.chartText},
      axisLabel:{fontSize:9,color:tv.chartText},
      splitLine:{lineStyle:{color:tv.splitLine,type:'dashed'}},
      axisLine:{show:false}
    },
    series:[{
      type:'bar',
      data:data.map((d,i)=>({
        value:d.storage,
        itemStyle:{
          color:i===0?'#8b5cf6':i===1?'#3b82f6':i===2?'#10b981':'#64748b'
        }
      })),
      barWidth:'60%',
      label:{show:true,position:'top',fontSize:9,color:tv.chartText,fontWeight:600},
      animationDelay:(idx:number)=>idx*50
    }],
  })
}

const drawAll = async () => {
  await drawTopo(); await drawJobPie(); await drawJobCurve(); await drawTrend(); await drawStorageChart()
}

const api = (path:string) =>
  fetch(`${getApiBase()}${path}`,{headers:{Authorization:`Bearer ${getToken()}`}})
    .then(r=>r.ok?r.json():null).catch(()=>null)

const loadAll = async () => {
  loading.value = true
  const sevenDaysAgo = Math.floor((Date.now() - 7 * 86400000) / 1000)
  const [nodeData, jobData, userData, dashData, historyData] = await Promise.all([
    api('/api/monitoring/node-metrics'),
    api('/api/jobs?page_size=100'),
    api('/api/users'),
    api('/api/dashboard/stats'),
    api(`/api/jobs?page_size=2000&start_time=${sevenDaysAgo}`),
  ])

  // 从 dashboard/stats 拿真实核数、内存、GPU
  if (dashData?.data) {
    const d = dashData.data
    stats.value.totalGpus = d.total_gpus || 0
    stats.value.allocGpus = d.allocated_gpus || 0
    stats.value.totalCpus = d.total_cpus || 0
    stats.value.allocCpus = d.allocated_cpus || 0
    stats.value.totalMemGb = d.total_memory_gb || 0
    stats.value.freeMemGb  = d.free_memory_gb || 0
    // CPU 利用率用 Slurm 分配率
    const tc = d.total_cpus || 0
    const ac = d.allocated_cpus || 0
    stats.value.cpuUtil = tc > 0 ? Math.round(ac / tc * 100) : 0
    // 内存利用率
    const mt = d.total_memory_gb || 0
    const mf = d.free_memory_gb || 0
    stats.value.memUtil = mt > 0 ? Math.round((mt - mf) / mt * 100) : 0
  }

  if (nodeData?.nodes) {
    const ns = nodeData.nodes.map((n:any) => ({
      name: n.instance?.replace(/:\d+$/, '') || '',
      state: n.up === false ? 'down' : 'idle',
      cpuAlloc: 0,  // node-metrics 不含分配数，用 dashboard/stats 的聚合值
      cpuTotal: 0,
      memTotal: n.mem_total_gb || 0,
      memAlloc: n.mem_used_gb || 0,
    }))
    nodes.value = ns
    stats.value.totalNodes = ns.length
    // 如果 Prometheus 有数据，用实际 CPU 使用率覆盖
    if (nodeData.connected) {
      const avgCpu = nodeData.nodes.reduce((s:number, n:any) => s + (n.cpu_usage || 0), 0) / (nodeData.nodes.length || 1)
      stats.value.cpuUtil = Math.round(avgCpu)
      const totalMem = nodeData.nodes.reduce((s:number, n:any) => s + (n.mem_total_gb || 0), 0)
      const usedMem  = nodeData.nodes.reduce((s:number, n:any) => s + (n.mem_used_gb || 0), 0)
      stats.value.memUtil = totalMem > 0 ? Math.round(usedMem / totalMem * 100) : 0
    }
  }
  if (jobData?.data) {
    const jobs=jobData.data
    stats.value.runningJobs=jobs.filter((j:any)=>j.job_state==='RUNNING').length
    stats.value.pendingJobs=jobs.filter((j:any)=>j.job_state==='PENDING').length
    stats.value.completedJobs=jobs.length
    stats.value.activeUsers=new Set(jobs.map((j:any)=>j.user_name).filter(Boolean)).size
    // 推断作业类型：优先用 job_type 字段，否则按特征推断
    const types = { mpi:0, openmp:0, gpu:0, array:0, serial:0 }
    jobs.forEach((j:any) => {
      const jt = (j.job_type||j.type||'').toLowerCase()
      const name = (j.name||j.job_name||'').toLowerCase()
      const numTasks = j.num_tasks||j.ntasks||1
      const numNodes = j.num_nodes||j.nodes||1
      const gresStr = (j.tres_req_str||j.gres||j.tres||'').toLowerCase()
      const arrayId = j.array_job_id||j.array_task_id
      if (arrayId && arrayId !== '0') { types.array++ }
      else if (jt.includes('mpi') || name.includes('mpi') || (numTasks>1 && numNodes>1)) { types.mpi++ }
      else if (gresStr.includes('gpu') || name.includes('gpu') || jt.includes('gpu')) { types.gpu++ }
      else if (jt.includes('omp') || name.includes('omp') || name.includes('openmp') || (numTasks>1 && numNodes<=1)) { types.openmp++ }
      else { types.serial++ }
    })
    stats.value.jobTypes = types
  }
  if (userData?.data) stats.value.totalUsers=userData.data.length
  if (historyData?.data) jobHistoryForRank.value = historyData.data
  trendData.value.push({ time:new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}), cpu:stats.value.cpuUtil, mem:stats.value.memUtil })
  if (trendData.value.length>20) trendData.value.shift()
  loading.value = false
  drawAll()
}

onMounted(()=>{
  const tick=()=>{ const n=new Date(); currentTime.value=n.toLocaleTimeString('zh-CN'); currentDate.value=n.toLocaleDateString('zh-CN',{weekday:'long',year:'numeric',month:'long',day:'numeric'}) }
  tick(); clockTimer=setInterval(tick,1000)
  // 监听主题变化，重绘所有图表
  themeObserver = new MutationObserver(()=>{
    currentTheme.value = document.documentElement.getAttribute('data-theme') || 'light'
    // 销毁所有图表实例，强制用新主题色重建
    ;[jobPie,queueChart,clusterChart,topoChart,jobCurve,trendChart].forEach(c=>c?.dispose())
    jobPie=null; queueChart=null; clusterChart=null; topoChart=null; jobCurve=null; trendChart=null
    drawAll()
  })
  themeObserver.observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] })
  loadAll(); refreshTimer=setInterval(loadAll,30000)
})
onUnmounted(()=>{
  clearInterval(clockTimer); clearInterval(refreshTimer)
  cancelAnimationFrame(flowRaf)
  themeObserver?.disconnect()
  ;[jobPie,queueChart,clusterChart,jobCurve,trendChart].forEach(c=>c?.dispose())
})
</script>
<style scoped>
.db{display:flex;flex-direction:column;flex:1;min-height:0;background:var(--db-bg,linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f172a 100%));overflow:auto;color:var(--db-text,#e2e8f0);font-family:system-ui,sans-serif}
.db-header{display:flex;align-items:center;padding:.7rem 1.5rem;background:var(--db-header-bg,rgba(15,23,42,.8));border-bottom:1px solid var(--db-header-border,rgba(99,102,241,.3));flex-shrink:0;backdrop-filter:blur(10px)}
.db-header-left{display:flex;align-items:center;gap:.75rem;flex:1}
.db-header-center{flex:1;text-align:center}
.db-header-right{display:flex;align-items:center;gap:.6rem;flex:1;justify-content:flex-end}
.db-logo{width:36px;height:36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:8px;box-shadow:0 0 16px rgba(99,102,241,.6)}
.db-title{font-size:1.2rem;font-weight:700;background:linear-gradient(90deg,#60a5fa,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:.02em}
.db-subtitle{font-size:.7rem;color:var(--db-sub,#64748b);letter-spacing:.08em;margin-top:.1rem}
.db-time{font-size:1.5rem;font-weight:700;color:#60a5fa;font-variant-numeric:tabular-nums;text-shadow:0 0 20px rgba(96,165,250,.5)}
.db-date{font-size:.7rem;color:var(--db-sub,#64748b);text-align:center;margin-top:.15rem}
.db-status{display:flex;align-items:center;gap:.4rem;padding:.25rem .75rem;border-radius:20px;font-size:.72rem;font-weight:600}
.db-status-ok{background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.3)}
.db-status-warn{background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.3)}
.db-status-dot{width:6px;height:6px;border-radius:50%;background:currentColor;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.db-btn{padding:.25rem .6rem;border:1px solid rgba(99,102,241,.4);border-radius:5px;background:rgba(99,102,241,.1);color:#a5b4fc;cursor:pointer;font-size:.85rem}
.db-btn:hover{background:rgba(99,102,241,.25)}
.db-kpi-row{display:grid;grid-template-columns:repeat(5,1fr);gap:.8rem;padding:.8rem 1.5rem;flex-shrink:0}
.db-kpi{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.2rem;padding:.85rem .6rem .7rem;min-height:82px;background:var(--db-kpi-bg,rgba(30,41,59,.8));border-radius:10px;border:1px solid var(--db-card-border,rgba(255,255,255,.06));overflow:hidden;text-align:center;transition:all .3s ease;backdrop-filter:blur(8px)}
.db-kpi:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,.3),0 0 20px var(--kc)}
.db-kpi-accent{position:absolute;top:0;left:0;right:0;height:3px;background:var(--kc);border-radius:10px 10px 0 0;box-shadow:0 0 10px var(--kc)}
.db-kpi-val{font-size:1.7rem;font-weight:800;color:var(--db-text,#f1f5f9);line-height:1;letter-spacing:-.02em;text-shadow:0 2px 8px rgba(0,0,0,.3)}
.db-kpi-label{font-size:.68rem;color:var(--db-sub,#64748b);margin-top:.15rem;white-space:nowrap;font-weight:500}
.db-kpi-bar{width:85%;height:3px;background:rgba(128,128,128,.12);border-radius:3px;margin-top:.4rem;overflow:hidden}
.db-kpi-bar-fill{height:100%;background:var(--kc);border-radius:3px;transition:width .8s cubic-bezier(.4,0,.2,1);box-shadow:0 0 8px var(--kc)}
.db-main{display:grid;grid-template-columns:280px 1fr 420px;gap:.8rem;padding:0 1.2rem .8rem;flex:1;min-height:400px;overflow:hidden}
.db-col{display:flex;flex-direction:column;gap:.5rem;overflow:hidden;flex:1;min-height:0}
.db-col-right{overflow:hidden;display:flex;flex-direction:column}
.db-card{background:var(--db-card-bg,rgba(30,41,59,.7));border:1px solid var(--db-card-border,rgba(255,255,255,.06));border-radius:8px;padding:.5rem .6rem;display:flex;flex-direction:column;overflow:hidden;backdrop-filter:blur(8px);transition:all .3s ease}
.db-card:hover{border-color:rgba(99,102,241,.15);box-shadow:0 4px 16px rgba(0,0,0,.2)}
.db-card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:.3rem}
.db-card-title{font-size:.65rem;font-weight:600;color:var(--db-sub,#94a3b8);margin-bottom:.3rem;letter-spacing:.02em}
.db-chart-h180{flex:1;min-height:0;max-height:180px;width:100%}
.db-chart-h160{width:100%;height:160px;flex-shrink:0}
.db-chart-h120{width:100%;height:100px;flex-shrink:0}
.db-chart-h150{width:100%;height:150px;flex-shrink:0}
.db-chart-h100{width:100%;height:100px;flex-shrink:0}
.db-chart-h160{width:100%;height:160px;flex-shrink:0}
.db-card-fixed{flex-shrink:0}
.db-chart-flex{flex:1;min-height:0;width:100%}
.db-chart-fill{flex:1;min-height:0;width:100%}
.db-topo-wrap{flex:1;min-height:0;position:relative;overflow:hidden}
.db-topo-wrap .db-chart-fill{position:absolute;inset:0;width:100%;height:100%}
.db-topo-flow{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1}
.db-card-fill{flex:1;min-height:0}
/* gauge 方正布局 */
.db-gauge-row{display:flex;gap:.4rem;justify-content:space-around;padding:.2rem 0}
.db-gauge-item{display:flex;flex-direction:column;align-items:center;flex:1}
.db-gauge-chart{width:100%;aspect-ratio:1/1;max-height:90px}
.db-gauge-label{font-size:.65rem;color:var(--db-sub,#64748b);margin-top:.1rem}
/* 算力统计 */
.db-compute-section{padding:.3rem 0}
.db-compute-type{font-size:.6rem;font-weight:600;color:var(--db-sub,#94a3b8);margin-bottom:.35rem;letter-spacing:.03em;text-transform:uppercase}
.db-compute-items{display:grid;grid-template-columns:1fr 1fr;gap:.3rem;margin-bottom:.3rem}
.db-compute-items-3{grid-template-columns:1fr 1fr 1fr}
.db-compute-item{background:var(--db-res-bg,rgba(255,255,255,.03));border-radius:6px;padding:.3rem .4rem;text-align:center;transition:all .3s ease;border:1px solid transparent}
.db-compute-item:hover{background:var(--db-res-bg,rgba(255,255,255,.05));border-color:rgba(99,102,241,.2);transform:translateY(-2px)}
.db-compute-label{font-size:.55rem;color:var(--db-sub,#64748b);margin-bottom:.1rem;font-weight:500}
.db-compute-val{font-size:.95rem;font-weight:800;line-height:1.1;text-shadow:0 2px 8px rgba(0,0,0,.3)}
.db-compute-unit{font-size:.52rem;color:var(--db-sub,#64748b);margin-top:.08rem;font-weight:500}
.db-compute-used{display:flex;justify-content:space-between;align-items:center;padding:.25rem .1rem}
.db-compute-used-label{font-size:.58rem;color:var(--db-sub,#64748b);font-weight:500}
.db-compute-used-val{font-size:.68rem;font-weight:600;color:var(--db-text,#e2e8f0)}
.db-compute-divider{height:1px;background:var(--db-card-border,rgba(255,255,255,.06));margin:.3rem 0}
.db-res-grid{display:grid;grid-template-columns:1fr 1fr;gap:.25rem}
.db-res-item{text-align:center;padding:.25rem;background:var(--db-res-bg,rgba(255,255,255,.03));border-radius:5px;transition:all .3s ease;border:1px solid transparent}
.db-res-item:hover{background:var(--db-res-bg,rgba(255,255,255,.05));border-color:rgba(99,102,241,.2);transform:translateY(-2px)}
.db-res-val{font-size:.8rem;font-weight:700;color:var(--db-text,#f1f5f9);text-shadow:0 2px 8px rgba(0,0,0,.3)}
.db-res-label{font-size:.5rem;color:var(--db-sub,#64748b);margin-top:.08rem;font-weight:500}
.db-stat-list{display:flex;flex-direction:column;gap:.15rem}
.db-stat-row{display:flex;justify-content:space-between;font-size:.65rem;padding:.15rem 0;border-bottom:1px solid rgba(128,128,128,.1);color:var(--db-sub,#64748b)}
.db-stat-val{font-weight:600;color:var(--db-text,#e2e8f0)}
.db-col-center .db-card{flex:1}
.db-chart-cluster{flex:1;min-height:0;width:100%}
.db-node-stats{display:flex;justify-content:space-around;padding:.6rem 0;border-top:1px solid var(--db-card-border,rgba(255,255,255,.06));flex-shrink:0}
.db-ns-item{text-align:center}
.db-ns-num{font-size:1.3rem;font-weight:800;text-shadow:0 0 12px currentColor;line-height:1}
.db-ns-label{font-size:.6rem;color:var(--db-sub,#64748b);margin-top:.2rem;font-weight:500}
.db-legend{display:flex;align-items:center;gap:.4rem;font-size:.62rem;color:var(--db-sub,#64748b)}
.db-leg{display:flex;align-items:center;gap:.2rem}
.db-leg i{display:inline-block;width:7px;height:7px;border-radius:50%}
.db-tabs{display:flex;gap:0}
.db-tab{padding:.15rem .5rem;font-size:.68rem;border:1px solid rgba(99,102,241,.3);background:transparent;color:var(--db-sub,#64748b);cursor:pointer;border-right:none}
.db-tab:first-child{border-radius:4px 0 0 4px}.db-tab:last-child{border-radius:0 4px 4px 0;border-right:1px solid rgba(99,102,241,.3)}
.db-tab.active{background:rgba(99,102,241,.3);color:#a5b4fc;border-color:#6366f1}
/* 告警列表 - 优化设计 */
.db-card-alert{min-height:0}
.db-alert-list{display:flex;flex-direction:column;gap:.4rem;overflow-y:auto;flex:1;min-height:0}
.db-alert-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1.2rem;gap:.4rem;flex:1}
.db-alert-ok-icon{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#10b981,#34d399);display:flex;align-items:center;justify-content:center;font-size:2rem;color:#fff;box-shadow:0 4px 20px rgba(16,185,129,.4);animation:pulse-ok 2s infinite}
@keyframes pulse-ok{0%,100%{transform:scale(1);box-shadow:0 4px 20px rgba(16,185,129,.4)}50%{transform:scale(1.08);box-shadow:0 6px 28px rgba(16,185,129,.6)}}
.db-alert-ok-text{font-size:.8rem;color:#10b981;font-weight:700;letter-spacing:.02em}
.db-alert-ok-sub{font-size:.65rem;color:var(--db-sub,#64748b);font-weight:500}
.db-alert-item{display:flex;align-items:center;gap:.5rem;padding:.5rem .6rem;border-radius:8px;background:var(--db-res-bg,rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.03);transition:all .3s ease}
.db-alert-item:hover{background:var(--db-res-bg,rgba(255,255,255,.06));transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.2)}
.db-alert-error{border-left:3px solid #ef4444;background:rgba(239,68,68,.05)}
.db-alert-error:hover{border-left-color:#ef4444;box-shadow:0 4px 12px rgba(239,68,68,.3)}
.db-alert-warning{border-left:3px solid #f59e0b;background:rgba(245,158,11,.05)}
.db-alert-warning:hover{border-left-color:#f59e0b;box-shadow:0 4px 12px rgba(245,158,11,.3)}
.db-alert-info{border-left:3px solid #3b82f6;background:rgba(59,130,246,.05)}
.db-alert-info:hover{border-left-color:#3b82f6;box-shadow:0 4px 12px rgba(59,130,246,.3)}
.db-alert-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0}
.db-alert-error .db-alert-icon{background:rgba(239,68,68,.2);box-shadow:0 0 10px rgba(239,68,68,.4)}
.db-alert-warning .db-alert-icon{background:rgba(245,158,11,.2);box-shadow:0 0 10px rgba(245,158,11,.4)}
.db-alert-info .db-alert-icon{background:rgba(59,130,246,.2);box-shadow:0 0 10px rgba(59,130,246,.4)}
.db-alert-content{display:flex;flex-direction:column;gap:.15rem;flex:1;min-width:0}
.db-alert-name{font-size:.72rem;color:var(--db-text,#e2e8f0);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.db-alert-time{font-size:.62rem;color:var(--db-sub,#64748b);font-weight:500}
/* 右列布局 - 重新设计 */
.db-col-right{gap:.7rem;width:100%;max-width:450px;display:flex;flex-direction:column;height:100%}
.db-right-row{display:grid;grid-template-columns:1fr 1fr;gap:.8rem}
.db-right-row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.7rem}

/* 底部区域 */
.db-bottom{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.8rem;padding:0 1.5rem .8rem;flex-shrink:0}
.db-card-bottom{min-height:200px;display:flex;flex-direction:column}
.db-chart-bottom{flex:1;min-height:150px;width:100%}

/* 图表卡片 */
.db-card-chart{min-height:180px}
.db-chart-main{flex:1;min-height:0;width:100%}
.db-card-trend{min-height:0}
.db-chart-trend{flex:1;min-height:0;width:100%}

/* 图例 */
.db-legend{display:flex;align-items:center;gap:.5rem;font-size:.65rem;color:var(--db-sub,#64748b)}
.db-leg{display:flex;align-items:center;gap:.25rem}
.db-leg i{display:inline-block;width:8px;height:8px;border-radius:2px}

/* 用户排行 - 横向条形图样式 */
.db-card-rank{min-height:0;flex:1;display:flex;flex-direction:column}
.db-rank-header-left{display:flex;align-items:center;gap:.4rem}
.db-rank-list-bar{display:flex;flex-direction:column;gap:.35rem;overflow-y:auto;flex:1;min-height:0;padding:.4rem .2rem}
.db-rank-empty{text-align:center;padding:2rem;color:var(--db-sub,#64748b);font-size:.65rem}
.db-rank-bar-item{display:flex;align-items:center;gap:.4rem;transition:all .2s ease;padding:0}
.db-rank-bar-item:hover{transform:translateX(2px);opacity:.95}
.db-rank-badge{width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700;flex-shrink:0;background:rgba(71,85,105,.5);color:rgba(203,213,225,.8);transition:all .3s ease}
.db-rank-badge.rank-1{background:linear-gradient(135deg,#fbbf24 0%,#f59e0b 100%);color:#fff;box-shadow:0 2px 6px rgba(251,191,36,.3),inset 0 1px 0 rgba(255,255,255,.2)}
.db-rank-badge.rank-2{background:linear-gradient(135deg,#cbd5e1 0%,#94a3b8 100%);color:#1e293b;box-shadow:0 1px 4px rgba(148,163,184,.25),inset 0 1px 0 rgba(255,255,255,.25)}
.db-rank-badge.rank-3{background:linear-gradient(135deg,#a78bfa 0%,#8b5cf6 100%);color:#fff;box-shadow:0 1px 4px rgba(139,92,246,.25),inset 0 1px 0 rgba(255,255,255,.15)}
.db-rank-bar-label{min-width:65px;max-width:65px;font-size:.65rem;color:var(--db-text,#e2e8f0);font-weight:500;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0}
.db-rank-bar-container{flex:1;display:flex;align-items:center;gap:.4rem;position:relative}
.db-rank-bar-fill{height:16px;border-radius:8px;position:relative;overflow:hidden;transition:all .6s cubic-bezier(.34,.46,.45,.94);box-shadow:0 1px 3px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.1);min-width:30px}
.db-rank-bar-fill:hover{box-shadow:0 2px 5px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.12)}
.db-rank-bar-shine{position:absolute;inset:0;background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,.18) 50%,transparent 100%);animation:bar-shine 3s ease-in-out infinite}
@keyframes bar-shine{0%,100%{transform:translateX(-100%)}50%{transform:translateX(200%)}}
.db-rank-bar-value{font-size:.65rem;font-weight:700;color:var(--db-text,#f1f5f9);min-width:30px;text-align:left;text-shadow:0 1px 2px rgba(0,0,0,.2)}
</style>


