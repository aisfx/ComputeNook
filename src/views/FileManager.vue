<template>
  <div class="file-manager">
    <div class="file-header">
      <h2>📁 文件管理</h2>
      <div class="path-bar">
        <button class="btn-secondary" @click="goHome" title="返回主目录">
          🏠 主目录
        </button>
        <button class="btn-secondary" @click="goUp" :disabled="!canGoUp" title="上级目录">
          ⬆️ 上级
        </button>
        <div class="current-path">
          <span class="path-label">当前路径：</span>
          <input 
            v-model="currentPath" 
            @keyup.enter="loadDirectory"
            class="path-input"
            placeholder="输入路径..."
          />
          <button class="btn-primary" @click="loadDirectory">
            🔄 刷新
          </button>
        </div>
      </div>
    </div>

    <div class="file-actions">
      <button class="btn-primary" @click="showUploadDialog">
        ⬆️ 上传文件
      </button>
      <button class="btn-secondary" @click="showCreateFolderDialog">
        📁 新建文件夹
      </button>
      <button class="btn-secondary" @click="showCreateFileDialog">
        📄 新建文件
      </button>
    </div>

    <div class="file-list" v-if="!loading">
      <table class="files-table">
        <thead>
          <tr>
            <th style="width: 40px"></th>
            <th>名称</th>
            <th style="width: 120px">大小</th>
            <th style="width: 180px">修改时间</th>
            <th style="width: 120px">权限</th>
            <th style="width: 200px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="file in sortedFiles" :key="file.path" @dblclick="handleDoubleClick(file)">
            <td class="file-icon">{{ file.is_dir ? '📁' : getFileIcon(file.name) }}</td>
            <td class="file-name">
              <span :class="{ 'is-dir': file.is_dir }">{{ file.name }}</span>
            </td>
            <td class="file-size">{{ file.is_dir ? '-' : formatSize(file.size) }}</td>
            <td class="file-time">{{ formatTime(file.mod_time) }}</td>
            <td class="file-permissions">{{ file.permissions }}</td>
            <td class="file-actions">
              <button v-if="file.is_dir" class="btn-link" @click="openDirectory(file)" title="打开">
                📂 打开
              </button>
              <button v-if="!file.is_dir" class="btn-link" @click="viewFile(file)" title="查看">
                👁️ 查看
              </button>
              <button v-if="!file.is_dir" class="btn-link" @click="downloadFile(file)" title="下载">
                ⬇️ 下载
              </button>
              <button class="btn-link" @click="renameFile(file)" title="重命名">
                ✏️ 重命名
              </button>
              <button class="btn-link danger" @click="deleteFile(file)" title="删除">
                🗑️ 删除
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="files.length === 0" class="empty-state">
        <div class="empty-icon">📭</div>
        <p>此目录为空</p>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner">⏳</div>
      <p>加载中...</p>
    </div>

    <!-- 文件查看对话框 -->
    <div v-if="showFileViewer" class="modal-overlay" @click="closeFileViewer">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>📄 {{ viewingFile?.name }}</h3>
          <button class="btn-close" @click="closeFileViewer">✕</button>
        </div>
        <div class="modal-body">
          <pre class="file-content">{{ fileContent }}</pre>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeFileViewer">关闭</button>
          <button class="btn-primary" @click="downloadFile(viewingFile)">下载</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getUser } from '../utils/auth'
import notification from '../utils/notification'
import { fileManagerApi } from '../config/api'

const currentPath = ref('')
const files = ref<any[]>([])
const loading = ref(false)
const currentUser = ref<any>(null)
const showFileViewer = ref(false)
const viewingFile = ref<any>(null)
const fileContent = ref('')

// 导航到指定目录（供外部调用）
const navigateToPath = (path: string) => {
  if (!path || path === '-') {
    notification.error('无效的路径')
    return
  }
  
  currentPath.value = path
  loadDirectory()
}

// 暴露方法给父组件
defineExpose({
  navigateToPath
})

const canGoUp = computed(() => {
  const homePath = currentUser.value?.homeDir || `/home/${currentUser.value?.username || ''}`
  return currentPath.value !== homePath && currentPath.value !== '/'
})

