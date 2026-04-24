<template>
  <div class="admin-groups">
    <div class="page-header">
      <h3>👨‍👩‍👧‍👦 用户组管理</h3>
      <button class="btn-primary" @click="openAddModal">+ 添加用户组</button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading">加载中...</div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-message">{{ error }}</div>

    <!-- 用户组列表 -->
    <div v-else class="card">
      <table class="data-table">
        <thead>
          <tr>
            <th>组名</th>
            <th>GID</th>
            <th>成员数量</th>
            <th>成员列表</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="group in groups" :key="group.gid">
            <td><strong>{{ group.groupName }}</strong></td>
            <td>{{ group.gid }}</td>
            <td>{{ group.members?.length || 0 }}</td>
            <td>
              <div class="members-list">
                <span v-for="member in group.members" :key="member" class="member-tag">
                  {{ member }}
                </span>
                <span v-if="!group.members || group.members.length === 0" class="text-muted">
                  无成员
                </span>
              </div>
            </td>
            <td>
              <div class="action-buttons">
                <button class="btn-link" @click="editGroup(group)">✏️ 编辑</button>
                <button class="btn-link danger" @click="confirmDelete(group)">🗑️ 删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <Teleport to="body">
    <!-- 添加/编辑用户组模态框 -->
    <div v-if="showAddModal || showEditModal" class="modal-overlay" @click.self="closeModals">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ showEditModal ? '编辑用户组' : '添加用户组' }}</h3>
          <button class="btn-close" @click="closeModals">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>组名 *</label>
            <input v-model="formData.groupName" :disabled="showEditModal" />
          </div>
          <div class="form-group">
            <label>GID *</label>
            <input type="number" v-model.number="formData.gid" :disabled="showEditModal" />
          </div>
          <div class="form-group">
            <label>成员列表</label>
            <textarea 
              v-model="membersText" 
              rows="5" 
              placeholder="每行一个用户名，例如：&#10;user1&#10;user2&#10;user3"
            ></textarea>
            <small class="form-hint">每行输入一个用户名</small>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeModals">取消</button>
          <button class="btn-primary" @click="saveGroup" :disabled="saving">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { groupAPI } from '../api'

const groups = ref<any[]>([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)

const showAddModal = ref(false)
const showEditModal = ref(false)
const selectedGroup = ref<any>(null)

const formData = ref({
  groupName: '',
  gid: 0,
  members: [] as string[]
})

const membersText = computed({
  get: () => formData.value.members.join('\n'),
  set: (value: string) => {
    formData.value.members = value.split('\n').map(m => m.trim()).filter(m => m)
  }
})

// 加载用户组列表
const loadGroups = async () => {
  loading.value = true
  error.value = ''
  try {
    groups.value = await groupAPI.getGroups()
  } catch (err: any) {
    error.value = err.response?.data?.error || '加载用户组列表失败'
    console.error('Failed to load groups:', err)
  } finally {
    loading.value = false
  }
}

// 打开添加用户组模态框并自动获取 GID
const openAddModal = async () => {
  try {
    const gid = await groupAPI.getNextGID()
    formData.value.gid = gid
  } catch (err: any) {
    console.error('Failed to get next GID:', err)
    // 如果失败，使用默认值
    formData.value.gid = 1000
  }
  showAddModal.value = true
}

// 编辑用户组
const editGroup = (group: any) => {
  selectedGroup.value = group
  formData.value = { ...group, members: [...(group.members || [])] }
  showEditModal.value = true
}

// 保存用户组
const saveGroup = async () => {
  saving.value = true
  error.value = ''
  
  try {
    if (showAddModal.value) {
      // 创建用户组
      await groupAPI.createGroup(formData.value)
      
      // 直接添加到本地列表
      groups.value.push({ ...formData.value })
      
      alert('用户组创建成功！')
    } else {
      // 更新用户组
      await groupAPI.updateGroup(formData.value.gid, formData.value)
      
      // 直接更新本地列表中的用户组
      const index = groups.value.findIndex(g => g.gid === formData.value.gid)
      if (index !== -1) {
        groups.value[index] = { ...formData.value }
      }
      
      alert('用户组更新成功！')
    }
    
    closeModals()
  } catch (err: any) {
    error.value = err.response?.data?.error || '保存失败'
    alert(error.value)
  } finally {
    saving.value = false
  }
}

// 确认删除
const confirmDelete = (group: any) => {
  if (confirm(`确定要删除用户组 ${group.groupName} 吗？此操作不可恢复！`)) {
    deleteGroup(group.gid)
  }
}

// 删除用户组
const deleteGroup = async (gid: number) => {
  try {
    await groupAPI.deleteGroup(gid)
    
    // 直接从本地列表中移除
    groups.value = groups.value.filter(g => g.gid !== gid)
    
    alert('用户组删除成功！')
  } catch (err: any) {
    alert(err.response?.data?.error || '删除失败')
  }
}

// 关闭模态框
const closeModals = () => {
  showAddModal.value = false
  showEditModal.value = false
  selectedGroup.value = null
  formData.value = {
    groupName: '',
    gid: 0,
    members: []
  }
}

onMounted(() => {
  loadGroups()
})
</script>

<style scoped>
.admin-groups {
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

.members-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.member-tag {
  background: #e0e7ff;
  color: #3730a3;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
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
  background: #fff;
  color: #1e293b;
  border: 1px solid #e2e8f0;
  padding: 7px 16px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.875rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: all 0.15s;
}
.btn-primary:hover { background: #f1f5f9; }
.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

.btn-secondary {
  background: #fff;
  color: #1e293b;
  border: 1px solid #e2e8f0;
  padding: 7px 16px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.875rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: all 0.15s;
}
.btn-secondary:hover { background: #f1f5f9; }

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

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-hint {
  display: block;
  margin-top: 0.5rem;
  color: #6b7280;
  font-size: 0.85rem;
}
</style>
