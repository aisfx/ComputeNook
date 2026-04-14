/// <reference types="../../node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted } from 'vue';
import { getUser, isAdmin } from '../utils/auth';
import notification from '../utils/notification';
// import { jobAPI } from '../api' // TODO: 取消注释以启用真实API调用
const emit = defineEmits(['view-detail', 'open-directory']);
const viewMode = ref('my');
const statusFilter = ref('');
const partitionFilter = ref('');
const currentUserInfo = ref(null);
const currentUser = computed(() => currentUserInfo.value?.username || '');
const loading = ref(false);
const error = ref('');
const summary = ref({
    running: 0,
    pending: 0,
    completed: 0,
    failed: 0
});
const allJobs = ref([]);
const pagination = ref({
    page: 1,
    pageSize: 15,
    total: 0,
    totalPages: 0
});
const filteredJobs = computed(() => {
    let jobs = allJobs.value;
    // 根据视图模式筛选
    if (viewMode.value === 'my') {
        jobs = jobs.filter(job => job.user === currentUser.value);
    }
    // 根据状态筛选
    if (statusFilter.value) {
        jobs = jobs.filter(job => job.status === statusFilter.value);
    }
    // 根据分区筛选
    if (partitionFilter.value) {
        jobs = jobs.filter(job => job.partition === partitionFilter.value);
    }
    return jobs;
});
// 更新统计数据
const updateSummary = () => {
    const myJobs = allJobs.value.filter(job => job.user === currentUser.value);
    const today = new Date().toISOString().split('T')[0];
    summary.value = {
        running: myJobs.filter(job => job.status === 'RUNNING').length,
        pending: myJobs.filter(job => job.status === 'PENDING').length,
        completed: myJobs.filter(job => job.status === 'COMPLETED' &&
            job.submitTime.startsWith(today.replace(/-/g, '-'))).length,
        failed: myJobs.filter(job => job.status === 'FAILED').length
    };
};
const canControlJob = (job) => {
    // 管理员可以控制所有作业，普通用户只能控制自己的作业
    return currentUserInfo.value?.isAdmin || job.user === currentUser.value;
};
const cancelJob = async (job) => {
    // 使用简单的确认对话框
    const confirmed = confirm(`🗑️ 取消作业\n\n确定要取消作业 ${job.id} - ${job.name} 吗？\n\n此操作不可恢复。`);
    if (!confirmed) {
        return;
    }
    console.log('取消作业:', job.id);
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            throw new Error('请先登录系统');
        }
        const response = await fetch(`http://localhost:8080/api/jobs/${job.id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '取消作业失败');
        }
        notification.success('作业取消成功');
        await loadJobs(); // 重新加载作业列表
    }
    catch (err) {
        notification.error(err.message || '取消作业失败');
    }
};
const openDirectory = (job) => {
    if (!job.directory || job.directory === '-') {
        notification.error('作业目录不可用');
        return;
    }
    console.log('打开作业目录:', job.directory);
    // 触发事件，通知父组件切换到文件管理并打开指定目录
    emit('open-directory', job.directory);
};
const loadJobs = async () => {
    loading.value = true;
    error.value = '';
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            throw new Error('请先登录系统');
        }
        // 构建 API URL
        let url = `http://localhost:8080/api/jobs?page=${pagination.value.page}&page_size=${pagination.value.pageSize}`;
        // 如果是"我的作业"模式，添加用户名参数
        if (viewMode.value === 'my') {
            url += `&user=${encodeURIComponent(currentUser.value)}`;
        }
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            // 静默处理错误，不显示提示
            console.error('Failed to fetch jobs:', response.status, response.statusText);
            allJobs.value = [];
            updateSummary();
            return;
        }
        const result = await response.json();
        // 处理返回的数据
        if (result.data && Array.isArray(result.data)) {
            allJobs.value = result.data.map((job) => {
                // 计算运行时间
                let runTime = 0;
                if (job.end_time && job.start_time && job.end_time > 0 && job.start_time > 0) {
                    // 已完成的作业
                    runTime = job.end_time - job.start_time;
                }
                else if (job.start_time && job.start_time > 0) {
                    // 正在运行的作业
                    runTime = Math.floor(Date.now() / 1000) - job.start_time;
                }
                // 解析节点数量
                let nodeCount = 0;
                if (typeof job.nodes === 'number') {
                    nodeCount = job.nodes;
                }
                else if (typeof job.nodes === 'string' && job.nodes) {
                    // 节点字符串可能是 "node01,node02" 或 "node[01-04]" 或 "cn1"
                    if (job.nodes === 'None assigned' || job.nodes === '') {
                        nodeCount = 0;
                    }
                    else {
                        const nodeList = job.nodes.split(',');
                        nodeCount = nodeList.length;
                    }
                }
                return {
                    id: job.job_id || job.id,
                    user: job.user_name || job.user,
                    name: job.name || `Job ${job.job_id || job.id}`,
                    status: job.job_state || job.status || 'UNKNOWN',
                    partition: job.partition || '-',
                    nodes: nodeCount,
                    cpus: job.cpus || 0,
                    submitTime: formatTime(job.submit_time),
                    runTime: formatDuration(runTime),
                    directory: job.work_dir || job.directory || '-',
                    account: job.account || '-',
                    timeLimit: job.time_limit || 0
                };
            });
            // 更新分页信息
            if (result.pagination) {
                pagination.value = {
                    page: result.pagination.page,
                    pageSize: result.pagination.page_size,
                    total: result.pagination.total,
                    totalPages: result.pagination.total_pages
                };
            }
        }
        else {
            allJobs.value = [];
        }
        updateSummary();
    }
    catch (err) {
        // 静默处理错误，只在控制台输出
        console.error('Failed to load jobs:', err);
        allJobs.value = [];
        updateSummary();
    }
    finally {
        loading.value = false;
    }
};
// 切换页码
const changePage = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.value.totalPages) {
        pagination.value.page = newPage;
        loadJobs();
    }
};
// 格式化时间
const formatTime = (timestamp) => {
    if (!timestamp || timestamp === 0)
        return '-';
    try {
        // Unix 时间戳（秒）转换为毫秒
        const date = new Date(timestamp * 1000);
        // 检查日期是否有效
        if (isNaN(date.getTime()))
            return '-';
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).replace(/\//g, '-');
    }
    catch {
        return '-';
    }
};
// 格式化持续时间
const formatDuration = (seconds) => {
    if (!seconds || seconds === 0 || seconds < 0)
        return '-';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) {
        return `${days}天${hours}时${minutes}分`;
    }
    else if (hours > 0) {
        return `${hours}时${minutes}分`;
    }
    else if (minutes > 0) {
        return `${minutes}分`;
    }
    else {
        return `${seconds}秒`;
    }
};
// 初始化
onMounted(() => {
    // 获取当前用户信息
    currentUserInfo.value = getUser();
    // 如果不是管理员，强制显示"我的作业"
    if (!isAdmin()) {
        viewMode.value = 'my';
    }
    // 更新统计数据
    updateSummary();
    // 自动加载作业列表
    loadJobs();
    console.log('当前用户:', currentUser.value, '是否管理员:', currentUserInfo.value?.isAdmin);
});
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['jobs-header']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-select']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-value']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-value']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-value']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-value']} */ ;
/** @type {__VLS_StyleScopedClasses['action-buttons']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
/** @type {__VLS_StyleScopedClasses['pagination']} */ ;
/** @type {__VLS_StyleScopedClasses['jobs-header']} */ ;
/** @type {__VLS_StyleScopedClasses['header-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['filters']} */ ;
/** @type {__VLS_StyleScopedClasses['job-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['job-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['view-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle-btn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jobs-header" },
});
/** @type {__VLS_StyleScopedClasses['jobs-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "header-controls" },
});
/** @type {__VLS_StyleScopedClasses['header-controls']} */ ;
if (__VLS_ctx.currentUserInfo?.isAdmin) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "view-toggle" },
    });
    /** @type {__VLS_StyleScopedClasses['view-toggle']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.currentUserInfo?.isAdmin))
                    return;
                __VLS_ctx.viewMode = 'my';
                // @ts-ignore
                [currentUserInfo, viewMode,];
            } },
        ...{ class: (['toggle-btn', { active: __VLS_ctx.viewMode === 'my' }]) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['toggle-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.currentUserInfo?.isAdmin))
                    return;
                __VLS_ctx.viewMode = 'all';
                // @ts-ignore
                [viewMode, viewMode,];
            } },
        ...{ class: (['toggle-btn', { active: __VLS_ctx.viewMode === 'all' }]) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['toggle-btn']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "view-toggle" },
    });
    /** @type {__VLS_StyleScopedClasses['view-toggle']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "current-view-label" },
    });
    /** @type {__VLS_StyleScopedClasses['current-view-label']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "filters" },
});
/** @type {__VLS_StyleScopedClasses['filters']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_ctx.statusFilter),
    ...{ class: "filter-select" },
});
/** @type {__VLS_StyleScopedClasses['filter-select']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "RUNNING",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "PENDING",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "COMPLETED",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "FAILED",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_ctx.partitionFilter),
    ...{ class: "filter-select" },
});
/** @type {__VLS_StyleScopedClasses['filter-select']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "compute",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "gpu",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "memory",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "debug",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.loadJobs) },
    ...{ class: "btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
if (__VLS_ctx.viewMode === 'my') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "job-summary" },
    });
    /** @type {__VLS_StyleScopedClasses['job-summary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "summary-item" },
    });
    /** @type {__VLS_StyleScopedClasses['summary-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "summary-label" },
    });
    /** @type {__VLS_StyleScopedClasses['summary-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "summary-value running" },
    });
    /** @type {__VLS_StyleScopedClasses['summary-value']} */ ;
    /** @type {__VLS_StyleScopedClasses['running']} */ ;
    (__VLS_ctx.summary.running);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "summary-item" },
    });
    /** @type {__VLS_StyleScopedClasses['summary-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "summary-label" },
    });
    /** @type {__VLS_StyleScopedClasses['summary-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "summary-value pending" },
    });
    /** @type {__VLS_StyleScopedClasses['summary-value']} */ ;
    /** @type {__VLS_StyleScopedClasses['pending']} */ ;
    (__VLS_ctx.summary.pending);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "summary-item" },
    });
    /** @type {__VLS_StyleScopedClasses['summary-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "summary-label" },
    });
    /** @type {__VLS_StyleScopedClasses['summary-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "summary-value completed" },
    });
    /** @type {__VLS_StyleScopedClasses['summary-value']} */ ;
    /** @type {__VLS_StyleScopedClasses['completed']} */ ;
    (__VLS_ctx.summary.completed);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "summary-item" },
    });
    /** @type {__VLS_StyleScopedClasses['summary-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "summary-label" },
    });
    /** @type {__VLS_StyleScopedClasses['summary-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "summary-value failed" },
    });
    /** @type {__VLS_StyleScopedClasses['summary-value']} */ ;
    /** @type {__VLS_StyleScopedClasses['failed']} */ ;
    (__VLS_ctx.summary.failed);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "table-container" },
});
/** @type {__VLS_StyleScopedClasses['table-container']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
    ...{ class: "jobs-table" },
});
/** @type {__VLS_StyleScopedClasses['jobs-table']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
if (__VLS_ctx.viewMode === 'all') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
}
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
for (const [job] of __VLS_vFor((__VLS_ctx.filteredJobs))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
        key: (job.id),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    (job.id);
    if (__VLS_ctx.viewMode === 'all') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (job.user);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    (job.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: (['status', `status-${job.status.toLowerCase()}`]) },
    });
    /** @type {__VLS_StyleScopedClasses['status']} */ ;
    (job.status);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    (job.partition);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    (job.nodes);
    (job.cpus);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    (job.submitTime);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    (job.runTime);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "action-buttons" },
    });
    /** @type {__VLS_StyleScopedClasses['action-buttons']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.$emit('view-detail', job);
                // @ts-ignore
                [viewMode, viewMode, viewMode, viewMode, statusFilter, partitionFilter, loadJobs, summary, summary, summary, summary, filteredJobs, $emit,];
            } },
        ...{ class: "btn-link" },
        title: "查看详情",
    });
    /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
    if ((job.status === 'RUNNING' || job.status === 'PENDING') && __VLS_ctx.canControlJob(job)) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!((job.status === 'RUNNING' || job.status === 'PENDING') && __VLS_ctx.canControlJob(job)))
                        return;
                    __VLS_ctx.cancelJob(job);
                    // @ts-ignore
                    [canControlJob, cancelJob,];
                } },
            ...{ class: "btn-link danger" },
            title: "取消作业",
        });
        /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
        /** @type {__VLS_StyleScopedClasses['danger']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.openDirectory(job);
                // @ts-ignore
                [openDirectory,];
            } },
        ...{ class: "btn-link" },
        title: "打开作业目录",
    });
    /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
    // @ts-ignore
    [];
}
if (__VLS_ctx.filteredJobs.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty-state" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
}
if (__VLS_ctx.pagination.total > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pagination" },
    });
    /** @type {__VLS_StyleScopedClasses['pagination']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.pagination.total > 0))
                    return;
                __VLS_ctx.changePage(__VLS_ctx.pagination.page - 1);
                // @ts-ignore
                [filteredJobs, pagination, pagination, changePage,];
            } },
        ...{ class: "btn-secondary" },
        disabled: (__VLS_ctx.pagination.page <= 1),
    });
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "pagination-info" },
    });
    /** @type {__VLS_StyleScopedClasses['pagination-info']} */ ;
    (__VLS_ctx.pagination.page);
    (__VLS_ctx.pagination.totalPages);
    (__VLS_ctx.pagination.total);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.pagination.total > 0))
                    return;
                __VLS_ctx.changePage(__VLS_ctx.pagination.page + 1);
                // @ts-ignore
                [pagination, pagination, pagination, pagination, pagination, changePage,];
            } },
        ...{ class: "btn-secondary" },
        disabled: (__VLS_ctx.pagination.page >= __VLS_ctx.pagination.totalPages),
    });
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
}
// @ts-ignore
[pagination, pagination,];
const __VLS_export = (await import('vue')).defineComponent({
    emits: {},
});
export default {};
