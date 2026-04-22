<template>
  <div class="desktop-page">
    <div class="page-header">
      <h3>远程桌面</h3>
      <button class="btn-primary" @click="openCreateModal">+ 新建桌面</button>
    </div>

    <div class="card">
      <table class="desktop-table">
        <thead>
          <tr>
            <th>序号</th><th>名称</th><th>类型</th><th>节点</th><th>状态</th><th>创建时间</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(session, index) in sessions" :key="session.id">
            <td>{{ index + 1 }}</td>
            <td>{{ session.name }}</td>
            <td>{{ session.type }}</td>
            <td>{{ session.status === 'running' ? session.address : '-' }}</td>
            <td><span class="status-badge" :class="session.status">{{ statusLabel(session.status) }}</span></td>
            <td>{{ session.createTime }}</td>
            <td>
              <div class="action-buttons">
                <template v-if="session.status === 'running'">
                  <button class="btn-action btn-detail" @click="openDetail(session)">连接</button>
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
        <p>暂无桌面会话</p>
        <p class="empty-hint">点击"新建桌面"创建远程桌面会话</p>
      </div>
    </div>

    <!-- 新建桌面弹窗 -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
      <div class="modal-content create-modal" @click.stop>
        <div class="modal-header">
          <h2>新建远程桌面</h2>
          <button @click="showCreateModal = false" class="btn-close">✕</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="createDesktop" class="create-form">
            <div class="form-group">
              <label>桌面名称 *</label>
              <input v-model="createForm.name" type="text" placeholder="my-desktop" required />
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

    <!-- 启动/详情弹窗 -->
    <div v-if="showStartModal" class="modal-overlay" @click.self="showStartModal = false">
      <div class="modal-content start-modal" @click.stop>
        <div class="modal-header">
          <h2>{{ startingStatus === 'ready' ? '桌面已就绪' : startingStatus === 'failed' ? '启动失败' : '启动中...' }}</h2>
          <button @click="showStartModal = false" class="btn-close">✕</button>
        </div>
        <div class="modal-body">
          <!-- 启动中 -->
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

          <!-- 失败 -->
          <div v-else-if="startingStatus === 'failed'" class="status-failed">
            <div class="fail-icon">✕</div>
            <h4>桌面启动失败</h4>
            <div class="log-panel">
              <div class="log-body" ref="logBodyRef">
                <div v-for="(line, i) in logLines" :key="i" class="log-line">{{ line }}</div>
              </div>
            </div>
            <div class="modal-actions" style="margin-top:1rem">
              <button class="btn-secondary" @click="showStartModal = false">关闭</button>
            </div>
          </div>

          <!-- 就绪 -->
          <div v-else-if="startingStatus === 'ready'" class="status-ready">
            <div class="success-icon">✅</div>
            <h4>桌面已就绪</h4>
            <div class="connection-info">
              <div class="info-item"><span class="info-label">节点:</span><code>{{ selectedSession?.address }}</code></div>
              <div class="info-item"><span class="info-label">VNC 端口:</span><code>{{ selectedSession?.vncPort }}</code></div>
              <div class="info-item">
                <span class="info-label">VNC 密码:</span>
                <code>{{ showVNCPass ? selectedSession?.vncPassword : '••••••••' }}</code>
                <button class="btn-eye-small" @click="showVNCPass = !showVNCPass">{{ showVNCPass ? '隐藏' : '显示' }}</button>
                <button class="btn-eye-small" @click="copyText(selectedSession?.vncPassword)">复制</button>
              </div>
            </div>
            <div class="connection-methods">
              <div class="method-item">
                <span class="method-icon">🌐</span>
                <div class="method-content">
                  <strong>浏览器内嵌（noVNC）</strong>
                  <p>直接在浏览器中访问，无需安装软件</p>
                </div>
                <button class="btn-primary" @click="openVNCInPage">打开桌面</button>
              </div>
              <div class="method-item">
                <span class="method-icon">💻</span>
                <div class="method-content">
                  <strong>HPC 客户端（TurboVNC）</strong>
                  <p>通过 SSH 隧道连接，性能更好</p>
                </div>
                <button class="btn-secondary" @click="launchVNCClient">一键连接</button>
              </div>
            </div>
            <div class="modal-actions">
              <button class="btn-danger" @click="stopSession">停止桌面</button>
              <button class="btn-secondary" @click="showStartModal = false">关闭</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- noVNC 内嵌全屏弹窗 -->
    <div v-if="showVNCModal" class="vnc-overlay">
      <div class="vnc-toolbar">
        <span>🖥️ {{ selectedSession?.name }} — {{ selectedSession?.address }}</span>
        <div style="display:flex;gap:8px;align-items:center">
          <span v-if="vncStatus" :style="{fontSize:'0.8rem', color: vncStatus==='已连接' ? '#10b981' : '#f59e0b'}">{{ vncStatus }}</span>
          <button class="btn-secondary" @click="toggleFullscreen">全屏</button>
          <button class="btn-secondary" @click="closeVNC">断开</button>
        </div>
      </div>
      <div ref="vncContainer" class="vnc-canvas-wrap"></div>
    </div>

    <!-- 脚本预览弹窗 -->
    <div v-if="showScriptModal" class="modal-overlay" @click.self="showScriptModal = false">
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
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import axios from 'axios'
import { desktopAPI } from '../api/index'
import { loadRFB } from '../utils/rfb-wrapper'

