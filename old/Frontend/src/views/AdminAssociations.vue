<template>
  <div class="admin-associations">
    <div class="page-header">
      <div>
        <h3>资源绑定管理</h3>
        <p class="page-desc">管理用户与 Slurm 账户的资源绑定关系</p>
      </div>
      <button class="btn btn-primary" @click="showCreateDialog = true">+ 创建资源绑定</button>
    </div>

    <div v-if="loading" class="loading"><div class="spinner"></div>加载中...</div>

    <div v-else class="card" style="padding:0">
      <div style="overflow-x:auto">
      <table class="table">
        <thead>
          <tr>
            <th>用户</th>
            <th>账户</th>
            <th>集群</th>
            <th>分区</th>
            <th>QoS</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!associations.length">
            <td colspan="6" style="text-align:center;padding:2rem;color:hsl(var(--muted-foreground))">暂无资源绑定</td>
          </tr>
          <tr v-for="assoc in associations" :key="`${assoc.account}-${assoc.user}-${assoc.cluster}-${assoc.partition}`">
            <td>
              <div class="user-cell">
                <div v-if="assoc.user" class="user-avatar">{{ assoc.user[0]?.toUpperCase() }}</div>
                <div v-else class="user-avatar account-level-avatar">A</div>
                <span class="user-name">{{ assoc.user || '账户级' }}</span>
              </div>
            </td>
            <td>
              <div style="display:flex;align-items:center;gap:6px">
                <span class="account-tag">{{ assoc.account }}</span>
                <span v-if="assoc.is_default" class="badge badge-success" style="font-size:0.68rem">默认</span>
              </div>
            </td>
            <td><code class="mono-tag">{{ assoc.cluster || '-' }}</code></td>
            <td>
              <span v-if="assoc.partition" class="partition-tag">{{ assoc.partition }}</span>
              <span v-else class="text-muted">-</span>
            </td>
            <td>
              <div v-if="assoc.qos && assoc.qos.length" class="qos-list">
                <span v-for="q in assoc.qos" :key="q" class="qos-tag">{{ q }}</span>
              </div>
              <span v-else class="text-muted">-</span>
            </td>
            <td>
              <button class="btn-action-toggle" @click.stop="toggleMenu(assoc, $event)">操作 ▾</button>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="openMenuAssoc" class="dropdown-menu dropdown-menu-fixed" :style="menuStyle" @click.stop>
      <button class="dropdown-item" @click="editAssociation(openMenuAssoc); openMenu = null">✏️ 编辑</button>
      <div class="dropdown-divider"></div>
      <button class="dropdown-item danger" @click="deleteAssociation(openMenuAssoc); openMenu = null">🗑️ 删除</button>
    </div>
    <div v-if="showCreateDialog" class="modal-overlay">
      <div class="modal association-modal">
        <div class="modal-header">
          <h3>{{ isEditing ? '编辑资源绑定' : '创建资源绑定' }}</h3>
          <button class="btn-close" @click="showCreateDialog = false">×</button>
        </div>
        <div class="modal-body">
          <div v-if="!isAccountAssociationEdit" class="form-group">
            <label>用户 <span class="required">*</span></label>
            <input v-if="isEditing" v-model="newAssociation.user" readonly style="background-color: #f5f5f5; cursor: not-allowed;" />
            <select v-else v-model="newAssociation.user">
              <option value="">-- 请选择用户 --</option>
              <option v-for="user in slurmUsers" :key="user.name" :value="user.name">{{ user.name }}</option>
            </select>
            <small>{{ isEditing ? '编辑时不可更改' : '从 Slurm 用户列表中选择' }}</small>
          </div>
          <div v-else class="form-group">
            <label>绑定类型</label>
            <input value="账户级绑定" readonly style="background-color: #f5f5f5; cursor: not-allowed;" />
            <small>Slurm 账户级 Association 不关联具体用户</small>
          </div>
          <div class="form-group">
            <label>账户 <span class="required">*</span></label>
            <input v-if="isEditing" v-model="newAssociation.account" readonly style="background-color: #f5f5f5; cursor: not-allowed;" />
            <select v-else v-model="newAssociation.account">
              <option value="">-- 请选择账户 --</option>
              <option v-for="account in slurmAccounts" :key="account.name" :value="account.name">{{ account.name }}</option>
            </select>
            <small>{{ isEditing ? '编辑时不可更改' : '从 Slurm 账户列表中选择' }}</small>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>集群 <span class="required">*</span></label>
              <input v-model="newAssociation.cluster" placeholder="cluster" :readonly="isEditing" :style="isEditing ? 'background-color: #f5f5f5; cursor: not-allowed;' : ''" />
              <small>{{ isEditing ? '编辑时不可更改' : '默认: cluster' }}</small>
            </div>
            <div class="form-group">
              <label>分区</label>
              <input v-model="newAssociation.partition" placeholder="可选" />
            </div>
          </div>
          <div class="form-group">
            <label>QoS</label>
            <input v-model="qosInput" placeholder="多个用逗号分隔，如: normal,high" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showCreateDialog = false">取消</button>
          <button class="btn btn-primary" @click="saveAssociation">{{ isEditing ? '保存' : '创建' }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { getAssociations, createAssociation as apiCreateAssociation, updateAssociation as apiUpdateAssociation, deleteAssociation as apiDeleteAssociation } from '../api'
import { slurmUserAPI, slurmAccountAPI } from '../api'
import { showSuccess, showError } from '../utils/notification'
import dialog from '../utils/dialog'

interface Association {
  user?: string; account: string; cluster?: string; partition?: string; qos?: string[]; is_default?: boolean
}

const associations = ref<Association[]>([])
const slurmUsers = ref<any[]>([])
const slurmAccounts = ref<any[]>([])
const showCreateDialog = ref(false)
const isEditing = ref(false)
const qosInput = ref('')
const originalAssociation = ref<Association | null>(null)
const loading = ref(false)
const openMenu = ref<string | null>(null)
const menuPosition = ref({ top: 0, left: 0 })

const newAssociation = ref<Association>({ user: '', account: '', cluster: 'cluster', partition: '', qos: [] })

const associationKey = (assoc: Association) => `${assoc.account}-${assoc.user}-${assoc.cluster || ''}-${assoc.partition || ''}`

const openMenuAssoc = computed(() => associations.value.find(assoc => associationKey(assoc) === openMenu.value) || null)
const isAccountAssociationEdit = computed(() => isEditing.value && !newAssociation.value.user)

const menuStyle = computed(() => ({
  top: `${menuPosition.value.top}px`,
  left: `${menuPosition.value.left}px`
}))

const toggleMenu = (assoc: Association, event: MouseEvent) => {
  const key = associationKey(assoc)
  if (openMenu.value === key) {
    openMenu.value = null
    return
  }

  const trigger = event.currentTarget as HTMLElement
  const rect = trigger.getBoundingClientRect()
  const menuWidth = 130
  const gap = 6
  menuPosition.value = {
    top: Math.round(rect.bottom + gap),
    left: Math.round(Math.max(8, rect.right - menuWidth))
  }
  openMenu.value = key
}

const normalizeList = (value: any): any[] => {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.accounts)) return value.accounts
  if (Array.isArray(value?.users)) return value.users
  return []
}

