<template>
  <div class="desktop-page">
    <div class="page-header">
      <h3>🖥️ 远程会话</h3>
      <button class="btn-primary" @click="openCreateModal">+ 新建会话</button>
    </div>

    <div class="card">
      <table class="desktop-table">
        <thead>
          <tr>
            <th>名称</th><th>模式</th><th>节点</th><th>状态</th><th>创建时间</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="session in sessions" :key="session.id">
            <td>
              <div class="session-name">{{ session.name }}</div>
              <div class="session-sub" v-if="session.mode === 'app'">{{ session.appCommand }}</div>
            </td>
            <td>
              <span class="mode-badge" :class="session.mode">
                {{ session.mode === 'app' ? '📦 应用' : '🖥️ 桌面' }}
              </span>
            </td>
            <td>{{ session.status === 'running' ? session.address : '-' }}</td>
            <td><span class="status-badge" :class="session.status">{{ statusLabel(session.status) }}</span></td>
            <td>{{ session.createTime?.slice(0,16).replace('T',' ') }}</td>
            <td>
              <div class="action-buttons">
                <template v-if="session.status === 'running'">
                  <button class="btn-action btn-connect" @click="openXpra(session)">连接</button>
                  <button class="btn-action btn-stop" @click="stopSessionById(session)">停止</button>
                </template>
                <template v-else>
                  <button class="btn-action btn-start" @click="startSession(session)" :disabled="session.status === 'pending'">
                    {{ session.status === 'pending' ? '排队中' : '启动' }}
                  </button>
                </template>
                <button class="btn-action btn-script" @click="previewScript(session)">脚本</button>
                <button class="btn-action btn-delete" @click="deleteSession(session)">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="sessions.length === 0" class="empty-state">
        <div class="empty-icon">🖥️</div>
        <p>暂无会话</p>
        <p class="empty-hint">点击"新建会话"创建远程桌面或应用会话</p>
      </div>
    </div>

    <!-- 新建会话弹窗 -->
    <div v-if="showCreateModal" class="modal-overlay">
      <div class="modal-content create-modal" @click.stop>
        <div class="modal-header">
          <h2>新建远程会话</h2>
          <button @click="showCreateModal = false" class="btn-close">✕</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="createDesktop" class="create-form">
            <!-- 模式选择 -->
            <div class="form-group">
              <label>会话模式</label>
              <div class="mode-selector">
                <div :class="['mode-card', { active: createForm.mode === 'desktop' }]" @click="createForm.mode = 'desktop'">
                  <div class="mode-icon">🖥️</div>
                  <div class="mode-label">完整桌面</div>
                  <div class="mode-desc">启动完整桌面环境（xfce4/gnome/kde）</div>
                </div>
                <div :class="['mode-card', { active: createForm.mode === 'app' }]" @click="createForm.mode = 'app'">
                  <div class="mode-icon">📦</div>
                  <div class="mode-label">发布应用</div>
                  <div class="mode-desc">直接启动单个应用，更轻量</div>
                </div>
              </div>
            </div>

            <!-- 桌面模式：选择桌面环境 -->
            <div class="form-group" v-if="createForm.mode === 'desktop'">
              <label>桌面环境</label>
              <div class="desktop-env-selector">
                <label v-for="env in desktopEnvs" :key="env.value" class="env-option">
                  <input type="radio" v-model="createForm.desktopEnv" :value="env.value" />
                  <span>{{ env.icon }} {{ env.label }}</span>
                </label>
              </div>
            </div>

            <!-- 应用模式：选择或输入应用 -->
            <div class="form-group" v-if="createForm.mode === 'app'">
              <label>应用</label>
              <div class="app-grid">
                <div v-for="app in builtinApps" :key="app.cmd"
                  :class="['app-card', { active: createForm.appCommand === app.cmd }]"
                  @click="createForm.appCommand = app.cmd">
                  <div class="app-icon">{{ app.icon }}</div>
                  <div class="app-name">{{ app.name }}</div>
                </div>
              </div>
              <div class="custom-app-row">
                <input v-model="createForm.appCommand" placeholder="或输入自定义命令，如 gedit、matlab..." class="custom-app-input" />
              </div>
            </div>

            <div class="form-group">
              <label>会话名称 *</label>
              <input v-model="createForm.name" type="text" placeholder="my-session" required />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>分区 *</label>
                <select v-model="createForm.partition" required @change="loadResourcePresets">
                  <option value="" disabled>{{ partitionsLoading ? '加载中...' : '请选择' }}</option>
                  <option v-for="p in partitions" :key="p.name" :value="p.name">{{ p.name }}</option>
                </select>
              </div>
              <div class="form-group">
                <label>资源规格</label>
                <select v-model="createForm.presetIndex">
                  <option v-if="presetsLoading" value="" disabled>加载中...</option>
                  <option v-for="(p, i) in resourcePresets" :key="i" :value="i">{{ p.label }}</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>时长(小时)</label>
              <input v-model.number="createForm.duration" type="number" min="1" max="24" style="width:120px" />
            </div>

            <div class="form-actions">
              <button type="button" class="btn-secondary" @click="showCreateModal = false">取消</button>
              <button type="submit" class="btn-primary" :disabled="submitting">{{ submitting ? '创建中...' : '创建' }}</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- 启动进度弹窗 -->
    <div v-if="showStartModal" class="modal-overlay">
      <div class="modal-content start-modal" @click.stop>
        <div class="modal-header">
          <h2>{{ startingStatus === 'ready' ? '会话已就绪' : startingStatus === 'failed' ? '启动失败' : '启动中...' }}</h2>
          <button @click="showStartModal = false" class="btn-close">✕</button>
        </div>
        <div class="modal-body">
          <div v-if="startingStatus === 'starting'" class="status-starting">
            <div class="loading-icon"></div>
            <p>作业 ID: <code>{{ currentJobId }}</code></p>
            <div class="progress-bar-container">
              <div class="progress-bar-fill" :style="{ width: startProgress + '%' }"></div>
            </div>
            <div class="log-panel">
              <div class="log-header">
                <span>日志</span>
                <div class="log-tabs">
                  <button :class="['log-tab', { active: logType === 'out' }]" @click="logType = 'out'">stdout</button>
                  <button :class="['log-tab', { active: logType === 'err' }]" @click="logType = 'err'">stderr</button>
                </div>
              </div>
              <div class="log-body" ref="logBodyRef">
                <div v-if="logLines.length === 0" class="log-empty">等待日志...</div>
                <div v-for="(line, i) in logLines" :key="i" class="log-line">{{ line }}</div>
              </div>
            </div>
          </div>

          <div v-else-if="startingStatus === 'failed'" class="status-failed">
            <div class="fail-icon">✕</div>
            <h4>会话启动失败</h4>
            <div class="log-panel">
              <div class="log-body" ref="logBodyRef">
                <div v-for="(line, i) in logLines" :key="i" class="log-line">{{ line }}</div>
              </div>
            </div>
            <div class="modal-actions" style="margin-top:1rem">
              <button class="btn-secondary" @click="showStartModal = false">关闭</button>
            </div>
          </div>

          <div v-else-if="startingStatus === 'ready'" class="status-ready">
            <div class="success-icon">✅</div>
            <h4>会话已就绪</h4>
            <div class="connection-info">
              <div class="info-item"><span class="info-label">节点:</span><code>{{ selectedSession?.address }}</code></div>
              <div class="info-item"><span class="info-label">VNC 端口:</span><code>{{ selectedSession?.vncPort || selectedSession?.xpraPort }}</code></div>
              <div class="info-item" v-if="selectedSession?.vncPassword">
                <span class="info-label">VNC 密码:</span>
                <code>{{ showVncPwd ? selectedSession.vncPassword : '••••••••' }}</code>
                <button class="btn-eye-small" @click="showVncPwd = !showVncPwd">{{ showVncPwd ? '隐藏' : '显示' }}</button>
              </div>
            </div>
            <div class="connection-methods">
              <!-- 浏览器 Xpra HTML5 -->
              <div class="method-item">
                <span class="method-icon">🌐</span>
                <div class="method-content">
                  <strong>浏览器连接（Xpra HTML5）</strong>
                  <p>无需安装软件，通过后端代理直接在浏览器中打开图形界面</p>
                </div>
                <button class="btn-primary" @click="openNoVNC">打开</button>
              </div>
              <!-- hpc-client 隧道 -->
              <div class="method-item method-item-block">
                <div class="method-top">
                  <span class="method-icon">🔌</span>
                  <div class="method-content">
                    <strong>hpc-client 隧道（推荐）</strong>
                    <p>通过本地端口连接，性能更好，支持任意 VNC 客户端</p>
                  </div>
                  <button class="btn-secondary" @click="copyTunnelCmd">复制命令</button>
                </div>
                <pre class="tunnel-cmd">{{ tunnelCmd }}</pre>
                <p class="tunnel-hint">执行后用 VNC 客户端连接 <code>localhost:{{ localVncPort }}</code>，密码同上</p>
              </div>
            </div>
            <div class="modal-actions">
              <button class="btn-danger" @click="stopSession">停止会话</button>
              <button class="btn-secondary" @click="showStartModal = false">关闭</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Xpra 内嵌全屏 -->
    <div v-if="showXpraModal" class="vnc-overlay">
      <div class="vnc-toolbar">
        <span>{{ selectedSession?.mode === 'app' ? '📦' : '🖥️' }} {{ selectedSession?.name }} — {{ selectedSession?.address }}</span>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn-secondary" @click="toggleFullscreen">全屏</button>
          <button class="btn-secondary" @click="showXpraModal = false">关闭</button>
        </div>
      </div>
      <iframe ref="xpraFrame" :src="xpraUrl" class="xpra-frame" allow="fullscreen"></iframe>
    </div>

    <!-- 脚本预览 -->
    <div v-if="showScriptModal" class="modal-overlay">
      <div class="modal-content script-modal" @click.stop>
        <div class="modal-header">
          <h2>提交脚本</h2>
          <button @click="showScriptModal = false" class="btn-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="script-actions">
            <button class="btn-secondary" @click="copyScript">复制</button>
          </div>
          <pre class="script-body">{{ scriptInfo.script }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import axios from 'axios'
import { desktopAPI } from '../api/index'

const sessions = ref<any[]>([])
const partitions = ref<any[]>([])
const partitionsLoading = ref(false)
const presetsLoading = ref(false)
const resourcePresets = ref<any[]>([])
const submitting = ref(false)
const showCreateModal = ref(false)
const showStartModal = ref(false)
const showXpraModal = ref(false)
const showScriptModal = ref(false)
const startingStatus = ref<'starting' | 'ready' | 'failed'>('starting')
const startProgress = ref(0)
const currentJobId = ref('')
const selectedSession = ref<any>(null)
const logLines = ref<string[]>([])
const logType = ref<'out' | 'err'>('out')
const logBodyRef = ref<HTMLElement | null>(null)
const xpraFrame = ref<HTMLIFrameElement | null>(null)
const xpraUrl = ref('')
const scriptInfo = ref({ script: '', partition: '', workdir: '' })

let logTimer: any = null
let pollTimer: any = null
let listTimer: any = null

const desktopEnvs = [
  { value: 'xfce4', label: 'Xfce4', icon: '🪟' },
  { value: 'gnome', label: 'GNOME', icon: '🔵' },
  { value: 'kde',   label: 'KDE',   icon: '🟦' },
]

const builtinApps = [
  { name: 'Terminal', cmd: 'xterm',      icon: '💻' },
  { name: 'Firefox',  cmd: 'firefox',    icon: '🦊' },
  { name: 'VSCode',   cmd: 'code',       icon: '📝' },
  { name: 'Gedit',    cmd: 'gedit',      icon: '📄' },
  { name: 'Nautilus', cmd: 'nautilus',   icon: '📁' },
  { name: 'MATLAB',   cmd: 'matlab -desktop', icon: '🔢' },
  { name: 'ParaView', cmd: 'paraview',   icon: '📊' },
  { name: 'VMD',      cmd: 'vmd',        icon: '🧬' },
]

const createForm = ref({
  name: '', mode: 'desktop', desktopEnv: 'xfce4', appCommand: '',
  partition: '', duration: 4, presetIndex: 1,
})

const statusLabel = (s: string) => ({ stopped: '未启动', pending: '排队中', running: '运行中', failed: '失败' }[s] || s)

const loadSessions = async () => {
  try { sessions.value = await desktopAPI.getSessions() } catch { /* ignore */ }
}

const loadPartitions = async () => {
  partitionsLoading.value = true
  try {
    const res = await axios.get('/jobs/partitions/list')
    partitions.value = res.data.data || []
    if (partitions.value.length > 0 && !createForm.value.partition) {
      createForm.value.partition = partitions.value[0].name
      await loadResourcePresets()
    }
  } catch { partitions.value = [] }
  finally { partitionsLoading.value = false }
}

const loadResourcePresets = async () => {
  presetsLoading.value = true
  try {
    const res = await axios.get('/desktop/resource-presets', { params: { partition: createForm.value.partition } })
    resourcePresets.value = res.data.data || []
    createForm.value.presetIndex = 1
  } catch {
    resourcePresets.value = [
      { label: '小型  1核/2GB', cpus: 1, memory: 2 },
      { label: '中型  2核/4GB', cpus: 2, memory: 4 },
      { label: '大型  4核/8GB', cpus: 4, memory: 8 },
      { label: '超大  8核/16GB', cpus: 8, memory: 16 },
    ]
  }
  finally { presetsLoading.value = false }
}

onMounted(() => {
  loadSessions()
  listTimer = setInterval(() => {
    if (sessions.value.some((s: any) => s.status === 'pending' || s.status === 'running')) loadSessions()
  }, 8000)
})

onUnmounted(() => {
  if (listTimer) clearInterval(listTimer)
  if (logTimer) clearInterval(logTimer)
  if (pollTimer) clearInterval(pollTimer)
})

const openCreateModal = async () => {
  showCreateModal.value = true
  await loadPartitions()
}

const createDesktop = async () => {
  submitting.value = true
  try {
    const preset = resourcePresets.value[createForm.value.presetIndex] || resourcePresets.value[0]
    const data = await desktopAPI.createSession({
      name: createForm.value.name,
      mode: createForm.value.mode,
      type: createForm.value.desktopEnv,
      appCommand: createForm.value.mode === 'app' ? createForm.value.appCommand : '',
      resolution: 'auto',
      duration: createForm.value.duration,
      cpus: preset?.cpus,
      memory: preset?.memory,
      partition: createForm.value.partition,
    })
    sessions.value.unshift(data)
    showCreateModal.value = false
    createForm.value = { name: '', mode: 'desktop', desktopEnv: 'xfce4', appCommand: '', partition: partitions.value[0]?.name || '', duration: 4, presetIndex: 1 }
  } catch (e: any) { alert('创建失败: ' + (e.response?.data?.error || e.message)) }
  finally { submitting.value = false }
}

const deleteSession = async (session: any) => {
  if (!confirm(`确认删除 "${session.name}"？`)) return
  try {
    await desktopAPI.deleteSession(session.id)
    sessions.value = sessions.value.filter((s: any) => s.id !== session.id)
  } catch (e: any) { alert('删除失败: ' + (e.response?.data?.error || e.message)) }
}

const startSession = async (session: any) => {
  selectedSession.value = session
  showStartModal.value = true
  startingStatus.value = 'starting'
  startProgress.value = 0
  currentJobId.value = ''
  logLines.value = []
  try {
    const res = await desktopAPI.startSession(session.id, session.partition)
    currentJobId.value = String(res.jobId || '')
    startLogPolling(session.id)
    startPollStatus(session.id)
  } catch (e: any) {
    startingStatus.value = 'failed'
    alert('启动失败: ' + (e.response?.data?.error || e.message))
  }
}

const startLogPolling = (id: number) => {
  if (logTimer) clearInterval(logTimer)
  const fetch = async () => {
    try {
      const res = await axios.get(`/desktop/sessions/${id}/logs`, { params: { type: logType.value, lines: 200 } })
      if (res.data.exists) {
        logLines.value = res.data.lines.filter((l: string) => l !== '')
        setTimeout(() => { if (logBodyRef.value) logBodyRef.value.scrollTop = logBodyRef.value.scrollHeight }, 50)
      }
    } catch { /* ignore */ }
  }
  fetch()
  logTimer = setInterval(fetch, 3000)
}

watch(logType, () => { if (selectedSession.value && startingStatus.value === 'starting') startLogPolling(selectedSession.value.id) })

const startPollStatus = (id: number) => {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(async () => {
    try {
      const s = await desktopAPI.getStatus(id)
      startProgress.value = s.status === 'running' ? 100 : s.status === 'pending' ? 50 : startProgress.value
      if (s.status === 'running') {
        clearInterval(pollTimer); if (logTimer) clearInterval(logTimer)
        startingStatus.value = 'ready'
        selectedSession.value = s
        const idx = sessions.value.findIndex((x: any) => x.id === id)
        if (idx >= 0) sessions.value[idx] = s
      } else if (s.status === 'failed') {
        clearInterval(pollTimer); if (logTimer) clearInterval(logTimer)
        startingStatus.value = 'failed'
      }
    } catch { /* ignore */ }
  }, 3000)
}

// 打开 Xpra 连接（running 状态直接连）
const openXpra = (session: any) => {
  selectedSession.value = session
  showStartModal.value = true
  startingStatus.value = 'ready'
}

const showVncPwd = ref(false)

// 本地转发端口 = VNC端口（用户可自定义，默认用远端端口）
const localVncPort = computed(() => selectedSession.value?.vncPort || selectedSession.value?.xpraPort || 5901)

const tunnelCmd = computed(() => {
  if (!selectedSession.value) return ''
  const node = selectedSession.value.address || 'compute-node'
  const port = selectedSession.value.vncPort || selectedSession.value.xpraPort || 5901
  return `hpc-client tunnel --node ${node} --remote-port ${port} --local-port ${localVncPort.value}`
})

const copyTunnelCmd = () => {
  navigator.clipboard.writeText(tunnelCmd.value)
    .then(() => alert('隧道命令已复制'))
    .catch(() => alert(tunnelCmd.value))
}

// 浏览器连接：通过后端 WebSocket 代理打开 Xpra HTML5 客户端
const openNoVNC = () => {
  if (!selectedSession.value) return
  showStartModal.value = false
  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || ''
  const ssl = location.protocol === 'https:' ? '1' : '0'
  const port = location.port || (location.protocol === 'https:' ? '443' : '80')
  // xpra-html5 URL 参数格式：host/port/path/ssl
  // path 指向后端 WS 代理，token 通过 query string 传递
  const wsPath = `api/desktop/sessions/${selectedSession.value.id}/xpra-ws?token=${encodeURIComponent(token)}`
  const url = `/xpra/index.html?host=${location.hostname}&port=${port}&path=${encodeURIComponent(wsPath)}&ssl=${ssl}&autoconnect=true`
  window.open(url, '_blank')
}
  if (!selectedSession.value) return
  showStartModal.value = false
  const port = selectedSession.value.xpraPort || selectedSession.value.vncPort
  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || ''
  // 通过后端代理路径访问 Xpra HTML5
  const wsPath = `/api/desktop/sessions/${selectedSession.value.id}/xpra-ws?token=${encodeURIComponent(token)}`
  const wsProto = location.protocol === 'https:' ? 'wss' : 'ws'
  const wsUrl = `${wsProto}://${location.host}${wsPath}`
  // Xpra HTML5 内置客户端 URL（需要计算节点上 xpra 的 html 目录）
  xpraUrl.value = `/api/desktop/sessions/${selectedSession.value.id}/xpra-html?token=${encodeURIComponent(token)}`
  showXpraModal.value = true
}

