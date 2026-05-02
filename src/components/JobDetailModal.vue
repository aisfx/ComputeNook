<template>
  <Teleport to="body">
    <div class="jd-overlay" @click="$emit('close')">
      <div class="jd-modal" @click.stop>
        <!-- Header -->
        <div class="jd-header">
          <div class="jd-header-left">
            <span class="jd-id">#{{ job.id }}</span>
            <span class="jd-name">{{ job.name }}</span>
            <span :class="['jd-status', `jd-status-${(job.status||'').toLowerCase()}`]">{{ job.status }}</span>
          </div>
          <button class="jd-close" @click="$emit('close')">✕</button>
        </div>

        <!-- Body -->
        <div class="jd-body">
          <!-- Info grid -->
          <div class="jd-grid">
            <div class="jd-field">
              <div class="jd-field-label">用户</div>
              <div class="jd-field-value">{{ job.user }}</div>
            </div>
            <div class="jd-field">
              <div class="jd-field-label">分区</div>
              <div class="jd-field-value">{{ job.partition }}</div>
            </div>
            <div class="jd-field">
              <div class="jd-field-label">节点</div>
              <div class="jd-field-value">
                <span v-if="job.nodeNames && job.nodeNames.length" class="jd-node-tags">
                  <span v-for="n in job.nodeNames" :key="n" class="jd-node-tag">{{ n }}</span>
                </span>
                <span v-else>{{ job.nodes || 0 }} 个节点</span>
              </div>
            </div>
            <div class="jd-field">
              <div class="jd-field-label">CPU 核心</div>
              <div class="jd-field-value">{{ job.cpus || 1 }} 核</div>
            </div>
            <div class="jd-field">
              <div class="jd-field-label">内存</div>
              <div class="jd-field-value">{{ job.memory || '-' }}</div>
            </div>
            <div class="jd-field">
              <div class="jd-field-label">提交时间</div>
              <div class="jd-field-value">{{ job.submitTime || '-' }}</div>
            </div>
            <div class="jd-field">
              <div class="jd-field-label">开始时间</div>
              <div class="jd-field-value">{{ job.startTime || '-' }}</div>
            </div>
            <div class="jd-field">
              <div class="jd-field-label">运行时长</div>
              <div class="jd-field-value">{{ job.runTime || '-' }}</div>
            </div>
          </div>

          <!-- Directory -->
          <div class="jd-section">
            <div class="jd-section-label">工作目录</div>
            <div class="jd-dir-row">
              <code class="jd-dir-path">{{ job.directory || '-' }}</code>
              <button class="jd-btn-outline" @click="$emit('open-directory', job.directory)">
                打开目录
              </button>
            </div>
          </div>

          <!-- Log viewer -->
        <div v-if="showLog" class="jd-section">
          <div class="jd-section-header">
            <div class="jd-section-label">{{ logType === 'out' ? '输出日志' : '错误日志' }}</div>
            <div style="display:flex;gap:6px">
              <button class="jd-btn-ghost" @click="loadLog('out')" :class="{ 'jd-btn-active': logType==='out' }">stdout</button>
              <button class="jd-btn-ghost" @click="loadLog('err')" :class="{ 'jd-btn-active': logType==='err' }">stderr</button>
              <button class="jd-btn-ghost" @click="showLog = false">收起</button>
            </div>
          </div>
          <div class="jd-log-box">
            <div v-if="logLoading" class="jd-log-loading">加载中...</div>
            <div v-else-if="logError" class="jd-log-error">{{ logError }}</div>
            <pre v-else class="jd-log-content">{{ logContent || '（日志为空）' }}</pre>
          </div>
        </div>
          <div v-if="job.status === 'RUNNING'" class="jd-section">
            <div class="jd-section-header">
              <div class="jd-section-label">
                节点实时监控
                <span v-if="job.nodeNames && job.nodeNames.length" class="jd-node-list">
                  {{ job.nodeNames.join(', ') }}
                </span>
              </div>
              <button class="jd-btn-ghost" @click="refreshResourceUsage" :disabled="refreshing">
                {{ refreshing ? '刷新中...' : '刷新' }}
              </button>
            </div>
            <div v-if="!promConnected" class="jd-prom-na">Prometheus 未连接，无法显示历史曲线</div>

            <!-- 当前快照进度条 -->
            <div class="jd-metrics">
              <div class="jd-metric">
                <div class="jd-metric-label">CPU</div>
                <div class="jd-metric-bar">
                  <div class="jd-metric-fill" :style="{ width: currentUsage.cpu + '%', background: currentUsage.cpu > 90 ? '#ef4444' : currentUsage.cpu > 70 ? '#f59e0b' : '#22c55e' }"></div>
                </div>
                <div class="jd-metric-val">{{ currentUsage.cpu }}%</div>
              </div>
              <div class="jd-metric">
                <div class="jd-metric-label">内存</div>
                <div class="jd-metric-bar">
                  <div class="jd-metric-fill" :style="{ width: currentUsage.memory + '%', background: currentUsage.memory > 90 ? '#ef4444' : currentUsage.memory > 70 ? '#f59e0b' : '#3b82f6' }"></div>
                </div>
                <div class="jd-metric-val">{{ currentUsage.memory }}%</div>
              </div>
              <div class="jd-metric" v-if="currentUsage.load > 0">
                <div class="jd-metric-label">负载</div>
                <div class="jd-metric-bar">
                  <div class="jd-metric-fill" :style="{ width: Math.min(currentUsage.load * 10, 100) + '%', background: '#8b5cf6' }"></div>
                </div>
                <div class="jd-metric-val">{{ currentUsage.load }}</div>
              </div>
              <div class="jd-metric" v-if="currentUsage.disk > 0">
                <div class="jd-metric-label">磁盘</div>
                <div class="jd-metric-bar">
                  <div class="jd-metric-fill" :style="{ width: currentUsage.disk + '%', background: currentUsage.disk > 90 ? '#ef4444' : '#f59e0b' }"></div>
                </div>
                <div class="jd-metric-val">{{ currentUsage.disk }}%</div>
              </div>
              <div class="jd-metric" v-if="promConnected">
                <div class="jd-metric-label">网络↓</div>
                <div class="jd-metric-bar">
                  <div class="jd-metric-fill" :style="{ width: Math.min(currentUsage.netRx * 10, 100) + '%', background: '#06b6d4' }"></div>
                </div>
                <div class="jd-metric-val">{{ currentUsage.netRx }}MB/s</div>
              </div>
            </div>

            <!-- 历史曲线图（Prometheus range query） -->
            <div v-if="promConnected" class="jd-charts">
              <div class="jd-chart-title">CPU 使用率历史（作业开始至今，每节点一条线）</div>
              <div ref="chartCpuEl" class="jd-chart"></div>
              <div class="jd-chart-title">内存使用率历史</div>
              <div ref="chartMemEl" class="jd-chart"></div>
              <div class="jd-chart-title">网络流量历史（MB/s）</div>
              <div ref="chartNetEl" class="jd-chart"></div>
            </div>

            <div class="jd-update-time">30s 自动刷新 · 最后更新: {{ lastUpdateTime }} {{ promConnected ? '(Prometheus)' : '(估算)' }}</div>
          </div>
        </div>

        <!-- Footer -->
        <div class="jd-footer">
          <button
            v-if="job.status === 'RUNNING' || job.status === 'PENDING' || job.status === 'SUSPENDED'"
            class="jd-btn-danger"
            @click="$emit('cancel', job.id)"
          >取消作业</button>
          <button v-if="job.status === 'RUNNING'" class="jd-btn-warning" @click="$emit('pause', job.id)">
            暂停作业
          </button>
          <button v-if="job.status === 'SUSPENDED'" class="jd-btn-outline" @click="$emit('resume', job.id)">
            恢复作业
          </button>
          <!-- 容器作业保存镜像 -->
          <button v-if="job.status === 'RUNNING'" class="jd-btn-save-image" @click="showSaveImage = true">
            🐳 保存镜像
          </button>
          <!-- 进入容器 -->
          <button v-if="job.status === 'RUNNING'" class="jd-btn-exec" @click="execIntoContainer">
            💻 进入容器
          </button>
          <button class="jd-btn-outline" @click="openLog">查看日志</button>
          <button class="jd-btn-ghost" @click="$emit('close')">关闭</button>
        </div>

        <!-- 保存镜像对话框 -->
        <div v-if="showSaveImage" class="jd-save-overlay" @click.self="closeSaveImage">
          <div class="jd-save-box">
            <div class="jd-save-header">
              <span>🐳 保存容器镜像</span>
              <button @click="closeSaveImage" class="jd-close">✕</button>
            </div>
            <div class="jd-save-body">
              <p class="jd-save-tip">将当前运行容器（作业 #{{ job.id }}）的环境保存为镜像，推送到你的私有仓库。</p>
              <div class="jd-save-field">
                <label>镜像名称</label>
                <input v-model="saveImageName" placeholder="例：my-pytorch-env" :disabled="saving || saveTask?.status === 'done'" />
              </div>
              <div class="jd-save-field">
                <label>Tag</label>
                <input v-model="saveImageTag" placeholder="latest" :disabled="saving || saveTask?.status === 'done'" />
              </div>

              <!-- 进度条 -->
              <div v-if="saveTask" class="jd-save-progress">
                <div class="jd-progress-steps">
                  <div
                    v-for="(label, i) in ['导出 squashfs', '解压 rootfs', '构建归档', '推送 Harbor']"
                    :key="i"
                    :class="['jd-progress-step',
                      saveTask.step > i + 1 || saveTask.status === 'done' ? 'done' :
                      saveTask.step === i + 1 && saveTask.status === 'running' ? 'active' :
                      saveTask.step === i + 1 && saveTask.status === 'error' ? 'error' : '']"
                  >
                    <div class="jd-step-dot">
                      <span v-if="saveTask.step > i + 1 || saveTask.status === 'done'">✓</span>
                      <span v-else-if="saveTask.step === i + 1 && saveTask.status === 'error'">✗</span>
                      <span v-else-if="saveTask.step === i + 1 && saveTask.status === 'running'" class="jd-spin">⟳</span>
                      <span v-else>{{ i + 1 }}</span>
                    </div>
                    <div class="jd-step-label">{{ label }}</div>
                  </div>
                </div>
                <div class="jd-progress-bar-wrap">
                  <div class="jd-progress-bar-fill"
                    :style="{
                      width: saveTask.status === 'done' ? '100%' :
                             saveTask.status === 'error' ? (((saveTask.step - 1) / 4 * 100) + '%') :
                             ((saveTask.step / 4 * 100) + '%'),
                      background: saveTask.status === 'error' ? '#ef4444' :
                                  saveTask.status === 'done' ? '#22c55e' : 'hsl(var(--primary))'
                    }"
                  ></div>
                </div>
                <div v-if="saveTask.status === 'error'" class="jd-save-result err">{{ saveTask.error }}</div>
                <div v-if="saveTask.status === 'done'" class="jd-save-result ok">
                  推送成功！
                  <div class="jd-save-target">{{ saveTask.target_image }}</div>
                </div>
              </div>

              <div v-else-if="saveResult && !saveTask" :class="['jd-save-result', saveResult.ok ? 'ok' : 'err']">
                {{ saveResult.msg }}
                <div v-if="saveResult.target" class="jd-save-target">{{ saveResult.target }}</div>
              </div>
            </div>
            <div class="jd-save-footer">
              <button class="jd-btn-primary" @click="doSaveImage"
                :disabled="saving || saveTask?.status === 'running' || saveTask?.status === 'done'">
                {{ saving ? '提交中...' : saveTask?.status === 'running' ? '执行中...' : saveTask?.status === 'done' ? '✅ 已完成' : '🚀 开始保存' }}
              </button>
              <button class="jd-btn-ghost" @click="closeSaveImage">关闭</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { fileManagerApi } from '../config/api'
