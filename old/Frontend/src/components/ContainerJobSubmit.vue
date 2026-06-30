<template>
  <div class="container-wrap">
  <form @submit.prevent="submit" class="container-form">
    <!-- 镜像地址 -->
    <div class="form-group">
      <label>容器镜像 *</label>
      <div class="input-row">
        <input
          v-model="form.image"
          type="text"
          placeholder="harbor.example.com/library/pytorch:latest"
          required
        />
        <button type="button" class="btn-pick" @click="showPicker = !showPicker">📦 选择</button>
        <button type="button" class="btn-pick" @click="emit('go-registry')" title="前往镜像仓库">🗄</button>
      </div>
      <div v-if="showPicker" class="image-picker">
        <div class="picker-search">
          <input v-model="pickerSearch" placeholder="搜索镜像..." class="picker-input" />
        </div>
        <div v-if="loadingImages" class="picker-empty">加载中...</div>
        <div v-else class="picker-list">
          <template v-if="filteredImages.length > 0">
            <div v-if="groupedImages.public.length > 0" class="picker-group-label">公共镜像</div>
            <div
              v-for="img in groupedImages.public"
              :key="img.addr"
              class="picker-item"
              @click="form.image = img.addr; showPicker = false"
            >
              <span class="picker-img-name">{{ img.name }}</span>
              <span class="picker-img-addr">{{ img.addr }}</span>
            </div>
            <div v-if="groupedImages.private.length > 0" class="picker-group-label">我的镜像</div>
            <div
              v-for="img in groupedImages.private"
              :key="img.addr"
              class="picker-item"
              @click="form.image = img.addr; showPicker = false"
            >
              <span class="picker-img-name">{{ img.name }}</span>
              <span class="picker-img-addr">{{ img.addr }}</span>
            </div>
          </template>
          <div v-else class="picker-empty">
            暂无镜像，
            <span class="picker-link" @click="emit('go-registry'); showPicker = false">前往镜像仓库</span>
            查看
          </div>
        </div>
      </div>
    </div>

    <!-- 作业名 + 分区 -->
    <div class="form-row">
      <div class="form-group">
        <label>作业名称 *</label>
        <input v-model="form.name" type="text" placeholder="container_job" required />
      </div>
      <div class="form-group">
        <label>分区 *</label>
        <select v-model="form.partition" required>
          <option value="" disabled>-- 选择分区 --</option>
          <option v-for="p in partitions" :key="p" :value="p">{{ p }}</option>
        </select>
      </div>
    </div>

    <!-- 资源 -->
    <div class="form-row">
      <div class="form-group">
        <label>节点数</label>
        <input v-model.number="form.nodes" type="number" min="1" max="32" />
      </div>
      <div class="form-group">
        <label>CPU 核心数</label>
        <input v-model.number="form.cpus" type="number" min="1" max="256" />
      </div>
      <div class="form-group">
        <label>内存 (GB)</label>
        <input v-model.number="form.memory" type="number" min="0" placeholder="不限" />
      </div>
      <div class="form-group">
        <label>GPU 卡数</label>
        <input v-model.number="form.gpus" type="number" min="0" max="16" />
      </div>
    </div>

    <!-- 挂载目录 -->
    <div class="form-group">
      <label>挂载目录</label>
      <input
        v-model="form.mounts"
        type="text"
        placeholder="/home/$USER:/workspace,/data:/data"
      />
      <div class="help-text">逗号分隔，格式：宿主机路径:容器内路径</div>
    </div>

    <!-- 工作目录 -->
    <div class="form-group">
      <label>工作目录</label>
      <input v-model="form.workdir" type="text" placeholder="/workspace" />
    </div>

    <!-- 运行命令 -->
    <div class="form-group">
      <label>运行命令（可选）</label>
      <input v-model="form.command" type="text" placeholder="python /workspace/train.py" />
      <div class="help-text" v-if="!form.command">
        💡 留空 = 交互模式（sleep infinity），可通过"进入容器"连接
      </div>
      <div class="help-text warn" v-else>
        ⚠️ 填写命令后容器执行完毕即退出，如需同时保持运行请勾选下方选项
      </div>
    </div>
    <!-- 保持运行选项（仅在有命令时显示） -->
    <div class="form-group" v-if="form.command">
      <label class="checkbox-label">
        <input type="checkbox" v-model="form.keepAlive" />
        命令执行后保持容器运行（追加 sleep infinity，方便进入容器调试）
      </label>
    </div>

    <!-- 时间限制 -->
    <div class="form-group">
      <label>时间限制（小时）</label>
      <input v-model.number="form.time" type="number" min="0" placeholder="不限" />
    </div>

    <!-- 生成的脚本预览 -->
    <div class="form-group">
      <label>生成脚本预览</label>
      <div class="script-preview">{{ generatedScript }}</div>
    </div>

    <div class="form-actions">
      <button type="submit" class="btn-primary" :disabled="submitting">
        {{ submitting ? '提交中...' : '🚀 提交容器作业' }}
      </button>
    </div>
  </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getApiBase, getUser } from '../utils/auth'
