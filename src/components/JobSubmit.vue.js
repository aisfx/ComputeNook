/// <reference types="../../node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, onMounted } from 'vue';
import { getUser } from '../utils/auth';
import { fileManagerApi } from '../config/api';
import notification from '../utils/notification';
const emit = defineEmits(['job-submitted']);
const currentUser = ref(null);
const selectedTemplate = ref(null);
const selectedTemplateData = ref(null);
const scriptFiles = ref([]);
const partitions = ref([]);
const loadingPartitions = ref(false);
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
const templates = ref([
    {
        id: 1,
        name: 'GPU 训练模板',
        partition: 'gpu',
        nodes: 1,
        cpus: 8,
        memory: 32,
        gpus: 4,
        time: 24,
        priority: 'normal',
        workdir: '/home/admin/jobs/gpu_training',
        script: '/home/admin/scripts/train.sh',
        output: 'train_output.log',
        error: 'train_error.log',
        extraParams: '--gres=gpu:4'
    },
    {
        id: 2,
        name: 'CPU 计算模板',
        partition: 'compute',
        nodes: 4,
        cpus: 32,
        memory: 64,
        gpus: 0,
        time: 12,
        priority: 'normal',
        workdir: '/home/admin/jobs/compute',
        script: '/home/admin/scripts/compute.sh',
        output: 'compute_output.log',
        error: 'compute_error.log',
        extraParams: ''
    },
    {
        id: 3,
        name: '数据分析模板',
        partition: 'compute',
        nodes: 2,
        cpus: 16,
        memory: 128,
        gpus: 0,
        time: 6,
        priority: 'normal',
        workdir: '/home/admin/jobs/analysis',
        script: '/home/admin/scripts/analyze.sh',
        output: 'analysis_output.log',
        error: 'analysis_error.log',
        extraParams: '--mem-per-cpu=8G'
    },
    {
        id: 4,
        name: '快速调试模板',
        partition: 'debug',
        nodes: 1,
        cpus: 4,
        memory: 8,
        gpus: 0,
        time: 1,
        priority: 'high',
        workdir: '/home/admin/jobs/debug',
        script: '/home/admin/scripts/debug.sh',
        output: 'debug_output.log',
        error: 'debug_error.log',
        extraParams: ''
    }
]);
const form = ref({
    name: '',
    partition: 'compute',
    nodes: 1,
    cpus: 8,
    memory: 0,
    gpus: 0,
    time: 0,
    priority: 'normal',
    workdir: '',
    script: '',
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
        const response = await fetch('http://localhost:8080/api/jobs/partitions/list', {
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
    form.value = {
        name: '',
        partition: template.partition,
        nodes: template.nodes,
        cpus: template.cpus,
        memory: template.memory,
        gpus: template.gpus,
        time: template.time,
        priority: template.priority,
        workdir: template.workdir,
        script: template.script,
        output: template.output,
        error: template.error,
        extraParams: template.extraParams
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
        priority: 'normal',
        workdir: homeDir,
        script: '',
        output: '',
        error: '',
        extraParams: ''
    };
};
const submitJob = async () => {
    submitting.value = true;
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            notification.error('请先登录系统');
            submitting.value = false;
            return;
        }
        // 读取脚本文件内容
        let scriptContent = '';
        if (form.value.script) {
            try {
                const scriptResponse = await fetch(`${fileManagerApi.read()}?path=${encodeURIComponent(form.value.script)}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!scriptResponse.ok) {
                    throw new Error('无法读取脚本文件，请确认文件路径正确');
                }
                const scriptData = await scriptResponse.json();
                scriptContent = scriptData.content || '';
                if (!scriptContent) {
                    throw new Error('脚本文件为空');
                }
                console.log('Script content loaded, length:', scriptContent.length);
            }
            catch (err) {
                notification.error(err.message || '读取脚本文件失败');
                submitting.value = false;
                return;
            }
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
            time: form.value.time || 0, // 0 表示不限制
            priority: form.value.priority,
            extra_params: form.value.extraParams
        };
        // 不发送workdir、output、error，让Slurm使用默认值
        // 这样可以避免路径权限问题
        console.log('Submitting job with script content length:', scriptContent.length);
        console.log('Using Slurm default paths for working directory and output files');
        const response = await fetch('http://localhost:8080/api/jobs', {
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
    // 不自动设置workdir，让Slurm使用默认值
    // 用户可以根据需要手动填写
    loadPartitions();
    loadScriptFiles();
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
/** @type {__VLS_StyleScopedClasses['submit-header']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-form']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-form']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-form']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-form']} */ ;
/** @type {__VLS_StyleScopedClasses['template-selector']} */ ;
/** @type {__VLS_StyleScopedClasses['template-select']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-form']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-form']} */ ;
/** @type {__VLS_StyleScopedClasses['input-with-button']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['script-input']} */ ;
/** @type {__VLS_StyleScopedClasses['form-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-header']} */ ;
/** @type {__VLS_StyleScopedClasses['template-selector']} */ ;
/** @type {__VLS_StyleScopedClasses['template-select']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card job-submit" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['job-submit']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "submit-header" },
});
/** @type {__VLS_StyleScopedClasses['submit-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "template-selector" },
});
/** @type {__VLS_StyleScopedClasses['template-selector']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: (__VLS_ctx.applyTemplate) },
    value: (__VLS_ctx.selectedTemplate),
    ...{ class: "template-select" },
});
/** @type {__VLS_StyleScopedClasses['template-select']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
for (const [template] of __VLS_vFor((__VLS_ctx.templates))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (template.id),
        value: (template.id),
    });
    (template.name);
    // @ts-ignore
    [applyTemplate, selectedTemplate, templates,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
    ...{ onSubmit: (__VLS_ctx.submitJob) },
    ...{ class: "submit-form" },
});
/** @type {__VLS_StyleScopedClasses['submit-form']} */ ;
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
for (const [partition] of __VLS_vFor((__VLS_ctx.partitions))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (partition.name),
        value: (partition.name),
    });
    (partition.name);
    (partition.state);
    // @ts-ignore
    [submitJob, form, form, loadingPartitions, loadingPartitions, partitions,];
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
    ...{ class: "form-group" },
});
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "0",
    placeholder: "不限制",
});
(__VLS_ctx.form.memory);
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
    placeholder: "不限制",
});
(__VLS_ctx.form.time);
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
    value: (__VLS_ctx.form.priority),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "normal",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "high",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "low",
});
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
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "script-selector" },
});
/** @type {__VLS_StyleScopedClasses['script-selector']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    value: (__VLS_ctx.form.script),
    type: "text",
    ...{ class: "script-input" },
    placeholder: "输入脚本路径或从列表选择",
    list: "script-files",
    required: true,
});
/** @type {__VLS_StyleScopedClasses['script-input']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.datalist, __VLS_intrinsics.datalist)({
    id: "script-files",
});
for (const [file, index] of __VLS_vFor((__VLS_ctx.scriptFiles))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (index),
        value: (file.path),
    });
    (file.name);
    // @ts-ignore
    [form, form, form, form, form, form, form, form, resetToHomeDir, scriptFiles,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.loadScriptFiles) },
    type: "button",
    ...{ class: "btn-secondary btn-small" },
});
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "help-text" },
});
/** @type {__VLS_StyleScopedClasses['help-text']} */ ;
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
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "form-group" },
});
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
    value: (__VLS_ctx.form.extraParams),
    rows: "3",
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
(__VLS_ctx.submitting ? '提交中...' : '🚀 提交作业');
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.resetForm) },
    type: "button",
    ...{ class: "btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
// @ts-ignore
[form, form, form, loadScriptFiles, submitting, submitting, resetForm,];
const __VLS_export = (await import('vue')).defineComponent({
    setup: () => (__VLS_exposed),
    emits: {},
});
export default {};
