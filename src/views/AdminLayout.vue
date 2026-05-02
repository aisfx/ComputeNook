<template>
  <div class="app-shell" :data-theme="theme">
    <!-- Sidebar -->
    <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="sidebar-header">
        <div class="sidebar-logo" @click="goHome">
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

      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-section-label" v-if="!sidebarCollapsed">管理</div>

          <!-- 总览 Dashboard -->
          <a
            :class="['nav-item', { active: adminTab === 'dashboard' }]"
            @click="adminTab = 'dashboard'"
            :title="sidebarCollapsed ? '总览' : ''"
          >
            <span class="nav-item-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </span>
            <span class="nav-item-label">总览</span>
          </a>

          <!-- 用户管理 -->
          <a
            :class="['nav-item', { active: ['users','groups'].includes(adminTab) }]"
            @click="groupExpanded.user = !groupExpanded.user"
            :title="sidebarCollapsed ? '用户管理' : ''"
          >
            <span class="nav-item-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </span>
            <span class="nav-item-label">用户管理</span>
            <span class="nav-item-chevron" v-if="!sidebarCollapsed">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline :points="groupExpanded.user ? '18 15 12 9 6 15' : '6 9 12 15 18 9'"/></svg>
            </span>
          </a>
          <div v-if="groupExpanded.user && !sidebarCollapsed" class="nav-sub">
            <a :class="['nav-sub-item', { active: adminTab === 'users' }]" @click.stop="adminTab = 'users'">用户</a>
            <a :class="['nav-sub-item', { active: adminTab === 'groups' }]" @click.stop="adminTab = 'groups'">用户组</a>
          </div>

          <!-- 账户管理 -->
          <a
            :class="['nav-item', { active: ['slurm-accounts','slurm-users'].includes(adminTab) }]"
            @click="groupExpanded.account = !groupExpanded.account"
            :title="sidebarCollapsed ? '账户管理' : ''"
          >
            <span class="nav-item-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="12" x2="16" y2="12"/></svg>
            </span>
            <span class="nav-item-label">账户管理</span>
            <span class="nav-item-chevron" v-if="!sidebarCollapsed">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline :points="groupExpanded.account ? '18 15 12 9 6 15' : '6 9 12 15 18 9'"/></svg>
            </span>
          </a>
          <div v-if="groupExpanded.account && !sidebarCollapsed" class="nav-sub">
            <a :class="['nav-sub-item', { active: adminTab === 'slurm-accounts' }]" @click.stop="adminTab = 'slurm-accounts'">Slurm账户</a>
            <a :class="['nav-sub-item', { active: adminTab === 'slurm-users' }]" @click.stop="adminTab = 'slurm-users'">Slurm用户</a>
          </div>

          <!-- 资源管理 -->
          <a
            :class="['nav-item', { active: ['associations','qos','hours','quota'].includes(adminTab) }]"
            @click="groupExpanded.resource = !groupExpanded.resource"
            :title="sidebarCollapsed ? '资源管理' : ''"
          >
            <span class="nav-item-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </span>
            <span class="nav-item-label">资源管理</span>
            <span class="nav-item-chevron" v-if="!sidebarCollapsed">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline :points="groupExpanded.resource ? '18 15 12 9 6 15' : '6 9 12 15 18 9'"/></svg>
            </span>
          </a>
          <div v-if="groupExpanded.resource && !sidebarCollapsed" class="nav-sub">
            <a :class="['nav-sub-item', { active: adminTab === 'associations' }]" @click.stop="adminTab = 'associations'">资源绑定</a>
            <a :class="['nav-sub-item', { active: adminTab === 'qos' }]" @click.stop="adminTab = 'qos'">QoS配置</a>
            <a :class="['nav-sub-item', { active: adminTab === 'hours' }]" @click.stop="adminTab = 'hours'">机时管理</a>
            <a :class="['nav-sub-item', { active: adminTab === 'quota' }]" @click.stop="adminTab = 'quota'">存储配额</a>
          </div>

          <!-- 集群监控 expandable -->
          <a
            :class="['nav-item', { active: adminTab === 'monitoring' || adminTab === 'custom-dashboard' }]"
            @click="groupExpanded.monitoring = !groupExpanded.monitoring"
            :title="sidebarCollapsed ? '集群监控' : ''"
          >
            <span class="nav-item-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </span>
            <span class="nav-item-label">集群监控</span>
            <span class="nav-item-chevron" v-if="!sidebarCollapsed">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline :points="groupExpanded.monitoring ? '18 15 12 9 6 15' : '6 9 12 15 18 9'"/></svg>
            </span>
          </a>
          <div v-if="groupExpanded.monitoring && !sidebarCollapsed" class="nav-sub">
            <a :class="['nav-sub-item', { active: adminTab === 'monitoring' && monitoringTab === 'cluster' }]" @click.stop="adminTab = 'monitoring'; monitoringTab = 'cluster'">集群状态</a>
            <a :class="['nav-sub-item', { active: adminTab === 'custom-dashboard' }]" @click.stop="adminTab = 'custom-dashboard'">监控面板</a>
            <a :class="['nav-sub-item', { active: adminTab === 'monitoring' && monitoringTab === 'alerts' }]" @click.stop="adminTab = 'monitoring'; monitoringTab = 'alerts'">告警规则</a>
          </div>

          <!-- 基础设施 -->
          <a
            :class="['nav-item', { active: adminTab === 'rack' || adminTab === 'network' || adminTab === 'cmdb' }]"
            @click="groupExpanded.infra = !groupExpanded.infra"
            :title="sidebarCollapsed ? '基础设施' : ''"
          >
            <span class="nav-item-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
            </span>
            <span class="nav-item-label">基础设施</span>
            <span class="nav-item-chevron" v-if="!sidebarCollapsed">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline :points="groupExpanded.infra ? '18 15 12 9 6 15' : '6 9 12 15 18 9'"/></svg>
            </span>
          </a>
          <div v-if="groupExpanded.infra && !sidebarCollapsed" class="nav-sub">
            <a :class="['nav-sub-item', { active: adminTab === 'rack' }]" @click.stop="adminTab = 'rack'">机柜管理</a>
            <a :class="['nav-sub-item', { active: adminTab === 'network' }]" @click.stop="adminTab = 'network'">网络拓扑</a>
            <a :class="['nav-sub-item', { active: adminTab === 'cmdb' }]" @click.stop="adminTab = 'cmdb'">主机资产</a>
          </div>

          <!-- AI 诊断 -->
          <a
            :class="['nav-item', { active: adminTab === 'ai-diagnostics' }]"
            @click="adminTab = 'ai-diagnostics'"
            :title="sidebarCollapsed ? 'AI 诊断' : ''"
          >
            <span class="nav-item-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
            </span>
            <span class="nav-item-label">AI 诊断</span>
          </a>

          <!-- 数据审计（始终最后） -->
          <a
            :class="['nav-item', { active: adminTab === 'audit' }]"
            @click="adminTab = 'audit'"
            :title="sidebarCollapsed ? '数据审计' : ''"
          >
            <span class="nav-item-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </span>
            <span class="nav-item-label">数据审计</span>
          </a>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="user-info" v-if="!sidebarCollapsed">
          <div class="user-avatar">{{ userInitial }}</div>
          <div class="user-details">
            <div class="user-name">{{ currentUser?.cnName || currentUser?.username }}</div>
            <div class="user-role">管理员</div>
          </div>
        </div>
        <div class="user-avatar" v-else :title="currentUser?.username">{{ userInitial }}</div>
      </div>
    </aside>

    <!-- Main -->
    <div class="main-wrapper">
      <header class="topbar">
        <div class="topbar-left">
          <h1 class="page-title">{{ currentTitle }}</h1>
        </div>
        <div class="topbar-right">
          <div class="status-badge">
            <span class="status-dot"></span>
            <span>集群在线</span>
          </div>
          <button class="icon-btn" @click="toggleTheme" :title="theme === 'dark' ? '切换亮色' : '切换暗色'">
            <span>{{ theme === 'dark' ? '☀️' : '🌙' }}</span>
          </button>
          <button class="btn-back" @click="goHome" title="返回主界面">← 返回主界面</button>
          <button class="icon-btn danger" @click="handleLogout" title="退出">
            <span>🚪</span>
          </button>
        </div>
      </header>

      <main class="content-area">
        <AdminDashboard v-if="adminTab === 'dashboard'" />
        <Monitoring v-else-if="adminTab === 'monitoring'" :active-tab="monitoringTab" @tab-change="monitoringTab = $event" />
        <RackView v-else-if="adminTab === 'rack'" />
        <NetworkTopology v-else-if="adminTab === 'network'" />
        <AdminUsers v-else-if="adminTab === 'users'" />
        <AdminGroups v-else-if="adminTab === 'groups'" />
        <AdminQoS v-else-if="adminTab === 'qos'" />
        <AdminAssociations v-else-if="adminTab === 'associations'" />
        <AdminHours v-else-if="adminTab === 'hours'" />
        <AdminQuota v-else-if="adminTab === 'quota'" />
        <AdminAudit v-else-if="adminTab === 'audit'" />
        <AdminCMDB v-else-if="adminTab === 'cmdb'" />
        <AdminSlurmAccounts v-else-if="adminTab === 'slurm-accounts'" />
        <AdminSlurmUsers v-else-if="adminTab === 'slurm-users'" />
        <CustomDashboard v-else-if="adminTab === 'custom-dashboard'" />
        <AIDiagnostics v-else-if="adminTab === 'ai-diagnostics'" />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AdminUsers from './AdminUsers.vue'
