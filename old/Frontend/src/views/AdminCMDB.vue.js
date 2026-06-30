/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import notification from '../utils/notification';
import { dialog } from '../utils/dialog';
const ROLES = ['登录节点', '计算节点', 'GPU节点', '存储节点', '管理节点', '监控节点', '网络设备', '其他'];
const hosts = ref([]);
const loading = ref(false);
const showModal = ref(false);
const editMode = ref(false);
const viewMode = ref(false);
const saving = ref(false);
const fileInput = ref();
const importMsg = ref(null);
const filters = ref({ q: '', role: '', status: '' });
const emptyForm = () => ({
    hostname: '', ips: [{ address: '', type: '业务口' }], os: '',
    cpu_model: '', cpu_cores: 0, memory_gb: 0, disk_desc: '',
    role: '', rack: '', rack_unit: '', status: 'online',
    vendor: '', model: '', sn: '', purchase_date: '', warranty_date: '', remark: '',
});
const form = ref(emptyForm());
const editId = ref('');
const stats = computed(() => {
    const all = hosts.value;
    return [
        { label: '总主机', value: all.length, cls: '' },
        { label: '在线', value: all.filter(h => h.status === 'online').length, cls: 'stat-ok' },
        { label: '离线', value: all.filter(h => h.status === 'offline').length, cls: all.some(h => h.status === 'offline') ? 'stat-err' : '' },
        { label: '维护中', value: all.filter(h => h.status === 'maintenance').length, cls: 'stat-warn' },
        { label: '计算节点', value: all.filter(h => h.role === '计算节点').length, cls: '' },
        { label: 'GPU节点', value: all.filter(h => h.role === 'GPU节点').length, cls: '' },
    ];
});
async function loadHosts() {
    loading.value = true;
    try {
        const params = {};
        if (filters.value.q)
            params.q = filters.value.q;
        if (filters.value.role)
            params.role = filters.value.role;
        if (filters.value.status)
            params.status = filters.value.status;
        const res = await axios.get('/cmdb/hosts', { params });
        hosts.value = res.data.data || [];
    }
    catch (e) {
        notification.error(e.response?.data?.error || e.message, '加载失败');
    }
    finally {
        loading.value = false;
    }
}
function resetFilters() {
    filters.value = { q: '', role: '', status: '' };
    loadHosts();
}
function openCreate() {
    form.value = emptyForm();
    editMode.value = false;
    viewMode.value = false;
    editId.value = '';
    showModal.value = true;
}
function openEdit(h) {
    form.value = JSON.parse(JSON.stringify(h));
    if (!form.value.ips?.length)
        form.value.ips = [{ address: '', type: '业务口' }];
    editMode.value = true;
    viewMode.value = false;
    editId.value = h.id;
    showModal.value = true;
}
function viewHost(h) {
    form.value = JSON.parse(JSON.stringify(h));
    editMode.value = false;
    viewMode.value = true;
    editId.value = h.id;
    showModal.value = true;
}
async function saveHost() {
    if (!form.value.hostname.trim()) {
        notification.error('主机名不能为空');
        return;
    }
    saving.value = true;
    try {
        const payload = { ...form.value };
        payload.ips = payload.ips.filter((ip) => ip.address.trim());
        if (editMode.value) {
            await axios.put(`/cmdb/hosts/${editId.value}`, payload);
            notification.success('更新成功');
        }
        else {
            await axios.post('/cmdb/hosts', payload);
            notification.success('新增成功');
        }
        showModal.value = false;
        loadHosts();
    }
    catch (e) {
        notification.error(e.response?.data?.error || e.message, '保存失败');
    }
    finally {
        saving.value = false;
    }
}
async function confirmDelete(h) {
    if (!await dialog.confirmDelete(h.hostname, '主机'))
        return;
    try {
        await axios.delete(`/cmdb/hosts/${h.id}`);
        notification.success('已删除');
        loadHosts();
    }
    catch (e) {
        notification.error(e.response?.data?.error || e.message, '删除失败');
    }
}
async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file)
        return;
    const fd = new FormData();
    fd.append('file', file);
    importMsg.value = null;
    try {
        const res = await axios.post('/cmdb/hosts/import', fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        importMsg.value = { text: res.data.message, type: 'msg-ok' };
        loadHosts();
    }
    catch (e) {
        importMsg.value = { text: e.response?.data?.error || '导入失败', type: 'msg-err' };
    }
    finally {
        if (fileInput.value)
            fileInput.value.value = '';
        setTimeout(() => { importMsg.value = null; }, 5000);
    }
}
const syncing = ref(false);
// 把 CMDB 主机同步到机柜图
async function syncToRack() {
    // 只处理有机柜信息的主机
    const withRack = hosts.value.filter(h => h.rack && h.rack_unit);
    if (withRack.length === 0) {
        notification.error('没有填写机柜信息的主机，请先在主机记录中填写机柜编号和机柜位置');
        return;
    }
    if (!await dialog.confirm(`将把 ${withRack.length} 台有机柜信息的主机同步到机柜图，已存在的设备会更新，确认继续？`, { title: '同步到机柜图' }))
        return;
    syncing.value = true;
    try {
        // 获取现有机柜列表
        const rackRes = await axios.get('/monitoring/rack');
        const existingRacks = rackRes.data.data || [];
        // 按机柜名分组
        const rackMap = new Map();
        for (const h of withRack) {
            if (!rackMap.has(h.rack))
                rackMap.set(h.rack, []);
            rackMap.get(h.rack).push(h);
        }
        let created = 0, updated = 0;
        for (const [rackName, rackHosts] of rackMap) {
            // 找或创建机柜
            let rack = existingRacks.find(r => r.name === rackName);
            if (!rack) {
                const res = await axios.post('/monitoring/rack', {
                    name: rackName, location: '数据中心', units: 42, devices: []
                });
                rack = res.data.data;
                existingRacks.push(rack);
                created++;
            }
            const devices = [...(rack.devices || [])];
            for (const h of rackHosts) {
                // 解析 U 位，如 "U12-U13" → unit=12, height=2；"U5" → unit=5, height=2
                const unitMatch = h.rack_unit.match(/[Uu](\d+)/);
                const unit = unitMatch ? parseInt(unitMatch[1]) : 1;
                const unitEndMatch = h.rack_unit.match(/[Uu]\d+-[Uu](\d+)/);
                const unitEnd = unitEndMatch ? parseInt(unitEndMatch[1]) : unit + 1;
                const height = Math.max(1, unitEnd - unit + 1);
                // 判断设备类型
                const role = (h.role || '').toLowerCase();
                let devType = 'compute';
                if (role.includes('gpu'))
                    devType = 'gpu';
                else if (role.includes('存储') || role.includes('storage'))
                    devType = 'storage';
                else if (role.includes('交换') || role.includes('switch'))
                    devType = 'switch';
                else if (role.includes('管理') || role.includes('登录'))
                    devType = 'compute';
                // 主 IP
                const mainIP = h.ips?.find((ip) => ip.type === '业务口' || ip.type === '管理口')?.address
                    || h.ips?.[0]?.address || '';
                const devData = {
                    name: h.hostname,
                    type: devType,
                    unit,
                    height,
                    ip: mainIP,
                    cpu_model: h.cpu_model || '',
                    mem_total: h.memory_gb ? h.memory_gb + 'GB' : '',
                    os: h.os || '',
                    sn: h.sn || '',
                    model: h.model || '',
                    remark: h.remark || '',
                    purchase_date: h.purchase_date || '',
                };
                // 按主机名找已有设备，有则更新，无则新增
                const existIdx = devices.findIndex(d => d.name === h.hostname);
                if (existIdx >= 0) {
                    devices[existIdx] = { ...devices[existIdx], ...devData };
                    updated++;
                }
                else {
                    devices.push({ ...devData, id: `dev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` });
                    updated++;
                }
            }
            await axios.put(`/monitoring/rack/${rack.id}`, { ...rack, devices });
        }
        notification.success(`同步完成：新建机柜 ${created} 个，更新/新增设备 ${updated} 台`);
    }
    catch (e) {
        notification.error(e.response?.data?.error || e.message, '同步失败');
    }
    finally {
        syncing.value = false;
    }
}
function downloadTemplate() {
    window.open(axios.defaults.baseURL + '/cmdb/hosts/template', '_blank');
}
function exportHosts() {
    window.open(axios.defaults.baseURL + '/cmdb/hosts/export', '_blank');
}
const shortCPU = (s) => s.length > 16 ? s.slice(0, 16) + '…' : s;
const statusLabel = (s) => ({ online: '在线', offline: '离线', maintenance: '维护中' }[s] || s);
const roleClass = (r) => ({
    '计算节点': 'role-compute', 'GPU节点': 'role-gpu', '登录节点': 'role-login',
    '存储节点': 'role-storage', '管理节点': 'role-mgmt',
}[r] || '');
onMounted(loadHosts);
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-input']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['host-table']} */ ;
/** @type {__VLS_StyleScopedClasses['host-table']} */ ;
/** @type {__VLS_StyleScopedClasses['host-row']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-import']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sync']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sync']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-add-ip']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "cmdb-page" },
});
/** @type {__VLS_StyleScopedClasses['cmdb-page']} */ ;
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
    ...{ onClick: (__VLS_ctx.downloadTemplate) },
    ...{ class: "btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "btn-import" },
});
/** @type {__VLS_StyleScopedClasses['btn-import']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: (__VLS_ctx.handleImport) },
    type: "file",
    accept: ".xlsx,.xls",
    ...{ style: {} },
    ref: "fileInput",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.exportHosts) },
    ...{ class: "btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.syncToRack) },
    ...{ class: "btn-sync" },
    disabled: (__VLS_ctx.syncing),
    title: "将有机柜信息的主机同步到机柜图",
});
/** @type {__VLS_StyleScopedClasses['btn-sync']} */ ;
(__VLS_ctx.syncing ? '同步中...' : '🗄️ 同步到机柜图');
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.openCreate) },
    ...{ class: "btn-primary" },
});
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "filter-bar" },
});
/** @type {__VLS_StyleScopedClasses['filter-bar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onInput: (__VLS_ctx.loadHosts) },
    placeholder: "🔍 搜索主机名/IP/机柜...",
    ...{ class: "filter-input" },
});
(__VLS_ctx.filters.q);
/** @type {__VLS_StyleScopedClasses['filter-input']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: (__VLS_ctx.loadHosts) },
    value: (__VLS_ctx.filters.role),
    ...{ class: "filter-select" },
});
/** @type {__VLS_StyleScopedClasses['filter-select']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
for (const [r] of __VLS_vFor((__VLS_ctx.ROLES))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (r),
        value: (r),
    });
    (r);
    // @ts-ignore
    [downloadTemplate, handleImport, exportHosts, syncToRack, syncing, syncing, openCreate, loadHosts, loadHosts, filters, filters, ROLES,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: (__VLS_ctx.loadHosts) },
    value: (__VLS_ctx.filters.status),
    ...{ class: "filter-select" },
});
/** @type {__VLS_StyleScopedClasses['filter-select']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "online",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "offline",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "maintenance",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.resetFilters) },
    ...{ class: "btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "total-badge" },
});
/** @type {__VLS_StyleScopedClasses['total-badge']} */ ;
(__VLS_ctx.hosts.length);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-cards" },
});
/** @type {__VLS_StyleScopedClasses['stat-cards']} */ ;
for (const [s] of __VLS_vFor((__VLS_ctx.stats))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stat-card" },
        key: (s.label),
        ...{ class: (s.cls) },
    });
    /** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stat-num" },
    });
    /** @type {__VLS_StyleScopedClasses['stat-num']} */ ;
    (s.value);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stat-label" },
    });
    /** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
    (s.label);
    // @ts-ignore
    [loadHosts, filters, resetFilters, hosts, stats,];
}
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "loading" },
    });
    /** @type {__VLS_StyleScopedClasses['loading']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "table-wrap" },
    });
    /** @type {__VLS_StyleScopedClasses['table-wrap']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
        ...{ class: "host-table" },
    });
    /** @type {__VLS_StyleScopedClasses['host-table']} */ ;
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
    for (const [h] of __VLS_vFor((__VLS_ctx.hosts))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    __VLS_ctx.viewHost(h);
                    // @ts-ignore
                    [hosts, loading, viewHost,];
                } },
            key: (h.id),
            ...{ class: "host-row" },
        });
        /** @type {__VLS_StyleScopedClasses['host-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "hostname-cell" },
        });
        /** @type {__VLS_StyleScopedClasses['hostname-cell']} */ ;
        (h.hostname);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "ip-cell" },
        });
        /** @type {__VLS_StyleScopedClasses['ip-cell']} */ ;
        for (const [ip] of __VLS_vFor((h.ips))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                key: (ip.address),
                ...{ class: "ip-tag" },
                title: (ip.type),
            });
            /** @type {__VLS_StyleScopedClasses['ip-tag']} */ ;
            (ip.address);
            // @ts-ignore
            [];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (h.os || '-');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "cpu-cell" },
        });
        /** @type {__VLS_StyleScopedClasses['cpu-cell']} */ ;
        if (h.cpu_cores) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (h.cpu_cores);
        }
        if (h.cpu_model) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "cpu-model" },
                title: (h.cpu_model),
            });
            /** @type {__VLS_StyleScopedClasses['cpu-model']} */ ;
            (__VLS_ctx.shortCPU(h.cpu_model));
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (h.memory_gb ? h.memory_gb + 'GB' : '-');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "role-badge" },
            ...{ class: (__VLS_ctx.roleClass(h.role)) },
        });
        /** @type {__VLS_StyleScopedClasses['role-badge']} */ ;
        (h.role || '-');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (h.rack || '-');
        (h.rack_unit ? ' ' + h.rack_unit : '');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "status-dot" },
            ...{ class: ('status-' + h.status) },
            title: (__VLS_ctx.statusLabel(h.status)),
        });
        /** @type {__VLS_StyleScopedClasses['status-dot']} */ ;
        (__VLS_ctx.statusLabel(h.status));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ onClick: () => { } },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    __VLS_ctx.openEdit(h);
                    // @ts-ignore
                    [shortCPU, roleClass, statusLabel, statusLabel, openEdit,];
                } },
            ...{ class: "btn-link" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    __VLS_ctx.confirmDelete(h);
                    // @ts-ignore
                    [confirmDelete,];
                } },
            ...{ class: "btn-link danger" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
        /** @type {__VLS_StyleScopedClasses['danger']} */ ;
        // @ts-ignore
        [];
    }
    if (__VLS_ctx.hosts.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "empty-state" },
        });
        /** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
    }
}
if (__VLS_ctx.importMsg) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "import-msg" },
        ...{ class: (__VLS_ctx.importMsg.type) },
    });
    /** @type {__VLS_StyleScopedClasses['import-msg']} */ ;
    (__VLS_ctx.importMsg.text);
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
if (__VLS_ctx.showModal) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal" },
    });
    /** @type {__VLS_StyleScopedClasses['modal']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    (__VLS_ctx.editMode ? '编辑主机' : (__VLS_ctx.viewMode ? '主机详情' : '新增主机'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showModal))
                    return;
                __VLS_ctx.showModal = false;
                // @ts-ignore
                [hosts, importMsg, importMsg, importMsg, showModal, showModal, editMode, viewMode,];
            } },
        ...{ class: "btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-grid" },
    });
    /** @type {__VLS_StyleScopedClasses['form-grid']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        disabled: (__VLS_ctx.viewMode),
        placeholder: "cn001",
    });
    (__VLS_ctx.form.hostname);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        disabled: (__VLS_ctx.viewMode),
        placeholder: "CentOS 7.9",
    });
    (__VLS_ctx.form.os);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group full" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    /** @type {__VLS_StyleScopedClasses['full']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ip-list" },
    });
    /** @type {__VLS_StyleScopedClasses['ip-list']} */ ;
    for (const [ip, i] of __VLS_vFor((__VLS_ctx.form.ips))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (i),
            ...{ class: "ip-row" },
        });
        /** @type {__VLS_StyleScopedClasses['ip-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            disabled: (__VLS_ctx.viewMode),
            placeholder: "192.168.1.1",
            ...{ class: "ip-input" },
        });
        (ip.address);
        /** @type {__VLS_StyleScopedClasses['ip-input']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            disabled: (__VLS_ctx.viewMode),
            placeholder: "业务口",
            ...{ class: "ip-type-input" },
        });
        (ip.type);
        /** @type {__VLS_StyleScopedClasses['ip-type-input']} */ ;
        if (!__VLS_ctx.viewMode) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.showModal))
                            return;
                        if (!(!__VLS_ctx.viewMode))
                            return;
                        __VLS_ctx.form.ips.splice(i, 1);
                        // @ts-ignore
                        [viewMode, viewMode, viewMode, viewMode, viewMode, form, form, form, form,];
                    } },
                ...{ class: "btn-rm" },
            });
            /** @type {__VLS_StyleScopedClasses['btn-rm']} */ ;
        }
        // @ts-ignore
        [];
    }
    if (!__VLS_ctx.viewMode) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showModal))
                        return;
                    if (!(!__VLS_ctx.viewMode))
                        return;
                    __VLS_ctx.form.ips.push({ address: '', type: '业务口' });
                    // @ts-ignore
                    [viewMode, form,];
                } },
            ...{ class: "btn-add-ip" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-add-ip']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        disabled: (__VLS_ctx.viewMode),
        placeholder: "Intel Xeon Gold 6248R",
    });
    (__VLS_ctx.form.cpu_model);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        disabled: (__VLS_ctx.viewMode),
        type: "number",
        placeholder: "40",
    });
    (__VLS_ctx.form.cpu_cores);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        disabled: (__VLS_ctx.viewMode),
        type: "number",
        placeholder: "256",
    });
    (__VLS_ctx.form.memory_gb);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        disabled: (__VLS_ctx.viewMode),
        placeholder: "2×960GB SSD",
    });
    (__VLS_ctx.form.disk_desc);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.form.role),
        disabled: (__VLS_ctx.viewMode),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    for (const [r] of __VLS_vFor((__VLS_ctx.ROLES))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (r),
            value: (r),
        });
        (r);
        // @ts-ignore
        [ROLES, viewMode, viewMode, viewMode, viewMode, viewMode, form, form, form, form, form,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.form.status),
        disabled: (__VLS_ctx.viewMode),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "online",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "offline",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "maintenance",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        disabled: (__VLS_ctx.viewMode),
        placeholder: "A01",
    });
    (__VLS_ctx.form.rack);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        disabled: (__VLS_ctx.viewMode),
        placeholder: "U12-U13",
    });
    (__VLS_ctx.form.rack_unit);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        disabled: (__VLS_ctx.viewMode),
        placeholder: "浪潮",
    });
    (__VLS_ctx.form.vendor);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        disabled: (__VLS_ctx.viewMode),
        placeholder: "NF5280M6",
    });
    (__VLS_ctx.form.model);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        disabled: (__VLS_ctx.viewMode),
        placeholder: "SN123456",
    });
    (__VLS_ctx.form.sn);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        disabled: (__VLS_ctx.viewMode),
        type: "date",
    });
    (__VLS_ctx.form.purchase_date);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        disabled: (__VLS_ctx.viewMode),
        type: "date",
    });
    (__VLS_ctx.form.warranty_date);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group full" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    /** @type {__VLS_StyleScopedClasses['full']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
        value: (__VLS_ctx.form.remark),
        disabled: (__VLS_ctx.viewMode),
        rows: "2",
        placeholder: "备注信息",
    });
    if (!__VLS_ctx.viewMode) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "modal-footer" },
        });
        /** @type {__VLS_StyleScopedClasses['modal-footer']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showModal))
                        return;
                    if (!(!__VLS_ctx.viewMode))
                        return;
                    __VLS_ctx.showModal = false;
                    // @ts-ignore
                    [showModal, viewMode, viewMode, viewMode, viewMode, viewMode, viewMode, viewMode, viewMode, viewMode, viewMode, form, form, form, form, form, form, form, form, form,];
                } },
            ...{ class: "btn-secondary" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.saveHost) },
            ...{ class: "btn-primary" },
            disabled: (__VLS_ctx.saving),
        });
        /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
        (__VLS_ctx.saving ? '保存中...' : '保存');
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "modal-footer" },
        });
        /** @type {__VLS_StyleScopedClasses['modal-footer']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showModal))
                        return;
                    if (!!(!__VLS_ctx.viewMode))
                        return;
                    __VLS_ctx.showModal = false;
                    // @ts-ignore
                    [showModal, saveHost, saving, saving,];
                } },
            ...{ class: "btn-secondary" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showModal))
                        return;
                    if (!!(!__VLS_ctx.viewMode))
                        return;
                    __VLS_ctx.viewMode = false;
                    __VLS_ctx.editMode = true;
                    // @ts-ignore
                    [editMode, viewMode,];
                } },
            ...{ class: "btn-primary" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    }
}
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
