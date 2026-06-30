<template>
  <div class="ai-submit-form">
    <!-- 模型模板快速选择 -->
    <div class="tpl-section">
      <div class="tpl-label">选择模型模板</div>
      <div class="tpl-grid">
        <button
          v-for="tpl in templates"
          :key="tpl.id"
          :class="['tpl-card', { active: selectedTpl === tpl.id }]"
          type="button"
          @click="applyTpl(tpl)"
        >
          <span class="tpl-icon">{{ tpl.icon }}</span>
          <span class="tpl-name">{{ tpl.name }}</span>
          <span class="tpl-tag">{{ tpl.tag }}</span>
        </button>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>任务名称 *</label>
        <input v-model="form.name" placeholder="my-ai-job" required />
      </div>
      <div class="form-group">
        <label>分区 *</label>
        <select v-model="form.partition">
          <option v-for="p in partitions" :key="p" :value="p">{{ p }}</option>
        </select>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>节点数</label>
        <input v-model.number="form.nodes" type="number" min="1" />
      </div>
      <div class="form-group">
        <label>CPU 核心数</label>
        <input v-model.number="form.cpus" type="number" min="1" />
      </div>
      <div class="form-group">
        <label>GPU 卡数</label>
        <input v-model.number="form.gpus" type="number" min="0" />
      </div>
      <div class="form-group">
        <label>内存 (GB)</label>
        <input v-model.number="form.memory" type="number" min="0" placeholder="不限" />
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>时间限制 (小时，0=不限)</label>
        <input v-model.number="form.time" type="number" min="0" />
      </div>
      <div v-if="type === 'infer'" class="form-group">
        <label>服务端口</label>
        <input v-model.number="form.servicePort" type="number" placeholder="8000" />
      </div>
    </div>

    <!-- 容器镜像（从仓库选择） -->
    <div class="form-group">
      <label>容器镜像（可选）</label>
      <div class="input-row">
        <input v-model="form.image" placeholder="harbor.example.com/library/pytorch:latest" />
        <button type="button" class="btn-pick" @click="showPicker = !showPicker"> 选择</button>
      </div>
      <div v-if="showPicker" class="image-picker">
        <div class="picker-search">
          <input v-model="pickerSearch" placeholder="搜索镜像..." class="picker-input" />
        </div>
        <div v-if="loadingImages" class="picker-empty">加载中...</div>
        <div v-else class="picker-list">
          <div v-if="filteredImages.length === 0" class="picker-empty">暂无镜像</div>
          <div v-for="img in filteredImages" :key="img.addr" class="picker-item" @click="form.image = img.addr; showPicker = false">
            <span class="picker-img-name">{{ img.name }}</span>
            <span class="picker-img-addr">{{ img.addr }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="form-group">
      <label>工作目录</label>
      <input v-model="form.workdir" placeholder="/home/user/jobs" />
    </div>

    <!-- 脚本 -->
    <div class="form-group">
      <label>作业脚本 *</label>
      <textarea v-model="form.script" rows="10" class="script-editor" spellcheck="false" />
    </div>

    <!-- 自动重启 -->
    <div class="restart-row">
      <label class="checkbox-label">
        <input type="checkbox" v-model="form.autoRestart" />
        节点故障时自动重启
      </label>
      <div v-if="form.autoRestart" class="restart-opts">
        <span>最大重试</span>
        <input v-model.number="form.maxRetries" type="number" min="1" max="10" style="width:50px" />
        <span>次</span>
      </div>
    </div>

    <div class="form-actions">
      <button type="button" class="btn-primary" @click="submit" :disabled="submitting">
        {{ submitting ? '提交中...' : ' 提交' }}
      </button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { getApiBase } from '../utils/auth'
import notification from '../utils/notification'
const props = defineProps<{ type: 'train' | 'infer' }>()
const emit = defineEmits(['submitted'])
const submitting = ref(false)
const showPicker = ref(false)
const pickerSearch = ref('')
const loadingImages = ref(false)
const partitions = ref<string[]>(['gpu'])
const selectedTpl = ref('')
interface ImageItem { name: string; addr: string }
const allImages = ref<ImageItem[]>([])
const filteredImages = computed(() => pickerSearch.value ? allImages.value.filter(i => i.name.includes(pickerSearch.value) || i.addr.includes(pickerSearch.value)) : allImages.value)
const form = ref({ name: '', partition: '', nodes: 1, cpus: 8, gpus: 1, memory: 0, time: 0, image: '', workdir: '', script: '', servicePort: 8000, autoRestart: true, maxRetries: 3 })
const trainTpls = [{ id:'pytorch',icon:'🔥',name:'PyTorch DDP',tag:'多机多卡',gpus:8,cpus:32,memory:128,nodes:1,script:'#!/bin/bash\n#SBATCH -o slurm-%j.out\nMASTER=\\nsrun torchrun --nproc_per_node=\ --nnodes=\ --node_rank=\ --master_addr=\ --master_port=29500 train.py'},{ id:'deepspeed',icon:'⚡',name:'DeepSpeed',tag:'ZeRO-3',gpus:8,cpus:32,memory:128,nodes:1,script:'#!/bin/bash\n#SBATCH -o slurm-%j.out\nMASTER=\\nsrun deepspeed --num_nodes=\ --num_gpus=\ --master_addr=\ train_ds.py --deepspeed ds_zero3.json'}]
const inferTpls = [{ id:'vllm',icon:'',name:'vLLM',tag:'OpenAI API',gpus:4,cpus:16,memory:64,nodes:1,script:'#!/bin/bash\n#SBATCH -o slurm-%j.out\npython -m vllm.entrypoints.openai.api_server --model /data/models/llama3 --host 0.0.0.0 --port 8000'},{ id:'triton',icon:'',name:'Triton',tag:'高性能',gpus:2,cpus:8,memory:32,nodes:1,script:'#!/bin/bash\n#SBATCH -o slurm-%j.out\ntritonserver --model-repository=/data/triton_models --http-port=8000'}]
const templates = computed(() => props.type === 'train' ? trainTpls : inferTpls)
const applyTpl = (tpl: any) => { selectedTpl.value = tpl.id; form.value.gpus = tpl.gpus; form.value.cpus = tpl.cpus; form.value.memory = tpl.memory; form.value.nodes = tpl.nodes; form.value.script = tpl.script; if (!form.value.name) form.value.name = tpl.id + '-job' }

// 更新脚本内容中的 SBATCH 参数
const updateScriptParams = () => {
  let script = form.value.script
  if (!script || !script.includes('#SBATCH')) return

  // 更新作业名称
  if (form.value.name) {
    if (script.includes('#SBATCH -J ')) {
      script = script.replace(/#SBATCH\s+-J\s+\S+/g, `#SBATCH -J ${form.value.name}`)
    } else {
      script = script.replace('#!/bin/bash\n', `#!/bin/bash\n#SBATCH -J ${form.value.name}\n`)
    }
  }

  // 更新分区
  if (form.value.partition) {
    if (script.includes('#SBATCH -p ')) {
      script = script.replace(/#SBATCH\s+-p\s+\S+/g, `#SBATCH -p ${form.value.partition}`)
    } else {
      const jobLine = script.match(/#SBATCH\s+-J\s+\S+/)
      if (jobLine) {
        script = script.replace(/(#SBATCH\s+-J\s+\S+)/g, `$1\n#SBATCH -p ${form.value.partition}`)
      }
    }
  }

  // 更新节点数
  if (script.includes('#SBATCH -N ')) {
    script = script.replace(/#SBATCH\s+-N\s+\d+/g, `#SBATCH -N ${form.value.nodes}`)
  } else {
    const partLine = script.match(/#SBATCH\s+-p\s+\S+/)
    if (partLine) {
      script = script.replace(/(#SBATCH\s+-p\s+\S+)/g, `$1\n#SBATCH -N ${form.value.nodes}`)
    }
  }

  // 更新 CPU 核心数
  if (script.includes('#SBATCH -c ')) {
    script = script.replace(/#SBATCH\s+-c\s+\d+/g, `#SBATCH -c ${form.value.cpus}`)
  } else if (script.includes('#SBATCH --ntasks-per-node=')) {
    script = script.replace(/#SBATCH\s+--ntasks-per-node=\d+/g, `#SBATCH --ntasks-per-node=${form.value.cpus}`)
  } else {
    const nodeLine = script.match(/#SBATCH\s+-N\s+\d+/)
    if (nodeLine) {
      script = script.replace(/(#SBATCH\s+-N\s+\d+)/g, `$1\n#SBATCH -c ${form.value.cpus}`)
    }
  }

  // 更新内存
  if (form.value.memory > 0) {
    if (script.includes('#SBATCH --mem=')) {
      script = script.replace(/#SBATCH\s+--mem=\d+G?/g, `#SBATCH --mem=${form.value.memory}G`)
    } else {
      const cpuLine = script.match(/#SBATCH\s+-c\s+\d+/)
      if (cpuLine) {
        script = script.replace(/(#SBATCH\s+-c\s+\d+)/g, `$1\n#SBATCH --mem=${form.value.memory}G`)
      }
    }
  } else {
    script = script.replace(/\n?#SBATCH\s+--mem=\d+G?\n?/g, '\n')
  }

  // 更新时间
  if (form.value.time > 0) {
    const timeStr = `${String(form.value.time).padStart(2, '0')}:00:00`
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
  if (form.value.gpus > 0) {
    if (script.includes('#SBATCH --gres=gpu:')) {
      script = script.replace(/#SBATCH\s+--gres=gpu:\d+/g, `#SBATCH --gres=gpu:${form.value.gpus}`)
    } else {
      const memLine = script.match(/#SBATCH\s+--mem=\d+G?/)
      if (memLine) {
        script = script.replace(/(#SBATCH\s+--mem=\d+G?)/g, `$1\n#SBATCH --gres=gpu:${form.value.gpus}`)
      }
    }
  } else {
    script = script.replace(/\n?#SBATCH\s+--gres=gpu:\d+\n?/g, '\n')
  }

  // 清理多余的空行
  script = script.replace(/\n{3,}/g, '\n\n')

  form.value.script = script
}

// 监听表单参数变化，自动更新脚本内容
watch(
  () => [
    form.value.name,
    form.value.partition,
    form.value.nodes,
    form.value.cpus,
    form.value.memory,
    form.value.time,
    form.value.gpus
  ],
  () => {
    updateScriptParams()
  },
  { deep: true }
)

const token = () => localStorage.getItem('token') || sessionStorage.getItem('token')
const loadPartitions = async () => { try { const r = await fetch(getApiBase()+'/api/jobs/partitions/list',{headers:{Authorization:'Bearer '+token()}}); const d = await r.json(); const l=(d.data||[]).map((p:any)=>p.name).filter(Boolean); if(l.length){partitions.value=l;form.value.partition=l[0]} } catch { form.value.partition='gpu' } }
const loadImages = async () => { loadingImages.value=true; try { const cr=await fetch(getApiBase()+'/api/registry/config',{headers:{Authorization:'Bearer '+token()}}); const cfg=await cr.json(); const h=(cfg.harbor_url||'').replace(/^https?:\/\//,'').replace(/\/$/,''); const pr=await fetch(getApiBase()+'/api/registry/projects',{headers:{Authorization:'Bearer '+token()}}); const pd=await pr.json(); const imgs:ImageItem[]=[]; await Promise.all((pd.data||[]).map(async(proj:any)=>{ try{ const res=await fetch(getApiBase()+'/api/registry/projects/'+proj.name+'/repositories',{headers:{Authorization:'Bearer '+token()}}); if(!res.ok)return; const data=await res.json(); for(const repo of(data.data||[])){const n=repo.name?.split('/').pop()||''; if(n)imgs.push({name:proj.name+'/'+n,addr:h+'/'+proj.name+'/'+n+':latest'})} }catch{} })); allImages.value=imgs } catch{} finally{loadingImages.value=false} }
const submit = async () => { if(!form.value.name.trim()||!form.value.script.trim()){notification.error('请填写任务名称和脚本');return}; submitting.value=true; try{ let script=form.value.script; if(form.value.image){script=script.replace('#!/bin/bash\n','#!/bin/bash\n#SBATCH --container-image='+form.value.image+'\n')}; const res=await fetch(getApiBase()+'/api/jobs',{method:'POST',headers:{Authorization:'Bearer '+token(),'Content-Type':'application/json'},body:JSON.stringify({name:form.value.name,partition:form.value.partition,script,nodes:form.value.nodes,cpus:form.value.cpus,memory:form.value.memory||0,gpus:form.value.gpus||0,time:form.value.time||0})}); if(!res.ok){const e=await res.json();throw new Error(e.error||'提交失败')}; const r=await res.json(); notification.success('作业提交成功！ID: '+r.job_id); emit('submitted') }catch(e:any){notification.error(e.message)}finally{submitting.value=false} }
onMounted(()=>{loadPartitions();loadImages()})
</script>
<style scoped>
.ai-submit-form{display:flex;flex-direction:column;gap:10px;flex:1;overflow-y:auto;padding:12px 14px}
.tpl-section{background:hsl(var(--muted)/.3);border-radius:8px;padding:10px}
.tpl-label{font-size:.72rem;font-weight:700;color:hsl(var(--muted-foreground));text-transform:uppercase;margin-bottom:7px}
.tpl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:6px}
.tpl-card{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px;border:1px solid hsl(var(--border));border-radius:8px;cursor:pointer;background:hsl(var(--background));transition:all .15s}
.tpl-card.active{border-color:hsl(var(--primary));background:hsl(var(--primary)/.08)}
.tpl-icon{font-size:1.2rem}.tpl-name{font-size:.75rem;font-weight:600}.tpl-tag{font-size:.65rem;color:hsl(var(--muted-foreground))}
.form-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px}
.form-group{display:flex;flex-direction:column;gap:3px}
.form-group label{font-size:.72rem;font-weight:600;color:hsl(var(--muted-foreground));text-transform:uppercase}
.form-group input,.form-group select{padding:6px 9px;border:1px solid hsl(var(--input));border-radius:var(--radius-md);font-size:.83rem;background:hsl(var(--background));color:hsl(var(--foreground));outline:none;box-sizing:border-box;width:100%}
.input-row{display:flex;gap:6px}.input-row input{flex:1;min-width:0}
.btn-pick{padding:0 10px;background:hsl(var(--secondary));border:1px solid hsl(var(--border));border-radius:var(--radius-md);font-size:.8rem;cursor:pointer;white-space:nowrap;flex-shrink:0}
.image-picker{border:1px solid hsl(var(--border));border-radius:var(--radius-md);background:hsl(var(--card));overflow:hidden;margin-top:2px}
.picker-search{padding:6px;border-bottom:1px solid hsl(var(--border))}
.picker-input{width:100%;box-sizing:border-box;padding:5px 8px;border:1px solid hsl(var(--input));border-radius:6px;font-size:.8rem;background:hsl(var(--background));color:hsl(var(--foreground));outline:none}
.picker-list{max-height:160px;overflow-y:auto}
.picker-item{padding:7px 10px;font-size:.8rem;cursor:pointer;color:hsl(var(--foreground));transition:background .1s;display:flex;gap:8px;align-items:center}
.picker-item:hover{background:hsl(var(--accent))}
.picker-img-name{font-weight:600;font-size:.78rem}.picker-img-addr{font-size:.72rem;color:hsl(var(--muted-foreground));font-family:monospace}
.picker-empty{padding:12px 10px;font-size:.8rem;color:hsl(var(--muted-foreground));text-align:center}
.script-editor{width:100%;box-sizing:border-box;font-family:monospace;font-size:.8rem;line-height:1.6;padding:10px 12px;border:1px solid hsl(var(--input));border-radius:var(--radius-md);background:#1e293b;color:#e2e8f0;resize:vertical;outline:none}
.restart-row{display:flex;align-items:center;gap:16px;font-size:.83rem}
.checkbox-label{display:flex;align-items:center;gap:6px;cursor:pointer}
.restart-opts{display:flex;align-items:center;gap:6px;font-size:.8rem;color:hsl(var(--muted-foreground))}
.form-actions{padding-top:8px;border-top:1px solid hsl(var(--border));position:sticky;bottom:0;background:hsl(var(--card))}
.btn-primary{width:100%;padding:9px;background:hsl(var(--primary));color:hsl(var(--primary-foreground));border:none;border-radius:var(--radius-md);font-size:.85rem;font-weight:600;cursor:pointer}
.btn-primary:disabled{opacity:.4;cursor:not-allowed}
</style>
