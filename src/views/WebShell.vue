<template>
  <div class="webshell-container">
    <div class="page-header">
      <h3>🖥️ Web Shell</h3>
      <div class="header-actions">
        <button class="btn-secondary" @click="showSettings = true">⚙️ 终端设置</button>
        <button class="btn-primary" @click="showKeyUpload = true">🔑 上传密钥</button>
      </div>
    </div>

    <!-- 认证方式选择 -->
    <div v-if="showAuthSelector" class="modal-overlay" @click="showAuthSelector = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h4>选择认证方式</h4>
          <button class="close-btn" @click="showAuthSelector = false">×</button>
        </div>
        <div class="modal-body">
          <div class="user-info">
            <span class="info-label">连接用户:</span>
            <span class="info-value">{{ currentUsername }}</span>
          </div>
          <div class="user-info">
            <span class="info-label">目标节点:</span>
            <span class="info-value">{{ selectedNode?.name }} ({{ selectedNode?.host }})</span>
          </div>
          
          <div class="auth-options">
            <div class="auth-option" @click="usePrivateKey">
              <div class="auth-icon">🔑</div>
              <h5>使用私钥</h5>
              <p>使用已上传的SSH私钥认证</p>
              <span v-if="hasPrivateKey" class="auth-status success">✓ 已上传私钥</span>
              <span v-else class="auth-status warning">⚠ 未上传私钥</span>
            </div>
            
            <div class="auth-option" @click="usePassword">
              <div class="auth-icon">🔐</div>
              <h5>使用密码</h5>
              <p>输入SSH密码进行认证</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 密码输入 -->
    <div v-if="showPasswordInput" class="modal-overlay" @click="showPasswordInput = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h4>输入SSH密码</h4>
          <button class="close-btn" @click="showPasswordInput = false">×</button>
        </div>
        <div class="modal-body">
          <div class="user-info">
            <span class="info-label">用户名:</span>
            <span class="info-value">{{ currentUsername }}</span>
          </div>
          <div class="user-info">
            <span class="info-label">节点:</span>
            <span class="info-value">{{ selectedNode?.name }}</span>
          </div>
          
          <div class="password-input-group">
            <label>SSH密码</label>
            <input 
              type="password" 
              v-model="sshPassword" 
              @keyup.enter="connectWithPassword"
              placeholder="输入SSH密码"
              class="password-input"
              ref="passwordInput"
            />
            <p class="input-hint">密码不会被保存，仅用于本次连接</p>
          </div>
          
          <div class="modal-actions">
            <button class="btn-secondary" @click="showPasswordInput = false">取消</button>
            <button class="btn-primary" @click="connectWithPassword" :disabled="!sshPassword">
              连接
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 密钥上传 -->
    <div v-if="showKeyUpload" class="modal-overlay" @click="showKeyUpload = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h4>上传SSH私钥</h4>
          <button class="close-btn" @click="showKeyUpload = false">×</button>
        </div>
        <div class="modal-body">
          <div class="upload-area">
            <input 
              type="file" 
              ref="keyFileInput" 
              @change="handleKeyUpload"
              accept=".pem,.key,*"
              style="display: none"
            />
            <div class="upload-zone" @click="($refs.keyFileInput as HTMLInputElement).click()">
              <div class="upload-icon">📁</div>
              <p>点击选择SSH私钥文件</p>
              <p class="upload-hint">支持 .pem, .key 等格式</p>
            </div>
          </div>
          <div class="upload-info">
            <h5>注意事项：</h5>
            <ul>
              <li>请确保私钥文件格式正确</li>
              <li>私钥将安全存储在服务器上</li>
              <li>建议使用专门的SSH密钥对</li>
              <li>上传后可以连接到配置的节点</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- 终端设置 -->
    <div v-if="showSettings" class="modal-overlay" @click="showSettings = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h4>终端设置</h4>
          <button class="close-btn" @click="showSettings = false">×</button>
        </div>
        <div class="modal-body settings-body">
          <!-- 字体大小 -->
          <div class="setting-group">
            <label class="setting-label">字体大小</label>
            <div class="setting-control">
              <input 
                type="range" 
                v-model.number="terminalSettings.fontSize" 
                min="10" 
                max="24" 
                step="1"
                @input="applyTerminalSettings"
                class="slider"
              />
              <span class="setting-value">{{ terminalSettings.fontSize }}px</span>
            </div>
          </div>

          <!-- 配色方案 -->
          <div class="setting-group">
            <label class="setting-label">配色方案</label>
            <div class="theme-grid">
              <div 
                v-for="theme in themes" 
                :key="theme.name"
                class="theme-card"
                :class="{ active: terminalSettings.theme === theme.name }"
                @click="selectTheme(theme.name)"
              >
                <div class="theme-preview" :style="{ background: theme.background }">
                  <span :style="{ color: theme.foreground }">{{ theme.name }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 光标样式 -->
          <div class="setting-group">
            <label class="setting-label">光标样式</label>
            <div class="cursor-options">
              <button 
                v-for="cursor in cursorStyles" 
                :key="cursor"
                class="cursor-btn"
                :class="{ active: terminalSettings.cursorStyle === cursor }"
                @click="selectCursorStyle(cursor)"
              >
                {{ cursor }}
              </button>
            </div>
          </div>

          <!-- 光标闪烁 -->
          <div class="setting-group">
            <label class="setting-label">
              <input 
                type="checkbox" 
                v-model="terminalSettings.cursorBlink"
                @change="applyTerminalSettings"
              />
              光标闪烁
            </label>
          </div>

          <div class="modal-actions">
            <button class="btn-secondary" @click="resetSettings">恢复默认</button>
            <button class="btn-primary" @click="showSettings = false">确定</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 主工作区：左侧主机列表 + 右侧终端 -->
    <div class="main-workspace">
      <!-- 左侧主机列表 -->
      <div class="hosts-sidebar" :class="{ collapsed: sidebarCollapsed }">
        <div class="sidebar-header">
          <h4 v-if="!sidebarCollapsed">主机列表</h4>
          <div class="sidebar-controls">
            <button class="btn-icon" @click="loadNodes" title="刷新" v-if="!sidebarCollapsed">🔄</button>
            <button class="btn-icon" @click="sidebarCollapsed = !sidebarCollapsed" :title="sidebarCollapsed ? '展开' : '折叠'">
              {{ sidebarCollapsed ? '▶' : '◀' }}
            </button>
          </div>
        </div>
        <div class="hosts-list" v-if="!sidebarCollapsed">
          <div v-if="loading" class="loading-small">加载中...</div>
          <div v-else-if="nodes.length === 0" class="empty-state">
            <p>暂无可用主机</p>
          </div>
          <div 
            v-else
            v-for="node in nodes" 
            :key="node.name"
            class="host-item"
            :class="{ 
              active: currentNode?.name === node.name,
              disabled: !node.enabled 
            }"
            @click="node.enabled && selectNode(node)"
          >
            <div class="host-icon">🖥️</div>
            <div class="host-info">
              <div class="host-name">{{ node.name }}</div>
              <div class="host-address">{{ node.host }}</div>
            </div>
            <div class="host-status" :class="{ connected: currentNode?.name === node.name && connected }">
              <span v-if="currentNode?.name === node.name && connected">●</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧终端区域 -->
      <div class="terminal-area" :class="{ fullscreen: isFullscreen }">
        <div v-if="connected" class="terminal-container">
          <div class="terminal-header">
            <div class="terminal-info">
              <span class="terminal-title">{{ currentNode?.name }} - {{ currentNode?.host }}</span>
              <span class="connection-status" :class="connectionStatus">{{ connectionStatus }}</span>
            </div>
            <div class="terminal-actions">
              <button class="btn-small btn-secondary" @click="toggleFullscreen" :title="isFullscreen ? '退出全屏' : '全屏'">
                {{ isFullscreen ? '🗗' : '🗖' }}
              </button>
              <button class="btn-small btn-secondary" @click="clearTerminal">清屏</button>
              <button class="btn-small btn-danger" @click="disconnect">断开连接</button>
            </div>
          </div>
          <div class="terminal-content">
            <div ref="terminalContainer" class="xterm-container"></div>
          </div>
        </div>

        <!-- 未连接时的提示 -->
        <div v-else class="connection-prompt">
          <div class="prompt-content">
            <div class="prompt-icon">🖥️</div>
            <h3>Web Shell</h3>
            <p>从左侧选择一个主机开始SSH连接</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'
