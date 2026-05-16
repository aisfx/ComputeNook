<template>
  <div class="admin-qos">
    <div class="page-header">
      <h3>⚡ QoS 管理 (服务质量)</h3>
      <button class="btn btn-primary" @click="openAddModal">+ 添加 QoS</button>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-if="error" class="error-message">{{ error }}</div>

    <div v-else class="card">
      <table class="data-table">
        <thead>
          <tr>
            <th>名称</th>
            <th>描述</th>
            <th>运行作业数</th>
            <th>提交作业数</th>
            <th>CPU 核心</th>
            <th>内存 (GB)</th>
            <th>GPU 数量</th>
            <th>节点数</th>
            <th>作业运行时间</th>
            <th>总机时限制</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="qos in qosList" :key="qos.name">
            <td><span class="qos-name">{{ qos.name }}</span></td>
            <td>{{ qos.description || '-' }}</td>
            <td>{{ formatLimitValue(extractJobsLimit(qos)) }}</td>
            <td>{{ formatLimitValue(extractSubmitLimit(qos)) }}</td>
            <td>{{ formatLimitValue(extractCPULimit(qos)) }}</td>
            <td>{{ formatLimitValue(extractMemoryLimit(qos)) }}</td>
            <td>{{ formatLimitValue(extractGPULimit(qos)) }}</td>
            <td>{{ formatLimitValue(extractNodeLimit(qos)) }}</td>
            <td>{{ formatWallTimeLimit(extractWallTimeLimit(qos)) }}</td>
            <td>{{ formatBillingLimit(qos) }}</td>
            <td>
              <div class="action-buttons">
                <button class="btn btn-link" @click="editQoS(qos)">✏️ 编辑</button>
                <button class="btn btn-link danger" @click="confirmDelete(qos)">🗑️ 删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <Teleport to="body">
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
          
          <div class="info-box">
            <strong>💡 资源限制说明</strong>
            <p>设置每个用户可使用的最大资源（MaxTRESPerUser），超过限制时提交作业会被拒绝（DenyOnLimit）</p>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>CPU 核心数</label>
              <input type="number" v-model.number="formData.max_cpus" placeholder="128" />
              <small class="form-hint">每用户最多使用的 CPU 核心数</small>
            </div>
            <div class="form-group">
              <label>内存容量 (GB)</label>
              <input type="number" v-model.number="formData.max_memory" placeholder="256" />
              <small class="form-hint">每用户最多使用的内存容量</small>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>GPU 数量</label>
              <input type="number" v-model.number="formData.max_gpus" placeholder="4" />
              <small class="form-hint">每用户最多使用的 GPU 数量</small>
            </div>
            <div class="form-group">
              <label>节点数</label>
              <input type="number" v-model.number="formData.max_nodes" placeholder="2" />
              <small class="form-hint">每用户最多使用的节点数</small>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>最大运行作业数</label>
              <input type="number" v-model.number="formData.max_jobs_pu" placeholder="100" />
              <small class="form-hint">同时运行的最大作业数</small>
            </div>
            <div class="form-group">
              <label>最大提交作业数</label>
              <input type="number" v-model.number="formData.max_submit_pu" placeholder="200" />
              <small class="form-hint">可提交的最大作业数</small>
            </div>
          </div>

          <div class="form-group">
            <label>总机时限制（小时）</label>
            <input type="number" v-model.number="formData.grp_tres_mins" placeholder="6000" />
            <small class="form-hint">输入小时数，系统会自动转换为分钟并添加 billing= 前缀</small>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="saveQoS" :disabled="saving">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- QoS 绑定查看模态框 -->
    <div v-if="showBindingsModal" class="modal-overlay">
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
                <button class="btn btn-primary" @click="goToAssociations">
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
          <button class="btn btn-secondary" @click="closeBindingsModal">关闭</button>
          <button class="btn btn-primary" @click="goToAssociations">
            前往账户关联页面
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, inject } from 'vue'
import { qosAPI } from '../api'
import notification from '../utils/notification'
import dialog from '../utils/dialog'

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
  max_jobs_pu: 0,
  max_submit_pu: 0,
  max_cpus: 0,
  max_memory: 0,
  max_gpus: 0,
  max_nodes: 0,
  max_wall_days: 0,
  grp_tres_mins: 0
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
    max_jobs_pu: 0,
    max_submit_pu: 0,
    max_cpus: 0,
    max_memory: 0,
    max_gpus: 0,
    max_nodes: 0,
    max_wall_days: 0,
    grp_tres_mins: 0
  }
  showModal.value = true
}

