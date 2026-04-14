import axios from 'axios';
const API_BASE_URL = 'http://localhost:8080/api';
// 配置 axios 默认值
axios.defaults.baseURL = API_BASE_URL;
// 请求拦截器 - 添加 token
axios.interceptors.request.use((config) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});
// 响应拦截器 - 处理账户禁用和强制修改密码
axios.interceptors.response.use((response) => {
    return response;
}, (error) => {
    if (error.response) {
        const { status, data } = error.response;
        // 账户被禁用
        if (status === 403 && data.code === 'ACCOUNT_DISABLED') {
            // 清除本地存储
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');
            // 显示提示信息
            alert('您的账户已被管理员禁用，请联系管理员。');
            // 跳转到登录页
            window.location.href = '/login';
            return Promise.reject(error);
        }
        // 需要强制修改密码
        if (status === 403 && data.code === 'PASSWORD_MUST_CHANGE') {
            // 跳转到强制修改密码页面
            window.location.href = '/force-change-password';
            return Promise.reject(error);
        }
        // Token 过期或无效
        if (status === 401) {
            // 清除本地存储
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');
            // 跳转到登录页
            window.location.href = '/login';
            return Promise.reject(error);
        }
    }
    return Promise.reject(error);
});
// 认证 API
export const authAPI = {
    // 登录
    login: async (username, password) => {
        const response = await axios.post('/login', { username, password });
        return response.data;
    },
    // 获取当前用户信息
    getCurrentUser: async () => {
        const response = await axios.get('/me');
        return response.data.data;
    },
    // 修改自己的密码
    changePassword: async (oldPassword, newPassword) => {
        const response = await axios.post('/profile/change-password', {
            oldPassword,
            newPassword
        });
        return response.data;
    },
    // 更新个人信息
    updateProfile: async (profile) => {
        const response = await axios.put('/profile', profile);
        return response.data;
    }
};
// 用户管理 API
export const userAPI = {
    // 获取所有用户
    getUsers: async () => {
        const response = await axios.get('/users');
        return response.data.data;
    },
    // 获取单个用户
    getUser: async (username) => {
        const response = await axios.get(`/users/${username}`);
        return response.data.data;
    },
    // 获取下一个可用的 UID
    getNextUID: async () => {
        const response = await axios.get('/users/next-uid');
        return response.data.uid;
    },
    // 创建用户
    createUser: async (user) => {
        const response = await axios.post('/users', user);
        return response.data;
    },
    // 更新用户
    updateUser: async (username, user) => {
        const response = await axios.put(`/users/${username}`, user);
        return response.data;
    },
    // 删除用户
    deleteUser: async (username) => {
        const response = await axios.delete(`/users/${username}`);
        return response.data;
    },
    // 重置密码
    resetPassword: async (username, newPassword) => {
        const response = await axios.post(`/users/${username}/reset-password`, {
            newPassword
        });
        return response.data;
    },
    // 禁用/启用用户
    setUserDisabled: async (username, disabled) => {
        const response = await axios.post(`/users/${username}/set-disabled`, {
            disabled
        });
        return response.data;
    },
    // 设置首次登录必须修改密码
    setPasswordMustChange: async (username, mustChange) => {
        const response = await axios.post(`/users/${username}/set-password-must-change`, {
            mustChange
        });
        return response.data;
    }
};
// 用户组管理 API
export const groupAPI = {
    // 获取所有用户组
    getGroups: async () => {
        const response = await axios.get('/groups');
        return response.data.data;
    },
    // 获取单个用户组
    getGroup: async (gid) => {
        const response = await axios.get(`/groups/${gid}`);
        return response.data.data;
    },
    // 获取下一个可用的 GID
    getNextGID: async () => {
        const response = await axios.get('/groups/next-gid');
        return response.data.gid;
    },
    // 创建用户组
    createGroup: async (group) => {
        const response = await axios.post('/groups', group);
        return response.data;
    },
    // 更新用户组
    updateGroup: async (gid, group) => {
        const response = await axios.put(`/groups/${gid}`, group);
        return response.data;
    },
    // 删除用户组
    deleteGroup: async (gid) => {
        const response = await axios.delete(`/groups/${gid}`);
        return response.data;
    }
};
// Slurm QoS 管理 API
export const qosAPI = {
    // 获取所有 QoS
    getQoSList: async () => {
        const response = await axios.get('/qos');
        return response.data.data;
    },
    // 获取单个 QoS
    getQoS: async (name) => {
        const response = await axios.get(`/qos/${name}`);
        return response.data.data;
    },
    // 创建 QoS
    createQoS: async (qos) => {
        const response = await axios.post('/qos', qos);
        return response.data;
    },
    // 更新 QoS
    updateQoS: async (name, qos) => {
        const response = await axios.put(`/qos/${name}`, qos);
        return response.data;
    },
    // 删除 QoS
    deleteQoS: async (name) => {
        const response = await axios.delete(`/qos/${name}`);
        return response.data;
    }
};
// Slurm 作业管理 API
export const jobAPI = {
    // 获取作业列表
    getJobs: async (username) => {
        const params = username ? { user: username } : {};
        const response = await axios.get('/jobs', { params });
        return response.data.data;
    },
    // 获取单个作业详情
    getJob: async (jobId) => {
        const response = await axios.get(`/jobs/${jobId}`);
        return response.data.data;
    },
    // 提交作业
    submitJob: async (jobScript) => {
        const response = await axios.post('/jobs', jobScript);
        return response.data;
    },
    // 暂停作业
    pauseJob: async (jobId) => {
        const response = await axios.post(`/jobs/${jobId}/pause`);
        return response.data;
    },
    // 恢复作业
    resumeJob: async (jobId) => {
        const response = await axios.post(`/jobs/${jobId}/resume`);
        return response.data;
    },
    // 取消作业
    cancelJob: async (jobId) => {
        const response = await axios.post(`/jobs/${jobId}/cancel`);
        return response.data;
    },
    // 删除作业
    deleteJob: async (jobId) => {
        const response = await axios.delete(`/jobs/${jobId}`);
        return response.data;
    }
};
// 审计日志 API
export const auditAPI = {
    // 获取审计日志列表
    getLogs: async (params) => {
        const response = await axios.get('/audit/logs', { params });
        return response.data.data;
    },
    // 获取单条审计日志
    getLog: async (id) => {
        const response = await axios.get(`/audit/logs/${id}`);
        return response.data.data;
    },
    // 获取统计信息
    getStats: async () => {
        const response = await axios.get('/audit/stats');
        return response.data.data;
    },
    // 导出日志
    exportLogs: async (params) => {
        const response = await axios.get('/audit/export', {
            params,
            responseType: 'blob'
        });
        return response.data;
    }
};
// Slurm 账户管理 API
export const slurmAccountAPI = {
    // 获取所有账户
    getAccounts: async () => {
        const response = await axios.get('/slurm/accounts');
        return response.data.data;
    },
    // 获取单个账户
    getAccount: async (name) => {
        const response = await axios.get(`/slurm/accounts/${name}`);
        return response.data.data;
    },
    // 创建账户
    createAccount: async (account) => {
        const response = await axios.post('/slurm/accounts', account);
        return response.data;
    },
    // 更新账户
    updateAccount: async (name, account) => {
        const response = await axios.put(`/slurm/accounts/${name}`, account);
        return response.data;
    },
    // 删除账户
    deleteAccount: async (name) => {
        const response = await axios.delete(`/slurm/accounts/${name}`);
        return response.data;
    }
};
// Slurm 用户管理 API
export const slurmUserAPI = {
    // 获取所有用户
    getUsers: async () => {
        const response = await axios.get('/slurm/users');
        return response.data.data;
    },
    // 获取单个用户
    getUser: async (name) => {
        const response = await axios.get(`/slurm/users/${name}`);
        return response.data.data;
    },
    // 创建用户
    createUser: async (user) => {
        const response = await axios.post('/slurm/users', user);
        return response.data;
    },
    // 更新用户
    updateUser: async (name, user) => {
        const response = await axios.put(`/slurm/users/${name}`, user);
        return response.data;
    },
    // 删除用户
    deleteUser: async (name) => {
        const response = await axios.delete(`/slurm/users/${name}`);
        return response.data;
    }
};
// 资源绑定管理 API
export const getAssociations = async () => {
    return await axios.get('/slurm/associations');
};
export const getAssociation = async (account, user, cluster) => {
    const params = new URLSearchParams();
    params.append('account', account);
    params.append('user', user);
    if (cluster) {
        params.append('cluster', cluster);
    }
    return await axios.get(`/slurm/associations/single?${params.toString()}`);
};
export const createAssociation = async (association) => {
    return await axios.post('/slurm/associations', association);
};
export const updateAssociation = async (account, user, cluster, association) => {
    const params = new URLSearchParams();
    params.append('account', account);
    params.append('user', user);
    if (cluster) {
        params.append('cluster', cluster);
    }
    return await axios.put(`/slurm/associations?${params.toString()}`, association);
};
export const deleteAssociation = async (account, user, cluster, partition) => {
    const params = new URLSearchParams();
    params.append('account', account);
    params.append('user', user);
    if (cluster) {
        params.append('cluster', cluster);
    }
    if (partition) {
        params.append('partition', partition);
    }
    return await axios.delete(`/slurm/associations?${params.toString()}`);
};
// 机时管理 API
export const usageAPI = {
    // 获取用户机时使用情况
    getUserUsage: async (user, startTime, endTime) => {
        const response = await axios.get('/usage/user', {
            params: { user, start_time: startTime, end_time: endTime }
        });
        return response.data;
    },
    // 获取账户机时使用情况（包含 billing 限制）
    getAccountUsage: async (account, startTime, endTime) => {
        const response = await axios.get('/usage/account', {
            params: { account, start_time: startTime, end_time: endTime }
        });
        return response.data;
    },
    // 获取用户在特定账户下的机时使用情况
    getUserUsageByAccount: async (user, account, startTime, endTime) => {
        const response = await axios.get('/usage/account/user', {
            params: { user, account, start_time: startTime, end_time: endTime }
        });
        return response.data;
    },
    // 获取所有账户的机时使用情况
    getAllAccountsUsage: async (startTime, endTime) => {
        const response = await axios.get('/usage/accounts', {
            params: { start_time: startTime, end_time: endTime }
        });
        return response.data;
    },
    // 获取机时使用汇总
    getUsageSummary: async (user, account, startTime, endTime) => {
        const params = { start_time: startTime, end_time: endTime };
        if (user)
            params.user = user;
        if (account)
            params.account = account;
        const response = await axios.get('/usage/summary', { params });
        return response.data;
    },
    // 获取集群整体机时使用情况
    getClusterUsage: async (startTime, endTime) => {
        const response = await axios.get('/usage/cluster', {
            params: { start_time: startTime, end_time: endTime }
        });
        return response.data;
    }
};
export default {
    auth: authAPI,
    user: userAPI,
    group: groupAPI,
    qos: qosAPI,
    job: jobAPI,
    audit: auditAPI,
    slurmAccount: slurmAccountAPI,
    slurmUser: slurmUserAPI,
    usage: usageAPI
};
