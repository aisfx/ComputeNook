<template>
  <div class="ai-tasks-page">
    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">运行中</div>
        <div class="stat-value running">{{ stats.running }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">等待中</div>
        <div class="stat-value pending">{{ stats.pending }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">已完成</div>
        <div class="stat-value completed">{{ stats.completed }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">失败</div>
        <div class="stat-value failed">{{ stats.failed }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">训练任务</div>
        <div class="stat-value">{{ stats.train }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">推理服务</div>
        <div class="stat-value">{{ stats.infer }}</div>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <button :class="['tab-btn', typeFilter === '' ? 'active' : '']" @click="typeFilter = ''">全部</button>
        <button :class="['tab-btn', typeFilter === 'train' ? 'active' : '']" @click="typeFilter = 'train'">🧠 训练</button>
        <button :class="['tab-btn', typeFilter === 'infer' ? 'active' : '']" @click="typeFilter = 'infer'">⚡ 推理</button>
      </div>
      <div class="toolbar-right">
        <button class="btn-refresh" @click="loadAll" title="刷新">↻</button>
        <button class="btn-create train" @click="openCreate('train')">+ 新建训练任务</button>
        <button class="btn-create infer" @click="openCreate('infer')">+ 新建推理服务</button>
      </div>
    </div>

    <!-- 任务列表 -->
    <div class="task-list">
      <div v-if="loading" class="empty-tip">⏳ 加载中...</div>
      <div v-else-if="filteredTasks.length === 0" class="empty-tip">
        <div style="font-size:2rem;opacity:.3">🤖</div>
        <p>暂无任务，点击右上角新建</p>
      </div>
      <div v-else v-for="task in filteredTasks" :key="task.id" class="task-card">
        <div class="task-card-header">
          <div class="task-title-row">
            <span class="task-type-badge" :class="task.type">{{ task.type === 'train' ? '🧠 训练' : '⚡ 推理' }}</span>
            <span class="task-name">{{ task.name }}</span>
            <span :class="['task-status', task.status.toLowerCase()]">{{ statusLabel(task.status) }}</span>
            <span v-if="task.auto_restart" class="restart-badge" title="自动重启已开启">🔄 自动重启 ×{{ task.max_retries }}</span>
          </div>
          <div class="task-meta">
            作业ID: <b>{{ task.job_id || '-' }}</b>
            · 分区: {{ task.partition }}
            · {{ task.nodes }}节点 {{ task.cpus }}核
            <span v-if="task.gpus"> · {{ task.gpus }} GPU</span>
            <span v-if="task.retry_count > 0" class="retry-count"> · 已重启 {{ task.retry_count }}/{{ task.max_retries }} 次</span>
            <span v-if="task.service_port && task.type === 'infer'" class="port-badge">
              端口: {{ task.service_port }}
            </span>
          </div>
          <!-- 推理端点信息 -->
          <div v-if="task.type === 'infer' && endpoints[task.id]" class="endpoint-info">
            <span class="endpoint-label">🔑 API Key:</span>
            <code class="endpoint-key">{{ endpoints[task.id].api_key }}</code>
            <button class="btn-copy" @click="copyText(endpoints[task.id].api_key)" title="复制">📋</button>
            <span class="endpoint-note" v-if="endpoints[task.id].note">· {{ endpoints[task.id].note }}</span>
            <button class="btn-revoke" @click="revokeEndpoint(task)">撤销</button>
          </div>
          <div v-if="task.last_error" class="task-error">⚠ {{ task.last_error }}</div>
        </div>
        <div class="task-card-footer">
          <span class="task-time">创建于 {{ formatTime(task.created_at) }}</span>
          <div class="task-actions">
            <button class="btn-sm" @click="viewLogs(task)">📋 日志</button>
            <!-- 推理运行中：发布端口 -->
            <button
              v-if="task.type === 'infer' && task.status === 'RUNNING' && !endpoints[task.id]"
              class="btn-sm publish"
              @click="openPublishPort(task)"
            >🌐 发布端口</button>
            <button
              v-if="task.status === 'RUNNING' || task.status === 'PENDING'"
              class="btn-sm danger"
              @click="stopTask(task)"
            >⏹ 停止</button>
            <!-- 失败重跑 -->
            <button
              v-if="task.status === 'FAILED' || task.status === 'COMPLETED'"
              class="btn-sm"
              @click="restartTask(task)"
            >🔄 重跑</button>
            <button class="btn-sm danger" @click="deleteTask(task)">🗑 删除</button>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <!-- 新建任务弹窗 -->
      <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
        <div class="modal-box">
          <div class="modal-header">
            <h3>{{ createForm.type === 'train' ? '🧠 新建训练任务' : '⚡ 新建推理服务' }}</h3>
            <button @click="showCreate = false" class="btn-close">✕</button>
          </div>
          <div class="modal-body">
            <!-- 模型模板选择 -->
            <div class="form-group">
              <label>模型模板（快速填充）</label>
              <div class="model-tpl-grid">
                <button
                  v-for="tpl in filteredModelTpls"
                  :key="tpl.id"
                  :class="['model-tpl-btn', selectedModelTpl === tpl.id ? 'active' : '']"
                  @click="applyModelTpl(tpl)"
                >
                  <span class="mtpl-icon">{{ tpl.icon }}</span>
                  <span class="mtpl-name">{{ tpl.name }}</span>
                  <span class="mtpl-tag">{{ tpl.tag }}</span>
                </button>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>任务名称 *</label>
                <input v-model="createForm.name" placeholder="my-training-job" />
              </div>
              <div class="form-group">
                <label>分区 *</label>
                <select v-model="createForm.partition">
                  <option v-for="p in partitions" :key="p" :value="p">{{ p }}</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>节点数</label>
                <input v-model.number="createForm.nodes" type="number" min="1" />
              </div>
              <div class="form-group">
                <label>CPU 核心数</label>
                <input v-model.number="createForm.cpus" type="number" min="1" />
              </div>
              <div class="form-group">
                <label>GPU 卡数</label>
                <input v-model.number="createForm.gpus" type="number" min="0" />
              </div>
              <div class="form-group">
                <label>内存 (GB)</label>
                <input v-model.number="createForm.memory" type="number" min="0" placeholder="不限" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>时间限制 (小时，0=不限)</label>
                <input v-model.number="createForm.time_limit" type="number" min="0" />
              </div>
              <div v-if="createForm.type === 'infer'" class="form-group">
                <label>服务端口</label>
                <input v-model.number="createForm.service_port" type="number" placeholder="8000" />
              </div>
            </div>
            <div class="form-group">
              <label>容器镜像（可选，Pyxis/Enroot）</label>
              <input v-model="createForm.image" placeholder="harbor.example.com/library/pytorch:latest" />
            </div>
            <div class="form-group">
              <label>工作目录</label>
              <input v-model="createForm.work_dir" placeholder="/home/user/jobs" />
            </div>
            <div class="form-group">
              <label>作业脚本 *</label>
              <div class="script-tpl-btns">
                <span style="font-size:.72rem;color:#94a3b8">脚本模板：</span>
                <button type="button" class="tpl-btn" @click="applyScriptTpl('pytorch')">PyTorch</button>
                <button type="button" class="tpl-btn" @click="applyScriptTpl('deepspeed')">DeepSpeed</button>
                <button type="button" class="tpl-btn" @click="applyScriptTpl('vllm')">vLLM</button>
                <button type="button" class="tpl-btn" @click="applyScriptTpl('triton')">Triton</button>
              </div>
              <textarea v-model="createForm.script" rows="10" class="script-editor" spellcheck="false" />
            </div>
            <!-- 失败重跑配置 -->
            <div class="restart-config-box">
              <div class="restart-config-title">🔄 失败重跑配置</div>
              <div class="restart-config-row">
                <label class="checkbox-label">
                  <input type="checkbox" v-model="createForm.auto_restart" />
                  失败时自动重跑
                </label>
                <label class="checkbox-label" style="margin-left:16px">
                  <input type="checkbox" v-model="createForm.restart_on_nodes" />
                  节点故障时重跑
                </label>
              </div>
              <div v-if="createForm.auto_restart" class="restart-opts">
                <label>最大重试次数</label>
                <input v-model.number="createForm.max_retries" type="number" min="1" max="10" style="width:60px" />
                <span style="font-size:.75rem;color:#94a3b8">次（失败后自动重新提交作业）</span>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-primary" @click="submitCreate" :disabled="submitting">
              {{ submitting ? '提交中...' : '🚀 提交' }}
            </button>
            <button class="btn-ghost" @click="showCreate = false">取消</button>
          </div>
        </div>
      </div>

      <!-- 发布端口弹窗 -->
      <div v-if="showPublish" class="modal-overlay" @click.self="showPublish = false">
        <div class="modal-box" style="max-width:480px">
          <div class="modal-header">
            <h3>🌐 发布推理端口</h3>
            <button @click="showPublish = false" class="btn-close">✕</button>
          </div>
          <div class="modal-body">
            <div v-if="publishResult" class="publish-result">
              <div class="publish-success">✅ 端口已发布，API Key 已生成</div>
              <div class="publish-field">
                <span class="pf-label">端口</span>
                <code class="pf-val">{{ publishResult.port }}</code>
              </div>
              <div class="publish-field">
                <span class="pf-label">API Key</span>
                <code class="pf-val key">{{ publishResult.api_key }}</code>
                <button class="btn-copy" @click="copyText(publishResult.api_key)">📋 复制</button>
              </div>
              <div class="publish-hint">
                使用示例：<br/>
                <code class="hint-code">curl http://&lt;节点IP&gt;:{{ publishResult.port }}/v1/chat/completions \<br/>  -H "Authorization: Bearer {{ publishResult.api_key }}"</code>
              </div>
            </div>
            <template v-else>
              <p style="font-size:.85rem;color:#94a3b8;margin:0 0 12px">
                为推理服务 <b>{{ publishTask?.name }}</b> 发布端口 <b>{{ publishTask?.service_port }}</b>，并生成访问 API Key。
              </p>
              <div class="form-group">
                <label>备注（可选）</label>
                <input v-model="publishNote" placeholder="如：对外测试用" />
              </div>
            </template>
          </div>
          <div class="modal-footer" v-if="!publishResult">
            <button class="btn-primary" @click="doPublishPort" :disabled="publishing">
              {{ publishing ? '生成中...' : '生成 API Key' }}
            </button>
            <button class="btn-ghost" @click="showPublish = false">取消</button>
          </div>
          <div class="modal-footer" v-else>
            <button class="btn-ghost" @click="showPublish = false">关闭</button>
          </div>
        </div>
      </div>

      <!-- 日志弹窗 -->
      <div v-if="showLog" class="modal-overlay" @click.self="showLog = false">
        <div class="modal-box">
          <div class="modal-header">
            <h3>📋 {{ logTask?.name }} - 日志</h3>
            <button @click="showLog = false" class="btn-close">✕</button>
          </div>
          <div class="modal-body">
            <div v-if="logLoading" style="text-align:center;padding:2rem;color:#94a3b8">加载中...</div>
            <pre v-else class="log-content">{{ logContent || '（暂无日志）' }}</pre>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { getApiBase } from '../utils/auth'
import notification from '../utils/notification'
import dialog from '../utils/dialog'

const loading = ref(false)
const tasks = ref<any[]>([])
const stats = ref({ running: 0, pending: 0, completed: 0, failed: 0, train: 0, infer: 0, total: 0 })
const typeFilter = ref('')
const showCreate = ref(false)
const showLog = ref(false)
const showPublish = ref(false)
const logTask = ref<any>(null)
const logContent = ref('')
const logLoading = ref(false)
const submitting = ref(false)
const publishing = ref(false)
const publishTask = ref<any>(null)
const publishNote = ref('')
const publishResult = ref<any>(null)
const selectedModelTpl = ref('')
const partitions = ref<string[]>(['compute', 'gpu'])
const endpoints = ref<Record<string, { api_key: string; port: number; note: string }>>({})

const token = () => localStorage.getItem('token') || sessionStorage.getItem('token')
const api = (path: string) => `${getApiBase()}${path}`
const headers = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' })

const filteredTasks = computed(() =>
  typeFilter.value ? tasks.value.filter(t => t.type === typeFilter.value) : tasks.value
)

const modelTemplates = [
  { id: 'llama3', icon: '🦙', name: 'LLaMA 3', tag: '推理', type: 'infer', gpus: 4, cpus: 16, memory: 64, script: '' },
  { id: 'pytorch', icon: '🔥', name: 'PyTorch', tag: '训练', type: 'train', gpus: 8, cpus: 32, memory: 128, script: '' },
  { id: 'deepspeed', icon: '⚡', name: 'DeepSpeed', tag: '训练', type: 'train', gpus: 8, cpus: 32, memory: 128, script: '' },
  { id: 'triton', icon: '🚀', name: 'Triton', tag: '推理', type: 'infer', gpus: 2, cpus: 8, memory: 32, script: '' },
]

const filteredModelTpls = computed(() =>
  modelTemplates.filter(t => !createForm.value.type || t.type === createForm.value.type)
)

const defaultForm = () => ({
  name: '', type: 'train' as 'train'|'infer', partition: '',
  nodes: 1, cpus: 8, gpus: 1, memory: 0, time_limit: 0,
  image: '', work_dir: '', script: '', service_port: 8000,
  auto_restart: true, max_retries: 3, restart_on_nodes: true
})
const createForm = ref(defaultForm())

const applyModelTpl = (tpl: any) => {
  selectedModelTpl.value = tpl.id
  createForm.value.gpus = tpl.gpus
  createForm.value.cpus = tpl.cpus
  createForm.value.memory = tpl.memory
  createForm.value.name = tpl.name.toLowerCase().replace(/\s+/g, '-') + '-job'
}

const scriptTpls: Record<string, string> = {
  pytorch: '#!/bin/bash\n#SBATCH -o slurm-%j.out\nMASTER=$(scontrol show hostnames $SLURM_JOB_NODELIST | head -n1)\nsrun torchrun --nproc_per_node=$SLURM_GPUS_ON_NODE --nnodes=$SLURM_NNODES --node_rank=$SLURM_NODEID --master_addr=$MASTER --master_port=29500 train.py',
  deepspeed: '#!/bin/bash\n#SBATCH -o slurm-%j.out\nMASTER=$(scontrol show hostnames $SLURM_JOB_NODELIST | head -n1)\nsrun deepspeed --num_nodes=$SLURM_NNODES --num_gpus=$SLURM_GPUS_ON_NODE --master_addr=$MASTER train_ds.py --deepspeed ds_config.json',
  vllm: '#!/bin/bash\n#SBATCH -o slurm-%j.out\npython -m vllm.entrypoints.openai.api_server --model /data/models/llama3 --tensor-parallel-size $SLURM_GPUS_ON_NODE --host 0.0.0.0 --port 8000',
  triton: '#!/bin/bash\n#SBATCH -o slurm-%j.out\ntritonserver --model-repository=/data/triton_models --http-port=8000 --grpc-port=8001'
}
const applyScriptTpl = (name: string) => { createForm.value.script = scriptTpls[name] || '' }

// 更新脚本内容中的 SBATCH 参数
const updateScriptParams = () => {
  let script = createForm.value.script
  if (!script || !script.includes('#SBATCH')) return

  // 更新作业名称
  if (createForm.value.name) {
    if (script.includes('#SBATCH -J ')) {
      script = script.replace(/#SBATCH\s+-J\s+\S+/g, `#SBATCH -J ${createForm.value.name}`)
    } else {
      script = script.replace('#!/bin/bash\n', `#!/bin/bash\n#SBATCH -J ${createForm.value.name}\n`)
    }
  }

  // 更新分区
  if (createForm.value.partition) {
    if (script.includes('#SBATCH -p ')) {
      script = script.replace(/#SBATCH\s+-p\s+\S+/g, `#SBATCH -p ${createForm.value.partition}`)
    } else {
      const jobLine = script.match(/#SBATCH\s+-J\s+\S+/)
      if (jobLine) {
        script = script.replace(/(#SBATCH\s+-J\s+\S+)/g, `$1\n#SBATCH -p ${createForm.value.partition}`)
      }
    }
  }

  // 更新节点数
  if (script.includes('#SBATCH -N ')) {
    script = script.replace(/#SBATCH\s+-N\s+\d+/g, `#SBATCH -N ${createForm.value.nodes}`)
  } else {
    const partLine = script.match(/#SBATCH\s+-p\s+\S+/)
    if (partLine) {
      script = script.replace(/(#SBATCH\s+-p\s+\S+)/g, `$1\n#SBATCH -N ${createForm.value.nodes}`)
    }
  }

  // 更新 CPU 核心数
  if (script.includes('#SBATCH -c ')) {
    script = script.replace(/#SBATCH\s+-c\s+\d+/g, `#SBATCH -c ${createForm.value.cpus}`)
  } else if (script.includes('#SBATCH --ntasks-per-node=')) {
    script = script.replace(/#SBATCH\s+--ntasks-per-node=\d+/g, `#SBATCH --ntasks-per-node=${createForm.value.cpus}`)
  } else {
    const nodeLine = script.match(/#SBATCH\s+-N\s+\d+/)
    if (nodeLine) {
      script = script.replace(/(#SBATCH\s+-N\s+\d+)/g, `$1\n#SBATCH -c ${createForm.value.cpus}`)
    }
  }

  // 更新内存
  if (createForm.value.memory > 0) {
    if (script.includes('#SBATCH --mem=')) {
      script = script.replace(/#SBATCH\s+--mem=\d+G?/g, `#SBATCH --mem=${createForm.value.memory}G`)
    } else {
      const cpuLine = script.match(/#SBATCH\s+-c\s+\d+/)
      if (cpuLine) {
        script = script.replace(/(#SBATCH\s+-c\s+\d+)/g, `$1\n#SBATCH --mem=${createForm.value.memory}G`)
      }
    }
  } else {
    script = script.replace(/\n?#SBATCH\s+--mem=\d+G?\n?/g, '\n')
  }

  // 更新时间
  if (createForm.value.time_limit > 0) {
    const timeStr = `${String(createForm.value.time_limit).padStart(2, '0')}:00:00`
    if (script.includes('#SBATCH -t ') || script.includes('#SBATCH --time=')) {
      script = script.replace(/#SBATCH\s+-t\s+\S+/g, `#SBATCH -t ${timeStr}`)
      script = script.replace(/#SBATCH\s+--time=\S+/g, `#SBATCH --time=${timeStr}`)
    } else {
      const memLine = script.match(/#SBATCH\s+--mem=\d+G?/)
      if (memLine) {
        script = script.replace(/(#SBATCH\s+--mem=\d+G?)/g, `$1\n#SBATCH -t ${timeStr}`)
      }
    }
  } else {
    script = script.replace(/\n?#SBATCH\s+(-t|--time=)\s*\S+\n?/g, '\n')
  }

  // 更新 GPU
  if (createForm.value.gpus > 0) {
    if (script.includes('#SBATCH --gres=gpu:')) {
      script = script.replace(/#SBATCH\s+--gres=gpu:\d+/g, `#SBATCH --gres=gpu:${createForm.value.gpus}`)
    } else {
      const memLine = script.match(/#SBATCH\s+--mem=\d+G?/)
      if (memLine) {
        script = script.replace(/(#SBATCH\s+--mem=\d+G?)/g, `$1\n#SBATCH --gres=gpu:${createForm.value.gpus}`)
      }
    }
  } else {
    script = script.replace(/\n?#SBATCH\s+--gres=gpu:\d+\n?/g, '\n')
  }

  // 清理多余的空行
  script = script.replace(/\n{3,}/g, '\n\n')

  createForm.value.script = script
}

// 监听表单参数变化，自动更新脚本内容
watch(
  () => [
    createForm.value.name,
    createForm.value.partition,
    createForm.value.nodes,
    createForm.value.cpus,
    createForm.value.memory,
    createForm.value.time_limit,
    createForm.value.gpus
  ],
  () => {
    updateScriptParams()
  },
  { deep: true }
)

const loadAll = async () => {
  loading.value = true
  try {
    const [tr, sr] = await Promise.all([
      fetch(api('/api/ai-tasks'), { headers: headers() }),
      fetch(api('/api/ai-tasks/stats'), { headers: headers() })
    ])
    const td = await tr.json(); const sd = await sr.json()
    tasks.value = (td.data || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    stats.value = sd.data || stats.value
  } catch (e: any) { notification.error('加载失败: ' + e.message) }
  finally { loading.value = false }
}

const loadPartitions = async () => {
  try {
    const res = await fetch(api('/api/jobs/partitions/list'), { headers: headers() })
    const data = await res.json()
    const list = (data.data || []).map((p: any) => p.name).filter(Boolean)
    if (list.length > 0) { partitions.value = list; createForm.value.partition = list[0] }
  } catch { partitions.value = ['compute', 'gpu'] }
}

const openCreate = (type: 'train' | 'infer') => {
  createForm.value = defaultForm()
  createForm.value.type = type
  selectedModelTpl.value = ''
  if (partitions.value.length > 0) createForm.value.partition = partitions.value[0]
  showCreate.value = true
}

const submitCreate = async () => {
  if (!createForm.value.name.trim() || !createForm.value.script.trim()) {
    notification.error('请填写任务名称和脚本'); return
  }
  submitting.value = true
  try {
    const res = await fetch(api('/api/ai-tasks'), { method: 'POST', headers: headers(), body: JSON.stringify(createForm.value) })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '提交失败')
    notification.success('任务已提交，作业ID: ' + data.data?.job_id)
    showCreate.value = false; loadAll()
  } catch (e: any) { notification.error(e.message) }
  finally { submitting.value = false }
}

const stopTask = async (task: any) => {
  const ok = await dialog.confirm('确定停止任务 ' + task.name + '？', { title: '停止任务' })
  if (!ok) return
  try {
    const res = await fetch(api('/api/ai-tasks/' + task.id + '/stop'), { method: 'POST', headers: headers() })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    notification.success('任务已停止'); loadAll()
  } catch (e: any) { notification.error(e.message) }
}

const restartTask = async (task: any) => {
  try {
    const res = await fetch(api('/api/ai-tasks/' + task.id + '/restart'), { method: 'POST', headers: headers() })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    notification.success('重启任务已提交'); loadAll()
  } catch (e: any) { notification.error(e.message) }
}

const deleteTask = async (task: any) => {
  const ok = await dialog.confirmDelete(task.name, '任务')
  if (!ok) return
  try {
    await fetch(api('/api/ai-tasks/' + task.id), { method: 'DELETE', headers: headers() })
    notification.success('删除成功'); loadAll()
  } catch (e: any) { notification.error(e.message) }
}

const viewLogs = async (task: any) => {
  logTask.value = task; showLog.value = true; logLoading.value = true; logContent.value = ''
  try {
    const res = await fetch(api('/api/ai-tasks/' + task.id + '/logs'), { headers: headers() })
    const data = await res.json()
    logContent.value = data.log || data.message || '暂无日志'
  } catch { logContent.value = '获取日志失败' }
  finally { logLoading.value = false }
}

const openPublishPort = (task: any) => {
  publishTask.value = task; publishNote.value = ''; publishResult.value = null; showPublish.value = true
}

const doPublishPort = async () => {
  if (!publishTask.value) return
  publishing.value = true
  try {
    const apiKey = 'sk-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    publishResult.value = { port: publishTask.value.service_port || 8000, api_key: apiKey }
    endpoints.value[publishTask.value.id] = { api_key: apiKey, port: publishTask.value.service_port || 8000, note: publishNote.value }
  } finally { publishing.value = false }
}

const revokeEndpoint = async (task: any) => {
  const ok = await dialog.confirm('确定撤销 API Key？', { title: '撤销 API Key', danger: true })
  if (ok) delete endpoints.value[task.id]
}

const copyText = (text: string) => { navigator.clipboard.writeText(text); notification.success('已复制') }

const statusLabel = (s: string) => ({ RUNNING: '运行中', PENDING: '等待中', COMPLETED: '已完成', FAILED: '失败', RESTARTING: '重启中' }[s] || s)
const formatTime = (t: string) => t ? new Date(t).toLocaleString('zh-CN') : '-'

let timer: ReturnType<typeof setInterval>
onMounted(() => { loadPartitions(); loadAll(); timer = setInterval(loadAll, 30000) })
onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.ai-tasks-page { display: flex; flex-direction: column; gap: 1rem; height: 100%; overflow-y: auto; }
.stats-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; flex-shrink: 0; }
.stat-card { background: hsl(var(--card)); border: 1px solid hsl(var(--border)); border-radius: var(--radius-md); padding: 14px; text-align: center; }
.stat-label { font-size: .72rem; color: hsl(var(--muted-foreground)); margin-bottom: 6px; }
.stat-value { font-size: 1.8rem; font-weight: 700; color: hsl(var(--foreground)); }
.stat-value.running { color: #3b82f6; } .stat-value.pending { color: #f59e0b; }
.stat-value.completed { color: #10b981; } .stat-value.failed { color: #ef4444; }
.toolbar { display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; gap: 8px; }
.toolbar-left, .toolbar-right { display: flex; align-items: center; gap: 6px; }
.tab-btn { padding: 5px 14px; border: 1px solid hsl(var(--border)); background: hsl(var(--background)); color: hsl(var(--muted-foreground)); border-radius: 20px; font-size: .8rem; cursor: pointer; transition: all .15s; }
.tab-btn.active { background: hsl(var(--foreground)); color: hsl(var(--background)); border-color: hsl(var(--foreground)); }
.btn-refresh { background: none; border: 1px solid hsl(var(--border)); border-radius: 8px; padding: 5px 10px; font-size: 1rem; cursor: pointer; color: hsl(var(--muted-foreground)); }
.btn-create { padding: 6px 14px; border: none; border-radius: 8px; font-size: .82rem; font-weight: 600; cursor: pointer; color: #fff; }
.btn-create.train { background: #6366f1; } .btn-create.infer { background: #0ea5e9; }
.task-list { display: flex; flex-direction: column; gap: 8px; }
.empty-tip { text-align: center; padding: 4rem 2rem; color: hsl(var(--muted-foreground)); font-size: .85rem; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.task-card { background: hsl(var(--card)); border: 1px solid hsl(var(--border)); border-radius: var(--radius-md); padding: 14px 16px; }
.task-title-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
.task-type-badge { padding: 2px 8px; border-radius: 10px; font-size: .72rem; font-weight: 600; }
.task-type-badge.train { background: rgba(99,102,241,.12); color: #6366f1; }
.task-type-badge.infer { background: rgba(14,165,233,.12); color: #0ea5e9; }
.task-name { font-size: .9rem; font-weight: 600; color: hsl(var(--foreground)); }
.task-status { padding: 2px 8px; border-radius: 10px; font-size: .72rem; font-weight: 600; }
.task-status.running { background: rgba(59,130,246,.1); color: #3b82f6; }
.task-status.pending,.task-status.restarting { background: rgba(245,158,11,.1); color: #f59e0b; }
.task-status.completed { background: rgba(16,185,129,.1); color: #10b981; }
.task-status.failed { background: rgba(239,68,68,.1); color: #ef4444; }
.restart-badge { font-size: .7rem; padding: 2px 7px; border-radius: 10px; background: rgba(16,185,129,.1); color: #10b981; }
.port-badge { font-size: .72rem; padding: 2px 7px; border-radius: 10px; background: rgba(14,165,233,.1); color: #0ea5e9; font-family: monospace; }
.task-meta { font-size: .78rem; color: hsl(var(--muted-foreground)); }
.task-error { font-size: .75rem; color: #ef4444; margin-top: 4px; }
.task-card-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid hsl(var(--border)); padding-top: 10px; margin-top: 10px; }
.task-time { font-size: .72rem; color: hsl(var(--muted-foreground)); }
.task-actions { display: flex; gap: 5px; }
.btn-sm { padding: 4px 10px; font-size: .75rem; background: hsl(var(--secondary)); border: 1px solid hsl(var(--border)); border-radius: 6px; cursor: pointer; color: hsl(var(--foreground)); }
.btn-sm.danger { color: #ef4444; border-color: rgba(239,68,68,.25); }
.btn-sm.publish { color: #0ea5e9; border-color: rgba(14,165,233,.25); }
.endpoint-info { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: .78rem; flex-wrap: wrap; }
.endpoint-key { font-family: monospace; font-size: .75rem; background: hsl(var(--muted)); padding: 2px 6px; border-radius: 4px; }
.btn-copy,.btn-revoke { padding: 2px 8px; font-size: .72rem; border: 1px solid hsl(var(--border)); border-radius: 4px; cursor: pointer; background: hsl(var(--secondary)); }
.model-tpl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 6px; }
.model-tpl-btn { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px; border: 1px solid hsl(var(--border)); border-radius: 8px; cursor: pointer; background: hsl(var(--background)); transition: all .15s; }
.model-tpl-btn.active { border-color: hsl(var(--primary)); background: hsl(var(--primary)/.08); }
.mtpl-icon { font-size: 1.2rem; } .mtpl-name { font-size: .78rem; font-weight: 600; } .mtpl-tag { font-size: .68rem; color: hsl(var(--muted-foreground)); }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1.5rem; }
.modal-box { background: hsl(var(--card)); border-radius: 12px; width: 100%; max-width: 680px; max-height: 88vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,.25); overflow: hidden; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 1px solid hsl(var(--border)); flex-shrink: 0; }
.modal-header h3 { margin: 0; font-size: 1rem; font-weight: 600; }
.btn-close { background: none; border: none; font-size: 1rem; color: hsl(var(--muted-foreground)); cursor: pointer; padding: 4px 8px; border-radius: 4px; }
.modal-body { padding: 16px 18px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 10px; }
.modal-footer { display: flex; gap: 8px; padding: 12px 18px; border-top: 1px solid hsl(var(--border)); flex-shrink: 0; }
.form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; }
.form-group { display: flex; flex-direction: column; gap: 3px; }
.form-group label { font-size: .72rem; font-weight: 600; color: hsl(var(--muted-foreground)); text-transform: uppercase; }
.form-group input,.form-group select { padding: 6px 9px; border: 1px solid hsl(var(--input)); border-radius: var(--radius-md); font-size: .83rem; background: hsl(var(--background)); color: hsl(var(--foreground)); outline: none; box-sizing: border-box; }
.script-tpl-btns { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.tpl-btn { padding: 2px 9px; font-size: .73rem; background: hsl(var(--secondary)); border: 1px solid hsl(var(--border)); border-radius: 6px; cursor: pointer; }
.script-editor { width: 100%; box-sizing: border-box; font-family: monospace; font-size: .8rem; line-height: 1.6; padding: 10px 12px; border: 1px solid hsl(var(--input)); border-radius: var(--radius-md); background: #1e293b; color: #e2e8f0; resize: vertical; outline: none; }
.restart-config-box { border: 1px solid hsl(var(--border)); border-radius: 8px; padding: 10px 12px; }
.restart-config-title { font-size: .78rem; font-weight: 600; margin-bottom: 8px; }
.restart-config-row { display: flex; align-items: center; margin-bottom: 8px; }
.restart-opts { display: flex; align-items: center; gap: 8px; font-size: .8rem; }
.checkbox-label { display: flex; align-items: center; gap: 6px; font-size: .83rem; cursor: pointer; }
.publish-result { display: flex; flex-direction: column; gap: 10px; }
.publish-success { color: #10b981; font-weight: 600; }
.publish-field { display: flex; align-items: center; gap: 8px; }
.pf-label { font-size: .78rem; color: hsl(var(--muted-foreground)); width: 60px; }
.pf-val { font-family: monospace; font-size: .82rem; background: hsl(var(--muted)); padding: 3px 8px; border-radius: 4px; }
.pf-val.key { max-width: 300px; overflow: hidden; text-overflow: ellipsis; }
.publish-hint { font-size: .78rem; color: hsl(var(--muted-foreground)); background: hsl(var(--muted)); padding: 8px 10px; border-radius: 6px; }
.hint-code { font-family: monospace; font-size: .75rem; }
.btn-ghost { padding: 8px 16px; background: none; color: hsl(var(--muted-foreground)); border: 1px solid hsl(var(--border)); border-radius: var(--radius-md); font-size: .83rem; cursor: pointer; }
.log-content { background: #1e293b; color: #e2e8f0; padding: 12px 14px; border-radius: 8px; font-size: .78rem; line-height: 1.6; overflow-x: auto; margin: 0; max-height: 500px; overflow-y: auto; font-family: monospace; white-space: pre-wrap; }
@media (max-width: 900px) { .stats-row { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 480px) { .stats-row { grid-template-columns: repeat(2, 1fr); } }
</style>
