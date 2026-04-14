<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal-content job-detail-modal" @click.stop>
      <div class="modal-header">
        <h2>📋 作业详情</h2>
        <button @click="$emit('close')" class="btn-close">✕</button>
      </div>
      
      <div class="modal-body">
        <!-- 基本信息 -->
        <div class="detail-section">
          <h4>基本信息</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <label>作业 ID</label>
              <span><code>{{ job.id }}</code></span>
            </div>
            <div class="detail-item">
              <label>作业名称</label>
              <span>{{ job.name }}</span>
            </div>
            <div class="detail-item">
              <label>状态</label>
              <span :class="['status', `status-${job.status.toLowerCase()}`]">{{ job.status }}</span>
            </div>
            <div class="detail-item">
              <label>用户</label>
              <span>{{ job.user }}</span>
            </div>
          </div>
        </div>

        <!-- 资源配置 -->
        <div class="detail-section">
          <h4>资源配置</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <label>分区</label>
              <span>{{ job.partition }}</span>
            </div>
            <div class="detail-item">
              <label>节点数</label>
              <span>{{ job.nodes }}</span>
            </div>
            <div class="detail-item">
              <label>CPU 核心数</label>
              <span>{{ job.cpus }}</span>
            </div>
            <div class="detail-item">
              <label>内存</label>
              <span>{{ job.memory || '16 GB' }}</span>
            </div>
          </div>
        </div>

        <!-- 资源使用情况 (仅运行中的作业显示) -->
        <div v-if="job.status === 'RUNNING'" class="detail-section resource-usage">
          <div class="section-header">
            <h4>📊 资源使用情况</h4>
            <button class="btn-refresh" @click="refreshResourceUsage" :disabled="refreshing">
              {{ refreshing ? '⏳' : '🔄' }} 刷新
            </button>
          </div>

          <!-- CPU 使用率曲线 -->
          <div class="resource-chart-item">
            <div class="chart-header">
              <div class="chart-title">
                <span class="chart-icon">⚡</span>
                <span class="chart-label">CPU 使用率</span>
              </div>
              <div class="chart-value" :class="{ warning: currentUsage.cpu > 80, danger: currentUsage.cpu > 95 }">
                {{ currentUsage.cpu }}%
              </div>
            </div>
            <canvas ref="cpuChartRef" class="resource-chart" width="800" height="150"></canvas>
            <div class="chart-stats">
              <span>当前: {{ resourceUsage.cpu.used }} / {{ resourceUsage.cpu.total }} 核</span>
              <span>平均: {{ avgUsage.cpu.toFixed(1) }}%</span>
              <span>峰值: {{ maxUsage.cpu }}%</span>
            </div>
          </div>

          <!-- 内存使用率曲线 -->
          <div class="resource-chart-item">
            <div class="chart-header">
              <div class="chart-title">
                <span class="chart-icon">💾</span>
                <span class="chart-label">内存使用率</span>
              </div>
              <div class="chart-value" :class="{ warning: currentUsage.memory > 80, danger: currentUsage.memory > 95 }">
                {{ currentUsage.memory }}%
              </div>
            </div>
            <canvas ref="memoryChartRef" class="resource-chart" width="800" height="150"></canvas>
            <div class="chart-stats">
              <span>当前: {{ resourceUsage.memory.used }} / {{ resourceUsage.memory.total }} GB</span>
              <span>平均: {{ avgUsage.memory.toFixed(1) }}%</span>
              <span>峰值: {{ maxUsage.memory }}%</span>
            </div>
          </div>

          <!-- GPU 使用率曲线 (如果有) -->
          <div v-if="resourceUsage.gpu.available" class="resource-chart-item">
            <div class="chart-header">
              <div class="chart-title">
                <span class="chart-icon">🎮</span>
                <span class="chart-label">GPU 使用率</span>
              </div>
              <div class="chart-value" :class="{ warning: currentUsage.gpu > 80, danger: currentUsage.gpu > 95 }">
                {{ currentUsage.gpu }}%
              </div>
            </div>
            <canvas ref="gpuChartRef" class="resource-chart" width="800" height="150"></canvas>
            <div class="chart-stats">
              <span>显存: {{ resourceUsage.gpu.memoryUsed }} / {{ resourceUsage.gpu.memoryTotal }} GB</span>
              <span>温度: {{ resourceUsage.gpu.temperature }}°C</span>
              <span>功耗: {{ resourceUsage.gpu.power }} W</span>
            </div>
          </div>

          <!-- 网络 I/O 曲线 -->
          <div class="resource-chart-item">
            <div class="chart-header">
              <div class="chart-title">
                <span class="chart-icon">🌐</span>
                <span class="chart-label">网络 I/O</span>
              </div>
              <div class="chart-value">
                {{ resourceUsage.network.rxRate }} / {{ resourceUsage.network.txRate }}
              </div>
            </div>
            <canvas ref="networkChartRef" class="resource-chart" width="800" height="150"></canvas>
            <div class="chart-stats">
              <span class="rx-label">⬇️ 接收: {{ resourceUsage.network.received }}</span>
              <span class="tx-label">⬆️ 发送: {{ resourceUsage.network.transmitted }}</span>
            </div>
          </div>

          <!-- 存储 I/O 曲线 -->
          <div class="resource-chart-item">
            <div class="chart-header">
              <div class="chart-title">
                <span class="chart-icon">💿</span>
                <span class="chart-label">存储 I/O</span>
              </div>
              <div class="chart-value">
                {{ resourceUsage.storage.readRate }} / {{ resourceUsage.storage.writeRate }}
              </div>
            </div>
            <canvas ref="storageChartRef" class="resource-chart" width="800" height="150"></canvas>
            <div class="chart-stats">
              <span class="read-label">📖 读取: {{ resourceUsage.storage.read }}</span>
              <span class="write-label">✍️ 写入: {{ resourceUsage.storage.write }}</span>
            </div>
          </div>

          <div class="resource-note">
            <span class="note-icon">ℹ️</span>
            <span>
              资源使用数据每 5 秒自动更新 | 
              作业开始: {{ jobStartTime?.toLocaleString() }} | 
              {{ props.job.status === 'RUNNING' ? '当前运行时长' : '总运行时长' }}: {{ Math.floor(jobDuration) }} 分钟 | 
              最后更新: {{ lastUpdateTime }}
            </span>
          </div>
        </div>

        <!-- 时间信息 -->
        <div class="detail-section">
          <h4>时间信息</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <label>提交时间</label>
              <span>{{ job.submitTime }}</span>
            </div>
            <div class="detail-item" v-if="job.startTime">
              <label>开始时间</label>
              <span>{{ job.startTime || '-' }}</span>
            </div>
            <div class="detail-item">
              <label>运行时间</label>
              <span>{{ job.runTime }}</span>
            </div>
            <div class="detail-item" v-if="job.endTime">
              <label>结束时间</label>
              <span>{{ job.endTime || '-' }}</span>
            </div>
          </div>
        </div>

        <!-- 作业目录 -->
        <div class="detail-section">
          <h4>作业目录</h4>
          <div class="directory-info">
            <code class="directory-path">{{ job.directory }}</code>
            <button class="btn-secondary" @click="$emit('open-directory', job.id, job.directory)">
              📁 打开目录
            </button>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="detail-actions">
          <button 
            class="btn-secondary" 
            v-if="job.status === 'RUNNING'"
            @click="$emit('pause', job.id)"
          >
            ⏸️ 暂停作业
          </button>
          <button 
            class="btn-danger" 
            v-if="job.status === 'RUNNING' || job.status === 'PENDING'"
            @click="$emit('cancel', job.id)"
          >
            ❌ 取消作业
          </button>
          <button class="btn-secondary">📄 查看日志</button>
          <button class="btn-secondary">📊 查看输出</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  job: any
}>()

