<template>
  <div class="app-shell" :data-theme="theme">
    <!-- Sidebar -->
    <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <!-- Logo -->
      <div class="sidebar-header">
        <div class="sidebar-logo" @click="currentView = 'dashboard'">
          <div class="logo-icon">⚡</div>
          <span class="logo-text">HPC 平台</span>
        </div>
        <button class="sidebar-collapse-btn" @click="sidebarCollapsed = !sidebarCollapsed">
          <span>{{ sidebarCollapsed ? '→' : '←' }}</span>
        </button>
      </div>

      <!-- Nav -->
      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-section-label" v-if="!sidebarCollapsed">通用</div>
          <!-- 仪表盘 -->
          <a
            :class="['nav-item', { active: currentView === 'dashboard' }]"
            @click="currentView = 'dashboard'"
            :title="sidebarCollapsed ? '仪表盘' : ''"
          >
            <span class="nav-item-icon">🏠</span>
            <span class="nav-item-label">仪表盘</span>
          </a>

          <!-- 作业管理 -->
          <a
            :class="['nav-item', { active: currentView === 'jobs' }]"
            @click="currentView = 'jobs'"
            :title="sidebarCollapsed ? '作业管理' : ''"
          >
            <span class="nav-item-icon">⚙️</span>
            <span class="nav-item-label">作业管理</span>
          </a>

          <a
            :class="['nav-item', { active: currentView === 'shell' }]"
            @click="currentView = 'shell'"
            :title="sidebarCollapsed ? 'Web Shell' : ''"
          >
            <span class="nav-item-icon">🖥️</span>
            <span class="nav-item-label">Web Shell</span>
          </a>

          <a
            :class="['nav-item', { active: currentView === 'desktop' }]"
            @click="currentView = 'desktop'"
            :title="sidebarCollapsed ? '远程桌面' : ''"
          >
            <span class="nav-item-icon">🖱️</span>
            <span class="nav-item-label">远程桌面</span>
          </a>

          <!-- 文件管理 -->
          <a
            :class="['nav-item', { active: currentView === 'files' }]"
            @click="currentView = 'files'"
            :title="sidebarCollapsed ? '文件管理' : ''"
          >
            <span class="nav-item-icon">📁</span>
            <span class="nav-item-label">文件管理</span>
          </a>

          <!-- 报表中心 -->
          <a
            :class="['nav-item', { active: currentView === 'reports' }]"
            @click="currentView = 'reports'"
            :title="sidebarCollapsed ? '报表中心' : ''"
          >
            <span class="nav-item-icon">📈</span>
            <span class="nav-item-label">报表中心</span>
          </a>
        </div>

      </nav>

      <!-- Sidebar footer -->
      <div class="sidebar-footer">
        <div class="user-info" v-if="!sidebarCollapsed">
          <div class="user-avatar">{{ userInitial }}</div>
          <div class="user-details">
            <div class="user-name">{{ currentUser?.cnName || currentUser?.username }}</div>
            <div class="user-role">{{ isAdmin ? '管理员' : '普通用户' }}</div>
          </div>
        </div>
        <div class="user-avatar" v-else :title="currentUser?.username">{{ userInitial }}</div>
      </div>
    </aside>

    <!-- Main -->
    <div class="main-wrapper">
      <!-- Top bar -->
      <header class="topbar">
        <div class="topbar-left">
          <h1 class="page-title">{{ currentTitle }}</h1>
        </div>
        <div class="topbar-right">
          <div class="status-badge">
            <span class="status-dot"></span>
            <span>集群在线</span>
          </div>
          <!-- Theme toggle -->
          <button class="icon-btn" @click="toggleTheme" :title="theme === 'dark' ? '切换亮色' : '切换暗色'">
            <span>{{ theme === 'dark' ? '☀️' : '🌙' }}</span>
          </button>
          <!-- 报警铃铛 -->
          <AlertNotification :show-bell="true" />
          <button v-if="isAdmin" class="btn-admin" @click="goToAdmin" title="管理后台">⚙️ 管理后台</button>
          <button class="btn-admin" @click="currentView = 'download'" title="下载客户端" style="background:#10b981">⬇️ 客户端</button>
          <button class="icon-btn" @click="goToProfile" title="个人信息">
            <span>👤</span>
          </button>
          <button class="icon-btn danger" @click="handleLogout" title="退出">
            <span>🚪</span>
          </button>
        </div>
      </header>

      <!-- Content -->
      <main class="content-area" :class="{ 'content-area--noscroll': currentView === 'rack' }">
        <Dashboard v-if="currentView === 'dashboard'" @navigate="currentView = $event" />
        <JobManagement v-else-if="currentView === 'jobs'" @open-directory="handleOpenDirectory" />
        <Monitoring v-else-if="currentView === 'monitoring' && isAdmin" :active-tab="monitoringTab" @tab-change="monitoringTab = $event" />
        <RackView v-else-if="currentView === 'rack' && isAdmin" />
        <NetworkTopology v-else-if="currentView === 'network' && isAdmin" />
        <WebShell v-else-if="currentView === 'shell'" />
        <Desktop v-else-if="currentView === 'desktop'" @open-download="currentView = 'download'" />
        <FileManager ref="fileManagerRef" v-else-if="currentView === 'files'" />
        <Reports v-else-if="currentView === 'reports'" />
        <Profile v-else-if="currentView === 'profile'" />
        <Download v-else-if="currentView === 'download'" />
        <AdminUsers v-else-if="currentView === 'admin' && adminTab === 'users' && isAdmin" />
        <AdminGroups v-else-if="currentView === 'admin' && adminTab === 'groups' && isAdmin" />
        <AdminQoS v-else-if="currentView === 'admin' && adminTab === 'qos' && isAdmin" />
        <AdminAssociations v-else-if="currentView === 'admin' && adminTab === 'associations' && isAdmin" />
        <AdminHours v-else-if="currentView === 'admin' && adminTab === 'hours' && isAdmin" />
        <AdminQuota v-else-if="currentView === 'admin' && adminTab === 'quota' && isAdmin" />
        <AdminAudit v-else-if="currentView === 'admin' && adminTab === 'audit' && isAdmin" />
        <AdminCMDB v-else-if="currentView === 'admin' && adminTab === 'cmdb' && isAdmin" />
        <AdminSlurmAccounts v-else-if="currentView === 'admin' && adminTab === 'slurm-accounts' && isAdmin" />
        <AdminSlurmUsers v-else-if="currentView === 'admin' && adminTab === 'slurm-users' && isAdmin" />
        <div v-else-if="!isAdmin && (currentView === 'monitoring' || currentView === 'admin' || currentView === 'rack' || currentView === 'network')" class="no-permission">
          <div class="no-perm-icon">🔒</div>
          <h3>无访问权限</h3>
          <p>请联系管理员获取权限</p>
        </div>
      </main>
    </div>

    <!-- AI 悬浮助手 -->
    <AIAssistant />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, provide, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import Dashboard from './Dashboard.vue'
