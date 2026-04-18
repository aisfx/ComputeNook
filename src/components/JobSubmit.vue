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
import { getUser, getApiBase } from '../utils/auth'
import { fileManagerApi } from '../config/api'
import notification from '../utils/notification'
import { jobTemplates } from '../data/jobTemplates'

const emit = defineEmits(['job-submitted'])

const currentUser = ref<any>(null)
const selectedTemplate = ref<number | null>(null)
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

const templates = ref(jobTemplates)

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
    
    const response = await fetch(`${getApiBase()}/api/jobs/partitions/list`, {
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
    memory: template.memory || 0,
    gpus: template.gpus || 0,
    time: template.time || 0,
    priority: 'normal',
    workdir: form.value.workdir,
    script: '',
    output: '',
    error: '',
    extraParams: template.gpus ? `--gres=gpu:${template.gpus}` : ''
  }
}

const resetForm = () => {
  selectedTemplate.value = null
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
    
    // 构建提交数据 - 只发送必需字段，让Slurm使用默认路径
    const submitData: any = {
      name: form.value.name,
      partition: form.value.partition,
      script: scriptContent,  // 发送脚本内容而不是路径
      nodes: form.value.nodes,
      cpus: form.value.cpus,
      memory: form.value.memory || 0,  // 0 表示不限制
      gpus: form.value.gpus || 0,
      time: form.value.time || 0,  // 0 表示不限制
      priority: form.value.priority,
      extra_params: form.value.extraParams
    }
    
    // 不发送workdir、output、error，让Slurm使用默认值
    // 这样可以避免路径权限问题
    
    console.log('Submitting job with script content length:', scriptContent.length)
    console.log('Using Slurm default paths for working directory and output files')
    
    const response = await fetch(`${getApiBase()}/api/jobs`, {
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
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 100px);
  overflow: hidden;
  background: hsl(var(--background));
  border: none;
  padding: 0;
}

/* Header */
.submit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid hsl(var(--border));
  flex-shrink: 0;
  background: hsl(var(--card));
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.submit-header h2 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.template-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.template-selector label {
  font-size: 0.8rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.template-select {
  padding: 6px 10px;
  border: 1px solid hsl(var(--input));
  border-radius: var(--radius-md);
  font-size: 0.8rem;
  min-width: 160px;
  cursor: pointer;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  outline: none;
}
.template-select:focus {
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
}

/* Scrollable form */
.submit-form {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: hsl(var(--card));
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
}

.submit-form::-webkit-scrollbar { width: 4px; }
.submit-form::-webkit-scrollbar-track { background: transparent; }
.submit-form::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 2px; }

/* Form rows */
.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 12px;
}

.form-group label {
  font-size: 0.8rem;
  font-weight: 500;
  color: hsl(var(--foreground));
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 7px 10px;
  border: 1px solid hsl(var(--input));
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
}

.form-group input:disabled,
.form-group select:disabled {
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  cursor: not-allowed;
}

.form-group textarea {
  resize: vertical;
  font-family: var(--font-family-mono);
  min-height: 72px;
  font-size: 0.8rem;
}

/* Input with button */
.input-with-button {
  display: flex;
  gap: 6px;
  align-items: stretch;
}
.input-with-button input { flex: 1; min-width: 0; }

.btn-icon {
  padding: 0 10px;
  background: hsl(var(--secondary));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.15s;
  flex-shrink: 0;
  color: hsl(var(--foreground));
}
.btn-icon:hover { background: hsl(var(--accent)); }

/* Script selector */
.script-selector {
  display: flex;
  gap: 6px;
  align-items: stretch;
}

.script-input {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  padding: 7px 10px;
  border: 1px solid hsl(var(--input));
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  outline: none;
}
.script-input:focus {
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
}

.btn-small {
  padding: 6px 12px;
  font-size: 0.8rem;
  white-space: nowrap;
  flex-shrink: 0;
  background: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.15s;
}
.btn-small:hover { background: hsl(var(--accent)); }

.help-text {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  margin-top: 3px;
}

/* Actions */
.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid hsl(var(--border));
  position: sticky;
  bottom: 0;
  background: hsl(var(--card));
}
.form-actions button { flex: 1; }

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 16px;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-primary:hover:not(:disabled) { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 16px;
  background: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-secondary:hover { background: hsl(var(--accent)); }
</style>

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.625rem 1.25rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}
.btn-primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.625rem 1.25rem;
  background: white;
  color: #667eea;
  border: 1.5px solid #667eea;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-secondary:hover { background: #f0f0ff; }
.job-submit {
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 160px);
  overflow: hidden;
}

/* header：标题左，模板选择右，同行对齐 */
.submit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
  padding-bottom: 0.875rem;
  border-bottom: 2px solid #e5e7eb;
  flex-shrink: 0;
}

.submit-header h2 {
  margin: 0;
  font-size: 1.2rem;
  color: #1a1a2e;
}

.template-selector {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex-shrink: 0;
}

.template-selector label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #6b7280;
  white-space: nowrap;
}

.template-select {
  padding: 0.5rem 0.875rem;
  border: 1.5px solid #667eea;
  border-radius: 8px;
  font-size: 0.9rem;
  min-width: 180px;
  cursor: pointer;
  background: white;
  color: #333;
  outline: none;
}

.template-select:focus {
  border-color: #764ba2;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.12);
}

/* 可滚动表单区域 */
.submit-form {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
}

.submit-form::-webkit-scrollbar { width: 5px; }
.submit-form::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
.submit-form::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }

/* 多列行 */
.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

/* 单个字段 */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-bottom: 1rem;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

/* 统一 input / select / textarea */
.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 0.625rem 0.875rem;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.9rem;
  background: white;
  color: #1a1a2e;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.12);
}

.form-group input:disabled,
.form-group select:disabled {
  background: #f3f4f6;
  cursor: not-allowed;
  color: #9ca3af;
}

.form-group textarea {
  resize: vertical;
  font-family: 'Courier New', monospace;
  min-height: 80px;
}

/* 带按钮的输入框 */
.input-with-button {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
}

.input-with-button input {
  flex: 1;
  min-width: 0;
}

.btn-icon {
  padding: 0 0.875rem;
  background: #f3f4f6;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.btn-icon:hover {
  background: #667eea;
  border-color: #667eea;
}

/* 脚本选择器 */
.script-selector {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
}

.script-input {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  padding: 0.625rem 0.875rem;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.9rem;
  background: white;
  outline: none;
}

.script-input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.12);
}

.btn-small {
  padding: 0.5rem 0.875rem;
  font-size: 0.875rem;
  white-space: nowrap;
  flex-shrink: 0;
}

.help-text {
  font-size: 0.8rem;
  color: #9ca3af;
  margin-top: 0.375rem;
}

/* 底部操作栏 */
.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
  position: sticky;
  bottom: 0;
  background: white;
  flex-shrink: 0;
}

.form-actions button {
  flex: 1;
}
