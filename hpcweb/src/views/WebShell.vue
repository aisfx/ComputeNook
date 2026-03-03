<template>
  <div class="webshell-container">
    <div class="page-header">
      <h3>🖥️ Web Shell</h3>
      <div class="header-actions">
        <button class="btn-secondary" @click="showNodeSelector = true">📡 选择节点</button>
        <button class="btn-secondary" @click="showSessions = true">📋 会话管理</button>
        <button class="btn-secondary" @click="showLogs = true">📄 日志查看</button>
        <button class="btn-primary" @click="showKeyUpload = true">🔑 上传密钥</button>
      </div>
    </div>

    <!-- 节点选择器 -->
    <div v-if="showNodeSelector" class="modal-overlay" @click="showNodeSelector = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h4>选择连接节点</h4>
          <button class="close-btn" @click="showNodeSelector = false">×</button>
        </div>
        <div class="modal-body">
          <div class="user-info">
            <span class="info-label">当前用户:</span>
            <span class="info-value">{{ currentUsername }}</span>
            <span class="info-hint">（连接将使用此用户名）</span>
          </div>
          <div v-if="loading" class="loading">加载节点列表...</div>
          <div v-else-if="error" class="error-message">{{ error }}</div>
          <div v-else class="nodes-grid">
            <div 
              v-for="node in nodes" 
              :key="node.name"
              class="node-card"
              :class="{ disabled: !node.enabled }"
              @click="node.enabled && selectNode(node)"
            >
              <div class="node-header">
                <h5>{{ node.name }}</h5>
                <span class="node-status" :class="{ enabled: node.enabled, disabled: !node.enabled }">
                  {{ node.enabled ? '可用' : '禁用' }}
                </span>
              </div>
              <div class="node-details">
                <p>{{ node.description }}</p>
                <p class="node-address">{{ node.host }}:{{ node.port }}</p>
              </div>
              <div class="node-actions">
                <button 
                  class="btn-small btn-secondary" 
                  @click.stop="testConnection(node)"
                  :disabled="!node.enabled"
                >
                  测试连接
                </button>
              </div>
            </div>
          </div>
        </div>
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
            <div class="upload-zone" @click="$refs.keyFileInput.click()">
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

    <!-- 简化的终端区域 -->
    <div class="terminal-container" v-show="connected">
      <div class="terminal-header">
        <div class="terminal-info">
          <span class="terminal-title">{{ currentNode?.name }} - {{ currentNode?.host }}</span>
          <span class="connection-status" :class="connectionStatus">{{ connectionStatus }}</span>
        </div>
        <div class="terminal-actions">
          <button class="btn-small btn-secondary" @click="clearTerminal">清屏</button>
          <button class="btn-small btn-danger" @click="disconnect">断开连接</button>
        </div>
      </div>
      <div class="terminal-content">
        <div class="terminal-output" ref="terminalOutput">{{ terminalText }}</div>
        <div class="terminal-input-line">
          <span class="prompt">{{ prompt }}</span>
          <input 
            v-model="currentInput" 
            @keyup.enter="sendCommand"
            @keyup.up="historyUp"
            @keyup.down="historyDown"
            class="terminal-input"
            ref="terminalInput"
            placeholder="输入命令..."
          />
        </div>
      </div>
    </div>

    <!-- 连接提示 -->
    <div v-if="!connected" class="connection-prompt">
      <div class="prompt-content">
        <div class="prompt-icon">🖥️</div>
        <h3>Web Shell</h3>
        <p>选择一个节点开始SSH连接</p>
        <button class="btn-primary btn-large" @click="showNodeSelector = true">
          选择节点连接
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import notification from '../utils/notification'

// 响应式数据
const showNodeSelector = ref(false)
const showSessions = ref(false)
const showLogs = ref(false)
const showKeyUpload = ref(false)
const loading = ref(false)
const error = ref('')
const connected = ref(false)
const connectionStatus = ref('disconnected')

const nodes = ref<any[]>([])
const currentNode = ref<any>(null)
const terminalText = ref('')
const currentInput = ref('')
const prompt = ref('$ ')
const commandHistory = ref<string[]>([])
const historyIndex = ref(-1)

