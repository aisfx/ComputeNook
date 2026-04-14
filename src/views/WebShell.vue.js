/// <reference types="../../node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import notification from '../utils/notification';
// 响应式数据
const showNodeSelector = ref(false);
const showAuthSelector = ref(false);
const showPasswordInput = ref(false);
const showSessions = ref(false);
const showLogs = ref(false);
const showKeyUpload = ref(false);
const showSettings = ref(false);
const loading = ref(false);
const error = ref('');
const connected = ref(false);
const connectionStatus = ref('disconnected');
const sidebarCollapsed = ref(false);
const isFullscreen = ref(false);
const nodes = ref([]);
const selectedNode = ref(null);
const currentNode = ref(null);
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
// 终端相关
const terminalContainer = ref();
const passwordInput = ref();
let terminal = null;
let fitAddon = null;
let websocket = null;
// 初始化
onMounted(async () => {
    console.log('WebShell component mounted, initializing...');
    // 加载保存的设置
    loadSettings();
    await loadCurrentUser();
    console.log('Current username after mount:', currentUsername.value);
    await loadNodes();
    await checkPrivateKey();
});
// 清理
onBeforeUnmount(() => {
    if (terminal) {
        terminal.dispose();
    }
    if (websocket) {
        websocket.close();
    }
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
// 应用终端设置
const applyTerminalSettings = () => {
    if (!terminal)
        return;
    const theme = themes.find(t => t.name === terminalSettings.value.theme);
    if (theme) {
        terminal.options.theme = {
            background: theme.background,
            foreground: theme.foreground,
            cursor: theme.cursor,
            selectionBackground: 'rgba(255, 255, 255, 0.3)',
            black: theme.black,
            red: theme.red,
            green: theme.green,
            yellow: theme.yellow,
            blue: theme.blue,
            magenta: theme.magenta,
            cyan: theme.cyan,
            white: theme.white,
            brightBlack: theme.brightBlack,
            brightRed: theme.brightRed,
            brightGreen: theme.brightGreen,
            brightYellow: theme.brightYellow,
            brightBlue: theme.brightBlue,
            brightMagenta: theme.brightMagenta,
            brightCyan: theme.brightCyan,
            brightWhite: theme.brightWhite
        };
    }
    terminal.options.fontSize = terminalSettings.value.fontSize;
    terminal.options.cursorStyle = terminalSettings.value.cursorStyle;
    terminal.options.cursorBlink = terminalSettings.value.cursorBlink;
    // 重新适配大小
    if (fitAddon) {
        fitAddon.fit();
    }
    // 保存设置
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
        console.log('Loading current user, token:', token ? 'exists' : 'missing');
        if (!token) {
            console.warn('No token found, user not logged in');
            currentUsername.value = 'unknown';
            notification.warning('请先登录系统');
            return;
        }
        const response = await fetch('http://localhost:8080/api/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        console.log('Response status:', response.status);
        if (response.ok) {
            const result = await response.json();
            console.log('User data received:', result);
            // 后端返回格式: {"data": {"username": "sunfx", "uid": 1001, ...}}
            if (result.data) {
                // 优先使用 username 字段（小写）
                if (result.data.username) {
                    currentUsername.value = result.data.username;
                    console.log('Current username set to:', currentUsername.value);
                }
                // 兼容大写的 Username 字段
                else if (result.data.Username) {
                    currentUsername.value = result.data.Username;
                    console.log('Current username set to (from Username):', currentUsername.value);
                }
                else {
                    console.warn('Username not found in response:', result);
                    currentUsername.value = 'unknown';
                }
            }
            else {
                console.warn('Data field not found in response:', result);
                currentUsername.value = 'unknown';
            }
        }
        else {
            console.error('Failed to load user, status:', response.status);
            const errorText = await response.text();
            console.error('Error response:', errorText);
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
        const response = await fetch('http://localhost:8080/api/webshell/keys/check', {
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
        const response = await fetch('http://localhost:8080/api/webshell/nodes', {
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
// 选择节点
const selectNode = async (node) => {
    selectedNode.value = node;
    // 确保用户信息已加载
    if (!currentUsername.value || currentUsername.value === 'unknown') {
        console.log('Username not loaded, loading now...');
        await loadCurrentUser();
        console.log('Username after loading:', currentUsername.value);
    }
    else {
        console.log('Username already loaded:', currentUsername.value);
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
// 连接到节点
const connectToNode = async (node, password = '') => {
    // 确保用户信息已加载
    if (!currentUsername.value || currentUsername.value === 'unknown') {
        await loadCurrentUser();
    }
    currentNode.value = node;
    connectionStatus.value = 'connecting';
    try {
        // 建立WebSocket连接
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            notification.error('请先登录系统');
            return;
        }
        let wsUrl = `ws://localhost:8080/api/webshell/connect?node=${node.name}&token=${encodeURIComponent(token)}`;
        // 如果提供了密码，添加到URL参数中
        if (password) {
            wsUrl += `&password=${encodeURIComponent(password)}`;
        }
        console.log('Connecting to WebSocket with username:', currentUsername.value);
        websocket = new WebSocket(wsUrl);
        websocket.onopen = () => {
            connectionStatus.value = 'connected';
            connected.value = true;
            // 取消登录提示
            // notification.success(`已连接到 ${node.name}`)
            // 初始化终端
            nextTick(() => {
                initTerminal();
            });
        };
        websocket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            handleWebSocketMessage(message);
        };
        websocket.onclose = () => {
            connectionStatus.value = 'disconnected';
            connected.value = false;
            // 取消断开连接提示
            // notification.info('连接已断开')
            if (terminal) {
                terminal.dispose();
                terminal = null;
            }
        };
        websocket.onerror = (error) => {
            connectionStatus.value = 'error';
            notification.error('连接错误');
            console.error('WebSocket error:', error);
        };
    }
    catch (err) {
        connectionStatus.value = 'error';
        notification.error('连接失败: ' + err.message);
    }
};
// 初始化终端
const initTerminal = () => {
    if (!terminalContainer.value)
        return;
    // 获取当前主题
    const theme = themes.find(t => t.name === terminalSettings.value.theme) || themes[0];
    // 创建终端实例
    terminal = new Terminal({
        cursorBlink: terminalSettings.value.cursorBlink,
        cursorStyle: terminalSettings.value.cursorStyle,
        fontSize: terminalSettings.value.fontSize,
        fontFamily: 'Consolas, "Courier New", monospace',
        theme: {
            background: theme.background,
            foreground: theme.foreground,
            cursor: theme.cursor,
            selectionBackground: 'rgba(255, 255, 255, 0.3)',
            black: theme.black,
            red: theme.red,
            green: theme.green,
            yellow: theme.yellow,
            blue: theme.blue,
            magenta: theme.magenta,
            cyan: theme.cyan,
            white: theme.white,
            brightBlack: theme.brightBlack,
            brightRed: theme.brightRed,
            brightGreen: theme.brightGreen,
            brightYellow: theme.brightYellow,
            brightBlue: theme.brightBlue,
            brightMagenta: theme.brightMagenta,
            brightCyan: theme.brightCyan,
            brightWhite: theme.brightWhite
        },
        allowProposedApi: true
    });
    // 添加插件
    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    // 挂载到容器
    terminal.open(terminalContainer.value);
    // 自适应大小
    fitAddon.fit();
    // 监听窗口大小变化
    window.addEventListener('resize', handleResize);
    // 监听终端输入
    terminal.onData((data) => {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({
                type: 'input',
                data: data
            }));
        }
    });
    // 发送终端大小
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
            type: 'resize',
            data: {
                rows: terminal.rows,
                cols: terminal.cols
            }
        }));
    }
};
// 处理窗口大小变化
const handleResize = () => {
    if (fitAddon && terminal) {
        fitAddon.fit();
        // 通知服务器终端大小变化
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({
                type: 'resize',
                data: {
                    rows: terminal.rows,
                    cols: terminal.cols
                }
            }));
        }
    }
};
// 处理WebSocket消息
const handleWebSocketMessage = (message) => {
    console.log('WebSocket message received:', message);
    switch (message.type) {
        case 'output':
            // 将输出写入终端
            if (terminal && message.data) {
                terminal.write(message.data);
            }
            break;
        case 'connected':
            connectionStatus.value = 'connected';
            connected.value = true;
            // 如果服务器返回了用户名，使用服务器返回的用户名
            if (message.data && message.data.username) {
                currentUsername.value = message.data.username;
                console.log('Username updated from server:', currentUsername.value);
            }
            if (message.data && message.data.auth_method) {
                // 取消认证方式提示
                // const authMethod = message.data.auth_method === 'private_key' ? '私钥' : '密码'
                // notification.success(`已连接 (认证方式: ${authMethod})`)
            }
            break;
        case 'auth_required':
            notification.warning(message.data);
            showPasswordInput.value = true;
            break;
        case 'error':
            notification.error(message.data);
            connectionStatus.value = 'error';
            break;
    }
};
// 清屏
const clearTerminal = () => {
    if (terminal) {
        terminal.clear();
    }
};
// 断开连接
const disconnect = () => {
    if (websocket) {
        websocket.close();
        websocket = null;
    }
    if (terminal) {
        terminal.dispose();
        terminal = null;
    }
    window.removeEventListener('resize', handleResize);
    connected.value = false;
    connectionStatus.value = 'disconnected';
    currentNode.value = null;
};
// 切换全屏
const toggleFullscreen = () => {
    isFullscreen.value = !isFullscreen.value;
    // 全屏时自动折叠侧边栏
    if (isFullscreen.value) {
        sidebarCollapsed.value = true;
    }
    // 延迟调整终端大小以适应新布局
    setTimeout(() => {
        if (fitAddon && terminal) {
            fitAddon.fit();
            // 通知服务器终端大小变化
            if (websocket && websocket.readyState === WebSocket.OPEN) {
                websocket.send(JSON.stringify({
                    type: 'resize',
                    data: {
                        rows: terminal.rows,
                        cols: terminal.cols
                    }
                }));
            }
        }
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
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}`
            },
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
/** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
/** @type {__VLS_StyleScopedClasses['host-item']} */ ;
/** @type {__VLS_StyleScopedClasses['host-item']} */ ;
/** @type {__VLS_StyleScopedClasses['host-item']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled']} */ ;
/** @type {__VLS_StyleScopedClasses['host-status']} */ ;
/** @type {__VLS_StyleScopedClasses['terminal-area']} */ ;
/** @type {__VLS_StyleScopedClasses['connection-status']} */ ;
/** @type {__VLS_StyleScopedClasses['connected']} */ ;
/** @type {__VLS_StyleScopedClasses['connection-status']} */ ;
/** @type {__VLS_StyleScopedClasses['connection-status']} */ ;
/** @type {__VLS_StyleScopedClasses['connection-status']} */ ;
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
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
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
    ...{ class: "btn-primary" },
});
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
if (__VLS_ctx.showAuthSelector) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showAuthSelector))
                    return;
                __VLS_ctx.showAuthSelector = false;
                // @ts-ignore
                [showAuthSelector, showAuthSelector,];
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
if (__VLS_ctx.showKeyUpload) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showKeyUpload))
                    return;
                __VLS_ctx.showKeyUpload = false;
                // @ts-ignore
                [showKeyUpload, showKeyUpload, connectWithPassword, sshPassword,];
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
        ...{ class: "upload-area" },
    });
    /** @type {__VLS_StyleScopedClasses['upload-area']} */ ;
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
                __VLS_ctx.$refs.keyFileInput.click();
                // @ts-ignore
                [handleKeyUpload, $refs,];
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "upload-info" },
    });
    /** @type {__VLS_StyleScopedClasses['upload-info']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h5, __VLS_intrinsics.h5)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
}
if (__VLS_ctx.showSettings) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showSettings))
                    return;
                __VLS_ctx.showSettings = false;
                // @ts-ignore
                [showSettings, showSettings,];
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
                        [sidebarCollapsed, sidebarCollapsed, sidebarCollapsed, loading, nodes, nodes, selectNode,];
                    } },
                key: (node.name),
                ...{ class: "host-item" },
                ...{ class: ({
                        active: __VLS_ctx.currentNode?.name === node.name,
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
                ...{ class: ({ connected: __VLS_ctx.currentNode?.name === node.name && __VLS_ctx.connected }) },
            });
            /** @type {__VLS_StyleScopedClasses['host-status']} */ ;
            /** @type {__VLS_StyleScopedClasses['connected']} */ ;
            if (__VLS_ctx.currentNode?.name === node.name && __VLS_ctx.connected) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            }
            // @ts-ignore
            [currentNode, currentNode, currentNode, connected, connected,];
        }
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "terminal-area" },
    ...{ class: ({ fullscreen: __VLS_ctx.isFullscreen }) },
});
/** @type {__VLS_StyleScopedClasses['terminal-area']} */ ;
/** @type {__VLS_StyleScopedClasses['fullscreen']} */ ;
if (__VLS_ctx.connected) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "terminal-container" },
    });
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
    (__VLS_ctx.currentNode?.name);
    (__VLS_ctx.currentNode?.host);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "connection-status" },
        ...{ class: (__VLS_ctx.connectionStatus) },
    });
    /** @type {__VLS_StyleScopedClasses['connection-status']} */ ;
    (__VLS_ctx.connectionStatus);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "terminal-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['terminal-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.toggleFullscreen) },
        ...{ class: "btn-small btn-secondary" },
        title: (__VLS_ctx.isFullscreen ? '退出全屏' : '全屏'),
    });
    /** @type {__VLS_StyleScopedClasses['btn-small']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    (__VLS_ctx.isFullscreen ? '🗗' : '🗖');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.clearTerminal) },
        ...{ class: "btn-small btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-small']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.disconnect) },
        ...{ class: "btn-small btn-danger" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-small']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-danger']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "terminal-content" },
    });
    /** @type {__VLS_StyleScopedClasses['terminal-content']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ref: "terminalContainer",
        ...{ class: "xterm-container" },
    });
    /** @type {__VLS_StyleScopedClasses['xterm-container']} */ ;
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
[currentNode, currentNode, connected, isFullscreen, isFullscreen, isFullscreen, connectionStatus, connectionStatus, toggleFullscreen, clearTerminal, disconnect,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