import { getToken, getApiBase } from '../utils/auth'

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const props = defineProps<{ job: any }>()
const emit = defineEmits(['close', 'pause', 'resume', 'cancel', 'open-directory', 'exec-container'])

const refreshing = ref(false)

const execIntoContainer = () => {
  // 取第一个节点名（计算节点）
  const node = (props.job.nodeNames && props.job.nodeNames[0]) || props.job.nodes
  if (!node) {
    alert('无法获取作业运行节点')
    return
  }
  const jobId = props.job.id
  // 直接 SSH 到计算节点后，在节点上找到 pyxis 容器实例并进入
  // 不使用 srun（会重新申请资源导致卡住），而是直接在节点上执行 enroot start
  const initCommand =
    `echo "→ 正在查找作业 ${jobId} 的容器实例..."\n` +
    `INSTANCE=$(enroot list 2>/dev/null | grep "^pyxis_${jobId}\\." | head -1)\n` +
    `if [ -n "$INSTANCE" ]; then\n` +
    `  echo "进入容器: $INSTANCE"\n` +
    `  enroot start -r "$INSTANCE"\n` +
    `else\n` +
    `  echo "未找到容器实例 pyxis_${jobId}.* ，请确认作业正在运行中"\n` +
    `fi\n`
  emit('exec-container', {
    node,
    jobId,
    initCommand,
  })
  emit('close')
}
const showSaveImage = ref(false)
const saveImageName = ref('')
const saveImageTag = ref('latest')
const saving = ref(false)
const saveResult = ref<{ ok: boolean; msg: string; target?: string } | null>(null)
const saveTask = ref<any>(null)
let saveTaskPollTimer: any = null

