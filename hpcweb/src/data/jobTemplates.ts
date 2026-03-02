// 作业模板数据 - 在JobSubmit和JobTemplates组件之间共享

export interface JobTemplate {
  id: number
  name: string
  icon?: string
  category?: string
  appType?: string
  description?: string
  partition?: string  // 改为可选，允许不预设分区
  qos?: string
  nodes: number
  cpus: number
  memory: number
  gpus: number
  time: number
  priority?: string
  workdir?: string
  script?: string
  output?: string
  error?: string
  extraParams?: string
  appParams?: Record<string, string>
  moduleLoad?: string
  executable?: string
  inputFile?: string
  configTemplate?: string
}

// 简单模板 - 用于快速开始
export const simpleTemplates: JobTemplate[] = [
  { 
    id: 101, 
    name: 'GPU 训练模板', 
    icon: '🎮',
    category: 'ai',
    appType: 'GPU',
    description: 'GPU深度学习训练标准配置',
    // partition: 'slurm-bridge',  // 不预设分区，让用户选择
    qos: '',
    nodes: 1,
    cpus: 8,
    memory: 32,
    gpus: 4,
    time: 24,
    priority: 'normal',
    workdir: '/home/user/jobs/gpu_training',
    script: '/home/user/scripts/train.sh',
    output: 'train_output_%j.log',
    error: 'train_error_%j.log',
    extraParams: '--gres=gpu:4'
  },
  { 
    id: 102, 
    name: 'CPU 计算模板',
    icon: '💻',
    category: 'general',
    appType: 'CPU',
    description: 'CPU密集型计算标准配置',
    // partition: 'slurm-bridge',  // 不预设分区，让用户选择
    qos: '',
    nodes: 4,
    cpus: 32,
    memory: 64,
    gpus: 0,
    time: 12,
    priority: 'normal',
    workdir: '/home/user/jobs/compute',
    script: '/home/user/scripts/compute.sh',
    output: 'compute_output_%j.log',
    error: 'compute_error_%j.log',
    extraParams: ''
  },
  { 
    id: 103, 
    name: '数据分析模板',
    icon: '📊',
    category: 'general',
    appType: 'Analysis',
    description: '大数据分析标准配置',
    // partition: 'slurm-bridge',  // 不预设分区，让用户选择
    qos: '',
    nodes: 2,
    cpus: 16,
    memory: 128,
    gpus: 0,
    time: 6,
    priority: 'normal',
    workdir: '/home/user/jobs/analysis',
    script: '/home/user/scripts/analyze.sh',
    output: 'analysis_output_%j.log',
    error: 'analysis_error_%j.log',
    extraParams: '--mem-per-cpu=8G'
  },
  { 
    id: 104, 
    name: '快速调试模板',
    icon: '🐛',
    category: 'general',
    appType: 'Debug',
    description: '快速测试和调试配置',
    // partition: 'slurm-bridge',  // 不预设分区，让用户选择
    qos: '',
    nodes: 1,
    cpus: 4,
    memory: 8,
    gpus: 0,
    time: 1,
    priority: 'high',
    workdir: '/home/user/jobs/debug',
    script: '/home/user/scripts/debug.sh',
    output: 'debug_output_%j.log',
    error: 'debug_error_%j.log',
    extraParams: ''
  }
]

// 专业应用模板
export const professionalTemplates: JobTemplate[] = [
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
    // partition: 'slurm-bridge',  // 不预设分区，让用户选择
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
    // partition: 'slurm-bridge',  // 不预设分区，让用户选择
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
    // partition: 'slurm-bridge',  // 不预设分区，让用户选择
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
    // partition: 'slurm-bridge',  // 不预设分区，让用户选择
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
    // partition: 'slurm-bridge',  // 不预设分区，让用户选择
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
    // partition: 'slurm-bridge',  // 不预设分区，让用户选择
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
]

// 所有模板
export const allTemplates: JobTemplate[] = [
  ...simpleTemplates,
  ...professionalTemplates
]

// 模板分类
export const templateCategories = [
  { id: 'all', name: '全部', icon: '📚' },
  { id: 'cfd', name: 'CFD', icon: '🌊' },
  { id: 'chemistry', name: '化学', icon: '⚗️' },
  { id: 'md', name: '分子动力学', icon: '🔬' },
  { id: 'ai', name: 'AI/ML', icon: '🤖' },
  { id: 'general', name: '通用', icon: '💻' }
]
