/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted, onUnmounted } from 'vue';
import axios from 'axios';
const props = withDefaults(defineProps(), {
    showBell: true,
    bellStyle: '',
    pollInterval: 60,
    cpuWarn: 85,
    memWarn: 90,
});
const alerts = ref([]);
const panelOpen = ref(false);
let idSeq = 0;
let timer = null;
const activeAlerts = computed(() => alerts.value.filter(a => !a.dismissed));
const visibleAlerts = computed(() => alerts.value.filter(a => !a.dismissed && !a.shown).slice(0, 4));
const levelIcon = (level) => ({ critical: '🔴', warning: '🟡', info: '🔵' }[level] || '⚪');
const dismiss = (id) => {
    const a = alerts.value.find(x => x.id === id);
    if (a)
        a.dismissed = true;
};
const clearAll = () => alerts.value.forEach(a => a.dismissed = true);
const addAlert = (level, title, message) => {
    // 去重：同 title+message 未 dismiss 的不重复加
    const dup = alerts.value.find(a => !a.dismissed && a.title === title && a.message === message);
    if (dup)
        return;
    const item = {
        id: ++idSeq,
        level, title, message,
        time: new Date().toLocaleTimeString(),
        dismissed: false,
        shown: false,
    };
    alerts.value.unshift(item);
    // 5 秒后自动标记为 shown（从 toast 消失，但留在面板）
    setTimeout(() => { item.shown = true; }, 5000);
    // 最多保留 50 条
    if (alerts.value.length > 50)
        alerts.value = alerts.value.slice(0, 50);
};
// 暴露给父组件手动触发
const __VLS_exposed = { addAlert };
defineExpose(__VLS_exposed);
// 轮询 Prometheus 节点指标
const poll = async () => {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const res = await axios.get('/monitoring/metrics', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const nodes = res.data?.data || [];
        nodes.forEach(n => {
            const name = n.instance || n.node || 'unknown';
            if ((n.cpu_usage ?? 0) >= props.cpuWarn) {
                addAlert('warning', `CPU 告警: ${name}`, `CPU 使用率 ${n.cpu_usage?.toFixed(1)}% 超过阈值 ${props.cpuWarn}%`);
            }
            if ((n.mem_usage ?? 0) >= props.memWarn) {
                addAlert('critical', `内存告警: ${name}`, `内存使用率 ${n.mem_usage?.toFixed(1)}% 超过阈值 ${props.memWarn}%`);
            }
        });
    }
    catch {
        // 静默失败，不影响主界面
    }
};
onMounted(() => {
    poll();
    timer = setInterval(poll, props.pollInterval * 1000);
});
onUnmounted(() => {
    if (timer)
        clearInterval(timer);
});
const __VLS_defaults = {
    showBell: true,
    bellStyle: '',
    pollInterval: 60,
    cpuWarn: 85,
    memWarn: 90,
};
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['alert-toast-close']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-bell-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-panel-clear']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-panel-item']} */ ;
/** @type {__VLS_StyleScopedClasses['api-close']} */ ;
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
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "alert-stack" },
});
/** @type {__VLS_StyleScopedClasses['alert-stack']} */ ;
let __VLS_6;
/** @ts-ignore @type {typeof __VLS_components.transitionGroup | typeof __VLS_components.TransitionGroup | typeof __VLS_components.transitionGroup | typeof __VLS_components.TransitionGroup} */
transitionGroup;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
    name: "alert-slide",
}));
const __VLS_8 = __VLS_7({
    name: "alert-slide",
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
const { default: __VLS_11 } = __VLS_9.slots;
for (const [alert] of __VLS_vFor((__VLS_ctx.visibleAlerts))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (alert.id),
        ...{ class: (['alert-toast', `alert-toast--${alert.level}`]) },
    });
    /** @type {__VLS_StyleScopedClasses['alert-toast']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "alert-toast-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['alert-toast-icon']} */ ;
    (__VLS_ctx.levelIcon(alert.level));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "alert-toast-body" },
    });
    /** @type {__VLS_StyleScopedClasses['alert-toast-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "alert-toast-title" },
    });
    /** @type {__VLS_StyleScopedClasses['alert-toast-title']} */ ;
    (alert.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "alert-toast-msg" },
    });
    /** @type {__VLS_StyleScopedClasses['alert-toast-msg']} */ ;
    (alert.message);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.dismiss(alert.id);
                // @ts-ignore
                [visibleAlerts, levelIcon, dismiss,];
            } },
        ...{ class: "alert-toast-close" },
    });
    /** @type {__VLS_StyleScopedClasses['alert-toast-close']} */ ;
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_9;
if (__VLS_ctx.showBell) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "alert-bell-wrap" },
        ...{ style: (__VLS_ctx.bellStyle) },
    });
    /** @type {__VLS_StyleScopedClasses['alert-bell-wrap']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showBell))
                    return;
                __VLS_ctx.panelOpen = !__VLS_ctx.panelOpen;
                // @ts-ignore
                [showBell, bellStyle, panelOpen, panelOpen,];
            } },
        ...{ class: "alert-bell-btn" },
        title: (`${__VLS_ctx.activeAlerts.length} 条告警`),
    });
    /** @type {__VLS_StyleScopedClasses['alert-bell-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "alert-bell-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['alert-bell-icon']} */ ;
    if (__VLS_ctx.activeAlerts.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "alert-bell-badge" },
        });
        /** @type {__VLS_StyleScopedClasses['alert-bell-badge']} */ ;
        (__VLS_ctx.activeAlerts.length > 9 ? '9+' : __VLS_ctx.activeAlerts.length);
    }
    if (__VLS_ctx.panelOpen) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "alert-panel" },
        });
        /** @type {__VLS_StyleScopedClasses['alert-panel']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "alert-panel-header" },
        });
        /** @type {__VLS_StyleScopedClasses['alert-panel-header']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.clearAll) },
            ...{ class: "alert-panel-clear" },
        });
        /** @type {__VLS_StyleScopedClasses['alert-panel-clear']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "alert-panel-list" },
        });
        /** @type {__VLS_StyleScopedClasses['alert-panel-list']} */ ;
        if (__VLS_ctx.activeAlerts.length === 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "alert-panel-empty" },
            });
            /** @type {__VLS_StyleScopedClasses['alert-panel-empty']} */ ;
        }
        for (const [a] of __VLS_vFor((__VLS_ctx.activeAlerts))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (a.id),
                ...{ class: (['alert-panel-item', `alert-panel-item--${a.level}`]) },
            });
            /** @type {__VLS_StyleScopedClasses['alert-panel-item']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "api-icon" },
            });
            /** @type {__VLS_StyleScopedClasses['api-icon']} */ ;
            (__VLS_ctx.levelIcon(a.level));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "api-body" },
            });
            /** @type {__VLS_StyleScopedClasses['api-body']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "api-title" },
            });
            /** @type {__VLS_StyleScopedClasses['api-title']} */ ;
            (a.title);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "api-msg" },
            });
            /** @type {__VLS_StyleScopedClasses['api-msg']} */ ;
            (a.message);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "api-time" },
            });
            /** @type {__VLS_StyleScopedClasses['api-time']} */ ;
            (a.time);
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.showBell))
                            return;
                        if (!(__VLS_ctx.panelOpen))
                            return;
                        __VLS_ctx.dismiss(a.id);
                        // @ts-ignore
                        [levelIcon, dismiss, panelOpen, activeAlerts, activeAlerts, activeAlerts, activeAlerts, activeAlerts, activeAlerts, clearAll,];
                    } },
                ...{ class: "api-close" },
            });
            /** @type {__VLS_StyleScopedClasses['api-close']} */ ;
            // @ts-ignore
            [];
        }
    }
}
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    setup: () => (__VLS_exposed),
    __typeProps: {},
    props: {},
});
export default {};
