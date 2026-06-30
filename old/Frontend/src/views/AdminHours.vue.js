/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, onMounted, computed } from 'vue';
import { qosAPI, slurmAccountAPI, usageAPI } from '../api';
import dialog from '../utils/dialog';
import axios from 'axios';
const hoursList = ref([]);
const loading = ref(false);
const error = ref('');
const showModal = ref(false);
const saving = ref(false);
const syncing = ref(false);
const modalError = ref('');
const searchQuery = ref('');
const qosList = ref([]);
const accounts = ref([]);
// 展开状态和用户使用量
const expandedQoS = ref(new Set());
const userUsageMap = ref({});
const loadingUsers = ref(new Set());
const formData = ref({
    type: 'qos',
    name: '',
    total: 0,
    notes: '',
    currentBalance: 0,
    totalRecharged: 0,
    used: 0,
    setSlurmBilling: false,
    slurmBillingValue: 0
});
const loadQoSAndAccounts = async () => {
    try {
        const [qosData, accountsData] = await Promise.all([
            qosAPI.getQoSList(),
            slurmAccountAPI.getAccounts()
        ]);
        qosList.value = qosData || [];
        accounts.value = accountsData || [];
    }
    catch (err) {
        console.error('Failed to load QoS/accounts:', err);
    }
};
const availableTargets = computed(() => {
    return qosList.value.map((q) => q.name);
});
const extractBillingHours = (qos) => {
    const minutesTotal = qos?.limits?.max?.tres?.minutes?.total;
    if (Array.isArray(minutesTotal)) {
        const billing = minutesTotal.find((t) => t.type === 'billing');
        if (billing && billing.count > 0)
            return billing.count / 60;
    }
    if (qos?.grp_tres_mins) {
        const mins = parseInt(qos.grp_tres_mins);
        if (!isNaN(mins) && mins > 0)
            return mins / 60;
    }
    return 0;
};
const filteredHoursList = computed(() => {
    let filtered = hoursList.value;
    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        filtered = filtered.filter(item => item.name.toLowerCase().includes(query));
    }
    return filtered;
});
// 展开/收起用户明细
const toggleExpand = async (qosName) => {
    if (expandedQoS.value.has(qosName)) {
        expandedQoS.value.delete(qosName);
        expandedQoS.value = new Set(expandedQoS.value);
        return;
    }
    expandedQoS.value.add(qosName);
    expandedQoS.value = new Set(expandedQoS.value);
    await loadUserUsage(qosName);
};
// 加载某个 QoS 下所有用户的使用量
const loadUserUsage = async (qosName) => {
    if (userUsageMap.value[qosName])
        return; // 已加载
    loadingUsers.value.add(qosName);
    loadingUsers.value = new Set(loadingUsers.value);
    try {
        const now = new Date();
        const end = now.toISOString().split('T')[0];
        const start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        const res = await usageAPI.getAllUsersRecords(start, end);
        const records = res.data || res || [];
        // 按用户聚合，过滤该 QoS
        const userMap = {};
        for (const r of records) {
            if (r.qos && r.qos !== qosName)
                continue;
            const user = r.user || r.user_name || r.username;
            if (!user)
                continue;
            const mins = (r.billing_mins || 0) + (r.billing_hours || 0) * 60;
            userMap[user] = (userMap[user] || 0) + mins;
        }
        const qosItem = hoursList.value.find(h => h.name === qosName);
        const totalHours = qosItem?.total || 0;
        userUsageMap.value[qosName] = Object.entries(userMap)
            .filter(([, mins]) => mins > 0)
            .map(([user, mins]) => {
            const used = Math.round(mins / 60 * 100) / 100;
            const pct = totalHours > 0 ? Math.min(100, Math.round(used / totalHours * 100)) : 0;
            return { user, used, pct };
        })
            .sort((a, b) => b.used - a.used);
    }
    catch (e) {
        console.error('loadUserUsage error:', e);
        userUsageMap.value[qosName] = [];
    }
    finally {
        loadingUsers.value.delete(qosName);
        loadingUsers.value = new Set(loadingUsers.value);
    }
};
const loadHoursList = async () => {
    loading.value = true;
    error.value = '';
    try {
        // 使用新的 API 获取机时账户（注意：axios.defaults.baseURL 已经包含 /api）
        const res = await axios.get('/billing/v2/accounts');
        const accounts = res.data.data || [];
        hoursList.value = accounts.map((account) => {
            const total = account.total_recharged || 0;
            const balance = account.current_balance || 0;
            const used = total - balance;
            const usage = total > 0 ? Math.min(100, Math.round(used / total * 100)) : 0;
            return {
                id: account.qos_name,
                type: 'qos',
                name: account.qos_name,
                description: '',
                total: Math.round(total * 100) / 100,
                used: Math.round(used * 100) / 100,
                remaining: Math.round(balance * 100) / 100,
                usage,
                expireDate: '-',
                notes: '',
                actualUsed: account.actual_used || 0, // Slurm 实际消费
            };
        });
    }
    catch (err) {
        error.value = err.response?.data?.error || '加载机时列表失败';
    }
    finally {
        loading.value = false;
    }
};
const getProgressColor = (usage) => {
    if (usage >= 90)
        return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    if (usage >= 70)
        return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
    return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
};
const getStatusClass = (item) => {
    if (item.usage >= 100)
        return 'status-expired';
    if (item.usage >= 80)
        return 'status-warning';
    return 'status-normal';
};
const getStatusText = (item) => {
    if (item.usage >= 100)
        return '已超额';
    if (item.usage >= 80)
        return '即将用完';
    return '正常';
};
const editHours = async (item) => {
    formData.value = {
        type: item.type,
        name: item.name,
        total: 0,
        notes: '',
        currentBalance: item.remaining || 0,
        totalRecharged: item.total || 0,
        used: item.used || 0,
        setSlurmBilling: false,
        slurmBillingValue: item.remaining || 0
    };
    // 获取 Slurm QoS 的实际 billing 值
    try {
        const qosRes = await qosAPI.getQoS(item.name);
        const qos = qosRes;
        let slurmBilling = 0;
        // 解析 grp_tres_mins 中的 billing 值
        if (qos.grp_tres_mins) {
            const match = qos.grp_tres_mins.match(/billing=(\d+)/);
            if (match) {
                slurmBilling = parseInt(match[1]) / 60; // 转换为小时
            }
        }
        formData.value.slurmBillingValue = slurmBilling;
    }
    catch (err) {
    }
    showModal.value = true;
};
const saveHours = async () => {
    modalError.value = '';
    if (!formData.value.name) {
        modalError.value = '请选择 QoS';
        return;
    }
    if (formData.value.total <= 0 && !formData.value.setSlurmBilling) {
        modalError.value = '请填写充值金额';
        return;
    }
    if (formData.value.setSlurmBilling && formData.value.slurmBillingValue < 0) {
        modalError.value = '请填写有效的 Slurm billing 值';
        return;
    }
    saving.value = true;
    try {
        // 使用新的充值 API
        await axios.post('/billing/v2/recharge', {
            qos_name: formData.value.name,
            amount: formData.value.total,
            notes: formData.value.notes,
            set_slurm_billing: formData.value.setSlurmBilling,
            slurm_billing_value: formData.value.slurmBillingValue
        });
        closeModal();
        await loadHoursList();
    }
    catch (err) {
        modalError.value = err.response?.data?.error || '操作失败';
    }
    finally {
        saving.value = false;
    }
};
const deleteHours = async (item) => {
    const ok = await dialog.confirm(`确定要清除 ${item.name} 的机时余额吗？`, { title: '清除机时' });
    if (!ok)
        return;
    try {
        // 这个操作需要管理员手动在数据库中操作，或者提供专门的 API
        dialog.error('此功能暂未实现，请联系系统管理员');
    }
    catch (err) {
        dialog.error(err.response?.data?.error || '操作失败');
    }
};
const closeModal = () => {
    showModal.value = false;
    modalError.value = '';
};
// 从 Slurm 同步消费记录
const syncFromSlurm = async () => {
    syncing.value = true;
    try {
        const res = await axios.post('/billing/v2/sync');
        const data = res.data;
        dialog.success(`同步完成！\n已同步: ${data.synced} 条\n跳过: ${data.skipped} 条\n总计: ${data.total} 条`);
        await loadHoursList();
    }
    catch (err) {
        dialog.error(err.response?.data?.error || '同步失败');
    }
    finally {
        syncing.value = false;
    }
};
onMounted(() => {
    loadHoursList();
    loadQoSAndAccounts();
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['user-row']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-group']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-group']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-group']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-group']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-group']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-group']} */ ;
/** @type {__VLS_StyleScopedClasses['data-table']} */ ;
/** @type {__VLS_StyleScopedClasses['data-table']} */ ;
/** @type {__VLS_StyleScopedClasses['data-table']} */ ;
/** @type {__VLS_StyleScopedClasses['data-table']} */ ;
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['status-normal']} */ ;
/** @type {__VLS_StyleScopedClasses['status-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['status-expired']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
/** @type {__VLS_StyleScopedClasses['progress-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['progress-fill']} */ ;
/** @type {__VLS_StyleScopedClasses['usage-text']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
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
/** @type {__VLS_StyleScopedClasses['balance-row']} */ ;
/** @type {__VLS_StyleScopedClasses['balance-value']} */ ;
/** @type {__VLS_StyleScopedClasses['balance-value']} */ ;
/** @type {__VLS_StyleScopedClasses['balance-value']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "admin-hours" },
});
/** @type {__VLS_StyleScopedClasses['admin-hours']} */ ;
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
    ...{ onClick: (__VLS_ctx.syncFromSlurm) },
    ...{ class: "btn btn-secondary" },
    disabled: (__VLS_ctx.syncing),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
