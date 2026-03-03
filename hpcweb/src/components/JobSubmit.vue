<template>
  <div class="card job-submit">
    <div class="submit-header">
      <h2>📝 提交新作业</h2>
      <div class="template-selector">
        <label>选择模板：</label>
        <select v-model="selectedTemplate" @change="applyTemplate" class="template-select">
          <option value="">-- 手动填写 --</option>
          <option v-for="template in templates" :key="template.id" :value="template.id">
            {{ template.name }}
          </option>
        </select>
      </div>
    </div>

    <form @submit.prevent="submitJob" class="submit-form">
      <div class="form-row">
        <div class="form-group">
          <label>作业名称 *</label>
          <input v-model="form.name" type="text" placeholder="my_job" required />
        </div>
        <div class="form-group">
          <label>队列/分区 *</label>
          <select v-model="form.partition" required :disabled="loadingPartitions">
            <option value="" disabled>{{ loadingPartitions ? '加载中...' : '-- 选择分区 --' }}</option>
            <option v-for="partition in partitions" :key="partition.name" :value="partition.name">
              {{ partition.name }} ({{ partition.state }})
            </option>
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>节点数 *</label>
          <input v-model.number="form.nodes" type="number" min="1" max="32" required />
        </div>
        <div class="form-group">
          <label>CPU 核心数 *</label>
          <input v-model.number="form.cpus" type="number" min="1" max="128" required />
        </div>
        <div class="form-group">
          <label>内存 (GB)</label>
          <input v-model.number="form.memory" type="number" min="0" placeholder="不限制" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>运行时间 (小时)</label>
          <input v-model.number="form.time" type="number" min="0" placeholder="不限制" />
        </div>
        <div class="form-group">
          <label>GPU 卡数</label>
          <input v-model.number="form.gpus" type="number" min="0" max="8" placeholder="0" />
        </div>
        <div class="form-group">
          <label>优先级</label>
          <select v-model="form.priority">
            <option value="normal">普通</option>
            <option value="high">高</option>
            <option value="low">低</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>工作目录 *</label>
        <div class="input-with-button">
          <input v-model="form.workdir" type="text" placeholder="/home/username/jobs" required />
          <button type="button" class="btn-icon" @click="resetToHomeDir" title="重置为家目录">
            🏠
          </button>
        </div>
      </div>

      <div class="form-group">
        <label>脚本文件 *</label>
        <div class="script-selector">
          <input 
            v-model="form.script" 
            type="text" 
            class="script-input" 
            placeholder="输入脚本路径或从列表选择"
            list="script-files"
            required 
          />
          <datalist id="script-files">
            <option v-for="(file, index) in scriptFiles" :key="index" :value="file.path">
              {{ file.name }}
            </option>
          </datalist>
          <button type="button" class="btn-secondary btn-small" @click="loadScriptFiles">
            🔄 刷新
          </button>
        </div>
        <div class="help-text">可以手动输入脚本路径，或从列表中选择</div>
      </div>

      <div class="form-group">
        <label>输出文件</label>
        <input v-model="form.output" type="text" placeholder="output.log" />
      </div>

      <div class="form-group">
        <label>错误文件</label>
        <input v-model="form.error" type="text" placeholder="error.log" />
      </div>

      <div class="form-group">
        <label>附加参数</label>
        <textarea v-model="form.extraParams" rows="3" placeholder="其他 Slurm 参数，如：--exclusive"></textarea>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn-primary" :disabled="submitting">
          {{ submitting ? '提交中...' : '🚀 提交作业' }}
        </button>
        <button type="button" class="btn-secondary" @click="resetForm">
          🔄 重置表单
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getUser } from '../utils/auth'
import { fileManagerApi } from '../config/api'
import notification from '../utils/notification'

const emit = defineEmits(['job-submitted'])

const currentUser = ref<any>(null)
const selectedTemplate = ref('')
const selectedTemplateData = ref<any>(null)
const scriptFiles = ref<any[]>([])
const partitions = ref<any[]>([])
const loadingPartitions = ref(false)

// 监听来自模板页面的事件
const handleTemplateSelect = (template: any) => {
  selectedTemplateData.value = template
  applyTemplateData(template)
}

// 暴露方法给父组件
defineExpose({
  handleTemplateSelect
})

