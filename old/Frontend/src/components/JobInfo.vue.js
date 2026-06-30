/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted } from 'vue';
import { getUser, getApiBase, isAdmin } from '../utils/auth';
import notification from '../utils/notification';
import { dialog } from '../utils/dialog';
const emit = defineEmits(['view-detail', 'open-directory', 'submit-job']);
const viewMode = ref('my');
const statusFilter = ref('');
const partitionFilter = ref('');
const searchText = ref('');
const userFilter = ref('');
const partitions = ref([]);
const currentUserInfo = ref(null);
const currentUser = computed(() => currentUserInfo.value?.username || '');
const loading = ref(false);
const selectedIds = ref([]);
const summary = ref({ running: 0, pending: 0, queued: 0, completed: 0, failed: 0, userHeld: 0, sysHeld: 0 });
const allJobs = ref([]);
const pagination = ref({ page: 1, pageSize: 15, total: 0, totalPages: 0 });
const totalJobs = computed(() => allJobs.value.length);
const pageRange = computed(() => {
    const cur = pagination.value.page;
    const total = pagination.value.totalPages;
    if (total <= 7)
        return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [1];
    if (cur > 3)
        pages.push('...');
    for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++)
        pages.push(i);
    if (cur < total - 2)
        pages.push('...');
    pages.push(total);
    return pages;
});
const filteredJobs = computed(() => {
    let jobs = allJobs.value;
    if (viewMode.value === 'my')
        jobs = jobs.filter(j => j.user === currentUser.value);
    if (statusFilter.value)
        jobs = jobs.filter(j => j.status === statusFilter.value);
    if (partitionFilter.value)
        jobs = jobs.filter(j => j.partition === partitionFilter.value);
    if (searchText.value.trim()) {
        const q = searchText.value.trim().toLowerCase();
        jobs = jobs.filter(j => j.name?.toLowerCase().includes(q) || String(j.id).includes(q));
    }
    return jobs;
});
const allSelected = computed(() => filteredJobs.value.length > 0 && filteredJobs.value.every(j => selectedIds.value.includes(j.id)));
const toggleSelectAll = () => {
    if (allSelected.value) {
        selectedIds.value = selectedIds.value.filter(id => !filteredJobs.value.find(j => j.id === id));
    }
    else {
        const ids = filteredJobs.value.map(j => j.id);
        selectedIds.value = [...new Set([...selectedIds.value, ...ids])];
    }
};
const statusLabel = (s) => {
    const map = {
        RUNNING: '运行中', PENDING: '等待中', COMPLETED: '已完成',
        FAILED: '失败', CANCELLED: '已取消', TIMEOUT: '超时',
        SUSPENDED: '已挂起', UNKNOWN: '未知'
    };
    return map[s] || s;
};
const updateSummary = () => {
    const jobs = viewMode.value === 'my'
        ? allJobs.value.filter(j => j.user === currentUser.value)
        : allJobs.value;
    summary.value = {
        running: jobs.filter(j => j.status === 'RUNNING').length,
        pending: jobs.filter(j => j.status === 'PENDING').length,
        queued: jobs.filter(j => j.status === 'PENDING').length,
        completed: jobs.filter(j => j.status === 'COMPLETED').length,
        failed: jobs.filter(j => j.status === 'FAILED').length,
        userHeld: jobs.filter(j => j.status === 'SUSPENDED').length,
        sysHeld: 0,
    };
};
const canControlJob = (job) => currentUserInfo.value?.isAdmin || job.user === currentUser.value;
const cancelJob = async (job) => {
    if (!await dialog.confirm(`确定要取消作业 ${job.id} - ${job.name} 吗？`, { title: '取消作业', danger: true }))
        return;
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const res = await fetch(`${getApiBase()}/api/jobs/${job.id}`, {
            method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
            const d = await res.json();
            throw new Error(d.error || '取消失败');
        }
        notification.success('作业取消成功');
        await loadJobs();
    }
    catch (e) {
        notification.error(e.message || '取消失败');
    }
};
const batchAction = async (action) => {
    if (selectedIds.value.length === 0)
        return;
    const labels = { restart: '重启', suspend: '挂起', resume: '恢复', cancel: '停止' };
    if (!await dialog.confirm(`确定要${labels[action]}选中的 ${selectedIds.value.length} 个作业吗？`, { title: '批量操作' }))
        return;
    notification.success(`已发送${labels[action]}指令`);
    selectedIds.value = [];
};
const openDirectory = (job) => {
    if (!job.directory || job.directory === '-') {
        notification.error('作业目录不可用');
        return;
    }
    emit('open-directory', job.directory);
};
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
const loadJobs = async () => {
    loading.value = true;
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token)
            throw new Error('请先登录');
        let url = `${getApiBase()}/api/jobs?page=${pagination.value.page}&page_size=${pagination.value.pageSize}`;
        if (viewMode.value === 'my')
            url += `&user=${encodeURIComponent(currentUser.value)}`;
        else if (viewMode.value === 'all' && userFilter.value.trim())
            url += `&user=${encodeURIComponent(userFilter.value.trim())}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
            allJobs.value = [];
            updateSummary();
            return;
        }
        const result = await res.json();
        if (result.data && Array.isArray(result.data)) {
            allJobs.value = result.data.map((job) => {
                let runTime = 0;
                if (job.end_time && job.start_time && job.end_time > 0 && job.start_time > 0)
                    runTime = job.end_time - job.start_time;
                else if (job.start_time && job.start_time > 0)
                    runTime = Math.floor(Date.now() / 1000) - job.start_time;
                let nodeNames = [];
                if (typeof job.nodes === 'string' && job.nodes && job.nodes !== 'None assigned')
                    nodeNames = expandHostList(job.nodes);
                if (nodeNames.length === 0 && job.batch_host)
                    nodeNames = [job.batch_host];
                return {
                    id: job.job_id || job.id,
                    user: job.user_name || job.user,
                    name: job.name || `Job ${job.job_id || job.id}`,
                    status: job.job_state || job.status || 'UNKNOWN',
                    partition: job.partition || '-',
                    nodes: nodeNames.length || (typeof job.nodes === 'number' ? job.nodes : 0),
                    nodeNames,
                    cpus: job.cpus || 0,
                    jobType: job.job_type || 'batch',
                    submitTime: formatTime(job.submit_time),
                    startTime: formatTime(job.start_time),
                    start_time: job.start_time || 0,
                    runTime: formatDuration(runTime),
                    directory: job.work_dir || job.directory || '-',
                    account: job.account || '-',
                    timeLimit: job.time_limit || 0
                };
            });
            if (result.pagination) {
                pagination.value = {
                    page: result.pagination.page,
                    pageSize: result.pagination.page_size,
                    total: result.pagination.total,
                    totalPages: result.pagination.total_pages
                };
            }
        }
        else {
            allJobs.value = [];
        }
        updateSummary();
    }
    catch (e) {
        console.error('Failed to load jobs:', e);
        allJobs.value = [];
        updateSummary();
    }
    finally {
        loading.value = false;
    }
};
const changePage = (p) => {
    if (p >= 1 && p <= pagination.value.totalPages) {
        pagination.value.page = p;
        loadJobs();
    }
};
const formatTime = (ts) => {
    if (!ts || ts === 0)
        return '-';
    try {
        const d = new Date(ts * 1000);
        if (isNaN(d.getTime()))
            return '-';
        return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\//g, '-');
    }
    catch {
        return '-';
    }
};
const formatDuration = (s) => {
    if (!s || s <= 0)
        return '-';
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    if (d > 0)
        return `${d}天${h}时${m}分`;
    if (h > 0)
        return `${h}时${m}分`;
    if (m > 0)
        return `${m}分`;
    return `${s}秒`;
};
const loadPartitions = async () => {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token)
            return;
        const res = await fetch(`${getApiBase()}/api/jobs/partitions/list`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok)
            return;
        const result = await res.json();
        partitions.value = (result.data || []).map((p) => p.name).filter(Boolean);
    }
    catch {
        partitions.value = ['compute', 'gpu', 'memory', 'debug'];
    }
};
onMounted(() => {
    currentUserInfo.value = getUser();
    if (!isAdmin())
        viewMode.value = 'my';
    loadPartitions();
    loadJobs();
});
const __VLS_exposed = { loadJobs };
defineExpose(__VLS_exposed);
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
/** @type {__VLS_StyleScopedClasses['stat-block']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-submit']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-tool']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-tool']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-tool-danger']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-icon-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-icon-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-icon-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-icon-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['search-input']} */ ;
/** @type {__VLS_StyleScopedClasses['search-input']} */ ;
/** @type {__VLS_StyleScopedClasses['vs-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-sel']} */ ;
/** @type {__VLS_StyleScopedClasses['jobs-table']} */ ;
/** @type {__VLS_StyleScopedClasses['jobs-table']} */ ;
/** @type {__VLS_StyleScopedClasses['jobs-table']} */ ;
/** @type {__VLS_StyleScopedClasses['jobs-table']} */ ;
/** @type {__VLS_StyleScopedClasses['jobs-table']} */ ;
/** @type {__VLS_StyleScopedClasses['jobs-table']} */ ;
/** @type {__VLS_StyleScopedClasses['ra-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['ra-danger']} */ ;
/** @type {__VLS_StyleScopedClasses['page-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['page-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['page-num']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['page-num']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['page-num']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-row']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-block']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-row']} */ ;
/** @type {__VLS_StyleScopedClasses['search-wrap']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "job-info-wrap" },
});
/** @type {__VLS_StyleScopedClasses['job-info-wrap']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-row" },
});
/** @type {__VLS_StyleScopedClasses['stat-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-block" },
});
/** @type {__VLS_StyleScopedClasses['stat-block']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-block-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-block-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-block-value" },
});
/** @type {__VLS_StyleScopedClasses['stat-block-value']} */ ;
(__VLS_ctx.totalJobs);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-block" },
});
/** @type {__VLS_StyleScopedClasses['stat-block']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-block-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-block-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-sub-row" },
});
/** @type {__VLS_StyleScopedClasses['stat-sub-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "stat-tag tag-pending" },
});
/** @type {__VLS_StyleScopedClasses['stat-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['tag-pending']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "tag-dot dot-pending" },
});
/** @type {__VLS_StyleScopedClasses['tag-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['dot-pending']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-block-value" },
});
/** @type {__VLS_StyleScopedClasses['stat-block-value']} */ ;
(__VLS_ctx.summary.pending);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-block" },
});
/** @type {__VLS_StyleScopedClasses['stat-block']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-block-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-block-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-sub-row" },
});
/** @type {__VLS_StyleScopedClasses['stat-sub-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "stat-tag tag-queue" },
});
/** @type {__VLS_StyleScopedClasses['stat-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['tag-queue']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "tag-dot dot-queue" },
});
/** @type {__VLS_StyleScopedClasses['tag-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['dot-queue']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-block-value" },
});
/** @type {__VLS_StyleScopedClasses['stat-block-value']} */ ;
(__VLS_ctx.summary.queued);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-block stat-block-wide" },
});
/** @type {__VLS_StyleScopedClasses['stat-block']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-block-wide']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-block-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-block-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-exec-grid" },
});
/** @type {__VLS_StyleScopedClasses['stat-exec-grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-exec-item" },
});
/** @type {__VLS_StyleScopedClasses['stat-exec-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "stat-tag tag-running" },
});
/** @type {__VLS_StyleScopedClasses['stat-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['tag-running']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "tag-icon" },
});
/** @type {__VLS_StyleScopedClasses['tag-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-exec-val" },
});
/** @type {__VLS_StyleScopedClasses['stat-exec-val']} */ ;
(__VLS_ctx.summary.running);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-exec-item" },
});
/** @type {__VLS_StyleScopedClasses['stat-exec-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "stat-tag tag-userheld" },
});
/** @type {__VLS_StyleScopedClasses['stat-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['tag-userheld']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "tag-icon" },
});
/** @type {__VLS_StyleScopedClasses['tag-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-exec-val" },
});
/** @type {__VLS_StyleScopedClasses['stat-exec-val']} */ ;
(__VLS_ctx.summary.userHeld);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-exec-item" },
});
/** @type {__VLS_StyleScopedClasses['stat-exec-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "stat-tag tag-sysheld" },
});
/** @type {__VLS_StyleScopedClasses['stat-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['tag-sysheld']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "tag-icon" },
});
/** @type {__VLS_StyleScopedClasses['tag-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-exec-val" },
});
/** @type {__VLS_StyleScopedClasses['stat-exec-val']} */ ;
(__VLS_ctx.summary.sysHeld);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-block" },
});
/** @type {__VLS_StyleScopedClasses['stat-block']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-block-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-block-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-exec-grid" },
});
/** @type {__VLS_StyleScopedClasses['stat-exec-grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-exec-item" },
});
/** @type {__VLS_StyleScopedClasses['stat-exec-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "stat-tag tag-completed" },
});
/** @type {__VLS_StyleScopedClasses['stat-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['tag-completed']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "tag-icon" },
});
/** @type {__VLS_StyleScopedClasses['tag-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-exec-val" },
});
/** @type {__VLS_StyleScopedClasses['stat-exec-val']} */ ;
(__VLS_ctx.summary.completed);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-exec-item" },
});
/** @type {__VLS_StyleScopedClasses['stat-exec-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "stat-tag tag-failed" },
});
/** @type {__VLS_StyleScopedClasses['stat-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['tag-failed']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "tag-icon" },
});
/** @type {__VLS_StyleScopedClasses['tag-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-exec-val" },
});
/** @type {__VLS_StyleScopedClasses['stat-exec-val']} */ ;
(__VLS_ctx.summary.failed);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "toolbar-row" },
});
/** @type {__VLS_StyleScopedClasses['toolbar-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "toolbar-left" },
});
/** @type {__VLS_StyleScopedClasses['toolbar-left']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('submit-job');
            // @ts-ignore
            [totalJobs, summary, summary, summary, summary, summary, summary, summary, emit,];
        } },
    ...{ class: "btn-submit" },
});
/** @type {__VLS_StyleScopedClasses['btn-submit']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    'stroke-width': "3",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "12",
    y1: "5",
    x2: "12",
    y2: "19",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "5",
    y1: "12",
    x2: "19",
    y2: "12",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.batchAction('restart');
            // @ts-ignore
            [batchAction,];
        } },
    ...{ class: "btn-tool" },
    disabled: (__VLS_ctx.selectedIds.length === 0),
});
/** @type {__VLS_StyleScopedClasses['btn-tool']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.batchAction('suspend');
            // @ts-ignore
            [batchAction, selectedIds,];
        } },
    ...{ class: "btn-tool" },
    disabled: (__VLS_ctx.selectedIds.length === 0),
});
/** @type {__VLS_StyleScopedClasses['btn-tool']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.batchAction('resume');
            // @ts-ignore
            [batchAction, selectedIds,];
        } },
    ...{ class: "btn-tool" },
    disabled: (__VLS_ctx.selectedIds.length === 0),
});
/** @type {__VLS_StyleScopedClasses['btn-tool']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.batchAction('cancel');
            // @ts-ignore
            [batchAction, selectedIds,];
        } },
    ...{ class: "btn-tool btn-tool-danger" },
    disabled: (__VLS_ctx.selectedIds.length === 0),
});
/** @type {__VLS_StyleScopedClasses['btn-tool']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-tool-danger']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "toolbar-right" },
});
/** @type {__VLS_StyleScopedClasses['toolbar-right']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.loadJobs) },
    ...{ class: "btn-icon-sm" },
    disabled: (__VLS_ctx.loading),
    title: "刷新",
});
/** @type {__VLS_StyleScopedClasses['btn-icon-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    'stroke-width': "2.5",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M21 3v5h-5",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M8 16H3v5",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ class: "btn-icon-sm" },
    title: "导出",
});
/** @type {__VLS_StyleScopedClasses['btn-icon-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    'stroke-width': "2.5",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.polyline)({
    points: "7 10 12 15 17 10",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "12",
    y1: "15",
    x2: "12",
    y2: "3",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "filter-row" },
});
/** @type {__VLS_StyleScopedClasses['filter-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "search-wrap" },
});
/** @type {__VLS_StyleScopedClasses['search-wrap']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    ...{ class: "search-icon" },
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    'stroke-width': "2.5",
});
/** @type {__VLS_StyleScopedClasses['search-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
    cx: "11",
    cy: "11",
    r: "8",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "21",
    y1: "21",
    x2: "16.65",
    y2: "16.65",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onInput: (...[$event]) => {
            __VLS_ctx.pagination.page = 1;
            // @ts-ignore
            [selectedIds, loadJobs, loading, pagination,];
        } },
    ...{ class: "search-input" },
    placeholder: "默认按照作业名称搜索",
});
(__VLS_ctx.searchText);
/** @type {__VLS_StyleScopedClasses['search-input']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "filter-right" },
});
/** @type {__VLS_StyleScopedClasses['filter-right']} */ ;
if (__VLS_ctx.isAdmin()) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "view-switch" },
    });
    /** @type {__VLS_StyleScopedClasses['view-switch']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isAdmin()))
                    return;
                __VLS_ctx.viewMode = 'my';
                __VLS_ctx.userFilter = '';
                __VLS_ctx.pagination.page = 1;
                __VLS_ctx.loadJobs();
                // @ts-ignore
                [loadJobs, pagination, searchText, isAdmin, viewMode, userFilter,];
            } },
        ...{ class: (['vs-btn', { active: __VLS_ctx.viewMode === 'my' }]) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['vs-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isAdmin()))
                    return;
                __VLS_ctx.viewMode = 'all';
                __VLS_ctx.pagination.page = 1;
                __VLS_ctx.loadJobs();
                // @ts-ignore
                [loadJobs, pagination, viewMode, viewMode,];
            } },
        ...{ class: (['vs-btn', { active: __VLS_ctx.viewMode === 'all' }]) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['vs-btn']} */ ;
}
if (__VLS_ctx.viewMode === 'all' && __VLS_ctx.isAdmin()) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onInput: (...[$event]) => {
                if (!(__VLS_ctx.viewMode === 'all' && __VLS_ctx.isAdmin()))
                    return;
                __VLS_ctx.pagination.page = 1;
                __VLS_ctx.loadJobs();
                // @ts-ignore
                [loadJobs, pagination, isAdmin, viewMode, viewMode,];
            } },
        ...{ class: "filter-sel" },
        placeholder: "按用户名筛选...",
        ...{ style: {} },
    });
    (__VLS_ctx.userFilter);
    /** @type {__VLS_StyleScopedClasses['filter-sel']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: (...[$event]) => {
            __VLS_ctx.pagination.page = 1;
            // @ts-ignore
            [pagination, userFilter,];
        } },
    value: (__VLS_ctx.statusFilter),
    ...{ class: "filter-sel" },
});
/** @type {__VLS_StyleScopedClasses['filter-sel']} */ ;
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
    value: "SUSPENDED",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: (...[$event]) => {
            __VLS_ctx.pagination.page = 1;
            // @ts-ignore
            [pagination, statusFilter,];
        } },
    value: (__VLS_ctx.partitionFilter),
    ...{ class: "filter-sel" },
});
/** @type {__VLS_StyleScopedClasses['filter-sel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
for (const [p] of __VLS_vFor((__VLS_ctx.partitions))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (p),
        value: (p),
    });
    (p);
    // @ts-ignore
    [partitionFilter, partitions,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "table-wrap" },
});
/** @type {__VLS_StyleScopedClasses['table-wrap']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
    ...{ class: "jobs-table" },
});
/** @type {__VLS_StyleScopedClasses['jobs-table']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "th-check" },
});
/** @type {__VLS_StyleScopedClasses['th-check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: (__VLS_ctx.toggleSelectAll) },
    type: "checkbox",
    checked: (__VLS_ctx.allSelected),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
if (__VLS_ctx.viewMode === 'all') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
}
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "sort-icon" },
});
/** @type {__VLS_StyleScopedClasses['sort-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "sort-icon" },
});
/** @type {__VLS_StyleScopedClasses['sort-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "sort-icon" },
});
/** @type {__VLS_StyleScopedClasses['sort-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "sort-icon" },
});
/** @type {__VLS_StyleScopedClasses['sort-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "sort-icon" },
});
/** @type {__VLS_StyleScopedClasses['sort-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
for (const [job] of __VLS_vFor((__VLS_ctx.filteredJobs))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
        key: (job.id),
        ...{ class: ({ selected: __VLS_ctx.selectedIds.includes(job.id) }) },
    });
    /** @type {__VLS_StyleScopedClasses['selected']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "td-check" },
    });
    /** @type {__VLS_StyleScopedClasses['td-check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
        value: (job.id),
    });
    (__VLS_ctx.selectedIds);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "td-id" },
    });
    /** @type {__VLS_StyleScopedClasses['td-id']} */ ;
    (job.id);
    if (__VLS_ctx.viewMode === 'all') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (job.user);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "td-name" },
    });
    /** @type {__VLS_StyleScopedClasses['td-name']} */ ;
    (job.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: (['job-status', `js-${job.status.toLowerCase()}`]) },
    });
    /** @type {__VLS_StyleScopedClasses['job-status']} */ ;
    (__VLS_ctx.statusLabel(job.status));
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "td-type" },
    });
    /** @type {__VLS_StyleScopedClasses['td-type']} */ ;
    (job.jobType || 'batch');
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    (job.partition);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    (job.cpus);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "td-time" },
    });
    /** @type {__VLS_StyleScopedClasses['td-time']} */ ;
    (job.submitTime);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "td-time" },
    });
    /** @type {__VLS_StyleScopedClasses['td-time']} */ ;
    (job.startTime);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    (job.runTime);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['row-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.$emit('view-detail', job);
                // @ts-ignore
                [selectedIds, selectedIds, viewMode, viewMode, toggleSelectAll, allSelected, filteredJobs, statusLabel, $emit,];
            } },
        ...{ class: "ra-btn" },
        title: "详情",
    });
    /** @type {__VLS_StyleScopedClasses['ra-btn']} */ ;
    if ((job.status === 'RUNNING' || job.status === 'PENDING') && __VLS_ctx.canControlJob(job)) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!((job.status === 'RUNNING' || job.status === 'PENDING') && __VLS_ctx.canControlJob(job)))
                        return;
                    __VLS_ctx.cancelJob(job);
                    // @ts-ignore
                    [canControlJob, cancelJob,];
                } },
            ...{ class: "ra-btn ra-danger" },
            title: "取消",
        });
        /** @type {__VLS_StyleScopedClasses['ra-btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['ra-danger']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.openDirectory(job);
                // @ts-ignore
                [openDirectory,];
            } },
        ...{ class: "ra-btn" },
        title: "目录",
    });
    /** @type {__VLS_StyleScopedClasses['ra-btn']} */ ;
    // @ts-ignore
    [];
}
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tbl-empty" },
    });
    /** @type {__VLS_StyleScopedClasses['tbl-empty']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "spinner" },
    });
    /** @type {__VLS_StyleScopedClasses['spinner']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
}
else if (__VLS_ctx.filteredJobs.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tbl-empty" },
    });
    /** @type {__VLS_StyleScopedClasses['tbl-empty']} */ ;
}
if (__VLS_ctx.pagination.total > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pagination" },
    });
    /** @type {__VLS_StyleScopedClasses['pagination']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.pagination.total > 0))
                    return;
                __VLS_ctx.changePage(__VLS_ctx.pagination.page - 1);
                // @ts-ignore
                [loading, pagination, pagination, filteredJobs, changePage,];
            } },
        ...{ class: "page-btn" },
        disabled: (__VLS_ctx.pagination.page <= 1),
    });
    /** @type {__VLS_StyleScopedClasses['page-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "page-numbers" },
    });
    /** @type {__VLS_StyleScopedClasses['page-numbers']} */ ;
    for (const [p] of __VLS_vFor((__VLS_ctx.pageRange))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.pagination.total > 0))
                        return;
                    p !== '...' && __VLS_ctx.changePage(p);
                    // @ts-ignore
                    [pagination, changePage, pageRange,];
                } },
            key: (p),
            ...{ class: (['page-num', { active: p === __VLS_ctx.pagination.page, ellipsis: p === '...' }]) },
            disabled: (p === '...'),
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        /** @type {__VLS_StyleScopedClasses['ellipsis']} */ ;
        /** @type {__VLS_StyleScopedClasses['page-num']} */ ;
        (p);
        // @ts-ignore
        [pagination,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.pagination.total > 0))
                    return;
                __VLS_ctx.changePage(__VLS_ctx.pagination.page + 1);
                // @ts-ignore
                [pagination, changePage,];
            } },
        ...{ class: "page-btn" },
        disabled: (__VLS_ctx.pagination.page >= __VLS_ctx.pagination.totalPages),
    });
    /** @type {__VLS_StyleScopedClasses['page-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "page-info" },
    });
    /** @type {__VLS_StyleScopedClasses['page-info']} */ ;
    (__VLS_ctx.pagination.total);
}
// @ts-ignore
[pagination, pagination, pagination,];
const __VLS_export = (await import('vue')).defineComponent({
    setup: () => (__VLS_exposed),
    emits: {},
});
export default {};
