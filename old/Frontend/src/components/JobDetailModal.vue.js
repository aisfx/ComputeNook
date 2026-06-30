import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { fileManagerApi } from '../config/api';
import { getToken, getApiBase } from '../utils/auth';
import { dialog } from '../utils/dialog';
echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);
const props = defineProps();
const emit = defineEmits(['close', 'pause', 'resume', 'cancel', 'open-directory', 'exec-container']);
const refreshing = ref(false);
const execIntoContainer = () => {
    // 取第一个节点名（计算节点）
    const node = (props.job.nodeNames && props.job.nodeNames[0]) || props.job.nodes;
    if (!node) {
        dialog.warning('无法获取作业运行节点');
        return;
    }
    const jobId = props.job.id;
    // 直接 SSH 到计算节点后，在节点上找到 pyxis 容器实例并进入
    // 不使用 srun（会重新申请资源导致卡住），而是直接在节点上执行 enroot start
    const initCommand = `echo "→ 正在查找作业 ${jobId} 的容器实例..."\n` +
        `INSTANCE=$(enroot list 2>/dev/null | grep "^pyxis_${jobId}\\." | head -1)\n` +
        `if [ -n "$INSTANCE" ]; then\n` +
        `  echo "进入容器: $INSTANCE"\n` +
        `  enroot start -r "$INSTANCE"\n` +
        `else\n` +
        `  echo "未找到容器实例 pyxis_${jobId}.* ，请确认作业正在运行中"\n` +
        `fi\n`;
    emit('exec-container', {
        node,
        jobId,
        initCommand,
    });
    emit('close');
};
const showSaveImage = ref(false);
const saveImageName = ref('');
const saveImageTag = ref('latest');
const saving = ref(false);
const saveResult = ref(null);
const saveTask = ref(null);
let saveTaskPollTimer = null;
const closeSaveImage = () => {
    showSaveImage.value = false;
    saveResult.value = null;
    saveTask.value = null;
    saveImageName.value = '';
    saveImageTag.value = 'latest';
    if (saveTaskPollTimer) {
        clearInterval(saveTaskPollTimer);
        saveTaskPollTimer = null;
    }
};
const pollSaveTask = (taskId) => {
    if (saveTaskPollTimer)
        clearInterval(saveTaskPollTimer);
    saveTaskPollTimer = setInterval(async () => {
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const res = await fetch(`${getApiBase()}/api/registry/images/save/task/${taskId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok)
                return;
            const data = await res.json();
            saveTask.value = data.data;
            if (data.data?.status === 'done' || data.data?.status === 'error') {
                clearInterval(saveTaskPollTimer);
                saveTaskPollTimer = null;
            }
        }
        catch { /* ignore */ }
    }, 2000);
};
const doSaveImage = async () => {
    if (!saveImageName.value.trim()) {
        saveResult.value = { ok: false, msg: '请填写镜像名称' };
        return;
    }
    saving.value = true;
    saveResult.value = null;
    saveTask.value = null;
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const res = await fetch(`${getApiBase()}/api/registry/images/save`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                job_id: props.job.id,
                image_name: saveImageName.value.trim(),
                tag: saveImageTag.value || 'latest'
            })
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || '保存失败');
        // 开始轮询任务进度
        if (data.task_id) {
            saveTask.value = { task_id: data.task_id, status: 'pending', step: 0, total_steps: 4, step_desc: '准备中...', target_image: data.target_image };
            pollSaveTask(data.task_id);
        }
    }
    catch (e) {
        saveResult.value = { ok: false, msg: e.message };
    }
    finally {
        saving.value = false;
    }
};
const lastUpdateTime = ref(new Date().toLocaleTimeString());
const autoRefreshInterval = ref(null);
const promConnected = ref(false);
const currentUsage = ref({ cpu: 0, memory: 0, load: 0, netRx: 0, netTx: 0, disk: 0 });
// echarts 图表实例
const chartCpuEl = ref();
const chartMemEl = ref();
const chartNetEl = ref();
let chartCpu = null;
let chartMem = null;
let chartNet = null;
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];
// 获取作业开始时间戳（秒）
const jobStartTs = () => {
    if (props.job.start_time && typeof props.job.start_time === 'number')
        return props.job.start_time;
    // 尝试从 startTime 字符串解析
    if (props.job.startTime && props.job.startTime !== '-') {
        const t = new Date(props.job.startTime).getTime();
        if (!isNaN(t))
            return Math.floor(t / 1000);
    }
    // 默认：当前时间往前 1 小时
    return Math.floor(Date.now() / 1000) - 3600;
};
// 查询 Prometheus range 数据，返回 { instance: string, times: number[], values: number[] }[]
const queryRange = async (promql) => {
    const start = jobStartTs();
    const end = Math.floor(Date.now() / 1000);
    const duration = end - start;
    const step = Math.max(15, Math.floor(duration / 120)); // 最多 120 个点
    const url = `${getApiBase()}/api/monitoring/promql/range?query=${encodeURIComponent(promql)}&start=${start}&end=${end}&step=${step}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok)
        return [];
    const data = await res.json();
    if (data.status !== 'success')
        return [];
    return (data.data?.result || []).map((r) => ({
        instance: r.metric?.instance?.replace(/:\d+$/, '') || r.metric?.nodename || Object.values(r.metric || {}).join(','),
        times: (r.values || []).map((v) => v[0] * 1000),
        values: (r.values || []).map((v) => parseFloat(parseFloat(v[1]).toFixed(2))),
    }));
};
// 过滤只保留作业节点的数据
const filterJobNodes = (series) => {
    const nodeNames = props.job.nodeNames || [];
    if (!nodeNames.length)
        return series;
    return series.filter(s => nodeNames.some(n => s.instance.includes(n) || n.includes(s.instance)));
};
const initChart = (el, title) => {
    if (!el)
        return null;
    const c = echarts.init(el, undefined, { renderer: 'canvas' });
    c.setOption({
        animation: false,
        grid: { top: 28, right: 12, bottom: 28, left: 42 },
        tooltip: {
            trigger: 'axis',
            formatter: (params) => {
                const time = new Date(params[0]?.axisValue).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                return time + '<br>' + params.map((p) => `${p.marker}${p.seriesName}: <b>${p.value}</b>`).join('<br>');
            }
        },
        legend: { top: 2, right: 0, textStyle: { fontSize: 10 }, itemWidth: 12, itemHeight: 8 },
        xAxis: { type: 'time', axisLabel: { fontSize: 10, formatter: (v) => new Date(v).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) } },
        yAxis: { type: 'value', axisLabel: { fontSize: 10 }, min: 0 },
        series: [],
    });
    return c;
};
const updateChart = (chart, seriesData, unit = '%', maxY) => {
    if (!chart)
        return;
    const series = seriesData.map((s, i) => ({
        name: s.instance,
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1.5, color: COLORS[i % COLORS.length] },
        itemStyle: { color: COLORS[i % COLORS.length] },
        data: s.times.map((t, j) => [t, s.values[j]]),
        areaStyle: seriesData.length === 1 ? { opacity: 0.08, color: COLORS[0] } : undefined,
    }));
    chart.setOption({
        yAxis: { max: maxY, axisLabel: { formatter: (v) => v + unit } },
        series,
    }, { replaceMerge: ['series'] });
};
const refreshResourceUsage = async () => {
    refreshing.value = true;
    try {
        const token = getToken();
        // 当前快照（进度条用）
        const snapRes = await fetch(`${getApiBase()}/api/monitoring/node-metrics`, { headers: { Authorization: `Bearer ${token}` } });
        if (snapRes.ok) {
            const data = await snapRes.json();
            promConnected.value = data.connected === true;
            if (data.connected && data.nodes?.length) {
                const nodeNames = props.job.nodeNames || [];
                const jobNodes = nodeNames.length > 0
                    ? data.nodes.filter((n) => nodeNames.some((name) => n.instance?.includes(name) || name.includes(n.instance?.replace(/:\d+$/, ''))))
                    : data.nodes;
                if (jobNodes.length > 0) {
                    const avg = (key) => Math.round(jobNodes.reduce((s, n) => s + (n[key] || 0), 0) / jobNodes.length);
                    currentUsage.value.cpu = avg('cpu_usage');
                    currentUsage.value.memory = avg('mem_usage');
                    currentUsage.value.load = +(jobNodes.reduce((s, n) => s + (n.load1 || 0), 0) / jobNodes.length).toFixed(2);
                    currentUsage.value.disk = avg('disk_usage');
                    const totalRx = jobNodes.reduce((s, n) => s + (n.net_rx_bps || 0), 0);
                    const totalTx = jobNodes.reduce((s, n) => s + (n.net_tx_bps || 0), 0);
                    currentUsage.value.netRx = Math.round(totalRx / 1024 / 1024 * 10) / 10;
                    currentUsage.value.netTx = Math.round(totalTx / 1024 / 1024 * 10) / 10;
                }
            }
        }
        // 历史曲线（range query）
        if (promConnected.value) {
            const [cpuSeries, memSeries, netSeries] = await Promise.all([
                queryRange('100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[2m])) * 100)'),
                queryRange('100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)'),
                queryRange('sum by (instance) (rate(node_network_receive_bytes_total{device!~"lo|docker.*|veth.*"}[2m])) / 1048576'),
            ]);
            const fCpu = filterJobNodes(cpuSeries);
            const fMem = filterJobNodes(memSeries);
            const fNet = filterJobNodes(netSeries);
            // 初始化图表（首次）
            await nextTick();
            if (!chartCpu && chartCpuEl.value)
                chartCpu = initChart(chartCpuEl.value, 'CPU');
            if (!chartMem && chartMemEl.value)
                chartMem = initChart(chartMemEl.value, '内存');
            if (!chartNet && chartNetEl.value)
                chartNet = initChart(chartNetEl.value, '网络');
            updateChart(chartCpu, fCpu.length ? fCpu : cpuSeries.slice(0, 8), '%', 100);
            updateChart(chartMem, fMem.length ? fMem : memSeries.slice(0, 8), '%', 100);
            updateChart(chartNet, fNet.length ? fNet : netSeries.slice(0, 8), 'MB/s');
        }
    }
    catch (e) {
        console.error('监控数据加载失败', e);
    }
    finally {
        lastUpdateTime.value = new Date().toLocaleTimeString();
        refreshing.value = false;
    }
};
// 日志
const showLog = ref(false);
const logType = ref('out');
const logContent = ref('');
const logLoading = ref(false);
const logError = ref('');
const getLogPath = (type) => {
    const dir = props.job.directory;
    if (!dir || dir === '-')
        return null;
    // Slurm 默认输出文件：slurm-{jobid}.out / slurm-{jobid}.err
    const ext = type === 'out' ? 'out' : 'err';
    return `${dir}/slurm-${props.job.id}.${ext}`;
};
const loadLog = async (type) => {
    logType.value = type;
    logLoading.value = true;
    logError.value = '';
    logContent.value = '';
    showLog.value = true;
    const path = getLogPath(type);
    if (!path) {
        logError.value = '无法确定日志文件路径，请确认作业目录';
        logLoading.value = false;
        return;
    }
    try {
        const token = getToken();
        const res = await fetch(`${fileManagerApi.read()}?path=${encodeURIComponent(path)}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `读取失败 (${res.status})`);
        }
        const data = await res.json();
        logContent.value = data.content || '';
    }
    catch (e) {
        logError.value = e.message || '读取日志失败';
    }
    finally {
        logLoading.value = false;
    }
};
const openLog = () => loadLog('out');
onMounted(() => {
    if (props.job.status === 'RUNNING') {
        refreshResourceUsage();
        autoRefreshInterval.value = setInterval(refreshResourceUsage, 30000);
    }
});
onUnmounted(() => {
    if (autoRefreshInterval.value)
        clearInterval(autoRefreshInterval.value);
    if (saveTaskPollTimer)
        clearInterval(saveTaskPollTimer);
    chartCpu?.dispose();
    chartMem?.dispose();
    chartNet?.dispose();
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
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('close');
            // @ts-ignore
            [$emit,];
        } },
    ...{ class: "jd-overlay" },
});
/** @type {__VLS_StyleScopedClasses['jd-overlay']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onClick: () => { } },
    ...{ class: "jd-modal" },
});
/** @type {__VLS_StyleScopedClasses['jd-modal']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-header" },
});
/** @type {__VLS_StyleScopedClasses['jd-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-header-left" },
});
/** @type {__VLS_StyleScopedClasses['jd-header-left']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "jd-id" },
});
/** @type {__VLS_StyleScopedClasses['jd-id']} */ ;
(__VLS_ctx.job.id);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "jd-name" },
});
/** @type {__VLS_StyleScopedClasses['jd-name']} */ ;
(__VLS_ctx.job.name);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: (['jd-status', `jd-status-${(__VLS_ctx.job.status || '').toLowerCase()}`]) },
});
/** @type {__VLS_StyleScopedClasses['jd-status']} */ ;
(__VLS_ctx.job.status);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('close');
            // @ts-ignore
            [$emit, job, job, job, job,];
        } },
    ...{ class: "jd-close" },
});
/** @type {__VLS_StyleScopedClasses['jd-close']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-body" },
});
/** @type {__VLS_StyleScopedClasses['jd-body']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-grid" },
});
/** @type {__VLS_StyleScopedClasses['jd-grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-field" },
});
/** @type {__VLS_StyleScopedClasses['jd-field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-field-label" },
});
/** @type {__VLS_StyleScopedClasses['jd-field-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-field-value" },
});
/** @type {__VLS_StyleScopedClasses['jd-field-value']} */ ;
(__VLS_ctx.job.user);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-field" },
});
/** @type {__VLS_StyleScopedClasses['jd-field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-field-label" },
});
/** @type {__VLS_StyleScopedClasses['jd-field-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-field-value" },
});
/** @type {__VLS_StyleScopedClasses['jd-field-value']} */ ;
(__VLS_ctx.job.partition);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-field" },
});
/** @type {__VLS_StyleScopedClasses['jd-field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-field-label" },
});
/** @type {__VLS_StyleScopedClasses['jd-field-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-field-value" },
});
/** @type {__VLS_StyleScopedClasses['jd-field-value']} */ ;
if (__VLS_ctx.job.nodeNames && __VLS_ctx.job.nodeNames.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "jd-node-tags" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-node-tags']} */ ;
    for (const [n] of __VLS_vFor((__VLS_ctx.job.nodeNames))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            key: (n),
            ...{ class: "jd-node-tag" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-node-tag']} */ ;
        (n);
        // @ts-ignore
        [job, job, job, job, job,];
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.job.nodes || 0);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-field" },
});
/** @type {__VLS_StyleScopedClasses['jd-field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-field-label" },
});
/** @type {__VLS_StyleScopedClasses['jd-field-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-field-value" },
});
/** @type {__VLS_StyleScopedClasses['jd-field-value']} */ ;
(__VLS_ctx.job.cpus || 1);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-field" },
});
/** @type {__VLS_StyleScopedClasses['jd-field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-field-label" },
});
/** @type {__VLS_StyleScopedClasses['jd-field-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-field-value" },
});
/** @type {__VLS_StyleScopedClasses['jd-field-value']} */ ;
(__VLS_ctx.job.memory || '-');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-field" },
});
/** @type {__VLS_StyleScopedClasses['jd-field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-field-label" },
});
/** @type {__VLS_StyleScopedClasses['jd-field-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-field-value" },
});
/** @type {__VLS_StyleScopedClasses['jd-field-value']} */ ;
(__VLS_ctx.job.submitTime || '-');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-field" },
});
/** @type {__VLS_StyleScopedClasses['jd-field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-field-label" },
});
/** @type {__VLS_StyleScopedClasses['jd-field-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-field-value" },
});
/** @type {__VLS_StyleScopedClasses['jd-field-value']} */ ;
(__VLS_ctx.job.startTime || '-');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-field" },
});
/** @type {__VLS_StyleScopedClasses['jd-field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-field-label" },
});
/** @type {__VLS_StyleScopedClasses['jd-field-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-field-value" },
});
/** @type {__VLS_StyleScopedClasses['jd-field-value']} */ ;
(__VLS_ctx.job.runTime || '-');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-section" },
});
/** @type {__VLS_StyleScopedClasses['jd-section']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-section-label" },
});
/** @type {__VLS_StyleScopedClasses['jd-section-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-dir-row" },
});
/** @type {__VLS_StyleScopedClasses['jd-dir-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({
    ...{ class: "jd-dir-path" },
});
/** @type {__VLS_StyleScopedClasses['jd-dir-path']} */ ;
(__VLS_ctx.job.directory || '-');
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('open-directory', __VLS_ctx.job.directory);
            // @ts-ignore
            [$emit, job, job, job, job, job, job, job, job,];
        } },
    ...{ class: "jd-btn-outline" },
});
/** @type {__VLS_StyleScopedClasses['jd-btn-outline']} */ ;
if (__VLS_ctx.showLog) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jd-section" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jd-section-header" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-section-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jd-section-label" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-section-label']} */ ;
    (__VLS_ctx.logType === 'out' ? '输出日志' : '错误日志');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showLog))
                    return;
                __VLS_ctx.loadLog('out');
                // @ts-ignore
                [showLog, logType, loadLog,];
            } },
        ...{ class: "jd-btn-ghost" },
        ...{ class: ({ 'jd-btn-active': __VLS_ctx.logType === 'out' }) },
    });
    /** @type {__VLS_StyleScopedClasses['jd-btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['jd-btn-active']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showLog))
                    return;
                __VLS_ctx.loadLog('err');
                // @ts-ignore
                [logType, loadLog,];
            } },
        ...{ class: "jd-btn-ghost" },
        ...{ class: ({ 'jd-btn-active': __VLS_ctx.logType === 'err' }) },
    });
    /** @type {__VLS_StyleScopedClasses['jd-btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['jd-btn-active']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showLog))
                    return;
                __VLS_ctx.showLog = false;
                // @ts-ignore
                [showLog, logType,];
            } },
        ...{ class: "jd-btn-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-btn-ghost']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jd-log-box" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-log-box']} */ ;
    if (__VLS_ctx.logLoading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jd-log-loading" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-log-loading']} */ ;
    }
    else if (__VLS_ctx.logError) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jd-log-error" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-log-error']} */ ;
        (__VLS_ctx.logError);
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
            ...{ class: "jd-log-content" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-log-content']} */ ;
        (__VLS_ctx.logContent || '（日志为空）');
    }
}
if (__VLS_ctx.job.status === 'RUNNING') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jd-section" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jd-section-header" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-section-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jd-section-label" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-section-label']} */ ;
    if (__VLS_ctx.job.nodeNames && __VLS_ctx.job.nodeNames.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "jd-node-list" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-node-list']} */ ;
        (__VLS_ctx.job.nodeNames.join(', '));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.refreshResourceUsage) },
        ...{ class: "jd-btn-ghost" },
        disabled: (__VLS_ctx.refreshing),
    });
    /** @type {__VLS_StyleScopedClasses['jd-btn-ghost']} */ ;
    (__VLS_ctx.refreshing ? '刷新中...' : '刷新');
    if (!__VLS_ctx.promConnected) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jd-prom-na" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-prom-na']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jd-metrics" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-metrics']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jd-metric" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-metric']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jd-metric-label" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-metric-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jd-metric-bar" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-metric-bar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jd-metric-fill" },
        ...{ style: ({ width: __VLS_ctx.currentUsage.cpu + '%', background: __VLS_ctx.currentUsage.cpu > 90 ? '#ef4444' : __VLS_ctx.currentUsage.cpu > 70 ? '#f59e0b' : '#22c55e' }) },
    });
    /** @type {__VLS_StyleScopedClasses['jd-metric-fill']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jd-metric-val" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-metric-val']} */ ;
    (__VLS_ctx.currentUsage.cpu);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jd-metric" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-metric']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jd-metric-label" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-metric-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jd-metric-bar" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-metric-bar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jd-metric-fill" },
        ...{ style: ({ width: __VLS_ctx.currentUsage.memory + '%', background: __VLS_ctx.currentUsage.memory > 90 ? '#ef4444' : __VLS_ctx.currentUsage.memory > 70 ? '#f59e0b' : '#3b82f6' }) },
    });
    /** @type {__VLS_StyleScopedClasses['jd-metric-fill']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jd-metric-val" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-metric-val']} */ ;
    (__VLS_ctx.currentUsage.memory);
    if (__VLS_ctx.currentUsage.load > 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jd-metric" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-metric']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jd-metric-label" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-metric-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jd-metric-bar" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-metric-bar']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jd-metric-fill" },
            ...{ style: ({ width: Math.min(__VLS_ctx.currentUsage.load * 10, 100) + '%', background: '#8b5cf6' }) },
        });
        /** @type {__VLS_StyleScopedClasses['jd-metric-fill']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jd-metric-val" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-metric-val']} */ ;
        (__VLS_ctx.currentUsage.load);
    }
    if (__VLS_ctx.currentUsage.disk > 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jd-metric" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-metric']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jd-metric-label" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-metric-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jd-metric-bar" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-metric-bar']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jd-metric-fill" },
            ...{ style: ({ width: __VLS_ctx.currentUsage.disk + '%', background: __VLS_ctx.currentUsage.disk > 90 ? '#ef4444' : '#f59e0b' }) },
        });
        /** @type {__VLS_StyleScopedClasses['jd-metric-fill']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jd-metric-val" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-metric-val']} */ ;
        (__VLS_ctx.currentUsage.disk);
    }
    if (__VLS_ctx.promConnected) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jd-metric" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-metric']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jd-metric-label" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-metric-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jd-metric-bar" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-metric-bar']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jd-metric-fill" },
            ...{ style: ({ width: Math.min(__VLS_ctx.currentUsage.netRx * 10, 100) + '%', background: '#06b6d4' }) },
        });
        /** @type {__VLS_StyleScopedClasses['jd-metric-fill']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jd-metric-val" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-metric-val']} */ ;
        (__VLS_ctx.currentUsage.netRx);
    }
    if (__VLS_ctx.promConnected) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jd-charts" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-charts']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jd-chart-title" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-chart-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ref: "chartCpuEl",
            ...{ class: "jd-chart" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-chart']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jd-chart-title" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-chart-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ref: "chartMemEl",
            ...{ class: "jd-chart" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-chart']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jd-chart-title" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-chart-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ref: "chartNetEl",
            ...{ class: "jd-chart" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-chart']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jd-update-time" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-update-time']} */ ;
    (__VLS_ctx.lastUpdateTime);
    (__VLS_ctx.promConnected ? '(Prometheus)' : '(估算)');
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jd-footer" },
});
/** @type {__VLS_StyleScopedClasses['jd-footer']} */ ;
if (__VLS_ctx.job.status === 'RUNNING' || __VLS_ctx.job.status === 'PENDING' || __VLS_ctx.job.status === 'SUSPENDED') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.job.status === 'RUNNING' || __VLS_ctx.job.status === 'PENDING' || __VLS_ctx.job.status === 'SUSPENDED'))
                    return;
                __VLS_ctx.$emit('cancel', __VLS_ctx.job.id);
                // @ts-ignore
                [$emit, job, job, job, job, job, job, job, job, logLoading, logError, logError, logContent, refreshResourceUsage, refreshing, refreshing, promConnected, promConnected, promConnected, promConnected, currentUsage, currentUsage, currentUsage, currentUsage, currentUsage, currentUsage, currentUsage, currentUsage, currentUsage, currentUsage, currentUsage, currentUsage, currentUsage, currentUsage, currentUsage, currentUsage, currentUsage, lastUpdateTime,];
            } },
        ...{ class: "jd-btn-danger" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-btn-danger']} */ ;
}
if (__VLS_ctx.job.status === 'RUNNING') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.job.status === 'RUNNING'))
                    return;
                __VLS_ctx.$emit('pause', __VLS_ctx.job.id);
                // @ts-ignore
                [$emit, job, job,];
            } },
        ...{ class: "jd-btn-warning" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-btn-warning']} */ ;
}
if (__VLS_ctx.job.status === 'SUSPENDED') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.job.status === 'SUSPENDED'))
                    return;
                __VLS_ctx.$emit('resume', __VLS_ctx.job.id);
                // @ts-ignore
                [$emit, job, job,];
            } },
        ...{ class: "jd-btn-outline" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-btn-outline']} */ ;
}
if (__VLS_ctx.job.status === 'RUNNING' && __VLS_ctx.job.isContainer) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.job.status === 'RUNNING' && __VLS_ctx.job.isContainer))
                    return;
                __VLS_ctx.showSaveImage = true;
                // @ts-ignore
                [job, job, showSaveImage,];
            } },
        ...{ class: "jd-btn-save-image" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-btn-save-image']} */ ;
}
if (__VLS_ctx.job.status === 'RUNNING' && __VLS_ctx.job.isContainer) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.execIntoContainer) },
        ...{ class: "jd-btn-exec" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-btn-exec']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.openLog) },
    ...{ class: "jd-btn-outline" },
});
/** @type {__VLS_StyleScopedClasses['jd-btn-outline']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('close');
            // @ts-ignore
            [$emit, job, job, execIntoContainer, openLog,];
        } },
    ...{ class: "jd-btn-ghost" },
});
/** @type {__VLS_StyleScopedClasses['jd-btn-ghost']} */ ;
if (__VLS_ctx.showSaveImage) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (__VLS_ctx.closeSaveImage) },
        ...{ class: "jd-save-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-save-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jd-save-box" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-save-box']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jd-save-header" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-save-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeSaveImage) },
        ...{ class: "jd-close" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jd-save-body" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-save-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "jd-save-tip" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-save-tip']} */ ;
    (__VLS_ctx.job.id);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jd-save-field" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-save-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "例：my-pytorch-env",
        disabled: (__VLS_ctx.saving || __VLS_ctx.saveTask?.status === 'done'),
    });
    (__VLS_ctx.saveImageName);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jd-save-field" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-save-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "latest",
        disabled: (__VLS_ctx.saving || __VLS_ctx.saveTask?.status === 'done'),
    });
    (__VLS_ctx.saveImageTag);
    if (__VLS_ctx.saveTask) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jd-save-progress" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-save-progress']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jd-progress-steps" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-progress-steps']} */ ;
        for (const [label, i] of __VLS_vFor((['导出 squashfs', '解压 rootfs', '构建归档', '推送 Harbor']))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (i),
                ...{ class: (['jd-progress-step',
                        __VLS_ctx.saveTask.step > i + 1 || __VLS_ctx.saveTask.status === 'done' ? 'done' :
                            __VLS_ctx.saveTask.step === i + 1 && __VLS_ctx.saveTask.status === 'running' ? 'active' :
                                __VLS_ctx.saveTask.step === i + 1 && __VLS_ctx.saveTask.status === 'error' ? 'error' : '']) },
            });
            /** @type {__VLS_StyleScopedClasses['jd-progress-step']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "jd-step-dot" },
            });
            /** @type {__VLS_StyleScopedClasses['jd-step-dot']} */ ;
            if (__VLS_ctx.saveTask.step > i + 1 || __VLS_ctx.saveTask.status === 'done') {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            }
            else if (__VLS_ctx.saveTask.step === i + 1 && __VLS_ctx.saveTask.status === 'error') {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            }
            else if (__VLS_ctx.saveTask.step === i + 1 && __VLS_ctx.saveTask.status === 'running') {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "jd-spin" },
                });
                /** @type {__VLS_StyleScopedClasses['jd-spin']} */ ;
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                (i + 1);
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "jd-step-label" },
            });
            /** @type {__VLS_StyleScopedClasses['jd-step-label']} */ ;
            (label);
            // @ts-ignore
            [job, showSaveImage, closeSaveImage, closeSaveImage, saving, saving, saveTask, saveTask, saveTask, saveTask, saveTask, saveTask, saveTask, saveTask, saveTask, saveTask, saveTask, saveTask, saveTask, saveTask, saveTask, saveImageName, saveImageTag,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jd-progress-bar-wrap" },
        });
        /** @type {__VLS_StyleScopedClasses['jd-progress-bar-wrap']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "jd-progress-bar-fill" },
            ...{ style: ({
                    width: __VLS_ctx.saveTask.status === 'done' ? '100%' :
                        __VLS_ctx.saveTask.status === 'error' ? (((__VLS_ctx.saveTask.step - 1) / 4 * 100) + '%') :
                            ((__VLS_ctx.saveTask.step / 4 * 100) + '%'),
                    background: __VLS_ctx.saveTask.status === 'error' ? '#ef4444' :
                        __VLS_ctx.saveTask.status === 'done' ? '#22c55e' : 'hsl(var(--primary))'
                }) },
        });
        /** @type {__VLS_StyleScopedClasses['jd-progress-bar-fill']} */ ;
        if (__VLS_ctx.saveTask.status === 'error') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "jd-save-result err" },
            });
            /** @type {__VLS_StyleScopedClasses['jd-save-result']} */ ;
            /** @type {__VLS_StyleScopedClasses['err']} */ ;
            (__VLS_ctx.saveTask.error);
        }
        if (__VLS_ctx.saveTask.status === 'done') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "jd-save-result ok" },
            });
            /** @type {__VLS_StyleScopedClasses['jd-save-result']} */ ;
            /** @type {__VLS_StyleScopedClasses['ok']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "jd-save-target" },
            });
            /** @type {__VLS_StyleScopedClasses['jd-save-target']} */ ;
            (__VLS_ctx.saveTask.target_image);
        }
    }
    else if (__VLS_ctx.saveResult && !__VLS_ctx.saveTask) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: (['jd-save-result', __VLS_ctx.saveResult.ok ? 'ok' : 'err']) },
        });
        /** @type {__VLS_StyleScopedClasses['jd-save-result']} */ ;
        (__VLS_ctx.saveResult.msg);
        if (__VLS_ctx.saveResult.target) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "jd-save-target" },
            });
            /** @type {__VLS_StyleScopedClasses['jd-save-target']} */ ;
            (__VLS_ctx.saveResult.target);
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jd-save-footer" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-save-footer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.doSaveImage) },
        ...{ class: "jd-btn-primary" },
        disabled: (__VLS_ctx.saving || __VLS_ctx.saveTask?.status === 'running' || __VLS_ctx.saveTask?.status === 'done'),
    });
    /** @type {__VLS_StyleScopedClasses['jd-btn-primary']} */ ;
    (__VLS_ctx.saving ? '提交中...' : __VLS_ctx.saveTask?.status === 'running' ? '执行中...' : __VLS_ctx.saveTask?.status === 'done' ? '✅ 已完成' : '🚀 开始保存');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeSaveImage) },
        ...{ class: "jd-btn-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['jd-btn-ghost']} */ ;
}
// @ts-ignore
[closeSaveImage, saving, saving, saveTask, saveTask, saveTask, saveTask, saveTask, saveTask, saveTask, saveTask, saveTask, saveTask, saveTask, saveTask, saveTask, saveTask, saveTask, saveResult, saveResult, saveResult, saveResult, saveResult, doSaveImage,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    emits: {},
    __typeProps: {},
});
export default {};
