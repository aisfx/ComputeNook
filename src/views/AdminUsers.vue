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
              <div class="action-dropdown">
                <button class="btn-action-toggle" @click.stop="toggleDropdown(user)">
                  操作 ▾
                </button>
                <div v-if="openDropdown[user.username]" class="dropdown-menu" @click.stop>
                  <button class="dropdown-item" @click="editUser(user); closeDropdown(user)">✏️ 编辑</button>
                  <button class="dropdown-item" @click="showResetPasswordModal(user); closeDropdown(user)">🔑 重置密码</button>
                  <button v-if="!user.disabled" class="dropdown-item warning" @click="toggleUserStatus(user); closeDropdown(user)">🚫 禁用</button>
                  <button v-else class="dropdown-item success" @click="toggleUserStatus(user); closeDropdown(user)">✅ 启用</button>
                  <button class="dropdown-item" @click="togglePasswordMustChange(user); closeDropdown(user)">
                    {{ user.passwordMustChange ? '🔓 取消强制改密' : '🔒 强制改密' }}
                  </button>
                  <div class="dropdown-divider"></div>
                  <button class="dropdown-item danger" @click="confirmDelete(user); closeDropdown(user)">🗑️ 删除</button>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <Teleport to="body">
    <!-- 添加/编辑用户模态框 -->
    <div v-if="showAddModal || showEditModal" class="modal-overlay" @click.self="closeModals">
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
    <div v-if="showPasswordModal" class="modal-overlay" @click.self="showPasswordModal = false">
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
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { userAPI } from '../api'

const users = ref<any[]>([])
const openDropdown = reactive<Record<string, boolean>>({})
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
      alert('用户创建成功！')
      // 重新从服务器加载
      await loadUsers()
    } else {
      // 更新用户
      await userAPI.updateUser(formData.value.username, formData.value)
      alert('用户更新成功！')
      // 重新从服务器加载，确保数据同步
      await loadUsers()
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

const toggleDropdown = (user: any) => {
  const current = openDropdown[user.username]
  Object.keys(openDropdown).forEach(k => { openDropdown[k] = false })
  openDropdown[user.username] = !current
}

const closeDropdown = (user: any) => {
  openDropdown[user.username] = false
}

const closeAllDropdowns = () => {
  Object.keys(openDropdown).forEach(k => { openDropdown[k] = false })
}

onMounted(() => {
  loadUsers()
  document.addEventListener('click', closeAllDropdowns)
})

onUnmounted(() => {
  document.removeEventListener('click', closeAllDropdowns)
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

.action-dropdown {
  position: relative;
  display: inline-block;
}

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

.btn-action-toggle:hover {
  background: #f1f5f9;
}

.dropdown-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  min-width: 150px;
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

.dropdown-item:hover {
  background: #f3f4f6;
}

.dropdown-item.danger {
  color: #ef4444;
}

.dropdown-item.warning {
  color: #f59e0b;
}

.dropdown-item.success {
  color: #10b981;
}

.dropdown-divider {
  height: 1px;
  background: #e5e7eb;
  margin: 0.25rem 0;
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

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
</style>