// Xpra 原生客户端一键连接
const launchXpraClient = () => {
  if (!selectedSession.value) return
  const port = selectedSession.value.xpraPort || selectedSession.value.vncPort
  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || ''
  // xpra:// 协议由 xpra 客户端注册
  const uri = `xpra://ws/${location.hostname}:${location.port || (location.protocol === 'https:' ? 443 : 80)}/api/desktop/sessions/${selectedSession.value.id}/xpra-ws?token=${encodeURIComponent(token)}`
  window.location.href = uri
}

const stopSession = async () => {
  if (!selectedSession.value || !confirm('确定停止此会话？')) return
  try {
    await desktopAPI.stopSession(selectedSession.value.id)
    if (pollTimer) clearInterval(pollTimer)
    showStartModal.value = false
    await loadSessions()
  } catch (e: any) { alert('停止失败: ' + (e.response?.data?.error || e.message)) }
}

const stopSessionById = async (session: any) => {
  if (!confirm(`确定停止 "${session.name}"？`)) return
  try { await desktopAPI.stopSession(session.id); await loadSessions() }
  catch (e: any) { alert('停止失败: ' + (e.response?.data?.error || e.message)) }
}

const toggleFullscreen = () => {
  const el = document.querySelector('.vnc-overlay') as HTMLElement
  if (el) el.requestFullscreen?.()
}

