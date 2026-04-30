<template>
  <div class="login-root" :data-theme="theme">
    <!-- Left panel -->
    <div class="login-left">
      <div class="login-brand">
        <div class="brand-logo">⚡</div>
        <h1>算力小筑</h1>
        <p>高性能计算集群统一管理系统</p>
        <div class="brand-features">
          <div class="feature-item">
            <span class="feature-dot"></span>实时集群监控与调度
          </div>
          <div class="feature-item">
            <span class="feature-dot"></span>作业提交与管理
          </div>
          <div class="feature-item">
            <span class="feature-dot"></span>Web Shell 终端访问
          </div>
          <div class="feature-item">
            <span class="feature-dot"></span>文件管理与传输
          </div>
        </div>
      </div>
    </div>

    <!-- Right panel -->
    <div class="login-right">
      <div class="login-box">
        <!-- Theme toggle -->
        <button class="theme-toggle" @click="toggleTheme">
          {{ theme === 'dark' ? '☀️' : '🌙' }}
        </button>

        <div class="login-header">
          <h2>欢迎回来</h2>
          <p>使用 LDAP 账户登录系统</p>
        </div>

        <form @submit.prevent="handleLogin" class="login-form" v-if="mfaStep === 'none'">
          <div class="field">
            <label for="username">用户名</label>
            <input
              id="username"
              v-model="form.username"
              type="text"
              placeholder="请输入用户名"
              required
              :disabled="loading"
              autocomplete="username"
            />
          </div>

          <div class="field">
            <label for="password">密码</label>
            <div class="password-wrap">
              <input
                id="password"
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="请输入密码"
                required
                :disabled="loading"
                autocomplete="current-password"
              />
              <button type="button" class="pw-toggle" @click="showPassword = !showPassword">
                {{ showPassword ? '🙈' : '👁️' }}
              </button>
            </div>
          </div>

          <div class="field-row">
            <label class="checkbox-label">
              <input type="checkbox" v-model="rememberMe" />
              <span>记住我</span>
            </label>
          </div>

          <!-- 验证码（失败1次后出现） -->
          <div v-if="requireCaptcha" class="field captcha-field">
            <label>验证码</label>
            <div class="captcha-row">
              <input
                v-model="captchaVal"
                type="text"
                placeholder="请输入验证码"
                maxlength="6"
                :disabled="loading || lockedSeconds > 0"
                @keyup.enter="handleLogin"
              />
              <img
                :src="captchaUrl"
                class="captcha-img"
                @click="refreshCaptcha"
                title="点击刷新"
                alt="验证码"
              />
            </div>
          </div>

          <!-- 账户锁定倒计时 -->
          <div v-if="lockedSeconds > 0" class="lock-alert">
            🔒 {{ lockMessage }}
          </div>

          <div v-else-if="errorMessage" class="error-alert">
            {{ errorMessage }}
          </div>

          <button type="submit" class="submit-btn" :disabled="loading || lockedSeconds > 0">
            <span v-if="loading" class="btn-spinner"></span>
            {{ loading ? '登录中...' : '登 录' }}
          </button>
        </form>

        <!-- MFA 验证步骤 -->
        <div v-else-if="mfaStep === 'verify'" class="login-form">
          <div class="mfa-hint">
            <div class="mfa-icon">🔐</div>
            <p>请打开 Authenticator App，输入 6 位验证码</p>
          </div>

          <div class="field">
            <label for="mfa-code">验证码</label>
            <input
              id="mfa-code"
              v-model="mfaCode"
              type="text"
              inputmode="numeric"
              maxlength="6"
              placeholder="000000"
              :disabled="loading"
              autocomplete="one-time-code"
              @keyup.enter="handleMFAVerify"
              class="mfa-input"
            />
          </div>

          <div v-if="errorMessage" class="error-alert">{{ errorMessage }}</div>

          <button class="submit-btn" :disabled="loading || mfaCode.length !== 6" @click="handleMFAVerify">
            <span v-if="loading" class="btn-spinner"></span>
            {{ loading ? '验证中...' : '验 证' }}
          </button>
          <button class="back-btn" @click="mfaStep = 'none'; mfaCode = ''; errorMessage = ''">← 返回</button>
        </div>

        <!-- MFA 绑定引导步骤 -->
        <div v-else-if="mfaStep === 'setup'" class="login-form">
          <div class="mfa-hint">
            <div class="mfa-icon">📱</div>
            <p>系统要求启用双因子认证，请先完成绑定</p>
          </div>
          <div v-if="errorMessage" class="error-alert">{{ errorMessage }}</div>
          <button class="submit-btn" @click="goToSetup">前往绑定 →</button>
          <button class="back-btn" @click="mfaStep = 'none'; errorMessage = ''">← 返回</button>
        </div>

        <div class="login-footer">算力小筑 v0.1</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import '@/api/index'
