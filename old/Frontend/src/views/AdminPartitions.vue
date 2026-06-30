<template>
  <div class="admin-partitions">
    <div class="page-header">
      <h3>🗂️ 分区配置管理</h3>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="exportConfig">📥 导出配置</button>
        <button class="btn btn-secondary" @click="openImportModal">📤 导入配置</button>
        <button class="btn btn-success" @click="applyConfig" :disabled="applying">
          {{ applying ? '应用中...' : '✅ 应用配置' }}
        </button>
        <button class="btn btn-primary" @click="openAddModal">+ 添加分区</button>
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-if="error" class="error-message">{{ error }}</div>

    <div v-else class="card">
      <div class="info-banner">
        <span class="info-icon">ℹ️</span>
        <div>
          <strong>分区配置说明：</strong>
          在数据库中管理分区配置，点击"应用配置"后会自动生成 partition.conf 文件并重新加载 Slurm 服务。
        </div>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>分区名称</th>
            <th>节点</th>
            <th>超额订阅</th>
            <th>默认分区</th>
            <th>最大时间</th>
            <th>状态</th>
            <th>允许的组</th>
            <th>允许的账户</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="partition in partitions" :key="partition.id">
            <td>
              <span class="partition-name" :class="{ 'is-default': partition.is_default }">
                {{ partition.name }}
                <span v-if="partition.is_default" class="badge badge-primary">默认</span>
              </span>
            </td>
            <td>{{ partition.nodes }}</td>
            <td>{{ partition.over_subscribe }}</td>
            <td>
              <span :class="partition.is_default ? 'badge badge-success' : 'badge badge-secondary'">
                {{ partition.is_default ? '是' : '否' }}
              </span>
            </td>
            <td>{{ partition.max_time }}</td>
            <td>
              <span class="badge" :class="getStateBadgeClass(partition.state)">
                {{ partition.state }}
              </span>
            </td>
            <td>{{ partition.allow_groups || '-' }}</td>
            <td>{{ partition.allow_accounts || '-' }}</td>
            <td>
              <div class="action-buttons">
                <button class="btn btn-link" @click="editPartition(partition)">✏️ 编辑</button>
                <button class="btn btn-link danger" @click="confirmDelete(partition)">🗑️ 删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="partitions.length === 0" class="empty-state">
        <p>暂无分区配置</p>
        <button class="btn btn-primary" @click="openAddModal">添加第一个分区</button>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <!-- 添加/编辑分区模态框 -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal modal-large">
        <div class="modal-header">
          <h3>{{ isEdit ? '编辑分区' : '添加分区' }}</h3>
          <button class="btn-close" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>
          
          <div class="form-group">
            <label>分区名称 *</label>
            <input v-model="formData.name" :disabled="isEdit" placeholder="例如: all, gpu, high" />
            <small class="form-hint">分区的唯一标识符</small>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>节点列表 *</label>
              <input v-model="formData.nodes" placeholder="ALL 或 node[01-10]" />
              <small class="form-hint">ALL 表示所有节点，或使用节点范围如 node[01-10]</small>
            </div>
            <div class="form-group">
              <label>超额订阅策略</label>
              <select v-model="formData.over_subscribe">
                <option value="Exclusive">Exclusive - 独占模式</option>
                <option value="NO">NO - 不允许超额订阅</option>
                <option value="YES">YES - 允许超额订阅</option>
                <option value="FORCE">FORCE - 强制超额订阅</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>默认分区</label>
              <div class="checkbox-wrapper">
                <input type="checkbox" v-model="formData.is_default" id="is_default" />
                <label for="is_default">设为默认分区</label>
              </div>
              <small class="form-hint">只能有一个默认分区</small>
            </div>
            <div class="form-group">
              <label>分区状态</label>
              <select v-model="formData.state">
                <option value="UP">UP - 正常运行</option>
                <option value="DOWN">DOWN - 关闭</option>
                <option value="DRAIN">DRAIN - 排空</option>
                <option value="INACTIVE">INACTIVE - 不活动</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>最大运行时间</label>
            <input v-model="formData.max_time" placeholder="INFINITE 或 7-00:00:00" />
            <small class="form-hint">INFINITE 表示无限制，或使用格式 D-HH:MM:SS（如 7-00:00:00 表示7天）</small>
          </div>

          <div class="form-group">
            <label>允许的用户组</label>
            <input v-model="formData.allow_groups" placeholder="root,test1,hpc-admin" />
            <small class="form-hint">逗号分隔的用户组列表，留空表示所有组</small>
          </div>

          <div class="form-group">
            <label>允许的账户</label>
            <input v-model="formData.allow_accounts" placeholder="root,test1,hpc-admin" />
            <small class="form-hint">逗号分隔的账户列表，留空表示所有账户</small>
          </div>

          <div class="form-group">
            <label>TRES 计费权重</label>
            <input v-model="formData.tres_billing_weights" placeholder='node=0,CPU=1.0,mem=1.0G' />
            <small class="form-hint">资源计费权重，如 node=0,CPU=1.0,mem=1.0G,gres/gpu=10.0</small>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="savePartition" :disabled="saving">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 导入配置模态框 -->
    <div v-if="showImportModal" class="modal-overlay" @click.self="closeImportModal">
      <div class="modal">
        <div class="modal-header">
          <h3>导入分区配置</h3>
          <button class="btn-close" @click="closeImportModal">×</button>
        </div>
        <div class="modal-body">
          <div v-if="importError" class="alert alert-error">{{ importError }}</div>
          
          <div class="form-group">
            <label>JSON 配置</label>
            <textarea v-model="importData" rows="15" placeholder='[{"name":"all","nodes":"ALL",...}]'></textarea>
            <small class="form-hint">粘贴 JSON 格式的分区配置</small>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeImportModal">取消</button>
          <button class="btn btn-primary" @click="importConfig" :disabled="importing">
            {{ importing ? '导入中...' : '导入' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { dialog } from '../utils/dialog'

interface Partition {
  id: number
  name: string
  nodes: string
  over_subscribe: string
  is_default: boolean
  max_time: string
  state: string
  allow_groups: string
  allow_accounts: string
  tres_billing_weights: string
  created_at: string
  updated_at: string
}

const partitions = ref<Partition[]>([])
const loading = ref(false)
const error = ref('')
const showModal = ref(false)
const showImportModal = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const applying = ref(false)
const importing = ref(false)
const modalError = ref('')
const importError = ref('')
const importData = ref('')

const formData = ref({
  name: '',
  nodes: 'ALL',
  over_subscribe: 'Exclusive',
  is_default: false,
  max_time: 'INFINITE',
  state: 'UP',
  allow_groups: '',
  allow_accounts: '',
  tres_billing_weights: ''
})

// 加载分区列表
const loadPartitions = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await axios.get('/partitions')
    partitions.value = response.data.data || []
  } catch (err: any) {
    error.value = err.response?.data?.error || '加载分区配置失败'
    dialog.error(error.value)
  } finally {
    loading.value = false
  }
}

