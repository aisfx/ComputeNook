/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import axios from 'axios';
const props = defineProps();
const W = 400;
const H = 160;
const PAD = 36;
const points = ref([]);
const loading = ref(false);
const error = ref('');
let timer = null;
const minV = computed(() => Math.min(...points.value.map(p => p.v)));
const maxV = computed(() => Math.max(...points.value.map(p => p.v)));
const range = computed(() => Math.max(maxV.value - minV.value, 0.001));
const toX = (t) => {
    const ts = points.value.map(p => p.t);
    const mn = Math.min(...ts), mx = Math.max(...ts);
    return PAD + ((t - mn) / Math.max(mx - mn, 1)) * (W - PAD * 2);
};
const toY = (v) => H - 16 - ((v - minV.value) / range.value) * (H - 32);
const linePath = computed(() => {
    if (!points.value.length)
        return '';
    return points.value.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.t).toFixed(1)},${toY(p.v).toFixed(1)}`).join(' ');
});
const areaPath = computed(() => {
    if (!points.value.length)
        return '';
    const base = H - 16;
    const line = points.value.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.t).toFixed(1)},${toY(p.v).toFixed(1)}`).join(' ');
    const last = points.value[points.value.length - 1];
    const first = points.value[0];
    return `${line} L${toX(last.t).toFixed(1)},${base} L${toX(first.t).toFixed(1)},${base} Z`;
});
const gridYs = computed(() => [0.2, 0.5, 0.8].map(r => H - 16 - r * (H - 32)));
const yLabels = computed(() => [0.8, 0.5, 0.2].map(r => {
    const v = minV.value + r * range.value;
    return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(1);
}));
const latestLabel = computed(() => {
    if (!points.value.length)
        return '';
    const v = points.value[points.value.length - 1].v;
    return `${v >= 1000 ? (v / 1000).toFixed(2) + 'k' : v.toFixed(2)} ${props.unit || ''}`;
});
const fetchData = async () => {
    if (!props.query)
        return;
    loading.value = true;
    error.value = '';
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const end = Math.floor(Date.now() / 1000);
        const start = end - 3600;
        const res = await axios.get('/monitoring/query_range', {
            params: { query: props.query, start, end, step: 60 },
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = res.data?.data?.result?.[0]?.values || [];
        points.value = result.map(([t, v]) => ({ t, v: parseFloat(v) }));
    }
    catch (e) {
        error.value = e?.response?.data?.error || '查询失败';
    }
    finally {
        loading.value = false;
    }
};
watch(() => props.query, fetchData);
onMounted(() => {
    fetchData();
    timer = setInterval(fetchData, 60000);
});
onUnmounted(() => { if (timer)
    clearInterval(timer); });
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['pc-error']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "prom-chart" },
});
/** @type {__VLS_StyleScopedClasses['prom-chart']} */ ;
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pc-loading" },
    });
    /** @type {__VLS_StyleScopedClasses['pc-loading']} */ ;
}
else if (__VLS_ctx.error) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pc-error" },
    });
    /** @type {__VLS_StyleScopedClasses['pc-error']} */ ;
    (__VLS_ctx.error);
}
else if (__VLS_ctx.points.length > 1) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        ...{ class: "pc-svg" },
        viewBox: (`0 0 ${__VLS_ctx.W} ${__VLS_ctx.H}`),
        preserveAspectRatio: "none",
    });
    /** @type {__VLS_StyleScopedClasses['pc-svg']} */ ;
    for (const [y] of __VLS_vFor((__VLS_ctx.gridYs))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.line)({
            key: (y),
            x1: (__VLS_ctx.PAD),
            y1: (y),
            x2: (__VLS_ctx.W - __VLS_ctx.PAD),
            y2: (y),
            stroke: "currentColor",
            'stroke-opacity': "0.08",
            'stroke-width': "1",
        });
        // @ts-ignore
        [loading, error, error, points, W, W, H, gridYs, PAD, PAD,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: (__VLS_ctx.areaPath),
        fill: (__VLS_ctx.color),
        'fill-opacity': "0.12",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: (__VLS_ctx.linePath),
        stroke: (__VLS_ctx.color),
        'stroke-width': "2",
        fill: "none",
        'stroke-linejoin': "round",
    });
    for (const [label, i] of __VLS_vFor((__VLS_ctx.yLabels))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.text, __VLS_intrinsics.text)({
            key: (i),
            x: (__VLS_ctx.PAD - 4),
            y: (__VLS_ctx.gridYs[i] + 4),
            'text-anchor': "end",
            'font-size': "10",
            fill: "currentColor",
            'fill-opacity': "0.5",
        });
        (label);
        // @ts-ignore
        [gridYs, PAD, areaPath, color, color, linePath, yLabels,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.text, __VLS_intrinsics.text)({
        x: (__VLS_ctx.W - __VLS_ctx.PAD),
        y: (__VLS_ctx.H - 4),
        'text-anchor': "end",
        'font-size': "11",
        fill: (__VLS_ctx.color),
        'font-weight': "600",
    });
    (__VLS_ctx.latestLabel);
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pc-empty" },
    });
    /** @type {__VLS_StyleScopedClasses['pc-empty']} */ ;
}
// @ts-ignore
[W, H, PAD, color, latestLabel,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
