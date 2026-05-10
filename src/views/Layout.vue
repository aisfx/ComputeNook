<template>
  <div class="app-shell" :data-theme="theme">
    <!-- 移动端遮罩 -->
    <div class="sidebar-overlay" :class="{ active: mobileMenuOpen }" @click="mobileMenuOpen = false"></div>

    <!-- Sidebar -->
    <aside class="sidebar" :class="{ collapsed: sidebarCollapsed, 'mobile-open': mobileMenuOpen }">
      <!-- Logo -->
      <div class="sidebar-header">
        <div class="sidebar-logo" @click="currentView = 'dashboard'; mobileMenuOpen = false">
          <div class="logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
          <span class="logo-text">算力小筑</span>
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
            @click="navigate('dashboard')"
            :title="sidebarCollapsed ? '仪表盘' : ''"
          >
            <span class="nav-item-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </span>
            <span class="nav-item-label">仪表盘</span>
          </a>

          <!-- 作业管理 -->
          <a
            :class="['nav-item', { active: currentView === 'jobs' }]"
            @click="navigate('jobs')"
            :title="sidebarCollapsed ? '作业管理' : ''"
          >
            <span class="nav-item-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </span>
            <span class="nav-item-label">作业管理</span>
          </a>

          <a
            :class="['nav-item', { active: currentView === 'shell' }]"
            @click="navigate('shell')"
            :title="sidebarCollapsed ? 'Web Shell' : ''"
          >
            <span class="nav-item-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
            </span>
            <span class="nav-item-label">Web Shell</span>
          </a>

          <a
            :class="['nav-item', { active: currentView === 'desktop' }]"
            @click="navigate('desktop')"
            :title="sidebarCollapsed ? '远程桌面' : ''"
          >
            <span class="nav-item-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </span>
            <span class="nav-item-label">远程桌面</span>
          </a>

          <!-- 文件管理 -->
          <a
            :class="['nav-item', { active: currentView === 'files' }]"
            @click="navigate('files')"
            :title="sidebarCollapsed ? '文件管理' : ''"
          >
            <span class="nav-item-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            </span>
            <span class="nav-item-label">文件管理</span>
          </a>

          <!-- 镜像仓库 -->
          <a
            :class="['nav-item', { active: currentView === 'registry' }]"
            @click="navigate('registry')"
            :title="sidebarCollapsed ? '镜像仓库' : ''"
          >
            <span class="nav-item-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
            </span>
            <span class="nav-item-label">镜像仓库</span>
          </a>

          <!-- 报表中心 -->
          <a
            :class="['nav-item', { active: currentView === 'reports' }]"
            @click="navigate('reports')"
            :title="sidebarCollapsed ? '报表中心' : ''"
          >
            <span class="nav-item-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            </span>
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
          <!-- 移动端汉堡菜单 -->
          <button class="mobile-menu-btn" @click="mobileMenuOpen = !mobileMenuOpen" aria-label="菜单">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <h1 class="page-title">{{ currentTitle }}</h1>
        </div>
        <div class="topbar-right">
          <div class="status-badge">
            <span class="status-dot"></span>
            <span class="status-text">集群在线</span>
          </div>
          <!-- Theme toggle -->
          <button class="icon-btn theme-cycle-btn" @click="cycleTheme" :title="themeLabel">
            <span>{{ themeIcon }}</span>
          </button>
          <!-- 报警铃铛 -->
          <AlertNotification :show-bell="true" />
          <button v-if="isAdmin" class="btn-admin" @click="goToAdmin" title="管理后台">⚙️ <span class="btn-text">管理后台</span></button>
          <button class="btn-admin btn-download" @click="navigate('download')" title="下载客户端">⬇️ <span class="btn-text">客户端</span></button>
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
        <JobManagement v-else-if="currentView === 'jobs'" @open-directory="handleOpenDirectory" @go-registry="currentView = 'registry'" @exec-container="currentView = 'shell'" />
        <Monitoring v-else-if="currentView === 'monitoring' && isAdmin" :active-tab="monitoringTab" @tab-change="monitoringTab = $event" />
        <RackView v-else-if="currentView === 'rack' && isAdmin" />
        <NetworkTopology v-else-if="currentView === 'network' && isAdmin" />
        <WebShell v-else-if="currentView === 'shell'" />
        <Desktop v-else-if="currentView === 'desktop'" @open-download="currentView = 'download'" />
        <FileManager ref="fileManagerRef" v-else-if="currentView === 'files'" />
        <Registry v-else-if="currentView === 'registry'" />
        <AITasks v-else-if="currentView === 'ai-tasks'" />
        <Reports v-else-if="currentView === 'reports'" />
        <Profile v-else-if="currentView === 'profile'" />
        <Download v-else-if="currentView === 'download'" @go-desktop="navigate('desktop')" @go-files="navigate('files')" />
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
import Registry from './Registry.vue'
import AITasks from './AITasks.vue'
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
import { dialog } from '../utils/dialog'

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
const mobileMenuOpen = ref(false)
const currentUser = ref<any>(null)
const isAdmin = ref(false)
const fileManagerRef = ref<any>(null)
const theme = ref<'light' | 'dark' | 'ocean'>('light')

