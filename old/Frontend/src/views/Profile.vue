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

      <!-- 双因子认证卡片（仅 MFA 未关闭时显示） -->
      <div class="card" v-if="mfaMode !== 'false'">
        <div class="card-header">
          <h4>🔐 双因子认证 (MFA)</h4>
          <span class="badge" :class="mfaStatus?.confirmed ? 'badge-admin' : 'badge-user'">
            {{ mfaStatus?.confirmed ? '已启用' : '未绑定' }}
          </span>
        </div>
        <div class="card-body">
          <div v-if="mfaMode === 'global'" class="alert alert-info" style="margin-bottom:1rem">
            系统已开启强制双因子认证，所有用户必须绑定 MFA。
          </div>
          <div v-if="mfaStatus?.confirmed">
            <!-- 已绑定：提供解绑入口 -->
            <p style="color:#6b7280;font-size:0.875rem;margin-bottom:1rem">
              双因子认证已启用，登录时需要输入 Authenticator App 中的验证码。
            </p>
            <div v-if="mfaDisableError" class="alert alert-error">{{ mfaDisableError }}</div>
            <div class="form-group">
              <label>输入当前验证码以解绑</label>
              <input v-model="mfaDisableCode" type="text" inputmode="numeric" maxlength="6" placeholder="000000" />
            </div>
            <button class="btn-danger" :disabled="mfaDisableCode.length !== 6 || mfaDisabling" @click="handleDisableMFA">
              {{ mfaDisabling ? '解绑中...' : '解绑 MFA' }}
            </button>
          </div>
          <div v-else>
            <!-- 未绑定：引导绑定 -->
            <p style="color:#6b7280;font-size:0.875rem;margin-bottom:1rem">
              绑定后，登录时需要额外输入 Authenticator App 中的 6 位验证码，提升账户安全性。
            </p>
            <button class="btn-primary" @click="goBindMFA">绑定 MFA →</button>
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
            <input type="password" v-model="passwordForm.newPassword" placeholder="至少8位，含大小写字母和数字" />
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
    <!-- MFA 绑定弹窗 -->
    <div v-if="showMFABindModal" class="modal-overlay" @click.self="closeMFABindModal">
      <div class="modal">
        <div class="modal-header">
          <h3>🔐 绑定双因子认证</h3>
          <button class="btn-close" @click="closeMFABindModal">×</button>
        </div>
        <div class="modal-body">
          <!-- Step 1: 扫码 -->
          <div v-if="mfaBindStep === 'scan'">
            <p style="font-size:0.875rem;color:#6b7280;margin-bottom:1rem">
              使用 Google Authenticator、Authy 等 TOTP 应用扫描二维码
            </p>
            <div v-if="!mfaBindQrUrl && !mfaBindError" style="text-align:center;padding:2rem;color:#9ca3af">生成二维码中...</div>
            <div v-else-if="mfaBindQrUrl" style="text-align:center;margin-bottom:1rem">
              <img :src="mfaBindQrUrl" alt="MFA QR" style="width:220px;height:220px;border:1px solid #e5e7eb;border-radius:8px;display:block;margin:0 auto" />
              <div style="margin-top:0.5rem;font-size:0.8rem;color:#6366f1;cursor:pointer" @click="mfaBindShowManual=!mfaBindShowManual">
                {{ mfaBindShowManual ? '▲ 收起' : '▼ 无法扫码？手动输入' }}
              </div>
              <div v-if="mfaBindShowManual" style="margin-top:0.5rem;background:#f9fafb;border-radius:8px;padding:0.75rem;text-align:left;font-size:0.8rem">
                <div style="margin-bottom:0.3rem"><span style="color:#9ca3af">账户：</span><code>{{ mfaBindAccount }}</code></div>
                <div><span style="color:#9ca3af">密钥：</span><code style="word-break:break-all">{{ mfaBindSecret }}</code></div>
              </div>
            </div>
            <div v-if="mfaBindError" class="alert alert-error">{{ mfaBindError }}</div>
          </div>
          <!-- Step 2: 确认验证码 -->
          <div v-else-if="mfaBindStep === 'confirm'">
            <p style="font-size:0.875rem;color:#6b7280;margin-bottom:1rem;text-align:center">
              请输入 App 中显示的 6 位验证码以完成绑定
            </p>
            <div class="form-group">
              <input v-model="mfaBindCode" type="text" inputmode="numeric" maxlength="6" placeholder="000000"
                style="text-align:center;font-size:1.5rem;letter-spacing:0.4em;font-weight:700"
                @keyup.enter="handleMFABindConfirm" autofocus />
            </div>
            <div v-if="mfaBindError" class="alert alert-error">{{ mfaBindError }}</div>
          </div>
          <!-- Step 3: 完成 -->
          <div v-else-if="mfaBindStep === 'done'" style="text-align:center;padding:1rem 0">
            <div style="font-size:3rem;margin-bottom:0.75rem">✅</div>
            <h4 style="margin:0 0 0.5rem">绑定成功</h4>
            <p style="font-size:0.875rem;color:#6b7280">双因子认证已启用，下次登录时需要输入验证码</p>
          </div>
        </div>
        <div class="modal-footer">
          <template v-if="mfaBindStep === 'scan'">
            <button class="btn-secondary" @click="closeMFABindModal">取消</button>
            <button class="btn-primary" :disabled="!mfaBindQrUrl" @click="mfaBindStep = 'confirm'">已扫码，下一步 →</button>
          </template>
          <template v-else-if="mfaBindStep === 'confirm'">
            <button class="btn-secondary" @click="mfaBindStep = 'scan'">← 返回</button>
            <button class="btn-primary" :disabled="mfaBindCode.length !== 6 || mfaBindLoading" @click="handleMFABindConfirm">
              {{ mfaBindLoading ? '验证中...' : '确认绑定' }}
            </button>
          </template>
          <template v-else>
            <button class="btn-primary" @click="closeMFABindModal">关闭</button>
          </template>
        </div>
      </div>
    </div>

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
import { useRouter } from 'vue-router'
import QRCode from 'qrcode'
import { authAPI, mfaAPI } from '../api'
import { getUser } from '../utils/auth'

