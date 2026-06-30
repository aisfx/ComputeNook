/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import axios from 'axios';
import { dialog } from '../utils/dialog';
// ── 数据源状
const dataSources = ref([]);
const activeDsId = ref('');
const showDsPanel = ref(false);
const newDs = ref({ name: '', url: '' });
const activeDs = computed(() => dataSources.value.find(d => d.id === activeDsId.value) || null);
function getPromBase(dsId) {
    const id = dsId ?? activeDsId.value;
    const ds = dataSources.value.find(d => d.id === id);
    if (!ds)
        return '';
    const url = ds.url.replace(/\/$/, '');
    // localhost/127.0.0.1 直连会被浏览器 CORS 拦截，自动走后端代理
    try {
        const u = new URL(url);
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
            return '';
    }
    catch { /* ignore */ }
    return url;
}
function saveDs() {
    localStorage.setItem('pex-datasources', JSON.stringify(dataSources.value));
    localStorage.setItem('pex-active-ds', activeDsId.value);
}
function loadDs() {
    try {
        const raw = localStorage.getItem('pex-datasources');
        if (raw)
            dataSources.value = JSON.parse(raw);
        activeDsId.value = localStorage.getItem('pex-active-ds') || '';
        if (activeDsId.value && !dataSources.value.find(d => d.id === activeDsId.value)) {
            activeDsId.value = dataSources.value[0]?.id || '';
        }
    }
    catch { /* ignore */ }
}
async function addDs() {
    const name = newDs.value.name.trim();
    const url = newDs.value.url.trim();
    if (!name || !url)
        return;
    const ds = { id: Date.now().toString(), name, url, status: 'unknown' };
    dataSources.value.push(ds);
    activeDsId.value = ds.id;
    newDs.value = { name: '', url: '' };
    showDsPanel.value = false;
    saveDs();
    await testDs(ds);
}
function removeDs(id) {
    dataSources.value = dataSources.value.filter(d => d.id !== id);
    if (activeDsId.value === id)
        activeDsId.value = dataSources.value[0]?.id || '';
    saveDs();
}
async function testDs(ds) {
    try {
        const u = new URL(ds.url);
        // localhost/127.0.0.1 不能从浏览器直连，走后端代理测试
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await fetch(`/api/monitoring/promql?query=1`, { headers, signal: AbortSignal.timeout(5000) });
            const json = await res.json();
            ds.status = json.status === 'success' ? 'ok' : 'err';
            saveDs();
            return;
        }
        const res = await fetch(`${ds.url.replace(/\/$/, '')}/api/v1/query?query=1`, { signal: AbortSignal.timeout(5000) });
        const json = await res.json();
        ds.status = json.status === 'success' ? 'ok' : 'err';
    }
    catch {
        ds.status = 'err';
    }
    saveDs();
}
// ── 全局时间范围 ──────────────────────────────────────────────────────────────
const TIME_RANGES = [
    { label: 'now', value: 'now', seconds: 300 },
    { label: '1h', value: '1h', seconds: 3600 },
    { label: '3h', value: '3h', seconds: 10800 },
    { label: '5h', value: '5h', seconds: 18000 },
    { label: '10h', value: '10h', seconds: 36000 },
    { label: '24h', value: '24h', seconds: 86400 },
    { label: '48h', value: '48h', seconds: 172800 },
];
const globalRange = ref('1h');
// auto-calculate step targeting ~300 data points
function autoStep(rangeSeconds) {
    const step = Math.max(15, Math.ceil(rangeSeconds / 300));
    return String(step);
}
function setGlobalRange(val) {
    globalRange.value = val;
    const tr = TIME_RANGES.find(t => t.value === val);
    if (!tr)
        return;
    const step = autoStep(tr.seconds);
    // sync all panels range/step and refresh
    panels.value.forEach(p => { p.range = val; p.step = step; });
    savePanels();
    refreshAll();
}
// ── 面板状态 ──────────────────────────────────────────────────────────────────
const panels = ref([]);
const collapsedGroups = ref(new Set());
const panelGroups = computed(() => {
    const groups = [];
    for (const p of panels.value) {
        const g = p.group || '';
        let grp = groups.find(x => x.name === g);
        if (!grp) {
            grp = { name: g, panels: [] };
            groups.push(grp);
        }
        grp.panels.push(p);
    }
    return groups;
});
function toggleGroup(name) {
    const s = new Set(collapsedGroups.value);
    if (s.has(name))
        s.delete(name);
    else
        s.add(name);
    collapsedGroups.value = s;
}
const editingPanel = ref(null);
const refreshing = ref(false);
const importInputRef = ref(null);
const previewChartEl = ref(null);
const previewGaugeEl = ref(null);
const editForm = ref({ title: '', query: '', chartType: 'line', range: '1h', step: '60', unit: '', decimals: 2, warnThreshold: null, critThreshold: null, dsId: '' });
const queryTab = ref('query');
const vizSearch = ref('');
const previewLoading = ref(false);
const previewDebug = ref('');
const previewError = ref('');
const previewData = ref([]);
const previewKeys = ref([]);
const previewStatVal = ref('');
let panelEls = {};
let panelCharts = {};
let editIsNew = false;
let nextId = 1;
// ── 自由拖拽布局 ──────────────────────────────────────────────────────────────
const GRID = 8; // snap grid px
const MIN_W = 200;
const MIN_H = 150;
const DEFAULT_W = 380;
const DEFAULT_H = 240;
function snapGrid(v) { return Math.round(v / GRID) * GRID; }
function canvasHeight(groupPanels) {
    if (!groupPanels.length)
        return 200;
    return Math.max(200, ...groupPanels.map(p => p.y + p.h)) + 40;
}
// auto-layout: arrange panels in rows of ~3, left-to-right
function autoLayout(panelList, containerW = 1200) {
    const cols = Math.max(1, Math.floor(containerW / (DEFAULT_W + 12)));
    panelList.forEach((p, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        p.x = col * (DEFAULT_W + 12);
        p.y = row * (DEFAULT_H + 12);
        if (!p.w || p.w < MIN_W)
            p.w = DEFAULT_W;
        if (!p.h || p.h < MIN_H)
            p.h = DEFAULT_H;
    });
}
let _dragPanel = null;
let _dragOffX = 0;
let _dragOffY = 0;
let _resizePanel = null;
let _resizeStartX = 0;
let _resizeStartY = 0;
let _resizeStartW = 0;
let _resizeStartH = 0;
function startDrag(e, panel) {
    if (e.target.closest('.pex-panel-acts, .pex-resize-handle'))
        return;
    _dragPanel = panel;
    const rect = e.currentTarget.getBoundingClientRect();
    _dragOffX = e.clientX - rect.left;
    _dragOffY = e.clientY - rect.top;
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragUp);
}
function onDragMove(e) {
    if (!_dragPanel)
        return;
    const canvas = document.querySelector('.pex-canvas');
    if (!canvas)
        return;
    const cr = canvas.getBoundingClientRect();
    _dragPanel.x = snapGrid(Math.max(0, e.clientX - cr.left - _dragOffX));
    _dragPanel.y = snapGrid(Math.max(0, e.clientY - cr.top - _dragOffY));
}
function onDragUp() {
    _dragPanel = null;
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragUp);
    savePanels();
}
function startResize(e, panel) {
    e.preventDefault();
    _resizePanel = panel;
    _resizeStartX = e.clientX;
    _resizeStartY = e.clientY;
    _resizeStartW = panel.w;
    _resizeStartH = panel.h;
    window.addEventListener('mousemove', onResizeMove);
    window.addEventListener('mouseup', onResizeUp);
}
function onResizeMove(e) {
    if (!_resizePanel)
        return;
    _resizePanel.w = snapGrid(Math.max(MIN_W, _resizeStartW + e.clientX - _resizeStartX));
    _resizePanel.h = snapGrid(Math.max(MIN_H, _resizeStartH + e.clientY - _resizeStartY));
    panelCharts[_resizePanel.id]?.resize();
}
function onResizeUp() {
    _resizePanel = null;
    window.removeEventListener('mousemove', onResizeMove);
    window.removeEventListener('mouseup', onResizeUp);
    savePanels();
}
const CHART_TYPES = [
    { value: 'timeseries', label: '时序图', icon: '📈', desc: '时序趋势（Grafana）' },
    { value: 'line', label: '折线图', icon: '〰', desc: '折线' },
    { value: 'bar', label: '柱状图', icon: '', desc: '对比分布' },
    { value: 'area', label: '面积图', icon: '', desc: '堆叠趋势' },
    { value: 'gauge', label: '仪表盘', icon: '', desc: '圆形仪表' },
    { value: 'bargauge', label: '条形仪表', icon: '▬', desc: '条形仪表' },
    { value: 'stat', label: '单值', icon: '#', desc: '当前值' },
    { value: 'table', label: '表格', icon: '≡', desc: '原始数据' },
];
const filteredChartTypes = computed(() => CHART_TYPES.filter(c => !vizSearch.value || c.label.includes(vizSearch.value) || c.value.includes(vizSearch.value)));
const templateVars = ref([]);
const showVarPanel = ref(false);
const newVarName = ref('');
const newVarValue = ref('');
function saveVars() {
    localStorage.setItem('pex-template-vars', JSON.stringify(templateVars.value));
}
// vars referenced in the current editor query - auto-fetch options if missing
const queryVars = computed(() => {
    const vars = extractVars([editForm.value.query]);
    return vars.map(name => {
        let v = templateVars.value.find(v => v.name === name);
        if (!v) {
            v = { name, value: "" };
            templateVars.value.push(v);
        }
        if (!v.options?.length)
            fetchVarOptions(v);
        return v;
    });
});
function loadVars() {
    try {
        const raw = localStorage.getItem('pex-template-vars');
        if (raw)
            templateVars.value = JSON.parse(raw);
    }
    catch { /* ignore */ }
}
function addVar() {
    const name = newVarName.value.trim();
    const value = newVarValue.value.trim();
    if (!name)
        return;
    const existing = templateVars.value.find(v => v.name === name);
    if (existing) {
        existing.value = value;
    }
    else {
        templateVars.value.push({ name, value });
    }
    newVarName.value = '';
    newVarValue.value = '';
    saveVars();
}
function removeVar(name) {
    templateVars.value = templateVars.value.filter(v => v.name !== name);
    saveVars();
}
// fetch var options from Prometheus
async function fetchVarOptions(v) {
    const base = getPromBase();
    // common var name to label mapping
    const labelMap = {
        node: 'instance', instance: 'instance', job: 'job',
        nodename: 'nodename', host: 'instance', cluster: 'cluster',
    };
    const label = labelMap[v.name] || v.name;
    try {
        const res = await fetch(`${base}/api/v1/label/${label}/values`);
        const json = await res.json();
        if (json.status === 'success' && json.data?.length) {
            v.options = json.data;
            if (!v.value)
                v.value = json.data[0];
        }
    }
    catch { /* ignore */ }
}
// auto-fill var defaults after import
async function autoFillVars(vars) {
    const base = getPromBase();
    const labelMap = {
        node: 'instance', instance: 'instance', job: 'job',
        nodename: 'nodename', host: 'instance', cluster: 'cluster',
    };
    await Promise.all(vars.map(async (v) => {
        const label = labelMap[v.name] || v.name;
        try {
            const res = await fetch(`${base}/api/v1/label/${label}/values`);
            const json = await res.json();
            if (json.status === 'success' && json.data?.length) {
                v.options = json.data;
                if (!v.value)
                    v.value = json.data[0];
            }
        }
        catch { /* ignore */ }
    }));
    saveVars();
}
// extract template var names from queries
function extractVars(queries) {
    const builtins = new Set(['__rate_interval', '__interval', '__range', '__from', '__to', '__dashboard', '__user']);
    const found = new Set();
    for (const q of queries) {
        const matches = q.matchAll(/\$(\w+)/g);
        for (const m of matches) {
            if (!builtins.has(m[1]))
                found.add(m[1]);
        }
    }
    return [...found];
}
// ── Grafana 变量替换 ──────────────────────────────────────────────────────────
function sanitizeQuery(query, step) {
    let q = query
        .replace(/\$__rate_interval/g, `${step}s`)
        .replace(/\$__interval/g, `${step}s`)
        .replace(/\$__range/g, `1h`);
    for (const v of templateVars.value) {
        if (v.value)
            q = q.replace(new RegExp(String.raw `\$` + v.name + String.raw `(?=\W|$)`, `g`), v.value);
    }
    // unresolved $var inside label value  match-all
    q = q.replace(/(\w+)\s*=\s*"\$\w+"/g, `$1=~".*"`);
    q = q.replace(/(\w+)\s*!=\s*"\$\w+"/g, `$1=~".*"`);
    // bare $var  .*
    q = q.replace(/\$\w+/g, `.*`);
    q = q.replace(/\{\s*\}/g, ``);
    return q;
}
// ── 查询 ──────────────────────────────────────────────────────────────────────
const RANGE_MAP = {
    'now': 300, '15m': 900, '1h': 3600, '3h': 10800,
    '5h': 18000, '6h': 21600, '10h': 36000, '24h': 86400, '48h': 172800
};
async function queryRange(query, range, step, dsId) {
    const end = Math.floor(Date.now() / 1000);
    const rangeSeconds = RANGE_MAP[range] || 3600;
    const start = end - rangeSeconds;
    const effectiveStep = step && step !== '60' ? step : autoStep(rangeSeconds);
    const base = getPromBase(dsId);
    const q = sanitizeQuery(query, effectiveStep);
    let url;
    let headers = {};
    if (base) {
        url = `${base}/api/v1/query_range?query=${encodeURIComponent(q)}&start=${start}&end=${end}&step=${effectiveStep}`;
    }
    else {
        url = `/api/monitoring/promql/range?query=${encodeURIComponent(q)}&start=${start}&end=${end}&step=${effectiveStep}`;
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (token)
            headers['Authorization'] = `Bearer ${token}`;
    }
    console.debug('[PromExplorer] queryRange url:', url);
    const res = await fetch(url, { headers });
    const json = await res.json();
    console.debug('[PromExplorer] queryRange response:', json);
    if (json.status !== 'success')
        throw new Error(json.error || '查询失败');
    return json.data.result;
}
async function queryInstant(query, dsId) {
    const base = getPromBase(dsId);
    const q = sanitizeQuery(query, '60');
    let url;
    let headers = {};
    if (base) {
        url = `${base}/api/v1/query?query=${encodeURIComponent(q)}`;
    }
    else {
        url = `/api/monitoring/promql?query=${encodeURIComponent(q)}`;
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (token)
            headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(url, { headers });
    const json = await res.json();
    if (json.status !== 'success')
        throw new Error(json.error || '查询失败');
    return json.data.result;
}
function getOrInitChart(el) {
    return echarts.getInstanceByDom(el) ?? echarts.init(el);
}
function renderChart(el, result, chartType, panel) {
    const chart = getOrInitChart(el);
    // gauge/bargauge: use first instant value
    if (chartType === 'gauge' || chartType === 'bargauge') {
        const val = result.length ? parseFloat(result[0].value?.[1] ?? result[0].values?.[result[0].values.length - 1]?.[1] ?? '0') : 0;
        const unit = panel?.unit || '';
        const isPercent = ['percent', 'percentunit', 'percent (0-100)', 'percent (0.0-1.0)'].includes((unit).toLowerCase());
        const displayVal = unit.toLowerCase() === 'percentunit' ? val * 100 : val;
        const max = isPercent ? 100 : (panel?.warnThreshold != null ? Math.max(panel.critThreshold ?? 100, 100) : 100);
        chart.setOption({
            backgroundColor: 'transparent',
            series: [{
                    type: 'gauge',
                    radius: '75%',
                    center: ['50%', '60%'],
                    startAngle: 200, endAngle: -20,
                    min: 0, max,
                    splitNumber: 4,
                    axisLine: {
                        lineStyle: {
                            width: 10,
                            color: [
                                [panel?.warnThreshold ? panel.warnThreshold / max : 0.7, '#10b981'],
                                [panel?.critThreshold ? panel.critThreshold / max : 0.9, '#f59e0b'],
                                [1, '#ef4444'],
                            ],
                        },
                    },
                    pointer: { length: '60%', width: 4, itemStyle: { color: 'auto' } },
                    axisTick: { distance: -12, length: 4, lineStyle: { color: '#fff', width: 1 } },
                    splitLine: { distance: -16, length: 10, lineStyle: { color: '#fff', width: 2 } },
                    axisLabel: { color: '#9ca3af', distance: 16, fontSize: 9 },
                    detail: {
                        valueAnimation: true,
                        formatter: (v) => fmtByUnit(v, isPercent ? 'percent' : unit, panel?.decimals ?? 1),
                        color: 'auto', fontSize: 14, offsetCenter: [0, '70%'],
                    },
                    data: [{ value: displayVal }],
                }],
        }, true);
        return chart;
    }
    // timeseries / line / bar / area
    const isRange = result[0]?.values?.length > 0;
    // find which label keys actually differ across series (to keep labels short but unique)
    const allKeys = result.length ? Object.keys(result[0].metric || {}) : [];
    const varyingKeys = allKeys.filter(k => new Set(result.map((r) => r.metric?.[k])).size > 1);
    const labelKeys = varyingKeys.length > 0 ? varyingKeys : allKeys.slice(0, 2);
    const series = result.map((r) => {
        const metric = r.metric || {};
        const label = labelKeys.length
            ? labelKeys.map(k => metric[k] ?? '').filter(Boolean).join(', ')
            : 'value';
        const data = isRange
            ? r.values.map((v) => [v[0] * 1000, parseFloat(v[1])])
            : [[Date.now(), parseFloat(r.value?.[1] ?? '0')]];
        return {
            name: label,
            type: chartType === 'bar' ? 'bar' : 'line',
            areaStyle: (chartType === 'area' || chartType === 'timeseries') ? { opacity: 0.15 } : undefined,
            data,
            smooth: true,
            symbol: 'none',
            lineStyle: { width: 1.5 },
        };
    });
    chart.setOption({
        backgroundColor: 'transparent',
        animation: false,
        tooltip: { trigger: 'axis', confine: true, textStyle: { fontSize: 11 } },
        legend: series.length > 1 ? { bottom: 0, type: 'scroll', textStyle: { fontSize: 10 }, itemHeight: 8 } : { show: false },
        grid: { left: 48, right: 8, top: 8, bottom: series.length > 1 ? 36 : 8 },
        xAxis: { type: 'time', axisLabel: { fontSize: 10, color: '#6b7280' }, axisLine: { lineStyle: { color: '#e5e7eb' } }, splitLine: { show: false } },
        yAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#6b7280', formatter: (v) => fmtNum(v) }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
        dataZoom: [{ type: 'inside', start: 0, end: 100 }],
        series,
    }, true);
    return chart;
}
function fmtNum(v) {
    if (Math.abs(v) >= 1e9)
        return (v / 1e9).toFixed(1) + 'G';
    if (Math.abs(v) >= 1e6)
        return (v / 1e6).toFixed(1) + 'M';
    if (Math.abs(v) >= 1e3)
        return (v / 1e3).toFixed(1) + 'K';
    return v.toFixed(1);
}
// ── 面板操作 ──────────────────────────────────────────────────────────────────
const panelResizeObservers = {};
function setPanelEl(el, id) {
    if (el) {
        panelEls[id] = el;
        // observe resize to update echarts
        if (panelResizeObservers[id])
            panelResizeObservers[id].disconnect();
        panelResizeObservers[id] = new ResizeObserver(() => {
            panelCharts[id]?.resize();
        });
        panelResizeObservers[id].observe(el);
    }
    else {
        panelResizeObservers[id]?.disconnect();
        delete panelResizeObservers[id];
        delete panelEls[id];
    }
}
function openAddPanel() {
    editIsNew = true;
    editForm.value = { title: '', query: '', chartType: 'line', range: '1h', step: '60', unit: '', decimals: 2, warnThreshold: null, critThreshold: null, dsId: activeDsId.value };
    queryTab.value = 'query';
    previewData.value = [];
    previewError.value = '';
    previewStatVal.value = '';
    editingPanel.value = { id: -1 };
}
function editPanel(pi) {
    editIsNew = false;
    const p = panels.value[pi];
    editingPanel.value = p;
    editForm.value = { title: p.title, query: p.query, chartType: p.chartType, range: p.range, step: p.step, unit: p.unit, decimals: p.decimals, warnThreshold: p.warnThreshold, critThreshold: p.critThreshold, dsId: p.dsId || activeDsId.value };
    queryTab.value = 'query';
    previewData.value = [];
    previewError.value = '';
    previewStatVal.value = '';
}
function closeEditor() { editingPanel.value = null; }
async function applyPanel() {
    const f = editForm.value;
    if (editIsNew) {
        const existing = panels.value;
        const col = existing.length % 3;
        const row = Math.floor(existing.length / 3);
        const p = { id: nextId++, title: f.title, query: f.query, chartType: f.chartType, range: f.range, step: f.step, unit: f.unit, decimals: f.decimals, warnThreshold: f.warnThreshold, critThreshold: f.critThreshold, dsId: f.dsId, x: col * (DEFAULT_W + 12), y: row * (DEFAULT_H + 12), w: DEFAULT_W, h: DEFAULT_H, loading: false, error: '', statVal: '', data: [], keys: [], chart: null };
        panels.value.push(p);
        editingPanel.value = null;
        await nextTick();
        loadPanel(panels.value.length - 1);
    }
    else {
        const p = editingPanel.value;
        Object.assign(p, { title: f.title, query: f.query, chartType: f.chartType, range: f.range, step: f.step, unit: f.unit, decimals: f.decimals, warnThreshold: f.warnThreshold, critThreshold: f.critThreshold, dsId: f.dsId });
        editingPanel.value = null;
        await nextTick();
        const pi = panels.value.findIndex(x => x.id === p.id);
        if (pi >= 0)
            loadPanel(pi);
    }
    savePanels();
}
async function loadPanel(pi) {
    const p = panels.value[pi];
    p.loading = true;
    p.error = '';
    try {
        const dsId = p.dsId || activeDsId.value;
        // if saved dsId no longer exists in dataSources, fall back to active
        const resolvedDsId = getPromBase(dsId) ? dsId : activeDsId.value;
        console.debug(`[loadPanel] "${p.title}" dsId=${dsId} resolved=${resolvedDsId} base="${getPromBase(resolvedDsId)}" chartType=${p.chartType}`);
        if (p.chartType === 'stat' || p.chartType === 'gauge' || p.chartType === 'bargauge') {
            const result = await queryInstant(p.query, resolvedDsId);
            p.data = result;
            p.statVal = result.length ? fmtVal(result[0].value[1], p.unit, p.decimals) : 'N/A';
            if (p.chartType === 'gauge' || p.chartType === 'bargauge') {
                p.loading = false;
                await nextTick();
                await nextTick();
                const el = panelEls[p.id];
                if (el) {
                    const chart = renderChart(el, result, p.chartType, p);
                    if (chart) {
                        chart.resize();
                        panelCharts[p.id] = chart;
                    }
                }
                return;
            }
        }
        else if (p.chartType === 'table') {
            const result = await queryInstant(p.query, resolvedDsId);
            p.data = result;
            p.keys = result.length ? Object.keys(result[0].metric) : [];
        }
        else {
            const result = await queryRange(p.query, p.range, p.step, resolvedDsId);
            console.debug(`[PromExplorer] panel "${p.title}" queryRange result count:`, result.length);
            p.data = result;
            p.loading = false; // set loading false first so v-else DOM renders
            await nextTick();
            await nextTick();
            const el = panelEls[p.id];
            if (el) {
                const chart = renderChart(el, result, p.chartType, p);
                if (chart)
                    setTimeout(() => chart.resize(), 50);
                if (chart)
                    panelCharts[p.id] = chart;
            }
            return; // skip finally setting loading=false again
        }
    }
    catch (e) {
        p.error = e.message || '加载失败';
    }
    finally {
        p.loading = false;
    }
}
async function refreshPanel(pi) { await loadPanel(pi); }
async function refreshAll() { refreshing.value = true; await Promise.all(panels.value.map((_, i) => loadPanel(i))); refreshing.value = false; }
function removePanel(pi) {
    const p = panels.value[pi];
    if (panelCharts[p.id]) {
        panelCharts[p.id].dispose();
        delete panelCharts[p.id];
    }
    delete panelEls[p.id];
    panels.value.splice(pi, 1);
    savePanels();
}
function clearAll() { Object.values(panelCharts).forEach(c => c.dispose()); panelCharts = {}; panelEls = {}; panels.value = []; savePanels(); }
async function runPreview() {
    const f = editForm.value;
    console.debug('[PromExplorer] runPreview called, query:', f.query, 'dsId:', f.dsId, 'chartType:', f.chartType);
    if (!f.query)
        return;
    previewLoading.value = true;
    previewError.value = '';
    previewData.value = [];
    previewStatVal.value = '';
    previewDebug.value = '';
    try {
        const dsId = f.dsId || activeDsId.value;
        if (f.chartType === 'stat' || f.chartType === 'gauge' || f.chartType === 'bargauge') {
            const result = await queryInstant(f.query, dsId);
            previewData.value = result;
            previewStatVal.value = result.length ? fmtVal(result[0].value[1], editForm.value.unit, editForm.value.decimals) : 'N/A';
            if (f.chartType === 'gauge' || f.chartType === 'bargauge') {
                await nextTick();
                if (previewGaugeEl.value)
                    renderChart(previewGaugeEl.value, result, f.chartType);
            }
        }
        else if (f.chartType === 'table') {
            const result = await queryInstant(f.query, dsId);
            previewData.value = result;
            previewKeys.value = result.length ? Object.keys(result[0].metric) : [];
        }
        else {
            const base = getPromBase(dsId);
            const effectiveStep = f.step && f.step !== '60' ? f.step : autoStep(RANGE_MAP[f.range] || 3600);
            const q = sanitizeQuery(f.query, effectiveStep);
            previewDebug.value = `dsId=${dsId} base="${base}" sanitized: ${q}`;
            const result = await queryRange(f.query, f.range, f.step, dsId);
            previewDebug.value = `结果: ${result.length} 条 | ${previewDebug.value}`;
            previewData.value = result;
            await nextTick();
            if (previewChartEl.value) {
                const chart = renderChart(previewChartEl.value, result, f.chartType);
                if (chart)
                    setTimeout(() => chart.resize(), 50);
            }
        }
    }
    catch (e) {
        previewError.value = e.message || '查询失败';
    }
    finally {
        previewLoading.value = false;
    }
}
// ── 工具函数 ──────────────────────────────────────────────────────────────────
// format value by Grafana unit
function fmtByUnit(v, unit, decimals = 2) {
    if (isNaN(v))
        return 'N/A';
    const d = decimals ?? 2;
    const u = (unit || '').trim().toLowerCase();
    // bytes/s variants - check with startsWith to cover all Grafana unit IDs
    if (u === 'bytes' || u === 'decbytes') {
        if (v >= 1073741824)
            return (v / 1073741824).toFixed(d) + ' GB';
        if (v >= 1048576)
            return (v / 1048576).toFixed(d) + ' MB';
        if (v >= 1024)
            return (v / 1024).toFixed(d) + ' KB';
        return v.toFixed(0) + ' B';
    }
    if (u.includes('bps') && !u.includes('bytes') && !u.includes('_b') && !u.includes('_k') && !u.includes('_m') && !u.includes('_g') && !u.includes('_t') && !u.includes('_s') && !u.includes('kib') && !u.includes('mib')) {
        if (v >= 1e9)
            return (v / 1e9).toFixed(d) + ' Gbps';
        if (v >= 1e6)
            return (v / 1e6).toFixed(d) + ' Mbps';
        if (v >= 1e3)
            return (v / 1e3).toFixed(d) + ' Kbps';
        return v.toFixed(d) + ' bps';
    }
    if (u.includes('bps') || u === 'binbps' || u === 'decbps') {
        if (v >= 1073741824)
            return (v / 1073741824).toFixed(d) + ' GB/s';
        if (v >= 1048576)
            return (v / 1048576).toFixed(d) + ' MB/s';
        if (v >= 1024)
            return (v / 1024).toFixed(d) + ' KB/s';
        return v.toFixed(d) + ' B/s';
    }
    switch (u) {
        // percentage
        case 'percent':
        case 'percent (0-100)': return v.toFixed(d) + '%';
        case 'percentunit':
        case 'percent (0.0-1.0)': return (v * 100).toFixed(d) + '%';
        // 时间
        case 's': {
            if (v >= 86400)
                return Math.floor(v / 86400) + 'd ' + Math.floor((v % 86400) / 3600) + 'h';
            if (v >= 3600)
                return Math.floor(v / 3600) + 'h ' + Math.floor((v % 3600) / 60) + 'm';
            if (v >= 60)
                return Math.floor(v / 60) + 'm ' + Math.floor(v % 60) + 's';
            return v.toFixed(d) + 's';
        }
        case 'ms':
            if (v >= 1000)
                return (v / 1000).toFixed(d) + 's';
            return v.toFixed(d) + 'ms';
        case 'μs':
        case 'us':
            if (v >= 1e6)
                return (v / 1e6).toFixed(d) + 's';
            if (v >= 1000)
                return (v / 1000).toFixed(d) + 'ms';
            return v.toFixed(d) + 'μs';
        case 'ns':
            if (v >= 1e9)
                return (v / 1e9).toFixed(d) + 's';
            if (v >= 1e6)
                return (v / 1e6).toFixed(d) + 'ms';
            return v.toFixed(d) + 'ns';
        case 'iops': return v.toFixed(d) + ' IOPS';
        case 'ops':
        case 'eps': return v.toFixed(d) + ' ops/s';
        case 'pps': return v.toFixed(d) + ' pps';
        case 'rotrpm': return v.toFixed(0) + ' RPM';
        case 'celsius': return v.toFixed(d) + '°C';
        case 'fahrenheit': return v.toFixed(d) + '°F';
        case 'hertz': {
            if (v >= 1e9)
                return (v / 1e9).toFixed(d) + ' GHz';
            if (v >= 1e6)
                return (v / 1e6).toFixed(d) + ' MHz';
            if (v >= 1e3)
                return (v / 1e3).toFixed(d) + ' KHz';
            return v.toFixed(d) + ' Hz';
        }
        case 'bool_yes_no': return v ? 'Yes' : 'No';
        case 'bool': return v ? '1' : '0';
        case 'short':
        case 'none':
        case '': {
            if (Math.abs(v) >= 1e9)
                return (v / 1e9).toFixed(d) + 'G';
            if (Math.abs(v) >= 1e6)
                return (v / 1e6).toFixed(d) + 'M';
            if (Math.abs(v) >= 1e3)
                return (v / 1e3).toFixed(d) + 'K';
            return v.toFixed(d);
        }
        default: {
            if (Math.abs(v) >= 1e9)
                return (v / 1e9).toFixed(d) + 'G';
            if (Math.abs(v) >= 1e6)
                return (v / 1e6).toFixed(d) + 'M';
            if (Math.abs(v) >= 1e3)
                return (v / 1e3).toFixed(d) + 'K';
            return v.toFixed(d);
        }
    }
}
function fmtVal(v, unit, decimals) {
    const n = parseFloat(String(v));
    if (isNaN(n))
        return String(v);
    const u = unit ?? '';
    const d = decimals ?? editForm.value?.decimals ?? 2;
    return fmtByUnit(n, u, d);
}
function isBuiltinUnit(unit) {
    return ['bytes', 'decbytes', 'Bps', 'binBps', 'bps', 'percent', 'percentunit', 's', 'ms', 'μs', 'us', 'ns',
        'iops', 'ops', 'eps', 'pps', 'rotrpm', 'celsius', 'fahrenheit', 'hertz', 'bool_yes_no', 'bool', 'short', 'none', ''].includes(unit);
}
function statColor(panel) {
    const raw = panel.data?.[0]?.value?.[1];
    const n = parseFloat(String(raw ?? panel.statVal));
    if (panel.critThreshold != null && n >= panel.critThreshold)
        return '#ef4444';
    if (panel.warnThreshold != null && n >= panel.warnThreshold)
        return '#f59e0b';
    return '#10b981';
}
// ── 导入导出 ──────────────────────────────────────────────────────────────────
function exportPanels() {
    const blob = new Blob([JSON.stringify(panels.value, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'prom-panels.json';
    a.click();
}
function importPanels() { importInputRef.value?.click(); }
function onImportFile(e) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file)
        return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const raw = JSON.parse(ev.target?.result);
            let imported = [];
            if (Array.isArray(raw)) {
                imported = raw.map((p, i) => ({
                    id: p.id ?? (nextId + i), title: p.title || '面板', query: p.query || '',
                    chartType: p.chartType || 'line', range: p.range || '1h', step: p.step || '60',
                    unit: p.unit || '', decimals: p.decimals ?? 2,
                    warnThreshold: p.warnThreshold ?? null, critThreshold: p.critThreshold ?? null,
                    dsId: p.dsId || activeDsId.value,
                    x: p.x ?? 0, y: p.y ?? 0, w: p.w || DEFAULT_W, h: p.h || DEFAULT_H,
                    loading: false, error: '', statVal: '', data: [], keys: [], chart: null
                }));
            }
            else if (raw && typeof raw === 'object') {
                const grafanaPanels = raw.panels || [];
                // parse rows: row panels contain nested panels or act as group separators
                let currentGroup = '';
                const flatPanels = [];
                for (const p of grafanaPanels) {
                    if (p.type === 'row') {
                        currentGroup = p.title || '';
                        // collapsed rows have nested panels
                        if (p.collapsed && p.panels?.length) {
                            for (const cp of p.panels)
                                flatPanels.push({ ...cp, _group: currentGroup });
                        }
                    }
                    else {
                        flatPanels.push({ ...p, _group: currentGroup });
                    }
                }
                // convert Grafana gridPos (24-col grid) to pixel coords
                // canvas width ~1200px → each grid unit = 1200/24 = 50px
                // height grid unit in Grafana is ~30px
                const GU_W = 50; // width grid unit
                const GU_H = 30; // height grid unit
                imported = flatPanels
                    .filter((p) => p.targets?.length)
                    .map((p, i) => {
                    const gp = p.gridPos || {};
                    return {
                        id: nextId + i, title: p.title || '面板',
                        query: p.targets?.[0]?.expr || p.targets?.[0]?.query || '',
                        chartType: p.type === 'stat' ? 'stat'
                            : p.type === 'table' ? 'table'
                                : p.type === 'gauge' ? 'gauge'
                                    : p.type === 'bargauge' ? 'bargauge'
                                        : p.type === 'bar' ? 'bar'
                                            : 'timeseries',
                        range: '1h', step: '60', unit: p.fieldConfig?.defaults?.unit || '',
                        decimals: p.fieldConfig?.defaults?.decimals ?? 2,
                        warnThreshold: null, critThreshold: null, dsId: activeDsId.value,
                        group: p._group || '',
                        x: gp.x != null ? gp.x * GU_W : 0,
                        y: gp.y != null ? gp.y * GU_H : 0,
                        w: gp.w != null ? Math.max(MIN_W, gp.w * GU_W) : DEFAULT_W,
                        h: gp.h != null ? Math.max(MIN_H, gp.h * GU_H) : DEFAULT_H,
                        gx: gp.x ?? undefined, gy: gp.y ?? undefined,
                        gw: gp.w ?? undefined, gh: gp.h ?? undefined,
                        loading: false, error: '', statVal: '', data: [], keys: [], chart: null
                    };
                });
            }
            if (imported.length > 0) {
                // normalize y per group so each group starts at y=0
                const groups = [...new Set(imported.map(p => p.group || ''))];
                for (const g of groups) {
                    const gPanels = imported.filter(p => (p.group || '') === g);
                    const minY = Math.min(...gPanels.map(p => p.y));
                    gPanels.forEach(p => { p.y -= minY; });
                }
                // auto-layout only if all panels have no gridPos (x=0,y=0,w=DEFAULT_W,h=DEFAULT_H)
                const hasGridPos = imported.some(p => p.x !== 0 || p.w !== DEFAULT_W);
                if (!hasGridPos)
                    autoLayout(imported);
                console.debug('[import] sample panel positions:', imported.slice(0, 3).map(p => `${p.title}: x=${p.x} y=${p.y} w=${p.w} h=${p.h} group=${p.group}`));
                const dbName = file.name.replace(/\.(json)$/i, '') || `导入 ${new Date().toLocaleDateString('zh-CN')}`;
                const panelData = imported.map(p => ({
                    id: p.id, title: p.title, query: p.query, chartType: p.chartType,
                    range: p.range, step: p.step, unit: p.unit, decimals: p.decimals,
                    warnThreshold: p.warnThreshold, critThreshold: p.critThreshold, dsId: p.dsId,
                    group: p.group || '', x: p.x, y: p.y, w: p.w, h: p.h,
                    gx: p.gx, gy: p.gy, gw: p.gw, gh: p.gh
                }));
                // 提取变量
                const allQueries = imported.map(p => p.query);
                const found = extractVars(allQueries);
                const newVarList = found.map(name => ({ name, value: '' }));
                const db = {
                    id: Date.now().toString(), name: dbName,
                    panels: panelData, vars: newVarList, createdAt: Date.now()
                };
                dashboards.value.push(db);
                currentDashboardId.value = db.id;
                saveDashboards();
                // 切换到新看板
                panelCharts = {};
                panelEls = {};
                panels.value = imported;
                nextId = Math.max(0, ...imported.map(p => p.id)) + 1;
                templateVars.value = newVarList;
                saveVars();
                savePanels();
                if (newVarList.length > 0) {
                    autoFillVars(newVarList).then(() => {
                        // 同步变量到看板
                        const d = dashboards.value.find(x => x.id === db.id);
                        if (d) {
                            d.vars = JSON.parse(JSON.stringify(templateVars.value));
                            saveDashboards();
                        }
                        showVarPanel.value = true;
                        nextTick(() => panels.value.forEach((_, i) => loadPanel(i)));
                    });
                }
                else {
                    nextTick(() => panels.value.forEach((_, i) => loadPanel(i)));
                }
            }
            else {
                dialog.warning('No importable panels found, check JSON format');
            }
        }
        catch {
            dialog.error('JSON parse failed, check file format');
        }
    };
    reader.readAsText(file);
    input.value = '';
}
const dashboards = ref([]);
const currentDashboardId = ref('');
const newDbName = ref('');
const showDbPanel = ref(false);
const currentDashboard = computed(() => dashboards.value.find(d => d.id === currentDashboardId.value) || null);
function saveDashboards() {
    // 同时写 localStorage（离线兜底）和后端（跨设备同步）
    const payload = {
        dashboards: dashboards.value,
        currentId: currentDashboardId.value,
    };
    localStorage.setItem('pex-dashboards', JSON.stringify(dashboards.value));
    localStorage.setItem('pex-current-db', currentDashboardId.value);
    // 异步保存到后端，失败不影响本地使用
    axios.post('/user/dashboards', payload).catch(() => { });
}
async function loadDashboards() {
    // 优先从后端加载，失败时降级到 localStorage
    try {
        const res = await axios.get('/user/dashboards');
        const data = res.data;
        if (data?.dashboards) {
            dashboards.value = data.dashboards;
            currentDashboardId.value = data.currentId || '';
            // 同步到 localStorage
            localStorage.setItem('pex-dashboards', JSON.stringify(dashboards.value));
            localStorage.setItem('pex-current-db', currentDashboardId.value);
            return;
        }
    }
    catch { /* 后端不可用，降级到本地 */ }
    // 降级：从 localStorage 读取
    try {
        const raw = localStorage.getItem('pex-dashboards');
        if (raw)
            dashboards.value = JSON.parse(raw);
        currentDashboardId.value = localStorage.getItem('pex-current-db') || '';
    }
    catch { /* ignore */ }
}
function saveDashboard() {
    const name = newDbName.value.trim() || `看板 ${new Date().toLocaleDateString('zh-CN')}`;
    const panelData = panels.value.map(p => ({
        id: p.id, title: p.title, query: p.query, chartType: p.chartType,
        range: p.range, step: p.step, unit: p.unit, decimals: p.decimals,
        warnThreshold: p.warnThreshold, critThreshold: p.critThreshold, dsId: p.dsId,
        group: p.group || '', x: p.x, y: p.y, w: p.w, h: p.h, gx: p.gx, gy: p.gy, gw: p.gw, gh: p.gh
    }));
    const existing = dashboards.value.find(d => d.id === currentDashboardId.value);
    if (existing && currentDashboardId.value) {
        existing.name = name;
        existing.panels = panelData;
        existing.vars = JSON.parse(JSON.stringify(templateVars.value));
    }
    else {
        const db = {
            id: Date.now().toString(), name, panels: panelData,
            vars: JSON.parse(JSON.stringify(templateVars.value)), createdAt: Date.now()
        };
        dashboards.value.push(db);
        currentDashboardId.value = db.id;
    }
    newDbName.value = '';
    showDbPanel.value = false;
    saveDashboards();
}
function switchDashboard(id) {
    const db = dashboards.value.find(d => d.id === id);
    if (!db)
        return;
    currentDashboardId.value = id;
    showDbPanel.value = false;
    saveDashboards();
    // load panels and vars
    panelCharts = {};
    panelEls = {};
    panels.value = db.panels.map((p, i) => ({ ...p, x: p.x ?? (i % 3) * (DEFAULT_W + 12), y: p.y ?? Math.floor(i / 3) * (DEFAULT_H + 12), w: p.w || DEFAULT_W, h: p.h || DEFAULT_H, loading: false, error: '', statVal: '', data: [], keys: [], chart: null }));
    nextId = Math.max(0, ...db.panels.map((p) => p.id)) + 1;
    templateVars.value = JSON.parse(JSON.stringify(db.vars || []));
    saveVars();
    nextTick(() => panels.value.forEach((_, i) => loadPanel(i)));
}
function deleteDashboard(id) {
    dashboards.value = dashboards.value.filter(d => d.id !== id);
    if (currentDashboardId.value === id) {
        currentDashboardId.value = '';
        // clear canvas when deleting current dashboard
        Object.values(panelCharts).forEach(c => c.dispose());
        panelCharts = {};
        panelEls = {};
        panels.value = [];
        savePanels();
    }
    saveDashboards();
}
// ── 持久
function savePanels() {
    try {
        localStorage.setItem('prom-explorer-panels', JSON.stringify(panels.value.map(p => ({ id: p.id, title: p.title, query: p.query, chartType: p.chartType, range: p.range, step: p.step, unit: p.unit, decimals: p.decimals, warnThreshold: p.warnThreshold, critThreshold: p.critThreshold, dsId: p.dsId, group: p.group || '', x: p.x, y: p.y, w: p.w, h: p.h, gx: p.gx, gy: p.gy, gw: p.gw, gh: p.gh }))));
    }
    catch { /* ignore */ }
}
function loadSaved() {
    try {
        const raw = localStorage.getItem('prom-explorer-panels');
        if (!raw)
            return;
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
            panels.value = data.map((p) => ({ ...p, loading: false, error: '', statVal: '', data: [], keys: [], chart: null }));
            nextId = Math.max(0, ...data.map((p) => p.id)) + 1;
            nextTick(() => panels.value.forEach((_, i) => loadPanel(i)));
        }
    }
    catch { /* ignore */ }
}
// close panels on outside click
function onDocClick() { showDsPanel.value = false; showDbPanel.value = false; }
onMounted(() => {
    loadDs();
    loadVars();
    loadDashboards();
    loadSaved();
    document.addEventListener('click', onDocClick);
    dataSources.value.forEach(ds => testDs(ds));
});
onUnmounted(() => {
    Object.values(panelCharts).forEach(c => c.dispose());
    document.removeEventListener('click', onDocClick);
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['pex-btn-group']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-btn-group']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-btn-outline']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-tr-select']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-db-selector']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-ds-selector']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-ds-item']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-ds-item']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-ds-del-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-btn-outline']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-btn-outline']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-btn-outline']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-btn-danger']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-run-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-run-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-btn-add']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-group-hd']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-panel-card']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-panel-card']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-panel-card']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-panel-acts']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-ib']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-table']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-table']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-table']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-table-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-editor-btn-discard']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-editor-btn-save']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-editor-btn-save']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-qtab']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-qtab']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-qrow']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-qfield']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-code']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-run-query-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-run-query-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-input']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-sel']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-viz-item']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-viz-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-var-tip']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pex" },
});
/** @type {__VLS_StyleScopedClasses['pex']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pex-topbar" },
});
/** @type {__VLS_StyleScopedClasses['pex-topbar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pex-topbar-left" },
});
/** @type {__VLS_StyleScopedClasses['pex-topbar-left']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "pex-topbar-count" },
});
/** @type {__VLS_StyleScopedClasses['pex-topbar-count']} */ ;
(__VLS_ctx.panels.length);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showDbPanel = !__VLS_ctx.showDbPanel;
            // @ts-ignore
            [panels, showDbPanel, showDbPanel,];
        } },
    ...{ class: "pex-db-selector" },
});
/** @type {__VLS_StyleScopedClasses['pex-db-selector']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "pex-db-icon" },
});
/** @type {__VLS_StyleScopedClasses['pex-db-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "pex-db-name" },
});
/** @type {__VLS_StyleScopedClasses['pex-db-name']} */ ;
(__VLS_ctx.currentDashboard?.name || '默认看板');
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "pex-ds-caret" },
});
/** @type {__VLS_StyleScopedClasses['pex-ds-caret']} */ ;
if (__VLS_ctx.showDbPanel) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "pex-db-dropdown" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-db-dropdown']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-ds-dropdown-title" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-ds-dropdown-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-ds-list" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-ds-list']} */ ;
    for (const [db] of __VLS_vFor((__VLS_ctx.dashboards))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showDbPanel))
                        return;
                    __VLS_ctx.switchDashboard(db.id);
                    // @ts-ignore
                    [showDbPanel, currentDashboard, dashboards, switchDashboard,];
                } },
            key: (db.id),
            ...{ class: (['pex-ds-item', { active: db.id === __VLS_ctx.currentDashboardId }]) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        /** @type {__VLS_StyleScopedClasses['pex-ds-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-ds-item-info" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-ds-item-info']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-ds-item-name" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-ds-item-name']} */ ;
        (db.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-ds-item-url" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-ds-item-url']} */ ;
        (db.panels.length);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showDbPanel))
                        return;
                    __VLS_ctx.deleteDashboard(db.id);
                    // @ts-ignore
                    [currentDashboardId, deleteDashboard,];
                } },
            ...{ class: "pex-ds-del-btn" },
            title: "删除",
        });
        /** @type {__VLS_StyleScopedClasses['pex-ds-del-btn']} */ ;
        // @ts-ignore
        [];
    }
    if (__VLS_ctx.dashboards.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-ds-empty" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-ds-empty']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-ds-add-form" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-ds-add-form']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "pex-input" },
        placeholder: "看板名称",
    });
    (__VLS_ctx.newDbName);
    /** @type {__VLS_StyleScopedClasses['pex-input']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.saveDashboard) },
        ...{ class: "pex-run-btn" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['pex-run-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showDbPanel))
                    return;
                __VLS_ctx.importPanels();
                __VLS_ctx.showDbPanel = false;
                // @ts-ignore
                [showDbPanel, dashboards, newDbName, saveDashboard, importPanels,];
            } },
        ...{ class: "pex-btn-outline" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['pex-btn-outline']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showDbPanel))
                    return;
                __VLS_ctx.exportPanels();
                __VLS_ctx.showDbPanel = false;
                // @ts-ignore
                [showDbPanel, exportPanels,];
            } },
        ...{ class: "pex-btn-outline" },
        ...{ style: {} },
        disabled: (__VLS_ctx.panels.length === 0),
    });
    /** @type {__VLS_StyleScopedClasses['pex-btn-outline']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showDsPanel = !__VLS_ctx.showDsPanel;
            // @ts-ignore
            [panels, showDsPanel, showDsPanel,];
        } },
    ...{ class: "pex-ds-selector" },
});
/** @type {__VLS_StyleScopedClasses['pex-ds-selector']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "pex-ds-dot" },
    ...{ class: (__VLS_ctx.activeDs ? 'ds-ok' : 'ds-na') },
});
/** @type {__VLS_StyleScopedClasses['pex-ds-dot']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "pex-ds-name" },
});
/** @type {__VLS_StyleScopedClasses['pex-ds-name']} */ ;
(__VLS_ctx.activeDs?.name || '未配置数据源');
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "pex-ds-caret" },
});
/** @type {__VLS_StyleScopedClasses['pex-ds-caret']} */ ;
if (__VLS_ctx.showDsPanel) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "pex-ds-dropdown" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-ds-dropdown']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-ds-dropdown-title" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-ds-dropdown-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-ds-list" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-ds-list']} */ ;
    for (const [ds] of __VLS_vFor((__VLS_ctx.dataSources))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showDsPanel))
                        return;
                    __VLS_ctx.activeDsId = ds.id;
                    __VLS_ctx.showDsPanel = false;
                    __VLS_ctx.saveDs();
                    // @ts-ignore
                    [showDsPanel, showDsPanel, activeDs, activeDs, dataSources, activeDsId, saveDs,];
                } },
            key: (ds.id),
            ...{ class: (['pex-ds-item', { active: ds.id === __VLS_ctx.activeDsId }]) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        /** @type {__VLS_StyleScopedClasses['pex-ds-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "pex-ds-dot" },
            ...{ class: (ds.status === 'ok' ? 'ds-ok' : ds.status === 'err' ? 'ds-err' : 'ds-na') },
        });
        /** @type {__VLS_StyleScopedClasses['pex-ds-dot']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-ds-item-info" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-ds-item-info']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-ds-item-name" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-ds-item-name']} */ ;
        (ds.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-ds-item-url" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-ds-item-url']} */ ;
        (ds.url);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showDsPanel))
                        return;
                    __VLS_ctx.removeDs(ds.id);
                    // @ts-ignore
                    [activeDsId, removeDs,];
                } },
            ...{ class: "pex-ds-del-btn" },
            title: "删除",
        });
        /** @type {__VLS_StyleScopedClasses['pex-ds-del-btn']} */ ;
        // @ts-ignore
        [];
    }
    if (__VLS_ctx.dataSources.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-ds-empty" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-ds-empty']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-ds-add-form" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-ds-add-form']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "pex-input" },
        placeholder: "名称，如 本地 Prometheus",
    });
    (__VLS_ctx.newDs.name);
    /** @type {__VLS_StyleScopedClasses['pex-input']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "pex-input" },
        placeholder: "地址，如 http://localhost:9090",
    });
    (__VLS_ctx.newDs.url);
    /** @type {__VLS_StyleScopedClasses['pex-input']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.addDs) },
        ...{ class: "pex-run-btn" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['pex-run-btn']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pex-topbar-actions" },
});
/** @type {__VLS_StyleScopedClasses['pex-topbar-actions']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showVarPanel = !__VLS_ctx.showVarPanel;
            // @ts-ignore
            [dataSources, newDs, newDs, addDs, showVarPanel, showVarPanel,];
        } },
    ...{ class: "pex-btn-outline" },
});
/** @type {__VLS_StyleScopedClasses['pex-btn-outline']} */ ;
(__VLS_ctx.templateVars.length ? ` (${__VLS_ctx.templateVars.length})` : '');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pex-timerange" },
});
/** @type {__VLS_StyleScopedClasses['pex-timerange']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: (...[$event]) => {
            __VLS_ctx.setGlobalRange($event.target.value);
            // @ts-ignore
            [templateVars, templateVars, setGlobalRange,];
        } },
    ...{ class: "pex-tr-select" },
    value: (__VLS_ctx.globalRange),
});
/** @type {__VLS_StyleScopedClasses['pex-tr-select']} */ ;
for (const [tr] of __VLS_vFor((__VLS_ctx.TIME_RANGES))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (tr.value),
        value: (tr.value),
    });
    (tr.label);
    // @ts-ignore
    [globalRange, TIME_RANGES,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.refreshAll) },
    ...{ class: "pex-run-btn" },
    disabled: (__VLS_ctx.refreshing || __VLS_ctx.panels.length === 0),
});
/** @type {__VLS_StyleScopedClasses['pex-run-btn']} */ ;
(__VLS_ctx.refreshing ? '刷新中...' : '全部刷新');
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.clearAll) },
    ...{ class: "pex-btn-outline pex-btn-danger" },
    disabled: (__VLS_ctx.panels.length === 0),
});
/** @type {__VLS_StyleScopedClasses['pex-btn-outline']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-btn-danger']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.openAddPanel) },
    ...{ class: "pex-run-btn pex-btn-add" },
});
/** @type {__VLS_StyleScopedClasses['pex-run-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['pex-btn-add']} */ ;
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
if (__VLS_ctx.showVarPanel) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showVarPanel))
                    return;
                __VLS_ctx.showVarPanel = false;
                // @ts-ignore
                [panels, panels, showVarPanel, showVarPanel, refreshAll, refreshing, refreshing, clearAll, openAddPanel,];
            } },
        ...{ class: "pex-var-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-var-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-var-modal" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-var-modal']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-var-header" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-var-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showVarPanel))
                    return;
                __VLS_ctx.showVarPanel = false;
                // @ts-ignore
                [showVarPanel,];
            } },
        ...{ class: "pex-ib" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-ib']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-var-tip" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-var-tip']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-var-list" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-var-list']} */ ;
    for (const [v] of __VLS_vFor((__VLS_ctx.templateVars))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (v.name),
            ...{ class: "pex-var-row" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-var-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "pex-var-name" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-var-name']} */ ;
        (v.name);
        if (v.options?.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                ...{ onChange: (...[$event]) => {
                        if (!(__VLS_ctx.showVarPanel))
                            return;
                        if (!(v.options?.length))
                            return;
                        __VLS_ctx.saveVars();
                        // @ts-ignore
                        [templateVars, saveVars,];
                    } },
                value: (v.value),
                ...{ class: "pex-sel" },
                ...{ style: {} },
            });
            /** @type {__VLS_StyleScopedClasses['pex-sel']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                value: "",
            });
            for (const [opt] of __VLS_vFor((v.options))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    key: (opt),
                    value: (opt),
                });
                (opt);
                // @ts-ignore
                [];
            }
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ onChange: (...[$event]) => {
                        if (!(__VLS_ctx.showVarPanel))
                            return;
                        if (!!(v.options?.length))
                            return;
                        __VLS_ctx.saveVars();
                        // @ts-ignore
                        [saveVars,];
                    } },
                ...{ class: "pex-input" },
                placeholder: (`${v.name} 的实际值`),
            });
            (v.value);
            /** @type {__VLS_StyleScopedClasses['pex-input']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showVarPanel))
                        return;
                    __VLS_ctx.fetchVarOptions(v);
                    // @ts-ignore
                    [fetchVarOptions,];
                } },
            ...{ class: "pex-ib" },
            title: "从 Prometheus 获取可用值",
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['pex-ib']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showVarPanel))
                        return;
                    __VLS_ctx.removeVar(v.name);
                    // @ts-ignore
                    [removeVar,];
                } },
            ...{ class: "pex-ib pex-del" },
            title: "删除",
        });
        /** @type {__VLS_StyleScopedClasses['pex-ib']} */ ;
        /** @type {__VLS_StyleScopedClasses['pex-del']} */ ;
        // @ts-ignore
        [];
    }
    if (__VLS_ctx.templateVars.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-ds-empty" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-ds-empty']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-var-add" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-var-add']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "pex-input" },
        placeholder: "变量名，如 node",
        ...{ style: {} },
    });
    (__VLS_ctx.newVarName);
    /** @type {__VLS_StyleScopedClasses['pex-input']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "pex-input" },
        placeholder: "实际值，如 localhost:9100",
        ...{ style: {} },
    });
    (__VLS_ctx.newVarValue);
    /** @type {__VLS_StyleScopedClasses['pex-input']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.addVar) },
        ...{ class: "pex-run-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-run-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-var-footer" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-var-footer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showVarPanel))
                    return;
                __VLS_ctx.showVarPanel = false;
                __VLS_ctx.refreshAll();
                // @ts-ignore
                [showVarPanel, templateVars, refreshAll, newVarName, newVarValue, addVar,];
            } },
        ...{ class: "pex-run-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-run-btn']} */ ;
}
// @ts-ignore
[];
var __VLS_3;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pex-body" },
});
/** @type {__VLS_StyleScopedClasses['pex-body']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pex-grid-wrap" },
});
/** @type {__VLS_StyleScopedClasses['pex-grid-wrap']} */ ;
if (__VLS_ctx.panels.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-empty" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-empty']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-empty-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-empty-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-empty-title" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-empty-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-empty-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-empty-sub']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.openAddPanel) },
        ...{ class: "pex-run-btn pex-btn-add" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['pex-run-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['pex-btn-add']} */ ;
}
else {
    for (const [group] of __VLS_vFor((__VLS_ctx.panelGroups))) {
        (group.name);
        if (group.name) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.panels.length === 0))
                            return;
                        if (!(group.name))
                            return;
                        __VLS_ctx.toggleGroup(group.name);
                        // @ts-ignore
                        [panels, openAddPanel, panelGroups, toggleGroup,];
                    } },
                ...{ class: "pex-group-hd" },
            });
            /** @type {__VLS_StyleScopedClasses['pex-group-hd']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "pex-group-arrow" },
            });
            /** @type {__VLS_StyleScopedClasses['pex-group-arrow']} */ ;
            (__VLS_ctx.collapsedGroups.has(group.name) ? '▶' : '▼');
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "pex-group-title" },
            });
            /** @type {__VLS_StyleScopedClasses['pex-group-title']} */ ;
            (group.name);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "pex-group-count" },
            });
            /** @type {__VLS_StyleScopedClasses['pex-group-count']} */ ;
            (group.panels.length);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-canvas" },
            ...{ style: ({ height: __VLS_ctx.canvasHeight(group.panels) + 'px' }) },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (!__VLS_ctx.collapsedGroups.has(group.name)) }, null, null);
        /** @type {__VLS_StyleScopedClasses['pex-canvas']} */ ;
        for (const [panel] of __VLS_vFor((group.panels))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ onMousedown: (...[$event]) => {
                        if (!!(__VLS_ctx.panels.length === 0))
                            return;
                        __VLS_ctx.startDrag($event, panel);
                        // @ts-ignore
                        [collapsedGroups, collapsedGroups, canvasHeight, startDrag,];
                    } },
                key: (panel.id),
                ...{ class: "pex-panel-card" },
                ...{ class: ({ selected: __VLS_ctx.editingPanel?.id === panel.id }) },
                ...{ style: (panel.gw != null
                        ? { left: (panel.gx / 24 * 100) + '%', top: panel.y + 'px', width: (panel.gw / 24 * 100) + '%', height: panel.h + 'px' }
                        : { left: panel.x + 'px', top: panel.y + 'px', width: panel.w + 'px', height: panel.h + 'px' }) },
            });
            /** @type {__VLS_StyleScopedClasses['pex-panel-card']} */ ;
            /** @type {__VLS_StyleScopedClasses['selected']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "pex-panel-hd" },
            });
            /** @type {__VLS_StyleScopedClasses['pex-panel-hd']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "pex-panel-title" },
            });
            /** @type {__VLS_StyleScopedClasses['pex-panel-title']} */ ;
            (panel.title);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "pex-panel-acts" },
            });
            /** @type {__VLS_StyleScopedClasses['pex-panel-acts']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.panels.length === 0))
                            return;
                        __VLS_ctx.editPanel(__VLS_ctx.panels.indexOf(panel));
                        // @ts-ignore
                        [panels, editingPanel, editPanel,];
                    } },
                ...{ class: "pex-ib" },
                title: "编辑",
            });
            /** @type {__VLS_StyleScopedClasses['pex-ib']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.panels.length === 0))
                            return;
                        __VLS_ctx.refreshPanel(__VLS_ctx.panels.indexOf(panel));
                        // @ts-ignore
                        [panels, refreshPanel,];
                    } },
                ...{ class: "pex-ib" },
                title: "刷新",
            });
            /** @type {__VLS_StyleScopedClasses['pex-ib']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.panels.length === 0))
                            return;
                        __VLS_ctx.removePanel(__VLS_ctx.panels.indexOf(panel));
                        // @ts-ignore
                        [panels, removePanel,];
                    } },
                ...{ class: "pex-ib pex-del" },
                title: "删除",
            });
            /** @type {__VLS_StyleScopedClasses['pex-ib']} */ ;
            /** @type {__VLS_StyleScopedClasses['pex-del']} */ ;
            if (panel.error) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "pex-error" },
                    ...{ style: {} },
                });
                /** @type {__VLS_StyleScopedClasses['pex-error']} */ ;
                (panel.error);
            }
            else if (panel.loading) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "pex-loading" },
                });
                /** @type {__VLS_StyleScopedClasses['pex-loading']} */ ;
            }
            else if (panel.chartType === 'stat') {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "pex-stat-panel" },
                });
                /** @type {__VLS_StyleScopedClasses['pex-stat-panel']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "pex-stat-val" },
                    ...{ style: ({ color: __VLS_ctx.statColor(panel) }) },
                });
                /** @type {__VLS_StyleScopedClasses['pex-stat-val']} */ ;
                (panel.statVal);
                if (panel.unit && !__VLS_ctx.isBuiltinUnit(panel.unit)) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "pex-stat-unit" },
                    });
                    /** @type {__VLS_StyleScopedClasses['pex-stat-unit']} */ ;
                    (panel.unit);
                }
            }
            else if (panel.chartType === 'table') {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ style: {} },
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
                    ...{ class: "pex-table pex-table-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['pex-table']} */ ;
                /** @type {__VLS_StyleScopedClasses['pex-table-sm']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
                for (const [k] of __VLS_vFor((panel.keys))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                        key: (k),
                    });
                    (k);
                    // @ts-ignore
                    [statColor, isBuiltinUnit,];
                }
                __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
                for (const [row, i] of __VLS_vFor((panel.data))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                        key: (i),
                    });
                    for (const [k] of __VLS_vFor((panel.keys))) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                            key: (k),
                        });
                        (row.metric[k] || '-');
                        // @ts-ignore
                        [];
                    }
                    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                        ...{ class: "pex-vc" },
                    });
                    /** @type {__VLS_StyleScopedClasses['pex-vc']} */ ;
                    (__VLS_ctx.fmtVal(row.value[1]));
                    // @ts-ignore
                    [fmtVal,];
                }
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ref: (el => __VLS_ctx.setPanelEl(el, panel.id)),
                    ...{ class: "pex-panel-chart" },
                });
                /** @type {__VLS_StyleScopedClasses['pex-panel-chart']} */ ;
                if (panel.data.length === 0) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ style: {} },
                    });
                }
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ onMousedown: (...[$event]) => {
                        if (!!(__VLS_ctx.panels.length === 0))
                            return;
                        __VLS_ctx.startResize($event, panel);
                        // @ts-ignore
                        [setPanelEl, startResize,];
                    } },
                ...{ class: "pex-resize-handle" },
            });
            /** @type {__VLS_StyleScopedClasses['pex-resize-handle']} */ ;
            // @ts-ignore
            [];
        }
        // @ts-ignore
        [];
    }
}
let __VLS_6;
/** @ts-ignore @type {typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
    to: "body",
}));
const __VLS_8 = __VLS_7({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
const { default: __VLS_11 } = __VLS_9.slots;
if (__VLS_ctx.editingPanel !== null) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-editor-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-editor-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-editor-topbar" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-editor-topbar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-editor-topbar-left" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-editor-topbar-left']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "pex-editor-panel-name" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-editor-panel-name']} */ ;
    (__VLS_ctx.editForm.title || '新面板');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-editor-topbar-right" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-editor-topbar-right']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeEditor) },
        ...{ class: "pex-editor-btn-discard" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-editor-btn-discard']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.applyPanel) },
        ...{ class: "pex-editor-btn-save" },
        disabled: (!__VLS_ctx.editForm.title || !__VLS_ctx.editForm.query),
    });
    /** @type {__VLS_StyleScopedClasses['pex-editor-btn-save']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-editor-main" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-editor-main']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-editor-left" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-editor-left']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-editor-preview" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-editor-preview']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ref: "previewChartEl",
        ...{ class: "pex-preview-chart" },
        ...{ style: {} },
        ...{ style: ({ visibility: (!__VLS_ctx.previewLoading && !__VLS_ctx.previewError && __VLS_ctx.previewData.length > 0 && __VLS_ctx.editForm.chartType !== 'stat' && __VLS_ctx.editForm.chartType !== 'table' && __VLS_ctx.editForm.chartType !== 'gauge' && __VLS_ctx.editForm.chartType !== 'bargauge') ? 'visible' : 'hidden' }) },
    });
    /** @type {__VLS_StyleScopedClasses['pex-preview-chart']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ref: "previewGaugeEl",
        ...{ class: "pex-preview-chart" },
        ...{ style: {} },
        ...{ style: ({ visibility: (!__VLS_ctx.previewLoading && !__VLS_ctx.previewError && __VLS_ctx.previewData.length > 0 && (__VLS_ctx.editForm.chartType === 'gauge' || __VLS_ctx.editForm.chartType === 'bargauge')) ? 'visible' : 'hidden' }) },
    });
    /** @type {__VLS_StyleScopedClasses['pex-preview-chart']} */ ;
    if (__VLS_ctx.previewLoading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-loading" },
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['pex-loading']} */ ;
    }
    else if (__VLS_ctx.previewError) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-error" },
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['pex-error']} */ ;
        (__VLS_ctx.previewError);
    }
    else if (__VLS_ctx.previewData.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-preview-empty" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-preview-empty']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        if (__VLS_ctx.previewDebug) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ style: {} },
            });
            (__VLS_ctx.previewDebug);
        }
    }
    else if (__VLS_ctx.editForm.chartType === 'stat') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-stat-panel" },
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['pex-stat-panel']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-stat-val" },
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['pex-stat-val']} */ ;
        (__VLS_ctx.previewStatVal);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-stat-unit" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-stat-unit']} */ ;
        (__VLS_ctx.editForm.unit);
    }
    else if (__VLS_ctx.editForm.chartType === 'table') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
            ...{ class: "pex-table" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-table']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
        for (const [k] of __VLS_vFor((__VLS_ctx.previewKeys))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                key: (k),
            });
            (k);
            // @ts-ignore
            [editingPanel, editForm, editForm, editForm, editForm, editForm, editForm, editForm, editForm, editForm, editForm, editForm, editForm, closeEditor, applyPanel, previewLoading, previewLoading, previewLoading, previewError, previewError, previewError, previewError, previewData, previewData, previewData, previewDebug, previewDebug, previewStatVal, previewKeys,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
        for (const [row, i] of __VLS_vFor((__VLS_ctx.previewData))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                key: (i),
            });
            for (const [k] of __VLS_vFor((__VLS_ctx.previewKeys))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    key: (k),
                });
                (row.metric[k] || '-');
                // @ts-ignore
                [previewData, previewKeys,];
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "pex-vc" },
            });
            /** @type {__VLS_StyleScopedClasses['pex-vc']} */ ;
            (__VLS_ctx.fmtVal(row.value[1]));
            // @ts-ignore
            [fmtVal,];
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-editor-query-area" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-editor-query-area']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-query-tabs" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-query-tabs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.editingPanel !== null))
                    return;
                __VLS_ctx.queryTab = 'query';
                // @ts-ignore
                [queryTab,];
            } },
        ...{ class: (['pex-qtab', { active: __VLS_ctx.queryTab === 'query' }]) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['pex-qtab']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.editingPanel !== null))
                    return;
                __VLS_ctx.queryTab = 'options';
                // @ts-ignore
                [queryTab, queryTab,];
            } },
        ...{ class: (['pex-qtab', { active: __VLS_ctx.queryTab === 'options' }]) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['pex-qtab']} */ ;
    if (__VLS_ctx.queryTab === 'query') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-query-body" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-query-body']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-qrow" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-qrow']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.editForm.dsId),
            ...{ class: "pex-sel" },
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['pex-sel']} */ ;
        for (const [ds] of __VLS_vFor((__VLS_ctx.dataSources))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (ds.id),
                value: (ds.id),
            });
            (ds.name);
            // @ts-ignore
            [dataSources, editForm, queryTab, queryTab,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-qrow" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-qrow']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-query-input-wrap" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-query-input-wrap']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.editForm.query),
            ...{ class: "pex-code" },
            rows: "3",
            placeholder: "输入 PromQL，例如：rate(node_cpu_seconds_total{mode!='idle'}[5m])",
        });
        /** @type {__VLS_StyleScopedClasses['pex-code']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.runPreview) },
            ...{ class: "pex-run-query-btn" },
            disabled: (!__VLS_ctx.editForm.query),
        });
        /** @type {__VLS_StyleScopedClasses['pex-run-query-btn']} */ ;
        if (__VLS_ctx.queryVars.length > 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "pex-inline-vars" },
            });
            /** @type {__VLS_StyleScopedClasses['pex-inline-vars']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "pex-inline-vars-label" },
            });
            /** @type {__VLS_StyleScopedClasses['pex-inline-vars-label']} */ ;
            for (const [v] of __VLS_vFor((__VLS_ctx.queryVars))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    key: (v.name),
                    ...{ class: "pex-inline-var" },
                });
                /** @type {__VLS_StyleScopedClasses['pex-inline-var']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "pex-inline-var-name" },
                });
                /** @type {__VLS_StyleScopedClasses['pex-inline-var-name']} */ ;
                (v.name);
                __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                    ...{ onChange: (...[$event]) => {
                            if (!(__VLS_ctx.editingPanel !== null))
                                return;
                            if (!(__VLS_ctx.queryTab === 'query'))
                                return;
                            if (!(__VLS_ctx.queryVars.length > 0))
                                return;
                            __VLS_ctx.saveVars();
                            // @ts-ignore
                            [saveVars, editForm, editForm, runPreview, queryVars, queryVars,];
                        } },
                    value: (v.value),
                    ...{ class: "pex-sel pex-inline-var-input" },
                });
                /** @type {__VLS_StyleScopedClasses['pex-sel']} */ ;
                /** @type {__VLS_StyleScopedClasses['pex-inline-var-input']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    value: "",
                });
                (v.name);
                for (const [opt] of __VLS_vFor((v.options))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                        key: (opt),
                        value: (opt),
                    });
                    (opt);
                    // @ts-ignore
                    [];
                }
                // @ts-ignore
                [];
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-qrow-inline" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-qrow-inline']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-qfield" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-qfield']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.editForm.range),
            ...{ class: "pex-sel" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-sel']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "15m",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "1h",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "6h",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "24h",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-qfield" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-qfield']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.editForm.step),
            ...{ class: "pex-sel" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-sel']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "15",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "60",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "300",
        });
    }
    if (__VLS_ctx.queryTab === 'options') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-query-body" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-query-body']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-qrow" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-qrow']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ class: "pex-input" },
            placeholder: "面板标题",
        });
        (__VLS_ctx.editForm.title);
        /** @type {__VLS_StyleScopedClasses['pex-input']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-qrow-inline" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-qrow-inline']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-qfield" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-qfield']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ class: "pex-input" },
            placeholder: "% / MB / req/s",
        });
        (__VLS_ctx.editForm.unit);
        /** @type {__VLS_StyleScopedClasses['pex-input']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-qfield" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-qfield']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.editForm.decimals),
            ...{ class: "pex-sel" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-sel']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "0",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "1",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "2",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "4",
        });
        if (__VLS_ctx.editForm.chartType === 'stat') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "pex-qrow-inline" },
            });
            /** @type {__VLS_StyleScopedClasses['pex-qrow-inline']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "pex-qfield" },
            });
            /** @type {__VLS_StyleScopedClasses['pex-qfield']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                type: "number",
                ...{ class: "pex-input" },
                placeholder: "70",
            });
            (__VLS_ctx.editForm.warnThreshold);
            /** @type {__VLS_StyleScopedClasses['pex-input']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "pex-qfield" },
            });
            /** @type {__VLS_StyleScopedClasses['pex-qfield']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                type: "number",
                ...{ class: "pex-input" },
                placeholder: "90",
            });
            (__VLS_ctx.editForm.critThreshold);
            /** @type {__VLS_StyleScopedClasses['pex-input']} */ ;
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-editor-right" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-editor-right']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-viz-search" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-viz-search']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "pex-input" },
        placeholder: "搜索可视化类型...",
    });
    (__VLS_ctx.vizSearch);
    /** @type {__VLS_StyleScopedClasses['pex-input']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pex-viz-list" },
    });
    /** @type {__VLS_StyleScopedClasses['pex-viz-list']} */ ;
    for (const [c] of __VLS_vFor((__VLS_ctx.filteredChartTypes))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.editingPanel !== null))
                        return;
                    __VLS_ctx.editForm.chartType = c.value;
                    __VLS_ctx.runPreview();
                    // @ts-ignore
                    [editForm, editForm, editForm, editForm, editForm, editForm, editForm, editForm, editForm, queryTab, runPreview, vizSearch, filteredChartTypes,];
                } },
            key: (c.value),
            ...{ class: (['pex-viz-item', { active: __VLS_ctx.editForm.chartType === c.value }]) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        /** @type {__VLS_StyleScopedClasses['pex-viz-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "pex-viz-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-viz-icon']} */ ;
        (c.icon);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-viz-info" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-viz-info']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-viz-name" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-viz-name']} */ ;
        (c.label);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pex-viz-desc" },
        });
        /** @type {__VLS_StyleScopedClasses['pex-viz-desc']} */ ;
        (c.desc);
        // @ts-ignore
        [editForm,];
    }
}
// @ts-ignore
[];
var __VLS_9;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: (__VLS_ctx.onImportFile) },
    ref: "importInputRef",
    type: "file",
    accept: ".json",
    ...{ style: {} },
});
// @ts-ignore
[onImportFile,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
