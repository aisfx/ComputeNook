<template>
  <div class="card">
    <div class="templates-header">
      <h3>📄 作业模板库</h3>
      <button class="btn-primary" @click="showCreateModal = true">+ 新建模板</button>
    </div>

    <!-- 应用分类 -->
    <div class="app-categories">
      <button 
        v-for="category in categories" 
        :key="category.id"
        :class="['category-btn', { active: selectedCategory === category.id }]"
        @click="selectedCategory = category.id"
      >
        {{ category.icon }} {{ category.name }}
      </button>
    </div>

    <div class="templates-grid">
      <div v-for="template in filteredTemplates" :key="template.id" class="template-card">
        <div class="template-header">
          <div class="template-title">
            <span class="app-icon">{{ template.icon }}</span>
            <h4>{{ template.name }}</h4>
          </div>
          <span :class="['template-type', `type-${template.category}`]">{{ template.appType }}</span>
        </div>
        <p class="template-desc">{{ template.description }}</p>
        <div class="template-specs">
          <span>📦 节点: {{ template.nodes }}</span>
          <span>⚡ CPU: {{ template.cpus }}</span>
          <span v-if="template.gpus">🎮 GPU: {{ template.gpus }}</span>
          <span>⏱️ 时间: {{ template.time }}h</span>
        </div>
        <div class="template-params">
          <div class="param-item" v-for="(value, key) in template.appParams" :key="key">
            <span class="param-key">{{ key }}:</span>
            <span class="param-value">{{ value }}</span>
          </div>
        </div>
        <div class="template-actions">
          <button class="btn-secondary" @click="useTemplate(template)">
            🚀 使用模板
          </button>
          <button class="btn-link" @click="viewConfig(template)">
            📄 查看配置
          </button>
          <button class="btn-link" @click="editTemplate(template)">
            ✏️ 编辑
          </button>
          <button class="btn-link danger" @click="deleteTemplate(template.id)">
            🗑️ 删除
          </button>
        </div>
      </div>
    </div>

    <!-- 配置文件预览弹窗 -->
    <Teleport to="body">

      <!-- 新建模板弹窗 -->
      <div v-if="showCreateModal" class="job-templates-modal-overlay" @click="showCreateModal = false">
        <div class="job-templates-modal-content" style="max-width:640px" @click.stop>
          <div class="job-templates-modal-header">
            <h2>+ 新建模板</h2>
            <button @click="showCreateModal = false" class="job-templates-btn-close">✕</button>
          </div>
          <div class="job-templates-modal-body">
            <div class="edit-form">
              <div class="edit-row">
                <div class="edit-field">
                  <label>模板名称 *</label>
                  <input v-model="createForm.name" type="text" placeholder="例：My LAMMPS 模板" />
                </div>
                <div class="edit-field">
                  <label>应用类型 *</label>
                  <input v-model="createForm.appType" type="text" placeholder="例：LAMMPS" />
                </div>
              </div>
              <div class="edit-row">
                <div class="edit-field">
                  <label>图标（emoji）</label>
                  <input v-model="createForm.icon" type="text" placeholder="🔬" maxlength="4" />
                </div>
                <div class="edit-field">
                  <label>分类</label>
                  <select v-model="createForm.category" class="edit-select">
                    <option value="cfd">CFD</option>
                    <option value="chemistry">化学</option>
                    <option value="md">分子动力学</option>
                    <option value="ai">AI/ML</option>
                    <option value="general">通用</option>
                  </select>
                </div>
              </div>
              <div class="edit-field">
                <label>描述</label>
                <input v-model="createForm.description" type="text" placeholder="简短描述此模板用途" />
              </div>
              <div class="edit-row">
                <div class="edit-field">
                  <label>分区</label>
                  <input v-model="createForm.partition" type="text" placeholder="compute" />
                </div>
                <div class="edit-field">
                  <label>节点数</label>
                  <input v-model.number="createForm.nodes" type="number" min="1" />
                </div>
              </div>
              <div class="edit-row">
                <div class="edit-field">
                  <label>CPU 核心数</label>
                  <input v-model.number="createForm.cpus" type="number" min="1" />
                </div>
                <div class="edit-field">
                  <label>内存 (GB)</label>
                  <input v-model.number="createForm.memory" type="number" min="1" />
                </div>
                <div class="edit-field">
                  <label>GPU 卡数</label>
                  <input v-model.number="createForm.gpus" type="number" min="0" />
                </div>
                <div class="edit-field">
                  <label>时间 (小时)</label>
                  <input v-model.number="createForm.time" type="number" min="1" />
                </div>
              </div>
              <div class="edit-row">
                <div class="edit-field">
                  <label>可执行文件</label>
                  <input v-model="createForm.executable" type="text" placeholder="例：lmp_mpi" />
                </div>
                <div class="edit-field">
                  <label>输入文件名</label>
                  <input v-model="createForm.inputFile" type="text" placeholder="例：in.lammps" />
                </div>
              </div>
              <div class="edit-field">
                <label>模块加载（module load）</label>
                <input v-model="createForm.moduleLoad" type="text" placeholder="例：lammps/2023" />
              </div>
            </div>
            <div class="job-templates-config-actions" style="margin-top:1.5rem">
              <button class="job-templates-btn-primary" @click="saveCreate">💾 创建</button>
              <button class="job-templates-btn-secondary" @click="showCreateModal = false">取消</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 编辑模板弹窗 -->
      <div v-if="showEditModal" class="job-templates-modal-overlay" @click="showEditModal = false">
        <div class="job-templates-modal-content" style="max-width:600px" @click.stop>
          <div class="job-templates-modal-header">
            <h2>✏️ 编辑模板</h2>
            <button @click="showEditModal = false" class="job-templates-btn-close">✕</button>
          </div>
          <div class="job-templates-modal-body">
            <div class="edit-form">
              <div class="edit-row">
                <div class="edit-field">
                  <label>模板名称</label>
                  <input v-model="editForm.name" type="text" />
                </div>
                <div class="edit-field">
                  <label>应用类型</label>
                  <input v-model="editForm.appType" type="text" />
                </div>
              </div>
              <div class="edit-field">
                <label>描述</label>
                <input v-model="editForm.description" type="text" />
              </div>
              <div class="edit-row">
                <div class="edit-field">
                  <label>分区</label>
                  <input v-model="editForm.partition" type="text" />
                </div>
                <div class="edit-field">
                  <label>节点数</label>
                  <input v-model.number="editForm.nodes" type="number" min="1" />
                </div>
              </div>
              <div class="edit-row">
                <div class="edit-field">
                  <label>CPU 核心数</label>
                  <input v-model.number="editForm.cpus" type="number" min="1" />
                </div>
                <div class="edit-field">
                  <label>内存 (GB)</label>
                  <input v-model.number="editForm.memory" type="number" min="0" />
                </div>
                <div class="edit-field">
                  <label>GPU 卡数</label>
                  <input v-model.number="editForm.gpus" type="number" min="0" />
                </div>
                <div class="edit-field">
                  <label>时间 (小时)</label>
                  <input v-model.number="editForm.time" type="number" min="0" />
                </div>
              </div>
            </div>
            <div class="job-templates-config-actions" style="margin-top:1.5rem">
              <button class="job-templates-btn-primary" @click="saveEdit">💾 保存</button>
              <button class="job-templates-btn-secondary" @click="showEditModal = false">取消</button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="showConfigModal" class="job-templates-modal-overlay" @click="showConfigModal = false">
        <div class="job-templates-modal-content" @click.stop>
          <div class="job-templates-modal-header">
            <h2>📄 {{ currentTemplate?.name }} - 配置文件</h2>
            <button @click="showConfigModal = false" class="job-templates-btn-close">✕</button>
          </div>
          <div class="job-templates-modal-body">
            <div class="job-templates-config-tabs">
              <button 
                v-for="file in configFiles" 
                :key="file.name"
                :class="['job-templates-config-tab', { active: currentConfigFile === file.name }]"
                @click="currentConfigFile = file.name"
              >
                {{ file.name }}
              </button>
            </div>
            <pre class="job-templates-config-content">{{ currentConfigContent }}</pre>
            <div class="job-templates-config-actions">
              <button class="job-templates-btn-primary" @click="downloadConfig">💾 下载配置</button>
              <button class="job-templates-btn-secondary" @click="copyConfig">📋 复制</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { jobTemplates } from '../data/jobTemplates'

