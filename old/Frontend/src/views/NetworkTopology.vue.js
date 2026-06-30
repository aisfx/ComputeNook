/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { getApiBase } from '../utils/auth';
import { dialog } from '../utils/dialog';
const STORAGE_KEY = 'topo-v2';
const wrapRef = ref(null);
const svgRef = ref(null);
const loading = ref(false);
const error = ref('');
const topoNodes = ref([]);
const edges = ref([]);
const selected = ref(null);
const zoom = ref(1);
const pan = ref({ x: 60, y: 60 });
const linkMode = ref(false);
const linkSrc = ref('');
let dragging = null;
let dragOffX = 0, dragOffY = 0;
let panning = false, panStart = { x: 0, y: 0 };
const token = () => localStorage.getItem('token') || sessionStorage.getItem('token') || '';
const nodeById = computed(() => Object.fromEntries(topoNodes.value.map(n => [n.id, n])));
const COLORS = {
    compute: { fill: '#dbeafe', stroke: '#3b82f6' },
    gpu: { fill: '#ede9fe', stroke: '#8b5cf6' },
    switch: { fill: '#e2e8f0', stroke: '#475569' },
    storage: { fill: '#d1fae5', stroke: '#10b981' },
    router: { fill: '#fce7f3', stroke: '#ec4899' },
    firewall: { fill: '#fee2e2', stroke: '#ef4444' },
};
const HEALTH_STROKE = {
    up: '#22c55e',
    warn: '#f59e0b',
    down: '#ef4444',
    unknown: '#94a3b8',
};
function nodeFill(n) {
    if (n.promHealth === 'down')
        return '#f3f4f6';
    return COLORS[n.type]?.fill || '#f1f5f9';
}
function nodeStroke(n) {
    if (n.promHealth && n.promHealth !== 'unknown')
        return HEALTH_STROKE[n.promHealth] || COLORS[n.type]?.stroke || '#94a3b8';
    return COLORS[n.type]?.stroke || '#94a3b8';
}
function labelColor(n) { return n.promHealth === 'down' ? '#9ca3af' : '#1e293b'; }
function edgeColor(e) {
    const from = nodeById.value[e.from];
    const to = nodeById.value[e.to];
    if (!from || !to)
        return '#94a3b8';
    if (from.promHealth === 'down' || to.promHealth === 'down')
        return '#ef4444';
    if (from.promHealth === 'warn' || to.promHealth === 'warn')
        return '#f59e0b';
    if (from.promHealth === 'up' && to.promHealth === 'up')
        return '#22c55e';
    return '#94a3b8';
}
const typeLabel = (t) => ({ switch: '交换机', compute: '计算节点', gpu: 'GPU节点', storage: '存储', router: '路由器', firewall: '防火墙' }[t] || t);
const healthLabel = (h) => ({ up: '正常', warn: '延迟', down: '离线', unknown: '未知' }[h] || h);
function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes: topoNodes.value, edges: edges.value }));
}
function load() {
    try {
        const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        if (d?.nodes) {
            topoNodes.value = d.nodes;
            edges.value = d.edges || [];
        }
    }
    catch { }
}
const loadData = async () => {
    loading.value = true;
    error.value = '';
    try {
        const [rRes, tRes] = await Promise.allSettled([
            fetch(getApiBase() + '/api/monitoring/rack', { headers: { Authorization: 'Bearer ' + token() } }),
            fetch(getApiBase() + '/api/monitoring/prom-targets', { headers: { Authorization: 'Bearer ' + token() } }),
        ]);
        const racks = rRes.status === 'fulfilled' && rRes.value.ok ? (await rRes.value.json()).data || [] : [];
        const targetsData = tRes.status === 'fulfilled' && tRes.value.ok ? await tRes.value.json() : { targets: [] };
        const targets = targetsData.targets || [];
        const healthMap = {};
        for (const t of targets) {
            const key = (t.instance || '').replace(/:\d+$/, '');
            const latency = t.last_scrape ? Math.round(parseFloat(t.last_scrape) * 1000) : null;
            const health = t.health === 'up' ? (latency && latency > 500 ? 'warn' : 'up') : t.health === 'down' ? 'down' : 'unknown';
            healthMap[key] = { health, error: t.last_error || '', latency };
            if (t.labels?.hostname)
                healthMap[t.labels.hostname] = healthMap[key];
        }
        const newNodes = [];
        for (const rack of racks) {
            for (const dev of (rack.devices || [])) {
                if (dev.type === 'empty' || dev.type === 'pdu')
                    continue;
                const hk = (dev.ip || dev.name || '').replace(/:\d+$/, '');
                const h = healthMap[hk] || healthMap[dev.name] || { health: 'unknown', error: '', latency: null };
                const prev = topoNodes.value.find(n => n.id === dev.id);
                newNodes.push({
                    id: dev.id, label: dev.name, type: dev.type, model: dev.model || '',
                    ip: dev.ip || '', promHealth: h.health, promError: h.error, latency: h.latency,
                    cpu: null, mem: null,
                    x: prev?.x ?? (Math.random() * 600 + 100),
                    y: prev?.y ?? (Math.random() * 400 + 80),
                    r: dev.type === 'switch' ? 24 : 18,
                });
            }
        }
        topoNodes.value = newNodes;
        save();
    }
    catch (e) {
        error.value = e.message;
    }
    finally {
        loading.value = false;
    }
};
function removeNode(id) {
    topoNodes.value = topoNodes.value.filter(n => n.id !== id);
    edges.value = edges.value.filter(e => e.from !== id && e.to !== id);
    selected.value = null;
    save();
}
function toggleLinkMode() {
    linkMode.value = !linkMode.value;
    linkSrc.value = '';
}
function onNodeClick(n) {
    if (!linkMode.value) {
        selected.value = n;
        return;
    }
    if (!linkSrc.value) {
        linkSrc.value = n.id;
        return;
    }
    if (linkSrc.value === n.id) {
        linkSrc.value = '';
        return;
    }
    const exists = edges.value.find(e => (e.from === linkSrc.value && e.to === n.id) || (e.from === n.id && e.to === linkSrc.value));
    if (!exists) {
        edges.value.push({ id: 'e-' + Date.now(), from: linkSrc.value, to: n.id, dashed: false });
        save();
    }
    linkSrc.value = '';
}
function removeEdge(id) {
    dialog.confirm('删除该连线？', { title: '确认删除', danger: true }).then(ok => {
        if (!ok)
            return;
        edges.value = edges.value.filter(e => e.id !== id);
        save();
    });
}
function clearLinks() {
    dialog.confirm('清空所有连线？', { title: '确认清空', danger: true }).then(ok => {
        if (!ok)
            return;
        edges.value = [];
        save();
    });
}
function startDrag(e, n) {
    if (linkMode.value)
        return;
    dragging = n;
    const r = svgRef.value.getBoundingClientRect();
    dragOffX = (e.clientX - r.left) / zoom.value - pan.value.x / zoom.value - n.x;
    dragOffY = (e.clientY - r.top) / zoom.value - pan.value.y / zoom.value - n.y;
}
function onSvgMouseDown(e) {
    const t = e.target;
    if (t === svgRef.value || t.tagName === 'svg' || t.tagName === 'line') {
        panning = true;
        panStart = { x: e.clientX - pan.value.x, y: e.clientY - pan.value.y };
    }
}
function onSvgMouseMove(e) {
    if (dragging) {
        const r = svgRef.value.getBoundingClientRect();
        dragging.x = (e.clientX - r.left - pan.value.x) / zoom.value - dragOffX;
        dragging.y = (e.clientY - r.top - pan.value.y) / zoom.value - dragOffY;
    }
    else if (panning) {
        pan.value = { x: e.clientX - panStart.x, y: e.clientY - panStart.y };
    }
}
function onSvgMouseUp() { if (dragging)
    save(); dragging = null; panning = false; }
