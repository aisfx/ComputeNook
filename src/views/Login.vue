<template>
  <div class="login-page">
    <div class="login-container">
      <Card class="login-card">
        <div class="login-header">
          <div class="logo">🖥️</div>
          <h1>HPC 管理平台</h1>
          <p class="text-muted">使用 LDAP 账户登录</p>
        </div>

        <form @submit.prevent="handleLogin" class="login-form">
          <div class="form-group">
            <label class="form-label" for="username">用户名</label>
            <input
              id="username"
              v-model="loginForm.username"
              type="text"
              class="form-input"
              placeholder="请输入用户名"
              required
              :disabled="loading"
              autocomplete="username"
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="password">密码</label>
            <input
              id="password"
              v-model="loginForm.password"
              type="password"
              class="form-input"
              placeholder="请输入密码"
              required
              :disabled="loading"
              autocomplete="current-password"
            />
          </div>

          <div class="form-group">
            <label class="d-flex align-center gap-2">
              <input type="checkbox" v-model="rememberMe" />
              <span>记住我</span>
            </label>
          </div>

          <Button 
            type="submit" 
            variant="primary" 
            :disabled="loading"
            :loading="loading"
            class="w-full"
          >
            登录
          </Button>

          <div v-if="errorMessage" class="alert alert-error mt-3">
            {{ errorMessage }}
          </div>
        </form>

        <div class="login-footer">
          <p class="text-muted text-sm">HPC Management Platform v1.0</p>
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { Button, Card } from '@/components/common'

const router = useRouter()

const loginForm = ref({
  username: '',
  password: ''
})

const rememberMe = ref(false)
const loading = ref(false)
const errorMessage = ref('')

const API_BASE_URL = 'http://localhost:8080/api'

const handleLogin = async () => {
  errorMessage.value = ''
  loading.value = true

  try {
    const response = await axios.post(`${API_BASE_URL}/login`, {
      username: loginForm.value.username,
      password: loginForm.value.password
    })

    const { token, user } = response.data

    // 保存 token 和用户信息
    if (rememberMe.value) {
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
    } else {
      sessionStorage.setItem('token', token)
      sessionStorage.setItem('user', JSON.stringify(user))
    }

    // 设置 axios 默认 header
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

    // 检查是否需要强制修改密码
    if (user.passwordMustChange) {
      router.push('/force-change-password')
    } else {
      router.push('/dashboard')
    }
  } catch (error: any) {
    console.error('Login failed:', error)
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
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
  padding: var(--spacing-xl);
}

.login-container {
  width: 100%;
  max-width: 420px;
}

.login-card {
  overflow: hidden;
}

.login-header {
  text-align: center;
  padding: var(--spacing-2xl) var(--spacing-xl);
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
  color: var(--color-white);
}

.logo {
  font-size: 4rem;
  margin-bottom: var(--spacing-lg);
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.login-header h1 {
  margin: 0 0 var(--spacing-sm) 0;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
}

.login-form {
  padding: var(--spacing-xl);
}

.login-footer {
  padding: var(--spacing-lg) var(--spacing-xl);
  background: var(--color-bg-secondary);
  text-align: center;
  border-top: 1px solid var(--color-border);
}

@media (max-width: 480px) {
  .login-page {
    padding: var(--spacing-md);
  }

  .login-header {
    padding: var(--spacing-xl) var(--spacing-lg);
  }

  .login-header h1 {
    font-size: var(--font-size-xl);
  }

  .login-form {
    padding: var(--spacing-lg);
  }
}
</style>