const emit = defineEmits(['use-template'])

const showCreateModal = ref(false)
const showConfigModal = ref(false)
const showEditModal = ref(false)
const editForm = ref<any>({})
const selectedCategory = ref('all')
const currentTemplate = ref<any>(null)
const currentConfigFile = ref('submit.sh')

const defaultCreateForm = () => ({
  name: '',
  icon: '💻',
  category: 'general',
  appType: '',
  description: '',
  nodes: 1,
  cpus: 8,
  gpus: 0,
  memory: 32,
  time: 24,
  partition: 'compute',
  executable: '',
  inputFile: '',
  moduleLoad: '',
  appParams: {},
  configTemplate: 'default'
})

const createForm = ref(defaultCreateForm())

const categories = [
  { id: 'all', name: '全部', icon: '📚' },
  { id: 'cfd', name: 'CFD', icon: '🌊' },
  { id: 'chemistry', name: '化学', icon: '⚗️' },
  { id: 'md', name: '分子动力学', icon: '🔬' },
  { id: 'ai', name: 'AI/ML', icon: '🤖' },
  { id: 'general', name: '通用', icon: '💻' }
]

const templates = ref(jobTemplates)

const filteredTemplates = computed(() => {
  if (selectedCategory.value === 'all') {
    return templates.value
  }
  return templates.value.filter(t => t.category === selectedCategory.value)
})