import AdminGroups from './AdminGroups.vue'
import AdminQoS from './AdminQoS.vue'
import AdminHours from './AdminHours.vue'
import AdminQuota from './AdminQuota.vue'
import AdminAudit from './AdminAudit.vue'
import AdminCMDB from './AdminCMDB.vue'
import AdminSlurmAccounts from './AdminSlurmAccounts.vue'
import AdminSlurmUsers from './AdminSlurmUsers.vue'
import AdminAssociations from './AdminAssociations.vue'
import Monitoring from './Monitoring.vue'
import RackView from './RackView.vue'
import NetworkTopology from './NetworkTopology.vue'
import CustomDashboard from './CustomDashboard.vue'
import AIDiagnostics from './AIDiagnostics.vue'
import AdminDashboard from '../components/AdminDashboard.vue'
import { getUser, logout, setupAxiosInterceptors, isAdmin as checkAdmin } from '../utils/auth'

const router = useRouter()
const adminTab = ref('dashboard')
const monitoringTab = ref('cluster')
const groupExpanded = reactive({ user: true, account: false, resource: false, monitoring: true, infra: true })
const sidebarCollapsed = ref(false)
const currentUser = ref<any>(null)
const theme = ref<'light' | 'dark'>('light')

const currentTitle = computed(() => {
  const map: Record<string, string> = {
    dashboard: '集群总览',
    monitoring: '集群监控',
    rack: '机柜管理',
    network: '网络拓扑',
    'ai-diagnostics': 'AI 故障诊断',
    users: '用户',
    groups: '用户组',
    'slurm-accounts': 'Slurm账户',
    'slurm-users': 'Slurm用户',
    associations: '资源绑定',
    qos: 'QoS配置',
    hours: '机时管理',
    quota: '存储配额',
    audit: '数据审计',
    'custom-dashboard': '监控面板',
  }
  return map[adminTab.value] || '管理后台'
})

