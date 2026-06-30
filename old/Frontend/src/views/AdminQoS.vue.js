/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, onMounted } from 'vue';
import { qosAPI } from '../api';
import notification from '../utils/notification';
import dialog from '../utils/dialog';
const qosList = ref([]);
const loading = ref(false);
const error = ref('');
const showModal = ref(false);
const showBindingsModal = ref(false);
const isEdit = ref(false);
const saving = ref(false);
const modalError = ref('');
const selectedQoS = ref(null);
const qosBindings = ref([]);
const loadingBindings = ref(false);
const bindingsError = ref('');
const formData = ref({
    name: '',
    description: '',
    max_jobs_pu: 0,
    max_submit_pu: 0,
    max_cpus: 0,
    max_memory: 0,
    max_gpus: 0,
    max_nodes: 0,
    max_wall_hours: 0,
    grp_tres_mins: 0
});
// 加载 QoS 列表
const loadQoSList = async () => {
    loading.value = true;
    error.value = '';
    try {
        qosList.value = await qosAPI.getQoSList();
    }
    catch (err) {
        const errorMsg = err.response?.data?.error || '加载 QoS 列表失败';
        // 检查是否是数据库连接错误
        if (err.response?.status === 502 || errorMsg.includes('Unable to connect to database')) {
            error.value = '⚠️ Slurm 数据库连接失败。请检查 slurmdbd 服务是否正常运行。\n\n' +
                '可能的原因：\n' +
                '1. slurmdbd 服务未启动\n' +
                '2. MySQL/MariaDB 数据库未运行\n' +
                '3. MUNGE 认证失败\n' +
                '4. JWT token 已过期\n\n' +
                '临时解决方案：在 backend/.env 中设置 DEV_MODE=true 使用模拟数据';
        }
        else {
            error.value = errorMsg;
        }
        console.error('Failed to load QoS list:', err);
    }
    finally {
        loading.value = false;
    }
};
// 查看 QoS 绑定（功能已移除）
const viewBindings = async (qos) => {
    notification.info('QoS 绑定查看功能已移除');
};
const closeBindingsModal = () => {
    showBindingsModal.value = false;
    selectedQoS.value = null;
    qosBindings.value = [];
};
const goToAssociations = () => {
    notification.info('账户关联管理功能已移除');
    closeBindingsModal();
};
const openAddModal = () => {
    isEdit.value = false;
    formData.value = {
        name: '',
        description: '',
        max_jobs_pu: 0,
        max_submit_pu: 0,
        max_cpus: 0,
        max_memory: 0,
        max_gpus: 0,
        max_nodes: 0,
        max_wall_hours: 0,
        grp_tres_mins: 0
    };
    showModal.value = true;
};
const editQoS = (qos) => {
    isEdit.value = true;
    formData.value = {
        name: qos.name,
        description: qos.description || '',
        max_jobs_pu: extractJobsLimit(qos) || 0,
        max_submit_pu: extractSubmitLimit(qos) || 0,
        max_cpus: extractCPULimit(qos) || 0,
        max_memory: extractMemoryLimit(qos) || 0,
        max_gpus: extractGPULimit(qos) || 0,
        max_nodes: extractNodeLimit(qos) || 0,
        max_wall_hours: Math.floor(extractWallTimeLimit(qos) / 60) || 0, // 分钟转小时
        grp_tres_mins: extractBillingLimit(qos) || 0
    };
    showModal.value = true;
};
// 从新的API结构中提取CPU限制
const extractCPULimit = (qos) => {
    // 优先从 tres.per.user 获取（per-user 限制）
    if (qos.limits?.max?.tres?.per?.user) {
        const userTres = qos.limits.max.tres.per.user;
        const cpuTres = userTres.find((tres) => tres.type === 'cpu');
        if (cpuTres)
            return cpuTres.count;
    }
    // 兼容旧结构
    if (qos.max_cpus_pu)
        return extractNumber(qos.max_cpus_pu);
    if (qos.MaxCPUs)
        return extractNumber(qos.MaxCPUs);
    return 0;
};
// 从新的API结构中提取GPU限制
const extractGPULimit = (qos) => {
    // 优先从 tres.per.user 获取
    if (qos.limits?.max?.tres?.per?.user) {
        const userTres = qos.limits.max.tres.per.user;
        const gpuTres = userTres.find(isGPUTres);
        if (gpuTres)
            return gpuTres.count;
    }
    // 兼容旧结构
    if (qos.max_tres_pu)
        return extractGPUCount(qos.max_tres_pu);
    if (qos.MaxTRES)
        return extractGPUCount(qos.MaxTRES);
    return 0;
};
// 从新的API结构中提取节点限制
const extractNodeLimit = (qos) => {
    // 优先从 tres.per.user 获取
    if (qos.limits?.max?.tres?.per?.user) {
        const userTres = qos.limits.max.tres.per.user;
        const nodeTres = userTres.find((tres) => tres.type === 'node');
        if (nodeTres)
            return nodeTres.count;
    }
    // 兜底从 tres.total 获取（GrpTRES）
    if (qos.limits?.max?.tres?.total) {
        const totalTres = qos.limits.max.tres.total;
        const nodeTres = totalTres.find((tres) => tres.type === 'node');
        if (nodeTres)
            return nodeTres.count;
    }
    // 兼容旧结构
    if (qos.max_nodes_pu)
        return extractNumber(qos.max_nodes_pu);
    if (qos.MaxNodes)
        return extractNumber(qos.MaxNodes);
    return 0;
};
// 从新的API结构中提取内存限制（MB转GB）
const extractMemoryLimit = (qos) => {
    // 优先从 tres.per.user 获取
    if (qos.limits?.max?.tres?.per?.user) {
        const userTres = qos.limits.max.tres.per.user;
        const memTres = userTres.find((tres) => tres.type === 'mem');
        if (memTres)
            return Math.floor(memTres.count / 1024); // MB 转 GB
    }
    // 兜底从 tres.total 获取（GrpTRES）
    if (qos.limits?.max?.tres?.total) {
        const totalTres = qos.limits.max.tres.total;
        const memTres = totalTres.find((tres) => tres.type === 'mem');
        if (memTres)
            return Math.floor(memTres.count / 1024);
    }
    return 0;
};
// 从新的API结构中提取作业数限制
const extractJobsLimit = (qos) => {
    // 检查新的嵌套结构
    if (qos.limits?.max?.jobs?.per?.user) {
        const jobsLimit = qos.limits.max.jobs.per.user;
        return jobsLimit.set && !jobsLimit.infinite ? jobsLimit.number : 0;
    }
    // 检查 active_jobs 结构
    if (qos.limits?.max?.active_jobs?.count) {
        const jobsLimit = qos.limits.max.active_jobs.count;
        return jobsLimit.set && !jobsLimit.infinite ? jobsLimit.number : 0;
    }
    // 兼容旧结构
    if (qos.max_jobs_pu)
        return extractNumber(qos.max_jobs_pu);
    if (qos.MaxJobs)
        return extractNumber(qos.MaxJobs);
    return 0;
};
// 从新的API结构中提取提交作业数限制
const extractSubmitLimit = (qos) => {
    // active_jobs.count（对应 sacctmgr 的 MaxSubmitPU）
    if (qos.limits?.max?.active_jobs?.count) {
        const v = qos.limits.max.active_jobs.count;
        if (v.set && !v.infinite)
            return v.number;
    }
    // 兼容旧结构
    if (qos.limits?.max?.jobs?.count) {
        const v = qos.limits.max.jobs.count;
        if (v.set && !v.infinite)
            return v.number;
    }
    if (qos.max_submit_pu)
        return extractNumber(qos.max_submit_pu);
    if (qos.MaxSubmit)
        return extractNumber(qos.MaxSubmit);
    return 0;
};
// 从新的API结构中提取运行时间限制（分钟）
const extractWallTimeLimit = (qos) => {
    // v0.0.43/v0.0.44 路径：limits.max.wall_clock.per.job
    if (qos.limits?.max?.wall_clock?.per?.job) {
        const v = qos.limits.max.wall_clock.per.job;
        console.log(`[QoS ${qos.name}] wall_clock:`, v);
        // set=true 且 infinite=false 才是有效限制
        if (v.set && !v.infinite) {
            console.log(`[QoS ${qos.name}] 提取到时间限制: ${v.number} 分钟`);
            return v.number;
        }
    }
    // 兼容旧路径
    if (qos.max_wall_pj)
        return extractNumber(qos.max_wall_pj);
    if (qos.MaxWall)
        return extractNumber(qos.MaxWall);
    console.log(`[QoS ${qos.name}] 未找到时间限制`);
    return 0;
};
// 从新的API结构中提取总机时限制（返回小时）
const extractBillingLimit = (qos) => {
    // 检查新的嵌套结构
    if (qos.limits?.max?.tres?.minutes?.total) {
        const totalTres = qos.limits.max.tres.minutes.total;
        const billingTres = totalTres.find((tres) => tres.type === 'billing');
        if (billingTres)
            return billingTres.count / 60;
    }
    // 兼容旧结构
    if (qos.grp_tres_mins)
        return extractBillingMins(qos.grp_tres_mins) / 60;
    if (qos.GrpTRESMins)
        return extractBillingMins(qos.GrpTRESMins) / 60;
    return 0;
};
// 格式化限制值显示
const formatLimitValue = (value) => {
    if (!value || value === 0)
        return '无限制';
    return value.toString();
};
// 格式化总机时显示（小时）
const formatBillingLimit = (qos) => {
    const hours = extractBillingLimit(qos);
    if (!hours || hours === 0)
        return '无限制';
    return `${Math.round(hours)} 小时`;
};
// 格式化运行时间限制
const formatWallTimeLimit = (minutes) => {
    if (!minutes || minutes === 0)
        return '无限制';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
        return `${hours}小时${mins > 0 ? mins + '分钟' : ''}`;
    }
    return `${mins}分钟`;
};
// 从 max_tres_pu 中提取 GPU 数量（兼容旧格式）
const extractGPUCount = (value) => {
    if (!value || value === '')
        return 0;
    // 格式: gres/gpu=4 或 gres/gpu:a100=2
    const match = value.match(/(?:gres\/gpu|gpu)[^=]*=(\d+)/);
    return match ? parseInt(match[1]) : 0;
};
const isGPUTres = (tres) => {
    const type = String(tres?.type || '').toLowerCase();
    const name = String(tres?.name || '').toLowerCase();
    return type === 'gres/gpu' || type === 'gpu' || (type === 'gres' && name === 'gpu');
};
// 从 grp_tres_mins 中提取 billing 数值（兼容旧格式）
const extractBillingMins = (value) => {
    if (!value || value === '')
        return 0;
    // 格式: billing=100000
    const match = value.match(/billing=(\d+)/);
    return match ? parseInt(match[1]) : 0;
};
// 提取数值（处理可能是对象的情况）
const extractNumber = (value) => {
    if (typeof value === 'number')
        return value;
    if (typeof value === 'object' && value !== null) {
        // 如果是对象，尝试提取 set 或 number 字段
        return value.set || value.number || 0;
    }
    return 0;
};
// 格式化显示值
const formatValue = (value) => {
    if (value === null || value === undefined)
        return '-';
    if (typeof value === 'number')
        return value.toString();
    if (typeof value === 'object' && value !== null) {
        return (value.set || value.number || '-').toString();
    }
    return value.toString();
};
const saveQoS = async () => {
    modalError.value = '';
    if (!formData.value.name) {
        modalError.value = 'QoS 名称不能为空';
        return;
    }
    saving.value = true;
    try {
        // 构建提交数据，将前端字段映射到后端字段
        const qosData = {
            name: formData.value.name,
            description: formData.value.description,
            max_jobs_pu: formData.value.max_jobs_pu,
            max_submit_pu: formData.value.max_submit_pu,
            max_cpus_pu: formData.value.max_cpus,
            max_nodes_pu: formData.value.max_nodes,
            max_gpus_pu: formData.value.max_gpus,
            max_wall_pj: formData.value.max_wall_hours * 60, // 小时转分钟
            // grp_tres_mins 不在此处提交，由机时管理页面单独维护
        };
        const maxTres = [];
        if (formData.value.max_memory > 0) {
            maxTres.push(`mem=${formData.value.max_memory}G`);
        }
        if (formData.value.max_gpus > 0) {
            maxTres.push(`gres/gpu=${formData.value.max_gpus}`);
        }
        if (maxTres.length > 0) {
            qosData.max_tres_pu = maxTres.join(',');
        }
        if (isEdit.value) {
            await qosAPI.updateQoS(formData.value.name, qosData);
            notification.success('QoS 更新成功！');
        }
        else {
            await qosAPI.createQoS(qosData);
            notification.success('QoS 创建成功！');
        }
        closeModal();
        await loadQoSList();
    }
    catch (err) {
        console.error('Save QoS error:', err);
        modalError.value = err.response?.data?.error || err.message || '保存失败';
    }
    finally {
        saving.value = false;
    }
};
const confirmDelete = async (qos) => {
    const ok = await dialog.confirmDelete(qos.name, 'QoS');
    if (!ok)
        return;
    try {
        await qosAPI.deleteQoS(qos.name);
        dialog.success('QoS 删除成功！');
        await loadQoSList();
    }
    catch (err) {
        dialog.error(err.response?.data?.error || '删除失败');
    }
};
const closeModal = () => {
    showModal.value = false;
    modalError.value = '';
};
// 格式化 TRES Minutes（总机时）
const formatTRESMins = (value) => {
    if (!value || value === '')
        return '-';
    // 格式: cpu=100000 或 gres/gpu=10000
    // 显示为: 100000 CPU-分钟 或 10000 GPU-分钟
    const parts = value.split(',');
    return parts.map(part => {
        const [resource, mins] = part.split('=');
        if (resource && mins) {
            const resourceName = resource.includes('gpu') ? 'GPU' :
                resource.includes('cpu') ? 'CPU' : resource;
            return `${mins} ${resourceName}-分钟`;
        }
        return part;
    }).join(', ');
};
// 获取优先级样式
const getPriorityClass = (value) => {
    const priority = extractNumber(value);
    if (priority >= 200)
        return 'priority-high';
    if (priority >= 100)
        return 'priority-normal';
    return 'priority-low';
};
onMounted(() => {
    loadQoSList();
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['bindings-section']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "admin-qos" },
});
/** @type {__VLS_StyleScopedClasses['admin-qos']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "page-header" },
});
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.openAddModal) },
    ...{ class: "btn btn-primary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "loading" },
    });
    /** @type {__VLS_StyleScopedClasses['loading']} */ ;
}
if (__VLS_ctx.error) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "error-message" },
    });
    /** @type {__VLS_StyleScopedClasses['error-message']} */ ;
    (__VLS_ctx.error);
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card" },
    });
    /** @type {__VLS_StyleScopedClasses['card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
        ...{ class: "data-table" },
    });
    /** @type {__VLS_StyleScopedClasses['data-table']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
    for (const [qos] of __VLS_vFor((__VLS_ctx.qosList))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (qos.name),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "qos-name" },
        });
        /** @type {__VLS_StyleScopedClasses['qos-name']} */ ;
        (qos.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (qos.description || '-');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (__VLS_ctx.formatLimitValue(__VLS_ctx.extractJobsLimit(qos)));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (__VLS_ctx.formatLimitValue(__VLS_ctx.extractSubmitLimit(qos)));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (__VLS_ctx.formatLimitValue(__VLS_ctx.extractCPULimit(qos)));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (__VLS_ctx.formatLimitValue(__VLS_ctx.extractMemoryLimit(qos)));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (__VLS_ctx.formatLimitValue(__VLS_ctx.extractGPULimit(qos)));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (__VLS_ctx.formatLimitValue(__VLS_ctx.extractNodeLimit(qos)));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (__VLS_ctx.formatWallTimeLimit(__VLS_ctx.extractWallTimeLimit(qos)));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "action-buttons" },
        });
        /** @type {__VLS_StyleScopedClasses['action-buttons']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.error))
                        return;
                    __VLS_ctx.editQoS(qos);
                    // @ts-ignore
                    [openAddModal, loading, error, error, qosList, formatLimitValue, formatLimitValue, formatLimitValue, formatLimitValue, formatLimitValue, formatLimitValue, extractJobsLimit, extractSubmitLimit, extractCPULimit, extractMemoryLimit, extractGPULimit, extractNodeLimit, formatWallTimeLimit, extractWallTimeLimit, editQoS,];
                } },
            ...{ class: "btn btn-link" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.error))
                        return;
                    __VLS_ctx.confirmDelete(qos);
                    // @ts-ignore
                    [confirmDelete,];
                } },
            ...{ class: "btn btn-link danger" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
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
if (__VLS_ctx.showModal) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal" },
    });
    /** @type {__VLS_StyleScopedClasses['modal']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    (__VLS_ctx.isEdit ? '编辑 QoS' : '添加 QoS');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeModal) },
        ...{ class: "btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    if (__VLS_ctx.modalError) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "alert alert-error" },
        });
        /** @type {__VLS_StyleScopedClasses['alert']} */ ;
        /** @type {__VLS_StyleScopedClasses['alert-error']} */ ;
        (__VLS_ctx.modalError);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        disabled: (__VLS_ctx.isEdit),
        placeholder: "例如: high",
    });
    (__VLS_ctx.formData.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "QoS 描述",
    });
    (__VLS_ctx.formData.description);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "info-box" },
    });
    /** @type {__VLS_StyleScopedClasses['info-box']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
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
        placeholder: "128",
    });
    (__VLS_ctx.formData.max_cpus);
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({
        ...{ class: "form-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['form-hint']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        placeholder: "256",
    });
    (__VLS_ctx.formData.max_memory);
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({
        ...{ class: "form-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['form-hint']} */ ;
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
        placeholder: "4",
    });
    (__VLS_ctx.formData.max_gpus);
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({
        ...{ class: "form-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['form-hint']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        placeholder: "2",
    });
    (__VLS_ctx.formData.max_nodes);
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({
        ...{ class: "form-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['form-hint']} */ ;
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
        placeholder: "100",
    });
    (__VLS_ctx.formData.max_jobs_pu);
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({
        ...{ class: "form-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['form-hint']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        placeholder: "200",
    });
    (__VLS_ctx.formData.max_submit_pu);
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({
        ...{ class: "form-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['form-hint']} */ ;
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
        placeholder: "72",
        min: "0",
    });
    (__VLS_ctx.formData.max_wall_hours);
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({
        ...{ class: "form-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['form-hint']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-footer" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-footer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeModal) },
        ...{ class: "btn btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.saveQoS) },
        ...{ class: "btn btn-primary" },
        disabled: (__VLS_ctx.saving),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    (__VLS_ctx.saving ? '保存中...' : '保存');
}
if (__VLS_ctx.showBindingsModal) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal modal-large" },
    });
    /** @type {__VLS_StyleScopedClasses['modal']} */ ;
    /** @type {__VLS_StyleScopedClasses['modal-large']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    (__VLS_ctx.selectedQoS?.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeBindingsModal) },
        ...{ class: "btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    if (__VLS_ctx.loadingBindings) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "loading-text" },
        });
        /** @type {__VLS_StyleScopedClasses['loading-text']} */ ;
    }
    else if (__VLS_ctx.bindingsError) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "alert alert-error" },
        });
        /** @type {__VLS_StyleScopedClasses['alert']} */ ;
        /** @type {__VLS_StyleScopedClasses['alert-error']} */ ;
        (__VLS_ctx.bindingsError);
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "bindings-section" },
        });
        /** @type {__VLS_StyleScopedClasses['bindings-section']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "hint-text" },
        });
        /** @type {__VLS_StyleScopedClasses['hint-text']} */ ;
        if (__VLS_ctx.qosBindings.length === 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "empty-state" },
            });
            /** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.goToAssociations) },
                ...{ class: "btn btn-primary" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
                ...{ class: "bindings-table" },
            });
            /** @type {__VLS_StyleScopedClasses['bindings-table']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
            for (const [binding, index] of __VLS_vFor((__VLS_ctx.qosBindings))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                    key: (index),
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
                (binding.user);
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                (binding.account);
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                (binding.cluster);
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                (binding.partition || '-');
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                if (binding.qos === __VLS_ctx.selectedQoS?.name) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-primary" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-primary']} */ ;
                    (binding.qos);
                }
                else {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                    (binding.qos || '-');
                }
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                (binding.qos_list || '-');
                // @ts-ignore
                [showModal, isEdit, isEdit, closeModal, closeModal, modalError, modalError, formData, formData, formData, formData, formData, formData, formData, formData, formData, saveQoS, saving, saving, showBindingsModal, selectedQoS, selectedQoS, closeBindingsModal, loadingBindings, bindingsError, bindingsError, qosBindings, qosBindings, goToAssociations,];
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "bindings-info" },
        });
        /** @type {__VLS_StyleScopedClasses['bindings-info']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.ol, __VLS_intrinsics.ol)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-footer" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-footer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeBindingsModal) },
        ...{ class: "btn btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.goToAssociations) },
        ...{ class: "btn btn-primary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
}
// @ts-ignore
[closeBindingsModal, goToAssociations,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