const configFiles = computed(() => {
  if (!currentTemplate.value) return []
  
  return [
    { name: 'submit.sh', type: 'slurm' },
    { name: currentTemplate.value.inputFile, type: 'input' }
  ]
})

const currentConfigContent = computed(() => {
  if (!currentTemplate.value) return ''
  
  if (currentConfigFile.value === 'submit.sh') {
    return generateSlurmScript(currentTemplate.value)
  } else {
    return generateInputFile(currentTemplate.value)
  }
})

const generateSlurmScript = (template: any) => {
  return `#!/bin/bash
#SBATCH --job-name=${template.appType}_job
#SBATCH --partition=${template.partition}
#SBATCH --nodes=${template.nodes}
#SBATCH --ntasks-per-node=${Math.floor(template.cpus / template.nodes)}
#SBATCH --time=${template.time}:00:00
#SBATCH --mem=${template.memory}G
${template.gpus ? `#SBATCH --gres=gpu:${template.gpus}` : ''}
#SBATCH --output=%j.out
#SBATCH --error=%j.err

# 加载模块
module purge
module load ${template.moduleLoad}

# 设置环境变量
export OMP_NUM_THREADS=1
${template.gpus ? 'export CUDA_VISIBLE_DEVICES=0,1,2,3' : ''}

# 作业信息
echo "作业开始时间: $(date)"
echo "运行节点: $SLURM_NODELIST"
echo "作业 ID: $SLURM_JOB_ID"

# 运行程序
${generateRunCommand(template)}

# 作业结束
echo "作业结束时间: $(date)"
`
}

const generateRunCommand = (template: any) => {
  switch (template.configTemplate) {
    case 'fluent':
      return `fluent 3ddp -g -t${template.cpus} -i ${template.inputFile} > fluent.log`
    case 'gaussian':
      return `${template.executable} < ${template.inputFile} > output.log`
    case 'lammps':
      return `mpirun -np ${template.cpus} ${template.executable} -in ${template.inputFile}`
    case 'pytorch':
      return `python ${template.inputFile} --batch-size 32 --epochs 100`
    case 'openfoam':
      return `mpirun -np ${template.cpus} ${template.executable} -parallel > log.${template.executable}`
    case 'vasp':
      return `mpirun -np ${template.cpus} ${template.executable}`
    default:
      return `${template.executable} ${template.inputFile}`
  }
}

const generateInputFile = (template: any) => {
  switch (template.configTemplate) {
    case 'fluent':
      return `; Fluent Journal File
; ${template.name}

/file/read-case ${template.inputFile}
/solve/initialize/initialize-flow
/solve/iterate 1000
/file/write-data result.dat
exit
yes`
    case 'gaussian':
      return `%chk=checkpoint.chk
%mem=${template.appParams['内存']}
%nprocshared=${template.cpus}
# ${template.appParams['计算方法']}/${template.appParams['基组']} Opt Freq

Title: Gaussian Calculation

0 1
C   0.000000   0.000000   0.000000
H   0.000000   0.000000   1.089000
H   1.026719   0.000000  -0.363000
H  -0.513360  -0.889165  -0.363000
H  -0.513360   0.889165  -0.363000

`
    case 'lammps':
      return `# LAMMPS Input Script
# ${template.name}

units           real
atom_style      full
boundary        p p p

read_data       data.lammps

pair_style      reaxff NULL
pair_coeff      * * ffield.reax C H O

timestep        ${template.appParams['时间步长']}
run             ${template.appParams['总步数']}

write_data      final.data
`
    case 'pytorch':
      return `# PyTorch Training Script
# ${template.name}

import torch
import torch.nn as nn
from torch.utils.data import DataLoader

# 设置设备
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f'Using device: {device}')