const closeSaveImage = () => {
  showSaveImage.value = false
  saveResult.value = null
  saveTask.value = null
  saveImageName.value = ''
  saveImageTag.value = 'latest'
  if (saveTaskPollTimer) { clearInterval(saveTaskPollTimer); saveTaskPollTimer = null }
}

const pollSaveTask = (taskId: string) => {
  if (saveTaskPollTimer) clearInterval(saveTaskPollTimer)
  saveTaskPollTimer = setInterval(async () => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token')
      const res = await fetch(`${getApiBase()}/api/registry/images/save/task/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) return
      const data = await res.json()
      saveTask.value = data.data
      if (data.data?.status === 'done' || data.data?.status === 'error') {
        clearInterval(saveTaskPollTimer)
        saveTaskPollTimer = null
      }
    } catch { /* ignore */ }
  }, 2000)
}

const doSaveImage = async () => {
  if (!saveImageName.value.trim()) {
    saveResult.value = { ok: false, msg: '请填写镜像名称' }
    return
  }
  saving.value = true
  saveResult.value = null
  saveTask.value = null
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    const res = await fetch(`${getApiBase()}/api/registry/images/save`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: props.job.id,
        image_name: saveImageName.value.trim(),
        tag: saveImageTag.value || 'latest'
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '保存失败')
    // 开始轮询任务进度
    if (data.task_id) {
      saveTask.value = { task_id: data.task_id, status: 'pending', step: 0, total_steps: 4, step_desc: '准备中...', target_image: data.target_image }
      pollSaveTask(data.task_id)
    }
  } catch (e: any) {
    saveResult.value = { ok: false, msg: e.message }
  } finally {
    saving.value = false
  }
}
const lastUpdateTime = ref(new Date().toLocaleTimeString())
const autoRefreshInterval = ref<any>(null)
const promConnected = ref(false)
const currentUsage = ref({ cpu: 0, memory: 0, load: 0, netRx: 0, netTx: 0, disk: 0 })

// echarts 图表实例
const chartCpuEl = ref<HTMLElement>()
const chartMemEl = ref<HTMLElement>()
const chartNetEl = ref<HTMLElement>()
let chartCpu: echarts.ECharts | null = null
let chartMem: echarts.ECharts | null = null
let chartNet: echarts.ECharts | null = null

const COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#14b8a6']

// 获取作业开始时间戳（秒）
const jobStartTs = () => {
  if (props.job.start_time && typeof props.job.start_time === 'number') return props.job.start_time
  // 尝试从 startTime 字符串解析
  if (props.job.startTime && props.job.startTime !== '-') {
    const t = new Date(props.job.startTime).getTime()
    if (!isNaN(t)) return Math.floor(t / 1000)
  }
  // 默认：当前时间往前 1 小时
  return Math.floor(Date.now() / 1000) - 3600
}

// 查询 Prometheus range 数据，返回 { instance: string, times: number[], values: number[] }[]
const queryRange = async (promql: string) => {
  const start = jobStartTs()
  const end = Math.floor(Date.now() / 1000)
  const duration = end - start
  const step = Math.max(15, Math.floor(duration / 120)) // 最多 120 个点
  const url = `${getApiBase()}/api/monitoring/promql/range?query=${encodeURIComponent(promql)}&start=${start}&end=${end}&step=${step}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } })
  if (!res.ok) return []
  const data = await res.json()
  if (data.status !== 'success') return []
  return (data.data?.result || []).map((r: any) => ({
    instance: r.metric?.instance?.replace(/:\d+$/, '') || r.metric?.nodename || Object.values(r.metric || {}).join(','),
    times: (r.values || []).map((v: any) => v[0] * 1000),
    values: (r.values || []).map((v: any) => parseFloat(parseFloat(v[1]).toFixed(2))),
  }))
}