import notification from '../utils/notification'

// 响应式数据
const showNodeSelector = ref(false)
const showAuthSelector = ref(false)
const showPasswordInput = ref(false)
const showSessions = ref(false)
const showLogs = ref(false)
const showKeyUpload = ref(false)
const showSettings = ref(false)
const loading = ref(false)
const error = ref('')
const connected = ref(false)
const connectionStatus = ref('disconnected')
const sidebarCollapsed = ref(false)
const isFullscreen = ref(false)

const nodes = ref<any[]>([])
const selectedNode = ref<any>(null)
const currentNode = ref<any>(null)
const currentUsername = ref('')
const hasPrivateKey = ref(false)
const sshPassword = ref('')

// 终端设置
const terminalSettings = ref({
  fontSize: 14,
  theme: 'dark',
  cursorStyle: 'block',
  cursorBlink: true
})

// 配色方案
const themes = [
  {
    name: 'dark',
    background: '#1e1e1e',
    foreground: '#ffffff',
    cursor: '#ffffff',
    black: '#000000',
    red: '#e06c75',
    green: '#98c379',
    yellow: '#d19a66',
    blue: '#61afef',
    magenta: '#c678dd',
    cyan: '#56b6c2',
    white: '#abb2bf',
    brightBlack: '#5c6370',
    brightRed: '#e06c75',
    brightGreen: '#98c379',
    brightYellow: '#d19a66',
    brightBlue: '#61afef',
    brightMagenta: '#c678dd',
    brightCyan: '#56b6c2',
    brightWhite: '#ffffff'
  },
  {
    name: 'light',
    background: '#ffffff',
    foreground: '#000000',
    cursor: '#000000',
    black: '#000000',
    red: '#cd3131',
    green: '#00bc00',
    yellow: '#949800',
    blue: '#0451a5',
    magenta: '#bc05bc',
    cyan: '#0598bc',
    white: '#555555',
    brightBlack: '#666666',
    brightRed: '#cd3131',
    brightGreen: '#14ce14',
    brightYellow: '#b5ba00',
    brightBlue: '#0451a5',
    brightMagenta: '#bc05bc',
    brightCyan: '#0598bc',
    brightWhite: '#a5a5a5'
  },
  {
    name: 'monokai',
    background: '#272822',
    foreground: '#f8f8f2',
    cursor: '#f8f8f0',
    black: '#272822',
    red: '#f92672',
    green: '#a6e22e',
    yellow: '#f4bf75',
    blue: '#66d9ef',
    magenta: '#ae81ff',
    cyan: '#a1efe4',
    white: '#f8f8f2',
    brightBlack: '#75715e',
    brightRed: '#f92672',
    brightGreen: '#a6e22e',
    brightYellow: '#f4bf75',
    brightBlue: '#66d9ef',
    brightMagenta: '#ae81ff',
    brightCyan: '#a1efe4',
    brightWhite: '#f9f8f5'
  },
  {
    name: 'solarized-dark',
    background: '#002b36',
    foreground: '#839496',
    cursor: '#839496',
    black: '#073642',
    red: '#dc322f',
    green: '#859900',
    yellow: '#b58900',
    blue: '#268bd2',
    magenta: '#d33682',
    cyan: '#2aa198',
    white: '#eee8d5',
    brightBlack: '#002b36',
    brightRed: '#cb4b16',
    brightGreen: '#586e75',
    brightYellow: '#657b83',
    brightBlue: '#839496',
    brightMagenta: '#6c71c4',
    brightCyan: '#93a1a1',
    brightWhite: '#fdf6e3'
  },
  {
    name: 'dracula',
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    black: '#21222c',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#f8f8f2',
    brightBlack: '#6272a4',
    brightRed: '#ff6e6e',
    brightGreen: '#69ff94',
    brightYellow: '#ffffa5',
    brightBlue: '#d6acff',
    brightMagenta: '#ff92df',
    brightCyan: '#a4ffff',
    brightWhite: '#ffffff'
  },
  {
    name: 'nord',
    background: '#2e3440',
    foreground: '#d8dee9',
    cursor: '#d8dee9',
    black: '#3b4252',
    red: '#bf616a',
    green: '#a3be8c',
    yellow: '#ebcb8b',
    blue: '#81a1c1',
    magenta: '#b48ead',
    cyan: '#88c0d0',
    white: '#e5e9f0',
    brightBlack: '#4c566a',
    brightRed: '#bf616a',
    brightGreen: '#a3be8c',
    brightYellow: '#ebcb8b',
    brightBlue: '#81a1c1',
    brightMagenta: '#b48ead',
    brightCyan: '#8fbcbb',
    brightWhite: '#eceff4'
  }
]

