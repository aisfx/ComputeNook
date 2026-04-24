<template>
  <form @submit.prevent="submitJob" class="submit-form">
    <!-- 作业名 + 分区 -->
    <div class="form-row col2">
      <div class="form-group">
        <label>作业名称 *</label>
        <input v-model="form.name" type="text" placeholder="my_job" required />
      </div>
      <div class="form-group">
        <label>队列/分区 *</label>
        <select v-model="form.partition" required :disabled="loadingPartitions">
          <option value="" disabled>{{ loadingPartitions ? '加载中...' : '-- 选择分区 --' }}</option>
          <option v-for="p in partitions" :key="p.name" :value="p.name">
            {{ p.name }} ({{ p.state }})
          </option>
        </select>
      </div>
    </div>

    <!-- 节点 + CPU -->
    <div class="form-row col2">
      <div class="form-group">
        <label>节点数 *</label>
        <input v-model.number="form.nodes" type="number" min="1" max="32" required />
      </div>
      <div class="form-group">
        <label>CPU 核心数 *</label>
        <input v-model.number="form.cpus" type="number" min="1" max="128" required />
      </div>
    </div>

    <!-- 内存 + 时间 -->
    <div class="form-row col2">
      <div class="form-group">
        <label>内存 (GB)</label>
        <input v-model.number="form.memory" type="number" min="0" placeholder="不限" />
      </div>
      <div class="form-group">
        <label>时间 (小时)</label>
        <input v-model.number="form.time" type="number" min="0" placeholder="不限" />
      </div>
    </div>

    <!-- GPU + 优先级 -->
    <div class="form-row col2">
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

    <!-- 工作目录 -->
    <div class="form-group">
      <label>工作目录 *</label>
      <div class="input-with-button">
        <input v-model="form.workdir" type="text" placeholder="/home/username/jobs" required />
        <button type="button" class="btn-icon" @click="resetToHomeDir" title="重置为家目录">🏠</button>
      </div>
    </div>

    <!-- 脚本文件 -->
    <div class="form-group">
      <label>脚本文件 *</label>
      <div class="script-selector">
        <input v-model="form.script" type="text" class="script-input"
          placeholder="输入脚本路径或从列表选择" list="script-files" required />
        <datalist id="script-files">
          <option v-for="(file, index) in scriptFiles" :key="index" :value="file.path">{{ file.name }}</option>
        </datalist>
        <button type="button" class="btn-small" @click="loadScriptFiles" title="刷新脚本列表">↺</button>
      </div>
      <div class="help-text">可手动输入路径，或从列表中选择</div>
    </div>

    <!-- 输出 + 错误文件 -->
    <div class="form-row col2">
      <div class="form-group">
        <label>输出文件</label>
        <input v-model="form.output" type="text" placeholder="output.log" />
      </div>
      <div class="form-group">
        <label>错误文件</label>
        <input v-model="form.error" type="text" placeholder="error.log" />
      </div>
    </div>

    <!-- 附加参数（折叠） -->
    <details class="extra-params-wrap">
      <summary class="extra-params-toggle">附加参数</summary>
      <div class="form-group" style="margin-top:6px">
        <textarea v-model="form.extraParams" rows="2" placeholder="其他 Slurm 参数，如：--exclusive"></textarea>
      </div>
    </details>

    <div class="form-actions">
      <button type="submit" class="btn-primary" :disabled="submitting">
        {{ submitting ? '提交中...' : '🚀 提交' }}
      </button>
      <button type="button" class="btn-ghost" @click="resetForm">重置</button>
    </div>
  </form>
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
.submit-form {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.submit-form::-webkit-scrollbar { width: 3px; }
.submit-form::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 2px; }

.form-row.col2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

.form-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.form-group label {
  font-size: 0.73rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 9px;
  border: 1px solid hsl(var(--input));
  border-radius: var(--radius-md);
  font-size: 0.83rem;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.15);
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
  min-height: 48px;
  font-size: 0.78rem;
}

.input-with-button { display: flex; gap: 5px; }
.input-with-button input { flex: 1; min-width: 0; }

.btn-icon {
  padding: 0 9px;
  background: hsl(var(--secondary));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}
.btn-icon:hover { background: hsl(var(--accent)); }

.script-selector { display: flex; gap: 5px; }
.script-input {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  padding: 6px 9px;
  border: 1px solid hsl(var(--input));
  border-radius: var(--radius-md);
  font-size: 0.83rem;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  outline: none;
}
.script-input:focus {
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.15);
}

.btn-small {
  padding: 0 10px;
  font-size: 0.9rem;
  font-weight: 600;
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
  font-size: 0.7rem;
  color: hsl(var(--muted-foreground));
}

/* 附加参数折叠 */
.extra-params-wrap {
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  padding: 0 10px;
}
.extra-params-toggle {
  font-size: 0.73rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.03em;
  cursor: pointer;
  padding: 7px 0;
  user-select: none;
  list-style: none;
}
.extra-params-toggle::-webkit-details-marker { display: none; }
.extra-params-toggle::after { content: ' ▸'; font-size: 0.65rem; }
details[open] .extra-params-toggle::after { content: ' ▾'; }

.form-actions {
  display: flex;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid hsl(var(--border));
  margin-top: 4px;
  position: sticky;
  bottom: 0;
  background: hsl(var(--card));
}

.btn-primary {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 8px 14px;
  background: #fff;
  color: #1e293b;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.83rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: all 0.15s;
}
.btn-primary:hover:not(:disabled) { background: #f1f5f9; }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-ghost {
  padding: 8px 14px;
  background: none;
  color: hsl(var(--muted-foreground));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  font-size: 0.83rem;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.btn-ghost:hover { background: hsl(var(--accent)); color: hsl(var(--foreground)); }
</style>