const router = useRouter()
const user = ref<any>(null)
const showEditModal = ref(false)
const editError = ref('')
const passwordError = ref('')
const passwordSuccess = ref('')
const updating = ref(false)
const changingPassword = ref(false)
const showSuccessToast = ref(false)
const successMessage = ref('')

// MFA
const mfaStatus = ref<any>(null)
const mfaMode = ref<string>('false')
const mfaDisableCode = ref('')
const mfaDisableError = ref('')
const mfaDisabling = ref(false)

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

// 加载 MFA 状态
const loadMFAStatus = async () => {
  try {
    const status = await mfaAPI.getStatus()
    mfaStatus.value = status
    mfaMode.value = String(status.mode)
  } catch (_) {}
}

// MFA 绑定弹窗状态
const showMFABindModal = ref(false)
const mfaBindStep = ref<'scan' | 'confirm' | 'done'>('scan')
const mfaBindQrUrl = ref('')   // data URL，直接给 img src
const mfaBindSecret = ref('')
const mfaBindAccount = ref('')
const mfaBindCode = ref('')
const mfaBindError = ref('')
const mfaBindLoading = ref(false)
const mfaBindShowManual = ref(false)

const goBindMFA = async () => {
  showMFABindModal.value = true
  mfaBindStep.value = 'scan'
  mfaBindQrUrl.value = ''
  mfaBindCode.value = ''
  mfaBindError.value = ''
  mfaBindShowManual.value = false
  try {
    const data = await mfaAPI.setupAuth()
    mfaBindSecret.value = data.secret
    mfaBindAccount.value = data.account || ''
    // toDataURL 纯 JS，不依赖 DOM
    mfaBindQrUrl.value = await QRCode.toDataURL(data.otpauthUri, {
      width: 220, margin: 2, errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' }
    })
  } catch (e: any) {
    mfaBindError.value = e.response?.data?.error || '获取二维码失败'
  }
}

const handleMFABindConfirm = async () => {
  mfaBindError.value = ''
  mfaBindLoading.value = true
  try {
    await mfaAPI.confirmAuth(mfaBindCode.value)
    mfaBindStep.value = 'done'
    await loadMFAStatus()
  } catch (e: any) {
    mfaBindError.value = e.response?.data?.error || '验证码错误，请重试'
  } finally {
    mfaBindLoading.value = false
  }
}

const closeMFABindModal = () => {
  showMFABindModal.value = false
}

// 解绑 MFA
const handleDisableMFA = async () => {
  mfaDisableError.value = ''
  mfaDisabling.value = true
  try {
    await mfaAPI.disable(mfaDisableCode.value)
    mfaDisableCode.value = ''
    showSuccess('✅ MFA 已成功解绑')
    await loadMFAStatus()
  } catch (err: any) {
    mfaDisableError.value = err.response?.data?.error || '解绑失败，请检查验证码'
  } finally {
    mfaDisabling.value = false
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

  if (!passwordForm.value.newPassword || passwordForm.value.newPassword.length < 8) {
    passwordError.value = '新密码至少需要8个字符'
    return
  }

  // 密码复杂度校验
  const pwd = passwordForm.value.newPassword
  if (!/[A-Z]/.test(pwd)) { passwordError.value = '新密码必须包含至少一个大写字母'; return }
  if (!/[a-z]/.test(pwd)) { passwordError.value = '新密码必须包含至少一个小写字母'; return }
  if (!/[0-9]/.test(pwd)) { passwordError.value = '新密码必须包含至少一个数字'; return }

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
  loadMFAStatus()
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
  .info-row {
    flex-direction: column;
    gap: 2px;
  }
  .info-row .label {
    min-width: 0;
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
  border-color: #94a3b8;
  box-shadow: 0 0 0 2px rgba(0,0,0,0.08);
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

.btn-danger {
  background: #fff;
  color: #dc2626;
  border: 1px solid #fca5a5;
  padding: 7px 16px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
  transition: all 0.15s;
}
.btn-danger:hover { background: #fef2f2; }
.btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

.alert-info {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.875rem;
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
