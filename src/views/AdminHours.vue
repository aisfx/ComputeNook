<template>
  <div class="admin-hours">
    <div class="page-header">
      <h3>⏱️ 机时管理</h3>
      <button class="btn-secondary" @click="openAddModal">+ 分配机时</button>
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
import dialog from '../utils/dialog'

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
  const ok = await dialog.confirm(`确定要清除 ${item.name} 的机时限制吗？（将 GrpTRESMins 设为无限制）`, { title: '清除机时限制' })
  if (!ok) return
  try {
    await qosAPI.updateQoS(item.name, { name: item.name, grp_tres_mins: '0' })
    await loadHoursList()
  } catch (err: any) {
    dialog.error(err.response?.data?.error || '操作失败')
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
.admin-hours { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }

.filters-bar {
  display: flex; gap: 0.6rem; align-items: center;
  background: hsl(var(--card)); border: 1px solid hsl(var(--border));
  border-radius: 12px; padding: 0.6rem 0.9rem;
}
.filter-group { display: flex; align-items: center; gap: 6px; }
.filter-group label { font-size: 0.8rem; font-weight: 500; color: hsl(var(--muted-foreground)); white-space: nowrap; }
.filter-group select, .filter-group input {
  padding: 6px 11px; border: 1.5px solid hsl(var(--border)); border-radius: 8px;
  font-size: 0.83rem; background: hsl(var(--background)); color: hsl(var(--foreground));
  outline: none; transition: border-color 0.15s, box-shadow 0.15s;
}
.filter-group input { min-width: 200px; }
.filter-group select:focus, .filter-group input:focus {
  border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
}

/* 表格卡片 */
.card {
  background: hsl(var(--card)); border: 1px solid hsl(var(--border));
  border-radius: 14px; overflow: hidden;
  box-shadow: 0 1px 6px rgba(0,0,0,0.04);
}
.data-table { width: 100%; border-collapse: collapse; }
.data-table th {
  background: hsl(var(--muted)/0.4); padding: 11px 16px; text-align: left;
  font-size: 0.75rem; font-weight: 600; color: hsl(var(--muted-foreground));
  border-bottom: 1px solid hsl(var(--border)); white-space: nowrap;
  letter-spacing: 0.03em; text-transform: uppercase;
}
.data-table td {
  padding: 13px 16px; border-bottom: 1px solid hsl(var(--border));
  font-size: 0.85rem; color: hsl(var(--foreground));
}
.data-table tbody tr:last-child td { border-bottom: none; }
.data-table tbody tr:hover { background: hsl(var(--muted)/0.25); }

.status-badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px; border-radius: 999px; font-size: 0.75rem; font-weight: 600;
}
.status-badge::before {
  content: ''; width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
}
.status-normal  { background: #dcfce7; color: #15803d; }
.status-normal::before  { background: #16a34a; }
.status-warning { background: #fef9c3; color: #a16207; }
.status-warning::before { background: #ca8a04; }
.status-expired { background: #fee2e2; color: #b91c1c; }
.status-expired::before { background: #dc2626; }

.action-buttons { display: flex; gap: 4px; }
.btn-link {
  display: inline-flex; align-items: center; gap: 4px;
  background: none; border: 1px solid transparent; padding: 4px 10px;
  border-radius: 7px; font-size: 0.78rem; cursor: pointer;
  color: #6366f1; transition: all 0.15s; font-weight: 500;
}
.btn-link:hover { background: rgba(99,102,241,0.08); border-color: rgba(99,102,241,0.2); }
.btn-link.danger { color: #ef4444; }
.btn-link.danger:hover { background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.2); }

.empty-state {
  text-align: center; padding: 3rem; color: hsl(var(--muted-foreground));
  font-size: 0.88rem;
}

.progress-bar { width: 80px; height: 6px; background: hsl(var(--muted)); border-radius: 999px; overflow: hidden; display: inline-block; margin-right: 6px; vertical-align: middle; }
.progress-fill { height: 100%; border-radius: 999px; transition: width 0.3s; }
.usage-text { font-size: 0.8rem; color: hsl(var(--muted-foreground)); }

/* 通用按钮 */
.btn-secondary {
  padding: 8px 18px; background: hsl(var(--muted)); color: hsl(var(--foreground));
  border: 1.5px solid hsl(var(--border)); border-radius: 10px;
  font-size: 0.85rem; font-weight: 500; cursor: pointer; transition: all 0.15s;
}
.btn-secondary:hover { background: hsl(var(--accent)); }

/* 弹窗 */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(15,23,42,0.55);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
  animation: ov-in 0.15s ease;
}
@keyframes ov-in { from { opacity: 0; } to { opacity: 1; } }
.modal {
  background: hsl(var(--card)); border: 1px solid hsl(var(--border));
  border-radius: 18px; width: 92%; max-width: 480px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.15);
  animation: modal-in 0.2s cubic-bezier(0.34,1.56,0.64,1);
}
@keyframes modal-in { from { opacity:0; transform:scale(0.94) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 1.3rem 1.6rem 1rem; border-bottom: 1px solid hsl(var(--border));
}
.modal-header h3 { margin: 0; font-size: 1rem; font-weight: 700; color: hsl(var(--foreground)); }
.btn-close {
  width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  background: hsl(var(--muted)); border: none; border-radius: 8px;
  font-size: 1rem; cursor: pointer; color: hsl(var(--muted-foreground)); transition: all 0.15s;
}
.btn-close:hover { background: hsl(var(--accent)); color: hsl(var(--foreground)); }
.modal-body { padding: 1.4rem 1.6rem; display: flex; flex-direction: column; gap: 1rem; }
.modal-footer {
  display: flex; justify-content: flex-end; gap: 0.75rem;
  padding: 1rem 1.6rem; border-top: 1px solid hsl(var(--border));
}

.form-group { display: flex; flex-direction: column; gap: 5px; }
.form-group label { font-size: 0.78rem; font-weight: 600; color: hsl(var(--foreground)); }
.form-group input, .form-group select, .form-group textarea {
  padding: 8px 11px; border: 1.5px solid hsl(var(--border)); border-radius: 9px;
  font-size: 0.85rem; outline: none;
  background: hsl(var(--background)); color: hsl(var(--foreground));
  transition: border-color 0.15s, box-shadow 0.15s;
}
.form-group input:focus, .form-group select:focus, .form-group textarea:focus {
  border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
}
.form-group input:disabled { background: hsl(var(--muted)); color: hsl(var(--muted-foreground)); }
.form-hint { font-size: 0.72rem; color: hsl(var(--muted-foreground)); }

.alert { padding: 8px 12px; border-radius: 8px; font-size: 0.83rem; margin-bottom: 0.25rem; }
.alert-error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }

.loading { text-align: center; padding: 2rem; color: hsl(var(--muted-foreground)); font-size: 0.88rem; }
.error-message { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 10px; padding: 10px 14px; font-size: 0.85rem; }
</style>

