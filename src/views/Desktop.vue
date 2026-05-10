<template>
  <div class="desktop-page">
    <div class="page-header">
      <div class="page-header-left">
        <h3>远程会话</h3>
        <span class="page-subtitle">管理远程桌面与应用会话</span>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn-secondary" @click="cleanupSpace" title="清理旧文件释放磁盘空间">
          🧹 清理空间
        </button>
        <button class="btn-new-session" @click="openCreateModal">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          新建会话
        </button>
      </div>
    </div>

    <div class="card table-card">
      <table class="desktop-table" v-if="sessions.length > 0">
        <thead>
          <tr>
            <th>名称</th>
            <th>模式</th>
            <th>节点</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
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
                {{ session.mode === 'app' ? '应用' : '桌面' }}
              </span>
            </td>
            <td>
              <span class="node-text">{{ session.status === 'running' ? session.address : '—' }}</span>
            </td>
            <td>
              <span class="status-badge" :class="session.status">
                <span class="status-dot"></span>
                {{ statusLabel(session.status) }}
              </span>
            </td>
            <td class="time-cell">{{ session.createTime?.slice(0,16).replace('T',' ') }}</td>
            <td>
              <div class="action-buttons">
                <template v-if="session.status === 'running'">
                  <button class="btn-action btn-connect" @click="openXpra(session)">连接</button>
                  <button class="btn-action btn-stop" @click="stopSessionById(session)">停止</button>
                </template>
                <template v-else>
                  <button class="btn-action btn-start" @click="startSession(session)"
                    :disabled="session.status === 'pending'">
                    {{ session.status === 'pending' ? '排队中' : '启动' }}
                  </button>
                </template>
                <button class="btn-action btn-script" @click="previewScript(session)">脚本</button>
                <button class="btn-action btn-log" @click="viewSessionLog(session)">日志</button>
                <button class="btn-action btn-delete" @click="deleteSession(session)"
                  :disabled="session.status === 'running' || session.status === 'pending'">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="sessions.length === 0" class="empty-state">
        <div class="empty-illustration">
          <svg width="120" height="96" viewBox="0 0 120 96" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="8" width="100" height="66" rx="8" fill="#EEF2FF" stroke="#C7D2FE" stroke-width="1.5"/>
            <rect x="18" y="16" width="84" height="50" rx="4" fill="#F8FAFF"/>
            <rect x="26" y="24" width="40" height="5" rx="2.5" fill="#C7D2FE"/>
            <rect x="26" y="34" width="60" height="4" rx="2" fill="#E0E7FF"/>
            <rect x="26" y="43" width="50" height="4" rx="2" fill="#E0E7FF"/>
            <rect x="26" y="52" width="30" height="4" rx="2" fill="#E0E7FF"/>
            <rect x="44" y="74" width="32" height="6" rx="3" fill="#C7D2FE"/>
            <rect x="30" y="80" width="60" height="8" rx="4" fill="#E0E7FF"/>
            <circle cx="88" cy="72" r="16" fill="#6366F1"/>
            <path d="M88 65v14M81 72h14" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        </div>
        <p class="empty-title">暂无会话</p>
        <p class="empty-hint">点击「新建会话」创建远程桌面或应用会话</p>
        <button class="btn-new-session" @click="openCreateModal">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          新建会话
        </button>
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
              <div class="app-label-row">
                <label>应用</label>
                <button v-if="isAdminUser" type="button" class="btn-manage-apps" @click="showManageApps = true">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
                  管理应用
                </button>
              </div>
              <div class="app-grid" v-if="remoteApps.length > 0">
                <div v-for="app in remoteApps" :key="app.id"
                  :class="['app-card', { active: createForm.selectedAppId === app.id }]"
                  @click="selectApp(app)">
                  <div class="app-icon">{{ app.icon || '📦' }}</div>
                  <div class="app-name">{{ app.name }}</div>
                  <div class="app-desc" v-if="app.desc">{{ app.desc }}</div>
                </div>
              </div>
              <div class="custom-app-row">
                <input v-model="createForm.appCommand" placeholder="或输入自定义命令，如 gedit、matlab..." class="custom-app-input" />
              </div>
              <!-- modules 加载 -->
              <div class="modules-row" v-if="createForm.appCommand">
                <label>加载 Modules（可选）</label>
                <input v-model="createForm.modules" placeholder="如: matlab/R2024a gcc/12.3 cuda/12.0（空格分隔）" class="custom-app-input" />
                <div class="modules-hint">启动前自动执行 <code>module load</code>，多个模块用空格分隔</div>
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

            <div class="form-group">
              <label>GPU 数量</label>
              <select v-model.number="createForm.gpus" style="width:120px">
                <option :value="0">不使用</option>
                <option :value="1">1 卡</option>
                <option :value="2">2 卡</option>
                <option :value="4">4 卡</option>
                <option :value="8">8 卡</option>
              </select>
            </div>

            <div class="form-actions">
              <button type="button" class="btn-secondary" @click="showCreateModal = false">取消</button>
              <button type="submit" class="btn-primary" :disabled="submitting">{{ submitting ? '创建中...' : '创建' }}</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- 管理应用弹窗（仅管理员） -->
    <div v-if="showManageApps" class="modal-overlay" @click.self="showManageApps = false">
      <div class="modal-content" style="max-width:560px" @click.stop>
        <div class="modal-header">
          <h2>管理远程应用</h2>
          <button @click="showManageApps = false" class="btn-close">✕</button>
        </div>
        <div class="modal-body">
          <!-- 应用列表 -->
          <table class="apps-table" v-if="remoteApps.length > 0">
            <thead><tr><th>图标</th><th>名称</th><th>命令</th><th>Modules</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="app in remoteApps" :key="app.id">
                <td>{{ app.icon || '📦' }}</td>
                <td>{{ app.name }}</td>
                <td><code>{{ app.cmd }}</code></td>
                <td style="font-size:0.78rem;color:#6b7280">{{ app.modules || '-' }}</td>
                <td>
                  <button class="btn-action btn-delete" @click="deleteApp(app.id)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else style="color:#9ca3af;text-align:center;padding:1rem">暂无应用</div>

          <!-- 新增应用表单 -->
          <div class="add-app-form">
            <h4>添加应用</h4>
            <div class="form-row">
              <div class="form-group">
                <label>名称 *</label>
                <input v-model="newApp.name" placeholder="MATLAB" />
              </div>
              <div class="form-group">
                <label>图标</label>
                <input v-model="newApp.icon" placeholder="🔢" style="width:60px" />
              </div>
            </div>
            <div class="form-group">
              <label>启动命令 *</label>
              <input v-model="newApp.cmd" placeholder="matlab -desktop" />
            </div>
            <div class="form-group">
              <label>预加载 Modules（可选）</label>
              <input v-model="newApp.modules" placeholder="matlab/R2024a cuda/12.0（空格分隔）" />
              <div class="modules-hint">用户选择此应用时自动填入 modules</div>
            </div>
            <div class="form-group">
              <label>描述</label>
              <input v-model="newApp.desc" placeholder="数值计算软件" />
            </div>
            <div class="form-actions">
              <button type="button" class="btn-primary" @click="addApp" :disabled="!newApp.name || !newApp.cmd">添加应用</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 悬浮启动进度条（启动中可最小化，不阻塞页面操作） -->
    <Teleport to="body">
      <div v-if="launchState?.status === 'starting'" class="launch-float" :class="{ minimized: launchMinimized }">
        <div class="launch-float-header" @click="launchMinimized = !launchMinimized">
          <div class="launch-float-title">
            <div class="launch-spinner"></div>
            <span>启动中 · {{ launchState.sessionName }}</span>
            <span class="launch-jobid" v-if="launchState.jobId">作业 #{{ launchState.jobId }}</span>
          </div>
          <div class="launch-float-actions">
            <button class="launch-icon-btn" :title="launchMinimized ? '展开' : '最小化'">
              {{ launchMinimized ? '▲' : '▼' }}
            </button>
            <button class="launch-icon-btn" title="关闭（后台继续启动）" @click.stop="launchMinimized = true">✕</button>
          </div>
        </div>
        <div v-if="!launchMinimized" class="launch-float-body">
          <div class="launch-progress">
            <div class="launch-progress-fill" :style="{ width: launchState.progress + '%' }"></div>
          </div>
          <div class="log-panel">
            <div class="log-header">
              <span>日志</span>
              <div class="log-tabs">
                <button :class="['log-tab', { active: launchState.logType === 'out' }]" @click="launchState.logType = 'out'">stdout</button>
                <button :class="['log-tab', { active: launchState.logType === 'err' }]" @click="launchState.logType = 'err'">stderr</button>
              </div>
            </div>
            <div class="log-body">
              <div v-if="launchState.logLines.length === 0" class="log-empty">等待日志...</div>
              <div v-for="(line, i) in launchState.logLines" :key="i" class="log-line">{{ line }}</div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 启动结果弹窗（就绪/失败时显示） -->
    <div v-if="showStartModal && launchState?.status !== 'starting'" class="modal-overlay">
      <div class="modal-content start-modal" @click.stop>
        <div class="modal-header">
          <h2>{{ modalStatus === 'ready' ? '会话已就绪' : modalStatus === 'failed' ? '启动失败' : '会话已就绪' }}</h2>
          <button @click="showStartModal = false" class="btn-close">✕</button>
        </div>
        <div class="modal-body">
          <div v-if="modalStatus === 'failed'" class="status-failed">
            <div class="fail-icon">✕</div>
            <h4>会话启动失败</h4>
            <div v-if="launchState?.errorMessage" class="error-message">{{ launchState.errorMessage }}</div>
            <div class="log-panel">
              <div class="log-header">
                <span>错误日志</span>
                <button class="btn-text" @click="viewScript(launchState?.sessionId)">查看脚本</button>
              </div>
              <div class="log-body">
                <div v-if="!launchState?.logLines || launchState.logLines.length === 0" class="log-empty">无日志输出</div>
                <div v-for="(line, i) in launchState?.logLines || []" :key="i" class="log-line">{{ line }}</div>
              </div>
            </div>
            <div class="modal-actions" style="margin-top:1rem">
              <button class="btn-secondary" @click="showStartModal = false; clearLaunch()">关闭</button>
            </div>
          </div>

          <div v-else class="status-ready">
            <div class="success-icon">✅</div>
            <h4>会话已就绪</h4>
            <div class="connection-info">
              <div class="info-item"><span class="info-label">节点:</span><code>{{ selectedSession?.address }}</code></div>
              <div class="info-item"><span class="info-label">网页端口(WS):</span><code>{{ selectedSession?.vncPort }}</code></div>
              <div class="info-item"><span class="info-label">客户端端口(TCP):</span><code>{{ selectedSession?.xpraPort }}</code></div>
            </div>

            <div class="connection-methods">
              <!-- 方式1：浏览器直连（推荐） -->
              <div class="method-item method-recommend">
                <div class="method-top">
                  <span class="method-icon">🌐</span>
                  <div class="method-content">
                    <strong>浏览器连接 <span class="recommend-tag">推荐</span></strong>
                    <p>无需安装任何软件，直接在浏览器中打开图形界面</p>
                  </div>
                  <button class="btn-primary" @click="openNoVNC">立即打开</button>
                </div>
              </div>

              <!-- 方式2：本地客户端 -->
              <div class="method-item">
                <div class="method-top">
                  <span class="method-icon">🖥️</span>
                  <div class="method-content">
                    <strong>本地 Xpra 客户端</strong>
                    <p>需安装 hpc-client，性能更好，适合图形密集型应用</p>
                  </div>
                  <div style="display:flex;gap:6px;flex-shrink:0;align-items:center">
                    <span v-if="tunnelStatus === 'connecting'" style="font-size:0.8rem;color:#f59e0b">⏳ 连接中...</span>
                    <span v-else-if="tunnelStatus === 'connected'" style="font-size:0.8rem;color:#10b981">✓ 已连接</span>
                    <span v-else-if="tunnelStatus === 'disconnected'" style="font-size:0.8rem;color:#ef4444">⚠ 已断开</span>
                    <button class="btn-primary" @click="launchTunnel"
                      :style="tunnelStatus === 'disconnected' ? 'background:#ef4444;color:#fff;border-color:#ef4444' : ''">
                      {{ tunnelStatus === 'idle' ? '一键连接' : tunnelStatus === 'disconnected' ? '重新连接' : '重新连接' }}
                    </button>
                  </div>
                </div>
                <div class="method-hint">
                  <span>点「一键连接」→ hpc-client 自动建立隧道并启动 Xpra 客户端</span>
                  <span>TCP 端口: <code>{{ selectedSession?.xpraPort }}</code> → 本地: <code>{{ localVncPort }}</code></span>
                  <span style="color:#9ca3af">未安装 hpc-client？<a href="/download" target="_blank" style="color:#6366f1">点此下载</a></span>
                </div>
              </div>
            </div>

            <div class="modal-actions">
              <button class="btn-danger" @click="stopSession">停止会话</button>
              <button v-if="tunnelStatus === 'connected'" class="btn-secondary" @click="showStartModal = false; clientMinimized = true">最小化</button>
              <button class="btn-secondary" @click="showStartModal = false">关闭</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Xpra 内嵌全屏 -->
    <div v-if="showXpraModal" class="vnc-overlay">
      <div class="vnc-toolbar">
        <span>🖥️ {{ selectedSession?.name }} — {{ selectedSession?.address }}</span>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn-secondary" @click="toggleFullscreen">全屏</button>
          <button class="btn-secondary" @click="showXpraModal = false">关闭</button>
        </div>
      </div>
      <XpraViewer :ws-url="xpraWsUrl" :password="selectedSession?.vncPassword" class="xpra-viewer-fill" />
    </div>

    <!-- 客户端连接最小化悬浮条 -->
    <Teleport to="body">
      <div v-if="clientMinimized && (tunnelStatus === 'connected' || tunnelStatus === 'disconnected')" class="client-float-bar"
        :class="{ 'client-float-disconnected': tunnelStatus === 'disconnected' }">
        <span class="client-float-icon">🖥️</span>
        <span class="client-float-name">{{ selectedSession?.name }}</span>
        <span v-if="tunnelStatus === 'connected'" class="client-float-status">客户端已连接</span>
        <span v-else class="client-float-status" style="color:#ef4444">⚠ 已断开</span>
        <button class="client-float-btn" @click="showStartModal = true; clientMinimized = false">
          {{ tunnelStatus === 'disconnected' ? '重新连接' : '恢复' }}
        </button>
        <button class="client-float-btn client-float-stop" @click="stopSession">停止</button>
      </div>
    </Teleport>

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

    <!-- 作业日志弹窗 -->
    <div v-if="showLogModal" class="modal-overlay" @click.self="showLogModal = false">
      <div class="modal-content script-modal" @click.stop>
        <div class="modal-header">
          <h2>📄 作业日志 — {{ logSession?.name }}</h2>
          <div style="display:flex;gap:8px;align-items:center">
            <button :class="['btn-tab', logType === 'out' ? 'active' : '']" @click="switchLog('out')">标准输出</button>
            <button :class="['btn-tab', logType === 'err' ? 'active' : '']" @click="switchLog('err')">错误输出</button>
            <button @click="showLogModal = false" class="btn-close">✕</button>
          </div>
        </div>
        <div class="modal-body">
          <div v-if="logLoading" style="text-align:center;padding:2rem;color:#9ca3af">加载中...</div>
          <pre v-else class="script-body log-body">{{ logContent || '（暂无日志内容）' }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import axios from 'axios'
import { desktopAPI } from '../api/index'
import XpraViewer from '../components/XpraViewer.vue'
import { launchState, launchMinimized, startDesktopLaunch, clearLaunch } from '../utils/desktopLaunch'
import dialog from '../utils/dialog'
import { isAdmin } from '../utils/auth'

const isAdminUser = isAdmin()

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
const selectedSession = ref<any>(null)
const xpraWsUrl = ref('')

// 日志弹窗
const showLogModal = ref(false)
const logSession = ref<any>(null)
const logType = ref<'out' | 'err'>('out')
const logContent = ref('')
const logLoading = ref(false)

const viewSessionLog = async (session: any) => {
  logSession.value = session
  logType.value = 'out'
  showLogModal.value = true
  await fetchLog(session, 'out')
}

const switchLog = async (type: 'out' | 'err') => {
  logType.value = type
  await fetchLog(logSession.value, type)
}

const fetchLog = async (session: any, type: 'out' | 'err') => {
  logLoading.value = true
  logContent.value = ''
  try {
    const res = await axios.get(`/desktop/sessions/${session.id}/logs`, {
      params: { type, lines: 200 }
    })
    const lines: string[] = res.data.lines || []
    logContent.value = lines.join('\n')
    if (!res.data.exists) logContent.value = '（日志文件尚未生成，请等待作业启动）'
  } catch (e: any) {
    logContent.value = '加载失败: ' + (e.response?.data?.error || e.message)
  } finally {
    logLoading.value = false
  }
}
const scriptInfo = ref({ script: '', partition: '', workdir: '' })

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

// 远程应用管理
const remoteApps = ref<any[]>([])
const showManageApps = ref(false)
const newApp = ref({ name: '', icon: '', cmd: '', modules: '', desc: '' })

const loadRemoteApps = async () => {
  try {
    const res = await axios.get('/desktop/apps')
    remoteApps.value = res.data.data || []
  } catch { remoteApps.value = builtinApps.map((a, i) => ({ id: i + 1, ...a, modules: '', desc: '' })) }
}

const selectApp = (app: any) => {
  createForm.value.selectedAppId = app.id
  createForm.value.appCommand = app.cmd
  createForm.value.modules = app.modules || ''
}

const addApp = async () => {
  try {
    await axios.post('/desktop/apps', newApp.value)
    newApp.value = { name: '', icon: '', cmd: '', modules: '', desc: '' }
    await loadRemoteApps()
  } catch (e: any) { alert(e.response?.data?.error || '添加失败') }
}

const deleteApp = async (id: number) => {
  if (!confirm('确定删除此应用？')) return
  try {
    await axios.delete(`/desktop/apps/${id}`)
    await loadRemoteApps()
  } catch (e: any) { alert(e.response?.data?.error || '删除失败') }
}

const createForm = ref({
  name: '', mode: 'desktop', desktopEnv: 'xfce4', appCommand: '',
  partition: '', duration: 4, presetIndex: 1, gpus: 0,
  selectedAppId: 0, modules: '',
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
  loadRemoteApps()
  // 如果有进行中的启动，恢复显示
  if (launchState.value?.status === 'ready') {
    selectedSession.value = launchState.value.session
    showStartModal.value = true
  }
  listTimer = setInterval(() => {
    if (sessions.value.some((s: any) => s.status === 'pending' || s.status === 'running')) loadSessions()
  }, 8000)
  // 使用 pagehide 事件代替 beforeunload（更可靠且不会有弃用警告）
  window.addEventListener('pagehide', notifyClientDisconnect, { capture: true })
})

onUnmounted(() => {
  if (listTimer) clearInterval(listTimer)
  if (tunnelHeartbeat) clearInterval(tunnelHeartbeat)
  window.removeEventListener('pagehide', notifyClientDisconnect, { capture: true })
  // 注意：不清理 launchState，让轮询继续在后台运行
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
      modules: createForm.value.mode === 'app' ? createForm.value.modules : '',
      resolution: 'auto',
      duration: createForm.value.duration,
      cpus: preset?.cpus,
      memory: preset?.memory,
      gpus: createForm.value.gpus,
      partition: createForm.value.partition,
    })
    sessions.value.unshift(data)
    showCreateModal.value = false
    createForm.value = { name: '', mode: 'desktop', desktopEnv: 'xfce4', appCommand: '', partition: partitions.value[0]?.name || '', duration: 4, presetIndex: 1, gpus: 0, selectedAppId: 0, modules: '' }
  } catch (e: any) { dialog.error('创建失败: ' + (e.response?.data?.error || e.message)) }
  finally { submitting.value = false }
}

