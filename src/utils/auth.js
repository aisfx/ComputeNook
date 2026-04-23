import axios from 'axios';
// 运行时动态获取 API 地址，与 api/index.ts 保持一致
function getBaseURL() {
    const w = window;
    if (w.__CONFIG__?.apiUrl)
        return w.__CONFIG__.apiUrl + '/api';
    if (import.meta.env.DEV)
        return `${location.protocol}//${location.hostname}:8080/api`;
    return '/api';
}
const API_BASE_URL = getBaseURL();
// 供各组件直接 fetch 使用的 API 根路径（不含 /api 后缀）
export const getApiBase = () => {
    const w = window;
    if (w.__CONFIG__?.apiUrl)
        return w.__CONFIG__.apiUrl;
    if (import.meta.env.DEV)
        return `${location.protocol}//${location.hostname}:8080`;
    return '';
};
// 供 WebShell 使用的 WS 根路径
export const getWsBase = () => {
    const w = window;
    const httpBase = w.__CONFIG__?.apiUrl || (import.meta.env.DEV ? `${location.protocol}//${location.hostname}:8080` : '');
    return httpBase.replace(/^http/, 'ws');
};
// 开发模式配置（已禁用）
const DEV_MODE = false; // 强制关闭开发模式
const DEV_USER = {
    username: 'admin',
    uid: 1000,
    gid: 1000,
    cnName: '管理员',
    email: 'admin@example.com',
    phone: '13800138000',
    shell: '/bin/bash',
    homeDir: '/home/admin',
    groups: ['admin', 'users'],
    isAdmin: true
};
// 获取 token
export const getToken = () => {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
};
// 获取用户信息
export const getUser = () => {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
        try {
            return JSON.parse(userStr);
        }
        catch (e) {
            return null;
        }
    }
    return null;
};
// 检查是否已登录
export const isAuthenticated = () => {
    return !!getToken();
};
// 检查是否是管理员
export const isAdmin = () => {
    const user = getUser();
    return user?.isAdmin === true;
};
// 登出（同时通知后端吊销 token）
export const logout = async () => {
    const token = getToken();
    if (token) {
        try {
            await fetch(`${getApiBase()}/api/logout`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
        }
        catch (_) {
            // 网络失败也继续清除本地状态
        }
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
};
// 设置 axios 拦截器
export const setupAxiosInterceptors = () => {
    // 请求拦截器 - 添加 token
    axios.interceptors.request.use((config) => {
        const token = getToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    }, (error) => {
        return Promise.reject(error);
    });
    // 响应拦截器 - 处理 401 错误
    axios.interceptors.response.use((response) => {
        return response;
    }, (error) => {
        if (error.response?.status === 401) {
            // Token 过期或无效，清除登录信息并跳转到登录页
            logout();
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    });
};
// 获取当前用户信息（从服务器）
export const fetchCurrentUser = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/me`);
        const user = response.data.data;
        // 更新本地存储
        if (localStorage.getItem('token')) {
            localStorage.setItem('user', JSON.stringify(user));
        }
        else {
            sessionStorage.setItem('user', JSON.stringify(user));
        }
        return user;
    }
    catch (error) {
        console.error('Failed to fetch current user:', error);
        return null;
    }
};
// 刷新 token
export const refreshToken = async () => {
    try {
        const response = await axios.post(`${API_BASE_URL}/refresh-token`);
        const { token, user } = response.data;
        // 更新存储
        if (localStorage.getItem('token')) {
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
        }
        else {
            sessionStorage.setItem('token', token);
            sessionStorage.setItem('user', JSON.stringify(user));
        }
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        return true;
    }
    catch (error) {
        console.error('Failed to refresh token:', error);
        return false;
    }
};
