/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import notification from '../utils/notification';
const loading = ref(false);
const saving = ref(false);
const search = ref('');
const filterStatus = ref('');
const configError = ref('');
const quotaList = ref([]);
const showModal = ref(false);
const form = ref({ username: '', blockSoftGB: 0, blockHardGB: 100, inodeSoft: 0, inodeHard: 0, _prefill: false });
const usagePct = (item) => {
    const q = item.quotas?.[0];
    if (!q || !q.block_hard_kb)
        return 0;
    return Math.min(100, Math.round((q.block_used_kb / q.block_hard_kb) * 100));
};
const inodeUsagePct = (item) => {
    const q = item.quotas?.[0];
    if (!q || !q.inode_hard)
        return 0;
    return Math.min(100, Math.round((q.inode_used / q.inode_hard) * 100));
};
const formatSize = (kb) => {
    if (!kb)
        return '0';
    if (kb >= 1024 * 1024 * 1024)
        return (kb / 1024 / 1024 / 1024).toFixed(1) + ' TB';
    if (kb >= 1024 * 1024)
        return (kb / 1024 / 1024).toFixed(1) + ' GB';
    if (kb >= 1024)
        return (kb / 1024).toFixed(1) + ' MB';
    return kb + ' KB';
};
const formatInode = (count) => {
    if (!count)
        return '0';
    if (count >= 1000000)
        return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000)
        return (count / 1000).toFixed(1) + 'K';
    return count.toString();
};
const filtered = computed(() => {
    let list = quotaList.value;
    if (search.value) {
        const q = search.value.toLowerCase();
        list = list.filter(i => i.username.toLowerCase().includes(q));
    }
    if (filterStatus.value === 'crit')
        list = list.filter(i => usagePct(i) >= 90);
    else if (filterStatus.value === 'warn')
        list = list.filter(i => usagePct(i) >= 75 && usagePct(i) < 90);
    else if (filterStatus.value === 'ok')
        list = list.filter(i => usagePct(i) < 75 && i.quotas?.[0]?.block_hard_kb);
    else if (filterStatus.value === 'noset')
        list = list.filter(i => !i.quotas?.[0]?.block_hard_kb);
    return list;
});
async function loadAll() {
    loading.value = true;
    configError.value = '';
    try {
        const res = await axios.get('/files/quota/all');
        quotaList.value = res.data.data || [];
        // 检查是否有配置错误
        const errItem = quotaList.value.find(i => i.error);
        if (errItem)
            configError.value = errItem.error;
    }
    catch (e) {
        const msg = e.response?.data?.error || e.message;
        if (msg.includes('QUOTA_FS_TYPE') || msg.includes('文件系统')) {
            configError.value = msg;
        }
        else {
            notification.error(msg, '加载失败');
        }
    }
    finally {
        loading.value = false;
    }
}
function openSet(username = '', quota) {
    form.value = {
        username,
        blockSoftGB: quota?.block_soft_kb ? Math.round(quota.block_soft_kb / 1024 / 1024) : 0,
        blockHardGB: quota?.block_hard_kb ? Math.round(quota.block_hard_kb / 1024 / 1024) : 100,
        inodeSoft: quota?.inode_soft || 0,
        inodeHard: quota?.inode_hard || 0,
        _prefill: !!username,
    };
    showModal.value = true;
}
function applyPreset(gb) {
    form.value.blockHardGB = gb;
    form.value.blockSoftGB = Math.round(gb * 0.9);
    // 根据空间大小自动设置文件数配额（每 GB 约 10000 个文件）
    const estimatedFiles = gb * 10000;
    form.value.inodeHard = estimatedFiles;
    form.value.inodeSoft = Math.round(estimatedFiles * 0.9);
}
async function submitQuota() {
    if (!form.value.username.trim()) {
        notification.error('请输入用户名');
        return;
    }
    saving.value = true;
    try {
        await axios.post('/files/quota', {
            username: form.value.username,
            block_hard_kb: Number(form.value.blockHardGB) * 1024 * 1024,
            block_soft_kb: Number(form.value.blockSoftGB) * 1024 * 1024,
            inode_hard: Number(form.value.inodeHard) || 0,
            inode_soft: Number(form.value.inodeSoft) || 0,
        });
        notification.success(`用户 ${form.value.username} 配额设置成功`);
        showModal.value = false;
        loadAll();
    }
    catch (e) {
        notification.error(e.response?.data?.error || e.message, '设置失败');
    }
    finally {
        saving.value = false;
    }
}
onMounted(loadAll);
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['config-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-input']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-select']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-select']} */ ;
/** @type {__VLS_StyleScopedClasses['quota-table']} */ ;
/** @type {__VLS_StyleScopedClasses['quota-table']} */ ;
/** @type {__VLS_StyleScopedClasses['quota-table']} */ ;
/** @type {__VLS_StyleScopedClasses['quota-table']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['input-unit']} */ ;
/** @type {__VLS_StyleScopedClasses['input-unit']} */ ;
/** @type {__VLS_StyleScopedClasses['preset-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "quota-page" },
});
/** @type {__VLS_StyleScopedClasses['quota-page']} */ ;
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
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "header-actions" },
});
/** @type {__VLS_StyleScopedClasses['header-actions']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.loadAll) },
    ...{ class: "btn btn-secondary" },
    disabled: (__VLS_ctx.loading),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.openSet();
            // @ts-ignore
            [loadAll, loading, openSet,];
        } },
    ...{ class: "btn btn-primary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
if (__VLS_ctx.configError) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "config-warn" },
    });
    /** @type {__VLS_StyleScopedClasses['config-warn']} */ ;
    (__VLS_ctx.configError);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "config-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['config-hint']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
}
if (__VLS_ctx.quotaList.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stat-cards" },
    });
    /** @type {__VLS_StyleScopedClasses['stat-cards']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stat-card" },
    });
    /** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stat-num" },
    });
    /** @type {__VLS_StyleScopedClasses['stat-num']} */ ;
    (__VLS_ctx.quotaList.length);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stat-label" },
    });
    /** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stat-card stat-warn" },
    });
    /** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['stat-warn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stat-num" },
    });
    /** @type {__VLS_StyleScopedClasses['stat-num']} */ ;
    (__VLS_ctx.quotaList.filter(q => __VLS_ctx.usagePct(q) >= 90).length);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stat-label" },
    });
    /** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stat-card" },
    });
    /** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stat-num" },
    });
    /** @type {__VLS_StyleScopedClasses['stat-num']} */ ;
    (__VLS_ctx.formatSize(__VLS_ctx.quotaList.reduce((s, q) => s + (q.quotas?.[0]?.block_used_kb || 0), 0)));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stat-label" },
    });
    /** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stat-card" },
    });
    /** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stat-num" },
    });
    /** @type {__VLS_StyleScopedClasses['stat-num']} */ ;
    (__VLS_ctx.formatSize(__VLS_ctx.quotaList.reduce((s, q) => s + (q.quotas?.[0]?.block_hard_kb || 0), 0)));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stat-label" },
    });
    /** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "filter-bar" },
});
/** @type {__VLS_StyleScopedClasses['filter-bar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    placeholder: "🔍 搜索用户名...",
    ...{ class: "filter-input" },
});
(__VLS_ctx.search);
/** @type {__VLS_StyleScopedClasses['filter-input']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_ctx.filterStatus),
    ...{ class: "filter-select" },
});
/** @type {__VLS_StyleScopedClasses['filter-select']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "warn",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "crit",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "ok",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "noset",
});
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "loading" },
    });
    /** @type {__VLS_StyleScopedClasses['loading']} */ ;
}
else if (!__VLS_ctx.quotaList.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty" },
    });
    /** @type {__VLS_StyleScopedClasses['empty']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "table-wrap" },
    });
    /** @type {__VLS_StyleScopedClasses['table-wrap']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
        ...{ class: "quota-table" },
    });
    /** @type {__VLS_StyleScopedClasses['quota-table']} */ ;
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
    for (const [item] of __VLS_vFor((__VLS_ctx.filtered))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (item.username),
            ...{ class: ({ 'row-crit': __VLS_ctx.usagePct(item) >= 90, 'row-warn': __VLS_ctx.usagePct(item) >= 75 && __VLS_ctx.usagePct(item) < 90 }) },
        });
        /** @type {__VLS_StyleScopedClasses['row-crit']} */ ;
        /** @type {__VLS_StyleScopedClasses['row-warn']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "user-cell" },
        });
        /** @type {__VLS_StyleScopedClasses['user-cell']} */ ;
        (item.username);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "fs-cell" },
        });
        /** @type {__VLS_StyleScopedClasses['fs-cell']} */ ;
        if (item.quotas?.[0]) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
            (item.quotas[0].filesystem);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "fs-type" },
            });
            /** @type {__VLS_StyleScopedClasses['fs-type']} */ ;
            (item.quotas[0].type);
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "no-data" },
            });
            /** @type {__VLS_StyleScopedClasses['no-data']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (item.quotas?.[0] ? __VLS_ctx.formatSize(item.quotas[0].block_used_kb) : '-');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (item.quotas?.[0]?.block_soft_kb ? __VLS_ctx.formatSize(item.quotas[0].block_soft_kb) : '无');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (item.quotas?.[0]?.block_hard_kb ? __VLS_ctx.formatSize(item.quotas[0].block_hard_kb) : '无限制');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        if (item.quotas?.[0]?.block_hard_kb) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "usage-cell" },
            });
            /** @type {__VLS_StyleScopedClasses['usage-cell']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "prog-bg" },
            });
            /** @type {__VLS_StyleScopedClasses['prog-bg']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "prog-fill" },
                ...{ style: ({ width: __VLS_ctx.usagePct(item) + '%' }) },
                ...{ class: (__VLS_ctx.usagePct(item) >= 90 ? 'fill-crit' : __VLS_ctx.usagePct(item) >= 75 ? 'fill-warn' : 'fill-ok') },
            });
            /** @type {__VLS_StyleScopedClasses['prog-fill']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "pct-text" },
                ...{ class: (__VLS_ctx.usagePct(item) >= 90 ? 'text-crit' : __VLS_ctx.usagePct(item) >= 75 ? 'text-warn' : '') },
            });
            /** @type {__VLS_StyleScopedClasses['pct-text']} */ ;
            (__VLS_ctx.usagePct(item));
        }
        else if (item.quotas?.[0]?.block_used_kb) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "no-limit-text" },
            });
            /** @type {__VLS_StyleScopedClasses['no-limit-text']} */ ;
            (__VLS_ctx.formatSize(item.quotas[0].block_used_kb));
        }
        else if (item.error) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "error-text" },
                title: (item.error),
            });
            /** @type {__VLS_StyleScopedClasses['error-text']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "no-data" },
            });
            /** @type {__VLS_StyleScopedClasses['no-data']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (item.quotas?.[0]?.inode_used ? __VLS_ctx.formatInode(item.quotas[0].inode_used) : '-');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        if (item.quotas?.[0]?.inode_hard) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "usage-cell" },
            });
            /** @type {__VLS_StyleScopedClasses['usage-cell']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "prog-bg" },
            });
            /** @type {__VLS_StyleScopedClasses['prog-bg']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "prog-fill" },
                ...{ style: ({ width: __VLS_ctx.inodeUsagePct(item) + '%' }) },
                ...{ class: (__VLS_ctx.inodeUsagePct(item) >= 90 ? 'fill-crit' : __VLS_ctx.inodeUsagePct(item) >= 75 ? 'fill-warn' : 'fill-ok') },
            });
            /** @type {__VLS_StyleScopedClasses['prog-fill']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "pct-text" },
                ...{ class: (__VLS_ctx.inodeUsagePct(item) >= 90 ? 'text-crit' : __VLS_ctx.inodeUsagePct(item) >= 75 ? 'text-warn' : '') },
            });
            /** @type {__VLS_StyleScopedClasses['pct-text']} */ ;
            (__VLS_ctx.inodeUsagePct(item));
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "no-data" },
            });
            /** @type {__VLS_StyleScopedClasses['no-data']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (item.quotas?.[0]?.inode_hard ? __VLS_ctx.formatInode(item.quotas[0].inode_hard) : '无限制');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    if (!!(!__VLS_ctx.quotaList.length))
                        return;
                    __VLS_ctx.openSet(item.username, item.quotas?.[0]);
                    // @ts-ignore
                    [loading, openSet, configError, configError, quotaList, quotaList, quotaList, quotaList, quotaList, quotaList, usagePct, usagePct, usagePct, usagePct, usagePct, usagePct, usagePct, usagePct, usagePct, usagePct, formatSize, formatSize, formatSize, formatSize, formatSize, formatSize, search, filterStatus, filtered, formatInode, formatInode, inodeUsagePct, inodeUsagePct, inodeUsagePct, inodeUsagePct, inodeUsagePct, inodeUsagePct,];
                } },
            ...{ class: "btn-link" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showModal))
                    return;
                __VLS_ctx.showModal = false;
                // @ts-ignore
                [showModal, showModal,];
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
        placeholder: "输入用户名",
        disabled: (!!__VLS_ctx.form._prefill),
    });
    (__VLS_ctx.form.username);
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
        ...{ class: "input-unit" },
    });
    /** @type {__VLS_StyleScopedClasses['input-unit']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "0",
        placeholder: "0",
    });
    (__VLS_ctx.form.blockSoftGB);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "unit" },
    });
    /** @type {__VLS_StyleScopedClasses['unit']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['form-hint']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "input-unit" },
    });
    /** @type {__VLS_StyleScopedClasses['input-unit']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "0",
        placeholder: "100",
    });
    (__VLS_ctx.form.blockHardGB);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "unit" },
    });
    /** @type {__VLS_StyleScopedClasses['unit']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
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
        min: "0",
        placeholder: "0",
    });
    (__VLS_ctx.form.inodeSoft);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "0",
        placeholder: "0",
    });
    (__VLS_ctx.form.inodeHard);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['form-hint']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "preset-bar" },
    });
    /** @type {__VLS_StyleScopedClasses['preset-bar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "preset-label" },
    });
    /** @type {__VLS_StyleScopedClasses['preset-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showModal))
                    return;
                __VLS_ctx.applyPreset(50);
                // @ts-ignore
                [form, form, form, form, form, form, applyPreset,];
            } },
        ...{ class: "preset-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['preset-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showModal))
                    return;
                __VLS_ctx.applyPreset(100);
                // @ts-ignore
                [applyPreset,];
            } },
        ...{ class: "preset-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['preset-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showModal))
                    return;
                __VLS_ctx.applyPreset(200);
                // @ts-ignore
                [applyPreset,];
            } },
        ...{ class: "preset-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['preset-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showModal))
                    return;
                __VLS_ctx.applyPreset(500);
                // @ts-ignore
                [applyPreset,];
            } },
        ...{ class: "preset-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['preset-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showModal))
                    return;
                __VLS_ctx.applyPreset(1024);
                // @ts-ignore
                [applyPreset,];
            } },
        ...{ class: "preset-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['preset-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-footer" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-footer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showModal))
                    return;
                __VLS_ctx.showModal = false;
                // @ts-ignore
                [showModal,];
            } },
        ...{ class: "btn btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.submitQuota) },
        ...{ class: "btn btn-primary" },
        disabled: (__VLS_ctx.saving),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    (__VLS_ctx.saving ? '设置中...' : '确认设置');
}
// @ts-ignore
[submitQuota, saving, saving,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
