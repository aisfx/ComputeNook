<template>
  <div class="admin-hours">
    <div class="page-header">
      <h3>⏱️ 机时管理</h3>
      <button class="btn-primary" @click="openAddModal">+ 分配机时</button>
    </div>

    <div class="filters-bar">
      <div class="filter-group">
        <label>搜索：</label>
        <input v-model="searchQuery" placeholder="搜索 QoS 名称" />
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-if="error" class="error-message">{{ error }}</div>

    <div v-else class="card">
      <table class="data-table">
        <thead>
          <tr>
            <th>QoS 名称</th>
            <th>描述</th>
            <th>总机时(小时)</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in filteredHoursList" :key="item.id">
            <td><strong>{{ item.name }}</strong></td>
            <td>{{ item.description || '-' }}</td>
            <td>{{ item.total.toLocaleString() }}</td>
            <td>
              <span class="status-badge" :class="getStatusClass(item)">
                {{ getStatusText(item) }}
              </span>
            </td>
            <td>
              <div class="action-buttons">
                <button class="btn-link" @click="editHours(item)">✏️ 编辑</button>
                <button class="btn-link danger" @click="deleteHours(item)">🗑️ 清除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      
      <div v-if="filteredHoursList.length === 0" class="empty-state">
        <p>暂无机时分配记录</p>
      </div>
    </div>
  </div>
  <Teleport to="body">
    <!-- 添加/编辑机时模态框 -->
    <div v-if="showModal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ isEdit ? '编辑机时分配' : '分配机时' }}</h3>
          <button class="btn-close" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>
          
          <div class="form-group">
            <label>QoS 名称 *</label>
            <input 
              v-if="isEdit" 
              v-model="formData.name" 
              disabled 
            />
            <select v-else v-model="formData.name">
              <option value="">请选择 QoS...</option>
              <option v-for="item in availableTargets" :key="item" :value="item">
                {{ item }}
              </option>
            </select>
            <small class="form-hint">选择要设置机时限制的 QoS</small>
          </div>

          <div class="form-group">
            <label>总机时（小时）*</label>
            <input 
              type="number" 
              v-model.number="formData.total" 
              placeholder="例如: 10000" 
              min="1"
            />
            <small class="form-hint">将转换为 billing-minutes 写入 QoS 的 GrpTRESMins</small>
          </div>

          <div class="form-group">
            <label>备注</label>
            <textarea 
              v-model="formData.notes" 
              placeholder="可选的备注信息（写入 QoS description）"
              rows="3"
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeModal">取消</button>
          <button class="btn-primary" @click="saveHours" :disabled="saving">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { userAPI, qosAPI, slurmAccountAPI, usageAPI } from '../api'

const hoursList = ref<any[]>([])
const loading = ref(false)
const error = ref('')
const showModal = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const modalError = ref('')
const filterType = ref('all')
const searchQuery = ref('')

const qosList = ref<any[]>([])
const accounts = ref<any[]>([])

const formData = ref({
  type: 'qos',       // 通过 QoS 的 GrpTRESMins 来限制机时
  name: '',          // QoS 名称
  total: 0,          // 总机时（小时），转换为 billing-minutes 存入 GrpTRESMins
  expireDate: '',
  notes: ''
})

// 加载 QoS 和账户列表
const loadQoSAndAccounts = async () => {
  try {
    const [qosData, accountsData] = await Promise.all([
      qosAPI.getQoSList(),
      slurmAccountAPI.getAccounts()
    ])
    qosList.value = qosData || []
    accounts.value = accountsData || []
  } catch (err) {
    console.error('Failed to load QoS/accounts:', err)
  }
}

// 可选择的目标列表（QoS 名称）
const availableTargets = computed(() => {
  return qosList.value.map((q: any) => q.name)
})

// 从 QoS 数据中提取 billing 限制（小时）
const extractBillingHours = (qos: any): number => {
  // 新版 v0.0.43 嵌套结构
  const minutesTotal = qos?.limits?.max?.tres?.minutes?.total
  if (Array.isArray(minutesTotal)) {
    const billing = minutesTotal.find((t: any) => t.type === 'billing')
    if (billing && billing.count > 0) return billing.count / 60
  }
  // 旧版字段 grp_tres_mins
  if (qos?.grp_tres_mins) {
    const mins = parseInt(qos.grp_tres_mins)
    if (!isNaN(mins) && mins > 0) return mins / 60
  }
  return 0
}

// 过滤后的机时列表（基于 QoS 数据）
const filteredHoursList = computed(() => {
  let filtered = hoursList.value

  if (filterType.value !== 'all') {
    filtered = filtered.filter(item => item.type === filterType.value)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(item =>
      item.name.toLowerCase().includes(query)
    )
  }

  return filtered
})

