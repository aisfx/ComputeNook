/// <reference types="../../node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, onMounted, watch } from 'vue';
import { getAssociations, createAssociation as apiCreateAssociation, updateAssociation as apiUpdateAssociation, deleteAssociation as apiDeleteAssociation } from '../api';
import { slurmUserAPI, slurmAccountAPI } from '../api';
import { showSuccess, showError } from '../utils/notification';
const associations = ref([]);
const slurmUsers = ref([]);
const slurmAccounts = ref([]);
const showCreateDialog = ref(false);
const isEditing = ref(false);
const qosInput = ref('');
const originalAssociation = ref(null);
const loading = ref(false);
const newAssociation = ref({
    user: '',
    account: '',
    cluster: 'cluster', // 设置默认集群名
    partition: '',
    qos: []
});
const loadAssociations = async () => {
    loading.value = true;
    try {
        const response = await getAssociations();
        console.log('Associations response:', response.data);
        associations.value = response.data.data || [];
        console.log('Loaded associations:', associations.value);
    }
    catch (error) {
        console.error('Load associations error:', error);
        showError('加载资源绑定失败: ' + (error.response?.data?.error || error.message));
    }
    finally {
        loading.value = false;
    }
};
const loadSlurmUsers = async () => {
    try {
        slurmUsers.value = await slurmUserAPI.getUsers();
    }
    catch (error) {
        showError('加载Slurm用户列表失败: ' + (error.response?.data?.error || error.message));
    }
};
const loadSlurmAccounts = async () => {
    try {
        slurmAccounts.value = await slurmAccountAPI.getAccounts();
    }
    catch (error) {
        showError('加载Slurm账户列表失败: ' + (error.response?.data?.error || error.message));
    }
};
const editAssociation = (assoc) => {
    isEditing.value = true;
    originalAssociation.value = { ...assoc };
    newAssociation.value = { ...assoc };
    qosInput.value = assoc.qos && assoc.qos.length > 0 ? assoc.qos.join(', ') : '';
    showCreateDialog.value = true;
};
const saveAssociation = async () => {
    if (!newAssociation.value.user || !newAssociation.value.account) {
        showError('用户和账户不能为空');
        return;
    }
    try {
        // 处理 QoS 输入
        const qosList = qosInput.value
            .split(',')
            .map(q => q.trim())
            .filter(q => q.length > 0);
        const assocData = {
            ...newAssociation.value,
            cluster: newAssociation.value.cluster || 'cluster', // 确保有cluster字段
            qos: qosList.length > 0 ? qosList : undefined
        };
        console.log('Saving association:', assocData);
        if (isEditing.value && originalAssociation.value) {
            // 更新
            const response = await apiUpdateAssociation(originalAssociation.value.account, originalAssociation.value.user, originalAssociation.value.cluster || '', assocData);
            console.log('Update response:', response);
            showSuccess('资源绑定更新成功');
        }
        else {
            // 创建
            const response = await apiCreateAssociation(assocData);
            console.log('Create response:', response);
            showSuccess('资源绑定创建成功');
        }
        showCreateDialog.value = false;
        resetForm();
        // 延迟一下再加载，给 Slurm API 时间处理
        console.log('Reloading associations...');
        setTimeout(async () => {
            await loadAssociations();
        }, 1000); // 增加延迟到1秒
    }
    catch (error) {
        console.error('Save association error:', error);
        showError((isEditing.value ? '更新' : '创建') + '资源绑定失败: ' + (error.response?.data?.error || error.message));
    }
};
const deleteAssociation = async (assoc) => {
    // 添加参数验证和日志
    console.log('Deleting association:', assoc);
    if (!assoc.account || !assoc.user) {
        showError(`参数错误: account='${assoc.account}', user='${assoc.user}'`);
        return;
    }
    // 检查是否是默认账户
    const userAssociations = associations.value.filter(a => a.user === assoc.user);
    const isOnlyAssociation = userAssociations.length === 1;
    let confirmMessage = `确定要删除用户 ${assoc.user} 和账户 ${assoc.account} 的绑定吗？`;
    if (isOnlyAssociation) {
        confirmMessage = `⚠️ 警告：这是用户 ${assoc.user} 的唯一账户绑定！\n\n` +
            `删除后该用户将无法使用任何账户。\n` +
            `建议：先为用户创建新的账户绑定，再删除此绑定。\n\n` +
            `确定要继续删除吗？`;
    }
    if (!confirm(confirmMessage)) {
        return;
    }
    try {
        console.log('Calling apiDeleteAssociation with:', {
            account: assoc.account,
            user: assoc.user,
            cluster: assoc.cluster || '',
            partition: assoc.partition || ''
        });
        await apiDeleteAssociation(assoc.account, assoc.user, assoc.cluster || '', assoc.partition || '');
        showSuccess('资源绑定删除成功');
        await loadAssociations();
    }
    catch (error) {
        console.error('Delete association error:', error);
        const errorMsg = error.response?.data?.error || error.message;
        // 检查是否是"不能删除默认账户"的错误
        if (errorMsg.includes('can not remove the default account')) {
            showError('无法删除：这是用户的默认账户。\n\n' +
                '解决方案：\n' +
                '1. 先为用户创建新的账户绑定\n' +
                '2. 新绑定会自动成为默认账户\n' +
                '3. 然后可以删除此绑定');
        }
        else {
            showError('删除资源绑定失败: ' + errorMsg);
        }
    }
};
const resetForm = () => {
    isEditing.value = false;
    originalAssociation.value = null;
    newAssociation.value = {
        user: '',
        account: '',
        cluster: 'cluster', // 设置默认集群名
        partition: '',
        qos: []
    };
    qosInput.value = '';
};
// 监听对话框打开，加载用户和账户列表
watch(showCreateDialog, (newVal) => {
    if (newVal) {
        // 打开对话框时，如果不是编辑模式，设置默认值
        if (!isEditing.value) {
            newAssociation.value.cluster = 'cluster';
        }
        loadSlurmUsers();
        loadSlurmAccounts();
    }
    else {
        resetForm();
    }
});
onMounted(() => {
    loadAssociations();
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['data-table']} */ ;
/** @type {__VLS_StyleScopedClasses['data-table']} */ ;
/** @type {__VLS_StyleScopedClasses['data-table']} */ ;
/** @type {__VLS_StyleScopedClasses['data-table']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-edit-small']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-danger-small']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "admin-associations" },
});
/** @type {__VLS_StyleScopedClasses['admin-associations']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "page-header" },
});
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showCreateDialog = true;
            // @ts-ignore
            [showCreateDialog,];
        } },
    ...{ class: "btn-primary" },
});
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "icon" },
});
/** @type {__VLS_StyleScopedClasses['icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "table-container" },
});
/** @type {__VLS_StyleScopedClasses['table-container']} */ ;
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
__VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        colspan: "6",
        ...{ class: "loading-state" },
    });
    /** @type {__VLS_StyleScopedClasses['loading-state']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "spinner" },
    });
    /** @type {__VLS_StyleScopedClasses['spinner']} */ ;
}
else if (__VLS_ctx.associations.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        colspan: "6",
        ...{ class: "empty-state" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
}
else {
    for (const [assoc] of __VLS_vFor((__VLS_ctx.associations))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (`${assoc.account}-${assoc.user}-${assoc.cluster}-${assoc.partition}`),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (assoc.user);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (assoc.account);
        if (assoc.is_default) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "default-badge" },
            });
            /** @type {__VLS_StyleScopedClasses['default-badge']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (assoc.cluster || '-');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (assoc.partition || '-');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (assoc.qos && assoc.qos.length > 0 ? assoc.qos.join(', ') : '-');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "action-buttons" },
        });
        /** @type {__VLS_StyleScopedClasses['action-buttons']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    if (!!(__VLS_ctx.associations.length === 0))
                        return;
                    __VLS_ctx.editAssociation(assoc);
                    // @ts-ignore
                    [loading, associations, associations, editAssociation,];
                } },
            ...{ class: "btn-edit-small" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-edit-small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    if (!!(__VLS_ctx.associations.length === 0))
                        return;
                    __VLS_ctx.deleteAssociation(assoc);
                    // @ts-ignore
                    [deleteAssociation,];
                } },
            ...{ class: "btn-danger-small" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-danger-small']} */ ;
        // @ts-ignore
        [];
    }
}
if (__VLS_ctx.showCreateDialog) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCreateDialog))
                    return;
                __VLS_ctx.showCreateDialog = false;
                // @ts-ignore
                [showCreateDialog, showCreateDialog,];
            } },
        ...{ class: "modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-content" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    (__VLS_ctx.isEditing ? '编辑资源绑定' : '创建资源绑定');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCreateDialog))
                    return;
                __VLS_ctx.showCreateDialog = false;
                // @ts-ignore
                [showCreateDialog, isEditing,];
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.newAssociation.user),
        disabled: (__VLS_ctx.isEditing),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    for (const [user] of __VLS_vFor((__VLS_ctx.slurmUsers))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (user.name),
            value: (user.name),
        });
        (user.name);
        // @ts-ignore
        [isEditing, newAssociation, slurmUsers,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
    (__VLS_ctx.isEditing ? '（编辑时不可更改）' : '');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.newAssociation.account),
        disabled: (__VLS_ctx.isEditing),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    for (const [account] of __VLS_vFor((__VLS_ctx.slurmAccounts))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (account.name),
            value: (account.name),
        });
        (account.name);
        // @ts-ignore
        [isEditing, isEditing, newAssociation, slurmAccounts,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
    (__VLS_ctx.isEditing ? '（编辑时不可更改）' : '');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        value: (__VLS_ctx.newAssociation.cluster),
        type: "text",
        placeholder: "输入集群名",
        disabled: (__VLS_ctx.isEditing),
    });
    if (!__VLS_ctx.isEditing) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        value: (__VLS_ctx.newAssociation.partition),
        type: "text",
        placeholder: "输入分区名（可选）",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        value: (__VLS_ctx.qosInput),
        type: "text",
        placeholder: "例如: normal,high",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-footer" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-footer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCreateDialog))
                    return;
                __VLS_ctx.showCreateDialog = false;
                // @ts-ignore
                [showCreateDialog, isEditing, isEditing, isEditing, newAssociation, newAssociation, qosInput,];
            } },
        ...{ class: "btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.saveAssociation) },
        ...{ class: "btn-primary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    (__VLS_ctx.isEditing ? '保存' : '创建');
}
// @ts-ignore
[isEditing, saveAssociation,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
