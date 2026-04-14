import axios from 'axios';
const API_BASE_URL = 'http://localhost:8080/api';
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
// 登出
export const logout = () => {
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
