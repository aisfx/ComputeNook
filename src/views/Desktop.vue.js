/// <reference types="../../node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed } from 'vue';
const selectedType = ref('');
const showCreateModal = ref(false);
const showStartModal = ref(false);
const submitting = ref(false);
const showPassword = ref(false);
const startingStatus = ref('starting');
const startProgress = ref(0);
const currentJobId = ref('');
const selectedSession = ref(null);
const createForm = ref({
    name: '',
    type: '',
    protocol: 'vnc',
    nodeType: 'standard',
    duration: 4,
    resolution: '1920x1080',
    port: null,
    purpose: ''
});
const sessions = ref([
    {
        id: 1,
        name: 'desktop-20250206-173123',
        type: 'xfce',
        protocol: 'vnc',
        address: 'hpc01_login01',
        createTime: '2025-02-06T18:15:24'
    },
    {
        id: 4,
        name: 'desktop-20231114-213706',
        type: 'kde',
        protocol: 'rdp',
        address: 'hpc01_login01',
        createTime: '2023-11-14T22:14:09'
    },
    {
        id: 6,
        name: 'desktop-20260204-172952',
        type: 'kde',
        protocol: 'vnc',
        address: 'hpc01_login01',
        createTime: '2026-02-04T18:32:09'
    }
]);
const sessionCredentials = ref({
    username: '',
    password: '',
    vncPort: 5901,
    rdpPort: 3389,
    webUrl: '',
    guacamoleUrl: ''
});
const filteredSessions = computed(() => {
    if (!selectedType.value)
        return sessions.value;
    return sessions.value.filter(s => s.type.toLowerCase() === selectedType.value.toLowerCase());
});
const createDesktop = async () => {
    submitting.value = true;
    setTimeout(() => {
        const newSession = {
            id: Date.now(),
            name: createForm.value.name,
            type: createForm.value.type,
            protocol: createForm.value.protocol,
            address: 'hpc01_login01',
            createTime: new Date().toISOString()
        };
        sessions.value.unshift(newSession);
        showCreateModal.value = false;
        submitting.value = false;
        alert(`远程桌面已创建！\n名称: ${newSession.name}\n类型: ${newSession.type}\n协议: ${newSession.protocol.toUpperCase()}`);
        // 重置表单
        createForm.value = {
            name: '',
            type: '',
            protocol: 'vnc',
            nodeType: 'standard',
            duration: 4,
            resolution: '1920x1080',
            port: null,
            purpose: ''
        };
    }, 1000);
};
const startSession = (session) => {
    selectedSession.value = session;
    showStartModal.value = true;
    startingStatus.value = 'starting';
    startProgress.value = 0;
    currentJobId.value = 'DESKTOP-' + Date.now();
    // 模拟启动进度
    const interval = setInterval(() => {
        startProgress.value += 20;
        if (startProgress.value >= 100) {
            clearInterval(interval);
            startingStatus.value = 'ready';
            // 生成临时凭据
            if (session.protocol === 'rdp') {
                sessionCredentials.value = {
                    username: 'rdpuser_' + Math.random().toString(36).substr(2, 6),
                    password: generatePassword(),
                    vncPort: 0,
                    rdpPort: 3389 + Math.floor(Math.random() * 100),
                    webUrl: '',
                    guacamoleUrl: `https://hpc.example.com/guacamole/#/client/${session.id}`
                };
            }
            else {
                sessionCredentials.value = {
                    username: 'vncuser_' + Math.random().toString(36).substr(2, 6),
                    password: generatePassword(),
                    vncPort: 5900 + Math.floor(Math.random() * 100),
                    rdpPort: 0,
                    webUrl: `https://hpc.example.com/vnc/${session.id}`,
                    guacamoleUrl: ''
                };
            }
        }
    }, 600);
};
const stopSession = () => {
    if (confirm('确定要停止此桌面会话吗？')) {
        showStartModal.value = false;
        alert('桌面会话已停止');
    }
};
const deleteSession = (id) => {
    if (confirm('确定要删除此桌面会话吗？\n删除后无法恢复。')) {
        const index = sessions.value.findIndex(s => s.id === id);
        if (index > -1) {
            sessions.value.splice(index, 1);
            alert('桌面会话已删除');
        }
    }
};
const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};
const togglePassword = () => {
    showPassword.value = !showPassword.value;
};
const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('已复制到剪贴板');
};
const openInBrowser = () => {
    window.open(sessionCredentials.value.webUrl, '_blank');
};
const downloadVNCFile = () => {
    const vncContent = `[connection]
host=${selectedSession.value?.address}
port=${sessionCredentials.value.vncPort}
password=${sessionCredentials.value.password}`;
    const blob = new Blob([vncContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSession.value?.name}.vnc`;
    a.click();
    URL.revokeObjectURL(url);
};
const downloadRDPFile = () => {
    const rdpContent = `full address:s:${selectedSession.value?.address}:${sessionCredentials.value.rdpPort}
username:s:${sessionCredentials.value.username}
screen mode id:i:2
use multimon:i:0
desktopwidth:i:1920
desktopheight:i:1080
session bpp:i:32
compression:i:1
keyboardhook:i:2
audiocapturemode:i:0
videoplaybackmode:i:1
connection type:i:7
networkautodetect:i:1
bandwidthautodetect:i:1
displayconnectionbar:i:1
enableworkspacereconnect:i:0
disable wallpaper:i:0
allow font smoothing:i:0
allow desktop composition:i:0
disable full window drag:i:1
disable menu anims:i:1
disable themes:i:0
disable cursor setting:i:0
bitmapcachepersistenable:i:1
audiomode:i:0
redirectprinters:i:1
redirectcomports:i:0
redirectsmartcards:i:1
redirectclipboard:i:1
redirectposdevices:i:0
autoreconnection enabled:i:1
authentication level:i:2
prompt for credentials:i:0
negotiate security layer:i:1
remoteapplicationmode:i:0
alternate shell:s:
shell working directory:s:
gatewayhostname:s:
gatewayusagemethod:i:4
gatewaycredentialssource:i:4
gatewayprofileusagemethod:i:0
promptcredentialonce:i:0
gatewaybrokeringtype:i:0
use redirection server name:i:0
rdgiskdcproxy:i:0
kdcproxyname:s:`;
    const blob = new Blob([rdpContent], { type: 'application/x-rdp' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSession.value?.name}.rdp`;
    a.click();
    URL.revokeObjectURL(url);
    alert('RDP 文件已下载，双击打开即可连接\n首次连接时请输入密码: ' + sessionCredentials.value.password);
};
const copyRDPConnection = () => {
    const connectionInfo = `主机: ${selectedSession.value?.address}
端口: ${sessionCredentials.value.rdpPort}
用户名: ${sessionCredentials.value.username}
密码: ${sessionCredentials.value.password}`;
    navigator.clipboard.writeText(connectionInfo);
    alert('连接信息已复制到剪贴板');
};
const openGuacamole = () => {
    window.open(sessionCredentials.value.guacamoleUrl, '_blank');
};
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
/** @type {__VLS_StyleScopedClasses['type-filter']} */ ;
/** @type {__VLS_StyleScopedClasses['desktop-table']} */ ;
/** @type {__VLS_StyleScopedClasses['desktop-table']} */ ;
/** @type {__VLS_StyleScopedClasses['desktop-table']} */ ;
/** @type {__VLS_StyleScopedClasses['desktop-table']} */ ;
/** @type {__VLS_StyleScopedClasses['protocol-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['protocol-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-start']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-delete']} */ ;
/** @type {__VLS_StyleScopedClasses['status-starting']} */ ;
/** @type {__VLS_StyleScopedClasses['status-starting']} */ ;
/** @type {__VLS_StyleScopedClasses['status-ready']} */ ;
/** @type {__VLS_StyleScopedClasses['info-value']} */ ;
/** @type {__VLS_StyleScopedClasses['credential-item']} */ ;
/** @type {__VLS_StyleScopedClasses['credential-value']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-copy']} */ ;
/** @type {__VLS_StyleScopedClasses['method-content']} */ ;
/** @type {__VLS_StyleScopedClasses['method-content']} */ ;
/** @type {__VLS_StyleScopedClasses['method-content']} */ ;
/** @type {__VLS_StyleScopedClasses['method-content']} */ ;
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
/** @type {__VLS_StyleScopedClasses['header-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['info-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['method-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "desktop-page" },
});
/** @type {__VLS_StyleScopedClasses['desktop-page']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "page-header" },
});
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "header-actions" },
});
/** @type {__VLS_StyleScopedClasses['header-actions']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_ctx.selectedType),
    ...{ class: "type-filter" },
});
/** @type {__VLS_StyleScopedClasses['type-filter']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "xfce",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "kde",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "gnome",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showCreateModal = true;
            // @ts-ignore
            [selectedType, showCreateModal,];
        } },
    ...{ class: "btn-primary" },
});
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
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
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
for (const [session, index] of __VLS_vFor((__VLS_ctx.filteredSessions))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
        key: (session.id),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    (index + 1);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    (session.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    (session.type);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "protocol-badge" },
        ...{ class: (session.protocol) },
    });
    /** @type {__VLS_StyleScopedClasses['protocol-badge']} */ ;
    (session.protocol.toUpperCase());
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    (session.address);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    (session.createTime);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "action-buttons" },
    });
    /** @type {__VLS_StyleScopedClasses['action-buttons']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.startSession(session);
                // @ts-ignore
                [filteredSessions, startSession,];
            } },
        ...{ class: "btn-action btn-start" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-action']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-start']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.deleteSession(session.id);
                // @ts-ignore
                [deleteSession,];
            } },
        ...{ class: "btn-action btn-delete" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-action']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-delete']} */ ;
    // @ts-ignore
    [];
}
if (__VLS_ctx.filteredSessions.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty-state" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "empty-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-hint']} */ ;
}
if (__VLS_ctx.showCreateModal) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCreateModal))
                    return;
                __VLS_ctx.showCreateModal = false;
                // @ts-ignore
                [showCreateModal, showCreateModal, filteredSessions,];
            } },
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
                [showCreateModal,];
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        value: (__VLS_ctx.createForm.name),
        type: "text",
        placeholder: "例如: desktop-20250206-001",
        required: true,
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.createForm.type),
        required: true,
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "xfce",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "kde",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "gnome",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.createForm.protocol),
        required: true,
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "vnc",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "rdp",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "help-text" },
    });
    /** @type {__VLS_StyleScopedClasses['help-text']} */ ;
    if (__VLS_ctx.createForm.protocol === 'vnc') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    }
    if (__VLS_ctx.createForm.protocol === 'rdp') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    }
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
        value: (__VLS_ctx.createForm.nodeType),
        required: true,
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "standard",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "high-mem",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "gpu",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "1",
        max: "24",
        required: true,
    });
    (__VLS_ctx.createForm.duration);
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
        value: (__VLS_ctx.createForm.resolution),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "1920x1080",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "1680x1050",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "1440x900",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "1280x720",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    (__VLS_ctx.createForm.protocol === 'rdp' ? 'RDP 端口' : 'VNC 端口');
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        placeholder: "自动分配",
        disabled: true,
    });
    (__VLS_ctx.createForm.port);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
        value: (__VLS_ctx.createForm.purpose),
        rows: "3",
        placeholder: "请简要说明使用远程桌面的目的...",
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
                [showCreateModal, createDesktop, createForm, createForm, createForm, createForm, createForm, createForm, createForm, createForm, createForm, createForm, createForm,];
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
    (__VLS_ctx.submitting ? '创建中...' : '创建桌面');
}
if (__VLS_ctx.showStartModal) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showStartModal))
                    return;
                __VLS_ctx.showStartModal = false;
                // @ts-ignore
                [submitting, submitting, showStartModal, showStartModal,];
            } },
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showStartModal))
                    return;
                __VLS_ctx.showStartModal = false;
                // @ts-ignore
                [showStartModal,];
            } },
        ...{ class: "btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "session-status" },
    });
    /** @type {__VLS_StyleScopedClasses['session-status']} */ ;
    if (__VLS_ctx.startingStatus === 'starting') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "status-starting" },
        });
        /** @type {__VLS_StyleScopedClasses['status-starting']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "loading-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['loading-icon']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
        (__VLS_ctx.currentJobId);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "progress-bar-container" },
        });
        /** @type {__VLS_StyleScopedClasses['progress-bar-container']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "progress-bar-fill" },
            ...{ style: ({ width: __VLS_ctx.startProgress + '%' }) },
        });
        /** @type {__VLS_StyleScopedClasses['progress-bar-fill']} */ ;
    }
    else if (__VLS_ctx.startingStatus === 'ready') {
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
        __VLS_asFunctionalElement1(__VLS_intrinsics.h5, __VLS_intrinsics.h5)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "info-grid" },
        });
        /** @type {__VLS_StyleScopedClasses['info-grid']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "info-item" },
        });
        /** @type {__VLS_StyleScopedClasses['info-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "info-label" },
        });
        /** @type {__VLS_StyleScopedClasses['info-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "info-value" },
        });
        /** @type {__VLS_StyleScopedClasses['info-value']} */ ;
        (__VLS_ctx.selectedSession?.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "info-item" },
        });
        /** @type {__VLS_StyleScopedClasses['info-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "info-label" },
        });
        /** @type {__VLS_StyleScopedClasses['info-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "info-value" },
        });
        /** @type {__VLS_StyleScopedClasses['info-value']} */ ;
        (__VLS_ctx.selectedSession?.type);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "info-item" },
        });
        /** @type {__VLS_StyleScopedClasses['info-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "info-label" },
        });
        /** @type {__VLS_StyleScopedClasses['info-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "info-value" },
        });
        /** @type {__VLS_StyleScopedClasses['info-value']} */ ;
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
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "info-value" },
        });
        /** @type {__VLS_StyleScopedClasses['info-value']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
        (__VLS_ctx.sessionCredentials.vncPort);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "credentials-section" },
        });
        /** @type {__VLS_StyleScopedClasses['credentials-section']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.h5, __VLS_intrinsics.h5)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "credential-item" },
        });
        /** @type {__VLS_StyleScopedClasses['credential-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "credential-value" },
        });
        /** @type {__VLS_StyleScopedClasses['credential-value']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
        (__VLS_ctx.sessionCredentials.username);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showStartModal))
                        return;
                    if (!!(__VLS_ctx.startingStatus === 'starting'))
                        return;
                    if (!(__VLS_ctx.startingStatus === 'ready'))
                        return;
                    __VLS_ctx.copyToClipboard(__VLS_ctx.sessionCredentials.username);
                    // @ts-ignore
                    [startingStatus, startingStatus, currentJobId, startProgress, selectedSession, selectedSession, selectedSession, sessionCredentials, sessionCredentials, sessionCredentials, copyToClipboard,];
                } },
            ...{ class: "btn-copy" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-copy']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "credential-item" },
        });
        /** @type {__VLS_StyleScopedClasses['credential-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "credential-value" },
        });
        /** @type {__VLS_StyleScopedClasses['credential-value']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
        (__VLS_ctx.showPassword ? __VLS_ctx.sessionCredentials.password : '••••••••••••');
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.togglePassword) },
            ...{ class: "btn-copy" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-copy']} */ ;
        (__VLS_ctx.showPassword ? '👁️' : '👁️‍🗨️');
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showStartModal))
                        return;
                    if (!!(__VLS_ctx.startingStatus === 'starting'))
                        return;
                    if (!(__VLS_ctx.startingStatus === 'ready'))
                        return;
                    __VLS_ctx.copyToClipboard(__VLS_ctx.sessionCredentials.password);
                    // @ts-ignore
                    [sessionCredentials, sessionCredentials, copyToClipboard, showPassword, showPassword, togglePassword,];
                } },
            ...{ class: "btn-copy" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-copy']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "credential-note" },
        });
        /** @type {__VLS_StyleScopedClasses['credential-note']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "note-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['note-icon']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "connection-methods" },
        });
        /** @type {__VLS_StyleScopedClasses['connection-methods']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.h5, __VLS_intrinsics.h5)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "method-list" },
        });
        /** @type {__VLS_StyleScopedClasses['method-list']} */ ;
        if (__VLS_ctx.selectedSession?.protocol === 'vnc') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "method-item" },
            });
            /** @type {__VLS_StyleScopedClasses['method-item']} */ ;
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
            __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
                href: (__VLS_ctx.sessionCredentials.webUrl),
                target: "_blank",
            });
            (__VLS_ctx.sessionCredentials.webUrl);
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.openInBrowser) },
                ...{ class: "btn-secondary" },
            });
            /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "method-item" },
            });
            /** @type {__VLS_StyleScopedClasses['method-item']} */ ;
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
            (__VLS_ctx.selectedSession?.address);
            (__VLS_ctx.sessionCredentials.vncPort);
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.downloadVNCFile) },
                ...{ class: "btn-secondary" },
            });
            /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
        }
        else if (__VLS_ctx.selectedSession?.protocol === 'rdp') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "method-item" },
            });
            /** @type {__VLS_StyleScopedClasses['method-item']} */ ;
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
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "connection-string" },
            });
            /** @type {__VLS_StyleScopedClasses['connection-string']} */ ;
            (__VLS_ctx.selectedSession?.address);
            (__VLS_ctx.sessionCredentials.rdpPort);
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.downloadRDPFile) },
                ...{ class: "btn-secondary" },
            });
            /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "method-item" },
            });
            /** @type {__VLS_StyleScopedClasses['method-item']} */ ;
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
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "connection-string" },
            });
            /** @type {__VLS_StyleScopedClasses['connection-string']} */ ;
            (__VLS_ctx.selectedSession?.address);
            (__VLS_ctx.sessionCredentials.rdpPort);
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.copyRDPConnection) },
                ...{ class: "btn-secondary" },
            });
            /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "method-item" },
            });
            /** @type {__VLS_StyleScopedClasses['method-item']} */ ;
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
            __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
                href: (__VLS_ctx.sessionCredentials.guacamoleUrl),
                target: "_blank",
            });
            (__VLS_ctx.sessionCredentials.guacamoleUrl);
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.openGuacamole) },
                ...{ class: "btn-secondary" },
            });
            /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "modal-actions" },
        });
        /** @type {__VLS_StyleScopedClasses['modal-actions']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.stopSession) },
            ...{ class: "btn-danger" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-danger']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showStartModal))
                        return;
                    if (!!(__VLS_ctx.startingStatus === 'starting'))
                        return;
                    if (!(__VLS_ctx.startingStatus === 'ready'))
                        return;
                    __VLS_ctx.showStartModal = false;
                    // @ts-ignore
                    [showStartModal, selectedSession, selectedSession, selectedSession, selectedSession, selectedSession, sessionCredentials, sessionCredentials, sessionCredentials, sessionCredentials, sessionCredentials, sessionCredentials, sessionCredentials, openInBrowser, downloadVNCFile, downloadRDPFile, copyRDPConnection, openGuacamole, stopSession,];
                } },
            ...{ class: "btn-secondary" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