// 过滤只保留作业节点的数据
const filterJobNodes = (series: any[]) => {
  const nodeNames: string[] = props.job.nodeNames || []
  if (!nodeNames.length) return series
  return series.filter(s => nodeNames.some(n =>
    s.instance.includes(n) || n.includes(s.instance)
  ))
}

const initChart = (el: HTMLElement | undefined, title: string) => {
  if (!el) return null
  const c = echarts.init(el, undefined, { renderer: 'canvas' })
  c.setOption({
    animation: false,
    grid: { top: 28, right: 12, bottom: 28, left: 42 },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const time = new Date(params[0]?.axisValue).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        return time + '<br>' + params.map((p: any) => `${p.marker}${p.seriesName}: <b>${p.value}</b>`).join('<br>')
      }
    },
    legend: { top: 2, right: 0, textStyle: { fontSize: 10 }, itemWidth: 12, itemHeight: 8 },
    xAxis: { type: 'time', axisLabel: { fontSize: 10, formatter: (v: number) => new Date(v).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) } },
    yAxis: { type: 'value', axisLabel: { fontSize: 10 }, min: 0 },
    series: [],
  })
  return c
}

const updateChart = (chart: echarts.ECharts | null, seriesData: any[], unit = '%', maxY?: number) => {
  if (!chart) return
  const series = seriesData.map((s, i) => ({
    name: s.instance,
    type: 'line',
    smooth: true,
    symbol: 'none',
    lineStyle: { width: 1.5, color: COLORS[i % COLORS.length] },
    itemStyle: { color: COLORS[i % COLORS.length] },
    data: s.times.map((t: number, j: number) => [t, s.values[j]]),
    areaStyle: seriesData.length === 1 ? { opacity: 0.08, color: COLORS[0] } : undefined,
  }))
  chart.setOption({
    yAxis: { max: maxY, axisLabel: { formatter: (v: number) => v + unit } },
    series,
  }, { replaceMerge: ['series'] })
}

