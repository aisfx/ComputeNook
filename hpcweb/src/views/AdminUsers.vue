<template>
  <div class="admin-users">
    <div class="page-header">
      <h3>👥 用户管理</h3>
      <button class="btn-primary" @click="openAddModal">+ 添加用户</button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading">加载中...</div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-message">{{ error }}</div>

    <!-- 用户列表 -->
    <div v-else class="card">
      <table class="data-table">
        <thead>
          <tr>
            <th>用户名</th>
            <th>UID</th>
            <th>GID</th>
            <th>中文名称</th>
            <th>邮箱</th>
            <th>电话</th>
            <th>Shell</th>
            <th>家目录</th>
            <th>管理员</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.username">
            <td><strong>{{ user.username }}</strong></td>
            <td>{{ user.uid }}</td>
            <td>{{ user.gid }}</td>
            <td>{{ user.cnName }}</td>
            <td>{{ user.email || '-' }}</td>
            <td>{{ user.phone || '-' }}</td>
            <td><code>{{ user.shell }}</code></td>
            <td><code>{{ user.homeDir }}</code></td>
            <td>
              <span :class="['badge', user.isAdmin ? 'badge-admin' : 'badge-user']">
                {{ user.isAdmin ? '✅ 是' : '❌ 否' }}
              </span>
            </td>
            <td>
              <div class="status-badges">
                <span v-if="user.disabled" class="badge badge-disabled">🚫 已禁用</span>
                <span v-else class="badge badge-active">✅ 正常</span>
                <span v-if="user.passwordMustChange" class="badge badge-warning">🔑 需改密码</span>
              </div>
            </td>
            <td>
              <div class="action-buttons">
                <button class="btn-link" @click="editUser(user)">✏️ 编辑</button>
                <button class="btn-link" @click="showResetPasswordModal(user)">🔑 重置密码</button>
                <button v-if="!user.disabled" class="btn-link warning" @click="toggleUserStatus(user)">🚫 禁用</button>
                <button v-else class="btn-link success" @click="toggleUserStatus(user)">✅ 启用</button>
                <button class="btn-link" @click="togglePasswordMustChange(user)">
                  {{ user.passwordMustChange ? '🔓 取消强制改密' : '🔒 强制改密' }}
                </button>
                <button class="btn-link danger" @click="confirmDelete(user)">🗑️ 删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 添加/编辑用户模态框 -->
    <div v-if="showAddModal || showEditModal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ showEditModal ? '编辑用户' : '添加用户' }}</h3>
          <button class="btn-close" @click="closeModals">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>用户名 *</label>
            <input v-model="formData.username" :disabled="showEditModal" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>UID *</label>
              <input type="number" v-model.number="formData.uid" />
            </div>
            <div class="form-group">
              <label>GID *</label>
              <input type="number" v-model.number="formData.gid" />
            </div>
          </div>
          <div class="form-group">
            <label>中文名称 *</label>
            <input v-model="formData.cnName" />
          </div>
          <div class="form-group">
            <label>邮箱</label>
            <input type="email" v-model="formData.email" />
          </div>
          <div class="form-group">
            <label>电话</label>
            <input v-model="formData.phone" />
          </div>
          <div class="form-group">
            <label>Shell</label>
            <input v-model="formData.shell" placeholder="/bin/bash" />
          </div>
          <div class="form-group">
            <label>家目录 *</label>
            <input v-model="formData.homeDir" />
          </div>
          <div v-if="showAddModal" class="form-group">
            <label>密码 *</label>
            <input type="password" v-model="formData.password" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeModals">取消</button>
          <button class="btn-primary" @click="saveUser" :disabled="saving">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 重置密码模态框 -->
    <div v-if="showPasswordModal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>重置密码 - {{ selectedUser?.username }}</h3>
          <button class="btn-close" @click="showPasswordModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>新密码 *</label>
            <input type="password" v-model="newPassword" placeholder="至少6个字符" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="showPasswordModal = false">取消</button>
          <button class="btn-primary" @click="resetPassword" :disabled="saving">
            {{ saving ? '重置中...' : '重置密码' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { userAPI } from '../api'

const users = ref<any[]>([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)

const showAddModal = ref(false)
const showEditModal = ref(false)
const showPasswordModal = ref(false)
const selectedUser = ref<any>(null)
const newPassword = ref('')

const formData = ref({
  username: '',
  uid: 0,
  gid: 0,
  cnName: '',
  email: '',
  phone: '',
  shell: '/bin/bash',
  homeDir: '',
  password: '',
  disabled: false,
  passwordMustChange: false
})

// 加载用户列表
const loadUsers = async () => {
  loading.value = true
  error.value = ''
  try {
    users.value = await userAPI.getUsers()
  } catch (err: any) {
    error.value = err.response?.data?.error || '加载用户列表失败'
    console.error('Failed to load users:', err)
  } finally {
    loading.value = false
  }
}

// 打开添加用户模态框并自动获取 UID/GID
const openAddModal = async () => {
  try {
    const [uid, gid] = await Promise.all([
      userAPI.getNextUID(),
      userAPI.getNextUID() // 使用相同的 UID 作为默认 GID
    ])
    formData.value.uid = uid
    formData.value.gid = gid
    formData.value.homeDir = `/home/${formData.value.username || 'user'}`
  } catch (err: any) {
    console.error('Failed to get next UID/GID:', err)
    // 如果失败，使用默认值
    formData.value.uid = 1000
    formData.value.gid = 1000
  }
  showAddModal.value = true
}

// 编辑用户
const editUser = (user: any) => {
  selectedUser.value = user
  formData.value = { ...user, password: '' }
  showEditModal.value = true
}

// 保存用户
const saveUser = async () => {
  saving.value = true
  error.value = ''
  
  try {
    if (showAddModal.value) {
      // 创建用户
      if (!formData.value.password) {
        error.value = '密码不能为空'
        saving.value = false
        return
      }
      await userAPI.createUser(formData.value)
      
      // 直接添加到本地列表，避免重新加载
      const newUser = {
        ...formData.value,
        isAdmin: false // 默认非管理员
      }
      delete newUser.password // 不在列表中显示密码
      users.value.push(newUser)
      
      alert('用户创建成功！')
    } else {
      // 更新用户
      await userAPI.updateUser(formData.value.username, formData.value)
      
      // 直接更新本地列表中的用户
      const index = users.value.findIndex(u => u.username === formData.value.username)
      if (index !== -1) {
        users.value[index] = { ...formData.value }
        delete users.value[index].password
      }
      
      alert('用户更新成功！')
    }
    
    closeModals()
  } catch (err: any) {
    error.value = err.response?.data?.error || '保存失败'
    alert(error.value)
  } finally {
    saving.value = false
  }
}

// 显示重置密码模态框
const showResetPasswordModal = (user: any) => {
  selectedUser.value = user
  newPassword.value = ''
  showPasswordModal.value = true
}

// 重置密码
const resetPassword = async () => {
  if (!newPassword.value || newPassword.value.length < 6) {
    alert('密码至少需要6个字符')
    return
  }

  saving.value = true
  try {
    await userAPI.resetPassword(selectedUser.value.username, newPassword.value)
    alert('密码重置成功！')
    showPasswordModal.value = false
  } catch (err: any) {
    alert(err.response?.data?.error || '重置密码失败')
  } finally {
    saving.value = false
  }
}

// 确认删除
const confirmDelete = (user: any) => {
  if (confirm(`确定要删除用户 ${user.username} 吗？此操作不可恢复！`)) {
    deleteUser(user.username)
  }
}

// 删除用户
const deleteUser = async (username: string) => {
  try {
    await userAPI.deleteUser(username)
    
    // 直接从本地列表中移除
    users.value = users.value.filter(u => u.username !== username)
    
    alert('用户删除成功！')
  } catch (err: any) {
    alert(err.response?.data?.error || '删除失败')
  }
}

// 关闭模态框
const closeModals = () => {
  showAddModal.value = false
  showEditModal.value = false
  selectedUser.value = null
  formData.value = {
    username: '',
    uid: 0,
    gid: 0,
    cnName: '',
    email: '',
    phone: '',
    shell: '/bin/bash',
    homeDir: '',
    password: '',
    disabled: false,
    passwordMustChange: false
  }
}

// 切换用户禁用状态
const toggleUserStatus = async (user: any) => {
  const action = user.disabled ? '启用' : '禁用'
  if (!confirm(`确定要${action}用户 ${user.username} 吗？`)) {
    return
  }

  try {
    await userAPI.setUserDisabled(user.username, !user.disabled)
    user.disabled = !user.disabled
    alert(`用户${action}成功！`)
  } catch (err: any) {
    alert(err.response?.data?.error || `${action}失败`)
  }
}

// 切换强制修改密码状态
const togglePasswordMustChange = async (user: any) => {
  const action = user.passwordMustChange ? '取消强制修改密码' : '设置强制修改密码'
  if (!confirm(`确定要为用户 ${user.username} ${action}吗？`)) {
    return
  }

  try {
    await userAPI.setPasswordMustChange(user.username, !user.passwordMustChange)
    user.passwordMustChange = !user.passwordMustChange
    alert(`${action}成功！`)
  } catch (err: any) {
    alert(err.response?.data?.error || `操作失败`)
  }
}

onMounted(() => {
  loadUsers()
})
</script>

<style scoped>
.admin-users {
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

.badge-active {
  background: #d1fae5;
  color: #065f46;
}

.badge-disabled {
  background: #fee2e2;
  color: #991b1b;
}

.badge-warning {
  background: #fef3c7;
  color: #92400e;
}

.status-badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
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

.btn-link.warning {
  color: #f59e0b;
}

.btn-link.success {
  color: #10b981;
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

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
</style>
