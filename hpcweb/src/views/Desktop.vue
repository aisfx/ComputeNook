<template>
  <div class="desktop-page">
    <div class="page-header">
      <h3>远程桌面应用管理</h3>
      <div class="header-actions">
        <select v-model="selectedType" class="type-filter">
          <option value="">登录方式</option>
          <option value="xfce">Xfce</option>
          <option value="kde">KDE</option>
          <option value="gnome">GNOME</option>
        </select>
        <button class="btn-primary" @click="showCreateModal = true">+ 新建桌面</button>
      </div>
    </div>

    <!-- 桌面会话列表 -->
    <div class="card">
      <table class="desktop-table">
        <thead>
          <tr>
            <th>序号</th>
            <th>桌面名称</th>
            <th>桌面类型</th>
            <th>协议</th>
            <th>地址</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(session, index) in filteredSessions" :key="session.id">
            <td>{{ index + 1 }}</td>
            <td>{{ session.name }}</td>
            <td>{{ session.type }}</td>
            <td>
              <span class="protocol-badge" :class="session.protocol">
                {{ session.protocol.toUpperCase() }}
              </span>
            </td>
            <td>{{ session.address }}</td>
            <td>{{ session.createTime }}</td>
            <td>
              <div class="action-buttons">
                <button class="btn-action btn-start" @click="startSession(session)">启动</button>
                <button class="btn-action btn-delete" @click="deleteSession(session.id)">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="filteredSessions.length === 0" class="empty-state">
        <div class="empty-icon">🖥️</div>
        <p>暂无桌面会话</p>
        <p class="empty-hint">点击"新建桌面"创建远程桌面会话</p>
      </div>
    </div>

    <!-- 新建桌面弹窗 -->
    <div v-if="showCreateModal" class="modal-overlay" @click="showCreateModal = false">
      <div class="modal-content create-modal" @click.stop>
        <div class="modal-header">
          <h2>新建远程桌面</h2>
          <button @click="showCreateModal = false" class="btn-close">✕</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="createDesktop" class="create-form">
            <div class="form-group">
              <label>桌面名称 *</label>
              <input v-model="createForm.name" type="text" placeholder="例如: desktop-20250206-001" required />
            </div>

            <div class="form-group">
              <label>桌面类型 *</label>
              <select v-model="createForm.type" required>
                <option value="">请选择桌面类型</option>
                <option value="xfce">Xfce (轻量级)</option>
                <option value="kde">KDE (功能丰富)</option>
                <option value="gnome">GNOME (现代化)</option>
              </select>
            </div>

            <div class="form-group">
              <label>连接协议 *</label>
              <select v-model="createForm.protocol" required>
                <option value="vnc">VNC (浏览器访问)</option>
                <option value="rdp">RDP (远程桌面协议)</option>
              </select>
              <div class="help-text">
                <span v-if="createForm.protocol === 'vnc'">VNC 支持浏览器直接访问，无需安装客户端</span>
                <span v-if="createForm.protocol === 'rdp'">RDP 需要使用远程桌面客户端连接，性能更好</span>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>节点类型 *</label>
                <select v-model="createForm.nodeType" required>
                  <option value="standard">标准节点 (8核/16GB)</option>
                  <option value="high-mem">大内存节点 (16核/64GB)</option>
                  <option value="gpu">GPU节点 (8核/32GB/1GPU)</option>
                </select>
              </div>
              <div class="form-group">
                <label>会话时长 (小时) *</label>
                <input v-model.number="createForm.duration" type="number" min="1" max="24" required />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>分辨率</label>
                <select v-model="createForm.resolution">
                  <option value="1920x1080">1920x1080 (推荐)</option>
                  <option value="1680x1050">1680x1050</option>
                  <option value="1440x900">1440x900</option>
                  <option value="1280x720">1280x720</option>
                </select>
              </div>
              <div class="form-group">
                <label>{{ createForm.protocol === 'rdp' ? 'RDP 端口' : 'VNC 端口' }}</label>
                <input v-model.number="createForm.port" type="number" placeholder="自动分配" disabled />
              </div>
            </div>

            <div class="form-group">
              <label>用途说明</label>
              <textarea v-model="createForm.purpose" rows="3" placeholder="请简要说明使用远程桌面的目的..."></textarea>
            </div>

            <div class="form-actions">
              <button type="button" class="btn-secondary" @click="showCreateModal = false">取消</button>
              <button type="submit" class="btn-primary" :disabled="submitting">
                {{ submitting ? '创建中...' : '创建桌面' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- 启动桌面弹窗 -->
    <div v-if="showStartModal" class="modal-overlay" @click="showStartModal = false">
      <div class="modal-content start-modal" @click.stop>
        <div class="modal-header">
          <h2>启动远程桌面</h2>
          <button @click="showStartModal = false" class="btn-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="session-status">
            <div v-if="startingStatus === 'starting'" class="status-starting">
              <div class="loading-icon">⏳</div>
              <h4>正在启动桌面...</h4>
              <p>作业 ID: <code>{{ currentJobId }}</code></p>
              <p>预计等待时间: 1-3 分钟</p>
              <div class="progress-bar-container">
                <div class="progress-bar-fill" :style="{ width: startProgress + '%' }"></div>
              </div>
            </div>

            <div v-else-if="startingStatus === 'ready'" class="status-ready">
              <div class="success-icon">✅</div>
              <h4>桌面已就绪</h4>
              
              <div class="connection-info">
                <h5>连接信息</h5>
                <div class="info-grid">
                  <div class="info-item">
                    <span class="info-label">桌面名称:</span>
                    <span class="info-value">{{ selectedSession?.name }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">桌面类型:</span>
                    <span class="info-value">{{ selectedSession?.type }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">访问地址:</span>
                    <span class="info-value"><code>{{ selectedSession?.address }}</code></span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">VNC 端口:</span>
                    <span class="info-value"><code>{{ sessionCredentials.vncPort }}</code></span>
                  </div>
                </div>

                <div class="credentials-section">
                  <h5>登录凭据 (临时)</h5>
                  <div class="credential-item">
                    <label>用户名:</label>
                    <div class="credential-value">
                      <code>{{ sessionCredentials.username }}</code>
                      <button class="btn-copy" @click="copyToClipboard(sessionCredentials.username)">📋</button>
                    </div>
                  </div>
                  <div class="credential-item">
                    <label>密码:</label>
                    <div class="credential-value">
                      <code>{{ showPassword ? sessionCredentials.password : '••••••••••••' }}</code>
                      <button class="btn-copy" @click="togglePassword">
                        {{ showPassword ? '👁️' : '👁️‍🗨️' }}
                      </button>
                      <button class="btn-copy" @click="copyToClipboard(sessionCredentials.password)">📋</button>
                    </div>
                  </div>
                  <div class="credential-note">
                    <span class="note-icon">⚠️</span>
                    <span>此凭据为临时生成，仅在本次会话有效</span>
                  </div>
                </div>

                <div class="connection-methods">
                  <h5>连接方式</h5>
                  <div class="method-list">
                    <!-- VNC 连接方式 -->
                    <template v-if="selectedSession?.protocol === 'vnc'">
                      <div class="method-item">
                        <span class="method-icon">🌐</span>
                        <div class="method-content">
                          <strong>Web 浏览器</strong>
                          <p>直接在浏览器中访问: <a :href="sessionCredentials.webUrl" target="_blank">{{ sessionCredentials.webUrl }}</a></p>
                        </div>
                        <button class="btn-secondary" @click="openInBrowser">打开</button>
                      </div>
                      <div class="method-item">
                        <span class="method-icon">💻</span>
                        <div class="method-content">
                          <strong>VNC 客户端</strong>
                          <p>使用 VNC Viewer 连接到 {{ selectedSession?.address }}:{{ sessionCredentials.vncPort }}</p>
                        </div>
                        <button class="btn-secondary" @click="downloadVNCFile">下载配置</button>
                      </div>
                    </template>
                    
                    <!-- RDP 连接方式 -->
                    <template v-else-if="selectedSession?.protocol === 'rdp'">
                      <div class="method-item">
                        <span class="method-icon">🖥️</span>
                        <div class="method-content">
                          <strong>Windows 远程桌面</strong>
                          <p>使用 Windows 自带的"远程桌面连接"工具</p>
                          <p class="connection-string">{{ selectedSession?.address }}:{{ sessionCredentials.rdpPort }}</p>
                        </div>
                        <button class="btn-secondary" @click="downloadRDPFile">下载 RDP 文件</button>
                      </div>
                      <div class="method-item">
                        <span class="method-icon">🍎</span>
                        <div class="method-content">
                          <strong>macOS / Linux</strong>
                          <p>使用 Microsoft Remote Desktop 或 Remmina 等 RDP 客户端</p>
                          <p class="connection-string">{{ selectedSession?.address }}:{{ sessionCredentials.rdpPort }}</p>
                        </div>
                        <button class="btn-secondary" @click="copyRDPConnection">复制连接信息</button>
                      </div>
                      <div class="method-item">
                        <span class="method-icon">🌐</span>
                        <div class="method-content">
                          <strong>Web 浏览器 (Apache Guacamole)</strong>
                          <p>通过浏览器访问 RDP 桌面: <a :href="sessionCredentials.guacamoleUrl" target="_blank">{{ sessionCredentials.guacamoleUrl }}</a></p>
                        </div>
                        <button class="btn-secondary" @click="openGuacamole">打开</button>
                      </div>
                    </template>
                  </div>
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const selectedType = ref('')
const showCreateModal = ref(false)
const showStartModal = ref(false)
const submitting = ref(false)
const showPassword = ref(false)
const startingStatus = ref<'starting' | 'ready'>('starting')
const startProgress = ref(0)
const currentJobId = ref('')
const selectedSession = ref<any>(null)

const createForm = ref({
  name: '',
  type: '',
  protocol: 'vnc',
  nodeType: 'standard',
  duration: 4,
  resolution: '1920x1080',
  port: null,
  purpose: ''
})

const sessions = ref([
  {
    id: 1,
    name: 'desktop-20250206-173123',
    type: 'xfce',
    protocol: 'vnc',
    address: 'hpc01_login01',
    createTime: '2025-02-06T18:15:24'
  },
  {
    id: 4,
    name: 'desktop-20231114-213706',
    type: 'kde',
    protocol: 'rdp',
    address: 'hpc01_login01',
    createTime: '2023-11-14T22:14:09'
  },
  {
    id: 6,
    name: 'desktop-20260204-172952',
    type: 'kde',
    protocol: 'vnc',
    address: 'hpc01_login01',
    createTime: '2026-02-04T18:32:09'
  }
])

const sessionCredentials = ref({
  username: '',
  password: '',
  vncPort: 5901,
  rdpPort: 3389,
  webUrl: '',
  guacamoleUrl: ''
})

const filteredSessions = computed(() => {
  if (!selectedType.value) return sessions.value
  return sessions.value.filter(s => s.type.toLowerCase() === selectedType.value.toLowerCase())
})

const createDesktop = async () => {
  submitting.value = true
  
  setTimeout(() => {
    const newSession = {
      id: Date.now(),
      name: createForm.value.name,
      type: createForm.value.type,
      address: 'hpc01_login01',
      createTime: new Date().toISOString()
    }
    
    sessions.value.unshift(newSession)
    showCreateModal.value = false
    submitting.value = false
    
    alert(`远程桌面已创建！\n名称: ${newSession.name}\n类型: ${newSession.type}`)
    
    // 重置表单
    createForm.value = {
      name: '',
      type: '',
      nodeType: 'standard',
      duration: 4,
      resolution: '1920x1080',
      vncPort: null,
      purpose: ''
    }
  }, 1000)
}

const startSession = (session: any) => {
  selectedSession.value = session
  showStartModal.value = true
  startingStatus.value = 'starting'
  startProgress.value = 0
  currentJobId.value = 'DESKTOP-' + Date.now()
  
  // 模拟启动进度
  const interval = setInterval(() => {
    startProgress.value += 20
    if (startProgress.value >= 100) {
      clearInterval(interval)
      startingStatus.value = 'ready'
      
      // 生成临时凭据
      if (session.protocol === 'rdp') {
        sessionCredentials.value = {
          username: 'rdpuser_' + Math.random().toString(36).substr(2, 6),
          password: generatePassword(),
          vncPort: 0,
          rdpPort: 3389 + Math.floor(Math.random() * 100),
          webUrl: '',
          guacamoleUrl: `https://hpc.example.com/guacamole/#/client/${session.id}`
        }
      } else {
        sessionCredentials.value = {
          username: 'vncuser_' + Math.random().toString(36).substr(2, 6),
          password: generatePassword(),
          vncPort: 5900 + Math.floor(Math.random() * 100),
          rdpPort: 0,
          webUrl: `https://hpc.example.com/vnc/${session.id}`,
          guacamoleUrl: ''
        }
      }
    }
  }, 600)
}

const stopSession = () => {
  if (confirm('确定要停止此桌面会话吗？')) {
    showStartModal.value = false
    alert('桌面会话已停止')
  }
}

const deleteSession = (id: number) => {
  if (confirm('确定要删除此桌面会话吗？\n删除后无法恢复。')) {
    const index = sessions.value.findIndex(s => s.id === id)
    if (index > -1) {
      sessions.value.splice(index, 1)
      alert('桌面会话已删除')
    }
  }
}

const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

const togglePassword = () => {
  showPassword.value = !showPassword.value
}

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text)
  alert('已复制到剪贴板')
}

const openInBrowser = () => {
  window.open(sessionCredentials.value.webUrl, '_blank')
}

const downloadVNCFile = () => {
  const vncContent = `[connection]
host=${selectedSession.value?.address}
port=${sessionCredentials.value.vncPort}
password=${sessionCredentials.value.password}`

  const blob = new Blob([vncContent], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${selectedSession.value?.name}.vnc`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.desktop-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header h3 {
  margin: 0;
  font-size: 1.3rem;
  color: #333;
}

.header-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.type-filter {
  padding: 0.625rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.95rem;
  cursor: pointer;
}

.type-filter:focus {
  outline: none;
  border-color: #667eea;
}

/* 表格样式 */
.desktop-table {
  width: 100%;
  border-collapse: collapse;
}

.desktop-table thead {
  background: #f9fafb;
}

.desktop-table th {
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #555;
  border-bottom: 2px solid #e5e7eb;
}

.desktop-table td {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
  color: #333;
}

.desktop-table tbody tr:hover {
  background: #f9fafb;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-action {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-start {
  background: #667eea;
  color: white;
}

.btn-start:hover {
  background: #5568d3;
}

.btn-delete {
  background: #ef4444;
  color: white;
}

.btn-delete:hover {
  background: #dc2626;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #999;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-hint {
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

/* 新建桌面弹窗 */
.create-modal {
  max-width: 600px;
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

/* 启动桌面弹窗 */
.start-modal {
  max-width: 700px;
}

.session-status {
  min-height: 300px;
}

.status-starting {
  text-align: center;
  padding: 2rem;
}

.loading-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status-starting h4 {
  margin: 0 0 1rem 0;
  color: #333;
}

.status-starting p {
  color: #666;
  margin: 0.5rem 0;
}

.progress-bar-container {
  width: 100%;
  height: 24px;
  background: #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  margin: 2rem 0;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  transition: width 0.5s ease;
}

.status-ready {
  padding: 1.5rem;
}

.success-icon {
  font-size: 3rem;
  text-align: center;
  margin-bottom: 1rem;
}

.status-ready h4 {
  text-align: center;
  margin: 0 0 2rem 0;
  color: #333;
  font-size: 1.3rem;
}

.connection-info h5 {
  margin: 0 0 1rem 0;
  color: #667eea;
  font-size: 1.1rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-label {
  font-size: 0.85rem;
  color: #666;
}

.info-value {
  font-size: 1rem;
  font-weight: 600;
  color: #333;
}

.info-value code {
  background: #e5e7eb;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.9rem;
}

.credentials-section {
  margin-bottom: 2rem;
}

.credential-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.credential-item label {
  font-size: 0.85rem;
  color: #666;
  font-weight: 600;
}

.credential-value {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.credential-value code {
  flex: 1;
  background: #e5e7eb;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  font-size: 0.95rem;
  font-family: 'Courier New', monospace;
}

.btn-copy {
  padding: 0.5rem 0.75rem;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
}

.btn-copy:hover {
  background: #667eea;
  border-color: #667eea;
  transform: scale(1.05);
}

.credential-note {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #fef3c7;
  border-radius: 6px;
  font-size: 0.85rem;
  color: #92400e;
}

.note-icon {
  font-size: 1.2rem;
}

.connection-methods {
  margin-bottom: 2rem;
}

.method-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.method-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
  border: 2px solid #e5e7eb;
}

.method-icon {
  font-size: 2rem;
}

.method-content {
  flex: 1;
}

.method-content strong {
  display: block;
  margin-bottom: 0.25rem;
  color: #333;
}

.method-content p {
  margin: 0;
  font-size: 0.9rem;
  color: #666;
}

.method-content a {
  color: #667eea;
  text-decoration: none;
}

.method-content a:hover {
  text-decoration: underline;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .header-actions {
    flex-direction: column;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

  .method-item {
    flex-direction: column;
    text-align: center;
  }
}
</style>