const loadAssociations = async () => {
  loading.value = true
  try {
    const response = await getAssociations()
    associations.value = normalizeList(response.data.data)
      .map(normalizeAssociation)
  } catch (error: any) {
    showError('加载资源绑定失败: ' + (error.response?.data?.error || error.message))
  } finally {
    loading.value = false
  }
}

const normalizeAssociation = (assoc: any): Association => {
  const qos = assoc.qos || assoc.QoS || assoc.Qos || []
  return {
    user: assoc.user || assoc.User || '',
    account: assoc.account || assoc.Account || '',
    cluster: assoc.cluster || assoc.Cluster || 'cluster',
    partition: assoc.partition || assoc.Partition || '',
    qos: Array.isArray(qos) ? qos : String(qos || '').split(',').map(q => q.trim()).filter(Boolean),
    is_default: assoc.is_default || assoc.IsDefault || false
  }
}

const editAssociation = (assoc: Association) => {
  const normalizedAssoc = normalizeAssociation(assoc)
  isEditing.value = true
  originalAssociation.value = { ...normalizedAssoc }
  newAssociation.value = { ...normalizedAssoc }
  qosInput.value = normalizedAssoc.qos?.length ? normalizedAssoc.qos.join(', ') : ''
  showCreateDialog.value = true
}

const saveAssociation = async () => {
  if (!newAssociation.value.account || (!isEditing.value && !newAssociation.value.user)) {
    showError(isEditing.value ? '账户不能为空' : '用户和账户不能为空')
    return
  }
  try {
    const qosList = qosInput.value.split(',').map(q => q.trim()).filter(q => q.length > 0)
    const assocData = { ...newAssociation.value, cluster: newAssociation.value.cluster || 'cluster', qos: qosList.length > 0 ? qosList : undefined }
    if (isEditing.value && originalAssociation.value) {
      await apiUpdateAssociation(originalAssociation.value.account, originalAssociation.value.user || '', originalAssociation.value.cluster || '', assocData)
      showSuccess('资源绑定更新成功')
    } else {
      await apiCreateAssociation(assocData)
      showSuccess('资源绑定创建成功')
    }
    showCreateDialog.value = false
    resetForm()
    setTimeout(loadAssociations, 1000)
  } catch (error: any) {
    showError((isEditing.value ? '更新' : '创建') + '资源绑定失败: ' + (error.response?.data?.error || error.message))
  }
}