const cursorStyles = ['block', 'underline', 'bar']

// 终端相关
const terminalContainer = ref<HTMLElement>()
const passwordInput = ref<HTMLInputElement>()
let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let websocket: WebSocket | null = null

// 初始化
onMounted(async () => {
  console.log('WebShell component mounted, initializing...')
  
  // 加载保存的设置
  loadSettings()
  
  await loadCurrentUser()
  console.log('Current username after mount:', currentUsername.value)
  await loadNodes()
  await checkPrivateKey()
})

// 清理
onBeforeUnmount(() => {
  if (terminal) {
    terminal.dispose()
  }
  if (websocket) {
    websocket.close()
  }
})

// 加载设置
const loadSettings = () => {
  const saved = localStorage.getItem('terminal-settings')
  if (saved) {
    try {
      const settings = JSON.parse(saved)
      terminalSettings.value = { ...terminalSettings.value, ...settings }
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
  }
}

// 保存设置
const saveSettings = () => {
  localStorage.setItem('terminal-settings', JSON.stringify(terminalSettings.value))
}

// 选择主题
const selectTheme = (themeName: string) => {
  terminalSettings.value.theme = themeName
  applyTerminalSettings()
}

// 选择光标样式
const selectCursorStyle = (style: string) => {
  terminalSettings.value.cursorStyle = style
  applyTerminalSettings()
}

// 应用终端设置
const applyTerminalSettings = () => {
  if (!terminal) return
  
  const theme = themes.find(t => t.name === terminalSettings.value.theme)
  if (theme) {
    terminal.options.theme = {
      background: theme.background,
      foreground: theme.foreground,
      cursor: theme.cursor,
      selectionBackground: 'rgba(255, 255, 255, 0.3)',
      black: theme.black,
      red: theme.red,
      green: theme.green,
      yellow: theme.yellow,
      blue: theme.blue,
      magenta: theme.magenta,
      cyan: theme.cyan,
      white: theme.white,
      brightBlack: theme.brightBlack,
      brightRed: theme.brightRed,
      brightGreen: theme.brightGreen,
      brightYellow: theme.brightYellow,
      brightBlue: theme.brightBlue,
      brightMagenta: theme.brightMagenta,
      brightCyan: theme.brightCyan,
      brightWhite: theme.brightWhite
    }
  }
  
  terminal.options.fontSize = terminalSettings.value.fontSize
  terminal.options.cursorStyle = terminalSettings.value.cursorStyle as any
  terminal.options.cursorBlink = terminalSettings.value.cursorBlink
  
  // 重新适配大小
  if (fitAddon) {
    fitAddon.fit()
  }
  
  // 保存设置
  saveSettings()
}

// 重置设置
const resetSettings = () => {
  terminalSettings.value = {
    fontSize: 14,
    theme: 'dark',
    cursorStyle: 'block',
    cursorBlink: true
  }
  applyTerminalSettings()
}

// 加载当前用户信息
const loadCurrentUser = async () => {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    console.log('Loading current user, token:', token ? 'exists' : 'missing')
    
    if (!token) {
      console.warn('No token found, user not logged in')
      currentUsername.value = 'unknown'
      notification.warning('请先登录系统')
      return
    }
    
    const response = await fetch('http://localhost:8080/api/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    console.log('Response status:', response.status)
    
    if (response.ok) {
      const result = await response.json()
      console.log('User data received:', result)
      
      // 后端返回格式: {"data": {"username": "sunfx", "uid": 1001, ...}}
      if (result.data) {
        // 优先使用 username 字段（小写）
        if (result.data.username) {
          currentUsername.value = result.data.username
          console.log('Current username set to:', currentUsername.value)
        } 
        // 兼容大写的 Username 字段
        else if (result.data.Username) {
          currentUsername.value = result.data.Username
          console.log('Current username set to (from Username):', currentUsername.value)
        } else {
          console.warn('Username not found in response:', result)
          currentUsername.value = 'unknown'
        }
      } else {
        console.warn('Data field not found in response:', result)
        currentUsername.value = 'unknown'
      }
    } else {
      console.error('Failed to load user, status:', response.status)
      const errorText = await response.text()
      console.error('Error response:', errorText)
      
      if (response.status === 401) {
        notification.error('登录已过期，请重新登录')
        currentUsername.value = 'unknown'
      } else {
        currentUsername.value = 'unknown'
      }
    }
  } catch (err) {
    console.error('Failed to load user info:', err)
    currentUsername.value = 'unknown'
  }
}

// 检查是否已上传私钥
const checkPrivateKey = async () => {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) {
      hasPrivateKey.value = false
      return
    }
    
    const response = await fetch('http://localhost:8080/api/webshell/keys/check', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      hasPrivateKey.value = data.has_key || false
    }
  } catch (err) {
    hasPrivateKey.value = false
  }
}

