<template>
  <div class="mfa-setup-root">
    <div class="mfa-setup-box">
      <div class="step-header">
        <div class="step-icon">📱</div>
        <h2>绑定双因子认证</h2>
        <p>使用 Google Authenticator、Authy 等 TOTP 应用扫描二维码</p>
      </div>

      <!-- Step 1: 显示二维码 -->
      <div v-if="step === 'scan'">
        <div v-if="loadingQR" class="loading">生成二维码中...</div>
        <div v-else-if="qrCode" class="qr-section">
          <!-- 直接用后端生成的 PNG，400x400 清晰度足够 -->
          <img :src="qrCode" alt="MFA QR Code" class="qr-img" />

          <!-- 手动添加备用 -->
          <div class="manual-toggle" @click="showManual = !showManual">
            {{ showManual ? '▲ 收起' : '▼ 无法扫码？手动输入' }}
          </div>
          <div v-if="showManual" class="manual-section">
            <div class="manual-row">
              <span class="manual-label">账户名</span>
              <code class="manual-val">{{ account }}</code>
            </div>
            <div class="manual-row">
              <span class="manual-label">密钥</span>
              <code class="manual-val secret-code">{{ secret }}</code>
              <button class="btn-copy" @click="copySecret">复制</button>
            </div>
            <div class="manual-row">
              <span class="manual-label">类型</span>
              <code class="manual-val">基于时间 (TOTP)</code>
            </div>
            <div class="manual-row">
              <span class="manual-label">位数</span>
              <code class="manual-val">6 位</code>
            </div>
          </div>
        </div>
        <div v-if="error" class="error-alert">{{ error }}</div>
        <button class="btn-primary" @click="step = 'confirm'" :disabled="!qrCode">
          已扫码 / 已添加，下一步 →
        </button>
      </div>

      <!-- Step 2: 输入验证码确认绑定 -->
      <div v-else-if="step === 'confirm'">
        <p class="confirm-hint">请输入 App 中显示的 6 位验证码以完成绑定</p>
        <div class="field">
          <input
            v-model="code"
            type="text"
            inputmode="numeric"
            maxlength="6"
            placeholder="000000"
            class="code-input"
            @keyup.enter="handleConfirm"
            autofocus
          />
        </div>
        <div v-if="error" class="error-alert">{{ error }}</div>
        <button class="btn-primary" :disabled="loading || code.length !== 6" @click="handleConfirm">
          <span v-if="loading" class="spinner"></span>
          {{ loading ? '验证中...' : '确认绑定' }}
        </button>
        <button class="btn-back" @click="step = 'scan'; error = ''">← 返回</button>
      </div>

      <!-- Step 3: 绑定成功 -->
      <div v-else-if="step === 'done'" class="done-section">
        <div class="done-icon">✅</div>
        <h3>绑定成功</h3>
        <p>双因子认证已启用，下次登录时需要输入验证码</p>
        <button class="btn-primary" @click="goLogin">前往登录</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()

const step = ref<'scan' | 'confirm' | 'done'>('scan')
const qrCode = ref('')   // base64 PNG from backend
const secret = ref('')
const account = ref('')
const code = ref('')
const error = ref('')
const loading = ref(false)
const loadingQR = ref(false)
const showManual = ref(false)

const tempToken = sessionStorage.getItem('mfa_temp_token') || ''

const mfaAxios = axios.create({
  baseURL: axios.defaults.baseURL || (() => {
    const w = window as any
    if (w.__CONFIG__?.apiUrl) return w.__CONFIG__.apiUrl + '/api'
    if (import.meta.env.DEV) return `${location.protocol}//${location.hostname}:8080/api`
    return '/api'
  })()
})
mfaAxios.interceptors.request.use(cfg => {
  cfg.headers.Authorization = `Bearer ${tempToken}`
  return cfg
})

onMounted(async () => {
  if (!tempToken) {
    router.push('/login')
    return
  }
  loadingQR.value = true
  try {
    const res = await mfaAxios.post('mfa/setup')
    qrCode.value = res.data.data.qrCode
    secret.value = res.data.data.secret
    account.value = res.data.data.account || ''
  } catch (e: any) {
    error.value = e.response?.data?.error || '获取二维码失败，临时 token 可能已过期，请重新登录'
  } finally {
    loadingQR.value = false
  }
})