const sortedFiles = computed(() => {
  return [...files.value].sort((a, b) => {
    // 文件夹排在前面
    if (a.is_dir && !b.is_dir) return -1
    if (!a.is_dir && b.is_dir) return 1
    // 按名称排序
    return a.name.localeCompare(b.name)
  })
})

const goHome = () => {
  currentPath.value = currentUser.value?.homeDir || `/home/${currentUser.value?.username || ''}`
  loadDirectory()
}

const goUp = () => {
  if (!canGoUp.value) return
  const parts = currentPath.value.split('/').filter(p => p)
  parts.pop()
  currentPath.value = '/' + parts.join('/')
  loadDirectory()
}

const loadDirectory = async () => {
  loading.value = true
  
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) {
      throw new Error('请先登录系统')
    }
    
    const url = `${fileManagerApi.list()}?path=${encodeURIComponent(currentPath.value)}`
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || '读取目录失败')
    }
    
    const result = await response.json()
    files.value = result.files || []
    currentPath.value = result.path || currentPath.value
  } catch (err: any) {
    notification.error(err.message || '读取目录失败')
    files.value = []
  } finally {
    loading.value = false
  }
}

const openDirectory = (file: any) => {
  currentPath.value = file.path
  loadDirectory()
}

const handleDoubleClick = (file: any) => {
  if (file.is_dir) {
    openDirectory(file)
  } else {
    viewFile(file)
  }
}

const viewFile = async (file: any) => {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) {
      throw new Error('请先登录系统')
    }
    
    const url = `${fileManagerApi.read()}?path=${encodeURIComponent(file.path)}`
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || '读取文件失败')
    }
    
    const result = await response.json()
    fileContent.value = result.content || ''
    viewingFile.value = file
    showFileViewer.value = true
  } catch (err: any) {
    notification.error(err.message || '读取文件失败')
  }
}

const closeFileViewer = () => {
  showFileViewer.value = false
  viewingFile.value = null
  fileContent.value = ''
}

const downloadFile = (file: any) => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token')
  const url = `${fileManagerApi.download()}?path=${encodeURIComponent(file.path)}`
  
  // 创建一个隐藏的 a 标签来触发下载
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.style.display = 'none'
  
  // 添加 Authorization header（通过在 URL 中添加 token）
  link.href = `${url}&token=${token}`
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  notification.success('开始下载文件')
}

const deleteFile = async (file: any) => {
  const confirmed = confirm(`🗑️ 删除${file.is_dir ? '文件夹' : '文件'}\n\n确定要删除 "${file.name}" 吗？\n\n此操作不可恢复！`)
  
  if (!confirmed) return
  
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) {
      throw new Error('请先登录系统')
    }
    
    const url = `${fileManagerApi.delete()}?path=${encodeURIComponent(file.path)}`
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || '删除失败')
    }
    
    notification.success('删除成功')
    await loadDirectory()
  } catch (err: any) {
    notification.error(err.message || '删除失败')
  }
}

const renameFile = async (file: any) => {
  const newName = prompt(`重命名 "${file.name}"\n\n请输入新名称：`, file.name)
  
  if (!newName || newName === file.name) return
  
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) {
      throw new Error('请先登录系统')
    }
    
    const parts = file.path.split('/')
    parts[parts.length - 1] = newName
    const newPath = parts.join('/')
    
    const response = await fetch(fileManagerApi.rename(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        old_path: file.path,
        new_path: newPath
      })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || '重命名失败')
    }
    
    notification.success('重命名成功')
    await loadDirectory()
  } catch (err: any) {
    notification.error(err.message || '重命名失败')
  }
}

const showCreateFolderDialog = async () => {
  const folderName = prompt('新建文件夹\n\n请输入文件夹名称：')
  
  if (!folderName) return
  
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) {
      throw new Error('请先登录系统')
    }
    
    const newPath = `${currentPath.value}/${folderName}`
    
    const response = await fetch(fileManagerApi.mkdir(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: newPath
      })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || '创建文件夹失败')
    }
    
    notification.success('文件夹创建成功')
    await loadDirectory()
  } catch (err: any) {
    notification.error(err.message || '创建文件夹失败')
  }
}