const deleteAssociation = async (assoc: Association) => {
  if (!assoc.account) { showError('参数错误'); return }

  const userAssocs = associations.value.filter(a => a.user === assoc.user)
  const isOnly = !!assoc.user && userAssocs.length === 1
  const msg = !assoc.user
    ? `确定要删除账户 ${assoc.account} 的账户级绑定吗？`
    : isOnly
    ? `这是用户 ${assoc.user} 的唯一账户绑定，删除后将无法使用任何账户。确定继续吗？`
    : `确定要删除用户 ${assoc.user} 与账户 ${assoc.account} 的绑定吗？`

  const ok = await dialog.confirm(msg, { title: '删除资源绑定' })
  if (!ok) return

  try {
    await apiDeleteAssociation(assoc.account, assoc.user || '', assoc.cluster || '', assoc.partition || '')
    showSuccess('资源绑定删除成功')
    await loadAssociations()
  } catch (error: any) {
    const msg = error.response?.data?.error || error.message
    if (msg.includes('can not remove the default account')) {
      showError('无法删除默认账户绑定，请先为用户创建新的账户绑定后再删除')
    } else {
      showError('删除资源绑定失败: ' + msg)
    }
  }
}

const resetForm = () => {
  isEditing.value = false
  originalAssociation.value = null
  newAssociation.value = { user: '', account: '', cluster: 'cluster', partition: '', qos: [] }
  qosInput.value = ''
}

watch(showCreateDialog, (val) => {
  if (val) {
    if (!isEditing.value) newAssociation.value.cluster = 'cluster'
    slurmUserAPI.getUsers().then(r => { slurmUsers.value = normalizeList(r) }).catch(() => {})
    slurmAccountAPI.getAccounts().then(r => { slurmAccounts.value = normalizeList(r) }).catch(() => {})
  } else {
    resetForm()
  }
})

const closeMenu = () => { openMenu.value = null }
onMounted(() => {
  loadAssociations()
  document.addEventListener('click', closeMenu)
  window.addEventListener('scroll', closeMenu, true)
  window.addEventListener('resize', closeMenu)
})
onUnmounted(() => {
  document.removeEventListener('click', closeMenu)
  window.removeEventListener('scroll', closeMenu, true)
  window.removeEventListener('resize', closeMenu)
})
</script>

<style scoped>
.admin-associations { padding: 1.5rem; }
.page-desc { margin: 2px 0 0; color: hsl(var(--muted-foreground)); font-size: 0.82rem; }

.association-modal {
  width: min(92vw, 420px);
  max-width: 420px;
}

.user-cell { display: flex; align-items: center; gap: 8px; }
.user-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  background: hsl(var(--primary) / 0.1); color: hsl(var(--primary));
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75rem; font-weight: 700; flex-shrink: 0;
}
.account-level-avatar {
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
}
.user-name { font-weight: 600; font-size: 0.85rem; }

.account-tag {
  font-size: 0.78rem; font-weight: 500;
  background: hsl(var(--secondary)); color: hsl(var(--secondary-foreground));
  padding: 2px 8px; border-radius: 4px;
}
.mono-tag { font-size: 0.78rem; color: hsl(var(--muted-foreground)); background: hsl(var(--muted)/0.5); padding: 2px 6px; border-radius: 4px; }
.partition-tag { font-size: 0.78rem; background: hsl(var(--accent)); color: hsl(var(--accent-foreground)); padding: 2px 8px; border-radius: 4px; }
.qos-list { display: flex; flex-wrap: wrap; gap: 4px; }
.qos-tag { font-size: 0.72rem; background: hsl(var(--primary)/0.08); color: hsl(var(--primary)); padding: 1px 6px; border-radius: 999px; }
.text-muted { color: hsl(var(--muted-foreground)); font-size: 0.8rem; }
.required { color: hsl(var(--destructive)); }

.btn-action-toggle {
  height: 28px; padding: 0 10px;
  background: hsl(var(--background)); border: 1px solid hsl(var(--border));
  border-radius: 6px; font-size: 0.75rem; font-weight: 500;
  color: hsl(var(--foreground)); cursor: pointer; transition: background 0.15s;
}
.btn-action-toggle:hover { background: hsl(var(--accent)); }
.dropdown-menu {
  background: hsl(var(--card)); border: 1px solid hsl(var(--border));
  border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  width: 130px; min-width: 130px; z-index: 9999; overflow: hidden;
}
.dropdown-menu-fixed {
  position: fixed;
  z-index: 2147483647;
}
.dropdown-item {
  display: block; width: 100%; padding: 7px 14px;
  background: none; border: none; text-align: left; cursor: pointer;
  font-size: 0.8rem; color: hsl(var(--foreground)); white-space: nowrap; transition: background 0.1s;
}
.dropdown-item:hover { background: hsl(var(--accent)); }
.dropdown-item.danger { color: hsl(var(--destructive)); }
.dropdown-item.danger:hover { background: hsl(var(--destructive) / 0.08); }
.dropdown-divider { height: 1px; background: hsl(var(--border)); margin: 3px 0; }
</style>