const templates = ref([
  { 
    id: 1, 
    name: 'GPU 训练模板', 
    partition: 'gpu',
    nodes: 1,
    cpus: 8,
    memory: 32,
    gpus: 4,
    time: 24,
    priority: 'normal',
    workdir: '/home/admin/jobs/gpu_training',
    script: '/home/admin/scripts/train.sh',
    output: 'train_output.log',
    error: 'train_error.log',
    extraParams: '--gres=gpu:4'
  },
  { 
    id: 2, 
    name: 'CPU 计算模板', 
    partition: 'compute',
    nodes: 4,
    cpus: 32,
    memory: 64,
    gpus: 0,
    time: 12,
    priority: 'normal',
    workdir: '/home/admin/jobs/compute',
    script: '/home/admin/scripts/compute.sh',
    output: 'compute_output.log',
    error: 'compute_error.log',
    extraParams: ''
  },
  { 
    id: 3, 
    name: '数据分析模板', 
    partition: 'compute',
    nodes: 2,
    cpus: 16,
    memory: 128,
    gpus: 0,
    time: 6,
    priority: 'normal',
    workdir: '/home/admin/jobs/analysis',
    script: '/home/admin/scripts/analyze.sh',
    output: 'analysis_output.log',
    error: 'analysis_error.log',
    extraParams: '--mem-per-cpu=8G'
  },
  { 
    id: 4, 
    name: '快速调试模板', 
    partition: 'debug',
    nodes: 1,
    cpus: 4,
    memory: 8,
    gpus: 0,
    time: 1,
    priority: 'high',
    workdir: '/home/admin/jobs/debug',
    script: '/home/admin/scripts/debug.sh',
    output: 'debug_output.log',
    error: 'debug_error.log',
    extraParams: ''
  }
])

const form = ref({
  name: '',
  partition: 'compute',
  nodes: 1,
  cpus: 8,
  memory: 0,
  gpus: 0,
  time: 0,
  priority: 'normal',
  workdir: '',
  script: '',
  output: '',
  error: '',
  extraParams: ''
})

const submitting = ref(false)

// 加载分区列表
const loadPartitions = async () => {
  loadingPartitions.value = true
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) {
      return
    }
    
    const response = await fetch('http://localhost:8080/api/jobs/partitions/list', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (!response.ok) {
      throw new Error('获取分区列表失败')
    }
    
    const result = await response.json()
    partitions.value = result.data || []
    
    // 如果有分区且当前没有选择分区，默认选择第一个
    if (partitions.value.length > 0 && !form.value.partition) {
      form.value.partition = partitions.value[0].name
    }
  } catch (err: any) {
    console.error('Failed to load partitions:', err)
    // 如果加载失败，使用默认分区列表
    partitions.value = [
      { name: 'compute', state: 'UP', nodes: '-' },
      { name: 'gpu', state: 'UP', nodes: '-' },
      { name: 'memory', state: 'UP', nodes: '-' },
      { name: 'debug', state: 'UP', nodes: '-' }
    ]
  } finally {
    loadingPartitions.value = false
  }
}

// 重置为家目录
const resetToHomeDir = () => {
  const homeDir = currentUser.value?.homeDir || `/home/${currentUser.value?.username || ''}`
  form.value.workdir = homeDir
}

// 加载脚本文件列表
const loadScriptFiles = async () => {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) {
      notification.error('请先登录系统')
      return
    }
    
    const homeDir = currentUser.value?.homeDir || `/home/${currentUser.value?.username || ''}`
    const url = `${fileManagerApi.list()}?path=${encodeURIComponent(homeDir)}`
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (!response.ok) {
      throw new Error('读取目录失败')
    }
    
    const result = await response.json()
    const files = result.files || []
    
    // 筛选出脚本文件（.sh, .py, .R, .m 等）
    scriptFiles.value = files
      .filter((file: any) => {
        if (file.is_dir) return false
        const ext = file.name.split('.').pop()?.toLowerCase()
        return ['sh', 'py', 'r', 'm', 'pl', 'jl', 'slurm', 'sbatch'].includes(ext || '')
      })
      .map((file: any) => ({
        name: file.name,
        path: file.path
      }))
    
    if (scriptFiles.value.length === 0) {
      notification.info('家目录下没有找到脚本文件')
    }
  } catch (err: any) {
    console.error('Failed to load script files:', err)
    notification.error(err.message || '加载脚本文件失败')
  }
}

const applyTemplate = () => {
  if (!selectedTemplate.value) return
  
  const template = templates.value.find(t => t.id === selectedTemplate.value)
  if (template) {
    applyTemplateData(template)
  }
}

const applyTemplateData = (template: any) => {
  form.value = {
    name: '',
    partition: template.partition,
    nodes: template.nodes,
    cpus: template.cpus,
    memory: template.memory,
    gpus: template.gpus,
    time: template.time,
    priority: template.priority,
    workdir: template.workdir,
    script: template.script,
    output: template.output,
    error: template.error,
    extraParams: template.extraParams
  }
}

const resetForm = () => {
  selectedTemplate.value = ''
  const homeDir = currentUser.value?.homeDir || `/home/${currentUser.value?.username || ''}`
  const defaultPartition = partitions.value.length > 0 ? partitions.value[0].name : 'compute'
  form.value = {
    name: '',
    partition: defaultPartition,
    nodes: 1,
    cpus: 8,
    memory: 0,
    gpus: 0,
    time: 0,
    priority: 'normal',
    workdir: homeDir,
    script: '',
    output: '',
    error: '',
    extraParams: ''
  }
}