const previewScript = async (session: any) => {
  try {
    const res = await axios.get(`/desktop/sessions/${session.id}/script`)
    scriptInfo.value = res.data
    showScriptModal.value = true
  } catch (e: any) { alert('获取脚本失败: ' + (e.response?.data?.error || e.message)) }
}

const copyScript = () => {
  navigator.clipboard.writeText(scriptInfo.value.script)
  alert('已复制')
}
</script>


<style scoped>
.desktop-page { display: flex; flex-direction: column; gap: 1.5rem; }
.page-header { display: flex; justify-content: space-between; align-items: center; }
.page-header h3 { margin: 0; font-size: 1.3rem; }

.desktop-table { width: 100%; border-collapse: collapse; }
.desktop-table th { padding: 1rem; text-align: left; font-weight: 600; color: #555; border-bottom: 2px solid #e5e7eb; background: #f9fafb; }
.desktop-table td { padding: 1rem; border-bottom: 1px solid #e5e7eb; }
.desktop-table tbody tr:hover { background: #f9fafb; }

.status-badge { display: inline-block; padding: .2rem .6rem; border-radius: 10px; font-size: .8rem; font-weight: 600; }
.status-badge.running  { background: #d1fae5; color: #065f46; }
.status-badge.pending  { background: #fef3c7; color: #92400e; }
.status-badge.failed   { background: #fee2e2; color: #991b1b; }
.status-badge.stopped  { background: #f3f4f6; color: #6b7280; }

.action-buttons { display: flex; gap: .5rem; }
.btn-action { padding: .4rem .9rem; border: none; border-radius: 6px; font-size: .85rem; font-weight: 600; cursor: pointer; }
.btn-start  { background: #667eea; color: #fff; }
.btn-stop   { background: #f59e0b; color: #fff; }
.btn-detail { background: #10b981; color: #fff; }
.btn-script { background: #6b7280; color: #fff; }
.btn-delete { background: #ef4444; color: #fff; }

.empty-state { text-align: center; padding: 4rem 2rem; color: #999; }
.empty-icon { font-size: 4rem; margin-bottom: 1rem; }
.empty-hint { font-size: .9rem; }

/* 弹窗 */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-content { background: #fff; border-radius: 12px; width: 90%; max-width: 600px; max-height: 90vh; overflow-y: auto; }
.start-modal { max-width: 680px; }
.script-modal { max-width: 750px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid #e5e7eb; }
.modal-header h2 { margin: 0; font-size: 1.2rem; }
.modal-body { padding: 1.5rem; }
.btn-close { background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #666; }

.form-group { margin-bottom: 1rem; }
.form-group label { display: block; margin-bottom: .4rem; font-weight: 600; font-size: .9rem; color: #555; }
.form-group input, .form-group select, .form-group textarea { width: 100%; padding: .6rem .9rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: .95rem; box-sizing: border-box; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.form-actions { display: flex; justify-content: flex-end; gap: 1rem; padding-top: .5rem; }

/* 启动状态 */
.status-starting { text-align: center; padding: 1rem; }
.loading-icon { width: 48px; height: 48px; border: 4px solid #e5e7eb; border-top-color: #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem; }
@keyframes spin { to { transform: rotate(360deg); } }
.progress-bar-container { width: 100%; height: 20px; background: #e5e7eb; border-radius: 10px; overflow: hidden; margin: 1rem 0; }
.progress-bar-fill { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); transition: width .5s; }

.status-failed { text-align: center; padding: 1rem; }
.fail-icon { width: 56px; height: 56px; line-height: 56px; border-radius: 50%; background: #fee2e2; color: #dc2626; font-size: 1.5rem; font-weight: bold; margin: 0 auto 1rem; }

.status-ready { padding: .5rem; }
.success-icon { font-size: 2.5rem; text-align: center; margin-bottom: .75rem; }
.status-ready h4 { text-align: center; margin: 0 0 1.5rem; font-size: 1.2rem; }
.connection-info { display: flex; gap: 2rem; background: #f9fafb; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; }
.info-item { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
.info-label { font-size: .85rem; color: #666; }
.btn-eye-small { padding: .15rem .5rem; background: #e5e7eb; border: none; border-radius: 4px; font-size: .8rem; cursor: pointer; }
.btn-eye-small:hover { background: #667eea; color: #fff; }
.connection-methods { display: flex; flex-direction: column; gap: .75rem; margin-bottom: 1.5rem; }
.method-item { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; }
.method-item-block { flex-direction: column; align-items: stretch; }
.method-top { display: flex; align-items: center; gap: 1rem; width: 100%; }
.tunnel-cmd { background: #1e293b; color: #e2e8f0; padding: .75rem 1rem; border-radius: 6px; font-size: .82rem; font-family: monospace; margin: .75rem 0 .25rem; white-space: pre-wrap; word-break: break-all; }
.tunnel-hint { font-size: .78rem; color: #6b7280; margin: 0; }
.method-icon { font-size: 1.8rem; }
.method-content { flex: 1; }
.method-content strong { display: block; margin-bottom: .2rem; }
.method-content p { margin: 0; font-size: .85rem; color: #666; }
.modal-actions { display: flex; gap: 1rem; justify-content: flex-end; padding-top: 1rem; border-top: 1px solid #e5e7eb; }

/* 日志 */
.log-panel { margin-top: 1rem; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; text-align: left; }
.log-header { display: flex; justify-content: space-between; align-items: center; padding: .5rem 1rem; background: #f3f4f6; font-size: .85rem; font-weight: 600; }
.log-tabs { display: flex; gap: .25rem; }
.log-tab { padding: .2rem .6rem; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; font-size: .8rem; cursor: pointer; }
.log-tab.active { background: #667eea; color: #fff; border-color: #667eea; }
.log-body { height: 160px; overflow-y: auto; background: #1e1e1e; padding: .75rem 1rem; font-family: monospace; font-size: .8rem; }
.log-empty { color: #666; font-style: italic; }
.log-line { color: #d4d4d4; line-height: 1.5; white-space: pre-wrap; word-break: break-all; }

/* noVNC */
.vnc-overlay { position: fixed; inset: 0; background: #000; z-index: 2000; display: flex; flex-direction: column; }
.vnc-toolbar { display: flex; justify-content: space-between; align-items: center; padding: .5rem 1rem; background: #1e1e1e; color: #fff; font-size: .9rem; flex-shrink: 0; }
.vnc-canvas-wrap { flex: 1; overflow: hidden; background: #000; }
.vnc-canvas-wrap :deep(canvas) { width: 100% !important; height: 100% !important; }

/* 脚本 */
.script-actions { margin-bottom: .75rem; }
.script-body { background: #1e1e1e; color: #d4d4d4; padding: 1rem; border-radius: 8px; font-size: .8rem; font-family: monospace; overflow-x: auto; max-height: 400px; overflow-y: auto; white-space: pre; margin: 0; }

/* 通用按钮 */
.btn-primary { background: #fff; color: #1e293b; border: 1px solid #e2e8f0; padding: 7px 16px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 0.85rem; box-shadow: 0 1px 3px rgba(0,0,0,0.06); transition: all 0.15s; }
.btn-primary:hover { background: #f1f5f9; }
.btn-primary:disabled { opacity: .6; cursor: not-allowed; }
.btn-secondary { background: #fff; color: #1e293b; border: 1px solid #e2e8f0; padding: 7px 16px; border-radius: 10px; cursor: pointer; font-weight: 500; font-size: 0.85rem; box-shadow: 0 1px 3px rgba(0,0,0,0.06); transition: all 0.15s; }
.btn-secondary:hover { background: #f1f5f9; }
.btn-danger { background: #fff; color: #ef4444; border: 1px solid rgba(239,68,68,0.3); padding: 7px 16px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 0.85rem; box-shadow: 0 1px 3px rgba(0,0,0,0.06); transition: all 0.15s; }
.btn-danger:hover { background: #fef2f2; }

/* 新增：会话列表 */
.session-name { font-weight: 600; font-size: .9rem; }
.session-sub { font-size: .78rem; color: #6b7280; margin-top: 2px; font-family: monospace; }
.mode-badge { display: inline-block; padding: .2rem .6rem; border-radius: 10px; font-size: .8rem; font-weight: 600; }
.mode-badge.desktop { background: #ede9fe; color: #5b21b6; }
.mode-badge.app     { background: #dbeafe; color: #1e40af; }
.btn-connect { background: #10b981; color: #fff; }

/* 模式选择卡片 */
.mode-selector { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
.mode-card { border: 2px solid #e5e7eb; border-radius: 10px; padding: 1rem; cursor: pointer; text-align: center; transition: all .15s; }
.mode-card:hover { border-color: #6366f1; background: #f5f3ff; }
.mode-card.active { border-color: #6366f1; background: #ede9fe; }
.mode-icon { font-size: 2rem; margin-bottom: .4rem; }
.mode-label { font-weight: 700; font-size: .95rem; margin-bottom: .25rem; }
.mode-desc { font-size: .78rem; color: #6b7280; }

/* 桌面环境选择 */
.desktop-env-selector { display: flex; gap: 1rem; flex-wrap: wrap; }
.env-option { display: flex; align-items: center; gap: .4rem; cursor: pointer; padding: .5rem .9rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: .9rem; transition: all .15s; }
.env-option:has(input:checked) { border-color: #6366f1; background: #ede9fe; }
.env-option input { accent-color: #6366f1; }

/* 应用网格 */
.app-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: .6rem; margin-bottom: .75rem; }
.app-card { border: 2px solid #e5e7eb; border-radius: 10px; padding: .6rem .4rem; cursor: pointer; text-align: center; transition: all .15s; }
.app-card:hover { border-color: #6366f1; background: #f5f3ff; }
.app-card.active { border-color: #6366f1; background: #ede9fe; }
.app-icon { font-size: 1.6rem; margin-bottom: .25rem; }
.app-name { font-size: .72rem; font-weight: 600; color: #374151; }
.custom-app-row { margin-top: .25rem; }
.custom-app-input { width: 100%; padding: .55rem .9rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: .9rem; box-sizing: border-box; }
.custom-app-input:focus { outline: none; border-color: #6366f1; }

/* Xpra iframe */
.xpra-frame { flex: 1; width: 100%; height: 100%; border: none; background: #000; }
</style>

