<template>
  <div class="login-root" :data-theme="theme">
    <div class="login-left">
      <div class="login-brand">
        <div class="brand-logo">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10.5z" fill="white" opacity="0.15"/>
            <path d="M3 10.5L12 3l9 7.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M4 10.5V21h16V10.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <rect x="7.5" y="12.5" width="9" height="7" rx="1" stroke="white" stroke-width="1.5" fill="white" fill-opacity="0.1"/>
            <rect x="10" y="14.5" width="4" height="3" rx="0.5" fill="white"/>
            <line x1="9.5" y1="12.5" x2="9.5" y2="11.2" stroke="white" stroke-width="1.2" stroke-linecap="round"/>
            <line x1="12" y1="12.5" x2="12" y2="11.2" stroke="white" stroke-width="1.2" stroke-linecap="round"/>
            <line x1="14.5" y1="12.5" x2="14.5" y2="11.2" stroke="white" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
        </div>
        <h1>算力小筑</h1>
        <p class="brand-tagline">算力触手可及</p>
        <p class="brand-desc">不大，但够用。<br/>一个人也能管好一整个集群。</p>
        <div class="brand-divider"></div>
        <div class="brand-features">
          <div class="feature-card">
            <span class="feature-icon">📊</span>
            <div class="feature-text">
              <div class="feature-title">实时集群监控与调度</div>
              <div class="feature-desc">节点状态、资源利用率一览无余</div>
            </div>
          </div>
          <div class="feature-card">
            <span class="feature-icon">🚀</span>
            <div class="feature-text">
              <div class="feature-title">作业提交与管理</div>
              <div class="feature-desc">Slurm 作业全生命周期管理</div>
            </div>
          </div>
          <div class="feature-card">
            <span class="feature-icon"></span>
            <div class="feature-text">
              <div class="feature-title">Web Shell 终端访问</div>
              <div class="feature-desc">浏览器直连，无需额外客户端</div>
            </div>
          </div>
          <div class="feature-card">
            <span class="feature-icon"></span>
            <div class="feature-text">
              <div class="feature-title">文件管理与传输</div>
              <div class="feature-desc">在线浏览、上传下载轻松搞定</div>
            </div>
          </div>
        </div>
        <div class="status-bar">
          <span class="status-dot"></span>系统运行中
        </div>
      </div>
    </div>

    <div class="login-right">
      <div class="login-box">
        <button class="theme-toggle" @click="cycleTheme" :title="themeLabel">
          {{ themeIcon }}
        </button>
        <div class="login-header">
          <h2>欢迎回来</h2>
          <p>使用 LDAP 账户登录系统</p>
        </div>

        <form @submit.prevent="handleLogin" class="login-form" v-if="mfaStep === 'none'">
          <div class="field">
            <label for="username">用户名</label>
            <input id="username" v-model="form.username" type="text" placeholder="请输入用户名"
              required :disabled="loading" autocomplete="username" />
          </div>
          <div class="field">
            <label for="password">密码</label>
            <div class="password-wrap">
              <input id="password" v-model="form.password" :type="showPassword ? 'text' : 'password'"
                placeholder="请输入密码" required :disabled="loading" autocomplete="current-password" />
              <button type="button" class="pw-toggle" @click="showPassword = !showPassword">
                {{ showPassword ? '' : '' }}
              </button>
            </div>
          </div>
          <div class="field-row">
            <label class="checkbox-label">
              <input type="checkbox" v-model="rememberMe" /><span>记住我</span>
            </label>
          </div>
          <div v-if="requireCaptcha" class="field">
            <label>验证码</label>
            <div class="captcha-row">
              <input v-model="captchaVal" type="text" placeholder="请输入验证码" maxlength="6"
                :disabled="loading || lockedSeconds > 0" @keyup.enter="handleLogin" />
              <img :src="captchaUrl" class="captcha-img" @click="refreshCaptcha" title="点击刷新" alt="验证码" />
            </div>
          </div>
          <div v-if="lockedSeconds > 0" class="lock-alert"> {{ lockMessage }}</div>
          <div v-else-if="errorMessage" class="error-alert">{{ errorMessage }}</div>
          <button type="submit" class="submit-btn" :disabled="loading || lockedSeconds > 0">
            <span v-if="loading" class="btn-spinner"></span>
            {{ loading ? '登录中...' : '登 录' }}
          </button>
        </form>

        <div v-else-if="mfaStep === 'verify'" class="login-form">
          <div class="mfa-hint">
            <div class="mfa-icon"></div>
            <p>请打开 Authenticator App，输入 6 位验证码</p>
          </div>
          <div class="field">
            <label for="mfa-code">验证码</label>
            <input id="mfa-code" v-model="mfaCode" type="text" inputmode="numeric" maxlength="6"
              placeholder="000000" :disabled="loading" autocomplete="one-time-code"
              @keyup.enter="handleMFAVerify" class="mfa-input" />
          </div>
          <div v-if="errorMessage" class="error-alert">{{ errorMessage }}</div>
          <button class="submit-btn" :disabled="loading || mfaCode.length !== 6" @click="handleMFAVerify">
            <span v-if="loading" class="btn-spinner"></span>
            {{ loading ? '验证中...' : '验 证' }}
          </button>
          <button class="back-btn" @click="mfaStep = 'none'; mfaCode = ''; errorMessage = ''"> 返回</button>
        </div>

        <div v-else-if="mfaStep === 'setup'" class="login-form">
          <div class="mfa-hint">
            <div class="mfa-icon"></div>
            <p>系统要求启用双因子认证，请先完成绑定</p>
          </div>
          <div v-if="errorMessage" class="error-alert">{{ errorMessage }}</div>
          <button class="submit-btn" @click="goToSetup">前往绑定 </button>
          <button class="back-btn" @click="mfaStep = 'none'; errorMessage = ''"> 返回</button>
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
const theme = ref<'light' | 'dark' | 'ocean'>('dark')
const captchaId = ref('')
const captchaVal = ref('')
const captchaUrl = ref('')
const requireCaptcha = ref(false)
const lockedSeconds = ref(0)
let lockTimer: ReturnType<typeof setInterval> | null = null
const mfaStep = ref<'none' | 'verify' | 'setup'>('none')
const mfaTempToken = ref('')
const mfaCode = ref('')

