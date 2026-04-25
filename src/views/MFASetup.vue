<template>
  <div class="mfa-setup-root">
    <div class="mfa-setup-box">
      <div class="step-header">
        <div class="step-icon">📱</div>
        <h2>绑定双因子认证</h2>
        <p>请按步骤完成 Google Authenticator 绑定</p>
      </div>

      <!-- Step 0: 安装引导 -->
      <div v-if="step === 'install'">
        <p class="install-hint">请先在手机上安装身份验证器应用</p>
        <div class="app-download">
          <div class="app-item recommended">
            <div class="recommend-badge">推荐</div>
            <img :src="wxQrUrl" alt="腾讯身份验证器" class="app-qr" />
            <span class="app-label">腾讯身份验证器</span>
            <span class="app-sub">微信扫码打开小程序</span>
          </div>
          <div class="app-divider">或</div>
          <div class="app-item">
            <img
              src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=https://appgallery.huawei.com/app/C100162"
              alt="Google Authenticator"
              class="app-qr"
            />
            <span class="app-label">Google Authenticator</span>
            <span class="app-sub">华为 / Android / iPhone</span>
          </div>
        </div>
        <p class="install-sub">安装完成后点击下一步（已安装可直接下一步）</p>
        <button class="btn-primary" @click="goToScan">已安装，下一步 →</button>
      </div>

      <!-- Step 1: 扫码绑定 -->
      <div v-else-if="step === 'scan'">
        <div v-if="loadingQR" class="loading">生成二维码中...</div>
        <div v-else-if="secret" class="qr-section">
          <img v-if="qrDataUrl" :src="qrDataUrl" alt="MFA QR Code" class="qr-img" />
          <div v-else class="loading">二维码生成中...</div>
          <div class="manual-toggle" @click="showManual = !showManual">
            {{ showManual ? '▲ 收起' : '▼ 无法扫码？手动输入密钥' }}
          </div>
          <div v-if="showManual" class="manual-section">
            <div class="manual-row">
              <span class="manual-label">账户名</span>
              <code class="manual-val">{{ account }}</code>
            </div>
            <div class="manual-row">
              <span class="manual-label">密钥</span>
              <code class="manual-val">{{ secret }}</code>
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
        <button class="btn-primary" @click="step = 'confirm'" :disabled="!secret">
          已扫码 / 已添加，下一步 →
        </button>
        <button class="btn-back" @click="step = 'install'">← 返回</button>
      </div>

      <!-- Step 2: 验证码确认 -->
      <div v-else-if="step === 'confirm'">
        <p class="confirm-hint">请输入 Google Authenticator 中显示的 6 位验证码</p>
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
import QRCode from 'qrcode'
import '@/api/index'

const router = useRouter()

const step = ref<'install' | 'scan' | 'confirm' | 'done'>('install')
const qrDataUrl = ref('')
const secret = ref('')
const account = ref('')
const code = ref('')
const error = ref('')
const loading = ref(false)
const loadingQR = ref(false)
const showManual = ref(false)

// 腾讯身份验证器微信小程序链接（用户微信扫码可直接打开）
// 小程序原始ID: gh_b896c9b1f9e0，搜索"腾讯身份验证器"
const wxQrUrl = ref('')

