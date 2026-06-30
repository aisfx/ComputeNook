/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AdminUsers from './AdminUsers.vue';
import AdminGroups from './AdminGroups.vue';
import AdminQoS from './AdminQoS.vue';
import AdminPartitions from './AdminPartitions.vue';
import AdminHours from './AdminHours.vue';
import AdminQuota from './AdminQuota.vue';
import AdminAudit from './AdminAudit.vue';
import AdminCMDB from './AdminCMDB.vue';
import AdminSlurmAccounts from './AdminSlurmAccounts.vue';
import AdminSlurmUsers from './AdminSlurmUsers.vue';
import AdminAssociations from './AdminAssociations.vue';
import Monitoring from './Monitoring.vue';
import Reports from './Reports.vue';
import RackView from './RackView.vue';
import NetworkTopology from './NetworkTopology.vue';
import CustomDashboard from './CustomDashboard.vue';
import AIDiagnostics from './AIDiagnostics.vue';
import AdminDashboard from '../components/AdminDashboard.vue';
import { getUser, logout, setupAxiosInterceptors, isAdmin as checkAdmin } from '../utils/auth';
import { dialog } from '../utils/dialog';
const router = useRouter();
const adminTab = ref('dashboard');
const monitoringTab = ref('cluster');
const dashSubTab = ref('overview');
const monDropOpen = ref(false);
const monSubTabs = ['mon-mgmt', 'mon-cluster', 'mon-network', 'mon-jobs'];
const groupExpanded = reactive({ user: true, account: true, resource: true, monitoring: true, infra: true });
const sidebarCollapsed = ref(false);
const currentUser = ref(null);
const theme = ref('light');
const THEMES = ['light', 'dark', 'ocean'];
const THEME_ICONS = { light: '🌙', dark: '🌊', ocean: '☀️' };
const THEME_LABELS = { light: '切换暗色', dark: '切换海洋', ocean: '切换亮色' };
const themeIcon = computed(() => THEME_ICONS[theme.value]);
const themeLabel = computed(() => THEME_LABELS[theme.value]);
const currentTitle = computed(() => {
    if (adminTab.value === 'dashboard') {
        const sub = { overview: '集群总览', monitoring: '集群监控', reports: '用量报表' };
        return sub[dashSubTab.value] || '集群总览';
    }
    const map = {
        rack: '机柜管理', network: '网络拓扑', 'ai-diagnostics': 'AI 故障诊断',
        users: '用户', groups: '用户组', 'slurm-accounts': 'Slurm账户', 'slurm-users': 'Slurm用户',
        associations: '资源绑定', qos: 'QoS配置', hours: '机时管理', quota: '存储配额',
        'custom-dashboard': '监控面板', cmdb: '主机资产', audit: '数据审计',
    };
    return map[adminTab.value] || '管理后台';
});
const userInitial = computed(() => {
    const name = currentUser.value?.cnName || currentUser.value?.username || '?';
    return name.charAt(0).toUpperCase();
});
const toggleTheme = () => {
    const idx = THEMES.indexOf(theme.value);
    theme.value = THEMES[(idx + 1) % THEMES.length];
    localStorage.setItem('theme', theme.value);
    document.documentElement.setAttribute('data-theme', theme.value);
};
const goHome = () => router.push('/dashboard');
const handleLogout = async () => {
    if (await dialog.confirm('确定要退出登录吗？', { title: '退出登录' })) {
        logout();
        router.push('/login');
    }
};
onMounted(() => {
    setupAxiosInterceptors();
    currentUser.value = getUser();
    if (!checkAdmin()) {
        router.push('/dashboard');
        return;
    }
    const saved = localStorage.getItem('theme');
    if (saved && ['light', 'dark', 'ocean'].includes(saved))
        theme.value = saved;
    document.documentElement.setAttribute('data-theme', theme.value);
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar-collapse-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-sub-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-sub-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-sub-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-back']} */ ;
/** @type {__VLS_StyleScopedClasses['isub-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['isub-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['isub-chevron']} */ ;
/** @type {__VLS_StyleScopedClasses['isub-drop-item']} */ ;
/** @type {__VLS_StyleScopedClasses['isub-drop-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['fill-view']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['collapsed']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item-label']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['collapsed']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item-chevron']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['collapsed']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-section-label']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['collapsed']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-sub']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['collapsed']} */ ;
/** @type {__VLS_StyleScopedClasses['logo-text']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['collapsed']} */ ;
/** @type {__VLS_StyleScopedClasses['user-details']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['collapsed']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['collapsed']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar-collapse-btn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "app-shell" },
    'data-theme': (__VLS_ctx.theme),
});
/** @type {__VLS_StyleScopedClasses['app-shell']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
    ...{ class: "sidebar" },
    ...{ class: ({ collapsed: __VLS_ctx.sidebarCollapsed }) },
});
/** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['collapsed']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "sidebar-header" },
});
/** @type {__VLS_StyleScopedClasses['sidebar-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onClick: (__VLS_ctx.goHome) },
    ...{ class: "sidebar-logo" },
});
/** @type {__VLS_StyleScopedClasses['sidebar-logo']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "logo-icon" },
});
/** @type {__VLS_StyleScopedClasses['logo-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "22",
    height: "22",
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10.5z",
    fill: "white",
    opacity: "0.15",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M3 10.5L12 3l9 7.5",
    stroke: "white",
    'stroke-width': "2",
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M4 10.5V21h16V10.5",
    stroke: "white",
    'stroke-width': "2",
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
    x: "7.5",
    y: "12.5",
    width: "9",
    height: "7",
    rx: "1",
    stroke: "white",
    'stroke-width': "1.5",
    fill: "white",
    'fill-opacity': "0.1",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
    x: "10",
    y: "14.5",
    width: "4",
    height: "3",
    rx: "0.5",
    fill: "white",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "9.5",
    y1: "12.5",
    x2: "9.5",
    y2: "11.2",
    stroke: "white",
    'stroke-width': "1.2",
    'stroke-linecap': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "12",
    y1: "12.5",
    x2: "12",
    y2: "11.2",
    stroke: "white",
    'stroke-width': "1.2",
    'stroke-linecap': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "14.5",
    y1: "12.5",
    x2: "14.5",
    y2: "11.2",
    stroke: "white",
    'stroke-width': "1.2",
    'stroke-linecap': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "logo-text" },
});
/** @type {__VLS_StyleScopedClasses['logo-text']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.sidebarCollapsed = !__VLS_ctx.sidebarCollapsed;
            // @ts-ignore
            [theme, sidebarCollapsed, sidebarCollapsed, sidebarCollapsed, goHome,];
        } },
    ...{ class: "sidebar-collapse-btn" },
});
/** @type {__VLS_StyleScopedClasses['sidebar-collapse-btn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.sidebarCollapsed ? '→' : '←');
__VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
    ...{ class: "sidebar-nav" },
});
/** @type {__VLS_StyleScopedClasses['sidebar-nav']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nav-section" },
});
/** @type {__VLS_StyleScopedClasses['nav-section']} */ ;
if (!__VLS_ctx.sidebarCollapsed) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "nav-section-label" },
    });
    /** @type {__VLS_StyleScopedClasses['nav-section-label']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.adminTab = 'dashboard';
            // @ts-ignore
            [sidebarCollapsed, sidebarCollapsed, adminTab,];
        } },
    ...{ class: (['nav-item', { active: __VLS_ctx.adminTab === 'dashboard' }]) },
    title: (__VLS_ctx.sidebarCollapsed ? '总览' : ''),
});
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "nav-item-icon" },
});
/** @type {__VLS_StyleScopedClasses['nav-item-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    'stroke-width': "1.8",
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
    x: "3",
    y: "3",
    width: "7",
    height: "7",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
    x: "14",
    y: "3",
    width: "7",
    height: "7",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
    x: "3",
    y: "14",
    width: "7",
    height: "7",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
    x: "14",
    y: "14",
    width: "7",
    height: "7",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "nav-item-label" },
});
/** @type {__VLS_StyleScopedClasses['nav-item-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.groupExpanded.user = !__VLS_ctx.groupExpanded.user;
            // @ts-ignore
            [sidebarCollapsed, adminTab, groupExpanded, groupExpanded,];
        } },
    ...{ class: (['nav-item', { active: ['users', 'groups'].includes(__VLS_ctx.adminTab) }]) },
    title: (__VLS_ctx.sidebarCollapsed ? '用户管理' : ''),
});
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "nav-item-icon" },
});
/** @type {__VLS_StyleScopedClasses['nav-item-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    'stroke-width': "1.8",
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
    cx: "9",
    cy: "7",
    r: "4",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M23 21v-2a4 4 0 0 0-3-3.87",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M16 3.13a4 4 0 0 1 0 7.75",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "nav-item-label" },
});
/** @type {__VLS_StyleScopedClasses['nav-item-label']} */ ;
if (!__VLS_ctx.sidebarCollapsed) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "nav-item-chevron" },
    });
    /** @type {__VLS_StyleScopedClasses['nav-item-chevron']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        width: "12",
        height: "12",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        'stroke-width': "2",
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.polyline)({
        points: (__VLS_ctx.groupExpanded.user ? '18 15 12 9 6 15' : '6 9 12 15 18 9'),
    });
}
if (__VLS_ctx.groupExpanded.user && !__VLS_ctx.sidebarCollapsed) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "nav-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['nav-sub']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.groupExpanded.user && !__VLS_ctx.sidebarCollapsed))
                    return;
                __VLS_ctx.adminTab = 'users';
                // @ts-ignore
                [sidebarCollapsed, sidebarCollapsed, sidebarCollapsed, adminTab, adminTab, groupExpanded, groupExpanded,];
            } },
        ...{ class: (['nav-sub-item', { active: __VLS_ctx.adminTab === 'users' }]) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['nav-sub-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.groupExpanded.user && !__VLS_ctx.sidebarCollapsed))
                    return;
                __VLS_ctx.adminTab = 'groups';
                // @ts-ignore
                [adminTab, adminTab,];
            } },
        ...{ class: (['nav-sub-item', { active: __VLS_ctx.adminTab === 'groups' }]) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['nav-sub-item']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.groupExpanded.account = !__VLS_ctx.groupExpanded.account;
            // @ts-ignore
            [adminTab, groupExpanded, groupExpanded,];
        } },
    ...{ class: (['nav-item', { active: ['slurm-accounts', 'slurm-users'].includes(__VLS_ctx.adminTab) }]) },
    title: (__VLS_ctx.sidebarCollapsed ? '账户管理' : ''),
});
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "nav-item-icon" },
});
/** @type {__VLS_StyleScopedClasses['nav-item-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    'stroke-width': "1.8",
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
    cx: "12",
    cy: "12",
    r: "10",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "12",
    y1: "8",
    x2: "12",
    y2: "12",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "12",
    y1: "12",
    x2: "16",
    y2: "12",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "nav-item-label" },
});
/** @type {__VLS_StyleScopedClasses['nav-item-label']} */ ;
if (!__VLS_ctx.sidebarCollapsed) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "nav-item-chevron" },
    });
    /** @type {__VLS_StyleScopedClasses['nav-item-chevron']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        width: "12",
        height: "12",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        'stroke-width': "2",
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.polyline)({
        points: (__VLS_ctx.groupExpanded.account ? '18 15 12 9 6 15' : '6 9 12 15 18 9'),
    });
}
if (__VLS_ctx.groupExpanded.account && !__VLS_ctx.sidebarCollapsed) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "nav-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['nav-sub']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.groupExpanded.account && !__VLS_ctx.sidebarCollapsed))
                    return;
                __VLS_ctx.adminTab = 'slurm-accounts';
                // @ts-ignore
                [sidebarCollapsed, sidebarCollapsed, sidebarCollapsed, adminTab, adminTab, groupExpanded, groupExpanded,];
            } },
        ...{ class: (['nav-sub-item', { active: __VLS_ctx.adminTab === 'slurm-accounts' }]) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['nav-sub-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.groupExpanded.account && !__VLS_ctx.sidebarCollapsed))
                    return;
                __VLS_ctx.adminTab = 'slurm-users';
                // @ts-ignore
                [adminTab, adminTab,];
            } },
        ...{ class: (['nav-sub-item', { active: __VLS_ctx.adminTab === 'slurm-users' }]) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['nav-sub-item']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.groupExpanded.resource = !__VLS_ctx.groupExpanded.resource;
            // @ts-ignore
            [adminTab, groupExpanded, groupExpanded,];
        } },
    ...{ class: (['nav-item', { active: ['slurm-accounts', 'associations', 'qos', 'partitions', 'hours', 'quota'].includes(__VLS_ctx.adminTab) }]) },
    title: (__VLS_ctx.sidebarCollapsed ? '资源管理' : ''),
});
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "nav-item-icon" },
});
/** @type {__VLS_StyleScopedClasses['nav-item-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    'stroke-width': "1.8",
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.polygon)({
    points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "nav-item-label" },
});
/** @type {__VLS_StyleScopedClasses['nav-item-label']} */ ;
if (!__VLS_ctx.sidebarCollapsed) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "nav-item-chevron" },
    });
    /** @type {__VLS_StyleScopedClasses['nav-item-chevron']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        width: "12",
        height: "12",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        'stroke-width': "2",
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.polyline)({
        points: (__VLS_ctx.groupExpanded.resource ? '18 15 12 9 6 15' : '6 9 12 15 18 9'),
    });
}
if (__VLS_ctx.groupExpanded.resource && !__VLS_ctx.sidebarCollapsed) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "nav-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['nav-sub']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.groupExpanded.resource && !__VLS_ctx.sidebarCollapsed))
                    return;
                __VLS_ctx.adminTab = 'slurm-accounts';
                // @ts-ignore
                [sidebarCollapsed, sidebarCollapsed, sidebarCollapsed, adminTab, adminTab, groupExpanded, groupExpanded,];
            } },
        ...{ class: (['nav-sub-item', { active: __VLS_ctx.adminTab === 'slurm-accounts' }]) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['nav-sub-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.groupExpanded.resource && !__VLS_ctx.sidebarCollapsed))
                    return;
                __VLS_ctx.adminTab = 'associations';
                // @ts-ignore
                [adminTab, adminTab,];
            } },
        ...{ class: (['nav-sub-item', { active: __VLS_ctx.adminTab === 'associations' }]) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['nav-sub-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.groupExpanded.resource && !__VLS_ctx.sidebarCollapsed))
                    return;
                __VLS_ctx.adminTab = 'qos';
                // @ts-ignore
                [adminTab, adminTab,];
            } },
        ...{ class: (['nav-sub-item', { active: __VLS_ctx.adminTab === 'qos' }]) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['nav-sub-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.groupExpanded.resource && !__VLS_ctx.sidebarCollapsed))
                    return;
                __VLS_ctx.adminTab = 'partitions';
                // @ts-ignore
                [adminTab, adminTab,];
            } },
        ...{ class: (['nav-sub-item', { active: __VLS_ctx.adminTab === 'partitions' }]) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['nav-sub-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.groupExpanded.resource && !__VLS_ctx.sidebarCollapsed))
                    return;
                __VLS_ctx.adminTab = 'hours';
                // @ts-ignore
                [adminTab, adminTab,];
            } },
        ...{ class: (['nav-sub-item', { active: __VLS_ctx.adminTab === 'hours' }]) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['nav-sub-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.groupExpanded.resource && !__VLS_ctx.sidebarCollapsed))
                    return;
                __VLS_ctx.adminTab = 'quota';
                // @ts-ignore
                [adminTab, adminTab,];
            } },
        ...{ class: (['nav-sub-item', { active: __VLS_ctx.adminTab === 'quota' }]) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['nav-sub-item']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.groupExpanded.infra = !__VLS_ctx.groupExpanded.infra;
            // @ts-ignore
            [adminTab, groupExpanded, groupExpanded,];
        } },
    ...{ class: (['nav-item', { active: __VLS_ctx.adminTab === 'rack' || __VLS_ctx.adminTab === 'network' || __VLS_ctx.adminTab === 'cmdb' }]) },
    title: (__VLS_ctx.sidebarCollapsed ? '基础设施' : ''),
});
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "nav-item-icon" },
});
/** @type {__VLS_StyleScopedClasses['nav-item-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    'stroke-width': "1.8",
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
    x: "2",
    y: "2",
    width: "20",
    height: "8",
    rx: "2",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
    x: "2",
    y: "14",
    width: "20",
    height: "8",
    rx: "2",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "6",
    y1: "6",
    x2: "6.01",
    y2: "6",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "6",
    y1: "18",
    x2: "6.01",
    y2: "18",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "nav-item-label" },
});
/** @type {__VLS_StyleScopedClasses['nav-item-label']} */ ;
if (!__VLS_ctx.sidebarCollapsed) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "nav-item-chevron" },
    });
    /** @type {__VLS_StyleScopedClasses['nav-item-chevron']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        width: "12",
        height: "12",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        'stroke-width': "2",
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.polyline)({
        points: (__VLS_ctx.groupExpanded.infra ? '18 15 12 9 6 15' : '6 9 12 15 18 9'),
    });
}
if (__VLS_ctx.groupExpanded.infra && !__VLS_ctx.sidebarCollapsed) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "nav-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['nav-sub']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.groupExpanded.infra && !__VLS_ctx.sidebarCollapsed))
                    return;
                __VLS_ctx.adminTab = 'rack';
                // @ts-ignore
                [sidebarCollapsed, sidebarCollapsed, sidebarCollapsed, adminTab, adminTab, adminTab, adminTab, groupExpanded, groupExpanded,];
            } },
        ...{ class: (['nav-sub-item', { active: __VLS_ctx.adminTab === 'rack' }]) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['nav-sub-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.groupExpanded.infra && !__VLS_ctx.sidebarCollapsed))
                    return;
                __VLS_ctx.adminTab = 'cmdb';
                // @ts-ignore
                [adminTab, adminTab,];
            } },
        ...{ class: (['nav-sub-item', { active: __VLS_ctx.adminTab === 'cmdb' }]) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['nav-sub-item']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.adminTab = 'ai-diagnostics';
            // @ts-ignore
            [adminTab, adminTab,];
        } },
    ...{ class: (['nav-item', { active: __VLS_ctx.adminTab === 'ai-diagnostics' }]) },
    title: (__VLS_ctx.sidebarCollapsed ? 'AI 诊断' : ''),
});
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "nav-item-icon" },
});
/** @type {__VLS_StyleScopedClasses['nav-item-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    'stroke-width': "1.8",
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
    cx: "12",
    cy: "12",
    r: "10",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M12 8v4l3 3",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "nav-item-label" },
});
/** @type {__VLS_StyleScopedClasses['nav-item-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.adminTab = 'audit';
            // @ts-ignore
            [sidebarCollapsed, adminTab, adminTab,];
        } },
    ...{ class: (['nav-item', { active: __VLS_ctx.adminTab === 'audit' }]) },
    title: (__VLS_ctx.sidebarCollapsed ? '数据审计' : ''),
});
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "nav-item-icon" },
});
/** @type {__VLS_StyleScopedClasses['nav-item-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "16",
    height: "16",
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
__VLS_asFunctionalElement1(__VLS_intrinsics.polyline)({
    points: "10 9 9 9 8 9",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "nav-item-label" },
});
/** @type {__VLS_StyleScopedClasses['nav-item-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "sidebar-footer" },
});
/** @type {__VLS_StyleScopedClasses['sidebar-footer']} */ ;
if (!__VLS_ctx.sidebarCollapsed) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "user-info" },
    });
    /** @type {__VLS_StyleScopedClasses['user-info']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "user-avatar" },
    });
    /** @type {__VLS_StyleScopedClasses['user-avatar']} */ ;
    (__VLS_ctx.userInitial);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "user-details" },
    });
    /** @type {__VLS_StyleScopedClasses['user-details']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "user-name" },
    });
    /** @type {__VLS_StyleScopedClasses['user-name']} */ ;
    (__VLS_ctx.currentUser?.cnName || __VLS_ctx.currentUser?.username);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "user-role" },
    });
    /** @type {__VLS_StyleScopedClasses['user-role']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "user-avatar" },
        title: (__VLS_ctx.currentUser?.username),
    });
    /** @type {__VLS_StyleScopedClasses['user-avatar']} */ ;
    (__VLS_ctx.userInitial);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "main-wrapper" },
});
/** @type {__VLS_StyleScopedClasses['main-wrapper']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "topbar" },
});
/** @type {__VLS_StyleScopedClasses['topbar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "topbar-left" },
});
/** @type {__VLS_StyleScopedClasses['topbar-left']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({
    ...{ class: "page-title" },
});
/** @type {__VLS_StyleScopedClasses['page-title']} */ ;
(__VLS_ctx.currentTitle);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "topbar-right" },
});
/** @type {__VLS_StyleScopedClasses['topbar-right']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "status-badge" },
});
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "status-dot" },
});
/** @type {__VLS_StyleScopedClasses['status-dot']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.toggleTheme) },
    ...{ class: "icon-btn" },
    title: (__VLS_ctx.themeLabel),
});
/** @type {__VLS_StyleScopedClasses['icon-btn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.themeIcon);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.goHome) },
    ...{ class: "btn-back" },
    title: "返回主界面",
});
/** @type {__VLS_StyleScopedClasses['btn-back']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.handleLogout) },
    ...{ class: "icon-btn danger" },
    title: "退出",
});
/** @type {__VLS_StyleScopedClasses['icon-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.main, __VLS_intrinsics.main)({
    ...{ class: "content-area" },
});
/** @type {__VLS_StyleScopedClasses['content-area']} */ ;
if (__VLS_ctx.adminTab === 'dashboard') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "integrated-view" },
    });
    /** @type {__VLS_StyleScopedClasses['integrated-view']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "integrated-subtabs" },
    });
    /** @type {__VLS_StyleScopedClasses['integrated-subtabs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.adminTab === 'dashboard'))
                    return;
                __VLS_ctx.dashSubTab = 'overview';
                // @ts-ignore
                [sidebarCollapsed, sidebarCollapsed, goHome, adminTab, adminTab, userInitial, userInitial, currentUser, currentUser, currentUser, currentTitle, toggleTheme, themeLabel, themeIcon, handleLogout, dashSubTab,];
            } },
        ...{ class: (['isub-tab', __VLS_ctx.dashSubTab === 'overview' && 'active']) },
    });
    /** @type {__VLS_StyleScopedClasses['isub-tab']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "isub-divider" },
    });
    /** @type {__VLS_StyleScopedClasses['isub-divider']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "isub-dropdown" },
        ...{ class: ({ open: __VLS_ctx.monDropOpen }) },
    });
    /** @type {__VLS_StyleScopedClasses['isub-dropdown']} */ ;
    /** @type {__VLS_StyleScopedClasses['open']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.adminTab === 'dashboard'))
                    return;
                __VLS_ctx.monDropOpen = !__VLS_ctx.monDropOpen;
                // @ts-ignore
                [dashSubTab, monDropOpen, monDropOpen, monDropOpen,];
            } },
        ...{ class: (['isub-tab', __VLS_ctx.monSubTabs.includes(__VLS_ctx.dashSubTab) && 'active']) },
    });
    /** @type {__VLS_StyleScopedClasses['isub-tab']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        ...{ class: "isub-chevron" },
        ...{ class: ({ rotated: __VLS_ctx.monDropOpen }) },
        width: "12",
        height: "12",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        'stroke-width': "2.5",
    });
    /** @type {__VLS_StyleScopedClasses['isub-chevron']} */ ;
    /** @type {__VLS_StyleScopedClasses['rotated']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.polyline)({
        points: "6 9 12 15 18 9",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "isub-drop-menu" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.monDropOpen) }, null, null);
    /** @type {__VLS_StyleScopedClasses['isub-drop-menu']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.adminTab === 'dashboard'))
                    return;
                __VLS_ctx.dashSubTab = 'mon-mgmt';
                __VLS_ctx.monDropOpen = false;
                // @ts-ignore
                [dashSubTab, dashSubTab, monDropOpen, monDropOpen, monDropOpen, monSubTabs,];
            } },
        ...{ class: (['isub-drop-item', __VLS_ctx.dashSubTab === 'mon-mgmt' && 'active']) },
    });
    /** @type {__VLS_StyleScopedClasses['isub-drop-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.adminTab === 'dashboard'))
                    return;
                __VLS_ctx.dashSubTab = 'mon-cluster';
                __VLS_ctx.monDropOpen = false;
                // @ts-ignore
                [dashSubTab, dashSubTab, monDropOpen,];
            } },
        ...{ class: (['isub-drop-item', __VLS_ctx.dashSubTab === 'mon-cluster' && 'active']) },
    });
    /** @type {__VLS_StyleScopedClasses['isub-drop-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.adminTab === 'dashboard'))
                    return;
                __VLS_ctx.dashSubTab = 'mon-network';
                __VLS_ctx.monDropOpen = false;
                // @ts-ignore
                [dashSubTab, dashSubTab, monDropOpen,];
            } },
        ...{ class: (['isub-drop-item', __VLS_ctx.dashSubTab === 'mon-network' && 'active']) },
    });
    /** @type {__VLS_StyleScopedClasses['isub-drop-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.adminTab === 'dashboard'))
                    return;
                __VLS_ctx.dashSubTab = 'mon-jobs';
                __VLS_ctx.monDropOpen = false;
                // @ts-ignore
                [dashSubTab, dashSubTab, monDropOpen,];
            } },
        ...{ class: (['isub-drop-item', __VLS_ctx.dashSubTab === 'mon-jobs' && 'active']) },
    });
    /** @type {__VLS_StyleScopedClasses['isub-drop-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.adminTab === 'dashboard'))
                    return;
                __VLS_ctx.dashSubTab = 'mon-alerts';
                // @ts-ignore
                [dashSubTab, dashSubTab,];
            } },
        ...{ class: (['isub-tab', __VLS_ctx.dashSubTab === 'mon-alerts' && 'active']) },
    });
    /** @type {__VLS_StyleScopedClasses['isub-tab']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "isub-divider" },
    });
    /** @type {__VLS_StyleScopedClasses['isub-divider']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.adminTab === 'dashboard'))
                    return;
                __VLS_ctx.dashSubTab = 'reports';
                // @ts-ignore
                [dashSubTab, dashSubTab,];
            } },
        ...{ class: (['isub-tab', __VLS_ctx.dashSubTab === 'reports' && 'active']) },
    });
    /** @type {__VLS_StyleScopedClasses['isub-tab']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "integrated-body" },
    });
    /** @type {__VLS_StyleScopedClasses['integrated-body']} */ ;
    if (__VLS_ctx.dashSubTab === 'overview') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "fill-view" },
        });
        /** @type {__VLS_StyleScopedClasses['fill-view']} */ ;
        const __VLS_0 = AdminDashboard;
        // @ts-ignore
        const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({}));
        const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
    }
    else if (__VLS_ctx.dashSubTab === 'mon-mgmt') {
        const __VLS_5 = Monitoring;
        // @ts-ignore
        const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
            activeTab: "mgmt",
        }));
        const __VLS_7 = __VLS_6({
            activeTab: "mgmt",
        }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    }
    else if (__VLS_ctx.dashSubTab === 'mon-cluster') {
        const __VLS_10 = Monitoring;
        // @ts-ignore
        const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
            activeTab: "cluster",
        }));
        const __VLS_12 = __VLS_11({
            activeTab: "cluster",
        }, ...__VLS_functionalComponentArgsRest(__VLS_11));
    }
    else if (__VLS_ctx.dashSubTab === 'mon-network') {
        const __VLS_15 = Monitoring;
        // @ts-ignore
        const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
            activeTab: "network",
        }));
        const __VLS_17 = __VLS_16({
            activeTab: "network",
        }, ...__VLS_functionalComponentArgsRest(__VLS_16));
    }
    else if (__VLS_ctx.dashSubTab === 'mon-jobs') {
        const __VLS_20 = Monitoring;
        // @ts-ignore
        const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
            activeTab: "jobs",
        }));
        const __VLS_22 = __VLS_21({
            activeTab: "jobs",
        }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    }
    else if (__VLS_ctx.dashSubTab === 'mon-alerts') {
        const __VLS_25 = Monitoring;
        // @ts-ignore
        const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({
            activeTab: "alerts",
        }));
        const __VLS_27 = __VLS_26({
            activeTab: "alerts",
        }, ...__VLS_functionalComponentArgsRest(__VLS_26));
    }
    else if (__VLS_ctx.dashSubTab === 'reports') {
        const __VLS_30 = Reports;
        // @ts-ignore
        const __VLS_31 = __VLS_asFunctionalComponent1(__VLS_30, new __VLS_30({}));
        const __VLS_32 = __VLS_31({}, ...__VLS_functionalComponentArgsRest(__VLS_31));
    }
}
else if (__VLS_ctx.adminTab === 'rack') {
    const __VLS_35 = RackView;
    // @ts-ignore
    const __VLS_36 = __VLS_asFunctionalComponent1(__VLS_35, new __VLS_35({
        ...{ class: "fill-view" },
    }));
    const __VLS_37 = __VLS_36({
        ...{ class: "fill-view" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_36));
    /** @type {__VLS_StyleScopedClasses['fill-view']} */ ;
}
else if (__VLS_ctx.adminTab === 'network') {
    const __VLS_40 = NetworkTopology;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent1(__VLS_40, new __VLS_40({
        ...{ class: "fill-view" },
    }));
    const __VLS_42 = __VLS_41({
        ...{ class: "fill-view" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    /** @type {__VLS_StyleScopedClasses['fill-view']} */ ;
}
else if (__VLS_ctx.adminTab === 'cmdb') {
    const __VLS_45 = AdminCMDB;
    // @ts-ignore
    const __VLS_46 = __VLS_asFunctionalComponent1(__VLS_45, new __VLS_45({
        ...{ class: "fill-view" },
    }));
    const __VLS_47 = __VLS_46({
        ...{ class: "fill-view" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_46));
    /** @type {__VLS_StyleScopedClasses['fill-view']} */ ;
}
else if (__VLS_ctx.adminTab === 'custom-dashboard') {
    const __VLS_50 = CustomDashboard;
    // @ts-ignore
    const __VLS_51 = __VLS_asFunctionalComponent1(__VLS_50, new __VLS_50({
        ...{ class: "fill-view" },
    }));
    const __VLS_52 = __VLS_51({
        ...{ class: "fill-view" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_51));
    /** @type {__VLS_StyleScopedClasses['fill-view']} */ ;
}
else if (__VLS_ctx.adminTab === 'users') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pad-view" },
    });
    /** @type {__VLS_StyleScopedClasses['pad-view']} */ ;
    const __VLS_55 = AdminUsers;
    // @ts-ignore
    const __VLS_56 = __VLS_asFunctionalComponent1(__VLS_55, new __VLS_55({}));
    const __VLS_57 = __VLS_56({}, ...__VLS_functionalComponentArgsRest(__VLS_56));
}
else if (__VLS_ctx.adminTab === 'groups') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pad-view" },
    });
    /** @type {__VLS_StyleScopedClasses['pad-view']} */ ;
    const __VLS_60 = AdminGroups;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent1(__VLS_60, new __VLS_60({}));
    const __VLS_62 = __VLS_61({}, ...__VLS_functionalComponentArgsRest(__VLS_61));
}
else if (__VLS_ctx.adminTab === 'qos') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pad-view" },
    });
    /** @type {__VLS_StyleScopedClasses['pad-view']} */ ;
    const __VLS_65 = AdminQoS;
    // @ts-ignore
    const __VLS_66 = __VLS_asFunctionalComponent1(__VLS_65, new __VLS_65({}));
    const __VLS_67 = __VLS_66({}, ...__VLS_functionalComponentArgsRest(__VLS_66));
}
else if (__VLS_ctx.adminTab === 'partitions') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pad-view" },
    });
    /** @type {__VLS_StyleScopedClasses['pad-view']} */ ;
    const __VLS_70 = AdminPartitions;
    // @ts-ignore
    const __VLS_71 = __VLS_asFunctionalComponent1(__VLS_70, new __VLS_70({}));
    const __VLS_72 = __VLS_71({}, ...__VLS_functionalComponentArgsRest(__VLS_71));
}
else if (__VLS_ctx.adminTab === 'associations') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pad-view" },
    });
    /** @type {__VLS_StyleScopedClasses['pad-view']} */ ;
    const __VLS_75 = AdminAssociations;
    // @ts-ignore
    const __VLS_76 = __VLS_asFunctionalComponent1(__VLS_75, new __VLS_75({}));
    const __VLS_77 = __VLS_76({}, ...__VLS_functionalComponentArgsRest(__VLS_76));
}
else if (__VLS_ctx.adminTab === 'hours') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pad-view" },
    });
    /** @type {__VLS_StyleScopedClasses['pad-view']} */ ;
    const __VLS_80 = AdminHours;
    // @ts-ignore
    const __VLS_81 = __VLS_asFunctionalComponent1(__VLS_80, new __VLS_80({}));
    const __VLS_82 = __VLS_81({}, ...__VLS_functionalComponentArgsRest(__VLS_81));
}
else if (__VLS_ctx.adminTab === 'quota') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pad-view" },
    });
    /** @type {__VLS_StyleScopedClasses['pad-view']} */ ;
    const __VLS_85 = AdminQuota;
    // @ts-ignore
    const __VLS_86 = __VLS_asFunctionalComponent1(__VLS_85, new __VLS_85({}));
    const __VLS_87 = __VLS_86({}, ...__VLS_functionalComponentArgsRest(__VLS_86));
}
else if (__VLS_ctx.adminTab === 'audit') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pad-view" },
    });
    /** @type {__VLS_StyleScopedClasses['pad-view']} */ ;
    const __VLS_90 = AdminAudit;
    // @ts-ignore
    const __VLS_91 = __VLS_asFunctionalComponent1(__VLS_90, new __VLS_90({}));
    const __VLS_92 = __VLS_91({}, ...__VLS_functionalComponentArgsRest(__VLS_91));
}
else if (__VLS_ctx.adminTab === 'slurm-accounts') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pad-view" },
    });
    /** @type {__VLS_StyleScopedClasses['pad-view']} */ ;
    const __VLS_95 = AdminSlurmAccounts;
    // @ts-ignore
    const __VLS_96 = __VLS_asFunctionalComponent1(__VLS_95, new __VLS_95({}));
    const __VLS_97 = __VLS_96({}, ...__VLS_functionalComponentArgsRest(__VLS_96));
}
else if (__VLS_ctx.adminTab === 'slurm-users') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pad-view" },
    });
    /** @type {__VLS_StyleScopedClasses['pad-view']} */ ;
    const __VLS_100 = AdminSlurmUsers;
    // @ts-ignore
    const __VLS_101 = __VLS_asFunctionalComponent1(__VLS_100, new __VLS_100({}));
    const __VLS_102 = __VLS_101({}, ...__VLS_functionalComponentArgsRest(__VLS_101));
}
else if (__VLS_ctx.adminTab === 'ai-diagnostics') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pad-view" },
    });
    /** @type {__VLS_StyleScopedClasses['pad-view']} */ ;
    const __VLS_105 = AIDiagnostics;
    // @ts-ignore
    const __VLS_106 = __VLS_asFunctionalComponent1(__VLS_105, new __VLS_105({}));
    const __VLS_107 = __VLS_106({}, ...__VLS_functionalComponentArgsRest(__VLS_106));
}
// @ts-ignore
[adminTab, adminTab, adminTab, adminTab, adminTab, adminTab, adminTab, adminTab, adminTab, adminTab, adminTab, adminTab, adminTab, adminTab, adminTab, dashSubTab, dashSubTab, dashSubTab, dashSubTab, dashSubTab, dashSubTab, dashSubTab, dashSubTab,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
