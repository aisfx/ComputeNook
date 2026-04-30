<template>
  <div class="submit-wrapper">
    <!-- 模式切换 -->
    <div class="mode-tabs">
      <button type="button" :class="['mode-tab', { active: mode === 'normal' }]" @click="mode = 'normal'">📝 普通作业</button>
      <button type="button" :class="['mode-tab', { active: mode === 'container' }]" @click="mode = 'container'">🐳 容器作业</button>
    </div>

    <!-- 容器作业模式 -->
    <ContainerJobSubmit
      v-if="mode === 'container'"
      style="flex:1; overflow:hidden; display:flex; flex-direction:column;"
      @submitted="emit('job-submitted')"
      @go-registry="emit('go-registry')"
    />

    <!-- AI 训练模式 -->

    <!-- AI 推理模式 -->

    <!-- 普通作业模式 -->
    <form v-else @submit.prevent="submitJob" class="submit-form">
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

    <!-- GPU + QoS -->
    <div class="form-row col2">
      <div class="form-group">
        <label>GPU 卡数</label>
        <input v-model.number="form.gpus" type="number" min="0" max="8" placeholder="0" />
      </div>
      <div class="form-group">
        <label>QoS（服务质量）</label>
        <select v-model="form.qos" :disabled="loadingQoS">
          <option value="">默认</option>
          <option v-for="q in qosList" :key="q.name" :value="q.name">{{ q.name }}</option>
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

    <!-- 脚本内容 -->
    <div class="form-group">
      <label>脚本内容 *</label>
      <textarea
        v-model="form.scriptContent"
        class="script-editor"
        rows="12"
        placeholder="#!/bin/bash&#10;#SBATCH -J my_job&#10;..."
        spellcheck="false"
        required
      ></textarea>
      <div class="help-text">直接编写脚本内容，或在模板管理中选择模板快速填充</div>
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getUser, getApiBase } from '../utils/auth'
import { fileManagerApi } from '../config/api'
import notification from '../utils/notification'
import ContainerJobSubmit from './ContainerJobSubmit.vue'

const emit = defineEmits(['job-submitted', 'go-registry'])
const mode = ref<'normal' | 'container'>('normal')

const currentUser = ref<any>(null)
const selectedTemplate = ref<number | null>(null)
const selectedTemplateData = ref<any>(null)
const scriptFiles = ref<any[]>([])
const partitions = ref<any[]>([])
const loadingPartitions = ref(false)
const qosList = ref<any[]>([])
const loadingQoS = ref(false)

// 监听来自模板页面的事件
const handleTemplateSelect = (template: any) => {
  selectedTemplateData.value = template
  applyTemplateData(template)
}

// 暴露方法给父组件
defineExpose({
  handleTemplateSelect
})

const templates = ref<any[]>([])

const loadTemplatesFromAPI = async () => {
  try {
    const tok = localStorage.getItem('token') || sessionStorage.getItem('token')
    const res = await fetch(`${getApiBase()}/api/app-templates`, {
      headers: { Authorization: `Bearer ${tok}` }
    })
    if (!res.ok) return
    const data = await res.json()
    templates.value = data.data || []
  } catch { /* ignore */ }
}

const form = ref({
  name: '',
  partition: 'compute',
  nodes: 1,
  cpus: 8,
  memory: 0,
  gpus: 0,
  time: 0,
  qos: '',
  priority: 'normal',
  workdir: '',
  script: '',
  scriptContent: '',
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

// 加载 QoS 列表
const loadQoSList = async () => {
  loadingQoS.value = true
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) return
    const res = await fetch(`${getApiBase()}/api/qos`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) return
    const result = await res.json()
    qosList.value = (result.data || []).map((q: any) => ({ name: q.name || q.Name }))
  } catch { /* ignore */ } finally {
    loadingQoS.value = false
  }
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
  // 根据模板生成对应的脚本内容
  const gpuLine = template.gpus ? `\n#SBATCH --gres=gpu:${template.gpus}` : ''
  const moduleLine = template.moduleLoad ? `\nmodule load ${template.moduleLoad}` : ''
  const runCmd = template.executable
    ? `\nmpirun -np ${template.cpus} ${template.executable}${template.inputFile ? ' -in ' + template.inputFile : ''}`
    : '\n# 在此处添加你的命令'

  const generatedScript = `#!/bin/bash
#SBATCH -J ${template.appType || template.name}_job
#SBATCH -p ${template.partition}
#SBATCH -N ${template.nodes}
#SBATCH -c ${template.cpus}
#SBATCH --mem=${template.memory || 0}G${gpuLine}
#SBATCH -t ${template.time || 1}:00:00
#SBATCH -o output_%j.log
#SBATCH -e error_%j.log
${moduleLine}
echo "Job started: $(date)"
echo "Running on node: $(hostname)"
${runCmd}

echo "Job finished: $(date)"`

  form.value = {
    name: '',
    partition: template.partition,
    nodes: template.nodes,
    cpus: template.cpus,
    memory: template.memory || 0,
    gpus: template.gpus || 0,
    time: template.time || 0,
    qos: '',
    priority: 'normal',
    workdir: form.value.workdir,
    script: '',
    scriptContent: generatedScript,
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
    qos: '',
    priority: 'normal',
    workdir: homeDir,
    script: '',
    scriptContent: scriptTemplates.basic,
    output: '',
    error: '',
    extraParams: ''
  }
}