const deleteSession = async (session: any) => {
  const ok = await dialog.confirmDelete(session.name, '会话')
  if (!ok) return
  try {
    await desktopAPI.deleteSession(session.id)
    sessions.value = sessions.value.filter((s: any) => s.id !== session.id)
  } catch (e: any) { dialog.error('删除失败: ' + (e.response?.data?.error || e.message)) }
}

const startSession = async (session: any) => {
  selectedSession.value = session
  showStartModal.value = false
  await startDesktopLaunch(session, session.partition)
}

// 监听全局启动状态变化，就绪时自动弹窗；失败时也弹窗显示错误
watch(() => launchState.value?.status, (status) => {
  if (status === 'ready') {
    selectedSession.value = launchState.value?.session
    showStartModal.value = true
    loadSessions()
  } else if (status === 'failed') {
    showStartModal.value = true
    loadSessions()
  }
})

// 弹窗状态：优先用 launchState（启动流程中），否则用 selectedSession.status
const modalStatus = computed(() => {
  if (launchState.value?.status === 'failed') return 'failed'
  if (launchState.value?.status === 'ready') return 'ready'
  if (selectedSession.value?.status === 'running') return 'ready'
  return 'ready'
})

const clientMinimized = ref(false)

// 打开 Xpra 连接（running 状态直接连）
const openXpra = (session: any) => {
  selectedSession.value = session
  clientMinimized.value = false
  tunnelStatus.value = 'idle'
  showStartModal.value = true
}