import notification from '../utils/notification'

const props = defineProps<{ initialImage?: string }>()
const emit = defineEmits(['submitted', 'go-registry'])

const submitting = ref(false)
const showPicker = ref(false)
const pickerSearch = ref('')
const loadingImages = ref(false)
const partitions = ref<string[]>([])

interface ImageItem { name: string; addr: string; project: string; isPublic: boolean }
const allImages = ref<ImageItem[]>([])

const filteredImages = computed(() =>
  pickerSearch.value
    ? allImages.value.filter(i => i.name.includes(pickerSearch.value) || i.addr.includes(pickerSearch.value))
    : allImages.value
)
const groupedImages = computed(() => ({
  public: filteredImages.value.filter(i => i.isPublic),
  private: filteredImages.value.filter(i => !i.isPublic)
}))

const currentUser = getUser()
const homeDir = currentUser?.homeDir || `/home/${currentUser?.username || '$USER'}`

const form = ref({
  image: props.initialImage || '',
  name: 'container_job',
  partition: '',
  nodes: 1,
  cpus: 8,
  memory: 0,
  gpus: 0,
  mounts: `${homeDir}:${homeDir}`,
  workdir: homeDir,
  command: '',
  keepAlive: false,
  time: 0,
})

const generatedScript = computed(() => {
  const f = form.value

  // 构建 srun container 参数（在脚本体内用 srun 启动，避免 REST API 提交时 #SBATCH 被 job 对象覆盖）
  const srunArgs: string[] = [
    `--container-image=${f.image}`,
  ]
  if (f.mounts) srunArgs.push(`--container-mounts=${f.mounts}`)
  if (f.workdir) srunArgs.push(`--container-workdir=${f.workdir}`)

  const lines: string[] = [
    '#!/bin/bash',
    `#SBATCH -J ${f.name || 'container_job'}`,
    `#SBATCH -p ${f.partition || 'compute'}`,
    `#SBATCH -N ${f.nodes}`,
    `#SBATCH -c ${f.cpus}`,
  ]
  if (f.memory > 0) lines.push(`#SBATCH --mem=${f.memory}G`)
  if (f.gpus > 0) lines.push(`#SBATCH --gres=gpu:${f.gpus}`)
  if (f.time > 0) {
    const timeStr = `${String(f.time).padStart(2, '0')}:00:00`
    lines.push(`#SBATCH -t ${timeStr}`)
  }
  lines.push('')
  lines.push('echo "Container job started: $(date)"')
  lines.push(`echo "Image: ${f.image}"`)
  lines.push('')

  const srunPrefix = `srun ${srunArgs.join(' ')}`
  if (f.command) {
    lines.push(`${srunPrefix} bash -c ${JSON.stringify(f.command)}`)
    if (f.keepAlive) {
      lines.push('')
      lines.push('# 保持容器运行，方便通过 Web Shell 进入调试')
      lines.push(`${srunPrefix} sleep infinity`)
    }
  } else {
    lines.push('# 交互模式 - 通过 Web Shell 连接到此作业节点')
    lines.push(`${srunPrefix} sleep infinity`)
  }
  lines.push('')
  lines.push('echo "Job finished: $(date)"')
  return lines.join('\n')
})

const loadPartitions = async () => {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    const res = await fetch(`${getApiBase()}/api/jobs/partitions/list`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) return
    const data = await res.json()
    partitions.value = (data.data || []).map((p: any) => p.name).filter(Boolean)
    if (partitions.value.length > 0 && !form.value.partition) {
      form.value.partition = partitions.value[0]
    }
  } catch {
    partitions.value = ['compute', 'gpu', 'memory', 'debug']
    form.value.partition = 'compute'
  }
}