const lockMessage = computed(() => {
  if (lockedSeconds.value <= 0) return ''
  const m = Math.floor(lockedSeconds.value / 60)
  const s = lockedSeconds.value % 60
  return `账户已锁定，请 ${m > 0 ? m + ' 分 ' : ''}${s} 秒后重试`
})

const THEMES_LOGIN: Array<'light' | 'dark' | 'ocean'> = ['light', 'dark', 'ocean']
const THEME_ICONS_LOGIN: Record<string, string> = { light: '🌙', dark: '🌊', ocean: '☀️' }
const THEME_LABELS_LOGIN: Record<string, string> = { light: '切换暗色', dark: '切换海洋', ocean: '切换亮色' }
const themeIcon = computed(() => THEME_ICONS_LOGIN[theme.value])
const themeLabel = computed(() => THEME_LABELS_LOGIN[theme.value])

const cycleTheme = () => {
  const idx = THEMES_LOGIN.indexOf(theme.value)
  theme.value = THEMES_LOGIN[(idx + 1) % THEMES_LOGIN.length]
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
    if (lockedSeconds.value <= 0) { clearInterval(lockTimer!); lockTimer = null; errorMessage.value = '' }
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
      username: form.value.username, password: form.value.password,
      captchaId: captchaId.value, captchaVal: captchaVal.value,
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
      startLockCountdown(res.retryAfter || 600); requireCaptcha.value = true; await refreshCaptcha()
    } else if (status === 400 && res?.code === 'CAPTCHA_REQUIRED') {
      errorMessage.value = '验证码错误，请重新输入'; requireCaptcha.value = true; await refreshCaptcha()
    } else if (status === 401) {
      errorMessage.value = res?.error || '用户名或密码错误'
      if (res?.attemptsLeft !== undefined) errorMessage.value += `，还剩 ${res.attemptsLeft} 次机会`
      if (res?.requireCaptcha) { requireCaptcha.value = true; await refreshCaptcha() }
    } else if (status === 403) {
      errorMessage.value = '账户已被禁用，请联系管理员'
    } else {
      errorMessage.value = res?.error || '登录失败，请检查网络连接'
    }
  } finally { loading.value = false }
}

