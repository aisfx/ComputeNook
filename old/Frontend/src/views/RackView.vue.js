/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue';
import { getApiBase } from '../utils/auth';
import { dialog } from '../utils/dialog';
const containerH = ref(600);
const racks = ref([]);
const nodes = ref([]);
const nodeMetrics = ref([]); // Prometheus 实时指标
const cmdbHosts = ref([]); // CMDB 主机列表
const loading = ref(false);
const rackLoading = ref(false);
const rackError = ref('');
const showRackModal = ref(false);
const showDeviceModal = ref(false);
const showCmdb = ref(false);
const devTab = ref('basic');
const editingRack = ref({ name: '', location: '', units: 42, devices: [] });
const editingDevice = ref({ name: '', type: 'compute', node_name: '', model: '', height: 2, unit: 1, ports: [] });
const editingRackId = ref('');
const cmdbSyncNode = ref('');
const cmdbSearch = ref('');
const cmdbTypeFilter = ref('');
const cmdbScanning = ref(false);
const cmdbImportHost = ref(''); // 从 CMDB 导入时选中的主机
const cables = ref(JSON.parse(localStorage.getItem('rack-cables') || '[]'));
const draggingCable = ref(false);
const dragFrom = ref(null);
const draggingPath = ref('');
const svgRef = ref(null);
const rackListRef = ref(null);
const svgWidth = ref(2000);
const svgHeight = ref(1000);
const maxUnits = computed(() => Math.max(...racks.value.map((r) => r.units || 42), 42));
const SLOT_H = computed(() => Math.max(12, Math.floor((containerH.value - 8) / maxUnits.value)));
const saveCables = () => localStorage.setItem('rack-cables', JSON.stringify(cables.value));
const token = () => localStorage.getItem('token') || sessionStorage.getItem('token') || '';
const CABLE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
const cableColor = (idx) => CABLE_COLORS[idx % CABLE_COLORS.length];
const getPortEl = (rackId, devId, portId) => document.querySelector(`[data-dev-id="${devId}"][data-rack-id="${rackId}"][data-port-id="${portId}"]`);
const getPortPos = (rackId, devId, portId, side) => {
    const el = getPortEl(rackId, devId, portId) || document.querySelector(`[data-dev-id="${devId}"][data-rack-id="${rackId}"]`);
    if (!el || !svgRef.value)
        return null;
    const sr = svgRef.value.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    return { x: side === 'right' ? er.right - sr.left : er.left - sr.left, y: er.top + er.height / 2 - sr.top };
};
const cableEndpoints = (cable) => ({
    from: getPortPos(cable.fromRack, cable.fromDev, cable.fromPort, 'right'),
    to: getPortPos(cable.toRack, cable.toDev, cable.toPort, 'left'),
});
const cablePath = (cable) => {
    const from = getPortPos(cable.fromRack, cable.fromDev, cable.fromPort, 'right');
    const to = getPortPos(cable.toRack, cable.toDev, cable.toPort, 'left');
    if (!from || !to)
        return '';
    const dx = to.x - from.x;
    if (Math.abs(dx) < 30) {
        const bulge = Math.max(50, Math.abs(to.y - from.y) * 0.4 + 40);
        return `M${from.x},${from.y} C${from.x + bulge},${from.y} ${to.x + bulge},${to.y} ${to.x},${to.y}`;
    }
    const cx = Math.abs(dx) * 0.5;
    return `M${from.x},${from.y} C${from.x + cx},${from.y} ${to.x - cx},${to.y} ${to.x},${to.y}`;
};
const cableLabel = (cable) => {
    const fromDev = racks.value.flatMap((r) => r.devices || []).find((d) => d.id === cable.fromDev);
    const toDev = racks.value.flatMap((r) => r.devices || []).find((d) => d.id === cable.toDev);
    return `${fromDev?.name || '?'}:${cable.fromPort}  ${toDev?.name || '?'}:${cable.toPort}`;
};
const isCablePort = (devId, portId) => cables.value.some(c => (c.fromDev === devId && c.fromPort === portId) || (c.toDev === devId && c.toPort === portId));
const portPinStyle = (pi, total) => {
    const pct = total <= 1 ? 50 : (pi / (total - 1)) * 80 + 10;
    return { top: pct + '%', right: '-5px', transform: 'translateY(-50%)' };
};
const startCable = (e, rackId, devId, portId) => {
    draggingCable.value = true;
    dragFrom.value = { rackId, devId, portId };
    e.preventDefault();
};
const onMouseMove = (e) => {
    if (!draggingCable.value || !dragFrom.value || !svgRef.value)
        return;
    const sr = svgRef.value.getBoundingClientRect();
    const mx = e.clientX - sr.left, my = e.clientY - sr.top;
    const from = getPortPos(dragFrom.value.rackId, dragFrom.value.devId, dragFrom.value.portId, 'right');
    if (!from)
        return;
    const dx = mx - from.x;
    const cx = Math.max(Math.abs(dx) * 0.5, 40);
    draggingPath.value = `M${from.x},${from.y} C${from.x + cx},${from.y} ${mx - cx},${my} ${mx},${my}`;
};
const onMouseUp = () => { draggingCable.value = false; dragFrom.value = null; draggingPath.value = ''; };
const endCable = (e, rackId, devId, portId) => {
    if (!draggingCable.value || !dragFrom.value)
        return;
    if (dragFrom.value.devId === devId && dragFrom.value.portId === portId)
        return;
    const exists = cables.value.find(c => (c.fromDev === dragFrom.value.devId && c.fromPort === dragFrom.value.portId && c.toDev === devId && c.toPort === portId) ||
        (c.fromDev === devId && c.fromPort === portId && c.toDev === dragFrom.value.devId && c.toPort === dragFrom.value.portId));
    if (!exists) {
        cables.value.push({ id: `cable-${Date.now()}`, fromRack: dragFrom.value.rackId, fromDev: dragFrom.value.devId, fromPort: dragFrom.value.portId, toRack: rackId, toDev: devId, toPort: portId });
        saveCables();
    }
    draggingCable.value = false;
    dragFrom.value = null;
    draggingPath.value = '';
};
const removeCable = (id) => {
    dialog.confirm('删除该连线？', { title: '确认删除', danger: true }).then(ok => {
        if (!ok)
            return;
        cables.value = cables.value.filter(c => c.id !== id);
        saveCables();
    });
};
const updateSvgSize = () => nextTick(() => {
    if (rackListRef.value) {
        svgWidth.value = rackListRef.value.scrollWidth + 100;
        svgHeight.value = rackListRef.value.scrollHeight + 100;
    }
});
const updateContainerH = () => {
    const el = rackListRef.value?.closest('.rack-scroll-area');
    containerH.value = el ? el.clientHeight - 4 : window.innerHeight - 160;
};
const loadAll = async () => {
    loading.value = true;
    try {
        const [rRes, nRes, mRes, cRes] = await Promise.allSettled([
            fetch(`${getApiBase()}/api/monitoring/rack`, { headers: { Authorization: `Bearer ${token()}` } }),
            fetch(`${getApiBase()}/api/dashboard/nodes`, { headers: { Authorization: `Bearer ${token()}` } }),
            fetch(`${getApiBase()}/api/monitoring/node-metrics`, { headers: { Authorization: `Bearer ${token()}` } }),
            fetch(`${getApiBase()}/api/cmdb/hosts`, { headers: { Authorization: `Bearer ${token()}` } }),
        ]);
        if (rRes.status === 'fulfilled' && rRes.value.ok)
            racks.value = (await rRes.value.json()).data || [];
        if (nRes.status === 'fulfilled' && nRes.value.ok)
            nodes.value = (await nRes.value.json()).data || [];
        if (mRes.status === 'fulfilled' && mRes.value.ok) {
            const d = await mRes.value.json();
            nodeMetrics.value = d.nodes || [];
        }
        if (cRes.status === 'fulfilled' && cRes.value.ok)
            cmdbHosts.value = (await cRes.value.json()).data || [];
    }
    finally {
        loading.value = false;
        updateContainerH();
        updateSvgSize();
    }
};
const nodeStateLabel = (nodeName) => {
    const n = nodes.value.find((x) => x.name === nodeName);
    if (!n)
        return '';
    const s = (n.state || '').toLowerCase();
    if (s.includes('down') || s.includes('drain'))
        return '🔴';
    if (s.includes('alloc') || s.includes('mix'))
        return '🟡';
    return '🟢';
};
// 从 Prometheus nodeMetrics 里查找设备对应的指标（按 node_name 或 IP 匹配）
const getDevMetrics = (dev) => {
    if (!nodeMetrics.value.length)
        return null;
    // 优先按 node_name 匹配
    if (dev.node_name) {
        const m = nodeMetrics.value.find((n) => n.instance && (n.instance.includes(dev.node_name) || dev.node_name.includes(n.instance.split(':')[0])));
        if (m)
            return m;
    }
    // 按 IP 匹配
    if (dev.ip) {
        const m = nodeMetrics.value.find((n) => n.instance && n.instance.includes(dev.ip));
        if (m)
            return m;
    }
    return null;
};
const sortedDevices = (rack) => [...(rack.devices || [])].sort((a, b) => b.unit - a.unit);
const slotClass = (rack, dev) => {
    const node = dev.node_name ? nodes.value.find((n) => n.name === dev.node_name) : null;
    const isDown = node?.state?.toLowerCase().includes('down') || node?.state?.toLowerCase().includes('drain');
    if (isDown)
        return 'slot-down';
    if (dev.type === 'gpu')
        return 'slot-gpu';
    if (dev.type === 'switch')
        return 'slot-switch';
    if (dev.type === 'compute')
        return 'slot-compute';
    if (dev.type === 'pdu')
        return 'slot-pdu';
    return 'slot-empty';
};
const slotTitle = (rack, dev) => {
    const n = dev.node_name ? nodes.value.find((x) => x.name === dev.node_name) : null;
    const m = getDevMetrics(dev);
    const base = dev.name + (dev.ip ? ` | IP: ${dev.ip}` : '');
    const slurmInfo = n ? ` | Slurm: ${n.state || '-'}` : '';
    const promInfo = m ? ` | CPU: ${Math.round(m.cpu_usage || 0)}% | 内存: ${Math.round(m.mem_usage || 0)}% | Load: ${m.load1 || 0}` : '';
    return base + slurmInfo + promInfo;
};
const openNewRack = () => { editingRack.value = { name: '', location: '', units: 42, devices: [] }; showRackModal.value = true; };
const openEditRack = (rack) => { editingRack.value = { ...rack, devices: [...(rack.devices || [])] }; showRackModal.value = true; };
// 从 CMDB 主机填充设备信息
const importFromCmdb = () => {
    if (!cmdbImportHost.value)
        return;
    const h = cmdbHosts.value.find((x) => x.id === cmdbImportHost.value);
    if (!h)
        return;
    const role = (h.role || '').toLowerCase();
    let devType = 'compute';
    if (role.includes('gpu'))
        devType = 'gpu';
    else if (role.includes('存储') || role.includes('storage'))
        devType = 'storage';
    else if (role.includes('交换') || role.includes('switch'))
        devType = 'switch';
    // 解析 U 数
    const unitMatch = (h.rack_unit || '').match(/[Uu](\d+)/);
    const unitEnd = (h.rack_unit || '').match(/[Uu]\d+-[Uu](\d+)/);
    const startU = unitMatch ? parseInt(unitMatch[1]) : editingDevice.value.unit;
    const endU = unitEnd ? parseInt(unitEnd[1]) : startU + 1;
    const height = Math.max(1, endU - startU + 1);
    // 主 IP
    const mainIP = h.ips?.find((ip) => ip.type === '业务口' || ip.type === '管理口')?.address || h.ips?.[0]?.address || '';
    editingDevice.value = {
        ...editingDevice.value,
        name: h.hostname,
        type: devType,
        model: h.model || '',
        height,
        ip: mainIP,
    };
    cmdbImportHost.value = '';
};
const saveRack = async () => {
    rackError.value = '';
    try {
        const base = `${getApiBase()}/api/monitoring/rack`;
        const headers = { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' };
        if (editingRack.value.id) {
            const res = await fetch(`${base}/${editingRack.value.id}`, { method: 'PUT', headers, body: JSON.stringify(editingRack.value) });
            if (!res.ok)
                throw new Error((await res.json()).error || '保存失败');
            const data = await res.json();
            const idx = racks.value.findIndex((r) => r.id === editingRack.value.id);
            if (idx >= 0)
                racks.value[idx] = data.data;
        }
        else {
            const res = await fetch(base, { method: 'POST', headers, body: JSON.stringify(editingRack.value) });
            if (!res.ok)
                throw new Error((await res.json()).error || '创建失败');
            racks.value.push((await res.json()).data);
        }
        showRackModal.value = false;
        updateSvgSize();
    }
    catch (e) {
        rackError.value = e.message;
    }
};
const deleteRack = async (id) => {
    if (!await dialog.confirm('确认删除该机柜？', { title: '删除机柜', danger: true }))
        return;
    try {
        const res = await fetch(`${getApiBase()}/api/monitoring/rack/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
        if (!res.ok)
            throw new Error((await res.json()).error || '删除失败');
        racks.value = racks.value.filter((r) => r.id !== id);
        cables.value = cables.value.filter(c => c.fromRack !== id && c.toRack !== id);
        saveCables();
    }
    catch (e) {
        rackError.value = e.message;
    }
};
const autoGenRacks = async () => {
    if (!await dialog.confirm('自动生成将覆盖现有机柜布局，确认继续？', { title: '自动生成机柜' }))
        return;
    rackLoading.value = true;
    rackError.value = '';
    try {
        const res = await fetch(`${getApiBase()}/api/monitoring/rack/auto`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` } });
        if (!res.ok)
            throw new Error((await res.json()).error || '自动生成失败');
        racks.value = (await res.json()).data || [];
        updateSvgSize();
    }
    catch (e) {
        rackError.value = e.message;
    }
    finally {
        rackLoading.value = false;
    }
};
const openAddDevice = (rack, unit) => {
    editingRackId.value = rack.id;
    editingDevice.value = { name: '', type: 'compute', node_name: '', model: '', height: 2, unit, ports: [] };
    devTab.value = 'basic';
    showDeviceModal.value = true;
};
const openAddPdu = (rack, unit) => {
    editingRackId.value = rack.id;
    editingDevice.value = { name: unit === 1 ? 'PDU-01' : 'PDU-02', type: 'pdu', node_name: '', model: '', height: 1, unit, ports: [] };
    devTab.value = 'basic';
    showDeviceModal.value = true;
};
const openEditDevice = (rack, dev) => {
    editingRackId.value = rack.id;
    editingDevice.value = { ...dev, ports: dev.ports ? [...dev.ports] : [] };
    devTab.value = 'basic';
    showDeviceModal.value = true;
};
const saveDevice = async () => {
    rackError.value = '';
    const rack = racks.value.find((r) => r.id === editingRackId.value);
    if (!rack)
        return;
    const devices = [...(rack.devices || [])];
    const dev = editingDevice.value;
    if (dev.id) {
        const idx = devices.findIndex((d) => d.id === dev.id);
        if (idx >= 0)
            devices[idx] = { ...dev };
    }
    else
        devices.push({ ...dev, id: `dev-${Date.now()}` });
    const updated = { ...rack, devices };
    try {
        const res = await fetch(`${getApiBase()}/api/monitoring/rack/${rack.id}`, { method: 'PUT', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
        if (!res.ok)
            throw new Error((await res.json()).error || '保存失败');
        const idx = racks.value.findIndex((r) => r.id === rack.id);
        if (idx >= 0)
            racks.value[idx] = (await res.json()).data;
        showDeviceModal.value = false;
    }
    catch (e) {
        rackError.value = e.message;
    }
};
const removeDevice = async () => {
    if (!await dialog.confirm('确认删除该设备？', { title: '删除设备', danger: true }))
        return;
    const rack = racks.value.find((r) => r.id === editingRackId.value);
    if (!rack)
        return;
    const devices = (rack.devices || []).filter((d) => d.id !== editingDevice.value.id);
    try {
        const res = await fetch(`${getApiBase()}/api/monitoring/rack/${rack.id}`, { method: 'PUT', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...rack, devices }) });
        if (!res.ok)
            throw new Error((await res.json()).error || '删除失败');
        const idx = racks.value.findIndex((r) => r.id === rack.id);
        if (idx >= 0)
            racks.value[idx] = (await res.json()).data;
        cables.value = cables.value.filter(c => c.fromDev !== editingDevice.value.id && c.toDev !== editingDevice.value.id);
        saveCables();
        showDeviceModal.value = false;
    }
    catch (e) {
        rackError.value = e.message;
    }
};
const addPort = () => {
    if (!editingDevice.value.ports)
        editingDevice.value.ports = [];
    const n = editingDevice.value.ports.length + 1;
    editingDevice.value.ports.push({ id: `port-${Date.now()}`, name: `Gi0/${n}`, speed: '1G', desc: '' });
};
const autoGenPorts = (count) => {
    editingDevice.value.ports = Array.from({ length: count }, (_, i) => ({ id: `port-${Date.now()}-${i}`, name: `Gi0/${i + 1}`, speed: '1G', desc: '' }));
};
const removePort = (pi) => { editingDevice.value.ports.splice(pi, 1); };
const syncFromNode = () => {
    const n = nodes.value.find((x) => x.name === cmdbSyncNode.value);
    if (!n)
        return;
    editingDevice.value.node_name = n.name;
    if (n.ip)
        editingDevice.value.ip = n.ip;
    if (n.cpu_model)
        editingDevice.value.cpu_model = n.cpu_model;
    if (n.mem_total_gb)
        editingDevice.value.mem_total = n.mem_total_gb + 'GB';
    if (n.os)
        editingDevice.value.os = n.os;
};
const cmdbList = computed(() => racks.value.flatMap((rack) => (rack.devices || []).filter((d) => d.type !== 'empty').map((d) => ({ ...d, devId: d.id, rackName: rack.name }))));
const cmdbFiltered = computed(() => cmdbList.value.filter((item) => {
    const q = cmdbSearch.value.toLowerCase();
    const matchQ = !q || [item.name, item.ip, item.model, item.mac, item.sn, item.cpu_model].some(v => v && String(v).toLowerCase().includes(q));
    const matchT = !cmdbTypeFilter.value || item.type === cmdbTypeFilter.value;
    return matchQ && matchT;
}));
const typeLabel = (t) => ({ compute: '计算节点', gpu: 'GPU节点', storage: '存储', switch: '交换机', pdu: 'PDU' }[t] || t);
const jumpToDevice = (item) => { showCmdb.value = false; };
const cmdbAutoScan = async () => {
    cmdbScanning.value = true;
    try {
        await loadAll();
        const nodeMap = Object.fromEntries(nodes.value.map((n) => [n.name, n]));
        for (const rack of racks.value) {
            let changed = false;
            for (const dev of (rack.devices || [])) {
                if (dev.node_name && nodeMap[dev.node_name]) {
                    const n = nodeMap[dev.node_name];
                    if (n.ip && !dev.ip) {
                        dev.ip = n.ip;
                        changed = true;
                    }
                    if (n.cpu_model && !dev.cpu_model) {
                        dev.cpu_model = n.cpu_model;
                        changed = true;
                    }
                    if (n.mem_total_gb && !dev.mem_total) {
                        dev.mem_total = n.mem_total_gb + 'GB';
                        changed = true;
                    }
                    if (n.os && !dev.os) {
                        dev.os = n.os;
                        changed = true;
                    }
                }
            }
            if (changed) {
                await fetch(`${getApiBase()}/api/monitoring/rack/${rack.id}`, { method: 'PUT', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(rack) });
            }
        }
        await loadAll();
    }
    finally {
        cmdbScanning.value = false;
    }
};
onMounted(() => {
    loadAll();
    nextTick(() => { setTimeout(updateContainerH, 100); });
    window.addEventListener('resize', updateContainerH);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
});
onUnmounted(() => { window.removeEventListener('resize', updateContainerH); window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); });
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['cable-line']} */ ;
/** @type {__VLS_StyleScopedClasses['cable-group']} */ ;
/** @type {__VLS_StyleScopedClasses['cable-line']} */ ;
/** @type {__VLS_StyleScopedClasses['rack-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['pdu-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['pdu-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['pdu-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['pdu-empty']} */ ;
/** @type {__VLS_StyleScopedClasses['rack-slot']} */ ;
/** @type {__VLS_StyleScopedClasses['slot-compute']} */ ;
/** @type {__VLS_StyleScopedClasses['slot-label']} */ ;
/** @type {__VLS_StyleScopedClasses['slot-gpu']} */ ;
/** @type {__VLS_StyleScopedClasses['slot-label']} */ ;
/** @type {__VLS_StyleScopedClasses['slot-switch']} */ ;
/** @type {__VLS_StyleScopedClasses['slot-label']} */ ;
/** @type {__VLS_StyleScopedClasses['slot-pdu']} */ ;
/** @type {__VLS_StyleScopedClasses['slot-label']} */ ;
/** @type {__VLS_StyleScopedClasses['slot-empty']} */ ;
/** @type {__VLS_StyleScopedClasses['slot-bar-fill']} */ ;
/** @type {__VLS_StyleScopedClasses['slot-bar-fill']} */ ;
/** @type {__VLS_StyleScopedClasses['port-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['port-right']} */ ;
/** @type {__VLS_StyleScopedClasses['port-left']} */ ;
/** @type {__VLS_StyleScopedClasses['port-pin']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-hd']} */ ;
/** @type {__VLS_StyleScopedClasses['dev-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['fg']} */ ;
/** @type {__VLS_StyleScopedClasses['fg']} */ ;
/** @type {__VLS_StyleScopedClasses['fg']} */ ;
/** @type {__VLS_StyleScopedClasses['fg']} */ ;
/** @type {__VLS_StyleScopedClasses['fg']} */ ;
/** @type {__VLS_StyleScopedClasses['fg']} */ ;
/** @type {__VLS_StyleScopedClasses['fg']} */ ;
/** @type {__VLS_StyleScopedClasses['fg-row']} */ ;
/** @type {__VLS_StyleScopedClasses['fg']} */ ;
/** @type {__VLS_StyleScopedClasses['cmdb-table']} */ ;
/** @type {__VLS_StyleScopedClasses['cmdb-table']} */ ;
/** @type {__VLS_StyleScopedClasses['cmdb-row']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-pri']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sec']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sec']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-pri']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rack-page" },
});
/** @type {__VLS_StyleScopedClasses['rack-page']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rack-toolbar" },
});
/** @type {__VLS_StyleScopedClasses['rack-toolbar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rack-toolbar-left" },
});
/** @type {__VLS_StyleScopedClasses['rack-toolbar-left']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rack-legend" },
});
/** @type {__VLS_StyleScopedClasses['rack-legend']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-item" },
});
/** @type {__VLS_StyleScopedClasses['leg-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-dot dot-compute" },
});
/** @type {__VLS_StyleScopedClasses['leg-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['dot-compute']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-item" },
});
/** @type {__VLS_StyleScopedClasses['leg-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-dot dot-gpu" },
});
/** @type {__VLS_StyleScopedClasses['leg-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['dot-gpu']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-item" },
});
/** @type {__VLS_StyleScopedClasses['leg-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-dot dot-switch" },
});
/** @type {__VLS_StyleScopedClasses['leg-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['dot-switch']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-item" },
});
/** @type {__VLS_StyleScopedClasses['leg-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-dot dot-pdu" },
});
/** @type {__VLS_StyleScopedClasses['leg-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['dot-pdu']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-item" },
});
/** @type {__VLS_StyleScopedClasses['leg-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-dot dot-warn" },
});
/** @type {__VLS_StyleScopedClasses['leg-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['dot-warn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-item" },
});
/** @type {__VLS_StyleScopedClasses['leg-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "leg-dot dot-down" },
});
/** @type {__VLS_StyleScopedClasses['leg-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['dot-down']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rack-toolbar-right" },
});
/** @type {__VLS_StyleScopedClasses['rack-toolbar-right']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.openNewRack) },
    ...{ class: "btn-pri" },
});
/** @type {__VLS_StyleScopedClasses['btn-pri']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.autoGenRacks) },
    ...{ class: "btn-sec" },
    disabled: (__VLS_ctx.rackLoading),
});
/** @type {__VLS_StyleScopedClasses['btn-sec']} */ ;
(__VLS_ctx.rackLoading ? '生成中...' : ' 自动生成');
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.loadAll) },
    ...{ class: "btn-sec" },
    disabled: (__VLS_ctx.loading),
});
/** @type {__VLS_StyleScopedClasses['btn-sec']} */ ;
if (__VLS_ctx.rackError) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "rack-err" },
    });
    /** @type {__VLS_StyleScopedClasses['rack-err']} */ ;
    (__VLS_ctx.rackError);
}
if (__VLS_ctx.racks.length === 0 && !__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty" },
    });
    /** @type {__VLS_StyleScopedClasses['empty']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rack-scroll-area" },
    });
    /** @type {__VLS_StyleScopedClasses['rack-scroll-area']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rack-list" },
        ref: "rackListRef",
    });
    /** @type {__VLS_StyleScopedClasses['rack-list']} */ ;
    for (const [rack] of __VLS_vFor((__VLS_ctx.racks))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (rack.id),
            ...{ class: "rack-col" },
        });
        /** @type {__VLS_StyleScopedClasses['rack-col']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rack-name" },
        });
        /** @type {__VLS_StyleScopedClasses['rack-name']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (rack.name);
        if (rack.location) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "rack-loc" },
            });
            /** @type {__VLS_StyleScopedClasses['rack-loc']} */ ;
            (rack.location);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rack-actions" },
        });
        /** @type {__VLS_StyleScopedClasses['rack-actions']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.racks.length === 0 && !__VLS_ctx.loading))
                        return;
                    __VLS_ctx.openEditRack(rack);
                    // @ts-ignore
                    [openNewRack, autoGenRacks, rackLoading, rackLoading, loadAll, loading, loading, rackError, rackError, racks, racks, openEditRack,];
                } },
            ...{ class: "rack-btn" },
        });
        /** @type {__VLS_StyleScopedClasses['rack-btn']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.racks.length === 0 && !__VLS_ctx.loading))
                        return;
                    __VLS_ctx.deleteRack(rack.id);
                    // @ts-ignore
                    [deleteRack,];
                } },
            ...{ class: "rack-btn rack-btn-del" },
        });
        /** @type {__VLS_StyleScopedClasses['rack-btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['rack-btn-del']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rack-body" },
            ...{ style: ({ height: __VLS_ctx.SLOT_H * rack.units + 8 + 'px' }) },
            'data-rack-id': (rack.id),
        });
        /** @type {__VLS_StyleScopedClasses['rack-body']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pdu-side pdu-left" },
        });
        /** @type {__VLS_StyleScopedClasses['pdu-side']} */ ;
        /** @type {__VLS_StyleScopedClasses['pdu-left']} */ ;
        for (const [dev] of __VLS_vFor((__VLS_ctx.sortedDevices(rack).filter((d) => d.type === 'pdu' && d.unit % 2 === 1)))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.racks.length === 0 && !__VLS_ctx.loading))
                            return;
                        __VLS_ctx.openEditDevice(rack, dev);
                        // @ts-ignore
                        [SLOT_H, sortedDevices, openEditDevice,];
                    } },
                key: ('pdu-l-' + dev.id),
                ...{ class: "pdu-bar" },
                title: (dev.name),
            });
            /** @type {__VLS_StyleScopedClasses['pdu-bar']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "pdu-label" },
            });
            /** @type {__VLS_StyleScopedClasses['pdu-label']} */ ;
            (dev.name);
            // @ts-ignore
            [];
        }
        if (__VLS_ctx.sortedDevices(rack).filter((d) => d.type === 'pdu' && d.unit % 2 === 1).length === 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.racks.length === 0 && !__VLS_ctx.loading))
                            return;
                        if (!(__VLS_ctx.sortedDevices(rack).filter((d) => d.type === 'pdu' && d.unit % 2 === 1).length === 0))
                            return;
                        __VLS_ctx.openAddPdu(rack, 1);
                        // @ts-ignore
                        [sortedDevices, openAddPdu,];
                    } },
                ...{ class: "pdu-bar pdu-empty" },
                title: ('添加 PDU'),
            });
            /** @type {__VLS_StyleScopedClasses['pdu-bar']} */ ;
            /** @type {__VLS_StyleScopedClasses['pdu-empty']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "pdu-add" },
            });
            /** @type {__VLS_StyleScopedClasses['pdu-add']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rack-inner" },
        });
        /** @type {__VLS_StyleScopedClasses['rack-inner']} */ ;
        for (const [u] of __VLS_vFor((rack.units))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.racks.length === 0 && !__VLS_ctx.loading))
                            return;
                        __VLS_ctx.openAddDevice(rack, u);
                        // @ts-ignore
                        [openAddDevice,];
                    } },
                key: ('bg-' + u),
                ...{ class: "rack-slot slot-empty rack-bg-slot" },
                ...{ style: ({ top: (rack.units - u) * __VLS_ctx.SLOT_H + 'px', height: __VLS_ctx.SLOT_H - 2 + 'px' }) },
            });
            /** @type {__VLS_StyleScopedClasses['rack-slot']} */ ;
            /** @type {__VLS_StyleScopedClasses['slot-empty']} */ ;
            /** @type {__VLS_StyleScopedClasses['rack-bg-slot']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "slot-u" },
            });
            /** @type {__VLS_StyleScopedClasses['slot-u']} */ ;
            (u);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "slot-add" },
            });
            /** @type {__VLS_StyleScopedClasses['slot-add']} */ ;
            // @ts-ignore
            [SLOT_H, SLOT_H,];
        }
        for (const [dev] of __VLS_vFor((__VLS_ctx.sortedDevices(rack).filter((d) => d.type !== 'pdu')))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.racks.length === 0 && !__VLS_ctx.loading))
                            return;
                        __VLS_ctx.openEditDevice(rack, dev);
                        // @ts-ignore
                        [sortedDevices, openEditDevice,];
                    } },
                key: (dev.id),
                ...{ class: "rack-slot rack-dev-slot" },
                ...{ class: (__VLS_ctx.slotClass(rack, dev)) },
                ...{ style: ({ top: (rack.units - dev.unit - dev.height + 1) * __VLS_ctx.SLOT_H + 'px', height: dev.height * __VLS_ctx.SLOT_H - 2 + 'px' }) },
                'data-dev-id': (dev.id),
                'data-rack-id': (rack.id),
                title: (__VLS_ctx.slotTitle(rack, dev)),
            });
            /** @type {__VLS_StyleScopedClasses['rack-slot']} */ ;
            /** @type {__VLS_StyleScopedClasses['rack-dev-slot']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "slot-u" },
            });
            /** @type {__VLS_StyleScopedClasses['slot-u']} */ ;
            (dev.unit);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "slot-label slot-label-center" },
            });
            /** @type {__VLS_StyleScopedClasses['slot-label']} */ ;
            /** @type {__VLS_StyleScopedClasses['slot-label-center']} */ ;
            (dev.name);
            if (dev.type === 'switch' && dev.ports && dev.ports.length) {
                for (const [port, pi] of __VLS_vFor((dev.ports))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ onMousedown: (...[$event]) => {
                                if (!!(__VLS_ctx.racks.length === 0 && !__VLS_ctx.loading))
                                    return;
                                if (!(dev.type === 'switch' && dev.ports && dev.ports.length))
                                    return;
                                __VLS_ctx.startCable($event, rack.id, dev.id, port.id);
                                // @ts-ignore
                                [SLOT_H, SLOT_H, slotClass, slotTitle, startCable,];
                            } },
                        ...{ onMouseup: (...[$event]) => {
                                if (!!(__VLS_ctx.racks.length === 0 && !__VLS_ctx.loading))
                                    return;
                                if (!(dev.type === 'switch' && dev.ports && dev.ports.length))
                                    return;
                                __VLS_ctx.endCable($event, rack.id, dev.id, port.id);
                                // @ts-ignore
                                [endCable,];
                            } },
                        key: (port.id),
                        ...{ class: "port-pin" },
                        ...{ class: ({ 'port-used': __VLS_ctx.isCablePort(dev.id, port.id) }) },
                        ...{ style: (__VLS_ctx.portPinStyle(Number(pi), dev.ports.length)) },
                        'data-dev-id': (dev.id),
                        'data-rack-id': (rack.id),
                        'data-port-id': (port.id),
                        title: (port.name + (port.speed ? ' ' + port.speed : '')),
                    });
                    /** @type {__VLS_StyleScopedClasses['port-pin']} */ ;
                    /** @type {__VLS_StyleScopedClasses['port-used']} */ ;
                    // @ts-ignore
                    [isCablePort, portPinStyle,];
                }
            }
            else if (dev.type === 'compute' || dev.type === 'gpu' || dev.type === 'storage') {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "port-dot port-right" },
                });
                /** @type {__VLS_StyleScopedClasses['port-dot']} */ ;
                /** @type {__VLS_StyleScopedClasses['port-right']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "port-dot port-left" },
                });
                /** @type {__VLS_StyleScopedClasses['port-dot']} */ ;
                /** @type {__VLS_StyleScopedClasses['port-left']} */ ;
            }
            // @ts-ignore
            [];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pdu-side pdu-right" },
        });
        /** @type {__VLS_StyleScopedClasses['pdu-side']} */ ;
        /** @type {__VLS_StyleScopedClasses['pdu-right']} */ ;
        for (const [dev] of __VLS_vFor((__VLS_ctx.sortedDevices(rack).filter((d) => d.type === 'pdu' && d.unit % 2 === 0)))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.racks.length === 0 && !__VLS_ctx.loading))
                            return;
                        __VLS_ctx.openEditDevice(rack, dev);
                        // @ts-ignore
                        [sortedDevices, openEditDevice,];
                    } },
                key: ('pdu-r-' + dev.id),
                ...{ class: "pdu-bar" },
                title: (dev.name),
            });
            /** @type {__VLS_StyleScopedClasses['pdu-bar']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "pdu-label" },
            });
            /** @type {__VLS_StyleScopedClasses['pdu-label']} */ ;
            (dev.name);
            // @ts-ignore
            [];
        }
        if (__VLS_ctx.sortedDevices(rack).filter((d) => d.type === 'pdu' && d.unit % 2 === 0).length === 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.racks.length === 0 && !__VLS_ctx.loading))
                            return;
                        if (!(__VLS_ctx.sortedDevices(rack).filter((d) => d.type === 'pdu' && d.unit % 2 === 0).length === 0))
                            return;
                        __VLS_ctx.openAddPdu(rack, 2);
                        // @ts-ignore
                        [sortedDevices, openAddPdu,];
                    } },
                ...{ class: "pdu-bar pdu-empty" },
                title: ('添加 PDU'),
            });
            /** @type {__VLS_StyleScopedClasses['pdu-bar']} */ ;
            /** @type {__VLS_StyleScopedClasses['pdu-empty']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "pdu-add" },
            });
            /** @type {__VLS_StyleScopedClasses['pdu-add']} */ ;
        }
        // @ts-ignore
        [];
    }
}
if (__VLS_ctx.showRackModal) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showRackModal))
                    return;
                __VLS_ctx.showRackModal = false;
                // @ts-ignore
                [showRackModal, showRackModal,];
            } },
        ...{ class: "overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal" },
    });
    /** @type {__VLS_StyleScopedClasses['modal']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-hd" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-hd']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    (__VLS_ctx.editingRack.id ? '编辑机柜' : '新建机柜');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showRackModal))
                    return;
                __VLS_ctx.showRackModal = false;
                // @ts-ignore
                [showRackModal, editingRack,];
            } },
        ...{ class: "x-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['x-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-bd" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-bd']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "fg" },
    });
    /** @type {__VLS_StyleScopedClasses['fg']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "如 A01",
    });
    (__VLS_ctx.editingRack.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "fg" },
    });
    /** @type {__VLS_StyleScopedClasses['fg']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "如 数据中心一楼",
    });
    (__VLS_ctx.editingRack.location);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "fg" },
    });
    /** @type {__VLS_StyleScopedClasses['fg']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "4",
        max: "52",
    });
    (__VLS_ctx.editingRack.units);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-ft" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-ft']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showRackModal))
                    return;
                __VLS_ctx.showRackModal = false;
                // @ts-ignore
                [showRackModal, editingRack, editingRack, editingRack,];
            } },
        ...{ class: "btn-sec" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-sec']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.saveRack) },
        ...{ class: "btn-pri" },
        disabled: (!__VLS_ctx.editingRack.name),
    });
    /** @type {__VLS_StyleScopedClasses['btn-pri']} */ ;
}
if (__VLS_ctx.showDeviceModal) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showDeviceModal))
                    return;
                __VLS_ctx.showDeviceModal = false;
                // @ts-ignore
                [editingRack, saveRack, showDeviceModal, showDeviceModal,];
            } },
        ...{ class: "overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal modal-lg" },
    });
    /** @type {__VLS_StyleScopedClasses['modal']} */ ;
    /** @type {__VLS_StyleScopedClasses['modal-lg']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-hd" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-hd']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    (__VLS_ctx.editingDevice.id ? '编辑设备' : '添加设备 (' + __VLS_ctx.editingDevice.unit + 'U)');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showDeviceModal))
                    return;
                __VLS_ctx.showDeviceModal = false;
                // @ts-ignore
                [showDeviceModal, editingDevice, editingDevice,];
            } },
        ...{ class: "x-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['x-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "dev-tabs" },
    });
    /** @type {__VLS_StyleScopedClasses['dev-tabs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showDeviceModal))
                    return;
                __VLS_ctx.devTab = 'basic';
                // @ts-ignore
                [devTab,];
            } },
        ...{ class: (['dev-tab', { active: __VLS_ctx.devTab === 'basic' }]) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['dev-tab']} */ ;
    if (__VLS_ctx.editingDevice.type === 'switch') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showDeviceModal))
                        return;
                    if (!(__VLS_ctx.editingDevice.type === 'switch'))
                        return;
                    __VLS_ctx.devTab = 'ports';
                    // @ts-ignore
                    [editingDevice, devTab, devTab,];
                } },
            ...{ class: (['dev-tab', { active: __VLS_ctx.devTab === 'ports' }]) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        /** @type {__VLS_StyleScopedClasses['dev-tab']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-bd" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-bd']} */ ;
    if (__VLS_ctx.devTab === 'basic') {
        if (__VLS_ctx.cmdbHosts.length > 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "cmdb-import-bar" },
            });
            /** @type {__VLS_StyleScopedClasses['cmdb-import-bar']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "cmdb-import-tip" },
            });
            /** @type {__VLS_StyleScopedClasses['cmdb-import-tip']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                value: (__VLS_ctx.cmdbImportHost),
                ...{ class: "cmdb-import-sel" },
            });
            /** @type {__VLS_StyleScopedClasses['cmdb-import-sel']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                value: "",
            });
            for (const [h] of __VLS_vFor((__VLS_ctx.cmdbHosts))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    key: (h.id),
                    value: (h.id),
                });
                (h.hostname);
                (h.rack ? ' [' + h.rack + ']' : '');
                (h.role ? ' · ' + h.role : '');
                // @ts-ignore
                [devTab, devTab, cmdbHosts, cmdbHosts, cmdbImportHost,];
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.importFromCmdb) },
                ...{ class: "btn-sec btn-sm" },
                disabled: (!__VLS_ctx.cmdbImportHost),
            });
            /** @type {__VLS_StyleScopedClasses['btn-sec']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "fg" },
        });
        /** @type {__VLS_StyleScopedClasses['fg']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            placeholder: "如 node01",
        });
        (__VLS_ctx.editingDevice.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "fg" },
        });
        /** @type {__VLS_StyleScopedClasses['fg']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.editingDevice.type),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "compute",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "gpu",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "storage",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "switch",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "pdu",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "empty",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "fg" },
        });
        /** @type {__VLS_StyleScopedClasses['fg']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            placeholder: "可选，如 node01",
        });
        (__VLS_ctx.editingDevice.node_name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "fg" },
        });
        /** @type {__VLS_StyleScopedClasses['fg']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            placeholder: "可选",
        });
        (__VLS_ctx.editingDevice.model);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "fg" },
        });
        /** @type {__VLS_StyleScopedClasses['fg']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "1",
            max: "10",
        });
        (__VLS_ctx.editingDevice.height);
    }
    if (__VLS_ctx.devTab === 'ports' && __VLS_ctx.editingDevice.type === 'switch') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "port-mgr-bar" },
        });
        /** @type {__VLS_StyleScopedClasses['port-mgr-bar']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "port-mgr-tip" },
        });
        /** @type {__VLS_StyleScopedClasses['port-mgr-tip']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.addPort) },
            ...{ class: "btn-sec btn-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-sec']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showDeviceModal))
                        return;
                    if (!(__VLS_ctx.devTab === 'ports' && __VLS_ctx.editingDevice.type === 'switch'))
                        return;
                    __VLS_ctx.autoGenPorts(24);
                    // @ts-ignore
                    [editingDevice, editingDevice, editingDevice, editingDevice, editingDevice, editingDevice, devTab, cmdbImportHost, importFromCmdb, addPort, autoGenPorts,];
                } },
            ...{ class: "btn-sec btn-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-sec']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showDeviceModal))
                        return;
                    if (!(__VLS_ctx.devTab === 'ports' && __VLS_ctx.editingDevice.type === 'switch'))
                        return;
                    __VLS_ctx.autoGenPorts(48);
                    // @ts-ignore
                    [autoGenPorts,];
                } },
            ...{ class: "btn-sec btn-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-sec']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "port-list" },
        });
        /** @type {__VLS_StyleScopedClasses['port-list']} */ ;
        for (const [port, pi] of __VLS_vFor((__VLS_ctx.editingDevice.ports || []))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (port.id),
                ...{ class: "port-row" },
            });
            /** @type {__VLS_StyleScopedClasses['port-row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "port-idx" },
            });
            /** @type {__VLS_StyleScopedClasses['port-idx']} */ ;
            (Number(pi) + 1);
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                placeholder: "端口名 如 Gi0/1",
                ...{ class: "port-input" },
            });
            (port.name);
            /** @type {__VLS_StyleScopedClasses['port-input']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                value: (port.speed),
                ...{ class: "port-speed" },
            });
            /** @type {__VLS_StyleScopedClasses['port-speed']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                value: "",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                value: "1G",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                value: "10G",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                value: "25G",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                value: "100G",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                placeholder: "描述",
                ...{ class: "port-input port-desc" },
            });
            (port.desc);
            /** @type {__VLS_StyleScopedClasses['port-input']} */ ;
            /** @type {__VLS_StyleScopedClasses['port-desc']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.showDeviceModal))
                            return;
                        if (!(__VLS_ctx.devTab === 'ports' && __VLS_ctx.editingDevice.type === 'switch'))
                            return;
                        __VLS_ctx.removePort(Number(pi));
                        // @ts-ignore
                        [editingDevice, removePort,];
                    } },
                ...{ class: "port-del" },
            });
            /** @type {__VLS_StyleScopedClasses['port-del']} */ ;
            // @ts-ignore
            [];
        }
        if (!__VLS_ctx.editingDevice.ports || __VLS_ctx.editingDevice.ports.length === 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "port-empty" },
            });
            /** @type {__VLS_StyleScopedClasses['port-empty']} */ ;
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-ft" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-ft']} */ ;
    if (__VLS_ctx.editingDevice.id) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.removeDevice) },
            ...{ class: "btn-sec" },
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['btn-sec']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showDeviceModal))
                    return;
                __VLS_ctx.showDeviceModal = false;
                // @ts-ignore
                [showDeviceModal, editingDevice, editingDevice, editingDevice, removeDevice,];
            } },
        ...{ class: "btn-sec" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-sec']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.saveDevice) },
        ...{ class: "btn-pri" },
        disabled: (!__VLS_ctx.editingDevice.name),
    });
    /** @type {__VLS_StyleScopedClasses['btn-pri']} */ ;
}
// @ts-ignore
[editingDevice, saveDevice,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
