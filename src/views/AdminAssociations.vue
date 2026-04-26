<template>
  <div class="admin-associations">
    <div class="page-header">
      <h3>资源绑定管理</h3>
      <button class="btn-primary" @click="showCreateDialog = true">
        <span class="icon">➕</span>
        创建资源绑定
      </button>
    </div>

    <div class="card">
      <table class="data-table">
        <thead>
          <tr>
            <th>用户</th>
            <th>账户</th>
            <th>集群</th>
            <th>分区</th>
            <th>QoS</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="6" class="loading-state">
              <div class="spinner"></div>
              正在加载...
            </td>
          </tr>
          <tr v-else-if="associations.length === 0">
            <td colspan="6" class="empty-state">暂无资源绑定</td>
          </tr>
          <tr v-else v-for="assoc in associations" :key="`${assoc.account}-${assoc.user}-${assoc.cluster}-${assoc.partition}`">
            <td>{{ assoc.user }}</td>
            <td>
              {{ assoc.account }}
              <span v-if="assoc.is_default" class="badge badge-default">默认</span>
            </td>
            <td>{{ assoc.cluster || '-' }}</td>
            <td>{{ assoc.partition || '-' }}</td>
            <td>{{ assoc.qos && assoc.qos.length > 0 ? assoc.qos.join(', ') : '-' }}</td>
            <td>
              <div class="action-dropdown">
                <button class="btn-action-toggle" @click.stop="openMenu = openMenu === `${assoc.account}-${assoc.user}` ? null : `${assoc.account}-${assoc.user}`">操作 ▾</button>
                <div v-if="openMenu === `${assoc.account}-${assoc.user}`" class="dropdown-menu" @click.stop>
                  <button class="dropdown-item" @click="editAssociation(assoc); openMenu = null">✏️ 编辑</button>
                  <div class="dropdown-divider"></div>
                  <button class="dropdown-item danger" @click="deleteAssociation(assoc); openMenu = null">🗑️ 删除</button>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <Teleport to="body">
    <!-- 创建对话框 -->
    <div v-if="showCreateDialog" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ isEditing ? '编辑资源绑定' : '创建资源绑定' }}</h3>
          <button class="btn-close" @click="showCreateDialog = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>用户 *</label>
            <select v-model="newAssociation.user" :disabled="isEditing">
              <option value="">-- 请选择用户 --</option>
              <option v-for="user in slurmUsers" :key="user.name" :value="user.name">
                {{ user.name }}
              </option>
            </select>
            <small>从Slurm用户列表中选择{{ isEditing ? '（编辑时不可更改）' : '' }}</small>
          </div>
          <div class="form-group">
            <label>账户 *</label>
            <select v-model="newAssociation.account" :disabled="isEditing">
              <option value="">-- 请选择账户 --</option>
              <option v-for="account in slurmAccounts" :key="account.name" :value="account.name">
                {{ account.name }}
              </option>
            </select>
            <small>从Slurm账户列表中选择{{ isEditing ? '（编辑时不可更改）' : '' }}</small>
          </div>
          <div class="form-group">
            <label>集群 *</label>
            <input v-model="newAssociation.cluster" type="text" placeholder="输入集群名" :disabled="isEditing" />
            <small v-if="!isEditing">默认值: cluster</small>
            <small v-else>（编辑时不可更改）</small>
          </div>
          <div class="form-group">
            <label>分区</label>
            <input v-model="newAssociation.partition" type="text" placeholder="输入分区名（可选）" />
          </div>
          <div class="form-group">
            <label>QoS（多个用逗号分隔）</label>
            <input v-model="qosInput" type="text" placeholder="例如: normal,high" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="showCreateDialog = false">取消</button>
          <button class="btn-primary" @click="saveAssociation">{{ isEditing ? '保存' : '创建' }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { getAssociations, createAssociation as apiCreateAssociation, updateAssociation as apiUpdateAssociation, deleteAssociation as apiDeleteAssociation } from '../api'
import { slurmUserAPI, slurmAccountAPI } from '../api'
import { showSuccess, showError } from '../utils/notification'

interface Association {
  user: string
  account: string
  cluster?: string
  partition?: string
  qos?: string[]
  is_default?: boolean
}

interface SlurmUser {
  name: string
  default_account?: string
  admin_level?: string
}

interface SlurmAccount {
  name: string
  description?: string
  organization?: string
}

const associations = ref<Association[]>([])
const slurmUsers = ref<SlurmUser[]>([])
const slurmAccounts = ref<SlurmAccount[]>([])
const showCreateDialog = ref(false)
const isEditing = ref(false)
const qosInput = ref('')
const originalAssociation = ref<Association | null>(null)
const loading = ref(false)
const openMenu = ref<string | null>(null)
const closeMenu = () => { openMenu.value = null }
const newAssociation = ref<Association>({
  user: '',
  account: '',
  cluster: 'cluster', // 设置默认集群名
  partition: '',
  qos: []
})

const loadAssociations = async () => {
  loading.value = true
  try {
    const response = await getAssociations()
    console.log('Associations response:', response.data)
    associations.value = response.data.data || []
    console.log('Loaded associations:', associations.value)
  } catch (error: any) {
    console.error('Load associations error:', error)
    showError('加载资源绑定失败: ' + (error.response?.data?.error || error.message))
  } finally {
    loading.value = false
  }
}

const loadSlurmUsers = async () => {
  try {
    slurmUsers.value = await slurmUserAPI.getUsers()
  } catch (error: any) {
    showError('加载Slurm用户列表失败: ' + (error.response?.data?.error || error.message))
  }
}

const loadSlurmAccounts = async () => {
  try {
    slurmAccounts.value = await slurmAccountAPI.getAccounts()
  } catch (error: any) {
    showError('加载Slurm账户列表失败: ' + (error.response?.data?.error || error.message))
  }
}

const editAssociation = (assoc: Association) => {
  isEditing.value = true
  originalAssociation.value = { ...assoc }
  newAssociation.value = { ...assoc }
  qosInput.value = assoc.qos && assoc.qos.length > 0 ? assoc.qos.join(', ') : ''
  showCreateDialog.value = true
}

const saveAssociation = async () => {
  if (!newAssociation.value.user || !newAssociation.value.account) {
    showError('用户和账户不能为空')
    return
  }

  try {
    // 处理 QoS 输入
    const qosList = qosInput.value
      .split(',')
      .map(q => q.trim())
      .filter(q => q.length > 0)

    const assocData = {
      ...newAssociation.value,
      cluster: newAssociation.value.cluster || 'cluster', // 确保有cluster字段
      qos: qosList.length > 0 ? qosList : undefined
    }

    console.log('Saving association:', assocData)

    if (isEditing.value && originalAssociation.value) {
      // 更新
      const response = await apiUpdateAssociation(
        originalAssociation.value.account,
        originalAssociation.value.user,
        originalAssociation.value.cluster || '',
        assocData
      )
      console.log('Update response:', response)
      showSuccess('资源绑定更新成功')
    } else {
      // 创建
      const response = await apiCreateAssociation(assocData)
      console.log('Create response:', response)
      showSuccess('资源绑定创建成功')
    }
    
    showCreateDialog.value = false
    resetForm()
    
    // 延迟一下再加载，给 Slurm API 时间处理
    console.log('Reloading associations...')
    setTimeout(async () => {
      await loadAssociations()
    }, 1000) // 增加延迟到1秒
  } catch (error: any) {
    console.error('Save association error:', error)
    showError((isEditing.value ? '更新' : '创建') + '资源绑定失败: ' + (error.response?.data?.error || error.message))
  }
}

const deleteAssociation = async (assoc: Association) => {
  // 添加参数验证和日志
  console.log('Deleting association:', assoc)
  
  if (!assoc.account || !assoc.user) {
    showError(`参数错误: account='${assoc.account}', user='${assoc.user}'`)
    return
  }
  
  // 检查是否是默认账户
  const userAssociations = associations.value.filter(a => a.user === assoc.user)
  const isOnlyAssociation = userAssociations.length === 1
  
  let confirmMessage = `确定要删除用户 ${assoc.user} 和账户 ${assoc.account} 的绑定吗？`
  
  if (isOnlyAssociation) {
    confirmMessage = `⚠️ 警告：这是用户 ${assoc.user} 的唯一账户绑定！\n\n` +
      `删除后该用户将无法使用任何账户。\n` +
      `建议：先为用户创建新的账户绑定，再删除此绑定。\n\n` +
      `确定要继续删除吗？`
  }
  
  if (!confirm(confirmMessage)) {
    return
  }

  try {
    console.log('Calling apiDeleteAssociation with:', {
      account: assoc.account,
      user: assoc.user,
      cluster: assoc.cluster || '',
      partition: assoc.partition || ''
    })
    
    await apiDeleteAssociation(assoc.account, assoc.user, assoc.cluster || '', assoc.partition || '')
    showSuccess('资源绑定删除成功')
    await loadAssociations()
  } catch (error: any) {
    console.error('Delete association error:', error)
    const errorMsg = error.response?.data?.error || error.message
    
    // 检查是否是"不能删除默认账户"的错误
    if (errorMsg.includes('can not remove the default account')) {
      showError(
        '无法删除：这是用户的默认账户。\n\n' +
        '解决方案：\n' +
        '1. 先为用户创建新的账户绑定\n' +
        '2. 新绑定会自动成为默认账户\n' +
        '3. 然后可以删除此绑定'
      )
    } else {
      showError('删除资源绑定失败: ' + errorMsg)
    }
  }
}

const resetForm = () => {
  isEditing.value = false
  originalAssociation.value = null
  newAssociation.value = {
    user: '',
    account: '',
    cluster: 'cluster', // 设置默认集群名
    partition: '',
    qos: []
  }
  qosInput.value = ''
}

// 监听对话框打开，加载用户和账户列表
watch(showCreateDialog, (newVal) => {
  if (newVal) {
    // 打开对话框时，如果不是编辑模式，设置默认值
    if (!isEditing.value) {
      newAssociation.value.cluster = 'cluster'
    }
    loadSlurmUsers()
    loadSlurmAccounts()
  } else {
    resetForm()
  }
})

onMounted(() => {
  loadAssociations()
  document.addEventListener('click', closeMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeMenu)
})
</script>

<style scoped>
.admin-associations {
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

.btn-primary {
  background: #fff;
  color: #1e293b;
  border: 1px solid #e2e8f0;
  padding: 7px 16px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.btn-primary:hover { background: #f1f5f9; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-secondary {
  background: #fff;
  color: #1e293b;
  border: 1px solid #e2e8f0;
  padding: 7px 16px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.85rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: all 0.15s;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
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

.data-table tbody tr:hover { background: #f9fafb; }

.empty-state, .loading-state {
  text-align: center;
  color: #9ca3af;
  padding: 3rem !important;
}

.spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 3px solid rgba(102,126,234,0.3);
  border-radius: 50%;
  border-top-color: #667eea;
  animation: spin 1s linear infinite;
  margin-right: 0.5rem;
  vertical-align: middle;
}
@keyframes spin { to { transform: rotate(360deg); } }

.badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}
.badge-default { background: #fef3c7; color: #92400e; }

.action-dropdown { position: relative; display: inline-block; }

.btn-action-toggle {
  background: #fff;
  color: #1e293b;
  border: 1px solid #e2e8f0;
  padding: 0.4rem 0.9rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: all 0.15s;
}
.btn-action-toggle:hover { background: #f1f5f9; }

.dropdown-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  min-width: 120px;
  z-index: 100;
  overflow: hidden;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 0.6rem 1rem;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  font-size: 0.9rem;
  color: #374151;
  white-space: nowrap;
}
.dropdown-item:hover { background: #f3f4f6; }
.dropdown-item.danger { color: #ef4444; }
.dropdown-item.danger:hover { background: #fee2e2; }
.dropdown-divider { height: 1px; background: #e5e7eb; margin: 0.25rem 0; }

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
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
.modal-header h3 { margin: 0; }

.btn-close {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #9ca3af;
  line-height: 1;
}
.btn-close:hover { color: #374151; }

.modal-body { padding: 1.5rem; }

.form-group { margin-bottom: 1.5rem; }
.form-group label { display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151; }
.form-group input,
.form-group select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  box-sizing: border-box;
}
.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #94a3b8;
  box-shadow: 0 0 0 2px rgba(0,0,0,0.08);
}
.form-group small { display: block; margin-top: 0.25rem; color: #6b7280; font-size: 0.85rem; }

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
}
</style>
