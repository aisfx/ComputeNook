/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted } from 'vue';
import { getApiBase } from '../utils/auth';
import { dialog } from '../utils/dialog';
const emit = defineEmits(['use-template']);
const token = () => localStorage.getItem('token') || sessionStorage.getItem('token');
// 当前用户信息
const currentUser = ref({ username: '', isAdmin: false });
const loadCurrentUser = () => {
    try {
        const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
        if (raw)
            Object.assign(currentUser.value, JSON.parse(raw));
    }
    catch { /* ignore */ }
};
// 是否可以编辑/删除：自己的模板 或 管理员
const canEdit = (template) => currentUser.value.isAdmin || template.owner === currentUser.value.username;
const scriptTypeOptions = {
    general: [
        { key: 'basic', label: '基础' },
        { key: 'mpi', label: 'MPI' },
        { key: 'gpu', label: 'GPU' },
        { key: 'python', label: 'Python' },
        { key: 'array', label: '数组作业' },
    ],
    ai: [
        { key: 'pytorch', label: '🔥 PyTorch' },
        { key: 'deepspeed', label: '⚡ DeepSpeed' },
        { key: 'vllm', label: '🚀 vLLM' },
        { key: 'triton', label: '🎯 Triton' },
    ]
};
const scriptTemplates = {
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

echo "Array Job \$SLURM_ARRAY_TASK_ID started: $(date)"
INPUT_FILE="input_\${SLURM_ARRAY_TASK_ID}.dat"
./process \$INPUT_FILE

echo "Task \$SLURM_ARRAY_TASK_ID finished: $(date)"`,
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
};
const applyCreateScriptType = (key) => {
    createForm.value.scriptType = key;
    createForm.value.scriptContent = scriptTemplates[key] || '';
};
const showCreateModal = ref(false);
const showConfigModal = ref(false);
const showEditModal = ref(false);
const editForm = ref({});
const selectedCategory = ref('all');
const selectedJobType = ref('normal');
const currentTemplate = ref(null);
const currentConfigFile = ref('submit.sh');
const defaultCreateForm = () => ({
    name: '',
    icon: '💻',
    category: 'general',
    appType: '',
    jobType: 'normal',
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
    containerImage: '',
    appParams: {},
    configTemplate: 'default',
    scriptType: 'basic',
    scriptContent: scriptTemplates.basic,
    showInQuick: false,
});
const createForm = ref(defaultCreateForm());
const categories = [
    { id: 'all', name: '全部', icon: '📚' },
    { id: 'cfd', name: 'CFD', icon: '🌊' },
    { id: 'chemistry', name: '化学', icon: '⚗️' },
    { id: 'md', name: '分子动力学', icon: '🔬' },
    { id: 'ai', name: 'AI 训练', icon: '🤖' },
    { id: 'ai-inference', name: 'AI 推理', icon: '🧠' },
    { id: 'general', name: '通用', icon: '💻' }
];
const templates = ref([]);
const loadTemplatesFromAPI = async () => {
    try {
        const res = await fetch(`${getApiBase()}/api/app-templates`, {
            headers: { Authorization: `Bearer ${token()}` }
        });
        if (!res.ok)
            return;
        const data = await res.json();
        templates.value = data.data || [];
    }
    catch { /* ignore */ }
};
onMounted(() => {
    loadCurrentUser();
    loadTemplatesFromAPI();
});
const filteredTemplates = computed(() => {
    let list = templates.value.filter(t => (t.jobType || 'normal') === selectedJobType.value);
    if (selectedCategory.value !== 'all') {
        list = list.filter(t => t.category === selectedCategory.value);
    }
    return list;
});
const configFiles = computed(() => {
    if (!currentTemplate.value)
        return [];
    return [
        { name: 'submit.sh', type: 'slurm' },
        { name: currentTemplate.value.inputFile, type: 'input' }
    ];
});
const currentConfigContent = computed(() => {
    if (!currentTemplate.value)
        return '';
    if (currentConfigFile.value === 'submit.sh') {
        return generateSlurmScript(currentTemplate.value);
    }
    else {
        return generateInputFile(currentTemplate.value);
    }
});
const generateSlurmScript = (template) => {
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
`;
};
const generateRunCommand = (template) => {
    switch (template.configTemplate) {
        case 'fluent':
            return `fluent 3ddp -g -t${template.cpus} -i ${template.inputFile} > fluent.log`;
        case 'gaussian':
            return `${template.executable} < ${template.inputFile} > output.log`;
        case 'lammps':
            return `mpirun -np ${template.cpus} ${template.executable} -in ${template.inputFile}`;
        case 'pytorch':
            return `python ${template.inputFile} --batch-size 32 --epochs 100`;
        case 'openfoam':
            return `mpirun -np ${template.cpus} ${template.executable} -parallel > log.${template.executable}`;
        case 'vasp':
            return `mpirun -np ${template.cpus} ${template.executable}`;
        default:
            return `${template.executable} ${template.inputFile}`;
    }
};
const generateInputFile = (template) => {
    switch (template.configTemplate) {
        case 'fluent':
            return `; Fluent Journal File
; ${template.name}

/file/read-case ${template.inputFile}
/solve/initialize/initialize-flow
/solve/iterate 1000
/file/write-data result.dat
exit
yes`;
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

`;
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
`;
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
`;
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
`;
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
`;
        default:
            return `# Configuration file for ${template.name}
# Please customize according to your needs
`;
    }
};
const useTemplate = (template) => {
    emit('use-template', template);
    dialog.success(`已选择模板: ${template.name}，请前往"提交作业"页面查看`);
};
const viewConfig = (template) => {
    currentTemplate.value = template;
    currentConfigFile.value = 'submit.sh';
    showConfigModal.value = true;
};
const editTemplate = (template) => {
    editForm.value = { ...template };
    showEditModal.value = true;
};
const saveEdit = async () => {
    try {
        const res = await fetch(`${getApiBase()}/api/app-templates/${editForm.value.id}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(editForm.value)
        });
        if (!res.ok)
            throw new Error('保存失败');
        await loadTemplatesFromAPI();
        showEditModal.value = false;
    }
    catch (e) {
        dialog.error(e.message);
    }
};
const saveCreate = async () => {
    if (!createForm.value.name.trim() || !createForm.value.appType.trim()) {
        dialog.warning('请填写模板名称和应用类型');
        return;
    }
    try {
        const res = await fetch(`${getApiBase()}/api/app-templates`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(createForm.value)
        });
        if (!res.ok)
            throw new Error('创建失败');
        await loadTemplatesFromAPI();
        createForm.value = defaultCreateForm();
        showCreateModal.value = false;
    }
    catch (e) {
        dialog.error(e.message);
    }
};
const deleteTemplate = async (id) => {
    if (!await dialog.confirm('确定要删除此模板吗？', { title: '删除模板', danger: true }))
        return;
    try {
        const res = await fetch(`${getApiBase()}/api/app-templates/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token()}` }
        });
        if (!res.ok)
            throw new Error('删除失败');
        await loadTemplatesFromAPI();
    }
    catch (e) {
        dialog.error(e.message);
    }
};
const togglePublic = async (template) => {
    const updated = { ...template, isPublic: !template.isPublic };
    try {
        const res = await fetch(`${getApiBase()}/api/app-templates/${template.id}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(updated)
        });
        if (!res.ok)
            throw new Error('操作失败');
        await loadTemplatesFromAPI();
    }
    catch (e) {
        dialog.error(e.message);
    }
};
const downloadConfig = () => {
    const content = currentConfigContent.value;
    const filename = currentConfigFile.value;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};
const copyConfig = () => {
    navigator.clipboard.writeText(currentConfigContent.value);
    dialog.success('配置已复制到剪贴板');
};
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
/** @type {__VLS_StyleScopedClasses['templates-header']} */ ;
/** @type {__VLS_StyleScopedClasses['job-type-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['job-type-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['category-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['category-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['template-card']} */ ;
/** @type {__VLS_StyleScopedClasses['template-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "templates-header" },
});
/** @type {__VLS_StyleScopedClasses['templates-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showCreateModal = true;
            // @ts-ignore
            [showCreateModal,];
        } },
    ...{ class: "btn-primary" },
});
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "job-type-tabs" },
});
/** @type {__VLS_StyleScopedClasses['job-type-tabs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.selectedJobType = 'normal';
            __VLS_ctx.selectedCategory = 'all';
            // @ts-ignore
            [selectedJobType, selectedCategory,];
        } },
    ...{ class: (['job-type-tab', { active: __VLS_ctx.selectedJobType === 'normal' }]) },
});
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['job-type-tab']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.selectedJobType = 'container';
            __VLS_ctx.selectedCategory = 'all';
            // @ts-ignore
            [selectedJobType, selectedJobType, selectedCategory,];
        } },
    ...{ class: (['job-type-tab', { active: __VLS_ctx.selectedJobType === 'container' }]) },
});
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['job-type-tab']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "app-categories" },
});
/** @type {__VLS_StyleScopedClasses['app-categories']} */ ;
for (const [category] of __VLS_vFor((__VLS_ctx.categories))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selectedCategory = category.id;
                // @ts-ignore
                [selectedJobType, selectedCategory, categories,];
            } },
        key: (category.id),
        ...{ class: (['category-btn', { active: __VLS_ctx.selectedCategory === category.id }]) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['category-btn']} */ ;
    (category.icon);
    (category.name);
    // @ts-ignore
    [selectedCategory,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "templates-grid" },
});
/** @type {__VLS_StyleScopedClasses['templates-grid']} */ ;
for (const [template] of __VLS_vFor((__VLS_ctx.filteredTemplates))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (template.id),
        ...{ class: "template-card" },
    });
    /** @type {__VLS_StyleScopedClasses['template-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "template-header" },
    });
    /** @type {__VLS_StyleScopedClasses['template-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "template-title" },
    });
    /** @type {__VLS_StyleScopedClasses['template-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "app-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['app-icon']} */ ;
    (template.icon);
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    (template.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "template-header-right" },
    });
    /** @type {__VLS_StyleScopedClasses['template-header-right']} */ ;
    if (template.isPublic) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge-public" },
        });
        /** @type {__VLS_StyleScopedClasses['badge-public']} */ ;
    }
    else if (template.owner) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge-owner" },
        });
        /** @type {__VLS_StyleScopedClasses['badge-owner']} */ ;
        (template.owner);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: (['template-type', `type-${template.category}`]) },
    });
    /** @type {__VLS_StyleScopedClasses['template-type']} */ ;
    (template.appType);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "template-desc" },
    });
    /** @type {__VLS_StyleScopedClasses['template-desc']} */ ;
    (template.description);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "template-specs" },
    });
    /** @type {__VLS_StyleScopedClasses['template-specs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (template.nodes);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (template.cpus);
    if (template.gpus) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (template.gpus);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (template.time);
    if (template.jobType === 'container' && template.containerImage) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "template-image" },
        });
        /** @type {__VLS_StyleScopedClasses['template-image']} */ ;
        (template.containerImage);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "template-params" },
    });
    /** @type {__VLS_StyleScopedClasses['template-params']} */ ;
    for (const [value, key] of __VLS_vFor((template.appParams))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "param-item" },
            key: (key),
        });
        /** @type {__VLS_StyleScopedClasses['param-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "param-key" },
        });
        /** @type {__VLS_StyleScopedClasses['param-key']} */ ;
        (key);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "param-value" },
        });
        /** @type {__VLS_StyleScopedClasses['param-value']} */ ;
        (value);
        // @ts-ignore
        [filteredTemplates,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "template-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['template-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.useTemplate(template);
                // @ts-ignore
                [useTemplate,];
            } },
        ...{ class: "btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.viewConfig(template);
                // @ts-ignore
                [viewConfig,];
            } },
        ...{ class: "btn-link" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
    if (__VLS_ctx.canEdit(template)) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.canEdit(template)))
                        return;
                    __VLS_ctx.editTemplate(template);
                    // @ts-ignore
                    [canEdit, editTemplate,];
                } },
            ...{ class: "btn-link" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
        if (__VLS_ctx.currentUser.isAdmin) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.canEdit(template)))
                            return;
                        if (!(__VLS_ctx.currentUser.isAdmin))
                            return;
                        __VLS_ctx.togglePublic(template);
                        // @ts-ignore
                        [currentUser, togglePublic,];
                    } },
                ...{ class: "btn-link" },
            });
            /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
            (template.isPublic ? '🔒 取消公共' : '🌐 设为公共');
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.canEdit(template)))
                        return;
                    __VLS_ctx.deleteTemplate(template.id);
                    // @ts-ignore
                    [deleteTemplate,];
                } },
            ...{ class: "btn-link danger" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
        /** @type {__VLS_StyleScopedClasses['danger']} */ ;
    }
    // @ts-ignore
    [];
}
let __VLS_0;
/** @ts-ignore @type {typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    to: "body",
}));
const __VLS_2 = __VLS_1({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
if (__VLS_ctx.showCreateModal) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCreateModal))
                    return;
                __VLS_ctx.showCreateModal = false;
                // @ts-ignore
                [showCreateModal, showCreateModal,];
            } },
        ...{ class: "job-templates-modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['job-templates-modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "job-templates-modal-content" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['job-templates-modal-content']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "job-templates-modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['job-templates-modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCreateModal))
                    return;
                __VLS_ctx.showCreateModal = false;
                // @ts-ignore
                [showCreateModal,];
            } },
        ...{ class: "job-templates-btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['job-templates-btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "job-templates-modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['job-templates-modal-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-form" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-form']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-row" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        value: (__VLS_ctx.createForm.name),
        type: "text",
        placeholder: "例：My LAMMPS 模板",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        value: (__VLS_ctx.createForm.appType),
        type: "text",
        placeholder: "例：LAMMPS",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-row" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.createForm.jobType),
        ...{ class: "edit-select" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-select']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "normal",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "container",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        value: (__VLS_ctx.createForm.icon),
        type: "text",
        placeholder: "🔬",
        maxlength: "4",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.createForm.category),
        ...{ class: "edit-select" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-select']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "cfd",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "chemistry",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "md",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "ai",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "ai-inference",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "general",
    });
    if (__VLS_ctx.createForm.jobType === 'container') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "edit-field" },
        });
        /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.createForm.containerImage),
            type: "text",
            placeholder: "harbor.example.com/library/pytorch:latest",
        });
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        value: (__VLS_ctx.createForm.description),
        type: "text",
        placeholder: "简短描述此模板用途",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-row" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        value: (__VLS_ctx.createForm.partition),
        type: "text",
        placeholder: "compute",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "1",
    });
    (__VLS_ctx.createForm.nodes);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-row" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "1",
    });
    (__VLS_ctx.createForm.cpus);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "1",
    });
    (__VLS_ctx.createForm.memory);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "0",
    });
    (__VLS_ctx.createForm.gpus);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "1",
    });
    (__VLS_ctx.createForm.time);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-row" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        value: (__VLS_ctx.createForm.executable),
        type: "text",
        placeholder: "例：lmp_mpi",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        value: (__VLS_ctx.createForm.inputFile),
        type: "text",
        placeholder: "例：in.lammps",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        value: (__VLS_ctx.createForm.moduleLoad),
        type: "text",
        placeholder: "例：lammps/2023",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "checkbox-label" },
    });
    /** @type {__VLS_StyleScopedClasses['checkbox-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
    });
    (__VLS_ctx.createForm.showInQuick);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "script-type-btns" },
    });
    /** @type {__VLS_StyleScopedClasses['script-type-btns']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tpl-group-label" },
    });
    /** @type {__VLS_StyleScopedClasses['tpl-group-label']} */ ;
    for (const [t] of __VLS_vFor((__VLS_ctx.scriptTypeOptions.general))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showCreateModal))
                        return;
                    __VLS_ctx.applyCreateScriptType(t.key);
                    // @ts-ignore
                    [createForm, createForm, createForm, createForm, createForm, createForm, createForm, createForm, createForm, createForm, createForm, createForm, createForm, createForm, createForm, createForm, createForm, createForm, scriptTypeOptions, applyCreateScriptType,];
                } },
            key: (t.key),
            type: "button",
            ...{ class: (['btn-script-type', { active: __VLS_ctx.createForm.scriptType === t.key }]) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-script-type']} */ ;
        (t.label);
        // @ts-ignore
        [createForm,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tpl-group-label" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['tpl-group-label']} */ ;
    for (const [t] of __VLS_vFor((__VLS_ctx.scriptTypeOptions.ai))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showCreateModal))
                        return;
                    __VLS_ctx.applyCreateScriptType(t.key);
                    // @ts-ignore
                    [scriptTypeOptions, applyCreateScriptType,];
                } },
            key: (t.key),
            type: "button",
            ...{ class: (['btn-script-type ai', { active: __VLS_ctx.createForm.scriptType === t.key }]) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-script-type']} */ ;
        /** @type {__VLS_StyleScopedClasses['ai']} */ ;
        (t.label);
        // @ts-ignore
        [createForm,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
        value: (__VLS_ctx.createForm.scriptContent),
        rows: "10",
        ...{ class: "script-textarea" },
        placeholder: "#!/bin/bash&#10;#SBATCH -J my_job&#10;...",
    });
    /** @type {__VLS_StyleScopedClasses['script-textarea']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "job-templates-config-actions" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['job-templates-config-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.saveCreate) },
        ...{ class: "job-templates-btn-primary" },
    });
    /** @type {__VLS_StyleScopedClasses['job-templates-btn-primary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCreateModal))
                    return;
                __VLS_ctx.showCreateModal = false;
                // @ts-ignore
                [showCreateModal, createForm, saveCreate,];
            } },
        ...{ class: "job-templates-btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['job-templates-btn-secondary']} */ ;
}
if (__VLS_ctx.showEditModal) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showEditModal))
                    return;
                __VLS_ctx.showEditModal = false;
                // @ts-ignore
                [showEditModal, showEditModal,];
            } },
        ...{ class: "job-templates-modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['job-templates-modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "job-templates-modal-content" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['job-templates-modal-content']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "job-templates-modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['job-templates-modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showEditModal))
                    return;
                __VLS_ctx.showEditModal = false;
                // @ts-ignore
                [showEditModal,];
            } },
        ...{ class: "job-templates-btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['job-templates-btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "job-templates-modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['job-templates-modal-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-form" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-form']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-row" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        value: (__VLS_ctx.editForm.name),
        type: "text",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        value: (__VLS_ctx.editForm.appType),
        type: "text",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        value: (__VLS_ctx.editForm.description),
        type: "text",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-row" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        value: (__VLS_ctx.editForm.partition),
        type: "text",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "1",
    });
    (__VLS_ctx.editForm.nodes);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-row" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "1",
    });
    (__VLS_ctx.editForm.cpus);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "0",
    });
    (__VLS_ctx.editForm.memory);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "0",
    });
    (__VLS_ctx.editForm.gpus);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "0",
    });
    (__VLS_ctx.editForm.time);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "edit-field" },
    });
    /** @type {__VLS_StyleScopedClasses['edit-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "checkbox-label" },
    });
    /** @type {__VLS_StyleScopedClasses['checkbox-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
    });
    (__VLS_ctx.editForm.showInQuick);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "job-templates-config-actions" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['job-templates-config-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.saveEdit) },
        ...{ class: "job-templates-btn-primary" },
    });
    /** @type {__VLS_StyleScopedClasses['job-templates-btn-primary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showEditModal))
                    return;
                __VLS_ctx.showEditModal = false;
                // @ts-ignore
                [showEditModal, editForm, editForm, editForm, editForm, editForm, editForm, editForm, editForm, editForm, editForm, saveEdit,];
            } },
        ...{ class: "job-templates-btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['job-templates-btn-secondary']} */ ;
}
if (__VLS_ctx.showConfigModal) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showConfigModal))
                    return;
                __VLS_ctx.showConfigModal = false;
                // @ts-ignore
                [showConfigModal, showConfigModal,];
            } },
        ...{ class: "job-templates-modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['job-templates-modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "job-templates-modal-content" },
    });
    /** @type {__VLS_StyleScopedClasses['job-templates-modal-content']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "job-templates-modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['job-templates-modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    (__VLS_ctx.currentTemplate?.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showConfigModal))
                    return;
                __VLS_ctx.showConfigModal = false;
                // @ts-ignore
                [showConfigModal, currentTemplate,];
            } },
        ...{ class: "job-templates-btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['job-templates-btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "job-templates-modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['job-templates-modal-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "job-templates-config-tabs" },
    });
    /** @type {__VLS_StyleScopedClasses['job-templates-config-tabs']} */ ;
    for (const [file] of __VLS_vFor((__VLS_ctx.configFiles))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showConfigModal))
                        return;
                    __VLS_ctx.currentConfigFile = file.name;
                    // @ts-ignore
                    [configFiles, currentConfigFile,];
                } },
            key: (file.name),
            ...{ class: (['job-templates-config-tab', { active: __VLS_ctx.currentConfigFile === file.name }]) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        /** @type {__VLS_StyleScopedClasses['job-templates-config-tab']} */ ;
        (file.name);
        // @ts-ignore
        [currentConfigFile,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
        ...{ class: "job-templates-config-content" },
    });
    /** @type {__VLS_StyleScopedClasses['job-templates-config-content']} */ ;
    (__VLS_ctx.currentConfigContent);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "job-templates-config-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['job-templates-config-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.downloadConfig) },
        ...{ class: "job-templates-btn-primary" },
    });
    /** @type {__VLS_StyleScopedClasses['job-templates-btn-primary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.copyConfig) },
        ...{ class: "job-templates-btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['job-templates-btn-secondary']} */ ;
}
// @ts-ignore
[currentConfigContent, downloadConfig, copyConfig,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    emits: {},
});
export default {};
