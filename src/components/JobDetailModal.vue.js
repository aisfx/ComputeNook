import { ref, onMounted, onUnmounted } from 'vue';
const props = defineProps();
const __VLS_emit = defineEmits(['close', 'pause', 'cancel', 'open-directory']);
const refreshing = ref(false);
const lastUpdateTime = ref(new Date().toLocaleTimeString());
const autoRefreshInterval = ref(null);
// Canvas 引用
const cpuChartRef = ref();
const memoryChartRef = ref();
const gpuChartRef = ref();
const networkChartRef = ref();
const storageChartRef = ref();
// 历史数据存储 (根据作业运行时间动态调整)
const cpuHistory = ref([]);
const memoryHistory = ref([]);
const gpuHistory = ref([]);
const networkRxHistory = ref([]);
const networkTxHistory = ref([]);
const storageReadHistory = ref([]);
const storageWriteHistory = ref([]);
// 作业时间信息
const jobStartTime = ref(null);
const jobEndTime = ref(null);
const jobDuration = ref(0); // 分钟
// 当前使用率
const currentUsage = ref({
    cpu: 0,
    memory: 0,
    gpu: 0
});
// 平均使用率
const avgUsage = ref({
    cpu: 0,
    memory: 0,
    gpu: 0
});
// 峰值使用率
const maxUsage = ref({
    cpu: 0,
    memory: 0,
    gpu: 0
});
const resourceUsage = ref({
    cpu: {
        usage: 0,
        used: 0,
        total: 0,
        load: '0.00'
    },
    memory: {
        usage: 0,
        used: 0,
        total: 0,
        available: 0
    },
    gpu: {
        available: false,
        usage: 0,
        memoryUsed: 0,
        memoryTotal: 0,
        temperature: 0,
        power: 0
    },
    network: {
        total: '0 MB',
        received: '0 MB',
        transmitted: '0 MB',
        rxRate: '0 KB/s',
        txRate: '0 KB/s'
    },
    storage: {
        total: '0 MB',
        read: '0 MB',
        write: '0 MB',
        readRate: '0 KB/s',
        writeRate: '0 KB/s'
    }
});
// 绘制曲线图
const drawChart = (canvas, data, color, maxValue = 100, showDualLine = false, data2, color2) => {
    if (!canvas)
        return;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return;
    const width = canvas.width;
    const height = canvas.height;
    const padding = 50;
    const paddingBottom = 60;
    // 清空画布
    ctx.clearRect(0, 0, width, height);
    // 绘制背景
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, width, height);
    // 绘制网格线
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    // 水平网格线
    for (let i = 0; i <= 4; i++) {
        const y = padding + (height - padding - paddingBottom) * i / 4;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
        // 绘制 Y 轴标签
        ctx.fillStyle = '#666';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.round(maxValue * (4 - i) / 4)}`, padding - 10, y + 4);
    }
    if (data.length === 0) {
        // 显示无数据提示
        ctx.fillStyle = '#999';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('等待数据...', width / 2, height / 2);
        return;
    }
    // 计算时间范围
    const startTime = jobStartTime.value || new Date();
    const endTime = jobEndTime.value || new Date();
    const totalDuration = (endTime.getTime() - startTime.getTime()) / 1000 / 60; // 分钟
    // 绘制垂直网格线和时间标签
    const timePoints = Math.min(Math.ceil(totalDuration / 10), 10); // 最多10个时间点
    for (let i = 0; i <= timePoints; i++) {
        const x = padding + (width - padding * 2) * i / timePoints;
        ctx.strokeStyle = '#e5e7eb';
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, height - paddingBottom);
        ctx.stroke();
        // 绘制时间标签
        const timeOffset = (totalDuration * i / timePoints);
        const labelTime = new Date(startTime.getTime() + timeOffset * 60 * 1000);
        const timeLabel = labelTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        ctx.fillStyle = '#666';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.save();
        ctx.translate(x, height - paddingBottom + 15);
        ctx.rotate(-Math.PI / 6);
        ctx.fillText(timeLabel, 0, 0);
        ctx.restore();
    }
    // 绘制 X 轴标签
    ctx.fillStyle = '#333';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('时间', width / 2, height - 10);
    // 绘制曲线
    const drawLine = (lineData, lineColor) => {
        if (lineData.length === 0)
            return;
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        lineData.forEach((point, index) => {
            const pointTime = new Date(point.time);
            const timeOffset = (pointTime.getTime() - startTime.getTime()) / 1000 / 60; // 分钟
            const x = padding + ((width - padding * 2) * timeOffset / totalDuration);
            const y = height - paddingBottom - ((point.value / maxValue) * (height - padding - paddingBottom));
            if (index === 0) {
                ctx.moveTo(x, y);
            }
            else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
        // 绘制数据点
        ctx.fillStyle = lineColor;
        lineData.forEach((point) => {
            const pointTime = new Date(point.time);
            const timeOffset = (pointTime.getTime() - startTime.getTime()) / 1000 / 60;
            const x = padding + ((width - padding * 2) * timeOffset / totalDuration);
            const y = height - paddingBottom - ((point.value / maxValue) * (height - padding - paddingBottom));
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
        // 绘制填充区域
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = lineColor;
        ctx.beginPath();
        lineData.forEach((point, index) => {
            const pointTime = new Date(point.time);
            const timeOffset = (pointTime.getTime() - startTime.getTime()) / 1000 / 60;
            const x = padding + ((width - padding * 2) * timeOffset / totalDuration);
            const y = height - paddingBottom - ((point.value / maxValue) * (height - padding - paddingBottom));
            if (index === 0) {
                ctx.moveTo(x, height - paddingBottom);
                ctx.lineTo(x, y);
            }
            else {
                ctx.lineTo(x, y);
            }
        });
        const lastPoint = lineData[lineData.length - 1];
        const lastTime = new Date(lastPoint.time);
        const lastOffset = (lastTime.getTime() - startTime.getTime()) / 1000 / 60;
        const lastX = padding + ((width - padding * 2) * lastOffset / totalDuration);
        ctx.lineTo(lastX, height - paddingBottom);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
    };
    // 绘制第一条线
    drawLine(data, color);
    // 如果有第二条线，绘制第二条线
    if (showDualLine && data2 && color2) {
        drawLine(data2, color2);
    }
    // 绘制当前时间线（如果作业还在运行）
    if (!jobEndTime.value) {
        const now = new Date();
        const currentOffset = (now.getTime() - startTime.getTime()) / 1000 / 60;
        const currentX = padding + ((width - padding * 2) * currentOffset / totalDuration);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(currentX, padding);
        ctx.lineTo(currentX, height - paddingBottom);
        ctx.stroke();
        ctx.setLineDash([]);
        // 标注"当前"
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('当前', currentX, padding - 5);
    }
};
const refreshResourceUsage = async () => {
    refreshing.value = true;
    setTimeout(() => {
        const currentTime = new Date().toISOString();
        // 模拟 CPU 使用率
        const cpuUsage = Math.floor(Math.random() * 40) + 50;
        cpuHistory.value.push({ time: currentTime, value: cpuUsage });
        currentUsage.value.cpu = cpuUsage;
        avgUsage.value.cpu = cpuHistory.value.reduce((a, b) => a + b.value, 0) / cpuHistory.value.length;
        maxUsage.value.cpu = Math.max(...cpuHistory.value.map(h => h.value));
        resourceUsage.value.cpu = {
            usage: cpuUsage,
            used: Math.floor((props.job.cpus * cpuUsage) / 100),
            total: props.job.cpus,
            load: (Math.random() * 3 + 1).toFixed(2)
        };
        // 模拟内存使用率
        const memTotal = parseInt(props.job.memory) || 16;
        const memUsage = Math.floor(Math.random() * 30) + 60;
        memoryHistory.value.push({ time: currentTime, value: memUsage });
        currentUsage.value.memory = memUsage;
        avgUsage.value.memory = memoryHistory.value.reduce((a, b) => a + b.value, 0) / memoryHistory.value.length;
        maxUsage.value.memory = Math.max(...memoryHistory.value.map(h => h.value));
        resourceUsage.value.memory = {
            usage: memUsage,
            used: parseFloat((memTotal * memUsage / 100).toFixed(2)),
            total: memTotal,
            available: parseFloat((memTotal * (100 - memUsage) / 100).toFixed(2))
        };
        // 模拟 GPU
        if (props.job.partition === 'gpu') {
            const gpuUsage = Math.floor(Math.random() * 40) + 50;
            gpuHistory.value.push({ time: currentTime, value: gpuUsage });
            currentUsage.value.gpu = gpuUsage;
            avgUsage.value.gpu = gpuHistory.value.reduce((a, b) => a + b.value, 0) / gpuHistory.value.length;
            maxUsage.value.gpu = Math.max(...gpuHistory.value.map(h => h.value));
            resourceUsage.value.gpu = {
                available: true,
                usage: gpuUsage,
                memoryUsed: Math.floor(Math.random() * 8) + 8,
                memoryTotal: 16,
                temperature: Math.floor(Math.random() * 20) + 60,
                power: Math.floor(Math.random() * 100) + 150
            };
        }
        // 模拟网络 I/O (KB/s)
        const rxRate = Math.floor(Math.random() * 5000) + 1000;
        const txRate = Math.floor(Math.random() * 3000) + 500;
        networkRxHistory.value.push({ time: currentTime, value: rxRate });
        networkTxHistory.value.push({ time: currentTime, value: txRate });
        resourceUsage.value.network = {
            total: ((rxRate + txRate) / 1024).toFixed(2) + ' MB/s',
            received: (Math.random() * 300 + 50).toFixed(2) + ' MB',
            transmitted: (Math.random() * 200 + 50).toFixed(2) + ' MB',
            rxRate: rxRate.toFixed(0) + ' KB/s',
            txRate: txRate.toFixed(0) + ' KB/s'
        };
        // 模拟存储 I/O (KB/s)
        const readRate = Math.floor(Math.random() * 10000) + 2000;
        const writeRate = Math.floor(Math.random() * 6000) + 1000;
        storageReadHistory.value.push({ time: currentTime, value: readRate });
        storageWriteHistory.value.push({ time: currentTime, value: writeRate });
        resourceUsage.value.storage = {
            total: ((readRate + writeRate) / 1024).toFixed(2) + ' MB/s',
            read: (Math.random() * 600 + 200).toFixed(2) + ' MB',
            write: (Math.random() * 400 + 300).toFixed(2) + ' MB',
            readRate: readRate.toFixed(0) + ' KB/s',
            writeRate: writeRate.toFixed(0) + ' KB/s'
        };
        // 绘制图表
        drawChart(cpuChartRef.value, cpuHistory.value, '#3b82f6');
        drawChart(memoryChartRef.value, memoryHistory.value, '#8b5cf6');
        if (resourceUsage.value.gpu.available) {
            drawChart(gpuChartRef.value, gpuHistory.value, '#10b981');
        }
        drawChart(networkChartRef.value, networkRxHistory.value, '#3b82f6', 10000, true, networkTxHistory.value, '#f59e0b');
        drawChart(storageChartRef.value, storageReadHistory.value, '#8b5cf6', 15000, true, storageWriteHistory.value, '#ef4444');
        lastUpdateTime.value = new Date().toLocaleTimeString();
        refreshing.value = false;
    }, 500);
};
// 初始化作业时间
const initJobTime = () => {
    // 解析作业开始时间
    if (props.job.startTime) {
        jobStartTime.value = new Date(props.job.startTime);
    }
    else {
        // 如果没有开始时间，使用提交时间
        jobStartTime.value = new Date(props.job.submitTime);
    }
    // 解析作业结束时间
    if (props.job.status === 'COMPLETED' || props.job.status === 'FAILED') {
        if (props.job.endTime) {
            jobEndTime.value = new Date(props.job.endTime);
        }
        else {
            jobEndTime.value = new Date();
        }
    }
    else {
        // 作业还在运行，结束时间为当前时间
        jobEndTime.value = new Date();
    }
    // 计算作业持续时间（分钟）
    jobDuration.value = (jobEndTime.value.getTime() - jobStartTime.value.getTime()) / 1000 / 60;
};
onMounted(() => {
    if (props.job.status === 'RUNNING' || props.job.status === 'COMPLETED') {
        // 初始化作业时间
        initJobTime();
        // 加载初始数据
        refreshResourceUsage();
        // 如果作业还在运行，每5秒自动刷新
        if (props.job.status === 'RUNNING') {
            autoRefreshInterval.value = setInterval(() => {
                // 更新结束时间为当前时间
                jobEndTime.value = new Date();
                refreshResourceUsage();
            }, 5000);
        }
    }
});
onUnmounted(() => {
    if (autoRefreshInterval.value) {
        clearInterval(autoRefreshInterval.value);
    }
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
/** @type {__VLS_StyleScopedClasses['detail-section']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-section']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['directory-info']} */ ;
/** @type {__VLS_StyleScopedClasses['job-detail-modal']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-section']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-section']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-section']} */ ;
/** @type {__VLS_StyleScopedClasses['section-header']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-refresh']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-refresh']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
/** @type {__VLS_StyleScopedClasses['chart-value']} */ ;
/** @type {__VLS_StyleScopedClasses['chart-value']} */ ;
/** @type {__VLS_StyleScopedClasses['chart-stats']} */ ;
/** @type {__VLS_StyleScopedClasses['directory-info']} */ ;
/** @type {__VLS_StyleScopedClasses['directory-path']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['directory-info']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('close');
            // @ts-ignore
            [$emit,];
        } },
    ...{ class: "modal-overlay" },
});
/** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onClick: () => { } },
    ...{ class: "modal-content job-detail-modal" },
});
/** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
/** @type {__VLS_StyleScopedClasses['job-detail-modal']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "modal-header" },
});
/** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('close');
            // @ts-ignore
            [$emit,];
        } },
    ...{ class: "btn-close" },
});
/** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "modal-body" },
});
/** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "detail-section" },
});
/** @type {__VLS_StyleScopedClasses['detail-section']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "detail-grid" },
});
/** @type {__VLS_StyleScopedClasses['detail-grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "detail-item" },
});
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
(__VLS_ctx.job.id);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "detail-item" },
});
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.job.name);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "detail-item" },
});
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: (['status', `status-${__VLS_ctx.job.status.toLowerCase()}`]) },
});
/** @type {__VLS_StyleScopedClasses['status']} */ ;
(__VLS_ctx.job.status);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "detail-item" },
});
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.job.user);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "detail-section" },
});
/** @type {__VLS_StyleScopedClasses['detail-section']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "detail-grid" },
});
/** @type {__VLS_StyleScopedClasses['detail-grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "detail-item" },
});
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.job.partition);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "detail-item" },
});
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.job.nodes);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "detail-item" },
});
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.job.cpus);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "detail-item" },
});
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.job.memory || '16 GB');
if (__VLS_ctx.job.status === 'RUNNING') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "detail-section resource-usage" },
    });
    /** @type {__VLS_StyleScopedClasses['detail-section']} */ ;
    /** @type {__VLS_StyleScopedClasses['resource-usage']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "section-header" },
    });
    /** @type {__VLS_StyleScopedClasses['section-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.refreshResourceUsage) },
        ...{ class: "btn-refresh" },
        disabled: (__VLS_ctx.refreshing),
    });
    /** @type {__VLS_StyleScopedClasses['btn-refresh']} */ ;
    (__VLS_ctx.refreshing ? '⏳' : '🔄');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "resource-chart-item" },
    });
    /** @type {__VLS_StyleScopedClasses['resource-chart-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chart-header" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chart-title" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "chart-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "chart-label" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chart-value" },
        ...{ class: ({ warning: __VLS_ctx.currentUsage.cpu > 80, danger: __VLS_ctx.currentUsage.cpu > 95 }) },
    });
    /** @type {__VLS_StyleScopedClasses['chart-value']} */ ;
    /** @type {__VLS_StyleScopedClasses['warning']} */ ;
    /** @type {__VLS_StyleScopedClasses['danger']} */ ;
    (__VLS_ctx.currentUsage.cpu);
    __VLS_asFunctionalElement1(__VLS_intrinsics.canvas, __VLS_intrinsics.canvas)({
        ref: "cpuChartRef",
        ...{ class: "resource-chart" },
        width: "800",
        height: "150",
    });
    /** @type {__VLS_StyleScopedClasses['resource-chart']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chart-stats" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-stats']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.resourceUsage.cpu.used);
    (__VLS_ctx.resourceUsage.cpu.total);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.avgUsage.cpu.toFixed(1));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.maxUsage.cpu);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "resource-chart-item" },
    });
    /** @type {__VLS_StyleScopedClasses['resource-chart-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chart-header" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chart-title" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "chart-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "chart-label" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chart-value" },
        ...{ class: ({ warning: __VLS_ctx.currentUsage.memory > 80, danger: __VLS_ctx.currentUsage.memory > 95 }) },
    });
    /** @type {__VLS_StyleScopedClasses['chart-value']} */ ;
    /** @type {__VLS_StyleScopedClasses['warning']} */ ;
    /** @type {__VLS_StyleScopedClasses['danger']} */ ;
    (__VLS_ctx.currentUsage.memory);
    __VLS_asFunctionalElement1(__VLS_intrinsics.canvas, __VLS_intrinsics.canvas)({
        ref: "memoryChartRef",
        ...{ class: "resource-chart" },
        width: "800",
        height: "150",
    });
    /** @type {__VLS_StyleScopedClasses['resource-chart']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chart-stats" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-stats']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.resourceUsage.memory.used);
    (__VLS_ctx.resourceUsage.memory.total);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.avgUsage.memory.toFixed(1));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.maxUsage.memory);
    if (__VLS_ctx.resourceUsage.gpu.available) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "resource-chart-item" },
        });
        /** @type {__VLS_StyleScopedClasses['resource-chart-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "chart-header" },
        });
        /** @type {__VLS_StyleScopedClasses['chart-header']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "chart-title" },
        });
        /** @type {__VLS_StyleScopedClasses['chart-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "chart-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['chart-icon']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "chart-label" },
        });
        /** @type {__VLS_StyleScopedClasses['chart-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "chart-value" },
            ...{ class: ({ warning: __VLS_ctx.currentUsage.gpu > 80, danger: __VLS_ctx.currentUsage.gpu > 95 }) },
        });
        /** @type {__VLS_StyleScopedClasses['chart-value']} */ ;
        /** @type {__VLS_StyleScopedClasses['warning']} */ ;
        /** @type {__VLS_StyleScopedClasses['danger']} */ ;
        (__VLS_ctx.currentUsage.gpu);
        __VLS_asFunctionalElement1(__VLS_intrinsics.canvas, __VLS_intrinsics.canvas)({
            ref: "gpuChartRef",
            ...{ class: "resource-chart" },
            width: "800",
            height: "150",
        });
        /** @type {__VLS_StyleScopedClasses['resource-chart']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "chart-stats" },
        });
        /** @type {__VLS_StyleScopedClasses['chart-stats']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.resourceUsage.gpu.memoryUsed);
        (__VLS_ctx.resourceUsage.gpu.memoryTotal);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.resourceUsage.gpu.temperature);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.resourceUsage.gpu.power);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "resource-chart-item" },
    });
    /** @type {__VLS_StyleScopedClasses['resource-chart-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chart-header" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chart-title" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "chart-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "chart-label" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chart-value" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-value']} */ ;
    (__VLS_ctx.resourceUsage.network.rxRate);
    (__VLS_ctx.resourceUsage.network.txRate);
    __VLS_asFunctionalElement1(__VLS_intrinsics.canvas, __VLS_intrinsics.canvas)({
        ref: "networkChartRef",
        ...{ class: "resource-chart" },
        width: "800",
        height: "150",
    });
    /** @type {__VLS_StyleScopedClasses['resource-chart']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chart-stats" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-stats']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "rx-label" },
    });
    /** @type {__VLS_StyleScopedClasses['rx-label']} */ ;
    (__VLS_ctx.resourceUsage.network.received);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tx-label" },
    });
    /** @type {__VLS_StyleScopedClasses['tx-label']} */ ;
    (__VLS_ctx.resourceUsage.network.transmitted);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "resource-chart-item" },
    });
    /** @type {__VLS_StyleScopedClasses['resource-chart-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chart-header" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chart-title" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "chart-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "chart-label" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chart-value" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-value']} */ ;
    (__VLS_ctx.resourceUsage.storage.readRate);
    (__VLS_ctx.resourceUsage.storage.writeRate);
    __VLS_asFunctionalElement1(__VLS_intrinsics.canvas, __VLS_intrinsics.canvas)({
        ref: "storageChartRef",
        ...{ class: "resource-chart" },
        width: "800",
        height: "150",
    });
    /** @type {__VLS_StyleScopedClasses['resource-chart']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chart-stats" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-stats']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "read-label" },
    });
    /** @type {__VLS_StyleScopedClasses['read-label']} */ ;
    (__VLS_ctx.resourceUsage.storage.read);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "write-label" },
    });
    /** @type {__VLS_StyleScopedClasses['write-label']} */ ;
    (__VLS_ctx.resourceUsage.storage.write);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "resource-note" },
    });
    /** @type {__VLS_StyleScopedClasses['resource-note']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "note-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['note-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.jobStartTime?.toLocaleString());
    (props.job.status === 'RUNNING' ? '当前运行时长' : '总运行时长');
    (Math.floor(__VLS_ctx.jobDuration));
    (__VLS_ctx.lastUpdateTime);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "detail-section" },
});
/** @type {__VLS_StyleScopedClasses['detail-section']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "detail-grid" },
});
/** @type {__VLS_StyleScopedClasses['detail-grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "detail-item" },
});
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.job.submitTime);
if (__VLS_ctx.job.startTime) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "detail-item" },
    });
    /** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.job.startTime || '-');
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "detail-item" },
});
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.job.runTime);
if (__VLS_ctx.job.endTime) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "detail-item" },
    });
    /** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.job.endTime || '-');
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "detail-section" },
});
/** @type {__VLS_StyleScopedClasses['detail-section']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "directory-info" },
});
/** @type {__VLS_StyleScopedClasses['directory-info']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({
    ...{ class: "directory-path" },
});
/** @type {__VLS_StyleScopedClasses['directory-path']} */ ;
(__VLS_ctx.job.directory);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('open-directory', __VLS_ctx.job.id, __VLS_ctx.job.directory);
            // @ts-ignore
            [$emit, job, job, job, job, job, job, job, job, job, job, job, job, job, job, job, job, job, job, job, refreshResourceUsage, refreshing, refreshing, currentUsage, currentUsage, currentUsage, currentUsage, currentUsage, currentUsage, currentUsage, currentUsage, currentUsage, resourceUsage, resourceUsage, resourceUsage, resourceUsage, resourceUsage, resourceUsage, resourceUsage, resourceUsage, resourceUsage, resourceUsage, resourceUsage, resourceUsage, resourceUsage, resourceUsage, resourceUsage, resourceUsage, resourceUsage, avgUsage, avgUsage, maxUsage, maxUsage, jobStartTime, jobDuration, lastUpdateTime,];
        } },
    ...{ class: "btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "detail-actions" },
});
/** @type {__VLS_StyleScopedClasses['detail-actions']} */ ;
if (__VLS_ctx.job.status === 'RUNNING') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.job.status === 'RUNNING'))
                    return;
                __VLS_ctx.$emit('pause', __VLS_ctx.job.id);
                // @ts-ignore
                [$emit, job, job,];
            } },
        ...{ class: "btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
}
if (__VLS_ctx.job.status === 'RUNNING' || __VLS_ctx.job.status === 'PENDING') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.job.status === 'RUNNING' || __VLS_ctx.job.status === 'PENDING'))
                    return;
                __VLS_ctx.$emit('cancel', __VLS_ctx.job.id);
                // @ts-ignore
                [$emit, job, job, job,];
            } },
        ...{ class: "btn-danger" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-danger']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ class: "btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ class: "btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    emits: {},
    __typeProps: {},
});
export default {};
