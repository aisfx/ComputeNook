<template>
  <div class="admin-qos">
    <div class="page-header">
      <h3>⚡ QoS 管理 (服务质量)</h3>
      <button class="btn-primary" @click="openAddModal">+ 添加 QoS</button>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-if="error" class="error-message">{{ error }}</div>

    <div v-else class="card">
      <table class="data-table">
        <thead>
          <tr>
            <th>名称</th>
            <th>描述</th>
            <th>优先级</th>
            <th>最大作业数</th>
            <th>最大节点数</th>
            <th>最大 CPU 核心</th>
            <th>最大作业运行时间</th>
            <th>最大用户运行时间</th>
            <th>总机时限制</th>
            <th>绑定用户/组</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="qos in qosList" :key="qos.name">
            <td><strong>{{ qos.name }}</strong></td>
            <td>{{ qos.description || '-' }}</td>
            <td>
              <span class="priority-badge" :class="getPriorityClass(qos.priority)">
                {{ formatValue(qos.priority) }}
              </span>
            </td>
            <td>{{ formatValue(qos.max_jobs_pu) }}</td>
            <td>{{ formatValue(qos.max_nodes_pu) }}</td>
            <td>{{ formatValue(qos.max_cpus_pu) }}</td>
            <td>{{ formatWallTime(qos.max_wall_pj) }}</td>
            <td>{{ formatWallTime(qos.max_wall_pu) }}</td>
            <td>{{ formatTRESMins(qos.grp_tres_mins) }}</td>
            <td>
              <button class="btn-link-small" @click="viewBindings(qos)">
                👥 查看绑定
              </button>
            </td>
            <td>
              <div class="action-buttons">
                <button class="btn-link" @click="editQoS(qos)">✏️ 编辑</button>
                <button class="btn-link danger" @click="confirmDelete(qos)">🗑️ 删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 添加/编辑 QoS 模态框 -->
    <div v-if="showModal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ isEdit ? '编辑 QoS' : '添加 QoS' }}</h3>
          <button class="btn-close" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>
          
          <div class="form-group">
            <label>名称 *</label>
            <input v-model="formData.name" :disabled="isEdit" placeholder="例如: high" />
          </div>
          <div class="form-group">
            <label>描述</label>
            <input v-model="formData.description" placeholder="QoS 描述" />
          </div>
          <div class="form-group">
            <label>优先级</label>
            <input type="number" v-model.number="formData.priority" placeholder="100" />
            <small class="form-hint">数值越大优先级越高</small>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>每用户最大作业数</label>
              <input type="number" v-model.number="formData.max_jobs_pu" placeholder="100" />
            </div>
            <div class="form-group">
              <label>每用户最大提交数</label>
              <input type="number" v-model.number="formData.max_submit_pu" placeholder="200" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>每用户最大节点数</label>
              <input type="number" v-model.number="formData.max_nodes_pu" placeholder="10" />
            </div>
            <div class="form-group">
              <label>每用户最大 CPU 核心数</label>
              <input type="number" v-model.number="formData.max_cpus_pu" placeholder="128" />
            </div>
          </div>

          <div class="form-group">
            <label>每作业最大运行时间（分钟）</label>
            <input type="number" v-model.number="formData.max_wall_pj" placeholder="1440" />
            <small class="form-hint">1440 分钟 = 24 小时，限制单个作业的最长运行时间</small>
          </div>

          <div class="form-group">
            <label>每用户最大运行时间（分钟）</label>
            <input type="number" v-model.number="formData.max_wall_pu" placeholder="10080" />
            <small class="form-hint">10080 分钟 = 7 天，限制用户所有作业的总运行时间</small>
          </div>

          <div class="form-group">
            <label>总机时限制（GrpTRESMins）</label>
            <input v-model="formData.grp_tres_mins" placeholder="例如: cpu=100000" />
            <small class="form-hint">格式: cpu=100000 表示总共 100000 CPU-分钟，gres/gpu=10000 表示 10000 GPU-分钟</small>
          </div>

          <div class="form-group">
            <label>组总 TRES 限制（GrpTRES）</label>
            <input v-model="formData.grp_tres" placeholder="例如: cpu=1000,gres/gpu=10" />
            <small class="form-hint">限制该 QoS 下所有用户同时使用的总资源</small>
          </div>

          <div class="form-group">
            <label>最大 TRES 资源（每用户）</label>
            <input v-model="formData.max_tres_pu" placeholder="例如: gres/gpu=4" />
            <small class="form-hint">格式: gres/gpu=4 表示最多 4 张 GPU 卡</small>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeModal">取消</button>
          <button class="btn-primary" @click="saveQoS" :disabled="saving">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- QoS 绑定查看模态框 -->
    <div v-if="showBindingsModal" class="modal-overlay" @click.self="closeBindingsModal">
      <div class="modal modal-large">
        <div class="modal-header">
          <h3>QoS 绑定: {{ selectedQoS?.name }}</h3>
          <button class="btn-close" @click="closeBindingsModal">×</button>
        </div>
        <div class="modal-body">
          <div v-if="loadingBindings" class="loading-text">加载中...</div>
          <div v-else-if="bindingsError" class="alert alert-error">{{ bindingsError }}</div>
          <div v-else>
            <div class="bindings-section">
              <h4>📋 通过关联（Association）绑定</h4>
              <p class="hint-text">
                QoS 通过 Association 绑定到用户和账户。在"账户关联"页面可以创建和管理这些绑定。
              </p>
              
              <div v-if="qosBindings.length === 0" class="empty-state">
                <p>暂无绑定此 QoS 的关联</p>
                <button class="btn-primary" @click="goToAssociations">
                  前往账户关联页面
                </button>
              </div>
              
              <table v-else class="bindings-table">
                <thead>
                  <tr>
                    <th>用户</th>
                    <th>账户</th>
                    <th>集群</th>
                    <th>分区</th>
                    <th>默认 QoS</th>
                    <th>可用 QoS 列表</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(binding, index) in qosBindings" :key="index">
                    <td><strong>{{ binding.user }}</strong></td>
                    <td>{{ binding.account }}</td>
                    <td>{{ binding.cluster }}</td>
                    <td>{{ binding.partition || '-' }}</td>
                    <td>
                      <span v-if="binding.qos === selectedQoS?.name" class="badge badge-primary">
                        {{ binding.qos }}
                      </span>
                      <span v-else>{{ binding.qos || '-' }}</span>
                    </td>
                    <td>{{ binding.qos_list || '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="bindings-info">
              <h4>💡 如何绑定 QoS</h4>
              <ol>
                <li>前往"系统管理" → "账户关联"页面</li>
                <li>创建或编辑关联时，选择此 QoS 作为默认 QoS 或添加到可用 QoS 列表</li>
                <li>用户通过关联获得使用此 QoS 的权限</li>
              </ol>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeBindingsModal">关闭</button>
          <button class="btn-primary" @click="goToAssociations">
            前往账户关联页面
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, inject } from 'vue'
import { qosAPI } from '../api'
import notification from '../utils/notification'

const qosList = ref<any[]>([])
const loading = ref(false)
const error = ref('')
const showModal = ref(false)
const showBindingsModal = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const modalError = ref('')
const selectedQoS = ref<any>(null)
const qosBindings = ref<any[]>([])
const loadingBindings = ref(false)
const bindingsError = ref('')

const formData = ref({
  name: '',
  description: '',
  priority: 100,
  max_jobs_pu: 0,
  max_submit_pu: 0,
  max_nodes_pu: 0,
  max_cpus_pu: 0,
  max_wall_pj: 0,
  max_wall_pu: 0,
  max_tres_pu: ''
})

// 加载 QoS 列表
const loadQoSList = async () => {
  loading.value = true
  error.value = ''
  try {
    qosList.value = await qosAPI.getQoSList()
  } catch (err: any) {
    const errorMsg = err.response?.data?.error || '加载 QoS 列表失败'
    
    // 检查是否是数据库连接错误
    if (err.response?.status === 502 || errorMsg.includes('Unable to connect to database')) {
      error.value = '⚠️ Slurm 数据库连接失败。请检查 slurmdbd 服务是否正常运行。\n\n' +
                    '可能的原因：\n' +
                    '1. slurmdbd 服务未启动\n' +
                    '2. MySQL/MariaDB 数据库未运行\n' +
                    '3. MUNGE 认证失败\n' +
                    '4. JWT token 已过期\n\n' +
                    '临时解决方案：在 backend/.env 中设置 DEV_MODE=true 使用模拟数据'
    } else {
      error.value = errorMsg
    }
    console.error('Failed to load QoS list:', err)
  } finally {
    loading.value = false
  }
}

// 查看 QoS 绑定（功能已移除）
const viewBindings = async (qos: any) => {
  notification.info('QoS 绑定查看功能已移除')
}

const closeBindingsModal = () => {
  showBindingsModal.value = false
  selectedQoS.value = null
  qosBindings.value = []
}

const goToAssociations = () => {
  notification.info('账户关联管理功能已移除')
  closeBindingsModal()
}

const openAddModal = () => {
  isEdit.value = false
  formData.value = {
    name: '',
    description: '',
    priority: 100,
    max_jobs_pu: 0,
    max_submit_pu: 0,
    max_nodes_pu: 0,
    max_cpus_pu: 0,
    max_wall_pj: 0,
    max_wall_pu: 0,
    max_tres_pu: ''
  }
  showModal.value = true
}

const editQoS = (qos: any) => {
  isEdit.value = true
  formData.value = {
    name: qos.name,
    description: qos.description || '',
    priority: extractNumber(qos.priority) || 100,
    max_jobs_pu: extractNumber(qos.max_jobs_pu) || 0,
    max_submit_pu: extractNumber(qos.max_submit_pu) || 0,
    max_nodes_pu: extractNumber(qos.max_nodes_pu) || 0,
    max_cpus_pu: extractNumber(qos.max_cpus_pu) || 0,
    max_wall_pj: extractNumber(qos.max_wall_pj) || 0,
    max_wall_pu: extractNumber(qos.max_wall_pu) || 0,
    max_tres_pu: qos.max_tres_pu || ''
  }
  showModal.value = true
}

// 提取数值（处理可能是对象的情况）
const extractNumber = (value: any): number => {
  if (typeof value === 'number') return value
  if (typeof value === 'object' && value !== null) {
    // 如果是对象，尝试提取 set 或 number 字段
    return value.set || value.number || 0
  }
  return 0
}

// 格式化显示值
const formatValue = (value: any): string => {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'number') return value.toString()
  if (typeof value === 'object' && value !== null) {
    return (value.set || value.number || '-').toString()
  }
  return value.toString()
}