// 加载节点列表
const loadNodes = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) {
      throw new Error('请先登录系统')
    }
    
    const response = await fetch('http://localhost:8080/api/webshell/nodes', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (!response.ok) {
      throw new Error('Failed to load nodes')
    }
    
    const data = await response.json()
    nodes.value = data.data || []
  } catch (err: any) {
    error.value = err.message
    notification.error('加载节点列表失败: ' + err.message)
  } finally {
    loading.value = false
  }
}

// 选择节点
const selectNode = async (node: any) => {
  selectedNode.value = node
  
  // 确保用户信息已加载
  if (!currentUsername.value || currentUsername.value === 'unknown') {
    console.log('Username not loaded, loading now...')
    await loadCurrentUser()
    console.log('Username after loading:', currentUsername.value)
  } else {
    console.log('Username already loaded:', currentUsername.value)
  }
  
  // 显示认证方式选择对话框
  showAuthSelector.value = true
}

// 使用私钥认证
const usePrivateKey = () => {
  if (!hasPrivateKey.value) {
    notification.error('请先上传SSH私钥')
    showAuthSelector.value = false
    showKeyUpload.value = true
    return
  }
  
  showAuthSelector.value = false
  connectToNode(selectedNode.value, '')
}

// 使用密码认证
const usePassword = () => {
  showAuthSelector.value = false
  showPasswordInput.value = true
  sshPassword.value = ''
  
  // 聚焦到密码输入框
  nextTick(() => {
    passwordInput.value?.focus()
  })
}