const refreshResourceUsage = async () => {
  refreshing.value = true
  try {
    const token = getToken()
    // 当前快照（进度条用）
    const snapRes = await fetch(`${getApiBase()}/api/monitoring/node-metrics`, { headers: { Authorization: `Bearer ${token}` } })
    if (snapRes.ok) {
      const data = await snapRes.json()
      promConnected.value = data.connected === true
      if (data.connected && data.nodes?.length) {
        const nodeNames: string[] = props.job.nodeNames || []
        const jobNodes = nodeNames.length > 0
          ? data.nodes.filter((n: any) => nodeNames.some((name: string) =>
              n.instance?.includes(name) || name.includes(n.instance?.replace(/:\d+$/, ''))))
          : data.nodes
        if (jobNodes.length > 0) {
          const avg = (key: string) => Math.round(jobNodes.reduce((s: number, n: any) => s + (n[key] || 0), 0) / jobNodes.length)
          currentUsage.value.cpu = avg('cpu_usage')
          currentUsage.value.memory = avg('mem_usage')
          currentUsage.value.load = +(jobNodes.reduce((s: number, n: any) => s + (n.load1 || 0), 0) / jobNodes.length).toFixed(2)
          currentUsage.value.disk = avg('disk_usage')
          const totalRx = jobNodes.reduce((s: number, n: any) => s + (n.net_rx_bps || 0), 0)
          const totalTx = jobNodes.reduce((s: number, n: any) => s + (n.net_tx_bps || 0), 0)
          currentUsage.value.netRx = Math.round(totalRx / 1024 / 1024 * 10) / 10
          currentUsage.value.netTx = Math.round(totalTx / 1024 / 1024 * 10) / 10
        }
      }
    }

    // 历史曲线（range query）
    if (promConnected.value) {
      const [cpuSeries, memSeries, netSeries] = await Promise.all([
        queryRange('100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[2m])) * 100)'),
        queryRange('100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)'),
        queryRange('sum by (instance) (rate(node_network_receive_bytes_total{device!~"lo|docker.*|veth.*"}[2m])) / 1048576'),
      ])
      const fCpu = filterJobNodes(cpuSeries)
      const fMem = filterJobNodes(memSeries)
      const fNet = filterJobNodes(netSeries)
      // 初始化图表（首次）
      await nextTick()
      if (!chartCpu && chartCpuEl.value) chartCpu = initChart(chartCpuEl.value, 'CPU')
      if (!chartMem && chartMemEl.value) chartMem = initChart(chartMemEl.value, '内存')
      if (!chartNet && chartNetEl.value) chartNet = initChart(chartNetEl.value, '网络')
      updateChart(chartCpu, fCpu.length ? fCpu : cpuSeries.slice(0, 8), '%', 100)
      updateChart(chartMem, fMem.length ? fMem : memSeries.slice(0, 8), '%', 100)
      updateChart(chartNet, fNet.length ? fNet : netSeries.slice(0, 8), 'MB/s')
    }
  } catch (e) {
    console.error('监控数据加载失败', e)
  } finally {
    lastUpdateTime.value = new Date().toLocaleTimeString()
    refreshing.value = false
  }
}

