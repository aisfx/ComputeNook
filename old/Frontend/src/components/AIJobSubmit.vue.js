/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted, watch } from 'vue';
import { getApiBase } from '../utils/auth';
import notification from '../utils/notification';
const props = defineProps();
const emit = defineEmits(['submitted']);
const submitting = ref(false);
const showPicker = ref(false);
const pickerSearch = ref('');
const loadingImages = ref(false);
const partitions = ref(['gpu']);
const selectedTpl = ref('');
const allImages = ref([]);
const filteredImages = computed(() => pickerSearch.value ? allImages.value.filter(i => i.name.includes(pickerSearch.value) || i.addr.includes(pickerSearch.value)) : allImages.value);
const form = ref({ name: '', partition: '', nodes: 1, cpus: 8, gpus: 1, memory: 0, time: 0, image: '', workdir: '', script: '', servicePort: 8000, autoRestart: true, maxRetries: 3 });
const trainTpls = [{ id: 'pytorch', icon: '🔥', name: 'PyTorch DDP', tag: '多机多卡', gpus: 8, cpus: 32, memory: 128, nodes: 1, script: '#!/bin/bash\n#SBATCH -o slurm-%j.out\nMASTER=\\nsrun torchrun --nproc_per_node=\ --nnodes=\ --node_rank=\ --master_addr=\ --master_port=29500 train.py' }, { id: 'deepspeed', icon: '⚡', name: 'DeepSpeed', tag: 'ZeRO-3', gpus: 8, cpus: 32, memory: 128, nodes: 1, script: '#!/bin/bash\n#SBATCH -o slurm-%j.out\nMASTER=\\nsrun deepspeed --num_nodes=\ --num_gpus=\ --master_addr=\ train_ds.py --deepspeed ds_zero3.json' }];
const inferTpls = [{ id: 'vllm', icon: '', name: 'vLLM', tag: 'OpenAI API', gpus: 4, cpus: 16, memory: 64, nodes: 1, script: '#!/bin/bash\n#SBATCH -o slurm-%j.out\npython -m vllm.entrypoints.openai.api_server --model /data/models/llama3 --host 0.0.0.0 --port 8000' }, { id: 'triton', icon: '', name: 'Triton', tag: '高性能', gpus: 2, cpus: 8, memory: 32, nodes: 1, script: '#!/bin/bash\n#SBATCH -o slurm-%j.out\ntritonserver --model-repository=/data/triton_models --http-port=8000' }];
const templates = computed(() => props.type === 'train' ? trainTpls : inferTpls);
const applyTpl = (tpl) => { selectedTpl.value = tpl.id; form.value.gpus = tpl.gpus; form.value.cpus = tpl.cpus; form.value.memory = tpl.memory; form.value.nodes = tpl.nodes; form.value.script = tpl.script; if (!form.value.name)
    form.value.name = tpl.id + '-job'; };
