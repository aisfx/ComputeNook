/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted } from 'vue';
import { getApiBase, getUser } from '../utils/auth';
import notification from '../utils/notification';
import { dialog } from '../utils/dialog';
const emit = defineEmits(['go-desktop', 'go-files']);
const token = () => localStorage.getItem('token') || sessionStorage.getItem('token') || '';
const currentUsername = computed(() => getUser()?.username || '');
// ── 客户端检测 ──────────────────────────────────────────────
const clientInstalled = ref(false);
const showAllPlatforms = ref(false);
const downloading = ref('');
const checkClient = () => {
    // 尝试触发 hpcc://ping，500ms 内没有报错视为已安装
    // 浏览器无法直接感知协议是否注册，用 iframe 静默触发
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = 'hpcc://ping';
    document.body.appendChild(iframe);
    setTimeout(() => {
        document.body.removeChild(iframe);
        // 如果 localStorage 里有上次成功记录，也视为已安装
        if (localStorage.getItem('hpcc_installed') === '1') {
            clientInstalled.value = true;
        }
    }, 600);
    // 同时检查 localStorage 标记
    if (localStorage.getItem('hpcc_installed') === '1') {
        clientInstalled.value = true;
    }
};
const osKey = computed(() => {
    const ua = navigator.userAgent;
    if (ua.includes('Windows'))
        return 'windows';
    if (ua.includes('Mac'))
        return 'darwin';
    return 'linux';
});
const platforms = [
    { key: 'windows', icon: '🪟', label: 'Windows', desc: 'Windows 10/11 x64', name: 'hpc-client-windows.exe' },
    { key: 'darwin', icon: '🍎', label: 'macOS', desc: 'Intel / Apple Silicon', name: 'hpc-client-mac' },
    { key: 'linux', icon: '🐧', label: 'Linux', desc: 'x86_64', name: 'hpc-client-linux' },
];
const currentOS = computed(() => platforms.find(p => p.key === osKey.value) || platforms[0]);
const downloadFile = async (p) => {
    downloading.value = p.name;
    try {
        const res = await fetch(`${getApiBase()}/api/download/${p.name}`, {
            headers: { Authorization: `Bearer ${token()}` }
        });
        if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            dialog.error(j.error || '客户端文件尚未生成，请联系管理员');
            return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = p.name;
        a.click();
        URL.revokeObjectURL(url);
        // 下载后提示安装
        notification.info('下载完成，双击运行文件完成安装，然后点击「重新检测」');
    }
    catch (e) {
        dialog.error('下载失败: ' + e.message);
    }
    finally {
        downloading.value = '';
    }
};
const downloadClient = () => downloadFile(currentOS.value);
// ── SSH 隧道 ──────────────────────────────────────────────
const sshStatus = ref('idle');
const sshNode = ref('');
const sshLocalPort = ref(12222);
const showSshPanel = ref(false);
const nodes = ref([]);
const selectedNode = ref(null);
const loadingNodes = ref(false);
const sshStatusLabel = computed(() => ({
    idle: '未连接', connecting: '连接中…', connected: '已连接'
}[sshStatus.value]));
const loadNodes = async () => {
    loadingNodes.value = true;
    try {
        const res = await fetch(`${getApiBase()}/api/webshell/nodes`, {
            headers: { Authorization: `Bearer ${token()}` }
        });
        if (res.ok) {
            const d = await res.json();
            nodes.value = d.nodes || d || [];
        }
    }
    catch { /* ignore */ }
    finally {
        loadingNodes.value = false;
    }
};
const triggerUri = (uri) => {
    // Use window.location.href for better browser compatibility with custom protocols
    // This ensures the protocol launch is treated as a user-initiated navigation
    window.location.href = uri;
};
const connectSsh = () => {
    if (!selectedNode.value)
        return;
    const node = selectedNode.value;
    const uri = `hpcc://ssh?server=${encodeURIComponent(location.origin)}&token=${encodeURIComponent(token())}&host=${encodeURIComponent(node.host || node.name)}&port=${sshLocalPort.value}&ssh-port=${node.port || 22}&user=${encodeURIComponent(currentUsername.value)}`;
    triggerUri(uri);
    sshStatus.value = 'connecting';
    sshNode.value = node.name;
    showSshPanel.value = false;
    // 增加延迟到5秒，给客户端更多时间建立连接
    setTimeout(() => {
        if (sshStatus.value === 'connecting')
            sshStatus.value = 'connected';
    }, 5000);
};
const disconnectSsh = () => {
    const uri = `hpcc://disconnect?server=${encodeURIComponent(location.origin)}&token=${encodeURIComponent(token())}&host=${encodeURIComponent(sshNode.value)}`;
    triggerUri(uri);
    sshStatus.value = 'idle';
    sshNode.value = '';
};
// ── 可视化桌面 ──────────────────────────────────────────────
const vncStatus = ref('idle');
const vncLocalPort = ref(15900);
const desktopSessions = ref([]);
const selectedSession = ref(null);
const vncStatusLabel = computed(() => ({
    idle: '未连接', connecting: '连接中…', connected: '已连接'
}[vncStatus.value]));
const loadDesktopSessions = async () => {
    try {
        const res = await fetch(`${getApiBase()}/api/desktop/sessions`, {
            headers: { Authorization: `Bearer ${token()}` }
        });
        if (res.ok) {
            const d = await res.json();
            desktopSessions.value = (d.sessions || d || []).filter((s) => s.status === 'running');
            if (desktopSessions.value.length > 0 && !selectedSession.value) {
                selectedSession.value = desktopSessions.value[0];
            }
        }
    }
    catch { /* ignore */ }
};
const connectVnc = () => {
    if (!selectedSession.value)
        return;
    const s = selectedSession.value;
    const sessionId = s.id;
    const tcpPort = s.xpraPort || s.vncPort;
    const uri = `hpcc://xpra?server=${encodeURIComponent(location.origin)}&token=${encodeURIComponent(token())}&session=${sessionId}&port=${vncLocalPort.value}&remote-port=${tcpPort}&auto-connect=1`;
    triggerUri(uri);
    vncStatus.value = 'connecting';
    // 增加延迟到8秒，给客户端更多时间建立隧道和连接
    setTimeout(() => {
        if (vncStatus.value === 'connecting')
            vncStatus.value = 'connected';
    }, 8000);
};
const disconnectVnc = () => {
    if (!selectedSession.value)
        return;
    const uri = `hpcc://exit?server=${encodeURIComponent(location.origin)}&token=${encodeURIComponent(token())}&session=${selectedSession.value.id}`;
    triggerUri(uri);
    vncStatus.value = 'idle';
};
// ── 目录挂载 ──────────────────────────────────────────────
const mountStatus = ref('idle');
const mountPoint = ref('');
const mountStatusLabel = computed(() => ({
    idle: '未挂载', connecting: '挂载中…', connected: '已挂载'
}[mountStatus.value]));
const mountDirectory = () => {
    const mp = mountPoint.value || (osKey.value === 'windows' ? 'Z:' : '/mnt/hpc');
    const uri = `hpcc://mount?server=${encodeURIComponent(location.origin)}&token=${encodeURIComponent(token())}&mountpoint=${encodeURIComponent(mp)}&port=18080`;
    triggerUri(uri);
    mountStatus.value = 'connecting';
    mountPoint.value = mp;
    setTimeout(() => {
        if (mountStatus.value === 'connecting')
            mountStatus.value = 'connected';
    }, 3000);
};
const unmountDirectory = () => {
    const uri = `hpcc://unmount?server=${encodeURIComponent(location.origin)}&token=${encodeURIComponent(token())}&mountpoint=${encodeURIComponent(mountPoint.value)}`;
    triggerUri(uri);
    mountStatus.value = 'idle';
};
// ── 工具 ──────────────────────────────────────────────
const copy = (text) => {
    navigator.clipboard.writeText(text);
    notification.success('已复制到剪贴板');
};
onMounted(() => {
    checkClient();
    loadNodes();
    loadDesktopSessions();
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
/** @type {__VLS_StyleScopedClasses['status-bar-left']} */ ;
/** @type {__VLS_StyleScopedClasses['client-status-pill']} */ ;
/** @type {__VLS_StyleScopedClasses['client-status-pill']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-refresh']} */ ;
/** @type {__VLS_StyleScopedClasses['install-banner-body']} */ ;
/** @type {__VLS_StyleScopedClasses['install-banner-body']} */ ;
/** @type {__VLS_StyleScopedClasses['install-banner-body']} */ ;
/** @type {__VLS_StyleScopedClasses['platform-card']} */ ;
/** @type {__VLS_StyleScopedClasses['feature-title']} */ ;
/** @type {__VLS_StyleScopedClasses['feature-title']} */ ;
/** @type {__VLS_StyleScopedClasses['conn-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['conn-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['conn-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['info-val']} */ ;
/** @type {__VLS_StyleScopedClasses['session-item']} */ ;
/** @type {__VLS_StyleScopedClasses['session-item']} */ ;
/** @type {__VLS_StyleScopedClasses['session-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['session-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['cmd-row']} */ ;
/** @type {__VLS_StyleScopedClasses['mount-point-row']} */ ;
/** @type {__VLS_StyleScopedClasses['mount-input']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-action']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-action']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-action']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-action']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-download-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-download-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-copy']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
/** @type {__VLS_StyleScopedClasses['node-item']} */ ;
/** @type {__VLS_StyleScopedClasses['node-item']} */ ;
/** @type {__VLS_StyleScopedClasses['node-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['idle']} */ ;
/** @type {__VLS_StyleScopedClasses['node-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['node-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-form']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-form']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-form']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "client-center" },
});
/** @type {__VLS_StyleScopedClasses['client-center']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "status-bar" },
});
/** @type {__VLS_StyleScopedClasses['status-bar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "status-bar-left" },
});
/** @type {__VLS_StyleScopedClasses['status-bar-left']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "status-bar-right" },
});
/** @type {__VLS_StyleScopedClasses['status-bar-right']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: (['client-status-pill', __VLS_ctx.clientInstalled ? 'ok' : 'warn']) },
});
/** @type {__VLS_StyleScopedClasses['client-status-pill']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "pill-dot" },
});
/** @type {__VLS_StyleScopedClasses['pill-dot']} */ ;
(__VLS_ctx.clientInstalled ? '客户端已就绪' : '客户端未安装');
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.checkClient) },
    ...{ class: "btn-refresh" },
    title: "重新检测",
});
/** @type {__VLS_StyleScopedClasses['btn-refresh']} */ ;
if (!__VLS_ctx.clientInstalled) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "install-banner" },
    });
    /** @type {__VLS_StyleScopedClasses['install-banner']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "install-banner-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['install-banner-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "install-banner-body" },
    });
    /** @type {__VLS_StyleScopedClasses['install-banner-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "install-banner-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['install-banner-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.downloadClient) },
        ...{ class: "btn-primary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    (__VLS_ctx.currentOS.label);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.clientInstalled))
                    return;
                __VLS_ctx.showAllPlatforms = !__VLS_ctx.showAllPlatforms;
                // @ts-ignore
                [clientInstalled, clientInstalled, clientInstalled, checkClient, downloadClient, currentOS, showAllPlatforms, showAllPlatforms,];
            } },
        ...{ class: "btn-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
}
if (__VLS_ctx.showAllPlatforms || __VLS_ctx.clientInstalled) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "platform-cards" },
    });
    /** @type {__VLS_StyleScopedClasses['platform-cards']} */ ;
    for (const [p] of __VLS_vFor((__VLS_ctx.platforms))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (p.key),
            ...{ class: (['platform-card', { current: p.key === __VLS_ctx.osKey }]) },
        });
        /** @type {__VLS_StyleScopedClasses['current']} */ ;
        /** @type {__VLS_StyleScopedClasses['platform-card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "platform-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['platform-icon']} */ ;
        (p.icon);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "platform-info" },
        });
        /** @type {__VLS_StyleScopedClasses['platform-info']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "platform-name" },
        });
        /** @type {__VLS_StyleScopedClasses['platform-name']} */ ;
        (p.label);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "platform-desc" },
        });
        /** @type {__VLS_StyleScopedClasses['platform-desc']} */ ;
        (p.desc);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showAllPlatforms || __VLS_ctx.clientInstalled))
                        return;
                    __VLS_ctx.downloadFile(p);
                    // @ts-ignore
                    [clientInstalled, showAllPlatforms, platforms, osKey, downloadFile,];
                } },
            ...{ class: "btn-download-sm" },
            disabled: (__VLS_ctx.downloading === p.name),
        });
        /** @type {__VLS_StyleScopedClasses['btn-download-sm']} */ ;
        (__VLS_ctx.downloading === p.name ? '下载中' : '下载');
        // @ts-ignore
        [downloading, downloading,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-grid" },
});
/** @type {__VLS_StyleScopedClasses['feature-grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-card" },
});
/** @type {__VLS_StyleScopedClasses['feature-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-header" },
});
/** @type {__VLS_StyleScopedClasses['feature-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-title" },
});
/** @type {__VLS_StyleScopedClasses['feature-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "feature-icon" },
});
/** @type {__VLS_StyleScopedClasses['feature-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: (['conn-badge', __VLS_ctx.sshStatus]) },
});
/** @type {__VLS_StyleScopedClasses['conn-badge']} */ ;
(__VLS_ctx.sshStatusLabel);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-body" },
});
/** @type {__VLS_StyleScopedClasses['feature-body']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "info-row" },
});
/** @type {__VLS_StyleScopedClasses['info-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "info-label" },
});
/** @type {__VLS_StyleScopedClasses['info-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({
    ...{ class: "info-val" },
});
/** @type {__VLS_StyleScopedClasses['info-val']} */ ;
(__VLS_ctx.sshLocalPort);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "info-row" },
});
/** @type {__VLS_StyleScopedClasses['info-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "info-label" },
});
/** @type {__VLS_StyleScopedClasses['info-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "info-val" },
});
/** @type {__VLS_StyleScopedClasses['info-val']} */ ;
(__VLS_ctx.sshNode || '');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "info-row" },
});
/** @type {__VLS_StyleScopedClasses['info-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "info-label" },
});
/** @type {__VLS_StyleScopedClasses['info-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({
    ...{ class: "info-val" },
});
/** @type {__VLS_StyleScopedClasses['info-val']} */ ;
(__VLS_ctx.currentUsername);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-footer" },
});
/** @type {__VLS_StyleScopedClasses['feature-footer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "cmd-block" },
});
/** @type {__VLS_StyleScopedClasses['cmd-block']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "cmd-label" },
});
/** @type {__VLS_StyleScopedClasses['cmd-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "cmd-row" },
});
/** @type {__VLS_StyleScopedClasses['cmd-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
(__VLS_ctx.sshLocalPort);
(__VLS_ctx.currentUsername);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.copy(`ssh -p ${__VLS_ctx.sshLocalPort} ${__VLS_ctx.currentUsername}@localhost`);
            // @ts-ignore
            [sshStatus, sshStatusLabel, sshLocalPort, sshLocalPort, sshLocalPort, sshNode, currentUsername, currentUsername, currentUsername, copy,];
        } },
    ...{ class: "btn-copy" },
});
/** @type {__VLS_StyleScopedClasses['btn-copy']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "action-row" },
});
/** @type {__VLS_StyleScopedClasses['action-row']} */ ;
if (__VLS_ctx.sshStatus !== 'connected') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.sshStatus !== 'connected'))
                    return;
                __VLS_ctx.showSshPanel = true;
                // @ts-ignore
                [sshStatus, showSshPanel,];
            } },
        ...{ class: "btn-action" },
        disabled: (!__VLS_ctx.clientInstalled),
    });
    /** @type {__VLS_StyleScopedClasses['btn-action']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.disconnectSsh) },
        ...{ class: "btn-action danger" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-action']} */ ;
    /** @type {__VLS_StyleScopedClasses['danger']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.copy(`ssh -p ${__VLS_ctx.sshLocalPort} ${__VLS_ctx.currentUsername}@localhost`);
            // @ts-ignore
            [clientInstalled, sshLocalPort, currentUsername, copy, disconnectSsh,];
        } },
    ...{ class: "btn-ghost-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn-ghost-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-card" },
});
/** @type {__VLS_StyleScopedClasses['feature-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-header" },
});
/** @type {__VLS_StyleScopedClasses['feature-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-title" },
});
/** @type {__VLS_StyleScopedClasses['feature-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "feature-icon" },
});
/** @type {__VLS_StyleScopedClasses['feature-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: (['conn-badge', __VLS_ctx.vncStatus]) },
});
/** @type {__VLS_StyleScopedClasses['conn-badge']} */ ;
(__VLS_ctx.vncStatusLabel);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-body" },
});
/** @type {__VLS_StyleScopedClasses['feature-body']} */ ;
if (__VLS_ctx.desktopSessions.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-hint']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "session-list" },
    });
    /** @type {__VLS_StyleScopedClasses['session-list']} */ ;
    for (const [s] of __VLS_vFor((__VLS_ctx.desktopSessions))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.desktopSessions.length === 0))
                        return;
                    __VLS_ctx.selectedSession = s;
                    // @ts-ignore
                    [vncStatus, vncStatusLabel, desktopSessions, desktopSessions, selectedSession,];
                } },
            key: (s.id),
            ...{ class: (['session-item', { active: __VLS_ctx.selectedSession?.id === s.id }]) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        /** @type {__VLS_StyleScopedClasses['session-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "session-dot" },
            ...{ class: (s.status) },
        });
        /** @type {__VLS_StyleScopedClasses['session-dot']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "session-name" },
        });
        /** @type {__VLS_StyleScopedClasses['session-name']} */ ;
        (s.name || `会话 #${s.id}`);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "session-port" },
        });
        /** @type {__VLS_StyleScopedClasses['session-port']} */ ;
        (s.vncPort || s.xpraPort);
        // @ts-ignore
        [selectedSession,];
    }
    if (__VLS_ctx.selectedSession) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "info-row" },
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['info-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "info-label" },
        });
        /** @type {__VLS_StyleScopedClasses['info-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({
            ...{ class: "info-val" },
        });
        /** @type {__VLS_StyleScopedClasses['info-val']} */ ;
        (__VLS_ctx.vncLocalPort);
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-footer" },
});
/** @type {__VLS_StyleScopedClasses['feature-footer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "action-row" },
});
/** @type {__VLS_StyleScopedClasses['action-row']} */ ;
if (__VLS_ctx.vncStatus !== 'connected') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.connectVnc) },
        ...{ class: "btn-action" },
        disabled: (!__VLS_ctx.clientInstalled || !__VLS_ctx.selectedSession),
    });
    /** @type {__VLS_StyleScopedClasses['btn-action']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.disconnectVnc) },
        ...{ class: "btn-action danger" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-action']} */ ;
    /** @type {__VLS_StyleScopedClasses['danger']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('go-desktop');
            // @ts-ignore
            [clientInstalled, vncStatus, selectedSession, selectedSession, vncLocalPort, connectVnc, disconnectVnc, $emit,];
        } },
    ...{ class: "btn-ghost-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn-ghost-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-card" },
});
/** @type {__VLS_StyleScopedClasses['feature-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-header" },
});
/** @type {__VLS_StyleScopedClasses['feature-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-title" },
});
/** @type {__VLS_StyleScopedClasses['feature-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "feature-icon" },
});
/** @type {__VLS_StyleScopedClasses['feature-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: (['conn-badge', __VLS_ctx.mountStatus]) },
});
/** @type {__VLS_StyleScopedClasses['conn-badge']} */ ;
(__VLS_ctx.mountStatusLabel);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-body" },
});
/** @type {__VLS_StyleScopedClasses['feature-body']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "info-row" },
});
/** @type {__VLS_StyleScopedClasses['info-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "info-label" },
});
/** @type {__VLS_StyleScopedClasses['info-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({
    ...{ class: "info-val" },
});
/** @type {__VLS_StyleScopedClasses['info-val']} */ ;
(__VLS_ctx.mountPoint || (__VLS_ctx.osKey === 'windows' ? 'Z:' : '/mnt/hpc'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "info-row" },
});
/** @type {__VLS_StyleScopedClasses['info-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "info-label" },
});
/** @type {__VLS_StyleScopedClasses['info-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "info-val" },
});
/** @type {__VLS_StyleScopedClasses['info-val']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "info-row" },
});
/** @type {__VLS_StyleScopedClasses['info-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "info-label" },
});
/** @type {__VLS_StyleScopedClasses['info-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({
    ...{ class: "info-val" },
});
/** @type {__VLS_StyleScopedClasses['info-val']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-footer" },
});
/** @type {__VLS_StyleScopedClasses['feature-footer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mount-point-row" },
});
/** @type {__VLS_StyleScopedClasses['mount-point-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    placeholder: (__VLS_ctx.osKey === 'windows' ? 'Z:' : '/mnt/hpc'),
    ...{ class: "mount-input" },
});
(__VLS_ctx.mountPoint);
/** @type {__VLS_StyleScopedClasses['mount-input']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "action-row" },
});
/** @type {__VLS_StyleScopedClasses['action-row']} */ ;
if (__VLS_ctx.mountStatus !== 'connected') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.mountDirectory) },
        ...{ class: "btn-action" },
        disabled: (!__VLS_ctx.clientInstalled),
    });
    /** @type {__VLS_StyleScopedClasses['btn-action']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.unmountDirectory) },
        ...{ class: "btn-action danger" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-action']} */ ;
    /** @type {__VLS_StyleScopedClasses['danger']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('go-files');
            // @ts-ignore
            [clientInstalled, osKey, osKey, $emit, mountStatus, mountStatus, mountStatusLabel, mountPoint, mountPoint, mountDirectory, unmountDirectory,];
        } },
    ...{ class: "btn-ghost-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn-ghost-sm']} */ ;
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
if (__VLS_ctx.showSshPanel) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showSshPanel))
                    return;
                __VLS_ctx.showSshPanel = false;
                // @ts-ignore
                [showSshPanel, showSshPanel,];
            } },
        ...{ class: "modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-box" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showSshPanel))
                    return;
                __VLS_ctx.showSshPanel = false;
                // @ts-ignore
                [showSshPanel,];
            } },
        ...{ class: "btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    if (__VLS_ctx.loadingNodes) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "loading-hint" },
        });
        /** @type {__VLS_StyleScopedClasses['loading-hint']} */ ;
    }
    else if (__VLS_ctx.nodes.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "empty-hint" },
        });
        /** @type {__VLS_StyleScopedClasses['empty-hint']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "node-list" },
        });
        /** @type {__VLS_StyleScopedClasses['node-list']} */ ;
        for (const [n] of __VLS_vFor((__VLS_ctx.nodes))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.showSshPanel))
                            return;
                        if (!!(__VLS_ctx.loadingNodes))
                            return;
                        if (!!(__VLS_ctx.nodes.length === 0))
                            return;
                        __VLS_ctx.selectedNode = n;
                        // @ts-ignore
                        [loadingNodes, nodes, nodes, selectedNode,];
                    } },
                key: (n.name),
                ...{ class: (['node-item', { selected: __VLS_ctx.selectedNode?.name === n.name }]) },
            });
            /** @type {__VLS_StyleScopedClasses['selected']} */ ;
            /** @type {__VLS_StyleScopedClasses['node-item']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "node-dot" },
                ...{ class: (n.state === 'idle' ? 'idle' : n.state === 'allocated' ? 'busy' : 'off') },
            });
            /** @type {__VLS_StyleScopedClasses['node-dot']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "node-name" },
            });
            /** @type {__VLS_StyleScopedClasses['node-name']} */ ;
            (n.name);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "node-state" },
            });
            /** @type {__VLS_StyleScopedClasses['node-state']} */ ;
            (n.state);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "node-host" },
            });
            /** @type {__VLS_StyleScopedClasses['node-host']} */ ;
            (n.host || n.name);
            // @ts-ignore
            [selectedNode,];
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-form" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-form']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "1024",
        max: "65535",
    });
    (__VLS_ctx.sshLocalPort);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-footer" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-footer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.connectSsh) },
        ...{ class: "btn-primary" },
        disabled: (!__VLS_ctx.selectedNode),
    });
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showSshPanel))
                    return;
                __VLS_ctx.showSshPanel = false;
                // @ts-ignore
                [sshLocalPort, showSshPanel, selectedNode, connectSsh,];
            } },
        ...{ class: "btn-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
}
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    emits: {},
});
export default {};
