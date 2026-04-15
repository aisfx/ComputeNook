<template>
  <div class="admin-hours">
    <div class="page-header">
      <h3>⏱️ 机时管理</h3>
      <button class="btn-primary" @click="openAddModal">+ 分配机时</button>
    </div>

    <div class="filters-bar">
      <div class="filter-group">
        <label>类型筛选：</label>
        <select v-model="filterType">
          <option value="all">全部</option>
          <option value="user">用户</option>
          <option value="account">账户</option>
        </select>
      </div>
      <div class="filter-group">
        <label>搜索：</label>
        <input v-model="searchQuery" placeholder="搜索用户或账户名称" />
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-if="error" class="error-message">{{ error }}</div>

    <div v-else class="card">
      <table class="data-table">
        <thead>
          <tr>
            <th>类型</th>
            <th>用户/账户</th>
            <th>总机时(小时)</th>
            <th>已使用</th>
            <th>剩余</th>
            <th>使用率</th>
            <th>有效期</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in filteredHoursList" :key="item.id">
            <td>
              <span class="type-badge" :class="item.type === 'user' ? 'type-user' : 'type-account'">
                {{ item.type === 'user' ? '👤 用户' : '📁 账户' }}
              </span>
            </td>
            <td><strong>{{ item.name }}</strong></td>
            <td>{{ item.total }}</td>
            <td>{{ item.used }}</td>
            <td>{{ item.remaining }}</td>
            <td>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: item.usage + '%', background: getProgressColor(item.usage) }"></div>
              </div>
              <span class="usage-text">{{ item.usage }}%</span>
            </td>
            <td>{{ item.expireDate }}</td>
            <td>
              <span class="status-badge" :class="getStatusClass(item)">
                {{ getStatusText(item) }}
              </span>
            </td>
            <td>
              <div class="action-buttons">
                <button class="btn-link" @click="editHours(item)">✏️ 编辑</button>
                <button class="btn-link danger" @click="deleteHours(item)">🗑️ 删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      
      <div v-if="filteredHoursList.length === 0" class="empty-state">
        <p>暂无机时分配记录</p>
      </div>
    </div>
  </div>
  <Teleport to="body">
    <!-- 添加/编辑机时模态框 -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ isEdit ? '编辑机时分配' : '分配机时' }}</h3>
          <button class="btn-close" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>
          
          <div class="form-group">
            <label>分配类型 *</label>
            <select v-model="formData.type" :disabled="isEdit">
              <option value="user">用户</option>
              <option value="account">账户</option>
            </select>
          </div>

          <div class="form-group">
            <label>{{ formData.type === 'user' ? '用户名' : '账户名' }} *</label>
            <input 
              v-if="isEdit" 
              v-model="formData.name" 
              disabled 
            />
            <select v-else v-model="formData.name">
              <option value="">请选择...</option>
              <option v-for="item in availableTargets" :key="item" :value="item">
                {{ item }}
              </option>
            </select>
            <small class="form-hint">选择要分配机时的{{ formData.type === 'user' ? '用户' : '账户' }}</small>
          </div>

          <div class="form-group">
            <label>总机时（小时）*</label>
            <input 
              type="number" 
              v-model.number="formData.total" 
              placeholder="例如: 1000" 
              min="0"
            />
            <small class="form-hint">分配的总机时数量</small>
          </div>

          <div class="form-group">
            <label>有效期 *</label>
            <input 
              type="date" 
              v-model="formData.expireDate"
            />
            <small class="form-hint">机时的有效截止日期</small>
          </div>

          <div class="form-group">
            <label>备注</label>
            <textarea 
              v-model="formData.notes" 
              placeholder="可选的备注信息"
              rows="3"
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeModal">取消</button>
          <button class="btn-primary" @click="saveHours" :disabled="saving">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { userAPI } from '../api'

const hoursList = ref<any[]>([])
const loading = ref(false)
const error = ref('')
const showModal = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const modalError = ref('')
const filterType = ref('all')
const searchQuery = ref('')

const users = ref<any[]>([])
const accounts = ref<any[]>([])

const formData = ref({
  type: 'user',
  name: '',
  total: 0,
  expireDate: '',
  notes: ''
})

// 加载用户列表
const loadUsersAndAccounts = async () => {
  try {
    const usersData = await userAPI.getUsers()
    users.value = usersData
    // 账户功能已移除
    accounts.value = []
  } catch (err) {
    console.error('Failed to load users:', err)
  }
}

// 可选择的目标列表
const availableTargets = computed(() => {
  if (formData.value.type === 'user') {
    return users.value.map(u => u.username)
  } else {
    // 账户功能已移除
    return []
  }
})

// 过滤后的机时列表
const filteredHoursList = computed(() => {
  let filtered = hoursList.value

  // 类型筛选
  if (filterType.value !== 'all') {
    filtered = filtered.filter(item => item.type === filterType.value)
  }

  // 搜索筛选
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(item => 
      item.name.toLowerCase().includes(query)
    )
  }

  return filtered
})

