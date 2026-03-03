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
          <select v-model="form.partition" required>
            <option value="compute">compute (计算队列)</option>
            <option value="gpu">gpu (GPU队列)</option>
            <option value="memory">memory (大内存队列)</option>
            <option value="debug">debug (调试队列)</option>
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
          <input v-model.number="form.memory" type="number" min="1" placeholder="16" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>运行时间 (小时) *</label>
          <input v-model.number="form.time" type="number" min="1" max="168" required />
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
          <select v-model="form.script" class="script-select" required>
            <option value="">-- 选择脚本文件 --</option>
            <option v-for="(file, index) in scriptFiles" :key="index" :value="file.path">
              {{ file.name }} ({{ file.path }})
            </option>
          </select>
          <button type="button" class="btn-secondary btn-small" @click="loadScriptFiles">
            🔄 刷新
          </button>
        </div>
        <div class="help-text">或手动输入脚本路径</div>
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
  memory: 16,
  gpus: 0,
  time: 1,
  priority: 'normal',
  workdir: '',
  script: '',
  output: '',
  error: '',
  extraParams: ''
})

const submitting = ref(false)

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
  form.value = {
    name: '',
    partition: 'compute',
    nodes: 1,
    cpus: 8,
    memory: 16,
    gpus: 0,
    time: 1,
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
  // 模拟 API 调用
  setTimeout(() => {
    alert(`作业 "${form.value.name}" 已提交！\n分区: ${form.value.partition}\n节点: ${form.value.nodes}\nCPU: ${form.value.cpus}`)
    emit('job-submitted')
    resetForm()
    submitting.value = false
  }, 1000)
}

// 初始化
onMounted(() => {
  currentUser.value = getUser()
  const homeDir = currentUser.value?.homeDir || `/home/${currentUser.value?.username || ''}`
  form.value.workdir = homeDir
  loadScriptFiles()
})
</script>

<style scoped>
.submit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e5e7eb;
}

.submit-header h2 {
  margin: 0;
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

.script-select {
  flex: 1;
  padding: 0.625rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.95rem;
  cursor: pointer;
  background: white;
}

.script-select:focus {
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
