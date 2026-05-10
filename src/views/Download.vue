<template>
  <div class="client-center">
    <div class="status-bar">
      <div class="status-bar-left">
        <h2>客户端连接中心</h2>
        <p>管理本地客户端、SSH 隧道、可视化桌面与目录挂载</p>
      </div>
      <div class="status-bar-right">
        <div :class="['client-status-pill', clientInstalled ? 'ok' : 'warn']">
          <span class="pill-dot"></span>
          {{ clientInstalled ? '客户端已就绪' : '客户端未安装' }}
        </div>
        <button class="btn-refresh" @click="checkClient" title="重新检测"></button>
      </div>
    </div>

    <div v-if="!clientInstalled" class="install-banner">
      <div class="install-banner-icon"></div>
      <div class="install-banner-body">
        <strong>需要安装客户端才能使用 SSH 隧道、可视化桌面和目录挂载</strong>
        <p>下载后双击运行，客户端会自动注册 <code>hpcc://</code> 协议，无需手动配置</p>
      </div>
      <div class="install-banner-actions">
        <button class="btn-primary" @click="downloadClient"> 下载 {{ currentOS.label }} 客户端</button>
        <button class="btn-ghost" @click="showAllPlatforms = !showAllPlatforms">其他平台</button>
      </div>
    </div>

    <div v-if="showAllPlatforms || clientInstalled" class="platform-cards">
      <div v-for="p in platforms" :key="p.key" :class="['platform-card', { current: p.key === osKey }]">
        <div class="platform-icon">{{ p.icon }}</div>
        <div class="platform-info">
          <span class="platform-name">{{ p.label }}</span>
          <span class="platform-desc">{{ p.desc }}</span>
        </div>
        <button class="btn-download-sm" :disabled="downloading === p.name" @click="downloadFile(p)">
          {{ downloading === p.name ? '下载中' : '下载' }}
        </button>
      </div>
    </div>

    <div class="feature-grid">
      <div class="feature-card">
        <div class="feature-header">
          <div class="feature-title">
            <span class="feature-icon"></span>
            <div>
              <h3>SSH 隧道</h3>
              <p>将计算节点 SSH 端口转发到本地，使用任意 SSH 客户端连接</p>
            </div>
          </div>
          <div :class="['conn-badge', sshStatus]">{{ sshStatusLabel }}</div>
        </div>
        <div class="feature-body">
          <div class="info-row"><span class="info-label">本地端口</span><code class="info-val">localhost:{{ sshLocalPort }}</code></div>
          <div class="info-row"><span class="info-label">连接节点</span><span class="info-val">{{ sshNode || '' }}</span></div>
          <div class="info-row"><span class="info-label">用户名</span><code class="info-val">{{ currentUsername }}</code></div>
        </div>
        <div class="feature-footer">
          <div class="cmd-block">
            <span class="cmd-label">连接命令</span>
            <div class="cmd-row">
              <code>ssh -p {{ sshLocalPort }} {{ currentUsername }}@localhost</code>
              <button class="btn-copy" @click="copy(`ssh -p ${sshLocalPort} ${currentUsername}@localhost`)"></button>
            </div>
          </div>
          <div class="action-row">
            <button v-if="sshStatus !== 'connected'" class="btn-action" :disabled="!clientInstalled" @click="showSshPanel = true"> 建立隧道</button>
            <button v-else class="btn-action danger" @click="disconnectSsh"> 断开隧道</button>
            <button class="btn-ghost-sm" @click="copy(`ssh -p ${sshLocalPort} ${currentUsername}@localhost`)">复制命令</button>
          </div>
        </div>
      </div>

      <div class="feature-card">
        <div class="feature-header">
          <div class="feature-title">
            <span class="feature-icon"></span>
            <div>
              <h3>可视化桌面</h3>
              <p>通过本地 VNC/Xpra 客户端连接远程图形桌面会话</p>
            </div>
          </div>
          <div :class="['conn-badge', vncStatus]">{{ vncStatusLabel }}</div>
        </div>
        <div class="feature-body">
          <div v-if="desktopSessions.length === 0" class="empty-hint">暂无运行中的桌面会话，请先在「远程桌面」页面创建会话</div>
          <template v-else>
            <div class="session-list">
              <div v-for="s in desktopSessions" :key="s.id" :class="['session-item', { active: selectedSession?.id === s.id }]" @click="selectedSession = s">
                <span class="session-dot" :class="s.status"></span>
                <span class="session-name">{{ s.name || `会话 #${s.id}` }}</span>
                <span class="session-port">:{{ s.vncPort || s.xpraPort }}</span>
              </div>
            </div>
            <div v-if="selectedSession" class="info-row" style="margin-top:8px">
              <span class="info-label">本地端口</span>
              <code class="info-val">localhost:{{ vncLocalPort }}</code>
            </div>
          </template>
        </div>
        <div class="feature-footer">
          <div class="action-row">
            <button v-if="vncStatus !== 'connected'" class="btn-action" :disabled="!clientInstalled || !selectedSession" @click="connectVnc"> 连接桌面</button>
            <button v-else class="btn-action danger" @click="disconnectVnc"> 断开桌面</button>
            <button class="btn-ghost-sm" @click="$emit('go-desktop')">管理会话</button>
          </div>
        </div>
      </div>

      <div class="feature-card">
        <div class="feature-header">
          <div class="feature-title">
            <span class="feature-icon"></span>
            <div>
              <h3>目录挂载</h3>
              <p>将 HPC 存储空间挂载为本地磁盘，像操作本地文件一样访问</p>
            </div>
          </div>
          <div :class="['conn-badge', mountStatus]">{{ mountStatusLabel }}</div>
        </div>
        <div class="feature-body">
          <div class="info-row"><span class="info-label">挂载点</span><code class="info-val">{{ mountPoint || (osKey === 'windows' ? 'Z:' : '/mnt/hpc') }}</code></div>
          <div class="info-row"><span class="info-label">协议</span><span class="info-val">WebDAV over HTTP</span></div>
          <div class="info-row"><span class="info-label">本地端口</span><code class="info-val">localhost:18080</code></div>
        </div>
        <div class="feature-footer">
          <div class="mount-point-row">
            <label>挂载点</label>
            <input v-model="mountPoint" :placeholder="osKey === 'windows' ? 'Z:' : '/mnt/hpc'" class="mount-input" />
          </div>
          <div class="action-row">
            <button v-if="mountStatus !== 'connected'" class="btn-action" :disabled="!clientInstalled" @click="mountDirectory"> 挂载目录</button>
            <button v-else class="btn-action danger" @click="unmountDirectory"> 卸载目录</button>
            <button class="btn-ghost-sm" @click="$emit('go-files')">文件管理</button>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showSshPanel" class="modal-overlay" @click.self="showSshPanel = false">
        <div class="modal-box">
          <div class="modal-header">
            <h3> 选择 SSH 节点</h3>
            <button class="btn-close" @click="showSshPanel = false"></button>
          </div>
          <div class="modal-body">
            <div v-if="loadingNodes" class="loading-hint">加载节点列表</div>
            <div v-else-if="nodes.length === 0" class="empty-hint">暂无可用节点</div>
            <div v-else class="node-list">
              <div v-for="n in nodes" :key="n.name" :class="['node-item', { selected: selectedNode?.name === n.name }]" @click="selectedNode = n">
                <span class="node-dot" :class="n.state === 'idle' ? 'idle' : n.state === 'allocated' ? 'busy' : 'off'"></span>
                <span class="node-name">{{ n.name }}</span>
                <span class="node-state">{{ n.state }}</span>
                <span class="node-host">{{ n.host || n.name }}</span>
              </div>
            </div>
            <div class="modal-form">
              <label>本地端口</label>
              <input v-model.number="sshLocalPort" type="number" min="1024" max="65535" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-primary" :disabled="!selectedNode" @click="connectSsh"> 建立隧道</button>
            <button class="btn-ghost" @click="showSshPanel = false">取消</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getApiBase, getUser } from '../utils/auth'