import JobManagement from './JobManagement.vue'
import WebShell from './WebShell.vue'
import Desktop from './Desktop.vue'
import Download from './Download.vue'
import FileManager from './FileManager.vue'
import Reports from './Reports.vue'
import AdminUsers from './AdminUsers.vue'
import AdminGroups from './AdminGroups.vue'
import AdminQoS from './AdminQoS.vue'
import AdminHours from './AdminHours.vue'
import AdminQuota from './AdminQuota.vue'
import AdminAudit from './AdminAudit.vue'
import AdminSlurmAccounts from './AdminSlurmAccounts.vue'
import AdminSlurmUsers from './AdminSlurmUsers.vue'
import AdminAssociations from './AdminAssociations.vue'
import Monitoring from './Monitoring.vue'
import Profile from './Profile.vue'
import RackView from './RackView.vue'
import NetworkTopology from './NetworkTopology.vue'
import AIAssistant from '../components/AIAssistant.vue'
import AlertNotification from '../components/AlertNotification.vue'
import { getUser, logout, setupAxiosInterceptors, isAdmin as checkAdmin } from '../utils/auth'

const router = useRouter()
const currentView = ref('dashboard')
const jobManagementTab = ref('info')
const jobsExpanded = ref(true)
const shellExpanded = ref(true)
const monitoringExpanded = ref(true)
const monitoringTab = ref('cluster')
const adminTab = ref('users')
const adminExpanded = ref(false)
const sidebarCollapsed = ref(false)
const currentUser = ref<any>(null)
const isAdmin = ref(false)
const fileManagerRef = ref<any>(null)
const theme = ref<'light' | 'dark'>('light')

provide('jobManagementTab', jobManagementTab)

const userInitial = computed(() => {
  const name = currentUser.value?.cnName || currentUser.value?.username || '?'
  return name.charAt(0).toUpperCase()
})

const toggleTheme = () => {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
  localStorage.setItem('theme', theme.value)
}

const handleOpenDirectory = (path: string) => {
  currentView.value = 'files'
  setTimeout(() => {
    if (fileManagerRef.value?.navigateToPath) {
      fileManagerRef.value.navigateToPath(path)
    }
  }, 100)
}