const showVncPwd = ref(false)

// 本地转发端口 = VNC端口（用户可自定义，默认用远端端口）
const localVncPort = computed(() => selectedSession.value?.xpraPort || selectedSession.value?.vncPort || 14501)

const tunnelCmd = computed(() => {
  if (!selectedSession.value) return ''
  const node = selectedSession.value.address || 'compute-node'
  const port = selectedSession.value.vncPort || selectedSession.value.xpraPort || 5901
  return `hpc-client tunnel --node ${node} --remote-port ${port} --local-port ${localVncPort.value}`
})

const copyTunnelCmd = () => {
  navigator.clipboard.writeText(tunnelCmd.value)
    .then(() => dialog.success('隧道命令已复制'))
    .catch(() => dialog.info(tunnelCmd.value))
}

// 浏览器连接：直接用 XpraViewer 组件通过后端 WS 代理连接
const openNoVNC = () => {
  if (!selectedSession.value) return
  showStartModal.value = false
  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || ''
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const port = location.port || (location.protocol === 'https:' ? '443' : '80')
  xpraWsUrl.value = `${proto}://${location.hostname}:${port}/api/desktop/sessions/${selectedSession.value.id}/xpra-ws?token=${encodeURIComponent(token)}`
  showXpraModal.value = true
}