const handleMFAVerify = async () => {
  errorMessage.value = ''; loading.value = true
  try {
    const data = await mfaAPI.verifyLogin(mfaTempToken.value, mfaCode.value)
    saveSession(data.token, data.user)
    router.push(data.user.passwordMustChange ? '/force-change-password' : '/dashboard')
  } catch (error: any) {
    errorMessage.value = error.response?.data?.error || '验证码错误'
  } finally { loading.value = false }
}

const goToSetup = () => {
  sessionStorage.setItem('mfa_temp_token', mfaTempToken.value)
  sessionStorage.setItem('mfa_setup_username', form.value.username)
  router.push('/mfa-setup')
}

onMounted(() => {
  const saved = localStorage.getItem('theme') as 'light' | 'dark' | 'ocean' | null
  theme.value = (saved && ['light', 'dark', 'ocean'].includes(saved)) ? saved as 'light' | 'dark' | 'ocean' : 'dark'
})
</script>

<style scoped>
.login-root { display: flex; min-height: 100vh; font-family: var(--font-family); }

.login-left {
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 3rem 2.5rem; position: relative; overflow: hidden;
  background: linear-gradient(145deg, #1a2035 0%, #1e2a45 40%, #1a2540 70%, #151e30 100%);
}
[data-theme="light"] .login-left {
  background: linear-gradient(145deg, #e8ecf4 0%, #dde4f0 40%, #e2e8f4 70%, #d8e0ee 100%);
}
[data-theme="ocean"] .login-left {
  background: linear-gradient(145deg, #071a20 0%, #0a2535 40%, #082030 70%, #051520 100%);
}
.login-left::before {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 40px 40px;
}
[data-theme="light"] .login-left::before {
  background-image: linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px);
}
[data-theme="ocean"] .login-left::before {
  background-image: linear-gradient(rgba(0,200,200,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,200,200,0.05) 1px, transparent 1px);
}

.login-brand { position: relative; z-index: 1; max-width: 380px; width: 100%; text-align: center; }

.brand-logo {
  width: 80px; height: 80px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border-radius: 22px;
  display: flex; align-items: center; justify-content: center; font-size: 2rem;
  margin: 0 auto 1.25rem;
  border: none;
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.45);
}
[data-theme="light"] .brand-logo {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.35);
}
[data-theme="ocean"] .brand-logo {
  background: linear-gradient(135deg, #0891b2 0%, #6366f1 100%);
  box-shadow: 0 8px 24px rgba(8, 145, 178, 0.4);
}

.login-brand h1 { font-size: 1.875rem; font-weight: 700; margin: 0 0 0.375rem; color: #fff; letter-spacing: 0.02em; }
[data-theme="light"] .login-brand h1 { color: #1e2a45; }
[data-theme="ocean"] .login-brand h1 { color: #a8f0f0; }

.brand-tagline { font-size: 0.9rem; color: rgba(255,255,255,0.55); margin: 0 0 0.75rem; }
[data-theme="light"] .brand-tagline { color: rgba(30,42,69,0.55); }
[data-theme="ocean"] .brand-tagline { color: rgba(100,220,220,0.65); }

.brand-desc { font-size: 0.875rem; color: rgba(255,255,255,0.7); margin: 0 0 1.5rem; line-height: 1.7; font-style: italic; }
[data-theme="light"] .brand-desc { color: rgba(30,42,69,0.65); }
[data-theme="ocean"] .brand-desc { color: rgba(150,230,230,0.7); }

.brand-divider { width: 40px; height: 2px; background: rgba(255,255,255,0.2); margin: 0 auto 1.5rem; border-radius: 2px; }
[data-theme="light"] .brand-divider { background: rgba(30,42,69,0.2); }
[data-theme="ocean"] .brand-divider { background: rgba(0,200,200,0.4); }

.brand-features { display: flex; flex-direction: column; gap: 10px; text-align: left; margin-bottom: 2rem; }

.feature-card {
  display: flex; align-items: center; gap: 12px; padding: 12px 14px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px; backdrop-filter: blur(4px); transition: background 0.2s;
}
.feature-card:hover { background: rgba(255,255,255,0.1); }
[data-theme="light"] .feature-card { background: rgba(255,255,255,0.55); border-color: rgba(0,0,0,0.07); }
[data-theme="light"] .feature-card:hover { background: rgba(255,255,255,0.8); }
[data-theme="ocean"] .feature-card { background: rgba(0,180,180,0.07); border-color: rgba(0,180,180,0.15); }
[data-theme="ocean"] .feature-card:hover { background: rgba(0,180,180,0.13); }

.feature-icon { font-size: 1.25rem; flex-shrink: 0; width: 32px; text-align: center; }
.feature-title { font-size: 0.875rem; font-weight: 600; color: rgba(255,255,255,0.9); margin-bottom: 2px; }
[data-theme="light"] .feature-title { color: #1e2a45; }
[data-theme="ocean"] .feature-title { color: #a8f0f0; }
.feature-desc { font-size: 0.775rem; color: rgba(255,255,255,0.5); }
[data-theme="light"] .feature-desc { color: rgba(30,42,69,0.55); }
[data-theme="ocean"] .feature-desc { color: rgba(100,210,210,0.55); }

.status-bar {
  display: inline-flex; align-items: center; gap: 7px; font-size: 0.8rem;
  color: rgba(255,255,255,0.5); background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1); padding: 6px 14px; border-radius: 999px;
}
[data-theme="light"] .status-bar { color: rgba(30,42,69,0.55); background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.08); }
[data-theme="ocean"] .status-bar { color: rgba(100,220,220,0.65); background: rgba(0,180,180,0.07); border-color: rgba(0,180,180,0.18); }

.status-dot {
  width: 7px; height: 7px; border-radius: 50%; background: #4ade80;
  box-shadow: 0 0 6px #4ade80; animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

.login-right {
  width: 460px; display: flex; align-items: center; justify-content: center;
  padding: 3rem 2.5rem; background: #0f1117;
}
[data-theme="light"] .login-right { background: #ffffff; }
[data-theme="ocean"] .login-right { background: #071520; }

.login-box { width: 100%; max-width: 340px; position: relative; }

.theme-toggle {
  position: absolute; top: -2rem; right: 0; background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; width: 36px; height: 36px;
  cursor: pointer; font-size: 1rem; display: flex; align-items: center; justify-content: center; transition: background 0.15s;
}
.theme-toggle:hover { background: rgba(255,255,255,0.14); }
[data-theme="light"] .theme-toggle { background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.1); }
[data-theme="light"] .theme-toggle:hover { background: rgba(0,0,0,0.09); }
[data-theme="ocean"] .theme-toggle { background: rgba(0,180,180,0.1); border-color: rgba(0,180,180,0.22); }
[data-theme="ocean"] .theme-toggle:hover { background: rgba(0,180,180,0.2); }

.login-header { margin-bottom: 2rem; }
.login-header h2 { font-size: 1.625rem; font-weight: 700; color: #f1f5f9; margin: 0 0 0.375rem; }
[data-theme="light"] .login-header h2 { color: #1e2a45; }
[data-theme="ocean"] .login-header h2 { color: #a8f0f0; }
.login-header p { font-size: 0.875rem; color: rgba(255,255,255,0.4); margin: 0; }
[data-theme="light"] .login-header p { color: rgba(30,42,69,0.5); }
[data-theme="ocean"] .login-header p { color: rgba(100,210,210,0.5); }

.login-form { display: flex; flex-direction: column; gap: 1rem; }

.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 0.875rem; font-weight: 500; color: #cbd5e1; }
[data-theme="light"] .field label { color: #374151; }
[data-theme="ocean"] .field label { color: #7dd8d8; }

.field input {
  width: 100%; padding: 10px 12px; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
  font-size: 0.875rem; background: rgba(255,255,255,0.05); color: #f1f5f9;
  outline: none; transition: border-color 0.15s, box-shadow 0.15s; box-sizing: border-box;
}
[data-theme="light"] .field input { background: #f8fafc; border-color: #e2e8f0; color: #1e2a45; }
[data-theme="ocean"] .field input { background: rgba(0,150,150,0.08); border-color: rgba(0,180,180,0.22); color: #a8f0f0; }
.field input::placeholder { color: rgba(255,255,255,0.25); }
[data-theme="light"] .field input::placeholder { color: rgba(30,42,69,0.35); }
[data-theme="ocean"] .field input::placeholder { color: rgba(100,200,200,0.35); }
.field input:focus { border-color: rgba(255,255,255,0.3); box-shadow: 0 0 0 2px rgba(255,255,255,0.06); }
[data-theme="light"] .field input:focus { border-color: #94a3b8; box-shadow: 0 0 0 2px rgba(148,163,184,0.2); }
[data-theme="ocean"] .field input:focus { border-color: rgba(0,200,200,0.55); box-shadow: 0 0 0 2px rgba(0,200,200,0.12); }
.field input:disabled { opacity: 0.5; cursor: not-allowed; }

.password-wrap { position: relative; }
.password-wrap input { padding-right: 40px; }
.pw-toggle { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 1rem; padding: 0; opacity: 0.6; }
.pw-toggle:hover { opacity: 1; }

.field-row { display: flex; align-items: center; }
.checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 0.875rem; color: rgba(255,255,255,0.45); cursor: pointer; }
[data-theme="light"] .checkbox-label { color: rgba(30,42,69,0.55); }
[data-theme="ocean"] .checkbox-label { color: rgba(100,210,210,0.55); }
.checkbox-label input[type="checkbox"] { width: 15px; height: 15px; accent-color: #6366f1; }

.submit-btn {
  width: 100%; padding: 11px; background: #1e293b; color: #f1f5f9;
  border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; font-size: 0.9rem;
  font-weight: 600; cursor: pointer; transition: background 0.15s, opacity 0.15s;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  letter-spacing: 0.05em; margin-top: 0.25rem;
}
.submit-btn:hover:not(:disabled) { background: #273549; }
[data-theme="light"] .submit-btn { background: #1e2a45; color: #fff; border-color: transparent; }
[data-theme="light"] .submit-btn:hover:not(:disabled) { background: #2d3f63; }
[data-theme="ocean"] .submit-btn { background: rgba(0,160,160,0.22); color: #a8f0f0; border-color: rgba(0,180,180,0.35); }
[data-theme="ocean"] .submit-btn:hover:not(:disabled) { background: rgba(0,160,160,0.35); }
.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-spinner {
  width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.error-alert { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); color: #f87171; padding: 10px 14px; border-radius: 8px; font-size: 0.875rem; }
[data-theme="light"] .error-alert { background: rgba(239,68,68,0.08); color: #dc2626; }

.lock-alert { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.25); color: #fbbf24; padding: 10px 14px; border-radius: 8px; font-size: 0.875rem; text-align: center; font-weight: 500; }
[data-theme="light"] .lock-alert { color: #d97706; }

.login-footer { margin-top: 2rem; text-align: center; font-size: 0.75rem; color: rgba(255,255,255,0.2); }
[data-theme="light"] .login-footer { color: rgba(30,42,69,0.3); }
[data-theme="ocean"] .login-footer { color: rgba(100,200,200,0.25); }

.mfa-hint { text-align: center; margin-bottom: 1.5rem; }
.mfa-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
.mfa-hint p { color: rgba(255,255,255,0.5); font-size: 0.875rem; margin: 0; }
[data-theme="light"] .mfa-hint p { color: rgba(30,42,69,0.55); }
[data-theme="ocean"] .mfa-hint p { color: rgba(100,210,210,0.55); }
.mfa-input { text-align: center; font-size: 1.5rem; letter-spacing: 0.4em; font-weight: 600; }

.back-btn { width: 100%; padding: 9px; background: none; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; font-size: 0.875rem; color: rgba(255,255,255,0.4); cursor: pointer; transition: background 0.15s; }
.back-btn:hover { background: rgba(255,255,255,0.05); }
[data-theme="light"] .back-btn { border-color: #e2e8f0; color: rgba(30,42,69,0.5); }
[data-theme="light"] .back-btn:hover { background: #f8fafc; }
[data-theme="ocean"] .back-btn { border-color: rgba(0,180,180,0.22); color: rgba(100,210,210,0.5); }
[data-theme="ocean"] .back-btn:hover { background: rgba(0,180,180,0.07); }

.captcha-row { display: flex; gap: 8px; align-items: center; }
.captcha-row input { flex: 1; }
.captcha-img { height: 40px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; flex-shrink: 0; }
[data-theme="light"] .captcha-img { border-color: #e2e8f0; }
[data-theme="ocean"] .captcha-img { border-color: rgba(0,180,180,0.22); }
.captcha-img:hover { opacity: 0.8; }

@media (max-width: 768px) {
  .login-left { display: none; }
  .login-right { width: 100%; }
}
</style>