const sessions = ref<any[]>([])
const partitions = ref<any[]>([])
const partitionsLoading = ref(false)
const presetsLoading = ref(false)
const resourcePresets = ref<any[]>([])
const submitting = ref(false)
const showCreateModal = ref(false)
const showStartModal = ref(false)
const showVNCModal = ref(false)
const showScriptModal = ref(false)
const startingStatus = ref<'starting' | 'ready' | 'failed'>('starting')
const startProgress = ref(0)
const currentJobId = ref('')
const selectedSession = ref<any>(null)
const logLines = ref<string[]>([])
const logType = ref<'out' | 'err'>('out')
const logBodyRef = ref<HTMLElement | null>(null)
const vncContainer = ref<HTMLElement | null>(null)
const vncStatus = ref('')
const showVNCPass = ref(false)
let rfb: any = null

const copyText = (text: string) => {
  if (!text) return
  navigator.clipboard.writeText(text)
  alert('已复制')
}
const scriptInfo = ref({ script: '', partition: '', workdir: '' })
const pageOrigin = location.origin

let logTimer: any = null
let pollTimer: any = null
let listTimer: any = null

const createForm = ref({
  name: '', partition: '', duration: 4, presetIndex: 1
})

const statusLabel = (s: string) => ({ stopped: '未启动', pending: '排队中', running: '运行中', failed: '失败' }[s] || s)

const loadSessions = async () => {
  try { sessions.value = await desktopAPI.getSessions() } catch { /* ignore */ }
}

const loadPartitions = async () => {
  partitionsLoading.value = true
  console.log('[Desktop] loadPartitions start, token:', !!(localStorage.getItem('token') || sessionStorage.getItem('token')))
  try {
    const res = await axios.get('/jobs/partitions/list')
    console.log('[Desktop] partitions response:', res.data)
    partitions.value = res.data.data || []
    if (partitions.value.length > 0 && !createForm.value.partition) {
      createForm.value.partition = partitions.value[0].name
      await loadResourcePresets()
    }
  } catch (e: any) {
    partitions.value = []
    console.error('[Desktop] 加载分区失败:', e.response?.status, e.response?.data?.error || e.message)
  }
  finally { partitionsLoading.value = false }
}

const loadResourcePresets = async () => {
  presetsLoading.value = true
  console.log('[Desktop] loadResourcePresets, partition:', createForm.value.partition)
  try {
    const res = await axios.get('/desktop/resource-presets', {
      params: { partition: createForm.value.partition }
    })
    console.log('[Desktop] presets response:', res.data)
    resourcePresets.value = res.data.data || []
    createForm.value.presetIndex = 1
  } catch (e: any) {
    console.warn('[Desktop] resource-presets failed, using fallback:', e.response?.status, e.message)
    resourcePresets.value = [
      { label: '小型  1核/2GB', cpus: 1, memory: 2 },
      { label: '中型  2核/4GB', cpus: 2, memory: 4 },
      { label: '大型  4核/8GB', cpus: 4, memory: 8 },
      { label: '超大  8核/16GB', cpus: 8, memory: 16 },
    ]
    createForm.value.presetIndex = 1
  }
  finally { presetsLoading.value = false }
}