const scriptTemplates: Record<string, string> = {
  basic: `#!/bin/bash
#SBATCH -J my_job
#SBATCH -p compute
#SBATCH -N 1
#SBATCH -c 4
#SBATCH --mem=8G
#SBATCH -t 01:00:00
#SBATCH -o output_%j.log
#SBATCH -e error_%j.log

echo "Job started: $(date)"
echo "Running on node: $(hostname)"

# 在此处添加你的命令
hostname

echo "Job finished: $(date)"`,

  mpi: `#!/bin/bash
#SBATCH -J mpi_job
#SBATCH -p compute
#SBATCH -N 2
#SBATCH --ntasks-per-node=16
#SBATCH --mem=32G
#SBATCH -t 04:00:00
#SBATCH -o mpi_%j.log
#SBATCH -e mpi_%j.err

module load openmpi

echo "MPI Job started: $(date)"
mpirun -np 32 ./your_mpi_program

echo "Job finished: $(date)"`,

  gpu: `#!/bin/bash
#SBATCH -J gpu_job
#SBATCH -p gpu
#SBATCH -N 1
#SBATCH -c 8
#SBATCH --mem=32G
#SBATCH --gres=gpu:1
#SBATCH -t 08:00:00
#SBATCH -o gpu_%j.log
#SBATCH -e gpu_%j.err

module load cuda

echo "GPU Job started: $(date)"
nvidia-smi

# 在此处添加你的 GPU 程序
python train.py

echo "Job finished: $(date)"`,

  python: `#!/bin/bash
#SBATCH -J python_job
#SBATCH -p compute
#SBATCH -N 1
#SBATCH -c 4
#SBATCH --mem=16G
#SBATCH -t 02:00:00
#SBATCH -o python_%j.log
#SBATCH -e python_%j.err

module load python/3.10

echo "Python Job started: $(date)"

# 激活虚拟环境（如有）
# source ~/venv/bin/activate

python your_script.py

echo "Job finished: $(date)"`,

  array: `#!/bin/bash
#SBATCH -J array_job
#SBATCH -p compute
#SBATCH -N 1
#SBATCH -c 2
#SBATCH --mem=4G
#SBATCH -t 01:00:00
#SBATCH --array=1-10
#SBATCH -o array_%A_%a.log
#SBATCH -e array_%A_%a.err

echo "Array Job $SLURM_ARRAY_TASK_ID started: $(date)"

# 根据任务 ID 处理不同输入
INPUT_FILE="input_\${SLURM_ARRAY_TASK_ID}.dat"
echo "Processing: $INPUT_FILE"

# 在此处添加你的命令
./process $INPUT_FILE

echo "Task $SLURM_ARRAY_TASK_ID finished: $(date)"`,

  pytorch: `#!/bin/bash
#SBATCH -J pytorch_train
#SBATCH -o slurm-%j.out
#SBATCH -e slurm-%j.err

MASTER=$(scontrol show hostnames $SLURM_JOB_NODELIST | head -n1)

srun torchrun \\
  --nproc_per_node=$SLURM_GPUS_ON_NODE \\
  --nnodes=$SLURM_NNODES \\
  --node_rank=$SLURM_NODEID \\
  --master_addr=$MASTER \\
  --master_port=29500 \\
  train.py`,

  deepspeed: `#!/bin/bash
#SBATCH -J deepspeed_train
#SBATCH -o slurm-%j.out
#SBATCH -e slurm-%j.err

MASTER=$(scontrol show hostnames $SLURM_JOB_NODELIST | head -n1)

srun deepspeed \\
  --num_nodes=$SLURM_NNODES \\
  --num_gpus=$SLURM_GPUS_ON_NODE \\
  --master_addr=$MASTER \\
  train_ds.py --deepspeed ds_zero3.json`,

  vllm: `#!/bin/bash
#SBATCH -J vllm_infer
#SBATCH -o slurm-%j.out
#SBATCH -e slurm-%j.err

python -m vllm.entrypoints.openai.api_server \\
  --model /data/models/llama3-8b \\
  --tensor-parallel-size $SLURM_GPUS_ON_NODE \\
  --host 0.0.0.0 --port 8000 \\
  --gpu-memory-utilization 0.9`,

  triton: `#!/bin/bash
#SBATCH -J triton_infer
#SBATCH -o slurm-%j.out
#SBATCH -e slurm-%j.err

tritonserver \\
  --model-repository=/data/triton_models \\
  --http-port=8000 --grpc-port=8001 \\
  --log-verbose=1`,
}

