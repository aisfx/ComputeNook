/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import axios from 'axios';
import { desktopAPI } from '../api/index';
import XpraViewer from '../components/XpraViewer.vue';
import { launchState, launchMinimized, startDesktopLaunch, clearLaunch } from '../utils/desktopLaunch';
import dialog from '../utils/dialog';
import { isAdmin } from '../utils/auth';
const isAdminUser = isAdmin();
const sessions = ref([]);
const partitions = ref([]);
const partitionsLoading = ref(false);
const presetsLoading = ref(false);
const resourcePresets = ref([]);
const submitting = ref(false);
const showCreateModal = ref(false);
const showStartModal = ref(false);
const showXpraModal = ref(false);
const showScriptModal = ref(false);
const selectedSession = ref(null);
const xpraWsUrl = ref('');
// 日志弹窗
const showLogModal = ref(false);
const logSession = ref(null);
const logType = ref('out');
const logContent = ref('');
const logLoading = ref(false);
const viewSessionLog = async (session) => {
    logSession.value = session;
    logType.value = 'out';
    showLogModal.value = true;
    await fetchLog(session, 'out');
};
const switchLog = async (type) => {
    logType.value = type;
    await fetchLog(logSession.value, type);
};
const fetchLog = async (session, type) => {
    logLoading.value = true;
    logContent.value = '';
    try {
        const res = await axios.get(`/desktop/sessions/${session.id}/logs`, {
            params: { type, lines: 200 }
        });
        const lines = res.data.lines || [];
        logContent.value = lines.join('\n');
        if (!res.data.exists)
            logContent.value = '（日志文件尚未生成，请等待作业启动）';
    }
    catch (e) {
        logContent.value = '加载失败: ' + (e.response?.data?.error || e.message);
    }
    finally {
        logLoading.value = false;
    }
};
const scriptInfo = ref({ script: '', partition: '', workdir: '' });
let listTimer = null;
const desktopEnvs = [
    { value: 'xfce4', label: 'Xfce4', icon: '🪟' },
    { value: 'gnome', label: 'GNOME', icon: '🔵' },
    { value: 'kde', label: 'KDE', icon: '🟦' },
];
const builtinApps = [
    { name: 'Terminal', cmd: 'xterm', icon: '💻' },
    { name: 'Firefox', cmd: 'firefox', icon: '🦊' },
    { name: 'VSCode', cmd: 'code', icon: '📝' },
    { name: 'Gedit', cmd: 'gedit', icon: '📄' },
    { name: 'Nautilus', cmd: 'nautilus', icon: '📁' },
    { name: 'MATLAB', cmd: 'matlab -desktop', icon: '🔢' },
    { name: 'ParaView', cmd: 'paraview', icon: '📊' },
    { name: 'VMD', cmd: 'vmd', icon: '🧬' },
];
// 远程应用管理
const remoteApps = ref([]);
const showManageApps = ref(false);
const newApp = ref({ name: '', icon: '', cmd: '', modules: '', desc: '' });
const loadRemoteApps = async () => {
    try {
        const res = await axios.get('/desktop/apps');
        remoteApps.value = res.data.data || [];
    }
    catch {
        remoteApps.value = builtinApps.map((a, i) => ({ id: i + 1, ...a, modules: '', desc: '' }));
    }
};
const selectApp = (app) => {
    createForm.value.selectedAppId = app.id;
    createForm.value.appCommand = app.cmd;
    createForm.value.modules = app.modules || '';
};
const addApp = async () => {
    try {
        await axios.post('/desktop/apps', newApp.value);
        newApp.value = { name: '', icon: '', cmd: '', modules: '', desc: '' };
        await loadRemoteApps();
    }
    catch (e) {
        alert(e.response?.data?.error || '添加失败');
    }
};
const deleteApp = async (id) => {
    if (!confirm('确定删除此应用？'))
        return;
    try {
        await axios.delete(`/desktop/apps/${id}`);
        await loadRemoteApps();
    }
    catch (e) {
        alert(e.response?.data?.error || '删除失败');
    }
};
const createForm = ref({
    name: '', mode: 'desktop', desktopEnv: 'xfce4', appCommand: '',
    partition: '', duration: 4, presetIndex: 1, gpus: 0,
    selectedAppId: 0, modules: '',
});
const statusLabel = (s) => ({ stopped: '未启动', pending: '排队中', running: '运行中', failed: '失败' }[s] || s);
const loadSessions = async () => {
    try {
        sessions.value = await desktopAPI.getSessions();
    }
    catch { /* ignore */ }
};
const loadPartitions = async () => {
    partitionsLoading.value = true;
    try {
        const res = await axios.get('/jobs/partitions/list');
        partitions.value = res.data.data || [];
        if (partitions.value.length > 0 && !createForm.value.partition) {
            // 优先选择第一个可用分区
            const availablePartition = partitions.value.find((p) => p.state === 'UP');
            createForm.value.partition = availablePartition?.name || partitions.value[0].name;
            await loadResourcePresets();
        }
    }
    catch {
        partitions.value = [];
    }
    finally {
        partitionsLoading.value = false;
    }
};
const loadResourcePresets = async () => {
    presetsLoading.value = true;
    try {
        const res = await axios.get('/desktop/resource-presets', { params: { partition: createForm.value.partition } });
        resourcePresets.value = res.data.data || [];
        createForm.value.presetIndex = 1;
    }
    catch {
        resourcePresets.value = [
            { label: '小型  1核/2GB', cpus: 1, memory: 2 },
            { label: '中型  2核/4GB', cpus: 2, memory: 4 },
            { label: '大型  4核/8GB', cpus: 4, memory: 8 },
            { label: '超大  8核/16GB', cpus: 8, memory: 16 },
        ];
    }
    finally {
        presetsLoading.value = false;
    }
};
onMounted(() => {
    loadSessions();
    loadRemoteApps();
    // 如果有进行中的启动，恢复显示
    if (launchState.value?.status === 'ready') {
        selectedSession.value = launchState.value.session;
        showStartModal.value = true;
    }
    listTimer = setInterval(() => {
        if (sessions.value.some((s) => s.status === 'pending' || s.status === 'running'))
            loadSessions();
    }, 8000);
    // 使用 pagehide 事件代替 beforeunload（更可靠且不会有弃用警告）
    window.addEventListener('pagehide', notifyClientDisconnect, { capture: true });
});
onUnmounted(() => {
    if (listTimer)
        clearInterval(listTimer);
    if (tunnelHeartbeat)
        clearInterval(tunnelHeartbeat);
    window.removeEventListener('pagehide', notifyClientDisconnect, { capture: true });
    // 注意：不清理 launchState，让轮询继续在后台运行
});
const openCreateModal = async () => {
    showCreateModal.value = true;
    await loadPartitions();
};
const createDesktop = async () => {
    submitting.value = true;
    try {
        const preset = resourcePresets.value[createForm.value.presetIndex] || resourcePresets.value[0];
        const data = await desktopAPI.createSession({
            name: createForm.value.name,
            mode: createForm.value.mode,
            type: createForm.value.desktopEnv,
            appCommand: createForm.value.mode === 'app' ? createForm.value.appCommand : '',
            modules: createForm.value.mode === 'app' ? createForm.value.modules : '',
            resolution: 'auto',
            duration: createForm.value.duration,
            cpus: preset?.cpus,
            memory: preset?.memory,
            gpus: createForm.value.gpus,
            partition: createForm.value.partition,
        });
        sessions.value.unshift(data);
        showCreateModal.value = false;
        createForm.value = { name: '', mode: 'desktop', desktopEnv: 'xfce4', appCommand: '', partition: partitions.value[0]?.name || '', duration: 4, presetIndex: 1, gpus: 0, selectedAppId: 0, modules: '' };
    }
    catch (e) {
        dialog.error('创建失败: ' + (e.response?.data?.error || e.message));
    }
    finally {
        submitting.value = false;
    }
};
const deleteSession = async (session) => {
    const ok = await dialog.confirmDelete(session.name, '会话');
    if (!ok)
        return;
    try {
        await desktopAPI.deleteSession(session.id);
        sessions.value = sessions.value.filter((s) => s.id !== session.id);
    }
    catch (e) {
        dialog.error('删除失败: ' + (e.response?.data?.error || e.message));
    }
};
const startSession = async (session) => {
    selectedSession.value = session;
    showStartModal.value = false;
    await startDesktopLaunch(session, session.partition);
};
// 监听全局启动状态变化，就绪时自动弹窗；失败时也弹窗显示错误
watch(() => launchState.value?.status, (status) => {
    if (status === 'ready') {
        selectedSession.value = launchState.value?.session;
        showStartModal.value = true;
        loadSessions();
    }
    else if (status === 'failed') {
        showStartModal.value = true;
        loadSessions();
    }
});
// 弹窗状态：优先用 launchState（启动流程中），否则用 selectedSession.status
const modalStatus = computed(() => {
    if (launchState.value?.status === 'failed')
        return 'failed';
    if (launchState.value?.status === 'ready')
        return 'ready';
    if (selectedSession.value?.status === 'running')
        return 'ready';
    return 'ready';
});
const clientMinimized = ref(false);
// 打开 Xpra 连接（running 状态直接连）
const openXpra = (session) => {
    selectedSession.value = session;
    clientMinimized.value = false;
    tunnelStatus.value = 'idle';
    showStartModal.value = true;
};
const showVncPwd = ref(false);
// 本地转发端口 = VNC端口（用户可自定义，默认用远端端口）
const localVncPort = computed(() => selectedSession.value?.xpraPort || selectedSession.value?.vncPort || 14501);
const tunnelCmd = computed(() => {
    if (!selectedSession.value)
        return '';
    const node = selectedSession.value.address || 'compute-node';
    const port = selectedSession.value.vncPort || selectedSession.value.xpraPort || 5901;
    return `hpc-client tunnel --node ${node} --remote-port ${port} --local-port ${localVncPort.value}`;
});
const copyTunnelCmd = () => {
    navigator.clipboard.writeText(tunnelCmd.value)
        .then(() => dialog.success('隧道命令已复制'))
        .catch(() => dialog.info(tunnelCmd.value));
};
// 浏览器连接：直接用 XpraViewer 组件通过后端 WS 代理连接
const openNoVNC = () => {
    if (!selectedSession.value)
        return;
    showStartModal.value = false;
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const port = location.port || (location.protocol === 'https:' ? '443' : '80');
    xpraWsUrl.value = `${proto}://${location.hostname}:${port}/api/desktop/sessions/${selectedSession.value.id}/xpra-ws?token=${encodeURIComponent(token)}`;
    showXpraModal.value = true;
};
// 端口转发 + 自动启动 Xpra：一键完成隧道建立和客户端连接
const tunnelStatus = ref('idle');
const tunnelSessionId = ref(null);
let tunnelHeartbeat = null;
// 心跳检测：定时检查本地隧道端口是否可达
const startTunnelHeartbeat = (localPort) => {
    if (tunnelHeartbeat)
        clearInterval(tunnelHeartbeat);
    tunnelHeartbeat = setInterval(async () => {
        if (tunnelStatus.value !== 'connected') {
            clearInterval(tunnelHeartbeat);
            return;
        }
        try {
            // 尝试连接本地端口，超时2秒认为断开
            const ws = new WebSocket(`ws://localhost:${localPort}/`);
            await new Promise((resolve, reject) => {
                const t = setTimeout(() => { ws.close(); reject(); }, 2000);
                ws.onopen = () => { clearTimeout(t); ws.close(); resolve(); };
                ws.onerror = () => { clearTimeout(t); reject(); };
                ws.onclose = () => { clearTimeout(t); reject(); };
            });
        }
        catch {
            tunnelStatus.value = 'disconnected';
            clearInterval(tunnelHeartbeat);
        }
    }, 10000);
};
const launchTunnel = () => {
    if (!selectedSession.value)
        return;
    // 如果是重连，先通知断开旧隧道
    if (tunnelStatus.value === 'disconnected' || tunnelStatus.value === 'connected') {
        notifyClientDisconnect();
    }
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    const sessionId = selectedSession.value.id;
    const localPort = localVncPort.value;
    const tcpPort = selectedSession.value.xpraPort;
    const pwd = selectedSession.value.vncPassword || '';
    const uri = `hpcc://xpra?server=${encodeURIComponent(location.origin)}&token=${encodeURIComponent(token)}&session=${sessionId}&port=${localPort}&remote-port=${tcpPort}&auto-connect=1${pwd ? '&password=' + encodeURIComponent(pwd) : ''}`;
    triggerUri(uri);
    tunnelStatus.value = 'connecting';
    tunnelSessionId.value = sessionId;
    // 增加延迟到8秒，给客户端更多时间建立隧道
    setTimeout(() => {
        if (tunnelStatus.value === 'connecting') {
            tunnelStatus.value = 'connected';
            startTunnelHeartbeat(localPort);
        }
    }, 8000);
};
// 浏览器退出时通知 hpc-client 断开
const notifyClientDisconnect = () => {
    if (tunnelSessionId.value === null)
        return;
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    // 用 sendBeacon 保证页面关闭时也能发出
    // sendBeacon 需要使用 Blob 或 FormData，并设置正确的 Content-Type
    const url = `/api/desktop/sessions/${tunnelSessionId.value}/client-exit`;
    const blob = new Blob([JSON.stringify({ token })], { type: 'application/json' });
    navigator.sendBeacon(url, blob);
    // 注意：不在这里触发 hpcc://exit，因为 pagehide 事件中无法触发自定义协议
    // hpc-client 应该通过监听后端 API 或 WebSocket 断开来处理清理
};
const triggerUri = (uri) => {
    // 直接使用 window.location.href 触发自定义协议
    // 注意：这只在用户手势（如点击）触发的函数中有效
    window.location.href = uri;
};
// 启动本地 Xpra 客户端连接到隧道本地端口（手动触发，隧道已就绪时用）
const launchXpraClient = () => {
    if (!selectedSession.value)
        return;
    const localPort = localVncPort.value;
    const pwd = selectedSession.value.vncPassword || '';
    const uri = `xpra://tcp/localhost:${localPort}/${pwd ? '?password=' + encodeURIComponent(pwd) : ''}`;
    triggerUri(uri);
};
// 主动断开隧道（用户手势触发）
const disconnectTunnel = () => {
    if (tunnelSessionId.value === null)
        return;
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    const uri = `hpcc://exit?server=${encodeURIComponent(location.origin)}&token=${encodeURIComponent(token)}&session=${tunnelSessionId.value}`;
    triggerUri(uri);
    tunnelStatus.value = 'idle';
    tunnelSessionId.value = null;
    if (tunnelHeartbeat)
        clearInterval(tunnelHeartbeat);
};
const stopSession = async () => {
    if (!selectedSession.value)
        return;
    const ok = await dialog.confirm('确定停止此会话？', { title: '停止会话' });
    if (!ok)
        return;
    try {
        // 先断开客户端连接
        if (tunnelStatus.value === 'connected' || tunnelStatus.value === 'disconnected') {
            disconnectTunnel();
        }
        await desktopAPI.stopSession(selectedSession.value.id);
        showStartModal.value = false;
        clearLaunch();
        await loadSessions();
    }
    catch (e) {
        dialog.error('停止失败: ' + (e.response?.data?.error || e.message));
    }
};
const stopSessionById = async (session) => {
    const ok = await dialog.confirm(`确定停止 "${session.name}"？`, { title: '停止会话' });
    if (!ok)
        return;
    try {
        await desktopAPI.stopSession(session.id);
        await loadSessions();
    }
    catch (e) {
        dialog.error('停止失败: ' + (e.response?.data?.error || e.message));
    }
};
const toggleFullscreen = () => {
    const el = document.querySelector('.vnc-overlay');
    if (el)
        el.requestFullscreen?.();
};
const previewScript = async (session) => {
    try {
        const res = await axios.get(`/desktop/sessions/${session.id}/script`);
        scriptInfo.value = res.data;
        showScriptModal.value = true;
    }
    catch (e) {
        dialog.error('获取脚本失败: ' + (e.response?.data?.error || e.message));
    }
};
const viewScript = async (sessionId) => {
    if (!sessionId)
        return;
    try {
        const res = await axios.get(`/desktop/sessions/${sessionId}/script`);
        scriptInfo.value = res.data;
        showScriptModal.value = true;
    }
    catch (e) {
        dialog.error('获取脚本失败: ' + (e.response?.data?.error || e.message));
    }
};
const copyScript = () => {
    navigator.clipboard.writeText(scriptInfo.value.script);
    dialog.success('已复制');
};
const cleanupSpace = async () => {
    const ok = await dialog.confirm('将清理旧的 xpra 目录和日志文件以释放磁盘空间。\n保留最近的文件，删除较旧的文件。\n\n确定继续？', { title: '清理磁盘空间' });
    if (!ok)
        return;
    try {
        const res = await axios.post('/desktop/cleanup');
        const cleaned = res.data.cleaned;
        const sizeMB = (cleaned.totalBytes / 1024 / 1024).toFixed(2);
        dialog.success(`清理完成！\n` +
            `删除 ${cleaned.xpraDirs} 个旧目录\n` +
            `删除 ${cleaned.logFiles} 个日志文件\n` +
            `释放 ${sizeMB} MB 空间`);
    }
    catch (e) {
        dialog.error('清理失败: ' + (e.response?.data?.error || e.message));
    }
};
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-new-session']} */ ;
/** @type {__VLS_StyleScopedClasses['desktop-table']} */ ;
/** @type {__VLS_StyleScopedClasses['desktop-table']} */ ;
/** @type {__VLS_StyleScopedClasses['desktop-table']} */ ;
/** @type {__VLS_StyleScopedClasses['desktop-table']} */ ;
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['running']} */ ;
/** @type {__VLS_StyleScopedClasses['status-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['pending']} */ ;
/** @type {__VLS_StyleScopedClasses['status-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['failed']} */ ;
/** @type {__VLS_StyleScopedClasses['status-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['stopped']} */ ;
/** @type {__VLS_StyleScopedClasses['status-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-action']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-action']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-log']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-delete']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['status-ready']} */ ;
/** @type {__VLS_StyleScopedClasses['info-item']} */ ;
/** @type {__VLS_StyleScopedClasses['info-item']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-eye-small']} */ ;
/** @type {__VLS_StyleScopedClasses['method-content']} */ ;
/** @type {__VLS_StyleScopedClasses['method-content']} */ ;
/** @type {__VLS_StyleScopedClasses['log-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['log-header']} */ ;
/** @type {__VLS_StyleScopedClasses['log-header']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-text']} */ ;
/** @type {__VLS_StyleScopedClasses['log-body']} */ ;
/** @type {__VLS_StyleScopedClasses['launch-float']} */ ;
/** @type {__VLS_StyleScopedClasses['launch-icon-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['vnc-canvas-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['mode-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['mode-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-danger']} */ ;
/** @type {__VLS_StyleScopedClasses['mode-card']} */ ;
/** @type {__VLS_StyleScopedClasses['mode-card']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['env-option']} */ ;
/** @type {__VLS_StyleScopedClasses['env-option']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-manage-apps']} */ ;
/** @type {__VLS_StyleScopedClasses['app-card']} */ ;
/** @type {__VLS_StyleScopedClasses['app-card']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['custom-app-input']} */ ;
/** @type {__VLS_StyleScopedClasses['modules-row']} */ ;
/** @type {__VLS_StyleScopedClasses['modules-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['apps-table']} */ ;
/** @type {__VLS_StyleScopedClasses['apps-table']} */ ;
/** @type {__VLS_StyleScopedClasses['add-app-form']} */ ;
/** @type {__VLS_StyleScopedClasses['client-float-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['client-float-stop']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "desktop-page" },
});
/** @type {__VLS_StyleScopedClasses['desktop-page']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "page-header" },
});
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "page-header-left" },
});
/** @type {__VLS_StyleScopedClasses['page-header-left']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "page-subtitle" },
});
/** @type {__VLS_StyleScopedClasses['page-subtitle']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ style: {} },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.cleanupSpace) },
    ...{ class: "btn-secondary" },
    title: "清理旧文件释放磁盘空间",
});
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.openCreateModal) },
    ...{ class: "btn-new-session" },
});
/** @type {__VLS_StyleScopedClasses['btn-new-session']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "14",
    height: "14",
    viewBox: "0 0 14 14",
    fill: "none",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M7 1v12M1 7h12",
    stroke: "currentColor",
    'stroke-width': "2",
    'stroke-linecap': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card table-card" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['table-card']} */ ;