const editQoS = (qos: any) => {
  console.log('Editing QoS:', qos)
  console.log('CPU limit:', extractCPULimit(qos))
  console.log('Node limit:', extractNodeLimit(qos))
  console.log('GPU limit:', extractGPULimit(qos))
  console.log('Memory limit:', extractMemoryLimit(qos))
  console.log('Billing limit:', extractBillingLimit(qos))
  
  isEdit.value = true
  formData.value = {
    name: qos.name,
    description: qos.description || '',
    max_jobs_pu: extractJobsLimit(qos) || 0,
    max_submit_pu: extractSubmitLimit(qos) || 0,
    max_cpus: extractCPULimit(qos) || 0,
    max_memory: extractMemoryLimit(qos) || 0,
    max_gpus: extractGPULimit(qos) || 0,
    max_nodes: extractNodeLimit(qos) || 0,
    max_wall_days: Math.floor(extractWallTimeLimit(qos) / 1440) || 0, // 转换分钟为天
    grp_tres_mins: extractBillingLimit(qos) || 0
  }
  
  console.log('Form data:', formData.value)
  showModal.value = true
}

// 从新的API结构中提取CPU限制
const extractCPULimit = (qos: any): number => {
  // 优先从 tres.per.user 获取（per-user 限制）
  if (qos.limits?.max?.tres?.per?.user) {
    const userTres = qos.limits.max.tres.per.user
    const cpuTres = userTres.find((tres: any) => tres.type === 'cpu')
    if (cpuTres) return cpuTres.count
  }
  // 兼容旧结构
  if (qos.max_cpus_pu) return extractNumber(qos.max_cpus_pu)
  if (qos.MaxCPUs) return extractNumber(qos.MaxCPUs)
  return 0
}

// 从新的API结构中提取GPU限制
const extractGPULimit = (qos: any): number => {
  // 优先从 tres.per.user 获取
  if (qos.limits?.max?.tres?.per?.user) {
    const userTres = qos.limits.max.tres.per.user
    const gpuTres = userTres.find((tres: any) => tres.type === 'gres/gpu')
    if (gpuTres) return gpuTres.count
  }
  // 兼容旧结构
  if (qos.max_tres_pu) return extractGPUCount(qos.max_tres_pu)
  if (qos.MaxTRES) return extractGPUCount(qos.MaxTRES)
  return 0
}

// 从新的API结构中提取节点限制
const extractNodeLimit = (qos: any): number => {
  // 优先从 tres.per.user 获取
  if (qos.limits?.max?.tres?.per?.user) {
    const userTres = qos.limits.max.tres.per.user
    const nodeTres = userTres.find((tres: any) => tres.type === 'node')
    if (nodeTres) return nodeTres.count
  }
  // 兼容旧结构
  if (qos.max_nodes_pu) return extractNumber(qos.max_nodes_pu)
  if (qos.MaxNodes) return extractNumber(qos.MaxNodes)
  return 0
}

// 从新的API结构中提取内存限制（MB转GB）
const extractMemoryLimit = (qos: any): number => {
  // 优先从 tres.per.user 获取
  if (qos.limits?.max?.tres?.per?.user) {
    const userTres = qos.limits.max.tres.per.user
    const memTres = userTres.find((tres: any) => tres.type === 'mem')
    if (memTres) return Math.floor(memTres.count / 1024) // MB 转 GB
  }
  return 0
}

// 从新的API结构中提取作业数限制
const extractJobsLimit = (qos: any): number => {
  // 检查新的嵌套结构
  if (qos.limits?.max?.jobs?.per?.user) {
    const jobsLimit = qos.limits.max.jobs.per.user
    return jobsLimit.set && !jobsLimit.infinite ? jobsLimit.number : 0
  }
  
  // 检查 active_jobs 结构
  if (qos.limits?.max?.active_jobs?.count) {
    const jobsLimit = qos.limits.max.active_jobs.count
    return jobsLimit.set && !jobsLimit.infinite ? jobsLimit.number : 0
  }
  
  // 兼容旧结构
  if (qos.max_jobs_pu) return extractNumber(qos.max_jobs_pu)
  if (qos.MaxJobs) return extractNumber(qos.MaxJobs)
  
  return 0
}

// 从新的API结构中提取提交作业数限制
const extractSubmitLimit = (qos: any): number => {
  // 检查新的嵌套结构
  if (qos.limits?.max?.jobs?.count) {
    const submitLimit = qos.limits.max.jobs.count
    return submitLimit.set && !submitLimit.infinite ? submitLimit.number : 0
  }
  
  // 兼容旧结构
  if (qos.max_submit_pu) return extractNumber(qos.max_submit_pu)
  if (qos.MaxSubmit) return extractNumber(qos.MaxSubmit)
  
  return 0
}

// 从新的API结构中提取运行时间限制（分钟）
const extractWallTimeLimit = (qos: any): number => {
  // 检查新的嵌套结构
  if (qos.limits?.max?.tres?.minutes?.per?.qos) {
    const qosTres = qos.limits.max.tres.minutes.per.qos
    const billingTres = qosTres.find((tres: any) => tres.type === 'billing')
    if (billingTres) return billingTres.count
  }
  
  // 兼容旧结构
  if (qos.max_wall_pj) return extractNumber(qos.max_wall_pj)
  if (qos.MaxWall) return extractNumber(qos.MaxWall)
  
  return 0
}

