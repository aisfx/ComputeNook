/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { getApiBase, getToken } from '../utils/auth';
import * as echarts from 'echarts/core';
import { PieChart, BarChart, LineChart, ScatterChart, GaugeChart, GraphChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import 'echarts-gl';
import Cluster3DTopology from './Cluster3DTopology.vue';
echarts.use([PieChart, BarChart, LineChart, ScatterChart, GaugeChart, GraphChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);
// ── 主题感知 ──────────────────────────────────────────────
const currentTheme = ref(document.documentElement.getAttribute('data-theme') || 'light');
let themeObserver = null;
const isDark = computed(() => currentTheme.value === 'dark' || currentTheme.value === 'ocean');
const themeVars = computed(() => {
    if (currentTheme.value === 'dark')
        return {
            bg: 'linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f172a 100%)',
            headerBg: 'rgba(15,23,42,.8)', headerBorder: 'rgba(99,102,241,.3)',
            cardBg: 'rgba(30,41,59,.7)', cardBorder: 'rgba(255,255,255,.06)',
            kpiBg: 'rgba(30,41,59,.8)', text: '#e2e8f0', subText: '#64748b',
            splitLine: '#1e293b', axisLine: '#334155', chartText: '#64748b',
            resBg: 'rgba(255,255,255,.03)', gaugeTrack: 'rgba(255,255,255,0.06)',
        };
    if (currentTheme.value === 'ocean')
        return {
            bg: 'linear-gradient(135deg,#0a1628 0%,#0d2137 50%,#0a1628 100%)',
            headerBg: 'rgba(10,22,40,.9)', headerBorder: 'rgba(56,189,248,.3)',
            cardBg: 'rgba(13,33,55,.8)', cardBorder: 'rgba(56,189,248,.08)',
            kpiBg: 'rgba(13,33,55,.9)', text: '#e0f2fe', subText: '#4a7fa5',
            splitLine: '#0d2137', axisLine: '#1e3a5f', chartText: '#4a7fa5',
            resBg: 'rgba(56,189,248,.04)', gaugeTrack: 'rgba(56,189,248,0.06)',
        };
    // light
    return {
        bg: 'linear-gradient(135deg,#f0f4ff 0%,#e8edf8 50%,#f0f4ff 100%)',
        headerBg: 'rgba(255,255,255,.9)', headerBorder: 'rgba(99,102,241,.2)',
        cardBg: 'rgba(255,255,255,.9)', cardBorder: 'rgba(0,0,0,.08)',
        kpiBg: 'rgba(255,255,255,.95)', text: '#1e293b', subText: '#64748b',
        splitLine: '#e2e8f0', axisLine: '#cbd5e1', chartText: '#64748b',
        resBg: 'rgba(0,0,0,.03)', gaugeTrack: 'rgba(0,0,0,0.06)',
    };
});
const loading = ref(false);
const currentTime = ref('');
const currentDate = ref('');
const isFullscreen = ref(false);
const dashEl = ref();
const trendTab = ref('cpu');
let clockTimer = null;
let refreshTimer = null;
const stats = ref({ totalNodes: 0, runningJobs: 0, pendingJobs: 0, completedJobs: 0, cpuUtil: 0, memUtil: 0, activeUsers: 0, totalUsers: 0,
    totalGpus: 0, allocGpus: 0,
    totalCpus: 0, allocCpus: 0, totalMemGb: 0, freeMemGb: 0,
    jobTypes: { mpi: 0, openmp: 0, gpu: 0, array: 0, serial: 0 } });
const nodes = ref([]);
const trendData = ref([]);
const recentAlerts = ref([]);
const jobHistoryForRank = ref([]);
const alertCount = computed(() => recentAlerts.value.length);
// 用户7天活跃排行（按作业数降序，取前8）
const userRankList = computed(() => {
    const map = {};
    for (const j of jobHistoryForRank.value) {
        const u = j.user_name || j.user_id || j.user || '';
        if (u)
            map[u] = (map[u] || 0) + 1;
    }
    return Object.entries(map)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
});
// 用户使用节点数量排名（按节点数降序，取前8）
const userNodeRankList = computed(() => {
    const map = {};
    for (const j of jobHistoryForRank.value) {
        const u = j.user_name || j.user_id || j.user || '';
        const nodeCount = j.num_nodes || j.nodes || 1;
        if (u)
            map[u] = (map[u] || 0) + nodeCount;
    }
    return Object.entries(map)
        .map(([name, nodes]) => ({ name, nodes }))
        .sort((a, b) => b.nodes - a.nodes)
        .slice(0, 8);
});
// 用户存储使用排名（模拟数据，实际需要从API获取）
const userStorageRankList = computed(() => {
    // TODO: 从 /api/users 或 /api/files/quota 获取真实存储数据
    // 这里先用模拟数据展示
    const mockData = [
        { name: 'admin', storage: 1024 },
        { name: 'user1', storage: 856 },
        { name: 'user2', storage: 642 },
        { name: 'user3', storage: 512 },
        { name: 'user4', storage: 384 },
        { name: 'user5', storage: 256 },
        { name: 'user6', storage: 128 },
        { name: 'user7', storage: 96 },
        { name: 'user8', storage: 64 },
        { name: 'user9', storage: 32 },
    ];
    return mockData.sort((a, b) => b.storage - a.storage);
});
const clusterNodeStates = computed(() => {
    const r = { unschedulable: 0, busy: 0, normal: 0, idle: 0 };
    for (const n of nodes.value) {
        const s = (n.state || '').toLowerCase();
        if (s.includes('down') || s.includes('drain')) {
            r.unschedulable++;
            continue;
        }
        const u = n.cpuTotal > 0 ? n.cpuAlloc / n.cpuTotal : 0;
        if (u >= 0.7)
            r.busy++;
        else if (u >= 0.2)
            r.normal++;
        else
            r.idle++;
    }
    return r;
});
const clusterRes = computed(() => {
    // 优先用 dashboard/stats 的聚合数据，fallback 到 node-metrics 累加
    const cpuTotal = stats.value.totalCpus || nodes.value.reduce((s, n) => s + (n.cpuTotal || 0), 0);
    const cpuFree = Math.max(0, (stats.value.totalCpus || 0) - (stats.value.allocCpus || 0));
    const memTotal = stats.value.totalMemGb > 0 ? stats.value.totalMemGb : nodes.value.reduce((s, n) => s + (n.memTotal || 0), 0);
    const memFree = stats.value.freeMemGb > 0 ? stats.value.freeMemGb : nodes.value.reduce((s, n) => s + Math.max(0, (n.memTotal || 0) - (n.memAlloc || 0)), 0);
    return { cpuTotal: Math.round(cpuTotal), cpuFree: Math.round(cpuFree), memTotal: memTotal.toFixed(0), memFree: memFree.toFixed(0), gpuTotal: stats.value.totalGpus, gpuFree: Math.max(0, stats.value.totalGpus - stats.value.allocGpus) };
});
const totalCpuHours = computed(() => nodes.value.reduce((s, n) => s + (n.cpuAlloc || 0), 0));
// 算力估算：CPU FP64 ≈ 核数 × 16 GFLOPS，FP32 ≈ 核数 × 32 GFLOPS
// GPU FP32 ≈ GPU卡数 × 10 TFLOPS，FP16 × 2，INT8 × 4（典型A100/V100估算）
const cpuCompute = computed(() => {
    const cores = stats.value.totalCpus || nodes.value.reduce((s, n) => s + (n.cpuTotal || 0), 0);
    return {
        fp64: cores > 0 ? (cores * 16 / 1000).toFixed(1) : '--',
        fp32: cores > 0 ? (cores * 32 / 1000).toFixed(1) : '--',
    };
});
const gpuCompute = computed(() => {
    const gpus = stats.value.totalGpus;
    return {
        fp32: gpus > 0 ? (gpus * 10).toFixed(1) : '--',
        fp16: gpus > 0 ? (gpus * 20).toFixed(1) : '--',
        int8: gpus > 0 ? (gpus * 40).toFixed(1) : '--',
    };
});
const kpiList = computed(() => [
    { icon: '', label: '总节点数', val: stats.value.totalNodes, pct: 100, color: '#3b82f6' },
    { icon: '', label: 'CPU利用率', val: stats.value.cpuUtil + '%', pct: stats.value.cpuUtil, color: '#10b981' },
    { icon: '', label: '内存利用率', val: stats.value.memUtil + '%', pct: stats.value.memUtil, color: '#8b5cf6' },
    { icon: '', label: '运行作业', val: stats.value.runningJobs, pct: Math.min(100, stats.value.runningJobs * 5), color: '#f97316' },
    { icon: '', label: '活跃用户', val: stats.value.activeUsers + ' / ' + stats.value.totalUsers, pct: stats.value.totalUsers > 0 ? Math.round(stats.value.activeUsers / stats.value.totalUsers * 100) : 0, color: '#06b6d4' },
]);
const toggleFullscreen = () => {
    if (!dashEl.value)
        return;
    if (!document.fullscreenElement) {
        dashEl.value.requestFullscreen();
        isFullscreen.value = true;
    }
    else {
        document.exitFullscreen();
        isFullscreen.value = false;
    }
};
const jobPieEl = ref();
const queueEl = ref();
const clusterEl = ref();
const topoEl = ref();
const topoFlowEl = ref();
const jobCurveEl = ref();
const trendEl = ref();
const storageChartEl = ref();
const userRankChartEl = ref();
const nodeRankChartEl = ref();
let jobPie = null;
let queueChart = null;
let clusterChart = null;
let topoChart = null;
let storageChart = null;
let userRankChart = null;
let nodeRankChart = null;
// 流量粒子动画
let flowRaf = 0;
let flowLinks = [];
let particles = [];
let jobCurve = null;
let trendChart = null;
let gaugeCpu = null;
let gaugeMem = null;
let gaugeGpu = null;
const drawTopo = async () => {
    await nextTick();
    if (!topoEl.value)
        return;
    if (!topoChart) {
        topoChart = echarts.init(topoEl.value);
    }
    topoChart.resize();
    const W = topoEl.value.clientWidth || 400;
    const H = topoEl.value.clientHeight || 500;
    const graphNodes = [];
    const graphLinks = [];
    const rawLinks = [];
    const aggCount = Math.min(4, Math.max(2, Math.ceil(nodes.value.length / 8)));
    // 以 (0,0) 为中心的相对坐标，半径根据容器尺寸计算
    const AGG_R = Math.min(W, H) * 0.22;
    const NODE_R = Math.min(W, H) * 0.42;
    graphNodes.push({
        id: 'core', name: '核心交换机', x: 0, y: 0, symbolSize: 38,
        itemStyle: { color: '#6366f1', shadowBlur: 20, shadowColor: '#6366f1' },
        label: { show: true, color: '#e2e8f0', fontSize: 10, position: 'inside' },
    });
    for (let i = 0; i < aggCount; i++) {
        const angle = (i / aggCount) * Math.PI * 2 - Math.PI / 2;
        const id = `agg${i}`;
        graphNodes.push({
            id, name: `汇聚${i + 1}`,
            x: Math.cos(angle) * AGG_R,
            y: Math.sin(angle) * AGG_R,
            symbolSize: 26,
            itemStyle: { color: '#3b82f6', shadowBlur: 15, shadowColor: '#3b82f6' },
            label: { show: true, color: '#e2e8f0', fontSize: 9, position: 'inside' },
        });
        graphLinks.push({ source: 'core', target: id, lineStyle: { color: 'rgba(99,102,241,0.5)', width: 2 } });
        rawLinks.push({ src: 'core', tgt: id, active: true });
        const myNodes = nodes.value.length > 0
            ? nodes.value.filter((_, idx) => idx % aggCount === i)
            : Array.from({ length: 4 }, (_, j) => ({ name: `node${i * 4 + j + 1}`, state: 'idle', cpuAlloc: 0, cpuTotal: 8 }));
        const sliced = myNodes.slice(0, 8);
        const spread = Math.min(Math.PI * 0.55, sliced.length * 0.2);
        sliced.forEach((n, j) => {
            const na = angle + (sliced.length > 1 ? (j / (sliced.length - 1) - 0.5) * spread : 0);
            const nid = `n_${i}_${j}`;
            const nc = nodeColor(n.state);
            const hasTraffic = (n.cpuAlloc || 0) > 0
                || n.state?.toLowerCase().includes('alloc')
                || n.state?.toLowerCase().includes('mix');
            graphNodes.push({
                id: nid, name: n.name || `node${j + 1}`,
                x: Math.cos(na) * NODE_R,
                y: Math.sin(na) * NODE_R,
                symbolSize: 14,
                itemStyle: { color: nc, shadowBlur: 8, shadowColor: nc },
                label: { show: false },
            });
            graphLinks.push({
                source: id, target: nid,
                lineStyle: { color: hasTraffic ? 'rgba(59,130,246,0.6)' : 'rgba(59,130,246,0.2)', width: hasTraffic ? 1.5 : 1 },
            });
            rawLinks.push({ src: id, tgt: nid, active: hasTraffic });
        });
    }
    // 先渲染节点数据，zoom/center 在 setTimeout 里修正
    topoChart.setOption({
        backgroundColor: 'transparent',
        tooltip: { formatter: (p) => p.data?.name || '' },
        series: [{
                type: 'graph', layout: 'none', roam: true,
                zoom: 0.8, center: ['50%', '50%'],
                nodes: graphNodes, edges: graphLinks,
                lineStyle: { curveness: 0.06 },
                emphasis: { focus: 'adjacency' },
                animationDuration: 1000, animationEasing: 'elasticOut',
            }],
    });
    // 延迟读取容器尺寸，确保 DOM 已稳定渲染
    await nextTick();
    setTimeout(() => {
        if (!topoChart || !topoEl.value)
            return;
        topoChart.resize();
        const RW = topoEl.value.clientWidth || 400;
        const RH = topoEl.value.clientHeight || 500;
        const xs = graphNodes.map((n) => n.x);
        const ys = graphNodes.map((n) => n.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const spanX = maxX - minX || 1;
        const spanY = maxY - minY || 1;
        const gcx = (minX + maxX) / 2;
        const gcy = (minY + maxY) / 2;
        const zoom = Math.min((RW * 0.75) / spanX, (RH * 0.75) / spanY);
        topoChart.setOption({
            series: [{ zoom, center: [gcx, gcy] }]
        });
        startFlowAnimation(graphNodes, rawLinks);
    }, 150);
};
// 将图坐标系转换为 canvas 像素坐标 —— 使用 ECharts convertToPixel 精确对齐
const topoCoordToPixel = (nx, ny) => {
    if (!topoChart)
        return { x: 0, y: 0 };
    const pt = topoChart.convertToPixel({ seriesIndex: 0 }, [nx, ny]);
    return { x: pt[0], y: pt[1] };
};
const startFlowAnimation = (graphNodes, rawLinks) => {
    cancelAnimationFrame(flowRaf);
    const canvas = topoFlowEl.value;
    if (!canvas)
        return;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return;
    // canvas 尺寸与 echarts 容器保持一致
    const syncSize = () => {
        const parent = canvas.parentElement;
        if (parent) {
            canvas.width = parent.clientWidth;
            canvas.height = parent.clientHeight;
        }
    };
    syncSize();
    // 节点 id -> 图坐标
    const nodeMap = {};
    graphNodes.forEach(n => { nodeMap[n.id] = { x: n.x, y: n.y }; });
    // 只对有流量的链路生成粒子，存储图坐标（每帧用 convertToPixel 转换）
    flowLinks = rawLinks
        .filter(l => l.active && nodeMap[l.src] && nodeMap[l.tgt])
        .map(l => {
        const s = nodeMap[l.src], t = nodeMap[l.tgt];
        return { x1: s.x, y1: s.y, x2: t.x, y2: t.y, color: '#60a5fa', active: true };
    });
    // 初始化粒子，错开初始位置
    particles = [];
    flowLinks.forEach(link => {
        const count = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
            particles.push({ link, t: i / count, speed: 0.004 + Math.random() * 0.003 });
        }
    });
    const draw = () => {
        syncSize();
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        particles.forEach(p => {
            p.t += p.speed;
            if (p.t > 1)
                p.t -= 1;
            const { x1, y1, x2, y2 } = p.link;
            // 每帧通过 ECharts API 获取精确像素坐标
            const gx = x1 + (x2 - x1) * p.t;
            const gy = y1 + (y2 - y1) * p.t;
            const px = topoCoordToPixel(gx, gy);
            if (px.x === 0 && px.y === 0)
                return;
            // 粒子光晕
            const grad = ctx.createRadialGradient(px.x, px.y, 0, px.x, px.y, 6);
            grad.addColorStop(0, 'rgba(96,165,250,0.95)');
            grad.addColorStop(0.4, 'rgba(96,165,250,0.5)');
            grad.addColorStop(1, 'rgba(96,165,250,0)');
            ctx.beginPath();
            ctx.arc(px.x, px.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
            // 粒子核心
            ctx.beginPath();
            ctx.arc(px.x, px.y, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = '#e0f2fe';
            ctx.fill();
        });
        flowRaf = requestAnimationFrame(draw);
    };
    draw();
};
const nodeColor = (s) => {
    const st = (s || '').toLowerCase();
    if (st.includes('down') || st.includes('drain'))
        return '#ef4444';
    if (st.includes('alloc') || st.includes('mix'))
        return '#f59e0b';
    if (st.includes('idle'))
        return '#10b981';
    return '#6366f1';
};
const drawCluster = async () => {
    await nextTick();
    if (!clusterEl.value)
        return;
    if (!clusterChart)
        clusterChart = echarts.init(clusterEl.value);
    const cols = Math.max(4, Math.ceil(Math.sqrt(nodes.value.length || 16)));
    const data = nodes.value.length > 0
        ? nodes.value.map((n, i) => ({ value: [i % cols, Math.floor(i / cols), Math.random() * 60 + 20], name: n.name, itemStyle: { color: nodeColor(n.state), shadowBlur: 8, shadowColor: nodeColor(n.state) } }))
        : Array.from({ length: 16 }, (_, i) => ({ value: [i % 4, Math.floor(i / 4), Math.random() * 80 + 10], name: 'node' + (i + 1), itemStyle: { color: '#10b981', shadowBlur: 8, shadowColor: '#10b981' } }));
    clusterChart.setOption({
        backgroundColor: 'transparent',
        tooltip: { formatter: (p) => `${p.name}` },
        grid: { top: 5, right: 5, bottom: 5, left: 5 },
        xAxis: { type: 'value', show: false, min: -0.5, max: cols - 0.5 },
        yAxis: { type: 'value', show: false, min: -0.5 },
        series: [{ type: 'scatter', data, symbolSize: (v) => Math.max(14, Math.min(32, v[2] / 2.8)), emphasis: { scale: 1.6 }, animationDuration: 1000, animationEasing: 'elasticOut' }],
    });
};
const drawJobPie = async () => {
    await nextTick();
    if (!jobPieEl.value)
        return;
    if (!jobPie)
        jobPie = echarts.init(jobPieEl.value);
    const tv = themeVars.value;
    const t = stats.value.jobTypes;
    const data = [
        { name: 'MPI', value: t.mpi, color: '#3b82f6' },
        { name: 'OpenMP', value: t.openmp, color: '#8b5cf6' },
        { name: 'GPU', value: t.gpu, color: '#10b981' },
        { name: 'Array', value: t.array, color: '#f59e0b' },
        { name: 'Serial', value: t.serial, color: '#64748b' },
    ];
    // 无数据时显示占位
    const chartData = data.some(d => d.value > 0) ? data : [
        { name: 'MPI', value: 3, color: '#3b82f6' },
        { name: 'OpenMP', value: 2, color: '#8b5cf6' },
        { name: 'GPU', value: 2, color: '#10b981' },
        { name: 'Array', value: 1, color: '#f59e0b' },
        { name: 'Serial', value: 4, color: '#64748b' },
    ];
    jobPie.setOption({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { top: 10, right: 10, bottom: 25, left: 35 },
        xAxis: {
            type: 'category',
            data: chartData.map(d => d.name),
            axisLabel: { fontSize: 9, color: tv.chartText },
            axisLine: { lineStyle: { color: tv.axisLine } },
            axisTick: { show: false }
        },
        yAxis: {
            type: 'value',
            axisLabel: { fontSize: 9, color: tv.chartText },
            splitLine: { lineStyle: { color: tv.splitLine, type: 'dashed' } },
            axisLine: { show: false }
        },
        series: [{
                type: 'bar',
                data: chartData.map(d => ({ value: d.value, itemStyle: { color: d.color } })),
                barWidth: '50%',
                label: { show: true, position: 'top', fontSize: 10, color: tv.chartText, fontWeight: 600 },
                animationDelay: (idx) => idx * 100
            }],
    });
};
const drawQueue = async () => {
    await nextTick();
    if (!queueEl.value)
        return;
    if (!queueChart)
        queueChart = echarts.init(queueEl.value);
    const times = trendData.value.map(d => d.time);
    const tv = themeVars.value;
    queueChart.setOption({
        backgroundColor: 'transparent',
        grid: { top: 5, right: 5, bottom: 18, left: 28 },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: times, axisLabel: { fontSize: 9, color: tv.chartText }, axisLine: { lineStyle: { color: tv.axisLine } }, splitLine: { show: false } },
        yAxis: { type: 'value', axisLabel: { fontSize: 9, color: tv.chartText }, splitLine: { lineStyle: { color: tv.splitLine } }, axisLine: { show: false } },
        series: [{ type: 'bar', data: trendData.value.map(() => stats.value.pendingJobs), itemStyle: { color: '#f59e0b', borderRadius: [3, 3, 0, 0] }, barMaxWidth: 16 }],
    });
};
const drawJobCurve = async () => {
    await nextTick();
    if (!jobCurveEl.value)
        return;
    if (!jobCurve)
        jobCurve = echarts.init(jobCurveEl.value);
    jobCurve.resize();
    const times = trendData.value.map(d => d.time);
    const tv = themeVars.value;
    // 如果没有数据，生成一些默认时间点
    const displayTimes = times.length > 0 ? times : Array.from({ length: 10 }, (_, i) => {
        const d = new Date(Date.now() - (9 - i) * 60000);
        return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    });
    jobCurve.setOption({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis' },
        legend: { top: 2, right: 4, textStyle: { color: tv.chartText, fontSize: 9 }, itemWidth: 10, itemHeight: 6, itemGap: 8 },
        grid: { top: 28, right: 10, bottom: 25, left: 35 },
        xAxis: { type: 'category', data: displayTimes, axisLabel: { fontSize: 9, color: tv.chartText }, axisLine: { lineStyle: { color: tv.axisLine } }, splitLine: { show: false } },
        yAxis: { type: 'value', axisLabel: { fontSize: 9, color: tv.chartText }, splitLine: { lineStyle: { color: tv.splitLine } }, axisLine: { show: false } },
        series: [
            { name: '运行', type: 'line', smooth: true, symbol: 'circle', symbolSize: 4, data: trendData.value.length > 0 ? trendData.value.map(() => stats.value.runningJobs) : Array(10).fill(stats.value.runningJobs), lineStyle: { color: '#3b82f6', width: 2 }, areaStyle: { color: '#3b82f6', opacity: 0.15 } },
            { name: '排队', type: 'line', smooth: true, symbol: 'circle', symbolSize: 4, data: trendData.value.length > 0 ? trendData.value.map(() => stats.value.pendingJobs) : Array(10).fill(stats.value.pendingJobs), lineStyle: { color: '#f59e0b', width: 2 }, areaStyle: { color: '#f59e0b', opacity: 0.15 } },
        ],
    });
};
const drawTrend = async () => {
    await nextTick();
    if (!trendEl.value)
        return;
    if (!trendChart)
        trendChart = echarts.init(trendEl.value);
    trendChart.resize();
    const times = trendData.value.map(d => d.time);
    const tv = themeVars.value;
    const colorMap = { cpu: '#3b82f6', mem: '#8b5cf6', gpu: '#10b981' };
    const dataMap = { cpu: trendData.value.map(d => d.cpu), mem: trendData.value.map(d => d.mem), gpu: trendData.value.map(() => stats.value.cpuUtil) };
    const color = colorMap[trendTab.value];
    // 如果没有数据，生成一些默认时间点
    const displayTimes = times.length > 0 ? times : Array.from({ length: 10 }, (_, i) => {
        const d = new Date(Date.now() - (9 - i) * 60000);
        return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    });
    const displayData = dataMap[trendTab.value].length > 0 ? dataMap[trendTab.value] : Array(10).fill(stats.value.cpuUtil);
    trendChart.setOption({
        backgroundColor: 'transparent',
        grid: { top: 28, right: 10, bottom: 25, left: 35 },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: displayTimes, axisLabel: { fontSize: 9, color: tv.chartText }, axisLine: { lineStyle: { color: tv.axisLine } }, splitLine: { show: false } },
        yAxis: { type: 'value', axisLabel: { fontSize: 9, color: tv.chartText }, splitLine: { lineStyle: { color: tv.splitLine } }, axisLine: { show: false } },
        series: [{ type: 'line', smooth: true, symbol: 'circle', symbolSize: 4, data: displayData, lineStyle: { color, width: 2 }, areaStyle: { color, opacity: 0.15 } }],
    });
};
const drawStorageChart = async () => {
    await nextTick();
    if (!storageChartEl.value)
        return;
    if (!storageChart)
        storageChart = echarts.init(storageChartEl.value);
    const tv = themeVars.value;
    const data = userStorageRankList.value.slice(0, 10);
    if (data.length === 0)
        return;
    storageChart.setOption({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { top: 15, right: 15, bottom: 35, left: 45 },
        xAxis: {
            type: 'category',
            data: data.map(d => d.name),
            axisLabel: { fontSize: 8, color: tv.chartText, rotate: 25, interval: 0 },
            axisLine: { lineStyle: { color: tv.axisLine } },
            axisTick: { show: false }
        },
        yAxis: {
            type: 'value',
            name: 'GB',
            nameTextStyle: { fontSize: 9, color: tv.chartText },
            axisLabel: { fontSize: 9, color: tv.chartText },
            splitLine: { lineStyle: { color: tv.splitLine, type: 'dashed' } },
            axisLine: { show: false }
        },
        series: [{
                type: 'bar',
                data: data.map((d, i) => ({
                    value: d.storage,
                    itemStyle: {
                        color: i === 0 ? '#8b5cf6' : i === 1 ? '#3b82f6' : i === 2 ? '#10b981' : '#64748b'
                    }
                })),
                barWidth: '60%',
                label: { show: true, position: 'top', fontSize: 9, color: tv.chartText, fontWeight: 600 },
                animationDelay: (idx) => idx * 50
            }],
    });
};
const drawUserRankChart = async () => {
    await nextTick();
    if (!userRankChartEl.value)
        return;
    if (!userRankChart)
        userRankChart = echarts.init(userRankChartEl.value);
    const tv = themeVars.value;
    const data = userRankList.value.slice(0, 10);
    if (data.length === 0)
        return;
    userRankChart.setOption({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { top: 15, right: 15, bottom: 35, left: 45 },
        xAxis: {
            type: 'category',
            data: data.map(d => d.name),
            axisLabel: { fontSize: 8, color: tv.chartText, rotate: 25, interval: 0 },
            axisLine: { lineStyle: { color: tv.axisLine } },
            axisTick: { show: false }
        },
        yAxis: {
            type: 'value',
            name: '作业数',
            nameTextStyle: { fontSize: 9, color: tv.chartText },
            axisLabel: { fontSize: 9, color: tv.chartText },
            splitLine: { lineStyle: { color: tv.splitLine, type: 'dashed' } },
            axisLine: { show: false }
        },
        series: [{
                type: 'bar',
                data: data.map((d, i) => ({
                    value: d.count,
                    itemStyle: {
                        color: i === 0 ? '#f59e0b' : i === 1 ? '#3b82f6' : i === 2 ? '#10b981' : '#64748b'
                    }
                })),
                barWidth: '60%',
                label: { show: true, position: 'top', fontSize: 9, color: tv.chartText, fontWeight: 600 },
                animationDelay: (idx) => idx * 50
            }],
    });
};
const drawNodeRankChart = async () => {
    await nextTick();
    if (!nodeRankChartEl.value)
        return;
    if (!nodeRankChart)
        nodeRankChart = echarts.init(nodeRankChartEl.value);
    const tv = themeVars.value;
    const data = userNodeRankList.value.slice(0, 10);
    if (data.length === 0)
        return;
    nodeRankChart.setOption({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { top: 15, right: 15, bottom: 35, left: 45 },
        xAxis: {
            type: 'category',
            data: data.map(d => d.name),
            axisLabel: { fontSize: 8, color: tv.chartText, rotate: 25, interval: 0 },
            axisLine: { lineStyle: { color: tv.axisLine } },
            axisTick: { show: false }
        },
        yAxis: {
            type: 'value',
            name: '节点数',
            nameTextStyle: { fontSize: 9, color: tv.chartText },
            axisLabel: { fontSize: 9, color: tv.chartText },
            splitLine: { lineStyle: { color: tv.splitLine, type: 'dashed' } },
            axisLine: { show: false }
        },
        series: [{
                type: 'bar',
                data: data.map((d, i) => ({
                    value: d.nodes,
                    itemStyle: {
                        color: i === 0 ? '#10b981' : i === 1 ? '#3b82f6' : i === 2 ? '#8b5cf6' : '#64748b'
                    }
                })),
                barWidth: '60%',
                label: { show: true, position: 'top', fontSize: 9, color: tv.chartText, fontWeight: 600 },
                animationDelay: (idx) => idx * 50
            }],
    });
};
const drawAll = async () => {
    await drawTopo();
    await drawJobPie();
    await drawJobCurve();
    await drawTrend();
    await drawStorageChart();
    await drawUserRankChart();
    await drawNodeRankChart();
};
const api = (path) => fetch(`${getApiBase()}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } })
    .then(r => r.ok ? r.json() : null).catch(() => null);
const loadAll = async () => {
    loading.value = true;
    const sevenDaysAgo = Math.floor((Date.now() - 7 * 86400000) / 1000);
    const [nodeData, jobData, userData, dashData, historyData] = await Promise.all([
        api('/api/monitoring/node-metrics'),
        api('/api/jobs?page_size=100'),
        api('/api/users'),
        api('/api/dashboard/stats'),
        api(`/api/jobs?page_size=2000&start_time=${sevenDaysAgo}`),
    ]);
    // 从 dashboard/stats 拿真实核数、内存、GPU
    if (dashData?.data) {
        const d = dashData.data;
        stats.value.totalGpus = d.total_gpus || 0;
        stats.value.allocGpus = d.allocated_gpus || 0;
        stats.value.totalCpus = d.total_cpus || 0;
        stats.value.allocCpus = d.allocated_cpus || 0;
        stats.value.totalMemGb = d.total_memory_gb || 0;
        stats.value.freeMemGb = d.free_memory_gb || 0;
        // CPU 利用率用 Slurm 分配率
        const tc = d.total_cpus || 0;
        const ac = d.allocated_cpus || 0;
        stats.value.cpuUtil = tc > 0 ? Math.round(ac / tc * 100) : 0;
        // 内存利用率
        const mt = d.total_memory_gb || 0;
        const mf = d.free_memory_gb || 0;
        stats.value.memUtil = mt > 0 ? Math.round((mt - mf) / mt * 100) : 0;
    }
    if (nodeData?.nodes) {
        const ns = nodeData.nodes.map((n) => ({
            name: n.instance?.replace(/:\d+$/, '') || '',
            state: n.up === false ? 'down' : 'idle',
            cpuAlloc: 0, // node-metrics 不含分配数，用 dashboard/stats 的聚合值
            cpuTotal: 0,
            memTotal: n.mem_total_gb || 0,
            memAlloc: n.mem_used_gb || 0,
        }));
        nodes.value = ns;
        stats.value.totalNodes = ns.length;
        // 如果 Prometheus 有数据，用实际 CPU 使用率覆盖
        if (nodeData.connected) {
            const avgCpu = nodeData.nodes.reduce((s, n) => s + (n.cpu_usage || 0), 0) / (nodeData.nodes.length || 1);
            stats.value.cpuUtil = Math.round(avgCpu);
            const totalMem = nodeData.nodes.reduce((s, n) => s + (n.mem_total_gb || 0), 0);
            const usedMem = nodeData.nodes.reduce((s, n) => s + (n.mem_used_gb || 0), 0);
            stats.value.memUtil = totalMem > 0 ? Math.round(usedMem / totalMem * 100) : 0;
        }
    }
    if (jobData?.data) {
        const jobs = jobData.data;
        stats.value.runningJobs = jobs.filter((j) => j.job_state === 'RUNNING').length;
        stats.value.pendingJobs = jobs.filter((j) => j.job_state === 'PENDING').length;
        stats.value.completedJobs = jobs.length;
        stats.value.activeUsers = new Set(jobs.map((j) => j.user_name).filter(Boolean)).size;
        // 推断作业类型：优先用 job_type 字段，否则按特征推断
        const types = { mpi: 0, openmp: 0, gpu: 0, array: 0, serial: 0 };
        jobs.forEach((j) => {
            const jt = (j.job_type || j.type || '').toLowerCase();
            const name = (j.name || j.job_name || '').toLowerCase();
            const numTasks = j.num_tasks || j.ntasks || 1;
            const numNodes = j.num_nodes || j.nodes || 1;
            const gresStr = (j.tres_req_str || j.gres || j.tres || '').toLowerCase();
            const arrayId = j.array_job_id || j.array_task_id;
            if (arrayId && arrayId !== '0') {
                types.array++;
            }
            else if (jt.includes('mpi') || name.includes('mpi') || (numTasks > 1 && numNodes > 1)) {
                types.mpi++;
            }
            else if (gresStr.includes('gpu') || name.includes('gpu') || jt.includes('gpu')) {
                types.gpu++;
            }
            else if (jt.includes('omp') || name.includes('omp') || name.includes('openmp') || (numTasks > 1 && numNodes <= 1)) {
                types.openmp++;
            }
            else {
                types.serial++;
            }
        });
        stats.value.jobTypes = types;
    }
    if (userData?.data)
        stats.value.totalUsers = userData.data.length;
    if (historyData?.data)
        jobHistoryForRank.value = historyData.data;
    trendData.value.push({ time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }), cpu: stats.value.cpuUtil, mem: stats.value.memUtil });
    if (trendData.value.length > 20)
        trendData.value.shift();
    loading.value = false;
    drawAll();
};
onMounted(() => {
    const tick = () => { const n = new Date(); currentTime.value = n.toLocaleTimeString('zh-CN'); currentDate.value = n.toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); };
    tick();
    clockTimer = setInterval(tick, 1000);
    // 监听主题变化，重绘所有图表
    themeObserver = new MutationObserver(() => {
        currentTheme.value = document.documentElement.getAttribute('data-theme') || 'light';
        [jobPie, queueChart, clusterChart, topoChart, jobCurve, trendChart, storageChart, userRankChart, nodeRankChart].forEach(c => c?.dispose());
        jobPie = null;
        queueChart = null;
        clusterChart = null;
        topoChart = null;
        jobCurve = null;
        trendChart = null;
        storageChart = null;
        userRankChart = null;
        nodeRankChart = null;
        drawAll();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    loadAll();
    refreshTimer = setInterval(loadAll, 30000);
});
onUnmounted(() => {
    clearInterval(clockTimer);
    clearInterval(refreshTimer);
    cancelAnimationFrame(flowRaf);
    themeObserver?.disconnect();
    [jobPie, queueChart, clusterChart, jobCurve, trendChart, storageChart, userRankChart, nodeRankChart].forEach(c => c?.dispose());
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['db-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['db-kpi']} */ ;
/** @type {__VLS_StyleScopedClasses['db-card']} */ ;
/** @type {__VLS_StyleScopedClasses['db-chart-h160']} */ ;
/** @type {__VLS_StyleScopedClasses['db-topo-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['db-chart-fill']} */ ;
/** @type {__VLS_StyleScopedClasses['db-compute-item']} */ ;
/** @type {__VLS_StyleScopedClasses['db-res-item']} */ ;
/** @type {__VLS_StyleScopedClasses['db-card']} */ ;
/** @type {__VLS_StyleScopedClasses['db-leg']} */ ;
/** @type {__VLS_StyleScopedClasses['db-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['db-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['db-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['db-alert-item']} */ ;
/** @type {__VLS_StyleScopedClasses['db-alert-error']} */ ;
/** @type {__VLS_StyleScopedClasses['db-alert-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['db-alert-info']} */ ;
/** @type {__VLS_StyleScopedClasses['db-alert-error']} */ ;
/** @type {__VLS_StyleScopedClasses['db-alert-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['db-alert-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['db-alert-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['db-alert-info']} */ ;
/** @type {__VLS_StyleScopedClasses['db-alert-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['db-col-right']} */ ;
/** @type {__VLS_StyleScopedClasses['db-card-fill']} */ ;
/** @type {__VLS_StyleScopedClasses['db-chart-fill']} */ ;
/** @type {__VLS_StyleScopedClasses['db-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['db-leg']} */ ;
/** @type {__VLS_StyleScopedClasses['db-leg']} */ ;
/** @type {__VLS_StyleScopedClasses['db-rank-bar-item']} */ ;
/** @type {__VLS_StyleScopedClasses['db-rank-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['db-rank-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['db-rank-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['db-rank-bar-fill']} */ ;
/** @type {__VLS_StyleScopedClasses['db-main']} */ ;
/** @type {__VLS_StyleScopedClasses['db-kpi-row']} */ ;
/** @type {__VLS_StyleScopedClasses['db-main']} */ ;
/** @type {__VLS_StyleScopedClasses['db-bottom']} */ ;
/** @type {__VLS_StyleScopedClasses['db-main']} */ ;
/** @type {__VLS_StyleScopedClasses['db-col']} */ ;
/** @type {__VLS_StyleScopedClasses['db-bottom']} */ ;
/** @type {__VLS_StyleScopedClasses['db-kpi-row']} */ ;
/** @type {__VLS_StyleScopedClasses['db-kpi-row']} */ ;
/** @type {__VLS_StyleScopedClasses['db-bottom']} */ ;
/** @type {__VLS_StyleScopedClasses['db-main']} */ ;
/** @type {__VLS_StyleScopedClasses['db-bottom']} */ ;
/** @type {__VLS_StyleScopedClasses['db-kpi-row']} */ ;
/** @type {__VLS_StyleScopedClasses['db-main']} */ ;
/** @type {__VLS_StyleScopedClasses['db-bottom']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db" },
    ref: "dashEl",
    ...{ style: ({
            '--db-bg': __VLS_ctx.themeVars.bg,
            '--db-header-bg': __VLS_ctx.themeVars.headerBg,
            '--db-header-border': __VLS_ctx.themeVars.headerBorder,
            '--db-card-bg': __VLS_ctx.themeVars.cardBg,
            '--db-card-border': __VLS_ctx.themeVars.cardBorder,
            '--db-kpi-bg': __VLS_ctx.themeVars.kpiBg,
            '--db-text': __VLS_ctx.themeVars.text,
            '--db-sub': __VLS_ctx.themeVars.subText,
            '--db-res-bg': __VLS_ctx.themeVars.resBg,
        }) },
});
/** @type {__VLS_StyleScopedClasses['db']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-header" },
});
/** @type {__VLS_StyleScopedClasses['db-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-header-left" },
});
/** @type {__VLS_StyleScopedClasses['db-header-left']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-logo" },
});
/** @type {__VLS_StyleScopedClasses['db-logo']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-title" },
});
/** @type {__VLS_StyleScopedClasses['db-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-subtitle" },
});
/** @type {__VLS_StyleScopedClasses['db-subtitle']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-header-center" },
});
/** @type {__VLS_StyleScopedClasses['db-header-center']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-time" },
});
/** @type {__VLS_StyleScopedClasses['db-time']} */ ;
(__VLS_ctx.currentTime);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-date" },
});
/** @type {__VLS_StyleScopedClasses['db-date']} */ ;
(__VLS_ctx.currentDate);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-header-right" },
});
/** @type {__VLS_StyleScopedClasses['db-header-right']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: (['db-status', __VLS_ctx.alertCount > 0 ? 'db-status-warn' : 'db-status-ok']) },
});
/** @type {__VLS_StyleScopedClasses['db-status']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "db-status-dot" },
});
/** @type {__VLS_StyleScopedClasses['db-status-dot']} */ ;
(__VLS_ctx.alertCount > 0 ? __VLS_ctx.alertCount + ' 条告警' : '系统正常');
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.loadAll) },
    ...{ class: "db-btn" },
    disabled: (__VLS_ctx.loading),
});
/** @type {__VLS_StyleScopedClasses['db-btn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.toggleFullscreen) },
    ...{ class: "db-btn" },
});
/** @type {__VLS_StyleScopedClasses['db-btn']} */ ;
(__VLS_ctx.isFullscreen ? '⊠' : '⛶');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-kpi-row" },
});
/** @type {__VLS_StyleScopedClasses['db-kpi-row']} */ ;
for (const [k] of __VLS_vFor((__VLS_ctx.kpiList))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "db-kpi" },
        key: (k.label),
        ...{ style: ({ '--kc': k.color }) },
    });
    /** @type {__VLS_StyleScopedClasses['db-kpi']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "db-kpi-accent" },
    });
    /** @type {__VLS_StyleScopedClasses['db-kpi-accent']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "db-kpi-val" },
    });
    /** @type {__VLS_StyleScopedClasses['db-kpi-val']} */ ;
    (k.val);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "db-kpi-label" },
    });
    /** @type {__VLS_StyleScopedClasses['db-kpi-label']} */ ;
    (k.label);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "db-kpi-bar" },
    });
    /** @type {__VLS_StyleScopedClasses['db-kpi-bar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "db-kpi-bar-fill" },
        ...{ style: ({ width: k.pct + '%' }) },
    });
    /** @type {__VLS_StyleScopedClasses['db-kpi-bar-fill']} */ ;
    // @ts-ignore
    [themeVars, themeVars, themeVars, themeVars, themeVars, themeVars, themeVars, themeVars, themeVars, currentTime, currentDate, alertCount, alertCount, alertCount, loadAll, loading, toggleFullscreen, isFullscreen, kpiList,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-main" },
});
/** @type {__VLS_StyleScopedClasses['db-main']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-col db-col-left" },
});
/** @type {__VLS_StyleScopedClasses['db-col']} */ ;
/** @type {__VLS_StyleScopedClasses['db-col-left']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-card db-card-fixed" },
});
/** @type {__VLS_StyleScopedClasses['db-card']} */ ;
/** @type {__VLS_StyleScopedClasses['db-card-fixed']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-card-title" },
});
/** @type {__VLS_StyleScopedClasses['db-card-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-section" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-section']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-type" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-type']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-items" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-items']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-item" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-label" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-val" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['db-compute-val']} */ ;
(__VLS_ctx.cpuCompute.fp64);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-unit" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-unit']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-item" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-label" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-val" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['db-compute-val']} */ ;
(__VLS_ctx.cpuCompute.fp32);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-unit" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-unit']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-used" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-used']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "db-compute-used-label" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-used-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "db-compute-used-val" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-used-val']} */ ;
(__VLS_ctx.clusterRes.cpuTotal - __VLS_ctx.clusterRes.cpuFree);
(__VLS_ctx.clusterRes.cpuTotal);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-divider" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-divider']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-section" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-section']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-type" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-type']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-items db-compute-items-3" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-items']} */ ;
/** @type {__VLS_StyleScopedClasses['db-compute-items-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-item" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-label" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-val" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['db-compute-val']} */ ;
(__VLS_ctx.gpuCompute.fp32);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-unit" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-unit']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-item" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-label" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-val" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['db-compute-val']} */ ;
(__VLS_ctx.gpuCompute.fp16);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-unit" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-unit']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-item" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-label" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-val" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['db-compute-val']} */ ;
(__VLS_ctx.gpuCompute.int8);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-unit" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-unit']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-compute-used" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-used']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "db-compute-used-label" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-used-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "db-compute-used-val" },
});
/** @type {__VLS_StyleScopedClasses['db-compute-used-val']} */ ;
(__VLS_ctx.clusterRes.gpuTotal - __VLS_ctx.clusterRes.gpuFree);
(__VLS_ctx.clusterRes.gpuTotal);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-card db-card-fixed" },
});
/** @type {__VLS_StyleScopedClasses['db-card']} */ ;
/** @type {__VLS_StyleScopedClasses['db-card-fixed']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-card-title" },
});
/** @type {__VLS_StyleScopedClasses['db-card-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-res-grid" },
});
/** @type {__VLS_StyleScopedClasses['db-res-grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-res-item" },
});
/** @type {__VLS_StyleScopedClasses['db-res-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-res-val" },
});
/** @type {__VLS_StyleScopedClasses['db-res-val']} */ ;
(__VLS_ctx.clusterRes.cpuTotal);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-res-label" },
});
/** @type {__VLS_StyleScopedClasses['db-res-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-res-item" },
});
/** @type {__VLS_StyleScopedClasses['db-res-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-res-val" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['db-res-val']} */ ;
(__VLS_ctx.clusterRes.cpuFree);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-res-label" },
});
/** @type {__VLS_StyleScopedClasses['db-res-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-res-item" },
});
/** @type {__VLS_StyleScopedClasses['db-res-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-res-val" },
});
/** @type {__VLS_StyleScopedClasses['db-res-val']} */ ;
(__VLS_ctx.clusterRes.memTotal);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-res-label" },
});
/** @type {__VLS_StyleScopedClasses['db-res-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-res-item" },
});
/** @type {__VLS_StyleScopedClasses['db-res-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-res-val" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['db-res-val']} */ ;
(__VLS_ctx.clusterRes.memFree);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-res-label" },
});
/** @type {__VLS_StyleScopedClasses['db-res-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-res-item" },
});
/** @type {__VLS_StyleScopedClasses['db-res-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-res-val" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['db-res-val']} */ ;
(__VLS_ctx.clusterRes.gpuTotal);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-res-label" },
});
/** @type {__VLS_StyleScopedClasses['db-res-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-res-item" },
});
/** @type {__VLS_StyleScopedClasses['db-res-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-res-val" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['db-res-val']} */ ;
(__VLS_ctx.clusterRes.gpuFree);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-res-label" },
});
/** @type {__VLS_StyleScopedClasses['db-res-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-card db-card-fill" },
});
/** @type {__VLS_StyleScopedClasses['db-card']} */ ;
/** @type {__VLS_StyleScopedClasses['db-card-fill']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-card-title" },
});
/** @type {__VLS_StyleScopedClasses['db-card-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "jobPieEl",
    ...{ class: "db-chart-fill" },
});
/** @type {__VLS_StyleScopedClasses['db-chart-fill']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-col db-col-center" },
});
/** @type {__VLS_StyleScopedClasses['db-col']} */ ;
/** @type {__VLS_StyleScopedClasses['db-col-center']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-card db-card-fill" },
});
/** @type {__VLS_StyleScopedClasses['db-card']} */ ;
/** @type {__VLS_StyleScopedClasses['db-card-fill']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-card-header" },
});
/** @type {__VLS_StyleScopedClasses['db-card-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "db-card-title" },
});
/** @type {__VLS_StyleScopedClasses['db-card-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-legend" },
});
/** @type {__VLS_StyleScopedClasses['db-legend']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "db-leg" },
});
/** @type {__VLS_StyleScopedClasses['db-leg']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({
    ...{ style: {} },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "db-leg" },
});
/** @type {__VLS_StyleScopedClasses['db-leg']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({
    ...{ style: {} },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "db-leg" },
});
/** @type {__VLS_StyleScopedClasses['db-leg']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({
    ...{ style: {} },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "db-leg" },
});
/** @type {__VLS_StyleScopedClasses['db-leg']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({
    ...{ style: {} },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-topo-wrap" },
});
/** @type {__VLS_StyleScopedClasses['db-topo-wrap']} */ ;
const __VLS_0 = Cluster3DTopology;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    nodes: (__VLS_ctx.nodes),
    isDark: (__VLS_ctx.isDark),
}));
const __VLS_2 = __VLS_1({
    nodes: (__VLS_ctx.nodes),
    isDark: (__VLS_ctx.isDark),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-node-stats" },
});
/** @type {__VLS_StyleScopedClasses['db-node-stats']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-ns-item" },
});
/** @type {__VLS_StyleScopedClasses['db-ns-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-ns-num" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['db-ns-num']} */ ;
(__VLS_ctx.clusterNodeStates.unschedulable);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-ns-label" },
});
/** @type {__VLS_StyleScopedClasses['db-ns-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-ns-item" },
});
/** @type {__VLS_StyleScopedClasses['db-ns-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-ns-num" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['db-ns-num']} */ ;
(__VLS_ctx.clusterNodeStates.busy);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-ns-label" },
});
/** @type {__VLS_StyleScopedClasses['db-ns-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-ns-item" },
});
/** @type {__VLS_StyleScopedClasses['db-ns-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-ns-num" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['db-ns-num']} */ ;
(__VLS_ctx.clusterNodeStates.normal);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-ns-label" },
});
/** @type {__VLS_StyleScopedClasses['db-ns-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-ns-item" },
});
/** @type {__VLS_StyleScopedClasses['db-ns-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-ns-num" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['db-ns-num']} */ ;
(__VLS_ctx.clusterNodeStates.idle);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-ns-label" },
});
/** @type {__VLS_StyleScopedClasses['db-ns-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-col db-col-right" },
});
/** @type {__VLS_StyleScopedClasses['db-col']} */ ;
/** @type {__VLS_StyleScopedClasses['db-col-right']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-card db-card-rank" },
});
/** @type {__VLS_StyleScopedClasses['db-card']} */ ;
/** @type {__VLS_StyleScopedClasses['db-card-rank']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-card-header" },
});
/** @type {__VLS_StyleScopedClasses['db-card-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "db-card-title" },
});
/** @type {__VLS_StyleScopedClasses['db-card-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "db-rank-meta" },
});
/** @type {__VLS_StyleScopedClasses['db-rank-meta']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "userRankChartEl",
    ...{ class: "db-chart-fill" },
});
/** @type {__VLS_StyleScopedClasses['db-chart-fill']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-card db-card-rank" },
});
/** @type {__VLS_StyleScopedClasses['db-card']} */ ;
/** @type {__VLS_StyleScopedClasses['db-card-rank']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-card-header" },
});
/** @type {__VLS_StyleScopedClasses['db-card-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "db-card-title" },
});
/** @type {__VLS_StyleScopedClasses['db-card-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "db-rank-meta" },
});
/** @type {__VLS_StyleScopedClasses['db-rank-meta']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "nodeRankChartEl",
    ...{ class: "db-chart-fill" },
});
/** @type {__VLS_StyleScopedClasses['db-chart-fill']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-card db-card-rank" },
});
/** @type {__VLS_StyleScopedClasses['db-card']} */ ;
/** @type {__VLS_StyleScopedClasses['db-card-rank']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-card-header" },
});
/** @type {__VLS_StyleScopedClasses['db-card-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "db-card-title" },
});
/** @type {__VLS_StyleScopedClasses['db-card-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "db-rank-meta" },
});
/** @type {__VLS_StyleScopedClasses['db-rank-meta']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "storageChartEl",
    ...{ class: "db-chart-fill" },
});
/** @type {__VLS_StyleScopedClasses['db-chart-fill']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-bottom" },
});
/** @type {__VLS_StyleScopedClasses['db-bottom']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-card db-card-bottom" },
});
/** @type {__VLS_StyleScopedClasses['db-card']} */ ;
/** @type {__VLS_StyleScopedClasses['db-card-bottom']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-card-header" },
});
/** @type {__VLS_StyleScopedClasses['db-card-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "db-card-title" },
});
/** @type {__VLS_StyleScopedClasses['db-card-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-legend" },
});
/** @type {__VLS_StyleScopedClasses['db-legend']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "db-leg" },
});
/** @type {__VLS_StyleScopedClasses['db-leg']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({
    ...{ style: {} },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "db-leg" },
});
/** @type {__VLS_StyleScopedClasses['db-leg']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({
    ...{ style: {} },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "jobCurveEl",
    ...{ class: "db-chart-bottom" },
});
/** @type {__VLS_StyleScopedClasses['db-chart-bottom']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-card db-card-bottom" },
});
/** @type {__VLS_StyleScopedClasses['db-card']} */ ;
/** @type {__VLS_StyleScopedClasses['db-card-bottom']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-card-header" },
});
/** @type {__VLS_StyleScopedClasses['db-card-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "db-card-title" },
});
/** @type {__VLS_StyleScopedClasses['db-card-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-tabs" },
});
/** @type {__VLS_StyleScopedClasses['db-tabs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.trendTab = 'cpu';
            __VLS_ctx.drawTrend();
            // @ts-ignore
            [cpuCompute, cpuCompute, clusterRes, clusterRes, clusterRes, clusterRes, clusterRes, clusterRes, clusterRes, clusterRes, clusterRes, clusterRes, clusterRes, clusterRes, gpuCompute, gpuCompute, gpuCompute, nodes, isDark, clusterNodeStates, clusterNodeStates, clusterNodeStates, clusterNodeStates, trendTab, drawTrend,];
        } },
    ...{ class: (['db-tab', __VLS_ctx.trendTab === 'cpu' && 'active']) },
});
/** @type {__VLS_StyleScopedClasses['db-tab']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.trendTab = 'mem';
            __VLS_ctx.drawTrend();
            // @ts-ignore
            [trendTab, trendTab, drawTrend,];
        } },
    ...{ class: (['db-tab', __VLS_ctx.trendTab === 'mem' && 'active']) },
});
/** @type {__VLS_StyleScopedClasses['db-tab']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.trendTab = 'gpu';
            __VLS_ctx.drawTrend();
            // @ts-ignore
            [trendTab, trendTab, drawTrend,];
        } },
    ...{ class: (['db-tab', __VLS_ctx.trendTab === 'gpu' && 'active']) },
});
/** @type {__VLS_StyleScopedClasses['db-tab']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "trendEl",
    ...{ class: "db-chart-bottom" },
});
/** @type {__VLS_StyleScopedClasses['db-chart-bottom']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-card db-card-bottom" },
});
/** @type {__VLS_StyleScopedClasses['db-card']} */ ;
/** @type {__VLS_StyleScopedClasses['db-card-bottom']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-card-header" },
});
/** @type {__VLS_StyleScopedClasses['db-card-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "db-card-title" },
});
/** @type {__VLS_StyleScopedClasses['db-card-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "db-rank-meta" },
});
/** @type {__VLS_StyleScopedClasses['db-rank-meta']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "db-alert-list" },
});
/** @type {__VLS_StyleScopedClasses['db-alert-list']} */ ;
if (__VLS_ctx.recentAlerts.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "db-alert-empty" },
    });
    /** @type {__VLS_StyleScopedClasses['db-alert-empty']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "db-alert-ok-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['db-alert-ok-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "db-alert-ok-text" },
    });
    /** @type {__VLS_StyleScopedClasses['db-alert-ok-text']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "db-alert-ok-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['db-alert-ok-sub']} */ ;
}
for (const [a] of __VLS_vFor((__VLS_ctx.recentAlerts))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (a.id),
        ...{ class: (['db-alert-item', 'db-alert-' + a.level]) },
    });
    /** @type {__VLS_StyleScopedClasses['db-alert-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "db-alert-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['db-alert-icon']} */ ;
    if (a.level === 'error') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    }
    else if (a.level === 'warning') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "db-alert-content" },
    });
    /** @type {__VLS_StyleScopedClasses['db-alert-content']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "db-alert-name" },
    });
    /** @type {__VLS_StyleScopedClasses['db-alert-name']} */ ;
    (a.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "db-alert-time" },
    });
    /** @type {__VLS_StyleScopedClasses['db-alert-time']} */ ;
    (a.time);
    // @ts-ignore
    [trendTab, recentAlerts, recentAlerts,];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