const userInitial = computed(() => {
  const name = currentUser.value?.cnName || currentUser.value?.username || '?'
  return name.charAt(0).toUpperCase()
})

const toggleTheme = () => {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
  localStorage.setItem('theme', theme.value)
}

const goHome = () => router.push('/dashboard')

const handleLogout = () => {
  if (confirm('确定要退出登录吗？')) {
    logout()
    router.push('/login')
  }
}

onMounted(() => {
  setupAxiosInterceptors()
  currentUser.value = getUser()
  if (!checkAdmin()) {
    router.push('/dashboard')
    return
  }
  const saved = localStorage.getItem('theme') as 'light' | 'dark' | null
  if (saved) theme.value = saved
})
</script>

<style scoped>
.app-shell {
  display: flex;
  height: 100vh;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  overflow: hidden;
}

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
.sidebar.collapsed { width: 56px; min-width: 56px; }

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

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.nav-section { margin-bottom: 4px; }

.nav-section-label {
  padding: 8px 12px 4px;
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
  padding: 7px 12px;
  margin: 1px 8px;
  border-radius: 6px;
  cursor: pointer;
  color: hsl(var(--sidebar-foreground));
  font-size: 0.875rem;
  font-weight: 500;
  transition: background 0.15s, color 0.15s;
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
}
.nav-item:hover { background: hsl(var(--sidebar-accent)); color: hsl(var(--sidebar-accent-foreground)); }
.nav-item.active {
  background: hsl(var(--sidebar-accent));
  color: hsl(var(--sidebar-foreground));
  font-weight: 600;
  box-shadow: inset 3px 0 0 hsl(262 83% 58%);
}