if (__VLS_ctx.sessions.length > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
        ...{ class: "desktop-table" },
    });
    /** @type {__VLS_StyleScopedClasses['desktop-table']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
    for (const [session] of __VLS_vFor((__VLS_ctx.sessions))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (session.id),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "session-name" },
        });
        /** @type {__VLS_StyleScopedClasses['session-name']} */ ;
        (session.name);
        if (session.mode === 'app') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "session-sub" },
            });
            /** @type {__VLS_StyleScopedClasses['session-sub']} */ ;
            (session.appCommand);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "mode-badge" },
            ...{ class: (session.mode) },
        });
        /** @type {__VLS_StyleScopedClasses['mode-badge']} */ ;
        (session.mode === 'app' ? '应用' : '桌面');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "node-text" },
        });
        /** @type {__VLS_StyleScopedClasses['node-text']} */ ;
        (session.status === 'running' ? session.address : '—');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "status-badge" },
            ...{ class: (session.status) },
        });
        /** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "status-dot" },
        });
        /** @type {__VLS_StyleScopedClasses['status-dot']} */ ;
        (__VLS_ctx.statusLabel(session.status));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "time-cell" },
        });
        /** @type {__VLS_StyleScopedClasses['time-cell']} */ ;
        (session.createTime?.slice(0, 16).replace('T', ' '));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "action-buttons" },
        });
        /** @type {__VLS_StyleScopedClasses['action-buttons']} */ ;
        if (session.status === 'running') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.sessions.length > 0))
                            return;
                        if (!(session.status === 'running'))
                            return;
                        __VLS_ctx.openXpra(session);
                        // @ts-ignore
                        [cleanupSpace, openCreateModal, sessions, sessions, statusLabel, openXpra,];
                    } },
                ...{ class: "btn-action btn-connect" },
            });
            /** @type {__VLS_StyleScopedClasses['btn-action']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-connect']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.sessions.length > 0))
                            return;
                        if (!(session.status === 'running'))
                            return;
                        __VLS_ctx.stopSessionById(session);
                        // @ts-ignore
                        [stopSessionById,];
                    } },
                ...{ class: "btn-action btn-stop" },
            });
            /** @type {__VLS_StyleScopedClasses['btn-action']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-stop']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.sessions.length > 0))
                            return;
                        if (!!(session.status === 'running'))
                            return;
                        __VLS_ctx.startSession(session);
                        // @ts-ignore
                        [startSession,];
                    } },
                ...{ class: "btn-action btn-start" },
                disabled: (session.status === 'pending'),
            });
            /** @type {__VLS_StyleScopedClasses['btn-action']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-start']} */ ;
            (session.status === 'pending' ? '排队中' : '启动');
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.sessions.length > 0))
                        return;
                    __VLS_ctx.previewScript(session);
                    // @ts-ignore
                    [previewScript,];
                } },
            ...{ class: "btn-action btn-script" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-action']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-script']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.sessions.length > 0))
                        return;
                    __VLS_ctx.viewSessionLog(session);
                    // @ts-ignore
                    [viewSessionLog,];
                } },
            ...{ class: "btn-action btn-log" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-action']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-log']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.sessions.length > 0))
                        return;
                    __VLS_ctx.deleteSession(session);
                    // @ts-ignore
                    [deleteSession,];
                } },
            ...{ class: "btn-action btn-delete" },
            disabled: (session.status === 'running' || session.status === 'pending'),
        });
        /** @type {__VLS_StyleScopedClasses['btn-action']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-delete']} */ ;
        // @ts-ignore
        [];
    }
}
if (__VLS_ctx.sessions.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty-state" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty-illustration" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-illustration']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        width: "120",
        height: "96",
        viewBox: "0 0 120 96",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
        x: "10",
        y: "8",
        width: "100",
        height: "66",
        rx: "8",
        fill: "#EEF2FF",
        stroke: "#C7D2FE",
        'stroke-width': "1.5",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
        x: "18",
        y: "16",
        width: "84",
        height: "50",
        rx: "4",
        fill: "#F8FAFF",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
        x: "26",
        y: "24",
        width: "40",
        height: "5",
        rx: "2.5",
        fill: "#C7D2FE",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
        x: "26",
        y: "34",
        width: "60",
        height: "4",
        rx: "2",
        fill: "#E0E7FF",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
        x: "26",
        y: "43",
        width: "50",
        height: "4",
        rx: "2",
        fill: "#E0E7FF",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
        x: "26",
        y: "52",
        width: "30",
        height: "4",
        rx: "2",
        fill: "#E0E7FF",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
        x: "44",
        y: "74",
        width: "32",
        height: "6",
        rx: "3",
        fill: "#C7D2FE",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
        x: "30",
        y: "80",
        width: "60",
        height: "8",
        rx: "4",
        fill: "#E0E7FF",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "88",
        cy: "72",
        r: "16",
        fill: "#6366F1",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "M88 65v14M81 72h14",
        stroke: "white",
        'stroke-width': "2.5",
        'stroke-linecap': "round",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "empty-title" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "empty-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-hint']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.openCreateModal) },
        ...{ class: "btn-new-session" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-new-session']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        width: "14",
        height: "14",
        viewBox: "0 0 14 14",
        fill: "none",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "M7 1v12M1 7h12",
        stroke: "currentColor",
        'stroke-width': "2",
        'stroke-linecap': "round",
    });
}
if (__VLS_ctx.showCreateModal) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "modal-content create-modal" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
    /** @type {__VLS_StyleScopedClasses['create-modal']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCreateModal))
                    return;
                __VLS_ctx.showCreateModal = false;
                // @ts-ignore
                [openCreateModal, sessions, showCreateModal, showCreateModal,];
            } },
        ...{ class: "btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
        ...{ onSubmit: (__VLS_ctx.createDesktop) },
        ...{ class: "create-form" },
    });
    /** @type {__VLS_StyleScopedClasses['create-form']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mode-selector" },
    });
    /** @type {__VLS_StyleScopedClasses['mode-selector']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCreateModal))
                    return;
                __VLS_ctx.createForm.mode = 'desktop';
                // @ts-ignore
                [createDesktop, createForm,];
            } },
        ...{ class: (['mode-card', { active: __VLS_ctx.createForm.mode === 'desktop' }]) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['mode-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mode-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['mode-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mode-label" },
    });
    /** @type {__VLS_StyleScopedClasses['mode-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mode-desc" },
    });
    /** @type {__VLS_StyleScopedClasses['mode-desc']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCreateModal))
                    return;
                __VLS_ctx.createForm.mode = 'app';
                // @ts-ignore
                [createForm, createForm,];
            } },
        ...{ class: (['mode-card', { active: __VLS_ctx.createForm.mode === 'app' }]) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['mode-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mode-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['mode-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mode-label" },
    });
    /** @type {__VLS_StyleScopedClasses['mode-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mode-desc" },
    });
    /** @type {__VLS_StyleScopedClasses['mode-desc']} */ ;
    if (__VLS_ctx.createForm.mode === 'desktop') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "form-group" },
        });
        /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "desktop-env-selector" },
        });
        /** @type {__VLS_StyleScopedClasses['desktop-env-selector']} */ ;
        for (const [env] of __VLS_vFor((__VLS_ctx.desktopEnvs))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                key: (env.value),
                ...{ class: "env-option" },
            });
            /** @type {__VLS_StyleScopedClasses['env-option']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                type: "radio",
                value: (env.value),
            });
            (__VLS_ctx.createForm.desktopEnv);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (env.icon);
            (env.label);
            // @ts-ignore
            [createForm, createForm, createForm, desktopEnvs,];
        }
    }
    if (__VLS_ctx.createForm.mode === 'app') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "form-group" },
        });
        /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "app-label-row" },
        });
        /** @type {__VLS_StyleScopedClasses['app-label-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        if (__VLS_ctx.isAdminUser) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.showCreateModal))
                            return;
                        if (!(__VLS_ctx.createForm.mode === 'app'))
                            return;
                        if (!(__VLS_ctx.isAdminUser))
                            return;
                        __VLS_ctx.showManageApps = true;
                        // @ts-ignore
                        [createForm, isAdminUser, showManageApps,];
                    } },
                type: "button",
                ...{ class: "btn-manage-apps" },
            });
            /** @type {__VLS_StyleScopedClasses['btn-manage-apps']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                width: "12",
                height: "12",
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
                r: "3",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14",
            });
        }
        if (__VLS_ctx.remoteApps.length > 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "app-grid" },
            });
            /** @type {__VLS_StyleScopedClasses['app-grid']} */ ;
            for (const [app] of __VLS_vFor((__VLS_ctx.remoteApps))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.showCreateModal))
                                return;
                            if (!(__VLS_ctx.createForm.mode === 'app'))
                                return;
                            if (!(__VLS_ctx.remoteApps.length > 0))
                                return;
                            __VLS_ctx.selectApp(app);
                            // @ts-ignore
                            [remoteApps, remoteApps, selectApp,];
                        } },
                    key: (app.id),
                    ...{ class: (['app-card', { active: __VLS_ctx.createForm.selectedAppId === app.id }]) },
                });
                /** @type {__VLS_StyleScopedClasses['active']} */ ;
                /** @type {__VLS_StyleScopedClasses['app-card']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "app-icon" },
                });
                /** @type {__VLS_StyleScopedClasses['app-icon']} */ ;
                (app.icon || '📦');
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "app-name" },
                });
                /** @type {__VLS_StyleScopedClasses['app-name']} */ ;
                (app.name);
                if (app.desc) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "app-desc" },
                    });
                    /** @type {__VLS_StyleScopedClasses['app-desc']} */ ;
                    (app.desc);
                }
                // @ts-ignore
                [createForm,];
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "custom-app-row" },
        });
        /** @type {__VLS_StyleScopedClasses['custom-app-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            placeholder: "或输入自定义命令，如 gedit、matlab...",
            ...{ class: "custom-app-input" },
        });
        (__VLS_ctx.createForm.appCommand);
        /** @type {__VLS_StyleScopedClasses['custom-app-input']} */ ;
        if (__VLS_ctx.createForm.appCommand) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "modules-row" },
            });
            /** @type {__VLS_StyleScopedClasses['modules-row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                placeholder: "如: matlab/R2024a gcc/12.3 cuda/12.0（空格分隔）",
                ...{ class: "custom-app-input" },
            });
            (__VLS_ctx.createForm.modules);
            /** @type {__VLS_StyleScopedClasses['custom-app-input']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "modules-hint" },
            });
            /** @type {__VLS_StyleScopedClasses['modules-hint']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        value: (__VLS_ctx.createForm.name),
        type: "text",
        placeholder: "my-session",
        required: true,
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-row" },
    });
    /** @type {__VLS_StyleScopedClasses['form-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: (__VLS_ctx.loadResourcePresets) },
        value: (__VLS_ctx.createForm.partition),
        required: true,
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
        disabled: true,
    });
    (__VLS_ctx.partitionsLoading ? '加载中...' : '请选择');
    for (const [p] of __VLS_vFor((__VLS_ctx.partitions))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (p.name),
            value: (p.name),
            disabled: (p.state !== 'UP'),
        });
        (p.name);
        if (p.state !== 'UP') {
            (p.state === 'DOWN' ? '已停用' : p.state);
        }
        // @ts-ignore
        [createForm, createForm, createForm, createForm, createForm, loadResourcePresets, partitionsLoading, partitions,];
    }
    if (__VLS_ctx.partitions.some(p => p.state !== 'UP')) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "partition-hint" },
        });
        /** @type {__VLS_StyleScopedClasses['partition-hint']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.createForm.presetIndex),
    });
    if (__VLS_ctx.presetsLoading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
            disabled: true,
        });
    }
    for (const [p, i] of __VLS_vFor((__VLS_ctx.resourcePresets))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (i),
            value: (i),
        });
        (p.label);
        // @ts-ignore
        [createForm, partitions, presetsLoading, resourcePresets,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "1",
        max: "24",
        ...{ style: {} },
    });
    (__VLS_ctx.createForm.duration);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.createForm.gpus),
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: (0),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: (1),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: (2),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: (4),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: (8),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['form-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCreateModal))
                    return;
                __VLS_ctx.showCreateModal = false;
                // @ts-ignore
                [showCreateModal, createForm, createForm,];
            } },
        type: "button",
        ...{ class: "btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        type: "submit",
        ...{ class: "btn-primary" },
        disabled: (__VLS_ctx.submitting),
    });
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    (__VLS_ctx.submitting ? '创建中...' : '创建');
}
if (__VLS_ctx.showManageApps) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showManageApps))
                    return;
                __VLS_ctx.showManageApps = false;
                // @ts-ignore
                [showManageApps, showManageApps, submitting, submitting,];
            } },
        ...{ class: "modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "modal-content" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showManageApps))
                    return;
                __VLS_ctx.showManageApps = false;
                // @ts-ignore
                [showManageApps,];
            } },
        ...{ class: "btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    if (__VLS_ctx.remoteApps.length > 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
            ...{ class: "apps-table" },
        });
        /** @type {__VLS_StyleScopedClasses['apps-table']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
        for (const [app] of __VLS_vFor((__VLS_ctx.remoteApps))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                key: (app.id),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            (app.icon || '📦');
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            (app.name);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
            (app.cmd);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ style: {} },
            });
            (app.modules || '-');
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.showManageApps))
                            return;
                        if (!(__VLS_ctx.remoteApps.length > 0))
                            return;
                        __VLS_ctx.deleteApp(app.id);
                        // @ts-ignore
                        [remoteApps, remoteApps, deleteApp,];
                    } },
                ...{ class: "btn-action btn-delete" },
            });
            /** @type {__VLS_StyleScopedClasses['btn-action']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-delete']} */ ;
            // @ts-ignore
            [];
        }
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ style: {} },
        });
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "add-app-form" },
    });
    /** @type {__VLS_StyleScopedClasses['add-app-form']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-row" },
    });
    /** @type {__VLS_StyleScopedClasses['form-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "MATLAB",
    });
    (__VLS_ctx.newApp.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "🔢",
        ...{ style: {} },
    });
    (__VLS_ctx.newApp.icon);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "matlab -desktop",
    });
    (__VLS_ctx.newApp.cmd);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "matlab/R2024a cuda/12.0（空格分隔）",
    });
    (__VLS_ctx.newApp.modules);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modules-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['modules-hint']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "数值计算软件",
    });
    (__VLS_ctx.newApp.desc);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['form-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.addApp) },
        type: "button",
        ...{ class: "btn-primary" },
        disabled: (!__VLS_ctx.newApp.name || !__VLS_ctx.newApp.cmd),
    });
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
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
if (__VLS_ctx.launchState?.status === 'starting') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "launch-float" },
        ...{ class: ({ minimized: __VLS_ctx.launchMinimized }) },
    });
    /** @type {__VLS_StyleScopedClasses['launch-float']} */ ;
    /** @type {__VLS_StyleScopedClasses['minimized']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.launchState?.status === 'starting'))
                    return;
                __VLS_ctx.launchMinimized = !__VLS_ctx.launchMinimized;
                // @ts-ignore
                [newApp, newApp, newApp, newApp, newApp, newApp, newApp, addApp, launchState, launchMinimized, launchMinimized, launchMinimized,];
            } },
        ...{ class: "launch-float-header" },
    });
    /** @type {__VLS_StyleScopedClasses['launch-float-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "launch-float-title" },
    });
    /** @type {__VLS_StyleScopedClasses['launch-float-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "launch-spinner" },
    });
    /** @type {__VLS_StyleScopedClasses['launch-spinner']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.launchState.sessionName);
    if (__VLS_ctx.launchState.jobId) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "launch-jobid" },
        });
        /** @type {__VLS_StyleScopedClasses['launch-jobid']} */ ;
        (__VLS_ctx.launchState.jobId);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "launch-float-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['launch-float-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ class: "launch-icon-btn" },
        title: (__VLS_ctx.launchMinimized ? '展开' : '最小化'),
    });
    /** @type {__VLS_StyleScopedClasses['launch-icon-btn']} */ ;
    (__VLS_ctx.launchMinimized ? '▲' : '▼');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.launchState?.status === 'starting'))
                    return;
                __VLS_ctx.launchMinimized = true;
                // @ts-ignore
                [launchState, launchState, launchState, launchMinimized, launchMinimized, launchMinimized,];
            } },
        ...{ class: "launch-icon-btn" },
        title: "关闭（后台继续启动）",
    });
    /** @type {__VLS_StyleScopedClasses['launch-icon-btn']} */ ;
    if (!__VLS_ctx.launchMinimized) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "launch-float-body" },
        });
        /** @type {__VLS_StyleScopedClasses['launch-float-body']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "launch-progress" },
        });
        /** @type {__VLS_StyleScopedClasses['launch-progress']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "launch-progress-fill" },
            ...{ style: ({ width: __VLS_ctx.launchState.progress + '%' }) },
        });
        /** @type {__VLS_StyleScopedClasses['launch-progress-fill']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "log-panel" },
        });
        /** @type {__VLS_StyleScopedClasses['log-panel']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "log-header" },
        });
        /** @type {__VLS_StyleScopedClasses['log-header']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "log-tabs" },
        });
        /** @type {__VLS_StyleScopedClasses['log-tabs']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.launchState?.status === 'starting'))
                        return;
                    if (!(!__VLS_ctx.launchMinimized))
                        return;
                    __VLS_ctx.launchState.logType = 'out';
                    // @ts-ignore
                    [launchState, launchState, launchMinimized,];
                } },
            ...{ class: (['log-tab', { active: __VLS_ctx.launchState.logType === 'out' }]) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        /** @type {__VLS_StyleScopedClasses['log-tab']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.launchState?.status === 'starting'))
                        return;
                    if (!(!__VLS_ctx.launchMinimized))
                        return;
                    __VLS_ctx.launchState.logType = 'err';
                    // @ts-ignore
                    [launchState, launchState,];
                } },
            ...{ class: (['log-tab', { active: __VLS_ctx.launchState.logType === 'err' }]) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        /** @type {__VLS_StyleScopedClasses['log-tab']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "log-body" },
        });
        /** @type {__VLS_StyleScopedClasses['log-body']} */ ;
        if (__VLS_ctx.launchState.logLines.length === 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "log-empty" },
            });
            /** @type {__VLS_StyleScopedClasses['log-empty']} */ ;
        }
        for (const [line, i] of __VLS_vFor((__VLS_ctx.launchState.logLines))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (i),
                ...{ class: "log-line" },
            });
            /** @type {__VLS_StyleScopedClasses['log-line']} */ ;
            (line);
            // @ts-ignore
            [launchState, launchState, launchState,];
        }
    }
}
// @ts-ignore
[];
var __VLS_3;
if (__VLS_ctx.showStartModal && __VLS_ctx.launchState?.status !== 'starting') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "modal-content start-modal" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
    /** @type {__VLS_StyleScopedClasses['start-modal']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    (__VLS_ctx.modalStatus === 'ready' ? '会话已就绪' : __VLS_ctx.modalStatus === 'failed' ? '启动失败' : '会话已就绪');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showStartModal && __VLS_ctx.launchState?.status !== 'starting'))
                    return;
                __VLS_ctx.showStartModal = false;
                // @ts-ignore
                [launchState, showStartModal, showStartModal, modalStatus, modalStatus,];
            } },
        ...{ class: "btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    if (__VLS_ctx.modalStatus === 'failed') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "status-failed" },
        });
        /** @type {__VLS_StyleScopedClasses['status-failed']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "fail-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['fail-icon']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
        if (__VLS_ctx.launchState?.errorMessage) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "error-message" },
            });
            /** @type {__VLS_StyleScopedClasses['error-message']} */ ;
            (__VLS_ctx.launchState.errorMessage);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "log-panel" },
        });
        /** @type {__VLS_StyleScopedClasses['log-panel']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "log-header" },
        });
        /** @type {__VLS_StyleScopedClasses['log-header']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showStartModal && __VLS_ctx.launchState?.status !== 'starting'))
                        return;
                    if (!(__VLS_ctx.modalStatus === 'failed'))
                        return;
                    __VLS_ctx.viewScript(__VLS_ctx.launchState?.sessionId);
                    // @ts-ignore
                    [launchState, launchState, launchState, modalStatus, viewScript,];
                } },
            ...{ class: "btn-text" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-text']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "log-body" },
        });
        /** @type {__VLS_StyleScopedClasses['log-body']} */ ;
        if (!__VLS_ctx.launchState?.logLines || __VLS_ctx.launchState.logLines.length === 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "log-empty" },
            });
            /** @type {__VLS_StyleScopedClasses['log-empty']} */ ;
        }
        for (const [line, i] of __VLS_vFor((__VLS_ctx.launchState?.logLines || []))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (i),
                ...{ class: "log-line" },
            });
            /** @type {__VLS_StyleScopedClasses['log-line']} */ ;
            (line);
            // @ts-ignore
            [launchState, launchState, launchState,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "modal-actions" },
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['modal-actions']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showStartModal && __VLS_ctx.launchState?.status !== 'starting'))
                        return;
                    if (!(__VLS_ctx.modalStatus === 'failed'))
                        return;
                    __VLS_ctx.showStartModal = false;
                    __VLS_ctx.clearLaunch();
                    // @ts-ignore
                    [showStartModal, clearLaunch,];
                } },
            ...{ class: "btn-secondary" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "status-ready" },
        });
        /** @type {__VLS_StyleScopedClasses['status-ready']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "success-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['success-icon']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "connection-info" },
        });
        /** @type {__VLS_StyleScopedClasses['connection-info']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "info-item" },
        });
        /** @type {__VLS_StyleScopedClasses['info-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "info-label" },
        });
        /** @type {__VLS_StyleScopedClasses['info-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
        (__VLS_ctx.selectedSession?.address);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "info-item" },
        });
        /** @type {__VLS_StyleScopedClasses['info-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "info-label" },
        });
        /** @type {__VLS_StyleScopedClasses['info-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
        (__VLS_ctx.selectedSession?.vncPort);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "info-item" },
        });
        /** @type {__VLS_StyleScopedClasses['info-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "info-label" },
        });
        /** @type {__VLS_StyleScopedClasses['info-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
        (__VLS_ctx.selectedSession?.xpraPort);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "connection-methods" },
        });
        /** @type {__VLS_StyleScopedClasses['connection-methods']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "method-item method-recommend" },
        });
        /** @type {__VLS_StyleScopedClasses['method-item']} */ ;
        /** @type {__VLS_StyleScopedClasses['method-recommend']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "method-top" },
        });
        /** @type {__VLS_StyleScopedClasses['method-top']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "method-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['method-icon']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "method-content" },
        });
        /** @type {__VLS_StyleScopedClasses['method-content']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "recommend-tag" },
        });
        /** @type {__VLS_StyleScopedClasses['recommend-tag']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.openNoVNC) },
            ...{ class: "btn-primary" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "method-item" },
        });
        /** @type {__VLS_StyleScopedClasses['method-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "method-top" },
        });
        /** @type {__VLS_StyleScopedClasses['method-top']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "method-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['method-icon']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "method-content" },
        });
        /** @type {__VLS_StyleScopedClasses['method-content']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ style: {} },
        });
        if (__VLS_ctx.tunnelStatus === 'connecting') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ style: {} },
            });
        }
        else if (__VLS_ctx.tunnelStatus === 'connected') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ style: {} },
            });
        }
        else if (__VLS_ctx.tunnelStatus === 'disconnected') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ style: {} },
            });
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.launchTunnel) },
            ...{ class: "btn-primary" },
            ...{ style: (__VLS_ctx.tunnelStatus === 'disconnected' ? 'background:#ef4444;color:#fff;border-color:#ef4444' : '') },
        });
        /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
        (__VLS_ctx.tunnelStatus === 'idle' ? '一键连接' : __VLS_ctx.tunnelStatus === 'disconnected' ? '重新连接' : '重新连接');
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "method-hint" },
        });
        /** @type {__VLS_StyleScopedClasses['method-hint']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
        (__VLS_ctx.selectedSession?.xpraPort);
        __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
        (__VLS_ctx.localVncPort);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
            href: "/download",
            target: "_blank",
            ...{ style: {} },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "modal-actions" },
        });
        /** @type {__VLS_StyleScopedClasses['modal-actions']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.stopSession) },
            ...{ class: "btn-danger" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-danger']} */ ;
        if (__VLS_ctx.tunnelStatus === 'connected') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.showStartModal && __VLS_ctx.launchState?.status !== 'starting'))
                            return;
                        if (!!(__VLS_ctx.modalStatus === 'failed'))
                            return;
                        if (!(__VLS_ctx.tunnelStatus === 'connected'))
                            return;
                        __VLS_ctx.showStartModal = false;
                        __VLS_ctx.clientMinimized = true;
                        // @ts-ignore
                        [showStartModal, selectedSession, selectedSession, selectedSession, selectedSession, openNoVNC, tunnelStatus, tunnelStatus, tunnelStatus, tunnelStatus, tunnelStatus, tunnelStatus, tunnelStatus, launchTunnel, localVncPort, stopSession, clientMinimized,];
                    } },
                ...{ class: "btn-secondary" },
            });
            /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showStartModal && __VLS_ctx.launchState?.status !== 'starting'))
                        return;
                    if (!!(__VLS_ctx.modalStatus === 'failed'))
                        return;
                    __VLS_ctx.showStartModal = false;
                    // @ts-ignore
                    [showStartModal,];
                } },
            ...{ class: "btn-secondary" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    }
}
if (__VLS_ctx.showXpraModal) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "vnc-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['vnc-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "vnc-toolbar" },
    });
    /** @type {__VLS_StyleScopedClasses['vnc-toolbar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.selectedSession?.name);
    (__VLS_ctx.selectedSession?.address);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.toggleFullscreen) },
        ...{ class: "btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showXpraModal))
                    return;
                __VLS_ctx.showXpraModal = false;
                // @ts-ignore
                [selectedSession, selectedSession, showXpraModal, showXpraModal, toggleFullscreen,];
            } },
        ...{ class: "btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    const __VLS_6 = XpraViewer;
    // @ts-ignore
    const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
        wsUrl: (__VLS_ctx.xpraWsUrl),
        password: (__VLS_ctx.selectedSession?.vncPassword),
        ...{ class: "xpra-viewer-fill" },
    }));
    const __VLS_8 = __VLS_7({
        wsUrl: (__VLS_ctx.xpraWsUrl),
        password: (__VLS_ctx.selectedSession?.vncPassword),
        ...{ class: "xpra-viewer-fill" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_7));
    /** @type {__VLS_StyleScopedClasses['xpra-viewer-fill']} */ ;
}
let __VLS_11;
/** @ts-ignore @type {typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_12 = __VLS_asFunctionalComponent1(__VLS_11, new __VLS_11({
    to: "body",
}));
const __VLS_13 = __VLS_12({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_12));
const { default: __VLS_16 } = __VLS_14.slots;
if (__VLS_ctx.clientMinimized && (__VLS_ctx.tunnelStatus === 'connected' || __VLS_ctx.tunnelStatus === 'disconnected')) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "client-float-bar" },
        ...{ class: ({ 'client-float-disconnected': __VLS_ctx.tunnelStatus === 'disconnected' }) },
    });
    /** @type {__VLS_StyleScopedClasses['client-float-bar']} */ ;
    /** @type {__VLS_StyleScopedClasses['client-float-disconnected']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "client-float-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['client-float-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "client-float-name" },
    });
    /** @type {__VLS_StyleScopedClasses['client-float-name']} */ ;
    (__VLS_ctx.selectedSession?.name);
    if (__VLS_ctx.tunnelStatus === 'connected') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "client-float-status" },
        });
        /** @type {__VLS_StyleScopedClasses['client-float-status']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "client-float-status" },
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['client-float-status']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.clientMinimized && (__VLS_ctx.tunnelStatus === 'connected' || __VLS_ctx.tunnelStatus === 'disconnected')))
                    return;
                __VLS_ctx.showStartModal = true;
                __VLS_ctx.clientMinimized = false;
                // @ts-ignore
                [showStartModal, selectedSession, selectedSession, tunnelStatus, tunnelStatus, tunnelStatus, tunnelStatus, clientMinimized, clientMinimized, xpraWsUrl,];
            } },
        ...{ class: "client-float-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['client-float-btn']} */ ;
    (__VLS_ctx.tunnelStatus === 'disconnected' ? '重新连接' : '恢复');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.stopSession) },
        ...{ class: "client-float-btn client-float-stop" },
    });
    /** @type {__VLS_StyleScopedClasses['client-float-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['client-float-stop']} */ ;
}
// @ts-ignore
[tunnelStatus, stopSession,];
var __VLS_14;
if (__VLS_ctx.showScriptModal) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "modal-content script-modal" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
    /** @type {__VLS_StyleScopedClasses['script-modal']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showScriptModal))
                    return;
                __VLS_ctx.showScriptModal = false;
                // @ts-ignore
                [showScriptModal, showScriptModal,];
            } },
        ...{ class: "btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "script-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['script-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.copyScript) },
        ...{ class: "btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
        ...{ class: "script-body" },
    });
    /** @type {__VLS_StyleScopedClasses['script-body']} */ ;
    (__VLS_ctx.scriptInfo.script);
}
if (__VLS_ctx.showLogModal) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showLogModal))
                    return;
                __VLS_ctx.showLogModal = false;
                // @ts-ignore
                [copyScript, scriptInfo, showLogModal, showLogModal,];
            } },
        ...{ class: "modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "modal-content script-modal" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
    /** @type {__VLS_StyleScopedClasses['script-modal']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    (__VLS_ctx.logSession?.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showLogModal))
                    return;
                __VLS_ctx.switchLog('out');
                // @ts-ignore
                [logSession, switchLog,];
            } },
        ...{ class: (['btn-tab', __VLS_ctx.logType === 'out' ? 'active' : '']) },
    });
    /** @type {__VLS_StyleScopedClasses['btn-tab']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showLogModal))
                    return;
                __VLS_ctx.switchLog('err');
                // @ts-ignore
                [switchLog, logType,];
            } },
        ...{ class: (['btn-tab', __VLS_ctx.logType === 'err' ? 'active' : '']) },
    });
    /** @type {__VLS_StyleScopedClasses['btn-tab']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showLogModal))
                    return;
                __VLS_ctx.showLogModal = false;
                // @ts-ignore
                [showLogModal, logType,];
            } },
        ...{ class: "btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    if (__VLS_ctx.logLoading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ style: {} },
        });
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
            ...{ class: "script-body log-body" },
        });
        /** @type {__VLS_StyleScopedClasses['script-body']} */ ;
        /** @type {__VLS_StyleScopedClasses['log-body']} */ ;
        (__VLS_ctx.logContent || '（暂无日志内容）');
    }
}
// @ts-ignore
[logLoading, logContent,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
