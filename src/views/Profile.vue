<template>
  <div class="profile">
    <!-- 成功提示 Toast -->
    <div v-if="showSuccessToast" class="success-toast">
      {{ successMessage }}
    </div>

    <div class="page-header">
      <h3>👤 个人资料</h3>
    </div>

    <div class="profile-container">
      <!-- 基本信息卡片 -->
      <div class="card">
        <div class="card-header">
          <h4>📝 个人信息</h4>
          <button class="btn-secondary" @click="showEditModal = true">✏️ 编辑</button>
        </div>
        <div class="card-body">
          <div class="info-row">
            <span class="label">显示名称：</span>
            <span class="value">{{ user?.cnName }}</span>
          </div>
          <div class="info-row">
            <span class="label">邮箱：</span>
            <span class="value">{{ user?.email || '-' }}</span>
          </div>
          <div class="info-row">
            <span class="label">手机号：</span>
            <span class="value">{{ user?.phone || '-' }}</span>
          </div>
          <div class="info-row">
            <span class="label">用户名：</span>
            <span class="value"><code>{{ user?.username }}</code></span>
          </div>
        </div>
      </div>

      <!-- 修改密码卡片 -->
      <div class="card">
        <div class="card-header">
          <h4>🔒 修改密码</h4>
        </div>
        <div class="card-body">
          <div v-if="passwordError" class="alert alert-error">
            {{ passwordError }}
          </div>
          <div v-if="passwordSuccess" class="alert alert-success">
            {{ passwordSuccess }}
          </div>

          <div class="form-group">
            <label>旧密码 *</label>
            <input type="password" v-model="passwordForm.oldPassword" />
          </div>
          <div class="form-group">
            <label>新密码 *</label>
            <input type="password" v-model="passwordForm.newPassword" placeholder="至少6个字符" />
          </div>
          <div class="form-group">
            <label>确认新密码 *</label>
            <input type="password" v-model="passwordForm.confirmPassword" />
          </div>
          <button class="btn-primary" @click="changePassword" :disabled="changingPassword">
            {{ changingPassword ? '修改中...' : '修改密码' }}
          </button>
        </div>
      </div>
    </div>

  </div>
  <Teleport to="body">
    <!-- 编辑个人信息模态框 -->
    <div v-if="showEditModal" class="modal-overlay" @click.self="closeEditModal">
      <div class="modal">
        <div class="modal-header">
          <h3>编辑个人信息</h3>
          <button class="btn-close" @click="closeEditModal">×</button>
        </div>
        <div class="modal-body">
          <div v-if="editError" class="alert alert-error">
            {{ editError }}
          </div>

          <div class="form-group">
            <label>显示名称 *</label>
            <input v-model="editForm.cnName" placeholder="请输入显示名称" />
          </div>
          <div class="form-group">
            <label>邮箱</label>
            <input type="email" v-model="editForm.email" placeholder="请输入邮箱地址" />
          </div>
          <div class="form-group">
            <label>手机号</label>
            <input v-model="editForm.phone" placeholder="请输入手机号码" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeEditModal">取消</button>
          <button class="btn-primary" @click="updateProfile" :disabled="updating">
            {{ updating ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { authAPI } from '../api'
import { getUser } from '../utils/auth'

const user = ref<any>(null)
const showEditModal = ref(false)
const editError = ref('')
const passwordError = ref('')
const passwordSuccess = ref('')
const updating = ref(false)
const changingPassword = ref(false)
const showSuccessToast = ref(false)
const successMessage = ref('')

const editForm = ref({
  cnName: '',
  email: '',
  phone: ''
})

const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

// 加载用户信息
const loadUser = () => {
  user.value = getUser()
  if (user.value) {
    editForm.value = {
      cnName: user.value.cnName || '',
      email: user.value.email || '',
      phone: user.value.phone || ''
    }
  }
}

// 显示成功提示
const showSuccess = (message: string) => {
  successMessage.value = message
  showSuccessToast.value = true
  setTimeout(() => {
    showSuccessToast.value = false
  }, 3000)
}

// 更新个人信息
const updateProfile = async () => {
  editError.value = ''
  
  if (!editForm.value.cnName) {
    editError.value = '显示名称不能为空'
    return
  }

  updating.value = true

  try {
    await authAPI.updateProfile(editForm.value)
    
    // 更新本地用户信息
    if (user.value) {
      user.value.cnName = editForm.value.cnName
      user.value.email = editForm.value.email
      user.value.phone = editForm.value.phone
      
      // 更新 localStorage 或 sessionStorage
      const storage = localStorage.getItem('user') ? localStorage : sessionStorage
      storage.setItem('user', JSON.stringify(user.value))
    }
    
    // 关闭模态框
    closeEditModal()
    
    // 显示成功提示
    showSuccess('✅ 个人信息更新成功！')
  } catch (err: any) {
    editError.value = err.response?.data?.error || '更新失败'
  } finally {
    updating.value = false
  }
}

// 修改密码
const changePassword = async () => {
  passwordError.value = ''
  passwordSuccess.value = ''

  // 验证
  if (!passwordForm.value.oldPassword) {
    passwordError.value = '请输入旧密码'
    return
  }

  if (!passwordForm.value.newPassword || passwordForm.value.newPassword.length < 6) {
    passwordError.value = '新密码至少需要6个字符'
    return
  }

  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    passwordError.value = '两次输入的密码不一致'
    return
  }

  if (passwordForm.value.oldPassword === passwordForm.value.newPassword) {
    passwordError.value = '新密码不能与旧密码相同'
    return
  }

  changingPassword.value = true

  try {
    await authAPI.changePassword(passwordForm.value.oldPassword, passwordForm.value.newPassword)
    
    // 更新本地用户信息，清除强制修改密码标记
    if (user.value) {
      user.value.passwordMustChange = false
      const storage = localStorage.getItem('user') ? localStorage : sessionStorage
      storage.setItem('user', JSON.stringify(user.value))
    }
    
    // 显示成功提示
    passwordSuccess.value = '✅ 密码修改成功！下次登录请使用新密码。'
    
    // 清空表单
    passwordForm.value = {
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
    
    // 5秒后自动清除成功提示
    setTimeout(() => {
      passwordSuccess.value = ''
    }, 5000)
  } catch (err: any) {
    passwordError.value = err.response?.data?.error || '密码修改失败'
  } finally {
    changingPassword.value = false
  }
}

// 关闭编辑模态框
const closeEditModal = () => {
  showEditModal.value = false
  editError.value = ''
  loadUser() // 重新加载，恢复原始值
}

onMounted(() => {
  loadUser()
})
</script>

<style scoped>
.profile {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  position: relative;
}

.success-toast {
  position: fixed;
  top: 2rem;
  right: 2rem;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  z-index: 9999;
  animation: slideIn 0.3s ease-out;
  font-weight: 600;
}

@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h3 {
  margin: 0;
  font-size: 1.5rem;
}

.profile-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  max-width: 800px;
}

@media (max-width: 768px) {
  .profile-container {
    max-width: 100%;
  }
}

.card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.card-header h4 {
  margin: 0;
  font-size: 1.1rem;
}

.card-body {
  padding: 1.5rem;
}

.info-row {
  display: flex;
  padding: 0.75rem 0;
  border-bottom: 1px solid #f3f4f6;
}

.info-row:last-child {
  border-bottom: none;
}

.info-row .label {
  font-weight: 600;
  color: #6b7280;
  min-width: 120px;
}

.info-row .value {
  color: #111827;
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

.alert {
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.alert-error {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #ef4444;
}

.alert-success {
  background: #d1fae5;
  color: #065f46;
  border: 1px solid #10b981;
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

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
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
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.btn-secondary:hover {
  background: #d1d5db;
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
</style>