// 日志
const showLog = ref(false)
const logType = ref<'out' | 'err'>('out')
const logContent = ref('')
const logLoading = ref(false)
const logError = ref('')

const getLogPath = (type: 'out' | 'err') => {
  const dir = props.job.directory
  if (!dir || dir === '-') return null
  // Slurm 默认输出文件：slurm-{jobid}.out / slurm-{jobid}.err
  const ext = type === 'out' ? 'out' : 'err'
  return `${dir}/slurm-${props.job.id}.${ext}`
}

const loadLog = async (type: 'out' | 'err') => {
  logType.value = type
  logLoading.value = true
  logError.value = ''
  logContent.value = ''
  showLog.value = true

  const path = getLogPath(type)
  if (!path) {
    logError.value = '无法确定日志文件路径，请确认作业目录'
    logLoading.value = false
    return
  }

  try {
    const token = getToken()
    const res = await fetch(`${fileManagerApi.read()}?path=${encodeURIComponent(path)}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `读取失败 (${res.status})`)
    }
    const data = await res.json()
    logContent.value = data.content || ''
  } catch (e: any) {
    logError.value = e.message || '读取日志失败'
  } finally {
    logLoading.value = false
  }
}

const openLog = () => loadLog('out')

onMounted(() => {
  if (props.job.status === 'RUNNING') {
    refreshResourceUsage()
    autoRefreshInterval.value = setInterval(refreshResourceUsage, 30000)
  }
})

onUnmounted(() => {
  if (autoRefreshInterval.value) clearInterval(autoRefreshInterval.value)
  if (saveTaskPollTimer) clearInterval(saveTaskPollTimer)
  chartCpu?.dispose()
  chartMem?.dispose()
  chartNet?.dispose()
})
</script>

<style>
/* Global — Teleport 出去的元素 */
.jd-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 24px;
  backdrop-filter: blur(2px);
}

.jd-modal {
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  width: 100%;
  max-width: 860px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px rgba(0,0,0,0.25);
  overflow: hidden;
  position: relative;
}

/* Header */
.jd-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid hsl(var(--border));
  flex-shrink: 0;
}

.jd-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.jd-id {
  font-size: 0.75rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
  padding: 2px 8px;
  border-radius: 4px;
  flex-shrink: 0;
}

.jd-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: hsl(var(--foreground));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.jd-status {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  flex-shrink: 0;
}

.jd-status-running { background: hsl(var(--primary) / 0.1); color: hsl(var(--primary)); }
.jd-status-pending { background: hsl(var(--warning) / 0.15); color: hsl(var(--warning)); }
.jd-status-completed { background: hsl(var(--success) / 0.1); color: hsl(var(--success)); }
.jd-status-failed { background: hsl(var(--destructive) / 0.1); color: hsl(var(--destructive)); }

.jd-close {
  background: none;
  border: none;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  transition: background 0.15s;
  flex-shrink: 0;
}
.jd-close:hover { background: hsl(var(--accent)); color: hsl(var(--accent-foreground)); }

/* Body */
.jd-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Info grid */
.jd-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: hsl(var(--border));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  overflow: hidden;
}

.jd-field {
  background: hsl(var(--card));
  padding: 12px 14px;
}

.jd-field-label {
  font-size: 0.72rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.jd-field-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--foreground));
}

/* Section */
.jd-section { display: flex; flex-direction: column; gap: 8px; }

.jd-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.jd-section-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* Directory */
.jd-dir-row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  padding: 10px 14px;
}

.jd-dir-path {
  flex: 1;
  font-family: var(--font-family-mono);
  font-size: 0.8rem;
  color: hsl(var(--foreground));
  background: none;
  padding: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Metrics */
.jd-metrics { display: flex; flex-direction: column; gap: 8px; }

.jd-metric {
  display: flex;
  align-items: center;
  gap: 10px;
}

.jd-metric-label {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  width: 36px;
  flex-shrink: 0;
}

.jd-metric-bar {
  flex: 1;
  height: 6px;
  background: hsl(var(--muted));
  border-radius: 3px;
  overflow: hidden;
}

.jd-metric-fill {
  height: 100%;
  background: hsl(var(--primary));
  border-radius: 3px;
  transition: width 0.3s ease;
}
.jd-metric-fill.mem { background: hsl(var(--warning)); }
.jd-metric-fill.gpu { background: hsl(var(--success)); }

.jd-metric-val {
  font-size: 0.75rem;
  font-weight: 600;
  color: hsl(var(--foreground));
  width: 36px;
  text-align: right;
  flex-shrink: 0;
}

.jd-update-time {
  font-size: 0.72rem;
  color: hsl(var(--muted-foreground));
}

.jd-charts { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
.jd-chart-title { font-size: 0.72rem; color: hsl(var(--muted-foreground)); font-weight: 500; }
.jd-chart { width: 100%; height: 160px; }

.jd-node-list {
  font-size: 0.7rem;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
  margin-left: 6px;
  font-family: monospace;
}

.jd-prom-na {
  font-size: 0.75rem;
  color: #f59e0b;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 5px;
  padding: 4px 10px;
  margin-bottom: 8px;
}

/* Footer */
.jd-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid hsl(var(--border));
  flex-shrink: 0;
  justify-content: flex-end;
}

.jd-btn-danger {
  padding: 7px 14px;
  background: hsl(var(--destructive));
  color: hsl(var(--destructive-foreground));
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}
.jd-btn-danger:hover { opacity: 0.85; }

.jd-btn-warning {
  padding: 7px 14px;
  background: hsl(var(--warning, 38 92% 50%));
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}
.jd-btn-warning:hover { opacity: 0.85; }

.jd-btn-save-image {
  padding: 7px 14px;
  background: #0ea5e9;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}
.jd-btn-save-image:hover { opacity: 0.85; }

.jd-btn-exec {
  padding: 7px 14px;
  background: #7c3aed;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}
.jd-btn-exec:hover { opacity: 0.85; }

/* 保存镜像对话框 */
.jd-save-overlay {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  border-radius: 12px;
  z-index: 10;
}
.jd-save-box {
  background: hsl(var(--card));
  border-radius: 10px;
  width: 380px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  overflow: hidden;
}
.jd-save-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid hsl(var(--border));
  font-size: 0.9rem; font-weight: 600;
}
.jd-save-body { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.jd-save-tip { font-size: 0.8rem; color: hsl(var(--muted-foreground)); margin: 0; }
.jd-save-field { display: flex; flex-direction: column; gap: 4px; }
.jd-save-field label { font-size: 0.72rem; font-weight: 600; color: hsl(var(--muted-foreground)); text-transform: uppercase; }
.jd-save-field input {
  padding: 6px 9px;
  border: 1px solid hsl(var(--input));
  border-radius: 6px;
  font-size: 0.83rem;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  outline: none;
}
.jd-save-field input:focus { border-color: hsl(var(--ring)); }
.jd-save-result { padding: 8px 10px; border-radius: 6px; font-size: 0.8rem; }
.jd-save-result.ok { background: rgba(16,185,129,0.1); color: #10b981; }
.jd-save-result.err { background: rgba(239,68,68,0.1); color: #ef4444; }
.jd-save-target { font-family: monospace; font-size: 0.75rem; margin-top: 4px; opacity: 0.8; }
.jd-save-footer {
  display: flex; gap: 8px; padding: 12px 16px;
  border-top: 1px solid hsl(var(--border));
}

/* 进度条 */
.jd-save-progress { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
.jd-progress-steps { display: flex; justify-content: space-between; gap: 4px; }
.jd-progress-step { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
.jd-step-dot {
  width: 26px; height: 26px; border-radius: 50%;
  background: hsl(var(--muted)); color: hsl(var(--muted-foreground));
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75rem; font-weight: 600; transition: all 0.2s;
}
.jd-progress-step.done .jd-step-dot { background: #22c55e; color: #fff; }
.jd-progress-step.active .jd-step-dot { background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); }
.jd-progress-step.error .jd-step-dot { background: #ef4444; color: #fff; }
.jd-step-label { font-size: 0.65rem; color: hsl(var(--muted-foreground)); text-align: center; }
.jd-progress-step.done .jd-step-label,
.jd-progress-step.active .jd-step-label { color: hsl(var(--foreground)); }
.jd-progress-bar-wrap { height: 6px; background: hsl(var(--muted)); border-radius: 3px; overflow: hidden; }
.jd-progress-bar-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
@keyframes spin { to { transform: rotate(360deg); } }
.jd-spin { display: inline-block; animation: spin 1s linear infinite; }
.jd-btn-primary {
  flex: 1; padding: 7px 14px;
  background: hsl(var(--primary)); color: hsl(var(--primary-foreground));
  border: none; border-radius: 6px;
  font-size: 0.82rem; font-weight: 600; cursor: pointer;
  transition: opacity 0.15s;
}
.jd-btn-primary:hover:not(:disabled) { opacity: 0.9; }
.jd-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

.jd-btn-outline {
  padding: 7px 14px;
  background: transparent;
  color: hsl(var(--foreground));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.jd-btn-outline:hover { background: hsl(var(--accent)); }

.jd-btn-ghost {
  padding: 7px 14px;
  background: transparent;
  color: hsl(var(--muted-foreground));
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.jd-btn-ghost:hover { background: hsl(var(--accent)); color: hsl(var(--accent-foreground)); }
.jd-btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }

.jd-btn-active {
  background: hsl(var(--accent));
  color: hsl(var(--accent-foreground));
}

/* Log */
.jd-log-box {
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  overflow: hidden;
  max-height: 320px;
  overflow-y: auto;
}

.jd-log-loading, .jd-log-error {
  padding: 16px;
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

.jd-log-error { color: hsl(var(--destructive)); }

.jd-log-content {
  padding: 14px 16px;
  font-family: var(--font-family-mono);
  font-size: 0.78rem;
  line-height: 1.6;
  color: hsl(var(--foreground));
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}

@media (max-width: 600px) {
  .jd-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
