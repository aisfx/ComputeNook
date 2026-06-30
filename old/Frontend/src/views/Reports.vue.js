/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, nextTick, onMounted, watch } from 'vue';
import * as echarts from 'echarts';
import axios from 'axios';
import { reportAPI } from '../api/report';
function formatDate(d) { return d.toISOString().split('T')[0]; }
const today = new Date();
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(today.getDate() - 30);
const loading = ref(false);
const globalError = ref('');
const partitions = ref([]);
const sevenDaysAgo = new Date(today);
sevenDaysAgo.setDate(today.getDate() - 7);
const filters = ref({
    startDate: formatDate(sevenDaysAgo),
    endDate: formatDate(today),
    partition: '',
});
const jobStats = ref(null);
const usageStats = ref(null);
const storageStats = ref(null);
const quotaStats = ref(null);
const qosUsage = ref([]);
const lineChartRef = ref(null);
const scaleChartRef = ref(null);
const usageChartRef = ref(null);
const storageChartRef = ref(null);
const qosChartRef = ref(null);
const billingChartRef = ref(null);
const quotaChartRef = ref(null);
let lineChart = null;
let scaleChart = null;
let usageChart = null;
let storageChart = null;
let qosChart = null;
let billingChart = null;
let quotaChart = null;
const dateError = computed(() => {
    if (filters.value.startDate && filters.value.endDate && filters.value.startDate > filters.value.endDate)
        return '开始日期不能晚于结束日期';
    return '';
});
// 查询完成后始终显示图表区域（各图自带 mock 兜底）
const hasAnyData = computed(() => queried.value);
const queried = ref(false);
const storageChartHeight = computed(() => Math.max(260, (storageStats.value?.length ?? 0) * 60));
async function loadPartitions() {
    try {
        const res = await axios.get('/jobs/partitions/list');
        partitions.value = res.data?.data ?? [];
    }
    catch {
        partitions.value = [];
    }
}
async function loadAll() {
    if (dateError.value)
        return;
    loading.value = true;
    globalError.value = '';
    queried.value = false;
    jobStats.value = null;
    usageStats.value = null;
    storageStats.value = null;
    quotaStats.value = null;
    qosUsage.value = [];
    disposeCharts();
    const params = {
        start_time: filters.value.startDate,
        end_time: filters.value.endDate,
        partition: filters.value.partition || undefined,
        // 不传 user 参数，后端强制查当前登录用户自己
    };
    try {
        const [jobRes, usageRes, storageRes, quotaRes, qosRes] = await Promise.allSettled([
            reportAPI.getJobStats(params),
            reportAPI.getUsageStats(params),
            reportAPI.getStorageStats(params),
            reportAPI.getQuotaStats(params),
            reportAPI.getQoSUsage(params),
        ]);
        if (jobRes.status === 'fulfilled')
            jobStats.value = jobRes.value.data.data;
        if (usageRes.status === 'fulfilled')
            usageStats.value = usageRes.value.data.data;
        if (storageRes.status === 'fulfilled')
            storageStats.value = storageRes.value.data.data;
        if (quotaRes.status === 'fulfilled')
            quotaStats.value = quotaRes.value.data.data;
        // QoS 接口失败时用 mock 数据兜底，保证图表始终可见
        if (qosRes.status === 'fulfilled' && qosRes.value.data.data?.length) {
            qosUsage.value = qosRes.value.data.data;
        }
        else {
            qosUsage.value = [
                { qos_name: 'normal', used_billing_hours: 0, total_billing_hours: 0, usage_percent: 0, status: 'NORMAL' },
                { qos_name: 'high', used_billing_hours: 0, total_billing_hours: 0, usage_percent: 0, status: 'NORMAL' },
                { qos_name: 'gpu', used_billing_hours: 0, total_billing_hours: 0, usage_percent: 0, status: 'NORMAL' },
            ];
        }
        queried.value = true;
        loading.value = false;
    }
    catch (e) {
        globalError.value = e?.message || '查询失败';
    }
    finally {
        loading.value = false;
    }
}
function disposeCharts() {
    lineChart?.dispose();
    lineChart = null;
    scaleChart?.dispose();
    scaleChart = null;
    usageChart?.dispose();
    usageChart = null;
    storageChart?.dispose();
    storageChart = null;
    qosChart?.dispose();
    qosChart = null;
    billingChart?.dispose();
    billingChart = null;
    quotaChart?.dispose();
    quotaChart = null;
}
function renderAllCharts() {
    console.log('[Charts] renderAllCharts called', {
        line: lineChartRef.value,
        scale: scaleChartRef.value,
        usage: usageChartRef.value,
    });
    renderLineChart();
    renderScaleChart();
    renderUsageChart();
    renderStorageChart();
    renderQoSChart();
    renderBillingChart();
    renderQuotaChart();
}
// queried 变为 true 时 DOM 已就绪，直接渲染
watch(queried, async (val) => {
    if (val) {
        await nextTick();
        await nextTick();
        console.log('[Charts] watch queried triggered, lineRef=', lineChartRef.value);
        renderAllCharts();
    }
});
// 统一颜色配置（浅色主题）
const C = {
    text: '#374151',
    muted: '#6b7280',
    axis: '#d1d5db',
    split: '#f3f4f6',
    colors: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'],
};
// 月度作业趋势折线图
function renderLineChart() {
    if (!lineChartRef.value)
        return;
    if (!lineChart)
        lineChart = echarts.init(lineChartRef.value);
    const counts = jobStats.value?.monthly_job_counts ?? [];
    const hasData = counts.length > 0;
    const months = hasData ? [...new Set(counts.map(c => c.month))].sort() : ['2026-01', '2026-02', '2026-03', '2026-04'];
    const queues = hasData ? [...new Set(counts.map(c => c.partition))] : ['normal', 'gpu'];
    lineChart.setOption({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', backgroundColor: '#fff', borderColor: '#e5e7eb', textStyle: { color: C.text } },
        legend: { data: queues, textStyle: { color: C.muted }, bottom: 4 },
        grid: { left: '3%', right: '4%', bottom: '14%', top: '6%', containLabel: true },
        xAxis: { type: 'category', data: months, boundaryGap: false, axisLabel: { color: C.muted, fontSize: 12 }, axisLine: { lineStyle: { color: C.axis } }, axisTick: { show: false } },
        yAxis: { type: 'value', name: '作业数', nameTextStyle: { color: C.muted }, axisLabel: { color: C.muted }, splitLine: { lineStyle: { color: C.split } }, axisLine: { show: false } },
        series: queues.map((q, i) => ({
            name: q, type: 'line', smooth: true, symbol: 'circle', symbolSize: 7,
            lineStyle: { width: 2.5, color: C.colors[i % C.colors.length] },
            itemStyle: { color: C.colors[i % C.colors.length] },
            areaStyle: { color: C.colors[i % C.colors.length], opacity: 0.06 },
            data: hasData ? months.map(m => counts.find(c => c.month === m && c.partition === q)?.count ?? 0) : [0, 0, 0, 0],
        })),
    });
}
// 作业规模柱状图
function renderScaleChart() {
    if (!scaleChartRef.value)
        return;
    if (!scaleChart)
        scaleChart = echarts.init(scaleChartRef.value);
    const dist = jobStats.value?.job_scale_distribution ?? [];
    const total = jobStats.value?.total_jobs ?? 0;
    const ranges = dist.length > 0 ? dist : [
        { range: '1-4核', count: 0 }, { range: '5-16核', count: 0 },
        { range: '17-64核', count: 0 }, { range: '64核以上', count: 0 },
    ];
    scaleChart.setOption({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', backgroundColor: '#fff', borderColor: '#e5e7eb', textStyle: { color: C.text },
            formatter: (p) => { const pct = total > 0 ? (p[0].value / total * 100).toFixed(1) : 0; return `${p[0].name}<br/>作业数: <b>${p[0].value}</b>（${pct}%）`; } },
        grid: { left: '3%', right: '4%', bottom: '3%', top: '6%', containLabel: true },
        xAxis: { type: 'category', data: ranges.map(d => d.range), axisLabel: { color: C.muted }, axisLine: { lineStyle: { color: C.axis } }, axisTick: { show: false } },
        yAxis: { type: 'value', name: '作业数', nameTextStyle: { color: C.muted }, axisLabel: { color: C.muted }, splitLine: { lineStyle: { color: C.split } }, axisLine: { show: false } },
        series: [{ type: 'bar', data: ranges.map(d => d.count), itemStyle: { color: C.colors[0], borderRadius: [6, 6, 0, 0] }, label: { show: true, position: 'top', color: C.muted, fontSize: 12 }, barMaxWidth: 56 }],
    });
}
// GPU / CPU 核时柱状图
function renderUsageChart() {
    if (!usageChartRef.value)
        return;
    if (!usageChart)
        usageChart = echarts.init(usageChartRef.value);
    const u = usageStats.value;
    usageChart.setOption({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: '#fff', borderColor: '#e5e7eb', textStyle: { color: C.text } },
        grid: { left: '3%', right: '4%', bottom: '3%', top: '6%', containLabel: true },
        xAxis: { type: 'category', data: ['GPU 卡时', 'CPU 核时', '计费核时'], axisLabel: { color: C.muted }, axisLine: { lineStyle: { color: C.axis } }, axisTick: { show: false } },
        yAxis: { type: 'value', name: '小时(h)', nameTextStyle: { color: C.muted }, axisLabel: { color: C.muted }, splitLine: { lineStyle: { color: C.split } }, axisLine: { show: false } },
        series: [{
                type: 'bar',
                data: [
                    { value: u ? +u.gpu_hours.toFixed(2) : 0, itemStyle: { color: C.colors[0] } },
                    { value: u ? +u.cpu_hours.toFixed(2) : 0, itemStyle: { color: C.colors[1] } },
                    { value: u ? +u.billing_hours.toFixed(2) : 0, itemStyle: { color: C.colors[2] } },
                ],
                label: { show: true, position: 'top', color: C.muted, fontSize: 12, formatter: (p) => `${p.value}h` },
                barMaxWidth: 56, itemStyle: { borderRadius: [6, 6, 0, 0] },
            }],
    });
}
// 存储用量水平柱状图
function renderStorageChart() {
    if (!storageChartRef.value || !storageStats.value?.length)
        return;
    if (!storageChart)
        storageChart = echarts.init(storageChartRef.value);
    const items = storageStats.value;
    const labels = items.map(i => `${i.username}  ${i.filesystem}`);
    const barColors = items.map(i => i.over_soft_limit ? '#f59e0b' : '#10b981');
    storageChart.resize();
    storageChart.setOption({
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
// 计费核时使用比例 — 仪表盘图
function renderBillingChart() {
    if (!billingChartRef.value || !usageStats.value)
        return;
    if (!billingChart)
        billingChart = echarts.init(billingChartRef.value);
    const u = usageStats.value;
    const noLimit = u.quota_billing_hours === 0;
    const used = +u.billing_hours.toFixed(2);
    const total = noLimit ? Math.max(used * 1.5, 100) : +u.quota_billing_hours.toFixed(2);
    const pct = noLimit ? 0 : +u.usage_percent.toFixed(1);
    const color = noLimit ? C.colors[0] : statusColor(u.status);
    billingChart.setOption({
        backgroundColor: 'transparent',
        series: [{
                type: 'gauge', startAngle: 200, endAngle: -20, min: 0, max: 100, radius: '88%',
                pointer: { show: !noLimit, length: '60%', width: 4, itemStyle: { color } },
                progress: { show: true, width: 16, itemStyle: { color } },
                axisLine: { lineStyle: { width: 16, color: [[1, '#f3f4f6']] } },
                axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
                detail: { valueAnimation: true, formatter: noLimit ? `${used}h` : `{value}%`, color: C.text, fontSize: 22, fontWeight: 700, offsetCenter: [0, '15%'] },
                title: { show: true, offsetCenter: [0, '50%'], color: C.muted, fontSize: 13, formatter: noLimit ? '无配额限制' : `${used} / ${total} h` },
                data: [{ value: noLimit ? 0 : pct, name: noLimit ? '无配额限制' : `${used} / ${total} h` }],
            }],
    });
}
// 配额使用率 — 仪表盘图
function renderQuotaChart() {
    if (!quotaChartRef.value)
        return;
    if (!quotaChart)
        quotaChart = echarts.init(quotaChartRef.value);
    const q = quotaStats.value;
    const used = q ? +q.used_billing_hours.toFixed(2) : 0;
    const total = q ? +q.total_billing_hours.toFixed(2) : 0;
    const pct = q ? +q.usage_percent.toFixed(1) : 0;
    const color = q ? statusColor(q.status) : '#d1d5db';
    const noData = !q?.account;
    quotaChart.setOption({
        backgroundColor: 'transparent',
        series: [{
                type: 'gauge', startAngle: 200, endAngle: -20, min: 0, max: 100, radius: '88%',
                pointer: { show: !noData, length: '60%', width: 4, itemStyle: { color } },
                progress: { show: true, width: 16, itemStyle: { color } },
                axisLine: { lineStyle: { width: 16, color: [[1, '#f3f4f6']] } },
                axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
                detail: { valueAnimation: true, formatter: noData ? '-' : `{value}%`, color: noData ? '#d1d5db' : C.text, fontSize: 22, fontWeight: 700, offsetCenter: [0, '15%'] },
                title: { show: true, offsetCenter: [0, '50%'], color: C.muted, fontSize: 13, formatter: noData ? '暂无配额数据' : `${used} / ${total} h` },
                data: [{ value: pct, name: noData ? '暂无配额数据' : `${used} / ${total} h` }],
            }],
    });
}
// QoS 计费核时使用量柱状图
function renderQoSChart() {
    if (!qosChartRef.value || !qosUsage.value.length)
        return;
    if (!qosChart)
        qosChart = echarts.init(qosChartRef.value);
    const items = qosUsage.value;
    const names = items.map(i => i.qos_name);
    const usedData = items.map(i => +i.used_billing_hours.toFixed(2));
    const totalData = items.map(i => i.total_billing_hours > 0 ? +i.total_billing_hours.toFixed(2) : 0);
    const barColors = items.map(i => statusColor(i.status));
    qosChart.setOption({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: '#fff', borderColor: '#e5e7eb', textStyle: { color: C.text },
            formatter: (params) => { const idx = params[0].dataIndex; const item = items[idx]; const quota = item.total_billing_hours > 0 ? `配额: ${item.total_billing_hours.toFixed(2)} h<br/>使用率: <b>${item.usage_percent.toFixed(1)}%</b>` : '配额: 无限制'; return `<b>${item.qos_name}</b><br/>已用: <b>${item.used_billing_hours.toFixed(2)} h</b><br/>${quota}`; },
        },
        legend: { data: ['已用核时', '配额上限'], textStyle: { color: C.muted }, bottom: 4 },
        grid: { left: '3%', right: '4%', bottom: '14%', top: '6%', containLabel: true },
        xAxis: { type: 'category', data: names, axisLabel: { color: C.muted }, axisLine: { lineStyle: { color: C.axis } }, axisTick: { show: false } },
        yAxis: { type: 'value', name: '核时(h)', nameTextStyle: { color: C.muted }, axisLabel: { color: C.muted }, splitLine: { lineStyle: { color: C.split } }, axisLine: { show: false } },
        series: [
            { name: '已用核时', type: 'bar', data: usedData.map((v, i) => ({ value: v, itemStyle: { color: barColors[i], borderRadius: [6, 6, 0, 0] } })), label: { show: true, position: 'top', color: C.muted, fontSize: 12, formatter: (p) => `${p.value}h` }, barMaxWidth: 56, z: 2 },
            { name: '配额上限', type: 'bar', data: totalData, itemStyle: { color: 'rgba(99,102,241,0.08)', borderColor: '#c7d2fe', borderWidth: 1, borderRadius: [6, 6, 0, 0] }, barMaxWidth: 56, barGap: '-100%', z: 1 },
        ],
    });
}
function statusColor(s) { return s === 'EXCEEDED' ? '#ef4444' : s === 'WARNING' ? '#f59e0b' : '#10b981'; }
function statusBg(s) { return s === 'EXCEEDED' ? 'rgba(239,68,68,0.1)' : s === 'WARNING' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)'; }
function statusLabel(s) { return s === 'EXCEEDED' ? '已超限' : s === 'WARNING' ? '警告' : '正常'; }
function exportExcel() {
    import('xlsx').then(XLSX => {
        const wb = XLSX.utils.book_new();
        const { startDate, endDate } = filters.value;
        if (jobStats.value) {
            const j = jobStats.value;
            const ws1 = XLSX.utils.aoa_to_sheet([
                ['月份', '队列', '作业数'],
                ...j.monthly_job_counts.map(r => [r.month, r.partition, r.count]),
            ]);
            ws1['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 10 }];
            XLSX.utils.book_append_sheet(wb, ws1, '月度作业趋势');
            const ws2 = XLSX.utils.aoa_to_sheet([
                ['规模范围', '作业数', '占比(%)'],
                ...j.job_scale_distribution.map(r => [r.range, r.count, j.total_jobs > 0 ? +(r.count / j.total_jobs * 100).toFixed(1) : 0]),
                ['合计', j.total_jobs, 100],
            ]);
            ws2['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 10 }];
            XLSX.utils.book_append_sheet(wb, ws2, '作业规模分布');
        }
        if (usageStats.value) {
            const u = usageStats.value;
            const ws = XLSX.utils.aoa_to_sheet([
                ['指标', '数值', '单位'],
                ['统计周期', `${startDate} ~ ${endDate}`, ''],
                ['GPU 卡时', +u.gpu_hours.toFixed(2), 'h'],
                ['CPU 核时', +u.cpu_hours.toFixed(2), 'h'],
                ['计费核时', +u.billing_hours.toFixed(2), 'h'],
                ['配额总量', u.quota_billing_hours === 0 ? '无限制' : +u.quota_billing_hours.toFixed(2), u.quota_billing_hours === 0 ? '' : 'h'],
                ['使用率', +u.usage_percent.toFixed(2), '%'],
                ['状态', statusLabel(u.status), ''],
            ]);
            ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 8 }];
            XLSX.utils.book_append_sheet(wb, ws, '核时使用');
        }
        if (storageStats.value?.length) {
            const ws = XLSX.utils.aoa_to_sheet([
                ['用户名', '文件系统', '已用量(GB)', '软限制(GB)', '硬限制(GB)', '使用率(%)', '超软限制'],
                ...storageStats.value.map(r => [r.username, r.filesystem, +r.used_gb.toFixed(2), +r.soft_limit_gb.toFixed(2), +r.hard_limit_gb.toFixed(2), +r.usage_percent.toFixed(2), r.over_soft_limit ? '是' : '否']),
            ]);
            ws['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }];
            XLSX.utils.book_append_sheet(wb, ws, '存储用量');
        }
        if (quotaStats.value?.account) {
            const q = quotaStats.value;
            const ws = XLSX.utils.aoa_to_sheet([
                ['指标', '数值', '单位'],
                ['统计周期', `${startDate} ~ ${endDate}`, ''],
                ['账户', q.account, ''],
                ['配额总量', +q.total_billing_hours.toFixed(2), 'h'],
                ['已用量', +q.used_billing_hours.toFixed(2), 'h'],
                ['剩余量', +q.remaining_billing_hours.toFixed(2), 'h'],
                ['使用率', +q.usage_percent.toFixed(2), '%'],
                ['状态', statusLabel(q.status), ''],
            ]);
            ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 8 }];
            XLSX.utils.book_append_sheet(wb, ws, '配额情况');
        }
        if (wb.SheetNames.length === 0)
            return;
        XLSX.writeFile(wb, `报表中心_${startDate}_${endDate}.xlsx`);
    });
}
onMounted(() => {
    loadPartitions();
    loadAll();
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['filter-item']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-item']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-item']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-item']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-item']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-item']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-item']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['state-card']} */ ;
/** @type {__VLS_StyleScopedClasses['chart-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "reports-page" },
});
/** @type {__VLS_StyleScopedClasses['reports-page']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "filter-bar" },
});
/** @type {__VLS_StyleScopedClasses['filter-bar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "page-title-wrap" },
});
/** @type {__VLS_StyleScopedClasses['page-title-wrap']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    'stroke-width': "2",
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "18",
    y1: "20",
    x2: "18",
    y2: "10",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "12",
    y1: "20",
    x2: "12",
    y2: "4",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "6",
    y1: "20",
    x2: "6",
    y2: "14",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "page-title" },
});
/** @type {__VLS_StyleScopedClasses['page-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "filter-bar-right" },
});
/** @type {__VLS_StyleScopedClasses['filter-bar-right']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "filter-item" },
});
/** @type {__VLS_StyleScopedClasses['filter-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "date",
    max: (__VLS_ctx.filters.endDate),
});
(__VLS_ctx.filters.startDate);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "filter-item" },
});
/** @type {__VLS_StyleScopedClasses['filter-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "date",
    min: (__VLS_ctx.filters.startDate),
});
(__VLS_ctx.filters.endDate);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "filter-item" },
});
/** @type {__VLS_StyleScopedClasses['filter-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_ctx.filters.partition),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
for (const [p] of __VLS_vFor((__VLS_ctx.partitions))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (p),
        value: (p),
    });
    (p);
    // @ts-ignore
    [filters, filters, filters, filters, filters, partitions,];
}
if (__VLS_ctx.dateError) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "date-error" },
    });
    /** @type {__VLS_StyleScopedClasses['date-error']} */ ;
    (__VLS_ctx.dateError);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.loadAll) },
    ...{ class: "btn-primary" },
    disabled: (__VLS_ctx.loading || !!__VLS_ctx.dateError),
});
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    'stroke-width': "2.5",
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
    cx: "11",
    cy: "11",
    r: "8",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "21",
    y1: "21",
    x2: "16.65",
    y2: "16.65",
});
(__VLS_ctx.loading ? '查询中...' : '查询');
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.exportExcel) },
    ...{ class: "btn-secondary" },
    disabled: (!__VLS_ctx.hasAnyData),
});
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    'stroke-width': "2",
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.polyline)({
    points: "7 10 12 15 17 10",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "12",
    y1: "15",
    x2: "12",
    y2: "3",
});
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "state-card" },
    });
    /** @type {__VLS_StyleScopedClasses['state-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "spinner" },
    });
    /** @type {__VLS_StyleScopedClasses['spinner']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
}
else if (__VLS_ctx.globalError) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "state-card error-state" },
    });
    /** @type {__VLS_StyleScopedClasses['state-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['error-state']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        width: "24",
        height: "24",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        'stroke-width': "2",
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "12",
        cy: "12",
        r: "10",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.line)({
        x1: "12",
        y1: "8",
        x2: "12",
        y2: "12",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.line)({
        x1: "12",
        y1: "16",
        x2: "12.01",
        y2: "16",
    });
    (__VLS_ctx.globalError);
}
if (__VLS_ctx.queried) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card chart-card" },
    });
    /** @type {__VLS_StyleScopedClasses['card']} */ ;
    /** @type {__VLS_StyleScopedClasses['chart-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card-title" },
    });
    /** @type {__VLS_StyleScopedClasses['card-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        width: "15",
        height: "15",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        'stroke-width': "2",
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.polyline)({
        points: "22 12 18 12 15 21 9 3 6 12 2 12",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ref: "lineChartRef",
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chart-row" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card chart-card" },
    });
    /** @type {__VLS_StyleScopedClasses['card']} */ ;
    /** @type {__VLS_StyleScopedClasses['chart-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card-title" },
    });
    /** @type {__VLS_StyleScopedClasses['card-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        width: "15",
        height: "15",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        'stroke-width': "2",
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
        x: "18",
        y: "3",
        width: "4",
        height: "18",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
        x: "10",
        y: "8",
        width: "4",
        height: "13",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
        x: "2",
        y: "13",
        width: "4",
        height: "8",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ref: "scaleChartRef",
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card chart-card" },
    });
    /** @type {__VLS_StyleScopedClasses['card']} */ ;
    /** @type {__VLS_StyleScopedClasses['chart-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card-title" },
    });
    /** @type {__VLS_StyleScopedClasses['card-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        width: "15",
        height: "15",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        'stroke-width': "2",
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "M6 3h12l4 6-10 13L2 9z",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ref: "usageChartRef",
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chart-row" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card chart-card" },
    });
    /** @type {__VLS_StyleScopedClasses['card']} */ ;
    /** @type {__VLS_StyleScopedClasses['chart-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card-title" },
    });
    /** @type {__VLS_StyleScopedClasses['card-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        width: "15",
        height: "15",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        'stroke-width': "2",
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "12",
        cy: "12",
        r: "10",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.polyline)({
        points: "12 6 12 12 16 14",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ref: "billingChartRef",
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card chart-card" },
    });
    /** @type {__VLS_StyleScopedClasses['card']} */ ;
    /** @type {__VLS_StyleScopedClasses['chart-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card-title" },
    });
    /** @type {__VLS_StyleScopedClasses['card-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        width: "15",
        height: "15",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        'stroke-width': "2",
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "M22 12h-4l-3 9L9 3l-3 9H2",
    });
    if (__VLS_ctx.quotaStats?.account) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "account-tag" },
        });
        /** @type {__VLS_StyleScopedClasses['account-tag']} */ ;
        (__VLS_ctx.quotaStats.account);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ref: "quotaChartRef",
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.storageStats && __VLS_ctx.storageStats.length > 0) }, null, null);
    /** @type {__VLS_StyleScopedClasses['card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card-title" },
    });
    /** @type {__VLS_StyleScopedClasses['card-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        width: "15",
        height: "15",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        'stroke-width': "2",
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.ellipse)({
        cx: "12",
        cy: "5",
        rx: "9",
        ry: "3",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "M21 12c0 1.66-4 3-9 3s-9-1.34-9-3",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ref: "storageChartRef",
        ...{ style: ({ width: '100%', height: __VLS_ctx.storageChartHeight + 'px' }) },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card chart-card" },
    });
    /** @type {__VLS_StyleScopedClasses['card']} */ ;
    /** @type {__VLS_StyleScopedClasses['chart-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card-title" },
    });
    /** @type {__VLS_StyleScopedClasses['card-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        width: "15",
        height: "15",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        'stroke-width': "2",
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.polygon)({
        points: "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ref: "qosChartRef",
        ...{ style: {} },
    });
}
else if (!__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "state-card" },
    });
    /** @type {__VLS_StyleScopedClasses['state-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        width: "40",
        height: "40",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        'stroke-width': "1.5",
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.line)({
        x1: "18",
        y1: "20",
        x2: "18",
        y2: "10",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.line)({
        x1: "12",
        y1: "20",
        x2: "12",
        y2: "4",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.line)({
        x1: "6",
        y1: "20",
        x2: "6",
        y2: "14",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
}
// @ts-ignore
[dateError, dateError, dateError, loadAll, loading, loading, loading, loading, exportExcel, hasAnyData, globalError, globalError, queried, quotaStats, quotaStats, storageStats, storageStats, storageChartHeight,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