// 更新脚本内容中的 SBATCH 参数
const updateScriptParams = () => {
    let script = form.value.script;
    if (!script || !script.includes('#SBATCH'))
        return;
    // 更新作业名称
    if (form.value.name) {
        if (script.includes('#SBATCH -J ')) {
            script = script.replace(/#SBATCH\s+-J\s+\S+/g, `#SBATCH -J ${form.value.name}`);
        }
        else {
            script = script.replace('#!/bin/bash\n', `#!/bin/bash\n#SBATCH -J ${form.value.name}\n`);
        }
    }
    // 更新分区
    if (form.value.partition) {
        if (script.includes('#SBATCH -p ')) {
            script = script.replace(/#SBATCH\s+-p\s+\S+/g, `#SBATCH -p ${form.value.partition}`);
        }
        else {
            const jobLine = script.match(/#SBATCH\s+-J\s+\S+/);
            if (jobLine) {
                script = script.replace(/(#SBATCH\s+-J\s+\S+)/g, `$1\n#SBATCH -p ${form.value.partition}`);
            }
        }
    }
    // 更新节点数
    if (script.includes('#SBATCH -N ')) {
        script = script.replace(/#SBATCH\s+-N\s+\d+/g, `#SBATCH -N ${form.value.nodes}`);
    }
    else {
        const partLine = script.match(/#SBATCH\s+-p\s+\S+/);
        if (partLine) {
            script = script.replace(/(#SBATCH\s+-p\s+\S+)/g, `$1\n#SBATCH -N ${form.value.nodes}`);
        }
    }
    // 更新 CPU 核心数
    if (script.includes('#SBATCH -c ')) {
        script = script.replace(/#SBATCH\s+-c\s+\d+/g, `#SBATCH -c ${form.value.cpus}`);
    }
    else if (script.includes('#SBATCH --ntasks-per-node=')) {
        script = script.replace(/#SBATCH\s+--ntasks-per-node=\d+/g, `#SBATCH --ntasks-per-node=${form.value.cpus}`);
    }
    else {
        const nodeLine = script.match(/#SBATCH\s+-N\s+\d+/);
        if (nodeLine) {
            script = script.replace(/(#SBATCH\s+-N\s+\d+)/g, `$1\n#SBATCH -c ${form.value.cpus}`);
        }
    }
    // 更新内存
    if (form.value.memory > 0) {
        if (script.includes('#SBATCH --mem=')) {
            script = script.replace(/#SBATCH\s+--mem=\d+G?/g, `#SBATCH --mem=${form.value.memory}G`);
        }
        else {
            const cpuLine = script.match(/#SBATCH\s+-c\s+\d+/);
            if (cpuLine) {
                script = script.replace(/(#SBATCH\s+-c\s+\d+)/g, `$1\n#SBATCH --mem=${form.value.memory}G`);
            }
        }
    }
    else {
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
    if (form.value.gpus > 0) {
        if (script.includes('#SBATCH --gres=gpu:')) {
            script = script.replace(/#SBATCH\s+--gres=gpu:\d+/g, `#SBATCH --gres=gpu:${form.value.gpus}`);
        }
        else {
            const memLine = script.match(/#SBATCH\s+--mem=\d+G?/);
            if (memLine) {
                script = script.replace(/(#SBATCH\s+--mem=\d+G?)/g, `$1\n#SBATCH --gres=gpu:${form.value.gpus}`);
            }
        }
    }
    else {
        script = script.replace(/\n?#SBATCH\s+--gres=gpu:\d+\n?/g, '\n');
    }
    // 清理多余的空行
    script = script.replace(/\n{3,}/g, '\n\n');
    form.value.script = script;
};
// 监听表单参数变化，自动更新脚本内容
watch(() => [
    form.value.name,
    form.value.partition,
    form.value.nodes,
    form.value.cpus,
    form.value.memory,
    form.value.time,
    form.value.gpus
], () => {
    updateScriptParams();
}, { deep: true });
const token = () => localStorage.getItem('token') || sessionStorage.getItem('token');
const loadPartitions = async () => { try {
    const r = await fetch(getApiBase() + '/api/jobs/partitions/list', { headers: { Authorization: 'Bearer ' + token() } });
    const d = await r.json();
    const l = (d.data || []).map((p) => p.name).filter(Boolean);
    if (l.length) {
        partitions.value = l;
        form.value.partition = l[0];
    }
}
catch {
    form.value.partition = 'gpu';
} };
const loadImages = async () => { loadingImages.value = true; try {
    const cr = await fetch(getApiBase() + '/api/registry/config', { headers: { Authorization: 'Bearer ' + token() } });
    const cfg = await cr.json();
    const h = (cfg.harbor_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    const pr = await fetch(getApiBase() + '/api/registry/projects', { headers: { Authorization: 'Bearer ' + token() } });
    const pd = await pr.json();
    const imgs = [];
    await Promise.all((pd.data || []).map(async (proj) => { try {
        const res = await fetch(getApiBase() + '/api/registry/projects/' + proj.name + '/repositories', { headers: { Authorization: 'Bearer ' + token() } });
        if (!res.ok)
            return;
        const data = await res.json();
        for (const repo of (data.data || [])) {
            const n = repo.name?.split('/').pop() || '';
            if (n)
                imgs.push({ name: proj.name + '/' + n, addr: h + '/' + proj.name + '/' + n + ':latest' });
        }
    }
    catch { } }));
    allImages.value = imgs;
}
catch { }
finally {
    loadingImages.value = false;
} };
const submit = async () => { if (!form.value.name.trim() || !form.value.script.trim()) {
    notification.error('请填写任务名称和脚本');
    return;
} ; submitting.value = true; try {
    let script = form.value.script;
    if (form.value.image) {
        script = script.replace('#!/bin/bash\n', '#!/bin/bash\n#SBATCH --container-image=' + form.value.image + '\n');
    }
    ;
    const res = await fetch(getApiBase() + '/api/jobs', { method: 'POST', headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.value.name, partition: form.value.partition, script, nodes: form.value.nodes, cpus: form.value.cpus, memory: form.value.memory || 0, gpus: form.value.gpus || 0, time: form.value.time || 0 }) });
    if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || '提交失败');
    }
    ;
    const r = await res.json();
    notification.success('作业提交成功！ID: ' + r.job_id);
    emit('submitted');
}
catch (e) {
    notification.error(e.message);
}
finally {
    submitting.value = false;
} };
onMounted(() => { loadPartitions(); loadImages(); });
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
/** @type {__VLS_StyleScopedClasses['tpl-card']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['input-row']} */ ;
/** @type {__VLS_StyleScopedClasses['picker-item']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "ai-submit-form" },
});
/** @type {__VLS_StyleScopedClasses['ai-submit-form']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "tpl-section" },
});
/** @type {__VLS_StyleScopedClasses['tpl-section']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "tpl-label" },
});
/** @type {__VLS_StyleScopedClasses['tpl-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "tpl-grid" },
});
/** @type {__VLS_StyleScopedClasses['tpl-grid']} */ ;
for (const [tpl] of __VLS_vFor((__VLS_ctx.templates))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.applyTpl(tpl);
                // @ts-ignore
                [templates, applyTpl,];
            } },
        key: (tpl.id),
        ...{ class: (['tpl-card', { active: __VLS_ctx.selectedTpl === tpl.id }]) },
        type: "button",
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['tpl-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tpl-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['tpl-icon']} */ ;
    (tpl.icon);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tpl-name" },
    });
    /** @type {__VLS_StyleScopedClasses['tpl-name']} */ ;
    (tpl.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tpl-tag" },
    });
    /** @type {__VLS_StyleScopedClasses['tpl-tag']} */ ;
    (tpl.tag);
    // @ts-ignore
    [selectedTpl,];
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
    placeholder: "my-ai-job",
    required: true,
});
(__VLS_ctx.form.name);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "form-group" },
});
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_ctx.form.partition),
});
for (const [p] of __VLS_vFor((__VLS_ctx.partitions))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (p),
        value: (p),
    });
    (p);
    // @ts-ignore
    [form, form, partitions,];
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
(__VLS_ctx.form.nodes);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "form-group" },
});
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "1",
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
});
(__VLS_ctx.form.gpus);
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
(__VLS_ctx.form.time);
if (__VLS_ctx.type === 'infer') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        placeholder: "8000",
    });
    (__VLS_ctx.form.servicePort);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "form-group" },
});
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "input-row" },
});
/** @type {__VLS_StyleScopedClasses['input-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    placeholder: "harbor.example.com/library/pytorch:latest",
});
(__VLS_ctx.form.image);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showPicker = !__VLS_ctx.showPicker;
            // @ts-ignore
            [form, form, form, form, form, form, form, type, showPicker, showPicker,];
        } },
    type: "button",
    ...{ class: "btn-pick" },
});
/** @type {__VLS_StyleScopedClasses['btn-pick']} */ ;
if (__VLS_ctx.showPicker) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "image-picker" },
    });
    /** @type {__VLS_StyleScopedClasses['image-picker']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "picker-search" },
    });
    /** @type {__VLS_StyleScopedClasses['picker-search']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "搜索镜像...",
        ...{ class: "picker-input" },
    });
    (__VLS_ctx.pickerSearch);
    /** @type {__VLS_StyleScopedClasses['picker-input']} */ ;
    if (__VLS_ctx.loadingImages) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "picker-empty" },
        });
        /** @type {__VLS_StyleScopedClasses['picker-empty']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "picker-list" },
        });
        /** @type {__VLS_StyleScopedClasses['picker-list']} */ ;
        if (__VLS_ctx.filteredImages.length === 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "picker-empty" },
            });
            /** @type {__VLS_StyleScopedClasses['picker-empty']} */ ;
        }
        for (const [img] of __VLS_vFor((__VLS_ctx.filteredImages))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.showPicker))
                            return;
                        if (!!(__VLS_ctx.loadingImages))
                            return;
                        __VLS_ctx.form.image = img.addr;
                        __VLS_ctx.showPicker = false;
                        // @ts-ignore
                        [form, showPicker, showPicker, pickerSearch, loadingImages, filteredImages, filteredImages,];
                    } },
                key: (img.addr),
                ...{ class: "picker-item" },
            });
            /** @type {__VLS_StyleScopedClasses['picker-item']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "picker-img-name" },
            });
            /** @type {__VLS_StyleScopedClasses['picker-img-name']} */ ;
            (img.name);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "picker-img-addr" },
            });
            /** @type {__VLS_StyleScopedClasses['picker-img-addr']} */ ;
            (img.addr);
            // @ts-ignore
            [];
        }
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "form-group" },
});
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    placeholder: "/home/user/jobs",
});
(__VLS_ctx.form.workdir);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "form-group" },
});
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (__VLS_ctx.form.script),
    rows: "10",
    ...{ class: "script-editor" },
    spellcheck: "false",
});
/** @type {__VLS_StyleScopedClasses['script-editor']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "restart-row" },
});
/** @type {__VLS_StyleScopedClasses['restart-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "checkbox-label" },
});
/** @type {__VLS_StyleScopedClasses['checkbox-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
});
(__VLS_ctx.form.autoRestart);
if (__VLS_ctx.form.autoRestart) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "restart-opts" },
    });
    /** @type {__VLS_StyleScopedClasses['restart-opts']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "1",
        max: "10",
        ...{ style: {} },
    });
    (__VLS_ctx.form.maxRetries);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "form-actions" },
});
/** @type {__VLS_StyleScopedClasses['form-actions']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.submit) },
    type: "button",
    ...{ class: "btn-primary" },
    disabled: (__VLS_ctx.submitting),
});
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
(__VLS_ctx.submitting ? '提交中...' : ' 提交');
// @ts-ignore
[form, form, form, form, form, submit, submitting, submitting,];
const __VLS_export = (await import('vue')).defineComponent({
    emits: {},
    __typeProps: {},
});
export default {};
