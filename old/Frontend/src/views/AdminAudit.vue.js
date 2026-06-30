/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, onMounted } from 'vue';
import axios from 'axios';
import * as echarts from 'echarts';
import notification from '../utils/notification';
import { reportAPI } from '../api/report';
const loading = ref(false);
const error = ref('');
const logs = ref([]);
const stats = ref({});
const showStats = ref(false);
const showDetailsDialog = ref(false);
const selectedLog = ref(null);
const activeTab = ref('audit');
// SSH 日志
const sshLogs = ref([]);
const sshLoading = ref(false);
const sshFilter = ref({ username: '', date: '' });
const showSSHLogModal = ref(false);
const sshLogFile = ref(null);
const sshLogContent = ref('');
const loadSSHLogs = async () => {
    sshLoading.value = true;
    try {
        const params = {};
        if (sshFilter.value.username)
            params.username = sshFilter.value.username;
        if (sshFilter.value.date)
            params.date = sshFilter.value.date;
        const res = await axios.get('/audit/ssh-logs', { params });
        sshLogs.value = res.data.data || [];
    }
    catch (e) {
        notification.error(e.response?.data?.error || e.message, '加载SSH日志失败');
    }
    finally {
        sshLoading.value = false;
    }
};
const viewSSHLog = async (item) => {
    sshLogFile.value = item;
    sshLogContent.value = '加载中...';
    showSSHLogModal.value = true;
    try {
        const res = await axios.get(`/audit/ssh-logs/download`, {
            params: { username: item.username, file: item.file, view: '1' },
            responseType: 'text',
        });
        sshLogContent.value = res.data || '（日志为空）';
    }
    catch (e) {
        sshLogContent.value = '加载失败: ' + (e.response?.data?.error || e.message);
    }
};
const formatSize = (bytes) => {
    if (bytes < 1024)
        return bytes + ' B';
    if (bytes < 1024 * 1024)
        return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
};
// 过滤器
const filters = ref({
    username: '',
    action: '',
    resource: '',
    status: '',
    timeRange: '24h',
    startTime: '',
    endTime: ''
});
// 防抖定时器
let debounceTimer = null;
// 加载日志
const loadLogs = async () => {
    loading.value = true;
    error.value = '';
    try {
        const params = {
            limit: 1000
        };
        if (filters.value.username)
            params.username = filters.value.username;
        if (filters.value.action)
            params.action = filters.value.action;
        if (filters.value.resource)
            params.resource = filters.value.resource;
        if (filters.value.status)
            params.status = filters.value.status;
        if (filters.value.startTime)
            params.start_time = filters.value.startTime;
        if (filters.value.endTime)
            params.end_time = filters.value.endTime;
        const response = await axios.get('/audit/logs', { params });
        logs.value = response.data.data || [];
    }
    catch (err) {
        error.value = err.response?.data?.error || '加载日志失败';
    }
    finally {
        loading.value = false;
    }
};
// 防抖加载
const debouncedLoad = () => {
    if (debounceTimer)
        clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        loadLogs();
    }, 500);
};
// 加载统计信息
const loadStats = async () => {
    try {
        const response = await axios.get('/audit/stats');
        stats.value = response.data.data || {};
        showStats.value = !showStats.value;
    }
    catch (err) {
        notification.error(err.response?.data?.error || err.message, '加载统计失败');
    }
};
// 处理时间范围变化
const handleTimeRangeChange = () => {
    const now = new Date();
    let startTime = new Date();
    switch (filters.value.timeRange) {
        case '1h':
            startTime.setHours(now.getHours() - 1);
            break;
        case '24h':
            startTime.setHours(now.getHours() - 24);
            break;
        case '7d':
            startTime.setDate(now.getDate() - 7);
            break;
        case '30d':
            startTime.setDate(now.getDate() - 30);
            break;
        default:
            filters.value.startTime = '';
            filters.value.endTime = '';
            loadLogs();
            return;
    }
    filters.value.startTime = startTime.toISOString();
    filters.value.endTime = now.toISOString();
    loadLogs();
};
// 重置过滤器
const resetFilters = () => {
    filters.value = {
        username: '',
        action: '',
        resource: '',
        status: '',
        timeRange: '24h',
        startTime: '',
        endTime: ''
    };
    handleTimeRangeChange();
};
// 导出日志
const exportLogs = async () => {
    try {
        const params = {};
        if (filters.value.username)
            params.username = filters.value.username;
        if (filters.value.action)
            params.action = filters.value.action;
        if (filters.value.resource)
            params.resource = filters.value.resource;
        if (filters.value.status)
            params.status = filters.value.status;
        if (filters.value.startTime)
            params.start_time = filters.value.startTime;
        if (filters.value.endTime)
            params.end_time = filters.value.endTime;
        const queryString = new URLSearchParams(params).toString();
        const url = `/audit/export${queryString ? '?' + queryString : ''}`;
        window.open(axios.defaults.baseURL + url, '_blank');
        notification.success('导出任务已启动');
    }
    catch (err) {
        notification.error(err.response?.data?.error || err.message, '导出失败');
    }
};
// 查看详情
const viewDetails = (log) => {
    selectedLog.value = log;
    showDetailsDialog.value = true;
};
// 关闭详情
const closeDetails = () => {
    showDetailsDialog.value = false;
    selectedLog.value = null;
};
// 格式化时间
const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000)
        return '刚刚';
    if (diff < 3600000)
        return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000)
        return Math.floor(diff / 3600000) + '小时前';
    return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};