# 模型定义
class Model(nn.Module):
    def __init__(self):
        super(Model, self).__init__()
        # 定义网络层
        
    def forward(self, x):
        # 前向传播
        return x

# 训练循环
model = Model().to(device)
# 训练代码...
`
    case 'openfoam':
      return `/*--------------------------------*- C++ -*----------------------------------*\\
| =========                 |                                                 |
| \\\\      /  F ield         | OpenFOAM: The Open Source CFD Toolbox           |
|  \\\\    /   O peration     | Version:  ${template.appParams['版本']}                                 |
|   \\\\  /    A nd           | Web:      www.OpenFOAM.org                      |
|    \\\\/     M anipulation  |                                                 |
\\*---------------------------------------------------------------------------*/
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    object      controlDict;
}
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

application     ${template.executable};

startFrom       startTime;

startTime       0;

stopAt          endTime;

endTime         1000;

deltaT          1;

writeControl    timeStep;

writeInterval   100;
`
    case 'vasp':
      return `SYSTEM = ${template.name}

# Electronic optimization
ENCUT = ${template.appParams['截断能']}
PREC = Accurate
EDIFF = 1E-5

# Ionic relaxation
NSW = 100
IBRION = 2
ISIF = 3
EDIFFG = -0.01

# DOS
ISMEAR = 0
SIGMA = 0.05

# Parallel
NCORE = 4
`
    default:
      return `# Configuration file for ${template.name}
