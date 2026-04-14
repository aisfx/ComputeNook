/// <reference types="../../node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted } from 'vue';
const stats = ref({
    nodes: 0,
    nodesOnline: 0,
    cpuCores: 0,
    cpuUsage: 0,
    gpuCards: 0,
    gpuInUse: 0,
    memory: 0,
    memoryFree: 0
});
const jobStats = ref({
    running: 0,
    pending: 0,
    completed: 0,
    failed: 0
});
const nodes = ref([]);
const machineTime = ref({
    totalQuota: 50000,
    used: 32500,
    remaining: 17500,
    usageRate: 65,
    monthUsed: 8200,
    todayUsed: 450,
    expiryDate: '2026-12-31'
});
const storageQuota = ref({
    capacity: {
        used: '3.8 TB',
        total: '5.0 TB',
        available: '1.2 TB',
        percentage: 76
    },
    files: {
        used: 856420,
        total: 1000000,
        available: 143580,
        percentage: 86
    }
});
// 格式化内存显示（自动选择合适的单位）
const formatMemory = (memoryTB) => {
    if (!memoryTB || memoryTB === 0) {
        return '0 GB';
    }
    if (memoryTB >= 1) {
        return `${memoryTB.toFixed(1)} TB`;
    }
    else {
        const memoryGB = memoryTB * 1024;
        return `${memoryGB.toFixed(1)} GB`;
    }
};
// 计算作业统计百分比
const jobStatsTotal = computed(() => {
    return jobStats.value.running + jobStats.value.pending +
        jobStats.value.completed + jobStats.value.failed;
});
const jobStatsPercentages = computed(() => {
    const total = jobStatsTotal.value;
    if (total === 0) {
        return { running: 0, pending: 0, completed: 0, failed: 0 };
    }
    return {
        running: (jobStats.value.running / total) * 100,
        pending: (jobStats.value.pending / total) * 100,
        completed: (jobStats.value.completed / total) * 100,
        failed: (jobStats.value.failed / total) * 100
    };
});
// 加载仪表盘统计数据
const loadDashboardStats = async () => {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            return;
        }
        const response = await fetch('http://localhost:8080/api/dashboard/stats', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            return;
        }
        const result = await response.json();
        const data = result.data;
        // 更新统计数据
        stats.value = {
            nodes: data.total_nodes || 0,
            nodesOnline: data.online_nodes || 0,
            cpuCores: data.total_cpus || 0,
            cpuUsage: Math.round(data.cpu_usage_percent || 0),
            gpuCards: data.total_gpus || 0,
            gpuInUse: data.allocated_gpus || 0,
            memory: data.total_memory_tb || 0,
            memoryFree: data.free_memory_tb || 0
        };
        console.log('Dashboard stats loaded:', stats.value);
    }
    catch (err) {
        console.error('Failed to load dashboard stats:', err);
        // 静默处理错误，不显示通知
    }
};
// 加载节点列表
const loadNodes = async () => {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            throw new Error('请先登录系统');
        }
        const response = await fetch('http://localhost:8080/api/dashboard/nodes', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
            throw new Error(errorMsg);
        }
        const result = await response.json();
        const nodeData = result.data || [];
        console.log('Loaded nodes:', nodeData);
        // 转换节点数据
        nodes.value = nodeData.map((node) => {
            // 状态映射
            let status = 'idle';
            let statusText = '空闲';
            const state = (node.state || '').toUpperCase();
            if (state === 'ALLOCATED' || state === 'MIXED') {
                status = 'online';
                statusText = '在线';
            }
            else if (state === 'IDLE') {
                status = 'idle';
                statusText = '空闲';
            }
            else if (state === 'DOWN' || state === 'DRAIN' || state === 'DRAINING') {
                status = 'offline';
                statusText = '离线';
            }
            else {
                status = 'online';
                statusText = '在线';
            }
            // GPU 信息格式化
            let gpuInfo = '-';
            if (node.gpu_info && node.gpu_info !== '') {
                // 解析总GPU数
                const totalMatch = node.gpu_info.match(/gpu:(\w+:)?(\d+)/);
                const usedMatch = node.gpu_used ? node.gpu_used.match(/gpu:(\w+:)?(\d+)/) : null;
                if (totalMatch) {
                    const total = parseInt(totalMatch[2]);
                    const used = usedMatch ? parseInt(usedMatch[2]) : 0;
                    gpuInfo = `${used}/${total}`;
                }
            }
            return {
                name: node.name,
                status: status,
                statusText: statusText,
                cpuUsage: Math.round(node.cpu_usage_percent || 0),
                memUsage: Math.round(node.memory_usage_percent || 0),
                gpu: gpuInfo,
                jobs: node.running_jobs || 0
            };
        });
    }
    catch (err) {
        console.error('Failed to load nodes:', err);
        // 只在控制台输出错误，不显示通知（避免干扰用户）
        // notification.error(err.message || '获取节点列表失败')
    }
};
// 加载作业统计（从作业API获取）
const loadJobStats = async () => {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            return;
        }
        const response = await fetch('http://localhost:8080/api/jobs?page=1&page_size=1000', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            return;
        }
        const result = await response.json();
        const jobs = result.data || [];
        // 统计作业状态
        jobStats.value = {
            running: jobs.filter((j) => j.job_state === 'RUNNING').length,
            pending: jobs.filter((j) => j.job_state === 'PENDING').length,
            completed: jobs.filter((j) => j.job_state === 'COMPLETED').length,
            failed: jobs.filter((j) => j.job_state === 'FAILED').length
        };
    }
    catch (err) {
        console.error('Failed to load job stats:', err);
    }
};
onMounted(() => {
    loadDashboardStats();
    loadNodes();
    loadJobStats();
    // 定时刷新（每30秒）
    setInterval(() => {
        loadDashboardStats();
        loadNodes();
        loadJobStats();
    }, 30000);
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['job-stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['job-stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['job-stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['job-stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['time-item']} */ ;
/** @type {__VLS_StyleScopedClasses['time-value']} */ ;
/** @type {__VLS_StyleScopedClasses['time-value']} */ ;
/** @type {__VLS_StyleScopedClasses['time-value']} */ ;
/** @type {__VLS_StyleScopedClasses['progress-fill-large']} */ ;
/** @type {__VLS_StyleScopedClasses['warning']} */ ;
/** @type {__VLS_StyleScopedClasses['progress-fill-large']} */ ;
/** @type {__VLS_StyleScopedClasses['charts-row']} */ ;
/** @type {__VLS_StyleScopedClasses['dashboard-row']} */ ;
/** @type {__VLS_StyleScopedClasses['charts-row']} */ ;
/** @type {__VLS_StyleScopedClasses['nodes-table']} */ ;
/** @type {__VLS_StyleScopedClasses['nodes-table']} */ ;
/** @type {__VLS_StyleScopedClasses['nodes-table']} */ ;
/** @type {__VLS_StyleScopedClasses['quota-header-compact']} */ ;
/** @type {__VLS_StyleScopedClasses['quota-status']} */ ;
/** @type {__VLS_StyleScopedClasses['warning']} */ ;
/** @type {__VLS_StyleScopedClasses['quota-fill']} */ ;
/** @type {__VLS_StyleScopedClasses['warning']} */ ;
/** @type {__VLS_StyleScopedClasses['quota-fill']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "dashboard" },
});
/** @type {__VLS_StyleScopedClasses['dashboard']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stats-grid" },
});
/** @type {__VLS_StyleScopedClasses['stats-grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-card" },
});
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-icon" },
});
/** @type {__VLS_StyleScopedClasses['stat-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-content" },
});
/** @type {__VLS_StyleScopedClasses['stat-content']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-value" },
});
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
(__VLS_ctx.stats.nodes);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-detail" },
});
/** @type {__VLS_StyleScopedClasses['stat-detail']} */ ;
(__VLS_ctx.stats.nodesOnline);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-card" },
});
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-icon" },
});
/** @type {__VLS_StyleScopedClasses['stat-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-content" },
});
/** @type {__VLS_StyleScopedClasses['stat-content']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-value" },
});
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
(__VLS_ctx.stats.cpuCores);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-detail" },
});
/** @type {__VLS_StyleScopedClasses['stat-detail']} */ ;
(__VLS_ctx.stats.cpuUsage);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-card" },
});
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-icon" },
});
/** @type {__VLS_StyleScopedClasses['stat-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-content" },
});
/** @type {__VLS_StyleScopedClasses['stat-content']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-value" },
});
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
(__VLS_ctx.stats.gpuCards);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-detail" },
});
/** @type {__VLS_StyleScopedClasses['stat-detail']} */ ;
(__VLS_ctx.stats.gpuInUse);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-card" },
});
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-icon" },
});
/** @type {__VLS_StyleScopedClasses['stat-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-content" },
});
/** @type {__VLS_StyleScopedClasses['stat-content']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-value" },
});
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
(__VLS_ctx.formatMemory(__VLS_ctx.stats.memory));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-detail" },
});
/** @type {__VLS_StyleScopedClasses['stat-detail']} */ ;
(__VLS_ctx.formatMemory(__VLS_ctx.stats.memoryFree));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "charts-row" },
});
/** @type {__VLS_StyleScopedClasses['charts-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card chart-card" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['chart-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "chart-container" },
});
/** @type {__VLS_StyleScopedClasses['chart-container']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    ...{ class: "pie-chart" },
    viewBox: "0 0 200 200",
});
/** @type {__VLS_StyleScopedClasses['pie-chart']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
    cx: "100",
    cy: "100",
    r: "80",
    fill: "none",
    stroke: "#e5e7eb",
    'stroke-width': "40",
});
if (__VLS_ctx.jobStats.running > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "100",
        cy: "100",
        r: "80",
        fill: "none",
        stroke: "#3b82f6",
        'stroke-width': "40",
        'stroke-dasharray': (`${__VLS_ctx.jobStatsPercentages.running * 5.03} 503`),
        'stroke-dashoffset': (0),
        transform: "rotate(-90 100 100)",
    });
}
if (__VLS_ctx.jobStats.pending > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "100",
        cy: "100",
        r: "80",
        fill: "none",
        stroke: "#f59e0b",
        'stroke-width': "40",
        'stroke-dasharray': (`${__VLS_ctx.jobStatsPercentages.pending * 5.03} 503`),
        'stroke-dashoffset': (`${-__VLS_ctx.jobStatsPercentages.running * 5.03}`),
        transform: "rotate(-90 100 100)",
    });
}
if (__VLS_ctx.jobStats.completed > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "100",
        cy: "100",
        r: "80",
        fill: "none",
        stroke: "#10b981",
        'stroke-width': "40",
        'stroke-dasharray': (`${__VLS_ctx.jobStatsPercentages.completed * 5.03} 503`),
        'stroke-dashoffset': (`${-(__VLS_ctx.jobStatsPercentages.running + __VLS_ctx.jobStatsPercentages.pending) * 5.03}`),
        transform: "rotate(-90 100 100)",
    });
}
if (__VLS_ctx.jobStats.failed > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "100",
        cy: "100",
        r: "80",
        fill: "none",
        stroke: "#ef4444",
        'stroke-width': "40",
        'stroke-dasharray': (`${__VLS_ctx.jobStatsPercentages.failed * 5.03} 503`),
        'stroke-dashoffset': (`${-(__VLS_ctx.jobStatsPercentages.running + __VLS_ctx.jobStatsPercentages.pending + __VLS_ctx.jobStatsPercentages.completed) * 5.03}`),
        transform: "rotate(-90 100 100)",
    });
}
__VLS_asFunctionalElement1(__VLS_intrinsics.text, __VLS_intrinsics.text)({
    x: "100",
    y: "95",
    'text-anchor': "middle",
    ...{ class: "chart-total" },
});
/** @type {__VLS_StyleScopedClasses['chart-total']} */ ;
(__VLS_ctx.jobStatsTotal);
__VLS_asFunctionalElement1(__VLS_intrinsics.text, __VLS_intrinsics.text)({
    x: "100",
    y: "115",
    'text-anchor': "middle",
    ...{ class: "chart-label" },
});
/** @type {__VLS_StyleScopedClasses['chart-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "chart-legend" },
});
/** @type {__VLS_StyleScopedClasses['chart-legend']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "legend-item" },
});
/** @type {__VLS_StyleScopedClasses['legend-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "legend-color" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['legend-color']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "legend-text" },
});
/** @type {__VLS_StyleScopedClasses['legend-text']} */ ;
(__VLS_ctx.jobStats.running);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "legend-item" },
});
/** @type {__VLS_StyleScopedClasses['legend-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "legend-color" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['legend-color']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "legend-text" },
});
/** @type {__VLS_StyleScopedClasses['legend-text']} */ ;
(__VLS_ctx.jobStats.pending);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "legend-item" },
});
/** @type {__VLS_StyleScopedClasses['legend-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "legend-color" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['legend-color']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "legend-text" },
});
/** @type {__VLS_StyleScopedClasses['legend-text']} */ ;
(__VLS_ctx.jobStats.completed);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "legend-item" },
});
/** @type {__VLS_StyleScopedClasses['legend-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "legend-color" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['legend-color']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "legend-text" },
});
/** @type {__VLS_StyleScopedClasses['legend-text']} */ ;
(__VLS_ctx.jobStats.failed);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card chart-card" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['chart-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "chart-container" },
});
/** @type {__VLS_StyleScopedClasses['chart-container']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    ...{ class: "pie-chart" },
    viewBox: "0 0 200 200",
});
/** @type {__VLS_StyleScopedClasses['pie-chart']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
    cx: "100",
    cy: "100",
    r: "80",
    fill: "none",
    stroke: "#e5e7eb",
    'stroke-width': "40",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
    cx: "100",
    cy: "100",
    r: "80",
    fill: "none",
    stroke: (__VLS_ctx.storageQuota.capacity.percentage > 90 ? '#ef4444' : __VLS_ctx.storageQuota.capacity.percentage > 80 ? '#f59e0b' : '#667eea'),
    'stroke-width': "40",
    'stroke-dasharray': (`${__VLS_ctx.storageQuota.capacity.percentage * 5.03} 503`),
    'stroke-dashoffset': "0",
    transform: "rotate(-90 100 100)",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.text, __VLS_intrinsics.text)({
    x: "100",
    y: "95",
    'text-anchor': "middle",
    ...{ class: "chart-total" },
});
/** @type {__VLS_StyleScopedClasses['chart-total']} */ ;
(__VLS_ctx.storageQuota.capacity.percentage);
__VLS_asFunctionalElement1(__VLS_intrinsics.text, __VLS_intrinsics.text)({
    x: "100",
    y: "115",
    'text-anchor': "middle",
    ...{ class: "chart-label" },
});
/** @type {__VLS_StyleScopedClasses['chart-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "chart-legend" },
});
/** @type {__VLS_StyleScopedClasses['chart-legend']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "legend-item" },
});
/** @type {__VLS_StyleScopedClasses['legend-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "legend-color" },
    ...{ style: ({ background: __VLS_ctx.storageQuota.capacity.percentage > 90 ? '#ef4444' : __VLS_ctx.storageQuota.capacity.percentage > 80 ? '#f59e0b' : '#667eea' }) },
});
/** @type {__VLS_StyleScopedClasses['legend-color']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "legend-text" },
});
/** @type {__VLS_StyleScopedClasses['legend-text']} */ ;
(__VLS_ctx.storageQuota.capacity.used);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "legend-item" },
});
/** @type {__VLS_StyleScopedClasses['legend-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "legend-color" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['legend-color']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "legend-text" },
});
/** @type {__VLS_StyleScopedClasses['legend-text']} */ ;
(__VLS_ctx.storageQuota.capacity.total);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "legend-item-full" },
});
/** @type {__VLS_StyleScopedClasses['legend-item-full']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "legend-text-small" },
});
/** @type {__VLS_StyleScopedClasses['legend-text-small']} */ ;
(__VLS_ctx.storageQuota.files.used.toLocaleString());
(__VLS_ctx.storageQuota.files.total.toLocaleString());
(__VLS_ctx.storageQuota.files.percentage);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card chart-card" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['chart-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "chart-container" },
});
/** @type {__VLS_StyleScopedClasses['chart-container']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    ...{ class: "pie-chart" },
    viewBox: "0 0 200 200",
});
/** @type {__VLS_StyleScopedClasses['pie-chart']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
    cx: "100",
    cy: "100",
    r: "80",
    fill: "none",
    stroke: "#e5e7eb",
    'stroke-width': "40",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
    cx: "100",
    cy: "100",
    r: "80",
    fill: "none",
    stroke: (__VLS_ctx.machineTime.usageRate > 90 ? '#ef4444' : __VLS_ctx.machineTime.usageRate > 70 ? '#f59e0b' : '#667eea'),
    'stroke-width': "40",
    'stroke-dasharray': (`${__VLS_ctx.machineTime.usageRate * 5.03} 503`),
    'stroke-dashoffset': "0",
    transform: "rotate(-90 100 100)",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.text, __VLS_intrinsics.text)({
    x: "100",
    y: "95",
    'text-anchor': "middle",
    ...{ class: "chart-total" },
});
/** @type {__VLS_StyleScopedClasses['chart-total']} */ ;
(__VLS_ctx.machineTime.usageRate);
__VLS_asFunctionalElement1(__VLS_intrinsics.text, __VLS_intrinsics.text)({
    x: "100",
    y: "115",
    'text-anchor': "middle",
    ...{ class: "chart-label" },
});
/** @type {__VLS_StyleScopedClasses['chart-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "chart-legend" },
});
/** @type {__VLS_StyleScopedClasses['chart-legend']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "legend-item" },
});
/** @type {__VLS_StyleScopedClasses['legend-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "legend-color" },
    ...{ style: ({ background: __VLS_ctx.machineTime.usageRate > 90 ? '#ef4444' : __VLS_ctx.machineTime.usageRate > 70 ? '#f59e0b' : '#667eea' }) },
});
/** @type {__VLS_StyleScopedClasses['legend-color']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "legend-text" },
});
/** @type {__VLS_StyleScopedClasses['legend-text']} */ ;
(__VLS_ctx.machineTime.used);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "legend-item" },
});
/** @type {__VLS_StyleScopedClasses['legend-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "legend-color" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['legend-color']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "legend-text" },
});
/** @type {__VLS_StyleScopedClasses['legend-text']} */ ;
(__VLS_ctx.machineTime.remaining);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "legend-item-full" },
});
/** @type {__VLS_StyleScopedClasses['legend-item-full']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "legend-text-small" },
});
/** @type {__VLS_StyleScopedClasses['legend-text-small']} */ ;
(__VLS_ctx.machineTime.totalQuota);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "legend-item-full" },
});
/** @type {__VLS_StyleScopedClasses['legend-item-full']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "legend-text-small" },
});
/** @type {__VLS_StyleScopedClasses['legend-text-small']} */ ;
(__VLS_ctx.machineTime.expiryDate);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
    ...{ class: "nodes-table" },
});
/** @type {__VLS_StyleScopedClasses['nodes-table']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
for (const [node] of __VLS_vFor((__VLS_ctx.nodes))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
        key: (node.name),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    (node.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: (['status', `status-${node.status}`]) },
    });
    /** @type {__VLS_StyleScopedClasses['status']} */ ;
    (node.statusText);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "progress-bar" },
    });
    /** @type {__VLS_StyleScopedClasses['progress-bar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "progress-fill" },
        ...{ style: ({ width: node.cpuUsage + '%' }) },
    });
    /** @type {__VLS_StyleScopedClasses['progress-fill']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "progress-text" },
    });
    /** @type {__VLS_StyleScopedClasses['progress-text']} */ ;
    (node.cpuUsage);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "progress-bar" },
    });
    /** @type {__VLS_StyleScopedClasses['progress-bar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "progress-fill" },
        ...{ style: ({ width: node.memUsage + '%' }) },
    });
    /** @type {__VLS_StyleScopedClasses['progress-fill']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "progress-text" },
    });
    /** @type {__VLS_StyleScopedClasses['progress-text']} */ ;
    (node.memUsage);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    (node.gpu);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    (node.jobs);
    // @ts-ignore
    [stats, stats, stats, stats, stats, stats, stats, stats, formatMemory, formatMemory, jobStats, jobStats, jobStats, jobStats, jobStats, jobStats, jobStats, jobStats, jobStatsPercentages, jobStatsPercentages, jobStatsPercentages, jobStatsPercentages, jobStatsPercentages, jobStatsPercentages, jobStatsPercentages, jobStatsPercentages, jobStatsPercentages, jobStatsPercentages, jobStatsTotal, storageQuota, storageQuota, storageQuota, storageQuota, storageQuota, storageQuota, storageQuota, storageQuota, storageQuota, storageQuota, storageQuota, machineTime, machineTime, machineTime, machineTime, machineTime, machineTime, machineTime, machineTime, machineTime, machineTime, nodes,];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
