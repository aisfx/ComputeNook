/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, provide, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import Dashboard from './Dashboard.vue';
import JobManagement from './JobManagement.vue';
import WebShell from './WebShell.vue';
import Desktop from './Desktop.vue';
import Download from './Download.vue';
import FileManager from './FileManager.vue';
import Registry from './Registry.vue';
import AITasks from './AITasks.vue';
import Reports from './Reports.vue';
import AdminUsers from './AdminUsers.vue';
import AdminGroups from './AdminGroups.vue';
import AdminQoS from './AdminQoS.vue';
import AdminHours from './AdminHours.vue';
import AdminQuota from './AdminQuota.vue';
import AdminAudit from './AdminAudit.vue';
import AdminSlurmAccounts from './AdminSlurmAccounts.vue';
import AdminSlurmUsers from './AdminSlurmUsers.vue';
import AdminAssociations from './AdminAssociations.vue';
import Monitoring from './Monitoring.vue';
import Profile from './Profile.vue';
import RackView from './RackView.vue';
import NetworkTopology from './NetworkTopology.vue';
import AIAssistant from '../components/AIAssistant.vue';
import AlertNotification from '../components/AlertNotification.vue';
import DesktopPet from '../components/DesktopPet.vue';
import { getUser, logout, setupAxiosInterceptors, isAdmin as checkAdmin } from '../utils/auth';
import { dialog } from '../utils/dialog';
import { uploadTasks, showUploadPanel, clearFinishedUploads } from '../utils/uploadManager';
const formatUploadSize = (bytes) => {
    if (bytes < 1024)
        return bytes + ' B';
    if (bytes < 1024 * 1024)
        return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
};
const router = useRouter();
const currentView = ref('dashboard');
const jobManagementTab = ref('info');
const jobsExpanded = ref(true);
const shellExpanded = ref(true);
const monitoringExpanded = ref(true);
const monitoringTab = ref('cluster');
const adminTab = ref('users');
const adminExpanded = ref(false);
const sidebarCollapsed = ref(false);
const mobileMenuOpen = ref(false);
const currentUser = ref(null);
const isAdmin = ref(false);
const fileManagerRef = ref(null);
const aiAssistantRef = ref(null);
const desktopPetRef = ref(null);
const theme = ref('light');
const showDesktopPet = ref(true); // 桌面宠物开关
provide('jobManagementTab', jobManagementTab);
// 导航并关闭移动端菜单
const navigate = (view) => {
    currentView.value = view;
    mobileMenuOpen.value = false;
};
const userInitial = computed(() => {
    const name = currentUser.value?.cnName || currentUser.value?.username || '?';
    return name.charAt(0).toUpperCase();
});
const THEMES = ['light', 'dark', 'ocean'];
const THEME_ICONS = { light: '🌙', dark: '🌊', ocean: '☀️' };
const THEME_LABELS = { light: '切换暗色', dark: '切换海洋', ocean: '切换亮色' };
const themeIcon = computed(() => THEME_ICONS[theme.value]);
const themeLabel = computed(() => THEME_LABELS[theme.value]);
const cycleTheme = () => {
    const idx = THEMES.indexOf(theme.value);
    theme.value = THEMES[(idx + 1) % THEMES.length];
    localStorage.setItem('theme', theme.value);
    document.documentElement.setAttribute('data-theme', theme.value);
};
const handleOpenDirectory = (path) => {
    currentView.value = 'files';
    setTimeout(() => {
        if (fileManagerRef.value?.navigateToPath) {
            fileManagerRef.value.navigateToPath(path);
        }
    }, 100);
};
const monitoringSubItems = [
    { id: 'cluster', label: '集群状态' },
];
const otherMenuItems = [
    { id: 'files', label: '文件管理', icon: '-' },
    { id: 'reports', label: '报表中心', icon: '~' },
];
const jobTabs = [
    { id: 'info', label: '作业列表' }
];
const adminTabs = [
    { id: 'group-user', label: '用户管理', isGroup: true },
    { id: 'users', label: '用户管理', parent: 'group-user' },
    { id: 'groups', label: '用户组管理', parent: 'group-user' },
    { id: 'group-account', label: '账户管理', isGroup: true },
    { id: 'slurm-accounts', label: 'Slurm账户', parent: 'group-account' },
    { id: 'slurm-users', label: 'Slurm用户', parent: 'group-account' },
    { id: 'group-resource', label: '资源管理', isGroup: true },
    { id: 'associations', label: '资源绑定', parent: 'group-resource' },
    { id: 'qos', label: 'QoS配置', parent: 'group-resource' },
    { id: 'hours', label: '机时管理', parent: 'group-resource' },
    { id: 'quota', label: '存储配额', parent: 'group-resource' },
    { id: 'audit', label: '数据审计' }
];
const currentTitle = computed(() => {
    if (currentView.value === 'admin') {
        const tab = adminTabs.find(t => t.id === adminTab.value);
        return tab?.label || '系统管理';
    }
    if (currentView.value === 'jobs') {
        const tab = jobTabs.find(t => t.id === jobManagementTab.value);
        return tab?.label || '作业管理';
    }
    const all = [
        { id: 'dashboard', label: '仪表盘' },
        ...otherMenuItems,
        { id: 'monitoring', label: '集群监控' },
        { id: 'rack', label: '机柜管理' },
        { id: 'profile', label: '个人信息' },
        { id: 'custom-dashboard', label: '自定义看板' },
        { id: 'registry', label: '镜像仓库' },
    ];
    if (currentView.value === 'monitoring') {
        const sub = monitoringSubItems.find(s => s.id === monitoringTab.value);
        return sub ? `集群监控 · ${sub.label}` : '集群监控';
    }
    return all.find(i => i.id === currentView.value)?.label || '';
});
const handleLogout = async () => {
    if (await dialog.confirm('确定要退出登录吗？', { title: '退出登录' })) {
        await logout();
        router.push('/login');
    }
};
const goToProfile = () => { currentView.value = 'profile'; };
const goToAdmin = () => { router.push('/admin'); };
// 桌面宠物相关方法
const openAIAssistant = () => {
    // 通过 ref 调用 AIAssistant 的方法打开聊天窗口
    if (aiAssistantRef.value?.toggleChat) {
        aiAssistantRef.value.toggleChat();
    }
};
const handlePetQuickAction = (action) => {
    switch (action) {
        case 'jobs':
            currentView.value = 'jobs';
            break;
        case 'files':
            currentView.value = 'files';
            break;
        case 'submit':
            currentView.value = 'jobs';
            // 可以触发作业提交面板
            break;
        case 'monitor':
            currentView.value = 'monitoring';
            break;
        case 'users':
            router.push('/admin');
            break;
    }
};
// 页面标题映射，用于上报可读名称
const PAGE_TITLES = {
    dashboard: '仪表盘', shell: 'Web Shell', desktop: '远程桌面',
    jobs: '作业管理', files: '文件管理', reports: '报表中心',
    monitoring: '集群监控', rack: '机柜管理', network: '网络拓扑',
    profile: '个人信息', download: '客户端下载', admin: '系统管理',
    registry: '镜像仓库',
    'ai-tasks': 'AI 作业',
};
// 上报页面访问，防抖避免快速切换时重复上报
let pageViewTimer = null;
const reportPageView = (page) => {
    if (pageViewTimer)
        clearTimeout(pageViewTimer);
    pageViewTimer = setTimeout(() => {
        const title = PAGE_TITLES[page] || page;
        axios.post('/audit/page-view', { page, title }).catch(() => { });
    }, 500);
};
watch(currentView, (page) => {
    reportPageView(page);
});
onMounted(() => {
    setupAxiosInterceptors();
    currentUser.value = getUser();
    isAdmin.value = checkAdmin();
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
/** @type {__VLS_StyleScopedClasses['sidebar-overlay']} */ ;
/** @type {__VLS_StyleScopedClasses['mobile-menu-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar-collapse-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-admin']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-download']} */ ;
/** @type {__VLS_StyleScopedClasses['no-permission']} */ ;
/** @type {__VLS_StyleScopedClasses['no-permission']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['collapsed']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item-label']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['collapsed']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['collapsed']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-section-label']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['collapsed']} */ ;
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
/** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar-collapse-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['mobile-menu-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-admin']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-admin']} */ ;
/** @type {__VLS_StyleScopedClasses['topbar']} */ ;
/** @type {__VLS_StyleScopedClasses['content-area']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-admin']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-text']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-admin']} */ ;
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['global-upload-close']} */ ;
/** @type {__VLS_StyleScopedClasses['global-upload-item']} */ ;
/** @type {__VLS_StyleScopedClasses['global-upload-status']} */ ;
/** @type {__VLS_StyleScopedClasses['global-upload-status']} */ ;
/** @type {__VLS_StyleScopedClasses['global-upload-status']} */ ;
/** @type {__VLS_StyleScopedClasses['global-upload-status']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "app-shell" },
    'data-theme': (__VLS_ctx.theme),
});
/** @type {__VLS_StyleScopedClasses['app-shell']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.mobileMenuOpen = false;
            // @ts-ignore
            [theme, mobileMenuOpen,];
        } },
    ...{ class: "sidebar-overlay" },
    ...{ class: ({ active: __VLS_ctx.mobileMenuOpen }) },
});
/** @type {__VLS_StyleScopedClasses['sidebar-overlay']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
    ...{ class: "sidebar" },
    ...{ class: ({ collapsed: __VLS_ctx.sidebarCollapsed, 'mobile-open': __VLS_ctx.mobileMenuOpen }) },
});
/** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['collapsed']} */ ;
/** @type {__VLS_StyleScopedClasses['mobile-open']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "sidebar-header" },
});
/** @type {__VLS_StyleScopedClasses['sidebar-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.currentView = 'dashboard';
            __VLS_ctx.mobileMenuOpen = false;
            // @ts-ignore
            [mobileMenuOpen, mobileMenuOpen, mobileMenuOpen, sidebarCollapsed, currentView,];
        } },
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
            [sidebarCollapsed, sidebarCollapsed,];
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
            __VLS_ctx.navigate('dashboard');
            // @ts-ignore
            [sidebarCollapsed, sidebarCollapsed, navigate,];
        } },
    ...{ class: (['nav-item', { active: __VLS_ctx.currentView === 'dashboard' }]) },
    title: (__VLS_ctx.sidebarCollapsed ? '仪表盘' : ''),
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
            __VLS_ctx.navigate('jobs');
            // @ts-ignore
            [sidebarCollapsed, currentView, navigate,];
        } },
    ...{ class: (['nav-item', { active: __VLS_ctx.currentView === 'jobs' }]) },
    title: (__VLS_ctx.sidebarCollapsed ? '作业管理' : ''),
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
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "nav-item-label" },
});
/** @type {__VLS_StyleScopedClasses['nav-item-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.navigate('shell');
            // @ts-ignore
            [sidebarCollapsed, currentView, navigate,];
        } },
    ...{ class: (['nav-item', { active: __VLS_ctx.currentView === 'shell' }]) },
    title: (__VLS_ctx.sidebarCollapsed ? 'Web Shell' : ''),
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
__VLS_asFunctionalElement1(__VLS_intrinsics.polyline)({
    points: "4 17 10 11 4 5",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "12",
    y1: "19",
    x2: "20",
    y2: "19",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "nav-item-label" },
});
/** @type {__VLS_StyleScopedClasses['nav-item-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.navigate('desktop');
            // @ts-ignore
            [sidebarCollapsed, currentView, navigate,];
        } },
    ...{ class: (['nav-item', { active: __VLS_ctx.currentView === 'desktop' }]) },
    title: (__VLS_ctx.sidebarCollapsed ? '远程桌面' : ''),
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
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "nav-item-label" },
});
/** @type {__VLS_StyleScopedClasses['nav-item-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.navigate('files');
            // @ts-ignore
            [sidebarCollapsed, currentView, navigate,];
        } },
    ...{ class: (['nav-item', { active: __VLS_ctx.currentView === 'files' }]) },
    title: (__VLS_ctx.sidebarCollapsed ? '文件管理' : ''),
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
    d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "nav-item-label" },
});
/** @type {__VLS_StyleScopedClasses['nav-item-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.navigate('registry');
            // @ts-ignore
            [sidebarCollapsed, currentView, navigate,];
        } },
    ...{ class: (['nav-item', { active: __VLS_ctx.currentView === 'registry' }]) },
    title: (__VLS_ctx.sidebarCollapsed ? '镜像仓库' : ''),
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
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "nav-item-label" },
});
/** @type {__VLS_StyleScopedClasses['nav-item-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.navigate('reports');
            // @ts-ignore
            [sidebarCollapsed, currentView, navigate,];
        } },
    ...{ class: (['nav-item', { active: __VLS_ctx.currentView === 'reports' }]) },
    title: (__VLS_ctx.sidebarCollapsed ? '报表中心' : ''),
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
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "18",
    y1: "20",
    x2: "18",
    y2: "10",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "12",
    y1: "20",
    x2: "12",
    y2: "4",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "6",
    y1: "20",
    x2: "6",
    y2: "14",
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
    (__VLS_ctx.isAdmin ? '管理员' : '普通用户');
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
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.mobileMenuOpen = !__VLS_ctx.mobileMenuOpen;
            // @ts-ignore
            [mobileMenuOpen, mobileMenuOpen, sidebarCollapsed, sidebarCollapsed, currentView, userInitial, userInitial, currentUser, currentUser, currentUser, isAdmin,];
        } },
    ...{ class: "mobile-menu-btn" },
    'aria-label': "菜单",
});
/** @type {__VLS_StyleScopedClasses['mobile-menu-btn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    'stroke-width': "2",
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "3",
    y1: "6",
    x2: "21",
    y2: "6",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "3",
    y1: "12",
    x2: "21",
    y2: "12",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.line)({
    x1: "3",
    y1: "18",
    x2: "21",
    y2: "18",
});
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
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "status-text" },
});
/** @type {__VLS_StyleScopedClasses['status-text']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.cycleTheme) },
    ...{ class: "icon-btn theme-cycle-btn" },
    title: (__VLS_ctx.themeLabel),
});
/** @type {__VLS_StyleScopedClasses['icon-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['theme-cycle-btn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.themeIcon);
const __VLS_0 = AlertNotification;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    showBell: (true),
}));
const __VLS_2 = __VLS_1({
    showBell: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
if (__VLS_ctx.isAdmin) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.goToAdmin) },
        ...{ class: "btn-admin" },
        title: "管理后台",
    });
    /** @type {__VLS_StyleScopedClasses['btn-admin']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "btn-text" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-text']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.navigate('download');
            // @ts-ignore
            [navigate, isAdmin, currentTitle, cycleTheme, themeLabel, themeIcon, goToAdmin,];
        } },
    ...{ class: "btn-admin btn-download" },
    title: "下载客户端",
});
/** @type {__VLS_StyleScopedClasses['btn-admin']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-download']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "btn-text" },
});
/** @type {__VLS_StyleScopedClasses['btn-text']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.goToProfile) },
    ...{ class: "icon-btn" },
    title: "个人信息",
});
/** @type {__VLS_StyleScopedClasses['icon-btn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
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
    ...{ class: ({ 'content-area--noscroll': __VLS_ctx.currentView === 'rack' }) },
});
/** @type {__VLS_StyleScopedClasses['content-area']} */ ;
/** @type {__VLS_StyleScopedClasses['content-area--noscroll']} */ ;
if (__VLS_ctx.currentView === 'dashboard') {
    const __VLS_5 = Dashboard;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
        ...{ 'onNavigate': {} },
    }));
    const __VLS_7 = __VLS_6({
        ...{ 'onNavigate': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    let __VLS_10;
    const __VLS_11 = ({ navigate: {} },
        { onNavigate: (...[$event]) => {
                if (!(__VLS_ctx.currentView === 'dashboard'))
                    return;
                __VLS_ctx.currentView = $event;
                // @ts-ignore
                [currentView, currentView, currentView, goToProfile, handleLogout,];
            } });
    var __VLS_8;
    var __VLS_9;
}
if (__VLS_ctx.currentView === 'jobs') {
    const __VLS_12 = JobManagement;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
        ...{ 'onOpenDirectory': {} },
        ...{ 'onGoRegistry': {} },
        ...{ 'onExecContainer': {} },
    }));
    const __VLS_14 = __VLS_13({
        ...{ 'onOpenDirectory': {} },
        ...{ 'onGoRegistry': {} },
        ...{ 'onExecContainer': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    let __VLS_17;
    const __VLS_18 = ({ openDirectory: {} },
        { onOpenDirectory: (__VLS_ctx.handleOpenDirectory) });
    const __VLS_19 = ({ goRegistry: {} },
        { onGoRegistry: (...[$event]) => {
                if (!(__VLS_ctx.currentView === 'jobs'))
                    return;
                __VLS_ctx.currentView = 'registry';
                // @ts-ignore
                [currentView, currentView, handleOpenDirectory,];
            } });
    const __VLS_20 = ({ execContainer: {} },
        { onExecContainer: (...[$event]) => {
                if (!(__VLS_ctx.currentView === 'jobs'))
                    return;
                __VLS_ctx.currentView = 'shell';
                // @ts-ignore
                [currentView,];
            } });
    var __VLS_15;
    var __VLS_16;
}
if (__VLS_ctx.currentView === 'monitoring' && __VLS_ctx.isAdmin) {
    const __VLS_21 = Monitoring;
    // @ts-ignore
    const __VLS_22 = __VLS_asFunctionalComponent1(__VLS_21, new __VLS_21({
        ...{ 'onTabChange': {} },
        activeTab: (__VLS_ctx.monitoringTab),
    }));
    const __VLS_23 = __VLS_22({
        ...{ 'onTabChange': {} },
        activeTab: (__VLS_ctx.monitoringTab),
    }, ...__VLS_functionalComponentArgsRest(__VLS_22));
    let __VLS_26;
    const __VLS_27 = ({ tabChange: {} },
        { onTabChange: (...[$event]) => {
                if (!(__VLS_ctx.currentView === 'monitoring' && __VLS_ctx.isAdmin))
                    return;
                __VLS_ctx.monitoringTab = $event;
                // @ts-ignore
                [currentView, isAdmin, monitoringTab, monitoringTab,];
            } });
    var __VLS_24;
    var __VLS_25;
}
if (__VLS_ctx.currentView === 'rack' && __VLS_ctx.isAdmin) {
    const __VLS_28 = RackView;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent1(__VLS_28, new __VLS_28({}));
    const __VLS_30 = __VLS_29({}, ...__VLS_functionalComponentArgsRest(__VLS_29));
}
if (__VLS_ctx.currentView === 'network' && __VLS_ctx.isAdmin) {
    const __VLS_33 = NetworkTopology;
    // @ts-ignore
    const __VLS_34 = __VLS_asFunctionalComponent1(__VLS_33, new __VLS_33({}));
    const __VLS_35 = __VLS_34({}, ...__VLS_functionalComponentArgsRest(__VLS_34));
}
let __VLS_38;
/** @ts-ignore @type {typeof __VLS_components.KeepAlive | typeof __VLS_components.KeepAlive} */
KeepAlive;
// @ts-ignore
const __VLS_39 = __VLS_asFunctionalComponent1(__VLS_38, new __VLS_38({}));
const __VLS_40 = __VLS_39({}, ...__VLS_functionalComponentArgsRest(__VLS_39));
const { default: __VLS_43 } = __VLS_41.slots;
if (__VLS_ctx.currentView === 'shell') {
    const __VLS_44 = WebShell;
    // @ts-ignore
    const __VLS_45 = __VLS_asFunctionalComponent1(__VLS_44, new __VLS_44({}));
    const __VLS_46 = __VLS_45({}, ...__VLS_functionalComponentArgsRest(__VLS_45));
}
// @ts-ignore
[currentView, currentView, currentView, isAdmin, isAdmin,];
var __VLS_41;
if (__VLS_ctx.currentView === 'desktop') {
    const __VLS_49 = Desktop;
    // @ts-ignore
    const __VLS_50 = __VLS_asFunctionalComponent1(__VLS_49, new __VLS_49({
        ...{ 'onOpenDownload': {} },
    }));
    const __VLS_51 = __VLS_50({
        ...{ 'onOpenDownload': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_50));
    let __VLS_54;
    const __VLS_55 = ({ openDownload: {} },
        { onOpenDownload: (...[$event]) => {
                if (!(__VLS_ctx.currentView === 'desktop'))
                    return;
                __VLS_ctx.currentView = 'download';
                // @ts-ignore
                [currentView, currentView,];
            } });
    var __VLS_52;
    var __VLS_53;
}
if (__VLS_ctx.currentView === 'files') {
    const __VLS_56 = FileManager;
    // @ts-ignore
    const __VLS_57 = __VLS_asFunctionalComponent1(__VLS_56, new __VLS_56({
        ref: "fileManagerRef",
    }));
    const __VLS_58 = __VLS_57({
        ref: "fileManagerRef",
    }, ...__VLS_functionalComponentArgsRest(__VLS_57));
    var __VLS_61 = {};
    var __VLS_59;
}
if (__VLS_ctx.currentView === 'registry') {
    const __VLS_63 = Registry;
    // @ts-ignore
    const __VLS_64 = __VLS_asFunctionalComponent1(__VLS_63, new __VLS_63({}));
    const __VLS_65 = __VLS_64({}, ...__VLS_functionalComponentArgsRest(__VLS_64));
}
if (__VLS_ctx.currentView === 'ai-tasks') {
    const __VLS_68 = AITasks;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent1(__VLS_68, new __VLS_68({}));
    const __VLS_70 = __VLS_69({}, ...__VLS_functionalComponentArgsRest(__VLS_69));
}
if (__VLS_ctx.currentView === 'reports') {
    const __VLS_73 = Reports;
    // @ts-ignore
    const __VLS_74 = __VLS_asFunctionalComponent1(__VLS_73, new __VLS_73({}));
    const __VLS_75 = __VLS_74({}, ...__VLS_functionalComponentArgsRest(__VLS_74));
}
if (__VLS_ctx.currentView === 'profile') {
    const __VLS_78 = Profile;
    // @ts-ignore
    const __VLS_79 = __VLS_asFunctionalComponent1(__VLS_78, new __VLS_78({}));
    const __VLS_80 = __VLS_79({}, ...__VLS_functionalComponentArgsRest(__VLS_79));
}
if (__VLS_ctx.currentView === 'download') {
    const __VLS_83 = Download;
    // @ts-ignore
    const __VLS_84 = __VLS_asFunctionalComponent1(__VLS_83, new __VLS_83({
        ...{ 'onGoDesktop': {} },
        ...{ 'onGoFiles': {} },
    }));
    const __VLS_85 = __VLS_84({
        ...{ 'onGoDesktop': {} },
        ...{ 'onGoFiles': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_84));
    let __VLS_88;
    const __VLS_89 = ({ goDesktop: {} },
        { onGoDesktop: (...[$event]) => {
                if (!(__VLS_ctx.currentView === 'download'))
                    return;
                __VLS_ctx.navigate('desktop');
                // @ts-ignore
                [currentView, currentView, currentView, currentView, currentView, currentView, navigate,];
            } });
    const __VLS_90 = ({ goFiles: {} },
        { onGoFiles: (...[$event]) => {
                if (!(__VLS_ctx.currentView === 'download'))
                    return;
                __VLS_ctx.navigate('files');
                // @ts-ignore
                [navigate,];
            } });
    var __VLS_86;
    var __VLS_87;
}
if (__VLS_ctx.currentView === 'admin' && __VLS_ctx.adminTab === 'users' && __VLS_ctx.isAdmin) {
    const __VLS_91 = AdminUsers;
    // @ts-ignore
    const __VLS_92 = __VLS_asFunctionalComponent1(__VLS_91, new __VLS_91({}));
    const __VLS_93 = __VLS_92({}, ...__VLS_functionalComponentArgsRest(__VLS_92));
}
if (__VLS_ctx.currentView === 'admin' && __VLS_ctx.adminTab === 'groups' && __VLS_ctx.isAdmin) {
    const __VLS_96 = AdminGroups;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent1(__VLS_96, new __VLS_96({}));
    const __VLS_98 = __VLS_97({}, ...__VLS_functionalComponentArgsRest(__VLS_97));
}
if (__VLS_ctx.currentView === 'admin' && __VLS_ctx.adminTab === 'qos' && __VLS_ctx.isAdmin) {
    const __VLS_101 = AdminQoS;
    // @ts-ignore
    const __VLS_102 = __VLS_asFunctionalComponent1(__VLS_101, new __VLS_101({}));
    const __VLS_103 = __VLS_102({}, ...__VLS_functionalComponentArgsRest(__VLS_102));
}
if (__VLS_ctx.currentView === 'admin' && __VLS_ctx.adminTab === 'associations' && __VLS_ctx.isAdmin) {
    const __VLS_106 = AdminAssociations;
    // @ts-ignore
    const __VLS_107 = __VLS_asFunctionalComponent1(__VLS_106, new __VLS_106({}));
    const __VLS_108 = __VLS_107({}, ...__VLS_functionalComponentArgsRest(__VLS_107));
}
if (__VLS_ctx.currentView === 'admin' && __VLS_ctx.adminTab === 'hours' && __VLS_ctx.isAdmin) {
    const __VLS_111 = AdminHours;
    // @ts-ignore
    const __VLS_112 = __VLS_asFunctionalComponent1(__VLS_111, new __VLS_111({}));
    const __VLS_113 = __VLS_112({}, ...__VLS_functionalComponentArgsRest(__VLS_112));
}
if (__VLS_ctx.currentView === 'admin' && __VLS_ctx.adminTab === 'quota' && __VLS_ctx.isAdmin) {
    const __VLS_116 = AdminQuota;
    // @ts-ignore
    const __VLS_117 = __VLS_asFunctionalComponent1(__VLS_116, new __VLS_116({}));
    const __VLS_118 = __VLS_117({}, ...__VLS_functionalComponentArgsRest(__VLS_117));
}
if (__VLS_ctx.currentView === 'admin' && __VLS_ctx.adminTab === 'audit' && __VLS_ctx.isAdmin) {
    const __VLS_121 = AdminAudit;
    // @ts-ignore
    const __VLS_122 = __VLS_asFunctionalComponent1(__VLS_121, new __VLS_121({}));
    const __VLS_123 = __VLS_122({}, ...__VLS_functionalComponentArgsRest(__VLS_122));
}
if (__VLS_ctx.currentView === 'admin' && __VLS_ctx.adminTab === 'cmdb' && __VLS_ctx.isAdmin) {
    let __VLS_126;
    /** @ts-ignore @type {typeof __VLS_components.AdminCMDB} */
    AdminCMDB;
    // @ts-ignore
    const __VLS_127 = __VLS_asFunctionalComponent1(__VLS_126, new __VLS_126({}));
    const __VLS_128 = __VLS_127({}, ...__VLS_functionalComponentArgsRest(__VLS_127));
}
if (__VLS_ctx.currentView === 'admin' && __VLS_ctx.adminTab === 'slurm-accounts' && __VLS_ctx.isAdmin) {
    const __VLS_131 = AdminSlurmAccounts;
    // @ts-ignore
    const __VLS_132 = __VLS_asFunctionalComponent1(__VLS_131, new __VLS_131({}));
    const __VLS_133 = __VLS_132({}, ...__VLS_functionalComponentArgsRest(__VLS_132));
}
if (__VLS_ctx.currentView === 'admin' && __VLS_ctx.adminTab === 'slurm-users' && __VLS_ctx.isAdmin) {
    const __VLS_136 = AdminSlurmUsers;
    // @ts-ignore
    const __VLS_137 = __VLS_asFunctionalComponent1(__VLS_136, new __VLS_136({}));
    const __VLS_138 = __VLS_137({}, ...__VLS_functionalComponentArgsRest(__VLS_137));
}
if (!__VLS_ctx.isAdmin && (__VLS_ctx.currentView === 'monitoring' || __VLS_ctx.currentView === 'admin' || __VLS_ctx.currentView === 'rack' || __VLS_ctx.currentView === 'network')) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "no-permission" },
    });
    /** @type {__VLS_StyleScopedClasses['no-permission']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "no-perm-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['no-perm-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
}
const __VLS_141 = AIAssistant;
// @ts-ignore
const __VLS_142 = __VLS_asFunctionalComponent1(__VLS_141, new __VLS_141({
    ref: "aiAssistantRef",
    hideTrigger: (true),
}));
const __VLS_143 = __VLS_142({
    ref: "aiAssistantRef",
    hideTrigger: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_142));
var __VLS_146 = {};
var __VLS_144;
if (__VLS_ctx.showDesktopPet) {
    const __VLS_148 = DesktopPet;
    // @ts-ignore
    const __VLS_149 = __VLS_asFunctionalComponent1(__VLS_148, new __VLS_148({
        ...{ 'onOpenAI': {} },
        ...{ 'onQuickAction': {} },
        ref: "desktopPetRef",
    }));
    const __VLS_150 = __VLS_149({
        ...{ 'onOpenAI': {} },
        ...{ 'onQuickAction': {} },
        ref: "desktopPetRef",
    }, ...__VLS_functionalComponentArgsRest(__VLS_149));
    let __VLS_153;
    const __VLS_154 = ({ openAI: {} },
        { onOpenAI: (__VLS_ctx.openAIAssistant) });
    const __VLS_155 = ({ quickAction: {} },
        { onQuickAction: (__VLS_ctx.handlePetQuickAction) });
    var __VLS_156 = {};
    var __VLS_151;
    var __VLS_152;
}
let __VLS_158;
/** @ts-ignore @type {typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_159 = __VLS_asFunctionalComponent1(__VLS_158, new __VLS_158({
    to: "body",
}));
const __VLS_160 = __VLS_159({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_159));
const { default: __VLS_163 } = __VLS_161.slots;
if (__VLS_ctx.showUploadPanel) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "global-upload-panel" },
    });
    /** @type {__VLS_StyleScopedClasses['global-upload-panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "global-upload-header" },
    });
    /** @type {__VLS_StyleScopedClasses['global-upload-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.uploadTasks.filter(t => t.status === 'uploading').length);
    (__VLS_ctx.uploadTasks.length);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.clearFinishedUploads) },
        ...{ class: "global-upload-close" },
        title: "清除已完成",
    });
    /** @type {__VLS_StyleScopedClasses['global-upload-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "global-upload-list" },
    });
    /** @type {__VLS_StyleScopedClasses['global-upload-list']} */ ;
    for (const [task] of __VLS_vFor((__VLS_ctx.uploadTasks))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (task.id),
            ...{ class: "global-upload-item" },
        });
        /** @type {__VLS_StyleScopedClasses['global-upload-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "global-upload-info" },
        });
        /** @type {__VLS_StyleScopedClasses['global-upload-info']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "global-upload-name" },
        });
        /** @type {__VLS_StyleScopedClasses['global-upload-name']} */ ;
        (task.file.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "global-upload-size" },
        });
        /** @type {__VLS_StyleScopedClasses['global-upload-size']} */ ;
        (__VLS_ctx.formatUploadSize(task.file.size));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "global-upload-progress" },
        });
        /** @type {__VLS_StyleScopedClasses['global-upload-progress']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "global-upload-bar" },
            ...{ style: ({ width: task.progress + '%' }) },
        });
        /** @type {__VLS_StyleScopedClasses['global-upload-bar']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "global-upload-status" },
        });
        /** @type {__VLS_StyleScopedClasses['global-upload-status']} */ ;
        if (task.status === 'pending') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "status-pending" },
            });
            /** @type {__VLS_StyleScopedClasses['status-pending']} */ ;
        }
        else if (task.status === 'uploading') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "status-uploading" },
            });
            /** @type {__VLS_StyleScopedClasses['status-uploading']} */ ;
            (task.progress);
        }
        else if (task.status === 'done') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "status-done" },
            });
            /** @type {__VLS_StyleScopedClasses['status-done']} */ ;
        }
        else if (task.status === 'error') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "status-error" },
                title: (task.error),
            });
            /** @type {__VLS_StyleScopedClasses['status-error']} */ ;
        }
        // @ts-ignore
        [currentView, currentView, currentView, currentView, currentView, currentView, currentView, currentView, currentView, currentView, currentView, currentView, currentView, currentView, isAdmin, isAdmin, isAdmin, isAdmin, isAdmin, isAdmin, isAdmin, isAdmin, isAdmin, isAdmin, isAdmin, adminTab, adminTab, adminTab, adminTab, adminTab, adminTab, adminTab, adminTab, adminTab, adminTab, showDesktopPet, openAIAssistant, handlePetQuickAction, showUploadPanel, uploadTasks, uploadTasks, uploadTasks, clearFinishedUploads, formatUploadSize,];
    }
}
// @ts-ignore
[];
var __VLS_161;
// @ts-ignore
var __VLS_62 = __VLS_61, __VLS_147 = __VLS_146, __VLS_157 = __VLS_156;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
