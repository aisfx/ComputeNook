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
    <div v-if="showConfigModal" class="modal-overlay" @click="showConfigModal = false">
      <div class="modal-content config-modal" @click.stop>
        <div class="modal-header">
          <h2>📄 {{ currentTemplate?.name }} - 配置文件</h2>
          <button @click="showConfigModal = false" class="btn-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="config-tabs">
            <button 
              v-for="file in configFiles" 
              :key="file.name"
              :class="['config-tab', { active: currentConfigFile === file.name }]"
              @click="currentConfigFile = file.name"
            >
              {{ file.name }}
            </button>
          </div>
          <pre class="config-content">{{ currentConfigContent }}</pre>
          <div class="config-actions">
            <button class="btn-primary" @click="downloadConfig">💾 下载配置</button>
            <button class="btn-secondary" @click="copyConfig">📋 复制</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const emit = defineEmits(['use-template'])

const showCreateModal = ref(false)
const showConfigModal = ref(false)
const selectedCategory = ref('all')
const currentTemplate = ref<any>(null)
const currentConfigFile = ref('submit.sh')

const categories = [
  { id: 'all', name: '全部', icon: '📚' },
  { id: 'cfd', name: 'CFD', icon: '🌊' },
  { id: 'chemistry', name: '化学', icon: '⚗️' },
  { id: 'md', name: '分子动力学', icon: '🔬' },
  { id: 'ai', name: 'AI/ML', icon: '🤖' },
  { id: 'general', name: '通用', icon: '💻' }
]

const templates = ref([
  {
    id: 1,
    name: 'Fluent 流体仿真',
    icon: '🌊',
    category: 'cfd',
    appType: 'Fluent',
    description: 'ANSYS Fluent 流体动力学仿真标准配置',
    nodes: 2,
    cpus: 48,
    gpus: 0,
    memory: 128,
    time: 24,
    partition: 'compute',
    appParams: {
      '版本': 'v2023R1',
      '求解器': 'pressure-based',
      '并行方式': 'MPI',
      '精度': 'double'
    },
    moduleLoad: 'ansys/2023R1',
    executable: 'fluent',
    inputFile: 'case.cas',
    configTemplate: 'fluent'
  },
  {
    id: 2,
    name: 'Gaussian 量子化学',
    icon: '⚗️',
    category: 'chemistry',
    appType: 'Gaussian',
    description: 'Gaussian 量子化学计算标准配置',
    nodes: 1,
    cpus: 32,
    gpus: 0,
    memory: 64,
    time: 48,
    partition: 'compute',
    appParams: {
      '版本': 'G16',
      '计算方法': 'DFT/B3LYP',
      '基组': '6-31G(d)',
      '内存': '32GB'
    },
    moduleLoad: 'gaussian/g16',
    executable: 'g16',
    inputFile: 'input.gjf',
    configTemplate: 'gaussian'
  },
  {
    id: 3,
    name: 'LAMMPS 分子动力学',
    icon: '🔬',
    category: 'md',
    appType: 'LAMMPS',
    description: 'LAMMPS 大规模原子/分子并行模拟',
    nodes: 4,
    cpus: 128,
    gpus: 0,
    memory: 256,
    time: 72,
    partition: 'compute',
    appParams: {
      '版本': '2023.08.02',
      '力场': 'ReaxFF',
      '时间步长': '0.5 fs',
      '总步数': '1000000'
    },
    moduleLoad: 'lammps/2023',
    executable: 'lmp_mpi',
    inputFile: 'in.lammps',
    configTemplate: 'lammps'
  },
  {
    id: 4,
    name: 'PyTorch 深度学习',
    icon: '🤖',
    category: 'ai',
    appType: 'PyTorch',
    description: 'PyTorch 深度学习训练标准配置',
    nodes: 1,
    cpus: 16,
    gpus: 4,
    memory: 64,
    time: 48,
    partition: 'gpu',
    appParams: {
      '版本': '2.1.0',
      'CUDA': '11.8',
      'Python': '3.10',
      '批次大小': '32'
    },
    moduleLoad: 'pytorch/2.1.0-cuda11.8',
    executable: 'python',
    inputFile: 'train.py',
    configTemplate: 'pytorch'
  },
  {
    id: 5,
    name: 'OpenFOAM CFD',
    icon: '🌊',
    category: 'cfd',
    appType: 'OpenFOAM',
    description: 'OpenFOAM 开源 CFD 工具包',
    nodes: 4,
    cpus: 96,
    gpus: 0,
    memory: 192,
    time: 36,
    partition: 'compute',
    appParams: {
      '版本': 'v2306',
      '求解器': 'simpleFoam',
      '湍流模型': 'k-epsilon',
      '网格数': '5M cells'
    },
    moduleLoad: 'openfoam/v2306',
    executable: 'simpleFoam',
    inputFile: 'system/controlDict',
    configTemplate: 'openfoam'
  },
  {
    id: 6,
    name: 'VASP 第一性原理',
    icon: '⚗️',
    category: 'chemistry',
    appType: 'VASP',
    description: 'VASP 第一性原理计算',
    nodes: 2,
    cpus: 64,
    gpus: 0,
    memory: 128,
    time: 96,
    partition: 'compute',
    appParams: {
      '版本': '6.4.1',
      '泛函': 'PBE',
      '截断能': '500 eV',
      'K点': '5x5x5'
    },
    moduleLoad: 'vasp/6.4.1',
    executable: 'vasp_std',
    inputFile: 'INCAR',
    configTemplate: 'vasp'
  }
])

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
  alert(`编辑模板: ${template.name}`)
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
.templates-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.template-card {
  background: #f9fafb;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.5rem;
  transition: all 0.3s;
}

.template-card:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
}

.template-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.template-header h4 {
  font-size: 1.1rem;
  color: #333;
}

.template-type {
  padding: 0.25rem 0.75rem;
  background: #667eea;
  color: white;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.template-desc {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.template-specs {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  font-size: 0.85rem;
  color: #666;
}

.template-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
</style>

<style scoped>
.app-categories {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.category-btn {
  padding: 0.625rem 1.25rem;
  border: 2px solid #e5e7eb;
  background: white;
  color: #666;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.category-btn:hover {
  border-color: #667eea;
  color: #667eea;
}

.category-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: transparent;
}

.template-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.app-icon {
  font-size: 1.5rem;
}

.template-type {
  font-size: 0.75rem;
}

.type-cfd {
  background: #3b82f6;
}

.type-chemistry {
  background: #8b5cf6;
}

.type-md {
  background: #10b981;
}

.type-ai {
  background: #f59e0b;
}

.type-general {
  background: #6b7280;
}

.template-params {
  background: #f9fafb;
  padding: 0.75rem;
  border-radius: 6px;
  margin: 1rem 0;
  font-size: 0.85rem;
}

.param-item {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.param-key {
  color: #666;
  font-weight: 600;
}

.param-value {
  color: #333;
}

.config-modal {
  max-width: 900px;
  max-height: 85vh;
}

.config-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  border-bottom: 2px solid #e5e7eb;
}

.config-tab {
  padding: 0.75rem 1.5rem;
  border: none;
  background: transparent;
  color: #666;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  transition: all 0.3s;
}

.config-tab:hover {
  color: #667eea;
}

.config-tab.active {
  color: #667eea;
  border-bottom-color: #667eea;
}

.config-content {
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

.config-actions {
  display: flex;
  gap: 1rem;
}
</style>