import notification from '../utils/notification'
import { dialog } from '../utils/dialog'

const emit = defineEmits(['go-desktop', 'go-files'])

const token = () => localStorage.getItem('token') || sessionStorage.getItem('token') || ''
const currentUsername = computed(() => getUser()?.username || '')

// ── 客户端检测 ──────────────────────────────────────────────
const clientInstalled = ref(false)
const showAllPlatforms = ref(false)
const downloading = ref('')

const checkClient = () => {
  // 尝试触发 hpcc://ping，500ms 内没有报错视为已安装
  // 浏览器无法直接感知协议是否注册，用 iframe 静默触发
  const iframe = document.createElement('iframe')
  iframe.style.display = 'none'
  iframe.src = 'hpcc://ping'
  document.body.appendChild(iframe)
  setTimeout(() => {
    document.body.removeChild(iframe)
    // 如果 localStorage 里有上次成功记录，也视为已安装
    if (localStorage.getItem('hpcc_installed') === '1') {
      clientInstalled.value = true
    }
  }, 600)
  // 同时检查 localStorage 标记
  if (localStorage.getItem('hpcc_installed') === '1') {
    clientInstalled.value = true
  }
}

const osKey = computed(() => {
  const ua = navigator.userAgent
  if (ua.includes('Windows')) return 'windows'
  if (ua.includes('Mac')) return 'darwin'
  return 'linux'
})