defineEmits(['close', 'pause', 'cancel', 'open-directory'])

const refreshing = ref(false)
const lastUpdateTime = ref(new Date().toLocaleTimeString())
const autoRefreshInterval = ref<any>(null)

// Canvas 引用
const cpuChartRef = ref<HTMLCanvasElement>()
const memoryChartRef = ref<HTMLCanvasElement>()
const gpuChartRef = ref<HTMLCanvasElement>()
const networkChartRef = ref<HTMLCanvasElement>()
const storageChartRef = ref<HTMLCanvasElement>()

// 历史数据存储 (根据作业运行时间动态调整)
const cpuHistory = ref<{ time: string, value: number }[]>([])
const memoryHistory = ref<{ time: string, value: number }[]>([])
const gpuHistory = ref<{ time: string, value: number }[]>([])
const networkRxHistory = ref<{ time: string, value: number }[]>([])
const networkTxHistory = ref<{ time: string, value: number }[]>([])
const storageReadHistory = ref<{ time: string, value: number }[]>([])
const storageWriteHistory = ref<{ time: string, value: number }[]>([])

// 作业时间信息
const jobStartTime = ref<Date | null>(null)
const jobEndTime = ref<Date | null>(null)
const jobDuration = ref(0) // 分钟

// 当前使用率
const currentUsage = ref({
  cpu: 0,
  memory: 0,
  gpu: 0
})