# Please customize according to your needs
`
  }
}

const useTemplate = (template: any) => {
  emit('use-template', template)
  alert(`已选择模板: ${template.name}\n请前往"提交作业"页面查看`)
}

const viewConfig = (template: any) => {
  currentTemplate.value = template
  currentConfigFile.value = 'submit.sh'
  showConfigModal.value = true
}

const editTemplate = (template: any) => {
  editForm.value = { ...template }
  showEditModal.value = true
}

const saveEdit = () => {
  const index = templates.value.findIndex(t => t.id === editForm.value.id)
  if (index > -1) {
    templates.value[index] = { ...templates.value[index], ...editForm.value }
  }
  showEditModal.value = false
}

const saveCreate = () => {
  if (!createForm.value.name.trim() || !createForm.value.appType.trim()) {
    alert('请填写模板名称和应用类型')
    return
  }
  const newId = templates.value.length > 0 ? Math.max(...templates.value.map(t => t.id)) + 1 : 1
  templates.value.push({ ...createForm.value, id: newId } as any)
  createForm.value = defaultCreateForm()
  showCreateModal.value = false
}

const deleteTemplate = (id: number) => {
  if (confirm('确定要删除此模板吗？')) {
    const index = templates.value.findIndex(t => t.id === id)
    if (index > -1) {
      templates.value.splice(index, 1)
      alert('模板已删除')
    }
  }
}

const downloadConfig = () => {
  const content = currentConfigContent.value
  const filename = currentConfigFile.value
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const copyConfig = () => {
  navigator.clipboard.writeText(currentConfigContent.value)
  alert('配置已复制到剪贴板')
}
</script>

<style scoped>
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 6px 14px;
  background: #fff;
  color: #1e293b;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: all 0.15s;
  white-space: nowrap;
}
.btn-primary:hover { background: #f1f5f9; }

.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 6px 14px;
  background: #fff;
  color: #1e293b;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: all 0.15s;
  white-space: nowrap;
}
.btn-secondary:hover { background: #f1f5f9; }

.btn-link {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 4px 10px;
  background: #fff;
  color: #1e293b;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.78rem;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  transition: all 0.15s;
  white-space: nowrap;
}
.btn-link:hover { background: #f1f5f9; }
.btn-link.danger { color: #ef4444; border-color: rgba(239,68,68,0.25); }
.btn-link.danger:hover { background: #fef2f2; }

.templates-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.templates-header h3 { margin: 0; font-size: 0.95rem; font-weight: 600; }

.app-categories {
  display: flex;
  gap: 6px;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.category-btn {
  padding: 4px 12px;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--background));
  color: hsl(var(--muted-foreground));
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.category-btn:hover { border-color: hsl(var(--foreground) / 0.3); color: hsl(var(--foreground)); }
.category-btn.active {
  background: hsl(var(--foreground));
  color: hsl(var(--background));
  border-color: hsl(var(--foreground));
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
}

.template-card {
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  padding: 14px;
  transition: all 0.15s;
}
.template-card:hover {
  border-color: hsl(var(--foreground) / 0.2);
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.template-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.template-title {
  display: flex;
  align-items: center;
  gap: 6px;
}
.app-icon { font-size: 1.2rem; }
.template-header h4 { margin: 0; font-size: 0.88rem; font-weight: 600; color: hsl(var(--foreground)); }

.template-type {
  padding: 2px 8px;
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 500;
}

.template-desc {
  color: hsl(var(--muted-foreground));
  font-size: 0.78rem;
  margin-bottom: 8px;
  line-height: 1.4;
}

.template-specs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.template-params {
  background: hsl(var(--muted) / 0.5);
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  margin-bottom: 10px;
  font-size: 0.75rem;
}
.param-item { display: flex; gap: 6px; margin-bottom: 2px; }
.param-key { color: hsl(var(--muted-foreground)); font-weight: 500; }
.param-value { color: hsl(var(--foreground)); }

.template-actions {
  display: flex;
  gap: 5px;
  align-items: center;
  flex-wrap: wrap;
}
</style>

<!-- 弹窗样式非 scoped，因为使用了 Teleport 挂载到 body -->
<style>
.job-templates-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1.5rem;
}

.job-templates-modal-content {
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 900px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.job-templates-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.job-templates-modal-header h2 {
  margin: 0;
  font-size: 1.1rem;
  color: #1a1a2e;
}

.job-templates-btn-close {
  background: none;
  border: none;
  font-size: 1.2rem;
  color: #9ca3af;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
}

.job-templates-btn-close:hover {
  background: #f3f4f6;
  color: #374151;
}

.job-templates-modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.job-templates-config-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  border-bottom: 2px solid #e5e7eb;
}

.job-templates-config-tab {
  padding: 0.75rem 1.5rem;
  border: none;
  background: transparent;
  color: #666;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  transition: all 0.3s;
}

.job-templates-config-tab:hover { color: #374151; }
.job-templates-config-tab.active { color: #1e293b; border-bottom-color: #1e293b; font-weight: 600; }

.job-templates-config-content {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 1.5rem;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.6;
  overflow-x: auto;
  max-height: 500px;
  overflow-y: auto;
  margin-bottom: 1rem;
}

.job-templates-config-actions {
  display: flex;
  gap: 1rem;
}

.job-templates-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 7px 16px;
  background: #fff;
  color: #1e293b;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: all 0.15s;
}
.job-templates-btn-primary:hover { background: #f1f5f9; }

.job-templates-btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 7px 16px;
  background: #fff;
  color: #1e293b;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: all 0.15s;
}
.job-templates-btn-secondary:hover { background: #f1f5f9; }

.edit-form { display: flex; flex-direction: column; gap: 1rem; }

.edit-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.75rem;
}

.edit-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.edit-field label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #374151;
}

.edit-field input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem 0.75rem;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.2s;
}

.edit-field input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102,126,234,0.12);
}

.edit-select {
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem 0.75rem;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.875rem;
  outline: none;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s;
}

.edit-select:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102,126,234,0.12);
}
</style>