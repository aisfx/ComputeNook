/// <reference types="../../node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, onMounted, watch } from 'vue';
import { slurmUserAPI, slurmAccountAPI, userAPI } from '../api';
import { showSuccess, showError } from '../utils/notification';
const users = ref([]);
const slurmAccounts = ref([]);
const ldapUsers = ref([]);
const loading = ref(false);
const error = ref('');
const saving = ref(false);
const showModal = ref(false);
const isEditing = ref(false);
const formData = ref({
    name: '',
    default_account: '',
    admin_level: 'None',
    password: '',
    cn_name: '',
    email: '',
    phone: '',
    shell: '/bin/bash',
    home_dir: ''
});
const loadUsers = async () => {
    loading.value = true;
    error.value = '';
    try {
        users.value = await slurmUserAPI.getUsers();
    }
    catch (err) {
        error.value = err.response?.data?.error || '加载用户列表失败';
        showError(error.value);
    }
    finally {
        loading.value = false;
    }
};
const loadSlurmAccounts = async () => {
    try {
        slurmAccounts.value = await slurmAccountAPI.getAccounts();
    }
    catch (err) {
        showError('加载账户列表失败: ' + (err.response?.data?.error || err.message));
    }
};
// 加载 LDAP 系统用户列表
const loadLdapUsers = async () => {
    try {
        ldapUsers.value = await userAPI.getUsers();
    }
    catch (err) {
        console.error('加载 LDAP 用户失败:', err);
        showError('加载 LDAP 用户失败');
    }
};
const openAddModal = async () => {
    isEditing.value = false;
    formData.value = {
        name: '',
        default_account: '',
        admin_level: 'None',
        password: '',
        cn_name: '',
        email: '',
        phone: '',
        shell: '/bin/bash',
        home_dir: ''
    };
    // 加载 LDAP 用户列表
    await loadLdapUsers();
    showModal.value = true;
};
const editUser = (user) => {
    isEditing.value = true;
    formData.value = {
        name: user.name,
        default_account: user.default_account || '',
        admin_level: user.admin_level || 'None',
        password: '',
        cn_name: '',
        email: '',
        phone: '',
        shell: '/bin/bash',
        home_dir: ''
    };
    showModal.value = true;
};
const saveUser = async () => {
    if (!formData.value.name) {
        showError('用户名不能为空');
        return;
    }
    saving.value = true;
    try {
        if (isEditing.value) {
            // 更新用户（只更新 admin_level）
            await slurmUserAPI.updateUser(formData.value.name, {
                name: formData.value.name,
                admin_level: formData.value.admin_level
            });
            showSuccess('用户更新成功');
        }
        else {
            // 创建 Slurm 用户（关联已存在的 LDAP 用户）
            const userData = {
                name: formData.value.name,
                admin_level: formData.value.admin_level,
                default_account: formData.value.default_account || undefined
            };
            const response = await slurmUserAPI.createUser(userData);
            // 显示成功信息
            if (formData.value.default_account) {
                showSuccess(`Slurm 用户创建成功！已关联到账户 ${formData.value.default_account}`);
            }
            else {
                showSuccess('Slurm 用户创建成功');
            }
        }
        closeModal();
        await loadUsers();
    }
    catch (err) {
        showError(err.response?.data?.error || '保存失败');
    }
    finally {
        saving.value = false;
    }
};
const confirmDelete = (user) => {
    if (confirm(`确定要删除用户 ${user.name} 吗？此操作不可恢复！`)) {
        deleteUser(user.name);
    }
};
const deleteUser = async (name) => {
    try {
        await slurmUserAPI.deleteUser(name);
        showSuccess('用户删除成功');
        await loadUsers();
    }
    catch (err) {
        showError(err.response?.data?.error || '删除失败');
    }
};
const closeModal = () => {
    showModal.value = false;
    formData.value = {
        name: '',
        default_account: '',
        admin_level: 'None',
        password: '',
        cn_name: '',
        email: '',
        phone: '',
        shell: '/bin/bash',
        home_dir: ''
    };
};
// 监听模态框打开，加载账户列表
watch(showModal, (newVal) => {
    if (newVal) {
        loadSlurmAccounts();
    }
});
onMounted(() => {
    loadUsers();
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
/** @type {__VLS_StyleScopedClasses['data-table']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "admin-slurm-users" },
});
/** @type {__VLS_StyleScopedClasses['admin-slurm-users']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "page-header" },
});
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "header-info" },
});
/** @type {__VLS_StyleScopedClasses['header-info']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "header-desc" },
});
/** @type {__VLS_StyleScopedClasses['header-desc']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.openAddModal) },
    ...{ class: "btn-primary" },
});
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "loading" },
    });
    /** @type {__VLS_StyleScopedClasses['loading']} */ ;
}
else if (__VLS_ctx.error) {
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
    for (const [user] of __VLS_vFor((__VLS_ctx.users))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (user.name),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        (user.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        if (user.default_account && user.default_account !== '') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (user.default_account);
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-muted" },
            });
            /** @type {__VLS_StyleScopedClasses['text-muted']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: (['badge', user.admin_level === 'Administrator' ? 'badge-admin' : 'badge-user']) },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        (user.admin_level || 'None');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "action-buttons" },
        });
        /** @type {__VLS_StyleScopedClasses['action-buttons']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    if (!!(__VLS_ctx.error))
                        return;
                    __VLS_ctx.editUser(user);
                    // @ts-ignore
                    [openAddModal, loading, error, error, users, editUser,];
                } },
            ...{ class: "btn-link" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    if (!!(__VLS_ctx.error))
                        return;
                    __VLS_ctx.confirmDelete(user);
                    // @ts-ignore
                    [confirmDelete,];
                } },
            ...{ class: "btn-link danger" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
        /** @type {__VLS_StyleScopedClasses['danger']} */ ;
        // @ts-ignore
        [];
    }
}
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
    (__VLS_ctx.isEditing ? '编辑用户' : '添加用户');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeModal) },
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
    if (!__VLS_ctx.isEditing) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.formData.name),
            disabled: (__VLS_ctx.isEditing),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        for (const [user] of __VLS_vFor((__VLS_ctx.ldapUsers))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (user.uid),
                value: (user.username),
            });
            (user.username);
            (user.cnName);
            (user.uid);
            // @ts-ignore
            [showModal, isEditing, isEditing, isEditing, closeModal, formData, ldapUsers,];
        }
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            disabled: true,
        });
        (__VLS_ctx.formData.name);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.formData.default_account),
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
        [formData, formData, slurmAccounts,];
    }
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.formData.admin_level),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "None",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "Operator",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "Administrator",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-footer" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-footer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeModal) },
        ...{ class: "btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.saveUser) },
        ...{ class: "btn-primary" },
        disabled: (__VLS_ctx.saving),
    });
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    (__VLS_ctx.saving ? '保存中...' : '保存');
}
// @ts-ignore
[isEditing, closeModal, formData, saveUser, saving, saving,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