onMounted(async () => {
  if (!tempToken) {
    router.push('/login')
    return
  }
  // 生成腾讯身份验证器小程序二维码（微信扫码跳转）
  try {
    wxQrUrl.value = await QRCode.toDataURL(
      'https://weixin.qq.com/r/qS_c7XjEg9-KrXiP9xmN',
      { width: 130, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#000', light: '#fff' } }
    )
  } catch (_) {
    // 生成失败时用外部服务兜底
    wxQrUrl.value = 'https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=https%3A%2F%2Fweixin.qq.com%2Fr%2FqS_c7XjEg9-KrXiP9xmN'
  }
})

const tempToken = sessionStorage.getItem('mfa_temp_token') || ''

function getBase(): string {
  if (axios.defaults.baseURL) return axios.defaults.baseURL
  const w = window as any
  if (w.__CONFIG__?.apiUrl) return w.__CONFIG__.apiUrl + '/api'
  if (import.meta.env.DEV) return `${location.protocol}//${location.hostname}:8080/api`
  return '/api'
}

const mfaAxios = axios.create()
mfaAxios.interceptors.request.use(cfg => {
  if (!cfg.baseURL) cfg.baseURL = getBase()
  cfg.headers.Authorization = `Bearer ${tempToken}`
  return cfg
})

// 点击"已安装"时才请求后端生成 secret，避免页面加载就跳 login
const goToScan = async () => {
  if (!tempToken) {
    router.push('/login')
    return
  }
  if (secret.value) {
    // 已经获取过，直接跳
    step.value = 'scan'
    return
  }
  loadingQR.value = true
  step.value = 'scan'
  try {
    const res = await mfaAxios.post('mfa/setup')
    const data = res.data.data
    secret.value = data.secret
    account.value = data.account || ''
    const uri = data.otpauthUri
    if (uri) {
      qrDataUrl.value = await QRCode.toDataURL(uri, {
        width: 280,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' }
      })
    }
  } catch (e: any) {
    error.value = e.response?.data?.error || '获取二维码失败，请重新登录'
    step.value = 'install'
  } finally {
    loadingQR.value = false
  }
}

onMounted(() => {
  if (!tempToken) {
    router.push('/login')
  }
  // 不在 onMounted 里请求，等用户点"已安装"再请求
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

const goLogin = () => router.push('/login')
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
  max-width: 460px;
  padding: 2.5rem;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  box-shadow: 0 4px 24px hsl(0 0% 0% / 0.08);
}
.step-header { text-align: center; margin-bottom: 1.5rem; }
.step-icon { font-size: 2.5rem; margin-bottom: 0.75rem; }
.step-header h2 { font-size: 1.4rem; font-weight: 700; margin: 0 0 0.4rem; color: hsl(var(--foreground)); }
.step-header p { font-size: 0.875rem; color: hsl(var(--muted-foreground)); margin: 0; }

/* 安装引导 */
.install-hint { text-align: center; font-size: 0.9rem; color: hsl(var(--foreground)); margin-bottom: 1.5rem; }
.install-hint strong { color: hsl(var(--primary)); }
.app-download { display: flex; align-items: center; gap: 1rem; justify-content: center; margin-bottom: 1.5rem; flex-wrap: wrap; }
.app-item { display: flex; flex-direction: column; align-items: center; gap: 6px; position: relative; }
.app-item.recommended { background: hsl(var(--primary) / 0.05); border: 1px solid hsl(var(--primary) / 0.2); border-radius: 10px; padding: 0.75rem; }
.recommend-badge { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); font-size: 0.7rem; padding: 2px 10px; border-radius: 10px; white-space: nowrap; font-weight: 600; }
.app-divider { font-size: 0.85rem; color: hsl(var(--muted-foreground)); padding: 0 0.5rem; }
.app-qr { width: 130px; height: 130px; border: 1px solid hsl(var(--border)); border-radius: 8px; }
.app-label { font-size: 0.82rem; font-weight: 600; color: hsl(var(--foreground)); }
.app-sub { font-size: 0.75rem; color: hsl(var(--muted-foreground)); }
.app-link { font-size: 0.78rem; color: hsl(var(--primary)); text-decoration: none; }
.app-link:hover { text-decoration: underline; }
.install-sub { text-align: center; font-size: 0.8rem; color: hsl(var(--muted-foreground)); margin-bottom: 1.5rem; }

/* 二维码 */
.qr-section { text-align: center; margin-bottom: 1.5rem; }
.qr-img { width: 280px; height: 280px; border-radius: 8px; border: 1px solid hsl(var(--border)); display: block; margin: 0 auto; }
.manual-toggle { margin-top: 0.75rem; font-size: 0.8rem; color: hsl(var(--primary)); cursor: pointer; }
.manual-section { margin-top: 0.75rem; background: hsl(var(--muted)); border-radius: 8px; padding: 0.75rem; text-align: left; }
.manual-row { display: flex; align-items: center; gap: 8px; margin-bottom: 0.4rem; font-size: 0.8rem; flex-wrap: wrap; }
.manual-label { color: hsl(var(--muted-foreground)); min-width: 50px; }
.manual-val { font-family: monospace; word-break: break-all; }
.btn-copy { padding: 2px 8px; font-size: 0.75rem; background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); border: none; border-radius: 4px; cursor: pointer; flex-shrink: 0; }

/* 验证码输入 */
.confirm-hint { font-size: 0.875rem; color: hsl(var(--muted-foreground)); margin-bottom: 1rem; text-align: center; }
.field { margin-bottom: 1rem; }
.code-input { width: 100%; padding: 12px; text-align: center; font-size: 1.75rem; letter-spacing: 0.5em; font-weight: 700; border: 1px solid hsl(var(--input)); border-radius: 8px; background: hsl(var(--background)); color: hsl(var(--foreground)); outline: none; box-sizing: border-box; }
.code-input:focus { border-color: hsl(var(--ring)); box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2); }

/* 按钮 */
.btn-primary { width: 100%; padding: 10px; background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); border: none; border-radius: 8px; font-size: 0.9rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: opacity 0.15s; margin-bottom: 0.5rem; }
.btn-primary:hover:not(:disabled) { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-back { width: 100%; padding: 8px; background: none; border: 1px solid hsl(var(--border)); border-radius: 8px; font-size: 0.875rem; color: hsl(var(--muted-foreground)); cursor: pointer; transition: background 0.15s; }
.btn-back:hover { background: hsl(var(--accent)); }

/* 完成 */
.done-section { text-align: center; }
.done-icon { font-size: 3rem; margin-bottom: 1rem; }
.done-section h3 { font-size: 1.25rem; font-weight: 700; margin: 0 0 0.5rem; }
.done-section p { font-size: 0.875rem; color: hsl(var(--muted-foreground)); margin-bottom: 1.5rem; }

.error-alert { background: hsl(var(--destructive) / 0.1); border: 1px solid hsl(var(--destructive) / 0.3); color: hsl(var(--destructive)); padding: 10px 14px; border-radius: 8px; font-size: 0.875rem; margin-bottom: 1rem; }
.loading { text-align: center; color: hsl(var(--muted-foreground)); padding: 2rem 0; }
.spinner { width: 14px; height: 14px; border: 2px solid hsl(var(--primary-foreground) / 0.4); border-top-color: hsl(var(--primary-foreground)); border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