const saveQoS = async () => {
  modalError.value = ''
  
  if (!formData.value.name) {
    modalError.value = 'QoS 名称不能为空'
    return
  }

  saving.value = true
  
  try {
    if (isEdit.value) {
      await qosAPI.updateQoS(formData.value.name, formData.value)
      alert('QoS 更新成功！')
    } else {
      await qosAPI.createQoS(formData.value)
      alert('QoS 创建成功！')
    }
    
    closeModal()
    await loadQoSList()
  } catch (err: any) {
    modalError.value = err.response?.data?.error || '保存失败'
  } finally {
    saving.value = false
  }
}

const confirmDelete = async (qos: any) => {
  if (confirm(`确定要删除 QoS ${qos.name} 吗？此操作不可恢复！`)) {
    try {
      await qosAPI.deleteQoS(qos.name)
      alert('QoS 删除成功！')
      await loadQoSList()
    } catch (err: any) {
      alert(err.response?.data?.error || '删除失败')
    }
  }
}

const closeModal = () => {
  showModal.value = false
  modalError.value = ''
}

// 格式化运行时间
const formatWallTime = (value: any) => {
  const minutes = extractNumber(value)
  if (!minutes) return '-'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0) {
    return `${hours}小时${mins > 0 ? mins + '分钟' : ''}`
  }
  return `${mins}分钟`
}

