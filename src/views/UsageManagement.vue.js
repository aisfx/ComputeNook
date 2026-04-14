/// <reference types="../../node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted } from 'vue';
import { usageAPI } from '../api';
import notification from '../utils/notification';
const loading = ref(false);
const error = ref('');
const searchText = ref('');
// 查询条件
const queryType = ref('user');
const queryUser = ref('');
const queryAccount = ref('');
const startDate = ref('');
const endDate = ref('');
// 数据
const usageRecords = ref([]);
const accountUsage = ref(null);
const summary = ref(null);
// 初始化日期
const initDates = () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    endDate.value = now.toISOString().split('T')[0];
    startDate.value = thirtyDaysAgo.toISOString().split('T')[0];
};
// 查询类型变化
const onQueryTypeChange = () => {
    usageRecords.value = [];
    summary.value = null;
    error.value = '';
};
// 快速选择时间范围
const onQuickSelect = (event) => {
    const days = parseInt(event.target.value);
    if (days) {
        const now = new Date();
        const pastDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        endDate.value = now.toISOString().split('T')[0];
        startDate.value = pastDate.toISOString().split('T')[0];
    }
};
// 过滤记录
const filteredRecords = computed(() => {
    if (!searchText.value)
        return usageRecords.value;
    const search = searchText.value.toLowerCase();
    return usageRecords.value.filter(record => (record.user && record.user.toLowerCase().includes(search)) ||
        (record.account && record.account.toLowerCase().includes(search)) ||
        (record.partition && record.partition.toLowerCase().includes(search)) ||
        (record.qos && record.qos.toLowerCase().includes(search)));
});
// 查询使用情况
const queryUsage = async () => {
    if (queryType.value === 'user' && !queryUser.value) {
        notification.error('请输入用户名');
        return;
    }
    if (queryType.value === 'account' && !queryAccount.value) {
        notification.error('请输入账户名');
        return;
    }
    if (!startDate.value || !endDate.value) {
        notification.error('请选择时间范围');
        return;
    }
    loading.value = true;
    error.value = '';
    try {
        let response;
        if (queryType.value === 'user') {
            // 获取用户使用情况
            response = await usageAPI.getUserUsage(queryUser.value, startDate.value, endDate.value);
            usageRecords.value = response.data;
            // 获取用户汇总
            const summaryResponse = await usageAPI.getUsageSummary(queryUser.value, '', startDate.value, endDate.value);
            summary.value = summaryResponse.data;
        }
        else if (queryType.value === 'account') {
            // 获取账户机时使用情况（包含 billing 限制）
            const accountResponse = await usageAPI.getAccountUsage(queryAccount.value, startDate.value, endDate.value);
            accountUsage.value = accountResponse.data;
            // 对于账户查询，显示账户汇总信息而不是详细记录
            usageRecords.value = accountUsage.value ? [accountUsage.value] : [];
            // 设置汇总数据
            if (accountUsage.value) {
                summary.value = {
                    total_jobs: accountUsage.value.job_count,
                    total_cpu_hours: accountUsage.value.cpu_hours,
                    total_node_hours: accountUsage.value.node_hours,
                    total_gpu_hours: accountUsage.value.gpu_hours,
                    total_memory_hours: accountUsage.value.memory_hours,
                    period: `${startDate.value} - ${endDate.value}`
                };
            }
        }
        else if (queryType.value === 'cluster') {
            // 获取集群使用情况
            const clusterResponse = await usageAPI.getAllAccountsUsage(startDate.value, endDate.value);
            // 转换为数组格式
            const clusterData = clusterResponse.data;
            usageRecords.value = Object.values(clusterData);
            // 计算总汇总
            summary.value = {
                total_jobs: usageRecords.value.reduce((sum, record) => sum + (record.job_count || 0), 0),
                total_cpu_hours: usageRecords.value.reduce((sum, record) => sum + (record.cpu_hours || 0), 0),
                total_node_hours: usageRecords.value.reduce((sum, record) => sum + (record.node_hours || 0), 0),
                total_gpu_hours: usageRecords.value.reduce((sum, record) => sum + (record.gpu_hours || 0), 0),
                total_memory_hours: usageRecords.value.reduce((sum, record) => sum + (record.memory_hours || 0), 0),
                period: `${startDate.value} - ${endDate.value}`
            };
        }
        notification.success('查询完成');
    }
    catch (err) {
        console.error('Query usage error:', err);
        error.value = err.response?.data?.error || err.message || '查询失败';
    }
    finally {
        loading.value = false;
    }
};
// 刷新数据
const refreshData = () => {
    if (usageRecords.value.length > 0) {
        queryUsage();
    }
};
// 导出数据
const exportData = () => {
    if (usageRecords.value.length === 0) {
        notification.warning('暂无数据可导出');
        return;
    }
    // 构建 CSV 数据
    const headers = ['用户', '账户', '集群', '分区', 'QoS', '作业数', 'CPU小时', '节点小时', 'GPU小时', '内存小时', '状态'];
    const csvData = [
        headers.join(','),
        ...usageRecords.value.map(record => [
            record.user || '',
            record.account || '',
            record.cluster || '',
            record.partition || '',
            record.qos || '',
            record.job_count || record.total_jobs || 1,
            record.cpu_hours || record.total_cpu_hours || 0,
            record.node_hours || record.total_node_hours || 0,
            record.gpu_hours || record.total_gpu_hours || 0,
            record.memory_hours || record.total_memory_hours || 0,
            record.state || 'SUMMARY'
        ].join(','))
    ].join('\n');
    // 下载文件
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `usage_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notification.success('数据导出成功');
};
// 格式化小时数
const formatHours = (hours) => {
    if (!hours || hours === 0)
        return '0';
    if (hours < 1)
        return hours.toFixed(2);
    return hours.toFixed(1);
};
// 格式化时间范围
const formatTimeRange = (record) => {
    if (record.period)
        return record.period;
    if (record.start_time && record.end_time) {
        const start = new Date(record.start_time).toLocaleDateString();
        const end = new Date(record.end_time).toLocaleDateString();
        return `${start} - ${end}`;
    }
    if (record.last_updated) {
        return `截至 ${new Date(record.last_updated).toLocaleDateString()}`;
    }
    return `${startDate.value} - ${endDate.value}`;
};
// 获取记录键
const getRecordKey = (record) => {
    return `${record.user || 'unknown'}-${record.account || 'unknown'}-${record.partition || 'unknown'}-${record.qos || 'unknown'}`;
};
// 获取 QoS 样式
const getQoSClass = (qos) => {
    switch (qos?.toLowerCase()) {
        case 'high': return 'qos-high';
        case 'normal': return 'qos-normal';
        case 'low': return 'qos-low';
        default: return 'qos-default';
    }
};
// 获取状态样式
const getStateClass = (state) => {
    switch (state?.toUpperCase()) {
        case 'COMPLETED': return 'state-completed';
        case 'FAILED': return 'state-failed';
        case 'CANCELLED': return 'state-cancelled';
        case 'TIMEOUT': return 'state-timeout';
        default: return 'state-default';
    }
};
// 格式化分钟数为小时
const formatMinutes = (minutes) => {
    if (!minutes || minutes === 0)
        return '0 小时';
    const hours = minutes / 60;
    if (hours < 1)
        return `${minutes} 分钟`;
    return `${hours.toFixed(1)} 小时`;
};
// 获取计费状态样式
const getBillingStatusClass = (status) => {
    switch (status?.toUpperCase()) {
        case 'NORMAL': return 'billing-normal';
        case 'WARNING': return 'billing-warning';
        case 'EXCEEDED': return 'billing-exceeded';
        default: return 'billing-normal';
    }
};
// 获取计费状态文本
const getBillingStatusText = (status) => {
    switch (status?.toUpperCase()) {
        case 'NORMAL': return '正常';
        case 'WARNING': return '警告';
        case 'EXCEEDED': return '超额';
        default: return '正常';
    }
};
onMounted(() => {
    initDates();
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['data-table']} */ ;
/** @type {__VLS_StyleScopedClasses['data-table']} */ ;
/** @type {__VLS_StyleScopedClasses['data-table']} */ ;
/** @type {__VLS_StyleScopedClasses['billing-card']} */ ;
/** @type {__VLS_StyleScopedClasses['billing-card']} */ ;
/** @type {__VLS_StyleScopedClasses['billing-card']} */ ;
/** @type {__VLS_StyleScopedClasses['billing-header']} */ ;
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['billing-normal']} */ ;
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['billing-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['billing-exceeded']} */ ;
/** @type {__VLS_StyleScopedClasses['billing-item']} */ ;
/** @type {__VLS_StyleScopedClasses['billing-item']} */ ;
/** @type {__VLS_StyleScopedClasses['progress-fill']} */ ;
/** @type {__VLS_StyleScopedClasses['billing-normal']} */ ;
/** @type {__VLS_StyleScopedClasses['progress-fill']} */ ;
/** @type {__VLS_StyleScopedClasses['billing-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['progress-fill']} */ ;
/** @type {__VLS_StyleScopedClasses['billing-exceeded']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
/** @type {__VLS_StyleScopedClasses['form-row']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['table-header']} */ ;
/** @type {__VLS_StyleScopedClasses['search-input']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "usage-management" },
});
/** @type {__VLS_StyleScopedClasses['usage-management']} */ ;
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
    ...{ onClick: (__VLS_ctx.exportData) },
    ...{ class: "btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.refreshData) },
    ...{ class: "btn-primary" },
});
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card query-panel" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['query-panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "query-form" },
});
/** @type {__VLS_StyleScopedClasses['query-form']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "form-row" },
});
/** @type {__VLS_StyleScopedClasses['form-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "form-group" },
});
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: (__VLS_ctx.onQueryTypeChange) },
    value: (__VLS_ctx.queryType),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "user",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "account",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "cluster",
});
if (__VLS_ctx.queryType === 'user') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "输入用户名",
    });
    (__VLS_ctx.queryUser);
}
if (__VLS_ctx.queryType === 'account') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "输入账户名",
    });
    (__VLS_ctx.queryAccount);
}
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
    type: "date",
});
(__VLS_ctx.startDate);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "form-group" },
});
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "date",
});
(__VLS_ctx.endDate);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "form-group" },
});
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: (__VLS_ctx.onQuickSelect) },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "7",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "30",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "90",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "form-group" },
});
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.queryUsage) },
    ...{ class: "btn-primary" },
});
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
if (__VLS_ctx.queryType === 'account' && __VLS_ctx.accountUsage) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card" },
    });
    /** @type {__VLS_StyleScopedClasses['card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "billing-status" },
    });
    /** @type {__VLS_StyleScopedClasses['billing-status']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "billing-card" },
        ...{ class: (__VLS_ctx.getBillingStatusClass(__VLS_ctx.accountUsage.status)) },
    });
    /** @type {__VLS_StyleScopedClasses['billing-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "billing-header" },
    });
    /** @type {__VLS_StyleScopedClasses['billing-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h5, __VLS_intrinsics.h5)({});
    (__VLS_ctx.accountUsage.account);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "status-badge" },
        ...{ class: (__VLS_ctx.getBillingStatusClass(__VLS_ctx.accountUsage.status)) },
    });
    /** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
    (__VLS_ctx.getBillingStatusText(__VLS_ctx.accountUsage.status));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "billing-details" },
    });
    /** @type {__VLS_StyleScopedClasses['billing-details']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "billing-item" },
    });
    /** @type {__VLS_StyleScopedClasses['billing-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "label" },
    });
    /** @type {__VLS_StyleScopedClasses['label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "value" },
    });
    /** @type {__VLS_StyleScopedClasses['value']} */ ;
    (__VLS_ctx.formatMinutes(__VLS_ctx.accountUsage.total_billing));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "billing-item" },
    });
    /** @type {__VLS_StyleScopedClasses['billing-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "label" },
    });
    /** @type {__VLS_StyleScopedClasses['label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "value" },
    });
    /** @type {__VLS_StyleScopedClasses['value']} */ ;
    (__VLS_ctx.formatMinutes(__VLS_ctx.accountUsage.used_billing));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "billing-item" },
    });
    /** @type {__VLS_StyleScopedClasses['billing-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "label" },
    });
    /** @type {__VLS_StyleScopedClasses['label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "value" },
    });
    /** @type {__VLS_StyleScopedClasses['value']} */ ;
    (__VLS_ctx.formatMinutes(__VLS_ctx.accountUsage.remaining_billing));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "billing-item" },
    });
    /** @type {__VLS_StyleScopedClasses['billing-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "label" },
    });
    /** @type {__VLS_StyleScopedClasses['label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "value" },
    });
    /** @type {__VLS_StyleScopedClasses['value']} */ ;
    (__VLS_ctx.accountUsage.usage_percent.toFixed(1));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "progress-bar" },
    });
    /** @type {__VLS_StyleScopedClasses['progress-bar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "progress-fill" },
        ...{ style: ({ width: Math.min(__VLS_ctx.accountUsage.usage_percent, 100) + '%' }) },
        ...{ class: (__VLS_ctx.getBillingStatusClass(__VLS_ctx.accountUsage.status)) },
    });
    /** @type {__VLS_StyleScopedClasses['progress-fill']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "summary-grid" },
});
/** @type {__VLS_StyleScopedClasses['summary-grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "summary-item" },
});
/** @type {__VLS_StyleScopedClasses['summary-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "summary-label" },
});
/** @type {__VLS_StyleScopedClasses['summary-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "summary-value" },
});
/** @type {__VLS_StyleScopedClasses['summary-value']} */ ;
(__VLS_ctx.summary.total_jobs);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "summary-item" },
});
/** @type {__VLS_StyleScopedClasses['summary-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "summary-label" },
});
/** @type {__VLS_StyleScopedClasses['summary-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "summary-value" },
});
/** @type {__VLS_StyleScopedClasses['summary-value']} */ ;
(__VLS_ctx.formatHours(__VLS_ctx.summary.total_cpu_hours));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "summary-item" },
});
/** @type {__VLS_StyleScopedClasses['summary-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "summary-label" },
});
/** @type {__VLS_StyleScopedClasses['summary-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "summary-value" },
});
/** @type {__VLS_StyleScopedClasses['summary-value']} */ ;
(__VLS_ctx.formatHours(__VLS_ctx.summary.total_node_hours));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "summary-item" },
});
/** @type {__VLS_StyleScopedClasses['summary-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "summary-label" },
});
/** @type {__VLS_StyleScopedClasses['summary-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "summary-value" },
});
/** @type {__VLS_StyleScopedClasses['summary-value']} */ ;
(__VLS_ctx.formatHours(__VLS_ctx.summary.total_gpu_hours));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "summary-item" },
});
/** @type {__VLS_StyleScopedClasses['summary-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "summary-label" },
});
/** @type {__VLS_StyleScopedClasses['summary-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "summary-value" },
});
/** @type {__VLS_StyleScopedClasses['summary-value']} */ ;
(__VLS_ctx.formatHours(__VLS_ctx.summary.total_memory_hours));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "summary-item" },
});
/** @type {__VLS_StyleScopedClasses['summary-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "summary-label" },
});
/** @type {__VLS_StyleScopedClasses['summary-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "summary-value" },
});
/** @type {__VLS_StyleScopedClasses['summary-value']} */ ;
(__VLS_ctx.summary.period);
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
        ...{ class: "table-header" },
    });
    /** @type {__VLS_StyleScopedClasses['table-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "table-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['table-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "text",
        value: (__VLS_ctx.searchText),
        placeholder: "搜索用户、账户或分区...",
        ...{ class: "search-input" },
    });
    /** @type {__VLS_StyleScopedClasses['search-input']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
        ...{ class: "data-table" },
    });
    /** @type {__VLS_StyleScopedClasses['data-table']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
    if (__VLS_ctx.queryType !== 'user') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    }
    if (__VLS_ctx.queryType !== 'account') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    }
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
    for (const [record] of __VLS_vFor((__VLS_ctx.filteredRecords))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (__VLS_ctx.getRecordKey(record)),
        });
        if (__VLS_ctx.queryType !== 'user') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
            (record.user || '-');
        }
        if (__VLS_ctx.queryType !== 'account') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            (record.account);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (record.cluster);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (record.partition || '-');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "qos-badge" },
            ...{ class: (__VLS_ctx.getQoSClass(record.qos || 'default')) },
        });
        /** @type {__VLS_StyleScopedClasses['qos-badge']} */ ;
        (record.qos || '-');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (record.job_count || 1);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (__VLS_ctx.formatHours(record.cpu_hours));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (__VLS_ctx.formatHours(record.node_hours));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (__VLS_ctx.formatHours(record.gpu_hours));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (__VLS_ctx.formatHours(record.memory_hours));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "state-badge" },
            ...{ class: (__VLS_ctx.getStateClass(record.state || record.status)) },
        });
        /** @type {__VLS_StyleScopedClasses['state-badge']} */ ;
        (record.state || record.status || 'SUMMARY');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (__VLS_ctx.formatTimeRange(record));
        // @ts-ignore
        [exportData, refreshData, onQueryTypeChange, queryType, queryType, queryType, queryType, queryType, queryType, queryType, queryType, queryUser, queryAccount, startDate, endDate, onQuickSelect, queryUsage, accountUsage, accountUsage, accountUsage, accountUsage, accountUsage, accountUsage, accountUsage, accountUsage, accountUsage, accountUsage, accountUsage, getBillingStatusClass, getBillingStatusClass, getBillingStatusClass, getBillingStatusText, formatMinutes, formatMinutes, formatMinutes, summary, summary, summary, summary, summary, summary, formatHours, formatHours, formatHours, formatHours, formatHours, formatHours, formatHours, formatHours, loading, error, error, searchText, filteredRecords, getRecordKey, getQoSClass, getStateClass, formatTimeRange,];
    }
    if (__VLS_ctx.filteredRecords.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "empty-state" },
        });
        /** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "hint" },
        });
        /** @type {__VLS_StyleScopedClasses['hint']} */ ;
    }
}
// @ts-ignore
[filteredRecords,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