// 使用密码连接
const connectWithPassword = () => {
  if (!sshPassword.value) {
    notification.error('请输入密码')
    return
  }
  
  showPasswordInput.value = false
  connectToNode(selectedNode.value, sshPassword.value)
  sshPassword.value = '' // 清空密码
}
// 连接到节点
const connectToNode = async (node: any, password: string = '') => {
  // 确保用户信息已加载
  if (!currentUsername.value || currentUsername.value === 'unknown') {
    await loadCurrentUser()
  }
  
  currentNode.value = node
  connectionStatus.value = 'connecting'
  
  try {
    // 建立WebSocket连接
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) {
      notification.error('请先登录系统')
      return
    }
    
    let wsUrl = `ws://localhost:8080/api/webshell/connect?node=${node.name}&token=${encodeURIComponent(token)}`
    
    // 如果提供了密码，添加到URL参数中
    if (password) {
      wsUrl += `&password=${encodeURIComponent(password)}`
    }
    
    console.log('Connecting to WebSocket with username:', currentUsername.value)
    
    websocket = new WebSocket(wsUrl)
    
    websocket.onopen = () => {
      connectionStatus.value = 'connected'
      connected.value = true
      // 取消登录提示
      // notification.success(`已连接到 ${node.name}`)
      
      // 初始化终端
      nextTick(() => {
        initTerminal()
      })
    }
    
    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data)
      handleWebSocketMessage(message)
    }
    
    websocket.onclose = () => {
      connectionStatus.value = 'disconnected'
      connected.value = false
      isFullscreen.value = false
      sidebarCollapsed.value = false
      if (terminal) {
        terminal.dispose()
        terminal = null
      }
      window.removeEventListener('resize', handleResize)
    }
    
    websocket.onerror = (error) => {
      connectionStatus.value = 'error'
      notification.error('连接错误')
      console.error('WebSocket error:', error)
    }
    
  } catch (err: any) {
    connectionStatus.value = 'error'
    notification.error('连接失败: ' + err.message)
  }
}