// 获取优先级样式
const getPriorityClass = (value: any) => {
  const priority = extractNumber(value)
  if (priority >= 200) return 'priority-high'
  if (priority >= 100) return 'priority-normal'
  return 'priority-low'
}

onMounted(() => {
  loadQoSList()
})
</script>

<style scoped>
.admin-qos {
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

.priority-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.priority-high {
  background: #fef3c7;
  color: #92400e;
}

.priority-normal {
  background: #dbeafe;
  color: #1e40af;
}

.priority-low {
  background: #e5e7eb;
  color: #374151;
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

.form-hint {
  display: block;
  margin-top: 0.5rem;
  color: #6b7280;
  font-size: 0.85rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.modal-large {
  max-width: 900px;
}

.bindings-section {
  margin-bottom: 2rem;
}

.bindings-section h4 {
  margin: 0 0 1rem 0;
  color: #374151;
}

.hint-text {
  color: #6b7280;
  margin-bottom: 1rem;
  line-height: 1.6;
}

.bindings-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

.bindings-table th {
  background: #f9fafb;
  padding: 0.75rem;
  text-align: left;
  font-weight: 600;
  color: #555;
  border-bottom: 2px solid #e5e7eb;
  font-size: 0.9rem;
}

.bindings-table td {
  padding: 0.75rem;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.9rem;
}

.bindings-table tbody tr:hover {
  background: #f9fafb;
}

.badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.badge-primary {
  background: #dbeafe;
  color: #1e40af;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #6b7280;
}

.empty-state p {
  margin-bottom: 1rem;
}

.bindings-info {
  background: #f0f9ff;
  padding: 1.5rem;
  border-radius: 8px;
  border-left: 4px solid #3b82f6;
}

.bindings-info h4 {
  margin: 0 0 1rem 0;
  color: #1e40af;
}

.bindings-info ol {
  margin: 0;
  padding-left: 1.5rem;
  color: #374151;
}

.bindings-info li {
  margin-bottom: 0.5rem;
  line-height: 1.6;
}

.loading-text {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
}

.btn-link-small {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0.25rem 0.5rem;
  text-decoration: none;
}

.btn-link-small:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .modal-large {
    max-width: 95%;
  }
}
</style>
