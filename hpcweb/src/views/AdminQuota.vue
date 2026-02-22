<template>
  <div class="admin-quota">
    <div class="page-header">
      <h3>💾 存储配额管理</h3>
      <button class="btn-primary" @click="openAddModal">+ 设置配额</button>
    </div>

    <div class="card">
      <table class="data-table">
        <thead>
          <tr>
            <th>用户/组</th>
            <th>存储路径</th>
            <th>配额(GB)</th>
            <th>已使用(GB)</th>
            <th>剩余(GB)</th>
            <th>使用率</th>
            <th>文件数限制</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in quotaList" :key="item.id">
            <td><strong>{{ item.name }}</strong></td>
            <td><code>{{ item.path }}</code></td>
            <td>{{ item.quota }}</td>
            <td>{{ item.used }}</td>
            <td>{{ item.remaining }}</td>
            <td>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: item.usage + '%', background: getUsageColor(item.usage) }"></div>
              </div>
              <span class="usage-text">{{ item.usage }}%</span>
            </td>
            <td>{{ item.fileLimit || '无限制' }}</td>
            <td>
              <div class="action-buttons">
                <button class="btn-link" @click="editQuota(item)">✏️ 编辑</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const quotaList = ref([
  { id: 1, name: 'user1', path: '/home/user1', quota: 100, used: 45, remaining: 55, usage: 45, fileLimit: 100000 },
  { id: 2, name: 'user2', path: '/home/user2', quota: 200, used: 180, remaining: 20, usage: 90, fileLimit: 200000 },
  { id: 3, name: 'project01', path: '/data/project01', quota: 1000, used: 350, remaining: 650, usage: 35, fileLimit: null },
])

const getUsageColor = (usage: number) => {
  if (usage >= 90) return '#ef4444'
  if (usage >= 75) return '#f59e0b'
  return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
}

const openAddModal = () => {
  alert('设置配额功能开发中...')
}

const editQuota = (item: any) => {
  alert(`编辑 ${item.name} 的存储配额`)
}
</script>

<style scoped>
.admin-quota {
  padding: 2rem;
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

.card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 900px;
}

.data-table th {
  background: #f9fafb;
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #555;
  border-bottom: 2px solid #e5e7eb;
  white-space: nowrap;
}

.data-table td {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.data-table tbody tr:hover {
  background: #f9fafb;
}

.progress-bar {
  width: 100px;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  display: inline-block;
  margin-right: 0.5rem;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s;
}

.usage-text {
  font-size: 0.9rem;
  color: #6b7280;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-link {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0.25rem 0.5rem;
  white-space: nowrap;
}

.btn-link:hover {
  text-decoration: underline;
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
</style>
