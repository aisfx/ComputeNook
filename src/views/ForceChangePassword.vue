<template>
  <div class="force-change-password">
    <div class="modal-overlay">
      <div class="modal">
        <!-- 成功提示 -->
        <div v-if="showSuccess" class="success-overlay">
          <div class="success-message">
            <div class="success-icon">✅</div>
            <h3>密码修改成功！</h3>
            <p>即将跳转到登录页面</p>
            <p class="countdown">{{ countdown }} 秒后自动跳转...</p>
          </div>
        </div>

        <!-- 修改密码表单 -->
        <div v-else>
          <div class="modal-header">
            <h3>🔒 强制修改密码</h3>
          </div>
          <div class="modal-body">
            <div class="alert alert-warning">
              <p>⚠️ 您的账户需要修改密码才能继续使用系统。</p>
              <p>请设置一个新的密码（至少6个字符）。</p>
            </div>

            <div v-if="error" class="alert alert-error">
              {{ error }}
            </div>

            <div class="form-group">
              <label>旧密码 *</label>
              <input 
                type="password" 
                v-model="oldPassword" 
                placeholder="请输入当前密码"
                @keyup.enter="changePassword"
              />
            </div>

            <div class="form-group">
              <label>新密码 *</label>
              <input 
                type="password" 
                v-model="newPassword" 
                placeholder="至少6个字符"
                @keyup.enter="changePassword"
              />
            </div>

            <div class="form-group">
              <label>确认新密码 *</label>
              <input 
                type="password" 
                v-model="confirmPassword" 
                placeholder="再次输入新密码"
                @keyup.enter="changePassword"
              />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-primary" @click="changePassword" :disabled="saving">
              {{ saving ? '修改中...' : '修改密码' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authAPI } from '../api'
import { logout } from '../utils/auth'

const router = useRouter()

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const saving = ref(false)
const showSuccess = ref(false)
const countdown = ref(3)

const changePassword = async () => {
  error.value = ''

  // 验证
  if (!oldPassword.value) {
    error.value = '请输入旧密码'
    return
  }

  if (!newPassword.value || newPassword.value.length < 6) {
    error.value = '新密码至少需要6个字符'
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    error.value = '两次输入的密码不一致'
    return
  }

  if (oldPassword.value === newPassword.value) {
    error.value = '新密码不能与旧密码相同'
    return
  }

  saving.value = true

  try {
    await authAPI.changePassword(oldPassword.value, newPassword.value)
    
    // 显示成功提示
    showSuccess.value = true
    
    // 倒计时
    const timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        clearInterval(timer)
        // 清除登录信息并跳转
        logout()
        router.push('/login')
      }
    }, 1000)
  } catch (err: any) {
    error.value = err.response?.data?.error || '密码修改失败'
    saving.value = false
  }
}
</script>

<style scoped>
.force-change-password {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.alert {
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.alert-warning {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fbbf24;
}

.alert-warning p {
  margin: 0.5rem 0;
}

.alert-error {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #ef4444;
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



.success-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  z-index: 10;
}

.success-message {
  text-align: center;
  padding: 2rem;
}

.success-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  animation: scaleIn 0.5s ease-out;
}

@keyframes scaleIn {
  from {
    transform: scale(0);
  }
  to {
    transform: scale(1);
  }
}

.success-message h3 {
  color: #10b981;
  font-size: 1.5rem;
  margin-bottom: 1rem;
}

.success-message p {
  color: #6b7280;
  font-size: 1rem;
  margin: 0.5rem 0;
}

.countdown {
  font-size: 1.2rem;
  font-weight: 600;
  color: #667eea;
  margin-top: 1rem;
}
</style>