const loadImages = async () => {
  loadingImages.value = true
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    const cfgRes = await fetch(`${getApiBase()}/api/registry/config`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const cfg = await cfgRes.json()
    const harborHost = (cfg.harbor_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '')
    const publicProjects: string[] = cfg.public_projects || ['library']

    const projRes = await fetch(`${getApiBase()}/api/registry/projects`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const projData = await projRes.json()
    const projects: any[] = projData.data || []

    const images: ImageItem[] = []
    await Promise.all(projects.map(async (proj) => {
      try {
        const res = await fetch(`${getApiBase()}/api/registry/projects/${proj.name}/repositories`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!res.ok) return
        const data = await res.json()
        for (const repo of (data.data || [])) {
          const repoShortName = repo.name?.split('/').pop() || ''
          if (!repoShortName) continue
          const isPublic = !!proj.is_public_project || publicProjects.includes(proj.name)

          // 拉取该 repo 的真实 tag 列表
          try {
            const tagRes = await fetch(
              `${getApiBase()}/api/registry/projects/${proj.name}/repositories/${repoShortName}/tags`,
              { headers: { Authorization: `Bearer ${token}` } }
            )
            if (tagRes.ok) {
              const tagData = await tagRes.json()
              const artifacts: any[] = tagData.data || []
              // 每个 artifact 可能有多个 tag
              const tags: string[] = []
              for (const artifact of artifacts) {
                for (const t of (artifact.tags || [])) {
                  if (t.name) tags.push(t.name)
                }
              }
              if (tags.length > 0) {
                for (const tag of tags) {
                  images.push({
                    name: `${proj.name}/${repoShortName}:${tag}`,
                    addr: `${harborHost}/${proj.name}/${repoShortName}:${tag}`,
                    project: proj.name,
                    isPublic,
                  })
                }
                continue
              }
            }
          } catch { /* ignore, fall through to :latest */ }

          // 拿不到 tag 时降级用 :latest
          images.push({
            name: `${proj.name}/${repoShortName}`,
            addr: `${harborHost}/${proj.name}/${repoShortName}:latest`,
            project: proj.name,
            isPublic,
          })
        }
      } catch { /* ignore */ }
    }))
    allImages.value = images
  } catch { /* ignore */ }
  finally { loadingImages.value = false }
}

const submit = async () => {
  submitting.value = true
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    const res = await fetch(`${getApiBase()}/api/jobs`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.value.name,
        partition: form.value.partition,
        script: generatedScript.value,
        nodes: form.value.nodes,
        cpus: form.value.cpus,
        memory: form.value.memory || 0,
        gpus: form.value.gpus || 0,
        time: form.value.time || 0,
      })
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || '提交失败')
    }
    const result = await res.json()
    notification.success(`容器作业提交成功！作业ID: ${result.job_id}`)
    emit('submitted')
  } catch (e: any) {
    notification.error(e.message || '提交失败')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadPartitions()
  loadImages()
})
</script>

<style scoped>
.container-wrap {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.container-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
  box-sizing: border-box;
}
.container-form::-webkit-scrollbar { width: 3px; }
.container-form::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 2px; }

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 8px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.form-group label {
  font-size: 0.73rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.form-group input,
.form-group select {
  padding: 6px 9px;
  border: 1px solid hsl(var(--input));
  border-radius: var(--radius-md);
  font-size: 0.83rem;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  outline: none;
  box-sizing: border-box;
  width: 100%;
}
.form-group input:focus,
.form-group select:focus {
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.15);
}

.input-row { display: flex; gap: 6px; }
.input-row input { flex: 1; min-width: 0; }

.btn-pick {
  padding: 0 10px;
  background: hsl(var(--secondary));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  font-size: 0.8rem;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}
.btn-pick:hover { background: hsl(var(--accent)); }

.image-picker {
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  background: hsl(var(--card));
  overflow: hidden;
  margin-top: 2px;
}
.picker-search { padding: 6px; border-bottom: 1px solid hsl(var(--border)); }
.picker-input {
  width: 100%; box-sizing: border-box;
  padding: 5px 8px;
  border: 1px solid hsl(var(--input));
  border-radius: 6px;
  font-size: 0.8rem;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  outline: none;
}
.picker-list { max-height: 160px; overflow-y: auto; }
.picker-item {
  padding: 7px 10px;
  font-size: 0.8rem;
  font-family: monospace;
  cursor: pointer;
  color: hsl(var(--foreground));
  transition: background 0.1s;
}
.picker-item:hover { background: hsl(var(--accent)); }
.picker-empty { padding: 12px 10px; font-size: 0.8rem; color: hsl(var(--muted-foreground)); text-align: center; }
.picker-group-label {
  padding: 5px 10px 3px;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 0.5);
}
.picker-img-name { font-weight: 600; font-size: 0.8rem; }
.picker-img-addr { font-size: 0.72rem; color: hsl(var(--muted-foreground)); margin-left: 6px; font-family: monospace; }
.picker-link { color: hsl(var(--primary)); cursor: pointer; text-decoration: underline; }

.help-text { font-size: 0.7rem; color: hsl(var(--muted-foreground)); }
.help-text.warn { color: #f59e0b; }
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  color: hsl(var(--foreground));
  cursor: pointer;
  font-weight: normal;
  text-transform: none;
  letter-spacing: normal;
}

.script-preview {
  background: #1e293b !important;
  color: #e2e8f0;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 0.78rem;
  line-height: 1.6;
  overflow-x: auto;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
  box-shadow: none !important;
  position: relative;
  isolation: isolate;
  white-space: pre;
}

.form-actions {
  padding: 8px 14px;
  border-top: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  flex-shrink: 0;
}

.btn-primary {
  width: 100%;
  padding: 9px;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-primary:hover:not(:disabled) { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