const monitoringSubItems = [
  { id: 'cluster', label: '集群状态' },
  { id: 'alerts', label: '告警规则' },
]

const otherMenuItems = [
  { id: 'files', label: '文件管理', icon: '-' },
  { id: 'reports', label: '报表中心', icon: '~' },
]

const jobTabs = [
  { id: 'info', label: '作业列表' }
]

const adminTabs = [
  { id: 'group-user', label: '用户管理', isGroup: true },
  { id: 'users', label: '用户管理', parent: 'group-user' },
  { id: 'groups', label: '用户组管理', parent: 'group-user' },
  { id: 'group-account', label: '账户管理', isGroup: true },
  { id: 'slurm-accounts', label: 'Slurm账户', parent: 'group-account' },
  { id: 'slurm-users', label: 'Slurm用户', parent: 'group-account' },
  { id: 'group-resource', label: '资源管理', isGroup: true },
  { id: 'associations', label: '资源绑定', parent: 'group-resource' },
  { id: 'qos', label: 'QoS配置', parent: 'group-resource' },
  { id: 'hours', label: '机时管理', parent: 'group-resource' },
  { id: 'quota', label: '存储配额', parent: 'group-resource' },
  { id: 'audit', label: '数据审计' }
]

const currentTitle = computed(() => {
  if (currentView.value === 'admin') {
    const tab = adminTabs.find(t => t.id === adminTab.value)
    return tab?.label || '系统管理'
  }
  if (currentView.value === 'jobs') {
    const tab = jobTabs.find(t => t.id === jobManagementTab.value)
    return tab?.label || '作业管理'
  }
  const all = [
    { id: 'dashboard', label: '仪表盘' },
    ...otherMenuItems,
    { id: 'monitoring', label: '集群监控' },
    { id: 'rack', label: '机柜管理' },
    { id: 'profile', label: '个人信息' },
    { id: 'custom-dashboard', label: '自定义看板' },
  ]
  if (currentView.value === 'monitoring') {
    const sub = monitoringSubItems.find(s => s.id === monitoringTab.value)
    return sub ? `集群监控 · ${sub.label}` : '集群监控'
  }
  return all.find(i => i.id === currentView.value)?.label || ''
})

const handleLogout = async () => {
  if (confirm('确定要退出登录吗？')) {
    await logout()
    router.push('/login')
  }
}

const goToProfile = () => { currentView.value = 'profile' }
const goToAdmin = () => { router.push('/admin') }

// 页面标题映射，用于上报可读名称
const PAGE_TITLES: Record<string, string> = {
  dashboard: '仪表盘', shell: 'Web Shell', desktop: '远程桌面',
  jobs: '作业管理', files: '文件管理', reports: '报表中心',
  monitoring: '集群监控', rack: '机柜管理', network: '网络拓扑',
  profile: '个人信息', download: '客户端下载', admin: '系统管理',
}

// 上报页面访问，防抖避免快速切换时重复上报
let pageViewTimer: ReturnType<typeof setTimeout> | null = null
const reportPageView = (page: string) => {
  if (pageViewTimer) clearTimeout(pageViewTimer)
  pageViewTimer = setTimeout(() => {
    const title = PAGE_TITLES[page] || page
    axios.post('/audit/page-view', { page, title }).catch(() => {/* 静默失败 */})
  }, 500)
}

watch(currentView, (page) => {
  reportPageView(page)
})

onMounted(() => {
  setupAxiosInterceptors()
  currentUser.value = getUser()
  isAdmin.value = checkAdmin()
  const saved = localStorage.getItem('theme') as 'light' | 'dark' | null
  if (saved) theme.value = saved
})
</script>

<style scoped>
/* ===== App Shell ===== */
.app-shell {
  display: flex;
  height: 100vh;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  overflow: hidden;
}

/* ===== Sidebar ===== */
.sidebar {
  width: 220px;
  min-width: 220px;
  background: hsl(var(--sidebar-bg));
  border-right: 1px solid hsl(var(--sidebar-border));
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease, min-width 0.2s ease;
  overflow: hidden;
}

.sidebar.collapsed {
  width: 56px;
  min-width: 56px;
}

/* Header */
.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  height: 56px;
  border-bottom: 1px solid hsl(var(--sidebar-border));
  flex-shrink: 0;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  overflow: hidden;
}

.logo-icon {
  width: 28px;
  height: 28px;
  background: hsl(var(--sidebar-primary));
  color: hsl(var(--sidebar-primary-foreground));
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.logo-text {
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--sidebar-foreground));
  white-space: nowrap;
}