const applyScriptTemplate = (type: string) => {
  const tpl = scriptTemplates[type]
  if (!tpl) return
  form.value.scriptContent = tpl
  if (type === 'gpu') { form.value.gpus = 1; form.value.partition = 'gpu' }
  if (type === 'mpi') { form.value.nodes = 2; form.value.cpus = 16 }
  if (type === 'pytorch') { form.value.gpus = 8; form.value.cpus = 32; form.value.nodes = 1 }
  if (type === 'deepspeed') { form.value.gpus = 8; form.value.cpus = 32; form.value.nodes = 1 }
  if (type === 'vllm') { form.value.gpus = 4; form.value.cpus = 16; form.value.nodes = 1 }
  if (type === 'triton') { form.value.gpus = 2; form.value.cpus = 8; form.value.nodes = 1 }
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
    
    // 直接使用编辑器里的脚本内容
    const scriptContent = form.value.scriptContent.trim()
    if (!scriptContent) {
      notification.error('请填写脚本内容')
      submitting.value = false
      return
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
      time: form.value.time || 0,
      qos: form.value.qos || '',
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
  loadPartitions()
  loadQoSList()
  loadTemplatesFromAPI()
  if (!form.value.scriptContent) {
    form.value.scriptContent = scriptTemplates.basic
  }
})
</script>

<style scoped>
.submit-wrapper { display: flex; flex-direction: column; flex: 1; overflow: hidden; }

.mode-tabs {
  display: flex; gap: 2px; padding: 8px 14px 0;
  border-bottom: 1px solid hsl(var(--border)); flex-shrink: 0;
}
.mode-tab {
  padding: 6px 14px; border: none; background: transparent;
  color: hsl(var(--muted-foreground)); font-size: 0.8rem; font-weight: 500;
  cursor: pointer; border-bottom: 2px solid transparent;
  transition: all 0.15s; margin-bottom: -1px;
}
.mode-tab:hover { color: hsl(var(--foreground)); }
.mode-tab.active { color: hsl(var(--foreground)); border-bottom-color: hsl(var(--primary)); font-weight: 600; }

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
}

/* 脚本编辑器 */
.script-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; flex-wrap: wrap; gap: 6px; }
.script-header label { margin-bottom: 0; }
.template-btns { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.template-label { font-size: 0.75rem; color: hsl(var(--muted-foreground)); }
.btn-tpl {
  padding: 2px 10px;
  font-size: 0.75rem;
  background: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-tpl:hover { background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); }
.btn-tpl.ai { background: rgba(99,102,241,.08); color: #6366f1; border-color: rgba(99,102,241,.3); }
.btn-tpl.ai:hover { background: #6366f1; color: #fff; }
.script-editor {
  width: 100%;
  font-family: 'Courier New', 'Consolas', monospace;
  font-size: 0.82rem;
  line-height: 1.6;
  padding: 10px 12px;
  border: 1px solid hsl(var(--input));
  border-radius: var(--radius-md, 8px);
  background: #1e293b;
  color: #e2e8f0;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
  tab-size: 2;
}
.script-editor:focus { border-color: hsl(var(--ring)); box-shadow: 0 0 0 2px hsl(var(--ring) / 0.15); }

.script-input {
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