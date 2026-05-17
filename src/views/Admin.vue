<template>
  <div class="admin-page">
    <!-- 二级导航 -->
    <div class="sub-nav">
      <button 
        v-for="tab in adminTabs" 
        :key="tab.id"
        :class="['sub-nav-btn', { active: currentTab === tab.id }]"
        @click="currentTab = tab.id"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        {{ tab.label }}
      </button>
    </div>

    <!-- Dashboard 总览 / 集群监控 / 用量报表 / 审计日志 整合 -->
    <div v-if="currentTab === 'dashboard'" class="tab-content tab-content-flush">
      <!-- 子 tab -->
      <div class="dash-subtabs">
        <button :class="['dash-subtab', dashSubTab==='overview' && 'active']" @click="dashSubTab='overview'">📊 总览</button>
        <!-- 集群监控子项直接展开 -->
        <button :class="['dash-subtab', dashSubTab==='mon-mgmt' && 'active']"    @click="dashSubTab='mon-mgmt'">🖥️ 管理节点</button>
        <button :class="['dash-subtab', dashSubTab==='mon-cluster' && 'active']" @click="dashSubTab='mon-cluster'">⚡ 计算节点</button>
        <button :class="['dash-subtab', dashSubTab==='mon-network' && 'active']" @click="dashSubTab='mon-network'">🌐 网络监控</button>
        <button :class="['dash-subtab', dashSubTab==='mon-jobs' && 'active']"    @click="dashSubTab='mon-jobs'">📋 作业管理</button>
        <button :class="['dash-subtab', dashSubTab==='mon-alerts' && 'active']"  @click="dashSubTab='mon-alerts'">🔔 告警规则</button>
        <button :class="['dash-subtab', dashSubTab==='reports' && 'active']" @click="dashSubTab='reports'">📈 用量报表</button>
        <button :class="['dash-subtab', dashSubTab==='audit' && 'active']" @click="dashSubTab='audit'">📝 审计日志</button>
      </div>
      <div class="dash-sub-content">
        <AdminDashboard v-if="dashSubTab==='overview'" />
        <Monitoring v-if="dashSubTab==='mon-mgmt'"    active-tab="mgmt" />
        <Monitoring v-if="dashSubTab==='mon-cluster'" active-tab="cluster" />
        <Monitoring v-if="dashSubTab==='mon-network'" active-tab="network" />
        <Monitoring v-if="dashSubTab==='mon-jobs'"    active-tab="jobs" />
        <Monitoring v-if="dashSubTab==='mon-alerts'"  active-tab="alerts" />
        <Reports v-if="dashSubTab==='reports'" />
        <!-- 审计日志 -->
        <div v-if="dashSubTab==='audit'" class="tab-content">
          <div class="page-header">
            <h3>📝 审计日志</h3>
          </div>
          <div class="card filters-card">
            <div class="filters-row">
              <div class="filter-group">
                <select v-model="auditFilters.action">
                  <option value="">全部操作</option>
                  <option value="login">登录</option>
                  <option value="logout">登出</option>
                  <option value="create">创建</option>
                  <option value="update">更新</option>
                  <option value="delete">删除</option>
                  <option value="submit">提交作业</option>
                </select>
              </div>
              <div class="filter-group">
                <input type="text" v-model="auditFilters.user" placeholder="用户名" />
              </div>
              <div class="filter-group">
                <input type="date" v-model="auditFilters.startDate" />
              </div>
              <div class="filter-group">
                <input type="date" v-model="auditFilters.endDate" />
              </div>
              <button class="btn-secondary" @click="searchAuditLogs">🔍 查询</button>
            </div>
          </div>
          <div class="card">
            <table class="data-table">
              <thead>
                <tr>
                  <th>时间</th><th>用户</th><th>操作类型</th><th>资源</th><th>详情</th><th>IP 地址</th><th>状态</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="log in filteredAuditLogs" :key="log.id">
                  <td>{{ log.timestamp }}</td>
                  <td><strong>{{ log.user }}</strong></td>
                  <td><span class="action-badge">{{ log.action }}</span></td>
                  <td>{{ log.resource }}</td>
                  <td>{{ log.details }}</td>
                  <td><code>{{ log.ip }}</code></td>
                  <td>
                    <span :class="['status-badge', log.success ? 'status-success' : 'status-failed']">
                      {{ log.success ? '成功' : '失败' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- 用户管理 -->
    <div v-if="currentTab === 'users'" class="tab-content">
      <div class="page-header">
        <h3>👥 用户管理</h3>
        <button class="btn-primary" @click="showAddUserModal = true">+ 添加用户</button>
      </div>

      <!-- 用户筛选 -->
      <div class="card filters-card">
        <div class="filters-row">
          <div class="filter-group">
            <input type="text" v-model="userFilters.search" placeholder="🔍 搜索用户名、姓名..." />
          </div>
          <div class="filter-group">
            <select v-model="userFilters.status">
              <option value="">全部状态</option>
              <option value="active">正常</option>
              <option value="locked">已锁定</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 用户列表 -->
      <div class="card">
        <table class="data-table">
          <thead>
            <tr>
              <th>用户名</th>
              <th>UID</th>
              <th>GID</th>
              <th>中文名称</th>
              <th>电话号码</th>
              <th>Shell</th>
              <th>家目录</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in filteredUsers" :key="user.id">
              <td><strong>{{ user.username }}</strong></td>
              <td>{{ user.uid }}</td>
              <td>{{ user.gid }}</td>
              <td>{{ user.cnName }}</td>
              <td>{{ user.phone }}</td>
              <td><code>{{ user.shell }}</code></td>
              <td><code>{{ user.homeDir }}</code></td>
              <td>
                <span :class="['status-badge', user.locked ? 'status-locked' : 'status-active']">
                  {{ user.locked ? '🔒 已锁定' : '✅ 正常' }}
                </span>
              </td>
              <td>
                <div class="action-buttons">
                  <button class="btn-link" @click="editUser(user)">✏️ 编辑</button>
                  <button class="btn-link" @click="toggleLock(user)">
                    {{ user.locked ? '🔓 解锁' : '🔒 锁定' }}
                  </button>
                  <button class="btn-link" @click="resetPassword(user)">🔑 重置密码</button>
                  <button class="btn-link danger" @click="deleteUser(user.username)">🗑️ 删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 用户组管理 -->
    <div v-if="currentTab === 'groups'" class="tab-content">
      <div class="page-header">
        <h3>👨‍👩‍👧‍👦 用户组管理</h3>
        <button class="btn-primary" @click="showAddGroupModal = true">+ 添加用户组</button>
      </div>

      <!-- 用户组筛选 -->
      <div class="card filters-card">
        <div class="filters-row">
          <div class="filter-group">
            <input type="text" v-model="groupFilters.search" placeholder="🔍 搜索组名..." />
          </div>
        </div>
      </div>

      <!-- 用户组列表 -->
      <div class="card">
        <table class="data-table">
          <thead>
            <tr>
              <th>组名</th>
              <th>GID</th>
              <th>关联用户</th>
              <th>用户数量</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="group in filteredGroups" :key="group.id">
              <td><strong>{{ group.groupName }}</strong></td>
              <td>{{ group.gid }}</td>
              <td>
                <div class="user-tags">
                  <span v-for="user in group.members" :key="user" class="user-tag">{{ user }}</span>
                  <span v-if="group.members.length === 0" class="empty-text">无成员</span>
                </div>
              </td>
              <td>{{ group.members.length }}</td>
              <td>{{ group.createTime }}</td>
              <td>
                <div class="action-buttons">
                  <button class="btn-link" @click="editGroup(group)">✏️ 编辑</button>
                  <button class="btn-link" @click="manageGroupMembers(group)">👥 管理成员</button>
                  <button class="btn-link danger" @click="deleteGroup(group.groupName)">🗑️ 删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 账户信息 (Slurm Account) -->
    <div v-if="currentTab === 'accounts'" class="tab-content">
      <AdminSlurmAccounts />
    </div>

    <!-- 账户关联 (Associations) -->
    <div v-if="currentTab === 'associations'" class="tab-content">
      <AdminAssociations />
    </div>

    <!-- 资源配置 (QoS) -->
    <div v-if="currentTab === 'qos'" class="tab-content">
      <div class="page-header">
        <h3>⚙️ 资源配置 (QoS)</h3>
        <button class="btn-primary" @click="showAddQosModal = true">+ 添加 QoS</button>
      </div>

      <div class="card">
        <table class="data-table">
          <thead>
            <tr>
              <th>QoS 名称</th>
              <th>优先级</th>
              <th>最大作业数</th>
              <th>最大 CPU 核数</th>
              <th>最大内存 (GB)</th>
              <th>最大运行时间</th>
              <th>抢占模式</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="qos in qosList" :key="qos.id">
              <td><strong>{{ qos.name }}</strong></td>
              <td><span class="priority-badge" :style="{background: getPriorityColor(qos.priority)}">{{ qos.priority }}</span></td>
              <td>{{ qos.maxJobs }}</td>
              <td>{{ qos.maxCpus }}</td>
              <td>{{ qos.maxMemory }}</td>
              <td>{{ qos.maxWallTime }}</td>
              <td>{{ qos.preemptMode }}</td>
              <td>
                <div class="action-buttons">
                  <button class="btn-link" @click="editQos(qos)">✏️ 编辑</button>
                  <button class="btn-link danger" @click="deleteQos(qos.id)">🗑️ 删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 集群监控和数据统计已整合到总览 tab -->
    <div v-if="currentTab === 'audit'" class="tab-content">
      <div class="page-header">
        <h3>📝 审计日志</h3>
      </div>

      <!-- 日志筛选 -->
      <div class="card filters-card">
        <div class="filters-row">
          <div class="filter-group">
            <select v-model="auditFilters.action">
              <option value="">全部操作</option>
              <option value="login">登录</option>
              <option value="logout">登出</option>
              <option value="create">创建</option>
              <option value="update">更新</option>
              <option value="delete">删除</option>
              <option value="submit">提交作业</option>
            </select>
          </div>
          <div class="filter-group">
            <input type="text" v-model="auditFilters.user" placeholder="用户名" />
          </div>
          <div class="filter-group">
            <input type="date" v-model="auditFilters.startDate" />
          </div>
          <div class="filter-group">
            <input type="date" v-model="auditFilters.endDate" />
          </div>
          <button class="btn-secondary" @click="searchAuditLogs">🔍 查询</button>
        </div>
      </div>

      <!-- 日志列表 -->
      <div class="card">
        <table class="data-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>用户</th>
              <th>操作类型</th>
              <th>资源</th>
              <th>详情</th>
              <th>IP 地址</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in filteredAuditLogs" :key="log.id">
              <td>{{ log.timestamp }}</td>
              <td><strong>{{ log.user }}</strong></td>
              <td><span class="action-badge">{{ log.action }}</span></td>
              <td>{{ log.resource }}</td>
              <td>{{ log.details }}</td>
              <td><code>{{ log.ip }}</code></td>
              <td>
                <span :class="['status-badge', log.success ? 'status-success' : 'status-failed']">
                  {{ log.success ? '成功' : '失败' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 平台数据统计 -->
    <div v-if="currentTab === 'statistics'" class="tab-content">
      <div class="page-header">
        <h3>📈 平台数据统计</h3>
      </div>

      <!-- 统计卡片 -->
      <div class="stats-grid">
        <div class="card stat-card">
          <div class="stat-icon">👥</div>
          <div class="stat-content">
            <div class="stat-label">总用户数</div>
            <div class="stat-value">{{ statistics.totalUsers }}</div>
            <div class="stat-change positive">+{{ statistics.newUsersThisMonth }} 本月新增</div>
          </div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon">📋</div>
          <div class="stat-content">
            <div class="stat-label">总作业数</div>
            <div class="stat-value">{{ statistics.totalJobs }}</div>
            <div class="stat-change positive">+{{ statistics.jobsToday }} 今日提交</div>
          </div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon">⏱️</div>
          <div class="stat-content">
            <div class="stat-label">总机时 (核时)</div>
            <div class="stat-value">{{ statistics.totalCoreHours }}</div>
            <div class="stat-change">{{ statistics.coreHoursThisMonth }} 本月消耗</div>
          </div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon">🖥️</div>
          <div class="stat-content">
            <div class="stat-label">活跃节点</div>
            <div class="stat-value">{{ statistics.activeNodes }}/{{ statistics.totalNodes }}</div>
            <div class="stat-change">{{ statistics.nodeUtilization }}% 利用率</div>
          </div>
        </div>
      </div>

      <!-- 趋势图表 -->
      <div class="card">
        <h4>作业提交趋势 (最近30天)</h4>
        <canvas ref="jobTrendChartRef" width="900" height="300"></canvas>
      </div>

      <div class="card">
        <h4>用户活跃度 TOP 10</h4>
        <table class="data-table">
          <thead>
            <tr>
              <th>排名</th>
              <th>用户名</th>
              <th>提交作业数</th>
              <th>消耗机时 (核时)</th>
              <th>成功率</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(user, index) in topUsers" :key="user.username">
              <td><strong>#{{ index + 1 }}</strong></td>
              <td>{{ user.username }}</td>
              <td>{{ user.jobCount }}</td>
              <td>{{ user.coreHours }}</td>
              <td>
                <div class="progress-bar">
                  <div class="progress-fill" :style="{width: user.successRate + '%'}"></div>
                  <span class="progress-text">{{ user.successRate }}%</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <Teleport to="body">
    <!-- 添加用户组弹窗 -->
    <div v-if="showAddGroupModal" class="modal-overlay" @click="showAddGroupModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>{{ editingGroup ? '编辑用户组' : '添加用户组' }}</h2>
          <button @click="showAddGroupModal = false" class="btn-close">✕</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="saveGroup" class="user-form">
            <div class="form-row">
              <div class="form-group">
                <label>组名 *</label>
                <input v-model="groupForm.groupName" type="text" required />
              </div>
              <div class="form-group">
                <label>GID *</label>
                <input v-model="groupForm.gid" type="number" required />
              </div>
            </div>
            <div class="form-group">
              <label>关联用户</label>
              <div class="member-selector">
                <div class="available-users">
                  <h5>可用用户</h5>
                  <div class="user-list">
                    <label v-for="user in availableUsers" :key="user.username" class="user-checkbox">
                      <input 
                        type="checkbox" 
                        :value="user.username"
                        v-model="groupForm.members"
                      />
                      <span>{{ user.username }} ({{ user.cnName }})</span>
                    </label>
                  </div>
                </div>
                <div class="selected-users">
                  <h5>已选用户 ({{ groupForm.members.length }})</h5>
                  <div class="selected-tags">
                    <span v-for="member in groupForm.members" :key="member" class="selected-tag">
                      {{ member }}
                      <button type="button" @click="removeMember(member)">✕</button>
                    </span>
                    <span v-if="groupForm.members.length === 0" class="empty-hint">未选择用户</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="form-actions">
              <button type="button" class="btn-secondary" @click="showAddGroupModal = false">取消</button>
              <button type="submit" class="btn-primary">保存</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- 添加用户弹窗 -->
    <div v-if="showAddUserModal" class="modal-overlay" @click="showAddUserModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>{{ editingUser ? '编辑用户' : '添加用户' }}</h2>
          <button @click="showAddUserModal = false" class="btn-close">✕</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="saveUser" class="user-form">
            <div class="form-row">
              <div class="form-group">
                <label>用户名 *</label>
                <input v-model="userForm.username" type="text" required />
              </div>
              <div class="form-group">
                <label>UID *</label>
                <input v-model="userForm.uid" type="number" required />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>GID *</label>
                <input v-model="userForm.gid" type="number" required />
              </div>
              <div class="form-group">
                <label>中文名称 *</label>
                <input v-model="userForm.cnName" type="text" required />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>电话号码</label>
                <input v-model="userForm.phone" type="tel" />
              </div>
              <div class="form-group">
                <label>Shell</label>
                <select v-model="userForm.shell">
                  <option value="/bin/bash">/bin/bash</option>
                  <option value="/bin/zsh">/bin/zsh</option>
                  <option value="/bin/sh">/bin/sh</option>
                  <option value="/bin/tcsh">/bin/tcsh</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>家目录 *</label>
              <input v-model="userForm.homeDir" type="text" required />
            </div>
            <div class="form-group">
              <label>密码 *</label>
              <input v-model="userForm.password" type="password" required />
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input v-model="userForm.locked" type="checkbox" />
                <span>锁定用户</span>
              </label>
            </div>
            <div class="form-actions">
              <button type="button" class="btn-secondary" @click="showAddUserModal = false">取消</button>
              <button type="submit" class="btn-primary">保存</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import AdminAssociations from './AdminAssociations.vue'
import AdminSlurmAccounts from './AdminSlurmAccounts.vue'
import AdminDashboard from '../components/AdminDashboard.vue'
import Monitoring from './Monitoring.vue'
import Reports from './Reports.vue'
import { dialog } from '../utils/dialog'

const API_BASE_URL = ''

const currentTab = ref('dashboard')
const dashSubTab = ref<'overview'|'mon-mgmt'|'mon-cluster'|'mon-network'|'mon-jobs'|'mon-alerts'|'reports'|'audit'>('overview')
const showAddUserModal = ref(false)
const showAddGroupModal = ref(false)
const showAddQosModal = ref(false)
const editingUser = ref<any>(null)
const editingGroup = ref<any>(null)
const loading = ref(false)

const adminTabs = [
  { id: 'dashboard',    label: '总览',    icon: '📊' },
  { id: 'users',        label: '用户管理', icon: '👥' },
  { id: 'groups',       label: '用户组',   icon: '👨‍👩‍👧‍👦' },
  { id: 'accounts',     label: '账户管理', icon: '💼' },
  { id: 'associations', label: '账户关联', icon: '🔗' },
  { id: 'qos',          label: '资源配置', icon: '⚙️' },
]

// 用户管理
const userFilters = ref({
  search: '',
  status: ''
})

const users = ref<any[]>([])

const userForm = ref({
  username: '',
  uid: 1005,
  gid: 1005,
  cnName: '',
  phone: '',
  shell: '/bin/bash',
  homeDir: '',
  password: '',
  locked: false
})

// 加载用户列表
const loadUsers = async () => {
  loading.value = true
  try {
    const response = await axios.get(`${API_BASE_URL}/users`)
    users.value = response.data.data || []
  } catch (error) {
    console.error('Failed to load users:', error)
    dialog.error('加载用户列表失败')
  } finally {
    loading.value = false
  }
}

const filteredUsers = computed(() => {
  let result = users.value
  
  if (userFilters.value.search) {
    const search = userFilters.value.search.toLowerCase()
    result = result.filter(u => 
      u.username.toLowerCase().includes(search) || 
      u.cnName.includes(search)
    )
  }
  
  if (userFilters.value.status === 'active') {
    result = result.filter(u => !u.locked)
  } else if (userFilters.value.status === 'locked') {
    result = result.filter(u => u.locked)
  }
  
  return result
})

// 用户组管理
const groupFilters = ref({
  search: ''
})

const groups = ref<any[]>([])

const groupForm = ref({
  groupName: '',
  gid: 2005,
  members: [] as string[]
})

// 加载用户组列表
const loadGroups = async () => {
  loading.value = true
  try {
    const response = await axios.get(`${API_BASE_URL}/groups`)
    groups.value = response.data.data || []
  } catch (error) {
    console.error('Failed to load groups:', error)
    dialog.error('加载用户组列表失败')
  } finally {
    loading.value = false
  }
}

const availableUsers = computed(() => {
  return users.value.map(u => ({ username: u.username, cnName: u.cnName }))
})

const filteredGroups = computed(() => {
  let result = groups.value
  
  if (groupFilters.value.search) {
    const search = groupFilters.value.search.toLowerCase()
    result = result.filter(g => g.groupName.toLowerCase().includes(search))
  }
  
  return result
})

// QoS 配置
const qosList = ref<any[]>([])

// 加载 QoS 列表
const loadQosList = async () => {
  loading.value = true
  try {
    const response = await axios.get(`${API_BASE_URL}/slurm/qos`)
    qosList.value = response.data.data || []
  } catch (error) {
    console.error('Failed to load QoS list:', error)
    dialog.error('加载 QoS 列表失败')
  } finally {
    loading.value = false
  }
}

// 监控告警
const alerts = ref([
  { 
    id: 1, 
    name: 'NodeDown', 
    severity: 'critical', 
    message: '节点 node01 无响应', 
    time: '2026-02-14 15:30:00',
    labels: { node: 'node01', cluster: 'hpc-cluster' }
  },
  { 
    id: 2, 
    name: 'HighCPUUsage', 
    severity: 'warning', 
    message: '节点 node05 CPU 使用率超过 90%', 
    time: '2026-02-14 15:25:00',
    labels: { node: 'node05', usage: '92%' }
  },
  { 
    id: 3, 
    name: 'DiskSpaceLow', 
    severity: 'warning', 
    message: '存储 /data 剩余空间不足 10%', 
    time: '2026-02-14 15:20:00',
    labels: { mount: '/data', available: '8%' }
  }
])

const metrics = ref({
  cpuUsage: 68,
  memUsage: 72,
  networkTraffic: 125,
  diskIO: 89
})

const cpuChartRef = ref<HTMLCanvasElement>()
const memChartRef = ref<HTMLCanvasElement>()
const netChartRef = ref<HTMLCanvasElement>()
const diskChartRef = ref<HTMLCanvasElement>()

// 审计日志
const auditFilters = ref({
  action: '',
  user: '',
  startDate: '',
  endDate: ''
})

const auditLogs = ref([
  { id: 1, timestamp: '2026-02-14 15:30:00', user: 'zhangsan', action: '提交作业', resource: 'job-12345', details: '提交 LAMMPS 作业', ip: '192.168.1.100', success: true },
  { id: 2, timestamp: '2026-02-14 15:28:00', user: 'lisi', action: '登录', resource: 'web-portal', details: '用户登录系统', ip: '192.168.1.101', success: true },
  { id: 3, timestamp: '2026-02-14 15:25:00', user: 'admin', action: '创建', resource: 'user-wangwu', details: '创建新用户 wangwu', ip: '192.168.1.10', success: true },
  { id: 4, timestamp: '2026-02-14 15:20:00', user: 'zhaoliu', action: '删除', resource: 'job-12340', details: '取消作业', ip: '192.168.1.102', success: true },
  { id: 5, timestamp: '2026-02-14 15:15:00', user: 'unknown', action: '登录', resource: 'web-portal', details: '登录失败', ip: '192.168.1.200', success: false }
])

const filteredAuditLogs = computed(() => {
  return auditLogs.value
})

// 平台统计
const statistics = ref({
  totalUsers: 156,
  newUsersThisMonth: 12,
  totalJobs: 45680,
  jobsToday: 234,
  totalCoreHours: 1250000,
  coreHoursThisMonth: 45680,
  activeNodes: 48,
  totalNodes: 50,
  nodeUtilization: 96
})

const topUsers = ref([
  { username: 'zhangsan', jobCount: 1250, coreHours: 45680, successRate: 95 },
  { username: 'lisi', jobCount: 980, coreHours: 38900, successRate: 92 },
  { username: 'wangwu', jobCount: 856, coreHours: 32100, successRate: 88 },
  { username: 'zhaoliu', jobCount: 720, coreHours: 28500, successRate: 90 },
  { username: 'sunqi', jobCount: 650, coreHours: 25600, successRate: 94 }
])

const jobTrendChartRef = ref<HTMLCanvasElement>()

// 方法
const editUser = (user: any) => {
  editingUser.value = user
  userForm.value = { ...user }
  showAddUserModal.value = true
}

const toggleLock = async (user: any) => {
  try {
    const endpoint = user.locked ? 'unlock' : 'lock'
    await axios.post(`${API_BASE_URL}/users/${user.username}/${endpoint}`)
    user.locked = !user.locked
    dialog.success(`用户 ${user.username} 已${user.locked ? '锁定' : '解锁'}`)
  } catch (error) {
    console.error('Failed to toggle lock:', error)
    dialog.error('操作失败')
  }
}

const resetPassword = async (user: any) => {
  const newPassword = await dialog.prompt(`重置用户 ${user.username} 的密码`, { placeholder: '至少8位' })
  if (!newPassword) return
  if (newPassword.length < 8) { dialog.warning('密码长度至少为8位'); return }
  try {
    await axios.post(`${API_BASE_URL}/users/${user.username}/reset-password`, { newPassword })
    dialog.success(`用户 ${user.username} 密码已重置`)
  } catch (error) {
    console.error('Failed to reset password:', error)
    dialog.error('密码重置失败')
  }
}

const deleteUser = async (username: string) => {
  if (!await dialog.confirmDelete(username, '用户')) return
  try {
    await axios.delete(`${API_BASE_URL}/users/${username}`)
    await loadUsers()
    dialog.success('用户已删除')
  } catch (error) {
    console.error('Failed to delete user:', error)
    dialog.error('删除失败')
  }
}

const saveUser = async () => {
  try {
    if (editingUser.value) {
      await axios.put(`${API_BASE_URL}/users/${editingUser.value.username}`, userForm.value)
      dialog.success('用户信息已更新')
    } else {
      await axios.post(`${API_BASE_URL}/users`, userForm.value)
      dialog.success('用户已添加')
    }
    showAddUserModal.value = false
    editingUser.value = null
    await loadUsers()
    userForm.value = { username: '', uid: 1005, gid: 1005, cnName: '', phone: '', shell: '/bin/bash', homeDir: '', password: '', locked: false }
  } catch (error) {
    console.error('Failed to save user:', error)
    dialog.error('保存失败')
  }
}

const editGroup = (group: any) => {
  editingGroup.value = group
  groupForm.value = { ...group, members: [...group.members] }
  showAddGroupModal.value = true
}

const manageGroupMembers = (group: any) => {
  editGroup(group)
}

const deleteGroup = async (groupName: string) => {
  if (!await dialog.confirmDelete(groupName, '用户组')) return
  try {
    await axios.delete(`${API_BASE_URL}/groups/${groupName}`)
    await loadGroups()
    dialog.success('用户组已删除')
  } catch (error) {
    console.error('Failed to delete group:', error)
    dialog.error('删除失败')
  }
}

const saveGroup = async () => {
  try {
    if (editingGroup.value) {
      await axios.put(`${API_BASE_URL}/groups/${editingGroup.value.groupName}`, groupForm.value)
      dialog.success('用户组信息已更新')
    } else {
      await axios.post(`${API_BASE_URL}/groups`, groupForm.value)
      dialog.success('用户组已添加')
    }
    showAddGroupModal.value = false
    editingGroup.value = null
    await loadGroups()
    groupForm.value = { groupName: '', gid: 2005, members: [] }
  } catch (error) {
    console.error('Failed to save group:', error)
    dialog.error('保存失败')
  }
}

const removeMember = (username: string) => {
  const index = groupForm.value.members.indexOf(username)
  if (index > -1) {
    groupForm.value.members.splice(index, 1)
  }
}

const editQos = (qos: any) => {
  dialog.info(`编辑 QoS: ${qos.name}`)
}

const deleteQos = async (id: number) => {
  if (await dialog.confirm('确定要删除此 QoS 配置吗？', { title: '删除 QoS', danger: true })) {
    dialog.success('QoS 已删除')
  }
}

const getPriorityColor = (priority: number) => {
  if (priority >= 1000) return '#ef4444'
  if (priority >= 500) return '#f59e0b'
  return '#10b981'
}

const getAlertIcon = (severity: string) => {
  if (severity === 'critical') return '🔴'
  if (severity === 'warning') return '🟡'
  return '🟢'
}

const acknowledgeAlert = (id: number) => {
  dialog.success('告警已确认')
}

const silenceAlert = (id: number) => {
  dialog.success('告警已静默')
}

const refreshMetrics = () => {
  dialog.success('监控数据已刷新')
}

const searchAuditLogs = () => {
  console.log('查询审计日志:', auditFilters.value)
}

const drawMetricChart = (canvas: HTMLCanvasElement | undefined, data: number[]) => {
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  const width = canvas.width
  const height = canvas.height
  const padding = 10
  
  ctx.clearRect(0, 0, width, height)
  
  // 绘制背景
  ctx.fillStyle = '#f9fafb'
  ctx.fillRect(0, 0, width, height)
  
  // 绘制曲线
  const maxValue = Math.max(...data)
  const step = (width - padding * 2) / (data.length - 1)
  
  ctx.beginPath()
  ctx.strokeStyle = '#667eea'
  ctx.lineWidth = 2
  
  data.forEach((value, index) => {
    const x = padding + index * step
    const y = height - padding - (value / maxValue) * (height - padding * 2)
    
    if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })
  
  ctx.stroke()
  
  // 填充渐变
  ctx.lineTo(width - padding, height - padding)
  ctx.lineTo(padding, height - padding)
  ctx.closePath()
  
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, 'rgba(102, 126, 234, 0.3)')
  gradient.addColorStop(1, 'rgba(102, 126, 234, 0)')
  
  ctx.fillStyle = gradient
  ctx.fill()
}

onMounted(() => {
  // 加载用户和用户组数据
  loadUsers()
  loadGroups()
  
  // 加载 QoS 数据
  loadQosList()
  
  // 绘制监控图表
  setTimeout(() => {
    const cpuData = [65, 68, 70, 72, 69, 71, 68, 70, 72, 68]
    const memData = [70, 72, 71, 73, 75, 74, 72, 73, 72, 72]
    const netData = [120, 125, 130, 128, 125, 127, 130, 125, 128, 125]
    const diskData = [85, 87, 89, 90, 88, 89, 91, 89, 90, 89]
    
    drawMetricChart(cpuChartRef.value, cpuData)
    drawMetricChart(memChartRef.value, memData)
    drawMetricChart(netChartRef.value, netData)
    drawMetricChart(diskChartRef.value, diskData)
  }, 100)
})

</script>

<style scoped>
.admin-page { display:flex; flex-direction:column; height:100%; background:hsl(var(--background)); }

.sub-nav { display:flex; gap:0; padding:0 1rem; background:hsl(var(--card)); border-bottom:2px solid hsl(var(--border)); overflow-x:auto; flex-shrink:0; }

.sub-nav-btn { display:flex; align-items:center; gap:0.4rem; padding:0.65rem 1.1rem; border:none; background:transparent; color:hsl(var(--muted-foreground)); font-size:0.875rem; font-weight:500; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-2px; transition:color 0.15s,border-color 0.15s; white-space:nowrap; }
.sub-nav-btn:hover { color:hsl(var(--foreground)); background:hsl(var(--muted)/0.3); }
.sub-nav-btn.active { color:hsl(var(--primary)); border-bottom-color:hsl(var(--primary)); font-weight:600; }
.tab-icon { font-size:1rem; }

.tab-content { display:flex; flex-direction:column; gap:1.25rem; padding:1.25rem; flex:1; overflow:auto; }
.tab-content-flush { gap:0; padding:0; overflow:hidden; display:flex; flex-direction:column; }

.dash-subtabs { display:flex; gap:0; border-bottom:1px solid hsl(var(--border)); background:hsl(var(--card)); padding:0 1rem; flex-shrink:0; }
.dash-subtab { padding:0.55rem 1.1rem; font-size:0.85rem; font-weight:500; color:hsl(var(--muted-foreground)); background:transparent; border:none; border-bottom:2px solid transparent; margin-bottom:-1px; cursor:pointer; transition:color 0.15s,border-color 0.15s; white-space:nowrap; }
.dash-subtab:hover { color:hsl(var(--foreground)); background:hsl(var(--muted)/0.3); }
.dash-subtab.active { color:hsl(var(--primary)); border-bottom-color:hsl(var(--primary)); font-weight:600; }
.dash-sub-content { flex:1; overflow:auto; min-height:0; }

.page-header { display:flex; justify-content:space-between; align-items:center; }
.page-header h3 { margin:0; font-size:1.1rem; font-weight:700; color:hsl(var(--foreground)); }

.filters-card { padding:1rem 1.25rem; }
.filters-row { display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap; }
.filter-group { flex:1; min-width:140px; }
.filter-group input, .filter-group select { width:100%; padding:0.45rem 0.65rem; border:1px solid hsl(var(--border)); border-radius:6px; font-size:0.85rem; background:hsl(var(--background)); color:hsl(var(--foreground)); outline:none; }
.filter-group input:focus, .filter-group select:focus { border-color:hsl(var(--primary)); }

.data-table { width:100%; border-collapse:collapse; font-size:0.85rem; }
.data-table thead { background:hsl(var(--muted)/0.5); }
.data-table th { padding:0.65rem 0.875rem; text-align:left; font-weight:600; color:hsl(var(--muted-foreground)); border-bottom:1px solid hsl(var(--border)); white-space:nowrap; }
.data-table td { padding:0.65rem 0.875rem; border-bottom:1px solid hsl(var(--border)); color:hsl(var(--foreground)); }
.data-table tbody tr:last-child td { border-bottom:none; }
.data-table tbody tr:hover td { background:hsl(var(--muted)/0.3); }

.status-badge { padding:0.2rem 0.6rem; border-radius:10px; font-size:0.78rem; font-weight:600; white-space:nowrap; }
.status-active   { background:rgba(16,185,129,0.12); color:#10b981; }
.status-locked   { background:rgba(239,68,68,0.1); color:#ef4444; }
.status-inactive { background:hsl(var(--muted)); color:hsl(var(--muted-foreground)); }
.status-success  { background:rgba(16,185,129,0.12); color:#10b981; }
.status-failed   { background:rgba(239,68,68,0.1); color:#ef4444; }

.action-buttons { display:flex; gap:0.4rem; flex-wrap:wrap; }
.user-tags, .qos-tags { display:flex; gap:0.4rem; flex-wrap:wrap; }
.user-tag, .qos-tag { padding:0.15rem 0.5rem; background:hsl(var(--primary)/0.1); color:hsl(var(--primary)); border-radius:4px; font-size:0.78rem; }
.qos-badge { padding:0.2rem 0.6rem; background:rgba(245,158,11,0.1); color:#f59e0b; border-radius:10px; font-size:0.78rem; font-weight:600; }
.priority-badge { padding:0.2rem 0.6rem; color:white; border-radius:10px; font-size:0.78rem; font-weight:600; }
.action-badge { padding:0.2rem 0.6rem; background:hsl(var(--primary)/0.1); color:hsl(var(--primary)); border-radius:10px; font-size:0.78rem; font-weight:600; }

.alerts-container { display:flex; flex-direction:column; gap:0.75rem; }
.alert-item { padding:0.875rem 1rem; border-radius:8px; border-left:3px solid; }
.alert-critical { background:rgba(239,68,68,0.06); border-color:#ef4444; }
.alert-warning  { background:rgba(245,158,11,0.06); border-color:#f59e0b; }
.alert-info     { background:rgba(59,130,246,0.06); border-color:#3b82f6; }
.alert-header { display:flex; align-items:center; gap:0.6rem; margin-bottom:0.4rem; }
.alert-icon { font-size:1rem; }
.alert-time { margin-left:auto; font-size:0.78rem; color:hsl(var(--muted-foreground)); }
.alert-body p { margin:0 0 0.4rem; color:hsl(var(--foreground)); font-size:0.85rem; }
.alert-labels { display:flex; gap:0.4rem; flex-wrap:wrap; }
.label-tag { padding:0.15rem 0.5rem; background:hsl(var(--muted)); border-radius:4px; font-size:0.75rem; font-family:monospace; }
.alert-actions { margin-top:0.5rem; display:flex; gap:0.4rem; }

.user-form { display:flex; flex-direction:column; gap:1.25rem; }
.form-row { display:grid; grid-template-columns:repeat(2,1fr); gap:0.875rem; }
.checkbox-label { display:flex; align-items:center; gap:0.5rem; cursor:pointer; }
.empty-text { color:hsl(var(--muted-foreground)); font-style:italic; font-size:0.85rem; }

.member-selector { display:grid; grid-template-columns:1fr 1fr; gap:1rem; padding:0.875rem; background:hsl(var(--muted)/0.3); border-radius:8px; }
.available-users, .selected-users { display:flex; flex-direction:column; gap:0.5rem; }
.available-users h5, .selected-users h5 { margin:0; color:hsl(var(--primary)); font-size:0.85rem; }
.user-list { display:flex; flex-direction:column; gap:0.3rem; max-height:260px; overflow-y:auto; padding:0.5rem; background:hsl(var(--background)); border-radius:6px; border:1px solid hsl(var(--border)); }
.user-checkbox { display:flex; align-items:center; gap:0.5rem; padding:0.4rem 0.5rem; cursor:pointer; border-radius:4px; font-size:0.85rem; transition:background 0.15s; }
.user-checkbox:hover { background:hsl(var(--muted)/0.5); }
.selected-tags { display:flex; flex-wrap:wrap; gap:0.4rem; padding:0.6rem; background:hsl(var(--background)); border-radius:6px; border:1px solid hsl(var(--border)); min-height:80px; }
.selected-tag { display:flex; align-items:center; gap:0.4rem; padding:0.3rem 0.6rem; background:hsl(var(--primary)/0.1); color:hsl(var(--primary)); border-radius:4px; font-size:0.82rem; }
.selected-tag button { background:none; border:none; color:hsl(var(--primary)); cursor:pointer; font-size:0.9rem; padding:0; line-height:1; }
.selected-tag button:hover { color:#ef4444; }
.empty-hint { color:hsl(var(--muted-foreground)); font-style:italic; font-size:0.85rem; }

.progress-bar { position:relative; width:100%; height:20px; background:hsl(var(--muted)); border-radius:10px; overflow:hidden; }
.progress-fill { height:100%; background:hsl(var(--primary)); transition:width 0.3s; }
.progress-text { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:0.78rem; font-weight:600; color:hsl(var(--foreground)); }

@media (max-width:768px) {
  .form-row { grid-template-columns:1fr; }
  .member-selector { grid-template-columns:1fr; }
}
</style>