// 从新的API结构中提取总机时限制（返回小时）
const extractBillingLimit = (qos: any): number => {
  // 检查新的嵌套结构
  if (qos.limits?.max?.tres?.minutes?.total) {
    const totalTres = qos.limits.max.tres.minutes.total
    const billingTres = totalTres.find((tres: any) => tres.type === 'billing')
    if (billingTres) return billingTres.count / 60
  }
  
  // 兼容旧结构
  if (qos.grp_tres_mins) return extractBillingMins(qos.grp_tres_mins) / 60
  if (qos.GrpTRESMins) return extractBillingMins(qos.GrpTRESMins) / 60
  
  return 0
}

// 格式化限制值显示
const formatLimitValue = (value: number): string => {
  if (!value || value === 0) return '无限制'
  return value.toString()
}

// 格式化总机时显示（小时）
const formatBillingLimit = (qos: any): string => {
  const hours = extractBillingLimit(qos)
  if (!hours || hours === 0) return '无限制'
  return `${Math.round(hours)} 小时`
}

// 格式化运行时间限制
const formatWallTimeLimit = (minutes: number): string => {
  if (!minutes || minutes === 0) return '无限制'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0) {
    return `${hours}小时${mins > 0 ? mins + '分钟' : ''}`
  }
  return `${mins}分钟`
}

// 从 max_tres_pu 中提取 GPU 数量（兼容旧格式）
const extractGPUCount = (value: string): number => {
  if (!value || value === '') return 0
  // 格式: gres/gpu=4 或 gres/gpu:a100=2
  const match = value.match(/gres\/gpu[^=]*=(\d+)/)
  return match ? parseInt(match[1]) : 0
}

// 从 grp_tres_mins 中提取 billing 数值（兼容旧格式）
const extractBillingMins = (value: string): number => {
  if (!value || value === '') return 0
  // 格式: billing=100000
  const match = value.match(/billing=(\d+)/)
  return match ? parseInt(match[1]) : 0
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
    // 构建提交数据，将前端字段映射到后端字段
    const qosData: any = {
      name: formData.value.name,
      description: formData.value.description,
      max_jobs_pu: formData.value.max_jobs_pu,
      max_submit_pu: formData.value.max_submit_pu,
      max_cpus_pu: formData.value.max_cpus,  // 映射到 MaxCPUs
      max_nodes_pu: formData.value.max_nodes, // 映射到 MaxNodes
      max_wall_pj: formData.value.max_wall_days * 1440, // 转换天为分钟
      grp_tres_mins: (formData.value.grp_tres_mins * 60).toString()  // 小时转分钟
    }
    
    // 构建 TRES 字符串，包含 GPU 和内存限制
    let tresComponents = []
    
    // 如果设置了 GPU 数量，添加到 max_tres_pu
    if (formData.value.max_gpus > 0) {
      tresComponents.push(`gres/gpu=${formData.value.max_gpus}`)
    }
    
    // 如果设置了内存限制，添加到 max_tres_pu
    if (formData.value.max_memory > 0) {
      tresComponents.push(`mem=${formData.value.max_memory}G`)
    }
    
    // 组合 TRES 字符串
    if (tresComponents.length > 0) {
      qosData.max_tres_pu = tresComponents.join(',')
    }
    
    console.log('Submitting QoS data:', qosData)
    
    if (isEdit.value) {
      await qosAPI.updateQoS(formData.value.name, qosData)
      notification.success('QoS 更新成功！')
    } else {
      await qosAPI.createQoS(qosData)
      notification.success('QoS 创建成功！')
    }
    
    closeModal()
    await loadQoSList()
  } catch (err: any) {
    console.error('Save QoS error:', err)
    modalError.value = err.response?.data?.error || err.message || '保存失败'
  } finally {
    saving.value = false
  }
}

const confirmDelete = async (qos: any) => {
  const ok = await dialog.confirmDelete(qos.name, 'QoS')
  if (!ok) return
  try {
    await qosAPI.deleteQoS(qos.name)
    dialog.success('QoS 删除成功！')
    await loadQoSList()
  } catch (err: any) {
    dialog.error(err.response?.data?.error || '删除失败')
  }
}

const closeModal = () => {
  showModal.value = false
  modalError.value = ''
}

// 格式化 TRES Minutes（总机时）
const formatTRESMins = (value: string) => {
  if (!value || value === '') return '-'
  // 格式: cpu=100000 或 gres/gpu=10000
  // 显示为: 100000 CPU-分钟 或 10000 GPU-分钟
  const parts = value.split(',')
  return parts.map(part => {
    const [resource, mins] = part.split('=')
    if (resource && mins) {
      const resourceName = resource.includes('gpu') ? 'GPU' : 
                          resource.includes('cpu') ? 'CPU' : resource
      return `${mins} ${resourceName}-分钟`
    }
    return part
  }).join(', ')
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
.admin-qos { padding: 1.5rem; }

.bindings-section { margin-top: 1.5rem; }
.bindings-section h4 { font-size: 0.85rem; font-weight: 600; color: hsl(var(--foreground)); margin: 0 0 0.75rem; }

.qos-name { font-weight: 500; color: hsl(var(--foreground)); }
</style>