.sidebar-collapse-btn {
  background: none;
  border: none;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  font-size: 12px;
  flex-shrink: 0;
  transition: background 0.15s;
}
.sidebar-collapse-btn:hover { background: hsl(var(--sidebar-accent)); }

/* Nav */
.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.nav-section { margin-bottom: 2px; }

.nav-section-label {
  padding: 6px 12px 2px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: hsl(var(--muted-foreground));
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  margin: 1px 6px;
  border-radius: 6px;
  cursor: pointer;
  color: hsl(var(--sidebar-foreground));
  font-size: 0.85rem;
  font-weight: 500;
  transition: background 0.15s, color 0.15s;
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
}

.nav-item:hover {
  background: hsl(var(--sidebar-accent));
  color: hsl(var(--sidebar-accent-foreground));
}

.nav-item.active {
  background: hsl(var(--sidebar-primary));
  color: hsl(var(--sidebar-primary-foreground));
}

.nav-item-icon {
  font-size: 14px;
  width: 18px;
  text-align: center;
  flex-shrink: 0;
}

.nav-item-label { flex: 1; }

.nav-item-chevron {
  font-size: 10px;
  color: hsl(var(--muted-foreground));
}

/* Sub nav */
.nav-sub {
  margin: 1px 6px 2px 26px;
}

.nav-sub-group {
  padding: 4px 8px 2px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: hsl(var(--muted-foreground));
}

.nav-sub-item {
  display: block;
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 0.82rem;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  margin: 1px 0;
}
.nav-sub-item:hover { background: hsl(var(--sidebar-accent)); color: hsl(var(--sidebar-accent-foreground)); }
.nav-sub-item.active { color: hsl(var(--sidebar-foreground)); font-weight: 500; }

/* Footer */
.sidebar-footer {
  padding: 12px;
  border-top: 1px solid hsl(var(--sidebar-border));
  flex-shrink: 0;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow: hidden;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: hsl(var(--sidebar-primary));
  color: hsl(var(--sidebar-primary-foreground));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 600;
  flex-shrink: 0;
}

.user-details { overflow: hidden; }

.user-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: hsl(var(--sidebar-foreground));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role {
  font-size: 0.7rem;
  color: hsl(var(--muted-foreground));
}

/* ===== Main ===== */
.main-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

/* Topbar */
.topbar {
  height: 56px;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--background));
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  flex-shrink: 0;
  gap: 16px;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.page-title {
  font-size: 1rem;
  font-weight: 600;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.page-tabs {
  display: flex;
  gap: 4px;
}

.page-tab {
  padding: 5px 12px;
  border: none;
  background: none;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  transition: all 0.15s;
}
.page-tab:hover { background: hsl(var(--accent)); color: hsl(var(--accent-foreground)); }
.page-tab.active { background: hsl(var(--secondary)); color: hsl(var(--secondary-foreground)); font-weight: 600; }

.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: hsl(var(--muted));
  border-radius: 20px;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: hsl(var(--success));
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.icon-btn {
  width: 34px;
  height: 34px;
  border: none;
  background: none;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  color: hsl(var(--muted-foreground));
  transition: background 0.15s, color 0.15s;
}
.icon-btn:hover { background: hsl(var(--accent)); color: hsl(var(--accent-foreground)); }
.icon-btn.danger:hover { background: hsl(var(--destructive) / 0.1); color: hsl(var(--destructive)); }

.btn-admin {
  padding: 5px 12px;
  border: 1px solid hsl(var(--sidebar-primary) / 0.4);
  background: hsl(var(--sidebar-primary) / 0.08);
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  color: hsl(var(--sidebar-primary));
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.btn-admin:hover { background: hsl(var(--sidebar-primary) / 0.15); }

/* Content */
.content-area {
  flex: 1;
  overflow-y: auto;
  background: hsl(var(--background));
  padding: 24px;
}
.content-area--noscroll {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* No permission */
.no-permission {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
  gap: 12px;
}
.no-perm-icon { font-size: 3rem; opacity: 0.3; }
.no-permission h3 { font-size: 1.1rem; color: hsl(var(--foreground)); }
.no-permission p { color: hsl(var(--muted-foreground)); font-size: 0.875rem; }

/* Collapsed sidebar hide labels */
.sidebar.collapsed .nav-item-label,
.sidebar.collapsed .nav-item-chevron,
.sidebar.collapsed .nav-section-label,
.sidebar.collapsed .nav-sub,
.sidebar.collapsed .logo-text,
.sidebar.collapsed .user-details {
  display: none;
}

.sidebar.collapsed .nav-item {
  justify-content: center;
  padding: 8px;
  margin: 1px 6px;
}

.sidebar.collapsed .sidebar-collapse-btn { margin: 0 auto; }
</style>