const platforms = [
  { key: 'windows', icon: '🪟', label: 'Windows', desc: 'Windows 10/11 x64', name: 'hpc-client-windows.exe' },
  { key: 'darwin',  icon: '🍎', label: 'macOS',   desc: 'Intel / Apple Silicon', name: 'hpc-client-mac' },
  { key: 'linux',   icon: '🐧', label: 'Linux',   desc: 'x86_64', name: 'hpc-client-linux' },
]

const currentOS = computed(() => platforms.find(p => p.key === osKey.value) || platforms[0])

const downloadFile = async (p: typeof platforms[0]) => {
  downloading.value = p.name
  try {
    const res = await fetch(`${getApiBase()}/api/download/${p.name}`, {
      headers: { Authorization: `Bearer ${token()}` }
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      dialog.error(j.error || '客户端文件尚未生成，请联系管理员')
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = p.name; a.click()
    URL.revokeObjectURL(url)
    // 下载后提示安装
    notification.info('下载完成，双击运行文件完成安装，然后点击「重新检测」')
  } catch (e: any) {
    dialog.error('下载失败: ' + e.message)
  } finally {
    downloading.value = ''
  }
}

const downloadClient = () => downloadFile(currentOS.value)

// ── SSH 隧道 ──────────────────────────────────────────────
const sshStatus = ref<'idle' | 'connecting' | 'connected'>('idle')
const sshNode = ref('')
const sshLocalPort = ref(12222)
const showSshPanel = ref(false)
const nodes = ref<any[]>([])
const selectedNode = ref<any>(null)
const loadingNodes = ref(false)

const sshStatusLabel = computed(() => ({
  idle: '未连接', connecting: '连接中…', connected: '已连接'
}[sshStatus.value]))

const loadNodes = async () => {
  loadingNodes.value = true
  try {
    const res = await fetch(`${getApiBase()}/api/webshell/nodes`, {
      headers: { Authorization: `Bearer ${token()}` }
    })
    if (res.ok) {
      const d = await res.json()
      nodes.value = d.nodes || d || []
    }
  } catch { /* ignore */ } finally {
    loadingNodes.value = false
  }
}

const triggerUri = (uri: string) => {
  // Use window.location.href for better browser compatibility with custom protocols
  // This ensures the protocol launch is treated as a user-initiated navigation
  window.location.href = uri
}

const connectSsh = () => {
  if (!selectedNode.value) return
  const node = selectedNode.value
  const uri = `hpcc://ssh?server=${encodeURIComponent(location.origin)}&token=${encodeURIComponent(token())}&host=${encodeURIComponent(node.host || node.name)}&port=${sshLocalPort.value}&ssh-port=${node.port || 22}&user=${encodeURIComponent(currentUsername.value)}`
  triggerUri(uri)
  sshStatus.value = 'connecting'
  sshNode.value = node.name
  showSshPanel.value = false
  // 增加延迟到5秒，给客户端更多时间建立连接
  setTimeout(() => {
    if (sshStatus.value === 'connecting') sshStatus.value = 'connected'
  }, 5000)
}

const disconnectSsh = () => {
  const uri = `hpcc://disconnect?server=${encodeURIComponent(location.origin)}&token=${encodeURIComponent(token())}&host=${encodeURIComponent(sshNode.value)}`
  triggerUri(uri)
  sshStatus.value = 'idle'
  sshNode.value = ''
}

// ── 可视化桌面 ──────────────────────────────────────────────
const vncStatus = ref<'idle' | 'connecting' | 'connected'>('idle')
const vncLocalPort = ref(15900)
const desktopSessions = ref<any[]>([])
const selectedSession = ref<any>(null)

const vncStatusLabel = computed(() => ({
  idle: '未连接', connecting: '连接中…', connected: '已连接'
}[vncStatus.value]))

const loadDesktopSessions = async () => {
  try {
    const res = await fetch(`${getApiBase()}/api/desktop/sessions`, {
      headers: { Authorization: `Bearer ${token()}` }
    })
    if (res.ok) {
      const d = await res.json()
      desktopSessions.value = (d.sessions || d || []).filter((s: any) => s.status === 'running')
      if (desktopSessions.value.length > 0 && !selectedSession.value) {
        selectedSession.value = desktopSessions.value[0]
      }
    }
  } catch { /* ignore */ }
}

const connectVnc = () => {
  if (!selectedSession.value) return
  const s = selectedSession.value
  const sessionId = s.id
  const tcpPort = s.xpraPort || s.vncPort
  const uri = `hpcc://xpra?server=${encodeURIComponent(location.origin)}&token=${encodeURIComponent(token())}&session=${sessionId}&port=${vncLocalPort.value}&remote-port=${tcpPort}&auto-connect=1`
  triggerUri(uri)
  vncStatus.value = 'connecting'
  // 增加延迟到8秒，给客户端更多时间建立隧道和连接
  setTimeout(() => {
    if (vncStatus.value === 'connecting') vncStatus.value = 'connected'
  }, 8000)
}

const disconnectVnc = () => {
  if (!selectedSession.value) return
  const uri = `hpcc://exit?server=${encodeURIComponent(location.origin)}&token=${encodeURIComponent(token())}&session=${selectedSession.value.id}`
  triggerUri(uri)
  vncStatus.value = 'idle'
}

// ── 目录挂载 ──────────────────────────────────────────────
const mountStatus = ref<'idle' | 'connecting' | 'connected'>('idle')
const mountPoint = ref('')

const mountStatusLabel = computed(() => ({
  idle: '未挂载', connecting: '挂载中…', connected: '已挂载'
}[mountStatus.value]))

const mountDirectory = () => {
  const mp = mountPoint.value || (osKey.value === 'windows' ? 'Z:' : '/mnt/hpc')
  const uri = `hpcc://mount?server=${encodeURIComponent(location.origin)}&token=${encodeURIComponent(token())}&mountpoint=${encodeURIComponent(mp)}&port=18080`
  triggerUri(uri)
  mountStatus.value = 'connecting'
  mountPoint.value = mp
  setTimeout(() => {
    if (mountStatus.value === 'connecting') mountStatus.value = 'connected'
  }, 3000)
}

const unmountDirectory = () => {
  const uri = `hpcc://unmount?server=${encodeURIComponent(location.origin)}&token=${encodeURIComponent(token())}&mountpoint=${encodeURIComponent(mountPoint.value)}`
  triggerUri(uri)
  mountStatus.value = 'idle'
}

// ── 工具 ──────────────────────────────────────────────
const copy = (text: string) => {
  navigator.clipboard.writeText(text)
  notification.success('已复制到剪贴板')
}

onMounted(() => {
  checkClient()
  loadNodes()
  loadDesktopSessions()
})
</script>

<style scoped>
.client-center {
  max-width: 1100px;
  margin: 0 auto;
}

/* ── 顶部状态栏 ── */
.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  gap: 12px;
}
.status-bar-left h2 { margin: 0 0 4px; font-size: 1.1rem; font-weight: 700; }
.status-bar-left p  { margin: 0; font-size: 0.82rem; color: hsl(var(--muted-foreground)); }
.status-bar-right   { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

.client-status-pill {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 12px; border-radius: 20px; font-size: 0.78rem; font-weight: 600;
}
.client-status-pill.ok   { background: rgba(34,197,94,.12); color: #16a34a; border: 1px solid rgba(34,197,94,.3); }
.client-status-pill.warn { background: rgba(234,179,8,.12);  color: #b45309; border: 1px solid rgba(234,179,8,.3); }
.pill-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: currentColor; animation: blink 2s infinite;
}
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.4} }

.btn-refresh {
  width: 30px; height: 30px; border: 1px solid hsl(var(--border));
  background: hsl(var(--background)); border-radius: 8px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: hsl(var(--muted-foreground)); transition: all .15s;
}
.btn-refresh:hover { background: hsl(var(--accent)); }

/* ── 安装横幅 ── */
.install-banner {
  display: flex; align-items: center; gap: 16px;
  background: hsl(var(--muted) / .5); border: 1px solid hsl(var(--border));
  border-radius: 12px; padding: 16px 20px; margin-bottom: 20px;
}
.install-banner-icon { font-size: 2rem; flex-shrink: 0; }
.install-banner-body { flex: 1; }
.install-banner-body strong { font-size: 0.88rem; }
.install-banner-body p { margin: 4px 0 0; font-size: 0.78rem; color: hsl(var(--muted-foreground)); }
.install-banner-body code { background: hsl(var(--muted)); padding: 1px 5px; border-radius: 4px; font-size: 0.78rem; }
.install-banner-actions { display: flex; gap: 8px; flex-shrink: 0; }

/* ── 平台卡片 ── */
.platform-cards {
  display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;
}
.platform-card {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; border: 1px solid hsl(var(--border));
  border-radius: 10px; background: hsl(var(--background)); flex: 1; min-width: 200px;
}
.platform-card.current { border-color: hsl(262 83% 58% / .5); background: hsl(262 83% 58% / .04); }
.platform-icon { font-size: 1.4rem; flex-shrink: 0; }
.platform-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.platform-name { font-size: 0.85rem; font-weight: 600; }
.platform-desc { font-size: 0.72rem; color: hsl(var(--muted-foreground)); }

/* ── 功能卡片网格 ── */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.feature-card {
  border: 1px solid hsl(var(--border)); border-radius: 12px;
  background: hsl(var(--background)); display: flex; flex-direction: column;
  overflow: hidden;
}

.feature-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 16px 16px 12px; border-bottom: 1px solid hsl(var(--border) / .6);
  gap: 12px;
}
.feature-title { display: flex; gap: 12px; align-items: flex-start; flex: 1; }
.feature-icon { font-size: 1.5rem; flex-shrink: 0; margin-top: 2px; }
.feature-title h3 { margin: 0 0 3px; font-size: 0.92rem; font-weight: 700; }
.feature-title p  { margin: 0; font-size: 0.75rem; color: hsl(var(--muted-foreground)); line-height: 1.4; }