// 终端相关
const terminalOutput = ref<HTMLElement>()
const terminalInput = ref<HTMLInputElement>()
let websocket: WebSocket | null = null

// 初始化
onMounted(async () => {
  await loadNodes()
})

// 加载节点列表
const loadNodes = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const response = await fetch('/api/webshell/nodes', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}`
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

// 连接到节点
const connectToNode = async (node: any) => {
  showNodeSelector.value = false
  currentNode.value = node
  connectionStatus.value = 'connecting'
  
  try {
    // 建立WebSocket连接
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    const wsUrl = `ws://localhost:8080/api/webshell/connect?node=${node.name}&token=${token}`
    
    websocket = new WebSocket(wsUrl)
    
    websocket.onopen = () => {
      connectionStatus.value = 'connected'
      connected.value = true
      terminalText.value = `Connected to ${node.name} (${node.host})\n`
      prompt.value = `${node.name}:~$ `
      notification.success(`已连接到 ${node.name}`)
      
      // 聚焦到输入框
      nextTick(() => {
        terminalInput.value?.focus()
      })
    }
    
    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data)
      handleWebSocketMessage(message)
    }
    
    websocket.onclose = () => {
      connectionStatus.value = 'disconnected'
      connected.value = false
      notification.info('连接已断开')
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

// 处理WebSocket消息
const handleWebSocketMessage = (message: any) => {
  switch (message.type) {
    case 'output':
      terminalText.value += message.data
      scrollToBottom()
      break
      
    case 'connected':
      connectionStatus.value = 'connected'
      connected.value = true
      break
      
    case 'error':
      notification.error(message.data)
      connectionStatus.value = 'error'
      break
  }
}

// 发送命令
const sendCommand = () => {
  if (!currentInput.value.trim()) return
  
  const command = currentInput.value.trim()
  
  // 添加到历史记录
  commandHistory.value.push(command)
  historyIndex.value = commandHistory.value.length
  
  // 显示命令
  terminalText.value += `${prompt.value}${command}\n`
  
  // 发送到WebSocket
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    websocket.send(JSON.stringify({
      type: 'input',
      data: command + '\n'
    }))
  }
  
  // 清空输入
  currentInput.value = ''
  scrollToBottom()
}

// 历史命令导航
const historyUp = () => {
  if (historyIndex.value > 0) {
    historyIndex.value--
    currentInput.value = commandHistory.value[historyIndex.value]
  }
}

const historyDown = () => {
  if (historyIndex.value < commandHistory.value.length - 1) {
    historyIndex.value++
    currentInput.value = commandHistory.value[historyIndex.value]
  } else {
    historyIndex.value = commandHistory.value.length
    currentInput.value = ''
  }
}

// 滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (terminalOutput.value) {
      terminalOutput.value.scrollTop = terminalOutput.value.scrollHeight
    }
  })
}

// 清屏
const clearTerminal = () => {
  terminalText.value = ''
}

// 断开连接
const disconnect = () => {
  if (websocket) {
    websocket.close()
    websocket = null
  }
  
  connected.value = false
  connectionStatus.value = 'disconnected'
  currentNode.value = null
  terminalText.value = ''
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
  padding: 2rem;
  height: calc(100vh - 4rem);
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.page-header h3 {
  margin: 0;
  font-size: 1.5rem;
}

.header-actions {
  display: flex;
  gap: 1rem;
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
  padding: 1rem;
  font-family: 'Courier New', monospace;
}

.terminal-output {
  flex: 1;
  color: #ffffff;
  white-space: pre-wrap;
  overflow-y: auto;
  margin-bottom: 1rem;
  line-height: 1.4;
}

.terminal-input-line {
  display: flex;
  align-items: center;
  color: #ffffff;
}

.prompt {
  color: #10b981;
  margin-right: 0.5rem;
  font-weight: 600;
}

.terminal-input {
  flex: 1;
  background: transparent;
  border: none;
  color: #ffffff;
  font-family: 'Courier New', monospace;
  font-size: 1rem;
  outline: none;
}

.connection-prompt {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.prompt-content {
  text-align: center;
  max-width: 400px;
}

.prompt-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.prompt-content h3 {
  margin-bottom: 1rem;
  color: #374151;
}

.prompt-content p {
  margin-bottom: 2rem;
  color: #6b7280;
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