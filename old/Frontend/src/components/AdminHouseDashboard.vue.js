/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted, onUnmounted } from 'vue';
// 基础数据
const clusterName = ref('HPC集群');
const currentTime = ref('');
const alertCount = ref(0);
// 统计数据
const stats = ref({
    nodes: 0,
    nodesOnline: 0,
    cpuCores: 0,
    cpuUsage: 0,
    gpuCards: 0,
    gpuInUse: 0,
    memory: 0,
    memoryFree: 0
});
const jobStats = ref({
    running: 0,
    pending: 0,
    completed: 0,
    failed: 0
});
const nodes = ref([]);
const alerts = ref([]);
// 计算属性
const cpuUsagePercent = computed(() => stats.value.cpuCores > 0 ? Math.round((stats.value.cpuUsage / stats.value.cpuCores) * 100) : 0);
const gpuUsagePercent = computed(() => stats.value.gpuCards > 0 ? Math.round((stats.value.gpuInUse / stats.value.gpuCards) * 100) : 0);
const memUsagePercent = computed(() => stats.value.memory > 0 ? Math.round(((stats.value.memory - stats.value.memoryFree) / stats.value.memory) * 100) : 0);
// 机柜数据
const serverRacks = ref([]);
// 活跃用户（正在工作的）
const activeUsers = ref([]);
// 休息的用户（没有作业的）
const restingUsers = ref([]);
// 平均等待时间
const avgWaitTime = ref(0);
// 工程师（巡检人员）
const engineers = ref([
    {
        id: 'eng-1',
        name: '运维工程师',
        avatar: '👷',
        x: 100,
        y: 150,
        targetX: 100,
        targetY: 150,
        action: '巡检机房',
        moving: false,
        showPath: false,
        currentRoom: 'server'
    }
]);
// API 基础地址
const getApiBase = () => {
    return '';
};
// 加载集群统计数据
const loadDashboardStats = async () => {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token)
            return;
        const res = await fetch(`${getApiBase()}/api/dashboard/stats`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok)
            return;
        const result = await res.json();
        const data = result.data || result || {};
        stats.value = {
            nodes: data.total_nodes || 0,
            nodesOnline: data.online_nodes || 0,
            cpuCores: data.total_cpus || 0,
            cpuUsage: Math.round(data.cpu_usage_percent || 0),
            gpuCards: data.total_gpus || 0,
            gpuInUse: data.allocated_gpus || 0,
            memory: data.total_memory_tb || 0,
            memoryFree: data.free_memory_tb || 0
        };
    }
    catch (e) {
        console.error('加载统计数据失败:', e);
    }
};
// 加载节点数据
const loadNodes = async () => {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token)
            return;
        const res = await fetch(`${getApiBase()}/api/dashboard/nodes`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok)
            return;
        const result = await res.json();
        const data = Array.isArray(result.data) ? result.data : [];
        nodes.value = data.map((node) => {
            const state = (node.state || '').toUpperCase();
            let status = 'idle';
            if (state === 'ALLOCATED' || state === 'MIXED')
                status = 'online';
            else if (state === 'DOWN' || state === 'DRAIN')
                status = 'offline';
            return {
                name: node.name,
                status,
                cpu: Math.round(node.cpu_usage_percent || 0),
                mem: Math.round(node.memory_usage_percent || 0),
                jobs: node.running_jobs || 0
            };
        });
        // 组织成机柜
        organizeRacks();
    }
    catch (e) {
        console.error('加载节点数据失败:', e);
    }
};
// 组织机柜数据
const organizeRacks = () => {
    const serversPerRack = 8;
    const rackCount = Math.ceil(nodes.value.length / serversPerRack);
    serverRacks.value = [];
    for (let i = 0; i < rackCount; i++) {
        const rackServers = nodes.value.slice(i * serversPerRack, (i + 1) * serversPerRack);
        const avgCpu = rackServers.length > 0
            ? Math.round(rackServers.reduce((sum, s) => sum + s.cpu, 0) / rackServers.length)
            : 0;
        const onlineCount = rackServers.filter(s => s.status === 'online').length;
        serverRacks.value.push({
            servers: rackServers,
            avgCpu,
            load: `${onlineCount}/${rackServers.length}`,
            status: onlineCount === rackServers.length ? 'full' : onlineCount > 0 ? 'partial' : 'idle'
        });
    }
};
// 加载作业统计
const loadJobStats = async () => {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token)
            return;
        const res = await fetch(`${getApiBase()}/api/jobs?page=1&page_size=5000`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok)
            return;
        const result = await res.json();
        const jobs = result.data || [];
        jobStats.value = {
            running: jobs.filter((j) => j.job_state === 'RUNNING').length,
            pending: jobs.filter((j) => j.job_state === 'PENDING').length,
            completed: jobs.filter((j) => j.job_state === 'COMPLETED').length,
            failed: jobs.filter((j) => ['FAILED', 'CANCELLED', 'TIMEOUT'].includes(j.job_state)).length
        };
        // 根据作业情况生成用户
        generateUsers(jobs);
    }
    catch (e) {
        console.error('加载作业统计失败:', e);
    }
};
// 生成用户角色
const generateUsers = (jobs) => {
    const runningJobs = jobs.filter((j) => j.job_state === 'RUNNING');
    const userAvatars = ['👨‍💻', '👩‍💻', '👨‍🔬', '👩‍🔬', '👨‍🎓', '👩‍🎓'];
    const jobTypes = ['CPU', 'GPU', 'MPI', 'AI'];
    const actions = ['提交作业', '查看日志', '监控进度', '下载结果', '调试程序', '分析数据'];
    // 活跃用户（有运行作业的）
    activeUsers.value = runningJobs.slice(0, 6).map((job, i) => ({
        id: `user-${i}`,
        name: job.user || `用户${i + 1}`,
        avatar: userAvatars[i % userAvatars.length],
        action: actions[i % actions.length],
        jobType: jobTypes[Math.floor(Math.random() * jobTypes.length)],
        jobId: job.job_id
    }));
    // 休息的用户（没有运行作业的，模拟数据）
    const totalUsers = 10;
    const restCount = Math.max(0, totalUsers - activeUsers.value.length);
    restingUsers.value = Array.from({ length: Math.min(restCount, 4) }, (_, i) => ({
        id: `rest-${i}`,
        name: `用户${activeUsers.value.length + i + 1}`,
        avatar: userAvatars[(activeUsers.value.length + i) % userAvatars.length],
        waitTime: Math.floor(Math.random() * 30) + 5
    }));
    // 计算平均等待时间
    if (restingUsers.value.length > 0) {
        avgWaitTime.value = Math.round(restingUsers.value.reduce((sum, u) => sum + u.waitTime, 0) / restingUsers.value.length);
    }
    else {
        avgWaitTime.value = 0;
    }
};
// 加载告警信息
const loadAlerts = async () => {
    try {
        // 模拟告警数据（实际应从API获取）
        const mockAlerts = [];
        // 检查CPU使用率
        if (cpuUsagePercent.value > 90) {
            mockAlerts.push({
                id: 'alert-cpu',
                message: `CPU使用率过高: ${cpuUsagePercent.value}%`,
                severity: 'warning'
            });
        }
        // 检查离线节点
        const offlineNodes = nodes.value.filter(n => n.status === 'offline');
        if (offlineNodes.length > 0) {
            mockAlerts.push({
                id: 'alert-nodes',
                message: `${offlineNodes.length}个节点离线: ${offlineNodes.map(n => n.name).join(', ')}`,
                severity: 'critical'
            });
        }
        // 检查等待作业
        if (jobStats.value.pending > 10) {
            mockAlerts.push({
                id: 'alert-queue',
                message: `作业队列积压: ${jobStats.value.pending}个作业等待中`,
                severity: 'info'
            });
        }
        alerts.value = mockAlerts;
        alertCount.value = mockAlerts.length;
    }
    catch (e) {
        console.error('加载告警失败:', e);
    }
};
// 刷新所有数据
const refreshAll = async () => {
    await Promise.all([
        loadDashboardStats(),
        loadNodes(),
        loadJobStats()
    ]);
    await loadAlerts();
    updateTime();
};
// 更新时间
const updateTime = () => {
    const now = new Date();
    currentTime.value = now.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};