// 打开添加模态框
const openAddModal = () => {
  isEdit.value = false
  modalError.value = ''
  formData.value = {
    name: '',
    nodes: 'ALL',
    over_subscribe: 'Exclusive',
    is_default: false,
    max_time: 'INFINITE',
    state: 'UP',
    allow_groups: '',
    allow_accounts: '',
    tres_billing_weights: ''
  }
  showModal.value = true
}

// 编辑分区
const editPartition = (partition: Partition) => {
  isEdit.value = true
  modalError.value = ''
  formData.value = {
    name: partition.name,
    nodes: partition.nodes,
    over_subscribe: partition.over_subscribe,
    is_default: partition.is_default,
    max_time: partition.max_time,
    state: partition.state,
    allow_groups: partition.allow_groups || '',
    allow_accounts: partition.allow_accounts || '',
    tres_billing_weights: partition.tres_billing_weights || ''
  }
  showModal.value = true
}

// 保存分区
const savePartition = async () => {
  modalError.value = ''
  
  if (!formData.value.name) {
    modalError.value = '请输入分区名称'
    return
  }
  
  if (!formData.value.nodes) {
    modalError.value = '请输入节点列表'
    return
  }

  saving.value = true
  try {
    if (isEdit.value) {
      await axios.put(`/partitions/${formData.value.name}`, formData.value)
      dialog.success('分区配置更新成功')
    } else {
      await axios.post('/partitions', formData.value)
      dialog.success('分区配置创建成功')
    }
    closeModal()
    loadPartitions()
  } catch (err: any) {
    modalError.value = err.response?.data?.error || '保存失败'
  } finally {
    saving.value = false
  }
}

// 关闭模态框
const closeModal = () => {
  showModal.value = false
}

// 确认删除
const confirmDelete = async (partition: Partition) => {
  if (!confirm(`确定要删除分区 "${partition.name}" 吗？`)) {
    return
  }

  try {
    await axios.delete(`/partitions/${partition.name}`)
    dialog.success('分区配置删除成功')
    loadPartitions()
  } catch (err: any) {
    dialog.error(err.response?.data?.error || '删除失败')
  }
}

