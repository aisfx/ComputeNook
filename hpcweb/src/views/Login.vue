<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <div class="logo">🖥️</div>
          <h1>HPC 管理平台</h1>
          <p>使用 LDAP 账户登录</p>
        </div>

        <form @submit.prevent="handleLogin" class="login-form">
          <div class="form-group">
            <label for="username">用户名</label>
            <input
              id="username"
              v-model="loginForm.username"
              type="text"
              placeholder="请输入用户名"
              required
              :disabled="loading"
              autocomplete="username"
            />
          </div>

          <div class="form-group">
            <label for="password">密码</label>
            <input
              id="password"
              v-model="loginForm.password"
              type="password"
              placeholder="请输入密码"
              required
              :disabled="loading"
              autocomplete="current-password"
            />
          </div>

          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" v-model="rememberMe" />
              <span>记住我</span>
            </label>
          </div>

          <button type="submit" class="btn-login" :disabled="loading">
            <span v-if="!loading">登录</span>
            <span v-else>登录中...</span>
          </button>

          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>
        </form>

        <div class="login-footer">
          <p>HPC Management Platform v1.0</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

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
      // 跳转到强制修改密码页面
      router.push('/force-change-password')
    } else {
      // 跳转到首页
      router.push('/dashboard')
    }
  } catch (error: any) {
    console.error('Login failed:', error)
    if (error.response?.status === 403) {
      // 账户被禁用
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
}

.login-container {
  width: 100%;
  max-width: 420px;
}

.login-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.login-header {
  text-align: center;
  padding: 3rem 2rem 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.logo {
  font-size: 4rem;
  margin-bottom: 1rem;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.login-header h1 {
  margin: 0 0 0.5rem 0;
  font-size: 1.8rem;
  font-weight: 700;
}

.login-header p {
  margin: 0;
  opacity: 0.9;
  font-size: 0.95rem;
}

.login-form {
  padding: 2rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #333;
  font-size: 0.95rem;
}

.form-group input[type="text"],
.form-group input[type="password"] {
  width: 100%;
  padding: 0.875rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.3s;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-group input:disabled {
  background: #f3f4f6;
  cursor: not-allowed;
}

.checkbox-group {
  margin-bottom: 2rem;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-weight: normal;
}

.checkbox-group input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.btn-login {
  width: 100%;
  padding: 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-login:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
}

.btn-login:active:not(:disabled) {
  transform: translateY(0);
}

.btn-login:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  margin-top: 1rem;
  padding: 0.875rem;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 8px;
  font-size: 0.9rem;
  text-align: center;
}

.login-footer {
  padding: 1.5rem 2rem;
  background: #f9fafb;
  text-align: center;
  border-top: 1px solid #e5e7eb;
}

.login-footer p {
  margin: 0;
  color: #6b7280;
  font-size: 0.85rem;
}

@media (max-width: 480px) {
  .login-page {
    padding: 1rem;
  }

  .login-header {
    padding: 2rem 1.5rem 1.5rem;
  }

  .login-header h1 {
    font-size: 1.5rem;
  }

  .login-form {
    padding: 1.5rem;
  }
}
</style>