// 格式化完整时间
const formatFullTime = (timestamp) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};
// 获取操作标签
const getActionLabel = (action) => {
    const labels = {
        page_view: '📄 页面访问',
        shell_command: '💻 Shell命令',
        shell_blocked: '⛔ 被拦截',
        create: '创建',
        update: '更新',
        delete: '删除',
        read: '读取',
        login: '登录',
        logout: '登出',
        reset_password: '重置密码',
        change_password: '修改密码',
        set_disabled: '禁用/启用',
        export: '导出'
    };
    return labels[action] || action;
};
// 获取资源标签
const getResourceLabel = (resource) => {
    const labels = {
        user: '用户',
        group: '用户组',
        account: '账户',
        association: '关联',
        qos: 'QoS',
        job: '作业',
        file: '文件',
        auth: '认证'
    };
    return labels[resource] || resource;
};
// ── 用量报表（管理员） ──────────────────────────────────────
function fmtDate(d) { return d.toISOString().split('T')[0]; }
const rToday = new Date();
const r30ago = new Date(rToday);
r30ago.setDate(rToday.getDate() - 30);
const reportLoading = ref(false);
const reportError = ref('');
const reportPartitions = ref([]);
const reportFilters = ref({ username: '', startDate: fmtDate(r30ago), endDate: fmtDate(rToday), partition: '' });
const rJobStats = ref(null);
const rUsageStats = ref(null);
const rStorageStats = ref(null);
const rQuotaStats = ref(null);
const rQosStats = ref(null);
const rLineRef = ref(null);
const rScaleRef = ref(null);
const rUsageRef = ref(null);
const rStorageRef = ref(null);
const rQosRef = ref(null);
const rBillingRef = ref(null);
const rQuotaRef = ref(null);
let rLineChart = null;
let rScaleChart = null;
let rUsageChart = null;
let rStorageChart = null;
let rQosChart = null;
let rBillingChart = null;
let rQuotaChart = null;
import { computed, nextTick } from 'vue';
// 这是解决 echarts 在 v-if 条件渲染下尺寸错误的最可靠方案
const reportHasData = computed(() => !!(rJobStats.value || rUsageStats.value || rStorageStats.value || rQuotaStats.value));
function switchToReport() {
    activeTab.value = 'report';
    nextTick(() => {
        rLineChart?.resize();
        rScaleChart?.resize();
        rUsageChart?.resize();
        rStorageChart?.resize();
        rQosChart?.resize();
        rBillingChart?.resize();
        rQuotaChart?.resize();
    });
}
async function loadReportPartitions() {
    try {
        const res = await axios.get('/jobs/partitions/list');
        reportPartitions.value = res.data?.data ?? [];
    }
    catch {
        reportPartitions.value = [];
    }
}
async function loadAdminReport() {
    reportLoading.value = true;
    reportError.value = '';
    rJobStats.value = null;
    rUsageStats.value = null;
    rStorageStats.value = null;
    rQuotaStats.value = null;
    const params = {
        start_time: reportFilters.value.startDate,
        end_time: reportFilters.value.endDate,
        partition: reportFilters.value.partition || undefined,
    };
    if (reportFilters.value.username)
        params.user = reportFilters.value.username;
    try {
        const [jobRes, usageRes, storageRes, quotaRes, qosRes] = await Promise.allSettled([
            reportAPI.getJobStats(params),
            reportAPI.getUsageStats(params),
            reportAPI.getStorageStats(params),
            reportAPI.getQuotaStats(params),
            reportAPI.getQoSUsage(params),
        ]);
        if (jobRes.status === 'fulfilled')
            rJobStats.value = jobRes.value.data.data;
        if (usageRes.status === 'fulfilled')
            rUsageStats.value = usageRes.value.data.data;
        if (storageRes.status === 'fulfilled')
            rStorageStats.value = storageRes.value.data.data;
        if (quotaRes.status === 'fulfilled')
            rQuotaStats.value = quotaRes.value.data.data;
        if (qosRes.status === 'fulfilled')
            rQosStats.value = qosRes.value.data.data;
        // 先关闭 loading，让 v-else-if="reportHasData" 的 DOM 渲染出来
        reportLoading.value = false;
        // 等两个 tick：第一个让 v-if 条件生效，第二个让 DOM 完全挂载
        await nextTick();
        await nextTick();
        renderAdminCharts();
    }
    catch (e) {
        reportError.value = e?.message || '查询失败';
    }
    finally {
        reportLoading.value = false;
    }
}
function renderAdminCharts() {
    // 找到第一个存在的容器，检查是否已布局
    const firstRef = rLineRef.value || rScaleRef.value || rUsageRef.value || rStorageRef.value;
    if (firstRef && firstRef.offsetWidth === 0) {
        setTimeout(renderAdminCharts, 150);
        return;
    }
    const C = {
        text: '#374151', muted: '#6b7280', axis: '#d1d5db', split: '#f3f4f6',
        colors: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'],
    };
    const sc = (s) => s === 'EXCEEDED' ? '#ef4444' : s === 'WARNING' ? '#f59e0b' : '#10b981';
    if (rLineRef.value) {
        // 每次都重新 init，确保用当前容器的正确尺寸
        rLineChart?.dispose();
        rLineChart = echarts.init(rLineRef.value);
        const counts = rJobStats.value?.monthly_job_counts ?? [];
        const hasData = counts.length > 0;
        const months = hasData ? [...new Set(counts.map(c => c.month))].sort() : ['2026-01', '2026-02', '2026-03', '2026-04'];
        const queues = hasData ? [...new Set(counts.map(c => c.partition))] : ['normal', 'gpu'];
        rLineChart.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis', backgroundColor: '#fff', borderColor: '#e5e7eb', textStyle: { color: C.text } },
            legend: { data: queues, textStyle: { color: C.muted }, top: 4, left: 'center' },
            grid: { left: '3%', right: '4%', bottom: '8%', top: '14%', containLabel: true },
            xAxis: { type: 'category', data: months, boundaryGap: false, axisLabel: { color: C.muted }, axisLine: { lineStyle: { color: C.axis } }, axisTick: { show: false } },
            yAxis: { type: 'value', axisLabel: { color: C.muted }, splitLine: { lineStyle: { color: C.split } }, axisLine: { show: false } },
            series: queues.map((q, i) => ({
                name: q, type: 'line', smooth: true, symbol: 'circle', symbolSize: 7,
                lineStyle: { width: 2.5, color: C.colors[i % C.colors.length] },
                itemStyle: { color: C.colors[i % C.colors.length] },
                areaStyle: { color: C.colors[i % C.colors.length], opacity: 0.06 },
                data: hasData ? months.map(m => counts.find(c => c.month === m && c.partition === q)?.count ?? 0) : [0, 0, 0, 0],
            })),
        });
    }
    if (rScaleRef.value) {
        rScaleChart?.dispose();
        rScaleChart = echarts.init(rScaleRef.value);
        const dist = rJobStats.value?.job_scale_distribution ?? [];
        const total = rJobStats.value?.total_jobs ?? 0;
        const ranges = dist.length > 0 ? dist : [
            { range: '1-4核', count: 0 }, { range: '5-16核', count: 0 },
            { range: '17-64核', count: 0 }, { range: '64核以上', count: 0 },
        ];
        rScaleChart.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis', backgroundColor: '#fff', borderColor: '#e5e7eb', textStyle: { color: C.text },
                formatter: (p) => { const pct = total > 0 ? (p[0].value / total * 100).toFixed(1) : 0; return `${p[0].name}<br/>作业数: <b>${p[0].value}</b>（${pct}%）`; } },
            grid: { left: '3%', right: '4%', bottom: '3%', top: '6%', containLabel: true },
            xAxis: { type: 'category', data: ranges.map(d => d.range), axisLabel: { color: C.muted }, axisLine: { lineStyle: { color: C.axis } }, axisTick: { show: false } },
            yAxis: { type: 'value', axisLabel: { color: C.muted }, splitLine: { lineStyle: { color: C.split } }, axisLine: { show: false } },
            series: [{ type: 'bar', data: ranges.map(d => d.count), itemStyle: { color: C.colors[0], borderRadius: [6, 6, 0, 0] }, label: { show: true, position: 'top', color: C.muted, fontSize: 12 }, barMaxWidth: 56 }],
        });
    }
    if (rUsageRef.value) {
        rUsageChart?.dispose();
        rUsageChart = echarts.init(rUsageRef.value);
        const u = rUsageStats.value;
        rUsageChart.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: '#fff', borderColor: '#e5e7eb', textStyle: { color: C.text } },
            grid: { left: '3%', right: '4%', bottom: '3%', top: '6%', containLabel: true },
            xAxis: { type: 'category', data: ['GPU 卡时', 'CPU 核时', '计费核时'], axisLabel: { color: C.muted }, axisLine: { lineStyle: { color: C.axis } }, axisTick: { show: false } },
            yAxis: { type: 'value', axisLabel: { color: C.muted }, splitLine: { lineStyle: { color: C.split } }, axisLine: { show: false } },
            series: [{ type: 'bar',
                    data: [
                        { value: u ? +u.gpu_hours.toFixed(2) : 0, itemStyle: { color: C.colors[0] } },
                        { value: u ? +u.cpu_hours.toFixed(2) : 0, itemStyle: { color: C.colors[1] } },
                        { value: u ? +u.billing_hours.toFixed(2) : 0, itemStyle: { color: C.colors[2] } },
                    ],
                    label: { show: true, position: 'top', color: C.muted, fontSize: 12, formatter: (p) => `${p.value}h` },
                    barMaxWidth: 56, itemStyle: { borderRadius: [6, 6, 0, 0] }, }],
        });
    }
    if (rStorageRef.value && rStorageStats.value?.length) {
        rStorageChart?.dispose();
        rStorageChart = echarts.init(rStorageRef.value);
        const items = rStorageStats.value;
        const labels = items.map(i => `${i.username}  ${i.filesystem}`);
        const barColors = items.map(i => i.over_soft_limit ? '#f59e0b' : '#10b981');
        rStorageChart.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: '#fff', borderColor: '#e5e7eb', textStyle: { color: C.text },
                formatter: (params) => { const i = items[params[0].dataIndex]; return `<b>${i.username}</b> ${i.filesystem}<br/>已用: <b>${i.used_gb.toFixed(2)} GB</b><br/>软限制: ${i.soft_limit_gb.toFixed(2)} GB<br/>硬限制: ${i.hard_limit_gb.toFixed(2)} GB<br/>使用率: <b>${i.usage_percent.toFixed(1)}%</b>${i.over_soft_limit ? '<br/><span style="color:#f59e0b">⚠ 超软限制</span>' : ''}`; },
            },
            legend: { data: ['已用量', '软限制', '硬限制'], textStyle: { color: C.muted }, top: 4 },
            grid: { left: '2%', right: '8%', top: 36, bottom: '2%', containLabel: true },
            xAxis: { type: 'value', name: 'GB', nameTextStyle: { color: C.muted }, axisLabel: { color: C.muted }, splitLine: { lineStyle: { color: C.split } }, axisLine: { show: false } },
            yAxis: { type: 'category', data: labels, axisLabel: { color: C.text, fontSize: 12 }, axisLine: { lineStyle: { color: C.axis } } },
            series: [
                { name: '已用量', type: 'bar', data: items.map((v, i) => ({ value: +v.used_gb.toFixed(2), itemStyle: { color: barColors[i] } })), label: { show: true, position: 'right', color: C.muted, fontSize: 11, formatter: (p) => `${p.value} GB` }, barMaxWidth: 28, z: 3 },
                { name: '软限制', type: 'bar', data: items.map(i => +i.soft_limit_gb.toFixed(2)), itemStyle: { color: 'rgba(245,158,11,0.15)', borderColor: '#f59e0b', borderWidth: 1 }, barMaxWidth: 28, barGap: '-100%', z: 2 },
                { name: '硬限制', type: 'bar', data: items.map(i => +i.hard_limit_gb.toFixed(2)), itemStyle: { color: 'rgba(107,114,128,0.08)', borderColor: '#d1d5db', borderWidth: 1 }, barMaxWidth: 28, barGap: '-100%', z: 1 },
            ],
        });
    }
    if (rBillingRef.value && rUsageStats.value) {
        rBillingChart?.dispose();
        rBillingChart = echarts.init(rBillingRef.value);
        const u = rUsageStats.value;
        const noLimit = u.quota_billing_hours === 0;
        const used = +u.billing_hours.toFixed(2);
        const total = noLimit ? Math.max(used * 1.5, 100) : +u.quota_billing_hours.toFixed(2);
        const pct = noLimit ? 0 : +u.usage_percent.toFixed(1);
        const color = noLimit ? C.colors[0] : sc(u.status);
        rBillingChart.setOption({
            backgroundColor: 'transparent',
            series: [{ type: 'gauge', startAngle: 200, endAngle: -20, min: 0, max: 100, radius: '88%',
                    pointer: { show: !noLimit, length: '60%', width: 4, itemStyle: { color } },
                    progress: { show: true, width: 16, itemStyle: { color } },
                    axisLine: { lineStyle: { width: 16, color: [[1, '#f3f4f6']] } },
                    axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
                    detail: { valueAnimation: true, formatter: noLimit ? `${used}h` : '{value}%', color: C.text, fontSize: 22, fontWeight: 700, offsetCenter: [0, '15%'] },
                    title: { show: true, offsetCenter: [0, '50%'], color: C.muted, fontSize: 13, formatter: noLimit ? '无配额限制' : `${used} / ${total} h` },
                    data: [{ value: noLimit ? 0 : pct, name: noLimit ? '无配额限制' : `${used} / ${total} h` }],
                }],
        });
    }
    if (rQuotaRef.value) {
        rQuotaChart?.dispose();
        rQuotaChart = echarts.init(rQuotaRef.value);
        const q = rQuotaStats.value;
        const used = q ? +q.used_billing_hours.toFixed(2) : 0;
        const total = q ? +q.total_billing_hours.toFixed(2) : 0;
        const pct = q ? +q.usage_percent.toFixed(1) : 0;
        const color = q ? sc(q.status) : '#d1d5db';
        const noData = !q?.account;
        rQuotaChart.setOption({
            backgroundColor: 'transparent',
            series: [{ type: 'gauge', startAngle: 200, endAngle: -20, min: 0, max: 100, radius: '88%',
                    pointer: { show: !noData, length: '60%', width: 4, itemStyle: { color } },
                    progress: { show: true, width: 16, itemStyle: { color } },
                    axisLine: { lineStyle: { width: 16, color: [[1, '#f3f4f6']] } },
                    axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
                    detail: { valueAnimation: true, formatter: noData ? '-' : '{value}%', color: noData ? '#d1d5db' : C.text, fontSize: 22, fontWeight: 700, offsetCenter: [0, '15%'] },
                    title: { show: true, offsetCenter: [0, '50%'], color: C.muted, fontSize: 13, formatter: noData ? '暂无配额数据' : `${used} / ${total} h` },
                    data: [{ value: pct, name: noData ? '暂无配额数据' : `${used} / ${total} h` }],
                }],
        });
    }
    if (rQosRef.value && rQosStats.value?.length) {
        rQosChart?.dispose();
        rQosChart = echarts.init(rQosRef.value);
        const items = rQosStats.value;
        const names = items.map(i => i.qos_name);
        const usedData = items.map(i => +i.used_billing_hours.toFixed(2));
        const totalData = items.map(i => i.total_billing_hours > 0 ? +i.total_billing_hours.toFixed(2) : 0);
        const barColors = items.map(i => sc(i.status));
        rQosChart.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: '#fff', borderColor: '#e5e7eb', textStyle: { color: C.text },
                formatter: (params) => { const idx = params[0].dataIndex; const item = items[idx]; const quota = item.total_billing_hours > 0 ? `配额: ${item.total_billing_hours.toFixed(2)} h<br/>使用率: <b>${item.usage_percent.toFixed(1)}%</b>` : '配额: 无限制'; return `<b>${item.qos_name}</b><br/>已用: <b>${item.used_billing_hours.toFixed(2)} h</b><br/>${quota}`; },
            },
            legend: { data: ['已用核时', '配额上限'], textStyle: { color: C.muted }, top: 4, left: 'center' },
            grid: { left: '3%', right: '4%', bottom: '8%', top: '14%', containLabel: true },
            xAxis: { type: 'category', data: names, axisLabel: { color: C.muted }, axisLine: { lineStyle: { color: C.axis } }, axisTick: { show: false } },
            yAxis: { type: 'value', name: '核时(h)', nameTextStyle: { color: C.muted }, axisLabel: { color: C.muted }, splitLine: { lineStyle: { color: C.split } }, axisLine: { show: false } },
            series: [
                { name: '已用核时', type: 'bar', data: usedData.map((v, i) => ({ value: v, itemStyle: { color: barColors[i], borderRadius: [6, 6, 0, 0] } })), label: { show: true, position: 'top', color: C.muted, fontSize: 12, formatter: (p) => `${p.value}h` }, barMaxWidth: 56, z: 2 },
                { name: '配额上限', type: 'bar', data: totalData, itemStyle: { color: 'rgba(99,102,241,0.08)', borderColor: '#c7d2fe', borderWidth: 1, borderRadius: [6, 6, 0, 0] }, barMaxWidth: 56, barGap: '-100%', z: 1 },
            ],
        });
    }
    setTimeout(() => {
        if (rLineRef.value && rLineChart)
            rLineChart.resize({ width: rLineRef.value.offsetWidth, height: rLineRef.value.offsetHeight });
        rScaleChart?.resize();
        rUsageChart?.resize();
        rStorageChart?.resize();
        rBillingChart?.resize();
        rQuotaChart?.resize();
        rQosChart?.resize();
    }, 300);
}
function exportAdminExcel() {
    const rStatusLabel = (s) => s === 'EXCEEDED' ? '已超限' : s === 'WARNING' ? '警告' : '正常';
    import('xlsx').then(XLSX => {
        const wb = XLSX.utils.book_new();
        const { startDate, endDate, username } = reportFilters.value;
        if (rJobStats.value) {
            const j = rJobStats.value;
            const ws1 = XLSX.utils.aoa_to_sheet([['月份', '队列', '作业数'], ...j.monthly_job_counts.map(r => [r.month, r.partition, r.count])]);
            ws1['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 10 }];
            XLSX.utils.book_append_sheet(wb, ws1, '月度作业趋势');
            const ws2 = XLSX.utils.aoa_to_sheet([['规模范围', '作业数', '占比(%)'], ...j.job_scale_distribution.map(r => [r.range, r.count, j.total_jobs > 0 ? +(r.count / j.total_jobs * 100).toFixed(1) : 0]), ['合计', j.total_jobs, 100]]);
            ws2['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 10 }];
            XLSX.utils.book_append_sheet(wb, ws2, '作业规模分布');
        }
        if (rUsageStats.value) {
            const u = rUsageStats.value;
            const ws = XLSX.utils.aoa_to_sheet([['指标', '数值', '单位'], ['统计周期', `${startDate} ~ ${endDate}`, ''], [`GPU 卡时`, +u.gpu_hours.toFixed(2), 'h'], ['CPU 核时', +u.cpu_hours.toFixed(2), 'h'], ['计费核时', +u.billing_hours.toFixed(2), 'h'], ['配额总量', u.quota_billing_hours === 0 ? '无限制' : +u.quota_billing_hours.toFixed(2), u.quota_billing_hours === 0 ? '' : 'h'], ['使用率', +u.usage_percent.toFixed(2), '%'], ['状态', rStatusLabel(u.status), '']]);
            ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 8 }];
            XLSX.utils.book_append_sheet(wb, ws, '核时使用');
        }
        if (rStorageStats.value?.length) {
            const ws = XLSX.utils.aoa_to_sheet([['用户名', '文件系统', '已用量(GB)', '软限制(GB)', '硬限制(GB)', '使用率(%)', '超软限制'], ...rStorageStats.value.map(r => [r.username, r.filesystem, +r.used_gb.toFixed(2), +r.soft_limit_gb.toFixed(2), +r.hard_limit_gb.toFixed(2), +r.usage_percent.toFixed(2), r.over_soft_limit ? '是' : '否'])]);
            ws['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }];
            XLSX.utils.book_append_sheet(wb, ws, '存储用量');
        }
        if (rQuotaStats.value?.account) {
            const q = rQuotaStats.value;
            const ws = XLSX.utils.aoa_to_sheet([['指标', '数值', '单位'], ['统计周期', `${startDate} ~ ${endDate}`, ''], [`账户`, q.account, ''], ['配额总量', +q.total_billing_hours.toFixed(2), 'h'], ['已用量', +q.used_billing_hours.toFixed(2), 'h'], ['剩余量', +q.remaining_billing_hours.toFixed(2), 'h'], ['使用率', +q.usage_percent.toFixed(2), '%'], ['状态', rStatusLabel(q.status), '']]);
            ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 8 }];
            XLSX.utils.book_append_sheet(wb, ws, '配额情况');
        }
        if (wb.SheetNames.length === 0)
            return;
        const uLabel = username ? `_${username}` : '_全部用户';
        XLSX.writeFile(wb, `用量报表${uLabel}_${startDate}_${endDate}.xlsx`);
    });
}
onMounted(() => {
    handleTimeRangeChange();
    loadReportPartitions();
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['tab-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-input']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-input']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-select']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-select']} */ ;
/** @type {__VLS_StyleScopedClasses['logs-table']} */ ;
/** @type {__VLS_StyleScopedClasses['logs-table']} */ ;
/** @type {__VLS_StyleScopedClasses['logs-table']} */ ;
/** @type {__VLS_StyleScopedClasses['logs-table']} */ ;
/** @type {__VLS_StyleScopedClasses['resource-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-row']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-row']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-row']} */ ;
/** @type {__VLS_StyleScopedClasses['filters-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-input']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-row']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-item']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-input-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['rchart-row']} */ ;
/** @type {__VLS_StyleScopedClasses['rcard']} */ ;
/** @type {__VLS_StyleScopedClasses['rchart-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "audit-logs" },
});
/** @type {__VLS_StyleScopedClasses['audit-logs']} */ ;
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
    ...{ onClick: (__VLS_ctx.loadStats) },
    ...{ class: "btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.exportLogs) },
    ...{ class: "btn-primary" },
});
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "tab-bar" },
});
/** @type {__VLS_StyleScopedClasses['tab-bar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.activeTab = 'audit';
            // @ts-ignore
            [loadStats, exportLogs, activeTab,];
        } },
    ...{ class: (['tab-btn', { active: __VLS_ctx.activeTab === 'audit' }]) },
});
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-btn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.activeTab = 'ssh';
            __VLS_ctx.loadSSHLogs();
            // @ts-ignore
            [activeTab, activeTab, loadSSHLogs,];
        } },
    ...{ class: (['tab-btn', { active: __VLS_ctx.activeTab === 'ssh' }]) },
});
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-btn']} */ ;
if (__VLS_ctx.activeTab === 'audit') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    if (__VLS_ctx.showStats) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "stats-section" },
        });
        /** @type {__VLS_StyleScopedClasses['stats-section']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "stats-cards" },
        });
        /** @type {__VLS_StyleScopedClasses['stats-cards']} */ ;
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
            ...{ class: "stat-value" },
        });
        /** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
        (__VLS_ctx.stats.total_logs || 0);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "stat-label" },
        });
        /** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
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
            ...{ class: "stat-value" },
        });
        /** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
        (__VLS_ctx.stats.by_status?.success || 0);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "stat-label" },
        });
        /** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
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
            ...{ class: "stat-value" },
        });
        /** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
        (__VLS_ctx.stats.by_status?.failed || 0);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "stat-label" },
        });
        /** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
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
            ...{ class: "stat-value" },
        });
        /** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
        (Object.keys(__VLS_ctx.stats.by_user || {}).length);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "stat-label" },
        });
        /** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "filters-section" },
    });
    /** @type {__VLS_StyleScopedClasses['filters-section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "filters-bar" },
    });
    /** @type {__VLS_StyleScopedClasses['filters-bar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onInput: (__VLS_ctx.debouncedLoad) },
        placeholder: "🔍 用户名...",
        ...{ class: "filter-input" },
    });
    (__VLS_ctx.filters.username);
    /** @type {__VLS_StyleScopedClasses['filter-input']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: (__VLS_ctx.loadLogs) },
        value: (__VLS_ctx.filters.action),
        ...{ class: "filter-select" },
    });
    /** @type {__VLS_StyleScopedClasses['filter-select']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "page_view",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "shell_command",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "shell_blocked",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "create",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "update",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "delete",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "read",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "login",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "logout",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: (__VLS_ctx.loadLogs) },
        value: (__VLS_ctx.filters.resource),
        ...{ class: "filter-select" },
    });
    /** @type {__VLS_StyleScopedClasses['filter-select']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "user",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "group",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "account",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "association",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "qos",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "job",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: (__VLS_ctx.loadLogs) },
        value: (__VLS_ctx.filters.status),
        ...{ class: "filter-select" },
    });
    /** @type {__VLS_StyleScopedClasses['filter-select']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "success",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "failed",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: (__VLS_ctx.handleTimeRangeChange) },
        value: (__VLS_ctx.filters.timeRange),
        ...{ class: "filter-select" },
    });
    /** @type {__VLS_StyleScopedClasses['filter-select']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "1h",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "24h",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "7d",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "30d",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.resetFilters) },
        ...{ class: "btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
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
            ...{ class: "logs-section" },
        });
        /** @type {__VLS_StyleScopedClasses['logs-section']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "logs-table-container" },
        });
        /** @type {__VLS_StyleScopedClasses['logs-table-container']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
            ...{ class: "logs-table" },
        });
        /** @type {__VLS_StyleScopedClasses['logs-table']} */ ;
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
        for (const [log] of __VLS_vFor((__VLS_ctx.logs))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                key: (log.id),
                ...{ class: ({ 'failed-row': log.status === 'failed' }) },
            });
            /** @type {__VLS_StyleScopedClasses['failed-row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "time-cell" },
            });
            /** @type {__VLS_StyleScopedClasses['time-cell']} */ ;
            (__VLS_ctx.formatTime(log.timestamp));
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "user-cell" },
            });
            /** @type {__VLS_StyleScopedClasses['user-cell']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "username" },
            });
            /** @type {__VLS_StyleScopedClasses['username']} */ ;
            (log.username);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "user-role" },
                ...{ class: ('role-' + log.user_role) },
            });
            /** @type {__VLS_StyleScopedClasses['user-role']} */ ;
            (log.user_role);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "action-badge" },
                ...{ class: ('action-' + log.action) },
            });
            /** @type {__VLS_StyleScopedClasses['action-badge']} */ ;
            (__VLS_ctx.getActionLabel(log.action));
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "resource-badge" },
            });
            /** @type {__VLS_StyleScopedClasses['resource-badge']} */ ;
            (__VLS_ctx.getResourceLabel(log.resource));
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "resource-id" },
            });
            /** @type {__VLS_StyleScopedClasses['resource-id']} */ ;
            (log.resource_id || '-');
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "status-badge" },
                ...{ class: ('status-' + log.status) },
            });
            /** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
            (log.status === 'success' ? '✅ 成功' : '❌ 失败');
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "ip-cell" },
            });
            /** @type {__VLS_StyleScopedClasses['ip-cell']} */ ;
            (log.ip_address);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "host-cell" },
            });
            /** @type {__VLS_StyleScopedClasses['host-cell']} */ ;
            (log.access_host || '-');
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "duration-cell" },
            });
            /** @type {__VLS_StyleScopedClasses['duration-cell']} */ ;
            (log.duration);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.activeTab === 'audit'))
                            return;
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.error))
                            return;
                        __VLS_ctx.viewDetails(log);
                        // @ts-ignore
                        [activeTab, activeTab, showStats, stats, stats, stats, stats, debouncedLoad, filters, filters, filters, filters, filters, loadLogs, loadLogs, loadLogs, handleTimeRangeChange, resetFilters, loading, error, error, logs, formatTime, getActionLabel, getResourceLabel, viewDetails,];
                    } },
                ...{ class: "btn-link" },
            });
            /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
            // @ts-ignore
            [];
        }
        if (__VLS_ctx.logs.length === 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "empty-state" },
            });
            /** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pagination" },
        });
        /** @type {__VLS_StyleScopedClasses['pagination']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "total-count" },
        });
        /** @type {__VLS_StyleScopedClasses['total-count']} */ ;
        (__VLS_ctx.logs.length);
    }
}
if (__VLS_ctx.activeTab === 'ssh') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ssh-logs-panel" },
    });
    /** @type {__VLS_StyleScopedClasses['ssh-logs-panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "filters-bar" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['filters-bar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onInput: (__VLS_ctx.loadSSHLogs) },
        placeholder: "🔍 用户名...",
        ...{ class: "filter-input" },
    });
    (__VLS_ctx.sshFilter.username);
    /** @type {__VLS_StyleScopedClasses['filter-input']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: (__VLS_ctx.loadSSHLogs) },
        type: "date",
        ...{ class: "filter-input" },
    });
    (__VLS_ctx.sshFilter.date);
    /** @type {__VLS_StyleScopedClasses['filter-input']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeTab === 'ssh'))
                    return;
                __VLS_ctx.sshFilter.username = '';
                __VLS_ctx.sshFilter.date = '';
                __VLS_ctx.loadSSHLogs();
                // @ts-ignore
                [activeTab, loadSSHLogs, loadSSHLogs, loadSSHLogs, logs, logs, sshFilter, sshFilter, sshFilter, sshFilter,];
            } },
        ...{ class: "btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    if (__VLS_ctx.sshLoading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "loading" },
        });
        /** @type {__VLS_StyleScopedClasses['loading']} */ ;
    }
    else if (__VLS_ctx.sshLogs.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "empty-state" },
        });
        /** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "logs-table-container" },
        });
        /** @type {__VLS_StyleScopedClasses['logs-table-container']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
            ...{ class: "logs-table" },
        });
        /** @type {__VLS_StyleScopedClasses['logs-table']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
        for (const [item] of __VLS_vFor((__VLS_ctx.sshLogs))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                key: (item.path),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            (item.username);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ style: {} },
            });
            (item.file);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            (__VLS_ctx.formatSize(item.size));
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            (item.mod_time);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.activeTab === 'ssh'))
                            return;
                        if (!!(__VLS_ctx.sshLoading))
                            return;
                        if (!!(__VLS_ctx.sshLogs.length === 0))
                            return;
                        __VLS_ctx.viewSSHLog(item);
                        // @ts-ignore
                        [sshLoading, sshLogs, sshLogs, formatSize, viewSSHLog,];
                    } },
                ...{ class: "btn-link" },
            });
            /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
                href: (`/api/audit/ssh-logs/download?username=${item.username}&file=${item.file}`),
                ...{ class: "btn-link" },
                ...{ style: {} },
            });
            /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
            // @ts-ignore
            [];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pagination" },
        });
        /** @type {__VLS_StyleScopedClasses['pagination']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "total-count" },
        });
        /** @type {__VLS_StyleScopedClasses['total-count']} */ ;
        (__VLS_ctx.sshLogs.length);
    }
}
if (__VLS_ctx.activeTab === 'report') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "report-panel" },
    });
    /** @type {__VLS_StyleScopedClasses['report-panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "report-filter-bar" },
    });
    /** @type {__VLS_StyleScopedClasses['report-filter-bar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "filter-item" },
    });
    /** @type {__VLS_StyleScopedClasses['filter-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "留空查全部",
        ...{ class: "filter-input-sm" },
    });
    (__VLS_ctx.reportFilters.username);
    /** @type {__VLS_StyleScopedClasses['filter-input-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "filter-item" },
    });
    /** @type {__VLS_StyleScopedClasses['filter-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "date",
        max: (__VLS_ctx.reportFilters.endDate),
        ...{ class: "filter-input-sm" },
    });
    (__VLS_ctx.reportFilters.startDate);
    /** @type {__VLS_StyleScopedClasses['filter-input-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "filter-item" },
    });
    /** @type {__VLS_StyleScopedClasses['filter-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "date",
        min: (__VLS_ctx.reportFilters.startDate),
        ...{ class: "filter-input-sm" },
    });
    (__VLS_ctx.reportFilters.endDate);
    /** @type {__VLS_StyleScopedClasses['filter-input-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "filter-item" },
    });
    /** @type {__VLS_StyleScopedClasses['filter-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.reportFilters.partition),
        ...{ class: "filter-input-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['filter-input-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    for (const [p] of __VLS_vFor((__VLS_ctx.reportPartitions))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (p),
            value: (p),
        });
        (p);
        // @ts-ignore
        [activeTab, sshLogs, reportFilters, reportFilters, reportFilters, reportFilters, reportFilters, reportFilters, reportPartitions,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.loadAdminReport) },
        ...{ class: "btn-primary" },
        disabled: (__VLS_ctx.reportLoading),
    });
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    (__VLS_ctx.reportLoading ? '查询中...' : '🔍 查询');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.exportAdminExcel) },
        ...{ class: "btn-secondary" },
        disabled: (!__VLS_ctx.reportHasData),
    });
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    if (__VLS_ctx.reportLoading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "report-state" },
        });
        /** @type {__VLS_StyleScopedClasses['report-state']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "spinner" },
        });
        /** @type {__VLS_StyleScopedClasses['spinner']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    }
    else if (__VLS_ctx.reportError) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "report-state" },
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['report-state']} */ ;
        (__VLS_ctx.reportError);
    }
    else if (__VLS_ctx.reportHasData) {
        if (__VLS_ctx.rJobStats?.monthly_job_counts.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rcard" },
            });
            /** @type {__VLS_StyleScopedClasses['rcard']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rcard-title" },
            });
            /** @type {__VLS_StyleScopedClasses['rcard-title']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ref: "rLineRef",
                ...{ style: {} },
            });
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rchart-row" },
        });
        /** @type {__VLS_StyleScopedClasses['rchart-row']} */ ;
        if (__VLS_ctx.rJobStats?.job_scale_distribution.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rcard" },
            });
            /** @type {__VLS_StyleScopedClasses['rcard']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rcard-title" },
            });
            /** @type {__VLS_StyleScopedClasses['rcard-title']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ref: "rScaleRef",
                ...{ style: {} },
            });
        }
        if (__VLS_ctx.rUsageStats) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rcard" },
            });
            /** @type {__VLS_StyleScopedClasses['rcard']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rcard-title" },
            });
            /** @type {__VLS_StyleScopedClasses['rcard-title']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ref: "rUsageRef",
                ...{ style: {} },
            });
        }
        if (__VLS_ctx.rStorageStats?.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rcard" },
            });
            /** @type {__VLS_StyleScopedClasses['rcard']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rcard-title" },
            });
            /** @type {__VLS_StyleScopedClasses['rcard-title']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ref: "rStorageRef",
                ...{ style: ({ width: '100%', height: Math.max(300, __VLS_ctx.rStorageStats.length * 70) + 'px', position: 'relative' }) },
            });
        }
        if (__VLS_ctx.rQosStats?.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rcard" },
            });
            /** @type {__VLS_StyleScopedClasses['rcard']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rcard-title" },
            });
            /** @type {__VLS_StyleScopedClasses['rcard-title']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ref: "rQosRef",
                ...{ style: ({ width: '100%', height: Math.max(280, __VLS_ctx.rQosStats.length * 60) + 'px', position: 'relative' }) },
            });
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rchart-row" },
        });
        /** @type {__VLS_StyleScopedClasses['rchart-row']} */ ;
        if (__VLS_ctx.rUsageStats) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rcard" },
            });
            /** @type {__VLS_StyleScopedClasses['rcard']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rcard-title" },
            });
            /** @type {__VLS_StyleScopedClasses['rcard-title']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ref: "rBillingRef",
                ...{ style: {} },
            });
        }
        if (__VLS_ctx.rQuotaStats?.account) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rcard" },
            });
            /** @type {__VLS_StyleScopedClasses['rcard']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rcard-title" },
            });
            /** @type {__VLS_StyleScopedClasses['rcard-title']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "account-tag" },
            });
            /** @type {__VLS_StyleScopedClasses['account-tag']} */ ;
            (__VLS_ctx.rQuotaStats.account);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ref: "rQuotaRef",
                ...{ style: {} },
            });
        }
    }
    else if (!__VLS_ctx.reportLoading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "report-state" },
        });
        /** @type {__VLS_StyleScopedClasses['report-state']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ style: {} },
        });
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
if (__VLS_ctx.showSSHLogModal) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal modal-large" },
    });
    /** @type {__VLS_StyleScopedClasses['modal']} */ ;
    /** @type {__VLS_StyleScopedClasses['modal-large']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    (__VLS_ctx.sshLogFile?.file);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showSSHLogModal))
                    return;
                __VLS_ctx.showSSHLogModal = false;
                // @ts-ignore
                [loadAdminReport, reportLoading, reportLoading, reportLoading, reportLoading, exportAdminExcel, reportHasData, reportHasData, reportError, reportError, rJobStats, rJobStats, rUsageStats, rUsageStats, rStorageStats, rStorageStats, rQosStats, rQosStats, rQuotaStats, rQuotaStats, showSSHLogModal, showSSHLogModal, sshLogFile,];
            } },
        ...{ class: "btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
        ...{ class: "ssh-log-content" },
    });
    /** @type {__VLS_StyleScopedClasses['ssh-log-content']} */ ;
    (__VLS_ctx.sshLogContent);
}
if (__VLS_ctx.showDetailsDialog) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal modal-large" },
    });
    /** @type {__VLS_StyleScopedClasses['modal']} */ ;
    /** @type {__VLS_StyleScopedClasses['modal-large']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeDetails) },
        ...{ class: "btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    if (__VLS_ctx.selectedLog) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "details-content" },
        });
        /** @type {__VLS_StyleScopedClasses['details-content']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "detail-row" },
        });
        /** @type {__VLS_StyleScopedClasses['detail-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.selectedLog.id);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "detail-row" },
        });
        /** @type {__VLS_StyleScopedClasses['detail-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.formatFullTime(__VLS_ctx.selectedLog.timestamp));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "detail-row" },
        });
        /** @type {__VLS_StyleScopedClasses['detail-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.selectedLog.username);
        (__VLS_ctx.selectedLog.user_role);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "detail-row" },
        });
        /** @type {__VLS_StyleScopedClasses['detail-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "action-badge" },
            ...{ class: ('action-' + __VLS_ctx.selectedLog.action) },
        });
        /** @type {__VLS_StyleScopedClasses['action-badge']} */ ;
        (__VLS_ctx.getActionLabel(__VLS_ctx.selectedLog.action));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "detail-row" },
        });
        /** @type {__VLS_StyleScopedClasses['detail-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "resource-badge" },
        });
        /** @type {__VLS_StyleScopedClasses['resource-badge']} */ ;
        (__VLS_ctx.getResourceLabel(__VLS_ctx.selectedLog.resource));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "detail-row" },
        });
        /** @type {__VLS_StyleScopedClasses['detail-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.selectedLog.resource_id || '-');
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "detail-row" },
        });
        /** @type {__VLS_StyleScopedClasses['detail-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "status-badge" },
            ...{ class: ('status-' + __VLS_ctx.selectedLog.status) },
        });
        /** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
        (__VLS_ctx.selectedLog.status === 'success' ? '✅ 成功' : '❌ 失败');
        if (__VLS_ctx.selectedLog.error_msg) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "detail-row" },
            });
            /** @type {__VLS_StyleScopedClasses['detail-row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "error-text" },
            });
            /** @type {__VLS_StyleScopedClasses['error-text']} */ ;
            (__VLS_ctx.selectedLog.error_msg);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "detail-row" },
        });
        /** @type {__VLS_StyleScopedClasses['detail-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.selectedLog.ip_address);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "detail-row" },
        });
        /** @type {__VLS_StyleScopedClasses['detail-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "host-text" },
        });
        /** @type {__VLS_StyleScopedClasses['host-text']} */ ;
        (__VLS_ctx.selectedLog.access_host || '-');
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "detail-row" },
        });
        /** @type {__VLS_StyleScopedClasses['detail-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "user-agent" },
        });
        /** @type {__VLS_StyleScopedClasses['user-agent']} */ ;
        (__VLS_ctx.selectedLog.user_agent);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "detail-row" },
        });
        /** @type {__VLS_StyleScopedClasses['detail-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.selectedLog.duration);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "detail-row full-width" },
        });
        /** @type {__VLS_StyleScopedClasses['detail-row']} */ ;
        /** @type {__VLS_StyleScopedClasses['full-width']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
            ...{ class: "details-pre" },
        });
        /** @type {__VLS_StyleScopedClasses['details-pre']} */ ;
        (__VLS_ctx.selectedLog.details);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-footer" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-footer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeDetails) },
        ...{ class: "btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
}
// @ts-ignore
[getActionLabel, getResourceLabel, sshLogContent, showDetailsDialog, closeDetails, closeDetails, selectedLog, selectedLog, selectedLog, selectedLog, selectedLog, selectedLog, selectedLog, selectedLog, selectedLog, selectedLog, selectedLog, selectedLog, selectedLog, selectedLog, selectedLog, selectedLog, selectedLog, selectedLog, formatFullTime,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