// 初始化终端
const initTerminal = () => {
  if (!terminalContainer.value) return
  
  // 获取当前主题
  const theme = themes.find(t => t.name === terminalSettings.value.theme) || themes[0]
  
  // 创建终端实例
  terminal = new Terminal({
    cursorBlink: terminalSettings.value.cursorBlink,
    cursorStyle: terminalSettings.value.cursorStyle as any,
    fontSize: terminalSettings.value.fontSize,
    fontFamily: 'Consolas, "Courier New", monospace',
    theme: {
      background: theme.background,
      foreground: theme.foreground,
      cursor: theme.cursor,
      selectionBackground: 'rgba(255, 255, 255, 0.3)',
      black: theme.black,
      red: theme.red,
      green: theme.green,
      yellow: theme.yellow,
      blue: theme.blue,
      magenta: theme.magenta,
      cyan: theme.cyan,
      white: theme.white,
      brightBlack: theme.brightBlack,
      brightRed: theme.brightRed,
      brightGreen: theme.brightGreen,
      brightYellow: theme.brightYellow,
      brightBlue: theme.brightBlue,
      brightMagenta: theme.brightMagenta,
      brightCyan: theme.brightCyan,
      brightWhite: theme.brightWhite
    },
    allowProposedApi: true
  })
  
  // 添加插件
  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.loadAddon(new WebLinksAddon())
  
  // 挂载到容器
  terminal.open(terminalContainer.value)
  
  // 自适应大小
  fitAddon.fit()
  
  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)
  
  // 监听终端输入
  terminal.onData((data) => {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({
        type: 'input',
        data: data
      }))
    }
  })
  
  // 发送终端大小
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    websocket.send(JSON.stringify({
      type: 'resize',
      data: {
        rows: terminal.rows,
        cols: terminal.cols
      }
    }))
  }
}

// 处理窗口大小变化
const handleResize = () => {
  if (fitAddon && terminal) {
    fitAddon.fit()
    
    // 通知服务器终端大小变化
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({
        type: 'resize',
        data: {
          rows: terminal.rows,
          cols: terminal.cols
        }
      }))
    }
  }
}

// 处理WebSocket消息
const handleWebSocketMessage = (message: any) => {
  console.log('WebSocket message received:', message)
  
  switch (message.type) {
    case 'output':
      // 将输出写入终端
      if (terminal && message.data) {
        terminal.write(message.data)
      }
      break
      
    case 'connected':
      connectionStatus.value = 'connected'
      connected.value = true
      
      // 如果服务器返回了用户名，使用服务器返回的用户名
      if (message.data && message.data.username) {
        currentUsername.value = message.data.username
        console.log('Username updated from server:', currentUsername.value)
      }
      
      if (message.data && message.data.auth_method) {
        // 取消认证方式提示
        // const authMethod = message.data.auth_method === 'private_key' ? '私钥' : '密码'
        // notification.success(`已连接 (认证方式: ${authMethod})`)
      }
      break
      
    case 'auth_required':
      notification.warning('需要密码认证，请输入SSH密码')
      showPasswordInput.value = true
      nextTick(() => { passwordInput.value?.focus() })
      break
      
    case 'error':
      notification.error(message.data)
      connectionStatus.value = 'error'
      break
  }
}

// 清屏
const clearTerminal = () => {
  if (terminal) {
    terminal.clear()
  }
}

// 断开连接
const disconnect = () => {
  if (websocket) {
    websocket.close()
    websocket = null
  }
  
  if (terminal) {
    terminal.dispose()
    terminal = null
  }
  
  window.removeEventListener('resize', handleResize)
  
  connected.value = false
  connectionStatus.value = 'disconnected'
  currentNode.value = null
  isFullscreen.value = false        // 退出全屏，避免断开后页面空白
  sidebarCollapsed.value = false    // 恢复侧边栏
}

// 切换全屏
const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
  
  // 全屏时自动折叠侧边栏
  if (isFullscreen.value) {
    sidebarCollapsed.value = true
  }
  
  // 延迟调整终端大小以适应新布局
  setTimeout(() => {
    if (fitAddon && terminal) {
      fitAddon.fit()
      
      // 通知服务器终端大小变化
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
          type: 'resize',
          data: {
            rows: terminal.rows,
            cols: terminal.cols
          }
        }))
      }
    }
  }, 100)
}