// 端口转发 + 自动启动 Xpra：一键完成隧道建立和客户端连接
const tunnelStatus = ref<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle')
const tunnelSessionId = ref<number | null>(null)
let tunnelHeartbeat: any = null

// 心跳检测：定时检查本地隧道端口是否可达
const startTunnelHeartbeat = (localPort: number) => {
  if (tunnelHeartbeat) clearInterval(tunnelHeartbeat)
  tunnelHeartbeat = setInterval(async () => {
    if (tunnelStatus.value !== 'connected') { clearInterval(tunnelHeartbeat); return }
    try {
      // 尝试连接本地端口，超时2秒认为断开
      const ws = new WebSocket(`ws://localhost:${localPort}/`)
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => { ws.close(); reject() }, 2000)
        ws.onopen = () => { clearTimeout(t); ws.close(); resolve() }
        ws.onerror = () => { clearTimeout(t); reject() }
        ws.onclose = () => { clearTimeout(t); reject() }
      })
    } catch {
      tunnelStatus.value = 'disconnected'
      clearInterval(tunnelHeartbeat)
    }
  }, 10000)
}

const launchTunnel = () => {
  if (!selectedSession.value) return
  // 如果是重连，先通知断开旧隧道
  if (tunnelStatus.value === 'disconnected' || tunnelStatus.value === 'connected') {
    notifyClientDisconnect()
  }
  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || ''
  const sessionId = selectedSession.value.id
  const localPort = localVncPort.value
  const tcpPort = selectedSession.value.xpraPort
  const pwd = selectedSession.value.vncPassword || ''
  const uri = `hpcc://xpra?server=${encodeURIComponent(location.origin)}&token=${encodeURIComponent(token)}&session=${sessionId}&port=${localPort}&remote-port=${tcpPort}&auto-connect=1${pwd ? '&password=' + encodeURIComponent(pwd) : ''}`
  triggerUri(uri)
  tunnelStatus.value = 'connecting'
  tunnelSessionId.value = sessionId
  // 增加延迟到8秒，给客户端更多时间建立隧道
  setTimeout(() => {
    if (tunnelStatus.value === 'connecting') {
      tunnelStatus.value = 'connected'
      startTunnelHeartbeat(localPort)
    }
  }, 8000)
}

