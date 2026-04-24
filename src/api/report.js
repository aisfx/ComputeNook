import axios from 'axios';
export const reportAPI = {
    getJobStats: (params) => axios.get('/reports/jobs', { params }),
    getUsageStats: (params) => axios.get('/reports/usage', { params }),
    getStorageStats: (params) => axios.get('/reports/storage', { params }),
    getQuotaStats: (params) => axios.get('/reports/quota', { params }),
    getQoSUsage: (params) => axios.get('/reports/qos-usage', { params }),
};
export default reportAPI;