// 平均使用率
const avgUsage = ref({
  cpu: 0,
  memory: 0,
  gpu: 0
})

// 峰值使用率
const maxUsage = ref({
  cpu: 0,
  memory: 0,
  gpu: 0
})

const resourceUsage = ref({
  cpu: {
    usage: 0,
    used: 0,
    total: 0,
    load: '0.00'
  },
  memory: {
    usage: 0,
    used: 0,
    total: 0,
    available: 0
  },
  gpu: {
    available: false,
    usage: 0,
    memoryUsed: 0,
    memoryTotal: 0,
    temperature: 0,
    power: 0
  },
  network: {
    total: '0 MB',
    received: '0 MB',
    transmitted: '0 MB',
    rxRate: '0 KB/s',
    txRate: '0 KB/s'
  },
  storage: {
    total: '0 MB',
    read: '0 MB',
    write: '0 MB',
    readRate: '0 KB/s',
    writeRate: '0 KB/s'
  }
})

// 绘制曲线图
const drawChart = (
  canvas: HTMLCanvasElement | undefined, 
  data: { time: string, value: number }[], 
  color: string, 
  maxValue: number = 100, 
  showDualLine: boolean = false, 
  data2?: { time: string, value: number }[], 
  color2?: string
) => {
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width
  const height = canvas.height
  const padding = 50
  const paddingBottom = 60

  // 清空画布
  ctx.clearRect(0, 0, width, height)

  // 绘制背景
  ctx.fillStyle = '#f9fafb'
  ctx.fillRect(0, 0, width, height)

  // 绘制网格线
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 1

  // 水平网格线
  for (let i = 0; i <= 4; i++) {
    const y = padding + (height - padding - paddingBottom) * i / 4
    ctx.beginPath()
    ctx.moveTo(padding, y)
    ctx.lineTo(width - padding, y)
    ctx.stroke()

    // 绘制 Y 轴标签
    ctx.fillStyle = '#666'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`${Math.round(maxValue * (4 - i) / 4)}`, padding - 10, y + 4)
  }

  if (data.length === 0) {
    // 显示无数据提示
    ctx.fillStyle = '#999'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('等待数据...', width / 2, height / 2)
    return
  }

  // 计算时间范围
  const startTime = jobStartTime.value || new Date()
  const endTime = jobEndTime.value || new Date()
  const totalDuration = (endTime.getTime() - startTime.getTime()) / 1000 / 60 // 分钟

  // 绘制垂直网格线和时间标签
  const timePoints = Math.min(Math.ceil(totalDuration / 10), 10) // 最多10个时间点
  for (let i = 0; i <= timePoints; i++) {
    const x = padding + (width - padding * 2) * i / timePoints
    ctx.strokeStyle = '#e5e7eb'
    ctx.beginPath()
    ctx.moveTo(x, padding)
    ctx.lineTo(x, height - paddingBottom)
    ctx.stroke()

    // 绘制时间标签
    const timeOffset = (totalDuration * i / timePoints)
    const labelTime = new Date(startTime.getTime() + timeOffset * 60 * 1000)
    const timeLabel = labelTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    
    ctx.fillStyle = '#666'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.save()
    ctx.translate(x, height - paddingBottom + 15)
    ctx.rotate(-Math.PI / 6)
    ctx.fillText(timeLabel, 0, 0)
    ctx.restore()
  }

  // 绘制 X 轴标签
  ctx.fillStyle = '#333'
  ctx.font = 'bold 12px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('时间', width / 2, height - 10)

  // 绘制曲线
  const drawLine = (lineData: { time: string, value: number }[], lineColor: string) => {
    if (lineData.length === 0) return

    ctx.strokeStyle = lineColor
    ctx.lineWidth = 2
    ctx.beginPath()

    lineData.forEach((point, index) => {
      const pointTime = new Date(point.time)
      const timeOffset = (pointTime.getTime() - startTime.getTime()) / 1000 / 60 // 分钟
      const x = padding + ((width - padding * 2) * timeOffset / totalDuration)
      const y = height - paddingBottom - ((point.value / maxValue) * (height - padding - paddingBottom))

      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })

    ctx.stroke()

    // 绘制数据点
    ctx.fillStyle = lineColor
    lineData.forEach((point) => {
      const pointTime = new Date(point.time)
      const timeOffset = (pointTime.getTime() - startTime.getTime()) / 1000 / 60
      const x = padding + ((width - padding * 2) * timeOffset / totalDuration)
      const y = height - paddingBottom - ((point.value / maxValue) * (height - padding - paddingBottom))
      
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fill()
    })

    // 绘制填充区域
    ctx.globalAlpha = 0.1
    ctx.fillStyle = lineColor
    ctx.beginPath()
    
    lineData.forEach((point, index) => {
      const pointTime = new Date(point.time)
      const timeOffset = (pointTime.getTime() - startTime.getTime()) / 1000 / 60
      const x = padding + ((width - padding * 2) * timeOffset / totalDuration)
      const y = height - paddingBottom - ((point.value / maxValue) * (height - padding - paddingBottom))
      
      if (index === 0) {
        ctx.moveTo(x, height - paddingBottom)
        ctx.lineTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    
    const lastPoint = lineData[lineData.length - 1]
    const lastTime = new Date(lastPoint.time)
    const lastOffset = (lastTime.getTime() - startTime.getTime()) / 1000 / 60
    const lastX = padding + ((width - padding * 2) * lastOffset / totalDuration)
    ctx.lineTo(lastX, height - paddingBottom)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
  }

  // 绘制第一条线
  drawLine(data, color)

  // 如果有第二条线，绘制第二条线
  if (showDualLine && data2 && color2) {
    drawLine(data2, color2)
  }

  // 绘制当前时间线（如果作业还在运行）
  if (!jobEndTime.value) {
    const now = new Date()
    const currentOffset = (now.getTime() - startTime.getTime()) / 1000 / 60
    const currentX = padding + ((width - padding * 2) * currentOffset / totalDuration)
    
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(currentX, padding)
    ctx.lineTo(currentX, height - paddingBottom)
    ctx.stroke()
    ctx.setLineDash([])

    // 标注"当前"
    ctx.fillStyle = '#ef4444'
    ctx.font = 'bold 11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('当前', currentX, padding - 5)
  }
}

const refreshResourceUsage = async () => {
  refreshing.value = true
  
  setTimeout(() => {
    const currentTime = new Date().toISOString()

    // 模拟 CPU 使用率
    const cpuUsage = Math.floor(Math.random() * 40) + 50
    cpuHistory.value.push({ time: currentTime, value: cpuUsage })
    currentUsage.value.cpu = cpuUsage
    avgUsage.value.cpu = cpuHistory.value.reduce((a, b) => a + b.value, 0) / cpuHistory.value.length
    maxUsage.value.cpu = Math.max(...cpuHistory.value.map(h => h.value))

    resourceUsage.value.cpu = {
      usage: cpuUsage,
      used: Math.floor((props.job.cpus * cpuUsage) / 100),
      total: props.job.cpus,
      load: (Math.random() * 3 + 1).toFixed(2)
    }

    // 模拟内存使用率
    const memTotal = parseInt(props.job.memory) || 16
    const memUsage = Math.floor(Math.random() * 30) + 60
    memoryHistory.value.push({ time: currentTime, value: memUsage })
    currentUsage.value.memory = memUsage
    avgUsage.value.memory = memoryHistory.value.reduce((a, b) => a + b.value, 0) / memoryHistory.value.length
    maxUsage.value.memory = Math.max(...memoryHistory.value.map(h => h.value))

    resourceUsage.value.memory = {
      usage: memUsage,
      used: parseFloat((memTotal * memUsage / 100).toFixed(2)),
      total: memTotal,
      available: parseFloat((memTotal * (100 - memUsage) / 100).toFixed(2))
    }

    // 模拟 GPU
    if (props.job.partition === 'gpu') {
      const gpuUsage = Math.floor(Math.random() * 40) + 50
      gpuHistory.value.push({ time: currentTime, value: gpuUsage })
      currentUsage.value.gpu = gpuUsage
      avgUsage.value.gpu = gpuHistory.value.reduce((a, b) => a + b.value, 0) / gpuHistory.value.length
      maxUsage.value.gpu = Math.max(...gpuHistory.value.map(h => h.value))

      resourceUsage.value.gpu = {
        available: true,
        usage: gpuUsage,
        memoryUsed: Math.floor(Math.random() * 8) + 8,
        memoryTotal: 16,
        temperature: Math.floor(Math.random() * 20) + 60,
        power: Math.floor(Math.random() * 100) + 150
      }
    }

    // 模拟网络 I/O (KB/s)
    const rxRate = Math.floor(Math.random() * 5000) + 1000
    const txRate = Math.floor(Math.random() * 3000) + 500
    networkRxHistory.value.push({ time: currentTime, value: rxRate })
    networkTxHistory.value.push({ time: currentTime, value: txRate })

    resourceUsage.value.network = {
      total: ((rxRate + txRate) / 1024).toFixed(2) + ' MB/s',
      received: (Math.random() * 300 + 50).toFixed(2) + ' MB',
      transmitted: (Math.random() * 200 + 50).toFixed(2) + ' MB',
      rxRate: rxRate.toFixed(0) + ' KB/s',
      txRate: txRate.toFixed(0) + ' KB/s'
    }

    // 模拟存储 I/O (KB/s)
    const readRate = Math.floor(Math.random() * 10000) + 2000
    const writeRate = Math.floor(Math.random() * 6000) + 1000
    storageReadHistory.value.push({ time: currentTime, value: readRate })
    storageWriteHistory.value.push({ time: currentTime, value: writeRate })

    resourceUsage.value.storage = {
      total: ((readRate + writeRate) / 1024).toFixed(2) + ' MB/s',
      read: (Math.random() * 600 + 200).toFixed(2) + ' MB',
      write: (Math.random() * 400 + 300).toFixed(2) + ' MB',
      readRate: readRate.toFixed(0) + ' KB/s',
      writeRate: writeRate.toFixed(0) + ' KB/s'
    }

    // 绘制图表
    drawChart(cpuChartRef.value, cpuHistory.value, '#3b82f6')
    drawChart(memoryChartRef.value, memoryHistory.value, '#8b5cf6')
    if (resourceUsage.value.gpu.available) {
      drawChart(gpuChartRef.value, gpuHistory.value, '#10b981')
    }
    drawChart(networkChartRef.value, networkRxHistory.value, '#3b82f6', 10000, true, networkTxHistory.value, '#f59e0b')
    drawChart(storageChartRef.value, storageReadHistory.value, '#8b5cf6', 15000, true, storageWriteHistory.value, '#ef4444')

    lastUpdateTime.value = new Date().toLocaleTimeString()
    refreshing.value = false
  }, 500)
}

// 初始化作业时间
const initJobTime = () => {
  // 解析作业开始时间
  if (props.job.startTime) {
    jobStartTime.value = new Date(props.job.startTime)
  } else {
    // 如果没有开始时间，使用提交时间
    jobStartTime.value = new Date(props.job.submitTime)
  }

  // 解析作业结束时间
  if (props.job.status === 'COMPLETED' || props.job.status === 'FAILED') {
    if (props.job.endTime) {
      jobEndTime.value = new Date(props.job.endTime)
    } else {
      jobEndTime.value = new Date()
    }
  } else {
    // 作业还在运行，结束时间为当前时间
    jobEndTime.value = new Date()
  }

  // 计算作业持续时间（分钟）
  jobDuration.value = (jobEndTime.value.getTime() - jobStartTime.value.getTime()) / 1000 / 60
}

onMounted(() => {
  if (props.job.status === 'RUNNING' || props.job.status === 'COMPLETED') {
    // 初始化作业时间
    initJobTime()
    
    // 加载初始数据
    refreshResourceUsage()
    
    // 如果作业还在运行，每5秒自动刷新
    if (props.job.status === 'RUNNING') {
      autoRefreshInterval.value = setInterval(() => {
        // 更新结束时间为当前时间
        jobEndTime.value = new Date()
        refreshResourceUsage()
      }, 5000)
    }
  }
})

onUnmounted(() => {
  if (autoRefreshInterval.value) {
    clearInterval(autoRefreshInterval.value)
  }
})
</script>

<style scoped>
.job-detail-modal {
  max-width: 800px;
}

.detail-section {
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.detail-section:last-of-type {
  border-bottom: none;
}

.detail-section h4 {
  font-size: 1.1rem;
  color: #667eea;
  margin-bottom: 1rem;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-item label {
  font-weight: 600;
  color: #666;
  font-size: 0.9rem;
}

.detail-item span {
  font-size: 1rem;
  color: #333;
}

.directory-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
}

.directory-path {
  flex: 1;
  background: #e5e7eb;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  font-size: 0.9rem;
  font-family: 'Courier New', monospace;
  color: #333;
}

.detail-actions {
  display: flex;
  gap: 1rem;
  padding-top: 1rem;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
  
  .directory-info {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>

<style scoped>
.job-detail-modal {
  max-width: 900px;
  max-height: 90vh;
}

.detail-section {
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.detail-section:last-of-type {
  border-bottom: none;
}

.detail-section h4 {
  font-size: 1.1rem;
  color: #667eea;
  margin-bottom: 1rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.section-header h4 {
  margin: 0;
}

.btn-refresh {
  padding: 0.5rem 1rem;
  background: white;
  border: 2px solid #667eea;
  border-radius: 6px;
  color: #667eea;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-refresh:hover:not(:disabled) {
  background: #667eea;
  color: white;
}

.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-item label {
  font-weight: 600;
  color: #666;
  font-size: 0.9rem;
}

.detail-item span {
  font-size: 1rem;
  color: #333;
}

/* 资源使用情况 */
.resource-usage {
  background: #f9fafb;
  padding: 1.5rem;
  border-radius: 8px;
  border: 2px solid #e5e7eb;
}

.resource-chart-item {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.chart-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.chart-icon {
  font-size: 1.5rem;
}

.chart-label {
  font-weight: 600;
  color: #333;
  font-size: 1.1rem;
}

.chart-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #667eea;
}

.chart-value.warning {
  color: #f59e0b;
}

.chart-value.danger {
  color: #ef4444;
}

.resource-chart {
  width: 100%;
  height: 150px;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.chart-stats {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  color: #666;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 6px;
}

.chart-stats span {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.rx-label::before {
  content: '';
  display: inline-block;
  width: 12px;
  height: 12px;
  background: #3b82f6;
  border-radius: 2px;
  margin-right: 0.25rem;
}

.tx-label::before {
  content: '';
  display: inline-block;
  width: 12px;
  height: 12px;
  background: #f59e0b;
  border-radius: 2px;
  margin-right: 0.25rem;
}

.read-label::before {
  content: '';
  display: inline-block;
  width: 12px;
  height: 12px;
  background: #8b5cf6;
  border-radius: 2px;
  margin-right: 0.25rem;
}

.write-label::before {
  content: '';
  display: inline-block;
  width: 12px;
  height: 12px;
  background: #ef4444;
  border-radius: 2px;
  margin-right: 0.25rem;
}

.resource-note {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #dbeafe;
  border-radius: 6px;
  font-size: 0.85rem;
  color: #1e40af;
  margin-top: 1rem;
}

.note-icon {
  font-size: 1.2rem;
}

.directory-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
}

.directory-path {
  flex: 1;
  background: #e5e7eb;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  font-size: 0.9rem;
  font-family: 'Courier New', monospace;
  color: #333;
}

.detail-actions {
  display: flex;
  gap: 1rem;
  padding-top: 1rem;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
  
  .directory-info {
    flex-direction: column;
    align-items: stretch;
  }

  .io-stats,
  .process-stats {
    grid-template-columns: 1fr;
  }
}
</style>
