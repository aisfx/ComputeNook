/// <reference types="../node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, provide, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Dashboard from './views/Dashboard.vue';
import JobManagement from './views/JobManagement.vue';
import WebShell from './views/WebShell.vue';
import Desktop from './views/Desktop.vue';
import FileManager from './views/FileManager.vue';
import Reports from './views/Reports.vue';
import AdminUsers from './views/AdminUsers.vue';
import AdminGroups from './views/AdminGroups.vue';
import AdminQoS from './views/AdminQoS.vue';
import AdminHours from './views/AdminHours.vue';
import AdminQuota from './views/AdminQuota.vue';
import AdminAudit from './views/AdminAudit.vue';
import AdminSlurmAccounts from './views/AdminSlurmAccounts.vue';
import AdminSlurmUsers from './views/AdminSlurmUsers.vue';
import AdminAssociations from './views/AdminAssociations.vue';
import Monitoring from './views/Monitoring.vue';
import Profile from './views/Profile.vue';
import { isAuthenticated as checkAuth, getUser, logout, setupAxiosInterceptors, isAdmin as checkAdmin } from './utils/auth';
const router = useRouter();
const currentView = ref('dashboard');
const jobManagementTab = ref('info');
const adminTab = ref('users'); // 管理员子页面，默认为用户管理
const currentUser = ref(null);
const isAuthenticated = ref(false);
const isAdmin = ref(false);
const fileManagerRef = ref(null); // 文件管理器引用
// 提供给子组件使用
provide('jobManagementTab', jobManagementTab);
// 处理打开目录事件
const handleOpenDirectory = (path) => {
    // 切换到文件管理视图
    currentView.value = 'files';
    // 等待组件渲染后再调用导航方法
    setTimeout(() => {
        if (fileManagerRef.value && fileManagerRef.value.navigateToPath) {
            fileManagerRef.value.navigateToPath(path);
        }
    }, 100);
};
const menuItems = computed(() => {
    const items = [
        { id: 'dashboard', label: '仪表盘', icon: '📊' },
        { id: 'jobs', label: '作业管理', icon: '📋' },
        { id: 'shell', label: 'Web Shell', icon: '💻' },
        { id: 'desktop', label: '远程桌面', icon: '🖥️' },
        { id: 'files', label: '文件管理', icon: '📁' },
        { id: 'reports', label: '报表中心', icon: '📑' }
    ];
    // 只有管理员才能看到集群监控和系统管理
    if (isAdmin.value) {
        items.splice(2, 0, { id: 'monitoring', label: '集群监控', icon: '📈' });
        items.push({ id: 'admin', label: '系统管理', icon: '⚙️' });
    }
    return items;
});
const jobTabs = [
    { id: 'info', label: '作业列表' },
    { id: 'submit', label: '提交作业' },
    { id: 'templates', label: '作业模板' }
];
const adminTabs = [
    // 用户管理分组
    { id: 'group-user', label: '用户管理', isGroup: true },
    { id: 'users', label: '用户管理', parent: 'group-user' },
    { id: 'groups', label: '用户组管理', parent: 'group-user' },
    // 账户管理分组
    { id: 'group-account', label: '账户管理', isGroup: true },
    { id: 'slurm-accounts', label: 'Slurm账户', parent: 'group-account' },
    { id: 'slurm-users', label: 'Slurm用户', parent: 'group-account' },
    // 资源管理分组
    { id: 'group-resource', label: '资源管理', isGroup: true },
    { id: 'associations', label: '资源绑定', parent: 'group-resource' },
    { id: 'qos', label: 'QoS配置', parent: 'group-resource' },
    { id: 'hours', label: '机时管理', parent: 'group-resource' },
    { id: 'quota', label: '存储配额', parent: 'group-resource' },
    // 数据审计（独立）
    { id: 'audit', label: '数据审计' }
];
const currentTitle = computed(() => {
    if (currentView.value === 'admin') {
        const tab = adminTabs.find(t => t.id === adminTab.value);
        return `系统管理 - ${tab?.label || ''}`;
    }
    return menuItems.value.find(item => item.id === currentView.value)?.label || '';
});
const handleLogout = () => {
    if (confirm('确定要退出登录吗？')) {
        logout();
        router.push('/login');
    }
};
const goToProfile = () => {
    currentView.value = 'profile';
};
onMounted(() => {
    // 设置 axios 拦截器
    setupAxiosInterceptors();
    // 检查登录状态
    isAuthenticated.value = checkAuth();
    if (isAuthenticated.value) {
        currentUser.value = getUser();
        isAdmin.value = checkAdmin();
    }
    else {
        router.push('/login');
    }
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['logo']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-menu']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-menu']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-menu']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-menu']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['sub-menu-group-title']} */ ;
/** @type {__VLS_StyleScopedClasses['sub-menu-group-title']} */ ;
/** @type {__VLS_StyleScopedClasses['sub-menu-item']} */ ;
/** @type {__VLS_StyleScopedClasses['sub-menu-item']} */ ;
/** @type {__VLS_StyleScopedClasses['sub-menu-item']} */ ;
/** @type {__VLS_StyleScopedClasses['sub-menu-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['sub-menu-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['sub-menu-item-standalone']} */ ;
/** @type {__VLS_StyleScopedClasses['sub-menu-item-standalone']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['top-header']} */ ;
/** @type {__VLS_StyleScopedClasses['sub-nav-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['sub-nav-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['profile-link']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-logout-header']} */ ;
/** @type {__VLS_StyleScopedClasses['content-area']} */ ;
/** @type {__VLS_StyleScopedClasses['no-permission']} */ ;
/** @type {__VLS_StyleScopedClasses['no-permission']} */ ;
if (!__VLS_ctx.isAuthenticated) {
    let __VLS_0;
    /** @ts-ignore @type {typeof __VLS_components.routerView | typeof __VLS_components.RouterView} */
    routerView;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({}));
    const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
    var __VLS_5 = {};
    var __VLS_3;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "app" },
    });
    /** @type {__VLS_StyleScopedClasses['app']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
        ...{ class: "sidebar" },
    });
    /** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "logo" },
    });
    /** @type {__VLS_StyleScopedClasses['logo']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "welcome-text" },
    });
    /** @type {__VLS_StyleScopedClasses['welcome-text']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "username" },
    });
    /** @type {__VLS_StyleScopedClasses['username']} */ ;
    (__VLS_ctx.currentUser?.cnName || __VLS_ctx.currentUser?.username || '用户');
    __VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
        ...{ class: "nav-menu" },
    });
    /** @type {__VLS_StyleScopedClasses['nav-menu']} */ ;
    for (const [item] of __VLS_vFor((__VLS_ctx.menuItems))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.isAuthenticated))
                        return;
                    __VLS_ctx.currentView = item.id;
                    // @ts-ignore
                    [isAuthenticated, currentUser, currentUser, menuItems, currentView,];
                } },
            key: (item.id),
            ...{ class: (['nav-item', { active: __VLS_ctx.currentView === item.id }]) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        /** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "nav-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['nav-icon']} */ ;
        (item.icon);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "nav-text" },
        });
        /** @type {__VLS_StyleScopedClasses['nav-text']} */ ;
        (item.label);
        // @ts-ignore
        [currentView,];
    }
    if (__VLS_ctx.currentView === 'admin' && __VLS_ctx.isAdmin) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sub-menu" },
        });
        /** @type {__VLS_StyleScopedClasses['sub-menu']} */ ;
        for (const [tab] of __VLS_vFor((__VLS_ctx.adminTabs))) {
            (tab.id);
            if (tab.isGroup) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "sub-menu-group-title" },
                });
                /** @type {__VLS_StyleScopedClasses['sub-menu-group-title']} */ ;
                (tab.label);
            }
            else if (tab.parent) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(!__VLS_ctx.isAuthenticated))
                                return;
                            if (!(__VLS_ctx.currentView === 'admin' && __VLS_ctx.isAdmin))
                                return;
                            if (!!(tab.isGroup))
                                return;
                            if (!(tab.parent))
                                return;
                            __VLS_ctx.adminTab = tab.id;
                            // @ts-ignore
                            [currentView, isAdmin, adminTabs, adminTab,];
                        } },
                    ...{ class: (['sub-menu-item', { active: __VLS_ctx.adminTab === tab.id }]) },
                });
                /** @type {__VLS_StyleScopedClasses['active']} */ ;
                /** @type {__VLS_StyleScopedClasses['sub-menu-item']} */ ;
                (tab.label);
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(!__VLS_ctx.isAuthenticated))
                                return;
                            if (!(__VLS_ctx.currentView === 'admin' && __VLS_ctx.isAdmin))
                                return;
                            if (!!(tab.isGroup))
                                return;
                            if (!!(tab.parent))
                                return;
                            __VLS_ctx.adminTab = tab.id;
                            // @ts-ignore
                            [adminTab, adminTab,];
                        } },
                    ...{ class: (['sub-menu-item', 'sub-menu-item-standalone', { active: __VLS_ctx.adminTab === tab.id }]) },
                });
                /** @type {__VLS_StyleScopedClasses['active']} */ ;
                /** @type {__VLS_StyleScopedClasses['sub-menu-item']} */ ;
                /** @type {__VLS_StyleScopedClasses['sub-menu-item-standalone']} */ ;
                (tab.label);
            }
            // @ts-ignore
            [adminTab,];
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sidebar-footer" },
    });
    /** @type {__VLS_StyleScopedClasses['sidebar-footer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.main, __VLS_intrinsics.main)({
        ...{ class: "main-container" },
    });
    /** @type {__VLS_StyleScopedClasses['main-container']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
        ...{ class: "top-header" },
    });
    /** @type {__VLS_StyleScopedClasses['top-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "header-title-section" },
    });
    /** @type {__VLS_StyleScopedClasses['header-title-section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    (__VLS_ctx.currentTitle);
    if (__VLS_ctx.currentView === 'jobs') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sub-nav" },
        });
        /** @type {__VLS_StyleScopedClasses['sub-nav']} */ ;
        for (const [tab] of __VLS_vFor((__VLS_ctx.jobTabs))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(!__VLS_ctx.isAuthenticated))
                            return;
                        if (!(__VLS_ctx.currentView === 'jobs'))
                            return;
                        __VLS_ctx.jobManagementTab = tab.id;
                        // @ts-ignore
                        [currentView, currentTitle, jobTabs, jobManagementTab,];
                    } },
                key: (tab.id),
                ...{ class: (['sub-nav-btn', { active: __VLS_ctx.jobManagementTab === tab.id }]) },
            });
            /** @type {__VLS_StyleScopedClasses['active']} */ ;
            /** @type {__VLS_StyleScopedClasses['sub-nav-btn']} */ ;
            (tab.label);
            // @ts-ignore
            [jobManagementTab,];
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "header-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['header-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "cluster-status" },
    });
    /** @type {__VLS_StyleScopedClasses['cluster-status']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "status-online" },
    });
    /** @type {__VLS_StyleScopedClasses['status-online']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "divider" },
    });
    /** @type {__VLS_StyleScopedClasses['divider']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
        ...{ onClick: (__VLS_ctx.goToProfile) },
        ...{ class: "profile-link" },
    });
    /** @type {__VLS_StyleScopedClasses['profile-link']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "profile-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['profile-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "divider" },
    });
    /** @type {__VLS_StyleScopedClasses['divider']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.handleLogout) },
        ...{ class: "btn-logout-header" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-logout-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "logout-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['logout-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "content-area" },
    });
    /** @type {__VLS_StyleScopedClasses['content-area']} */ ;
    if (__VLS_ctx.currentView === 'dashboard') {
        const __VLS_6 = Dashboard;
        // @ts-ignore
        const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({}));
        const __VLS_8 = __VLS_7({}, ...__VLS_functionalComponentArgsRest(__VLS_7));
    }
    else if (__VLS_ctx.currentView === 'jobs') {
        const __VLS_11 = JobManagement;
        // @ts-ignore
        const __VLS_12 = __VLS_asFunctionalComponent1(__VLS_11, new __VLS_11({
            ...{ 'onOpenDirectory': {} },
        }));
        const __VLS_13 = __VLS_12({
            ...{ 'onOpenDirectory': {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_12));
        let __VLS_16;
        const __VLS_17 = ({ openDirectory: {} },
            { onOpenDirectory: (__VLS_ctx.handleOpenDirectory) });
        var __VLS_14;
        var __VLS_15;
    }
    else if (__VLS_ctx.currentView === 'monitoring' && __VLS_ctx.isAdmin) {
        const __VLS_18 = Monitoring;
        // @ts-ignore
        const __VLS_19 = __VLS_asFunctionalComponent1(__VLS_18, new __VLS_18({}));
        const __VLS_20 = __VLS_19({}, ...__VLS_functionalComponentArgsRest(__VLS_19));
    }
    else if (__VLS_ctx.currentView === 'shell') {
        const __VLS_23 = WebShell;
        // @ts-ignore
        const __VLS_24 = __VLS_asFunctionalComponent1(__VLS_23, new __VLS_23({}));
        const __VLS_25 = __VLS_24({}, ...__VLS_functionalComponentArgsRest(__VLS_24));
    }
    else if (__VLS_ctx.currentView === 'desktop') {
        const __VLS_28 = Desktop;
        // @ts-ignore
        const __VLS_29 = __VLS_asFunctionalComponent1(__VLS_28, new __VLS_28({}));
        const __VLS_30 = __VLS_29({}, ...__VLS_functionalComponentArgsRest(__VLS_29));
    }
    else if (__VLS_ctx.currentView === 'files') {
        const __VLS_33 = FileManager;
        // @ts-ignore
        const __VLS_34 = __VLS_asFunctionalComponent1(__VLS_33, new __VLS_33({
            ref: "fileManagerRef",
        }));
        const __VLS_35 = __VLS_34({
            ref: "fileManagerRef",
        }, ...__VLS_functionalComponentArgsRest(__VLS_34));
        var __VLS_38 = {};
        var __VLS_36;
    }
    else if (__VLS_ctx.currentView === 'reports') {
        const __VLS_40 = Reports;
        // @ts-ignore
        const __VLS_41 = __VLS_asFunctionalComponent1(__VLS_40, new __VLS_40({}));
        const __VLS_42 = __VLS_41({}, ...__VLS_functionalComponentArgsRest(__VLS_41));
    }
    else if (__VLS_ctx.currentView === 'profile') {
        const __VLS_45 = Profile;
        // @ts-ignore
        const __VLS_46 = __VLS_asFunctionalComponent1(__VLS_45, new __VLS_45({}));
        const __VLS_47 = __VLS_46({}, ...__VLS_functionalComponentArgsRest(__VLS_46));
    }
    else if (__VLS_ctx.currentView === 'admin' && __VLS_ctx.adminTab === 'users' && __VLS_ctx.isAdmin) {
        const __VLS_50 = AdminUsers;
        // @ts-ignore
        const __VLS_51 = __VLS_asFunctionalComponent1(__VLS_50, new __VLS_50({}));
        const __VLS_52 = __VLS_51({}, ...__VLS_functionalComponentArgsRest(__VLS_51));
    }
    else if (__VLS_ctx.currentView === 'admin' && __VLS_ctx.adminTab === 'groups' && __VLS_ctx.isAdmin) {
        const __VLS_55 = AdminGroups;
        // @ts-ignore
        const __VLS_56 = __VLS_asFunctionalComponent1(__VLS_55, new __VLS_55({}));
        const __VLS_57 = __VLS_56({}, ...__VLS_functionalComponentArgsRest(__VLS_56));
    }
    else if (__VLS_ctx.currentView === 'admin' && __VLS_ctx.adminTab === 'qos' && __VLS_ctx.isAdmin) {
        const __VLS_60 = AdminQoS;
        // @ts-ignore
        const __VLS_61 = __VLS_asFunctionalComponent1(__VLS_60, new __VLS_60({}));
        const __VLS_62 = __VLS_61({}, ...__VLS_functionalComponentArgsRest(__VLS_61));
    }
    else if (__VLS_ctx.currentView === 'admin' && __VLS_ctx.adminTab === 'associations' && __VLS_ctx.isAdmin) {
        const __VLS_65 = AdminAssociations;
        // @ts-ignore
        const __VLS_66 = __VLS_asFunctionalComponent1(__VLS_65, new __VLS_65({}));
        const __VLS_67 = __VLS_66({}, ...__VLS_functionalComponentArgsRest(__VLS_66));
    }
    else if (__VLS_ctx.currentView === 'admin' && __VLS_ctx.adminTab === 'hours' && __VLS_ctx.isAdmin) {
        const __VLS_70 = AdminHours;
        // @ts-ignore
        const __VLS_71 = __VLS_asFunctionalComponent1(__VLS_70, new __VLS_70({}));
        const __VLS_72 = __VLS_71({}, ...__VLS_functionalComponentArgsRest(__VLS_71));
    }
    else if (__VLS_ctx.currentView === 'admin' && __VLS_ctx.adminTab === 'quota' && __VLS_ctx.isAdmin) {
        const __VLS_75 = AdminQuota;
        // @ts-ignore
        const __VLS_76 = __VLS_asFunctionalComponent1(__VLS_75, new __VLS_75({}));
        const __VLS_77 = __VLS_76({}, ...__VLS_functionalComponentArgsRest(__VLS_76));
    }
    else if (__VLS_ctx.currentView === 'admin' && __VLS_ctx.adminTab === 'audit' && __VLS_ctx.isAdmin) {
        const __VLS_80 = AdminAudit;
        // @ts-ignore
        const __VLS_81 = __VLS_asFunctionalComponent1(__VLS_80, new __VLS_80({}));
        const __VLS_82 = __VLS_81({}, ...__VLS_functionalComponentArgsRest(__VLS_81));
    }
    else if (__VLS_ctx.currentView === 'admin' && __VLS_ctx.adminTab === 'slurm-accounts' && __VLS_ctx.isAdmin) {
        const __VLS_85 = AdminSlurmAccounts;
        // @ts-ignore
        const __VLS_86 = __VLS_asFunctionalComponent1(__VLS_85, new __VLS_85({}));
        const __VLS_87 = __VLS_86({}, ...__VLS_functionalComponentArgsRest(__VLS_86));
    }
    else if (__VLS_ctx.currentView === 'admin' && __VLS_ctx.adminTab === 'slurm-users' && __VLS_ctx.isAdmin) {
        const __VLS_90 = AdminSlurmUsers;
        // @ts-ignore
        const __VLS_91 = __VLS_asFunctionalComponent1(__VLS_90, new __VLS_90({}));
        const __VLS_92 = __VLS_91({}, ...__VLS_functionalComponentArgsRest(__VLS_91));
    }
    else if (!__VLS_ctx.isAdmin && (__VLS_ctx.currentView === 'monitoring' || __VLS_ctx.currentView === 'admin')) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "no-permission" },
        });
        /** @type {__VLS_StyleScopedClasses['no-permission']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "no-permission-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['no-permission-icon']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    }
}
// @ts-ignore
var __VLS_39 = __VLS_38;
// @ts-ignore
[currentView, currentView, currentView, currentView, currentView, currentView, currentView, currentView, currentView, currentView, currentView, currentView, currentView, currentView, currentView, currentView, currentView, currentView, currentView, isAdmin, isAdmin, isAdmin, isAdmin, isAdmin, isAdmin, isAdmin, isAdmin, isAdmin, isAdmin, isAdmin, adminTab, adminTab, adminTab, adminTab, adminTab, adminTab, adminTab, adminTab, adminTab, goToProfile, handleLogout, handleOpenDirectory,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