onMounted(() => {
  loadSessions()
  listTimer = setInterval(() => {
    if (sessions.value.some((s: any) => s.status === 'pending' || s.status === 'running')) loadSessions()
  }, 8000)
})

const openCreateModal = async () => {
  showCreateModal.value = true
  // 每次打开弹窗都重新加载分区，确保数据最新
  await loadPartitions()
}

onUnmounted(() => {
  if (listTimer) clearInterval(listTimer)
  if (logTimer) clearInterval(logTimer)
  if (pollTimer) clearInterval(pollTimer)
  disconnectVNC()
})

const createDesktop = async () => {
  submitting.value = true
  try {
    const preset = resourcePresets.value[createForm.value.presetIndex] || resourcePresets.value[0]
    const data = await desktopAPI.createSession({
      name: createForm.value.name,
      type: 'auto',
      resolution: 'auto',
      duration: createForm.value.duration,
      cpus: preset?.cpus,
      memory: preset?.memory,
      partition: createForm.value.partition,
    })
    sessions.value.unshift(data)
    showCreateModal.value = false
    createForm.value = { name: '', partition: partitions.value[0]?.name || '', duration: 4, presetIndex: 1 }
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
        const idx = sessions.value.findIndex((x: any) => x.id === id)
        if (idx >= 0) sessions.value[idx] = s
      }
    } catch { /* ignore */ }
  }, 3000)
}

const openDetail = async (session: any) => {
  selectedSession.value = session
  showStartModal.value = true
  startingStatus.value = 'ready'
}

const stopSession = async () => {
  if (!selectedSession.value || !confirm('确定停止此桌面？')) return
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

// noVNC 直连 - 用 RFB 库直接在页面内建立 WebSocket VNC 连接
const openVNCInPage = async () => {
  showStartModal.value = false
  if (!selectedSession.value) return
  showVNCModal.value = true
  vncStatus.value = '连接中...'
  await nextTick()
  await connectVNC()
}

const connectVNC = async () => {
  if (!selectedSession.value || !vncContainer.value) return
  disconnectVNC()

  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || ''
  const id = selectedSession.value.id
  const pass = selectedSession.value.vncPassword || ''
  const wsProto = location.protocol === 'https:' ? 'wss' : 'ws'
  const wsUrl = `${wsProto}://${location.host}/api/desktop/sessions/${id}/vnc-ws?token=${encodeURIComponent(token)}`

  try {
    // 动态加载 RFB（从 public/novnc-lib，绕开 Rollup 顶层 await 问题）
    const RFB = await loadRFB()
    rfb = new RFB(vncContainer.value, wsUrl, {
      credentials: { password: pass },
    })
    rfb.scaleViewport = true
    rfb.resizeSession = true
    rfb.addEventListener('connect', () => { vncStatus.value = '已连接' })
    rfb.addEventListener('disconnect', (e: any) => {
      vncStatus.value = e.detail?.clean ? '已断开' : '连接断开'
      rfb = null
    })
    rfb.addEventListener('credentialsrequired', () => { rfb?.sendCredentials({ password: pass }) })
  } catch (e: any) {
    vncStatus.value = '连接失败: ' + e.message
  }
}

const disconnectVNC = () => {
  if (rfb) {
    try { rfb.disconnect() } catch { /* ignore */ }
    rfb = null
  }
  vncStatus.value = ''
}

const closeVNC = () => {
  disconnectVNC()
  showVNCModal.value = false
}

const toggleFullscreen = () => {
  const el = document.querySelector('.vnc-overlay') as HTMLElement
  if (el) el.requestFullscreen?.()
}

const getVNCWsUrl = (id: number) => {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}/api/desktop/sessions/${id}/vnc-ws`
}

// 客户端一键连接（TurboVNC via SSH 隧道）
const launchVNCClient = () => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || ''
  const uri = `hpcc://vnc?server=${encodeURIComponent(location.origin)}&token=${encodeURIComponent(token)}&session=${selectedSession.value?.id}&port=15900`
  window.location.href = uri
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
.btn-primary { background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; border: none; padding: .7rem 1.4rem; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: .95rem; }
.btn-primary:disabled { opacity: .6; cursor: not-allowed; }
.btn-secondary { background: #e5e7eb; color: #374151; border: none; padding: .7rem 1.4rem; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: .95rem; }
.btn-danger { background: #ef4444; color: #fff; border: none; padding: .7rem 1.4rem; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: .95rem; }
</style>