// 工程师巡检动画
let animationFrame;
const animateEngineers = () => {
    engineers.value.forEach(engineer => {
        // 定义巡检路径（房间坐标）
        const rooms = [
            { name: 'server', x: 150, y: 150, action: '巡检机房' },
            { name: 'control', x: 550, y: 150, action: '查看监控' },
            { name: 'user', x: 150, y: 350, action: '协助用户' },
            { name: 'rest', x: 550, y: 350, action: '检查环境' }
        ];
        // 到达目标点
        const dx = engineer.targetX - engineer.x;
        const dy = engineer.targetY - engineer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 5) {
            engineer.moving = false;
            engineer.showPath = false;
            // 在当前房间停留一段时间后前往下一个房间
            if (Math.random() < 0.01) {
                const currentIndex = rooms.findIndex(r => r.name === engineer.currentRoom);
                const nextIndex = (currentIndex + 1) % rooms.length;
                const nextRoom = rooms[nextIndex];
                engineer.targetX = nextRoom.x;
                engineer.targetY = nextRoom.y;
                engineer.action = nextRoom.action;
                engineer.currentRoom = nextRoom.name;
                engineer.moving = true;
                engineer.showPath = true;
            }
        }
        else {
            // 移动中
            engineer.moving = true;
            const speed = 2;
            engineer.x += (dx / distance) * speed;
            engineer.y += (dy / distance) * speed;
        }
    });
    animationFrame = requestAnimationFrame(animateEngineers);
};
// 生命周期
onMounted(() => {
    updateTime();
    refreshAll();
    // 启动工程师动画
    setTimeout(() => {
        animateEngineers();
    }, 1000);
    // 定时刷新
    const refreshInterval = setInterval(refreshAll, 30000);
    const timeInterval = setInterval(updateTime, 1000);
    onUnmounted(() => {
        clearInterval(refreshInterval);
        clearInterval(timeInterval);
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
    });
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['header-left']} */ ;
/** @type {__VLS_StyleScopedClasses['status-indicator']} */ ;
/** @type {__VLS_StyleScopedClasses['status-indicator']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-refresh']} */ ;
/** @type {__VLS_StyleScopedClasses['cloud']} */ ;
/** @type {__VLS_StyleScopedClasses['cloud']} */ ;
/** @type {__VLS_StyleScopedClasses['cloud-1']} */ ;
/** @type {__VLS_StyleScopedClasses['cloud-1']} */ ;
/** @type {__VLS_StyleScopedClasses['cloud-2']} */ ;
/** @type {__VLS_StyleScopedClasses['cloud-2']} */ ;
/** @type {__VLS_StyleScopedClasses['room']} */ ;
/** @type {__VLS_StyleScopedClasses['room']} */ ;
/** @type {__VLS_StyleScopedClasses['room-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['server-unit']} */ ;
/** @type {__VLS_StyleScopedClasses['server-led']} */ ;
/** @type {__VLS_StyleScopedClasses['server-led']} */ ;
/** @type {__VLS_StyleScopedClasses['server-led']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-item']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-item']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-item']} */ ;
/** @type {__VLS_StyleScopedClasses['meter-fill']} */ ;
/** @type {__VLS_StyleScopedClasses['meter-fill']} */ ;
/** @type {__VLS_StyleScopedClasses['meter-fill']} */ ;
/** @type {__VLS_StyleScopedClasses['desk']} */ ;
/** @type {__VLS_StyleScopedClasses['desk']} */ ;
/** @type {__VLS_StyleScopedClasses['user-avatar']} */ ;
/** @type {__VLS_StyleScopedClasses['empty']} */ ;
/** @type {__VLS_StyleScopedClasses['computer-screen']} */ ;
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['sofa']} */ ;
/** @type {__VLS_StyleScopedClasses['character']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-item']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['room-row']} */ ;
/** @type {__VLS_StyleScopedClasses['stats-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['office-desks']} */ ;
/** @type {__VLS_StyleScopedClasses['stats-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['office-desks']} */ ;
/** @type {__VLS_StyleScopedClasses['monitor-screens']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "admin-house-dashboard" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['admin-house-dashboard']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ style: {} },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "admin-header" },
});
/** @type {__VLS_StyleScopedClasses['admin-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "header-left" },
});
/** @type {__VLS_StyleScopedClasses['header-left']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "cluster-tag" },
});
/** @type {__VLS_StyleScopedClasses['cluster-tag']} */ ;
(__VLS_ctx.clusterName);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "time-display" },
});
/** @type {__VLS_StyleScopedClasses['time-display']} */ ;
(__VLS_ctx.currentTime);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "header-right" },
});
/** @type {__VLS_StyleScopedClasses['header-right']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: (['status-indicator', __VLS_ctx.alertCount > 0 ? 'has-alert' : 'normal']) },
});
/** @type {__VLS_StyleScopedClasses['status-indicator']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "status-dot" },
});
/** @type {__VLS_StyleScopedClasses['status-dot']} */ ;
(__VLS_ctx.alertCount > 0 ? `${__VLS_ctx.alertCount} 条告警` : '系统正常');
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.refreshAll) },
    ...{ class: "btn-refresh" },
});
/** @type {__VLS_StyleScopedClasses['btn-refresh']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    'stroke-width': "2",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "house-scene" },
});
/** @type {__VLS_StyleScopedClasses['house-scene']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "sky" },
});
/** @type {__VLS_StyleScopedClasses['sky']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "sun" },
});
/** @type {__VLS_StyleScopedClasses['sun']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "cloud cloud-1" },
});
/** @type {__VLS_StyleScopedClasses['cloud']} */ ;
/** @type {__VLS_StyleScopedClasses['cloud-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "cloud cloud-2" },
});
/** @type {__VLS_StyleScopedClasses['cloud']} */ ;
/** @type {__VLS_StyleScopedClasses['cloud-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "building" },
});
/** @type {__VLS_StyleScopedClasses['building']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "roof" },
});
/** @type {__VLS_StyleScopedClasses['roof']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "roof-sign" },
});
/** @type {__VLS_StyleScopedClasses['roof-sign']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rooms-container" },
});
/** @type {__VLS_StyleScopedClasses['rooms-container']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "room-row" },
});
/** @type {__VLS_StyleScopedClasses['room-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "room server-room" },
});
/** @type {__VLS_StyleScopedClasses['room']} */ ;
/** @type {__VLS_StyleScopedClasses['server-room']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "room-header" },
});
/** @type {__VLS_StyleScopedClasses['room-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "room-icon" },
});
/** @type {__VLS_StyleScopedClasses['room-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "room-title" },
});
/** @type {__VLS_StyleScopedClasses['room-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "room-badge" },
});
/** @type {__VLS_StyleScopedClasses['room-badge']} */ ;
(__VLS_ctx.nodes.length);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "room-content" },
});
/** @type {__VLS_StyleScopedClasses['room-content']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "server-racks" },
});
/** @type {__VLS_StyleScopedClasses['server-racks']} */ ;
for (const [rack, idx] of __VLS_vFor((__VLS_ctx.serverRacks))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (idx),
        ...{ class: (['rack', `rack-status-${rack.status}`]) },
    });
    /** @type {__VLS_StyleScopedClasses['rack']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rack-label" },
    });
    /** @type {__VLS_StyleScopedClasses['rack-label']} */ ;
    (idx + 1);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rack-servers" },
    });
    /** @type {__VLS_StyleScopedClasses['rack-servers']} */ ;
    for (const [server] of __VLS_vFor((rack.servers))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (server.name),
            ...{ class: (['server-unit', `server-${server.status}`]) },
            title: (`${server.name}\nCPU: ${server.cpu}%\nMEM: ${server.mem}%`),
        });
        /** @type {__VLS_StyleScopedClasses['server-unit']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "server-led" },
        });
        /** @type {__VLS_StyleScopedClasses['server-led']} */ ;
        // @ts-ignore
        [clusterName, currentTime, alertCount, alertCount, alertCount, refreshAll, nodes, serverRacks,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rack-stats" },
    });
    /** @type {__VLS_StyleScopedClasses['rack-stats']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rack-stat" },
    });
    /** @type {__VLS_StyleScopedClasses['rack-stat']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "stat-label" },
    });
    /** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "stat-value" },
    });
    /** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
    (rack.avgCpu);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rack-stat" },
    });
    /** @type {__VLS_StyleScopedClasses['rack-stat']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "stat-label" },
    });
    /** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "stat-value" },
    });
    /** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
    (rack.load);
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "room control-room" },
});
/** @type {__VLS_StyleScopedClasses['room']} */ ;
/** @type {__VLS_StyleScopedClasses['control-room']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "room-header" },
});
/** @type {__VLS_StyleScopedClasses['room-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "room-icon" },
});
/** @type {__VLS_StyleScopedClasses['room-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "room-title" },
});
/** @type {__VLS_StyleScopedClasses['room-title']} */ ;
if (__VLS_ctx.alertCount > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "room-badge blink" },
    });
    /** @type {__VLS_StyleScopedClasses['room-badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['blink']} */ ;
    (__VLS_ctx.alertCount);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "room-content" },
});
/** @type {__VLS_StyleScopedClasses['room-content']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "monitor-screens" },
});
/** @type {__VLS_StyleScopedClasses['monitor-screens']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "monitor-screen" },
});
/** @type {__VLS_StyleScopedClasses['monitor-screen']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "screen-title" },
});
/** @type {__VLS_StyleScopedClasses['screen-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "queue-display" },
});
/** @type {__VLS_StyleScopedClasses['queue-display']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "queue-item running" },
});
/** @type {__VLS_StyleScopedClasses['queue-item']} */ ;
/** @type {__VLS_StyleScopedClasses['running']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "queue-label" },
});
/** @type {__VLS_StyleScopedClasses['queue-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "queue-number" },
});
/** @type {__VLS_StyleScopedClasses['queue-number']} */ ;
(__VLS_ctx.jobStats.running);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "queue-item pending" },
});
/** @type {__VLS_StyleScopedClasses['queue-item']} */ ;
/** @type {__VLS_StyleScopedClasses['pending']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "queue-label" },
});
/** @type {__VLS_StyleScopedClasses['queue-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "queue-number" },
});
/** @type {__VLS_StyleScopedClasses['queue-number']} */ ;
(__VLS_ctx.jobStats.pending);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "queue-item completed" },
});
/** @type {__VLS_StyleScopedClasses['queue-item']} */ ;
/** @type {__VLS_StyleScopedClasses['completed']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "queue-label" },
});
/** @type {__VLS_StyleScopedClasses['queue-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "queue-number" },
});
/** @type {__VLS_StyleScopedClasses['queue-number']} */ ;
(__VLS_ctx.jobStats.completed);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "monitor-screen" },
});
/** @type {__VLS_StyleScopedClasses['monitor-screen']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "screen-title" },
});
/** @type {__VLS_StyleScopedClasses['screen-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "resource-meters" },
});
/** @type {__VLS_StyleScopedClasses['resource-meters']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "resource-meter" },
});
/** @type {__VLS_StyleScopedClasses['resource-meter']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "meter-label" },
});
/** @type {__VLS_StyleScopedClasses['meter-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "meter-bar" },
});
/** @type {__VLS_StyleScopedClasses['meter-bar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "meter-fill cpu" },
    ...{ style: ({ width: __VLS_ctx.cpuUsagePercent + '%' }) },
});
/** @type {__VLS_StyleScopedClasses['meter-fill']} */ ;
/** @type {__VLS_StyleScopedClasses['cpu']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "meter-value" },
});
/** @type {__VLS_StyleScopedClasses['meter-value']} */ ;
(__VLS_ctx.cpuUsagePercent);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "resource-meter" },
});
/** @type {__VLS_StyleScopedClasses['resource-meter']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "meter-label" },
});
/** @type {__VLS_StyleScopedClasses['meter-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "meter-bar" },
});
/** @type {__VLS_StyleScopedClasses['meter-bar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "meter-fill mem" },
    ...{ style: ({ width: __VLS_ctx.memUsagePercent + '%' }) },
});
/** @type {__VLS_StyleScopedClasses['meter-fill']} */ ;
/** @type {__VLS_StyleScopedClasses['mem']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "meter-value" },
});
/** @type {__VLS_StyleScopedClasses['meter-value']} */ ;
(__VLS_ctx.memUsagePercent);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "resource-meter" },
});
/** @type {__VLS_StyleScopedClasses['resource-meter']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "meter-label" },
});
/** @type {__VLS_StyleScopedClasses['meter-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "meter-bar" },
});
/** @type {__VLS_StyleScopedClasses['meter-bar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "meter-fill gpu" },
    ...{ style: ({ width: __VLS_ctx.gpuUsagePercent + '%' }) },
});
/** @type {__VLS_StyleScopedClasses['meter-fill']} */ ;
/** @type {__VLS_StyleScopedClasses['gpu']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "meter-value" },
});
/** @type {__VLS_StyleScopedClasses['meter-value']} */ ;
(__VLS_ctx.gpuUsagePercent);
if (__VLS_ctx.alerts.length > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "alert-ticker" },
    });
    /** @type {__VLS_StyleScopedClasses['alert-ticker']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ticker-content" },
    });
    /** @type {__VLS_StyleScopedClasses['ticker-content']} */ ;
    for (const [alert] of __VLS_vFor((__VLS_ctx.alerts))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            key: (alert.id),
            ...{ class: "alert-item" },
        });
        /** @type {__VLS_StyleScopedClasses['alert-item']} */ ;
        (alert.message);
        // @ts-ignore
        [alertCount, alertCount, jobStats, jobStats, jobStats, cpuUsagePercent, cpuUsagePercent, memUsagePercent, memUsagePercent, gpuUsagePercent, gpuUsagePercent, alerts, alerts,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "room-row" },
});
/** @type {__VLS_StyleScopedClasses['room-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "room user-office" },
});
/** @type {__VLS_StyleScopedClasses['room']} */ ;
/** @type {__VLS_StyleScopedClasses['user-office']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "room-header" },
});
/** @type {__VLS_StyleScopedClasses['room-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "room-icon" },
});
/** @type {__VLS_StyleScopedClasses['room-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "room-title" },
});
/** @type {__VLS_StyleScopedClasses['room-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "room-badge" },
});
/** @type {__VLS_StyleScopedClasses['room-badge']} */ ;
(__VLS_ctx.activeUsers.length);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "room-content" },
});
/** @type {__VLS_StyleScopedClasses['room-content']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "office-desks" },
});
/** @type {__VLS_StyleScopedClasses['office-desks']} */ ;
for (const [user] of __VLS_vFor((__VLS_ctx.activeUsers))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (user.id),
        ...{ class: "desk" },
    });
    /** @type {__VLS_StyleScopedClasses['desk']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "desk-user" },
    });
    /** @type {__VLS_StyleScopedClasses['desk-user']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "user-avatar" },
    });
    /** @type {__VLS_StyleScopedClasses['user-avatar']} */ ;
    (user.avatar);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "user-name" },
    });
    /** @type {__VLS_StyleScopedClasses['user-name']} */ ;
    (user.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "desk-computer" },
    });
    /** @type {__VLS_StyleScopedClasses['desk-computer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "computer-screen" },
    });
    /** @type {__VLS_StyleScopedClasses['computer-screen']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "screen-content" },
    });
    /** @type {__VLS_StyleScopedClasses['screen-content']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "terminal-line" },
    });
    /** @type {__VLS_StyleScopedClasses['terminal-line']} */ ;
    (user.action);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "terminal-cursor" },
    });
    /** @type {__VLS_StyleScopedClasses['terminal-cursor']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "desk-status" },
    });
    /** @type {__VLS_StyleScopedClasses['desk-status']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: (['status-badge', user.jobType]) },
    });
    /** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
    (user.jobType);
    // @ts-ignore
    [activeUsers, activeUsers,];
}
for (const [i] of __VLS_vFor((Math.max(0, 6 - __VLS_ctx.activeUsers.length)))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: ('empty-' + i),
        ...{ class: "desk empty" },
    });
    /** @type {__VLS_StyleScopedClasses['desk']} */ ;
    /** @type {__VLS_StyleScopedClasses['empty']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "desk-user" },
    });
    /** @type {__VLS_StyleScopedClasses['desk-user']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "user-avatar empty" },
    });
    /** @type {__VLS_StyleScopedClasses['user-avatar']} */ ;
    /** @type {__VLS_StyleScopedClasses['empty']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "user-name" },
    });
    /** @type {__VLS_StyleScopedClasses['user-name']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "desk-computer" },
    });
    /** @type {__VLS_StyleScopedClasses['desk-computer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "computer-screen off" },
    });
    /** @type {__VLS_StyleScopedClasses['computer-screen']} */ ;
    /** @type {__VLS_StyleScopedClasses['off']} */ ;
    // @ts-ignore
    [activeUsers,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "room rest-room" },
});
/** @type {__VLS_StyleScopedClasses['room']} */ ;
/** @type {__VLS_StyleScopedClasses['rest-room']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "room-header" },
});
/** @type {__VLS_StyleScopedClasses['room-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "room-icon" },
});
/** @type {__VLS_StyleScopedClasses['room-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "room-title" },
});
/** @type {__VLS_StyleScopedClasses['room-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "room-badge" },
});
/** @type {__VLS_StyleScopedClasses['room-badge']} */ ;
(__VLS_ctx.restingUsers.length);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "room-content" },
});
/** @type {__VLS_StyleScopedClasses['room-content']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rest-area" },
});
/** @type {__VLS_StyleScopedClasses['rest-area']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "sofa" },
});
/** @type {__VLS_StyleScopedClasses['sofa']} */ ;
for (const [user] of __VLS_vFor((__VLS_ctx.restingUsers.slice(0, 2)))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (user.id),
        ...{ class: "resting-user" },
    });
    /** @type {__VLS_StyleScopedClasses['resting-user']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "user-lying" },
    });
    /** @type {__VLS_StyleScopedClasses['user-lying']} */ ;
    (user.avatar);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sleep-bubble" },
    });
    /** @type {__VLS_StyleScopedClasses['sleep-bubble']} */ ;
    // @ts-ignore
    [restingUsers, restingUsers,];
}
if (__VLS_ctx.restingUsers.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty-sofa" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-sofa']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "empty-text" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-text']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rest-stats" },
});
/** @type {__VLS_StyleScopedClasses['rest-stats']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rest-stat" },
});
/** @type {__VLS_StyleScopedClasses['rest-stat']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "stat-icon" },
});
/** @type {__VLS_StyleScopedClasses['stat-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "stat-text" },
});
/** @type {__VLS_StyleScopedClasses['stat-text']} */ ;
(__VLS_ctx.restingUsers.length);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rest-stat" },
});
/** @type {__VLS_StyleScopedClasses['rest-stat']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "stat-icon" },
});
/** @type {__VLS_StyleScopedClasses['stat-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "stat-text" },
});
/** @type {__VLS_StyleScopedClasses['stat-text']} */ ;
(__VLS_ctx.avgWaitTime);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "ground" },
});
/** @type {__VLS_StyleScopedClasses['ground']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "ground-line" },
});
/** @type {__VLS_StyleScopedClasses['ground-line']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "characters" },
});
/** @type {__VLS_StyleScopedClasses['characters']} */ ;
for (const [engineer] of __VLS_vFor((__VLS_ctx.engineers))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (engineer.id),
        ...{ class: (['character', 'engineer', engineer.moving ? 'walking' : '']) },
        ...{ style: ({ left: engineer.x + 'px', top: engineer.y + 'px' }) },
    });
    /** @type {__VLS_StyleScopedClasses['character']} */ ;
    /** @type {__VLS_StyleScopedClasses['engineer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "character-avatar" },
    });
    /** @type {__VLS_StyleScopedClasses['character-avatar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "character-name" },
    });
    /** @type {__VLS_StyleScopedClasses['character-name']} */ ;
    (engineer.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "character-action" },
    });
    /** @type {__VLS_StyleScopedClasses['character-action']} */ ;
    (engineer.action);
    if (engineer.showPath) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "character-path" },
        });
        /** @type {__VLS_StyleScopedClasses['character-path']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "path-arrow" },
        });
        /** @type {__VLS_StyleScopedClasses['path-arrow']} */ ;
    }
    // @ts-ignore
    [restingUsers, restingUsers, avgWaitTime, engineers,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stats-panel" },
});
/** @type {__VLS_StyleScopedClasses['stats-panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-item" },
});
/** @type {__VLS_StyleScopedClasses['stat-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-icon" },
});
/** @type {__VLS_StyleScopedClasses['stat-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-content" },
});
/** @type {__VLS_StyleScopedClasses['stat-content']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-value" },
});
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
(__VLS_ctx.stats.nodesOnline);
(__VLS_ctx.stats.nodes);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-item" },
});
/** @type {__VLS_StyleScopedClasses['stat-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-icon" },
});
/** @type {__VLS_StyleScopedClasses['stat-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-content" },
});
/** @type {__VLS_StyleScopedClasses['stat-content']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-value" },
});
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
(__VLS_ctx.activeUsers.length);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-item" },
});
/** @type {__VLS_StyleScopedClasses['stat-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-icon" },
});
/** @type {__VLS_StyleScopedClasses['stat-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-content" },
});
/** @type {__VLS_StyleScopedClasses['stat-content']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-value" },
});
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
(__VLS_ctx.jobStats.running);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-item" },
});
/** @type {__VLS_StyleScopedClasses['stat-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-icon" },
});
/** @type {__VLS_StyleScopedClasses['stat-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-content" },
});
/** @type {__VLS_StyleScopedClasses['stat-content']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-value" },
});
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
(__VLS_ctx.cpuUsagePercent);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-item" },
});
/** @type {__VLS_StyleScopedClasses['stat-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-icon" },
});
/** @type {__VLS_StyleScopedClasses['stat-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-content" },
});
/** @type {__VLS_StyleScopedClasses['stat-content']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-value" },
    ...{ class: ({ 'alert-value': __VLS_ctx.alertCount > 0 }) },
});
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-value']} */ ;
(__VLS_ctx.alertCount);
// @ts-ignore
[alertCount, alertCount, jobStats, cpuUsagePercent, activeUsers, stats, stats,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
