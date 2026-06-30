/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, reactive, onMounted, onUnmounted, watch } from 'vue';
import axios from 'axios';
import { userAPI, mfaAPI } from '../api';
import { dialog } from '../utils/dialog';
// 从运行时配置读取家目录基础路径
const getHomeBasePath = () => {
    return (window.__CONFIG__?.homeBasePath || '/home').replace(/\/$/, '');
};
const users = ref([]);
const openDropdown = reactive({});
const loading = ref(false);
const error = ref('');
const saving = ref(false);
const showAddModal = ref(false);
const showEditModal = ref(false);
const showPasswordModal = ref(false);
const selectedUser = ref(null);
const newPassword = ref('');
const formData = ref({
    username: '',
    uid: 0,
    gid: 0,
    cnName: '',
    email: '',
    phone: '',
    shell: '/bin/bash',
    homeDir: '',
    password: '',
    disabled: false,
    passwordMustChange: false
});
// 加载用户列表
const loadUsers = async () => {
    loading.value = true;
    error.value = '';
    try {
        users.value = await userAPI.getUsers();
    }
    catch (err) {
        error.value = err.response?.data?.error || '加载用户列表失败';
        console.error('Failed to load users:', err);
    }
    finally {
        loading.value = false;
    }
};
// MFA 状态 map: username -> {confirmed, enabled}
const mfaStatus = ref({});
const loadMFAStatus = async () => {
    try {
        const res = await axios.get('/mfa/admin/list');
        const map = {};
        for (const item of res.data.data || []) {
            map[item.username] = item;
        }
        mfaStatus.value = map;
    }
    catch (_) { }
};
const resetMFA = async (user) => {
    if (!await dialog.confirm(`确定要重置 ${user.username} 的 MFA 绑定吗？该用户下次登录需重新绑定。`, { title: '重置 MFA' }))
        return;
    try {
        await mfaAPI.adminReset(user.username);
        delete mfaStatus.value[user.username];
        dialog.success('MFA 已重置');
    }
    catch (err) {
        dialog.error(err.response?.data?.error || '重置失败');
    }
};
// 打开添加用户模态框并自动获取 UID/GID
const openAddModal = async () => {
    try {
        const [uid, gid] = await Promise.all([
            userAPI.getNextUID(),
            userAPI.getNextUID()
        ]);
        formData.value.uid = uid;
        formData.value.gid = gid;
        formData.value.homeDir = `${getHomeBasePath()}/${formData.value.username || ''}`;
    }
    catch (err) {
        console.error('Failed to get next UID/GID:', err);
        formData.value.uid = 1000;
        formData.value.gid = 1000;
    }
    showAddModal.value = true;
};
// 用户名变化时自动更新家目录（仅添加模式）
watch(() => formData.value.username, (newName) => {
    if (showAddModal.value) {
        formData.value.homeDir = `${getHomeBasePath()}/${newName}`;
    }
});
// 编辑用户
const editUser = (user) => {
    selectedUser.value = user;
    formData.value = { ...user, password: '' };
    showEditModal.value = true;
};
// 保存用户
const saveUser = async () => {
    saving.value = true;
    error.value = '';
    try {
        if (showAddModal.value) {
            // 创建用户
            if (!formData.value.password) {
                error.value = '密码不能为空';
                saving.value = false;
                return;
            }
            await userAPI.createUser(formData.value);
            dialog.success('用户创建成功');
            await loadUsers();
        }
        else {
            await userAPI.updateUser(formData.value.username, formData.value);
            dialog.success('用户更新成功');
            await loadUsers();
        }
        closeModals();
    }
    catch (err) {
        error.value = err.response?.data?.error || '保存失败';
        dialog.error(error.value);
    }
    finally {
        saving.value = false;
    }
};
// 显示重置密码模态框
const showResetPasswordModal = (user) => {
    selectedUser.value = user;
    newPassword.value = '';
    showPasswordModal.value = true;
};
// 重置密码
const resetPassword = async () => {
    if (!newPassword.value || newPassword.value.length < 6) {
        dialog.warning('密码至少需要6个字符');
        return;
    }
    saving.value = true;
    try {
        await userAPI.resetPassword(selectedUser.value.username, newPassword.value);
        dialog.success('密码重置成功');
        showPasswordModal.value = false;
    }
    catch (err) {
        dialog.error(err.response?.data?.error || '重置密码失败');
    }
    finally {
        saving.value = false;
    }
};
const confirmDelete = async (user) => {
    if (await dialog.confirmDelete(user.username, '用户')) {
        deleteUser(user.username);
    }
};
const deleteUser = async (username) => {
    try {
        await userAPI.deleteUser(username);
        users.value = users.value.filter(u => u.username !== username);
        dialog.success('用户删除成功');
    }
    catch (err) {
        dialog.error(err.response?.data?.error || '删除失败');
    }
};
// 关闭模态框
const closeModals = () => {
    showAddModal.value = false;
    showEditModal.value = false;
    selectedUser.value = null;
    formData.value = {
        username: '',
        uid: 0,
        gid: 0,
        cnName: '',
        email: '',
        phone: '',
        shell: '/bin/bash',
        homeDir: '',
        password: '',
        disabled: false,
        passwordMustChange: false
    };
};
const toggleUserStatus = async (user) => {
    const action = user.disabled ? '启用' : '禁用';
    if (!await dialog.confirm(`确定要${action}用户 ${user.username} 吗？`, { title: `${action}用户` }))
        return;
    try {
        await userAPI.setUserDisabled(user.username, !user.disabled);
        user.disabled = !user.disabled;
        dialog.success(`用户${action}成功`);
    }
    catch (err) {
        dialog.error(err.response?.data?.error || `${action}失败`);
    }
};
const togglePasswordMustChange = async (user) => {
    const action = user.passwordMustChange ? '取消强制修改密码' : '设置强制修改密码';
    if (!await dialog.confirm(`确定要为用户 ${user.username} ${action}吗？`, { title: action }))
        return;
    try {
        await userAPI.setPasswordMustChange(user.username, !user.passwordMustChange);
        user.passwordMustChange = !user.passwordMustChange;
        dialog.success(`${action}成功`);
    }
    catch (err) {
        dialog.error(err.response?.data?.error || '操作失败');
    }
};
const toggleDropdown = (user) => {
    const current = openDropdown[user.username];
    Object.keys(openDropdown).forEach(k => { openDropdown[k] = false; });
    openDropdown[user.username] = !current;
};
const closeDropdown = (user) => {
    openDropdown[user.username] = false;
};
const closeAllDropdowns = () => {
    Object.keys(openDropdown).forEach(k => { openDropdown[k] = false; });
};
onMounted(() => {
    loadUsers();
    loadMFAStatus();
    document.addEventListener('click', closeAllDropdowns);
});
onUnmounted(() => {
    document.removeEventListener('click', closeAllDropdowns);
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
/** @type {__VLS_StyleScopedClasses['btn-action-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['dropdown-item']} */ ;
/** @type {__VLS_StyleScopedClasses['dropdown-item']} */ ;
/** @type {__VLS_StyleScopedClasses['dropdown-item']} */ ;
/** @type {__VLS_StyleScopedClasses['dropdown-item']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "admin-users" },
});
/** @type {__VLS_StyleScopedClasses['admin-users']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "page-header" },
});
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
    for (const [user] of __VLS_vFor((__VLS_ctx.users))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (user.username),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        (user.username);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (user.uid);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (user.gid);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (user.cnName);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (user.email || '-');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (user.phone || '-');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
        (user.shell);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
        (user.homeDir);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: (['badge', user.isAdmin ? 'badge-admin' : 'badge-user']) },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        (user.isAdmin ? '✅ 是' : '❌ 否');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "status-badges" },
        });
        /** @type {__VLS_StyleScopedClasses['status-badges']} */ ;
        if (user.disabled) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-disabled" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-disabled']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-active" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-active']} */ ;
        }
        if (user.passwordMustChange) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-warning" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        if (__VLS_ctx.mfaStatus[user.username]?.confirmed) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-active" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-active']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-disabled" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-disabled']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "action-dropdown" },
        });
        /** @type {__VLS_StyleScopedClasses['action-dropdown']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.error))
                        return;
                    __VLS_ctx.toggleDropdown(user);
                    // @ts-ignore
                    [openAddModal, loading, error, error, users, mfaStatus, toggleDropdown,];
                } },
            ...{ class: "btn-action-toggle" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-action-toggle']} */ ;
        if (__VLS_ctx.openDropdown[user.username]) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ onClick: () => { } },
                ...{ class: "dropdown-menu" },
            });
            /** @type {__VLS_StyleScopedClasses['dropdown-menu']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.error))
                            return;
                        if (!(__VLS_ctx.openDropdown[user.username]))
                            return;
                        __VLS_ctx.editUser(user);
                        __VLS_ctx.closeDropdown(user);
                        // @ts-ignore
                        [openDropdown, editUser, closeDropdown,];
                    } },
                ...{ class: "dropdown-item" },
            });
            /** @type {__VLS_StyleScopedClasses['dropdown-item']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.error))
                            return;
                        if (!(__VLS_ctx.openDropdown[user.username]))
                            return;
                        __VLS_ctx.showResetPasswordModal(user);
                        __VLS_ctx.closeDropdown(user);
                        // @ts-ignore
                        [closeDropdown, showResetPasswordModal,];
                    } },
                ...{ class: "dropdown-item" },
            });
            /** @type {__VLS_StyleScopedClasses['dropdown-item']} */ ;
            if (!user.disabled) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.error))
                                return;
                            if (!(__VLS_ctx.openDropdown[user.username]))
                                return;
                            if (!(!user.disabled))
                                return;
                            __VLS_ctx.toggleUserStatus(user);
                            __VLS_ctx.closeDropdown(user);
                            // @ts-ignore
                            [closeDropdown, toggleUserStatus,];
                        } },
                    ...{ class: "dropdown-item warning" },
                });
                /** @type {__VLS_StyleScopedClasses['dropdown-item']} */ ;
                /** @type {__VLS_StyleScopedClasses['warning']} */ ;
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.error))
                                return;
                            if (!(__VLS_ctx.openDropdown[user.username]))
                                return;
                            if (!!(!user.disabled))
                                return;
                            __VLS_ctx.toggleUserStatus(user);
                            __VLS_ctx.closeDropdown(user);
                            // @ts-ignore
                            [closeDropdown, toggleUserStatus,];
                        } },
                    ...{ class: "dropdown-item success" },
                });
                /** @type {__VLS_StyleScopedClasses['dropdown-item']} */ ;
                /** @type {__VLS_StyleScopedClasses['success']} */ ;
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.error))
                            return;
                        if (!(__VLS_ctx.openDropdown[user.username]))
                            return;
                        __VLS_ctx.togglePasswordMustChange(user);
                        __VLS_ctx.closeDropdown(user);
                        // @ts-ignore
                        [closeDropdown, togglePasswordMustChange,];
                    } },
                ...{ class: "dropdown-item" },
            });
            /** @type {__VLS_StyleScopedClasses['dropdown-item']} */ ;
            (user.passwordMustChange ? '🔓 取消强制改密' : '🔒 强制改密');
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "dropdown-divider" },
            });
            /** @type {__VLS_StyleScopedClasses['dropdown-divider']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.error))
                            return;
                        if (!(__VLS_ctx.openDropdown[user.username]))
                            return;
                        __VLS_ctx.resetMFA(user);
                        __VLS_ctx.closeDropdown(user);
                        // @ts-ignore
                        [closeDropdown, resetMFA,];
                    } },
                ...{ class: "dropdown-item warning" },
            });
            /** @type {__VLS_StyleScopedClasses['dropdown-item']} */ ;
            /** @type {__VLS_StyleScopedClasses['warning']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "dropdown-divider" },
            });
            /** @type {__VLS_StyleScopedClasses['dropdown-divider']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.error))
                            return;
                        if (!(__VLS_ctx.openDropdown[user.username]))
                            return;
                        __VLS_ctx.confirmDelete(user);
                        __VLS_ctx.closeDropdown(user);
                        // @ts-ignore
                        [closeDropdown, confirmDelete,];
                    } },
                ...{ class: "dropdown-item danger" },
            });
            /** @type {__VLS_StyleScopedClasses['dropdown-item']} */ ;
            /** @type {__VLS_StyleScopedClasses['danger']} */ ;
        }
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
if (__VLS_ctx.showAddModal || __VLS_ctx.showEditModal) {
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
    (__VLS_ctx.showEditModal ? '编辑用户' : '添加用户');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeModals) },
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        disabled: (__VLS_ctx.showEditModal),
    });
    (__VLS_ctx.formData.username);
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
    });
    (__VLS_ctx.formData.uid);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
    });
    (__VLS_ctx.formData.gid);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({});
    (__VLS_ctx.formData.cnName);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "email",
    });
    (__VLS_ctx.formData.email);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({});
    (__VLS_ctx.formData.phone);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "/bin/bash",
    });
    (__VLS_ctx.formData.shell);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({});
    (__VLS_ctx.formData.homeDir);
    if (__VLS_ctx.showAddModal) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "form-group" },
        });
        /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "password",
        });
        (__VLS_ctx.formData.password);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-footer" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-footer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeModals) },
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
if (__VLS_ctx.showPasswordModal) {
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
    (__VLS_ctx.selectedUser?.username);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showPasswordModal))
                    return;
                __VLS_ctx.showPasswordModal = false;
                // @ts-ignore
                [showAddModal, showAddModal, showEditModal, showEditModal, showEditModal, closeModals, closeModals, formData, formData, formData, formData, formData, formData, formData, formData, formData, saveUser, saving, saving, showPasswordModal, showPasswordModal, selectedUser,];
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "password",
        placeholder: "至少6个字符",
    });
    (__VLS_ctx.newPassword);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-footer" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-footer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showPasswordModal))
                    return;
                __VLS_ctx.showPasswordModal = false;
                // @ts-ignore
                [showPasswordModal, newPassword,];
            } },
        ...{ class: "btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.resetPassword) },
        ...{ class: "btn-primary" },
        disabled: (__VLS_ctx.saving),
    });
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    (__VLS_ctx.saving ? '重置中...' : '重置密码');
}
// @ts-ignore
[saving, saving, resetPassword,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
