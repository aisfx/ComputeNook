<template>
  <div class="login-root" :data-theme="theme">
    <!-- Left panel -->
    <div class="login-left">
      <div class="login-brand">
        <div class="brand-logo">⚡</div>
        <h1>HPC 管理平台</h1>
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

        <form @submit.prevent="handleLogin" class="login-form">
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

          <div v-if="errorMessage" class="error-alert">
            {{ errorMessage }}
          </div>

          <button type="submit" class="submit-btn" :disabled="loading">
            <span v-if="loading" class="btn-spinner"></span>
            {{ loading ? '登录中...' : '登 录' }}
          </button>
        </form>

        <div class="login-footer">HPC Management Platform v1.0</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import '@/api/index'

const router = useRouter()
const form = ref({ username: '', password: '' })
const rememberMe = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const showPassword = ref(false)
const theme = ref<'light' | 'dark'>('light')

const toggleTheme = () => {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
  localStorage.setItem('theme', theme.value)
}

const handleLogin = async () => {
  errorMessage.value = ''
  loading.value = true
  try {
    const response = await axios.post('/login', {
      username: form.value.username,
      password: form.value.password
    })
    const { token, user } = response.data
    const storage = rememberMe.value ? localStorage : sessionStorage
    storage.setItem('token', token)
    storage.setItem('user', JSON.stringify(user))
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    router.push(user.passwordMustChange ? '/force-change-password' : '/dashboard')
  } catch (error: any) {
    if (error.response?.status === 403) {
      errorMessage.value = '账户已被禁用，请联系管理员'
    } else if (error.response?.data?.error) {
      errorMessage.value = error.response.data.error
    } else if (error.response?.status === 401) {
      errorMessage.value = '用户名或密码错误'
    } else {
      errorMessage.value = '登录失败，请检查网络连接'
    }
  } finally {
    loading.value = false
  }
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

@media (max-width: 768px) {
  .login-left { display: none; }
  .login-right { width: 100%; }
}
</style>
