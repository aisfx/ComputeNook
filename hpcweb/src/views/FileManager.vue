<template>
  <div class="card file-manager">
    <div class="fm-header">
      <h3>📁 文件管理</h3>
      <div class="fm-actions">
        <button class="btn-primary" @click="showUpload = true">⬆️ 上传</button>
        <button class="btn-secondary">➕ 新建文件夹</button>
      </div>
    </div>

    <div class="fm-toolbar">
      <div class="breadcrumb">
        <span class="breadcrumb-item" @click="navigateTo('/')">🏠 根目录</span>
        <span v-for="(part, index) in pathParts" :key="index" class="breadcrumb-item">
          / {{ part }}
        </span>
      </div>
      <div class="fm-tools">
        <input type="text" placeholder="搜索文件..." class="search-input" />
        <button class="btn-secondary">🔄</button>
      </div>
    </div>

    <div class="fm-content">
      <div class="fm-sidebar">
        <div class="sidebar-section">
          <h4>快捷访问</h4>
          <div class="sidebar-item" @click="navigateTo('/home')">
            <span>🏠</span> 主目录
          </div>
          <div class="sidebar-item" @click="navigateTo('/scratch')">
            <span>💾</span> 临时目录
          </div>
          <div class="sidebar-item" @click="navigateTo('/data')">
            <span>📊</span> 数据目录
          </div>
        </div>
      </div>

      <div class="fm-main">
        <table class="files-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>大小</th>
              <th>修改时间</th>
              <th>权限</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="file in files" :key="file.name" @dblclick="openFile(file)">
              <td>
                <span class="file-icon">{{ file.type === 'dir' ? '📁' : '📄' }}</span>
                {{ file.name }}
              </td>
              <td>{{ file.size }}</td>
              <td>{{ file.modTime }}</td>
              <td><code>{{ file.permissions }}</code></td>
              <td>
                <button class="btn-link">下载</button>
                <button class="btn-link">重命名</button>
                <button class="btn-link danger">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const currentPath = ref('/home/admin')
const showUpload = ref(false)

const pathParts = computed(() => {
  return currentPath.value.split('/').filter(p => p)
})

const files = ref([
  { name: 'projects', type: 'dir', size: '-', modTime: '2026-02-14 10:30', permissions: 'drwxr-xr-x' },
  { name: 'data', type: 'dir', size: '-', modTime: '2026-02-13 15:20', permissions: 'drwxr-xr-x' },
  { name: 'script.sh', type: 'file', size: '2.5 KB', modTime: '2026-02-14 09:15', permissions: '-rwxr-xr-x' },
  { name: 'results.csv', type: 'file', size: '15.8 MB', modTime: '2026-02-14 11:00', permissions: '-rw-r--r--' },
  { name: 'config.json', type: 'file', size: '1.2 KB', modTime: '2026-02-12 14:30', permissions: '-rw-r--r--' }
])

const navigateTo = (path: string) => {
  currentPath.value = path
}

const openFile = (file: any) => {
  if (file.type === 'dir') {
    currentPath.value += '/' + file.name
  }
}
</script>

<style scoped>
.file-manager {
  height: calc(100vh - 200px);
  display: flex;
  flex-direction: column;
}

.fm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.fm-actions {
  display: flex;
  gap: 0.5rem;
}

.fm-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.9rem;
}

.breadcrumb-item {
  cursor: pointer;
  color: #667eea;
}

.breadcrumb-item:hover {
  text-decoration: underline;
}

.fm-tools {
  display: flex;
  gap: 0.5rem;
}

.search-input {
  padding: 0.5rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.9rem;
  width: 250px;
}

.fm-content {
  flex: 1;
  display: flex;
  gap: 1rem;
  overflow: hidden;
}

.fm-sidebar {
  width: 200px;
  background: #f9fafb;
  border-radius: 8px;
  padding: 1rem;
}

.sidebar-section h4 {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 0.75rem;
}

.sidebar-item {
  padding: 0.75rem;
  cursor: pointer;
  border-radius: 6px;
  margin-bottom: 0.25rem;
  transition: background 0.2s;
}

.sidebar-item:hover {
  background: white;
}

.fm-main {
  flex: 1;
  overflow-y: auto;
}

.files-table {
  width: 100%;
  border-collapse: collapse;
}

.files-table th {
  background: #f9fafb;
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #555;
  border-bottom: 2px solid #e5e7eb;
  position: sticky;
  top: 0;
}

.files-table td {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.files-table tbody tr {
  cursor: pointer;
}

.files-table tbody tr:hover {
  background: #f9fafb;
}

.file-icon {
  margin-right: 0.5rem;
}
</style>
