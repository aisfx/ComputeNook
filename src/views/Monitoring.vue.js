/// <reference types="../../node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted } from 'vue';
const showConfigModal = ref(false);
const showAlertModal = ref(false);
const activePanel = ref('overview');
const iframeLoading = ref(true);
const config = ref({
    prometheusUrl: '',
    grafanaUrl: '',
    grafanaDashboardId: '',
    enableAlerts: true,
    refreshInterval: 30
});
const prometheusUrl = ref('');
const grafanaUrl = ref('');
const clusterStatus = ref({
    totalNodes: 10,
    activeNodes: 9,
    cpuUsage: 65,
    memoryUsage: 72,
    memoryUsed: 360,
    memoryTotal: 500
});
const activeAlerts = ref([
    {
        id: 1,
        severity: 'critical',
        title: '节点 node01 离线',
        description: '节点 node01 在过去 5 分钟内无响应',
        time: '2分钟前'
    },
    {
        id: 2,
        severity: 'warning',
        title: 'CPU 使用率过高',
        description: '节点 node03 的 CPU 使用率超过 90%',
        time: '10分钟前'
    }
]);
const alertRules = ref([
    { id: 1, name: '节点离线检测', metric: 'node_up', condition: '==', threshold: '0', severity: 'critical', enabled: true },
    { id: 2, name: 'CPU 使用率告警', metric: 'cpu_usage', condition: '>', threshold: '90%', severity: 'warning', enabled: true },
    { id: 3, name: '内存使用率告警', metric: 'memory_usage', condition: '>', threshold: '85%', severity: 'warning', enabled: true },
    { id: 4, name: '磁盘空间告警', metric: 'disk_usage', condition: '>', threshold: '90%', severity: 'critical', enabled: true },
]);
const monitoringPanels = [
    { id: 'overview', label: '总览' },
    { id: 'nodes', label: '节点监控' },
    { id: 'jobs', label: '作业监控' },
    { id: 'network', label: '网络监控' },
    { id: 'storage', label: '存储监控' }
];
const currentPanelUrl = computed(() => {
    if (!grafanaUrl.value)
        return '';
    const baseUrl = grafanaUrl.value;
    const dashboardId = config.value.grafanaDashboardId || 'default';
    // 根据不同面板返回不同的 Grafana URL
    return `${baseUrl}/d/${dashboardId}?orgId=1&refresh=30s&kiosk=tv`;
});
const getSeverityLabel = (severity) => {
    const labels = {
        critical: '🔴 严重',
        warning: '🟡 警告',
        info: '🔵 信息'
    };
    return labels[severity] || severity;
};
const saveConfig = () => {
    prometheusUrl.value = config.value.prometheusUrl;
    grafanaUrl.value = config.value.grafanaUrl;
    // 保存到 localStorage
    localStorage.setItem('monitoring_config', JSON.stringify(config.value));
    showConfigModal.value = false;
    alert('配置保存成功！');
};
const loadConfig = () => {
    const saved = localStorage.getItem('monitoring_config');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            config.value = { ...config.value, ...parsed };
            prometheusUrl.value = config.value.prometheusUrl;
            grafanaUrl.value = config.value.grafanaUrl;
        }
        catch (e) {
            console.error('Failed to load config:', e);
        }
    }
};
const refreshMonitoring = () => {
    iframeLoading.value = true;
    // 重新加载 iframe
    const iframe = document.querySelector('iframe');
    if (iframe) {
        iframe.src = iframe.src;
    }
};
const onIframeLoad = () => {
    iframeLoading.value = false;
};
const acknowledgeAlert = (alert) => {
    if (confirm(`确认已处理报警：${alert.title}？`)) {
        activeAlerts.value = activeAlerts.value.filter(a => a.id !== alert.id);
        alert('报警已确认');
    }
};
const viewAlertDetails = (alert) => {
    alert(`报警详情：\n\n${alert.title}\n${alert.description}\n时间：${alert.time}`);
};
const addAlertRule = () => {
    alert('添加报警规则功能开发中...');
};
const editAlertRule = (rule) => {
    alert(`编辑规则：${rule.name}`);
};
const deleteAlertRule = (rule) => {
    if (confirm(`确定要删除规则 ${rule.name} 吗？`)) {
        alertRules.value = alertRules.value.filter(r => r.id !== rule.id);
        alert('规则已删除');
    }
};
onMounted(() => {
    loadConfig();
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
/** @type {__VLS_StyleScopedClasses['status-card']} */ ;
/** @type {__VLS_StyleScopedClasses['alerts-section']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-item']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-item']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-item']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
/** @type {__VLS_StyleScopedClasses['iframe-container']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['data-table']} */ ;
/** @type {__VLS_StyleScopedClasses['data-table']} */ ;
/** @type {__VLS_StyleScopedClasses['data-table']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "monitoring" },
});
/** @type {__VLS_StyleScopedClasses['monitoring']} */ ;
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
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showConfigModal = true;
            // @ts-ignore
            [showConfigModal,];
        } },
    ...{ class: "btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.refreshMonitoring) },
    ...{ class: "btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showAlertModal = true;
            // @ts-ignore
            [refreshMonitoring, showAlertModal,];
        } },
    ...{ class: "btn-primary" },
});
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "status-cards" },
});
/** @type {__VLS_StyleScopedClasses['status-cards']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "status-card" },
});
/** @type {__VLS_StyleScopedClasses['status-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-icon" },
});
/** @type {__VLS_StyleScopedClasses['card-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-content" },
});
/** @type {__VLS_StyleScopedClasses['card-content']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-label" },
});
/** @type {__VLS_StyleScopedClasses['card-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-value" },
});
/** @type {__VLS_StyleScopedClasses['card-value']} */ ;
(__VLS_ctx.clusterStatus.totalNodes);
(__VLS_ctx.clusterStatus.activeNodes);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-sub" },
});
/** @type {__VLS_StyleScopedClasses['card-sub']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "status-card" },
});
/** @type {__VLS_StyleScopedClasses['status-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-icon" },
});
/** @type {__VLS_StyleScopedClasses['card-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-content" },
});
/** @type {__VLS_StyleScopedClasses['card-content']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-label" },
});
/** @type {__VLS_StyleScopedClasses['card-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-value" },
});
/** @type {__VLS_StyleScopedClasses['card-value']} */ ;
(__VLS_ctx.clusterStatus.cpuUsage);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-sub" },
});
/** @type {__VLS_StyleScopedClasses['card-sub']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "status-card" },
});
/** @type {__VLS_StyleScopedClasses['status-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-icon" },
});
/** @type {__VLS_StyleScopedClasses['card-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-content" },
});
/** @type {__VLS_StyleScopedClasses['card-content']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-label" },
});
/** @type {__VLS_StyleScopedClasses['card-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-value" },
});
/** @type {__VLS_StyleScopedClasses['card-value']} */ ;
(__VLS_ctx.clusterStatus.memoryUsage);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-sub" },
});
/** @type {__VLS_StyleScopedClasses['card-sub']} */ ;
(__VLS_ctx.clusterStatus.memoryUsed);
(__VLS_ctx.clusterStatus.memoryTotal);
if (__VLS_ctx.activeAlerts.length > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "status-card alert" },
    });
    /** @type {__VLS_StyleScopedClasses['status-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['alert']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['card-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card-content" },
    });
    /** @type {__VLS_StyleScopedClasses['card-content']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card-label" },
    });
    /** @type {__VLS_StyleScopedClasses['card-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card-value" },
    });
    /** @type {__VLS_StyleScopedClasses['card-value']} */ ;
    (__VLS_ctx.activeAlerts.length);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['card-sub']} */ ;
}
if (__VLS_ctx.activeAlerts.length > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "alerts-section" },
    });
    /** @type {__VLS_StyleScopedClasses['alerts-section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "alerts-list" },
    });
    /** @type {__VLS_StyleScopedClasses['alerts-list']} */ ;
    for (const [alert] of __VLS_vFor((__VLS_ctx.activeAlerts))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (alert.id),
            ...{ class: (['alert-item', 'alert-' + alert.severity]) },
        });
        /** @type {__VLS_StyleScopedClasses['alert-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "alert-header" },
        });
        /** @type {__VLS_StyleScopedClasses['alert-header']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "alert-severity" },
        });
        /** @type {__VLS_StyleScopedClasses['alert-severity']} */ ;
        (__VLS_ctx.getSeverityLabel(alert.severity));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "alert-time" },
        });
        /** @type {__VLS_StyleScopedClasses['alert-time']} */ ;
        (alert.time);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "alert-title" },
        });
        /** @type {__VLS_StyleScopedClasses['alert-title']} */ ;
        (alert.title);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "alert-description" },
        });
        /** @type {__VLS_StyleScopedClasses['alert-description']} */ ;
        (alert.description);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "alert-actions" },
        });
        /** @type {__VLS_StyleScopedClasses['alert-actions']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.activeAlerts.length > 0))
                        return;
                    __VLS_ctx.acknowledgeAlert(alert);
                    // @ts-ignore
                    [clusterStatus, clusterStatus, clusterStatus, clusterStatus, clusterStatus, clusterStatus, activeAlerts, activeAlerts, activeAlerts, activeAlerts, getSeverityLabel, acknowledgeAlert,];
                } },
            ...{ class: "btn-link" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.activeAlerts.length > 0))
                        return;
                    __VLS_ctx.viewAlertDetails(alert);
                    // @ts-ignore
                    [viewAlertDetails,];
                } },
            ...{ class: "btn-link" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
        // @ts-ignore
        [];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "monitoring-panels" },
});
/** @type {__VLS_StyleScopedClasses['monitoring-panels']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "panel-tabs" },
});
/** @type {__VLS_StyleScopedClasses['panel-tabs']} */ ;
for (const [panel] of __VLS_vFor((__VLS_ctx.monitoringPanels))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.activePanel = panel.id;
                // @ts-ignore
                [monitoringPanels, activePanel,];
            } },
        key: (panel.id),
        ...{ class: (['tab-btn', { active: __VLS_ctx.activePanel === panel.id }]) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['tab-btn']} */ ;
    (panel.label);
    // @ts-ignore
    [activePanel,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "panel-content" },
});
/** @type {__VLS_StyleScopedClasses['panel-content']} */ ;
if (!__VLS_ctx.prometheusUrl && !__VLS_ctx.grafanaUrl) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty-state" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.prometheusUrl && !__VLS_ctx.grafanaUrl))
                    return;
                __VLS_ctx.showConfigModal = true;
                // @ts-ignore
                [showConfigModal, prometheusUrl, grafanaUrl,];
            } },
        ...{ class: "btn-primary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "iframe-container" },
    });
    /** @type {__VLS_StyleScopedClasses['iframe-container']} */ ;
    if (__VLS_ctx.currentPanelUrl) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.iframe, __VLS_intrinsics.iframe)({
            ...{ onLoad: (__VLS_ctx.onIframeLoad) },
            src: (__VLS_ctx.currentPanelUrl),
            frameborder: "0",
        });
    }
    if (__VLS_ctx.iframeLoading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "iframe-loading" },
        });
        /** @type {__VLS_StyleScopedClasses['iframe-loading']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "spinner" },
        });
        /** @type {__VLS_StyleScopedClasses['spinner']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    }
}
if (__VLS_ctx.showConfigModal) {
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showConfigModal))
                    return;
                __VLS_ctx.showConfigModal = false;
                // @ts-ignore
                [showConfigModal, showConfigModal, currentPanelUrl, currentPanelUrl, onIframeLoad, iframeLoading,];
            } },
        ...{ class: "btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "http://prometheus.example.com:9090",
    });
    (__VLS_ctx.config.prometheusUrl);
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({
        ...{ class: "form-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['form-hint']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "http://grafana.example.com:3000",
    });
    (__VLS_ctx.config.grafanaUrl);
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({
        ...{ class: "form-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['form-hint']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "例如: node-exporter-full",
    });
    (__VLS_ctx.config.grafanaDashboardId);
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({
        ...{ class: "form-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['form-hint']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
    });
    (__VLS_ctx.config.enableAlerts);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "10",
        max: "300",
    });
    (__VLS_ctx.config.refreshInterval);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-footer" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-footer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showConfigModal))
                    return;
                __VLS_ctx.showConfigModal = false;
                // @ts-ignore
                [showConfigModal, config, config, config, config, config,];
            } },
        ...{ class: "btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.saveConfig) },
        ...{ class: "btn-primary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
}
if (__VLS_ctx.showAlertModal) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal large" },
    });
    /** @type {__VLS_StyleScopedClasses['modal']} */ ;
    /** @type {__VLS_StyleScopedClasses['large']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showAlertModal))
                    return;
                __VLS_ctx.showAlertModal = false;
                // @ts-ignore
                [showAlertModal, showAlertModal, saveConfig,];
            } },
        ...{ class: "btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "alert-rules-header" },
    });
    /** @type {__VLS_StyleScopedClasses['alert-rules-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.addAlertRule) },
        ...{ class: "btn-primary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
    for (const [rule] of __VLS_vFor((__VLS_ctx.alertRules))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (rule.id),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        (rule.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (rule.metric);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (rule.condition);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (rule.threshold);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: (['badge', 'badge-' + rule.severity]) },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        (__VLS_ctx.getSeverityLabel(rule.severity));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: (['badge', rule.enabled ? 'badge-active' : 'badge-disabled']) },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        (rule.enabled ? '启用' : '禁用');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "action-buttons" },
        });
        /** @type {__VLS_StyleScopedClasses['action-buttons']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showAlertModal))
                        return;
                    __VLS_ctx.editAlertRule(rule);
                    // @ts-ignore
                    [getSeverityLabel, addAlertRule, alertRules, editAlertRule,];
                } },
            ...{ class: "btn-link" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showAlertModal))
                        return;
                    __VLS_ctx.deleteAlertRule(rule);
                    // @ts-ignore
                    [deleteAlertRule,];
                } },
            ...{ class: "btn-link danger" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
        /** @type {__VLS_StyleScopedClasses['danger']} */ ;
        // @ts-ignore
        [];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-footer" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-footer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showAlertModal))
                    return;
                __VLS_ctx.showAlertModal = false;
                // @ts-ignore
                [showAlertModal,];
            } },
        ...{ class: "btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
