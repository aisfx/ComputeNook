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
  </div>
  <Teleport to="body">
    <!-- 添加/编辑用户模态框 -->
    <div v-if="showModal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ isEditing ? '编辑用户' : '添加用户' }}</h3>
          <button class="btn-close" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>User (LDAP 系统用户) *</label>
            <select v-model="formData.name" :disabled="isEditing" v-if="!isEditing">
              <option value="">-- 选择 LDAP 系统用户 --</option>
              <option v-for="user in ldapUsers" :key="user.uid" :value="user.username">
                {{ user.username }} ({{ user.cnName }}, UID: {{ user.uid }})
              </option>
            </select>
            <input v-else v-model="formData.name" disabled />
            <small>选择一个已存在的 LDAP 系统用户</small>
          </div>
          
          <div class="form-group">
            <label>Def Acct (默认账户)</label>
            <select v-model="formData.default_account">
              <option value="">-- 请选择默认账户 --</option>
              <option v-for="account in slurmAccounts" :key="account.name" :value="account.name">
                {{ account.name }}
              </option>
            </select>
            <small v-if="!isEditing">选择默认账户（将自动创建用户关联）</small>
            <small v-else>默认账户通过"资源绑定"管理</small>
          </div>
          
          <div class="form-group">
            <label>Admin Level</label>
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
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { slurmUserAPI, slurmAccountAPI, userAPI } from '../api'
import { showSuccess, showError } from '../utils/notification'
import { dialog } from '../utils/dialog'

const users = ref<any[]>([])
const slurmAccounts = ref<any[]>([])
const ldapUsers = ref<any[]>([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const showModal = ref(false)
const isEditing = ref(false)

const formData = ref({
  name: '',
  default_account: '',
  admin_level: 'None',
  password: '',
  cn_name: '',
  email: '',
  phone: '',
  shell: '/bin/bash',
  home_dir: ''
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

// 加载 LDAP 系统用户列表
const loadLdapUsers = async () => {
  try {
    ldapUsers.value = await userAPI.getUsers()
  } catch (err: any) {
    console.error('加载 LDAP 用户失败:', err)
    showError('加载 LDAP 用户失败')
  }
}

const openAddModal = async () => {
  isEditing.value = false
  formData.value = {
    name: '',
    default_account: '',
    admin_level: 'None',
    password: '',
    cn_name: '',
    email: '',
    phone: '',
    shell: '/bin/bash',
    home_dir: ''
  }
  // 加载 LDAP 用户列表
  await loadLdapUsers()
  showModal.value = true
}

const editUser = (user: any) => {
  isEditing.value = true
  formData.value = {
    name: user.name,
    default_account: user.default_account || '',
    admin_level: user.admin_level || 'None',
    password: '',
    cn_name: '',
    email: '',
    phone: '',
    shell: '/bin/bash',
    home_dir: ''
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
      // 创建 Slurm 用户（关联已存在的 LDAP 用户）
      const userData: any = {
        name: formData.value.name,
        admin_level: formData.value.admin_level,
        default_account: formData.value.default_account || undefined
      }
      
      const response = await slurmUserAPI.createUser(userData)
      
      // 显示成功信息
      if (formData.value.default_account) {
        showSuccess(`Slurm 用户创建成功！已关联到账户 ${formData.value.default_account}`)
      } else {
        showSuccess('Slurm 用户创建成功')
      }
    }
    closeModal()
    await loadUsers()
  } catch (err: any) {
    showError(err.response?.data?.error || '保存失败')
  } finally {
    saving.value = false
  }
}

const confirmDelete = async (user: any) => {
  if (await dialog.confirmDelete(user.name, 'Slurm用户')) {
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
    admin_level: 'None',
    password: '',
    cn_name: '',
    email: '',
    phone: '',
    shell: '/bin/bash',
    home_dir: ''
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
}

.btn-primary:hover {
  background: #f1f5f9;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

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

.btn-secondary:hover {
  background: #f1f5f9;
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
  border-color: #94a3b8;
  box-shadow: 0 0 0 2px rgba(0,0,0,0.08);
}

.form-group small {
  display: block;
  margin-top: 0.25rem;
  color: #6b7280;
  font-size: 0.85rem;
}
</style>