.nav-item-icon { width: 18px; text-align: center; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.nav-item-label { flex: 1; }
.nav-item-chevron { display: flex; align-items: center; color: hsl(var(--muted-foreground)); }

.nav-sub { margin: 2px 8px 4px 28px; }

.nav-sub-group {
  padding: 6px 8px 2px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: hsl(var(--muted-foreground));
}

.nav-sub-item {
  display: block;
  padding: 5px 8px;
  border-radius: 5px;
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  margin: 1px 0;
}
.nav-sub-item:hover { background: hsl(var(--sidebar-accent)); color: hsl(var(--sidebar-accent-foreground)); }
.nav-sub-item.active {
  background: hsl(214 100% 97%);
  color: hsl(221 83% 53%);
  font-weight: 500;
}

[data-theme="dark"] .nav-sub-item.active {
  background: hsl(214 60% 20%);
  color: hsl(214 100% 75%);
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid hsl(var(--sidebar-border));
  flex-shrink: 0;
}

.user-info { display: flex; align-items: center; gap: 10px; overflow: hidden; }

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
.user-name { font-size: 0.8rem; font-weight: 600; color: hsl(var(--sidebar-foreground)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.user-role { font-size: 0.7rem; color: hsl(var(--muted-foreground)); }

.main-wrapper { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

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

.topbar-left { display: flex; align-items: center; gap: 16px; min-width: 0; }

.page-title { font-size: 1rem; font-weight: 600; color: hsl(var(--foreground)); white-space: nowrap; }

.topbar-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

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

.btn-back {
  padding: 5px 12px;
  border: 1px solid hsl(var(--border));
  background: none;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.btn-back:hover { background: hsl(var(--accent)); color: hsl(var(--accent-foreground)); }

.content-area { flex: 1; overflow-y: auto; background: hsl(var(--background)); padding: 24px; }

.sidebar.collapsed .nav-item-label,
.sidebar.collapsed .nav-item-chevron,
.sidebar.collapsed .nav-section-label,
.sidebar.collapsed .nav-sub,
.sidebar.collapsed .logo-text,
.sidebar.collapsed .user-details { display: none; }

.sidebar.collapsed .nav-item { justify-content: center; padding: 8px; margin: 1px 6px; }
.sidebar.collapsed .sidebar-collapse-btn { margin: 0 auto; }
</style>
