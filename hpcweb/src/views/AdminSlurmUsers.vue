<template>
  <div class="admin-slurm-users">
    <div class="page-header">
      <div class="header-info">
        <h3>👤 Slurm 用户管理</h3>
        <p class="header-desc">管理 Slurm 系统中的用户配置</p>
      </div>
      <button class="btn-primary" @click="openAddModal">+ 添加用户</button>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="error" class="error-message">{{ error }}</div>

    <div v-else class="card">
      <table class="data-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Def Acct</th>
            <th>Admin</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.name">
            <td><strong>{{ user.name }}</strong></td>
            <td>
              <span v-if="user.default_account && user.default_account !== ''">
                {{ user.default_account }}
              </span>
              <span v-else class="text-muted">未设置</span>
            </td>
            <td>
              <span :class="['badge', user.admin_level === 'Administrator' ? 'badge-admin' : 'badge-user']">
                {{ user.admin_level || 'None' }}
              </span>
            </td>
            <td>
              <div class="action-buttons">
                <button class="btn-link" @click="editUser(user)">✏️ 编辑</button>
                <button class="btn-link danger" @click="confirmDelete(user)">🗑️ 删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 添加/编辑用户模态框 -->
    <div v-if="showModal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ isEditing ? '编辑用户' : '添加用户' }}</h3>
          <button class="btn-close" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>User *</label>
            <input v-model="formData.name" :disabled="isEditing" placeholder="例如: user1" />
            <small>Slurm 用户名（通常与系统用户名相同）</small>
          </div>
          <div class="form-group">
            <label>Def Acct</label>
            <select v-model="formData.default_account" :disabled="isEditing">
              <option value="">-- 请选择默认账户 --</option>
              <option v-for="account in slurmAccounts" :key="account.name" :value="account.name">
                {{ account.name }}
              </option>
            </select>
            <small v-if="!isEditing">可选：选择默认账户（需要在"资源绑定"中手动创建绑定）</small>
            <small v-else>默认账户通过"资源绑定"管理，此处仅显示</small>
          </div>
          <div class="form-group">
            <label>Admin</label>
            <select v-model="formData.admin_level">
              <option value="None">None - 普通用户</option>
              <option value="Operator">Operator - 操作员</option>
              <option value="Administrator">Administrator - 管理员</option>
            </select>
            <small>用户的管理员权限级别</small>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeModal">取消</button>
          <button class="btn-primary" @click="saveUser" :disabled="saving">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { slurmUserAPI, slurmAccountAPI, createAssociation } from '../api'
import { showSuccess, showError } from '../utils/notification'

const users = ref<any[]>([])
const slurmAccounts = ref<any[]>([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const showModal = ref(false)
const isEditing = ref(false)

const formData = ref({
  name: '',
  default_account: '',
  admin_level: 'None'
})

const loadUsers = async () => {
  loading.value = true
  error.value = ''
  try {
    users.value = await slurmUserAPI.getUsers()
  } catch (err: any) {
    error.value = err.response?.data?.error || '加载用户列表失败'
    showError(error.value)
  } finally {
    loading.value = false
  }
}

const loadSlurmAccounts = async () => {
  try {
    slurmAccounts.value = await slurmAccountAPI.getAccounts()
  } catch (err: any) {
    showError('加载账户列表失败: ' + (err.response?.data?.error || err.message))
  }
}

const openAddModal = () => {
  isEditing.value = false
  formData.value = {
    name: '',
    default_account: '',
    admin_level: 'None'
  }
  showModal.value = true
}

const editUser = (user: any) => {
  isEditing.value = true
  formData.value = {
    name: user.name,
    default_account: user.default_account || '',
    admin_level: user.admin_level || 'None'
  }
  showModal.value = true
}

const saveUser = async () => {
  if (!formData.value.name) {
    showError('用户名不能为空')
    return
  }

  saving.value = true
  try {
    if (isEditing.value) {
      // 更新用户（只更新 admin_level）
      await slurmUserAPI.updateUser(formData.value.name, {
        name: formData.value.name,
        admin_level: formData.value.admin_level
      })
      showSuccess('用户更新成功')
    } else {
      // 创建用户
      await slurmUserAPI.createUser({
        name: formData.value.name,
        admin_level: formData.value.admin_level
      })
      showSuccess('用户创建成功')
    }
    closeModal()
    await loadUsers()
  } catch (err: any) {
    showError(err.response?.data?.error || '保存失败')
  } finally {
    saving.value = false
  }
}

const confirmDelete = (user: any) => {
  if (confirm(`确定要删除用户 ${user.name} 吗？此操作不可恢复！`)) {
    deleteUser(user.name)
  }
}

const deleteUser = async (name: string) => {
  try {
    await slurmUserAPI.deleteUser(name)
    showSuccess('用户删除成功')
    await loadUsers()
  } catch (err: any) {
    showError(err.response?.data?.error || '删除失败')
  }
}

const closeModal = () => {
  showModal.value = false
  formData.value = {
    name: '',
    default_account: '',
    admin_level: 'None'
  }
}

// 监听模态框打开，加载账户列表
watch(showModal, (newVal) => {
  if (newVal) {
    loadSlurmAccounts()
  }
})

onMounted(() => {
  loadUsers()
})
</script>

<style scoped>
.admin-slurm-users {
  padding: 2rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header-info {
  flex: 1;
}

.page-header h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
}

.header-desc {
  margin: 0;
  color: #6b7280;
  font-size: 0.9rem;
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

.data-table tbody tr:hover {
  background: #f9fafb;
}

.badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.badge-admin {
  background: #d1fae5;
  color: #065f46;
}

.badge-user {
  background: #e5e7eb;
  color: #6b7280;
}

.text-muted {
  color: #9ca3af;
  font-style: italic;
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
.form-group select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-group small {
  display: block;
  margin-top: 0.25rem;
  color: #6b7280;
  font-size: 0.85rem;
}
</style>