(__VLS_ctx.syncing ? '同步中...' : '🔄 从 Slurm 同步');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "filters-bar" },
});
/** @type {__VLS_StyleScopedClasses['filters-bar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "filter-group" },
});
/** @type {__VLS_StyleScopedClasses['filter-group']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    placeholder: "搜索 QoS 名称",
});
(__VLS_ctx.searchQuery);
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
    for (const [item] of __VLS_vFor((__VLS_ctx.filteredHoursList))) {
        (item.id);
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.error))
                        return;
                    __VLS_ctx.toggleExpand(item.name);
                    // @ts-ignore
                    [syncFromSlurm, syncing, syncing, searchQuery, loading, error, error, filteredHoursList, toggleExpand,];
                } },
            ...{ class: "qos-row" },
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['qos-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "expand-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['expand-icon']} */ ;
        (__VLS_ctx.expandedQoS.has(item.name) ? '▼' : '▶');
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        (item.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (item.description || '-');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (item.total.toLocaleString());
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (item.used.toLocaleString());
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (item.remaining.toLocaleString());
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "progress-wrap" },
        });
        /** @type {__VLS_StyleScopedClasses['progress-wrap']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "progress-bar" },
        });
        /** @type {__VLS_StyleScopedClasses['progress-bar']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "progress-fill" },
            ...{ style: ({ width: Math.min(item.usage, 100) + '%', background: __VLS_ctx.getProgressColor(item.usage) }) },
        });
        /** @type {__VLS_StyleScopedClasses['progress-fill']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "usage-text" },
        });
        /** @type {__VLS_StyleScopedClasses['usage-text']} */ ;
        (item.usage);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "status-badge" },
            ...{ class: (__VLS_ctx.getStatusClass(item)) },
        });
        /** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
        (__VLS_ctx.getStatusText(item));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "action-buttons" },
        });
        /** @type {__VLS_StyleScopedClasses['action-buttons']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.error))
                        return;
                    __VLS_ctx.editHours(item);
                    // @ts-ignore
                    [expandedQoS, getProgressColor, getStatusClass, getStatusText, editHours,];
                } },
            ...{ class: "btn-link" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.error))
                        return;
                    __VLS_ctx.deleteHours(item);
                    // @ts-ignore
                    [deleteHours,];
                } },
            ...{ class: "btn-link danger" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
        /** @type {__VLS_StyleScopedClasses['danger']} */ ;
        if (__VLS_ctx.expandedQoS.has(item.name)) {
            if (__VLS_ctx.loadingUsers.has(item.name)) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    colspan: "8",
                    ...{ class: "user-loading" },
                });
                /** @type {__VLS_StyleScopedClasses['user-loading']} */ ;
            }
            else {
                for (const [u] of __VLS_vFor(((__VLS_ctx.userUsageMap[item.name] || [])))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                        key: (u.user),
                        ...{ class: "user-row" },
                    });
                    /** @type {__VLS_StyleScopedClasses['user-row']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                        ...{ class: "user-indent" },
                    });
                    /** @type {__VLS_StyleScopedClasses['user-indent']} */ ;
                    (u.user);
                    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                    (item.total.toLocaleString());
                    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                    (u.used.toLocaleString());
                    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                    (Math.max(0, item.total - u.used).toLocaleString());
                    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "progress-wrap" },
                    });
                    /** @type {__VLS_StyleScopedClasses['progress-wrap']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "progress-bar" },
                    });
                    /** @type {__VLS_StyleScopedClasses['progress-bar']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "progress-fill" },
                        ...{ style: ({ width: Math.min(u.pct, 100) + '%', background: __VLS_ctx.getProgressColor(u.pct) }) },
                    });
                    /** @type {__VLS_StyleScopedClasses['progress-fill']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "usage-text" },
                    });
                    /** @type {__VLS_StyleScopedClasses['usage-text']} */ ;
                    (u.pct);
                    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "status-badge" },
                        ...{ class: (u.pct >= 100 ? 'status-expired' : u.pct >= 80 ? 'status-warning' : 'status-normal') },
                    });
                    /** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
                    (u.pct >= 100 ? '已超额' : u.pct >= 80 ? '即将用完' : '正常');
                    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                    // @ts-ignore
                    [expandedQoS, getProgressColor, loadingUsers, userUsageMap,];
                }
                if (!(__VLS_ctx.userUsageMap[item.name]?.length)) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
                    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                        colspan: "8",
                        ...{ class: "user-loading" },
                    });
                    /** @type {__VLS_StyleScopedClasses['user-loading']} */ ;
                }
            }
        }
        // @ts-ignore
        [userUsageMap,];
    }
    if (__VLS_ctx.filteredHoursList.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "empty-state" },
        });
        /** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
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
        disabled: true,
    });
    (__VLS_ctx.formData.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({
        ...{ class: "form-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['form-hint']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "balance-info" },
    });
    /** @type {__VLS_StyleScopedClasses['balance-info']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "balance-row" },
    });
    /** @type {__VLS_StyleScopedClasses['balance-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "balance-label" },
    });
    /** @type {__VLS_StyleScopedClasses['balance-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "balance-value" },
    });
    /** @type {__VLS_StyleScopedClasses['balance-value']} */ ;
    (__VLS_ctx.formData.totalRecharged.toLocaleString());
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "balance-row" },
    });
    /** @type {__VLS_StyleScopedClasses['balance-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "balance-label" },
    });
    /** @type {__VLS_StyleScopedClasses['balance-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "balance-value used" },
    });
    /** @type {__VLS_StyleScopedClasses['balance-value']} */ ;
    /** @type {__VLS_StyleScopedClasses['used']} */ ;
    (__VLS_ctx.formData.used.toLocaleString());
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "balance-row highlight" },
    });
    /** @type {__VLS_StyleScopedClasses['balance-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['highlight']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "balance-label" },
    });
    /** @type {__VLS_StyleScopedClasses['balance-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "balance-value current" },
    });
    /** @type {__VLS_StyleScopedClasses['balance-value']} */ ;
    /** @type {__VLS_StyleScopedClasses['current']} */ ;
    (__VLS_ctx.formData.currentBalance.toLocaleString());
    if (__VLS_ctx.formData.slurmBillingValue >= 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "balance-row" },
        });
        /** @type {__VLS_StyleScopedClasses['balance-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "balance-label" },
        });
        /** @type {__VLS_StyleScopedClasses['balance-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "balance-value" },
            ...{ class: ({ 'slurm-mismatch': Math.abs(__VLS_ctx.formData.slurmBillingValue - __VLS_ctx.formData.currentBalance) > 1 }) },
        });
        /** @type {__VLS_StyleScopedClasses['balance-value']} */ ;
        /** @type {__VLS_StyleScopedClasses['slurm-mismatch']} */ ;
        (__VLS_ctx.formData.slurmBillingValue.toLocaleString());
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        placeholder: "例如: 100",
        min: "0",
    });
    (__VLS_ctx.formData.total);
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({
        ...{ class: "form-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['form-hint']} */ ;
    ((__VLS_ctx.formData.currentBalance + (__VLS_ctx.formData.total || 0)).toLocaleString());
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "checkbox-label" },
    });
    /** @type {__VLS_StyleScopedClasses['checkbox-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
    });
    (__VLS_ctx.formData.setSlurmBilling);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    if (__VLS_ctx.formData.setSlurmBilling) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            placeholder: "例如: 1000",
            min: "0",
            ...{ class: "slurm-billing-input" },
        });
        (__VLS_ctx.formData.slurmBillingValue);
        /** @type {__VLS_StyleScopedClasses['slurm-billing-input']} */ ;
    }
    if (__VLS_ctx.formData.setSlurmBilling) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({
            ...{ class: "form-hint" },
        });
        /** @type {__VLS_StyleScopedClasses['form-hint']} */ ;
        ((__VLS_ctx.formData.slurmBillingValue || 0).toLocaleString());
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
        value: (__VLS_ctx.formData.notes),
        placeholder: "可选的备注信息",
        rows: "3",
    });
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
        ...{ onClick: (__VLS_ctx.saveHours) },
        ...{ class: "btn-primary" },
        disabled: (__VLS_ctx.saving),
    });
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    (__VLS_ctx.saving ? '保存中...' : '保存');
}
// @ts-ignore
[filteredHoursList, showModal, closeModal, closeModal, modalError, modalError, formData, formData, formData, formData, formData, formData, formData, formData, formData, formData, formData, formData, formData, formData, formData, formData, formData, saveHours, saving, saving,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
