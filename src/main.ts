import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import Login from './views/Login.vue'
import ForceChangePassword from './views/ForceChangePassword.vue'
import MFASetup from './views/MFASetup.vue'
import Layout from './views/Layout.vue'
import AdminLayout from './views/AdminLayout.vue'
import Download from './views/Download.vue'
import { isAuthenticated, getUser, isAdmin } from './utils/auth'
import './styles/main.css'

// 创建路由
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: Login
    },
    {
      path: '/force-change-password',
      name: 'ForceChangePassword',
      component: ForceChangePassword,
      meta: { requiresAuth: true, skipPasswordCheck: true }
    },
    {
      path: '/mfa-setup',
      name: 'MFASetup',
      component: MFASetup
    },
    {
      path: '/',
      redirect: '/dashboard'
    },
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: Layout,
      meta: { requiresAuth: true }
    },
    {
      path: '/admin',
      name: 'Admin',
      component: AdminLayout,
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/download',
      name: 'Download',
      component: Download,
      meta: { requiresAuth: true }
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/dashboard'
    }
  ]
})

// 路由守卫 - 强制认证和密码检查
router.beforeEach((to, from, next) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const skipPasswordCheck = to.matched.some(record => record.meta.skipPasswordCheck)
  const authenticated = isAuthenticated()

  // 未认证用户访问需要认证的页面
  if (requiresAuth && !authenticated) {
    next('/login')
    return
  }

  // 已认证用户访问登录页 - 检查是否需要强制修改密码
  if (to.path === '/login' && authenticated) {
    const user = getUser()
    // 如果用户需要强制修改密码，跳转到强制修改密码页面
    if (user && user.passwordMustChange) {
      next('/force-change-password')
      return
    }
    // 否则跳转到仪表盘
    next('/dashboard')
    return
  }

  // 检查是否需要强制修改密码
  if (authenticated && !skipPasswordCheck) {
    const user = getUser()
    if (user && user.passwordMustChange) {
      if (to.path !== '/force-change-password') {
        next('/force-change-password')
        return
      }
    }
  }

  // 非管理员访问管理页面
  if (to.meta.requiresAdmin && !isAdmin()) {
    next('/dashboard')
    return
  }

  next()
})

const app = createApp(App)
app.use(router)
app.mount('#app')