// 测试连接
const testConnection = async (node: any) => {
  try {
    const response = await fetch(`/api/webshell/nodes/${node.name}/test`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    })
    
    const data = await response.json()
    
    if (data.success) {
      notification.success(`${node.name} 连接测试成功`)
    } else {
      notification.error(`${node.name} 连接测试失败: ${data.error}`)
    }
  } catch (err: any) {
    notification.error(`连接测试失败: ${err.message}`)
  }
}

// 处理密钥上传
const handleKeyUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (!file) return
  
  const formData = new FormData()
  formData.append('private_key', file)
  
  try {
    const response = await fetch('/api/webshell/keys/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}`
      },
      body: formData
    })
    
    if (response.ok) {
      notification.success('SSH私钥上传成功')
      showKeyUpload.value = false
      hasPrivateKey.value = true
    } else {
      const data = await response.json()
      notification.error('上传失败: ' + data.error)
    }
  } catch (err: any) {
    notification.error('上传失败: ' + err.message)
  }
}
</script>

<style scoped>
.webshell-container {
  padding: 1.25rem 1.5rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-sizing: border-box;
  overflow: hidden;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.page-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #374151;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.main-workspace {
  flex: 1;
  display: flex;
  gap: 0.75rem;
  overflow: hidden;
  min-height: 0;
  overflow: hidden;
}

.hosts-sidebar {
  width: 200px;
  min-width: 200px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: all 0.25s ease;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.hosts-sidebar.collapsed {
  width: 48px;
  min-width: 48px;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid #f3f4f6;
  background: #fafafa;
  border-radius: 12px 12px 0 0;
}

.sidebar-header h4 {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
}

.sidebar-controls {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0.25rem 0.4rem;
  border-radius: 6px;
  transition: background 0.15s;
  color: #6b7280;
}

.btn-icon:hover {
  background: #f3f4f6;
  color: #374151;
}

.hosts-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.host-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.75rem;
  margin-bottom: 0.2rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid transparent;
}

.host-item:hover:not(.disabled) {
  background: #f0f4ff;
  border-color: #c7d2fe;
}

.host-item.active {
  background: #eef2ff;
  border-color: #818cf8;
}

.host-item.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.host-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
}

.host-info {
  flex: 1;
  min-width: 0;
}

.host-name {
  font-weight: 600;
  color: #1f2937;
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.host-address {
  font-size: 0.72rem;
  color: #9ca3af;
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.host-status {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.host-status.connected {
  background: #10b981;
  box-shadow: 0 0 0 2px rgba(16,185,129,0.2);
}

.host-status.connected span { display: none; }

.terminal-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: all 0.3s ease;
}

.terminal-area.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  background: #1e1e1e;
}

.terminal-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
  border-radius: 8px;
  overflow: hidden;
}

.terminal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #2d2d2d;
  border-bottom: 1px solid #404040;
}

.terminal-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.terminal-title {
  font-weight: 600;
  color: #ffffff;
}