const submitJob = async () => {
  submitting.value = true
  
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) {
      notification.error('请先登录系统')
      submitting.value = false
      return
    }
    
    // 读取脚本文件内容
    let scriptContent = ''
    if (form.value.script) {
      try {
        const scriptResponse = await fetch(`${fileManagerApi.read()}?path=${encodeURIComponent(form.value.script)}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (!scriptResponse.ok) {
          throw new Error('无法读取脚本文件，请确认文件路径正确')
        }
        
        const scriptData = await scriptResponse.json()
        scriptContent = scriptData.content || ''
        
        if (!scriptContent) {
          throw new Error('脚本文件为空')
        }
        
        console.log('Script content loaded, length:', scriptContent.length)
      } catch (err: any) {
        notification.error(err.message || '读取脚本文件失败')
        submitting.value = false
        return
      }
    }
    
    // 确保工作目录是绝对路径（如果指定了的话）
    let workdir = form.value.workdir?.trim()
    if (workdir) {
      if (workdir[0] !== '/') {
        const homeDir = currentUser.value?.homeDir || `/home/${currentUser.value?.username || ''}`
        workdir = `${homeDir}/${workdir}`
      }
    } else {
      // 如果没有指定工作目录，使用空字符串（让Slurm使用默认值）
      workdir = ''
    }
    
    // 构建提交数据
    const submitData: any = {
      name: form.value.name,
      partition: form.value.partition,
      script: scriptContent,  // 发送脚本内容而不是路径
      nodes: form.value.nodes,
      cpus: form.value.cpus,
      memory: form.value.memory || 0,  // 0 表示不限制
      gpus: form.value.gpus || 0,
      time: form.value.time || 0,  // 0 表示不限制
      output: form.value.output || 'slurm-%j.out',  // 默认输出文件
      error: form.value.error || 'slurm-%j.err',    // 默认错误文件
      priority: form.value.priority,
      extra_params: form.value.extraParams
    }
    
    // 只有明确指定了工作目录时才添加
    if (workdir) {
      submitData.workdir = workdir
    }
    
    console.log('Submitting job with script content length:', scriptContent.length)
    console.log('Working directory:', workdir || '(using Slurm default)')
    
    const response = await fetch('http://localhost:8080/api/jobs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(submitData)
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `提交失败: ${response.status}`)
    }
    
    const result = await response.json()
    notification.success(`作业提交成功！作业ID: ${result.job_id}`)
    emit('job-submitted')
    resetForm()
  } catch (err: any) {
    console.error('Failed to submit job:', err)
    notification.error(err.message || '作业提交失败')
  } finally {
    submitting.value = false
  }
}

// 初始化
onMounted(() => {
  currentUser.value = getUser()
  // 不自动设置workdir，让Slurm使用默认值
  // 用户可以根据需要手动填写
  loadPartitions()
  loadScriptFiles()
})
</script>

<style scoped>
.job-submit {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 180px);
  overflow: hidden;
}

.submit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid #e5e7eb;
  flex-shrink: 0;
}

.submit-header h2 {
  margin: 0;
  font-size: 1.3rem;
}

.submit-form {
  flex: 1;
  overflow-y: auto;
  padding-right: 0.5rem;
}

.submit-form::-webkit-scrollbar {
  width: 6px;
}

.submit-form::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.submit-form::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

.submit-form::-webkit-scrollbar-thumb:hover {
  background: #555;
}

.template-selector {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.template-selector label {
  font-weight: 600;
  color: #666;
  font-size: 0.95rem;
}

.template-select {
  padding: 0.625rem 1rem;
  border: 2px solid #667eea;
  border-radius: 8px;
  font-size: 0.95rem;
  min-width: 200px;
  cursor: pointer;
  background: white;
  color: #333;
  font-weight: 600;
}

.template-select:focus {
  outline: none;
  border-color: #764ba2;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.submit-form textarea {
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  font-family: 'Courier New', monospace;
  resize: vertical;
  transition: border-color 0.3s;
}

.submit-form textarea:focus {
  outline: none;
  border-color: #667eea;
}

.input-with-button {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.input-with-button input {
  flex: 1;
}

.btn-icon {
  padding: 0.625rem 1rem;
  background: #f3f4f6;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-icon:hover {
  background: #667eea;
  border-color: #667eea;
  transform: scale(1.05);
}

.script-selector {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.script-input {
  flex: 1;
  padding: 0.625rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.95rem;
  background: white;
}

.script-input:focus {
  outline: none;
  border-color: #667eea;
}

.btn-small {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  white-space: nowrap;
}

.help-text {
  font-size: 0.85rem;
  color: #999;
  margin-top: 0.5rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
  position: sticky;
  bottom: 0;
  background: white;
}

.form-actions button {
  flex: 1;
}

@media (max-width: 768px) {
  .submit-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .template-selector {
    width: 100%;
  }
  
  .template-select {
    flex: 1;
  }
}
</style>
