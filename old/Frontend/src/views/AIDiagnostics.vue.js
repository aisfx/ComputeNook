/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, onMounted, nextTick } from 'vue';
import { getApiBase, getToken } from '../utils/auth';
import { fetchSnapshot, buildSystemPrompt } from '../utils/diagnostics';
const QUICK_ACTIONS = [
    { label: '🔴 分析活跃告警', prompt: '请分析当前所有活跃告警的根因，判断严重程度和影响范围' },
    { label: '📴 离线节点分析', prompt: '请根据监控数据分析离线节点的可能原因，评估对集群的影响' },
    { label: '📊 性能瓶颈识别', prompt: '请根据 Prometheus 实时指标，识别当前集群的性能瓶颈节点和资源异常' },
    { label: '🌡️ 高负载节点', prompt: '请分析 CPU 或内存使用率异常高的节点，判断是否存在资源争用或泄漏' },
    { label: '🔍 集群健康评估', prompt: '请基于当前所有监控数据，给出集群整体健康状态评分和需要关注的风险点' },
];
const snapshot = ref(null);
const snapshotLoading = ref(false);
const snapshotError = ref('');
const messages = ref([]);
const chatLoading = ref(false);
const inputText = ref('');
const messagesEl = ref(null);
const inputEl = ref(null);
const token = () => getToken() || '';
const now = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
async function loadSnapshot() {
    snapshotLoading.value = true;
    snapshotError.value = '';
    try {
        snapshot.value = await fetchSnapshot();
    }
    catch (e) {
        snapshotError.value = 'Failed to collect cluster data: ' + e.message;
    }
    finally {
        snapshotLoading.value = false;
    }
}
// 前端主动查询 Prometheus，把实时数据注入到用户消息里
// 根据用户问题关键词决定查哪些指标
async function enrichWithPromData(userText) {
    if (!snapshot.value?.promConnected)
        return '';
    const text = userText.toLowerCase();
    const queries = [];
    // 根据问题内容选择相关查询
    const wantCPU = text.includes('cpu') || text.includes('负载') || text.includes('瓶颈') || text.includes('性能') || text.includes('健康') || text.includes('告警');
    const wantMem = text.includes('内存') || text.includes('mem') || text.includes('瓶颈') || text.includes('性能') || text.includes('健康');
    const wantDisk = text.includes('磁盘') || text.includes('disk') || text.includes('存储') || text.includes('健康');
    const wantNet = text.includes('网络') || text.includes('net') || text.includes('带宽') || text.includes('健康');
    const wantAlerts = text.includes('告警') || text.includes('alert') || text.includes('健康') || text.includes('异常');
    const wantLoad = text.includes('负载') || text.includes('load') || text.includes('健康') || text.includes('性能');
    // 默认至少查 CPU + 内存
    if (wantCPU || (!wantMem && !wantDisk && !wantNet)) {
        queries.push({ label: 'CPU使用率(%)', q: '100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)' });
    }
    if (wantMem || (!wantCPU && !wantDisk && !wantNet)) {
        queries.push({ label: '内存使用率(%)', q: '100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)' });
    }
    if (wantLoad) {
        queries.push({ label: '系统负载(load1)', q: 'node_load1' });
    }
    if (wantDisk) {
        queries.push({ label: '磁盘使用率(%)', q: '100 - (node_filesystem_avail_bytes{mountpoint="/",fstype!="tmpfs"} / node_filesystem_size_bytes{mountpoint="/",fstype!="tmpfs"} * 100)' });
    }
    if (wantNet) {
        queries.push({ label: '网络接收(KB/s)', q: 'sum by (instance) (rate(node_network_receive_bytes_total{device!~"lo|docker.*|veth.*"}[5m])) / 1024' });
    }
    if (wantAlerts) {
        queries.push({ label: '活跃告警', q: 'ALERTS{alertstate="firing"}' });
    }
    if (queries.length === 0)
        return '';
    const results = [];
    await Promise.all(queries.map(async ({ label, q }) => {
        const r = await execPromQL(q);
        results.push(`${label}:\n${r}`);
    }));
    return `\n\n【Prometheus 实时数据 - ${new Date().toLocaleTimeString('zh-CN')}】\n${results.join('\n\n')}`;
}
// 执行 PromQL 查询，返回格式化结果字符串
async function execPromQL(query) {
    try {
        const res = await fetch(getApiBase() + '/api/monitoring/promql?query=' + encodeURIComponent(query), { headers: { Authorization: 'Bearer ' + token() } });
        if (!res.ok)
            return `查询失败: ${res.statusText}`;
        const data = await res.json();
        if (data.status !== 'success')
            return `查询错误`;
        const results = data.data?.result || [];
        if (results.length === 0)
            return '无数据';
        return results.slice(0, 20).map(r => {
            const inst = r.metric?.instance || r.metric?.nodename || Object.values(r.metric || {}).join(',') || '-';
            const val = Array.isArray(r.value) ? parseFloat(r.value[1]).toFixed(2) : '-';
            return `  ${inst}: ${val}`;
        }).join('\n');
    }
    catch {
        return '查询异常';
    }
}
async function send(text) {
    const t = text.trim();
    if (!t || chatLoading.value)
        return;
    inputText.value = '';
    if (inputEl.value)
        inputEl.value.style.height = 'auto';
    chatLoading.value = true;
    // 前端主动查询 Prometheus，把实时数据附加到用户消息
    const promData = await enrichWithPromData(t);
    const enrichedContent = t + promData;
    messages.value.push({ role: 'user', content: t, time: now() }); // 显示原始问题
    scrollToBottom();
    try {
        // 发给 AI 的历史用 enriched 内容（含实时数据），但显示给用户的是原始问题
        const history = messages.value.slice(-10).map((m, idx, arr) => ({
            role: m.role,
            // 最后一条 user 消息替换为带数据的版本
            content: (m.role === 'user' && idx === arr.length - 1) ? enrichedContent : m.content,
        }));
        const systemContent = snapshot.value ? buildSystemPrompt(snapshot.value) : '你是一个专业的 HPC 集群监控分析 AI，请用中文回答。';
        const res = await fetch(getApiBase() + '/api/ai/admin/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
            body: JSON.stringify({ messages: [{ role: 'system', content: systemContent }, ...history] }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error || 'Request failed');
        }
        const data = await res.json();
        messages.value.push({ role: 'assistant', content: data.content || '无响应', time: now() });
    }
    catch (e) {
        messages.value.push({ role: 'assistant', content: '❌ ' + e.message, time: now() });
    }
    finally {
        chatLoading.value = false;
        scrollToBottom();
    }
}
function sendQuick(prompt) { inputText.value = prompt; send(prompt); }
function clearMessages() { messages.value = []; }
function scrollToBottom() { nextTick(() => { if (messagesEl.value)
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight; }); }
function autoResize() { if (!inputEl.value)
    return; inputEl.value.style.height = 'auto'; inputEl.value.style.height = Math.min(inputEl.value.scrollHeight, 140) + 'px'; }
