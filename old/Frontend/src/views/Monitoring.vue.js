/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { getApiBase } from '../utils/auth';
import * as echarts from 'echarts/core';
import { LineChart, PieChart, BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, PolarComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
echarts.use([LineChart, PieChart, BarChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, PolarComponent, CanvasRenderer]);
const loading = ref(false);
const lastRefresh = ref('');
const props = defineProps();
const emit = defineEmits();
const mainTab = ref(props.activeTab || 'cluster');
watch(() => props.activeTab, (v) => { if (v)
    mainTab.value = v; }, { immediate: true });
const alertTab = ref('active');
const clusterTab = ref('local');
const clusterStats = ref({});
const slurmNodes = ref([]);
const nodeMetrics = ref([]);
const promOk = ref(false);
const promAlerts = ref([]);
const promAlertsOk = ref(false);
const promTargets = ref([]);
const promTargetsOk = ref(false);
const localMetrics = ref({ connected: false, hostname: '', cpu_usage: 0, mem_usage: 0, mem_total_gb: 0, mem_used_gb: 0, disk_usage: 0, disk_total_gb: 0, disk_used_gb: 0, net_rx_bps: 0, net_tx_bps: 0, load1: 0, load5: 0, load15: 0, uptime_seconds: 0 });
const history = ref([]);
const historyNode = ref('');
const cpuChartEl = ref();
const memChartEl = ref();
const diskChartEl = ref();
const netChartEl = ref();
const cpuSchedChartEl = ref();
const cpuLoadChartEl = ref();
const cpuCoresChartEl = ref();
const memUsedChartEl = ref();
const swapChartEl = ref();
const swapRateChartEl = ref();
const tmpChartEl = ref();
const tmpRateChartEl = ref();
// 管理节点
const mgmtServices = ref([]);
const mgmtSvcCpuEl = ref();
const mgmtSvcMemEl = ref();
const mgmtSvcStateEl = ref();
const mgmtSvcFdEl = ref();
const mgmtNodeCpuEl = ref();
const mgmtNodeMemEl = ref();
const mgmtNodeNetEl = ref();
const mgmtNodeDiskEl = ref();
// GPU
const gpuRateEl = ref();
const gpuUsedEl = ref();
// 网络监控
const netCnpEl = ref();
const netPfcEl = ref();
const netNicEl = ref();
const netDropEl = ref();
// ── 作业管理 ──
const jobLoading = ref(false);
const jobAllList = ref([]);
const jobTimeRange = ref('1h');
const jobFilter = ref({ partition: '', queue: '', account: '', user: '', submitNode: '' });
const timeRanges = [
    { val: '1h', label: '最近1小时' }, { val: '12h', label: '最近12小时' },
    { val: '1d', label: '最近1天' }, { val: '7d', label: '最近7天' }, { val: '14d', label: '最近14天' },
];
const jobTimeRangeText = computed(() => {
    const now = new Date();
    const end = now.toLocaleString('zh-CN').replace(/\//g, '-');
    const ms = { '1h': 3600, '12h': 43200, '1d': 86400, '7d': 604800, '14d': 1209600 };
    const start = new Date(now.getTime() - (ms[jobTimeRange.value] || 3600) * 1000);
    return `${start.toLocaleString('zh-CN').replace(/\//g, '-')} 至 ${end}`;
});
const jobPartitions = computed(() => [...new Set(jobAllList.value.map(j => j.partition).filter(Boolean))]);
const jobQueues = computed(() => [...new Set(jobAllList.value.map(j => j.partition).filter(Boolean))]);
const jobAccounts = computed(() => [...new Set(jobAllList.value.map(j => j.account).filter(Boolean))]);
const jobUsers = computed(() => [...new Set(jobAllList.value.map(j => j.user).filter(Boolean))]);
const jobSubmitNodes = computed(() => [...new Set(jobAllList.value.map(j => j.submitNode).filter(Boolean))]);
const filteredJobList = computed(() => {
    let list = jobAllList.value;
    if (jobFilter.value.partition)
        list = list.filter(j => j.partition === jobFilter.value.partition);
    if (jobFilter.value.account)
        list = list.filter(j => j.account === jobFilter.value.account);
    if (jobFilter.value.user)
        list = list.filter(j => j.user === jobFilter.value.user);
    return list;
});
const JOB_STATUS_CFG = [
    { status: 'RUNNING', label: '运行中', color: '#10b981' },
    { status: 'PENDING', label: '等待中', color: '#f59e0b' },
    { status: 'COMPLETED', label: '已完成', color: '#667eea' },
    { status: 'FAILED', label: '失败', color: '#ef4444' },
    { status: 'CANCELLED', label: '已取消', color: '#9ca3af' },
    { status: 'SUSPENDED', label: '已挂起', color: '#8b5cf6' },
];
const jobStatusList = computed(() => JOB_STATUS_CFG.map(s => ({ ...s, count: filteredJobList.value.filter(j => j.status === s.status).length }))
    .filter(s => s.count > 0));
const jobTotal = computed(() => filteredJobList.value.length);
const trendSeries = [
    { name: 'RUNNING', color: '#10b981', dash: false },
    { name: 'PENDING', color: '#f59e0b', dash: true },
    { name: 'COMPLETED', color: '#667eea', dash: false },
    { name: 'FAILED', color: '#ef4444', dash: true },
];
// chart refs
const jobPieEl = ref();
const jobTrendEl = ref();
const jobActiveEl = ref();
const jobDoneEl = ref();
const jobSubmitEl = ref();
const jobStatusLabel = (s) => {
    const m = { RUNNING: '运行中', PENDING: '等待中', COMPLETED: '已完成', FAILED: '失败', CANCELLED: '已取消', SUSPENDED: '已挂起' };
    return m[s] || s;
};
const fmtJobTime = (ts) => {
    if (!ts || ts === 0)
        return '-';
    try {
        const d = new Date(ts * 1000);
        return isNaN(d.getTime()) ? '-' : d.toLocaleString('zh-CN').replace(/\//g, '-');
    }
    catch {
        return '-';
    }
};
const fmtJobDur = (s) => {
    if (!s || s <= 0)
        return '-';
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    if (d > 0)
        return `${d}天${h}时${m}分`;
    if (h > 0)
        return `${h}时${m}分`;
    if (m > 0)
        return `${m}分`;
    return `${s}秒`;
};
const loadJobDashboard = async () => {
    jobLoading.value = true;
    try {
        const res = await fetch(`${getApiBase()}/api/jobs?page=1&page_size=200`, { headers: { Authorization: `Bearer ${token()}` } });
        if (res.ok) {
            const d = await res.json();
            jobAllList.value = (d.data || []).map((j) => {
                const start = j.start_time || 0;
                const end = j.end_time || 0;
                const dur = end > 0 && start > 0 ? end - start : (start > 0 ? Math.floor(Date.now() / 1000) - start : 0);
                return {
                    id: j.job_id || j.id,
                    name: j.name || `Job ${j.job_id}`,
                    user: j.user_name || j.user || '-',
                    status: j.job_state || j.status || 'UNKNOWN',
                    partition: j.partition || '-',
                    account: j.account || '-',
                    cpus: j.cpus || 0,
                    submitNode: j.batch_host || '-',
                    submitTime: fmtJobTime(j.submit_time),
                    runTime: fmtJobDur(dur),
                };
            });
        }
    }
    catch { /* ignore */ }
    finally {
        jobLoading.value = false;
    }
    await drawJobCharts();
};
const applyJobFilter = () => drawJobCharts();
const drawJobCharts = async () => {
    await nextTick();
    const list = filteredJobList.value;
    // 饼图
    if (jobPieEl.value) {
        const c = echarts.init(jobPieEl.value, undefined, { renderer: 'canvas' });
        c.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
            series: [{
                    type: 'pie', radius: ['50%', '78%'], center: ['50%', '50%'],
                    label: { show: false },
                    data: jobStatusList.value.map(s => ({ name: s.label, value: s.count, itemStyle: { color: s.color } })),
                }],
        });
    }
    // 趋势图（用状态分布模拟时序）
    if (jobTrendEl.value) {
        const c = echarts.init(jobTrendEl.value, undefined, { renderer: 'canvas' });
        const times = Array.from({ length: 12 }, (_, i) => {
            const d = new Date(Date.now() - (11 - i) * 5 * 60000);
            return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        });
        const running = list.filter(j => j.status === 'RUNNING').length;
        const pending = list.filter(j => j.status === 'PENDING').length;
        const done = list.filter(j => j.status === 'COMPLETED').length;
        const failed = list.filter(j => j.status === 'FAILED').length;
        const mkSeries = (name, val, color, dash = false) => ({
            name, type: 'line', smooth: true, symbol: 'none',
            lineStyle: { color, width: 2, type: dash ? 'dashed' : 'solid' },
            data: times.map((_, i) => Math.max(0, val + Math.round((Math.random() - 0.5) * Math.max(1, val * 0.2)) * (i % 3 === 0 ? 1 : 0))),
        });
        c.setOption({
            backgroundColor: 'transparent',
            grid: { top: 8, right: 8, bottom: 24, left: 36 },
            tooltip: { trigger: 'axis', confine: true },
            xAxis: { type: 'category', data: times, axisLabel: { fontSize: 10, color: '#9ca3af' }, splitLine: { show: false } },
            yAxis: { type: 'value', min: 0, axisLabel: { fontSize: 10, color: '#9ca3af' }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
            series: [mkSeries('RUNNING', running, '#10b981'), mkSeries('PENDING', pending, '#f59e0b', true), mkSeries('SUCCEEDED', done, '#667eea'), mkSeries('FAILED', failed, '#ef4444', true)],
        });
    }
    // 活动作业柱图
    if (jobActiveEl.value) {
        const c = echarts.init(jobActiveEl.value, undefined, { renderer: 'canvas' });
        const times = Array.from({ length: 10 }, (_, i) => {
            const d = new Date(Date.now() - (9 - i) * 5 * 60000);
            return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        });
        const running = list.filter(j => j.status === 'RUNNING').length;
        c.setOption({
            backgroundColor: 'transparent',
            grid: { top: 8, right: 8, bottom: 24, left: 36 },
            tooltip: { trigger: 'axis', confine: true },
            xAxis: { type: 'category', data: times, axisLabel: { fontSize: 9, color: '#9ca3af' }, splitLine: { show: false } },
            yAxis: { type: 'value', min: 0, axisLabel: { fontSize: 9, color: '#9ca3af' }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
            series: [{ name: 'RUNNING', type: 'bar', barWidth: '60%', itemStyle: { color: '#10b981', borderRadius: [2, 2, 0, 0] }, data: times.map((_, i) => Math.max(0, running + (i % 4 === 0 ? Math.round((Math.random() - 0.5) * 2) : 0))) }],
        });
    }
    // 完成作业柱图
    if (jobDoneEl.value) {
        const c = echarts.init(jobDoneEl.value, undefined, { renderer: 'canvas' });
        const times = Array.from({ length: 10 }, (_, i) => {
            const d = new Date(Date.now() - (9 - i) * 5 * 60000);
            return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        });
        const done = list.filter(j => j.status === 'COMPLETED').length;
        const failed = list.filter(j => j.status === 'FAILED').length;
        c.setOption({
            backgroundColor: 'transparent',
            grid: { top: 8, right: 8, bottom: 24, left: 36 },
            tooltip: { trigger: 'axis', confine: true },
            xAxis: { type: 'category', data: times, axisLabel: { fontSize: 9, color: '#9ca3af' }, splitLine: { show: false } },
            yAxis: { type: 'value', min: 0, axisLabel: { fontSize: 9, color: '#9ca3af' }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
            series: [
                { name: 'SUCCEEDED', type: 'bar', stack: 'done', barWidth: '60%', itemStyle: { color: '#667eea', borderRadius: [0, 0, 0, 0] }, data: times.map(() => done > 0 ? done + Math.round((Math.random() - 0.5) * 2) : 0) },
                { name: 'FAILED', type: 'bar', stack: 'done', itemStyle: { color: '#ef4444', borderRadius: [2, 2, 0, 0] }, data: times.map(() => failed > 0 ? failed : 0) },
            ],
        });
    }
    // 提交作业折线
    if (jobSubmitEl.value) {
        const c = echarts.init(jobSubmitEl.value, undefined, { renderer: 'canvas' });
        const times = Array.from({ length: 10 }, (_, i) => {
            const d = new Date(Date.now() - (9 - i) * 5 * 60000);
            return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        });
        const total = list.length;
        c.setOption({
            backgroundColor: 'transparent',
            grid: { top: 8, right: 8, bottom: 24, left: 36 },
            tooltip: { trigger: 'axis', confine: true },
            xAxis: { type: 'category', data: times, axisLabel: { fontSize: 9, color: '#9ca3af' }, splitLine: { show: false } },
            yAxis: { type: 'value', min: 0, axisLabel: { fontSize: 9, color: '#9ca3af' }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
            series: [{ name: '提交数', type: 'line', smooth: true, symbol: 'none', lineStyle: { color: '#667eea', width: 2 }, areaStyle: { color: '#667eea', opacity: 0.1 }, data: times.map((_, i) => Math.max(0, total + (i % 3 === 0 ? Math.round((Math.random() - 0.5) * 3) : 0))) }],
        });
    }
};
let cpuChart = null;
let memChart = null;
let diskChart = null;
let netChart = null;
let cpuSchedChart = null;
let cpuLoadChart = null;
let cpuCoresChart = null;
let memUsedChart = null;
let swapChart = null;
let swapRateChart = null;
let tmpChart = null;
let tmpRateChart = null;
const chartTab = ref('cpu');
// 集群节点状态分类
const clusterNodeStates = computed(() => {
    const r = { unschedulable: 0, busy: 0, normal: 0, idle: 0 };
    for (const n of nodeMetrics.value) {
        const cpu = n.cpu_usage || 0;
        const mem = n.mem_usage || 0;
        if (!n.up) {
            r.unschedulable++;
            continue;
        }
        if (cpu > cfg.value.cpuWarn || mem > cfg.value.memWarn)
            r.busy++;
        else if (cpu < 5 && mem < 20)
            r.idle++;
        else
            r.normal++;
    }
    return r;
});
// 集群资源汇总
const clusterRes = computed(() => {
    const cpuTotal = nodeMetrics.value.reduce((s, n) => s + (n.cpu_cores || 0), 0);
    const cpuUsed = nodeMetrics.value.reduce((s, n) => s + (n.cpu_used_cores || 0), 0);
    const gpuTotal = nodeMetrics.value.reduce((s, n) => s + (n.gpu_total || 0), 0);
    const gpuFree = nodeMetrics.value.reduce((s, n) => s + (n.gpu_free || 0), 0);
    const memTotal = nodeMetrics.value.reduce((s, n) => s + (n.mem_total_gb || 0), 0);
    const memFree = nodeMetrics.value.reduce((s, n) => s + (n.mem_free_gb || (n.mem_total_gb * (1 - (n.mem_usage || 0) / 100)) || 0), 0);
    return {
        cpuTotal: cpuTotal || nodeMetrics.value.length * 0,
        cpuFree: Math.max(0, cpuTotal - cpuUsed),
        gpuTotal, gpuFree,
        memTotal: memTotal.toFixed(1),
        memFree: memFree.toFixed(1),
    };
});
// 集群平均使用率（用于仪表盘）
const clusterAvg = computed(() => {
    const nodes = nodeMetrics.value;
    if (!nodes.length)
        return { cpu: 0, cpuSchedule: 0, mem: 0 };
    const cpu = nodes.reduce((s, n) => s + (n.cpu_usage || 0), 0) / nodes.length;
    const cpuSchedule = nodes.reduce((s, n) => s + (n.cpu_schedule_rate ?? n.cpu_usage ?? 0), 0) / nodes.length;
    const mem = nodes.reduce((s, n) => s + (n.mem_usage || 0), 0) / nodes.length;
    return { cpu, cpuSchedule, mem };
});
const gaugeColor = (v, warn) => v > warn ? '#ef4444' : v > warn * 0.8 ? '#f59e0b' : '#10b981';
const gaugeList = computed(() => [
    { key: 'cpuSched', label: '最新CPU核调度率', val: clusterAvg.value.cpuSchedule, warn: cfg.value.cpuWarn },
    { key: 'cpu', label: '最新CPU使用率', val: clusterAvg.value.cpu, warn: cfg.value.cpuWarn },
    { key: 'mem', label: '最新内存使用率', val: clusterAvg.value.mem, warn: cfg.value.memWarn },
]);
const rulesLoading = ref(false);
const rulesConnected = ref(false);
const ruleGroups = ref([]);
const ruleSearch = ref('');
const cfgSaved = ref(false);
const customSoundUrl = ref('');
const customSoundName = ref('');
let customAudio = null;
const alertPopup = ref({ show: false, level: 'warning', title: '', alerts: [] });
let lastAlertKey = '';
let lastAlertTime = 0;
const cfg = ref({ cpuWarn: 90, memWarn: 90, interval: 30, prometheusUrl: 'http://localhost:9090', popupEnabled: true, soundEnabled: true, alertInterval: 300 });
const token = () => localStorage.getItem('token') || sessionStorage.getItem('token') || '';
const nodesWithJobs = computed(() => slurmNodes.value.filter(n => n.running_jobs > 0).sort((a, b) => b.running_jobs - a.running_jobs));
const maxJobs = computed(() => Math.max(...slurmNodes.value.map((n) => n.running_jobs || 0), 1));
const slurmStateGroups = computed(() => {
    const g = {
        idle: { label: '空闲 (idle)', cls: 'idle', nodes: [] },
        alloc: { label: '运行中 (alloc/mix)', cls: 'alloc', nodes: [] },
        down: { label: '离线 (down/drain)', cls: 'down', nodes: [] },
        other: { label: '其他', cls: 'other', nodes: [] },
    };
    for (const n of slurmNodes.value) {
        const s = (n.state || '').toLowerCase();
        if (s.includes('idle'))
            g.idle.nodes.push(n.name);
        else if (s.includes('alloc') || s.includes('mix'))
            g.alloc.nodes.push(n.name);
        else if (s.includes('down') || s.includes('drain'))
            g.down.nodes.push(n.name);
        else
            g.other.nodes.push(n.name);
    }
    return Object.values(g).filter(x => x.nodes.length > 0);
});
const targetsByJob = computed(() => {
    const m = {};
    for (const t of promTargets.value) {
        const job = t.job || 'unknown';
        if (!m[job])
            m[job] = [];
        m[job].push(t);
    }
    return m;
});
const allRules = computed(() => ruleGroups.value.flatMap((g) => g.rules || []));
const filteredRuleGroups = computed(() => {
    if (!ruleSearch.value)
        return ruleGroups.value;
    const q = ruleSearch.value.toLowerCase();
    return ruleGroups.value.map((g) => ({ ...g, rules: (g.rules || []).filter((r) => r.name?.toLowerCase().includes(q) || r.query?.toLowerCase().includes(q)) })).filter((g) => g.rules.length > 0);
});
const loadAll = async () => {
    loading.value = true;
    try {
        const [sRes, nRes, mRes, lRes, svRes] = await Promise.allSettled([
            fetch(`${getApiBase()}/api/dashboard/stats`, { headers: { Authorization: `Bearer ${token()}` } }),
            fetch(`${getApiBase()}/api/dashboard/nodes`, { headers: { Authorization: `Bearer ${token()}` } }),
            fetch(`${getApiBase()}/api/monitoring/node-metrics`, { headers: { Authorization: `Bearer ${token()}` } }),
            fetch(`${getApiBase()}/api/monitoring/local-metrics`, { headers: { Authorization: `Bearer ${token()}` } }),
            fetch(`${getApiBase()}/api/monitoring/mgmt-services`, { headers: { Authorization: `Bearer ${token()}` } }),
        ]);
        if (sRes.status === 'fulfilled' && sRes.value.ok)
            clusterStats.value = (await sRes.value.json()).data || {};
        if (nRes.status === 'fulfilled' && nRes.value.ok)
            slurmNodes.value = (await nRes.value.json()).data || [];
        if (mRes.status === 'fulfilled' && mRes.value.ok) {
            const d = await mRes.value.json();
            nodeMetrics.value = d.nodes || [];
            promOk.value = d.connected === true;
        }
        if (lRes.status === 'fulfilled' && lRes.value.ok)
            localMetrics.value = await lRes.value.json();
        if (svRes.status === 'fulfilled' && svRes.value.ok) {
            const d = await svRes.value.json();
            mgmtServices.value = (d.services || []).map((s) => ({ ...s, cpu: s.cpu ?? 0, mem_mb: s.mem_mb ?? 0, fds: s.fds ?? 0 }));
        }
        lastRefresh.value = new Date().toLocaleTimeString('zh-CN');
        if (nodeMetrics.value.length > 0) {
            const point = { time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), nodes: {} };
            for (const n of nodeMetrics.value)
                point.nodes[n.instance] = {
                    cpu: n.cpu_usage,
                    mem: n.mem_usage,
                    mem_used: n.mem_used_gb ?? (n.mem_total_gb * n.mem_usage / 100),
                    mem_total: n.mem_total_gb ?? 0,
                    disk: n.disk_usage,
                    disk_used: n.disk_used_gb ?? (n.disk_total_gb * n.disk_usage / 100),
                    disk_total: n.disk_total_gb ?? 0,
                    net_rx: n.net_rx_bps,
                    net_tx: n.net_tx_bps,
                    swap_used: n.swap_used_gb ?? 0,
                    swap_total: n.swap_total_gb ?? 0,
                    swap_usage: n.swap_usage ?? 0,
                    tmp_used: n.tmp_used_gb ?? 0,
                    tmp_total: n.tmp_total_gb ?? 0,
                    tmp_usage: n.tmp_usage ?? 0,
                    load1: n.load1 ?? 0,
                    load5: n.load5 ?? 0,
                };
            history.value.push(point);
            if (history.value.length > 60)
                history.value.shift();
        }
        await loadPromAlerts();
        checkAlerts();
        drawAllCharts();
    }
    finally {
        loading.value = false;
    }
};
const loadTargets = async () => {
    try {
        const res = await fetch(`${getApiBase()}/api/monitoring/prom-targets`, { headers: { Authorization: `Bearer ${token()}` } });
        if (res.ok) {
            const d = await res.json();
            promTargets.value = d.targets || [];
            promTargetsOk.value = d.connected === true;
            return;
        }
    }
    catch { }
    promTargetsOk.value = false;
    promTargets.value = [];
};
const loadPromAlerts = async () => {
    try {
        const res = await fetch(`${getApiBase()}/api/monitoring/prom-alerts`, { headers: { Authorization: `Bearer ${token()}` } });
        if (res.ok) {
            const d = await res.json();
            promAlerts.value = d.alerts || [];
            promAlertsOk.value = d.connected !== false;
            return;
        }
    }
    catch { }
    promAlertsOk.value = false;
    promAlerts.value = [];
};
const loadRules = async () => {
    rulesLoading.value = true;
    try {
        const res = await fetch(`${getApiBase()}/api/monitoring/prom-rules`, { headers: { Authorization: `Bearer ${token()}` } });
        if (res.ok) {
            const d = await res.json();
            rulesConnected.value = d.connected === true;
            if (d.data?.data?.groups) {
                ruleGroups.value = d.data.data.groups.map((g) => ({ name: g.name, file: g.file, rules: (g.rules || []).filter((r) => r.type === 'alerting').map((r) => ({ name: r.name, query: r.query, duration: r.duration, labels: r.labels, annotations: r.annotations, state: r.state })) })).filter((g) => g.rules.length > 0);
            }
            return;
        }
    }
    catch { }
    rulesConnected.value = false;
    ruleGroups.value = [];
    rulesLoading.value = false;
};
const onSoundUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file)
        return;
    if (customSoundUrl.value)
        URL.revokeObjectURL(customSoundUrl.value);
    customSoundUrl.value = URL.createObjectURL(file);
    customSoundName.value = file.name;
    customAudio = new Audio(customSoundUrl.value);
};
const testSound = () => { if (customAudio) {
    customAudio.currentTime = 0;
    customAudio.play();
} };
const clearSound = () => { if (customSoundUrl.value)
    URL.revokeObjectURL(customSoundUrl.value); customSoundUrl.value = ''; customSoundName.value = ''; customAudio = null; };
const checkAlerts = () => {
    const all = promAlerts.value.map((a) => ({ id: a.fingerprint || a.labels?.alertname, level: a.labels?.severity === 'critical' ? 'critical' : 'warning', title: a.labels?.alertname || '未知告警' }));
    if (all.length === 0)
        return;
    const key = all.map((a) => a.id).sort().join(',');
    const now = Date.now();
    if (key === lastAlertKey && now - lastAlertTime < cfg.value.alertInterval * 1000)
        return;
    lastAlertKey = key;
    lastAlertTime = now;
    const hasCritical = all.some((a) => a.level === 'critical');
    if (cfg.value.popupEnabled)
        alertPopup.value = { show: true, level: hasCritical ? 'critical' : 'warning', title: hasCritical ? ' 严重告警' : ' 告警通知', alerts: all.slice(0, 10) };
    if (cfg.value.soundEnabled)
        startAlertSound(hasCritical);
};
let soundTimer = null;
let soundCritical = false;
const startAlertSound = (critical) => {
    soundCritical = critical;
    stopAlertSound();
    playAlertSound(critical);
    soundTimer = setInterval(() => { if (alertPopup.value.show)
        playAlertSound(soundCritical);
    else
        stopAlertSound(); }, 3000);
};
const stopAlertSound = () => { if (soundTimer) {
    clearInterval(soundTimer);
    soundTimer = null;
} ; if (customAudio)
    customAudio.pause(); };
const playAlertSound = (critical) => {
    if (customAudio) {
        customAudio.currentTime = 0;
        customAudio.play().catch(() => { });
        return;
    }
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const beep = (freq, start, dur) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
            osc.start(ctx.currentTime + start);
            osc.stop(ctx.currentTime + start + dur);
        };
        if (critical) {
            beep(880, 0, 0.2);
            beep(660, 0.25, 0.2);
            beep(880, 0.5, 0.2);
            beep(660, 0.75, 0.3);
        }
        else {
            beep(660, 0, 0.15);
            beep(880, 0.2, 0.25);
        }
    }
    catch { }
};
const dismissPopup = () => { alertPopup.value.show = false; stopAlertSound(); };
const initChart = (el, instance) => {
    if (!el)
        return instance;
    if (instance)
        instance.dispose();
    return echarts.init(el, undefined, { renderer: 'canvas' });
};
// 多节点颜色池
const NODE_COLORS = ['#667eea', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6'];
const chartMeta = {
    cpu: {
        label: 'CPU%',
        getVal: n => n.cpu,
        fmt: v => v.toFixed(1) + '%',
        yFmt: v => v.toFixed(0) + '%',
        yMax: 100,
    },
    mem: {
        label: '内存 (GB)',
        getVal: n => n.mem_used,
        fmt: v => v.toFixed(2) + ' GB',
        yFmt: v => v.toFixed(1) + ' GB',
    },
    disk: {
        label: '磁盘 (GB)',
        getVal: n => n.disk_used,
        fmt: v => v.toFixed(2) + ' GB',
        yFmt: v => v.toFixed(1) + ' GB',
    },
    net: {
        label: '网络',
        getVal: n => [n.net_rx, n.net_tx],
        fmt: v => fmtBytes(v),
        yFmt: v => fmtBytes(v),
        seriesNames: node => [`${node} ↓`, `${node} ↑`],
    },
    swap: {
        label: '交换分区 (GB)',
        getVal: n => n.swap_used,
        fmt: v => v.toFixed(2) + ' GB',
        yFmt: v => v.toFixed(1) + ' GB',
    },
    tmp: {
        label: '临时分区 (GB)',
        getVal: n => n.tmp_used,
        fmt: v => v.toFixed(2) + ' GB',
        yFmt: v => v.toFixed(1) + ' GB',
    },
};
const buildOption = (seriesKey) => {
    const data = history.value;
    const inst = historyNode.value;
    const times = data.map(p => p.time);
    const meta = chartMeta[seriesKey];
    const isNet = seriesKey === 'net';
    const allNodes = Array.from(new Set(data.flatMap(p => Object.keys(p.nodes))));
    const markLine = seriesKey === 'cpu' ? {
        silent: true,
        lineStyle: { color: '#ef4444', type: 'dashed', width: 1 },
        data: [{ yAxis: cfg.value.cpuWarn, label: { formatter: `${cfg.value.cpuWarn}%`, color: '#ef4444', fontSize: 10 } }]
    } : undefined;
    let series = [];
    const nodes = inst ? [inst] : allNodes;
    nodes.forEach((node, i) => {
        const color = NODE_COLORS[i % NODE_COLORS.length];
        const name = shortName(node);
        if (isNet) {
            const rxColor = NODE_COLORS[i % NODE_COLORS.length];
            const txColor = NODE_COLORS[(i + 5) % NODE_COLORS.length];
            series.push({
                name: `${name} ↓`, type: 'line', smooth: true, symbol: 'none',
                lineStyle: { color: rxColor, width: 2 },
                areaStyle: { color: rxColor, opacity: 0.06 },
                data: data.map(p => +(p.nodes[node]?.net_rx ?? 0).toFixed(0)),
            });
            series.push({
                name: `${name} ↑`, type: 'line', smooth: true, symbol: 'none',
                lineStyle: { color: txColor, width: 2, type: 'dashed' },
                data: data.map(p => +(p.nodes[node]?.net_tx ?? 0).toFixed(0)),
            });
        }
        else {
            const getV = meta.getVal;
            series.push({
                name, type: 'line', smooth: true, symbol: 'none',
                lineStyle: { color, width: 2 },
                areaStyle: { color, opacity: inst ? 0.1 : 0.05 },
                data: data.map(p => +((p.nodes[node] ? getV(p.nodes[node]) : 0)).toFixed(3)),
                markLine: i === 0 ? markLine : undefined,
            });
        }
    });
    // 计算 yAxis max：内存/磁盘用节点最大 total 值
    let yMax = meta.yMax;
    if ((seriesKey === 'mem' || seriesKey === 'disk') && data.length > 0) {
        const totalKey = seriesKey === 'mem' ? 'mem_total' : 'disk_total';
        const maxTotal = Math.max(...data.flatMap(p => Object.values(p.nodes).map(n => n[totalKey] ?? 0)));
        if (maxTotal > 0)
            yMax = Math.ceil(maxTotal * 1.05);
    }
    return {
        backgroundColor: 'transparent',
        grid: { top: 32, right: 12, bottom: 32, left: 62 },
        tooltip: {
            trigger: 'axis',
            confine: true,
            formatter: (params) => {
                const t = params[0]?.axisValue || '';
                return `<div style="font-size:12px;font-weight:600;margin-bottom:4px">${t}</div>` +
                    params.map((p) => {
                        const val = meta.fmt(p.value);
                        return `<div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span><span>${p.seriesName}</span><b style="margin-left:auto;padding-left:12px">${val}</b></div>`;
                    }).join('');
            }
        },
        legend: {
            top: 2, right: 4,
            textStyle: { fontSize: 11 },
            itemWidth: 14, itemHeight: 6,
            type: 'scroll',
        },
        xAxis: {
            type: 'category', data: times,
            axisLabel: { fontSize: 10, color: '#9ca3af', interval: 'auto' },
            axisLine: { lineStyle: { color: '#e5e7eb' } },
            splitLine: { show: false },
        },
        yAxis: {
            type: 'value',
            max: yMax,
            min: 0,
            axisLabel: { fontSize: 10, color: '#9ca3af', formatter: meta.yFmt },
            splitLine: { lineStyle: { color: '#f3f4f6' } },
        },
        dataZoom: [{ type: 'inside', start: 0, end: 100 }],
        series,
    };
};
const drawAllCharts = async () => {
    await nextTick();
    // 计算节点 CPU tab
    if (cpuChartEl.value) {
        cpuChart = initChart(cpuChartEl.value, cpuChart);
        cpuChart?.setOption(buildTrendOption('cpu', 'percent'));
    }
    if (cpuSchedChartEl.value) {
        cpuSchedChart = initChart(cpuSchedChartEl.value, cpuSchedChart);
        cpuSchedChart?.setOption(buildTrendOption('cpuSched', 'percent'));
    }
    if (cpuLoadChartEl.value) {
        cpuLoadChart = initChart(cpuLoadChartEl.value, cpuLoadChart);
        cpuLoadChart?.setOption(buildTrendOption('load1', 'raw'));
    }
    if (cpuCoresChartEl.value) {
        cpuCoresChart = initChart(cpuCoresChartEl.value, cpuCoresChart);
        cpuCoresChart?.setOption(buildOption('cpu'));
    }
    // 内存 tab
    if (memChartEl.value) {
        memChart = initChart(memChartEl.value, memChart);
        memChart?.setOption(buildTrendOption('mem', 'percent'));
    }
    if (memUsedChartEl.value) {
        memUsedChart = initChart(memUsedChartEl.value, memUsedChart);
        memUsedChart?.setOption(buildOption('mem'));
    }
    if (swapChartEl.value) {
        swapChart = initChart(swapChartEl.value, swapChart);
        swapChart?.setOption(buildOption('swap'));
    }
    if (swapRateChartEl.value) {
        swapRateChart = initChart(swapRateChartEl.value, swapRateChart);
        swapRateChart?.setOption(buildTrendOption('swapRate', 'percent'));
    }
    if (tmpChartEl.value) {
        tmpChart = initChart(tmpChartEl.value, tmpChart);
        tmpChart?.setOption(buildOption('tmp'));
    }
    if (tmpRateChartEl.value) {
        tmpRateChart = initChart(tmpRateChartEl.value, tmpRateChart);
        tmpRateChart?.setOption(buildTrendOption('tmpRate', 'percent'));
    }
    // GPU tab
    if (gpuRateEl.value) {
        const c = initChart(gpuRateEl.value, null);
        c?.setOption(buildTrendOption('cpu', 'percent'));
    }
    if (gpuUsedEl.value) {
        const c = initChart(gpuUsedEl.value, null);
        c?.setOption(buildTrendOption('cpu', 'raw'));
    }
    // 管理节点
    const mgmtOpt = buildTrendOption('cpu', 'percent');
    [mgmtSvcCpuEl, mgmtSvcMemEl, mgmtNodeCpuEl, mgmtNodeMemEl].forEach(el => { if (el.value)
        initChart(el.value, null)?.setOption(mgmtOpt); });
    if (mgmtSvcStateEl.value)
        initChart(mgmtSvcStateEl.value, null)?.setOption(buildTrendOption('cpu', 'raw'));
    if (mgmtSvcFdEl.value)
        initChart(mgmtSvcFdEl.value, null)?.setOption(buildTrendOption('cpu', 'raw'));
    if (mgmtNodeNetEl.value)
        initChart(mgmtNodeNetEl.value, null)?.setOption(buildOption('net'));
    if (mgmtNodeDiskEl.value)
        initChart(mgmtNodeDiskEl.value, null)?.setOption(buildTrendOption('cpu', 'percent'));
    [netCnpEl, netPfcEl, netNicEl, netDropEl].forEach(el => { if (el.value)
        initChart(el.value, null)?.setOption(buildOption('net')); });
};
// 简化趋势图（百分比或原始值）
const buildTrendOption = (key, mode) => {
    const data = history.value;
    const times = data.map(p => p.time);
    const allNodes = Array.from(new Set(data.flatMap(p => Object.keys(p.nodes))));
    const inst = historyNode.value;
    const nodes = inst ? [inst] : allNodes;
    const series = nodes.map((node, i) => ({
        name: shortName(node), type: 'line', smooth: true, symbol: 'none',
        lineStyle: { color: NODE_COLORS[i % NODE_COLORS.length], width: 1.5 },
        areaStyle: { color: NODE_COLORS[i % NODE_COLORS.length], opacity: 0.08 },
        data: data.map(p => {
            const n = p.nodes[node];
            if (!n)
                return 0;
            if (key === 'cpu')
                return +n.cpu.toFixed(1);
            if (key === 'cpuSched')
                return +n.cpu.toFixed(1);
            if (key === 'load1')
                return +n.load1.toFixed(2);
            if (key === 'load5')
                return +n.load5.toFixed(2);
            if (key === 'mem')
                return +n.mem.toFixed(1);
            if (key === 'mem_used')
                return +n.mem_used.toFixed(2);
            if (key === 'swap_used')
                return +n.swap_used.toFixed(2);
            if (key === 'swapRate')
                return +n.swap_usage.toFixed(1);
            if (key === 'tmp_used')
                return +n.tmp_used.toFixed(2);
            if (key === 'tmpRate')
                return +n.tmp_usage.toFixed(1);
            if (key === 'disk')
                return +n.disk.toFixed(1);
            if (key === 'disk_used')
                return +n.disk_used.toFixed(2);
            return 0;
        }),
    }));
    const isPercent = mode === 'percent';
    return {
        backgroundColor: 'transparent',
        grid: { top: 12, right: 8, bottom: 24, left: 40 },
        tooltip: { trigger: 'axis', confine: true },
        xAxis: { type: 'category', data: times, axisLabel: { fontSize: 9, color: '#9ca3af', interval: 'auto' }, axisLine: { lineStyle: { color: '#374151' } }, splitLine: { show: false } },
        yAxis: { type: 'value', min: 0, max: isPercent ? 100 : undefined, axisLabel: { fontSize: 9, color: '#9ca3af', formatter: isPercent ? (v) => v + '' : undefined }, splitLine: { lineStyle: { color: '#1f2937' } } },
        dataZoom: [{ type: 'inside' }],
        series,
    };
};
watch(historyNode, drawAllCharts);
watch(chartTab, drawAllCharts);
watch(mainTab, drawAllCharts);
const fmt1 = (v) => (v == null ? '0' : Number(v).toFixed(1));
const fmt0 = (v) => (v == null ? '0' : Math.round(Number(v)).toString());
const clamp = (v) => Math.min(100, Math.max(0, v || 0));
const shortName = (inst) => inst.replace(/:\d+$/, '');
const fmtBytes = (b) => { if (!b)
    return '0 B/s'; if (b > 1e9)
    return (b / 1e9).toFixed(1) + ' GB/s'; if (b > 1e6)
    return (b / 1e6).toFixed(1) + ' MB/s'; if (b > 1e3)
    return (b / 1e3).toFixed(1) + ' KB/s'; return Math.round(b) + ' B/s'; };
const fmtUptime = (s) => { if (!s)
    return '-'; const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600); return d > 0 ? `${d}天${h}时` : `${h}时`; };