const copySecret = () => {
  navigator.clipboard?.writeText(secret.value)
    .then(() => alert('密钥已复制'))
    .catch(() => alert(secret.value))
}

const handleConfirm = async () => {
  error.value = ''
  loading.value = true
  try {
    await mfaAxios.post('mfa/confirm', { code: code.value })
    sessionStorage.removeItem('mfa_temp_token')
    sessionStorage.removeItem('mfa_setup_username')
    step.value = 'done'
  } catch (e: any) {
    error.value = e.response?.data?.error || '验证码错误，请重试'
  } finally {
    loading.value = false
  }
}

const goLogin = () => {
  router.push('/login')
}
</script>

<style scoped>
.mfa-setup-root {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: hsl(var(--background));
}

.mfa-setup-box {
  width: 100%;
  max-width: 400px;
  padding: 2.5rem;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  box-shadow: 0 4px 24px hsl(0 0% 0% / 0.08);
}

.step-header {
  text-align: center;
  margin-bottom: 2rem;
}
.step-icon { font-size: 2.5rem; margin-bottom: 0.75rem; }
.step-header h2 { font-size: 1.4rem; font-weight: 700; margin: 0 0 0.4rem; color: hsl(var(--foreground)); }
.step-header p { font-size: 0.875rem; color: hsl(var(--muted-foreground)); margin: 0; }

.qr-section { text-align: center; margin-bottom: 1.5rem; }
.qr-img {
  width: 220px;
  height: 220px;
  border-radius: 8px;
  border: 1px solid hsl(var(--border));
  image-rendering: pixelated;
}

.manual-toggle {
  margin-top: 0.75rem;
  font-size: 0.8rem;
  color: hsl(var(--primary));
  cursor: pointer;
  text-align: center;
}
.manual-section {
  margin-top: 0.75rem;
  background: hsl(var(--muted));
  border-radius: 8px;
  padding: 0.75rem;
  text-align: left;
}
.manual-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 0.4rem;
  font-size: 0.8rem;
  flex-wrap: wrap;
}
.manual-label { color: hsl(var(--muted-foreground)); min-width: 50px; }
.manual-val { font-family: monospace; word-break: break-all; }
.btn-copy {
  padding: 2px 8px;
  font-size: 0.75rem;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border: none;
  border-radius: 4px;
  cursor: pointer;
  flex-shrink: 0;
}
  height: 220px;
  border-radius: 8px;
  border: 1px solid hsl(var(--border));
}
.qr-img { width: 180px; height: 180px; border: 1px solid hsl(var(--border)); border-radius: 8px; }

.secret-row {
  margin-top: 1rem;
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
}
.secret-code {
  background: hsl(var(--muted));
  padding: 2px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.85rem;
  color: hsl(var(--foreground));
  word-break: break-all;
}

.confirm-hint {
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
  margin-bottom: 1rem;
  text-align: center;
}

.field { margin-bottom: 1rem; }
.code-input {
  width: 100%;
  padding: 12px;
  text-align: center;
  font-size: 1.75rem;
  letter-spacing: 0.5em;
  font-weight: 700;
  border: 1px solid hsl(var(--input));
  border-radius: 8px;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  outline: none;
  box-sizing: border-box;
}
.code-input:focus { border-color: hsl(var(--ring)); box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2); }

.btn-primary {
  width: 100%;
  padding: 10px;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: opacity 0.15s;
}
.btn-primary:hover:not(:disabled) { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-back {
  width: 100%;
  padding: 8px;
  background: none;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  margin-top: 0.5rem;
  transition: background 0.15s;
}
.btn-back:hover { background: hsl(var(--accent)); }

.done-section { text-align: center; }
.done-icon { font-size: 3rem; margin-bottom: 1rem; }
.done-section h3 { font-size: 1.25rem; font-weight: 700; margin: 0 0 0.5rem; }
.done-section p { font-size: 0.875rem; color: hsl(var(--muted-foreground)); margin-bottom: 1.5rem; }

.error-alert {
  background: hsl(var(--destructive) / 0.1);
  border: 1px solid hsl(var(--destructive) / 0.3);
  color: hsl(var(--destructive));
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.loading { text-align: center; color: hsl(var(--muted-foreground)); padding: 2rem 0; }

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid hsl(var(--primary-foreground) / 0.4);
  border-top-color: hsl(var(--primary-foreground));
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