function renderContent(text) {
    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return escaped
        .replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, lang, code) => {
        const id = 'cb-' + Math.random().toString(36).slice(2, 8);
        return `<div class="code-block"><div class="code-header"><span class="code-lang">${lang || 'code'}</span><button class="copy-btn" type="button" data-copy-target="${id}">复制</button></div><pre id="${id}"><code>${code.trim()}</code></pre></div>`;
    })
        .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/^#{1,3} (.+)$/gm, '<div class="msg-heading">$1</div>')
        .replace(/\n/g, '<br>');
}
async function handleMessageClick(event) {
    const button = event.target.closest('.copy-btn[data-copy-target]');
    if (!button)
        return;
    const targetId = button.dataset.copyTarget;
    const target = targetId ? document.getElementById(targetId) : null;
    if (!target)
        return;
    try {
        await navigator.clipboard.writeText(target.innerText);
        button.textContent = '已复制';
        window.setTimeout(() => {
            button.textContent = '复制';
        }, 1500);
    }
    catch {
        button.textContent = '复制失败';
        window.setTimeout(() => {
            button.textContent = '复制';
        }, 1500);
    }
}
onMounted(() => loadSnapshot());
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['snap-card']} */ ;
/** @type {__VLS_StyleScopedClasses['snap-card']} */ ;
/** @type {__VLS_StyleScopedClasses['snap-card']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-refresh']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-refresh']} */ ;
/** @type {__VLS_StyleScopedClasses['qa-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['qa-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['chat-messages']} */ ;
/** @type {__VLS_StyleScopedClasses['chat-messages']} */ ;
/** @type {__VLS_StyleScopedClasses['msg-user']} */ ;
/** @type {__VLS_StyleScopedClasses['msg-bubble']} */ ;
/** @type {__VLS_StyleScopedClasses['msg-user']} */ ;
/** @type {__VLS_StyleScopedClasses['msg-content']} */ ;
/** @type {__VLS_StyleScopedClasses['msg-content']} */ ;
/** @type {__VLS_StyleScopedClasses['typing']} */ ;
/** @type {__VLS_StyleScopedClasses['typing']} */ ;
/** @type {__VLS_StyleScopedClasses['typing']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-clear']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-clear']} */ ;
/** @type {__VLS_StyleScopedClasses['chat-input']} */ ;
/** @type {__VLS_StyleScopedClasses['chat-input']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-send']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-send']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "diag-page" },
});
/** @type {__VLS_StyleScopedClasses['diag-page']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "diag-header" },
});
/** @type {__VLS_StyleScopedClasses['diag-header']} */ ;
if (__VLS_ctx.snapshot) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "snapshot-cards" },
    });
    /** @type {__VLS_StyleScopedClasses['snapshot-cards']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "snap-card" },
    });
    /** @type {__VLS_StyleScopedClasses['snap-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "snap-val" },
    });
    /** @type {__VLS_StyleScopedClasses['snap-val']} */ ;
    (__VLS_ctx.snapshot.stats.totalNodes);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "snap-label" },
    });
    /** @type {__VLS_StyleScopedClasses['snap-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "snap-card snap-ok" },
    });
    /** @type {__VLS_StyleScopedClasses['snap-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['snap-ok']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "snap-val" },
    });
    /** @type {__VLS_StyleScopedClasses['snap-val']} */ ;
    (__VLS_ctx.snapshot.stats.onlineNodes);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "snap-label" },
    });
    /** @type {__VLS_StyleScopedClasses['snap-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "snap-card" },
        ...{ class: (__VLS_ctx.snapshot.stats.downNodes > 0 ? 'snap-err' : 'snap-ok') },
    });
    /** @type {__VLS_StyleScopedClasses['snap-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "snap-val" },
    });
    /** @type {__VLS_StyleScopedClasses['snap-val']} */ ;
    (__VLS_ctx.snapshot.stats.downNodes);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "snap-label" },
    });
    /** @type {__VLS_StyleScopedClasses['snap-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "snap-card" },
        ...{ class: (__VLS_ctx.snapshot.stats.cpuUsage > 90 ? 'snap-err' : __VLS_ctx.snapshot.stats.cpuUsage > 70 ? 'snap-warn' : '') },
    });
    /** @type {__VLS_StyleScopedClasses['snap-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "snap-val" },
    });
    /** @type {__VLS_StyleScopedClasses['snap-val']} */ ;
    (__VLS_ctx.snapshot.stats.cpuUsage.toFixed(1));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "snap-label" },
    });
    /** @type {__VLS_StyleScopedClasses['snap-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "snap-card" },
        ...{ class: (__VLS_ctx.snapshot.stats.memUsage > 90 ? 'snap-err' : __VLS_ctx.snapshot.stats.memUsage > 70 ? 'snap-warn' : '') },
    });
    /** @type {__VLS_StyleScopedClasses['snap-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "snap-val" },
    });
    /** @type {__VLS_StyleScopedClasses['snap-val']} */ ;
    (__VLS_ctx.snapshot.stats.memUsage.toFixed(1));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "snap-label" },
    });
    /** @type {__VLS_StyleScopedClasses['snap-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "snap-card" },
        ...{ class: (__VLS_ctx.snapshot.alerts.length > 0 ? 'snap-err' : 'snap-ok') },
    });
    /** @type {__VLS_StyleScopedClasses['snap-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "snap-val" },
    });
    /** @type {__VLS_StyleScopedClasses['snap-val']} */ ;
    (__VLS_ctx.snapshot.alerts.length);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "snap-label" },
    });
    /** @type {__VLS_StyleScopedClasses['snap-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "snap-card" },
    });
    /** @type {__VLS_StyleScopedClasses['snap-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "snap-val" },
    });
    /** @type {__VLS_StyleScopedClasses['snap-val']} */ ;
    (__VLS_ctx.snapshot.stats.allocGPUs);
    (__VLS_ctx.snapshot.stats.totalGPUs);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "snap-label" },
    });
    /** @type {__VLS_StyleScopedClasses['snap-label']} */ ;
}
if (__VLS_ctx.snapshot) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "snapshot-meta" },
    });
    /** @type {__VLS_StyleScopedClasses['snapshot-meta']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: (['prom-dot', __VLS_ctx.snapshot.promConnected ? 'dot-ok' : 'dot-na']) },
    });
    /** @type {__VLS_StyleScopedClasses['prom-dot']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "snap-time" },
    });
    /** @type {__VLS_StyleScopedClasses['snap-time']} */ ;
    (__VLS_ctx.snapshot.promConnected ? 'Prometheus 已连接' : 'Prometheus 未连接');
    (__VLS_ctx.snapshot.fetchedAt);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.loadSnapshot) },
        ...{ class: "btn-refresh" },
        disabled: (__VLS_ctx.snapshotLoading),
    });
    /** @type {__VLS_StyleScopedClasses['btn-refresh']} */ ;
    (__VLS_ctx.snapshotLoading ? '采集中...' : '刷新上下文');
}
if (__VLS_ctx.snapshotLoading && !__VLS_ctx.snapshot) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "snap-loading" },
    });
    /** @type {__VLS_StyleScopedClasses['snap-loading']} */ ;
}
if (__VLS_ctx.snapshotError) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "snap-error" },
    });
    /** @type {__VLS_StyleScopedClasses['snap-error']} */ ;
    (__VLS_ctx.snapshotError);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "quick-actions" },
});
/** @type {__VLS_StyleScopedClasses['quick-actions']} */ ;
for (const [qa] of __VLS_vFor((__VLS_ctx.QUICK_ACTIONS))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.sendQuick(qa.prompt);
                // @ts-ignore
                [snapshot, snapshot, snapshot, snapshot, snapshot, snapshot, snapshot, snapshot, snapshot, snapshot, snapshot, snapshot, snapshot, snapshot, snapshot, snapshot, snapshot, snapshot, snapshot, snapshot, loadSnapshot, snapshotLoading, snapshotLoading, snapshotLoading, snapshotError, snapshotError, QUICK_ACTIONS, sendQuick,];
            } },
        key: (qa.label),
        ...{ class: "qa-btn" },
        disabled: (__VLS_ctx.chatLoading || __VLS_ctx.snapshotLoading),
    });
    /** @type {__VLS_StyleScopedClasses['qa-btn']} */ ;
    (qa.label);
    // @ts-ignore
    [snapshotLoading, chatLoading,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "chat-area" },
});
/** @type {__VLS_StyleScopedClasses['chat-area']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onClick: (__VLS_ctx.handleMessageClick) },
    ...{ class: "chat-messages" },
    ref: "messagesEl",
});
/** @type {__VLS_StyleScopedClasses['chat-messages']} */ ;
if (__VLS_ctx.messages.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chat-empty" },
    });
    /** @type {__VLS_StyleScopedClasses['chat-empty']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chat-empty-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['chat-empty-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chat-empty-text" },
    });
    /** @type {__VLS_StyleScopedClasses['chat-empty-text']} */ ;
}
for (const [msg, i] of __VLS_vFor((__VLS_ctx.messages))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (i),
        ...{ class: (['msg', 'msg-' + msg.role]) },
    });
    /** @type {__VLS_StyleScopedClasses['msg']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "msg-avatar" },
    });
    /** @type {__VLS_StyleScopedClasses['msg-avatar']} */ ;
    (msg.role === 'user' ? '' : '');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "msg-bubble" },
    });
    /** @type {__VLS_StyleScopedClasses['msg-bubble']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "msg-content" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vHtml, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.renderContent(msg.content)) }, null, null);
    /** @type {__VLS_StyleScopedClasses['msg-content']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "msg-time" },
    });
    /** @type {__VLS_StyleScopedClasses['msg-time']} */ ;
    (msg.time);
    // @ts-ignore
    [handleMessageClick, messages, messages, renderContent,];
}
if (__VLS_ctx.chatLoading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "msg msg-assistant" },
    });
    /** @type {__VLS_StyleScopedClasses['msg']} */ ;
    /** @type {__VLS_StyleScopedClasses['msg-assistant']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "msg-avatar" },
    });
    /** @type {__VLS_StyleScopedClasses['msg-avatar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "msg-bubble" },
    });
    /** @type {__VLS_StyleScopedClasses['msg-bubble']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "typing" },
    });
    /** @type {__VLS_StyleScopedClasses['typing']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "chat-toolbar" },
});
/** @type {__VLS_StyleScopedClasses['chat-toolbar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.clearMessages) },
    ...{ class: "btn-clear" },
    disabled: (__VLS_ctx.messages.length === 0),
});
/** @type {__VLS_StyleScopedClasses['btn-clear']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "chat-input-row" },
});
/** @type {__VLS_StyleScopedClasses['chat-input-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
    ...{ onKeydown: (...[$event]) => {
            __VLS_ctx.send(__VLS_ctx.inputText);
            // @ts-ignore
            [chatLoading, messages, clearMessages, send, inputText,];
        } },
    ...{ onKeydown: (...[$event]) => {
            __VLS_ctx.inputText += '\n';
            // @ts-ignore
            [inputText,];
        } },
    ...{ onInput: (__VLS_ctx.autoResize) },
    ref: "inputEl",
    value: (__VLS_ctx.inputText),
    ...{ class: "chat-input" },
    placeholder: "描述观察到的异常现象，或询问监控数据分析... (Enter 发送，Shift+Enter 换行)",
    rows: "2",
    disabled: (__VLS_ctx.chatLoading || __VLS_ctx.snapshotLoading),
});
/** @type {__VLS_StyleScopedClasses['chat-input']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.send(__VLS_ctx.inputText);
            // @ts-ignore
            [snapshotLoading, chatLoading, send, inputText, inputText, autoResize,];
        } },
    ...{ class: "btn-send" },
    disabled: (__VLS_ctx.chatLoading || __VLS_ctx.snapshotLoading || !__VLS_ctx.inputText.trim()),
});
/** @type {__VLS_StyleScopedClasses['btn-send']} */ ;
(__VLS_ctx.chatLoading ? '' : '发送');
// @ts-ignore
[snapshotLoading, chatLoading, chatLoading, inputText,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