provide('jobManagementTab', jobManagementTab)

// 导航并关闭移动端菜单
const navigate = (view: string) => {
  currentView.value = view
  mobileMenuOpen.value = false
}

const userInitial = computed(() => {
  const name = currentUser.value?.cnName || currentUser.value?.username || '?'
  return name.charAt(0).toUpperCase()
})

const THEMES: Array<'light' | 'dark' | 'ocean'> = ['light', 'dark', 'ocean']
const THEME_ICONS: Record<string, string> = { light: '🌙', dark: '🌊', ocean: '☀️' }
const THEME_LABELS: Record<string, string> = { light: '切换暗色', dark: '切换海洋', ocean: '切换亮色' }

const themeIcon = computed(() => THEME_ICONS[theme.value])
const themeLabel = computed(() => THEME_LABELS[theme.value])

const cycleTheme = () => {
  const idx = THEMES.indexOf(theme.value)
  theme.value = THEMES[(idx + 1) % THEMES.length]
  localStorage.setItem('theme', theme.value)
  document.documentElement.setAttribute('data-theme', theme.value)
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
    { id: 'registry', label: '镜像仓库' },
  ]
  if (currentView.value === 'monitoring') {
    const sub = monitoringSubItems.find(s => s.id === monitoringTab.value)
    return sub ? `集群监控 · ${sub.label}` : '集群监控'
  }
  return all.find(i => i.id === currentView.value)?.label || ''
})

const handleLogout = async () => {
  if (await dialog.confirm('确定要退出登录吗？', { title: '退出登录' })) {
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
  registry: '镜像仓库',
  'ai-tasks': 'AI 作业',
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
  const saved = localStorage.getItem('theme') as 'light' | 'dark' | 'ocean' | null
  if (saved && ['light', 'dark', 'ocean'].includes(saved)) theme.value = saved as 'light' | 'dark' | 'ocean'
  document.documentElement.setAttribute('data-theme', theme.value)
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

/* ===== 移动端遮罩 ===== */
.sidebar-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 199;
  backdrop-filter: blur(2px);
}
.sidebar-overlay.active { display: block; }

/* ===== 移动端汉堡按钮 ===== */
.mobile-menu-btn {
  display: none;
  width: 34px;
  height: 34px;
  border: none;
  background: none;
  border-radius: 6px;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  color: hsl(var(--foreground));
  flex-shrink: 0;
  transition: background 0.15s;
}
.mobile-menu-btn:hover { background: hsl(var(--accent)); }

/* ===== Sidebar ===== */
.sidebar {
  width: 220px;
  min-width: 220px;
  background: hsl(var(--sidebar-bg));
  border-right: 1px solid hsl(var(--sidebar-border));
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease, min-width 0.2s ease, transform 0.25s ease;
  overflow: hidden;
  z-index: 200;
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
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: #ffffff;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
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
  background: hsl(var(--sidebar-accent));
  color: hsl(var(--sidebar-foreground));
  font-weight: 600;
  box-shadow: inset 3px 0 0 hsl(262 83% 58%);
}

.nav-item-icon {
  width: 18px;
  text-align: center;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-item-label { flex: 1; }

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
  padding: 0 16px;
  flex-shrink: 0;
  gap: 8px;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.page-title {
  font-size: 1rem;
  font-weight: 600;
  color: hsl(var(--foreground));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
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
  flex-shrink: 0;
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
  padding: 5px 10px;
  border: 1px solid hsl(var(--sidebar-primary) / 0.4);
  background: hsl(var(--sidebar-primary) / 0.08);
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  color: hsl(var(--sidebar-primary));
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
}
.btn-admin:hover { background: hsl(var(--sidebar-primary) / 0.15); }
.btn-download {
  border-color: hsl(142 71% 45% / 0.4);
  background: hsl(142 71% 45% / 0.08);
  color: hsl(var(--success));
}
.btn-download:hover { background: hsl(142 71% 45% / 0.15); }

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

/* ===== 移动端响应式 ===== */
@media (max-width: 767px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    transform: translateX(-100%);
    width: 240px !important;
    min-width: 240px !important;
  }

  .sidebar.mobile-open {
    transform: translateX(0);
  }

  /* 移动端不显示折叠按钮 */
  .sidebar-collapse-btn { display: none; }

  /* 移动端显示汉堡按钮 */
  .mobile-menu-btn { display: flex; }

  /* 移动端隐藏部分顶栏元素 */
  .status-badge .status-text { display: none; }
  .btn-admin .btn-text { display: none; }
  .btn-admin { padding: 5px 8px; }

  .topbar { padding: 0 12px; }
  .content-area { padding: 16px 12px; }
}

/* 平板适配 */
@media (min-width: 768px) and (max-width: 1023px) {
  .sidebar {
    width: 180px;
    min-width: 180px;
  }
  .btn-admin .btn-text { display: none; }
  .btn-admin { padding: 5px 8px; }
  .status-badge { display: none; }
}
</style>
