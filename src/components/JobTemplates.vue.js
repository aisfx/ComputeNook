/// <reference types="../../node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed } from 'vue';
const emit = defineEmits(['use-template']);
const showCreateModal = ref(false);
const showConfigModal = ref(false);
const selectedCategory = ref('all');
const currentTemplate = ref(null);
const currentConfigFile = ref('submit.sh');
const categories = [
    { id: 'all', name: '全部', icon: '📚' },
    { id: 'cfd', name: 'CFD', icon: '🌊' },
    { id: 'chemistry', name: '化学', icon: '⚗️' },
    { id: 'md', name: '分子动力学', icon: '🔬' },
    { id: 'ai', name: 'AI/ML', icon: '🤖' },
    { id: 'general', name: '通用', icon: '💻' }
];
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
]);
const filteredTemplates = computed(() => {
    if (selectedCategory.value === 'all') {
        return templates.value;
    }
    return templates.value.filter(t => t.category === selectedCategory.value);
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
    alert(`已选择模板: ${template.name}\n请前往"提交作业"页面查看`);
};
const viewConfig = (template) => {
    currentTemplate.value = template;
    currentConfigFile.value = 'submit.sh';
    showConfigModal.value = true;
};
const editTemplate = (template) => {
    alert(`编辑模板: ${template.name}`);
};
const deleteTemplate = (id) => {
    if (confirm('确定要删除此模板吗？')) {
        const index = templates.value.findIndex(t => t.id === id);
        if (index > -1) {
            templates.value.splice(index, 1);
            alert('模板已删除');
        }
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
    alert('配置已复制到剪贴板');
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
/** @type {__VLS_StyleScopedClasses['template-card']} */ ;
/** @type {__VLS_StyleScopedClasses['template-header']} */ ;
/** @type {__VLS_StyleScopedClasses['category-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['category-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['template-type']} */ ;
/** @type {__VLS_StyleScopedClasses['config-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['config-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
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
    ...{ class: "app-categories" },
});
/** @type {__VLS_StyleScopedClasses['app-categories']} */ ;
for (const [category] of __VLS_vFor((__VLS_ctx.categories))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selectedCategory = category.id;
                // @ts-ignore
                [categories, selectedCategory,];
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.editTemplate(template);
                // @ts-ignore
                [editTemplate,];
            } },
        ...{ class: "btn-link" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.deleteTemplate(template.id);
                // @ts-ignore
                [deleteTemplate,];
            } },
        ...{ class: "btn-link danger" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
    /** @type {__VLS_StyleScopedClasses['danger']} */ ;
    // @ts-ignore
    [];
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
        ...{ class: "modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "modal-content config-modal" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
    /** @type {__VLS_StyleScopedClasses['config-modal']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
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
        ...{ class: "btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "config-tabs" },
    });
    /** @type {__VLS_StyleScopedClasses['config-tabs']} */ ;
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
            ...{ class: (['config-tab', { active: __VLS_ctx.currentConfigFile === file.name }]) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        /** @type {__VLS_StyleScopedClasses['config-tab']} */ ;
        (file.name);
        // @ts-ignore
        [currentConfigFile,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
        ...{ class: "config-content" },
    });
    /** @type {__VLS_StyleScopedClasses['config-content']} */ ;
    (__VLS_ctx.currentConfigContent);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "config-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['config-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.downloadConfig) },
        ...{ class: "btn-primary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.copyConfig) },
        ...{ class: "btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
}
// @ts-ignore
[currentConfigContent, downloadConfig, copyConfig,];
const __VLS_export = (await import('vue')).defineComponent({
    emits: {},
});
export default {};
