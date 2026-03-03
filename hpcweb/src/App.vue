<template>
  <router-view v-if="!isAuthenticated" />
  <div v-else class="app">
    <aside class="sidebar">
      <div class="logo">
        <h1>🖥️ HPC 平台</h1>
        <div class="welcome-text">
          欢迎您，<span class="username">{{ currentUser?.cnName || currentUser?.username || '用户' }}</span>
        </div>
      </div>
      <nav class="nav-menu">
        <a 
          v-for="item in menuItems" 
          :key="item.id"
          :class="['nav-item', { active: currentView === item.id }]"
          @click="currentView = item.id"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-text">{{ item.label }}</span>
        </a>
        
        <!-- 系统管理二级导航 -->
        <div v-if="currentView === 'admin' && isAdmin" class="sub-menu">
          <template v-for="tab in adminTabs" :key="tab.id">
            <!-- 分组标题 -->
            <div v-if="tab.isGroup" class="sub-menu-group-title">
              {{ tab.label }}
            </div>
            <!-- 子菜单项 -->
            <a 
              v-else-if="tab.parent"
              :class="['sub-menu-item', { active: adminTab === tab.id }]"
              @click="adminTab = tab.id"
            >
              {{ tab.label }}
            </a>
            <!-- 独立菜单项 -->
            <a 
              v-else
              :class="['sub-menu-item', 'sub-menu-item-standalone', { active: adminTab === tab.id }]"
              @click="adminTab = tab.id"
            >
              {{ tab.label }}
            </a>
          </template>
        </div>
      </nav>
      <div class="sidebar-footer">
        <!-- 退出按钮移到右上角，这里留空或放其他内容 -->
      </div>
    </aside>

    <main class="main-container">
      <header class="top-header">
        <div class="header-title-section">
          <h2>{{ currentTitle }}</h2>
          <!-- 作业管理二级导航 -->
          <div v-if="currentView === 'jobs'" class="sub-nav">
            <button 
              v-for="tab in jobTabs" 
              :key="tab.id"
              :class="['sub-nav-btn', { active: jobManagementTab === tab.id }]"
              @click="jobManagementTab = tab.id"
            >
              {{ tab.label }}
            </button>
          </div>
        </div>
        <div class="header-actions">
          <span class="cluster-status">集群状态: <span class="status-online">在线</span></span>
          <span class="divider">|</span>
          <a class="profile-link" @click="goToProfile">
            <span class="profile-icon">👤</span>
            <span>个人信息</span>
          </a>
          <span class="divider">|</span>
          <button class="btn-logout-header" @click="handleLogout">
            <span class="logout-icon">🚪</span>
            <span>退出</span>
          </button>
        </div>
      </header>

      <div class="content-area">
        <Dashboard v-if="currentView === 'dashboard'" />
        <JobManagement v-else-if="currentView === 'jobs'" @open-directory="handleOpenDirectory" />
        <Monitoring v-else-if="currentView === 'monitoring' && isAdmin" />
        <WebShell v-else-if="currentView === 'shell'" />
        <Desktop v-else-if="currentView === 'desktop'" />
        <FileManager ref="fileManagerRef" v-else-if="currentView === 'files'" />
        <Reports v-else-if="currentView === 'reports'" />
        <Profile v-else-if="currentView === 'profile'" />
        <AdminUsers v-else-if="currentView === 'admin' && adminTab === 'users' && isAdmin" />
        <AdminGroups v-else-if="currentView === 'admin' && adminTab === 'groups' && isAdmin" />
        <AdminQoS v-else-if="currentView === 'admin' && adminTab === 'qos' && isAdmin" />
        <AdminAssociations v-else-if="currentView === 'admin' && adminTab === 'associations' && isAdmin" />
        <AdminHours v-else-if="currentView === 'admin' && adminTab === 'hours' && isAdmin" />
        <AdminQuota v-else-if="currentView === 'admin' && adminTab === 'quota' && isAdmin" />
        <AdminAudit v-else-if="currentView === 'admin' && adminTab === 'audit' && isAdmin" />
        <AdminSlurmAccounts v-else-if="currentView === 'admin' && adminTab === 'slurm-accounts' && isAdmin" />
        <AdminSlurmUsers v-else-if="currentView === 'admin' && adminTab === 'slurm-users' && isAdmin" />
        <!-- 无权限提示 -->
        <div v-else-if="!isAdmin && (currentView === 'monitoring' || currentView === 'admin')" class="no-permission">
          <div class="no-permission-icon">🔒</div>
          <h3>无访问权限</h3>
          <p>您没有权限访问此页面，请联系管理员。</p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, provide, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Dashboard from './views/Dashboard.vue'
