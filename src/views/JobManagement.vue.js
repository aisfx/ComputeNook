/// <reference types="../../node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, inject } from 'vue';
import JobInfo from '../components/JobInfo.vue';
import JobSubmit from '../components/JobSubmit.vue';
import JobTemplates from '../components/JobTemplates.vue';
import JobDetailModal from '../components/JobDetailModal.vue';
const emit = defineEmits(['open-directory']);
const currentTab = inject('jobManagementTab', ref('info'));
const selectedJob = ref(null);
const jobSubmitRef = ref(null);
const handleViewDetail = (job) => {
    selectedJob.value = job;
};
const handleUseTemplate = (template) => {
    // 切换到提交作业页面
    currentTab.value = 'submit';
    // 等待组件渲染后应用模板
    setTimeout(() => {
        if (jobSubmitRef.value && jobSubmitRef.value.handleTemplateSelect) {
            jobSubmitRef.value.handleTemplateSelect(template);
        }
    }, 100);
};
const handlePause = (jobId) => {
    console.log('暂停作业:', jobId);
    alert(`作业 ${jobId} 已暂停`);
    selectedJob.value = null;
};
const handleCancel = (jobId) => {
    if (confirm(`确定要取消作业 ${jobId} 吗？`)) {
        console.log('取消作业:', jobId);
        alert(`作业 ${jobId} 已取消`);
        selectedJob.value = null;
    }
};
const handleOpenDirectory = (path) => {
    // 转发事件到父组件（App.vue）
    emit('open-directory', path);
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
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "job-management" },
});
/** @type {__VLS_StyleScopedClasses['job-management']} */ ;
if (__VLS_ctx.currentTab === 'info') {
    const __VLS_0 = JobInfo;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ 'onViewDetail': {} },
        ...{ 'onOpenDirectory': {} },
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onViewDetail': {} },
        ...{ 'onOpenDirectory': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_5;
    const __VLS_6 = ({ viewDetail: {} },
        { onViewDetail: (__VLS_ctx.handleViewDetail) });
    const __VLS_7 = ({ openDirectory: {} },
        { onOpenDirectory: (__VLS_ctx.handleOpenDirectory) });
    var __VLS_3;
    var __VLS_4;
}
else if (__VLS_ctx.currentTab === 'submit') {
    const __VLS_8 = JobSubmit;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent1(__VLS_8, new __VLS_8({
        ref: "jobSubmitRef",
    }));
    const __VLS_10 = __VLS_9({
        ref: "jobSubmitRef",
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    var __VLS_13 = {};
    var __VLS_11;
}
else if (__VLS_ctx.currentTab === 'templates') {
    const __VLS_15 = JobTemplates;
    // @ts-ignore
    const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
        ...{ 'onUseTemplate': {} },
    }));
    const __VLS_17 = __VLS_16({
        ...{ 'onUseTemplate': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_16));
    let __VLS_20;
    const __VLS_21 = ({ useTemplate: {} },
        { onUseTemplate: (__VLS_ctx.handleUseTemplate) });
    var __VLS_18;
    var __VLS_19;
}
if (__VLS_ctx.selectedJob) {
    const __VLS_22 = JobDetailModal;
    // @ts-ignore
    const __VLS_23 = __VLS_asFunctionalComponent1(__VLS_22, new __VLS_22({
        ...{ 'onClose': {} },
        ...{ 'onPause': {} },
        ...{ 'onCancel': {} },
        ...{ 'onOpenDirectory': {} },
        job: (__VLS_ctx.selectedJob),
    }));
    const __VLS_24 = __VLS_23({
        ...{ 'onClose': {} },
        ...{ 'onPause': {} },
        ...{ 'onCancel': {} },
        ...{ 'onOpenDirectory': {} },
        job: (__VLS_ctx.selectedJob),
    }, ...__VLS_functionalComponentArgsRest(__VLS_23));
    let __VLS_27;
    const __VLS_28 = ({ close: {} },
        { onClose: (...[$event]) => {
                if (!(__VLS_ctx.selectedJob))
                    return;
                __VLS_ctx.selectedJob = null;
                // @ts-ignore
                [currentTab, currentTab, currentTab, handleViewDetail, handleOpenDirectory, handleUseTemplate, selectedJob, selectedJob, selectedJob,];
            } });
    const __VLS_29 = ({ pause: {} },
        { onPause: (__VLS_ctx.handlePause) });
    const __VLS_30 = ({ cancel: {} },
        { onCancel: (__VLS_ctx.handleCancel) });
    const __VLS_31 = ({ openDirectory: {} },
        { onOpenDirectory: (__VLS_ctx.handleOpenDirectory) });
    var __VLS_25;
    var __VLS_26;
}
// @ts-ignore
var __VLS_14 = __VLS_13;
// @ts-ignore
[handleOpenDirectory, handlePause, handleCancel,];
const __VLS_export = (await import('vue')).defineComponent({
    emits: {},
});
export default {};