// 浏览器退出时通知 hpc-client 断开
const notifyClientDisconnect = () => {
  if (tunnelSessionId.value === null) return
  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || ''
  // 用 sendBeacon 保证页面关闭时也能发出
  // sendBeacon 需要使用 Blob 或 FormData，并设置正确的 Content-Type
  const url = `/api/desktop/sessions/${tunnelSessionId.value}/client-exit`
  const blob = new Blob([JSON.stringify({ token })], { type: 'application/json' })
  navigator.sendBeacon(url, blob)
  
  // 注意：不在这里触发 hpcc://exit，因为 pagehide 事件中无法触发自定义协议
  // hpc-client 应该通过监听后端 API 或 WebSocket 断开来处理清理
}

const triggerUri = (uri: string) => {
  // 直接使用 window.location.href 触发自定义协议
  // 注意：这只在用户手势（如点击）触发的函数中有效
  window.location.href = uri
}

// 启动本地 Xpra 客户端连接到隧道本地端口（手动触发，隧道已就绪时用）
const launchXpraClient = () => {
  if (!selectedSession.value) return
  const localPort = localVncPort.value
  const pwd = selectedSession.value.vncPassword || ''
  const uri = `xpra://tcp/localhost:${localPort}/${pwd ? '?password=' + encodeURIComponent(pwd) : ''}`
  triggerUri(uri)
}

// 主动断开隧道（用户手势触发）
const disconnectTunnel = () => {
  if (tunnelSessionId.value === null) return
  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || ''
  const uri = `hpcc://exit?server=${encodeURIComponent(location.origin)}&token=${encodeURIComponent(token)}&session=${tunnelSessionId.value}`
  triggerUri(uri)
  tunnelStatus.value = 'idle'
  tunnelSessionId.value = null
  if (tunnelHeartbeat) clearInterval(tunnelHeartbeat)
}

const stopSession = async () => {
  if (!selectedSession.value) return
  const ok = await dialog.confirm('确定停止此会话？', { title: '停止会话' })
  if (!ok) return
  try {
    // 先断开客户端连接
    if (tunnelStatus.value === 'connected' || tunnelStatus.value === 'disconnected') {
      disconnectTunnel()
    }
    await desktopAPI.stopSession(selectedSession.value.id)
    showStartModal.value = false
    clearLaunch()
    await loadSessions()
  } catch (e: any) { dialog.error('停止失败: ' + (e.response?.data?.error || e.message)) }
}

const stopSessionById = async (session: any) => {
  const ok = await dialog.confirm(`确定停止 "${session.name}"？`, { title: '停止会话' })
  if (!ok) return
  try { await desktopAPI.stopSession(session.id); await loadSessions() }
  catch (e: any) { dialog.error('停止失败: ' + (e.response?.data?.error || e.message)) }
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
  } catch (e: any) { dialog.error('获取脚本失败: ' + (e.response?.data?.error || e.message)) }
}

const viewScript = async (sessionId?: number) => {
  if (!sessionId) return
  try {
    const res = await axios.get(`/desktop/sessions/${sessionId}/script`)
    scriptInfo.value = res.data
    showScriptModal.value = true
  } catch (e: any) { dialog.error('获取脚本失败: ' + (e.response?.data?.error || e.message)) }
}

const copyScript = () => {
  navigator.clipboard.writeText(scriptInfo.value.script)
  dialog.success('已复制')
}

const cleanupSpace = async () => {
  const ok = await dialog.confirm(
    '将清理旧的 xpra 目录和日志文件以释放磁盘空间。\n保留最近的文件，删除较旧的文件。\n\n确定继续？',
    { title: '清理磁盘空间' }
  )
  if (!ok) return
  
  try {
    const res = await axios.post('/desktop/cleanup')
    const cleaned = res.data.cleaned
    const sizeMB = (cleaned.totalBytes / 1024 / 1024).toFixed(2)
    dialog.success(
      `清理完成！\n` +
      `删除 ${cleaned.xpraDirs} 个旧目录\n` +
      `删除 ${cleaned.logFiles} 个日志文件\n` +
      `释放 ${sizeMB} MB 空间`
    )
  } catch (e: any) {
    dialog.error('清理失败: ' + (e.response?.data?.error || e.message))
  }
}

</script>


<style scoped>
.desktop-page { display: flex; flex-direction: column; gap: 1.5rem; }