import JobManagement from './views/JobManagement.vue'
import WebShell from './views/WebShell.vue'
import Desktop from './views/Desktop.vue'
import FileManager from './views/FileManager.vue'
import Reports from './views/Reports.vue'
import AdminUsers from './views/AdminUsers.vue'
import AdminGroups from './views/AdminGroups.vue'
import AdminQoS from './views/AdminQoS.vue'
import AdminHours from './views/AdminHours.vue'
import AdminQuota from './views/AdminQuota.vue'
import AdminAudit from './views/AdminAudit.vue'
import AdminSlurmAccounts from './views/AdminSlurmAccounts.vue'
import AdminSlurmUsers from './views/AdminSlurmUsers.vue'
import AdminAssociations from './views/AdminAssociations.vue'
import Monitoring from './views/Monitoring.vue'
import Profile from './views/Profile.vue'
import { isAuthenticated as checkAuth, getUser, logout, setupAxiosInterceptors, isAdmin as checkAdmin } from './utils/auth'

const router = useRouter()
const currentView = ref('dashboard')
const jobManagementTab = ref('info')
const adminTab = ref('users') // 管理员子页面，默认为用户管理
const currentUser = ref<any>(null)
const isAuthenticated = ref(false)
const isAdmin = ref(false)
const fileManagerRef = ref<any>(null) // 文件管理器引用

// 提供给子组件使用
provide('jobManagementTab', jobManagementTab)

// 处理打开目录事件
const handleOpenDirectory = (path: string) => {
  // 切换到文件管理视图
  currentView.value = 'files'
  
  // 等待组件渲染后再调用导航方法
  setTimeout(() => {
    if (fileManagerRef.value && fileManagerRef.value.navigateToPath) {
      fileManagerRef.value.navigateToPath(path)
    }
  }, 100)
}

const menuItems = computed(() => {
  const items = [
    { id: 'dashboard', label: '仪表盘', icon: '📊' },
    { id: 'jobs', label: '作业管理', icon: '📋' },
    { id: 'shell', label: 'Web Shell', icon: '💻' },
    { id: 'desktop', label: '远程桌面', icon: '🖥️' },
    { id: 'files', label: '文件管理', icon: '📁' },
    { id: 'reports', label: '报表中心', icon: '📑' }
  ]
  
  // 只有管理员才能看到集群监控和系统管理
  if (isAdmin.value) {
    items.splice(2, 0, { id: 'monitoring', label: '集群监控', icon: '📈' })
    items.push({ id: 'admin', label: '系统管理', icon: '⚙️' })
  }
  
  return items
})

const jobTabs = [
  { id: 'info', label: '作业列表' },
  { id: 'submit', label: '提交作业' },
  { id: 'templates', label: '作业模板' }
]

const adminTabs = [
  // 用户管理分组
  { id: 'group-user', label: '用户管理', isGroup: true },
  { id: 'users', label: '用户管理', parent: 'group-user' },
  { id: 'groups', label: '用户组管理', parent: 'group-user' },
  
  // 账户管理分组
  { id: 'group-account', label: '账户管理', isGroup: true },
  { id: 'slurm-accounts', label: 'Slurm账户', parent: 'group-account' },
  { id: 'slurm-users', label: 'Slurm用户', parent: 'group-account' },
  
  // 资源管理分组
  { id: 'group-resource', label: '资源管理', isGroup: true },
  { id: 'associations', label: '资源绑定', parent: 'group-resource' },
  { id: 'qos', label: 'QoS配置', parent: 'group-resource' },
  { id: 'hours', label: '机时管理', parent: 'group-resource' },
  { id: 'quota', label: '存储配额', parent: 'group-resource' },
  
  // 数据审计（独立）
  { id: 'audit', label: '数据审计' }
]

const currentTitle = computed(() => {
  if (currentView.value === 'admin') {
    const tab = adminTabs.find(t => t.id === adminTab.value)
    return `系统管理 - ${tab?.label || ''}`
  }
  return menuItems.value.find(item => item.id === currentView.value)?.label || ''
})

const handleLogout = () => {
  if (confirm('确定要退出登录吗？')) {
    logout()
    router.push('/login')
  }
}

const goToProfile = () => {
  currentView.value = 'profile'
}

onMounted(() => {
  // 设置 axios 拦截器
  setupAxiosInterceptors()
  
  // 检查登录状态
  isAuthenticated.value = checkAuth()
  if (isAuthenticated.value) {
    currentUser.value = getUser()
    isAdmin.value = checkAdmin()
  } else {
    router.push('/login')
  }
})
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app {
  display: flex;
  height: 100vh;
  background: #f5f7fa;
}

