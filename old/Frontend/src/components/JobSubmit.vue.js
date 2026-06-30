/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, onMounted, watch } from 'vue';
import { getUser, getApiBase } from '../utils/auth';
import { fileManagerApi } from '../config/api';
import notification from '../utils/notification';
import ContainerJobSubmit from './ContainerJobSubmit.vue';
const emit = defineEmits(['job-submitted', 'go-registry']);
const mode = ref('normal');
const currentUser = ref(null);
const selectedTemplate = ref(null);
const selectedTemplateData = ref(null);
const scriptFiles = ref([]);
const partitions = ref([]);
const loadingPartitions = ref(false);
const qosList = ref([]);
const loadingQoS = ref(false);
// 监听来自模板页面的事件
const handleTemplateSelect = (template) => {
    selectedTemplateData.value = template;
    applyTemplateData(template);
};
// 暴露方法给父组件
const __VLS_exposed = {
    handleTemplateSelect
};
defineExpose(__VLS_exposed);
const templates = ref([]);
const loadTemplatesFromAPI = async () => {
    try {
        const tok = localStorage.getItem('token') || sessionStorage.getItem('token');
        const res = await fetch(`${getApiBase()}/api/app-templates`, {
            headers: { Authorization: `Bearer ${tok}` }
        });
        if (!res.ok)
            return;
        const data = await res.json();
        templates.value = data.data || [];
    }
    catch { /* ignore */ }
};
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
});
const submitting = ref(false);
// 加载分区列表
const loadPartitions = async () => {
    loadingPartitions.value = true;
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            return;
        }
        const response = await fetch(`${getApiBase()}/api/jobs/partitions/list`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('获取分区列表失败');
        }
        const result = await response.json();
        partitions.value = result.data || [];
        // 如果有分区且当前没有选择分区，默认选择第一个
        if (partitions.value.length > 0 && !form.value.partition) {
            form.value.partition = partitions.value[0].name;
        }
    }
    catch (err) {
        console.error('Failed to load partitions:', err);
        // 如果加载失败，使用默认分区列表
        partitions.value = [
            { name: 'compute', state: 'UP', nodes: '-' },
            { name: 'gpu', state: 'UP', nodes: '-' },
            { name: 'memory', state: 'UP', nodes: '-' },
            { name: 'debug', state: 'UP', nodes: '-' }
        ];
    }
    finally {
        loadingPartitions.value = false;
    }
};
// 重置为家目录
const resetToHomeDir = () => {
    const homeDir = currentUser.value?.homeDir || `/home/${currentUser.value?.username || ''}`;
    form.value.workdir = homeDir;
};
// 加载 QoS 列表
const loadQoSList = async () => {
    loadingQoS.value = true;
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token)
            return;
        const res = await fetch(`${getApiBase()}/api/qos`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok)
            return;
        const result = await res.json();
        qosList.value = (result.data || []).map((q) => ({ name: q.name || q.Name }));
    }
    catch { /* ignore */ }
    finally {
        loadingQoS.value = false;
    }
};
// 加载脚本文件列表
const loadScriptFiles = async () => {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            notification.error('请先登录系统');
            return;
        }
        const homeDir = currentUser.value?.homeDir || `/home/${currentUser.value?.username || ''}`;
        const url = `${fileManagerApi.list()}?path=${encodeURIComponent(homeDir)}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('读取目录失败');
        }
        const result = await response.json();
        const files = result.files || [];
        // 筛选出脚本文件（.sh, .py, .R, .m 等）
        scriptFiles.value = files
            .filter((file) => {
            if (file.is_dir)
                return false;
            const ext = file.name.split('.').pop()?.toLowerCase();
            return ['sh', 'py', 'r', 'm', 'pl', 'jl', 'slurm', 'sbatch'].includes(ext || '');
        })
            .map((file) => ({
            name: file.name,
            path: file.path
        }));
        if (scriptFiles.value.length === 0) {
            notification.info('家目录下没有找到脚本文件');
        }
    }
    catch (err) {
        console.error('Failed to load script files:', err);
        notification.error(err.message || '加载脚本文件失败');
    }
};
const applyTemplate = () => {
    if (!selectedTemplate.value)
        return;
    const template = templates.value.find(t => t.id === selectedTemplate.value);
    if (template) {
        applyTemplateData(template);
    }
};
const applyTemplateData = (template) => {
    // 根据模板生成对应的脚本内容
    const gpuLine = template.gpus ? `\n#SBATCH --gres=gpu:${template.gpus}` : '';
    const moduleLine = template.moduleLoad ? `\nmodule load ${template.moduleLoad}` : '';
    const runCmd = template.executable
        ? `\nmpirun -np ${template.cpus} ${template.executable}${template.inputFile ? ' -in ' + template.inputFile : ''}`
        : '\n# 在此处添加你的命令';
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