// 加载机时列表
const loadHoursList = async () => {
  loading.value = true
  error.value = ''
  
  try {
    // 这里应该调用实际的 API，目前使用模拟数据
    // TODO: 实现后端 API
    hoursList.value = [
      { 
        id: 1, 
        type: 'user',
        name: 'user1', 
        total: 1000, 
        used: 350, 
        remaining: 650, 
        usage: 35, 
        expireDate: '2024-12-31',
        notes: '研究项目A'
      },
      { 
        id: 2, 
        type: 'account',
        name: 'project01', 
        total: 5000, 
        used: 2100, 
        remaining: 2900, 
        usage: 42, 
        expireDate: '2024-12-31',
        notes: '大型计算项目'
      },
      { 
        id: 3, 
        type: 'user',
        name: 'user2', 
        total: 500, 
        used: 450, 
        remaining: 50, 
        usage: 90, 
        expireDate: '2024-06-30',
        notes: '即将到期'
      },
    ]
  } catch (err: any) {
    error.value = err.response?.data?.error || '加载机时列表失败'
  } finally {
    loading.value = false
  }
}

// 获取进度条颜色
const getProgressColor = (usage: number) => {
  if (usage >= 90) return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
  if (usage >= 70) return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
  return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
}

// 获取状态样式
const getStatusClass = (item: any) => {
  const now = new Date()
  const expireDate = new Date(item.expireDate)
  const daysLeft = Math.ceil((expireDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  
  if (daysLeft < 0) return 'status-expired'
  if (daysLeft <= 7 || item.usage >= 90) return 'status-warning'
  return 'status-normal'
}

// 获取状态文本
const getStatusText = (item: any) => {
  const now = new Date()
  const expireDate = new Date(item.expireDate)
  const daysLeft = Math.ceil((expireDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  
  if (daysLeft < 0) return '已过期'
  if (daysLeft <= 7) return `${daysLeft}天后到期`
  if (item.usage >= 90) return '即将用完'
  return '正常'
}

const openAddModal = () => {
  isEdit.value = false
  formData.value = {
    type: 'user',
    name: '',
    total: 0,
    expireDate: '',
    notes: ''
  }
  showModal.value = true
}

const editHours = (item: any) => {
  isEdit.value = true
  formData.value = {
    type: item.type,
    name: item.name,
    total: item.total,
    expireDate: item.expireDate,
    notes: item.notes || ''
  }
  showModal.value = true
}

const saveHours = async () => {
  modalError.value = ''
  
  // 验证
  if (!formData.value.name) {
    modalError.value = '请选择用户或账户'
    return
  }
  if (formData.value.total <= 0) {
    modalError.value = '总机时必须大于0'
    return
  }
  if (!formData.value.expireDate) {
    modalError.value = '请选择有效期'
    return
  }

  saving.value = true
  
  try {
    // TODO: 调用实际的 API
    if (isEdit.value) {
      // await hoursAPI.updateHours(formData.value)
      alert('机时更新成功！')
    } else {
      // await hoursAPI.createHours(formData.value)
      alert('机时分配成功！')
    }
    
    closeModal()
    await loadHoursList()
  } catch (err: any) {
    modalError.value = err.response?.data?.error || '保存失败'
  } finally {
    saving.value = false
  }
}

const deleteHours = async (item: any) => {
  if (confirm(`确定要删除 ${item.name} 的机时分配吗？`)) {
    try {
      // TODO: 调用实际的 API
      // await hoursAPI.deleteHours(item.id)
      alert('机时分配删除成功！')
      await loadHoursList()
    } catch (err: any) {
      alert(err.response?.data?.error || '删除失败')
    }
  }
}

const closeModal = () => {
  showModal.value = false
  modalError.value = ''
}

onMounted(() => {
  loadHoursList()
  loadUsersAndAccounts()
})
</script>

<style scoped>
.admin-hours {
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

.filters-bar {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
  align-items: center;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-group label {
  font-weight: 600;
  color: #374151;
  white-space: nowrap;
}

.filter-group select,
.filter-group input {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.95rem;
}

.filter-group input {
  min-width: 250px;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: #666;
}

.error-message {
  padding: 1rem;
  background: #fee;
  color: #c00;
  border-radius: 8px;
  margin-bottom: 1rem;
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
  min-width: 1000px;
}

.data-table th {
  background: #f9fafb;
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #555;
  border-bottom: 2px solid #e5e7eb;
}

.data-table td {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.data-table tbody tr:hover {
  background: #f9fafb;
}

.type-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.type-user {
  background: #dbeafe;
  color: #1e40af;
}

.type-account {
  background: #fef3c7;
  color: #92400e;
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

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.status-normal {
  background: #d1fae5;
  color: #065f46;
}

.status-warning {
  background: #fed7aa;
  color: #92400e;
}

.status-expired {
  background: #fee2e2;
  color: #991b1b;
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
}

.btn-link:hover {
  text-decoration: underline;
}

.btn-link.danger {
  color: #ef4444;
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

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
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

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
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

.modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
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
  font-size: 2rem;
  cursor: pointer;
  color: #9ca3af;
  line-height: 1;
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.alert {
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.alert-error {
  background: #fee2e2;
  color: #991b1b;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #374151;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-hint {
  display: block;
  margin-top: 0.5rem;
  color: #6b7280;
  font-size: 0.85rem;
}

@media (max-width: 768px) {
  .filters-bar {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filter-group {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filter-group input {
    min-width: auto;
  }
}
</style>
