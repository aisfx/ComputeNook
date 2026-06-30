/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import axios from 'axios';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import notification from '../utils/notification';
import { getApiBase, getWsBase } from '../utils/auth';
let tabIdSeq = 0;
const tabs = ref([]);
const activeTabId = ref(-1);
const tabTerminalRefs = new Map();
const activeTab = computed(() => tabs.value.find(t => t.id === activeTabId.value) ?? null);
// 用于 :ref 动态绑定每个 tab 的 xterm 容器
const setTabTerminalRef = (id, el) => {
    if (el)
        tabTerminalRefs.set(id, el);
    else
        tabTerminalRefs.delete(id);
};
const createTab = (node, pendingCmd = '') => {
    const tab = {
        id: ++tabIdSeq,
        node,
        websocket: null,
        terminal: null,
        fitAddon: null,
        connected: false,
        status: 'connecting',
        pendingCmd,
    };
    tabs.value.push(tab);
    activeTabId.value = tab.id;
    return tab;
};
const switchTab = (id) => {
    activeTabId.value = id;
    nextTick(() => {
        const tab = tabs.value.find(t => t.id === id);
        if (tab?.fitAddon)
            tab.fitAddon.fit();
    });
};
const newTab = () => {
    // 打开认证选择器，连接后会创建新 tab
    if (!selectedNode.value && nodes.value.length > 0)
        selectedNode.value = nodes.value[0];
    showAuthSelector.value = true;
};
const closeTab = (id) => {
    const tab = tabs.value.find(t => t.id === id);
    if (!tab)
        return;
    tab.websocket?.close();
    tab.terminal?.dispose();
    tabTerminalRefs.delete(id);
    tabs.value = tabs.value.filter(t => t.id !== id);
    if (activeTabId.value === id) {
        activeTabId.value = tabs.value[tabs.value.length - 1]?.id ?? -1;
    }
};
const clearTab = (id) => {
    tabs.value.find(t => t.id === id)?.terminal?.clear();
};
const disconnectTab = (id) => {
    const tab = tabs.value.find(t => t.id === id);
    if (!tab)
        return;
    tab.websocket?.close();
    tab.terminal?.dispose();
    tab.terminal = null;
    tab.websocket = null;
    tab.connected = false;
    tab.status = 'disconnected';
    isFullscreen.value = false;
    sidebarCollapsed.value = false;
};
// 兼容旧代码引用
const connected = computed(() => activeTab.value?.connected ?? false);
const connectionStatus = computed(() => activeTab.value?.status ?? 'disconnected');
const currentNode = computed(() => activeTab.value?.node ?? null);
// 响应式数据
const showNodeSelector = ref(false);
const showAuthSelector = ref(false);
const showPasswordInput = ref(false);
const showSessions = ref(false);
const showLogs = ref(false);
const showKeyUpload = ref(false);
// MFA 弹窗
const showMFAInput = ref(false);
const mfaCodeInput = ref('');
const pendingNode = ref(null);
const pendingPassword = ref('');
// 缓存 MFA 状态，避免每次连接都请求（组件挂载时重置）
const mfaStatusCache = ref(null);
const loadMFAStatus = async (forceRefresh = false) => {
    if (!forceRefresh && mfaStatusCache.value !== null)
        return mfaStatusCache.value;
    try {
        const res = await axios.get('/mfa/status');
        mfaStatusCache.value = res.data.data;
    }
    catch (_) {
        mfaStatusCache.value = { mode: 'false', enabled: false, confirmed: false };
    }
    return mfaStatusCache.value;
};
const keyTab = ref('generate');
const generatingKey = ref(false);
const generatedPubKey = ref('');
const showSettings = ref(false);
const loading = ref(false);
const error = ref('');
// connected / connectionStatus / currentNode 已改为 computed，见上方
const sidebarCollapsed = ref(false);
const isFullscreen = ref(false);
const nodes = ref([]);
const selectedNode = ref(null);
const currentUsername = ref('');
const hasPrivateKey = ref(false);
const sshPassword = ref('');
// 终端设置
const terminalSettings = ref({
    fontSize: 14,
    theme: 'dark',
    cursorStyle: 'block',
    cursorBlink: true
});
// 配色方案
const themes = [
    {
        name: 'dark',
        background: '#1e1e1e',
        foreground: '#ffffff',
        cursor: '#ffffff',
        black: '#000000',
        red: '#e06c75',
        green: '#98c379',
        yellow: '#d19a66',
        blue: '#61afef',
        magenta: '#c678dd',
        cyan: '#56b6c2',
        white: '#abb2bf',
        brightBlack: '#5c6370',
        brightRed: '#e06c75',
        brightGreen: '#98c379',
        brightYellow: '#d19a66',
        brightBlue: '#61afef',
        brightMagenta: '#c678dd',
        brightCyan: '#56b6c2',
        brightWhite: '#ffffff'
    },
    {
        name: 'light',
        background: '#ffffff',
        foreground: '#000000',
        cursor: '#000000',
        black: '#000000',
        red: '#cd3131',
        green: '#00bc00',
        yellow: '#949800',
        blue: '#0451a5',
        magenta: '#bc05bc',
        cyan: '#0598bc',
        white: '#555555',
        brightBlack: '#666666',
        brightRed: '#cd3131',
        brightGreen: '#14ce14',
        brightYellow: '#b5ba00',
        brightBlue: '#0451a5',
        brightMagenta: '#bc05bc',
        brightCyan: '#0598bc',
        brightWhite: '#a5a5a5'
    },
    {
        name: 'monokai',
        background: '#272822',
        foreground: '#f8f8f2',
        cursor: '#f8f8f0',
        black: '#272822',
        red: '#f92672',
        green: '#a6e22e',
        yellow: '#f4bf75',
        blue: '#66d9ef',
        magenta: '#ae81ff',
        cyan: '#a1efe4',
        white: '#f8f8f2',
        brightBlack: '#75715e',
        brightRed: '#f92672',
        brightGreen: '#a6e22e',
        brightYellow: '#f4bf75',
        brightBlue: '#66d9ef',
        brightMagenta: '#ae81ff',
        brightCyan: '#a1efe4',
        brightWhite: '#f9f8f5'
    },
    {
        name: 'solarized-dark',
        background: '#002b36',
        foreground: '#839496',
        cursor: '#839496',
        black: '#073642',
        red: '#dc322f',
        green: '#859900',
        yellow: '#b58900',
        blue: '#268bd2',
        magenta: '#d33682',
        cyan: '#2aa198',
        white: '#eee8d5',
        brightBlack: '#002b36',
        brightRed: '#cb4b16',
        brightGreen: '#586e75',
        brightYellow: '#657b83',
        brightBlue: '#839496',
        brightMagenta: '#6c71c4',
        brightCyan: '#93a1a1',
        brightWhite: '#fdf6e3'
    },
    {
        name: 'dracula',
        background: '#282a36',
        foreground: '#f8f8f2',
        cursor: '#f8f8f2',
        black: '#21222c',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#bd93f9',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#f8f8f2',
        brightBlack: '#6272a4',
        brightRed: '#ff6e6e',
        brightGreen: '#69ff94',
        brightYellow: '#ffffa5',
        brightBlue: '#d6acff',
        brightMagenta: '#ff92df',
        brightCyan: '#a4ffff',
        brightWhite: '#ffffff'
    },
    {
        name: 'nord',
        background: '#2e3440',
        foreground: '#d8dee9',
        cursor: '#d8dee9',
        black: '#3b4252',
        red: '#bf616a',
        green: '#a3be8c',
        yellow: '#ebcb8b',
        blue: '#81a1c1',
        magenta: '#b48ead',
        cyan: '#88c0d0',
        white: '#e5e9f0',
        brightBlack: '#4c566a',
        brightRed: '#bf616a',
        brightGreen: '#a3be8c',
        brightYellow: '#ebcb8b',
        brightBlue: '#81a1c1',
        brightMagenta: '#b48ead',
        brightCyan: '#8fbcbb',
        brightWhite: '#eceff4'
    }
];
const cursorStyles = ['block', 'underline', 'bar'];
// 终端相关（多 tab 后不再使用单例，保留 pendingInitCommand 供 autoConnect 用）
const terminalContainer = ref();
const passwordInput = ref();
let terminal = null;
let fitAddon = null;
let websocket = null;
const pendingInitCommand = ref('');
// 初始化
onMounted(async () => {
    // 每次挂载重置 MFA 缓存，防止退出再登录时用到旧用户的状态
    mfaStatusCache.value = null;
    // 加载保存的设置
    loadSettings();
    await loadCurrentUser();
    await loadNodes();
    await checkPrivateKey();
    // 检查是否有来自"进入容器"的自动连接请求
    const autoConnectRaw = sessionStorage.getItem('webshell_auto_connect');
    if (autoConnectRaw) {
        sessionStorage.removeItem('webshell_auto_connect');
        try {
            const { node: nodeName, initCommand } = JSON.parse(autoConnectRaw);
            // 找到对应节点对象
            const targetNode = nodes.value.find((n) => n.name === nodeName);
            if (targetNode) {
                // 连接后自动发送进入容器命令
                pendingInitCommand.value = initCommand;
                connectToNode(targetNode);
            }
        }
        catch { /* ignore */ }
    }
});
// 清理（仅在组件真正销毁时执行，keep-alive切换页面时不会触发）
onBeforeUnmount(() => {
    tabs.value.forEach(tab => {
        tab.websocket?.close();
        tab.terminal?.dispose();
    });
    tabs.value = [];
    if (sshTunnelHeartbeat)
        clearInterval(sshTunnelHeartbeat);
    window.removeEventListener('resize', handleResize);
});
// 加载设置
const loadSettings = () => {
    const saved = localStorage.getItem('terminal-settings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            terminalSettings.value = { ...terminalSettings.value, ...settings };
        }
        catch (e) {
            console.error('Failed to load settings:', e);
        }
    }
};
// 保存设置
const saveSettings = () => {
    localStorage.setItem('terminal-settings', JSON.stringify(terminalSettings.value));
};
// 选择主题
const selectTheme = (themeName) => {
    terminalSettings.value.theme = themeName;
    applyTerminalSettings();
};
// 选择光标样式
const selectCursorStyle = (style) => {
    terminalSettings.value.cursorStyle = style;
    applyTerminalSettings();
};
// 应用终端设置（作用于所有 tab）
const applyTerminalSettings = () => {
    const theme = themes.find(t => t.name === terminalSettings.value.theme);
    tabs.value.forEach(tab => {
        if (!tab.terminal)
            return;
        if (theme) {
            tab.terminal.options.theme = {
                background: theme.background, foreground: theme.foreground, cursor: theme.cursor,
                selectionBackground: 'rgba(255, 255, 255, 0.3)',
                black: theme.black, red: theme.red, green: theme.green, yellow: theme.yellow,
                blue: theme.blue, magenta: theme.magenta, cyan: theme.cyan, white: theme.white,
                brightBlack: theme.brightBlack, brightRed: theme.brightRed, brightGreen: theme.brightGreen,
                brightYellow: theme.brightYellow, brightBlue: theme.brightBlue, brightMagenta: theme.brightMagenta,
                brightCyan: theme.brightCyan, brightWhite: theme.brightWhite,
            };
        }
        tab.terminal.options.fontSize = terminalSettings.value.fontSize;
        tab.terminal.options.cursorStyle = terminalSettings.value.cursorStyle;
        tab.terminal.options.cursorBlink = terminalSettings.value.cursorBlink;
        tab.fitAddon?.fit();
    });
    saveSettings();
};
// 重置设置
const resetSettings = () => {
    terminalSettings.value = {
        fontSize: 14,
        theme: 'dark',
        cursorStyle: 'block',
        cursorBlink: true
    };
    applyTerminalSettings();
};
// 加载当前用户信息
const loadCurrentUser = async () => {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            console.warn('No token found, user not logged in');
            currentUsername.value = 'unknown';
            notification.warning('请先登录系统');
            return;
        }
        const response = await fetch(`${getApiBase()}/api/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (response.ok) {
            const result = await response.json();
            // 后端返回格式: {"data": {"username": "sunfx", "uid": 1001, ...}}
            if (result.data) {
                // 优先使用 username 字段（小写）
                if (result.data.username) {
                    currentUsername.value = result.data.username;
                }
                // 兼容大写的 Username 字段
                else if (result.data.Username) {
                    currentUsername.value = result.data.Username;
                }
                else {
                    currentUsername.value = 'unknown';
                }
            }
            else {
                currentUsername.value = 'unknown';
            }
        }
        else {
            const errorText = await response.text();
            if (response.status === 401) {
                notification.error('登录已过期，请重新登录');
                currentUsername.value = 'unknown';
            }
            else {
                currentUsername.value = 'unknown';
            }
        }
    }
    catch (err) {
        console.error('Failed to load user info:', err);
        currentUsername.value = 'unknown';
    }
};
// 检查是否已上传私钥
const checkPrivateKey = async () => {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            hasPrivateKey.value = false;
            return;
        }
        const response = await fetch(`${getApiBase()}/api/webshell/keys/check`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (response.ok) {
            const data = await response.json();
            hasPrivateKey.value = data.has_key || false;
        }
    }
    catch (err) {
        hasPrivateKey.value = false;
    }
};
// 加载节点列表
const loadNodes = async () => {
    loading.value = true;
    error.value = '';
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            throw new Error('请先登录系统');
        }
        const response = await fetch(`${getApiBase()}/api/webshell/nodes`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to load nodes');
        }
        const data = await response.json();
        nodes.value = data.data || [];
    }
    catch (err) {
        error.value = err.message;
        notification.error('加载节点列表失败: ' + err.message);
    }
    finally {
        loading.value = false;
    }
};
// SSH 隧道信息弹窗
const showTunnelInfo = ref(false);
const tunnelNode = ref(null);
const tunnelLocalPort = ref(12222);
const tunnelUser = ref('');
const sshTunnelStatus = ref({});
let sshTunnelHeartbeat = null;
// 当前已连接隧道的节点（用于显示提示条）
const activeTunnelNode = computed(() => {
    const connectedName = Object.keys(sshTunnelStatus.value).find(k => sshTunnelStatus.value[k] === 'connected');
    if (!connectedName)
        return null;
    const node = nodes.value.find((n) => n.name === connectedName);
    return node ? { ...node, user: currentUsername.value || node.name } : null;
});
const copyTunnelSshCmd = () => {
    if (!activeTunnelNode.value)
        return;
    const cmd = `ssh ${activeTunnelNode.value.user}@localhost -p ${tunnelLocalPort.value}`;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(cmd).then(() => notification.success('命令已复制'));
    }
    else {
        fallbackCopy(cmd);
    }
};
// 通过隐藏 <a> 触发自定义协议，兼容浏览器弹出"打开应用"对话框
const triggerProtocolUri = (uri) => {
    const a = document.createElement('a');
    a.href = uri;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 1000);
};
// SSH 隧道心跳检测
const startSshTunnelHeartbeat = (nodeName, localPort) => {
    if (sshTunnelHeartbeat)
        clearInterval(sshTunnelHeartbeat);
    sshTunnelHeartbeat = setInterval(async () => {
        if (sshTunnelStatus.value[nodeName] !== 'connected') {
            clearInterval(sshTunnelHeartbeat);
            return;
        }
        try {
            const ws = new WebSocket(`ws://localhost:${localPort}/`);
            await new Promise((resolve, reject) => {
                const t = setTimeout(() => { ws.close(); reject(); }, 1500);
                ws.onopen = () => { clearTimeout(t); ws.close(); resolve(); };
                ws.onerror = () => { clearTimeout(t); reject(); };
            });
        }
        catch {
            sshTunnelStatus.value = { [nodeName]: 'disconnected' };
            clearInterval(sshTunnelHeartbeat);
        }
    }, 8000);
};
// 点击隧道按钮：直接拉起 hpcc:// 协议（同一时间只允许一个节点建立隧道）
const launchSSHTunnel = (node) => {
    const nodeName = node.name;
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    // 断开所有其他节点的隧道（包括当前节点自身如果已连接）
    Object.keys(sshTunnelStatus.value).forEach(name => {
        const st = sshTunnelStatus.value[name];
        if (st === 'connected' || st === 'disconnected' || st === 'connecting') {
            const otherNode = nodes.value.find((n) => n.name === name);
            if (otherNode) {
                triggerProtocolUri(`hpcc://disconnect?server=${encodeURIComponent(location.origin)}&token=${encodeURIComponent(token)}&host=${encodeURIComponent(otherNode.host || otherNode.name)}`);
            }
        }
    });
    // 重置所有节点状态为 idle
    sshTunnelStatus.value = {};
    if (sshTunnelHeartbeat) {
        clearInterval(sshTunnelHeartbeat);
        sshTunnelHeartbeat = null;
    }
    const user = currentUsername.value || '';
    const localPort = 12222;
    const sshPort = node.port || 22;
    const uri = `hpcc://ssh?server=${encodeURIComponent(location.origin)}&token=${encodeURIComponent(token)}&host=${encodeURIComponent(node.host || node.name)}&port=${localPort}&ssh-port=${sshPort}&user=${encodeURIComponent(user)}`;
    triggerProtocolUri(uri);
    sshTunnelStatus.value = { [nodeName]: 'connecting' };
    setTimeout(() => {
        if (sshTunnelStatus.value[nodeName] === 'connecting') {
            sshTunnelStatus.value = { [nodeName]: 'connected' };
            startSshTunnelHeartbeat(nodeName, localPort);
        }
    }, 5000);
};
// 保留弹窗里的启动函数（兼容弹窗内调用）
const doLaunchTunnel = () => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    const node = tunnelNode.value;
    if (!node)
        return;
    const sshPort = node.port || 22;
    const uri = `hpcc://ssh?server=${encodeURIComponent(location.origin)}&token=${encodeURIComponent(token)}&host=${encodeURIComponent(node.host || node.name)}&port=${tunnelLocalPort.value}&ssh-port=${sshPort}&user=${encodeURIComponent(tunnelUser.value)}`;
    triggerProtocolUri(uri);
};
const copySshCmd = () => {
    const cmd = `ssh -p ${tunnelLocalPort.value} ${tunnelUser.value}@localhost`;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(cmd).then(() => notification.success('命令已复制')).catch(() => fallbackCopy(cmd));
    }
    else {
        fallbackCopy(cmd);
    }
};
const fallbackCopy = (text) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    notification.success('命令已复制');
};
// 选择节点
const selectNode = async (node) => {
    selectedNode.value = node;
    // 确保用户信息已加载
    if (!currentUsername.value || currentUsername.value === 'unknown') {
        await loadCurrentUser();
    }
    // 显示认证方式选择对话框
    showAuthSelector.value = true;
};
// 使用私钥认证
const usePrivateKey = () => {
    if (!hasPrivateKey.value) {
        notification.error('请先上传SSH私钥');
        showAuthSelector.value = false;
        showKeyUpload.value = true;
        return;
    }
    showAuthSelector.value = false;
    connectToNode(selectedNode.value, '');
};
// 使用密码认证
const usePassword = () => {
    showAuthSelector.value = false;
    showPasswordInput.value = true;
    sshPassword.value = '';
    // 聚焦到密码输入框
    nextTick(() => {
        passwordInput.value?.focus();
    });
};
// 使用密码连接
const connectWithPassword = () => {
    if (!sshPassword.value) {
        notification.error('请输入密码');
        return;
    }
    showPasswordInput.value = false;
    connectToNode(selectedNode.value, sshPassword.value);
    sshPassword.value = ''; // 清空密码
};
// MFA 验证后连接
const confirmMFAAndConnect = () => {
    if (mfaCodeInput.value.length !== 6)
        return;
    showMFAInput.value = false;
    const code = mfaCodeInput.value;
    const node = pendingNode.value;
    const pwd = pendingPassword.value;
    mfaCodeInput.value = '';
    pendingNode.value = null;
    pendingPassword.value = '';
    connectToNode(node, pwd, code);
};
// 连接到节点（创建新 tab）
const connectToNode = async (node, password = '', mfaCode = '') => {
    if (!currentUsername.value || currentUsername.value === 'unknown') {
        await loadCurrentUser();
    }
    if (!mfaCode) {
        const status = await loadMFAStatus();
        if (status && status.mode !== 'false' && status.enabled && status.confirmed) {
            pendingNode.value = node;
            pendingPassword.value = password;
            mfaCodeInput.value = '';
            showMFAInput.value = true;
            return;
        }
    }
    const tab = createTab(node, pendingInitCommand.value);
    pendingInitCommand.value = '';
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            notification.error('请先登录系统');
            return;
        }
        let wsUrl = `${getWsBase()}/api/webshell/connect?node=${node.name}&token=${encodeURIComponent(token)}`;
        if (password)
            wsUrl += `&password=${encodeURIComponent(password)}`;
        if (mfaCode)
            wsUrl += `&mfaCode=${encodeURIComponent(mfaCode)}`;
        const ws = new WebSocket(wsUrl);
        tab.websocket = ws;
        ws.onopen = () => {
            tab.status = 'connected';
            tab.connected = true;
            nextTick(() => {
                initTabTerminal(tab);
                if (tab.pendingCmd) {
                    const cmd = tab.pendingCmd;
                    tab.pendingCmd = '';
                    setTimeout(() => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'input', data: cmd }));
                        }
                    }, 800);
                }
            });
        };
        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            handleTabMessage(tab, message);
        };
        ws.onclose = () => {
            tab.status = 'disconnected';
            tab.connected = false;
            tab.terminal?.dispose();
            tab.terminal = null;
            tab.websocket = null;
            window.removeEventListener('resize', handleResize);
        };
        ws.onerror = () => {
            tab.status = 'error';
            notification.error('连接错误');
            tab.websocket = null;
        };
    }
    catch (err) {
        tab.status = 'error';
        notification.error('连接失败: ' + err.message);
    }
};
// 初始化指定 tab 的终端
const initTabTerminal = (tab) => {
    const container = tabTerminalRefs.get(tab.id);
    if (!container)
        return;
    const theme = themes.find(t => t.name === terminalSettings.value.theme) || themes[0];
    const term = new Terminal({
        cursorBlink: terminalSettings.value.cursorBlink,
        cursorStyle: terminalSettings.value.cursorStyle,
        fontSize: terminalSettings.value.fontSize,
        fontFamily: 'Consolas, "Courier New", monospace',
        theme: {
            background: theme.background, foreground: theme.foreground, cursor: theme.cursor,
            selectionBackground: 'rgba(255, 255, 255, 0.3)',
            black: theme.black, red: theme.red, green: theme.green, yellow: theme.yellow,
            blue: theme.blue, magenta: theme.magenta, cyan: theme.cyan, white: theme.white,
            brightBlack: theme.brightBlack, brightRed: theme.brightRed, brightGreen: theme.brightGreen,
            brightYellow: theme.brightYellow, brightBlue: theme.brightBlue, brightMagenta: theme.brightMagenta,
            brightCyan: theme.brightCyan, brightWhite: theme.brightWhite,
        },
        allowProposedApi: true,
    });
    const fa = new FitAddon();
    term.loadAddon(fa);
    term.loadAddon(new WebLinksAddon());
    container.innerHTML = '';
    term.open(container);
    fa.fit();
    tab.terminal = term;
    tab.fitAddon = fa;
    window.addEventListener('resize', handleResize);
    term.onData((data) => {
        if (tab.websocket?.readyState === WebSocket.OPEN) {
            tab.websocket.send(JSON.stringify({ type: 'input', data }));
        }
    });
    if (tab.websocket?.readyState === WebSocket.OPEN) {
        tab.websocket.send(JSON.stringify({ type: 'resize', data: { rows: term.rows, cols: term.cols } }));
    }
};
// 兼容旧名称（handleResize 里用到）
const initTerminal = () => {
    const tab = activeTab.value;
    if (tab)
        initTabTerminal(tab);
};
// 处理窗口大小变化
const handleResize = () => {
    tabs.value.forEach(tab => {
        if (tab.fitAddon && tab.terminal) {
            tab.fitAddon.fit();
            if (tab.websocket?.readyState === WebSocket.OPEN) {
                tab.websocket.send(JSON.stringify({ type: 'resize', data: { rows: tab.terminal.rows, cols: tab.terminal.cols } }));
            }
        }
    });
};
// 处理指定 tab 的 WebSocket 消息
const handleTabMessage = (tab, message) => {
    switch (message.type) {
        case 'output':
            if (tab.terminal && message.data)
                tab.terminal.write(message.data);
            break;
        case 'connected':
            tab.status = 'connected';
            tab.connected = true;
            if (message.data?.username)
                currentUsername.value = message.data.username;
            break;
        case 'auth_required':
            notification.warning('需要密码认证，请输入SSH密码');
            showPasswordInput.value = true;
            nextTick(() => { passwordInput.value?.focus(); });
            break;
        case 'error':
            if (typeof message.data === 'string' &&
                (message.data.includes('unable to authenticate') ||
                    message.data.includes('no supported methods') ||
                    message.data.includes('handshake failed'))) {
                notification.warning('密钥认证失败，请使用密码连接');
                tab.status = 'disconnected';
                tab.connected = false;
                showPasswordInput.value = true;
                nextTick(() => { passwordInput.value?.focus(); });
            }
            else {
                notification.error(message.data);
                tab.status = 'error';
            }
            break;
    }
};
// 兼容旧 handleWebSocketMessage 引用
const handleWebSocketMessage = (message) => {
    const tab = activeTab.value;
    if (tab)
        handleTabMessage(tab, message);
};
// 切换全屏
const toggleFullscreen = () => {
    isFullscreen.value = !isFullscreen.value;
    if (isFullscreen.value)
        sidebarCollapsed.value = true;
    setTimeout(() => {
        tabs.value.forEach(tab => {
            if (tab.fitAddon && tab.terminal) {
                tab.fitAddon.fit();
                if (tab.websocket?.readyState === WebSocket.OPEN) {
                    tab.websocket.send(JSON.stringify({ type: 'resize', data: { rows: tab.terminal.rows, cols: tab.terminal.cols } }));
                }
            }
        });
    }, 100);
};
// 测试连接
const testConnection = async (node) => {
    try {
        const response = await fetch(`/api/webshell/nodes/${node.name}/test`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });
        const data = await response.json();
        if (data.success) {
            notification.success(`${node.name} 连接测试成功`);
        }
        else {
            notification.error(`${node.name} 连接测试失败: ${data.error}`);
        }
    }
    catch (err) {
        notification.error(`连接测试失败: ${err.message}`);
    }
};
// 处理密钥上传
const handleKeyUpload = async (event) => {
    const target = event.target;
    const file = target.files?.[0];
    if (!file)
        return;
    const formData = new FormData();
    formData.append('private_key', file);
    try {
        const response = await fetch('/api/webshell/keys/upload', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}` },
            body: formData
        });
        if (response.ok) {
            notification.success('SSH私钥上传成功');
            showKeyUpload.value = false;
            hasPrivateKey.value = true;
        }
        else {
            const data = await response.json();
            notification.error('上传失败: ' + data.error);
        }
    }
    catch (err) {
        notification.error('上传失败: ' + err.message);
    }
};
// 生成密钥对
const generateKey = async () => {
    generatingKey.value = true;
    generatedPubKey.value = '';
    try {
        const res = await fetch('/api/webshell/keys/generate', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error);
        generatedPubKey.value = data.public_key;
        hasPrivateKey.value = true;
        notification.success('密钥生成成功');
        // 自动弹出部署密码框
        showDeployModal.value = true;
        deployTargetNode.value = nodes.value[0]?.name || '';
        deployPassword.value = '';
        deployError.value = '';
        deploySuccess.value = '';
    }
    catch (err) {
        notification.error('生成失败: ' + err.message);
    }
    finally {
        generatingKey.value = false;
    }
};
const copyPubKey = () => {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(generatedPubKey.value).then(() => notification.success('公钥已复制')).catch(() => fallbackCopy(generatedPubKey.value));
    }
    else {
        fallbackCopy(generatedPubKey.value);
    }
};
// 部署公钥到节点
const showDeployModal = ref(false);
const deployTargetNode = ref('');
const deployPassword = ref('');
const deployError = ref('');
const deploySuccess = ref('');
const deploying = ref(false);
const deployPublicKey = async (nodeName) => {
    if (!deployPassword.value) {
        deployError.value = '请输入密码';
        return;
    }
    deploying.value = true;
    deployError.value = '';
    deploySuccess.value = '';
    try {
        const res = await fetch('/api/webshell/keys/deploy', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ node_name: nodeName, password: deployPassword.value })
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error);
        deploySuccess.value = data.message;
        deployPassword.value = '';
        setTimeout(() => { showDeployModal.value = false; }, 1500);
    }
    catch (err) {
        deployError.value = err.message;
    }
    finally {
        deploying.value = false;
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
/** @type {__VLS_StyleScopedClasses['hosts-sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar-header']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['host-item']} */ ;
/** @type {__VLS_StyleScopedClasses['host-item']} */ ;
/** @type {__VLS_StyleScopedClasses['host-item']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled']} */ ;
/** @type {__VLS_StyleScopedClasses['host-item']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-tunnel']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-tunnel']} */ ;
/** @type {__VLS_StyleScopedClasses['tunnel-tip-cmd']} */ ;
/** @type {__VLS_StyleScopedClasses['tunnel-tip-copy']} */ ;
/** @type {__VLS_StyleScopedClasses['tunnel-banner-copy']} */ ;
/** @type {__VLS_StyleScopedClasses['tunnel-step-body']} */ ;
/** @type {__VLS_StyleScopedClasses['ssh-cmd-box']} */ ;
/** @type {__VLS_StyleScopedClasses['host-status']} */ ;
/** @type {__VLS_StyleScopedClasses['host-status']} */ ;
/** @type {__VLS_StyleScopedClasses['connected']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['shell-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['shell-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-close']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-new']} */ ;
/** @type {__VLS_StyleScopedClasses['terminal-area']} */ ;
/** @type {__VLS_StyleScopedClasses['connection-status']} */ ;
/** @type {__VLS_StyleScopedClasses['connected']} */ ;
/** @type {__VLS_StyleScopedClasses['connection-status']} */ ;
/** @type {__VLS_StyleScopedClasses['connection-status']} */ ;
/** @type {__VLS_StyleScopedClasses['connection-status']} */ ;
/** @type {__VLS_StyleScopedClasses['term-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['term-btn-danger']} */ ;
/** @type {__VLS_StyleScopedClasses['prompt-content']} */ ;
/** @type {__VLS_StyleScopedClasses['prompt-content']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
/** @type {__VLS_StyleScopedClasses['close-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['node-card']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled']} */ ;
/** @type {__VLS_StyleScopedClasses['node-card']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled']} */ ;
/** @type {__VLS_StyleScopedClasses['node-header']} */ ;
/** @type {__VLS_StyleScopedClasses['node-status']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled']} */ ;
/** @type {__VLS_StyleScopedClasses['upload-zone']} */ ;
/** @type {__VLS_StyleScopedClasses['key-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-copy-small']} */ ;
/** @type {__VLS_StyleScopedClasses['upload-info']} */ ;
/** @type {__VLS_StyleScopedClasses['upload-info']} */ ;
/** @type {__VLS_StyleScopedClasses['upload-info']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-option']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-option']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-option']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-status']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-status']} */ ;
/** @type {__VLS_StyleScopedClasses['password-input-group']} */ ;
/** @type {__VLS_StyleScopedClasses['password-input']} */ ;
/** @type {__VLS_StyleScopedClasses['slider']} */ ;
/** @type {__VLS_StyleScopedClasses['slider']} */ ;
/** @type {__VLS_StyleScopedClasses['theme-card']} */ ;
/** @type {__VLS_StyleScopedClasses['theme-card']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-danger']} */ ;
/** @type {__VLS_StyleScopedClasses['webshell-container']} */ ;
/** @type {__VLS_StyleScopedClasses['header-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['main-workspace']} */ ;
/** @type {__VLS_StyleScopedClasses['hosts-sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['nodes-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
/** @type {__VLS_StyleScopedClasses['terminal-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "webshell-container" },
});
/** @type {__VLS_StyleScopedClasses['webshell-container']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "page-header" },
});
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "header-actions" },
});
/** @type {__VLS_StyleScopedClasses['header-actions']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showSettings = true;
            // @ts-ignore
            [showSettings,];
        } },
    ...{ class: "btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showKeyUpload = true;
            // @ts-ignore
            [showKeyUpload,];
        } },
    ...{ class: "btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
if (__VLS_ctx.activeTunnelNode) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tunnel-banner" },
    });
    /** @type {__VLS_StyleScopedClasses['tunnel-banner']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tunnel-banner-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['tunnel-banner-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tunnel-banner-text" },
    });
    /** @type {__VLS_StyleScopedClasses['tunnel-banner-text']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    (__VLS_ctx.activeTunnelNode.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({
        ...{ class: "tunnel-banner-cmd" },
    });
    /** @type {__VLS_StyleScopedClasses['tunnel-banner-cmd']} */ ;
    (__VLS_ctx.activeTunnelNode.user);
    (__VLS_ctx.tunnelLocalPort);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.copyTunnelSshCmd) },
        ...{ class: "tunnel-banner-copy" },
        title: "复制命令",
    });
    /** @type {__VLS_StyleScopedClasses['tunnel-banner-copy']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tunnel-banner-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['tunnel-banner-hint']} */ ;
    (__VLS_ctx.tunnelLocalPort);
}
if (__VLS_ctx.showAuthSelector) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showAuthSelector))
                    return;
                __VLS_ctx.showAuthSelector = false;
                // @ts-ignore
                [activeTunnelNode, activeTunnelNode, activeTunnelNode, tunnelLocalPort, tunnelLocalPort, copyTunnelSshCmd, showAuthSelector, showAuthSelector,];
            } },
        ...{ class: "modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "modal-content" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showAuthSelector))
                    return;
                __VLS_ctx.showAuthSelector = false;
                // @ts-ignore
                [showAuthSelector,];
            } },
        ...{ class: "close-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['close-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "user-info" },
    });
    /** @type {__VLS_StyleScopedClasses['user-info']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "info-label" },
    });
    /** @type {__VLS_StyleScopedClasses['info-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "info-value" },
    });
    /** @type {__VLS_StyleScopedClasses['info-value']} */ ;
    (__VLS_ctx.currentUsername);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "user-info" },
    });
    /** @type {__VLS_StyleScopedClasses['user-info']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "info-label" },
    });
    /** @type {__VLS_StyleScopedClasses['info-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "info-value" },
    });
    /** @type {__VLS_StyleScopedClasses['info-value']} */ ;
    (__VLS_ctx.selectedNode?.name);
    (__VLS_ctx.selectedNode?.host);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "auth-options" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-options']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (__VLS_ctx.usePrivateKey) },
        ...{ class: "auth-option" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-option']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "auth-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h5, __VLS_intrinsics.h5)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    if (__VLS_ctx.hasPrivateKey) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "auth-status success" },
        });
        /** @type {__VLS_StyleScopedClasses['auth-status']} */ ;
        /** @type {__VLS_StyleScopedClasses['success']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "auth-status warning" },
        });
        /** @type {__VLS_StyleScopedClasses['auth-status']} */ ;
        /** @type {__VLS_StyleScopedClasses['warning']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (__VLS_ctx.usePassword) },
        ...{ class: "auth-option" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-option']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "auth-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h5, __VLS_intrinsics.h5)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
}
if (__VLS_ctx.showPasswordInput) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showPasswordInput))
                    return;
                __VLS_ctx.showPasswordInput = false;
                // @ts-ignore
                [currentUsername, selectedNode, selectedNode, usePrivateKey, hasPrivateKey, usePassword, showPasswordInput, showPasswordInput,];
            } },
        ...{ class: "modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "modal-content" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showPasswordInput))
                    return;
                __VLS_ctx.showPasswordInput = false;
                // @ts-ignore
                [showPasswordInput,];
            } },
        ...{ class: "close-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['close-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "user-info" },
    });
    /** @type {__VLS_StyleScopedClasses['user-info']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "info-label" },
    });
    /** @type {__VLS_StyleScopedClasses['info-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "info-value" },
    });
    /** @type {__VLS_StyleScopedClasses['info-value']} */ ;
    (__VLS_ctx.currentUsername);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "user-info" },
    });
    /** @type {__VLS_StyleScopedClasses['user-info']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "info-label" },
    });
    /** @type {__VLS_StyleScopedClasses['info-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "info-value" },
    });
    /** @type {__VLS_StyleScopedClasses['info-value']} */ ;
    (__VLS_ctx.selectedNode?.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "password-input-group" },
    });
    /** @type {__VLS_StyleScopedClasses['password-input-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onKeyup: (__VLS_ctx.connectWithPassword) },
        type: "password",
        placeholder: "输入SSH密码",
        ...{ class: "password-input" },
        ref: "passwordInput",
    });
    (__VLS_ctx.sshPassword);
    /** @type {__VLS_StyleScopedClasses['password-input']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "input-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['input-hint']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showPasswordInput))
                    return;
                __VLS_ctx.showPasswordInput = false;
                // @ts-ignore
                [currentUsername, selectedNode, showPasswordInput, connectWithPassword, sshPassword,];
            } },
        ...{ class: "btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.connectWithPassword) },
        ...{ class: "btn-primary" },
        disabled: (!__VLS_ctx.sshPassword),
    });
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
}
if (__VLS_ctx.showMFAInput) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "modal-content" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ style: {} },
    });
    (__VLS_ctx.pendingNode?.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "password-input-group" },
    });
    /** @type {__VLS_StyleScopedClasses['password-input-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onKeyup: (__VLS_ctx.confirmMFAAndConnect) },
        type: "text",
        inputmode: "numeric",
        maxlength: "6",
        value: (__VLS_ctx.mfaCodeInput),
        placeholder: "000000",
        ...{ class: "password-input" },
        ...{ style: {} },
        ref: "mfaInput",
    });
    /** @type {__VLS_StyleScopedClasses['password-input']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showMFAInput))
                    return;
                __VLS_ctx.showMFAInput = false;
                __VLS_ctx.mfaCodeInput = '';
                // @ts-ignore
                [connectWithPassword, sshPassword, showMFAInput, showMFAInput, pendingNode, confirmMFAAndConnect, mfaCodeInput, mfaCodeInput,];
            } },
        ...{ class: "btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.confirmMFAAndConnect) },
        ...{ class: "btn-primary" },
        disabled: (__VLS_ctx.mfaCodeInput.length !== 6),
    });
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
}
if (__VLS_ctx.showTunnelInfo) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showTunnelInfo))
                    return;
                __VLS_ctx.showTunnelInfo = false;
                // @ts-ignore
                [confirmMFAAndConnect, mfaCodeInput, showTunnelInfo, showTunnelInfo,];
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showTunnelInfo))
                    return;
                __VLS_ctx.showTunnelInfo = false;
                // @ts-ignore
                [showTunnelInfo,];
            } },
        ...{ class: "close-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['close-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tunnel-step" },
    });
    /** @type {__VLS_StyleScopedClasses['tunnel-step']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tunnel-step-num" },
    });
    /** @type {__VLS_StyleScopedClasses['tunnel-step-num']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tunnel-step-body" },
    });
    /** @type {__VLS_StyleScopedClasses['tunnel-step-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    (__VLS_ctx.tunnelLocalPort);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.doLaunchTunnel) },
        ...{ class: "btn-primary" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showTunnelInfo))
                    return;
                __VLS_ctx.$router.push('/download');
                // @ts-ignore
                [tunnelLocalPort, doLaunchTunnel, $router,];
            } },
        href: "#",
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tunnel-step" },
    });
    /** @type {__VLS_StyleScopedClasses['tunnel-step']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tunnel-step-num" },
    });
    /** @type {__VLS_StyleScopedClasses['tunnel-step-num']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tunnel-step-body" },
    });
    /** @type {__VLS_StyleScopedClasses['tunnel-step-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ssh-cmd-box" },
    });
    /** @type {__VLS_StyleScopedClasses['ssh-cmd-box']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    (__VLS_ctx.tunnelLocalPort);
    (__VLS_ctx.tunnelUser);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.copySshCmd) },
        ...{ class: "btn-copy-small" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-copy-small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    (__VLS_ctx.tunnelLocalPort);
}
if (__VLS_ctx.showKeyUpload) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showKeyUpload))
                    return;
                __VLS_ctx.showKeyUpload = false;
                // @ts-ignore
                [showKeyUpload, showKeyUpload, tunnelLocalPort, tunnelLocalPort, tunnelUser, copySshCmd,];
            } },
        ...{ class: "modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "modal-content" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showKeyUpload))
                    return;
                __VLS_ctx.showKeyUpload = false;
                // @ts-ignore
                [showKeyUpload,];
            } },
        ...{ class: "close-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['close-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "key-tabs" },
    });
    /** @type {__VLS_StyleScopedClasses['key-tabs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showKeyUpload))
                    return;
                __VLS_ctx.keyTab = 'generate';
                // @ts-ignore
                [keyTab,];
            } },
        ...{ class: (['key-tab', { active: __VLS_ctx.keyTab === 'generate' }]) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['key-tab']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showKeyUpload))
                    return;
                __VLS_ctx.keyTab = 'upload';
                // @ts-ignore
                [keyTab, keyTab,];
            } },
        ...{ class: (['key-tab', { active: __VLS_ctx.keyTab === 'upload' }]) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['key-tab']} */ ;
    if (__VLS_ctx.keyTab === 'generate') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.generateKey) },
            ...{ class: "btn-primary" },
            disabled: (__VLS_ctx.generatingKey),
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
        (__VLS_ctx.generatingKey ? '生成中...' : '🔐 一键生成密钥对');
        if (__VLS_ctx.generatedPubKey) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "pubkey-box" },
            });
            /** @type {__VLS_StyleScopedClasses['pubkey-box']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "pubkey-header" },
            });
            /** @type {__VLS_StyleScopedClasses['pubkey-header']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.copyPubKey) },
                ...{ class: "btn-copy-small" },
            });
            /** @type {__VLS_StyleScopedClasses['btn-copy-small']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
                ...{ class: "pubkey-content" },
            });
            /** @type {__VLS_StyleScopedClasses['pubkey-content']} */ ;
            (__VLS_ctx.generatedPubKey);
        }
    }
    if (__VLS_ctx.keyTab === 'upload') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onChange: (__VLS_ctx.handleKeyUpload) },
            type: "file",
            ref: "keyFileInput",
            accept: ".pem,.key,*",
            ...{ style: {} },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showKeyUpload))
                        return;
                    if (!(__VLS_ctx.keyTab === 'upload'))
                        return;
                    __VLS_ctx.$refs.keyFileInput.click();
                    // @ts-ignore
                    [keyTab, keyTab, keyTab, generateKey, generatingKey, generatingKey, generatedPubKey, generatedPubKey, copyPubKey, handleKeyUpload, $refs,];
                } },
            ...{ class: "upload-zone" },
        });
        /** @type {__VLS_StyleScopedClasses['upload-zone']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "upload-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['upload-icon']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "upload-hint" },
        });
        /** @type {__VLS_StyleScopedClasses['upload-hint']} */ ;
    }
}
if (__VLS_ctx.showDeployModal) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showDeployModal))
                    return;
                __VLS_ctx.showDeployModal = false;
                // @ts-ignore
                [showDeployModal, showDeployModal,];
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showDeployModal))
                    return;
                __VLS_ctx.showDeployModal = false;
                // @ts-ignore
                [showDeployModal,];
            } },
        ...{ class: "close-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['close-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    if (__VLS_ctx.deployError) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ style: {} },
        });
        (__VLS_ctx.deployError);
    }
    if (__VLS_ctx.deploySuccess) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ style: {} },
        });
        (__VLS_ctx.deploySuccess);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.deployTargetNode),
        ...{ style: {} },
    });
    for (const [n] of __VLS_vFor((__VLS_ctx.nodes))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (n.name),
            value: (n.name),
        });
        (n.name);
        (n.host);
        // @ts-ignore
        [deployError, deployError, deploySuccess, deploySuccess, deployTargetNode, nodes,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onKeyup: (...[$event]) => {
                if (!(__VLS_ctx.showDeployModal))
                    return;
                __VLS_ctx.deployPublicKey(__VLS_ctx.deployTargetNode);
                // @ts-ignore
                [deployTargetNode, deployPublicKey,];
            } },
        type: "password",
        placeholder: "输入该节点的 SSH 密码",
        ...{ style: {} },
    });
    (__VLS_ctx.deployPassword);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showDeployModal))
                    return;
                __VLS_ctx.showDeployModal = false;
                // @ts-ignore
                [showDeployModal, deployPassword,];
            } },
        ...{ class: "btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showDeployModal))
                    return;
                __VLS_ctx.deployPublicKey(__VLS_ctx.deployTargetNode);
                // @ts-ignore
                [deployTargetNode, deployPublicKey,];
            } },
        ...{ class: "btn-primary" },
        disabled: (__VLS_ctx.deploying || !__VLS_ctx.deployPassword || !__VLS_ctx.deployTargetNode),
    });
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    (__VLS_ctx.deploying ? '部署中...' : '🚀 部署公钥');
}
if (__VLS_ctx.showSettings) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showSettings))
                    return;
                __VLS_ctx.showSettings = false;
                // @ts-ignore
                [showSettings, showSettings, deployTargetNode, deployPassword, deploying, deploying,];
            } },
        ...{ class: "modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "modal-content" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showSettings))
                    return;
                __VLS_ctx.showSettings = false;
                // @ts-ignore
                [showSettings,];
            } },
        ...{ class: "close-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['close-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body settings-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    /** @type {__VLS_StyleScopedClasses['settings-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "setting-group" },
    });
    /** @type {__VLS_StyleScopedClasses['setting-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "setting-label" },
    });
    /** @type {__VLS_StyleScopedClasses['setting-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "setting-control" },
    });
    /** @type {__VLS_StyleScopedClasses['setting-control']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onInput: (__VLS_ctx.applyTerminalSettings) },
        type: "range",
        min: "10",
        max: "24",
        step: "1",
        ...{ class: "slider" },
    });
    (__VLS_ctx.terminalSettings.fontSize);
    /** @type {__VLS_StyleScopedClasses['slider']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "setting-value" },
    });
    /** @type {__VLS_StyleScopedClasses['setting-value']} */ ;
    (__VLS_ctx.terminalSettings.fontSize);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "setting-group" },
    });
    /** @type {__VLS_StyleScopedClasses['setting-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "setting-label" },
    });
    /** @type {__VLS_StyleScopedClasses['setting-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "theme-grid" },
    });
    /** @type {__VLS_StyleScopedClasses['theme-grid']} */ ;
    for (const [theme] of __VLS_vFor((__VLS_ctx.themes))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showSettings))
                        return;
                    __VLS_ctx.selectTheme(theme.name);
                    // @ts-ignore
                    [applyTerminalSettings, terminalSettings, terminalSettings, themes, selectTheme,];
                } },
            key: (theme.name),
            ...{ class: "theme-card" },
            ...{ class: ({ active: __VLS_ctx.terminalSettings.theme === theme.name }) },
        });
        /** @type {__VLS_StyleScopedClasses['theme-card']} */ ;
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "theme-preview" },
            ...{ style: ({ background: theme.background }) },
        });
        /** @type {__VLS_StyleScopedClasses['theme-preview']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ style: ({ color: theme.foreground }) },
        });
        (theme.name);
        // @ts-ignore
        [terminalSettings,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "setting-group" },
    });
    /** @type {__VLS_StyleScopedClasses['setting-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "setting-label" },
    });
    /** @type {__VLS_StyleScopedClasses['setting-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cursor-options" },
    });
    /** @type {__VLS_StyleScopedClasses['cursor-options']} */ ;
    for (const [cursor] of __VLS_vFor((__VLS_ctx.cursorStyles))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showSettings))
                        return;
                    __VLS_ctx.selectCursorStyle(cursor);
                    // @ts-ignore
                    [cursorStyles, selectCursorStyle,];
                } },
            key: (cursor),
            ...{ class: "cursor-btn" },
            ...{ class: ({ active: __VLS_ctx.terminalSettings.cursorStyle === cursor }) },
        });
        /** @type {__VLS_StyleScopedClasses['cursor-btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        (cursor);
        // @ts-ignore
        [terminalSettings,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "setting-group" },
    });
    /** @type {__VLS_StyleScopedClasses['setting-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "setting-label" },
    });
    /** @type {__VLS_StyleScopedClasses['setting-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: (__VLS_ctx.applyTerminalSettings) },
        type: "checkbox",
    });
    (__VLS_ctx.terminalSettings.cursorBlink);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.resetSettings) },
        ...{ class: "btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showSettings))
                    return;
                __VLS_ctx.showSettings = false;
                // @ts-ignore
                [showSettings, applyTerminalSettings, terminalSettings, resetSettings,];
            } },
        ...{ class: "btn-primary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "main-workspace" },
});
/** @type {__VLS_StyleScopedClasses['main-workspace']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "hosts-sidebar" },
    ...{ class: ({ collapsed: __VLS_ctx.sidebarCollapsed }) },
});
/** @type {__VLS_StyleScopedClasses['hosts-sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['collapsed']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "sidebar-header" },
});
/** @type {__VLS_StyleScopedClasses['sidebar-header']} */ ;
if (!__VLS_ctx.sidebarCollapsed) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "sidebar-controls" },
});
/** @type {__VLS_StyleScopedClasses['sidebar-controls']} */ ;
if (!__VLS_ctx.sidebarCollapsed) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.loadNodes) },
        ...{ class: "btn-icon" },
        title: "刷新",
    });
    /** @type {__VLS_StyleScopedClasses['btn-icon']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.sidebarCollapsed = !__VLS_ctx.sidebarCollapsed;
            // @ts-ignore
            [sidebarCollapsed, sidebarCollapsed, sidebarCollapsed, sidebarCollapsed, sidebarCollapsed, loadNodes,];
        } },
    ...{ class: "btn-icon" },
    title: (__VLS_ctx.sidebarCollapsed ? '展开' : '折叠'),
});
/** @type {__VLS_StyleScopedClasses['btn-icon']} */ ;
(__VLS_ctx.sidebarCollapsed ? '▶' : '◀');
if (!__VLS_ctx.sidebarCollapsed) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "hosts-list" },
    });
    /** @type {__VLS_StyleScopedClasses['hosts-list']} */ ;
    if (__VLS_ctx.loading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "loading-small" },
        });
        /** @type {__VLS_StyleScopedClasses['loading-small']} */ ;
    }
    else if (__VLS_ctx.nodes.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "empty-state" },
        });
        /** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    }
    else {
        for (const [node] of __VLS_vFor((__VLS_ctx.nodes))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ onClick: (...[$event]) => {
                        if (!(!__VLS_ctx.sidebarCollapsed))
                            return;
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.nodes.length === 0))
                            return;
                        node.enabled && __VLS_ctx.selectNode(node);
                        // @ts-ignore
                        [nodes, nodes, sidebarCollapsed, sidebarCollapsed, sidebarCollapsed, loading, selectNode,];
                    } },
                key: (node.name),
                ...{ class: "host-item" },
                ...{ class: ({
                        active: __VLS_ctx.activeTab?.node?.name === node.name,
                        disabled: !node.enabled
                    }) },
            });
            /** @type {__VLS_StyleScopedClasses['host-item']} */ ;
            /** @type {__VLS_StyleScopedClasses['active']} */ ;
            /** @type {__VLS_StyleScopedClasses['disabled']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "host-icon" },
            });
            /** @type {__VLS_StyleScopedClasses['host-icon']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "host-info" },
            });
            /** @type {__VLS_StyleScopedClasses['host-info']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "host-name" },
            });
            /** @type {__VLS_StyleScopedClasses['host-name']} */ ;
            (node.name);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "host-address" },
            });
            /** @type {__VLS_StyleScopedClasses['host-address']} */ ;
            (node.host);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "host-status" },
                ...{ class: ({ connected: __VLS_ctx.tabs.some(t => t.node?.name === node.name && t.connected) }) },
            });
            /** @type {__VLS_StyleScopedClasses['host-status']} */ ;
            /** @type {__VLS_StyleScopedClasses['connected']} */ ;
            if (__VLS_ctx.tabs.some(t => t.node?.name === node.name && t.connected)) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(!__VLS_ctx.sidebarCollapsed))
                            return;
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.nodes.length === 0))
                            return;
                        __VLS_ctx.launchSSHTunnel(node);
                        // @ts-ignore
                        [activeTab, tabs, tabs, launchSSHTunnel,];
                    } },
                ...{ class: "btn-tunnel" },
                ...{ class: ({
                        'btn-tunnel-connecting': __VLS_ctx.sshTunnelStatus[node.name] === 'connecting',
                        'btn-tunnel-connected': __VLS_ctx.sshTunnelStatus[node.name] === 'connected',
                        'btn-tunnel-disconnected': __VLS_ctx.sshTunnelStatus[node.name] === 'disconnected'
                    }) },
                title: (__VLS_ctx.sshTunnelStatus[node.name] === 'connected' ? '隧道已连接（点击重连）' :
                    __VLS_ctx.sshTunnelStatus[node.name] === 'disconnected' ? '隧道已断开（点击重连）' :
                        __VLS_ctx.sshTunnelStatus[node.name] === 'connecting' ? '连接中...' : '通过客户端 SSH 隧道连接'),
            });
            /** @type {__VLS_StyleScopedClasses['btn-tunnel']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-tunnel-connecting']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-tunnel-connected']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-tunnel-disconnected']} */ ;
            (__VLS_ctx.sshTunnelStatus[node.name] === 'connected' ? '🟢' : __VLS_ctx.sshTunnelStatus[node.name] === 'disconnected' ? '🔴' : __VLS_ctx.sshTunnelStatus[node.name] === 'connecting' ? '⏳' : '🔗');
            // @ts-ignore
            [sshTunnelStatus, sshTunnelStatus, sshTunnelStatus, sshTunnelStatus, sshTunnelStatus, sshTunnelStatus, sshTunnelStatus, sshTunnelStatus, sshTunnelStatus,];
        }
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "terminal-area" },
    ...{ class: ({ fullscreen: __VLS_ctx.isFullscreen }) },
});
/** @type {__VLS_StyleScopedClasses['terminal-area']} */ ;
/** @type {__VLS_StyleScopedClasses['fullscreen']} */ ;
if (__VLS_ctx.tabs.length > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tab-bar" },
    });
    /** @type {__VLS_StyleScopedClasses['tab-bar']} */ ;
    for (const [tab] of __VLS_vFor((__VLS_ctx.tabs))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.tabs.length > 0))
                        return;
                    __VLS_ctx.switchTab(tab.id);
                    // @ts-ignore
                    [tabs, tabs, isFullscreen, switchTab,];
                } },
            key: (tab.id),
            ...{ class: "shell-tab" },
            ...{ class: ({ active: tab.id === __VLS_ctx.activeTabId }) },
        });
        /** @type {__VLS_StyleScopedClasses['shell-tab']} */ ;
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tab-dot" },
            ...{ class: (tab.connected ? 'dot-connected' : 'dot-disconnected') },
        });
        /** @type {__VLS_StyleScopedClasses['tab-dot']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tab-label" },
        });
        /** @type {__VLS_StyleScopedClasses['tab-label']} */ ;
        (tab.node?.name || '连接中');
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.tabs.length > 0))
                        return;
                    __VLS_ctx.closeTab(tab.id);
                    // @ts-ignore
                    [activeTabId, closeTab,];
                } },
            ...{ class: "tab-close" },
            title: "关闭",
        });
        /** @type {__VLS_StyleScopedClasses['tab-close']} */ ;
        // @ts-ignore
        [];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.newTab) },
        ...{ class: "tab-new" },
        title: "新建终端",
    });
    /** @type {__VLS_StyleScopedClasses['tab-new']} */ ;
}
if (__VLS_ctx.tabs.length > 0) {
    for (const [tab] of __VLS_vFor((__VLS_ctx.tabs))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (tab.id),
            ...{ class: "terminal-container" },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (tab.id === __VLS_ctx.activeTabId) }, null, null);
        /** @type {__VLS_StyleScopedClasses['terminal-container']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "terminal-header" },
        });
        /** @type {__VLS_StyleScopedClasses['terminal-header']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "terminal-info" },
        });
        /** @type {__VLS_StyleScopedClasses['terminal-info']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "terminal-title" },
        });
        /** @type {__VLS_StyleScopedClasses['terminal-title']} */ ;
        (tab.node?.name);
        (tab.node?.host);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "connection-status" },
            ...{ class: (tab.status) },
        });
        /** @type {__VLS_StyleScopedClasses['connection-status']} */ ;
        (tab.status);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "terminal-actions" },
        });
        /** @type {__VLS_StyleScopedClasses['terminal-actions']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.toggleFullscreen) },
            ...{ class: "term-btn" },
            title: (__VLS_ctx.isFullscreen ? '退出全屏' : '全屏'),
        });
        /** @type {__VLS_StyleScopedClasses['term-btn']} */ ;
        if (!__VLS_ctx.isFullscreen) {
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
            __VLS_asFunctionalElement1(__VLS_intrinsics.polyline)({
                points: "15 3 21 3 21 9",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.polyline)({
                points: "9 21 3 21 3 15",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.line)({
                x1: "21",
                y1: "3",
                x2: "14",
                y2: "10",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.line)({
                x1: "3",
                y1: "21",
                x2: "10",
                y2: "14",
            });
        }
        else {
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
            __VLS_asFunctionalElement1(__VLS_intrinsics.polyline)({
                points: "4 14 10 14 10 20",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.polyline)({
                points: "20 10 14 10 14 4",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.line)({
                x1: "10",
                y1: "14",
                x2: "3",
                y2: "21",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.line)({
                x1: "21",
                y1: "3",
                x2: "14",
                y2: "10",
            });
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.tabs.length > 0))
                        return;
                    __VLS_ctx.clearTab(tab.id);
                    // @ts-ignore
                    [tabs, tabs, isFullscreen, isFullscreen, activeTabId, newTab, toggleFullscreen, clearTab,];
                } },
            ...{ class: "term-btn" },
            title: "清屏",
        });
        /** @type {__VLS_StyleScopedClasses['term-btn']} */ ;
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
        __VLS_asFunctionalElement1(__VLS_intrinsics.polyline)({
            points: "3 6 5 6 21 6",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
            d: "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
            d: "M10 11v6",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
            d: "M14 11v6",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.tabs.length > 0))
                        return;
                    __VLS_ctx.disconnectTab(tab.id);
                    // @ts-ignore
                    [disconnectTab,];
                } },
            ...{ class: "term-btn term-btn-danger" },
            title: "断开连接",
        });
        /** @type {__VLS_StyleScopedClasses['term-btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['term-btn-danger']} */ ;
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
        __VLS_asFunctionalElement1(__VLS_intrinsics.line)({
            x1: "18",
            y1: "6",
            x2: "6",
            y2: "18",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.line)({
            x1: "6",
            y1: "6",
            x2: "18",
            y2: "18",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "terminal-content" },
        });
        /** @type {__VLS_StyleScopedClasses['terminal-content']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ref: (el => __VLS_ctx.setTabTerminalRef(tab.id, el)),
            ...{ class: "xterm-container" },
        });
        /** @type {__VLS_StyleScopedClasses['xterm-container']} */ ;
        // @ts-ignore
        [setTabTerminalRef,];
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "connection-prompt" },
    });
    /** @type {__VLS_StyleScopedClasses['connection-prompt']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "prompt-content" },
    });
    /** @type {__VLS_StyleScopedClasses['prompt-content']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "prompt-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['prompt-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