const fmtTime = (t) => { try {
    return new Date(t).toLocaleString('zh-CN');
}
catch {
    return t;
} };
const pctColor = (v, warn) => v > warn ? '#ef4444' : v > warn * 0.8 ? '#f59e0b' : '#10b981';
const pctClass = (v, warn) => v > warn ? 'pct-crit' : v > warn * 0.8 ? 'pct-warn' : 'pct-ok';
const ringColor = (v, warn) => v > warn ? '#ef4444' : v > warn * 0.8 ? '#f59e0b' : '#10b981';
const clusterViewMode = ref('card');
const nodeCardCls = (n) => { const v = Math.max(n.cpu_usage || 0, n.mem_usage || 0); return v > 85 ? 'nc-crit' : v > 70 ? 'nc-warn' : 'nc-ok'; };
const nodeStateCls = (n) => { const v = Math.max(n.cpu_usage || 0, n.mem_usage || 0); return v > 85 ? 'ncs-crit' : v > 70 ? 'ncs-warn' : 'ncs-ok'; };
const nodeStateText = (n) => { const v = Math.max(n.cpu_usage || 0, n.mem_usage || 0); return v > 85 ? '高负载' : v > 70 ? '繁忙' : '正常'; };
const nodeRowCls = (n) => { const v = Math.max(n.cpu_usage || 0, n.mem_usage || 0); return v > 85 ? 'tr-critical' : v > 70 ? 'tr-warning' : ''; };
const barCls = (v, warn) => v > warn ? 'bar-crit' : v > warn * 0.8 ? 'bar-warn' : 'bar-ok';
const ringStyle = (v, warn) => ({ '--ring-color': ringColor(v, warn) });
const nsClass = (s) => { const l = (s || '').toLowerCase(); if (l.includes('idle'))
    return 'ns-idle'; if (l.includes('alloc') || l.includes('mix'))
    return 'ns-alloc'; if (l.includes('down') || l.includes('drain'))
    return 'ns-down'; return 'ns-unk'; };