// 加载机时列表（从 QoS 读取 billing 限制）
const loadHoursList = async () => {
  loading.value = true
  error.value = ''

  try {
    const qosData = await qosAPI.getQoSList()
    qosList.value = qosData || []

    hoursList.value = qosList.value
      .filter((qos: any) => extractBillingHours(qos) > 0)
      .map((qos: any) => {
        const total = extractBillingHours(qos)
        return {
          id: qos.name,
          type: 'qos',
          name: qos.name,
          description: qos.description || '',
          total: Math.round(total),
          used: 0,       // 需要查询实际使用量
          remaining: Math.round(total),
          usage: 0,
          expireDate: '-',
          notes: qos.description || ''
        }
      })
  } catch (err: any) {
    error.value = err.response?.data?.error || '加载机时列表失败'
  } finally {
    loading.value = false
  }
}

// 获取进度条颜色
const getProgressColor = (usage: number) => {
  if (usage >= 90) return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
  if (usage >= 70) return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
  return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
}

// 获取状态样式
const getStatusClass = (item: any) => {
  if (item.usage >= 100) return 'status-expired'
  if (item.usage >= 80) return 'status-warning'
  return 'status-normal'
}

// 获取状态文本
const getStatusText = (item: any) => {
  if (item.usage >= 100) return '已超额'
  if (item.usage >= 80) return '即将用完'
  return '正常'
}

const openAddModal = () => {
  isEdit.value = false
  formData.value = { type: 'qos', name: '', total: 0, expireDate: '', notes: '' }
  showModal.value = true
}

const editHours = (item: any) => {
  isEdit.value = true
  formData.value = {
    type: item.type,
    name: item.name,
    total: item.total,
    expireDate: item.expireDate === '-' ? '' : item.expireDate,
    notes: item.notes || ''
  }
  showModal.value = true
}

const saveHours = async () => {
  modalError.value = ''

  if (!formData.value.name) {
    modalError.value = '请选择 QoS'
    return
  }
  if (formData.value.total <= 0) {
    modalError.value = '总机时必须大于0'
    return
  }

  saving.value = true

  try {
    // 将小时转换为 billing-minutes，写入 QoS 的 GrpTRESMins
    const billingMinutes = formData.value.total * 60
    const qosPayload = {
      name: formData.value.name,
      description: formData.value.notes,
      grp_tres_mins: String(billingMinutes)
    }

    if (isEdit.value) {
      await qosAPI.updateQoS(formData.value.name, qosPayload)
    } else {
      await qosAPI.updateQoS(formData.value.name, qosPayload)
    }

    closeModal()
    await loadHoursList()
  } catch (err: any) {
    modalError.value = err.response?.data?.error || '保存失败'
  } finally {
    saving.value = false
  }
}

const deleteHours = async (item: any) => {
  if (confirm(`确定要清除 ${item.name} 的机时限制吗？（将 GrpTRESMins 设为无限制）`)) {
    try {
      await qosAPI.updateQoS(item.name, { name: item.name, grp_tres_mins: '0' })
      await loadHoursList()
    } catch (err: any) {
      alert(err.response?.data?.error || '操作失败')
    }
  }
}

const closeModal = () => {
  showModal.value = false
  modalError.value = ''
}

onMounted(() => {
  loadHoursList()
  loadQoSAndAccounts()
})
</script>

<style scoped>
.admin-hours {
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

.filters-bar {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
  align-items: center;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-group label {
  font-weight: 600;
  color: #374151;
  white-space: nowrap;
}

.filter-group select,
.filter-group input {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.95rem;
}

.filter-group input {
  min-width: 250px;
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
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 1000px;
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

.type-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.type-user {
  background: #dbeafe;
  color: #1e40af;
}

.type-account {
  background: #fef3c7;
  color: #92400e;
}

.progress-bar {
  width: 100px;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  display: inline-block;
  margin-right: 0.5rem;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s;
}

.usage-text {
  font-size: 0.9rem;
  color: #6b7280;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.status-normal {
  background: #d1fae5;
  color: #065f46;
}

.status-warning {
  background: #fed7aa;
  color: #92400e;
}

.status-expired {
  background: #fee2e2;
  color: #991b1b;
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
  font-size: 0.85rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: all 0.15s;
}

.btn-primary:hover {
  background: #f1f5f9;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-secondary {
  background: #fff;
  color: #1e293b;
  border: 1px solid #e2e8f0;
  padding: 7px 16px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.85rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: all 0.15s;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #6b7280;
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

.alert {
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.alert-error {
  background: #fee2e2;
  color: #991b1b;
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
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #94a3b8;
  box-shadow: 0 0 0 2px rgba(0,0,0,0.08);
}

.form-hint {
  display: block;
  margin-top: 0.5rem;
  color: #6b7280;
  font-size: 0.85rem;
}

@media (max-width: 768px) {
  .filters-bar {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filter-group {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filter-group input {
    min-width: auto;
  }
}
</style>
