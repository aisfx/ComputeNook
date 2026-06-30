/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { getUser, getApiBase } from '../utils/auth';
import axios from 'axios';
import { usageAPI } from '../api';
import JobDetailModal from '../components/JobDetailModal.vue';
import { dialog } from '../utils/dialog';
const currentUser = ref(null);
const myResources = ref({ associations: [], qos_limits: [] });
const resourcesLoading = ref(false);
const selectedAccountIdx = ref(0);
const lastUpdateTime = ref('');
const router = useRouter();
const refreshAll = async () => {
    await Promise.all([loadDashboardStats(), loadNodes(), loadJobStats()]);
    const now = new Date();
    lastUpdateTime.value = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};
const switchToHouse = () => {
    router.push('/house-dashboard');
};
// 账户资源配额列表（association + qos_limits 合并）
const accountQuotaList = computed(() => {
    const assocs = myResources.value.associations || [];
    const qosList = myResources.value.qos_limits || [];
    console.log('[DEBUG] accountQuotaList computed:', {
        assocs_count: assocs.length,
        qos_count: qosList.length,
        assocs: assocs,
        qosList: qosList
    });
    // 按 account 合并，同一账户的所有 qos_list 合并去重
    const accountMap = new Map();
    for (const a of assocs) {
        const key = a.account || '-';
        const existing = accountMap.get(key) || [];
        const names = a.qos_list || (a.qos ? [a.qos] : []);
        for (const n of names) {
            if (!existing.includes(n))
                existing.push(n);
        }
        accountMap.set(key, existing);
    }
    return Array.from(accountMap.entries()).map(([account, qosNames]) => {
        // 优先找有实际限制的 QoS（max_cpus/max_nodes/max_jobs 任意一个 > 0）
        const qosInfo = qosList.find((q) => qosNames.includes(q.name) && (q.max_cpus > 0 || q.max_nodes > 0 || q.max_jobs > 0)) ||
            qosList.find((q) => qosNames.includes(q.name)) ||
            {};
        const maxCpus = Number(qosInfo.max_cpus) || 0;
        const maxNodes = Number(qosInfo.max_nodes) || 0;
        const maxJobs = Number(qosInfo.max_jobs) || 0;
        const usedCpus = runningJobs.value
            .filter((j) => !account || j.account === account)
            .reduce((s, j) => s + (j.cpus || 0), 0);
        const cpuPct = maxCpus > 0 ? Math.min(100, Math.round(usedCpus / maxCpus * 100)) : 0;
        // 找到 assoc 的 partition（取第一条）
        const assoc = assocs.find((a) => (a.account || '-') === account) || {};
        return {
            account,
            partition: assoc.partition || '',
            qos: qosInfo.name || qosNames.join(', '),
            maxCpus,
            maxNodes,
            maxJobs,
            usedCpus,
            cpuPct,
        };
    });
});
const currentAccountQuota = computed(() => accountQuotaList.value[selectedAccountIdx.value] || {
    account: '-', partition: '', qos: '-', maxCpus: 0, maxNodes: 0, maxJobs: 0, usedCpus: 0, cpuPct: 0
});
// ── 作业历史弹窗 ──
const showJobHistory = ref(false);
const jobHistoryFilter = ref('');
const jobHistoryLoading = ref(false);
const jobHistoryList = ref([]);
const jobStartDate = ref(new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);
const jobEndDate = ref(new Date().toISOString().split('T')[0]);
const selectedJob = ref(null);
// 排序相关
const sortColumn = ref('');
const sortOrder = ref('desc');
// 自选列功能
const availableColumns = [
    { key: 'job_id', label: '作业ID', visible: true },
    { key: 'name', label: '作业名', visible: true },
    { key: 'user', label: '提交人', visible: true },
    { key: 'job_state', label: '状态', visible: true },
    { key: 'partition', label: '分区', visible: true },
    { key: 'num_nodes', label: '节点数', visible: true },
    { key: 'cpus', label: 'CPU核', visible: true },
    { key: 'submit_time', label: '提交时间', visible: true },
    { key: 'start_time', label: '开始时间', visible: true },
    { key: 'end_time', label: '结束时间', visible: true },
    { key: 'run_time', label: '运行时长', visible: true },
];
const visibleColumns = ref([...availableColumns]);
const showColumnSelector = ref(false);
const filteredJobHistory = computed(() => {
    let list = jobHistoryList.value;
    if (jobHistoryFilter.value)
        list = list.filter(j => j.job_state === jobHistoryFilter.value);
    // 排序
    if (sortColumn.value) {
        list = [...list].sort((a, b) => {
            let aVal = a[sortColumn.value];
            let bVal = b[sortColumn.value];
            // 处理时间字段
            if (['submit_time', 'start_time', 'end_time'].includes(sortColumn.value)) {
                aVal = aVal || 0;
                bVal = bVal || 0;
            }
            if (aVal === bVal)
                return 0;
            const comparison = aVal > bVal ? 1 : -1;
            return sortOrder.value === 'asc' ? comparison : -comparison;
        });
    }
    return list;
});
const toggleSort = (column) => {
    if (sortColumn.value === column) {
        sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    }
    else {
        sortColumn.value = column;
        sortOrder.value = 'desc';
    }
};
const getSortIcon = (column) => {
    if (sortColumn.value !== column)
        return '↕';
    return sortOrder.value === 'asc' ? '↑' : '↓';
};
const isColumnVisible = (key) => {
    return visibleColumns.value.find(c => c.key === key)?.visible ?? false;
};
const openJobList = async (state) => {
    jobHistoryFilter.value = state;
    showJobHistory.value = true;
};
// 展开 Slurm hostlist 格式，如 cn[0-1] → ['cn0','cn1']
const expandHostList = (hostlist) => {
    const result = [];
    const parts = [];
    let depth = 0, cur = '';
    for (const ch of hostlist) {
        if (ch === '[') {
            depth++;
            cur += ch;
        }
        else if (ch === ']') {
            depth--;
            cur += ch;
        }
        else if (ch === ',' && depth === 0) {
            parts.push(cur.trim());
            cur = '';
        }
        else {
            cur += ch;
        }
    }
    if (cur.trim())
        parts.push(cur.trim());
    for (const part of parts) {
        const m = part.match(/^(.*?)\[([^\]]+)\](.*)$/);
        if (!m) {
            if (part)
                result.push(part);
            continue;
        }
        const prefix = m[1], ranges = m[2], suffix = m[3];
        for (const seg of ranges.split(',')) {
            const range = seg.trim();
            const dash = range.match(/^(\d+)-(\d+)$/);
            if (dash) {
                const from = parseInt(dash[1]), to = parseInt(dash[2]);
                const pad = dash[1].length > 1 ? dash[1].length : 0;
                for (let i = from; i <= to; i++)
                    result.push(prefix + (pad ? String(i).padStart(pad, '0') : i) + suffix);
            }
            else {
                result.push(prefix + range + suffix);
            }
        }
    }
    return result;
};
// 将 API 作业数据映射为 JobDetailModal 期望的格式
const openJobDetail = (job) => {
    const rawNodes = typeof job.nodes === 'string' ? job.nodes : '';
    const nodeNames = rawNodes && rawNodes !== 'None assigned'
        ? expandHostList(rawNodes)
        : (job.batch_host ? [job.batch_host] : []);
    selectedJob.value = {
        id: job.job_id,
        name: job.name || `Job ${job.job_id}`,
        status: job.job_state,
        user: job.user_name || job.user_id || job.user || currentUser.value?.username,
        partition: job.partition,
        nodes: nodeNames.length || job.num_nodes || 0,
        nodeNames,
        cpus: job.cpus || '-',
        memory: job.memory_per_node ? `${job.memory_per_node} MB` : '-',
        submitTime: formatTime(job.submit_time),
        startTime: formatTime(job.start_time),
        start_time: job.start_time || 0,
        runTime: formatElapsed(job.run_time),
        directory: job.work_dir || job.directory || '-',
    };
};
const cancelJob = async (jobId) => {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const res = await fetch(`${getApiBase()}/api/jobs/${jobId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();
        if (!res.ok)
            throw new Error(result.error || '取消失败');
        selectedJob.value = null;
        await loadJobStats();
    }
    catch (e) {
        console.error('cancelJob error:', e);
        dialog.error(e.message || '取消作业失败');
    }
};
const resumeJob = async (jobId) => {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const res = await fetch(`${getApiBase()}/api/jobs/${jobId}/resume`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();
        if (!res.ok)
            throw new Error(result.error || '恢复失败');
        if (selectedJob.value) {
            selectedJob.value = { ...selectedJob.value, status: 'RUNNING' };
        }
        await loadJobStats();
    }
    catch (e) {
        console.error('resumeJob error:', e);
        dialog.error(e.message || '恢复作业失败');
    }
};
const suspendJob = async (jobId) => {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const res = await fetch(`${getApiBase()}/api/jobs/${jobId}/suspend`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();
        if (!res.ok)
            throw new Error(result.error || '暂停失败');
        if (selectedJob.value) {
            selectedJob.value = { ...selectedJob.value, status: 'SUSPENDED' };
        }
        await loadJobStats();
    }
    catch (e) {
        console.error('suspendJob error:', e);
        dialog.error(e.message || '暂停作业失败');
    }
};
watch(showJobHistory, async (v) => {
    if (v && jobHistoryList.value.length === 0)
        await loadJobHistory();
    // 关闭列选择器
    if (!v)
        showColumnSelector.value = false;
});
// 点击模态框外部关闭列选择器
watch(showColumnSelector, (v) => {
    if (v) {
        const closeSelector = (e) => {
            const target = e.target;
            if (!target.closest('.column-selector-wrap')) {
                showColumnSelector.value = false;
                document.removeEventListener('click', closeSelector);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', closeSelector);
        }, 0);
    }
});
const loadJobHistory = async () => {
    jobHistoryLoading.value = true;
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const username = currentUser.value?.username || '';
        let url = `${getApiBase()}/api/jobs?page=1&page_size=500&user=${encodeURIComponent(username)}`;
        // 后端需要 Unix 时间戳，把日期字符串转换
        if (jobStartDate.value) {
            url += `&start_time=${Math.floor(new Date(jobStartDate.value).getTime() / 1000)}`;
        }
        if (jobEndDate.value) {
            // 结束日期取当天末尾 23:59:59
            url += `&end_time=${Math.floor(new Date(jobEndDate.value + 'T23:59:59').getTime() / 1000)}`;
        }
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const result = await res.json();
        jobHistoryList.value = result.data || [];
    }
    catch (e) {
        console.error(e);
    }
    finally {
        jobHistoryLoading.value = false;
    }
};
// 导出作业历史 Excel（CSV格式，Excel可直接打开）
const exportJobExcel = () => {
    const rows = filteredJobHistory.value;
    if (!rows.length)
        return;
    // 根据可见列生成表头和数据
    const visibleCols = visibleColumns.value.filter(c => c.visible);
    const headers = visibleCols.map(c => c.label);
    const csvRows = [
        headers.join(','),
        ...rows.map(j => {
            return visibleCols.map(col => {
                switch (col.key) {
                    case 'job_id': return j.job_id;
                    case 'name': return `"${j.name || ''}"`;
                    case 'user': return j.user_id || j.user_name || j.user || '';
                    case 'job_state': return j.job_state;
                    case 'partition': return j.partition || '';
                    case 'num_nodes': return j.num_nodes || '';
                    case 'cpus': return j.cpus || '';
                    case 'submit_time': return formatTime(j.submit_time);
                    case 'start_time': return formatTime(j.start_time);
                    case 'end_time': return formatTime(j.end_time);
                    case 'run_time': return formatElapsed(j.run_time);
                    default: return '';
                }
            }).join(',');
        })
    ];
    downloadCsv(csvRows.join('\n'), `jobs_${jobStartDate.value || 'all'}_${jobEndDate.value || 'all'}.csv`);
};
// ── 机时消费记录弹窗 ──
const showBillingHistory = ref(false);
const billingLoading = ref(false);
const billingRecords = ref([]);
const billingStartDate = ref(new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);
const billingEndDate = ref(new Date().toISOString().split('T')[0]);
// 过滤掉 billing=0 的记录
const billingValidRecords = computed(() => billingRecords.value.filter(r => {
    const mins = (r.billing_mins || 0) + (r.billing_hours || 0) * 60 + (r.cpu_hours || 0) * 60;
    return mins > 0;
}));
const billingTotalMins = computed(() => billingValidRecords.value.reduce((s, r) => {
    const mins = (r.billing_mins || 0) || (r.billing_hours || 0) * 60 || (r.cpu_hours || 0) * 60;
    return s + mins;
}, 0));
const billingCpuHours = computed(() => billingValidRecords.value.reduce((s, r) => s + (r.cpu_hours || 0), 0));
const billingGpuHours = computed(() => billingValidRecords.value.reduce((s, r) => s + (r.gpu_hours || 0), 0));
watch(showBillingHistory, async (v) => {
    if (v)
        await loadBillingHistory();
});
const loadBillingHistory = async () => {
    billingLoading.value = true;
    try {
        const user = currentUser.value?.username;
        if (!user)
            return;
        const start = billingStartDate.value || new Date().toISOString().split('T')[0];
        const end = billingEndDate.value || new Date().toISOString().split('T')[0];
        // end_time 取当天末尾，避免今天的作业被截断
        console.log('[billing] querying user=', user, 'start=', start, 'end=', end + 'T23:59:59');
        const res = await usageAPI.getUserUsage(user, start, end + 'T23:59:59');
        console.log('[billing] raw response:', res);
        console.log('[billing] res.data:', res.data);
        console.log('[billing] records count:', (res.data || []).length);
        if ((res.data || []).length > 0) {
            console.log('[billing] first record:', res.data[0]);
        }
        billingRecords.value = res.data || [];
    }
    catch (e) {
        console.error('[billing] error:', e);
    }
    finally {
        billingLoading.value = false;
    }
};
// 导出机时消费 Excel
const exportBillingExcel = () => {
    const rows = billingValidRecords.value;
    if (!rows.length)
        return;
    const headers = ['作业ID', '作业名', '账户', '分区', 'QoS', '状态', '开始时间', '结束时间', '运行时长(秒)', 'CPU小时', 'GPU小时', '消耗核时'];
    const csvRows = [
        headers.join(','),
        ...rows.map(r => [
            r.job_id || '',
            `"${r.job_name || ''}"`,
            r.account,
            r.partition || '',
            r.qos || '',
            r.state || '',
            formatTime(r.start_time),
            formatTime(r.end_time),
            r.elapsed_secs || 0,
            (r.cpu_hours || 0).toFixed(2),
            (r.gpu_hours || 0).toFixed(2),
            (r.billing_mins || (r.billing_hours || 0) * 60).toFixed(1)
        ].join(','))
    ];
    downloadCsv(csvRows.join('\n'), `billing_${billingStartDate.value || 'all'}_${billingEndDate.value || 'all'}.csv`);
};
// ── 通用 CSV 下载（BOM 保证 Excel 中文不乱码）──
const downloadCsv = (content, filename) => {
    const bom = '\uFEFF';
    const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};
// ── 格式化工具 ──
const formatTime = (ts) => {
    if (!ts)
        return '-';
    const d = new Date(typeof ts === 'number' ? ts * 1000 : ts);
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};
const formatElapsed = (secs) => {
    if (!secs || secs === 0)
        return '-';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
const formatMemory = (memoryTB) => {
    if (!memoryTB)
        return '0 GB';
    if (memoryTB >= 1)
        return `${memoryTB.toFixed(1)} TB`;
    return `${(memoryTB * 1024).toFixed(1)} GB`;
};
// ── 数据 ──
const stats = ref({ nodes: 0, nodesOnline: 0, cpuCores: 0, cpuUsage: 0, gpuCards: 0, gpuInUse: 0, memory: 0, memoryFree: 0 });
const jobStats = ref({ running: 0, pending: 0, completed: 0, failed: 0 });
const jobStatsLoading = ref(false);
const runningJobs = ref([]);
const nodes = ref([]);
const machineTime = ref({ totalQuota: 0, used: 0, remaining: 0, usageRate: 0, hasLimit: false });
const machineTimeList = ref([]); // 所有有限制的 QoS
const machineTimeIndex = ref(0); // 当前选中的索引
const storageQuota = ref({
    hasData: false,
    capacity: { used: '-', total: '-', percentage: 0 },
    files: { used: 0, total: 0, percentage: 0, noLimit: false }
});
const jobStatsTotal = computed(() => jobStats.value.running + jobStats.value.pending + jobStats.value.completed + jobStats.value.failed);
const jobStatsPercentages = computed(() => {
    const t = jobStatsTotal.value;
    if (t === 0)
        return { running: 0, pending: 0, completed: 0, failed: 0 };
    return {
        running: (jobStats.value.running / t) * 100,
        pending: (jobStats.value.pending / t) * 100,
        completed: (jobStats.value.completed / t) * 100,
        failed: (jobStats.value.failed / t) * 100
    };
});
// ── API 加载 ──
const loadDashboardStats = async () => {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token)
            return;
        const res = await fetch(`${getApiBase()}/api/dashboard/stats`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok)
            return;
        const result = await res.json();
        const data = result.data || result || {};
        stats.value = {
            nodes: data.total_nodes || 0, nodesOnline: data.online_nodes || 0,
            cpuCores: data.total_cpus || 0, cpuUsage: Math.round(data.cpu_usage_percent || 0),
            gpuCards: data.total_gpus || 0, gpuInUse: data.allocated_gpus || 0,
            memory: data.total_memory_tb || 0, memoryFree: data.free_memory_tb || 0
        };
    }
    catch (e) {
        console.error(e);
    }
};
const loadNodes = async () => {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token)
            return;
        const res = await fetch(`${getApiBase()}/api/dashboard/nodes`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok)
            return;
        const result = await res.json();
        // 确保 data 是数组
        const data = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
        nodes.value = data.map((node) => {
            const state = (node.state || '').toUpperCase();
            let status = 'idle', statusText = '空闲';
            if (state === 'ALLOCATED' || state === 'MIXED') {
                status = 'online';
                statusText = '在线';
            }
            else if (state === 'DOWN' || state === 'DRAIN' || state === 'DRAINING') {
                status = 'offline';
                statusText = '离线';
            }
            let gpuInfo = '-';
            if (node.gpu_info) {
                const m = node.gpu_info.match(/gpu:(\w+:)?(\d+)/);
                const u = node.gpu_used?.match(/gpu:(\w+:)?(\d+)/);
                if (m)
                    gpuInfo = `${u ? parseInt(u[2]) : 0}/${parseInt(m[2])}`;
            }
            return { name: node.name, status, statusText, cpuUsage: Math.round(node.cpu_usage_percent || 0), memUsage: Math.round(node.memory_usage_percent || 0), gpu: gpuInfo, jobs: node.running_jobs || 0 };
        });
    }
    catch (e) {
        console.error(e);
    }
};
const loadJobStats = async () => {
    jobStatsLoading.value = true;
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token)
            return;
        const username = currentUser.value?.username || '';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15秒超时
        const res = await fetch(`${getApiBase()}/api/jobs?page=1&page_size=5000&user=${encodeURIComponent(username)}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok)
            return;
        const result = await res.json();
        const jobs = result.data || [];
        jobStats.value = {
            running: jobs.filter((j) => j.job_state === 'RUNNING').length,
            pending: jobs.filter((j) => j.job_state === 'PENDING').length,
            completed: jobs.filter((j) => j.job_state === 'COMPLETED').length,
            failed: jobs.filter((j) => ['FAILED', 'CANCELLED', 'TIMEOUT', 'NODE_FAIL'].includes(j.job_state)).length,
        };
        runningJobs.value = jobs
            .filter((j) => j.job_state === 'RUNNING')
            .sort((a, b) => (b.submit_time || 0) - (a.submit_time || 0));
        jobHistoryList.value = jobs;
    }
    catch (e) {
        console.error(e);
    }
    finally {
        jobStatsLoading.value = false;
    }
};
const loadMyResources = async () => {
    resourcesLoading.value = true;
    try {
        // 判断是否是管理员
        const isAdmin = currentUser.value?.isAdmin === true || currentUser.value?.is_admin === true;
        if (isAdmin) {
            // 管理员：显示所有 QoS 的汇总
            const res = await axios.get('/billing/v2/accounts');
            const accounts = res.data.data || [];
            const toHours = (hours) => Math.round(hours * 100) / 100;
            const bqList = accounts.map((account) => {
                const total = account.total_recharged || 0;
                const balance = account.current_balance || 0;
                const used = total - balance;
                const usageRate = total > 0 ? parseFloat(((used / total) * 100).toFixed(2)) : 0;
                return {
                    qosName: account.qos_name || '',
                    totalQuota: toHours(total),
                    used: toHours(used),
                    remaining: toHours(balance),
                    usageRate,
                    hasLimit: total > 0
                };
            });
            machineTimeList.value = bqList;
            machineTimeIndex.value = 0;
            if (bqList.length > 0) {
                machineTime.value = bqList[0];
            }
            else {
                machineTime.value = { totalQuota: 0, used: 0, remaining: 0, usageRate: 0, hasLimit: false };
            }
        }
        else {
            // 普通用户：显示自己的机时
            const res = await axios.get('/me/billing');
            const billingData = res.data.data || [];
            const toHours = (hours) => Math.round(hours * 100) / 100;
            const bqList = billingData.map((bq) => {
                const total = bq.total_recharged || 0;
                const used = bq.used || 0;
                const remain = bq.current_balance || 0;
                const usageRate = bq.usage_percent || 0;
                return {
                    qosName: bq.qos_name || '',
                    totalQuota: toHours(total),
                    used: toHours(used),
                    remaining: toHours(remain),
                    usageRate: parseFloat(usageRate.toFixed(2)),
                    hasLimit: total > 0
                };
            });
            machineTimeList.value = bqList;
            machineTimeIndex.value = 0;
            if (bqList.length > 0) {
                machineTime.value = bqList[0];
            }
            else {
                machineTime.value = { totalQuota: 0, used: 0, remaining: 0, usageRate: 0, hasLimit: false };
            }
        }
        // 加载 associations 和 qos_limits（用于账户配额显示）
        try {
            const resRes = await axios.get('/me/resources');
            myResources.value = resRes.data.data || {};
            console.log('[DEBUG] myResources loaded:', {
                associations: myResources.value.associations?.length || 0,
                qos_limits: myResources.value.qos_limits?.length || 0,
                data: myResources.value
            });
        }
        catch (e) {
            console.error('Failed to load resources:', e);
        }
    }
    catch (e) {
        console.error(e);
        // 如果新 API 失败，尝试旧 API（兼容）
        try {
            const res = await axios.get('me/resources');
            myResources.value = res.data.data || {};
            const qosList = myResources.value.qos_limits || [];
            const toHours = (mins) => Math.round(mins / 60 * 100) / 100;
            const bqList = qosList.filter((q) => q.billing_limit_mins > 0).map((bq) => {
                const total = bq.billing_limit_mins;
                const used = bq.billing_used_mins || 0;
                const remain = Math.max(0, total - used);
                const usageRate = total > 0 ? parseFloat((used / total * 100).toFixed(2)) : 0;
                return {
                    qosName: bq.name || '',
                    totalQuota: toHours(total),
                    used: toHours(used),
                    remaining: toHours(remain),
                    usageRate,
                    hasLimit: true
                };
            });
            machineTimeList.value = bqList;
            machineTimeIndex.value = 0;
            if (bqList.length > 0) {
                machineTime.value = bqList[0];
            }
            else {
                machineTime.value = { totalQuota: 0, used: 0, remaining: 0, usageRate: 0, hasLimit: false };
            }
        }
        catch (e2) {
            console.error(e2);
        }
    }
    finally {
        resourcesLoading.value = false;
    }
};
const loadStorageQuota = async () => {
    try {
        const sqRes = await axios.get('files/quota');
        const quotas = sqRes.data.quotas || [];
        if (quotas.length) {
            const q = quotas[0];
            const usedKB = q.block_used_kb || 0;
            const hardKB = q.block_hard_kb || 0;
            const pct = hardKB > 0 ? Math.min(100, Math.round(usedKB / hardKB * 100)) : 0;
            const fmtKB = (kb) => {
                if (kb >= 1024 * 1024 * 1024)
                    return (kb / 1024 / 1024 / 1024).toFixed(1) + ' TB';
                if (kb >= 1024 * 1024)
                    return (kb / 1024 / 1024).toFixed(1) + ' GB';
                if (kb >= 1024)
                    return (kb / 1024).toFixed(1) + ' MB';
                return kb + ' KB';
            };
            const inodeUsed = q.inode_used || 0;
            const inodeHard = q.inode_hard || 0;
            storageQuota.value = {
                hasData: true,
                capacity: { used: fmtKB(usedKB), total: hardKB > 0 ? fmtKB(hardKB) : '无限制', percentage: pct },
                files: {
                    used: inodeUsed,
                    total: inodeHard > 0 ? inodeHard : 0,
                    percentage: inodeHard > 0 ? Math.min(100, Math.round(inodeUsed / inodeHard * 100)) : 0,
                    noLimit: inodeHard === 0
                }
            };
        }
    }
    catch (_) { /* 配额接口失败不影响其他数据 */ }
};
onMounted(() => {
    currentUser.value = getUser();
    const now = new Date();
    billingEndDate.value = now.toISOString().split('T')[0];
    billingStartDate.value = now.toISOString().split('T')[0];
    lastUpdateTime.value = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    loadDashboardStats();
    loadNodes();
    loadJobStats();
    loadStorageQuota();
    loadMyResources();
    setInterval(() => {
        loadDashboardStats();
        loadNodes();
        loadJobStats();
        lastUpdateTime.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }, 30000);
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['btn-refresh']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-refresh']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-house']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-icon-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-icon-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-icon-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-icon-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-icon-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['chart-card-header']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-link-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['qos-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['qos-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['legend-row']} */ ;
/** @type {__VLS_StyleScopedClasses['leg-label']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['running-jobs-header']} */ ;
/** @type {__VLS_StyleScopedClasses['running-job-row']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title-row']} */ ;
/** @type {__VLS_StyleScopedClasses['node-card']} */ ;
/** @type {__VLS_StyleScopedClasses['nodes-table']} */ ;
/** @type {__VLS_StyleScopedClasses['nodes-table']} */ ;
/** @type {__VLS_StyleScopedClasses['nodes-table']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-query']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-export']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-columns']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-detail']} */ ;
/** @type {__VLS_StyleScopedClasses['column-option']} */ ;
/** @type {__VLS_StyleScopedClasses['column-option']} */ ;
/** @type {__VLS_StyleScopedClasses['column-option']} */ ;
/** @type {__VLS_StyleScopedClasses['sortable']} */ ;
/** @type {__VLS_StyleScopedClasses['clickable-row']} */ ;
/** @type {__VLS_StyleScopedClasses['data-table']} */ ;
/** @type {__VLS_StyleScopedClasses['data-table']} */ ;
/** @type {__VLS_StyleScopedClasses['data-table']} */ ;
/** @type {__VLS_StyleScopedClasses['stats-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['stats-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['charts-row']} */ ;
/** @type {__VLS_StyleScopedClasses['charts-row']} */ ;
/** @type {__VLS_StyleScopedClasses['stats-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['billing-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['stats-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['billing-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['charts-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "dashboard" },
});
/** @type {__VLS_StyleScopedClasses['dashboard']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "dash-header" },
});
/** @type {__VLS_StyleScopedClasses['dash-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "dash-title-row" },
});
/** @type {__VLS_StyleScopedClasses['dash-title-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "dash-online-dot" },
});
/** @type {__VLS_StyleScopedClasses['dash-online-dot']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "dash-title" },
});
/** @type {__VLS_StyleScopedClasses['dash-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "dash-cluster-tag" },
});
/** @type {__VLS_StyleScopedClasses['dash-cluster-tag']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "dash-update-time" },
});
/** @type {__VLS_StyleScopedClasses['dash-update-time']} */ ;
(__VLS_ctx.lastUpdateTime);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.refreshAll) },
    ...{ class: "btn-refresh" },
    disabled: (__VLS_ctx.jobStatsLoading),
});
/** @type {__VLS_StyleScopedClasses['btn-refresh']} */ ;
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
    points: "23 4 23 10 17 10",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.polyline)({
    points: "1 20 1 14 7 14",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "charts-row" },
});
/** @type {__VLS_StyleScopedClasses['charts-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card chart-card" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['chart-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "chart-card-header" },
});
/** @type {__VLS_StyleScopedClasses['chart-card-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    'stroke-width': "2",
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
    ...{ style: {} },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
    x: "18",
    y: "3",
    width: "4",
    height: "18",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
    x: "10",
    y: "8",
    width: "4",
    height: "13",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
    x: "2",
    y: "13",
    width: "4",
    height: "8",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showJobHistory = true;
            // @ts-ignore
            [lastUpdateTime, refreshAll, jobStatsLoading, showJobHistory,];
        } },
    ...{ class: "btn-link-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn-link-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "chart-body" },
});
/** @type {__VLS_StyleScopedClasses['chart-body']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "donut-wrap" },
});
/** @type {__VLS_StyleScopedClasses['donut-wrap']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    viewBox: "0 0 200 200",
    ...{ class: "donut-svg" },
});
/** @type {__VLS_StyleScopedClasses['donut-svg']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
    cx: "100",
    cy: "100",
    r: "70",
    fill: "none",
    stroke: "#f3f4f6",
    'stroke-width': "32",
});
if (__VLS_ctx.jobStatsTotal === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "100",
        cy: "100",
        r: "70",
        fill: "none",
        stroke: "#e5e7eb",
        'stroke-width': "32",
        'stroke-dasharray': "440",
        'stroke-dashoffset': "0",
        transform: "rotate(-90 100 100)",
    });
}
if (__VLS_ctx.jobStats.completed > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "100",
        cy: "100",
        r: "70",
        fill: "none",
        stroke: "#10b981",
        'stroke-width': "32",
        'stroke-dasharray': (`${__VLS_ctx.jobStatsPercentages.completed * 4.4} 440`),
        'stroke-dashoffset': (`${-(__VLS_ctx.jobStatsPercentages.running + __VLS_ctx.jobStatsPercentages.pending) * 4.4}`),
        transform: "rotate(-90 100 100)",
    });
}
if (__VLS_ctx.jobStats.pending > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "100",
        cy: "100",
        r: "70",
        fill: "none",
        stroke: "#f59e0b",
        'stroke-width': "32",
        'stroke-dasharray': (`${__VLS_ctx.jobStatsPercentages.pending * 4.4} 440`),
        'stroke-dashoffset': (`${-__VLS_ctx.jobStatsPercentages.running * 4.4}`),
        transform: "rotate(-90 100 100)",
    });
}
if (__VLS_ctx.jobStats.running > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "100",
        cy: "100",
        r: "70",
        fill: "none",
        stroke: "#3b82f6",
        'stroke-width': "32",
        'stroke-dasharray': (`${__VLS_ctx.jobStatsPercentages.running * 4.4} 440`),
        'stroke-dashoffset': "0",
        transform: "rotate(-90 100 100)",
    });
}
if (__VLS_ctx.jobStats.failed > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "100",
        cy: "100",
        r: "70",
        fill: "none",
        stroke: "#ef4444",
        'stroke-width': "32",
        'stroke-dasharray': (`${__VLS_ctx.jobStatsPercentages.failed * 4.4} 440`),
        'stroke-dashoffset': (`${-(__VLS_ctx.jobStatsPercentages.running + __VLS_ctx.jobStatsPercentages.pending + __VLS_ctx.jobStatsPercentages.completed) * 4.4}`),
        transform: "rotate(-90 100 100)",
    });
}
__VLS_asFunctionalElement1(__VLS_intrinsics.text, __VLS_intrinsics.text)({
    x: "100",
    y: "93",
    'text-anchor': "middle",
    ...{ class: "donut-num" },
});
/** @type {__VLS_StyleScopedClasses['donut-num']} */ ;
(__VLS_ctx.jobStatsTotal);
__VLS_asFunctionalElement1(__VLS_intrinsics.text, __VLS_intrinsics.text)({
    x: "100",
    y: "113",
    'text-anchor': "middle",
    ...{ class: "donut-lbl" },
});
/** @type {__VLS_StyleScopedClasses['donut-lbl']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "legend-list" },
});
/** @type {__VLS_StyleScopedClasses['legend-list']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.openJobList('RUNNING');
            // @ts-ignore
            [jobStatsTotal, jobStatsTotal, jobStats, jobStats, jobStats, jobStats, jobStatsPercentages, jobStatsPercentages, jobStatsPercentages, jobStatsPercentages, jobStatsPercentages, jobStatsPercentages, jobStatsPercentages, jobStatsPercentages, jobStatsPercentages, jobStatsPercentages, openJobList,];
        } },
    ...{ class: "legend-row" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['legend-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "dot" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['dot']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-label" },
});
/** @type {__VLS_StyleScopedClasses['leg-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-val" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['leg-val']} */ ;
(__VLS_ctx.jobStats.running);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.openJobList('PENDING');
            // @ts-ignore
            [jobStats, openJobList,];
        } },
    ...{ class: "legend-row" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['legend-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "dot" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['dot']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-label" },
});
/** @type {__VLS_StyleScopedClasses['leg-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-val" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['leg-val']} */ ;
(__VLS_ctx.jobStats.pending);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.openJobList('COMPLETED');
            // @ts-ignore
            [jobStats, openJobList,];
        } },
    ...{ class: "legend-row" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['legend-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "dot" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['dot']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-label" },
});
/** @type {__VLS_StyleScopedClasses['leg-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-val" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['leg-val']} */ ;
(__VLS_ctx.jobStats.completed);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.openJobList('FAILED');
            // @ts-ignore
            [jobStats, openJobList,];
        } },
    ...{ class: "legend-row" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['legend-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "dot" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['dot']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-label" },
});
/** @type {__VLS_StyleScopedClasses['leg-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-val" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['leg-val']} */ ;
(__VLS_ctx.jobStats.failed);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card chart-card" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['chart-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "chart-card-header" },
});
/** @type {__VLS_StyleScopedClasses['chart-card-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    'stroke-width': "2",
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
    ...{ style: {} },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
    cx: "12",
    cy: "12",
    r: "10",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.polyline)({
    points: "12 6 12 12 16 14",
});
if (__VLS_ctx.accountQuotaList.length > 1) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.selectedAccountIdx),
        ...{ class: "quota-select" },
    });
    /** @type {__VLS_StyleScopedClasses['quota-select']} */ ;
    for (const [a, i] of __VLS_vFor((__VLS_ctx.accountQuotaList))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (i),
            value: (i),
        });
        (a.account);
        // @ts-ignore
        [jobStats, accountQuotaList, accountQuotaList, selectedAccountIdx,];
    }
}
if (__VLS_ctx.accountQuotaList.length > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chart-body" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "donut-wrap" },
    });
    /** @type {__VLS_StyleScopedClasses['donut-wrap']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        viewBox: "0 0 200 200",
        ...{ class: "donut-svg" },
    });
    /** @type {__VLS_StyleScopedClasses['donut-svg']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "100",
        cy: "100",
        r: "70",
        fill: "none",
        stroke: "#f3f4f6",
        'stroke-width': "32",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "100",
        cy: "100",
        r: "70",
        fill: "none",
        stroke: (__VLS_ctx.currentAccountQuota.cpuPct > 90 ? '#ef4444' : __VLS_ctx.currentAccountQuota.cpuPct > 70 ? '#f59e0b' : '#667eea'),
        'stroke-width': "32",
        'stroke-dasharray': (`${__VLS_ctx.currentAccountQuota.cpuPct * 4.4} 440`),
        'stroke-dashoffset': "0",
        transform: "rotate(-90 100 100)",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.text, __VLS_intrinsics.text)({
        x: "100",
        y: "88",
        'text-anchor': "middle",
        ...{ class: "donut-num" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['donut-num']} */ ;
    (__VLS_ctx.currentAccountQuota.cpuPct);
    __VLS_asFunctionalElement1(__VLS_intrinsics.text, __VLS_intrinsics.text)({
        x: "100",
        y: "108",
        'text-anchor': "middle",
        ...{ class: "donut-lbl" },
    });
    /** @type {__VLS_StyleScopedClasses['donut-lbl']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.text, __VLS_intrinsics.text)({
        x: "100",
        y: "124",
        'text-anchor': "middle",
        ...{ style: {} },
    });
    (__VLS_ctx.currentAccountQuota.account);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "legend-list" },
    });
    /** @type {__VLS_StyleScopedClasses['legend-list']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "legend-row" },
    });
    /** @type {__VLS_StyleScopedClasses['legend-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "dot" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['dot']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "leg-label" },
    });
    /** @type {__VLS_StyleScopedClasses['leg-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "leg-val" },
    });
    /** @type {__VLS_StyleScopedClasses['leg-val']} */ ;
    (__VLS_ctx.currentAccountQuota.maxCpus > 0 ? __VLS_ctx.currentAccountQuota.maxCpus + ' 核' : '无限制');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "legend-row" },
    });
    /** @type {__VLS_StyleScopedClasses['legend-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "dot" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['dot']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "leg-label" },
    });
    /** @type {__VLS_StyleScopedClasses['leg-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "leg-val" },
    });
    /** @type {__VLS_StyleScopedClasses['leg-val']} */ ;
    (__VLS_ctx.currentAccountQuota.maxNodes > 0 ? __VLS_ctx.currentAccountQuota.maxNodes + ' 个' : '无限制');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "legend-row" },
    });
    /** @type {__VLS_StyleScopedClasses['legend-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "dot" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['dot']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "leg-label" },
    });
    /** @type {__VLS_StyleScopedClasses['leg-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "leg-val" },
    });
    /** @type {__VLS_StyleScopedClasses['leg-val']} */ ;
    (__VLS_ctx.currentAccountQuota.maxJobs > 0 ? __VLS_ctx.currentAccountQuota.maxJobs : '无限制');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "legend-row-full" },
    });
    /** @type {__VLS_StyleScopedClasses['legend-row-full']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "leg-small" },
    });
    /** @type {__VLS_StyleScopedClasses['leg-small']} */ ;
    (__VLS_ctx.currentAccountQuota.partition || '全部');
    (__VLS_ctx.currentAccountQuota.qos || '-');
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chart-empty" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-empty']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        width: "36",
        height: "36",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "#d1d5db",
        'stroke-width': "1.5",
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ style: {} },
    });
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card chart-card" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['chart-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "chart-card-header" },
});
/** @type {__VLS_StyleScopedClasses['chart-card-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    'stroke-width': "2",
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
    ...{ style: {} },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
    cx: "12",
    cy: "12",
    r: "10",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.polyline)({
    points: "12 6 12 12 16 14",
});
if (__VLS_ctx.machineTime.hasLimit) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.machineTime.hasLimit))
                    return;
                __VLS_ctx.showBillingHistory = true;
                // @ts-ignore
                [accountQuotaList, currentAccountQuota, currentAccountQuota, currentAccountQuota, currentAccountQuota, currentAccountQuota, currentAccountQuota, currentAccountQuota, currentAccountQuota, currentAccountQuota, currentAccountQuota, currentAccountQuota, currentAccountQuota, currentAccountQuota, machineTime, showBillingHistory,];
            } },
        ...{ class: "btn-link-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-link-sm']} */ ;
}
if (__VLS_ctx.machineTimeList.length > 1) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "qos-tabs" },
    });
    /** @type {__VLS_StyleScopedClasses['qos-tabs']} */ ;
    for (const [item, idx] of __VLS_vFor((__VLS_ctx.machineTimeList))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.machineTimeList.length > 1))
                        return;
                    __VLS_ctx.machineTimeIndex = idx;
                    __VLS_ctx.machineTime = item;
                    // @ts-ignore
                    [machineTime, machineTimeList, machineTimeList, machineTimeIndex,];
                } },
            key: (item.qosName),
            ...{ class: "qos-tab" },
            ...{ class: ({ active: __VLS_ctx.machineTimeIndex === idx }) },
        });
        /** @type {__VLS_StyleScopedClasses['qos-tab']} */ ;
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        (item.qosName);
        // @ts-ignore
        [machineTimeIndex,];
    }
}
if (__VLS_ctx.machineTime.hasLimit) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chart-body" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "donut-wrap" },
    });
    /** @type {__VLS_StyleScopedClasses['donut-wrap']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        viewBox: "0 0 200 200",
        ...{ class: "donut-svg" },
    });
    /** @type {__VLS_StyleScopedClasses['donut-svg']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "100",
        cy: "100",
        r: "70",
        fill: "none",
        stroke: "#f3f4f6",
        'stroke-width': "32",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "100",
        cy: "100",
        r: "70",
        fill: "none",
        stroke: (__VLS_ctx.machineTime.usageRate > 90 ? '#ef4444' : __VLS_ctx.machineTime.usageRate > 70 ? '#f59e0b' : '#667eea'),
        'stroke-width': "32",
        'stroke-dasharray': (`${Math.max(__VLS_ctx.machineTime.usageRate, __VLS_ctx.machineTime.usageRate > 0 ? 0.5 : 0) * 4.4} 440`),
        'stroke-dashoffset': "0",
        transform: "rotate(-90 100 100)",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.text, __VLS_intrinsics.text)({
        x: "100",
        y: "93",
        'text-anchor': "middle",
        ...{ class: "donut-num" },
    });
    /** @type {__VLS_StyleScopedClasses['donut-num']} */ ;
    (__VLS_ctx.machineTime.usageRate < 0.01 && __VLS_ctx.machineTime.usageRate > 0 ? '<0.01' : __VLS_ctx.machineTime.usageRate);
    __VLS_asFunctionalElement1(__VLS_intrinsics.text, __VLS_intrinsics.text)({
        x: "100",
        y: "113",
        'text-anchor': "middle",
        ...{ class: "donut-lbl" },
    });
    /** @type {__VLS_StyleScopedClasses['donut-lbl']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "legend-list" },
    });
    /** @type {__VLS_StyleScopedClasses['legend-list']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "legend-row" },
    });
    /** @type {__VLS_StyleScopedClasses['legend-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "dot" },
        ...{ style: ({ background: __VLS_ctx.machineTime.usageRate > 90 ? '#ef4444' : __VLS_ctx.machineTime.usageRate > 70 ? '#f59e0b' : '#667eea' }) },
    });
    /** @type {__VLS_StyleScopedClasses['dot']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "leg-label" },
    });
    /** @type {__VLS_StyleScopedClasses['leg-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "leg-val" },
    });
    /** @type {__VLS_StyleScopedClasses['leg-val']} */ ;
    (__VLS_ctx.machineTime.used);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "legend-row" },
    });
    /** @type {__VLS_StyleScopedClasses['legend-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "dot" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['dot']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "leg-label" },
    });
    /** @type {__VLS_StyleScopedClasses['leg-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "leg-val" },
    });
    /** @type {__VLS_StyleScopedClasses['leg-val']} */ ;
    (__VLS_ctx.machineTime.remaining);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "legend-row-full" },
    });
    /** @type {__VLS_StyleScopedClasses['legend-row-full']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "leg-small" },
    });
    /** @type {__VLS_StyleScopedClasses['leg-small']} */ ;
    (__VLS_ctx.machineTime.totalQuota.toLocaleString());
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chart-empty" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-empty']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        width: "36",
        height: "36",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "#d1d5db",
        'stroke-width': "1.5",
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "12",
        cy: "12",
        r: "10",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.polyline)({
        points: "12 6 12 12 16 14",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ style: {} },
    });
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card chart-card" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['chart-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "chart-card-header" },
});
/** @type {__VLS_StyleScopedClasses['chart-card-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    'stroke-width': "2",
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
    ...{ style: {} },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.ellipse)({
    cx: "12",
    cy: "5",
    rx: "9",
    ry: "3",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M21 12c0 1.66-4 3-9 3s-9-1.34-9-3",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5",
});
if (__VLS_ctx.storageQuota.hasData) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chart-body" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "donut-wrap" },
    });
    /** @type {__VLS_StyleScopedClasses['donut-wrap']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        viewBox: "0 0 200 200",
        ...{ class: "donut-svg" },
    });
    /** @type {__VLS_StyleScopedClasses['donut-svg']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "100",
        cy: "100",
        r: "70",
        fill: "none",
        stroke: "#f3f4f6",
        'stroke-width': "32",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "100",
        cy: "100",
        r: "70",
        fill: "none",
        stroke: (__VLS_ctx.storageQuota.capacity.percentage > 90 ? '#ef4444' : __VLS_ctx.storageQuota.capacity.percentage > 80 ? '#f59e0b' : '#667eea'),
        'stroke-width': "32",
        'stroke-dasharray': (`${Math.max(__VLS_ctx.storageQuota.capacity.percentage, __VLS_ctx.storageQuota.capacity.percentage > 0 ? 1 : 0) * 4.4} 440`),
        'stroke-dashoffset': "0",
        transform: "rotate(-90 100 100)",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.text, __VLS_intrinsics.text)({
        x: "100",
        y: "93",
        'text-anchor': "middle",
        ...{ class: "donut-num" },
    });
    /** @type {__VLS_StyleScopedClasses['donut-num']} */ ;
    (__VLS_ctx.storageQuota.capacity.percentage);
    __VLS_asFunctionalElement1(__VLS_intrinsics.text, __VLS_intrinsics.text)({
        x: "100",
        y: "113",
        'text-anchor': "middle",
        ...{ class: "donut-lbl" },
    });
    /** @type {__VLS_StyleScopedClasses['donut-lbl']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "legend-list" },
    });
    /** @type {__VLS_StyleScopedClasses['legend-list']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "legend-row" },
    });
    /** @type {__VLS_StyleScopedClasses['legend-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "dot" },
        ...{ style: ({ background: __VLS_ctx.storageQuota.capacity.percentage > 90 ? '#ef4444' : __VLS_ctx.storageQuota.capacity.percentage > 80 ? '#f59e0b' : '#667eea' }) },
    });
    /** @type {__VLS_StyleScopedClasses['dot']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "leg-label" },
    });
    /** @type {__VLS_StyleScopedClasses['leg-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "leg-val" },
    });
    /** @type {__VLS_StyleScopedClasses['leg-val']} */ ;
    (__VLS_ctx.storageQuota.capacity.used);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "legend-row" },
    });
    /** @type {__VLS_StyleScopedClasses['legend-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "dot" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['dot']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "leg-label" },
    });
    /** @type {__VLS_StyleScopedClasses['leg-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "leg-val" },
    });
    /** @type {__VLS_StyleScopedClasses['leg-val']} */ ;
    (__VLS_ctx.storageQuota.capacity.total);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "legend-row-full" },
    });
    /** @type {__VLS_StyleScopedClasses['legend-row-full']} */ ;
    if (__VLS_ctx.storageQuota.files.noLimit) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "leg-small" },
        });
        /** @type {__VLS_StyleScopedClasses['leg-small']} */ ;
        (__VLS_ctx.storageQuota.files.used.toLocaleString());
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "leg-small" },
        });
        /** @type {__VLS_StyleScopedClasses['leg-small']} */ ;
        (__VLS_ctx.storageQuota.files.used.toLocaleString());
        (__VLS_ctx.storageQuota.files.total.toLocaleString());
        (__VLS_ctx.storageQuota.files.percentage);
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chart-empty" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-empty']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        width: "36",
        height: "36",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "#d1d5db",
        'stroke-width': "1.5",
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.ellipse)({
        cx: "12",
        cy: "5",
        rx: "9",
        ry: "3",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "M21 12c0 1.66-4 3-9 3s-9-1.34-9-3",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ style: {} },
    });
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stats-grid" },
});
/** @type {__VLS_StyleScopedClasses['stats-grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-card" },
});
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-card-left" },
});
/** @type {__VLS_StyleScopedClasses['stat-card-left']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-icon-wrap stat-icon-blue" },
});
/** @type {__VLS_StyleScopedClasses['stat-icon-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-icon-blue']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "22",
    height: "22",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    'stroke-width': "1.8",
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
    x: "2",
    y: "3",
    width: "20",
    height: "14",
    rx: "2",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "8",
    y1: "21",
    x2: "16",
    y2: "21",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "12",
    y1: "17",
    x2: "12",
    y2: "21",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-content" },
});
/** @type {__VLS_StyleScopedClasses['stat-content']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-value-row" },
});
/** @type {__VLS_StyleScopedClasses['stat-value-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "stat-value" },
});
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
(__VLS_ctx.stats.nodesOnline);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "stat-sep" },
});
/** @type {__VLS_StyleScopedClasses['stat-sep']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "stat-total" },
});
/** @type {__VLS_StyleScopedClasses['stat-total']} */ ;
(__VLS_ctx.stats.nodes);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-detail" },
});
/** @type {__VLS_StyleScopedClasses['stat-detail']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-ring-wrap" },
});
/** @type {__VLS_StyleScopedClasses['stat-ring-wrap']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "64",
    height: "64",
    viewBox: "0 0 64 64",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
    cx: "32",
    cy: "32",
    r: "26",
    fill: "none",
    stroke: "#e5e7eb",
    'stroke-width': "5",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
    cx: "32",
    cy: "32",
    r: "26",
    fill: "none",
    stroke: "#3b82f6",
    'stroke-width': "5",
    'stroke-dasharray': (`${__VLS_ctx.stats.nodes > 0 ? (__VLS_ctx.stats.nodesOnline / __VLS_ctx.stats.nodes) * 163.4 : 0} 163.4`),
    'stroke-dashoffset': "0",
    transform: "rotate(-90 32 32)",
    'stroke-linecap': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.text, __VLS_intrinsics.text)({
    x: "32",
    y: "37",
    'text-anchor': "middle",
    ...{ style: {} },
});
(__VLS_ctx.stats.nodes > 0 ? Math.round(__VLS_ctx.stats.nodesOnline / __VLS_ctx.stats.nodes * 100) : 0);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-card" },
});
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-card-left" },
});
/** @type {__VLS_StyleScopedClasses['stat-card-left']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-icon-wrap stat-icon-green" },
});
/** @type {__VLS_StyleScopedClasses['stat-icon-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-icon-green']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "22",
    height: "22",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    'stroke-width': "1.8",
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
    x: "4",
    y: "4",
    width: "16",
    height: "16",
    rx: "2",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
    x: "9",
    y: "9",
    width: "6",
    height: "6",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "9",
    y1: "1",
    x2: "9",
    y2: "4",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "15",
    y1: "1",
    x2: "15",
    y2: "4",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "9",
    y1: "20",
    x2: "9",
    y2: "23",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "15",
    y1: "20",
    x2: "15",
    y2: "23",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "20",
    y1: "9",
    x2: "23",
    y2: "9",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "20",
    y1: "14",
    x2: "23",
    y2: "14",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "1",
    y1: "9",
    x2: "4",
    y2: "9",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "1",
    y1: "14",
    x2: "4",
    y2: "14",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-content" },
});
/** @type {__VLS_StyleScopedClasses['stat-content']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-value-row" },
});
/** @type {__VLS_StyleScopedClasses['stat-value-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "stat-value" },
});
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
(__VLS_ctx.stats.cpuUsage);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "stat-sep" },
});
/** @type {__VLS_StyleScopedClasses['stat-sep']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "stat-total" },
});
/** @type {__VLS_StyleScopedClasses['stat-total']} */ ;
(__VLS_ctx.stats.cpuCores);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-detail" },
});
/** @type {__VLS_StyleScopedClasses['stat-detail']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-ring-wrap" },
});
/** @type {__VLS_StyleScopedClasses['stat-ring-wrap']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "64",
    height: "64",
    viewBox: "0 0 64 64",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
    cx: "32",
    cy: "32",
    r: "26",
    fill: "none",
    stroke: "#e5e7eb",
    'stroke-width': "5",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
    cx: "32",
    cy: "32",
    r: "26",
    fill: "none",
    stroke: "#10b981",
    'stroke-width': "5",
    'stroke-dasharray': (`${__VLS_ctx.stats.cpuCores > 0 ? (__VLS_ctx.stats.cpuUsage / __VLS_ctx.stats.cpuCores) * 163.4 : 0} 163.4`),
    'stroke-dashoffset': "0",
    transform: "rotate(-90 32 32)",
    'stroke-linecap': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.text, __VLS_intrinsics.text)({
    x: "32",
    y: "37",
    'text-anchor': "middle",
    ...{ style: {} },
});
(__VLS_ctx.stats.cpuCores > 0 ? Math.round(__VLS_ctx.stats.cpuUsage / __VLS_ctx.stats.cpuCores * 100) : 0);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-card" },
});
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-card-left" },
});
/** @type {__VLS_StyleScopedClasses['stat-card-left']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-icon-wrap stat-icon-purple" },
});
/** @type {__VLS_StyleScopedClasses['stat-icon-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-icon-purple']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "22",
    height: "22",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    'stroke-width': "1.8",
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M6 3h12l4 6-10 13L2 9z",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M11 3L8 9l4 13 4-13-3-6",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "2",
    y1: "9",
    x2: "22",
    y2: "9",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-content" },
});
/** @type {__VLS_StyleScopedClasses['stat-content']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-value-row" },
});
/** @type {__VLS_StyleScopedClasses['stat-value-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "stat-value" },
});
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
(__VLS_ctx.stats.gpuInUse);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "stat-sep" },
});
/** @type {__VLS_StyleScopedClasses['stat-sep']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "stat-total" },
});
/** @type {__VLS_StyleScopedClasses['stat-total']} */ ;
(__VLS_ctx.stats.gpuCards);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-detail" },
});
/** @type {__VLS_StyleScopedClasses['stat-detail']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-ring-wrap" },
});
/** @type {__VLS_StyleScopedClasses['stat-ring-wrap']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "64",
    height: "64",
    viewBox: "0 0 64 64",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
    cx: "32",
    cy: "32",
    r: "26",
    fill: "none",
    stroke: "#e5e7eb",
    'stroke-width': "5",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
    cx: "32",
    cy: "32",
    r: "26",
    fill: "none",
    stroke: "#8b5cf6",
    'stroke-width': "5",
    'stroke-dasharray': (`${__VLS_ctx.stats.gpuCards > 0 ? (__VLS_ctx.stats.gpuInUse / __VLS_ctx.stats.gpuCards) * 163.4 : 0} 163.4`),
    'stroke-dashoffset': "0",
    transform: "rotate(-90 32 32)",
    'stroke-linecap': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.text, __VLS_intrinsics.text)({
    x: "32",
    y: "37",
    'text-anchor': "middle",
    ...{ style: {} },
});
(__VLS_ctx.stats.gpuCards > 0 ? Math.round(__VLS_ctx.stats.gpuInUse / __VLS_ctx.stats.gpuCards * 100) : 0);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-card" },
});
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-card-left" },
});
/** @type {__VLS_StyleScopedClasses['stat-card-left']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-icon-wrap stat-icon-cyan" },
});
/** @type {__VLS_StyleScopedClasses['stat-icon-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-icon-cyan']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "22",
    height: "22",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    'stroke-width': "1.8",
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.ellipse)({
    cx: "12",
    cy: "5",
    rx: "9",
    ry: "3",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M21 12c0 1.66-4 3-9 3s-9-1.34-9-3",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-content" },
});
/** @type {__VLS_StyleScopedClasses['stat-content']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-value-row" },
});
/** @type {__VLS_StyleScopedClasses['stat-value-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "stat-value" },
});
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
(__VLS_ctx.formatMemory(__VLS_ctx.stats.memory - __VLS_ctx.stats.memoryFree));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "stat-sep" },
});
/** @type {__VLS_StyleScopedClasses['stat-sep']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "stat-total" },
});
/** @type {__VLS_StyleScopedClasses['stat-total']} */ ;
(__VLS_ctx.formatMemory(__VLS_ctx.stats.memory));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-detail" },
});
/** @type {__VLS_StyleScopedClasses['stat-detail']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-ring-wrap" },
});
/** @type {__VLS_StyleScopedClasses['stat-ring-wrap']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "64",
    height: "64",
    viewBox: "0 0 64 64",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
    cx: "32",
    cy: "32",
    r: "26",
    fill: "none",
    stroke: "#e5e7eb",
    'stroke-width': "5",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
    cx: "32",
    cy: "32",
    r: "26",
    fill: "none",
    stroke: "#06b6d4",
    'stroke-width': "5",
    'stroke-dasharray': (`${__VLS_ctx.stats.memory > 0 ? ((__VLS_ctx.stats.memory - __VLS_ctx.stats.memoryFree) / __VLS_ctx.stats.memory) * 163.4 : 0} 163.4`),
    'stroke-dashoffset': "0",
    transform: "rotate(-90 32 32)",
    'stroke-linecap': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.text, __VLS_intrinsics.text)({
    x: "32",
    y: "37",
    'text-anchor': "middle",
    ...{ style: {} },
});
(__VLS_ctx.stats.memory > 0 ? Math.round((__VLS_ctx.stats.memory - __VLS_ctx.stats.memoryFree) / __VLS_ctx.stats.memory * 100) : 0);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-card" },
});
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-card-left" },
});
/** @type {__VLS_StyleScopedClasses['stat-card-left']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-icon-wrap stat-icon-orange" },
});
/** @type {__VLS_StyleScopedClasses['stat-icon-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-icon-orange']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "22",
    height: "22",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    'stroke-width': "1.8",
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.polyline)({
    points: "14 2 14 8 20 8",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "16",
    y1: "13",
    x2: "8",
    y2: "13",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "16",
    y1: "17",
    x2: "8",
    y2: "17",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-content" },
});
/** @type {__VLS_StyleScopedClasses['stat-content']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-value-row" },
});
/** @type {__VLS_StyleScopedClasses['stat-value-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "stat-value" },
});
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
(__VLS_ctx.jobStats.running);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-detail-tags" },
});
/** @type {__VLS_StyleScopedClasses['stat-detail-tags']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "tag-pending" },
});
/** @type {__VLS_StyleScopedClasses['tag-pending']} */ ;
(__VLS_ctx.jobStats.pending);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "tag-done" },
});
/** @type {__VLS_StyleScopedClasses['tag-done']} */ ;
(__VLS_ctx.jobStats.completed);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-sparkline" },
});
/** @type {__VLS_StyleScopedClasses['stat-sparkline']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "60",
    height: "36",
    viewBox: "0 0 80 40",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.defs, __VLS_intrinsics.defs)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.linearGradient, __VLS_intrinsics.linearGradient)({
    id: "sparkGrad",
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.stop)({
    offset: "0%",
    'stop-color': "#f97316",
    'stop-opacity': "0.15",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.stop)({
    offset: "100%",
    'stop-color': "#f97316",
    'stop-opacity': "0",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.polygon)({
    points: "0,35 20,28 40,20 60,15 80,10 80,40 0,40",
    fill: "url(#sparkGrad)",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.polyline)({
    points: "0,35 20,28 40,20 60,15 80,10",
    fill: "none",
    stroke: "#f97316",
    'stroke-width': "2",
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "running-jobs-header" },
});
/** @type {__VLS_StyleScopedClasses['running-jobs-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    'stroke-width': "2",
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
    ...{ style: {} },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.polygon)({
    points: "5 3 19 12 5 21 5 3",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "running-jobs-meta" },
});
/** @type {__VLS_StyleScopedClasses['running-jobs-meta']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "running-count" },
});
/** @type {__VLS_StyleScopedClasses['running-count']} */ ;
(__VLS_ctx.runningJobs.length);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.loadJobStats) },
    ...{ class: "btn-link-sm" },
    disabled: (__VLS_ctx.jobStatsLoading),
});
/** @type {__VLS_StyleScopedClasses['btn-link-sm']} */ ;
(__VLS_ctx.jobStatsLoading ? '刷新中...' : '🔄 刷新');
if (__VLS_ctx.runningJobs.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "running-empty" },
    });
    /** @type {__VLS_StyleScopedClasses['running-empty']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
        ...{ class: "nodes-table" },
    });
    /** @type {__VLS_StyleScopedClasses['nodes-table']} */ ;
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
    for (const [job] of __VLS_vFor((__VLS_ctx.runningJobs))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (job.job_id),
            ...{ class: "running-job-row" },
        });
        /** @type {__VLS_StyleScopedClasses['running-job-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
        (job.job_id);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (job.name || '-');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (job.partition || '-');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (job.num_nodes || '-');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (job.cpus || '-');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "elapsed-badge" },
        });
        /** @type {__VLS_StyleScopedClasses['elapsed-badge']} */ ;
        (__VLS_ctx.formatElapsed(job.run_time));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.runningJobs.length === 0))
                        return;
                    __VLS_ctx.openJobDetail(job);
                    // @ts-ignore
                    [jobStatsLoading, jobStatsLoading, jobStats, jobStats, jobStats, machineTime, machineTime, machineTime, machineTime, machineTime, machineTime, machineTime, machineTime, machineTime, machineTime, machineTime, machineTime, machineTime, storageQuota, storageQuota, storageQuota, storageQuota, storageQuota, storageQuota, storageQuota, storageQuota, storageQuota, storageQuota, storageQuota, storageQuota, storageQuota, storageQuota, storageQuota, stats, stats, stats, stats, stats, stats, stats, stats, stats, stats, stats, stats, stats, stats, stats, stats, stats, stats, stats, stats, stats, stats, stats, stats, stats, stats, stats, stats, stats, stats, stats, stats, stats, stats, stats, formatMemory, formatMemory, runningJobs, runningJobs, runningJobs, loadJobStats, formatElapsed, openJobDetail,];
                } },
            ...{ class: "btn-detail" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-detail']} */ ;
        // @ts-ignore
        [];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "section-header" },
});
/** @type {__VLS_StyleScopedClasses['section-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "section-title-row" },
});
/** @type {__VLS_StyleScopedClasses['section-title-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "section-dot" },
});
/** @type {__VLS_StyleScopedClasses['section-dot']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "section-badge" },
});
/** @type {__VLS_StyleScopedClasses['section-badge']} */ ;
(__VLS_ctx.nodes.length);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nodes-grid" },
});
/** @type {__VLS_StyleScopedClasses['nodes-grid']} */ ;
for (const [node] of __VLS_vFor((__VLS_ctx.nodes))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (node.name),
        ...{ class: "node-card" },
    });
    /** @type {__VLS_StyleScopedClasses['node-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "node-card-header" },
    });
    /** @type {__VLS_StyleScopedClasses['node-card-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "node-name" },
    });
    /** @type {__VLS_StyleScopedClasses['node-name']} */ ;
    (node.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: (['node-status-dot', `dot-${node.status}`]) },
    });
    /** @type {__VLS_StyleScopedClasses['node-status-dot']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "node-metric" },
    });
    /** @type {__VLS_StyleScopedClasses['node-metric']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "node-metric-row" },
    });
    /** @type {__VLS_StyleScopedClasses['node-metric-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "node-metric-label" },
    });
    /** @type {__VLS_StyleScopedClasses['node-metric-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "node-metric-val" },
    });
    /** @type {__VLS_StyleScopedClasses['node-metric-val']} */ ;
    (node.cpuUsage);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "node-bar" },
    });
    /** @type {__VLS_StyleScopedClasses['node-bar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "node-bar-fill node-bar-cpu" },
        ...{ style: ({ width: node.cpuUsage + '%' }) },
    });
    /** @type {__VLS_StyleScopedClasses['node-bar-fill']} */ ;
    /** @type {__VLS_StyleScopedClasses['node-bar-cpu']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "node-metric" },
    });
    /** @type {__VLS_StyleScopedClasses['node-metric']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "node-metric-row" },
    });
    /** @type {__VLS_StyleScopedClasses['node-metric-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "node-metric-label" },
    });
    /** @type {__VLS_StyleScopedClasses['node-metric-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "node-metric-val" },
    });
    /** @type {__VLS_StyleScopedClasses['node-metric-val']} */ ;
    (node.memUsage);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "node-bar" },
    });
    /** @type {__VLS_StyleScopedClasses['node-bar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "node-bar-fill node-bar-mem" },
        ...{ style: ({ width: node.memUsage + '%' }) },
    });
    /** @type {__VLS_StyleScopedClasses['node-bar-fill']} */ ;
    /** @type {__VLS_StyleScopedClasses['node-bar-mem']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "node-metric" },
    });
    /** @type {__VLS_StyleScopedClasses['node-metric']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "node-metric-row" },
    });
    /** @type {__VLS_StyleScopedClasses['node-metric-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "node-metric-label" },
    });
    /** @type {__VLS_StyleScopedClasses['node-metric-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "node-metric-val" },
    });
    /** @type {__VLS_StyleScopedClasses['node-metric-val']} */ ;
    (node.jobs);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "node-status-label" },
        ...{ class: (`status-label-${node.status}`) },
    });
    /** @type {__VLS_StyleScopedClasses['node-status-label']} */ ;
    (node.statusText);
    // @ts-ignore
    [nodes, nodes,];
}
if (__VLS_ctx.nodes.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "nodes-empty" },
    });
    /** @type {__VLS_StyleScopedClasses['nodes-empty']} */ ;
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
if (__VLS_ctx.showJobHistory) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showJobHistory))
                    return;
                __VLS_ctx.showJobHistory = false;
                // @ts-ignore
                [showJobHistory, showJobHistory, nodes,];
            } },
        ...{ class: "modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal modal-xl" },
    });
    /** @type {__VLS_StyleScopedClasses['modal']} */ ;
    /** @type {__VLS_StyleScopedClasses['modal-xl']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "date",
        ...{ class: "filter-select" },
        title: "开始时间",
    });
    (__VLS_ctx.jobStartDate);
    /** @type {__VLS_StyleScopedClasses['filter-select']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "date",
        ...{ class: "filter-select" },
        title: "结束时间",
    });
    (__VLS_ctx.jobEndDate);
    /** @type {__VLS_StyleScopedClasses['filter-select']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.jobHistoryFilter),
        ...{ class: "filter-select" },
    });
    /** @type {__VLS_StyleScopedClasses['filter-select']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "RUNNING",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "PENDING",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "COMPLETED",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "FAILED",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "CANCELLED",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.loadJobHistory) },
        ...{ class: "btn-query" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-query']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "column-selector-wrap" },
    });
    /** @type {__VLS_StyleScopedClasses['column-selector-wrap']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showJobHistory))
                    return;
                __VLS_ctx.showColumnSelector = !__VLS_ctx.showColumnSelector;
                // @ts-ignore
                [jobStartDate, jobEndDate, jobHistoryFilter, loadJobHistory, showColumnSelector, showColumnSelector,];
            } },
        ...{ class: "btn-columns" },
        title: "自选列",
    });
    /** @type {__VLS_StyleScopedClasses['btn-columns']} */ ;
    if (__VLS_ctx.showColumnSelector) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onClick: () => { } },
            ...{ class: "column-selector-dropdown" },
        });
        /** @type {__VLS_StyleScopedClasses['column-selector-dropdown']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "column-selector-header" },
        });
        /** @type {__VLS_StyleScopedClasses['column-selector-header']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "column-options-list" },
        });
        /** @type {__VLS_StyleScopedClasses['column-options-list']} */ ;
        for (const [col] of __VLS_vFor((__VLS_ctx.visibleColumns))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                key: (col.key),
                ...{ class: "column-option" },
            });
            /** @type {__VLS_StyleScopedClasses['column-option']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                type: "checkbox",
            });
            (col.visible);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (col.label);
            // @ts-ignore
            [showColumnSelector, visibleColumns,];
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.exportJobExcel) },
        ...{ class: "btn-export" },
        title: "导出 Excel",
    });
    /** @type {__VLS_StyleScopedClasses['btn-export']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showJobHistory))
                    return;
                __VLS_ctx.showJobHistory = false;
                // @ts-ignore
                [showJobHistory, exportJobExcel,];
            } },
        ...{ class: "btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    if (__VLS_ctx.jobHistoryLoading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "modal-loading" },
        });
        /** @type {__VLS_StyleScopedClasses['modal-loading']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
            ...{ class: "data-table" },
        });
        /** @type {__VLS_StyleScopedClasses['data-table']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
        if (__VLS_ctx.isColumnVisible('job_id')) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        }
        if (__VLS_ctx.isColumnVisible('name')) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        }
        if (__VLS_ctx.isColumnVisible('user')) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        }
        if (__VLS_ctx.isColumnVisible('job_state')) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        }
        if (__VLS_ctx.isColumnVisible('partition')) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        }
        if (__VLS_ctx.isColumnVisible('num_nodes')) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        }
        if (__VLS_ctx.isColumnVisible('cpus')) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        }
        if (__VLS_ctx.isColumnVisible('submit_time')) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.showJobHistory))
                            return;
                        if (!!(__VLS_ctx.jobHistoryLoading))
                            return;
                        if (!(__VLS_ctx.isColumnVisible('submit_time')))
                            return;
                        __VLS_ctx.toggleSort('submit_time');
                        // @ts-ignore
                        [jobHistoryLoading, isColumnVisible, isColumnVisible, isColumnVisible, isColumnVisible, isColumnVisible, isColumnVisible, isColumnVisible, isColumnVisible, toggleSort,];
                    } },
                ...{ class: "sortable" },
            });
            /** @type {__VLS_StyleScopedClasses['sortable']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "sort-icon" },
            });
            /** @type {__VLS_StyleScopedClasses['sort-icon']} */ ;
            (__VLS_ctx.getSortIcon('submit_time'));
        }
        if (__VLS_ctx.isColumnVisible('start_time')) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.showJobHistory))
                            return;
                        if (!!(__VLS_ctx.jobHistoryLoading))
                            return;
                        if (!(__VLS_ctx.isColumnVisible('start_time')))
                            return;
                        __VLS_ctx.toggleSort('start_time');
                        // @ts-ignore
                        [isColumnVisible, toggleSort, getSortIcon,];
                    } },
                ...{ class: "sortable" },
            });
            /** @type {__VLS_StyleScopedClasses['sortable']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "sort-icon" },
            });
            /** @type {__VLS_StyleScopedClasses['sort-icon']} */ ;
            (__VLS_ctx.getSortIcon('start_time'));
        }
        if (__VLS_ctx.isColumnVisible('end_time')) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.showJobHistory))
                            return;
                        if (!!(__VLS_ctx.jobHistoryLoading))
                            return;
                        if (!(__VLS_ctx.isColumnVisible('end_time')))
                            return;
                        __VLS_ctx.toggleSort('end_time');
                        // @ts-ignore
                        [isColumnVisible, toggleSort, getSortIcon,];
                    } },
                ...{ class: "sortable" },
            });
            /** @type {__VLS_StyleScopedClasses['sortable']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "sort-icon" },
            });
            /** @type {__VLS_StyleScopedClasses['sort-icon']} */ ;
            (__VLS_ctx.getSortIcon('end_time'));
        }
        if (__VLS_ctx.isColumnVisible('run_time')) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
        for (const [job] of __VLS_vFor((__VLS_ctx.filteredJobHistory))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.showJobHistory))
                            return;
                        if (!!(__VLS_ctx.jobHistoryLoading))
                            return;
                        __VLS_ctx.openJobDetail(job);
                        // @ts-ignore
                        [openJobDetail, isColumnVisible, getSortIcon, filteredJobHistory,];
                    } },
                key: (job.job_id),
                ...{ class: "clickable-row" },
            });
            /** @type {__VLS_StyleScopedClasses['clickable-row']} */ ;
            if (__VLS_ctx.isColumnVisible('job_id')) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
                (job.job_id);
            }
            if (__VLS_ctx.isColumnVisible('name')) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                (job.name || '-');
            }
            if (__VLS_ctx.isColumnVisible('user')) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "user-tag" },
                });
                /** @type {__VLS_StyleScopedClasses['user-tag']} */ ;
                (job.user_id || job.user_name || job.user || '-');
            }
            if (__VLS_ctx.isColumnVisible('job_state')) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: (['state-badge', `state-${(job.job_state || '').toLowerCase()}`]) },
                });
                /** @type {__VLS_StyleScopedClasses['state-badge']} */ ;
                (job.job_state);
            }
            if (__VLS_ctx.isColumnVisible('partition')) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                (job.partition || '-');
            }
            if (__VLS_ctx.isColumnVisible('num_nodes')) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                (job.num_nodes || '-');
            }
            if (__VLS_ctx.isColumnVisible('cpus')) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                (job.cpus || '-');
            }
            if (__VLS_ctx.isColumnVisible('submit_time')) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                (__VLS_ctx.formatTime(job.submit_time));
            }
            if (__VLS_ctx.isColumnVisible('start_time')) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                (__VLS_ctx.formatTime(job.start_time));
            }
            if (__VLS_ctx.isColumnVisible('end_time')) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                (__VLS_ctx.formatTime(job.end_time));
            }
            if (__VLS_ctx.isColumnVisible('run_time')) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                (__VLS_ctx.formatElapsed(job.run_time));
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ onClick: () => { } },
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.showJobHistory))
                            return;
                        if (!!(__VLS_ctx.jobHistoryLoading))
                            return;
                        __VLS_ctx.openJobDetail(job);
                        // @ts-ignore
                        [formatElapsed, openJobDetail, isColumnVisible, isColumnVisible, isColumnVisible, isColumnVisible, isColumnVisible, isColumnVisible, isColumnVisible, isColumnVisible, isColumnVisible, isColumnVisible, isColumnVisible, formatTime, formatTime, formatTime,];
                    } },
                ...{ class: "btn-detail" },
            });
            /** @type {__VLS_StyleScopedClasses['btn-detail']} */ ;
            // @ts-ignore
            [];
        }
        if (__VLS_ctx.filteredJobHistory.length === 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                colspan: (__VLS_ctx.visibleColumns.filter(c => c.visible).length + 1),
                ...{ class: "empty-cell" },
            });
            /** @type {__VLS_StyleScopedClasses['empty-cell']} */ ;
        }
    }
}
// @ts-ignore
[visibleColumns, filteredJobHistory,];
var __VLS_3;
if (__VLS_ctx.selectedJob) {
    const __VLS_6 = JobDetailModal;
    // @ts-ignore
    const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
        ...{ 'onClose': {} },
        ...{ 'onCancel': {} },
        ...{ 'onPause': {} },
        ...{ 'onResume': {} },
        ...{ 'onOpenDirectory': {} },
        job: (__VLS_ctx.selectedJob),
    }));
    const __VLS_8 = __VLS_7({
        ...{ 'onClose': {} },
        ...{ 'onCancel': {} },
        ...{ 'onPause': {} },
        ...{ 'onResume': {} },
        ...{ 'onOpenDirectory': {} },
        job: (__VLS_ctx.selectedJob),
    }, ...__VLS_functionalComponentArgsRest(__VLS_7));
    let __VLS_11;
    const __VLS_12 = ({ close: {} },
        { onClose: (...[$event]) => {
                if (!(__VLS_ctx.selectedJob))
                    return;
                __VLS_ctx.selectedJob = null;
                // @ts-ignore
                [selectedJob, selectedJob, selectedJob,];
            } });
    const __VLS_13 = ({ cancel: {} },
        { onCancel: (__VLS_ctx.cancelJob) });
    const __VLS_14 = ({ pause: {} },
        { onPause: (__VLS_ctx.suspendJob) });
    const __VLS_15 = ({ resume: {} },
        { onResume: (__VLS_ctx.resumeJob) });
    const __VLS_16 = ({ openDirectory: {} },
        { onOpenDirectory: (...[$event]) => {
                if (!(__VLS_ctx.selectedJob))
                    return;
                __VLS_ctx.selectedJob = null;
                // @ts-ignore
                [selectedJob, cancelJob, suspendJob, resumeJob,];
            } });
    var __VLS_9;
    var __VLS_10;
}
let __VLS_17;
/** @ts-ignore @type {typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_18 = __VLS_asFunctionalComponent1(__VLS_17, new __VLS_17({
    to: "body",
}));
const __VLS_19 = __VLS_18({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_18));
const { default: __VLS_22 } = __VLS_20.slots;
if (__VLS_ctx.showBillingHistory) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showBillingHistory))
                    return;
                __VLS_ctx.showBillingHistory = false;
                // @ts-ignore
                [showBillingHistory, showBillingHistory,];
            } },
        ...{ class: "modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal modal-xl" },
    });
    /** @type {__VLS_StyleScopedClasses['modal']} */ ;
    /** @type {__VLS_StyleScopedClasses['modal-xl']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "date",
        ...{ class: "filter-select" },
    });
    (__VLS_ctx.billingStartDate);
    /** @type {__VLS_StyleScopedClasses['filter-select']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "date",
        ...{ class: "filter-select" },
    });
    (__VLS_ctx.billingEndDate);
    /** @type {__VLS_StyleScopedClasses['filter-select']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.loadBillingHistory) },
        ...{ class: "btn-query" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-query']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.exportBillingExcel) },
        ...{ class: "btn-export" },
        title: "导出 Excel",
    });
    /** @type {__VLS_StyleScopedClasses['btn-export']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showBillingHistory))
                    return;
                __VLS_ctx.showBillingHistory = false;
                // @ts-ignore
                [showBillingHistory, billingStartDate, billingEndDate, loadBillingHistory, exportBillingExcel,];
            } },
        ...{ class: "btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    if (__VLS_ctx.billingLoading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "modal-loading" },
        });
        /** @type {__VLS_StyleScopedClasses['modal-loading']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "billing-summary" },
        });
        /** @type {__VLS_StyleScopedClasses['billing-summary']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "bs-item" },
        });
        /** @type {__VLS_StyleScopedClasses['bs-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "bs-label" },
        });
        /** @type {__VLS_StyleScopedClasses['bs-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "bs-val" },
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['bs-val']} */ ;
        ((__VLS_ctx.billingTotalMins / 60).toFixed(1));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "bs-item" },
        });
        /** @type {__VLS_StyleScopedClasses['bs-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "bs-label" },
        });
        /** @type {__VLS_StyleScopedClasses['bs-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "bs-val" },
        });
        /** @type {__VLS_StyleScopedClasses['bs-val']} */ ;
        (__VLS_ctx.billingValidRecords.length);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "bs-item" },
        });
        /** @type {__VLS_StyleScopedClasses['bs-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "bs-label" },
        });
        /** @type {__VLS_StyleScopedClasses['bs-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "bs-val" },
        });
        /** @type {__VLS_StyleScopedClasses['bs-val']} */ ;
        (__VLS_ctx.billingCpuHours.toFixed(2));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "bs-item" },
        });
        /** @type {__VLS_StyleScopedClasses['bs-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "bs-label" },
        });
        /** @type {__VLS_StyleScopedClasses['bs-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "bs-val" },
        });
        /** @type {__VLS_StyleScopedClasses['bs-val']} */ ;
        (__VLS_ctx.billingGpuHours.toFixed(2));
        __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
            ...{ class: "data-table" },
        });
        /** @type {__VLS_StyleScopedClasses['data-table']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
        for (const [r] of __VLS_vFor((__VLS_ctx.billingValidRecords))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                key: (r.job_id),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
            (r.job_id || '-');
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            (r.job_name || '-');
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            (r.account);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            (r.partition || '-');
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            (r.qos || '-');
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: (['state-badge', `state-${(r.state || '').toLowerCase()}`]) },
            });
            /** @type {__VLS_StyleScopedClasses['state-badge']} */ ;
            (r.state || '-');
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            (__VLS_ctx.formatTime(r.start_time));
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            (__VLS_ctx.formatTime(r.end_time));
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            (__VLS_ctx.formatElapsed(r.elapsed_secs));
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            ((r.cpu_hours || 0).toFixed(2));
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            ((r.gpu_hours || 0).toFixed(2));
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({
                ...{ style: {} },
            });
            ((((r.billing_mins || 0) || (r.billing_hours || 0) * 60 || (r.cpu_hours || 0) * 60) / 60).toFixed(1));
            // @ts-ignore
            [formatElapsed, formatTime, formatTime, billingLoading, billingTotalMins, billingValidRecords, billingValidRecords, billingCpuHours, billingGpuHours,];
        }
        if (__VLS_ctx.billingValidRecords.length === 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                colspan: "12",
                ...{ class: "empty-cell" },
            });
            /** @type {__VLS_StyleScopedClasses['empty-cell']} */ ;
        }
    }
}
// @ts-ignore
[billingValidRecords,];
var __VLS_20;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