// 应用配置
const applyConfig = async () => {
  if (!confirm('确定要应用配置吗？这将生成 partition.conf 文件并重新加载 Slurm 服务。')) {
    return
  }

  applying.value = true
  try {
    const response = await axios.post('/partitions/apply')
    const data = response.data
    
    // 显示详细结果
    let msg = data.message || '配置应用成功'
    if (data.path) msg += `\n文件路径: ${data.path}`
    if (data.command) msg += `\n执行命令: ${data.command}`
    if (data.output) msg += `\n命令输出: ${data.output}`
    if (data.content) {
      console.log('生成的配置文件内容:\n' + data.content)
    }
    
    if (data.warning) {
      dialog.warning(msg + '\n\n警告: ' + data.warning)
    } else {
      dialog.success(msg)
    }
  } catch (err: any) {
    const errData = err.response?.data
    let errMsg = errData?.error || '应用配置失败'
    if (errData?.output) errMsg += '\n命令输出: ' + errData.output
    if (errData?.command) errMsg += '\n执行命令: ' + errData.command
    dialog.error(errMsg)
  } finally {
    applying.value = false
  }
}

// 导出配置
const exportConfig = async () => {
  try {
    const response = await axios.get('/partitions/export', {
      responseType: 'blob'
    })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `partitions_${new Date().getTime()}.json`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    dialog.success('配置导出成功')
  } catch (err: any) {
    dialog.error('导出配置失败')
  }
}

// 打开导入模态框
const openImportModal = () => {
  importError.value = ''
  importData.value = ''
  showImportModal.value = true
}

// 关闭导入模态框
const closeImportModal = () => {
  showImportModal.value = false
}

// 导入配置
const importConfig = async () => {
  importError.value = ''
  
  if (!importData.value.trim()) {
    importError.value = '请输入 JSON 配置'
    return
  }

  try {
    JSON.parse(importData.value)
  } catch (err) {
    importError.value = 'JSON 格式错误'
    return
  }

  importing.value = true
  try {
    await axios.post('/partitions/import', {
      data: importData.value
    })
    dialog.success('配置导入成功')
    closeImportModal()
    loadPartitions()
  } catch (err: any) {
    importError.value = err.response?.data?.error || '导入失败'
  } finally {
    importing.value = false
  }
}

// 获取状态徽章样式
const getStateBadgeClass = (state: string) => {
  switch (state) {
    case 'UP':
      return 'badge-success'
    case 'DOWN':
      return 'badge-danger'
    case 'DRAIN':
      return 'badge-warning'
    case 'INACTIVE':
      return 'badge-secondary'
    default:
      return 'badge-secondary'
  }
}

onMounted(() => {
  loadPartitions()
})
</script>

<style scoped>
.admin-partitions {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h3 {
  margin: 0;
  font-size: 24px;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.info-banner {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  background: #e3f2fd;
  border-left: 4px solid #2196f3;
  border-radius: 4px;
  margin-bottom: 20px;
}

.info-icon {
  font-size: 20px;
}

.card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  padding: 20px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  background: #f5f5f5;
  padding: 12px;
  text-align: left;
  font-weight: 600;
  border-bottom: 2px solid #ddd;
}

.data-table td {
  padding: 12px;
  border-bottom: 1px solid #eee;
}

.partition-name {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.partition-name.is-default {
  color: #2196f3;
}

.badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.badge-primary {
  background: #2196f3;
  color: white;
}

.badge-success {
  background: #4caf50;
  color: white;
}

.badge-danger {
  background: #f44336;
  color: white;
}

.badge-warning {
  background: #ff9800;
  color: white;
}

.badge-secondary {
  background: #9e9e9e;
  color: white;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.btn-primary {
  background: #2196f3;
  color: white;
}

.btn-primary:hover {
  background: #1976d2;
}

.btn-success {
  background: #4caf50;
  color: white;
}

.btn-success:hover {
  background: #388e3c;
}

.btn-secondary {
  background: #757575;
  color: white;
}

.btn-secondary:hover {
  background: #616161;
}

.btn-link {
  background: none;
  color: #2196f3;
  padding: 4px 8px;
}

.btn-link:hover {
  background: #e3f2fd;
}

.btn-link.danger {
  color: #f44336;
}

.btn-link.danger:hover {
  background: #ffebee;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading, .error-message {
  text-align: center;
  padding: 40px;
}

.error-message {
  color: #f44336;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #757575;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow: auto;
}

.modal-large {
  max-width: 800px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  margin: 0;
}

.btn-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #757575;
}

.btn-close:hover {
  color: #000;
}

.modal-body {
  padding: 20px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 20px;
  border-top: 1px solid #eee;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-group textarea {
  font-family: monospace;
  resize: vertical;
}

.form-hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #757575;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.checkbox-wrapper input[type="checkbox"] {
  width: auto;
}

.alert {
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.alert-error {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ef5350;
}
</style>
