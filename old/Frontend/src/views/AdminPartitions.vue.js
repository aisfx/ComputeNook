/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { dialog } from '../utils/dialog';
const partitions = ref([]);
const loading = ref(false);
const error = ref('');
const showModal = ref(false);
const showImportModal = ref(false);
const isEdit = ref(false);
const saving = ref(false);
const applying = ref(false);
const importing = ref(false);
const modalError = ref('');
const importError = ref('');
const importData = ref('');
const formData = ref({
    name: '',
    nodes: 'ALL',
    over_subscribe: 'Exclusive',
    is_default: false,
    max_time: 'INFINITE',
    state: 'UP',
    allow_groups: '',
    allow_accounts: '',
    tres_billing_weights: ''
});
// 加载分区列表
const loadPartitions = async () => {
    loading.value = true;
    error.value = '';
    try {
        const response = await axios.get('/partitions');
        partitions.value = response.data.data || [];
    }
    catch (err) {
        error.value = err.response?.data?.error || '加载分区配置失败';
        dialog.error(error.value);
    }
    finally {
        loading.value = false;
    }
};
// 打开添加模态框
const openAddModal = () => {
    isEdit.value = false;
    modalError.value = '';
    formData.value = {
        name: '',
        nodes: 'ALL',
        over_subscribe: 'Exclusive',
        is_default: false,
        max_time: 'INFINITE',
        state: 'UP',
        allow_groups: '',
        allow_accounts: '',
        tres_billing_weights: ''
    };
    showModal.value = true;
};
// 编辑分区
const editPartition = (partition) => {
    isEdit.value = true;
    modalError.value = '';
    formData.value = {
        name: partition.name,
        nodes: partition.nodes,
        over_subscribe: partition.over_subscribe,
        is_default: partition.is_default,
        max_time: partition.max_time,
        state: partition.state,
        allow_groups: partition.allow_groups || '',
        allow_accounts: partition.allow_accounts || '',
        tres_billing_weights: partition.tres_billing_weights || ''
    };
    showModal.value = true;
};
// 保存分区
const savePartition = async () => {
    modalError.value = '';
    if (!formData.value.name) {
        modalError.value = '请输入分区名称';
        return;
    }
    if (!formData.value.nodes) {
        modalError.value = '请输入节点列表';
        return;
    }
    saving.value = true;
    try {
        if (isEdit.value) {
            await axios.put(`/partitions/${formData.value.name}`, formData.value);
            dialog.success('分区配置更新成功');
        }
        else {
            await axios.post('/partitions', formData.value);
            dialog.success('分区配置创建成功');
        }
        closeModal();
        loadPartitions();
    }
    catch (err) {
        modalError.value = err.response?.data?.error || '保存失败';
    }
    finally {
        saving.value = false;
    }
};
// 关闭模态框
const closeModal = () => {
    showModal.value = false;
};
// 确认删除
const confirmDelete = async (partition) => {
    if (!confirm(`确定要删除分区 "${partition.name}" 吗？`)) {
        return;
    }
    try {
        await axios.delete(`/partitions/${partition.name}`);
        dialog.success('分区配置删除成功');
        loadPartitions();
    }
    catch (err) {
        dialog.error(err.response?.data?.error || '删除失败');
    }
};
// 应用配置
const applyConfig = async () => {
    if (!confirm('确定要应用配置吗？这将生成 partition.conf 文件并重新加载 Slurm 服务。')) {
        return;
    }
    applying.value = true;
    try {
        const response = await axios.post('/partitions/apply');
        dialog.success(response.data.message || '配置应用成功');
        console.log('应用结果:', response.data);
    }
    catch (err) {
        dialog.error(err.response?.data?.error || '应用配置失败');
    }
    finally {
        applying.value = false;
    }
};
// 导出配置
const exportConfig = async () => {
    try {
        const response = await axios.get('/partitions/export', {
            responseType: 'blob'
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `partitions_${new Date().getTime()}.json`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        dialog.success('配置导出成功');
    }
    catch (err) {
        dialog.error('导出配置失败');
    }
};
// 打开导入模态框
const openImportModal = () => {
    importError.value = '';
    importData.value = '';
    showImportModal.value = true;
};
// 关闭导入模态框
const closeImportModal = () => {
    showImportModal.value = false;
};
// 导入配置
const importConfig = async () => {
    importError.value = '';
    if (!importData.value.trim()) {
        importError.value = '请输入 JSON 配置';
        return;
    }
    try {
        JSON.parse(importData.value);
    }
    catch (err) {
        importError.value = 'JSON 格式错误';
        return;
    }
    importing.value = true;
    try {
        await axios.post('/partitions/import', {
            data: importData.value
        });
        dialog.success('配置导入成功');
        closeImportModal();
        loadPartitions();
    }
    catch (err) {
        importError.value = err.response?.data?.error || '导入失败';
    }
    finally {
        importing.value = false;
    }
};
// 获取状态徽章样式
const getStateBadgeClass = (state) => {
    switch (state) {
        case 'UP':
            return 'badge-success';
        case 'DOWN':
            return 'badge-danger';
        case 'DRAIN':
            return 'badge-warning';
        case 'INACTIVE':
            return 'badge-secondary';
        default:
            return 'badge-secondary';
    }
};
onMounted(() => {
    loadPartitions();
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
/** @type {__VLS_StyleScopedClasses['data-table']} */ ;
/** @type {__VLS_StyleScopedClasses['data-table']} */ ;
/** @type {__VLS_StyleScopedClasses['partition-name']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-success']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['error-message']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-wrapper']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "admin-partitions" },
});
/** @type {__VLS_StyleScopedClasses['admin-partitions']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "page-header" },
});
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "header-actions" },
});
/** @type {__VLS_StyleScopedClasses['header-actions']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.exportConfig) },
    ...{ class: "btn btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.openImportModal) },
    ...{ class: "btn btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.applyConfig) },
    ...{ class: "btn btn-success" },
    disabled: (__VLS_ctx.applying),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-success']} */ ;
(__VLS_ctx.applying ? '应用中...' : '✅ 应用配置');
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "info-banner" },
    });
    /** @type {__VLS_StyleScopedClasses['info-banner']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "info-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['info-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
    for (const [partition] of __VLS_vFor((__VLS_ctx.partitions))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (partition.id),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "partition-name" },
            ...{ class: ({ 'is-default': partition.is_default }) },
        });
        /** @type {__VLS_StyleScopedClasses['partition-name']} */ ;
        /** @type {__VLS_StyleScopedClasses['is-default']} */ ;
        (partition.name);
        if (partition.is_default) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-primary" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-primary']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (partition.nodes);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (partition.over_subscribe);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: (partition.is_default ? 'badge badge-success' : 'badge badge-secondary') },
        });
        (partition.is_default ? '是' : '否');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (partition.max_time);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge" },
            ...{ class: (__VLS_ctx.getStateBadgeClass(partition.state)) },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        (partition.state);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (partition.allow_groups || '-');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (partition.allow_accounts || '-');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "action-buttons" },
        });
        /** @type {__VLS_StyleScopedClasses['action-buttons']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.error))
                        return;
                    __VLS_ctx.editPartition(partition);
                    // @ts-ignore
                    [exportConfig, openImportModal, applyConfig, applying, applying, openAddModal, loading, error, error, partitions, getStateBadgeClass, editPartition,];
                } },
            ...{ class: "btn btn-link" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.error))
                        return;
                    __VLS_ctx.confirmDelete(partition);
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
    if (__VLS_ctx.partitions.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "empty-state" },
        });
        /** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.openAddModal) },
            ...{ class: "btn btn-primary" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
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
        ...{ onClick: (__VLS_ctx.closeModal) },
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
    (__VLS_ctx.isEdit ? '编辑分区' : '添加分区');
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
        placeholder: "例如: all, gpu, high",
    });
    (__VLS_ctx.formData.name);
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
        placeholder: "ALL 或 node[01-10]",
    });
    (__VLS_ctx.formData.nodes);
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({
        ...{ class: "form-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['form-hint']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.formData.over_subscribe),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "Exclusive",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "NO",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "YES",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "FORCE",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-row" },
    });
    /** @type {__VLS_StyleScopedClasses['form-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "checkbox-wrapper" },
    });
    /** @type {__VLS_StyleScopedClasses['checkbox-wrapper']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
        id: "is_default",
    });
    (__VLS_ctx.formData.is_default);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        for: "is_default",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({
        ...{ class: "form-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['form-hint']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.formData.state),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "UP",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "DOWN",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "DRAIN",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "INACTIVE",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "INFINITE 或 7-00:00:00",
    });
    (__VLS_ctx.formData.max_time);
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
        placeholder: "root,test1,hpc-admin",
    });
    (__VLS_ctx.formData.allow_groups);
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
        placeholder: "root,test1,hpc-admin",
    });
    (__VLS_ctx.formData.allow_accounts);
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
        placeholder: 'node=0,CPU=1.0,mem=1.0G',
    });
    (__VLS_ctx.formData.tres_billing_weights);
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
        ...{ onClick: (__VLS_ctx.savePartition) },
        ...{ class: "btn btn-primary" },
        disabled: (__VLS_ctx.saving),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    (__VLS_ctx.saving ? '保存中...' : '保存');
}
if (__VLS_ctx.showImportModal) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (__VLS_ctx.closeImportModal) },
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeImportModal) },
        ...{ class: "btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    if (__VLS_ctx.importError) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "alert alert-error" },
        });
        /** @type {__VLS_StyleScopedClasses['alert']} */ ;
        /** @type {__VLS_StyleScopedClasses['alert-error']} */ ;
        (__VLS_ctx.importError);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
        value: (__VLS_ctx.importData),
        rows: "15",
        placeholder: '[{"name":"all","nodes":"ALL",...}]',
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({
        ...{ class: "form-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['form-hint']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-footer" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-footer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeImportModal) },
        ...{ class: "btn btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.importConfig) },
        ...{ class: "btn btn-primary" },
        disabled: (__VLS_ctx.importing),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    (__VLS_ctx.importing ? '导入中...' : '导入');
}
// @ts-ignore
[openAddModal, partitions, showModal, closeModal, closeModal, closeModal, isEdit, isEdit, modalError, modalError, formData, formData, formData, formData, formData, formData, formData, formData, formData, savePartition, saving, saving, showImportModal, closeImportModal, closeImportModal, closeImportModal, importError, importError, importData, importConfig, importing, importing,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
