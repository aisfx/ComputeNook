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
              <div class="jd-field-label">节点数</div>
              <div class="jd-field-value">{{ job.nodes || 0 }}</div>
            </div>
            <div class="jd-field">
              <div class="jd-field-label">CPU 核心</div>
              <div class="jd-field-value">{{ job.cpus || 1 }}</div>
            </div>
            <div class="jd-field">
              <div class="jd-field-label">内存</div>
              <div class="jd-field-value">{{ job.memory || '16 GB' }}</div>
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
              <div class="jd-section-label">资源使用</div>
              <button class="jd-btn-ghost" @click="refreshResourceUsage" :disabled="refreshing">
                {{ refreshing ? '刷新中...' : '刷新' }}
              </button>
            </div>
            <div class="jd-metrics">
              <div class="jd-metric">
                <div class="jd-metric-label">CPU</div>
                <div class="jd-metric-bar">
                  <div class="jd-metric-fill" :style="{ width: currentUsage.cpu + '%' }"></div>
                </div>
                <div class="jd-metric-val">{{ currentUsage.cpu }}%</div>
              </div>
              <div class="jd-metric">
                <div class="jd-metric-label">内存</div>
                <div class="jd-metric-bar">
                  <div class="jd-metric-fill mem" :style="{ width: currentUsage.memory + '%' }"></div>
                </div>
                <div class="jd-metric-val">{{ currentUsage.memory }}%</div>
              </div>
              <div v-if="resourceUsage.gpu.available" class="jd-metric">
                <div class="jd-metric-label">GPU</div>
                <div class="jd-metric-bar">
                  <div class="jd-metric-fill gpu" :style="{ width: currentUsage.gpu + '%' }"></div>
                </div>
                <div class="jd-metric-val">{{ currentUsage.gpu }}%</div>
              </div>
            </div>
            <div class="jd-update-time">最后更新: {{ lastUpdateTime }}</div>
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
          <button class="jd-btn-outline" @click="openLog">查看日志</button>
          <button class="jd-btn-ghost" @click="$emit('close')">关闭</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { fileManagerApi } from '../config/api'
import { getToken } from '../utils/auth'

const props = defineProps<{ job: any }>()
defineEmits(['close', 'pause', 'resume', 'cancel', 'open-directory'])

const refreshing = ref(false)
const lastUpdateTime = ref(new Date().toLocaleTimeString())
const autoRefreshInterval = ref<any>(null)

const currentUsage = ref({ cpu: 0, memory: 0, gpu: 0 })
const resourceUsage = ref({
  gpu: { available: false, usage: 0, memoryUsed: 0, memoryTotal: 0, temperature: 0, power: 0 }
})

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

const refreshResourceUsage = () => {
  refreshing.value = true
  setTimeout(() => {
    currentUsage.value.cpu = Math.floor(Math.random() * 40) + 50
    currentUsage.value.memory = Math.floor(Math.random() * 30) + 60
    if (props.job.partition === 'gpu') {
      resourceUsage.value.gpu.available = true
      currentUsage.value.gpu = Math.floor(Math.random() * 40) + 50
    }
    lastUpdateTime.value = new Date().toLocaleTimeString()
    refreshing.value = false
  }, 500)
}

onMounted(() => {
  if (props.job.status === 'RUNNING') {
    refreshResourceUsage()
    autoRefreshInterval.value = setInterval(refreshResourceUsage, 5000)
  }
})

onUnmounted(() => {
  if (autoRefreshInterval.value) clearInterval(autoRefreshInterval.value)
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
  max-width: 640px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px rgba(0,0,0,0.25);
  overflow: hidden;
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