import { mfaAPI } from '../api'

const router = useRouter()
const form = ref({ username: '', password: '' })
const rememberMe = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const showPassword = ref(false)
const theme = ref<'light' | 'dark'>('light')

// 验证码
const captchaId = ref('')
const captchaVal = ref('')
const captchaUrl = ref('')
const requireCaptcha = ref(false)

// 账户锁定
const lockedSeconds = ref(0)
let lockTimer: ReturnType<typeof setInterval> | null = null

// MFA 状态
const mfaStep = ref<'none' | 'verify' | 'setup'>('none')
const mfaTempToken = ref('')
const mfaCode = ref('')

const lockMessage = computed(() => {
  if (lockedSeconds.value <= 0) return ''
  const m = Math.floor(lockedSeconds.value / 60)
  const s = lockedSeconds.value % 60
  return `账户已锁定，请 ${m > 0 ? m + ' 分 ' : ''}${s} 秒后重试`
})

const toggleTheme = () => {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
  localStorage.setItem('theme', theme.value)
}

const getBaseUrl = () => {
  const w = window as any
  if (w.__CONFIG__?.apiUrl) return w.__CONFIG__.apiUrl + '/api'
  if (import.meta.env.DEV) return `${location.protocol}//${location.hostname}:8080/api`
  return '/api'
}

const refreshCaptcha = async () => {
  try {
    const res = await axios.get('/captcha/new')
    captchaId.value = res.data.captchaId
    captchaUrl.value = `${getBaseUrl()}/captcha/${captchaId.value}.png?t=${Date.now()}`
    captchaVal.value = ''
  } catch (_) {}
}

const startLockCountdown = (seconds: number) => {
  lockedSeconds.value = seconds
  if (lockTimer) clearInterval(lockTimer)
  lockTimer = setInterval(() => {
    lockedSeconds.value--
    if (lockedSeconds.value <= 0) {
      clearInterval(lockTimer!)
      lockTimer = null
      errorMessage.value = ''
    }
  }, 1000)
}

const saveSession = (token: string, user: any) => {
  const storage = rememberMe.value ? localStorage : sessionStorage
  storage.setItem('token', token)
  storage.setItem('user', JSON.stringify(user))
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
}

const handleLogin = async () => {
  if (lockedSeconds.value > 0) return
  errorMessage.value = ''
  loading.value = true
  try {
    const data = await axios.post('/login', {
      username: form.value.username,
      password: form.value.password,
      captchaId: captchaId.value,
      captchaVal: captchaVal.value,
    }).then(r => r.data)

    if (data.mfaRequired) {
      mfaTempToken.value = data.tempToken
      mfaStep.value = data.mfaSetup ? 'setup' : 'verify'
      return
    }

    saveSession(data.token, data.user)
    router.push(data.user.passwordMustChange ? '/force-change-password' : '/dashboard')
  } catch (error: any) {
    const res = error.response?.data
    const status = error.response?.status

    if (status === 429 && res?.code === 'ACCOUNT_LOCKED') {
      startLockCountdown(res.retryAfter || 600)
      errorMessage.value = ''
      requireCaptcha.value = true
      await refreshCaptcha()
    } else if (status === 400 && res?.code === 'CAPTCHA_REQUIRED') {
      errorMessage.value = '验证码错误，请重新输入'
      requireCaptcha.value = true
      await refreshCaptcha()
    } else if (status === 401) {
      errorMessage.value = res?.error || '用户名或密码错误'
      if (res?.attemptsLeft !== undefined) {
        errorMessage.value += `，还剩 ${res.attemptsLeft} 次机会`
      }
      if (res?.requireCaptcha) {
        requireCaptcha.value = true
        await refreshCaptcha()
      }
    } else if (status === 403) {
      errorMessage.value = '账户已被禁用，请联系管理员'
    } else {
      errorMessage.value = res?.error || '登录失败，请检查网络连接'
    }
  } finally {
    loading.value = false
  }
}

const handleMFAVerify = async () => {
  errorMessage.value = ''
  loading.value = true
  try {
    const data = await mfaAPI.verifyLogin(mfaTempToken.value, mfaCode.value)
    saveSession(data.token, data.user)
    router.push(data.user.passwordMustChange ? '/force-change-password' : '/dashboard')
  } catch (error: any) {
    errorMessage.value = error.response?.data?.error || '验证码错误'
  } finally {
    loading.value = false
  }
}

const goToSetup = () => {
  sessionStorage.setItem('mfa_temp_token', mfaTempToken.value)
  sessionStorage.setItem('mfa_setup_username', form.value.username)
  router.push('/mfa-setup')
}

