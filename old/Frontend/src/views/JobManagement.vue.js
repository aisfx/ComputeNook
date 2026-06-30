/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, inject, onMounted } from 'vue';
import JobInfo from '../components/JobInfo.vue';
import JobSubmit from '../components/JobSubmit.vue';
import JobTemplates from '../components/JobTemplates.vue';
import JobDetailModal from '../components/JobDetailModal.vue';
import { getApiBase } from '../utils/auth';
import { dialog } from '../utils/dialog';
const emit = defineEmits(['open-directory', 'go-registry', 'exec-container']);
inject('jobManagementTab', ref('info'));
const submitOpen = ref(false);
const activePanel = ref('submit');
const selectedJob = ref(null);
const jobSubmitRef = ref(null);
const jobInfoRef = ref(null);
const allTemplates = ref([]);
const getToken = () => localStorage.getItem('token') || sessionStorage.getItem('token');
const loadAllTemplates = async () => {
    try {
        const res = await fetch(`${getApiBase()}/api/app-templates`, {
            headers: { Authorization: `Bearer ${getToken()}` }
        });
        if (!res.ok)
            return;
        const data = await res.json();
        allTemplates.value = (data.data || []).filter((t) => t.showInQuick);
    }
    catch { /* ignore */ }
};
onMounted(loadAllTemplates);
const applyTemplate = (tpl) => {
    activePanel.value = 'submit';
    setTimeout(() => { jobSubmitRef.value?.handleTemplateSelect?.(tpl); }, 50);
};
const handleUseTemplate = (tpl) => {
    activePanel.value = 'submit';
    setTimeout(() => { jobSubmitRef.value?.handleTemplateSelect?.(tpl); }, 50);
};
const handleViewDetail = (job) => { selectedJob.value = job; };
const handleJobSubmitted = () => {
    submitOpen.value = false;
    jobInfoRef.value?.loadJobs();
};
const handleCancel = async (jobId) => {
    if (!await dialog.confirm(`确定要取消作业 ${jobId} 吗？`, { title: '取消作业', danger: true }))
        return;
    try {
        const res = await fetch(`${getApiBase()}/api/jobs/${jobId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${getToken()}` }
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || '取消失败');
        dialog.success(`作业 ${jobId} 已取消`);
        selectedJob.value = null;
    }
    catch (e) {
        dialog.error(`取消失败: ${e.message}`);
    }
};
const handlePause = async (jobId) => {
    if (!await dialog.confirm(`确定要暂停作业 ${jobId} 吗？`, { title: '暂停作业' }))
        return;
    try {
        const res = await fetch(`${getApiBase()}/api/jobs/${jobId}/suspend`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${getToken()}` }
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || '暂停失败');
        dialog.success(`作业 ${jobId} 已暂停`);
        selectedJob.value = null;
    }
    catch (e) {
        dialog.error(`暂停失败: ${e.message}`);
    }
};
const handleOpenDirectory = (path) => { emit('open-directory', path); };
const handleExecContainer = (payload) => {
    // 存入 sessionStorage，WebShell 挂载时读取并自动连接
    sessionStorage.setItem('webshell_auto_connect', JSON.stringify(payload));
    emit('exec-container');
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
/** @type {__VLS_StyleScopedClasses['pane-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['close-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['template-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['template-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['tpl-card']} */ ;
/** @type {__VLS_StyleScopedClasses['templates-pane']} */ ;
/** @type {__VLS_StyleScopedClasses['templates-pane']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "job-management" },
    ...{ class: ({ 'panel-open': __VLS_ctx.submitOpen }) },
});
/** @type {__VLS_StyleScopedClasses['job-management']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-open']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "job-list-pane" },
});
/** @type {__VLS_StyleScopedClasses['job-list-pane']} */ ;
const __VLS_0 = JobInfo;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ 'onViewDetail': {} },
    ...{ 'onOpenDirectory': {} },
    ...{ 'onSubmitJob': {} },
    ref: "jobInfoRef",
}));
const __VLS_2 = __VLS_1({
    ...{ 'onViewDetail': {} },
    ...{ 'onOpenDirectory': {} },
    ...{ 'onSubmitJob': {} },
    ref: "jobInfoRef",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
const __VLS_6 = ({ viewDetail: {} },
    { onViewDetail: (__VLS_ctx.handleViewDetail) });
const __VLS_7 = ({ openDirectory: {} },
    { onOpenDirectory: (__VLS_ctx.handleOpenDirectory) });
const __VLS_8 = ({ submitJob: {} },
    { onSubmitJob: (...[$event]) => {
            __VLS_ctx.submitOpen = true;
            __VLS_ctx.activePanel = 'submit';
            // @ts-ignore
            [submitOpen, submitOpen, handleViewDetail, handleOpenDirectory, activePanel,];
        } });
var __VLS_9 = {};
var __VLS_3;
var __VLS_4;
let __VLS_11;
/** @ts-ignore @type {typeof __VLS_components.transition | typeof __VLS_components.Transition | typeof __VLS_components.transition | typeof __VLS_components.Transition} */
transition;
// @ts-ignore
const __VLS_12 = __VLS_asFunctionalComponent1(__VLS_11, new __VLS_11({
    name: "slide",
}));
const __VLS_13 = __VLS_12({
    name: "slide",
}, ...__VLS_functionalComponentArgsRest(__VLS_12));
const { default: __VLS_16 } = __VLS_14.slots;
if (__VLS_ctx.submitOpen) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "submit-pane" },
    });
    /** @type {__VLS_StyleScopedClasses['submit-pane']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "submit-pane-header" },
    });
    /** @type {__VLS_StyleScopedClasses['submit-pane-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pane-tabs" },
    });
    /** @type {__VLS_StyleScopedClasses['pane-tabs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.submitOpen))
                    return;
                __VLS_ctx.activePanel = 'submit';
                // @ts-ignore
                [submitOpen, activePanel,];
            } },
        ...{ class: (['pane-tab', { active: __VLS_ctx.activePanel === 'submit' }]) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['pane-tab']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.submitOpen))
                    return;
                __VLS_ctx.activePanel = 'templates';
                // @ts-ignore
                [activePanel, activePanel,];
            } },
        ...{ class: (['pane-tab', { active: __VLS_ctx.activePanel === 'templates' }]) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['pane-tab']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.submitOpen))
                    return;
                __VLS_ctx.submitOpen = false;
                // @ts-ignore
                [submitOpen, activePanel,];
            } },
        ...{ class: "close-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['close-btn']} */ ;
    if (__VLS_ctx.activePanel === 'submit') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "template-bar" },
        });
        /** @type {__VLS_StyleScopedClasses['template-bar']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "template-bar-label" },
        });
        /** @type {__VLS_StyleScopedClasses['template-bar-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "template-grid" },
        });
        /** @type {__VLS_StyleScopedClasses['template-grid']} */ ;
        for (const [tpl] of __VLS_vFor((__VLS_ctx.allTemplates))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.submitOpen))
                            return;
                        if (!(__VLS_ctx.activePanel === 'submit'))
                            return;
                        __VLS_ctx.applyTemplate(tpl);
                        // @ts-ignore
                        [activePanel, allTemplates, applyTemplate,];
                    } },
                key: (tpl.id),
                ...{ class: "tpl-card" },
            });
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
                ...{ class: "tpl-meta" },
            });
            /** @type {__VLS_StyleScopedClasses['tpl-meta']} */ ;
            (tpl.cpus);
            (tpl.memory);
            // @ts-ignore
            [];
        }
        const __VLS_17 = JobSubmit;
        // @ts-ignore
        const __VLS_18 = __VLS_asFunctionalComponent1(__VLS_17, new __VLS_17({
            ...{ 'onJobSubmitted': {} },
            ...{ 'onGoRegistry': {} },
            ref: "jobSubmitRef",
        }));
        const __VLS_19 = __VLS_18({
            ...{ 'onJobSubmitted': {} },
            ...{ 'onGoRegistry': {} },
            ref: "jobSubmitRef",
        }, ...__VLS_functionalComponentArgsRest(__VLS_18));
        let __VLS_22;
        const __VLS_23 = ({ jobSubmitted: {} },
            { onJobSubmitted: (__VLS_ctx.handleJobSubmitted) });
        const __VLS_24 = ({ goRegistry: {} },
            { onGoRegistry: (...[$event]) => {
                    if (!(__VLS_ctx.submitOpen))
                        return;
                    if (!(__VLS_ctx.activePanel === 'submit'))
                        return;
                    __VLS_ctx.emit('go-registry');
                    // @ts-ignore
                    [handleJobSubmitted, emit,];
                } });
        var __VLS_25 = {};
        var __VLS_20;
        var __VLS_21;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "templates-pane" },
        });
        /** @type {__VLS_StyleScopedClasses['templates-pane']} */ ;
        const __VLS_27 = JobTemplates;
        // @ts-ignore
        const __VLS_28 = __VLS_asFunctionalComponent1(__VLS_27, new __VLS_27({
            ...{ 'onUseTemplate': {} },
        }));
        const __VLS_29 = __VLS_28({
            ...{ 'onUseTemplate': {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_28));
        let __VLS_32;
        const __VLS_33 = ({ useTemplate: {} },
            { onUseTemplate: (__VLS_ctx.handleUseTemplate) });
        var __VLS_30;
        var __VLS_31;
    }
}
// @ts-ignore
[handleUseTemplate,];
var __VLS_14;
if (__VLS_ctx.selectedJob) {
    const __VLS_34 = JobDetailModal;
    // @ts-ignore
    const __VLS_35 = __VLS_asFunctionalComponent1(__VLS_34, new __VLS_34({
        ...{ 'onClose': {} },
        ...{ 'onPause': {} },
        ...{ 'onCancel': {} },
        ...{ 'onOpenDirectory': {} },
        ...{ 'onExecContainer': {} },
        job: (__VLS_ctx.selectedJob),
    }));
    const __VLS_36 = __VLS_35({
        ...{ 'onClose': {} },
        ...{ 'onPause': {} },
        ...{ 'onCancel': {} },
        ...{ 'onOpenDirectory': {} },
        ...{ 'onExecContainer': {} },
        job: (__VLS_ctx.selectedJob),
    }, ...__VLS_functionalComponentArgsRest(__VLS_35));
    let __VLS_39;
    const __VLS_40 = ({ close: {} },
        { onClose: (...[$event]) => {
                if (!(__VLS_ctx.selectedJob))
                    return;
                __VLS_ctx.selectedJob = null;
                // @ts-ignore
                [selectedJob, selectedJob, selectedJob,];
            } });
    const __VLS_41 = ({ pause: {} },
        { onPause: (__VLS_ctx.handlePause) });
    const __VLS_42 = ({ cancel: {} },
        { onCancel: (__VLS_ctx.handleCancel) });
    const __VLS_43 = ({ openDirectory: {} },
        { onOpenDirectory: (__VLS_ctx.handleOpenDirectory) });
    const __VLS_44 = ({ execContainer: {} },
        { onExecContainer: (__VLS_ctx.handleExecContainer) });
    var __VLS_37;
    var __VLS_38;
}
// @ts-ignore
var __VLS_10 = __VLS_9, __VLS_26 = __VLS_25;
// @ts-ignore
[handleOpenDirectory, handlePause, handleCancel, handleExecContainer,];
const __VLS_export = (await import('vue')).defineComponent({
    emits: {},
});
export default {};