/* 页面头部 */
.page-header { display: flex; justify-content: space-between; align-items: center; }
.page-header-left { display: flex; flex-direction: column; gap: 2px; }
.page-header h3 { margin: 0; font-size: 1.25rem; font-weight: 700; color: #111827; }
.page-subtitle { font-size: 0.82rem; color: #9ca3af; }

/* 新建按钮 */
.btn-new-session {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px; background: #6366f1; color: #fff;
  border: none; border-radius: 8px; font-size: 0.85rem; font-weight: 600;
  cursor: pointer; transition: background 0.15s, box-shadow 0.15s;
  box-shadow: 0 1px 4px rgba(99,102,241,0.3);
}
.btn-new-session:hover { background: #4f46e5; box-shadow: 0 2px 8px rgba(99,102,241,0.4); }

/* 表格卡片 */
.table-card { padding: 0; overflow: hidden; }
.desktop-table { width: 100%; border-collapse: collapse; }
.desktop-table th {
  padding: 11px 16px; text-align: left; font-size: 0.78rem;
  font-weight: 600; color: #6b7280; letter-spacing: 0.04em; text-transform: uppercase;
  border-bottom: 1px solid #f0f0f0; background: #fafafa;
}
.desktop-table td { padding: 13px 16px; border-bottom: 1px solid #f5f5f5; vertical-align: middle; }
.desktop-table tbody tr:last-child td { border-bottom: none; }
.desktop-table tbody tr:hover { background: #fafbff; }
.node-text { font-size: 0.85rem; color: #374151; font-family: monospace; }
.time-cell { font-size: 0.82rem; color: #9ca3af; white-space: nowrap; }

/* 状态徽章 */
.status-badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: .25rem .65rem; border-radius: 20px; font-size: .78rem; font-weight: 600;
}
.status-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.status-badge.running  { background: #dcfce7; color: #15803d; }
.status-badge.running .status-dot  { background: #16a34a; box-shadow: 0 0 0 2px #bbf7d0; animation: pulse-dot 2s infinite; }
.status-badge.pending  { background: #fef9c3; color: #a16207; }
.status-badge.pending .status-dot  { background: #ca8a04; }
.status-badge.failed   { background: #fee2e2; color: #b91c1c; }
.status-badge.failed .status-dot   { background: #dc2626; }
.status-badge.stopped  { background: #f1f5f9; color: #64748b; }
.status-badge.stopped .status-dot  { background: #94a3b8; }
@keyframes pulse-dot { 0%,100% { opacity:1; } 50% { opacity:0.4; } }

/* 操作按钮 */
.action-buttons { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
.btn-action {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 4px 10px; border: 1px solid transparent;
  border-radius: 6px; font-size: 0.76rem; font-weight: 500;
  cursor: pointer; white-space: nowrap; transition: all 0.15s;
}
.btn-action:hover:not(:disabled) { filter: brightness(0.92); transform: translateY(-1px); }
.btn-action:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }
.btn-start   { background: #6366f1; color: #fff; border-color: #6366f1; }
.btn-stop    { background: #f59e0b; color: #fff; border-color: #f59e0b; }
.btn-connect { background: #10b981; color: #fff; border-color: #10b981; }
.btn-script  { background: #f3f4f6; color: #374151; border-color: #e5e7eb; }
.btn-log     { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
.btn-log:hover:not(:disabled) { background: #dbeafe; filter: none; transform: translateY(-1px); }
.btn-delete  { background: transparent; color: #ef4444; border-color: rgba(239,68,68,0.3); }
.btn-delete:hover:not(:disabled) { background: #fef2f2; filter: none; transform: translateY(-1px); }
.btn-tab { padding: 4px 12px; border: 1px solid #e5e7eb; border-radius: 6px; background: #f9fafb; font-size: 0.8rem; cursor: pointer; }
.btn-tab.active { background: #2563eb; color: #fff; border-color: #2563eb; }
.log-body { max-height: 500px; overflow-y: auto; background: #0f172a; color: #e2e8f0; }

.empty-state { text-align: center; padding: 4rem 2rem; color: #999; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
.empty-illustration { margin-bottom: 0.5rem; }
.empty-title { font-size: 1rem; font-weight: 600; color: #374151; margin: 0; }
.empty-hint { font-size: .85rem; color: #9ca3af; margin: 0 0 1rem; }
.empty-icon { font-size: 4rem; margin-bottom: 1rem; }

/* ── 弹窗基础 ── */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
  animation: overlay-in 0.15s ease;
}
@keyframes overlay-in { from { opacity: 0; } to { opacity: 1; } }

.modal-content {
  background: #fff;
  border-radius: 18px;
  width: 92%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08);
  animation: modal-in 0.2s cubic-bezier(0.34,1.56,0.64,1);
}
@keyframes modal-in { from { opacity: 0; transform: scale(0.94) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }

.start-modal { max-width: 700px; }
.script-modal { max-width: 780px; }

.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 1.4rem 1.75rem 1.1rem;
  border-bottom: 1px solid #f1f5f9;
  position: sticky; top: 0; background: #fff; z-index: 1;
  border-radius: 18px 18px 0 0;
}
.modal-header h2 {
  margin: 0; font-size: 1.05rem; font-weight: 700;
  color: #0f172a; letter-spacing: -0.01em;
}
.modal-body { padding: 1.5rem 1.75rem 1.75rem; }

.btn-close {
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  background: #f1f5f9; border: none; border-radius: 8px;
  font-size: 1rem; cursor: pointer; color: #64748b;
  transition: all 0.15s; flex-shrink: 0;
}
.btn-close:hover { background: #e2e8f0; color: #0f172a; }

/* ── 表单 ── */
.form-group { margin-bottom: 1.1rem; }
.form-group label {
  display: block; margin-bottom: 6px;
  font-weight: 600; font-size: 0.82rem;
  color: #374151; letter-spacing: 0.01em;
}
.form-group input,
.form-group select,
.form-group textarea {
  width: 100%; padding: 0.6rem 0.9rem;
  border: 1.5px solid #e2e8f0; border-radius: 10px;
  font-size: 0.9rem; box-sizing: border-box;
  background: #f8fafc; color: #0f172a;
  transition: border-color 0.15s, box-shadow 0.15s;
  outline: none;
}
.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
  background: #fff;
}
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.form-actions {
  display: flex; justify-content: flex-end; gap: 0.75rem;
  padding-top: 1rem; margin-top: 0.5rem;
  border-top: 1px solid #f1f5f9;
}

/* ── 启动状态 ── */
.status-starting { text-align: center; padding: 1rem; }
.loading-icon { width: 48px; height: 48px; border: 4px solid #e5e7eb; border-top-color: #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem; }
@keyframes spin { to { transform: rotate(360deg); } }
.progress-bar-container { width: 100%; height: 20px; background: #e5e7eb; border-radius: 10px; overflow: hidden; margin: 1rem 0; }
.progress-bar-fill { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); transition: width .5s; }

/* ── 失败状态 ── */
.status-failed { text-align: center; padding: 0.5rem; }
.fail-icon {
  width: 56px; height: 56px; line-height: 56px;
  border-radius: 50%; background: #fee2e2; color: #dc2626;
  font-size: 1.5rem; font-weight: bold; margin: 0 auto 1rem;
}
.error-message {
  background: #fef2f2; color: #991b1b;
  border: 1px solid #fecaca;
  border-radius: 10px; padding: 0.75rem 1rem;
  margin-bottom: 0.75rem; font-size: 0.88rem; text-align: left;
}

/* ── 就绪状态 ── */
.status-ready { padding: 0.25rem; }
.success-icon { font-size: 2.5rem; text-align: center; margin-bottom: 0.5rem; }
.status-ready h4 { text-align: center; margin: 0 0 1.25rem; font-size: 1.1rem; font-weight: 700; color: #0f172a; }

.connection-info {
  display: flex; gap: 0; flex-wrap: wrap;
  background: #f8fafc; border: 1px solid #e2e8f0;
  border-radius: 12px; margin-bottom: 1.25rem; overflow: hidden;
}
.info-item {
  display: flex; flex-direction: column; gap: 2px;
  padding: 0.75rem 1.1rem; flex: 1;
  border-right: 1px solid #e2e8f0;
}
.info-item:last-child { border-right: none; }
.info-label { font-size: 0.7rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
.info-item code { font-size: 0.85rem; color: #0f172a; font-weight: 600; font-family: monospace; }

.btn-eye-small { padding: .15rem .5rem; background: #e5e7eb; border: none; border-radius: 4px; font-size: .8rem; cursor: pointer; }
.btn-eye-small:hover { background: #667eea; color: #fff; }

.connection-methods { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.25rem; }
.method-item {
  display: flex; flex-direction: column;
  padding: 1rem 1.1rem;
  background: #f8fafc; border-radius: 12px;
  border: 1.5px solid #e2e8f0;
  transition: border-color 0.15s;
}
.method-recommend {
  border-color: #6366f1;
  background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
}
.method-top { display: flex; align-items: center; gap: 0.9rem; width: 100%; }
.method-hint {
  margin-top: 0.75rem; padding-top: 0.75rem;
  border-top: 1px solid rgba(0,0,0,0.06);
  display: flex; flex-direction: column; gap: 4px;
  font-size: 0.76rem; color: #6b7280;
}
.recommend-tag {
  background: #6366f1; color: #fff;
  font-size: 0.68rem; padding: 1px 7px;
  border-radius: 999px; font-weight: 600;
  margin-left: 6px; vertical-align: middle;
}
.tunnel-cmd { background: #1e293b; color: #e2e8f0; padding: .75rem 1rem; border-radius: 8px; font-size: .82rem; font-family: monospace; margin: .75rem 0 .25rem; white-space: pre-wrap; word-break: break-all; }
.tunnel-hint { font-size: .78rem; color: #6b7280; margin: 0; }
.method-icon { font-size: 1.6rem; flex-shrink: 0; }
.method-content { flex: 1; min-width: 0; }
.method-content strong { display: block; margin-bottom: 3px; font-size: 0.88rem; color: #0f172a; }
.method-content p { margin: 0; font-size: 0.8rem; color: #64748b; }

.modal-actions {
  display: flex; gap: 0.75rem; justify-content: flex-end;
  padding-top: 1rem; border-top: 1px solid #f1f5f9;
}

/* ── 日志面板 ── */
.log-panel {
  margin-top: 1rem; border: 1px solid #e2e8f0;
  border-radius: 12px; overflow: hidden; text-align: left;
}
.log-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.6rem 1rem; background: #f8fafc;
  font-size: 0.82rem; font-weight: 600; color: #374151;
  border-bottom: 1px solid #e2e8f0;
}
.log-tabs { display: flex; gap: 4px; }
.log-tab {
  padding: 3px 10px; border: 1px solid #e2e8f0;
  border-radius: 6px; background: #fff;
  font-size: 0.76rem; cursor: pointer; color: #64748b;
  transition: all 0.15s;
}
.log-tab.active { background: #6366f1; color: #fff; border-color: #6366f1; }
.log-header { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; margin-bottom: 0.5rem; }
.log-header span { font-size: 0.85rem; font-weight: 600; color: #64748b; }
.btn-text { background: none; border: none; color: #6366f1; font-size: 0.8rem; cursor: pointer; padding: 4px 8px; border-radius: 4px; }
.btn-text:hover { background: #f1f5f9; }
.log-body { height: 160px; overflow-y: auto; background: #0f172a; padding: 0.75rem 1rem; font-family: monospace; font-size: 0.8rem; }
.log-empty { color: #475569; font-style: italic; }
.log-line { color: #cbd5e1; line-height: 1.6; white-space: pre-wrap; word-break: break-all; }

/* noVNC */
.vnc-overlay { position: fixed; inset: 0; background: #000; z-index: 2000; display: flex; flex-direction: column; }
.vnc-toolbar { display: flex; justify-content: space-between; align-items: center; padding: .5rem 1rem; background: #1e1e1e; color: #fff; font-size: .9rem; flex-shrink: 0; }
.vnc-canvas-wrap { flex: 1; overflow: hidden; background: #000; }

/* 悬浮启动进度条 */
.launch-float {
  position: fixed; bottom: 24px; right: 24px; z-index: 3000;
  width: 380px; background: #1e293b; border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4); overflow: hidden;
  transition: all 0.2s;
}
.launch-float.minimized { width: 280px; }
.launch-float-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px; cursor: pointer; user-select: none;
  background: linear-gradient(135deg, #667eea, #764ba2);
}
.launch-float-title { display: flex; align-items: center; gap: 8px; color: #fff; font-size: 0.85rem; font-weight: 600; }
.launch-jobid { font-size: 0.75rem; opacity: 0.75; font-weight: 400; }
.launch-float-actions { display: flex; gap: 4px; }
.launch-icon-btn { background: rgba(255,255,255,0.15); border: none; color: #fff; width: 22px; height: 22px; border-radius: 4px; cursor: pointer; font-size: 0.7rem; display: flex; align-items: center; justify-content: center; }
.launch-icon-btn:hover { background: rgba(255,255,255,0.3); }
.launch-float-body { padding: 12px 14px; }
.launch-progress { height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-bottom: 10px; overflow: hidden; }
.launch-progress-fill { height: 100%; background: linear-gradient(90deg, #667eea, #a78bfa); border-radius: 2px; transition: width 0.5s; }
.launch-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; flex-shrink: 0; }
@keyframes spin { to { transform: rotate(360deg); } }
.vnc-canvas-wrap :deep(canvas) { width: 100% !important; height: 100% !important; }

/* ── 会话列表 ── */
.session-name { font-weight: 600; font-size: 0.9rem; color: #0f172a; }
.session-sub { font-size: 0.76rem; color: #6b7280; margin-top: 2px; font-family: monospace; }
.mode-badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 0.73rem; font-weight: 600; }
.mode-badge.desktop { background: #ede9fe; color: #5b21b6; }
.mode-badge.app     { background: #dbeafe; color: #1e40af; }

/* ── 脚本弹框 ── */
.script-actions { margin-bottom: 0.75rem; }
.script-body {
  background: #0f172a; color: #e2e8f0;
  padding: 1.1rem 1.25rem; border-radius: 12px;
  font-size: 0.8rem; font-family: 'Fira Code', 'Cascadia Code', monospace;
  overflow-x: auto; max-height: 420px; overflow-y: auto;
  white-space: pre; margin: 0; line-height: 1.6;
  border: 1px solid rgba(255,255,255,0.06);
}

/* ── 通用按钮 ── */
.btn-secondary {
  background: #f8fafc; color: #374151;
  border: 1.5px solid #e2e8f0; padding: 8px 18px;
  border-radius: 10px; cursor: pointer;
  font-weight: 500; font-size: 0.85rem;
  transition: all 0.15s;
}
.btn-secondary:hover { background: #f1f5f9; border-color: #cbd5e1; }

.btn-danger {
  background: #fff; color: #ef4444;
  border: 1.5px solid rgba(239,68,68,0.35); padding: 8px 18px;
  border-radius: 10px; cursor: pointer;
  font-weight: 600; font-size: 0.85rem;
  transition: all 0.15s;
}
.btn-danger:hover { background: #fef2f2; border-color: #ef4444; }

/* ── 模式选择卡片 ── */
.mode-selector { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.mode-card {
  border: 2px solid #e2e8f0; border-radius: 14px;
  padding: 1.1rem 1rem; cursor: pointer; text-align: center;
  transition: all 0.15s; background: #f8fafc;
}
.mode-card:hover { border-color: #a5b4fc; background: #f5f3ff; transform: translateY(-1px); }
.mode-card.active {
  border-color: #6366f1; background: #ede9fe;
  box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
}
.mode-icon { font-size: 2rem; margin-bottom: 0.5rem; }
.mode-label { font-weight: 700; font-size: 0.92rem; margin-bottom: 0.3rem; color: #0f172a; }
.mode-desc { font-size: 0.75rem; color: #64748b; line-height: 1.4; }

/* ── 桌面环境选择 ── */
.desktop-env-selector { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.env-option {
  display: flex; align-items: center; gap: 0.4rem;
  cursor: pointer; padding: 0.5rem 1rem;
  border: 2px solid #e2e8f0; border-radius: 10px;
  font-size: 0.88rem; transition: all 0.15s;
  background: #f8fafc;
}
.env-option:has(input:checked) { border-color: #6366f1; background: #ede9fe; color: #4338ca; font-weight: 600; }
.env-option input { accent-color: #6366f1; }

/* ── 应用网格 ── */
.app-label-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
.btn-manage-apps {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 500;
  background: hsl(var(--muted)); border: 1px solid hsl(var(--border));
  color: hsl(var(--muted-foreground)); cursor: pointer; transition: all 0.15s;
}
.btn-manage-apps:hover { background: hsl(var(--accent)); color: hsl(var(--foreground)); }
.app-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 0.6rem; margin-bottom: 0.75rem; }
.app-card {
  border: 2px solid hsl(var(--border)); border-radius: 12px;
  padding: 0.65rem 0.4rem; cursor: pointer; text-align: center;
  transition: all 0.15s; background: hsl(var(--muted));
}
.app-card:hover { border-color: #a5b4fc; background: hsl(var(--accent)); transform: translateY(-1px); }
.app-card.active { border-color: #6366f1; background: hsl(var(--accent)); box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
.app-icon { font-size: 1.6rem; margin-bottom: 0.25rem; }
.app-name { font-size: 0.7rem; font-weight: 600; color: hsl(var(--foreground)); }
.app-desc { font-size: 0.65rem; color: hsl(var(--muted-foreground)); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.custom-app-row { margin-top: 0.25rem; }
.custom-app-input {
  width: 100%; padding: 0.6rem 0.9rem;
  border: 1.5px solid hsl(var(--border)); border-radius: 10px;
  font-size: 0.9rem; box-sizing: border-box;
  background: hsl(var(--background)); color: hsl(var(--foreground)); outline: none; transition: all 0.15s;
}
.custom-app-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
.modules-row { margin-top: 0.75rem; display: flex; flex-direction: column; gap: 0.35rem; }
.modules-row label { font-size: 0.8rem; font-weight: 500; color: hsl(var(--foreground)); }
.modules-hint { font-size: 0.72rem; color: hsl(var(--muted-foreground)); }
.modules-hint code { background: hsl(var(--muted)); padding: 1px 5px; border-radius: 3px; font-size: 0.7rem; }
.apps-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-bottom: 1.5rem; }
.apps-table th { background: hsl(var(--muted)); padding: 0.5rem 0.75rem; text-align: left; font-size: 0.75rem; font-weight: 600; color: hsl(var(--muted-foreground)); border-bottom: 1px solid hsl(var(--border)); }
.apps-table td { padding: 0.5rem 0.75rem; border-bottom: 1px solid hsl(var(--border)); color: hsl(var(--foreground)); }
.add-app-form { border-top: 1px solid hsl(var(--border)); padding-top: 1rem; }
.add-app-form h4 { font-size: 0.88rem; font-weight: 600; color: hsl(var(--foreground)); margin: 0 0 0.75rem; }

/* ── Xpra iframe ── */
.xpra-frame { flex: 1; width: 100%; height: 100%; border: none; background: #000; }
.xpra-viewer-fill { flex: 1; min-height: 0; width: 100%; }

/* 客户端连接最小化悬浮条 */
.client-float-bar {
  position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 12px;
  background: #1e293b; color: #fff;
  padding: 8px 20px; border-radius: 12px 12px 0 0;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
  z-index: 3000; font-size: 0.85rem;
}
.client-float-icon { font-size: 1.1rem; }
.client-float-name { font-weight: 600; }
.client-float-status { color: #10b981; font-size: 0.78rem; }
.client-float-btn {
  padding: 4px 12px; border-radius: 6px; border: none; cursor: pointer;
  font-size: 0.78rem; font-weight: 600; background: rgba(255,255,255,0.15); color: #fff;
}
.client-float-btn:hover { background: rgba(255,255,255,0.25); }
.client-float-stop { background: rgba(239,68,68,0.3); }
.client-float-stop:hover { background: rgba(239,68,68,0.5); }
.client-float-disconnected { background: #7f1d1d; animation: pulse-red 2s infinite; }
@keyframes pulse-red { 0%,100% { box-shadow: 0 -4px 20px rgba(239,68,68,0.3); } 50% { box-shadow: 0 -4px 20px rgba(239,68,68,0.7); } }
</style>