.connection-status {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.connection-status.connected {
  background: #d1fae5;
  color: #065f46;
}

.connection-status.connecting {
  background: #fef3c7;
  color: #92400e;
}

.connection-status.disconnected,
.connection-status.error {
  background: #fee2e2;
  color: #991b1b;
}

.terminal-actions {
  display: flex;
  gap: 0.5rem;
}

.terminal-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.xterm-container {
  flex: 1;
  padding: 0.5rem;
}

.connection-prompt {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 12px;
  border: 2px dashed #e5e7eb;
}

.prompt-content {
  text-align: center;
  padding: 2rem;
}

.prompt-icon {
  font-size: 3.5rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.prompt-content h3 {
  margin: 0 0 0.5rem 0;
  color: #374151;
  font-size: 1.1rem;
}

.prompt-content p {
  margin: 0;
  color: #9ca3af;
  font-size: 0.9rem;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h4 {
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6b7280;
}

.close-btn:hover {
  color: #374151;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
}

.nodes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.node-card {
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.node-card:hover:not(.disabled) {
  border-color: #667eea;
  transform: translateY(-2px);
}

.node-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.node-header h5 {
  margin: 0;
}

.node-status.enabled {
  background: #d1fae5;
  color: #065f46;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
}

.node-status.disabled {
  background: #fee2e2;
  color: #991b1b;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
}

.node-details p {
  margin: 0.25rem 0;
  color: #6b7280;
}

.node-address {
  font-family: monospace;
  font-size: 0.9rem;
}

.node-actions {
  margin-top: 1rem;
}

.upload-area {
  margin-bottom: 1.5rem;
}

.upload-zone {
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s;
}

.upload-zone:hover {
  border-color: #667eea;
}

.upload-icon {
  font-size: 2rem;
  margin-bottom: 1rem;
}

.upload-hint {
  color: #6b7280;
  font-size: 0.9rem;
}

.upload-info {
  background: #f9fafb;
  padding: 1rem;
  border-radius: 8px;
}

.upload-info h5 {
  margin: 0 0 0.5rem 0;
}

.upload-info ul {
  margin: 0;
  padding-left: 1.5rem;
}

.upload-info li {
  margin: 0.25rem 0;
  color: #6b7280;
}

.user-info {
  background: #f0f9ff;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.info-label {
  font-weight: 600;
  color: #1e40af;
}

.info-value {
  color: #1e3a8a;
  font-family: monospace;
  background: white;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
}

.info-hint {
  color: #6b7280;
  font-size: 0.9rem;
  font-style: italic;
}

.auth-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.auth-option {
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.auth-option:hover {
  border-color: #667eea;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
}

.auth-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.auth-option h5 {
  margin: 0.5rem 0;
  color: #374151;
}

.auth-option p {
  margin: 0;
  color: #6b7280;
  font-size: 0.9rem;
}

.auth-status {
  display: inline-block;
  margin-top: 0.5rem;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.auth-status.success {
  background: #d1fae5;
  color: #065f46;
}

.auth-status.warning {
  background: #fef3c7;
  color: #92400e;
}

.password-input-group {
  margin: 1.5rem 0;
}

.password-input-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #374151;
}

.password-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.password-input:focus {
  outline: none;
  border-color: #667eea;
}

.input-hint {
  margin-top: 0.5rem;
  color: #6b7280;
  font-size: 0.85rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1.5rem;
}

.settings-body {
  max-height: 70vh;
  overflow-y: auto;
}

.setting-group {
  margin-bottom: 2rem;
}

.setting-label {
  display: block;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.75rem;
  font-size: 0.95rem;
}

.setting-control {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.slider {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: #e5e7eb;
  outline: none;
  -webkit-appearance: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #667eea;
  cursor: pointer;
}

.slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #667eea;
  cursor: pointer;
  border: none;
}

.setting-value {
  min-width: 50px;
  text-align: right;
  font-weight: 600;
  color: #667eea;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 1rem;
}

.theme-card {
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
}

.theme-card:hover {
  border-color: #667eea;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
}

.theme-card.active {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
}

.theme-preview {
  padding: 1.5rem 1rem;
  text-align: center;
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  font-weight: 600;
}

.cursor-options {
  display: flex;
  gap: 0.5rem;
}

.cursor-btn {
  flex: 1;
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-weight: 600;
  color: #374151;
  transition: all 0.2s;
  text-transform: capitalize;
}

.cursor-btn:hover {
  border-color: #667eea;
  background: #f0f9ff;
}

.cursor-btn.active {
  border-color: #667eea;
  background: #667eea;
  color: white;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-primary.btn-large {
  padding: 1rem 2rem;
  font-size: 1.1rem;
}

.btn-secondary {
  background: #e5e7eb;
  color: #374151;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.btn-secondary:hover {
  background: #d1d5db;
}

.btn-small {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover {
  background: #dc2626;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
}

.error-message {
  padding: 1rem;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 8px;
  margin-bottom: 1rem;
}

@media (max-width: 768px) {
  .webshell-container {
    padding: 1rem;
  }
  
  .header-actions {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .main-workspace {
    flex-direction: column;
  }
  
  .hosts-sidebar {
    width: 100%;
    height: 200px;
  }
  
  .nodes-grid {
    grid-template-columns: 1fr;
  }
  
  .modal-content {
    width: 95%;
    margin: 1rem;
  }
  
  .terminal-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
}
</style>