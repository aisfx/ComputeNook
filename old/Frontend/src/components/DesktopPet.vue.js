/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { getUser } from '../utils/auth';
const emit = defineEmits();
const router = useRouter();
// 位置状态
const position = ref({ x: window.innerWidth - 100, y: window.innerHeight - 150 });
const isDragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });
// 宠物状态: idle, jump, run, trapped, chased, casting
const petState = ref('idle');
const direction = ref('right'); // left | right
const showJinguBang = ref(false);
// 消息气泡
const showBubble = ref(false);
const bubbleText = ref('');
// 右键菜单
const menuVisible = ref(false);
const menuPosition = ref({ x: 0, y: 0 });
// 设置
const petEnabled = ref(true);
// 用户权限
const currentUser = ref(null);
const isAdmin = computed(() => currentUser.value?.role === 'admin');
// 宠物表情映射
const petEmoji = computed(() => {
    const emojis = {
        idle: '🐒',
        jump: '🐵',
        run: '🐒',
        trapped: '😫',
        chased: '😱',
        casting: '🐒',
        spin: '🐵',
        think: '🐒',
        roar: '🐵',
    };
    return emojis[petState.value] || '🐒';
});
// 宠物样式
const petStyle = computed(() => ({
    left: `${position.value.x}px`,
    top: `${position.value.y}px`,
    cursor: isDragging.value ? 'grabbing' : 'grab'
}));
const menuStyle = computed(() => ({
    left: `${menuPosition.value.x}px`,
    top: `${menuPosition.value.y}px`
}));
// 随机跳跃
const randomJump = () => {
    if (isDragging.value || !petEnabled.value)
        return;
    const actions = ['jump', 'run', 'idle'];
    const action = actions[Math.floor(Math.random() * actions.length)];
    if (action === 'jump') {
        petState.value = 'jump';
        // 随机移动
        const jumpX = (Math.random() - 0.5) * 100;
        const jumpY = (Math.random() - 0.5) * 50;
        position.value.x = Math.max(50, Math.min(window.innerWidth - 100, position.value.x + jumpX));
        position.value.y = Math.max(100, Math.min(window.innerHeight - 150, position.value.y + jumpY));
        direction.value = jumpX > 0 ? 'right' : 'left';
        setTimeout(() => {
            petState.value = 'idle';
        }, 600);
    }
    else if (action === 'run') {
        petState.value = 'run';
        direction.value = Math.random() > 0.5 ? 'right' : 'left';
        setTimeout(() => {
            petState.value = 'idle';
        }, 1000);
    }
};
// 显示消息气泡
const showBubbleMessage = (text, duration = 3000) => {
    bubbleText.value = text;
    showBubble.value = true;
    setTimeout(() => {
        showBubble.value = false;
    }, duration);
};
// 挥舞金箍棒特效
const castSpell = () => {
    if (petState.value === 'casting')
        return; // 防重复
    petState.value = 'casting';
    showJinguBang.value = true;
    setTimeout(() => {
        showJinguBang.value = false;
        petState.value = 'idle';
        showBubbleMessage('有什么问题，尽管问俺老孙！🪄');
    }, 900);
};
// 五指山效果（权限不足时）
const showTrappedEffect = () => {
    petState.value = 'trapped';
    showBubbleMessage('师父念紧箍咒了！头疼...');
    setTimeout(() => {
        petState.value = 'idle';
    }, 3000);
};
// 唐僧追赶效果（做坏事时）
const showChasedEffect = () => {
    petState.value = 'chased';
    showBubbleMessage('师父来追我了！快跑！');
    // 快速移动
    const escapeX = direction.value === 'right' ? 80 : -80;
    position.value.x = Math.max(50, Math.min(window.innerWidth - 100, position.value.x + escapeX));
    setTimeout(() => {
        petState.value = 'idle';
    }, 2000);
};
// 点击动作池 — 随机挑一个，同时打开 AI
const clickActions = [
    // 挥金箍棒
    () => {
        petState.value = 'casting';
        showJinguBang.value = true;
        showBubbleMessage('有什么问题，尽管问俺老孙！🪄');
        setTimeout(() => { showJinguBang.value = false; petState.value = 'idle'; }, 900);
    },
    // 跳一下
    () => {
        petState.value = 'jump';
        showBubbleMessage('俺来啦！🐵');
        setTimeout(() => { petState.value = 'idle'; }, 700);
    },
    // 翻跟斗（spin）
    () => {
        petState.value = 'spin';
        showBubbleMessage('筋斗云！☁️');
        setTimeout(() => { petState.value = 'idle'; }, 800);
    },
    // 挠头思考
    () => {
        petState.value = 'think';
        showBubbleMessage('俺老孙帮你想想... 🤔');
        setTimeout(() => { petState.value = 'idle'; }, 1200);
    },
    // 抖威风
    () => {
        petState.value = 'roar';
        showBubbleMessage('齐天大圣到此！✨');
        setTimeout(() => { petState.value = 'idle'; }, 800);
    },
];
const handleClick = (e) => {
    if (isDragging.value)
        return;
    // 随机挑一个动作
    const action = clickActions[Math.floor(Math.random() * clickActions.length)];
    action();
    // 动作开始后 500ms 弹出 AI 窗口
    setTimeout(() => emit('openAI'), 500);
};
// 拖拽开始
const startDrag = (e) => {
    if (e.button !== 0)
        return; // 只响应左键
    isDragging.value = true;
    dragOffset.value = {
        x: e.clientX - position.value.x,
        y: e.clientY - position.value.y
    };
    petState.value = 'run';
};
// 拖拽中
const onDrag = (e) => {
    if (!isDragging.value)
        return;
    position.value = {
        x: e.clientX - dragOffset.value.x,
        y: e.clientY - dragOffset.value.y
    };
    direction.value = e.movementX > 0 ? 'right' : 'left';
};
// 拖拽结束
const endDrag = () => {
    if (isDragging.value) {
        isDragging.value = false;
        petState.value = 'idle';
    }
};
// 显示右键菜单
const showMenu = (e) => {
    menuPosition.value = { x: e.clientX, y: e.clientY };
    menuVisible.value = true;
};
// 关闭菜单
const closeMenu = () => {
    menuVisible.value = false;
};
// 打开AI助手
const openAIAssistant = () => {
    closeMenu();
    emit('openAI');
};
// 快捷操作
const quickAction = (action) => {
    closeMenu();
    emit('quickAction', action);
    const actionTexts = {
        jobs: '带你去作业列表！',
        files: '打开文件管理！',
        submit: '来提交作业吧！',
        monitor: '查看集群状态！',
        users: '管理用户！'
    };
    showBubbleMessage(actionTexts[action] || '好的！');
    castSpell();
};
// 宠物设置
const togglePetSettings = () => {
    closeMenu();
    showBubbleMessage('设置功能开发中...');
};
// 加载用户信息
const loadUser = () => {
    const user = getUser();
    currentUser.value = user;
};
// 定时器ID
let jumpInterval = null;
onMounted(() => {
    loadUser();
    // 绑定事件
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('click', (e) => {
        if (menuVisible.value)
            closeMenu();
    });
    // 定时随机跳跃
    jumpInterval = window.setInterval(randomJump, 5000);
    // 欢迎消息
    setTimeout(() => {
        showBubbleMessage('俺老孙来也！点我帮你解决问题！');
    }, 1000);
});
onUnmounted(() => {
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', endDrag);
    if (jumpInterval)
        clearInterval(jumpInterval);
});
// 暴露方法供父组件调用
const __VLS_exposed = {
    showBubbleMessage,
    castSpell,
    showTrappedEffect,
    showChasedEffect
};
defineExpose(__VLS_exposed);
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
/** @type {__VLS_StyleScopedClasses['pet-body']} */ ;
/** @type {__VLS_StyleScopedClasses['pet-body']} */ ;
/** @type {__VLS_StyleScopedClasses['pet-body']} */ ;
/** @type {__VLS_StyleScopedClasses['pet-body']} */ ;
/** @type {__VLS_StyleScopedClasses['pet-body']} */ ;
/** @type {__VLS_StyleScopedClasses['pet-body']} */ ;
/** @type {__VLS_StyleScopedClasses['pet-body']} */ ;
/** @type {__VLS_StyleScopedClasses['pet-body']} */ ;
/** @type {__VLS_StyleScopedClasses['pet-body']} */ ;
/** @type {__VLS_StyleScopedClasses['pet-sprite']} */ ;
/** @type {__VLS_StyleScopedClasses['pet-body']} */ ;
/** @type {__VLS_StyleScopedClasses['pet-sprite']} */ ;
/** @type {__VLS_StyleScopedClasses['pet-shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['jgb-spark']} */ ;
/** @type {__VLS_StyleScopedClasses['jgb-spark']} */ ;
/** @type {__VLS_StyleScopedClasses['jgb-spark']} */ ;
/** @type {__VLS_StyleScopedClasses['jgb-spark']} */ ;
/** @type {__VLS_StyleScopedClasses['pet-bubble']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onMousedown: (__VLS_ctx.startDrag) },
    ...{ onContextmenu: (__VLS_ctx.showMenu) },
    ...{ class: "desktop-pet" },
    ...{ style: (__VLS_ctx.petStyle) },
});
/** @type {__VLS_StyleScopedClasses['desktop-pet']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onClick: (__VLS_ctx.handleClick) },
    ...{ class: "pet-body" },
    ...{ class: ([__VLS_ctx.petState, __VLS_ctx.direction]) },
});
/** @type {__VLS_StyleScopedClasses['pet-body']} */ ;
let __VLS_0;
/** @ts-ignore @type {typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
Transition;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    name: "jgb",
}));
const __VLS_2 = __VLS_1({
    name: "jgb",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
if (__VLS_ctx.showJinguBang) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jingu-bang-wrap" },
    });
    /** @type {__VLS_StyleScopedClasses['jingu-bang-wrap']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jgb-stick" },
    });
    /** @type {__VLS_StyleScopedClasses['jgb-stick']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jgb-spark s1" },
    });
    /** @type {__VLS_StyleScopedClasses['jgb-spark']} */ ;
    /** @type {__VLS_StyleScopedClasses['s1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jgb-spark s2" },
    });
    /** @type {__VLS_StyleScopedClasses['jgb-spark']} */ ;
    /** @type {__VLS_StyleScopedClasses['s2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jgb-spark s3" },
    });
    /** @type {__VLS_StyleScopedClasses['jgb-spark']} */ ;
    /** @type {__VLS_StyleScopedClasses['s3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jgb-spark s4" },
    });
    /** @type {__VLS_StyleScopedClasses['jgb-spark']} */ ;
    /** @type {__VLS_StyleScopedClasses['s4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jgb-ring" },
    });
    /** @type {__VLS_StyleScopedClasses['jgb-ring']} */ ;
}
// @ts-ignore
[startDrag, showMenu, petStyle, handleClick, petState, direction, showJinguBang,];
var __VLS_3;
let __VLS_6;
/** @ts-ignore @type {typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
Transition;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
    name: "mountain",
}));
const __VLS_8 = __VLS_7({
    name: "mountain",
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
const { default: __VLS_11 } = __VLS_9.slots;
if (__VLS_ctx.petState === 'trapped') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "five-finger-mountain" },
    });
    /** @type {__VLS_StyleScopedClasses['five-finger-mountain']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "mtn-emoji" },
    });
    /** @type {__VLS_StyleScopedClasses['mtn-emoji']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mtn-glow" },
    });
    /** @type {__VLS_StyleScopedClasses['mtn-glow']} */ ;
}
// @ts-ignore
[petState,];
var __VLS_9;
let __VLS_12;
/** @ts-ignore @type {typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
Transition;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
    name: "tangseng",
}));
const __VLS_14 = __VLS_13({
    name: "tangseng",
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
const { default: __VLS_17 } = __VLS_15.slots;
if (__VLS_ctx.petState === 'chased') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tangseng-wrap" },
    });
    /** @type {__VLS_StyleScopedClasses['tangseng-wrap']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
}
// @ts-ignore
[petState,];
var __VLS_15;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pet-sprite" },
});
/** @type {__VLS_StyleScopedClasses['pet-sprite']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "pet-emoji" },
});
/** @type {__VLS_StyleScopedClasses['pet-emoji']} */ ;
(__VLS_ctx.petEmoji);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pet-shadow" },
    ...{ class: ({ jumping: __VLS_ctx.petState === 'jump' }) },
});
/** @type {__VLS_StyleScopedClasses['pet-shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['jumping']} */ ;
let __VLS_18;
/** @ts-ignore @type {typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
Transition;
// @ts-ignore
const __VLS_19 = __VLS_asFunctionalComponent1(__VLS_18, new __VLS_18({
    name: "bubble",
}));
const __VLS_20 = __VLS_19({
    name: "bubble",
}, ...__VLS_functionalComponentArgsRest(__VLS_19));
const { default: __VLS_23 } = __VLS_21.slots;
if (__VLS_ctx.showBubble) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pet-bubble" },
    });
    /** @type {__VLS_StyleScopedClasses['pet-bubble']} */ ;
    (__VLS_ctx.bubbleText);
}
// @ts-ignore
[petState, petEmoji, showBubble, bubbleText,];
var __VLS_21;
let __VLS_24;
/** @ts-ignore @type {typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
Transition;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent1(__VLS_24, new __VLS_24({
    name: "menu",
}));
const __VLS_26 = __VLS_25({
    name: "menu",
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
const { default: __VLS_29 } = __VLS_27.slots;
if (__VLS_ctx.menuVisible) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pet-menu" },
        ...{ style: (__VLS_ctx.menuStyle) },
    });
    /** @type {__VLS_StyleScopedClasses['pet-menu']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (__VLS_ctx.openAIAssistant) },
        ...{ class: "menu-item" },
    });
    /** @type {__VLS_StyleScopedClasses['menu-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.menuVisible))
                    return;
                __VLS_ctx.quickAction('jobs');
                // @ts-ignore
                [menuVisible, menuStyle, openAIAssistant, quickAction,];
            } },
        ...{ class: "menu-item" },
    });
    /** @type {__VLS_StyleScopedClasses['menu-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.menuVisible))
                    return;
                __VLS_ctx.quickAction('files');
                // @ts-ignore
                [quickAction,];
            } },
        ...{ class: "menu-item" },
    });
    /** @type {__VLS_StyleScopedClasses['menu-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.menuVisible))
                    return;
                __VLS_ctx.quickAction('submit');
                // @ts-ignore
                [quickAction,];
            } },
        ...{ class: "menu-item" },
    });
    /** @type {__VLS_StyleScopedClasses['menu-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    if (__VLS_ctx.isAdmin) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.menuVisible))
                        return;
                    if (!(__VLS_ctx.isAdmin))
                        return;
                    __VLS_ctx.quickAction('monitor');
                    // @ts-ignore
                    [quickAction, isAdmin,];
                } },
            ...{ class: "menu-item" },
        });
        /** @type {__VLS_StyleScopedClasses['menu-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    }
    if (__VLS_ctx.isAdmin) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.menuVisible))
                        return;
                    if (!(__VLS_ctx.isAdmin))
                        return;
                    __VLS_ctx.quickAction('users');
                    // @ts-ignore
                    [quickAction, isAdmin,];
                } },
            ...{ class: "menu-item" },
        });
        /** @type {__VLS_StyleScopedClasses['menu-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "menu-divider" },
    });
    /** @type {__VLS_StyleScopedClasses['menu-divider']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (__VLS_ctx.togglePetSettings) },
        ...{ class: "menu-item" },
    });
    /** @type {__VLS_StyleScopedClasses['menu-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
}
// @ts-ignore
[togglePetSettings,];
var __VLS_27;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    setup: () => (__VLS_exposed),
    __typeEmits: {},
});
export default {};