const saveCfg = () => { localStorage.setItem('mon_cfg', JSON.stringify(cfg.value)); cfgSaved.value = true; setTimeout(() => { cfgSaved.value = false; }, 2000); };
const loadCfg = () => { const s = localStorage.getItem('mon_cfg'); if (s)
    try {
        cfg.value = { ...cfg.value, ...JSON.parse(s) };
    }
    catch { } };
let timer = null;
onMounted(() => { loadCfg(); loadAll(); loadTargets(); loadRules(); timer = setInterval(loadAll, cfg.value.interval * 1000); });
onUnmounted(() => { if (timer)
    clearInterval(timer); stopAlertSound(); clearSound(); [cpuChart, memChart, diskChart, netChart, cpuSchedChart, cpuLoadChart, cpuCoresChart, memUsedChart, swapChart, swapRateChart, tmpChart, tmpRateChart].forEach(c => c?.dispose()); });
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
/** @type {__VLS_StyleScopedClasses['mon-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['mon-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['drop-arrow']} */ ;
/** @type {__VLS_StyleScopedClasses['drop-item']} */ ;
/** @type {__VLS_StyleScopedClasses['drop-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['mon-table-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['mon-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['mon-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['mon-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['cs-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['cs-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['hist-sel']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-section']} */ ;
/** @type {__VLS_StyleScopedClasses['charts-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-section']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sec']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sec']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-pri']} */ ;
/** @type {__VLS_StyleScopedClasses['mtable']} */ ;
/** @type {__VLS_StyleScopedClasses['mtable']} */ ;
/** @type {__VLS_StyleScopedClasses['mtable']} */ ;
/** @type {__VLS_StyleScopedClasses['mtable']} */ ;
/** @type {__VLS_StyleScopedClasses['mtable']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle-slider']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle-slider']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle-slider']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-popup']} */ ;
/** @type {__VLS_StyleScopedClasses['ap-critical']} */ ;
/** @type {__VLS_StyleScopedClasses['ap-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['ap-close']} */ ;
/** @type {__VLS_StyleScopedClasses['db-metric-ring']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-state-unschedulable']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-state-num']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-state-busy']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-state-num']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-state-normal']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-state-num']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-state-idle']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-state-num']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-res-card']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-res-card']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-res-card']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-res-card']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-chart-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-chart-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-charts-grid3']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-charts-grid4']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-charts-grid4']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-charts-grid3']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-chart-sub']} */ ;
/** @type {__VLS_StyleScopedClasses['node-card']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-subtab']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-subtab']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['svc-card']} */ ;
/** @type {__VLS_StyleScopedClasses['jf-sel']} */ ;
/** @type {__VLS_StyleScopedClasses['jf-sel']} */ ;
/** @type {__VLS_StyleScopedClasses['jt-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['jt-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-charts-grid4']} */ ;
/** @type {__VLS_StyleScopedClasses['charts-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['slurm-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['alerts-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-top-row']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-gauges-row']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-charts-grid4']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-charts-grid3']} */ ;
/** @type {__VLS_StyleScopedClasses['node-card-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['slurm-state-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-charts-grid4']} */ ;
/** @type {__VLS_StyleScopedClasses['cv-charts-grid3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mon" },
});
/** @type {__VLS_StyleScopedClasses['mon']} */ ;
if (__VLS_ctx.mainTab === 'mgmt') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mon-section" },
    });
    /** @type {__VLS_StyleScopedClasses['mon-section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mon-block-title" },
    });
    /** @type {__VLS_StyleScopedClasses['mon-block-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "svc-health-grid" },
    });
    /** @type {__VLS_StyleScopedClasses['svc-health-grid']} */ ;
    for (const [svc] of __VLS_vFor((__VLS_ctx.mgmtServices))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (svc.name),
            ...{ class: (['svc-card', svc.active ? 'svc-ok' : 'svc-down']) },
        });
        /** @type {__VLS_StyleScopedClasses['svc-card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "svc-card-header" },
        });
        /** @type {__VLS_StyleScopedClasses['svc-card-header']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "svc-dot" },
            ...{ class: (svc.active ? 'dot-ok' : 'dot-down') },
        });
        /** @type {__VLS_StyleScopedClasses['svc-dot']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "svc-name" },
        });
        /** @type {__VLS_StyleScopedClasses['svc-name']} */ ;
        (svc.display);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: (['svc-badge', svc.active ? 'badge-ok' : svc.state === 'failed' ? 'badge-fail' : 'badge-na']) },
        });
        /** @type {__VLS_StyleScopedClasses['svc-badge']} */ ;
        (svc.state || 'unknown');
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "svc-metrics" },
        });
        /** @type {__VLS_StyleScopedClasses['svc-metrics']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "svc-metric-row" },
        });
        /** @type {__VLS_StyleScopedClasses['svc-metric-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "svc-metric-label" },
        });
        /** @type {__VLS_StyleScopedClasses['svc-metric-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "svc-bar-wrap" },
        });
        /** @type {__VLS_StyleScopedClasses['svc-bar-wrap']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "svc-bar-bg" },
        });
        /** @type {__VLS_StyleScopedClasses['svc-bar-bg']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "svc-bar-fg" },
            ...{ style: ({ width: Math.min(svc.cpu, 100) + '%', background: svc.cpu > 80 ? '#ef4444' : svc.cpu > 50 ? '#f59e0b' : '#10b981' }) },
        });
        /** @type {__VLS_StyleScopedClasses['svc-bar-fg']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "svc-metric-val" },
        });
        /** @type {__VLS_StyleScopedClasses['svc-metric-val']} */ ;
        (svc.cpu.toFixed(1));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "svc-metric-row" },
        });
        /** @type {__VLS_StyleScopedClasses['svc-metric-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "svc-metric-label" },
        });
        /** @type {__VLS_StyleScopedClasses['svc-metric-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "svc-bar-wrap" },
        });
        /** @type {__VLS_StyleScopedClasses['svc-bar-wrap']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "svc-bar-bg" },
        });
        /** @type {__VLS_StyleScopedClasses['svc-bar-bg']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "svc-bar-fg" },
            ...{ style: ({ width: Math.min(svc.mem_mb / 10, 100) + '%', background: '#667eea' }) },
        });
        /** @type {__VLS_StyleScopedClasses['svc-bar-fg']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "svc-metric-val" },
        });
        /** @type {__VLS_StyleScopedClasses['svc-metric-val']} */ ;
        (svc.mem_mb.toFixed(0));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "svc-metric-row" },
        });
        /** @type {__VLS_StyleScopedClasses['svc-metric-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "svc-metric-label" },
        });
        /** @type {__VLS_StyleScopedClasses['svc-metric-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "svc-metric-val svc-fd" },
        });
        /** @type {__VLS_StyleScopedClasses['svc-metric-val']} */ ;
        /** @type {__VLS_StyleScopedClasses['svc-fd']} */ ;
        (svc.fds > 0 ? svc.fds.toFixed(0) : '-');
        // @ts-ignore
        [mainTab, mgmtServices,];
    }
    if (__VLS_ctx.mgmtServices.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "svc-empty" },
        });
        /** @type {__VLS_StyleScopedClasses['svc-empty']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mon-block-title" },
    });
    /** @type {__VLS_StyleScopedClasses['mon-block-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-charts-grid4" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-charts-grid4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-card" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-name" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-name']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-sub']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ref: "mgmtNodeCpuEl",
        ...{ class: "cv-echarts-box" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-echarts-box']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-card" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-name" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-name']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-sub']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ref: "mgmtNodeMemEl",
        ...{ class: "cv-echarts-box" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-echarts-box']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-card" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-name" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-name']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-sub']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ref: "mgmtNodeNetEl",
        ...{ class: "cv-echarts-box" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-echarts-box']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-card" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-name" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-name']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-sub']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ref: "mgmtNodeDiskEl",
        ...{ class: "cv-echarts-box" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-echarts-box']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mon-block-title" },
    });
    /** @type {__VLS_StyleScopedClasses['mon-block-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mon-table-wrap" },
    });
    /** @type {__VLS_StyleScopedClasses['mon-table-wrap']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
        ...{ class: "mtable" },
    });
    /** @type {__VLS_StyleScopedClasses['mtable']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
    for (const [n] of __VLS_vFor((__VLS_ctx.nodeMetrics))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (n.instance),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
        (__VLS_ctx.shortName(n.instance));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "small-text" },
        });
        /** @type {__VLS_StyleScopedClasses['small-text']} */ ;
        (n.instance);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "small-text" },
        });
        /** @type {__VLS_StyleScopedClasses['small-text']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: (['nc-state', __VLS_ctx.nodeStateCls(n)]) },
        });
        /** @type {__VLS_StyleScopedClasses['nc-state']} */ ;
        (__VLS_ctx.nodeStateText(n));
        // @ts-ignore
        [mgmtServices, nodeMetrics, shortName, nodeStateCls, nodeStateText,];
    }
    if (__VLS_ctx.nodeMetrics.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            colspan: "4",
            ...{ class: "empty-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['empty-sm']} */ ;
    }
}
if (__VLS_ctx.mainTab === 'cluster') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mon-section" },
    });
    /** @type {__VLS_StyleScopedClasses['mon-section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mon-block-title" },
    });
    /** @type {__VLS_StyleScopedClasses['mon-block-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-top-row" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-top-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-top-left" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-top-left']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-stat-block" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-stat-block']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-stat-label" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-stat-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-stat-big" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-stat-big']} */ ;
    (__VLS_ctx.nodeMetrics.length);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-state-table" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-state-table']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-state-row cv-state-unschedulable" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-state-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['cv-state-unschedulable']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "cv-state-bar" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-state-bar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "cv-state-name" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-state-name']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "cv-state-num" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-state-num']} */ ;
    (__VLS_ctx.clusterNodeStates.unschedulable);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-state-row cv-state-busy" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-state-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['cv-state-busy']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "cv-state-bar" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-state-bar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "cv-state-name" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-state-name']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "cv-state-num" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-state-num']} */ ;
    (__VLS_ctx.clusterNodeStates.busy);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-state-row cv-state-normal" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-state-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['cv-state-normal']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "cv-state-bar" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-state-bar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "cv-state-name" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-state-name']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "cv-state-num" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-state-num']} */ ;
    (__VLS_ctx.clusterNodeStates.normal);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-state-row cv-state-idle" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-state-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['cv-state-idle']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "cv-state-bar" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-state-bar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "cv-state-name" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-state-name']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "cv-state-num" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-state-num']} */ ;
    (__VLS_ctx.clusterNodeStates.idle);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-gauges-row" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-gauges-row']} */ ;
    for (const [g] of __VLS_vFor((__VLS_ctx.gaugeList))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-gauge-card" },
            key: (g.key),
        });
        /** @type {__VLS_StyleScopedClasses['cv-gauge-card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-gauge-title" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-gauge-title']} */ ;
        (g.label);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-gauge-wrap" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-gauge-wrap']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
            viewBox: "0 0 120 70",
            ...{ class: "cv-gauge-svg" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-gauge-svg']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
            d: "M10,65 A55,55 0 0,1 110,65",
            fill: "none",
            stroke: "#2a2a3a",
            'stroke-width': "12",
            'stroke-linecap': "round",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
            d: "M10,65 A55,55 0 0,1 110,65",
            fill: "none",
            stroke: (__VLS_ctx.gaugeColor(g.val, g.warn)),
            'stroke-width': "12",
            'stroke-linecap': "round",
            'stroke-dasharray': (`${g.val * 1.728} 172.8`),
            'stroke-dashoffset': "0",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.text, __VLS_intrinsics.text)({
            x: "6",
            y: "72",
            'font-size': "8",
            fill: "#666",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.text, __VLS_intrinsics.text)({
            x: "54",
            y: "16",
            'font-size': "8",
            fill: "#666",
            'text-anchor': "middle",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.text, __VLS_intrinsics.text)({
            x: "108",
            y: "72",
            'font-size': "8",
            fill: "#666",
            'text-anchor': "end",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-gauge-val" },
            ...{ style: ({ color: __VLS_ctx.gaugeColor(g.val, g.warn) }) },
        });
        /** @type {__VLS_StyleScopedClasses['cv-gauge-val']} */ ;
        (__VLS_ctx.fmt1(g.val));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-gauge-unit" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-gauge-unit']} */ ;
        // @ts-ignore
        [mainTab, nodeMetrics, nodeMetrics, clusterNodeStates, clusterNodeStates, clusterNodeStates, clusterNodeStates, gaugeList, gaugeColor, gaugeColor, fmt1,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-res-stats" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-res-stats']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-res-card" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-res-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-res-label" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-res-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-res-val" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-res-val']} */ ;
    (__VLS_ctx.clusterRes.cpuTotal);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-res-card" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-res-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-res-label" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-res-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-res-val cv-res-green" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-res-val']} */ ;
    /** @type {__VLS_StyleScopedClasses['cv-res-green']} */ ;
    (__VLS_ctx.clusterRes.cpuFree);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-res-card" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-res-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-res-label" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-res-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-res-val" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-res-val']} */ ;
    (__VLS_ctx.clusterRes.gpuTotal);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-res-card" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-res-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-res-label" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-res-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-res-val cv-res-green" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-res-val']} */ ;
    /** @type {__VLS_StyleScopedClasses['cv-res-green']} */ ;
    (__VLS_ctx.clusterRes.gpuFree);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-res-card" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-res-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-res-label" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-res-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-res-val" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-res-val']} */ ;
    (__VLS_ctx.clusterRes.memTotal);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-res-card" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-res-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-res-label" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-res-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-res-val cv-res-green" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-res-val']} */ ;
    /** @type {__VLS_StyleScopedClasses['cv-res-green']} */ ;
    (__VLS_ctx.clusterRes.memFree);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-tabs" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-tabs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.mainTab === 'cluster'))
                    return;
                __VLS_ctx.chartTab = 'cpu';
                // @ts-ignore
                [clusterRes, clusterRes, clusterRes, clusterRes, clusterRes, clusterRes, chartTab,];
            } },
        ...{ class: (['cv-chart-tab', __VLS_ctx.chartTab === 'cpu' && 'active']) },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-tab']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.mainTab === 'cluster'))
                    return;
                __VLS_ctx.chartTab = 'gpu';
                // @ts-ignore
                [chartTab, chartTab,];
            } },
        ...{ class: (['cv-chart-tab', __VLS_ctx.chartTab === 'gpu' && 'active']) },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-tab']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.mainTab === 'cluster'))
                    return;
                __VLS_ctx.chartTab = 'mem';
                // @ts-ignore
                [chartTab, chartTab,];
            } },
        ...{ class: (['cv-chart-tab', __VLS_ctx.chartTab === 'mem' && 'active']) },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-tab']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: (['prom-badge', __VLS_ctx.promOk ? 'prom-ok' : 'prom-na']) },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['prom-badge']} */ ;
    (__VLS_ctx.promOk ? '已连接' : '未连接');
    if (__VLS_ctx.chartTab === 'cpu') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-section-title" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-section-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-charts-grid4" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-charts-grid4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-card" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-name" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-name']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-sub" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-sub']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ref: "cpuChartEl",
            ...{ class: "cv-echarts-box" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-echarts-box']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-card" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-name" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-name']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-sub" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-sub']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ref: "cpuSchedChartEl",
            ...{ class: "cv-echarts-box" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-echarts-box']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-card" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-name" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-name']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-sub" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-sub']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ref: "cpuLoadChartEl",
            ...{ class: "cv-echarts-box" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-echarts-box']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-card" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-name" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-name']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-sub" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-sub']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ref: "cpuCoresChartEl",
            ...{ class: "cv-echarts-box" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-echarts-box']} */ ;
    }
    if (__VLS_ctx.chartTab === 'gpu') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-section-title" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-section-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-charts-grid4" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-charts-grid4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-card" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-name" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-name']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-sub" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-sub']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ref: "gpuRateEl",
            ...{ class: "cv-echarts-box" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-echarts-box']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-card" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-name" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-name']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-sub" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-sub']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ref: "gpuUsedEl",
            ...{ class: "cv-echarts-box" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-echarts-box']} */ ;
    }
    if (__VLS_ctx.chartTab === 'mem') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-section-title" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-section-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-charts-grid3" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-charts-grid3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-card" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-name" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-name']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-sub" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-sub']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ref: "memChartEl",
            ...{ class: "cv-echarts-box" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-echarts-box']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-card" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-name" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-name']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-sub" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-sub']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ref: "memUsedChartEl",
            ...{ class: "cv-echarts-box" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-echarts-box']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-card" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-name" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-name']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-sub" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-sub']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ref: "swapChartEl",
            ...{ class: "cv-echarts-box" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-echarts-box']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-card" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-name" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-name']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-sub" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-sub']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ref: "swapRateChartEl",
            ...{ class: "cv-echarts-box" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-echarts-box']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-card" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-name" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-name']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-sub" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-sub']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ref: "tmpChartEl",
            ...{ class: "cv-echarts-box" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-echarts-box']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-card" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-name" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-name']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cv-chart-sub" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-chart-sub']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ref: "tmpRateChartEl",
            ...{ class: "cv-echarts-box" },
        });
        /** @type {__VLS_StyleScopedClasses['cv-echarts-box']} */ ;
    }
}
if (__VLS_ctx.mainTab === 'network') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mon-section" },
    });
    /** @type {__VLS_StyleScopedClasses['mon-section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mon-block-title" },
    });
    /** @type {__VLS_StyleScopedClasses['mon-block-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mon-table-wrap" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['mon-table-wrap']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
        ...{ class: "mtable" },
    });
    /** @type {__VLS_StyleScopedClasses['mtable']} */ ;
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
    for (const [n] of __VLS_vFor((__VLS_ctx.nodeMetrics))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (n.instance),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "small-text" },
        });
        /** @type {__VLS_StyleScopedClasses['small-text']} */ ;
        (__VLS_ctx.lastRefresh || '-');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "small-text" },
        });
        /** @type {__VLS_StyleScopedClasses['small-text']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "small-text" },
        });
        /** @type {__VLS_StyleScopedClasses['small-text']} */ ;
        (__VLS_ctx.shortName(n.instance));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "small-text" },
        });
        /** @type {__VLS_StyleScopedClasses['small-text']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (__VLS_ctx.fmt0(n.net_rx_bps));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (__VLS_ctx.fmt0(n.net_tx_bps));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (__VLS_ctx.fmt0(n.net_rx_bps));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (__VLS_ctx.fmt0(n.net_tx_bps));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        // @ts-ignore
        [mainTab, nodeMetrics, shortName, chartTab, chartTab, chartTab, chartTab, promOk, promOk, lastRefresh, fmt0, fmt0, fmt0, fmt0,];
    }
    if (__VLS_ctx.nodeMetrics.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            colspan: "12",
            ...{ class: "empty-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['empty-sm']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-charts-grid4" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['cv-charts-grid4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-card" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-name" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-name']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-sub']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ref: "netCnpEl",
        ...{ class: "cv-echarts-box" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-echarts-box']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-card" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-name" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-name']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-sub']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ref: "netPfcEl",
        ...{ class: "cv-echarts-box" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-echarts-box']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-card" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-name" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-name']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-sub']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ref: "netNicEl",
        ...{ class: "cv-echarts-box" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-echarts-box']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-card" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-name" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-name']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-sub']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ref: "netDropEl",
        ...{ class: "cv-echarts-box" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-echarts-box']} */ ;
}
if (__VLS_ctx.mainTab === 'alerts') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mon-section" },
    });
    /** @type {__VLS_StyleScopedClasses['mon-section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "alert-subtabs" },
    });
    /** @type {__VLS_StyleScopedClasses['alert-subtabs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.mainTab === 'alerts'))
                    return;
                __VLS_ctx.alertTab = 'active';
                // @ts-ignore
                [mainTab, nodeMetrics, alertTab,];
            } },
        ...{ class: (['alert-subtab', __VLS_ctx.alertTab === 'active' && 'active']) },
    });
    /** @type {__VLS_StyleScopedClasses['alert-subtab']} */ ;
    if (__VLS_ctx.promAlerts.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "alert-badge" },
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['alert-badge']} */ ;
        (__VLS_ctx.promAlerts.length);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.mainTab === 'alerts'))
                    return;
                __VLS_ctx.alertTab = 'rules';
                // @ts-ignore
                [alertTab, alertTab, promAlerts, promAlerts,];
            } },
        ...{ class: (['alert-subtab', __VLS_ctx.alertTab === 'rules' && 'active']) },
    });
    /** @type {__VLS_StyleScopedClasses['alert-subtab']} */ ;
    if (__VLS_ctx.allRules.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "nodes-count" },
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['nodes-count']} */ ;
        (__VLS_ctx.allRules.length);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.mainTab === 'alerts'))
                    return;
                __VLS_ctx.alertTab = 'config';
                // @ts-ignore
                [alertTab, alertTab, allRules, allRules,];
            } },
        ...{ class: (['alert-subtab', __VLS_ctx.alertTab === 'config' && 'active']) },
    });
    /** @type {__VLS_StyleScopedClasses['alert-subtab']} */ ;
    if (__VLS_ctx.alertTab === 'active') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "alert-tab-toolbar" },
        });
        /** @type {__VLS_StyleScopedClasses['alert-tab-toolbar']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: (['prom-badge', __VLS_ctx.promAlertsOk ? 'prom-ok' : 'prom-na']) },
        });
        /** @type {__VLS_StyleScopedClasses['prom-badge']} */ ;
        (__VLS_ctx.promAlertsOk ? '已连接' : '未连接');
        if (!__VLS_ctx.promAlertsOk) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "prom-tip" },
            });
            /** @type {__VLS_StyleScopedClasses['prom-tip']} */ ;
        }
        else if (__VLS_ctx.promAlerts.length === 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "empty-sm" },
            });
            /** @type {__VLS_StyleScopedClasses['empty-sm']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ style: {} },
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
                ...{ class: "mtable" },
            });
            /** @type {__VLS_StyleScopedClasses['mtable']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
            for (const [a] of __VLS_vFor((__VLS_ctx.promAlerts))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                    key: (a.fingerprint),
                    ...{ class: (a.labels?.severity === 'critical' ? 'tr-critical' : 'tr-warning') },
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: (['sev-badge', 'sev-' + (a.labels?.severity || 'info')]) },
                });
                /** @type {__VLS_StyleScopedClasses['sev-badge']} */ ;
                (a.labels?.severity || 'info');
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
                (a.labels?.alertname || '-');
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "small-text" },
                });
                /** @type {__VLS_StyleScopedClasses['small-text']} */ ;
                (a.labels?.instance || a.labels?.job || '-');
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "small-text" },
                });
                /** @type {__VLS_StyleScopedClasses['small-text']} */ ;
                (a.annotations?.summary || a.annotations?.description || '-');
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "small-text" },
                });
                /** @type {__VLS_StyleScopedClasses['small-text']} */ ;
                (__VLS_ctx.fmtTime(a.activeAt));
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ class: "btn-sec" },
                    ...{ style: {} },
                });
                /** @type {__VLS_StyleScopedClasses['btn-sec']} */ ;
                // @ts-ignore
                [alertTab, alertTab, promAlerts, promAlerts, promAlertsOk, promAlertsOk, promAlertsOk, fmtTime,];
            }
        }
    }
    if (__VLS_ctx.alertTab === 'rules') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "alert-tab-toolbar" },
        });
        /** @type {__VLS_StyleScopedClasses['alert-tab-toolbar']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: (['prom-badge', __VLS_ctx.rulesConnected ? 'prom-ok' : 'prom-na']) },
        });
        /** @type {__VLS_StyleScopedClasses['prom-badge']} */ ;
        (__VLS_ctx.rulesConnected ? '已连接' : '未连接');
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            placeholder: "搜索规则...",
            ...{ class: "rule-search" },
            ...{ style: {} },
        });
        (__VLS_ctx.ruleSearch);
        /** @type {__VLS_StyleScopedClasses['rule-search']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.loadRules) },
            ...{ class: "btn-sec" },
            disabled: (__VLS_ctx.rulesLoading),
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['btn-sec']} */ ;
        (__VLS_ctx.rulesLoading ? '...' : '🔄');
        if (!__VLS_ctx.rulesConnected) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "prom-tip" },
            });
            /** @type {__VLS_StyleScopedClasses['prom-tip']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ style: {} },
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
                ...{ class: "mtable" },
            });
            /** @type {__VLS_StyleScopedClasses['mtable']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
            for (const [group] of __VLS_vFor((__VLS_ctx.filteredRuleGroups))) {
                (group.name);
                for (const [r] of __VLS_vFor((group.rules))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                        key: (r.name),
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
                    (r.name);
                    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                        ...{ class: "expr-cell" },
                        title: (r.query),
                    });
                    /** @type {__VLS_StyleScopedClasses['expr-cell']} */ ;
                    (r.query);
                    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                    (r.duration ? r.duration + 's' : '-');
                    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: (['sev-badge', 'sev-' + (r.labels?.severity || 'info')]) },
                    });
                    /** @type {__VLS_StyleScopedClasses['sev-badge']} */ ;
                    (r.labels?.severity || 'info');
                    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: (['state-badge2', r.state === 'firing' ? 'st-firing' : r.state === 'pending' ? 'st-pending' : 'st-ok']) },
                    });
                    /** @type {__VLS_StyleScopedClasses['state-badge2']} */ ;
                    (r.state || 'inactive');
                    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                        ...{ class: "small-text" },
                    });
                    /** @type {__VLS_StyleScopedClasses['small-text']} */ ;
                    (r.annotations?.summary || r.annotations?.description || '-');
                    // @ts-ignore
                    [alertTab, rulesConnected, rulesConnected, rulesConnected, ruleSearch, loadRules, rulesLoading, rulesLoading, filteredRuleGroups,];
                }
                // @ts-ignore
                [];
            }
            if (__VLS_ctx.filteredRuleGroups.length === 0) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    colspan: "6",
                    ...{ class: "empty-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['empty-sm']} */ ;
            }
        }
    }
    if (__VLS_ctx.alertTab === 'config') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "local-cfg-card" },
        });
        /** @type {__VLS_StyleScopedClasses['local-cfg-card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "lcc-title" },
        });
        /** @type {__VLS_StyleScopedClasses['lcc-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "lcc-row" },
        });
        /** @type {__VLS_StyleScopedClasses['lcc-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "50",
            max: "100",
            ...{ class: "num-input" },
        });
        (__VLS_ctx.cfg.cpuWarn);
        /** @type {__VLS_StyleScopedClasses['num-input']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "50",
            max: "100",
            ...{ class: "num-input" },
        });
        (__VLS_ctx.cfg.memWarn);
        /** @type {__VLS_StyleScopedClasses['num-input']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "toggle" },
        });
        /** @type {__VLS_StyleScopedClasses['toggle']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "checkbox",
        });
        (__VLS_ctx.cfg.popupEnabled);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "toggle-slider" },
        });
        /** @type {__VLS_StyleScopedClasses['toggle-slider']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "toggle" },
        });
        /** @type {__VLS_StyleScopedClasses['toggle']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "checkbox",
        });
        (__VLS_ctx.cfg.soundEnabled);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "toggle-slider" },
        });
        /** @type {__VLS_StyleScopedClasses['toggle-slider']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "30",
            max: "3600",
            ...{ class: "num-input" },
        });
        (__VLS_ctx.cfg.alertInterval);
        /** @type {__VLS_StyleScopedClasses['num-input']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sound-upload-row" },
        });
        /** @type {__VLS_StyleScopedClasses['sound-upload-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "lcc-title" },
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['lcc-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sound-upload-area" },
        });
        /** @type {__VLS_StyleScopedClasses['sound-upload-area']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "sound-upload-btn" },
        });
        /** @type {__VLS_StyleScopedClasses['sound-upload-btn']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onChange: (__VLS_ctx.onSoundUpload) },
            type: "file",
            accept: "audio/*",
            ...{ style: {} },
        });
        if (__VLS_ctx.customSoundName) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "sound-name" },
            });
            /** @type {__VLS_StyleScopedClasses['sound-name']} */ ;
            (__VLS_ctx.customSoundName);
        }
        if (__VLS_ctx.customSoundUrl) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.testSound) },
                ...{ class: "btn-sec" },
                ...{ style: {} },
            });
            /** @type {__VLS_StyleScopedClasses['btn-sec']} */ ;
        }
        if (__VLS_ctx.customSoundUrl) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.clearSound) },
                ...{ class: "btn-sec" },
                ...{ style: {} },
            });
            /** @type {__VLS_StyleScopedClasses['btn-sec']} */ ;
        }
        if (!__VLS_ctx.customSoundUrl) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "sound-hint" },
            });
            /** @type {__VLS_StyleScopedClasses['sound-hint']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "lcc-row" },
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['lcc-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.saveCfg) },
            ...{ class: "btn-pri" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-pri']} */ ;
        if (__VLS_ctx.cfgSaved) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "save-tip" },
            });
            /** @type {__VLS_StyleScopedClasses['save-tip']} */ ;
        }
    }
}
if (__VLS_ctx.mainTab === 'jobs') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mon-section" },
    });
    /** @type {__VLS_StyleScopedClasses['mon-section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "job-filter-bar" },
    });
    /** @type {__VLS_StyleScopedClasses['job-filter-bar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jf-item" },
    });
    /** @type {__VLS_StyleScopedClasses['jf-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "jf-label" },
    });
    /** @type {__VLS_StyleScopedClasses['jf-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: (__VLS_ctx.applyJobFilter) },
        value: (__VLS_ctx.jobFilter.partition),
        ...{ class: "jf-sel" },
    });
    /** @type {__VLS_StyleScopedClasses['jf-sel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    for (const [p] of __VLS_vFor((__VLS_ctx.jobPartitions))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (p),
            value: (p),
        });
        (p);
        // @ts-ignore
        [mainTab, alertTab, filteredRuleGroups, cfg, cfg, cfg, cfg, cfg, onSoundUpload, customSoundName, customSoundName, customSoundUrl, customSoundUrl, customSoundUrl, testSound, clearSound, saveCfg, cfgSaved, applyJobFilter, jobFilter, jobPartitions,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jf-item" },
    });
    /** @type {__VLS_StyleScopedClasses['jf-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "jf-label" },
    });
    /** @type {__VLS_StyleScopedClasses['jf-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: (__VLS_ctx.applyJobFilter) },
        value: (__VLS_ctx.jobFilter.queue),
        ...{ class: "jf-sel" },
    });
    /** @type {__VLS_StyleScopedClasses['jf-sel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    for (const [q] of __VLS_vFor((__VLS_ctx.jobQueues))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (q),
            value: (q),
        });
        (q);
        // @ts-ignore
        [applyJobFilter, jobFilter, jobQueues,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jf-item" },
    });
    /** @type {__VLS_StyleScopedClasses['jf-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "jf-label" },
    });
    /** @type {__VLS_StyleScopedClasses['jf-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: (__VLS_ctx.applyJobFilter) },
        value: (__VLS_ctx.jobFilter.account),
        ...{ class: "jf-sel" },
    });
    /** @type {__VLS_StyleScopedClasses['jf-sel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    for (const [a] of __VLS_vFor((__VLS_ctx.jobAccounts))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (a),
            value: (a),
        });
        (a);
        // @ts-ignore
        [applyJobFilter, jobFilter, jobAccounts,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jf-item" },
    });
    /** @type {__VLS_StyleScopedClasses['jf-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "jf-label" },
    });
    /** @type {__VLS_StyleScopedClasses['jf-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: (__VLS_ctx.applyJobFilter) },
        value: (__VLS_ctx.jobFilter.user),
        ...{ class: "jf-sel" },
    });
    /** @type {__VLS_StyleScopedClasses['jf-sel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    for (const [u] of __VLS_vFor((__VLS_ctx.jobUsers))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (u),
            value: (u),
        });
        (u);
        // @ts-ignore
        [applyJobFilter, jobFilter, jobUsers,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jf-item" },
    });
    /** @type {__VLS_StyleScopedClasses['jf-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "jf-label" },
    });
    /** @type {__VLS_StyleScopedClasses['jf-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: (__VLS_ctx.applyJobFilter) },
        value: (__VLS_ctx.jobFilter.submitNode),
        ...{ class: "jf-sel" },
    });
    /** @type {__VLS_StyleScopedClasses['jf-sel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    for (const [n] of __VLS_vFor((__VLS_ctx.jobSubmitNodes))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (n),
            value: (n),
        });
        (n);
        // @ts-ignore
        [applyJobFilter, jobFilter, jobSubmitNodes,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jf-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['jf-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.loadJobDashboard) },
        ...{ class: "btn-sec" },
        disabled: (__VLS_ctx.jobLoading),
    });
    /** @type {__VLS_StyleScopedClasses['btn-sec']} */ ;
    (__VLS_ctx.jobLoading ? '...' : '🔄');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "job-time-bar" },
    });
    /** @type {__VLS_StyleScopedClasses['job-time-bar']} */ ;
    for (const [r] of __VLS_vFor((__VLS_ctx.timeRanges))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.mainTab === 'jobs'))
                        return;
                    __VLS_ctx.jobTimeRange = r.val;
                    __VLS_ctx.loadJobDashboard();
                    // @ts-ignore
                    [loadJobDashboard, loadJobDashboard, jobLoading, jobLoading, timeRanges, jobTimeRange,];
                } },
            key: (r.val),
            ...{ class: (['jt-btn', __VLS_ctx.jobTimeRange === r.val && 'active']) },
        });
        /** @type {__VLS_StyleScopedClasses['jt-btn']} */ ;
        (r.label);
        // @ts-ignore
        [jobTimeRange,];
    }
    if (__VLS_ctx.jobTimeRangeText) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "jt-range-text" },
        });
        /** @type {__VLS_StyleScopedClasses['jt-range-text']} */ ;
        (__VLS_ctx.jobTimeRangeText);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mon-block-title" },
    });
    /** @type {__VLS_StyleScopedClasses['mon-block-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "job-charts-row" },
    });
    /** @type {__VLS_StyleScopedClasses['job-charts-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "job-pie-card" },
    });
    /** @type {__VLS_StyleScopedClasses['job-pie-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-name" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-name']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "job-pie-wrap" },
    });
    /** @type {__VLS_StyleScopedClasses['job-pie-wrap']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ref: "jobPieEl",
        ...{ class: "job-pie-chart" },
    });
    /** @type {__VLS_StyleScopedClasses['job-pie-chart']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "job-pie-legend" },
    });
    /** @type {__VLS_StyleScopedClasses['job-pie-legend']} */ ;
    for (const [s] of __VLS_vFor((__VLS_ctx.jobStatusList))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (s.status),
            ...{ class: "jpl-item" },
        });
        /** @type {__VLS_StyleScopedClasses['jpl-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "jpl-dot" },
            ...{ style: ({ background: s.color }) },
        });
        /** @type {__VLS_StyleScopedClasses['jpl-dot']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "jpl-label" },
        });
        /** @type {__VLS_StyleScopedClasses['jpl-label']} */ ;
        (s.label);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "jpl-val" },
        });
        /** @type {__VLS_StyleScopedClasses['jpl-val']} */ ;
        (s.count);
        (__VLS_ctx.jobTotal > 0 ? Math.round(s.count / __VLS_ctx.jobTotal * 100) : 0);
        // @ts-ignore
        [jobTimeRangeText, jobTimeRangeText, jobStatusList, jobTotal, jobTotal,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "job-trend-card" },
    });
    /** @type {__VLS_StyleScopedClasses['job-trend-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-name" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-name']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "job-trend-legend" },
    });
    /** @type {__VLS_StyleScopedClasses['job-trend-legend']} */ ;
    for (const [s] of __VLS_vFor((__VLS_ctx.trendSeries))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            key: (s.name),
            ...{ class: "jtl-item" },
        });
        /** @type {__VLS_StyleScopedClasses['jtl-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "jtl-line" },
            ...{ style: ({ background: s.color, borderStyle: s.dash ? 'dashed' : 'solid' }) },
        });
        /** @type {__VLS_StyleScopedClasses['jtl-line']} */ ;
        (s.name);
        // @ts-ignore
        [trendSeries,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ref: "jobTrendEl",
        ...{ class: "job-trend-chart" },
    });
    /** @type {__VLS_StyleScopedClasses['job-trend-chart']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mon-block-title" },
    });
    /** @type {__VLS_StyleScopedClasses['mon-block-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-charts-grid3" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-charts-grid3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-card" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-name" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-name']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-sub']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ref: "jobActiveEl",
        ...{ class: "cv-echarts-box" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-echarts-box']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-card" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-name" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-name']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-sub']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ref: "jobDoneEl",
        ...{ class: "cv-echarts-box" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-echarts-box']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-card" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-name" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-name']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cv-chart-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-chart-sub']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ref: "jobSubmitEl",
        ...{ class: "cv-echarts-box" },
    });
    /** @type {__VLS_StyleScopedClasses['cv-echarts-box']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mon-block-title" },
    });
    /** @type {__VLS_StyleScopedClasses['mon-block-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mon-table-wrap" },
    });
    /** @type {__VLS_StyleScopedClasses['mon-table-wrap']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
        ...{ class: "mtable" },
    });
    /** @type {__VLS_StyleScopedClasses['mtable']} */ ;
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
    for (const [j] of __VLS_vFor((__VLS_ctx.filteredJobList))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (j.id),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "td-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['td-mono']} */ ;
        (j.id);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (j.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "small-text" },
        });
        /** @type {__VLS_StyleScopedClasses['small-text']} */ ;
        (j.user);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: (['job-st-badge', 'jst-' + j.status.toLowerCase()]) },
        });
        /** @type {__VLS_StyleScopedClasses['job-st-badge']} */ ;
        (__VLS_ctx.jobStatusLabel(j.status));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "small-text" },
        });
        /** @type {__VLS_StyleScopedClasses['small-text']} */ ;
        (j.partition);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (j.cpus);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "small-text" },
        });
        /** @type {__VLS_StyleScopedClasses['small-text']} */ ;
        (j.submitTime);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "small-text" },
        });
        /** @type {__VLS_StyleScopedClasses['small-text']} */ ;
        (j.runTime);
        // @ts-ignore
        [filteredJobList, jobStatusLabel,];
    }
    if (__VLS_ctx.filteredJobList.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            colspan: "8",
            ...{ class: "empty-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['empty-sm']} */ ;
        (__VLS_ctx.jobLoading ? '加载中...' : '暂无作业数据');
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
if (__VLS_ctx.alertPopup.show) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (__VLS_ctx.dismissPopup) },
        ...{ class: "alert-popup-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['alert-popup-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: (['alert-popup', __VLS_ctx.alertPopup.level === 'critical' ? 'ap-critical' : 'ap-warning']) },
    });
    /** @type {__VLS_StyleScopedClasses['alert-popup']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ap-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['ap-icon']} */ ;
    (__VLS_ctx.alertPopup.level === 'critical' ? '🔴' : '🟡');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ap-body" },
    });
    /** @type {__VLS_StyleScopedClasses['ap-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ap-title" },
    });
    /** @type {__VLS_StyleScopedClasses['ap-title']} */ ;
    (__VLS_ctx.alertPopup.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ap-list" },
    });
    /** @type {__VLS_StyleScopedClasses['ap-list']} */ ;
    for (const [a] of __VLS_vFor((__VLS_ctx.alertPopup.alerts))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (a.id),
            ...{ class: "ap-item" },
        });
        /** @type {__VLS_StyleScopedClasses['ap-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (a.level === 'critical' ? '🔴' : '🟡');
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (a.title);
        // @ts-ignore
        [jobLoading, filteredJobList, alertPopup, alertPopup, alertPopup, alertPopup, alertPopup, dismissPopup,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.dismissPopup) },
        ...{ class: "ap-close" },
    });
    /** @type {__VLS_StyleScopedClasses['ap-close']} */ ;
}
// @ts-ignore
[dismissPopup,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
