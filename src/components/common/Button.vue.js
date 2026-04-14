/// <reference types="../../../node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed } from 'vue';
const props = withDefaults(defineProps(), {
    variant: 'primary',
    size: 'md',
    disabled: false,
    loading: false,
    type: 'button'
});
const emit = defineEmits();
const buttonClasses = computed(() => {
    const classes = ['btn'];
    // 变体
    classes.push(`btn-${props.variant}`);
    // 尺寸
    if (props.size !== 'md') {
        classes.push(`btn-${props.size}`);
    }
    return classes.join(' ');
});
const handleClick = (event) => {
    if (!props.disabled && !props.loading) {
        emit('click', event);
    }
};
const __VLS_defaults = {
    variant: 'primary',
    size: 'md',
    disabled: false,
    loading: false,
    type: 'button'
};
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.handleClick) },
    ...{ class: (__VLS_ctx.buttonClasses) },
    disabled: (__VLS_ctx.disabled || __VLS_ctx.loading),
    type: (__VLS_ctx.type),
});
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "loading" },
    });
    /** @type {__VLS_StyleScopedClasses['loading']} */ ;
}
else {
    var __VLS_0 = {};
}
// @ts-ignore
var __VLS_1 = __VLS_0;
// @ts-ignore
[handleClick, buttonClasses, disabled, loading, loading, type,];
const __VLS_base = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
const __VLS_export = {};
export default {};