.conn-badge {
  padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 600;
  white-space: nowrap; flex-shrink: 0;
}
.conn-badge.idle       { background: hsl(var(--muted)); color: hsl(var(--muted-foreground)); }
.conn-badge.connecting { background: rgba(234,179,8,.12); color: #b45309; }
.conn-badge.connected  { background: rgba(34,197,94,.12); color: #16a34a; }

.feature-body {
  padding: 12px 16px; flex: 1; display: flex; flex-direction: column; gap: 6px;
}

.info-row {
  display: flex; align-items: center; gap: 8px; font-size: 0.78rem;
}
.info-label { color: hsl(var(--muted-foreground)); min-width: 60px; flex-shrink: 0; }
.info-val   { color: hsl(var(--foreground)); }
code.info-val {
  background: hsl(var(--muted)); padding: 1px 6px; border-radius: 4px; font-size: 0.75rem;
}

.empty-hint {
  font-size: 0.78rem; color: hsl(var(--muted-foreground));
  text-align: center; padding: 12px 0;
}

.session-list { display: flex; flex-direction: column; gap: 4px; }
.session-item {
  display: flex; align-items: center; gap: 8px; padding: 6px 8px;
  border-radius: 6px; cursor: pointer; font-size: 0.78rem;
  border: 1px solid transparent; transition: all .15s;
}
.session-item:hover { background: hsl(var(--muted) / .5); }
.session-item.active { background: hsl(var(--muted)); border-color: hsl(var(--border)); }
.session-dot {
  width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
}
.session-dot.running { background: #22c55e; }
.session-dot.stopped { background: #9ca3af; }
.session-name { flex: 1; font-weight: 500; }
.session-port { color: hsl(var(--muted-foreground)); font-size: 0.72rem; }

.feature-footer {
  padding: 12px 16px; border-top: 1px solid hsl(var(--border) / .6);
  display: flex; flex-direction: column; gap: 10px;
}

.cmd-block { display: flex; flex-direction: column; gap: 4px; }
.cmd-label { font-size: 0.7rem; color: hsl(var(--muted-foreground)); font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
.cmd-row {
  display: flex; align-items: center; gap: 6px;
  background: hsl(var(--muted)); border-radius: 6px; padding: 5px 8px;
}
.cmd-row code { flex: 1; font-size: 0.75rem; color: hsl(var(--foreground)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.action-row { display: flex; gap: 8px; align-items: center; }

.mount-point-row {
  display: flex; align-items: center; gap: 8px; font-size: 0.78rem;
}
.mount-point-row label { color: hsl(var(--muted-foreground)); flex-shrink: 0; }
.mount-input {
  flex: 1; padding: 4px 8px; border: 1px solid hsl(var(--border));
  border-radius: 6px; font-size: 0.78rem; background: hsl(var(--background));
  color: hsl(var(--foreground)); outline: none;
}
.mount-input:focus { border-color: hsl(262 83% 58% / .6); }

/* ── 按钮 ── */
.btn-primary {
  padding: 7px 16px; background: hsl(262 83% 58%); color: #fff;
  border: none; border-radius: 8px; font-size: 0.82rem; font-weight: 600;
  cursor: pointer; transition: all .15s; white-space: nowrap;
}
.btn-primary:hover { background: hsl(262 83% 50%); }
.btn-primary:disabled { opacity: .5; cursor: not-allowed; }

.btn-ghost {
  padding: 7px 14px; background: transparent; color: hsl(var(--foreground));
  border: 1px solid hsl(var(--border)); border-radius: 8px; font-size: 0.82rem;
  cursor: pointer; transition: all .15s; white-space: nowrap;
}
.btn-ghost:hover { background: hsl(var(--accent)); }

.btn-action {
  padding: 6px 14px; background: hsl(var(--foreground)); color: hsl(var(--background));
  border: none; border-radius: 8px; font-size: 0.8rem; font-weight: 600;
  cursor: pointer; transition: all .15s; white-space: nowrap;
}
.btn-action:hover { opacity: .85; }
.btn-action:disabled { opacity: .4; cursor: not-allowed; }
.btn-action.danger { background: #ef4444; color: #fff; }
.btn-action.danger:hover { background: #dc2626; }

.btn-ghost-sm {
  padding: 5px 10px; background: transparent; color: hsl(var(--muted-foreground));
  border: 1px solid hsl(var(--border)); border-radius: 6px; font-size: 0.75rem;
  cursor: pointer; transition: all .15s; white-space: nowrap;
}
.btn-ghost-sm:hover { background: hsl(var(--accent)); color: hsl(var(--foreground)); }

.btn-download-sm {
  padding: 5px 12px; background: hsl(var(--background)); color: hsl(var(--foreground));
  border: 1px solid hsl(var(--border)); border-radius: 6px; font-size: 0.75rem;
  cursor: pointer; transition: all .15s; white-space: nowrap; flex-shrink: 0;
}
.btn-download-sm:hover { background: hsl(var(--accent)); }
.btn-download-sm:disabled { opacity: .5; cursor: not-allowed; }

.btn-copy {
  background: none; border: none; cursor: pointer; font-size: 0.85rem;
  padding: 2px 4px; border-radius: 4px; flex-shrink: 0;
  color: hsl(var(--muted-foreground)); transition: all .15s;
}
.btn-copy:hover { background: hsl(var(--border)); }

/* ── 节点选择弹窗 ── */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.5);
  display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;
}
.modal-box {
  background: hsl(var(--background)); border-radius: 12px; width: 100%; max-width: 480px;
  box-shadow: 0 20px 60px rgba(0,0,0,.25); display: flex; flex-direction: column; overflow: hidden;
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 1px solid hsl(var(--border));
}
.modal-header h3 { margin: 0; font-size: 1rem; }
.btn-close {
  background: none; border: none; font-size: 1rem; cursor: pointer;
  color: hsl(var(--muted-foreground)); width: 28px; height: 28px;
  border-radius: 6px; display: flex; align-items: center; justify-content: center;
}
.btn-close:hover { background: hsl(var(--accent)); }

.modal-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; max-height: 60vh; overflow-y: auto; }
.modal-footer { padding: 12px 20px; border-top: 1px solid hsl(var(--border)); display: flex; gap: 8px; }

.loading-hint { font-size: 0.82rem; color: hsl(var(--muted-foreground)); text-align: center; padding: 12px; }

.node-list { display: flex; flex-direction: column; gap: 4px; }
.node-item {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px;
  border-radius: 8px; cursor: pointer; font-size: 0.82rem;
  border: 1px solid transparent; transition: all .15s;
}
.node-item:hover { background: hsl(var(--muted) / .5); }
.node-item.selected { background: hsl(var(--muted)); border-color: hsl(var(--border)); }
.node-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.node-dot.idle { background: #22c55e; }
.node-dot.busy { background: #f59e0b; }
.node-dot.off  { background: #9ca3af; }
.node-name  { flex: 1; font-weight: 600; }
.node-state { font-size: 0.72rem; color: hsl(var(--muted-foreground)); }
.node-host  { font-size: 0.72rem; color: hsl(var(--muted-foreground)); }

.modal-form { display: flex; align-items: center; gap: 10px; font-size: 0.82rem; }
.modal-form label { color: hsl(var(--muted-foreground)); flex-shrink: 0; }
.modal-form input {
  flex: 1; padding: 6px 10px; border: 1px solid hsl(var(--border));
  border-radius: 6px; font-size: 0.82rem; background: hsl(var(--background));
  color: hsl(var(--foreground)); outline: none;
}
.modal-form input:focus { border-color: hsl(262 83% 58% / .6); }
</style>
