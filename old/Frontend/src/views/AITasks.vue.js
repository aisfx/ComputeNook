/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { getApiBase } from '../utils/auth';
import notification from '../utils/notification';
import dialog from '../utils/dialog';
const loading = ref(false);
const tasks = ref([]);
const stats = ref({ running: 0, pending: 0, completed: 0, failed: 0, train: 0, infer: 0, total: 0 });
const typeFilter = ref('');
const showCreate = ref(false);
const showLog = ref(false);
const showPublish = ref(false);
const logTask = ref(null);
const logContent = ref('');
const logLoading = ref(false);
const submitting = ref(false);
const publishing = ref(false);
const publishTask = ref(null);
const publishNote = ref('');
const publishResult = ref(null);
const selectedModelTpl = ref('');
const partitions = ref(['compute', 'gpu']);
const endpoints = ref({});
const token = () => localStorage.getItem('token') || sessionStorage.getItem('token');
const api = (path) => `${getApiBase()}${path}`;
const headers = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });
const filteredTasks = computed(() => typeFilter.value ? tasks.value.filter(t => t.type === typeFilter.value) : tasks.value);
const modelTemplates = [
    { id: 'llama3', icon: '🦙', name: 'LLaMA 3', tag: '推理', type: 'infer', gpus: 4, cpus: 16, memory: 64, script: '' },
    { id: 'pytorch', icon: '🔥', name: 'PyTorch', tag: '训练', type: 'train', gpus: 8, cpus: 32, memory: 128, script: '' },
    { id: 'deepspeed', icon: '⚡', name: 'DeepSpeed', tag: '训练', type: 'train', gpus: 8, cpus: 32, memory: 128, script: '' },
    { id: 'triton', icon: '🚀', name: 'Triton', tag: '推理', type: 'infer', gpus: 2, cpus: 8, memory: 32, script: '' },
];
const filteredModelTpls = computed(() => modelTemplates.filter(t => !createForm.value.type || t.type === createForm.value.type));
const defaultForm = () => ({
    name: '', type: 'train', partition: '',
    nodes: 1, cpus: 8, gpus: 1, memory: 0, time_limit: 0,
    image: '', work_dir: '', script: '', service_port: 8000,
    auto_restart: true, max_retries: 3, restart_on_nodes: true
});
const createForm = ref(defaultForm());
const applyModelTpl = (tpl) => {
    selectedModelTpl.value = tpl.id;
    createForm.value.gpus = tpl.gpus;
    createForm.value.cpus = tpl.cpus;
    createForm.value.memory = tpl.memory;
    createForm.value.name = tpl.name.toLowerCase().replace(/\s+/g, '-') + '-job';
};
const scriptTpls = {
    pytorch: '#!/bin/bash\n#SBATCH -o slurm-%j.out\nMASTER=$(scontrol show hostnames $SLURM_JOB_NODELIST | head -n1)\nsrun torchrun --nproc_per_node=$SLURM_GPUS_ON_NODE --nnodes=$SLURM_NNODES --node_rank=$SLURM_NODEID --master_addr=$MASTER --master_port=29500 train.py',
    deepspeed: '#!/bin/bash\n#SBATCH -o slurm-%j.out\nMASTER=$(scontrol show hostnames $SLURM_JOB_NODELIST | head -n1)\nsrun deepspeed --num_nodes=$SLURM_NNODES --num_gpus=$SLURM_GPUS_ON_NODE --master_addr=$MASTER train_ds.py --deepspeed ds_config.json',
    vllm: '#!/bin/bash\n#SBATCH -o slurm-%j.out\npython -m vllm.entrypoints.openai.api_server --model /data/models/llama3 --tensor-parallel-size $SLURM_GPUS_ON_NODE --host 0.0.0.0 --port 8000',
    triton: '#!/bin/bash\n#SBATCH -o slurm-%j.out\ntritonserver --model-repository=/data/triton_models --http-port=8000 --grpc-port=8001'
};
const applyScriptTpl = (name) => { createForm.value.script = scriptTpls[name] || ''; };
// 更新脚本内容中的 SBATCH 参数
const updateScriptParams = () => {
    let script = createForm.value.script;
    if (!script || !script.includes('#SBATCH'))
        return;
    // 更新作业名称
    if (createForm.value.name) {
        if (script.includes('#SBATCH -J ')) {
            script = script.replace(/#SBATCH\s+-J\s+\S+/g, `#SBATCH -J ${createForm.value.name}`);
        }
        else {
            script = script.replace('#!/bin/bash\n', `#!/bin/bash\n#SBATCH -J ${createForm.value.name}\n`);
        }
    }
    // 更新分区
    if (createForm.value.partition) {
        if (script.includes('#SBATCH -p ')) {
            script = script.replace(/#SBATCH\s+-p\s+\S+/g, `#SBATCH -p ${createForm.value.partition}`);
        }
        else {
            const jobLine = script.match(/#SBATCH\s+-J\s+\S+/);
            if (jobLine) {
                script = script.replace(/(#SBATCH\s+-J\s+\S+)/g, `$1\n#SBATCH -p ${createForm.value.partition}`);
            }
        }
    }
    // 更新节点数
    if (script.includes('#SBATCH -N ')) {
        script = script.replace(/#SBATCH\s+-N\s+\d+/g, `#SBATCH -N ${createForm.value.nodes}`);
    }
    else {
        const partLine = script.match(/#SBATCH\s+-p\s+\S+/);
        if (partLine) {
            script = script.replace(/(#SBATCH\s+-p\s+\S+)/g, `$1\n#SBATCH -N ${createForm.value.nodes}`);
        }
    }
    // 更新 CPU 核心数
    if (script.includes('#SBATCH -c ')) {
        script = script.replace(/#SBATCH\s+-c\s+\d+/g, `#SBATCH -c ${createForm.value.cpus}`);
    }
    else if (script.includes('#SBATCH --ntasks-per-node=')) {
        script = script.replace(/#SBATCH\s+--ntasks-per-node=\d+/g, `#SBATCH --ntasks-per-node=${createForm.value.cpus}`);
    }
    else {
        const nodeLine = script.match(/#SBATCH\s+-N\s+\d+/);
        if (nodeLine) {
            script = script.replace(/(#SBATCH\s+-N\s+\d+)/g, `$1\n#SBATCH -c ${createForm.value.cpus}`);
        }
    }
    // 更新内存
    if (createForm.value.memory > 0) {
        if (script.includes('#SBATCH --mem=')) {
            script = script.replace(/#SBATCH\s+--mem=\d+G?/g, `#SBATCH --mem=${createForm.value.memory}G`);
        }
        else {
            const cpuLine = script.match(/#SBATCH\s+-c\s+\d+/);
            if (cpuLine) {
                script = script.replace(/(#SBATCH\s+-c\s+\d+)/g, `$1\n#SBATCH --mem=${createForm.value.memory}G`);
            }
        }
    }
    else {
        script = script.replace(/\n?#SBATCH\s+--mem=\d+G?\n?/g, '\n');
    }
    // 更新时间
    if (createForm.value.time_limit > 0) {
        const timeStr = `${String(createForm.value.time_limit).padStart(2, '0')}:00:00`;
        if (script.includes('#SBATCH -t ') || script.includes('#SBATCH --time=')) {
            script = script.replace(/#SBATCH\s+-t\s+\S+/g, `#SBATCH -t ${timeStr}`);
            script = script.replace(/#SBATCH\s+--time=\S+/g, `#SBATCH --time=${timeStr}`);
        }
        else {
            const memLine = script.match(/#SBATCH\s+--mem=\d+G?/);
            if (memLine) {
                script = script.replace(/(#SBATCH\s+--mem=\d+G?)/g, `$1\n#SBATCH -t ${timeStr}`);
            }
        }
    }
    else {
        script = script.replace(/\n?#SBATCH\s+(-t|--time=)\s*\S+\n?/g, '\n');
    }
    // 更新 GPU
    if (createForm.value.gpus > 0) {
        if (script.includes('#SBATCH --gres=gpu:')) {
            script = script.replace(/#SBATCH\s+--gres=gpu:\d+/g, `#SBATCH --gres=gpu:${createForm.value.gpus}`);
        }
        else {
            const memLine = script.match(/#SBATCH\s+--mem=\d+G?/);
            if (memLine) {
                script = script.replace(/(#SBATCH\s+--mem=\d+G?)/g, `$1\n#SBATCH --gres=gpu:${createForm.value.gpus}`);
            }
        }
    }
    else {
        script = script.replace(/\n?#SBATCH\s+--gres=gpu:\d+\n?/g, '\n');
    }
    // 清理多余的空行
    script = script.replace(/\n{3,}/g, '\n\n');
    createForm.value.script = script;
};
// 监听表单参数变化，自动更新脚本内容
watch(() => [
    createForm.value.name,
    createForm.value.partition,
    createForm.value.nodes,
    createForm.value.cpus,
    createForm.value.memory,
    createForm.value.time_limit,
    createForm.value.gpus
], () => {
    updateScriptParams();
}, { deep: true });
const loadAll = async () => {
    loading.value = true;
    try {
        const [tr, sr] = await Promise.all([
            fetch(api('/api/ai-tasks'), { headers: headers() }),
            fetch(api('/api/ai-tasks/stats'), { headers: headers() })
        ]);
        const td = await tr.json();
        const sd = await sr.json();
        tasks.value = (td.data || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        stats.value = sd.data || stats.value;
    }
    catch (e) {
        notification.error('加载失败: ' + e.message);
    }
    finally {
        loading.value = false;
    }
};
const loadPartitions = async () => {
    try {
        const res = await fetch(api('/api/jobs/partitions/list'), { headers: headers() });
        const data = await res.json();
        const list = (data.data || []).map((p) => p.name).filter(Boolean);
        if (list.length > 0) {
            partitions.value = list;
            createForm.value.partition = list[0];
        }
    }
    catch {
        partitions.value = ['compute', 'gpu'];
    }
};
const openCreate = (type) => {
    createForm.value = defaultForm();
    createForm.value.type = type;
    selectedModelTpl.value = '';
    if (partitions.value.length > 0)
        createForm.value.partition = partitions.value[0];
    showCreate.value = true;
};
const submitCreate = async () => {
    if (!createForm.value.name.trim() || !createForm.value.script.trim()) {
        notification.error('请填写任务名称和脚本');
        return;
    }
    submitting.value = true;
    try {
        const res = await fetch(api('/api/ai-tasks'), { method: 'POST', headers: headers(), body: JSON.stringify(createForm.value) });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || '提交失败');
        notification.success('任务已提交，作业ID: ' + data.data?.job_id);
        showCreate.value = false;
        loadAll();
    }
    catch (e) {
        notification.error(e.message);
    }
    finally {
        submitting.value = false;
    }
};
const stopTask = async (task) => {
    const ok = await dialog.confirm('确定停止任务 ' + task.name + '？', { title: '停止任务' });
    if (!ok)
        return;
    try {
        const res = await fetch(api('/api/ai-tasks/' + task.id + '/stop'), { method: 'POST', headers: headers() });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error);
        notification.success('任务已停止');
        loadAll();
    }
    catch (e) {
        notification.error(e.message);
    }
};
const restartTask = async (task) => {
    try {
        const res = await fetch(api('/api/ai-tasks/' + task.id + '/restart'), { method: 'POST', headers: headers() });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error);
        notification.success('重启任务已提交');
        loadAll();
    }
    catch (e) {
        notification.error(e.message);
    }
};
const deleteTask = async (task) => {
    const ok = await dialog.confirmDelete(task.name, '任务');
    if (!ok)
        return;
    try {
        await fetch(api('/api/ai-tasks/' + task.id), { method: 'DELETE', headers: headers() });
        notification.success('删除成功');
        loadAll();
    }
    catch (e) {
        notification.error(e.message);
    }
};
const viewLogs = async (task) => {
    logTask.value = task;
    showLog.value = true;
    logLoading.value = true;
    logContent.value = '';
    try {
        const res = await fetch(api('/api/ai-tasks/' + task.id + '/logs'), { headers: headers() });
        const data = await res.json();
        logContent.value = data.log || data.message || '暂无日志';
    }
    catch {
        logContent.value = '获取日志失败';
    }
    finally {
        logLoading.value = false;
    }
};
const openPublishPort = (task) => {
    publishTask.value = task;
    publishNote.value = '';
    publishResult.value = null;
    showPublish.value = true;
};
const doPublishPort = async () => {
    if (!publishTask.value)
        return;
    publishing.value = true;
    try {
        const apiKey = 'sk-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        publishResult.value = { port: publishTask.value.service_port || 8000, api_key: apiKey };
        endpoints.value[publishTask.value.id] = { api_key: apiKey, port: publishTask.value.service_port || 8000, note: publishNote.value };
    }
    finally {
        publishing.value = false;
    }
};
const revokeEndpoint = async (task) => {
    const ok = await dialog.confirm('确定撤销 API Key？', { title: '撤销 API Key', danger: true });
    if (ok)
        delete endpoints.value[task.id];
};
const copyText = (text) => { navigator.clipboard.writeText(text); notification.success('已复制'); };
const statusLabel = (s) => ({ RUNNING: '运行中', PENDING: '等待中', COMPLETED: '已完成', FAILED: '失败', RESTARTING: '重启中' }[s] || s);
const formatTime = (t) => t ? new Date(t).toLocaleString('zh-CN') : '-';
let timer;
onMounted(() => { loadPartitions(); loadAll(); timer = setInterval(loadAll, 30000); });
onUnmounted(() => clearInterval(timer));
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-create']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-create']} */ ;
/** @type {__VLS_StyleScopedClasses['task-type-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['train']} */ ;
/** @type {__VLS_StyleScopedClasses['task-type-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['infer']} */ ;
/** @type {__VLS_StyleScopedClasses['task-status']} */ ;
/** @type {__VLS_StyleScopedClasses['running']} */ ;
/** @type {__VLS_StyleScopedClasses['task-status']} */ ;
/** @type {__VLS_StyleScopedClasses['pending']} */ ;
/** @type {__VLS_StyleScopedClasses['task-status']} */ ;
/** @type {__VLS_StyleScopedClasses['task-status']} */ ;
/** @type {__VLS_StyleScopedClasses['completed']} */ ;
/** @type {__VLS_StyleScopedClasses['task-status']} */ ;
/** @type {__VLS_StyleScopedClasses['failed']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['model-tpl-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['pf-val']} */ ;
/** @type {__VLS_StyleScopedClasses['stats-row']} */ ;
/** @type {__VLS_StyleScopedClasses['stats-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "ai-tasks-page" },
});
/** @type {__VLS_StyleScopedClasses['ai-tasks-page']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stats-row" },
});
/** @type {__VLS_StyleScopedClasses['stats-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-card" },
});
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-value running" },
});
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['running']} */ ;
(__VLS_ctx.stats.running);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-card" },
});
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-value pending" },
});
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['pending']} */ ;
(__VLS_ctx.stats.pending);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-card" },
});
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-value completed" },
});
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['completed']} */ ;
(__VLS_ctx.stats.completed);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-card" },
});
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-value failed" },
});
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['failed']} */ ;
(__VLS_ctx.stats.failed);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-card" },
});
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-value" },
});
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
(__VLS_ctx.stats.train);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-card" },
});
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-value" },
});
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
(__VLS_ctx.stats.infer);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "toolbar" },
});
/** @type {__VLS_StyleScopedClasses['toolbar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "toolbar-left" },
});
/** @type {__VLS_StyleScopedClasses['toolbar-left']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.typeFilter = '';
            // @ts-ignore
            [stats, stats, stats, stats, stats, stats, typeFilter,];
        } },
    ...{ class: (['tab-btn', __VLS_ctx.typeFilter === '' ? 'active' : '']) },
});
/** @type {__VLS_StyleScopedClasses['tab-btn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.typeFilter = 'train';
            // @ts-ignore
            [typeFilter, typeFilter,];
        } },
    ...{ class: (['tab-btn', __VLS_ctx.typeFilter === 'train' ? 'active' : '']) },
});
/** @type {__VLS_StyleScopedClasses['tab-btn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.typeFilter = 'infer';
            // @ts-ignore
            [typeFilter, typeFilter,];
        } },
    ...{ class: (['tab-btn', __VLS_ctx.typeFilter === 'infer' ? 'active' : '']) },
});
/** @type {__VLS_StyleScopedClasses['tab-btn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "toolbar-right" },
});
/** @type {__VLS_StyleScopedClasses['toolbar-right']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.loadAll) },
    ...{ class: "btn-refresh" },
    title: "刷新",
});
/** @type {__VLS_StyleScopedClasses['btn-refresh']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.openCreate('train');
            // @ts-ignore
            [typeFilter, loadAll, openCreate,];
        } },
    ...{ class: "btn-create train" },
});
/** @type {__VLS_StyleScopedClasses['btn-create']} */ ;
/** @type {__VLS_StyleScopedClasses['train']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.openCreate('infer');
            // @ts-ignore
            [openCreate,];
        } },
    ...{ class: "btn-create infer" },
});
/** @type {__VLS_StyleScopedClasses['btn-create']} */ ;
/** @type {__VLS_StyleScopedClasses['infer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "task-list" },
});
/** @type {__VLS_StyleScopedClasses['task-list']} */ ;
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty-tip" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-tip']} */ ;
}
else if (__VLS_ctx.filteredTasks.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty-tip" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-tip']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
}
else {
    for (const [task] of __VLS_vFor((__VLS_ctx.filteredTasks))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (task.id),
            ...{ class: "task-card" },
        });
        /** @type {__VLS_StyleScopedClasses['task-card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "task-card-header" },
        });
        /** @type {__VLS_StyleScopedClasses['task-card-header']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "task-title-row" },
        });
        /** @type {__VLS_StyleScopedClasses['task-title-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "task-type-badge" },
            ...{ class: (task.type) },
        });
        /** @type {__VLS_StyleScopedClasses['task-type-badge']} */ ;
        (task.type === 'train' ? '🧠 训练' : '⚡ 推理');
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "task-name" },
        });
        /** @type {__VLS_StyleScopedClasses['task-name']} */ ;
        (task.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: (['task-status', task.status.toLowerCase()]) },
        });
        /** @type {__VLS_StyleScopedClasses['task-status']} */ ;
        (__VLS_ctx.statusLabel(task.status));
        if (task.auto_restart) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "restart-badge" },
                title: "自动重启已开启",
            });
            /** @type {__VLS_StyleScopedClasses['restart-badge']} */ ;
            (task.max_retries);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "task-meta" },
        });
        /** @type {__VLS_StyleScopedClasses['task-meta']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        (task.job_id || '-');
        (task.partition);
        (task.nodes);
        (task.cpus);
        if (task.gpus) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (task.gpus);
        }
        if (task.retry_count > 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "retry-count" },
            });
            /** @type {__VLS_StyleScopedClasses['retry-count']} */ ;
            (task.retry_count);
            (task.max_retries);
        }
        if (task.service_port && task.type === 'infer') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "port-badge" },
            });
            /** @type {__VLS_StyleScopedClasses['port-badge']} */ ;
            (task.service_port);
        }
        if (task.type === 'infer' && __VLS_ctx.endpoints[task.id]) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "endpoint-info" },
            });
            /** @type {__VLS_StyleScopedClasses['endpoint-info']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "endpoint-label" },
            });
            /** @type {__VLS_StyleScopedClasses['endpoint-label']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({
                ...{ class: "endpoint-key" },
            });
            /** @type {__VLS_StyleScopedClasses['endpoint-key']} */ ;
            (__VLS_ctx.endpoints[task.id].api_key);
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.filteredTasks.length === 0))
                            return;
                        if (!(task.type === 'infer' && __VLS_ctx.endpoints[task.id]))
                            return;
                        __VLS_ctx.copyText(__VLS_ctx.endpoints[task.id].api_key);
                        // @ts-ignore
                        [loading, filteredTasks, filteredTasks, statusLabel, endpoints, endpoints, endpoints, copyText,];
                    } },
                ...{ class: "btn-copy" },
                title: "复制",
            });
            /** @type {__VLS_StyleScopedClasses['btn-copy']} */ ;
            if (__VLS_ctx.endpoints[task.id].note) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "endpoint-note" },
                });
                /** @type {__VLS_StyleScopedClasses['endpoint-note']} */ ;
                (__VLS_ctx.endpoints[task.id].note);
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.filteredTasks.length === 0))
                            return;
                        if (!(task.type === 'infer' && __VLS_ctx.endpoints[task.id]))
                            return;
                        __VLS_ctx.revokeEndpoint(task);
                        // @ts-ignore
                        [endpoints, endpoints, revokeEndpoint,];
                    } },
                ...{ class: "btn-revoke" },
            });
            /** @type {__VLS_StyleScopedClasses['btn-revoke']} */ ;
        }
        if (task.last_error) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "task-error" },
            });
            /** @type {__VLS_StyleScopedClasses['task-error']} */ ;
            (task.last_error);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "task-card-footer" },
        });
        /** @type {__VLS_StyleScopedClasses['task-card-footer']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "task-time" },
        });
        /** @type {__VLS_StyleScopedClasses['task-time']} */ ;
        (__VLS_ctx.formatTime(task.created_at));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "task-actions" },
        });
        /** @type {__VLS_StyleScopedClasses['task-actions']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    if (!!(__VLS_ctx.filteredTasks.length === 0))
                        return;
                    __VLS_ctx.viewLogs(task);
                    // @ts-ignore
                    [formatTime, viewLogs,];
                } },
            ...{ class: "btn-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        if (task.type === 'infer' && task.status === 'RUNNING' && !__VLS_ctx.endpoints[task.id]) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.filteredTasks.length === 0))
                            return;
                        if (!(task.type === 'infer' && task.status === 'RUNNING' && !__VLS_ctx.endpoints[task.id]))
                            return;
                        __VLS_ctx.openPublishPort(task);
                        // @ts-ignore
                        [endpoints, openPublishPort,];
                    } },
                ...{ class: "btn-sm publish" },
            });
            /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['publish']} */ ;
        }
        if (task.status === 'RUNNING' || task.status === 'PENDING') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.filteredTasks.length === 0))
                            return;
                        if (!(task.status === 'RUNNING' || task.status === 'PENDING'))
                            return;
                        __VLS_ctx.stopTask(task);
                        // @ts-ignore
                        [stopTask,];
                    } },
                ...{ class: "btn-sm danger" },
            });
            /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['danger']} */ ;
        }
        if (task.status === 'FAILED' || task.status === 'COMPLETED') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.filteredTasks.length === 0))
                            return;
                        if (!(task.status === 'FAILED' || task.status === 'COMPLETED'))
                            return;
                        __VLS_ctx.restartTask(task);
                        // @ts-ignore
                        [restartTask,];
                    } },
                ...{ class: "btn-sm" },
            });
            /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    if (!!(__VLS_ctx.filteredTasks.length === 0))
                        return;
                    __VLS_ctx.deleteTask(task);
                    // @ts-ignore
                    [deleteTask,];
                } },
            ...{ class: "btn-sm danger" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['danger']} */ ;
        // @ts-ignore
        [];
    }
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
if (__VLS_ctx.showCreate) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCreate))
                    return;
                __VLS_ctx.showCreate = false;
                // @ts-ignore
                [showCreate, showCreate,];
            } },
        ...{ class: "modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-box" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    (__VLS_ctx.createForm.type === 'train' ? '🧠 新建训练任务' : '⚡ 新建推理服务');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCreate))
                    return;
                __VLS_ctx.showCreate = false;
                // @ts-ignore
                [showCreate, createForm,];
            } },
        ...{ class: "btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "model-tpl-grid" },
    });
    /** @type {__VLS_StyleScopedClasses['model-tpl-grid']} */ ;
    for (const [tpl] of __VLS_vFor((__VLS_ctx.filteredModelTpls))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showCreate))
                        return;
                    __VLS_ctx.applyModelTpl(tpl);
                    // @ts-ignore
                    [filteredModelTpls, applyModelTpl,];
                } },
            key: (tpl.id),
            ...{ class: (['model-tpl-btn', __VLS_ctx.selectedModelTpl === tpl.id ? 'active' : '']) },
        });
        /** @type {__VLS_StyleScopedClasses['model-tpl-btn']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "mtpl-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['mtpl-icon']} */ ;
        (tpl.icon);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "mtpl-name" },
        });
        /** @type {__VLS_StyleScopedClasses['mtpl-name']} */ ;
        (tpl.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "mtpl-tag" },
        });
        /** @type {__VLS_StyleScopedClasses['mtpl-tag']} */ ;
        (tpl.tag);
        // @ts-ignore
        [selectedModelTpl,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-row" },
    });
    /** @type {__VLS_StyleScopedClasses['form-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "my-training-job",
    });
    (__VLS_ctx.createForm.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.createForm.partition),
    });
    for (const [p] of __VLS_vFor((__VLS_ctx.partitions))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (p),
            value: (p),
        });
        (p);
        // @ts-ignore
        [createForm, createForm, partitions,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-row" },
    });
    /** @type {__VLS_StyleScopedClasses['form-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "1",
    });
    (__VLS_ctx.createForm.nodes);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "1",
    });
    (__VLS_ctx.createForm.cpus);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "0",
    });
    (__VLS_ctx.createForm.gpus);
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
    (__VLS_ctx.createForm.memory);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-row" },
    });
    /** @type {__VLS_StyleScopedClasses['form-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "0",
    });
    (__VLS_ctx.createForm.time_limit);
    if (__VLS_ctx.createForm.type === 'infer') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "form-group" },
        });
        /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            placeholder: "8000",
        });
        (__VLS_ctx.createForm.service_port);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "harbor.example.com/library/pytorch:latest",
    });
    (__VLS_ctx.createForm.image);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "/home/user/jobs",
    });
    (__VLS_ctx.createForm.work_dir);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "script-tpl-btns" },
    });
    /** @type {__VLS_StyleScopedClasses['script-tpl-btns']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCreate))
                    return;
                __VLS_ctx.applyScriptTpl('pytorch');
                // @ts-ignore
                [createForm, createForm, createForm, createForm, createForm, createForm, createForm, createForm, createForm, applyScriptTpl,];
            } },
        type: "button",
        ...{ class: "tpl-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['tpl-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCreate))
                    return;
                __VLS_ctx.applyScriptTpl('deepspeed');
                // @ts-ignore
                [applyScriptTpl,];
            } },
        type: "button",
        ...{ class: "tpl-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['tpl-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCreate))
                    return;
                __VLS_ctx.applyScriptTpl('vllm');
                // @ts-ignore
                [applyScriptTpl,];
            } },
        type: "button",
        ...{ class: "tpl-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['tpl-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCreate))
                    return;
                __VLS_ctx.applyScriptTpl('triton');
                // @ts-ignore
                [applyScriptTpl,];
            } },
        type: "button",
        ...{ class: "tpl-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['tpl-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        value: (__VLS_ctx.createForm.script),
        rows: "10",
        ...{ class: "script-editor" },
        spellcheck: "false",
    });
    /** @type {__VLS_StyleScopedClasses['script-editor']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "restart-config-box" },
    });
    /** @type {__VLS_StyleScopedClasses['restart-config-box']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "restart-config-title" },
    });
    /** @type {__VLS_StyleScopedClasses['restart-config-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "restart-config-row" },
    });
    /** @type {__VLS_StyleScopedClasses['restart-config-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "checkbox-label" },
    });
    /** @type {__VLS_StyleScopedClasses['checkbox-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
    });
    (__VLS_ctx.createForm.auto_restart);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "checkbox-label" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['checkbox-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
    });
    (__VLS_ctx.createForm.restart_on_nodes);
    if (__VLS_ctx.createForm.auto_restart) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "restart-opts" },
        });
        /** @type {__VLS_StyleScopedClasses['restart-opts']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "1",
            max: "10",
            ...{ style: {} },
        });
        (__VLS_ctx.createForm.max_retries);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ style: {} },
        });
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-footer" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-footer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.submitCreate) },
        ...{ class: "btn-primary" },
        disabled: (__VLS_ctx.submitting),
    });
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    (__VLS_ctx.submitting ? '提交中...' : '🚀 提交');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCreate))
                    return;
                __VLS_ctx.showCreate = false;
                // @ts-ignore
                [showCreate, createForm, createForm, createForm, createForm, createForm, submitCreate, submitting, submitting,];
            } },
        ...{ class: "btn-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
}
if (__VLS_ctx.showPublish) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showPublish))
                    return;
                __VLS_ctx.showPublish = false;
                // @ts-ignore
                [showPublish, showPublish,];
            } },
        ...{ class: "modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-box" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showPublish))
                    return;
                __VLS_ctx.showPublish = false;
                // @ts-ignore
                [showPublish,];
            } },
        ...{ class: "btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    if (__VLS_ctx.publishResult) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "publish-result" },
        });
        /** @type {__VLS_StyleScopedClasses['publish-result']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "publish-success" },
        });
        /** @type {__VLS_StyleScopedClasses['publish-success']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "publish-field" },
        });
        /** @type {__VLS_StyleScopedClasses['publish-field']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "pf-label" },
        });
        /** @type {__VLS_StyleScopedClasses['pf-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({
            ...{ class: "pf-val" },
        });
        /** @type {__VLS_StyleScopedClasses['pf-val']} */ ;
        (__VLS_ctx.publishResult.port);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "publish-field" },
        });
        /** @type {__VLS_StyleScopedClasses['publish-field']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "pf-label" },
        });
        /** @type {__VLS_StyleScopedClasses['pf-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({
            ...{ class: "pf-val key" },
        });
        /** @type {__VLS_StyleScopedClasses['pf-val']} */ ;
        /** @type {__VLS_StyleScopedClasses['key']} */ ;
        (__VLS_ctx.publishResult.api_key);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showPublish))
                        return;
                    if (!(__VLS_ctx.publishResult))
                        return;
                    __VLS_ctx.copyText(__VLS_ctx.publishResult.api_key);
                    // @ts-ignore
                    [copyText, publishResult, publishResult, publishResult, publishResult,];
                } },
            ...{ class: "btn-copy" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-copy']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "publish-hint" },
        });
        /** @type {__VLS_StyleScopedClasses['publish-hint']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({
            ...{ class: "hint-code" },
        });
        /** @type {__VLS_StyleScopedClasses['hint-code']} */ ;
        (__VLS_ctx.publishResult.port);
        __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
        (__VLS_ctx.publishResult.api_key);
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        (__VLS_ctx.publishTask?.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        (__VLS_ctx.publishTask?.service_port);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "form-group" },
        });
        /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            placeholder: "如：对外测试用",
        });
        (__VLS_ctx.publishNote);
    }
    if (!__VLS_ctx.publishResult) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "modal-footer" },
        });
        /** @type {__VLS_StyleScopedClasses['modal-footer']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.doPublishPort) },
            ...{ class: "btn-primary" },
            disabled: (__VLS_ctx.publishing),
        });
        /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
        (__VLS_ctx.publishing ? '生成中...' : '生成 API Key');
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showPublish))
                        return;
                    if (!(!__VLS_ctx.publishResult))
                        return;
                    __VLS_ctx.showPublish = false;
                    // @ts-ignore
                    [showPublish, publishResult, publishResult, publishResult, publishTask, publishTask, publishNote, doPublishPort, publishing, publishing,];
                } },
            ...{ class: "btn-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "modal-footer" },
        });
        /** @type {__VLS_StyleScopedClasses['modal-footer']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showPublish))
                        return;
                    if (!!(!__VLS_ctx.publishResult))
                        return;
                    __VLS_ctx.showPublish = false;
                    // @ts-ignore
                    [showPublish,];
                } },
            ...{ class: "btn-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    }
}
if (__VLS_ctx.showLog) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showLog))
                    return;
                __VLS_ctx.showLog = false;
                // @ts-ignore
                [showLog, showLog,];
            } },
        ...{ class: "modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-box" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    (__VLS_ctx.logTask?.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showLog))
                    return;
                __VLS_ctx.showLog = false;
                // @ts-ignore
                [showLog, logTask,];
            } },
        ...{ class: "btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    if (__VLS_ctx.logLoading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ style: {} },
        });
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
            ...{ class: "log-content" },
        });
        /** @type {__VLS_StyleScopedClasses['log-content']} */ ;
        (__VLS_ctx.logContent || '（暂无日志）');
    }
}
// @ts-ignore
[logLoading, logContent,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