echo "Job finished: $(date)"`;
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
    };
};
const resetForm = () => {
    selectedTemplate.value = null;
    const homeDir = currentUser.value?.homeDir || `/home/${currentUser.value?.username || ''}`;
    const defaultPartition = partitions.value.length > 0 ? partitions.value[0].name : 'compute';
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
    };
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
};
const applyScriptTemplate = (type) => {
    const tpl = scriptTemplates[type];
    if (!tpl)
        return;
    form.value.scriptContent = tpl;
    if (type === 'gpu') {
        form.value.gpus = 1;
        form.value.partition = 'gpu';
    }
    if (type === 'mpi') {
        form.value.nodes = 2;
        form.value.cpus = 16;
    }
    if (type === 'pytorch') {
        form.value.gpus = 8;
        form.value.cpus = 32;
        form.value.nodes = 1;
    }
    if (type === 'deepspeed') {
        form.value.gpus = 8;
        form.value.cpus = 32;
        form.value.nodes = 1;
    }
    if (type === 'vllm') {
        form.value.gpus = 4;
        form.value.cpus = 16;
        form.value.nodes = 1;
    }
    if (type === 'triton') {
        form.value.gpus = 2;
        form.value.cpus = 8;
        form.value.nodes = 1;
    }
};
// 更新脚本内容中的 SBATCH 参数
const updateScriptParams = () => {
    let script = form.value.scriptContent;
    if (!script || !script.includes('#SBATCH'))
        return;
    // 更新作业名称
    if (form.value.name) {
        script = script.replace(/#SBATCH\s+-J\s+\S+/g, `#SBATCH -J ${form.value.name}`);
    }
    // 更新分区
    if (form.value.partition) {
        script = script.replace(/#SBATCH\s+-p\s+\S+/g, `#SBATCH -p ${form.value.partition}`);
    }
    // 更新节点数
    script = script.replace(/#SBATCH\s+-N\s+\d+/g, `#SBATCH -N ${form.value.nodes}`);
    // 更新 CPU 核心数
    script = script.replace(/#SBATCH\s+-c\s+\d+/g, `#SBATCH -c ${form.value.cpus}`);
    script = script.replace(/#SBATCH\s+--ntasks-per-node=\d+/g, `#SBATCH --ntasks-per-node=${form.value.cpus}`);
    // 更新内存
    if (form.value.memory > 0) {
        if (script.includes('#SBATCH --mem=')) {
            script = script.replace(/#SBATCH\s+--mem=\d+G?/g, `#SBATCH --mem=${form.value.memory}G`);
        }
        else {
            // 如果脚本中没有内存参数，在 CPU 行后添加
            script = script.replace(/(#SBATCH\s+-c\s+\d+)/g, `$1\n#SBATCH --mem=${form.value.memory}G`);
        }
    }
    else {
        // 如果内存设为 0，移除内存限制行
        script = script.replace(/\n?#SBATCH\s+--mem=\d+G?\n?/g, '\n');
    }
    // 更新时间
    if (form.value.time > 0) {
        const timeStr = `${String(form.value.time).padStart(2, '0')}:00:00`;
        if (script.includes('#SBATCH -t ') || script.includes('#SBATCH --time=')) {
            script = script.replace(/#SBATCH\s+-t\s+\S+/g, `#SBATCH -t ${timeStr}`);
            script = script.replace(/#SBATCH\s+--time=\S+/g, `#SBATCH --time=${timeStr}`);
        }
        else {
            // 如果脚本中没有时间参数，在内存行后添加
            const memLine = script.match(/#SBATCH\s+--mem=\d+G?/);
            if (memLine) {
                script = script.replace(/(#SBATCH\s+--mem=\d+G?)/g, `$1\n#SBATCH -t ${timeStr}`);
            }
            else {
                script = script.replace(/(#SBATCH\s+-c\s+\d+)/g, `$1\n#SBATCH -t ${timeStr}`);
            }
        }
    }
    else {
        // 如果时间设为 0，移除时间限制行
        script = script.replace(/\n?#SBATCH\s+(-t|--time=)\s*\S+\n?/g, '\n');
    }
    // 更新 GPU
    if (form.value.gpus > 0) {
        if (script.includes('#SBATCH --gres=gpu:')) {
            script = script.replace(/#SBATCH\s+--gres=gpu:\d+/g, `#SBATCH --gres=gpu:${form.value.gpus}`);
        }
        else {
            // 如果脚本中没有 GPU 参数，在内存行后添加
            const memLine = script.match(/#SBATCH\s+--mem=\d+G?/);
            if (memLine) {
                script = script.replace(/(#SBATCH\s+--mem=\d+G?)/g, `$1\n#SBATCH --gres=gpu:${form.value.gpus}`);
            }
            else {
                script = script.replace(/(#SBATCH\s+-c\s+\d+)/g, `$1\n#SBATCH --gres=gpu:${form.value.gpus}`);
            }
        }
    }
    else {
        // 如果 GPU 设为 0，移除 GPU 行
        script = script.replace(/\n?#SBATCH\s+--gres=gpu:\d+\n?/g, '\n');
    }
    // 更新 QoS
    if (form.value.qos) {
        if (script.includes('#SBATCH --qos=')) {
            script = script.replace(/#SBATCH\s+--qos=\S+/g, `#SBATCH --qos=${form.value.qos}`);
        }
        else {
            // 在时间行后添加 QoS
            const timeLine = script.match(/#SBATCH\s+(-t|--time=)\s*\S+/);
            if (timeLine) {
                script = script.replace(/(#SBATCH\s+(-t|--time=)\s*\S+)/g, `$1\n#SBATCH --qos=${form.value.qos}`);
            }
        }
    }
    else {
        // 移除 QoS 行
        script = script.replace(/\n?#SBATCH\s+--qos=\S+\n?/g, '\n');
    }
    // 清理多余的空行
    script = script.replace(/\n{3,}/g, '\n\n');
    form.value.scriptContent = script;
};
// 监听表单参数变化，自动更新脚本内容
watch(() => [
    form.value.name,
    form.value.partition,
    form.value.nodes,
    form.value.cpus,
    form.value.memory,
    form.value.time,
    form.value.gpus,
    form.value.qos
], () => {
    updateScriptParams();
}, { deep: true });
const submitJob = async () => {
    submitting.value = true;
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            notification.error('请先登录系统');
            submitting.value = false;
            return;
        }
        // 直接使用编辑器里的脚本内容
        const scriptContent = form.value.scriptContent.trim();
        if (!scriptContent) {
            notification.error('请填写脚本内容');
            submitting.value = false;
            return;
        }
        // 构建提交数据 - 只发送必需字段，让Slurm使用默认路径
        const submitData = {
            name: form.value.name,
            partition: form.value.partition,
            script: scriptContent, // 发送脚本内容而不是路径
            nodes: form.value.nodes,
            cpus: form.value.cpus,
            memory: form.value.memory || 0, // 0 表示不限制
            gpus: form.value.gpus || 0,
            time: form.value.time || 0,
            qos: form.value.qos || '',
            priority: form.value.priority,
            extra_params: form.value.extraParams
        };
        // 不发送workdir、output、error，让Slurm使用默认值
        // 这样可以避免路径权限问题
        const response = await fetch(`${getApiBase()}/api/jobs`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(submitData)
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `提交失败: ${response.status}`);
        }
        const result = await response.json();
        notification.success(`作业提交成功！作业ID: ${result.job_id}`);
        emit('job-submitted');
        resetForm();
    }
    catch (err) {
        console.error('Failed to submit job:', err);
        notification.error(err.message || '作业提交失败');
    }
    finally {
        submitting.value = false;
    }
};
// 初始化
onMounted(() => {
    currentUser.value = getUser();
    loadPartitions();
    loadQoSList();
    loadTemplatesFromAPI();
    if (!form.value.scriptContent) {
        form.value.scriptContent = scriptTemplates.basic;
    }
});
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
/** @type {__VLS_StyleScopedClasses['mode-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['mode-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-form']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-form']} */ ;
/** @type {__VLS_StyleScopedClasses['form-row']} */ ;
/** @type {__VLS_StyleScopedClasses['col2']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['input-with-button']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['script-header']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-tpl']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-tpl']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-tpl']} */ ;
/** @type {__VLS_StyleScopedClasses['ai']} */ ;
/** @type {__VLS_StyleScopedClasses['script-editor']} */ ;
/** @type {__VLS_StyleScopedClasses['script-input']} */ ;
/** @type {__VLS_StyleScopedClasses['script-input']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-small']} */ ;
/** @type {__VLS_StyleScopedClasses['extra-params-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['extra-params-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['extra-params-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "submit-wrapper" },
});
/** @type {__VLS_StyleScopedClasses['submit-wrapper']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mode-tabs" },
});
/** @type {__VLS_StyleScopedClasses['mode-tabs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.mode = 'normal';
            // @ts-ignore
            [mode,];
        } },
    type: "button",
    ...{ class: (['mode-tab', { active: __VLS_ctx.mode === 'normal' }]) },
});
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['mode-tab']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.mode = 'container';
            // @ts-ignore
            [mode, mode,];
        } },
    type: "button",
    ...{ class: (['mode-tab', { active: __VLS_ctx.mode === 'container' }]) },
});
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['mode-tab']} */ ;
if (__VLS_ctx.mode === 'container') {
    const __VLS_0 = ContainerJobSubmit;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ 'onSubmitted': {} },
        ...{ 'onGoRegistry': {} },
        ...{ style: {} },
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onSubmitted': {} },
        ...{ 'onGoRegistry': {} },
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_5;
    const __VLS_6 = ({ submitted: {} },
        { onSubmitted: (...[$event]) => {
                if (!(__VLS_ctx.mode === 'container'))
                    return;
                __VLS_ctx.emit('job-submitted');
                // @ts-ignore
                [mode, mode, emit,];
            } });
    const __VLS_7 = ({ goRegistry: {} },
        { onGoRegistry: (...[$event]) => {
                if (!(__VLS_ctx.mode === 'container'))
                    return;
                __VLS_ctx.emit('go-registry');
                // @ts-ignore
                [emit,];
            } });
    var __VLS_3;
    var __VLS_4;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
        ...{ onSubmit: (__VLS_ctx.submitJob) },
        ...{ class: "submit-form" },
    });
    /** @type {__VLS_StyleScopedClasses['submit-form']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-row col2" },
    });
    /** @type {__VLS_StyleScopedClasses['form-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['col2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        value: (__VLS_ctx.form.name),
        type: "text",
        placeholder: "my_job",
        required: true,
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.form.partition),
        required: true,
        disabled: (__VLS_ctx.loadingPartitions),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
        disabled: true,
    });
    (__VLS_ctx.loadingPartitions ? '加载中...' : '-- 选择分区 --');
    for (const [p] of __VLS_vFor((__VLS_ctx.partitions))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (p.name),
            value: (p.name),
        });
        (p.name);
        (p.state);
        // @ts-ignore
        [submitJob, form, form, loadingPartitions, loadingPartitions, partitions,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-row col2" },
    });
    /** @type {__VLS_StyleScopedClasses['form-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['col2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "1",
        max: "32",
        required: true,
    });
    (__VLS_ctx.form.nodes);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "1",
        max: "128",
        required: true,
    });
    (__VLS_ctx.form.cpus);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-row col2" },
    });
    /** @type {__VLS_StyleScopedClasses['form-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['col2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "0",
        placeholder: "不限",
    });
    (__VLS_ctx.form.memory);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "0",
        placeholder: "不限",
    });
    (__VLS_ctx.form.time);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-row col2" },
    });
    /** @type {__VLS_StyleScopedClasses['form-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['col2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "0",
        max: "8",
        placeholder: "0",
    });
    (__VLS_ctx.form.gpus);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.form.qos),
        disabled: (__VLS_ctx.loadingQoS),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    for (const [q] of __VLS_vFor((__VLS_ctx.qosList))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (q.name),
            value: (q.name),
        });
        (q.name);
        // @ts-ignore
        [form, form, form, form, form, form, loadingQoS, qosList,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "input-with-button" },
    });
    /** @type {__VLS_StyleScopedClasses['input-with-button']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        value: (__VLS_ctx.form.workdir),
        type: "text",
        placeholder: "/home/username/jobs",
        required: true,
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.resetToHomeDir) },
        type: "button",
        ...{ class: "btn-icon" },
        title: "重置为家目录",
    });
    /** @type {__VLS_StyleScopedClasses['btn-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
        value: (__VLS_ctx.form.scriptContent),
        ...{ class: "script-editor" },
        rows: "12",
        placeholder: "#!/bin/bash&#10;#SBATCH -J my_job&#10;...",
        spellcheck: "false",
        required: true,
    });
    /** @type {__VLS_StyleScopedClasses['script-editor']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "help-text" },
    });
    /** @type {__VLS_StyleScopedClasses['help-text']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-row col2" },
    });
    /** @type {__VLS_StyleScopedClasses['form-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['col2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        value: (__VLS_ctx.form.output),
        type: "text",
        placeholder: "output.log",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        value: (__VLS_ctx.form.error),
        type: "text",
        placeholder: "error.log",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
        ...{ class: "extra-params-wrap" },
    });
    /** @type {__VLS_StyleScopedClasses['extra-params-wrap']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
        ...{ class: "extra-params-toggle" },
    });
    /** @type {__VLS_StyleScopedClasses['extra-params-toggle']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
        value: (__VLS_ctx.form.extraParams),
        rows: "2",
        placeholder: "其他 Slurm 参数，如：--exclusive",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['form-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        type: "submit",
        ...{ class: "btn-primary" },
        disabled: (__VLS_ctx.submitting),
    });
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    (__VLS_ctx.submitting ? '提交中...' : '🚀 提交');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.resetForm) },
        type: "button",
        ...{ class: "btn-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
}
// @ts-ignore
[form, form, form, form, form, resetToHomeDir, submitting, submitting, resetForm,];
const __VLS_export = (await import('vue')).defineComponent({
    setup: () => (__VLS_exposed),
    emits: {},
});
export default {};
