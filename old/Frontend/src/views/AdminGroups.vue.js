/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted } from 'vue';
import { groupAPI } from '../api';
import { dialog } from '../utils/dialog';
const groups = ref([]);
const loading = ref(false);
const error = ref('');
const saving = ref(false);
const showAddModal = ref(false);
const showEditModal = ref(false);
const selectedGroup = ref(null);
const formData = ref({
    groupName: '',
    gid: 0,
    members: []
});
const membersText = computed({
    get: () => formData.value.members.join('\n'),
    set: (value) => {
        formData.value.members = value.split('\n').map(m => m.trim()).filter(m => m);
    }
});
// 加载用户组列表
const loadGroups = async () => {
    loading.value = true;
    error.value = '';
    try {
        groups.value = await groupAPI.getGroups();
    }
    catch (err) {
        error.value = err.response?.data?.error || '加载用户组列表失败';
        console.error('Failed to load groups:', err);
    }
    finally {
        loading.value = false;
    }
};
// 打开添加用户组模态框并自动获取 GID
const openAddModal = async () => {
    try {
        const gid = await groupAPI.getNextGID();
        formData.value.gid = gid;
    }
    catch (err) {
        console.error('Failed to get next GID:', err);
        // 如果失败，使用默认值
        formData.value.gid = 1000;
    }
    showAddModal.value = true;
};
// 编辑用户组
const editGroup = (group) => {
    selectedGroup.value = group;
    formData.value = { ...group, members: [...(group.members || [])] };
    showEditModal.value = true;
};
// 保存用户组
const saveGroup = async () => {
    saving.value = true;
    error.value = '';
    try {
        if (showAddModal.value) {
            // 创建用户组
            await groupAPI.createGroup(formData.value);
            groups.value.push({ ...formData.value });
            dialog.success('用户组创建成功');
        }
        else {
            // 更新用户组
            await groupAPI.updateGroup(formData.value.gid, formData.value);
            const index = groups.value.findIndex(g => g.gid === formData.value.gid);
            if (index !== -1)
                groups.value[index] = { ...formData.value };
            dialog.success('用户组更新成功');
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
// 确认删除
const confirmDelete = async (group) => {
    if (await dialog.confirmDelete(group.groupName, '用户组')) {
        deleteGroup(group.gid);
    }
};
// 删除用户组
const deleteGroup = async (gid) => {
    try {
        await groupAPI.deleteGroup(gid);
        groups.value = groups.value.filter(g => g.gid !== gid);
        dialog.success('用户组删除成功');
    }
    catch (err) {
        dialog.error(err.response?.data?.error || '删除失败');
    }
};
// 关闭模态框
const closeModals = () => {
    showAddModal.value = false;
    showEditModal.value = false;
    selectedGroup.value = null;
    formData.value = {
        groupName: '',
        gid: 0,
        members: []
    };
};
onMounted(() => {
    loadGroups();
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
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "admin-groups" },
});
/** @type {__VLS_StyleScopedClasses['admin-groups']} */ ;
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
    for (const [group] of __VLS_vFor((__VLS_ctx.groups))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (group.gid),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        (group.groupName);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (group.gid);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (group.members?.length || 0);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "members-list" },
        });
        /** @type {__VLS_StyleScopedClasses['members-list']} */ ;
        for (const [member] of __VLS_vFor((group.members))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                key: (member),
                ...{ class: "member-tag" },
            });
            /** @type {__VLS_StyleScopedClasses['member-tag']} */ ;
            (member);
            // @ts-ignore
            [openAddModal, loading, error, error, groups,];
        }
        if (!group.members || group.members.length === 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-muted" },
            });
            /** @type {__VLS_StyleScopedClasses['text-muted']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "action-buttons" },
        });
        /** @type {__VLS_StyleScopedClasses['action-buttons']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.error))
                        return;
                    __VLS_ctx.editGroup(group);
                    // @ts-ignore
                    [editGroup,];
                } },
            ...{ class: "btn-link" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.error))
                        return;
                    __VLS_ctx.confirmDelete(group);
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
    (__VLS_ctx.showEditModal ? '编辑用户组' : '添加用户组');
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
    (__VLS_ctx.formData.groupName);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        disabled: (__VLS_ctx.showEditModal),
    });
    (__VLS_ctx.formData.gid);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
        value: (__VLS_ctx.membersText),
        rows: "5",
        placeholder: "每行一个用户名，例如：&#10;user1&#10;user2&#10;user3",
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
        ...{ onClick: (__VLS_ctx.closeModals) },
        ...{ class: "btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.saveGroup) },
        ...{ class: "btn-primary" },
        disabled: (__VLS_ctx.saving),
    });
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    (__VLS_ctx.saving ? '保存中...' : '保存');
}
// @ts-ignore
[showAddModal, showEditModal, showEditModal, showEditModal, showEditModal, closeModals, closeModals, formData, formData, membersText, saveGroup, saving, saving,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
