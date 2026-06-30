/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import { getAssociations, createAssociation as apiCreateAssociation, updateAssociation as apiUpdateAssociation, deleteAssociation as apiDeleteAssociation } from '../api';
import { slurmUserAPI, slurmAccountAPI } from '../api';
import { showSuccess, showError } from '../utils/notification';
import dialog from '../utils/dialog';
const associations = ref([]);
const slurmUsers = ref([]);
const slurmAccounts = ref([]);
const showCreateDialog = ref(false);
const isEditing = ref(false);
const qosInput = ref('');
const originalAssociation = ref(null);
const loading = ref(false);
const openMenu = ref(null);
const menuPosition = ref({ top: 0, left: 0 });
const newAssociation = ref({ user: '', account: '', cluster: 'cluster', partition: '', qos: [] });
const associationKey = (assoc) => `${assoc.account}-${assoc.user}-${assoc.cluster || ''}-${assoc.partition || ''}`;
const openMenuAssoc = computed(() => associations.value.find(assoc => associationKey(assoc) === openMenu.value) || null);
const isAccountAssociationEdit = computed(() => isEditing.value && !newAssociation.value.user);
const menuStyle = computed(() => ({
    top: `${menuPosition.value.top}px`,
    left: `${menuPosition.value.left}px`
}));
const toggleMenu = (assoc, event) => {
    const key = associationKey(assoc);
    if (openMenu.value === key) {
        openMenu.value = null;
        return;
    }
    const trigger = event.currentTarget;
    const rect = trigger.getBoundingClientRect();
    const menuWidth = 130;
    const gap = 6;
    menuPosition.value = {
        top: Math.round(rect.bottom + gap),
        left: Math.round(Math.max(8, rect.right - menuWidth))
    };
    openMenu.value = key;
};
const normalizeList = (value) => {
    if (Array.isArray(value))
        return value;
    if (Array.isArray(value?.data))
        return value.data;
    if (Array.isArray(value?.accounts))
        return value.accounts;
    if (Array.isArray(value?.users))
        return value.users;
    return [];
};
const loadAssociations = async () => {
    loading.value = true;
    try {
        const response = await getAssociations();
        associations.value = normalizeList(response.data.data)
            .map(normalizeAssociation)
            .filter(assoc => !!assoc.user);
    }
    catch (error) {
        showError('加载资源绑定失败: ' + (error.response?.data?.error || error.message));
    }
    finally {
        loading.value = false;
    }
};
const normalizeAssociation = (assoc) => {
    const qos = assoc.qos || assoc.QoS || assoc.Qos || [];
    return {
        user: assoc.user || assoc.User || '',
        account: assoc.account || assoc.Account || '',
        cluster: assoc.cluster || assoc.Cluster || 'cluster',
        partition: assoc.partition || assoc.Partition || '',
        qos: Array.isArray(qos) ? qos : String(qos || '').split(',').map(q => q.trim()).filter(Boolean),
        is_default: assoc.is_default || assoc.IsDefault || false
    };
};
const editAssociation = (assoc) => {
    const normalizedAssoc = normalizeAssociation(assoc);
    if (!normalizedAssoc.user) {
        showError('账户级绑定请在账户配置中修改');
        return;
    }
    isEditing.value = true;
    originalAssociation.value = { ...normalizedAssoc };
    newAssociation.value = { ...normalizedAssoc };
    qosInput.value = normalizedAssoc.qos?.length ? normalizedAssoc.qos.join(', ') : '';
    showCreateDialog.value = true;
};
const saveAssociation = async () => {
    if (!newAssociation.value.user || !newAssociation.value.account) {
        showError('用户和账户不能为空');
        return;
    }
    try {
        const qosList = qosInput.value.split(',').map(q => q.trim()).filter(q => q.length > 0);
        const assocData = { ...newAssociation.value, cluster: newAssociation.value.cluster || 'cluster', qos: qosList.length > 0 ? qosList : undefined };
        if (isEditing.value && originalAssociation.value) {
            await apiUpdateAssociation(originalAssociation.value.account, originalAssociation.value.user || '', originalAssociation.value.cluster || '', assocData);
            showSuccess('资源绑定更新成功');
        }
        else {
            await apiCreateAssociation(assocData);
            showSuccess('资源绑定创建成功');
        }
        showCreateDialog.value = false;
        resetForm();
        setTimeout(loadAssociations, 1000);
    }
    catch (error) {
        showError((isEditing.value ? '更新' : '创建') + '资源绑定失败: ' + (error.response?.data?.error || error.message));
    }
};
const deleteAssociation = async (assoc) => {
    if (!assoc.account) {
        showError('参数错误');
        return;
    }
    const userAssocs = associations.value.filter(a => a.user === assoc.user);
    const isOnly = !!assoc.user && userAssocs.length === 1;
    const msg = !assoc.user
        ? `确定要删除账户 ${assoc.account} 的账户级绑定吗？`
        : isOnly
            ? `这是用户 ${assoc.user} 的唯一账户绑定，删除后将无法使用任何账户。确定继续吗？`
            : `确定要删除用户 ${assoc.user} 与账户 ${assoc.account} 的绑定吗？`;
    const ok = await dialog.confirm(msg, { title: '删除资源绑定' });
    if (!ok)
        return;
    try {
        await apiDeleteAssociation(assoc.account, assoc.user || '', assoc.cluster || '', assoc.partition || '');
        showSuccess('资源绑定删除成功');
        await loadAssociations();
    }
    catch (error) {
        const msg = error.response?.data?.error || error.message;
        if (msg.includes('can not remove the default account')) {
            showError('无法删除默认账户绑定，请先为用户创建新的账户绑定后再删除');
        }
        else {
            showError('删除资源绑定失败: ' + msg);
        }
    }
};
const resetForm = () => {
    isEditing.value = false;
    originalAssociation.value = null;
    newAssociation.value = { user: '', account: '', cluster: 'cluster', partition: '', qos: [] };
    qosInput.value = '';
};
watch(showCreateDialog, (val) => {
    if (val) {
        if (!isEditing.value)
            newAssociation.value.cluster = 'cluster';
        slurmUserAPI.getUsers().then(r => { slurmUsers.value = normalizeList(r); }).catch(() => { });
        slurmAccountAPI.getAccounts().then(r => { slurmAccounts.value = normalizeList(r); }).catch(() => { });
    }
    else {
        resetForm();
    }
});
const closeMenu = () => { openMenu.value = null; };
onMounted(() => {
    loadAssociations();
    document.addEventListener('click', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('resize', closeMenu);
});
onUnmounted(() => {
    document.removeEventListener('click', closeMenu);
    window.removeEventListener('scroll', closeMenu, true);
    window.removeEventListener('resize', closeMenu);
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['btn-action-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['dropdown-item']} */ ;
/** @type {__VLS_StyleScopedClasses['dropdown-item']} */ ;
/** @type {__VLS_StyleScopedClasses['dropdown-item']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "admin-associations" },
});
/** @type {__VLS_StyleScopedClasses['admin-associations']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "page-header" },
});
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "page-desc" },
});
/** @type {__VLS_StyleScopedClasses['page-desc']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showCreateDialog = true;
            // @ts-ignore
            [showCreateDialog,];
        } },
    ...{ class: "btn btn-primary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "loading" },
    });
    /** @type {__VLS_StyleScopedClasses['loading']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "spinner" },
    });
    /** @type {__VLS_StyleScopedClasses['spinner']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
        ...{ class: "table" },
    });
    /** @type {__VLS_StyleScopedClasses['table']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
    if (!__VLS_ctx.associations.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            colspan: "6",
            ...{ style: {} },
        });
    }
    for (const [assoc] of __VLS_vFor((__VLS_ctx.associations))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (`${assoc.account}-${assoc.user}-${assoc.cluster}-${assoc.partition}`),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "user-cell" },
        });
        /** @type {__VLS_StyleScopedClasses['user-cell']} */ ;
        if (assoc.user) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "user-avatar" },
            });
            /** @type {__VLS_StyleScopedClasses['user-avatar']} */ ;
            (assoc.user[0]?.toUpperCase());
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "user-name" },
        });
        /** @type {__VLS_StyleScopedClasses['user-name']} */ ;
        (assoc.user);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "account-tag" },
        });
        /** @type {__VLS_StyleScopedClasses['account-tag']} */ ;
        (assoc.account);
        if (assoc.is_default) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-success" },
                ...{ style: {} },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-success']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({
            ...{ class: "mono-tag" },
        });
        /** @type {__VLS_StyleScopedClasses['mono-tag']} */ ;
        (assoc.cluster || '-');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        if (assoc.partition) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "partition-tag" },
            });
            /** @type {__VLS_StyleScopedClasses['partition-tag']} */ ;
            (assoc.partition);
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-muted" },
            });
            /** @type {__VLS_StyleScopedClasses['text-muted']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        if (assoc.qos && assoc.qos.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "qos-list" },
            });
            /** @type {__VLS_StyleScopedClasses['qos-list']} */ ;
            for (const [q] of __VLS_vFor((assoc.qos))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    key: (q),
                    ...{ class: "qos-tag" },
                });
                /** @type {__VLS_StyleScopedClasses['qos-tag']} */ ;
                (q);
                // @ts-ignore
                [loading, associations, associations,];
            }
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-muted" },
            });
            /** @type {__VLS_StyleScopedClasses['text-muted']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    __VLS_ctx.toggleMenu(assoc, $event);
                    // @ts-ignore
                    [toggleMenu,];
                } },
            ...{ class: "btn-action-toggle" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-action-toggle']} */ ;
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
if (__VLS_ctx.openMenuAssoc) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "dropdown-menu dropdown-menu-fixed" },
        ...{ style: (__VLS_ctx.menuStyle) },
    });
    /** @type {__VLS_StyleScopedClasses['dropdown-menu']} */ ;
    /** @type {__VLS_StyleScopedClasses['dropdown-menu-fixed']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.openMenuAssoc))
                    return;
                __VLS_ctx.editAssociation(__VLS_ctx.openMenuAssoc);
                __VLS_ctx.openMenu = null;
                // @ts-ignore
                [openMenuAssoc, openMenuAssoc, menuStyle, editAssociation, openMenu,];
            } },
        ...{ class: "dropdown-item" },
    });
    /** @type {__VLS_StyleScopedClasses['dropdown-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "dropdown-divider" },
    });
    /** @type {__VLS_StyleScopedClasses['dropdown-divider']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.openMenuAssoc))
                    return;
                __VLS_ctx.deleteAssociation(__VLS_ctx.openMenuAssoc);
                __VLS_ctx.openMenu = null;
                // @ts-ignore
                [openMenuAssoc, openMenu, deleteAssociation,];
            } },
        ...{ class: "dropdown-item danger" },
    });
    /** @type {__VLS_StyleScopedClasses['dropdown-item']} */ ;
    /** @type {__VLS_StyleScopedClasses['danger']} */ ;
}
if (__VLS_ctx.showCreateDialog) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal association-modal" },
    });
    /** @type {__VLS_StyleScopedClasses['modal']} */ ;
    /** @type {__VLS_StyleScopedClasses['association-modal']} */ ;
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
                [showCreateDialog, showCreateDialog, isEditing,];
            } },
        ...{ class: "btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    if (!__VLS_ctx.isAccountAssociationEdit) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "form-group" },
        });
        /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "required" },
        });
        /** @type {__VLS_StyleScopedClasses['required']} */ ;
        if (__VLS_ctx.isEditing) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                readonly: true,
                ...{ style: {} },
            });
            (__VLS_ctx.newAssociation.user);
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                value: (__VLS_ctx.newAssociation.user),
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
                [isEditing, isAccountAssociationEdit, newAssociation, newAssociation, slurmUsers,];
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
        (__VLS_ctx.isEditing ? '编辑时不可更改' : '从 Slurm 用户列表中选择');
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "form-group" },
        });
        /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: "账户级绑定",
            readonly: true,
            ...{ style: {} },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "required" },
    });
    /** @type {__VLS_StyleScopedClasses['required']} */ ;
    if (__VLS_ctx.isEditing) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            readonly: true,
            ...{ style: {} },
        });
        (__VLS_ctx.newAssociation.account);
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.newAssociation.account),
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
            [isEditing, isEditing, newAssociation, newAssociation, slurmAccounts,];
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
    (__VLS_ctx.isEditing ? '编辑时不可更改' : '从 Slurm 账户列表中选择');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-row" },
    });
    /** @type {__VLS_StyleScopedClasses['form-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "required" },
    });
    /** @type {__VLS_StyleScopedClasses['required']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "cluster",
        readonly: (__VLS_ctx.isEditing),
        ...{ style: (__VLS_ctx.isEditing ? 'background-color: #f5f5f5; cursor: not-allowed;' : '') },
    });
    (__VLS_ctx.newAssociation.cluster);
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
    (__VLS_ctx.isEditing ? '编辑时不可更改' : '默认: cluster');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "可选",
    });
    (__VLS_ctx.newAssociation.partition);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "多个用逗号分隔，如: normal,high",
    });
    (__VLS_ctx.qosInput);
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
                [showCreateDialog, isEditing, isEditing, isEditing, isEditing, newAssociation, newAssociation, qosInput,];
            } },
        ...{ class: "btn btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.saveAssociation) },
        ...{ class: "btn btn-primary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    (__VLS_ctx.isEditing ? '保存' : '创建');
}
// @ts-ignore
[isEditing, saveAssociation,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