onMounted(() => {
  const saved = localStorage.getItem('theme') as 'light' | 'dark' | null
  if (saved) theme.value = saved
})
</script>

<style scoped>
.login-root {
  display: flex;
  min-height: 100vh;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}

/* Left */
.login-left {
  flex: 1;
  background: hsl(var(--primary));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  position: relative;
  overflow: hidden;
}

.login-left::before {
  content: '';
  position: absolute;
  width: 500px;
  height: 500px;
  border-radius: 50%;
  background: hsl(var(--primary-foreground) / 0.04);
  top: -150px;
  right: -150px;
}

.login-left::after {
  content: '';
  position: absolute;
  width: 350px;
  height: 350px;
  border-radius: 50%;
  background: hsl(var(--primary-foreground) / 0.04);
  bottom: -100px;
  left: -100px;
}

.login-brand {
  color: hsl(var(--primary-foreground));
  text-align: center;
  position: relative;
  z-index: 1;
  max-width: 340px;
}

.brand-logo {
  width: 64px;
  height: 64px;
  background: hsl(var(--primary-foreground) / 0.15);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  margin: 0 auto 1.5rem;
  border: 1px solid hsl(var(--primary-foreground) / 0.2);
}

.login-brand h1 {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
  color: hsl(var(--primary-foreground));
}

.login-brand > p {
  font-size: 0.9rem;
  opacity: 0.75;
  margin: 0 0 2rem;
  color: hsl(var(--primary-foreground));
}

.brand-features {
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-align: left;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.875rem;
  color: hsl(var(--primary-foreground) / 0.85);
}

.feature-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: hsl(var(--primary-foreground) / 0.6);
  flex-shrink: 0;
}

/* Right */
.login-right {
  width: 460px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: hsl(var(--background));
  padding: 3rem 2.5rem;
  position: relative;
}

.login-box {
  width: 100%;
  max-width: 360px;
  position: relative;
}

.theme-toggle {
  position: absolute;
  top: -2rem;
  right: 0;
  background: hsl(var(--secondary));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  width: 36px;
  height: 36px;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.theme-toggle:hover { background: hsl(var(--accent)); }

.login-header { margin-bottom: 2rem; }

.login-header h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: hsl(var(--foreground));
  margin: 0 0 0.375rem;
}

.login-header p {
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  margin: 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--foreground));
}

.field input {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid hsl(var(--input));
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  box-sizing: border-box;
}

.field input:focus {
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
}

.field input:disabled {
  background: hsl(var(--muted));
  cursor: not-allowed;
}

.password-wrap {
  position: relative;
}

.password-wrap input { padding-right: 40px; }

.pw-toggle {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 0;
  line-height: 1;
}

.field-row {
  display: flex;
  align-items: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 15px;
  height: 15px;
  accent-color: hsl(var(--primary));
}

.error-alert {
  background: hsl(var(--destructive) / 0.1);
  border: 1px solid hsl(var(--destructive) / 0.3);
  color: hsl(var(--destructive));
  padding: 10px 14px;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
}

.submit-btn {
  width: 100%;
  padding: 10px;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  letter-spacing: 0.03em;
}
.submit-btn:hover:not(:disabled) { opacity: 0.9; }
.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid hsl(var(--primary-foreground) / 0.4);
  border-top-color: hsl(var(--primary-foreground));
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.login-footer {
  margin-top: 2rem;
  text-align: center;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.mfa-hint {
  text-align: center;
  margin-bottom: 1.5rem;
}
.mfa-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
.mfa-hint p { color: hsl(var(--muted-foreground)); font-size: 0.875rem; margin: 0; }

.mfa-input {
  text-align: center;
  font-size: 1.5rem;
  letter-spacing: 0.4em;
  font-weight: 600;
}

.back-btn {
  width: 100%;
  padding: 8px;
  background: none;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  margin-top: 0.5rem;
  transition: background 0.15s;
}
.back-btn:hover { background: hsl(var(--accent)); }

.captcha-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.captcha-row input {
  flex: 1;
  padding: 9px 12px;
  border: 1px solid hsl(var(--input));
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  outline: none;
}
.captcha-row input:focus { border-color: hsl(var(--ring)); box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2); }
.captcha-img {
  height: 40px;
  border-radius: 6px;
  border: 1px solid hsl(var(--border));
  cursor: pointer;
  flex-shrink: 0;
}
.captcha-img:hover { opacity: 0.85; }

.lock-alert {
  background: hsl(38 92% 50% / 0.12);
  border: 1px solid hsl(38 92% 50% / 0.4);
  color: hsl(32 95% 44%);
  padding: 10px 14px;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  text-align: center;
  font-weight: 500;
}

@media (max-width: 768px) {
  .login-left { display: none; }
  .login-right { width: 100%; }
}
</style>