function onWheel(e) { zoom.value = Math.min(3, Math.max(0.15, zoom.value * (e.deltaY > 0 ? 0.9 : 1.1))); }
function resetView() { zoom.value = 1; pan.value = { x: 60, y: 60 }; }
function onKeyDown(e) { if (e.key === 'Escape') {
    linkMode.value = false;
    linkSrc.value = '';
} }
let refreshTimer = null;
onMounted(() => {
    load();
    loadData();
    window.addEventListener('keydown', onKeyDown);
    refreshTimer = setInterval(loadData, 30000);
});
onUnmounted(() => {
    window.removeEventListener('keydown', onKeyDown);
    if (refreshTimer)
        clearInterval(refreshTimer);
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['btn-sec']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sec']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sec']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-pri']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-pri']} */ ;
/** @type {__VLS_StyleScopedClasses['topo-edge']} */ ;
/** @type {__VLS_StyleScopedClasses['drag-cursor']} */ ;
/** @type {__VLS_StyleScopedClasses['tt-close']} */ ;
/** @type {__VLS_StyleScopedClasses['tt-row']} */ ;
/** @type {__VLS_StyleScopedClasses['tt-btn-del']} */ ;
/** @type {__VLS_StyleScopedClasses['fg']} */ ;
/** @type {__VLS_StyleScopedClasses['fg']} */ ;
/** @type {__VLS_StyleScopedClasses['fg']} */ ;
/** @type {__VLS_StyleScopedClasses['fg']} */ ;
/** @type {__VLS_StyleScopedClasses['fg']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "topo-page" },
});
/** @type {__VLS_StyleScopedClasses['topo-page']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "topo-toolbar" },
});
/** @type {__VLS_StyleScopedClasses['topo-toolbar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "topo-legend" },
});
/** @type {__VLS_StyleScopedClasses['topo-legend']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-item" },
});
/** @type {__VLS_StyleScopedClasses['leg-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-dot dot-compute" },
});
/** @type {__VLS_StyleScopedClasses['leg-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['dot-compute']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-item" },
});
/** @type {__VLS_StyleScopedClasses['leg-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-dot dot-gpu" },
});
/** @type {__VLS_StyleScopedClasses['leg-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['dot-gpu']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-item" },
});
/** @type {__VLS_StyleScopedClasses['leg-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-dot dot-switch" },
});
/** @type {__VLS_StyleScopedClasses['leg-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['dot-switch']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-item" },
});
/** @type {__VLS_StyleScopedClasses['leg-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-dot dot-storage" },
});
/** @type {__VLS_StyleScopedClasses['leg-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['dot-storage']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-item" },
});
/** @type {__VLS_StyleScopedClasses['leg-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-dot dot-router" },
});
/** @type {__VLS_StyleScopedClasses['leg-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['dot-router']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-sep" },
});
/** @type {__VLS_StyleScopedClasses['leg-sep']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-item" },
});
/** @type {__VLS_StyleScopedClasses['leg-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-dot dot-up" },
});
/** @type {__VLS_StyleScopedClasses['leg-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['dot-up']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-item" },
});
/** @type {__VLS_StyleScopedClasses['leg-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-dot dot-latency" },
});
/** @type {__VLS_StyleScopedClasses['leg-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['dot-latency']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-item" },
});
/** @type {__VLS_StyleScopedClasses['leg-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-dot dot-dn" },
});
/** @type {__VLS_StyleScopedClasses['leg-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['dot-dn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "topo-toolbar-right" },
});
/** @type {__VLS_StyleScopedClasses['topo-toolbar-right']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.toggleLinkMode) },
    ...{ class: "btn-sec" },
    ...{ class: ({ active: __VLS_ctx.linkMode }) },
});
/** @type {__VLS_StyleScopedClasses['btn-sec']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
(__VLS_ctx.linkMode ? "连线中..." : "手动连线");
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.clearLinks) },
    ...{ class: "btn-sec" },
    disabled: (__VLS_ctx.edges.length === 0),
});
/** @type {__VLS_StyleScopedClasses['btn-sec']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.loadData) },
    ...{ class: "btn-sec" },
    disabled: (__VLS_ctx.loading),
});
/** @type {__VLS_StyleScopedClasses['btn-sec']} */ ;
(__VLS_ctx.loading ? "加载中..." : "刷新");
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.resetView) },
    ...{ class: "btn-sec" },
});
/** @type {__VLS_StyleScopedClasses['btn-sec']} */ ;
if (__VLS_ctx.error) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "topo-err" },
    });
    /** @type {__VLS_StyleScopedClasses['topo-err']} */ ;
    (__VLS_ctx.error);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "topo-canvas-wrap" },
    ref: "wrapRef",
});
/** @type {__VLS_StyleScopedClasses['topo-canvas-wrap']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    ...{ onWheel: (__VLS_ctx.onWheel) },
    ...{ onMousedown: (__VLS_ctx.onSvgMouseDown) },
    ...{ onMousemove: (__VLS_ctx.onSvgMouseMove) },
    ...{ onMouseup: (__VLS_ctx.onSvgMouseUp) },
    ...{ onMouseleave: (__VLS_ctx.onSvgMouseUp) },
    ref: "svgRef",
    ...{ class: "topo-svg" },
});
/** @type {__VLS_StyleScopedClasses['topo-svg']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.defs, __VLS_intrinsics.defs)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.marker, __VLS_intrinsics.marker)({
    id: "arr",
    markerWidth: "8",
    markerHeight: "8",
    refX: "6",
    refY: "3",
    orient: "auto",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M0,0 L0,6 L8,3 z",
    fill: "#94a3b8",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.g, __VLS_intrinsics.g)({
    transform: (`translate(${__VLS_ctx.pan.x},${__VLS_ctx.pan.y}) scale(${__VLS_ctx.zoom})`),
});
for (const [e] of __VLS_vFor((__VLS_ctx.edges))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.line)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.removeEdge(e.id);
                // @ts-ignore
                [toggleLinkMode, linkMode, linkMode, clearLinks, edges, edges, loadData, loading, loading, resetView, error, error, onWheel, onSvgMouseDown, onSvgMouseMove, onSvgMouseUp, onSvgMouseUp, pan, pan, zoom, removeEdge,];
            } },
        key: (e.id),
        x1: (__VLS_ctx.nodeById[e.from] ? __VLS_ctx.nodeById[e.from].x : 0),
        y1: (__VLS_ctx.nodeById[e.from] ? __VLS_ctx.nodeById[e.from].y : 0),
        x2: (__VLS_ctx.nodeById[e.to] ? __VLS_ctx.nodeById[e.to].x : 0),
        y2: (__VLS_ctx.nodeById[e.to] ? __VLS_ctx.nodeById[e.to].y : 0),
        stroke: (__VLS_ctx.edgeColor(e)),
        'stroke-width': "2",
        'stroke-opacity': "0.75",
        'marker-end': "url(#arr)",
        ...{ class: "topo-edge" },
    });
    /** @type {__VLS_StyleScopedClasses['topo-edge']} */ ;
    // @ts-ignore
    [nodeById, nodeById, nodeById, nodeById, nodeById, nodeById, nodeById, nodeById, edgeColor,];
}
for (const [n] of __VLS_vFor((__VLS_ctx.topoNodes))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.g, __VLS_intrinsics.g)({
        ...{ onMousedown: (...[$event]) => {
                __VLS_ctx.startDrag($event, n);
                // @ts-ignore
                [topoNodes, startDrag,];
            } },
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.onNodeClick(n);
                // @ts-ignore
                [onNodeClick,];
            } },
        key: (n.id),
        transform: (`translate(${n.x},${n.y})`),
        ...{ class: ([__VLS_ctx.linkMode ? `link-cursor` : `drag-cursor`, __VLS_ctx.linkSrc === n.id ? `link-src` : ``, __VLS_ctx.selected && __VLS_ctx.selected.id === n.id ? `node-sel` : ``]) },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        r: (n.r),
        fill: (__VLS_ctx.nodeFill(n)),
        stroke: (__VLS_ctx.nodeStroke(n)),
        'stroke-width': "2.5",
    });
    if (n.promHealth) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.text, __VLS_intrinsics.text)({
            'text-anchor': "middle",
            y: "5",
            'font-size': "9",
            fill: "#fff",
            'font-weight': "700",
            ...{ style: {} },
        });
        (n.promHealth === `up` ? `UP` : `DN`);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.text, __VLS_intrinsics.text)({
        'text-anchor': "middle",
        y: (n.r + 14),
        'font-size': "11",
        fill: (__VLS_ctx.labelColor(n)),
        ...{ style: {} },
    });
    (n.label);
    // @ts-ignore
    [linkMode, linkSrc, selected, selected, nodeFill, nodeStroke, labelColor,];
}
if (__VLS_ctx.selected) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "topo-tooltip" },
    });
    /** @type {__VLS_StyleScopedClasses['topo-tooltip']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.selected))
                    return;
                __VLS_ctx.selected = null;
                // @ts-ignore
                [selected, selected,];
            } },
        ...{ class: "tt-close" },
    });
    /** @type {__VLS_StyleScopedClasses['tt-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tt-name" },
    });
    /** @type {__VLS_StyleScopedClasses['tt-name']} */ ;
    (__VLS_ctx.selected.label);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tt-row" },
    });
    /** @type {__VLS_StyleScopedClasses['tt-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.typeLabel(__VLS_ctx.selected.type));
    if (__VLS_ctx.selected.model) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "tt-row" },
        });
        /** @type {__VLS_StyleScopedClasses['tt-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.selected.model);
    }
    if (__VLS_ctx.selected.ip) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "tt-row" },
        });
        /** @type {__VLS_StyleScopedClasses['tt-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "mono" },
        });
        /** @type {__VLS_StyleScopedClasses['mono']} */ ;
        (__VLS_ctx.selected.ip);
    }
    if (__VLS_ctx.selected.promHealth) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "tt-row" },
        });
        /** @type {__VLS_StyleScopedClasses['tt-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: ([`tt-health`, `health-` + __VLS_ctx.selected.promHealth]) },
        });
        /** @type {__VLS_StyleScopedClasses['tt-health']} */ ;
        (__VLS_ctx.healthLabel(__VLS_ctx.selected.promHealth));
    }
    if (__VLS_ctx.selected.latency) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "tt-row" },
        });
        /** @type {__VLS_StyleScopedClasses['tt-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.selected.latency);
    }
    if (__VLS_ctx.selected.cpu != null) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "tt-row" },
        });
        /** @type {__VLS_StyleScopedClasses['tt-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.selected.cpu);
    }
    if (__VLS_ctx.selected.mem != null) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "tt-row" },
        });
        /** @type {__VLS_StyleScopedClasses['tt-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.selected.mem);
    }
    if (__VLS_ctx.selected.promError) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "tt-row" },
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['tt-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.selected.promError);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tt-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['tt-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.selected))
                    return;
                __VLS_ctx.removeNode(__VLS_ctx.selected.id);
                // @ts-ignore
                [selected, selected, selected, selected, selected, selected, selected, selected, selected, selected, selected, selected, selected, selected, selected, selected, selected, selected, typeLabel, healthLabel, removeNode,];
            } },
        ...{ class: "tt-btn-del" },
    });
    /** @type {__VLS_StyleScopedClasses['tt-btn-del']} */ ;
}
if (__VLS_ctx.linkMode) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "link-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['link-hint']} */ ;
    (__VLS_ctx.linkSrc ? "再点击目标节点完成连线，Esc取消" : "点击源节点开始连线");
}
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "topo-loading" },
    });
    /** @type {__VLS_StyleScopedClasses['topo-loading']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "spin" },
    });
    /** @type {__VLS_StyleScopedClasses['spin']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
}
if (!__VLS_ctx.loading && __VLS_ctx.topoNodes.length === 0 && !__VLS_ctx.error) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "topo-empty" },
    });
    /** @type {__VLS_StyleScopedClasses['topo-empty']} */ ;
}
// @ts-ignore
[linkMode, loading, loading, error, topoNodes, linkSrc,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
