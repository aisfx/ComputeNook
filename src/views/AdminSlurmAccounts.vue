<template>
  <div class="admin-slurm-accounts">
    <div class="page-header">
      <h3>🏢 Slurm 账户管理</h3>
      <button class="btn-primary" @click="openAddModal">+ 添加账户</button>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="error" class="error-message">{{ error }}</div>

    <div v-else class="card">
      <table class="data-table">
        <thead>
          <tr>
            <th>Account</th>
            <th>Descr</th>
            <th>Org</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="account in accounts" :key="account.name">
            <td><strong>{{ account.name }}</strong></td>
            <td>
              <span v-if="account.description && account.description !== ''">
                {{ account.description }}
              </span>
              <span v-else class="text-muted">未设置</span>
            </td>
            <td>
              <span v-if="account.organization && account.organization !== ''">
                {{ account.organization }}
              </span>
              <span v-else class="text-muted">未设置</span>
            </td>
            <td>
              <div class="action-buttons">
                <button class="btn-link" @click="editAccount(account)">✏️ 编辑</button>
                <button class="btn-link danger" @click="confirmDelete(account)">🗑️ 删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <Teleport to="body">
    <!-- 添加/编辑账户模态框 -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ isEditing ? '编辑账户' : '添加账户' }}</h3>
          <button class="btn-close" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Account (OpenLDAP 用户组) *</label>
            <select v-model="formData.name" :disabled="isEditing" v-if="!isEditing">
              <option value="">-- 选择 LDAP 用户组 --</option>
              <option v-for="group in ldapGroups" :key="group.gid" :value="group.groupName">
                {{ group.groupName }} (GID: {{ group.gid }})
              </option>
            </select>
            <input v-else v-model="formData.name" disabled />
            <small>选择一个 LDAP 用户组作为 Slurm 账户名称</small>
          </div>
          <div class="form-group">
            <label>Descr</label>
            <input v-model="formData.description" placeholder="账户描述" />
            <small>账户的描述信息，留空则使用账户名称</small>
          </div>
          <div class="form-group">
            <label>Org</label>
            <input v-model="formData.organization" placeholder="组织名称" />
            <small>所属组织，留空则使用 "Default"</small>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeModal">取消</button>
          <button class="btn-primary" @click="saveAccount" :disabled="saving">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { slurmAccountAPI, groupAPI } from '../api'
import { showSuccess, showError } from '../utils/notification'

const accounts = ref<any[]>([])
const ldapGroups = ref<any[]>([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const showModal = ref(false)
const isEditing = ref(false)

const formData = ref({
  name: '',
  description: '',
  organization: '',
  parent: '',
  coordinators: [] as string[]
})

// 加载 LDAP 用户组列表
const loadLdapGroups = async () => {
  try {
    ldapGroups.value = await groupAPI.getGroups()
  } catch (err: any) {
    console.error('加载 LDAP 用户组失败:', err)
    showError('加载 LDAP 用户组失败')
  }
}

const loadAccounts = async () => {
  loading.value = true
  error.value = ''
  try {
    accounts.value = await slurmAccountAPI.getAccounts()
  } catch (err: any) {
    error.value = err.response?.data?.error || '加载账户列表失败'
    showError(error.value)
  } finally {
    loading.value = false
  }
}

const openAddModal = async () => {
  isEditing.value = false
  formData.value = {
    name: '',
    description: '',
    organization: '',
    parent: '',
    coordinators: []
  }
  // 加载 LDAP 用户组
  await loadLdapGroups()
  showModal.value = true
}

const editAccount = (account: any) => {
  isEditing.value = true
  formData.value = {
    name: account.name,
    description: account.description || '',
    organization: account.organization || '',
    parent: account.parent || '',
    coordinators: account.coordinators || []
  }
  showModal.value = true
}

const saveAccount = async () => {
  if (!formData.value.name) {
    showError('账户名称不能为空')
    return
  }

  // 设置默认值
  if (!formData.value.description) {
    formData.value.description = formData.value.name
  }
  if (!formData.value.organization) {
    formData.value.organization = 'Default'
  }

  saving.value = true
  try {
    if (isEditing.value) {
      await slurmAccountAPI.updateAccount(formData.value.name, formData.value)
      showSuccess('账户更新成功')
    } else {
      const response = await slurmAccountAPI.createAccount(formData.value)
      // 显示创建的 LDAP 组信息
      if (response.data?.ldap_group) {
        showSuccess(`账户创建成功！已自动创建 LDAP 用户组 (GID: ${response.data.ldap_group.gid})`)
      } else {
        showSuccess('账户创建成功')
      }
    }
    closeModal()
    await loadAccounts()
  } catch (err: any) {
    showError(err.response?.data?.error || '保存失败')
  } finally {
    saving.value = false
  }
}

const confirmDelete = (account: any) => {
  if (confirm(`确定要删除账户 ${account.name} 吗？此操作不可恢复！`)) {
    deleteAccount(account.name)
  }
}

const deleteAccount = async (name: string) => {
  try {
    await slurmAccountAPI.deleteAccount(name)
    showSuccess('账户删除成功')
    await loadAccounts()
  } catch (err: any) {
    showError(err.response?.data?.error || '删除失败')
  }
}

const closeModal = () => {
  showModal.value = false
  formData.value = {
    name: '',
    description: '',
    organization: '',
    parent: '',
    coordinators: []
  }
}

onMounted(() => {
  loadAccounts()
})
</script>

<style scoped>
.admin-slurm-accounts {
  padding: 2rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.page-header h3 {
  margin: 0;
  font-size: 1.5rem;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: #666;
}

.error-message {
  padding: 1rem;
  background: #fee;
  color: #c00;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  background: #f9fafb;
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #555;
  border-bottom: 2px solid #e5e7eb;
}

.data-table td {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.data-table tbody tr:hover {
  background: #f9fafb;
}

.text-muted {
  color: #9ca3af;
  font-style: italic;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-link {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0.25rem 0.5rem;
}

.btn-link:hover {
  text-decoration: underline;
}

.btn-link.danger {
  color: #ef4444;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #e5e7eb;
  color: #374151;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
}

.btn-close {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #9ca3af;
  line-height: 1;
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #374151;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-group small {
  display: block;
  margin-top: 0.25rem;
  color: #6b7280;
  font-size: 0.85rem;
}
</style>
