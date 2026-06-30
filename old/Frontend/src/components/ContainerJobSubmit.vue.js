/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted } from 'vue';
import { getApiBase, getUser } from '../utils/auth';
import notification from '../utils/notification';
const props = defineProps();
const emit = defineEmits(['submitted', 'go-registry']);
const submitting = ref(false);
const showPicker = ref(false);
const pickerSearch = ref('');
const loadingImages = ref(false);
const partitions = ref([]);
const allImages = ref([]);
const filteredImages = computed(() => pickerSearch.value
    ? allImages.value.filter(i => i.name.includes(pickerSearch.value) || i.addr.includes(pickerSearch.value))
    : allImages.value);
const groupedImages = computed(() => ({
    public: filteredImages.value.filter(i => i.isPublic),
    private: filteredImages.value.filter(i => !i.isPublic)
}));
const currentUser = getUser();
const homeDir = currentUser?.homeDir || `/home/${currentUser?.username || '$USER'}`;
const form = ref({
    image: props.initialImage || '',
    name: 'container_job',
    partition: '',
    nodes: 1,
    cpus: 8,
    memory: 0,
    gpus: 0,
    mounts: `${homeDir}:${homeDir}`,
    workdir: homeDir,
    command: '',
    keepAlive: false,
    time: 0,
});
const generatedScript = computed(() => {
    const f = form.value;
    // 构建 srun container 参数（在脚本体内用 srun 启动，避免 REST API 提交时 #SBATCH 被 job 对象覆盖）
    const srunArgs = [
        `--container-image=${f.image}`,
    ];
    if (f.mounts)
        srunArgs.push(`--container-mounts=${f.mounts}`);
    if (f.workdir)
        srunArgs.push(`--container-workdir=${f.workdir}`);
    const lines = [
        '#!/bin/bash',
        `#SBATCH -J ${f.name || 'container_job'}`,
        `#SBATCH -p ${f.partition || 'compute'}`,
        `#SBATCH -N ${f.nodes}`,
        `#SBATCH -c ${f.cpus}`,
    ];
    if (f.memory > 0)
        lines.push(`#SBATCH --mem=${f.memory}G`);
    if (f.gpus > 0)
        lines.push(`#SBATCH --gres=gpu:${f.gpus}`);
    if (f.time > 0) {
        const timeStr = `${String(f.time).padStart(2, '0')}:00:00`;
        lines.push(`#SBATCH -t ${timeStr}`);
    }
    lines.push('');
    lines.push('echo "Container job started: $(date)"');
    lines.push(`echo "Image: ${f.image}"`);
    lines.push('');
    const srunPrefix = `srun ${srunArgs.join(' ')}`;
    if (f.command) {
        lines.push(`${srunPrefix} bash -c ${JSON.stringify(f.command)}`);
        if (f.keepAlive) {
            lines.push('');
            lines.push('# 保持容器运行，方便通过 Web Shell 进入调试');
            lines.push(`${srunPrefix} sleep infinity`);
        }
    }
    else {
        lines.push('# 交互模式 - 通过 Web Shell 连接到此作业节点');
        lines.push(`${srunPrefix} sleep infinity`);
    }
    lines.push('');
    lines.push('echo "Job finished: $(date)"');
    return lines.join('\n');
});
const loadPartitions = async () => {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const res = await fetch(`${getApiBase()}/api/jobs/partitions/list`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok)
            return;
        const data = await res.json();
        partitions.value = (data.data || []).map((p) => p.name).filter(Boolean);
        if (partitions.value.length > 0 && !form.value.partition) {
            form.value.partition = partitions.value[0];
        }
    }
    catch {
        partitions.value = ['compute', 'gpu', 'memory', 'debug'];
        form.value.partition = 'compute';
    }
};
const loadImages = async () => {
    loadingImages.value = true;
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const cfgRes = await fetch(`${getApiBase()}/api/registry/config`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const cfg = await cfgRes.json();
        const harborHost = (cfg.harbor_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
        const publicProjects = cfg.public_projects || ['library'];
        const projRes = await fetch(`${getApiBase()}/api/registry/projects`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const projData = await projRes.json();
        const projects = projData.data || [];
        const images = [];
        await Promise.all(projects.map(async (proj) => {
            try {
                const res = await fetch(`${getApiBase()}/api/registry/projects/${proj.name}/repositories`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!res.ok)
                    return;
                const data = await res.json();
                for (const repo of (data.data || [])) {
                    const repoShortName = repo.name?.split('/').pop() || '';
                    if (!repoShortName)
                        continue;
                    const isPublic = !!proj.is_public_project || publicProjects.includes(proj.name);
                    // 拉取该 repo 的真实 tag 列表
                    try {
                        const tagRes = await fetch(`${getApiBase()}/api/registry/projects/${proj.name}/repositories/${repoShortName}/tags`, { headers: { Authorization: `Bearer ${token}` } });
                        if (tagRes.ok) {
                            const tagData = await tagRes.json();
                            const artifacts = tagData.data || [];
                            // 每个 artifact 可能有多个 tag
                            const tags = [];
                            for (const artifact of artifacts) {
                                for (const t of (artifact.tags || [])) {
                                    if (t.name)
                                        tags.push(t.name);
                                }
                            }
                            if (tags.length > 0) {
                                for (const tag of tags) {
                                    images.push({
                                        name: `${proj.name}/${repoShortName}:${tag}`,
                                        addr: `${harborHost}/${proj.name}/${repoShortName}:${tag}`,
                                        project: proj.name,
                                        isPublic,
                                    });
                                }
                                continue;
                            }
                        }
                    }
                    catch { /* ignore, fall through to :latest */ }
                    // 拿不到 tag 时降级用 :latest
                    images.push({
                        name: `${proj.name}/${repoShortName}`,
                        addr: `${harborHost}/${proj.name}/${repoShortName}:latest`,
                        project: proj.name,
                        isPublic,
                    });
                }
            }
            catch { /* ignore */ }
        }));
        allImages.value = images;
    }
    catch { /* ignore */ }
    finally {
        loadingImages.value = false;
    }
};
const submit = async () => {
    submitting.value = true;
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const res = await fetch(`${getApiBase()}/api/jobs`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: form.value.name,
                partition: form.value.partition,
                script: generatedScript.value,
                nodes: form.value.nodes,
                cpus: form.value.cpus,
                memory: form.value.memory || 0,
                gpus: form.value.gpus || 0,
                time: form.value.time || 0,
            })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || '提交失败');
        }
        const result = await res.json();
        notification.success(`容器作业提交成功！作业ID: ${result.job_id}`);
        emit('submitted');
    }
    catch (e) {
        notification.error(e.message || '提交失败');
    }
    finally {
        submitting.value = false;
    }
};
onMounted(() => {
    loadPartitions();
    loadImages();
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
/** @type {__VLS_StyleScopedClasses['container-form']} */ ;
/** @type {__VLS_StyleScopedClasses['container-form']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['input-row']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-pick']} */ ;
/** @type {__VLS_StyleScopedClasses['picker-item']} */ ;
/** @type {__VLS_StyleScopedClasses['help-text']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "container-wrap" },
});
/** @type {__VLS_StyleScopedClasses['container-wrap']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
    ...{ onSubmit: (__VLS_ctx.submit) },
    ...{ class: "container-form" },
});
/** @type {__VLS_StyleScopedClasses['container-form']} */ ;
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
    value: (__VLS_ctx.form.image),
    type: "text",
    placeholder: "harbor.example.com/library/pytorch:latest",
    required: true,
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showPicker = !__VLS_ctx.showPicker;
            // @ts-ignore
            [submit, form, showPicker, showPicker,];
        } },
    type: "button",
    ...{ class: "btn-pick" },
});
/** @type {__VLS_StyleScopedClasses['btn-pick']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('go-registry');
            // @ts-ignore
            [emit,];
        } },
    type: "button",
    ...{ class: "btn-pick" },
    title: "前往镜像仓库",
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
        if (__VLS_ctx.filteredImages.length > 0) {
            if (__VLS_ctx.groupedImages.public.length > 0) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "picker-group-label" },
                });
                /** @type {__VLS_StyleScopedClasses['picker-group-label']} */ ;
            }
            for (const [img] of __VLS_vFor((__VLS_ctx.groupedImages.public))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.showPicker))
                                return;
                            if (!!(__VLS_ctx.loadingImages))
                                return;
                            if (!(__VLS_ctx.filteredImages.length > 0))
                                return;
                            __VLS_ctx.form.image = img.addr;
                            __VLS_ctx.showPicker = false;
                            // @ts-ignore
                            [form, showPicker, showPicker, pickerSearch, loadingImages, filteredImages, groupedImages, groupedImages,];
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
            if (__VLS_ctx.groupedImages.private.length > 0) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "picker-group-label" },
                });
                /** @type {__VLS_StyleScopedClasses['picker-group-label']} */ ;
            }
            for (const [img] of __VLS_vFor((__VLS_ctx.groupedImages.private))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.showPicker))
                                return;
                            if (!!(__VLS_ctx.loadingImages))
                                return;
                            if (!(__VLS_ctx.filteredImages.length > 0))
                                return;
                            __VLS_ctx.form.image = img.addr;
                            __VLS_ctx.showPicker = false;
                            // @ts-ignore
                            [form, showPicker, groupedImages, groupedImages,];
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
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "picker-empty" },
            });
            /** @type {__VLS_StyleScopedClasses['picker-empty']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.showPicker))
                            return;
                        if (!!(__VLS_ctx.loadingImages))
                            return;
                        if (!!(__VLS_ctx.filteredImages.length > 0))
                            return;
                        __VLS_ctx.emit('go-registry');
                        __VLS_ctx.showPicker = false;
                        // @ts-ignore
                        [showPicker, emit,];
                    } },
                ...{ class: "picker-link" },
            });
            /** @type {__VLS_StyleScopedClasses['picker-link']} */ ;
        }
    }
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
    value: (__VLS_ctx.form.name),
    type: "text",
    placeholder: "container_job",
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
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
    disabled: true,
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
    max: "32",
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
    max: "256",
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
    max: "16",
});
(__VLS_ctx.form.gpus);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "form-group" },
});
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    value: (__VLS_ctx.form.mounts),
    type: "text",
    placeholder: "/home/$USER:/workspace,/data:/data",
});
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
    value: (__VLS_ctx.form.workdir),
    type: "text",
    placeholder: "/workspace",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "form-group" },
});
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    value: (__VLS_ctx.form.command),
    type: "text",
    placeholder: "python /workspace/train.py",
});
if (!__VLS_ctx.form.command) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "help-text" },
    });
    /** @type {__VLS_StyleScopedClasses['help-text']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "help-text warn" },
    });
    /** @type {__VLS_StyleScopedClasses['help-text']} */ ;
    /** @type {__VLS_StyleScopedClasses['warn']} */ ;
}
if (__VLS_ctx.form.command) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "checkbox-label" },
    });
    /** @type {__VLS_StyleScopedClasses['checkbox-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
    });
    (__VLS_ctx.form.keepAlive);
}
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
    ...{ class: "form-group" },
});
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "script-preview" },
});
/** @type {__VLS_StyleScopedClasses['script-preview']} */ ;
(__VLS_ctx.generatedScript);
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
(__VLS_ctx.submitting ? '提交中...' : '🚀 提交容器作业');
// @ts-ignore
[form, form, form, form, form, form, form, form, form, form, form, generatedScript, submitting, submitting,];
const __VLS_export = (await import('vue')).defineComponent({
    emits: {},
    __typeProps: {},
});
export default {};
