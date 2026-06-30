/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, nextTick, defineComponent, h } from 'vue';
// ── 图标组件 ──
const CheckIcon = defineComponent({ render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [h('polyline', { points: '20 6 9 17 4 12' })]) });
const XCircleIcon = defineComponent({ render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [h('circle', { cx: '12', cy: '12', r: '10' }), h('line', { x1: '15', y1: '9', x2: '9', y2: '15' }), h('line', { x1: '9', y1: '9', x2: '15', y2: '15' })]) });
const AlertTriangleIcon = defineComponent({ render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [h('path', { d: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z' }), h('line', { x1: '12', y1: '9', x2: '12', y2: '13' }), h('line', { x1: '12', y1: '17', x2: '12.01', y2: '17' })]) });
const InfoIcon = defineComponent({ render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [h('circle', { cx: '12', cy: '12', r: '10' }), h('line', { x1: '12', y1: '16', x2: '12', y2: '12' }), h('line', { x1: '12', y1: '8', x2: '12.01', y2: '8' })]) });
const HelpCircleIcon = defineComponent({ render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [h('circle', { cx: '12', cy: '12', r: '10' }), h('path', { d: 'M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3' }), h('line', { x1: '12', y1: '17', x2: '12.01', y2: '17' })]) });
const XIcon = defineComponent({ render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round' }, [h('line', { x1: '18', y1: '6', x2: '6', y2: '18' }), h('line', { x1: '6', y1: '6', x2: '18', y2: '18' })]) });
const iconMap = {
    success: CheckIcon,
    error: XCircleIcon,
    warning: AlertTriangleIcon,
    info: InfoIcon,
    confirm: HelpCircleIcon,
};
const toasts = ref([]);
let toastId = 0;
const addToast = (type, message, title, duration = 3500) => {
    const id = ++toastId;
    toasts.value.push({ id, type, message, title, duration });
    setTimeout(() => removeToast(id), duration);
};
const removeToast = (id) => {
    const idx = toasts.value.findIndex(t => t.id === id);
    if (idx !== -1)
        toasts.value.splice(idx, 1);
};
const dialog = ref(null);
const confirmBtnRef = ref(null);
let dialogResolve = null;
const showDialog = (options) => {
    return new Promise(resolve => {
        dialog.value = options;
        dialogResolve = resolve;
        nextTick(() => confirmBtnRef.value?.focus());
    });
};
const resolveDialog = (result) => {
    dialog.value = null;
    dialogResolve?.(result);
    dialogResolve = null;
};
const onBackdropClick = () => {
    if (dialog.value?.showCancel !== false)
        resolveDialog(false);
};
const promptState = ref(null);
const promptInputRef = ref(null);
let promptResolve = null;
const showPrompt = (title, options) => {
    return new Promise(resolve => {
        promptState.value = {
            title,
            message: options?.message,
            placeholder: options?.placeholder || '',
            value: options?.defaultValue || '',
        };
        promptResolve = resolve;
        nextTick(() => {
            promptInputRef.value?.focus();
            promptInputRef.value?.select();
        });
    });
};
const resolvePrompt = (value) => {
    promptState.value = null;
    promptResolve?.(value);
    promptResolve = null;
};
const submitPrompt = () => {
    if (!promptState.value?.value.trim())
        return;
    resolvePrompt(promptState.value.value.trim());
};
// ── 公开 API ──
const __VLS_exposed = {
    // Toast
    success: (msg, title) => addToast('success', msg, title),
    error: (msg, title) => addToast('error', msg, title),
    warning: (msg, title) => addToast('warning', msg, title),
    info: (msg, title) => addToast('info', msg, title),
    // Dialog
    confirm: (message, options) => showDialog({ type: 'confirm', title: options?.title || '确认操作', message, showCancel: true, ...options }),
    alert: (message, options) => showDialog({ type: options?.type || 'info', title: options?.title || '提示', message, showCancel: false, ...options }),
    // Prompt
    prompt: (title, options) => showPrompt(title, options),
};
defineExpose(__VLS_exposed);
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['toast-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['toast--success']} */ ;
/** @type {__VLS_StyleScopedClasses['toast-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['toast--error']} */ ;
/** @type {__VLS_StyleScopedClasses['toast-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['toast--warning']} */ ;
/** @type {__VLS_StyleScopedClasses['toast-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['toast--info']} */ ;
/** @type {__VLS_StyleScopedClasses['toast-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['toast-close']} */ ;
/** @type {__VLS_StyleScopedClasses['toast-close']} */ ;
/** @type {__VLS_StyleScopedClasses['toast--success']} */ ;
/** @type {__VLS_StyleScopedClasses['toast-progress']} */ ;
/** @type {__VLS_StyleScopedClasses['toast--error']} */ ;
/** @type {__VLS_StyleScopedClasses['toast-progress']} */ ;
/** @type {__VLS_StyleScopedClasses['toast--warning']} */ ;
/** @type {__VLS_StyleScopedClasses['toast-progress']} */ ;
/** @type {__VLS_StyleScopedClasses['toast--info']} */ ;
/** @type {__VLS_StyleScopedClasses['toast-progress']} */ ;
/** @type {__VLS_StyleScopedClasses['dialog-icon-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['dialog-icon-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['dialog-icon-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['dialog-icon-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['dialog-icon-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['dialog-icon-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['dialog-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['dialog-btn--cancel']} */ ;
/** @type {__VLS_StyleScopedClasses['dialog-btn--confirm']} */ ;
/** @type {__VLS_StyleScopedClasses['dialog-btn--danger']} */ ;
/** @type {__VLS_StyleScopedClasses['dialog-fade-enter-from']} */ ;
/** @type {__VLS_StyleScopedClasses['dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['dialog-fade-leave-to']} */ ;
/** @type {__VLS_StyleScopedClasses['dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['prompt-dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['dialog-content']} */ ;
/** @type {__VLS_StyleScopedClasses['prompt-input']} */ ;
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
    ...{ class: "toast-stack" },
    'aria-live': "polite",
});
/** @type {__VLS_StyleScopedClasses['toast-stack']} */ ;
let __VLS_6;
/** @ts-ignore @type {typeof __VLS_components.TransitionGroup | typeof __VLS_components.TransitionGroup} */
TransitionGroup;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
    name: "toast",
}));
const __VLS_8 = __VLS_7({
    name: "toast",
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
const { default: __VLS_11 } = __VLS_9.slots;
for (const [toast] of __VLS_vFor((__VLS_ctx.toasts))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (toast.id),
        ...{ class: (['toast', `toast--${toast.type}`]) },
        role: "alert",
    });
    /** @type {__VLS_StyleScopedClasses['toast']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "toast-icon" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['toast-icon']} */ ;
    const __VLS_12 = (__VLS_ctx.iconMap[toast.type]);
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({}));
    const __VLS_14 = __VLS_13({}, ...__VLS_functionalComponentArgsRest(__VLS_13));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "toast-body" },
    });
    /** @type {__VLS_StyleScopedClasses['toast-body']} */ ;
    if (toast.title) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "toast-title" },
        });
        /** @type {__VLS_StyleScopedClasses['toast-title']} */ ;
        (toast.title);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "toast-message" },
    });
    /** @type {__VLS_StyleScopedClasses['toast-message']} */ ;
    (toast.message);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.removeToast(toast.id);
                // @ts-ignore
                [toasts, iconMap, removeToast,];
            } },
        ...{ class: "toast-close" },
        'aria-label': "关闭",
    });
    /** @type {__VLS_StyleScopedClasses['toast-close']} */ ;
    let __VLS_17;
    /** @ts-ignore @type {typeof __VLS_components.XIcon} */
    XIcon;
    // @ts-ignore
    const __VLS_18 = __VLS_asFunctionalComponent1(__VLS_17, new __VLS_17({}));
    const __VLS_19 = __VLS_18({}, ...__VLS_functionalComponentArgsRest(__VLS_18));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "toast-progress" },
        ...{ style: ({ animationDuration: toast.duration + 'ms' }) },
    });
    /** @type {__VLS_StyleScopedClasses['toast-progress']} */ ;
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_9;
let __VLS_22;
/** @ts-ignore @type {typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
Transition;
// @ts-ignore
const __VLS_23 = __VLS_asFunctionalComponent1(__VLS_22, new __VLS_22({
    name: "dialog-fade",
}));
const __VLS_24 = __VLS_23({
    name: "dialog-fade",
}, ...__VLS_functionalComponentArgsRest(__VLS_23));
const { default: __VLS_27 } = __VLS_25.slots;
if (__VLS_ctx.dialog) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (__VLS_ctx.onBackdropClick) },
        ...{ class: "dialog-backdrop" },
    });
    /** @type {__VLS_StyleScopedClasses['dialog-backdrop']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: (['dialog', `dialog--${__VLS_ctx.dialog.type}`]) },
        role: "dialog",
        'aria-modal': "true",
        'aria-labelledby': ('dialog-title'),
    });
    /** @type {__VLS_StyleScopedClasses['dialog']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "dialog-icon-wrap" },
    });
    /** @type {__VLS_StyleScopedClasses['dialog-icon-wrap']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "dialog-icon" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['dialog-icon']} */ ;
    const __VLS_28 = (__VLS_ctx.iconMap[__VLS_ctx.dialog.type]);
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent1(__VLS_28, new __VLS_28({}));
    const __VLS_30 = __VLS_29({}, ...__VLS_functionalComponentArgsRest(__VLS_29));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "dialog-content" },
    });
    /** @type {__VLS_StyleScopedClasses['dialog-content']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        id: "dialog-title",
        ...{ class: "dialog-title" },
    });
    /** @type {__VLS_StyleScopedClasses['dialog-title']} */ ;
    (__VLS_ctx.dialog.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "dialog-message" },
    });
    /** @type {__VLS_StyleScopedClasses['dialog-message']} */ ;
    (__VLS_ctx.dialog.message);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "dialog-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['dialog-actions']} */ ;
    if (__VLS_ctx.dialog.showCancel !== false) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.dialog))
                        return;
                    if (!(__VLS_ctx.dialog.showCancel !== false))
                        return;
                    __VLS_ctx.resolveDialog(false);
                    // @ts-ignore
                    [iconMap, dialog, dialog, dialog, dialog, dialog, dialog, onBackdropClick, resolveDialog,];
                } },
            ...{ class: "dialog-btn dialog-btn--cancel" },
        });
        /** @type {__VLS_StyleScopedClasses['dialog-btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['dialog-btn--cancel']} */ ;
        (__VLS_ctx.dialog.cancelText || '取消');
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.dialog))
                    return;
                __VLS_ctx.resolveDialog(true);
                // @ts-ignore
                [dialog, resolveDialog,];
            } },
        ...{ class: (['dialog-btn', `dialog-btn--${__VLS_ctx.dialog.type === 'error' || __VLS_ctx.dialog.type === 'warning' ? 'danger' : 'confirm'}`]) },
        ref: "confirmBtnRef",
    });
    /** @type {__VLS_StyleScopedClasses['dialog-btn']} */ ;
    (__VLS_ctx.dialog.confirmText || '确定');
}
// @ts-ignore
[dialog, dialog, dialog,];
var __VLS_25;
let __VLS_33;
/** @ts-ignore @type {typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
Transition;
// @ts-ignore
const __VLS_34 = __VLS_asFunctionalComponent1(__VLS_33, new __VLS_33({
    name: "dialog-fade",
}));
const __VLS_35 = __VLS_34({
    name: "dialog-fade",
}, ...__VLS_functionalComponentArgsRest(__VLS_34));
const { default: __VLS_38 } = __VLS_36.slots;
if (__VLS_ctx.promptState) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.promptState))
                    return;
                __VLS_ctx.resolvePrompt(null);
                // @ts-ignore
                [promptState, resolvePrompt,];
            } },
        ...{ class: "dialog-backdrop" },
    });
    /** @type {__VLS_StyleScopedClasses['dialog-backdrop']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "dialog dialog--confirm prompt-dialog" },
        role: "dialog",
        'aria-modal': "true",
    });
    /** @type {__VLS_StyleScopedClasses['dialog']} */ ;
    /** @type {__VLS_StyleScopedClasses['dialog--confirm']} */ ;
    /** @type {__VLS_StyleScopedClasses['prompt-dialog']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "dialog-icon-wrap" },
    });
    /** @type {__VLS_StyleScopedClasses['dialog-icon-wrap']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "dialog-icon" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['dialog-icon']} */ ;
    const __VLS_39 = (__VLS_ctx.iconMap['confirm']);
    // @ts-ignore
    const __VLS_40 = __VLS_asFunctionalComponent1(__VLS_39, new __VLS_39({}));
    const __VLS_41 = __VLS_40({}, ...__VLS_functionalComponentArgsRest(__VLS_40));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "dialog-content" },
    });
    /** @type {__VLS_StyleScopedClasses['dialog-content']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "dialog-title" },
    });
    /** @type {__VLS_StyleScopedClasses['dialog-title']} */ ;
    (__VLS_ctx.promptState.title);
    if (__VLS_ctx.promptState.message) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "dialog-message" },
        });
        /** @type {__VLS_StyleScopedClasses['dialog-message']} */ ;
        (__VLS_ctx.promptState.message);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onKeyup: (__VLS_ctx.submitPrompt) },
        ...{ onKeyup: (...[$event]) => {
                if (!(__VLS_ctx.promptState))
                    return;
                __VLS_ctx.resolvePrompt(null);
                // @ts-ignore
                [iconMap, promptState, promptState, promptState, resolvePrompt, submitPrompt,];
            } },
        ref: "promptInputRef",
        ...{ class: "prompt-input" },
        placeholder: (__VLS_ctx.promptState.placeholder),
        spellcheck: "false",
    });
    (__VLS_ctx.promptState.value);
    /** @type {__VLS_StyleScopedClasses['prompt-input']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "dialog-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['dialog-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.promptState))
                    return;
                __VLS_ctx.resolvePrompt(null);
                // @ts-ignore
                [promptState, promptState, resolvePrompt,];
            } },
        ...{ class: "dialog-btn dialog-btn--cancel" },
    });
    /** @type {__VLS_StyleScopedClasses['dialog-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['dialog-btn--cancel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.submitPrompt) },
        ...{ class: "dialog-btn dialog-btn--confirm" },
        disabled: (!__VLS_ctx.promptState.value.trim()),
    });
    /** @type {__VLS_StyleScopedClasses['dialog-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['dialog-btn--confirm']} */ ;
}
// @ts-ignore
[promptState, submitPrompt,];
var __VLS_36;
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    setup: () => (__VLS_exposed),
});
export default {};