.sidebar {
  width: 250px;
  background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 20px rgba(0, 0, 0, 0.15);
  position: relative;
  z-index: 100;
}

.logo {
  padding: 1.5rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo h1 {
  font-size: 1.3rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.welcome-text {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.9);
  margin-top: 0.5rem;
}

.username {
  color: #10b981;
  font-weight: 600;
}

.nav-menu {
  flex: 1;
  padding: 1rem 0;
  overflow-y: auto;
}

.nav-menu::-webkit-scrollbar {
  width: 6px;
}

.nav-menu::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

.nav-menu::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.nav-menu::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 0.75rem 1.5rem;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.25s ease;
  text-decoration: none;
  border-radius: 8px;
  margin: 0.2rem 0.75rem;
  position: relative;
  overflow: hidden;
}

.nav-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: white;
  transform: translateX(-4px);
  transition: transform 0.25s ease;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  transform: translateX(2px);
}

.nav-item:hover::before {
  transform: translateX(0);
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-weight: 600;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
}

.nav-item.active::before {
  transform: translateX(0);
  background: linear-gradient(to bottom, #fff, rgba(255, 255, 255, 0.7));
}

.nav-icon {
  font-size: 1.5rem;
  margin-right: 1rem;
}

.nav-text {
  font-size: 1rem;
}

.sub-menu {
  margin-top: 0.25rem;
  margin-bottom: 0.5rem;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  padding: 0.5rem 0;
}

.sub-menu-group-title {
  font-size: 0.7rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.5rem 1.5rem 0.25rem 1.5rem;
  margin-top: 0.5rem;
  position: relative;
}

.sub-menu-group-title:first-child {
  margin-top: 0;
}

.sub-menu-group-title::before {
  content: '';
  position: absolute;
  left: 1.5rem;
  right: 1.5rem;
  bottom: 0;
  height: 1px;
  background: linear-gradient(to right, rgba(255, 255, 255, 0.2), transparent);
}

.sub-menu-item {
  display: flex;
  align-items: center;
  padding: 0.65rem 1.5rem;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
  font-size: 0.9rem;
  border-radius: 6px;
  margin: 0.15rem 0.75rem;
  position: relative;
}

.sub-menu-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 0;
  background: white;
  border-radius: 0 2px 2px 0;
  transition: height 0.2s ease;
}

.sub-menu-item:hover {
  background: rgba(255, 255, 255, 0.15);
  color: white;
  transform: translateX(2px);
}

.sub-menu-item:hover::before {
  height: 60%;
}

.sub-menu-item.active {
  background: rgba(255, 255, 255, 0.25);
  color: white;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.sub-menu-item.active::before {
  height: 100%;
  background: linear-gradient(to bottom, #fff, rgba(255, 255, 255, 0.8));
}

.sub-menu-item-standalone {
  margin-top: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  font-weight: 500;
}

.sub-menu-item-standalone:hover {
  background: rgba(255, 255, 255, 0.18);
}

.sub-menu-item-standalone.active {
  background: rgba(255, 255, 255, 0.28);
}

.sidebar-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  min-height: 60px;
}

.main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.top-header {
  background: white;
  padding: 1rem 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title-section {
  flex: 1;
}

.top-header h2 {
  font-size: 1.3rem;
  color: #333;
  margin-bottom: 0.25rem;
}

.sub-nav {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.sub-nav-btn {
  padding: 0.5rem 1rem;
  background: #f3f4f6;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  color: #6b7280;
  transition: all 0.3s;
}

.sub-nav-btn:hover {
  background: #e5e7eb;
}

.sub-nav-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.cluster-status {
  font-size: 0.9rem;
  color: #666;
}

.status-online {
  color: #10b981;
  font-weight: 600;
}

.divider {
  color: #d1d5db;
  font-size: 1rem;
}

.profile-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #667eea;
  font-size: 0.9rem;
  cursor: pointer;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  transition: all 0.3s;
}

.profile-link:hover {
  background: #f3f4f6;
  color: #764ba2;
}

.profile-icon {
  font-size: 1.2rem;
}

.btn-logout-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  color: #ef4444;
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  transition: all 0.3s;
}

.btn-logout-header:hover {
  background: #fee2e2;
  color: #dc2626;
}

.logout-icon {
  font-size: 1.2rem;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  background: #f5f7fa;
}

.no-permission {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
  min-height: 400px;
}

.no-permission-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.no-permission h3 {
  margin: 0 0 0.5rem 0;
  color: #374151;
  font-size: 1.5rem;
}

.no-permission p {
  color: #6b7280;
  font-size: 1rem;
}
</style>