const showCreateFileDialog = async () => {
  const fileName = prompt('新建文件\n\n请输入文件名称：')
  
  if (!fileName) return
  
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) {
      throw new Error('请先登录系统')
    }
    
    const newPath = `${currentPath.value}/${fileName}`
    
    const response = await fetch(fileManagerApi.write(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: newPath,
        content: ''
      })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || '创建文件失败')
    }
    
    notification.success('文件创建成功')
    await loadDirectory()
  } catch (err: any) {
    notification.error(err.message || '创建文件失败')
  }
}

const showUploadDialog = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.onchange = async (e: any) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    
    for (const file of files) {
      await uploadFile(file)
    }
    
    await loadDirectory()
  }
  input.click()
}

const uploadFile = async (file: File) => {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) {
      throw new Error('请先登录系统')
    }
    
    const formData = new FormData()
    formData.append('file', file)
    formData.append('path', currentPath.value)
    
    const response = await fetch(fileManagerApi.upload(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || '上传失败')
    }
    
    notification.success(`文件 "${file.name}" 上传成功`)
  } catch (err: any) {
    notification.error(`上传 "${file.name}" 失败: ${err.message}`)
  }
}

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

const formatTime = (timeStr: string): string => {
  try {
    const date = new Date(timeStr)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return timeStr
  }
}

const getFileIcon = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase()
  const iconMap: Record<string, string> = {
    'txt': '📄',
    'pdf': '📕',
    'doc': '📘',
    'docx': '📘',
    'xls': '📗',
    'xlsx': '📗',
    'ppt': '📙',
    'pptx': '📙',
    'zip': '📦',
    'tar': '📦',
    'gz': '📦',
    'jpg': '🖼️',
    'jpeg': '🖼️',
    'png': '🖼️',
    'gif': '🖼️',
    'mp4': '🎬',
    'avi': '🎬',
    'mp3': '🎵',
    'wav': '🎵',
    'py': '🐍',
    'js': '📜',
    'ts': '📜',
    'html': '🌐',
    'css': '🎨',
    'json': '📋',
    'xml': '📋',
    'sh': '⚙️',
    'c': '⚙️',
    'cpp': '⚙️',
    'java': '☕',
    'go': '🐹'
  }
  return iconMap[ext || ''] || '📄'
}

onMounted(() => {
  currentUser.value = getUser()
  currentPath.value = currentUser.value?.homeDir || `/home/${currentUser.value?.username || ''}`
  loadDirectory()
})
</script>

<style scoped>
.file-manager {
  padding: 1.5rem;
}

.file-header {
  margin-bottom: 1.5rem;
}

.file-header h2 {
  margin: 0 0 1rem 0;
}

.path-bar {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

.current-path {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex: 1;
  min-width: 300px;
}

.path-label {
  font-weight: 600;
  color: #666;
  white-space: nowrap;
}

.path-input {
  flex: 1;
  padding: 0.5rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.9rem;
  font-family: monospace;
}

.path-input:focus {
  outline: none;
  border-color: #667eea;
}

.file-actions {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.files-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.files-table thead {
  background: #f9fafb;
}

.files-table th {
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
}

.files-table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #f3f4f6;
}

.files-table tbody tr:hover {
  background: #f9fafb;
  cursor: pointer;
}

.file-icon {
  font-size: 1.5rem;
  text-align: center;
}

.file-name .is-dir {
  font-weight: 600;
  color: #667eea;
}

.file-size, .file-time, .file-permissions {
  color: #6b7280;
  font-size: 0.9rem;
}

.file-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.empty-state, .loading-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #9ca3af;
}

.empty-icon, .spinner {
  font-size: 4rem;
  margin-bottom: 1rem;
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
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #9ca3af;
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.btn-close:hover {
  background: #f3f4f6;
  color: #374151;
}

.modal-body {
  flex: 1;
  overflow: auto;
  padding: 1.5rem;
}

.file-content {
  margin: 0;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
}
</style>
