/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, watch, onMounted } from 'vue';
const props = defineProps();
const containerEl = ref();
const iframeEl = ref();
const status = ref('connecting');
const errorMsg = ref('');
const iframeUrl = ref('');
// Derive the HTTP proxy URL from the wsUrl.
// wsUrl format: ws://host:port/api/desktop/sessions/{id}/xpra-ws?token=xxx
// iframe proxy:  http://host:port/api/desktop/sessions/{id}/xpra-html/?token=xxx
function buildIframeUrl(wsUrl) {
    if (!wsUrl)
        return '';
    try {
        const u = new URL(wsUrl);
        const proto = u.protocol === 'wss:' ? 'https:' : 'http:';
        // replace /xpra-ws with /xpra-html/
        const path = u.pathname.replace(/\/xpra-ws$/, '/xpra-html/');
        return `${proto}//${u.host}${path}${u.search}`;
    }
    catch {
        return '';
    }
}
function load() {
    status.value = 'connecting';
    errorMsg.value = '';
    iframeUrl.value = buildIframeUrl(props.wsUrl);
}
function onIframeLoad() {
    status.value = 'connected';
}
function onIframeError() {
    status.value = 'error';
    errorMsg.value = '无法加载 Xpra 界面';
}
onMounted(load);
watch(() => props.wsUrl, load);
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['xpra-msg']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "xpra-viewer" },
    ref: "containerEl",
});
/** @type {__VLS_StyleScopedClasses['xpra-viewer']} */ ;
if (__VLS_ctx.status !== 'connected') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "xpra-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['xpra-overlay']} */ ;
    if (__VLS_ctx.status === 'connecting') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "xpra-msg" },
        });
        /** @type {__VLS_StyleScopedClasses['xpra-msg']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "xpra-spinner" },
        });
        /** @type {__VLS_StyleScopedClasses['xpra-spinner']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    }
    else if (__VLS_ctx.status === 'error') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "xpra-msg xpra-error" },
        });
        /** @type {__VLS_StyleScopedClasses['xpra-msg']} */ ;
        /** @type {__VLS_StyleScopedClasses['xpra-error']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.errorMsg);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.load) },
        });
    }
}
if (__VLS_ctx.iframeUrl) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.iframe)({
        ...{ onLoad: (__VLS_ctx.onIframeLoad) },
        ...{ onError: (__VLS_ctx.onIframeError) },
        ref: "iframeEl",
        src: (__VLS_ctx.iframeUrl),
        ...{ class: "xpra-frame" },
        allow: "autoplay; clipboard-read; clipboard-write",
    });
    /** @type {__VLS_StyleScopedClasses['xpra-frame']} */ ;
}
// @ts-ignore
[status, status, status, errorMsg, load, iframeUrl, iframeUrl, onIframeLoad, onIframeError,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
