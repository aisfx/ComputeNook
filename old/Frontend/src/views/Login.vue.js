/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import '@/api/index';
import { mfaAPI } from '../api';
const router = useRouter();
const form = ref({ username: '', password: '' });
const rememberMe = ref(false);
const loading = ref(false);
const errorMessage = ref('');
const showPassword = ref(false);
const theme = ref('dark');
const captchaId = ref('');
const captchaVal = ref('');
const captchaUrl = ref('');
const requireCaptcha = ref(false);
const lockedSeconds = ref(0);
let lockTimer = null;
const mfaStep = ref('none');
const mfaTempToken = ref('');
const mfaCode = ref('');
const lockMessage = computed(() => {
    if (lockedSeconds.value <= 0)
        return '';
    const m = Math.floor(lockedSeconds.value / 60);
    const s = lockedSeconds.value % 60;
    return `账户已锁定，请 ${m > 0 ? m + ' 分 ' : ''}${s} 秒后重试`;
});
const THEMES_LOGIN = ['light', 'dark', 'ocean'];
const THEME_ICONS_LOGIN = { light: '🌙', dark: '🌊', ocean: '☀️' };
const THEME_LABELS_LOGIN = { light: '切换暗色', dark: '切换海洋', ocean: '切换亮色' };
const themeIcon = computed(() => THEME_ICONS_LOGIN[theme.value]);
const themeLabel = computed(() => THEME_LABELS_LOGIN[theme.value]);
const cycleTheme = () => {
    const idx = THEMES_LOGIN.indexOf(theme.value);
    theme.value = THEMES_LOGIN[(idx + 1) % THEMES_LOGIN.length];
    localStorage.setItem('theme', theme.value);
    document.documentElement.setAttribute('data-theme', theme.value);
};
const getBaseUrl = () => {
    const w = window;
    if (w.__CONFIG__?.apiUrl)
        return w.__CONFIG__.apiUrl + '/api';
    if (import.meta.env.DEV)
        return `${location.protocol}//${location.hostname}:8080/api`;
    return '/api';
};
const refreshCaptcha = async () => {
    try {
        const res = await axios.get('/captcha/new');
        captchaId.value = res.data.captchaId;
        captchaUrl.value = `${getBaseUrl()}/captcha/${captchaId.value}.png?t=${Date.now()}`;
        captchaVal.value = '';
    }
    catch (_) { }
};
const startLockCountdown = (seconds) => {
    lockedSeconds.value = seconds;
    if (lockTimer)
        clearInterval(lockTimer);
    lockTimer = setInterval(() => {
        lockedSeconds.value--;
        if (lockedSeconds.value <= 0) {
            clearInterval(lockTimer);
            lockTimer = null;
            errorMessage.value = '';
        }
    }, 1000);
};
const saveSession = (token, user) => {
    // 始终使用 localStorage 以支持多标签页共享会话
    // "记住我"功能通过后端 token 过期时间控制
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};
const handleLogin = async () => {
    if (lockedSeconds.value > 0)
        return;
    errorMessage.value = '';
    loading.value = true;
    try {
        const data = await axios.post('/login', {
            username: form.value.username, password: form.value.password,
            captchaId: captchaId.value, captchaVal: captchaVal.value,
            rememberMe: rememberMe.value, // 传递"记住我"选项给后端
        }).then(r => r.data);
        if (data.mfaRequired) {
            mfaTempToken.value = data.tempToken;
            mfaStep.value = data.mfaSetup ? 'setup' : 'verify';
            return;
        }
        saveSession(data.token, data.user);
        router.push(data.user.passwordMustChange ? '/force-change-password' : '/dashboard');
    }
    catch (error) {
        const res = error.response?.data;
        const status = error.response?.status;
        if (status === 429 && res?.code === 'ACCOUNT_LOCKED') {
            startLockCountdown(res.retryAfter || 600);
            requireCaptcha.value = true;
            await refreshCaptcha();
        }
        else if (status === 400 && res?.code === 'CAPTCHA_REQUIRED') {
            errorMessage.value = '验证码错误，请重新输入';
            requireCaptcha.value = true;
            await refreshCaptcha();
        }
        else if (status === 401) {
            errorMessage.value = res?.error || '用户名或密码错误';
            if (res?.attemptsLeft !== undefined)
                errorMessage.value += `，还剩 ${res.attemptsLeft} 次机会`;
            if (res?.requireCaptcha) {
                requireCaptcha.value = true;
                await refreshCaptcha();
            }
        }
        else if (status === 403) {
            errorMessage.value = '账户已被禁用，请联系管理员';
        }
        else {
            errorMessage.value = res?.error || '登录失败，请检查网络连接';
        }
    }
    finally {
        loading.value = false;
    }
};
const handleMFAVerify = async () => {
    errorMessage.value = '';
    loading.value = true;
    try {
        const data = await mfaAPI.verifyLogin(mfaTempToken.value, mfaCode.value);
        saveSession(data.token, data.user);
        router.push(data.user.passwordMustChange ? '/force-change-password' : '/dashboard');
    }
    catch (error) {
        errorMessage.value = error.response?.data?.error || '验证码错误';
    }
    finally {
        loading.value = false;
    }
};
const goToSetup = () => {
    sessionStorage.setItem('mfa_temp_token', mfaTempToken.value);
    sessionStorage.setItem('mfa_setup_username', form.value.username);
    router.push('/mfa-setup');
};
onMounted(() => {
    const saved = localStorage.getItem('theme');
    theme.value = (saved && ['light', 'dark', 'ocean'].includes(saved)) ? saved : 'dark';
    document.documentElement.setAttribute('data-theme', theme.value);
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['login-left']} */ ;
/** @type {__VLS_StyleScopedClasses['login-left']} */ ;
/** @type {__VLS_StyleScopedClasses['login-left']} */ ;
/** @type {__VLS_StyleScopedClasses['login-left']} */ ;
/** @type {__VLS_StyleScopedClasses['login-left']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-logo']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-logo']} */ ;
/** @type {__VLS_StyleScopedClasses['login-brand']} */ ;
/** @type {__VLS_StyleScopedClasses['login-brand']} */ ;
/** @type {__VLS_StyleScopedClasses['login-brand']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-tagline']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-tagline']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-divider']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-divider']} */ ;
/** @type {__VLS_StyleScopedClasses['feature-card']} */ ;
/** @type {__VLS_StyleScopedClasses['feature-card']} */ ;
/** @type {__VLS_StyleScopedClasses['feature-card']} */ ;
/** @type {__VLS_StyleScopedClasses['feature-card']} */ ;
/** @type {__VLS_StyleScopedClasses['feature-card']} */ ;
/** @type {__VLS_StyleScopedClasses['feature-title']} */ ;
/** @type {__VLS_StyleScopedClasses['feature-title']} */ ;
/** @type {__VLS_StyleScopedClasses['feature-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['feature-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['status-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['status-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['login-right']} */ ;
/** @type {__VLS_StyleScopedClasses['login-right']} */ ;
/** @type {__VLS_StyleScopedClasses['theme-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['theme-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['theme-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['theme-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['theme-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['login-header']} */ ;
/** @type {__VLS_StyleScopedClasses['login-header']} */ ;
/** @type {__VLS_StyleScopedClasses['login-header']} */ ;
/** @type {__VLS_StyleScopedClasses['login-header']} */ ;
/** @type {__VLS_StyleScopedClasses['login-header']} */ ;
/** @type {__VLS_StyleScopedClasses['login-header']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['password-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['pw-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-label']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-label']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-label']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['error-alert']} */ ;
/** @type {__VLS_StyleScopedClasses['lock-alert']} */ ;
/** @type {__VLS_StyleScopedClasses['login-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['login-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['mfa-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['mfa-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['mfa-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['back-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['back-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['back-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['back-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['back-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['captcha-row']} */ ;
/** @type {__VLS_StyleScopedClasses['captcha-img']} */ ;
/** @type {__VLS_StyleScopedClasses['captcha-img']} */ ;
/** @type {__VLS_StyleScopedClasses['captcha-img']} */ ;
/** @type {__VLS_StyleScopedClasses['login-left']} */ ;
/** @type {__VLS_StyleScopedClasses['login-right']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "login-root" },
    'data-theme': (__VLS_ctx.theme),
});
/** @type {__VLS_StyleScopedClasses['login-root']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "login-left" },
});
/** @type {__VLS_StyleScopedClasses['login-left']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "login-brand" },
});
/** @type {__VLS_StyleScopedClasses['login-brand']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "brand-logo" },
});
/** @type {__VLS_StyleScopedClasses['brand-logo']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    width: "44",
    height: "44",
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
__VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "brand-tagline" },
});
/** @type {__VLS_StyleScopedClasses['brand-tagline']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "brand-desc" },
});
/** @type {__VLS_StyleScopedClasses['brand-desc']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "brand-divider" },
});
/** @type {__VLS_StyleScopedClasses['brand-divider']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "brand-features" },
});
/** @type {__VLS_StyleScopedClasses['brand-features']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-card" },
});
/** @type {__VLS_StyleScopedClasses['feature-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "feature-icon" },
});
/** @type {__VLS_StyleScopedClasses['feature-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-text" },
});
/** @type {__VLS_StyleScopedClasses['feature-text']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-title" },
});
/** @type {__VLS_StyleScopedClasses['feature-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-desc" },
});
/** @type {__VLS_StyleScopedClasses['feature-desc']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-card" },
});
/** @type {__VLS_StyleScopedClasses['feature-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "feature-icon" },
});
/** @type {__VLS_StyleScopedClasses['feature-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-text" },
});
/** @type {__VLS_StyleScopedClasses['feature-text']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-title" },
});
/** @type {__VLS_StyleScopedClasses['feature-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-desc" },
});
/** @type {__VLS_StyleScopedClasses['feature-desc']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-card" },
});
/** @type {__VLS_StyleScopedClasses['feature-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "feature-icon" },
});
/** @type {__VLS_StyleScopedClasses['feature-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-text" },
});
/** @type {__VLS_StyleScopedClasses['feature-text']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-title" },
});
/** @type {__VLS_StyleScopedClasses['feature-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-desc" },
});
/** @type {__VLS_StyleScopedClasses['feature-desc']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-card" },
});
/** @type {__VLS_StyleScopedClasses['feature-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "feature-icon" },
});
/** @type {__VLS_StyleScopedClasses['feature-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-text" },
});
/** @type {__VLS_StyleScopedClasses['feature-text']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-title" },
});
/** @type {__VLS_StyleScopedClasses['feature-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "feature-desc" },
});
/** @type {__VLS_StyleScopedClasses['feature-desc']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "status-bar" },
});
/** @type {__VLS_StyleScopedClasses['status-bar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "status-dot" },
});
/** @type {__VLS_StyleScopedClasses['status-dot']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "login-right" },
});
/** @type {__VLS_StyleScopedClasses['login-right']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "login-box" },
});
/** @type {__VLS_StyleScopedClasses['login-box']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.cycleTheme) },
    ...{ class: "theme-toggle" },
    title: (__VLS_ctx.themeLabel),
});
/** @type {__VLS_StyleScopedClasses['theme-toggle']} */ ;
(__VLS_ctx.themeIcon);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "login-header" },
});
/** @type {__VLS_StyleScopedClasses['login-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
if (__VLS_ctx.mfaStep === 'none') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
        ...{ onSubmit: (__VLS_ctx.handleLogin) },
        ...{ class: "login-form" },
    });
    /** @type {__VLS_StyleScopedClasses['login-form']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "field" },
    });
    /** @type {__VLS_StyleScopedClasses['field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        for: "username",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        id: "username",
        value: (__VLS_ctx.form.username),
        type: "text",
        placeholder: "请输入用户名",
        required: true,
        disabled: (__VLS_ctx.loading),
        autocomplete: "username",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "field" },
    });
    /** @type {__VLS_StyleScopedClasses['field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        for: "password",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "password-wrap" },
    });
    /** @type {__VLS_StyleScopedClasses['password-wrap']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        id: "password",
        type: (__VLS_ctx.showPassword ? 'text' : 'password'),
        placeholder: "请输入密码",
        required: true,
        disabled: (__VLS_ctx.loading),
        autocomplete: "current-password",
    });
    (__VLS_ctx.form.password);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.mfaStep === 'none'))
                    return;
                __VLS_ctx.showPassword = !__VLS_ctx.showPassword;
                // @ts-ignore
                [theme, cycleTheme, themeLabel, themeIcon, mfaStep, handleLogin, form, form, loading, loading, showPassword, showPassword, showPassword,];
            } },
        type: "button",
        ...{ class: "pw-toggle" },
    });
    /** @type {__VLS_StyleScopedClasses['pw-toggle']} */ ;
    (__VLS_ctx.showPassword ? '' : '');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "field-row" },
    });
    /** @type {__VLS_StyleScopedClasses['field-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "checkbox-label" },
    });
    /** @type {__VLS_StyleScopedClasses['checkbox-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
    });
    (__VLS_ctx.rememberMe);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    if (__VLS_ctx.requireCaptcha) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "field" },
        });
        /** @type {__VLS_StyleScopedClasses['field']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "captcha-row" },
        });
        /** @type {__VLS_StyleScopedClasses['captcha-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onKeyup: (__VLS_ctx.handleLogin) },
            value: (__VLS_ctx.captchaVal),
            type: "text",
            placeholder: "请输入验证码",
            maxlength: "6",
            disabled: (__VLS_ctx.loading || __VLS_ctx.lockedSeconds > 0),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
            ...{ onClick: (__VLS_ctx.refreshCaptcha) },
            src: (__VLS_ctx.captchaUrl),
            ...{ class: "captcha-img" },
            title: "点击刷新",
            alt: "验证码",
        });
        /** @type {__VLS_StyleScopedClasses['captcha-img']} */ ;
    }
    if (__VLS_ctx.lockedSeconds > 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "lock-alert" },
        });
        /** @type {__VLS_StyleScopedClasses['lock-alert']} */ ;
        (__VLS_ctx.lockMessage);
    }
    else if (__VLS_ctx.errorMessage) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "error-alert" },
        });
        /** @type {__VLS_StyleScopedClasses['error-alert']} */ ;
        (__VLS_ctx.errorMessage);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        type: "submit",
        ...{ class: "submit-btn" },
        disabled: (__VLS_ctx.loading || __VLS_ctx.lockedSeconds > 0),
    });
    /** @type {__VLS_StyleScopedClasses['submit-btn']} */ ;
    if (__VLS_ctx.loading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "btn-spinner" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-spinner']} */ ;
    }
    (__VLS_ctx.loading ? '登录中...' : '登 录');
}
else if (__VLS_ctx.mfaStep === 'verify') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "login-form" },
    });
    /** @type {__VLS_StyleScopedClasses['login-form']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mfa-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['mfa-hint']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mfa-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['mfa-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "field" },
    });
    /** @type {__VLS_StyleScopedClasses['field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        for: "mfa-code",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onKeyup: (__VLS_ctx.handleMFAVerify) },
        id: "mfa-code",
        value: (__VLS_ctx.mfaCode),
        type: "text",
        inputmode: "numeric",
        maxlength: "6",
        placeholder: "000000",
        disabled: (__VLS_ctx.loading),
        autocomplete: "one-time-code",
        ...{ class: "mfa-input" },
    });
    /** @type {__VLS_StyleScopedClasses['mfa-input']} */ ;
    if (__VLS_ctx.errorMessage) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "error-alert" },
        });
        /** @type {__VLS_StyleScopedClasses['error-alert']} */ ;
        (__VLS_ctx.errorMessage);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.handleMFAVerify) },
        ...{ class: "submit-btn" },
        disabled: (__VLS_ctx.loading || __VLS_ctx.mfaCode.length !== 6),
    });
    /** @type {__VLS_StyleScopedClasses['submit-btn']} */ ;
    if (__VLS_ctx.loading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "btn-spinner" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-spinner']} */ ;
    }
    (__VLS_ctx.loading ? '验证中...' : '验 证');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.mfaStep === 'none'))
                    return;
                if (!(__VLS_ctx.mfaStep === 'verify'))
                    return;
                __VLS_ctx.mfaStep = 'none';
                __VLS_ctx.mfaCode = '';
                __VLS_ctx.errorMessage = '';
                // @ts-ignore
                [mfaStep, mfaStep, handleLogin, loading, loading, loading, loading, loading, loading, loading, loading, showPassword, rememberMe, requireCaptcha, captchaVal, lockedSeconds, lockedSeconds, lockedSeconds, refreshCaptcha, captchaUrl, lockMessage, errorMessage, errorMessage, errorMessage, errorMessage, errorMessage, handleMFAVerify, handleMFAVerify, mfaCode, mfaCode, mfaCode,];
            } },
        ...{ class: "back-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['back-btn']} */ ;
}
else if (__VLS_ctx.mfaStep === 'setup') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "login-form" },
    });
    /** @type {__VLS_StyleScopedClasses['login-form']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mfa-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['mfa-hint']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mfa-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['mfa-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    if (__VLS_ctx.errorMessage) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "error-alert" },
        });
        /** @type {__VLS_StyleScopedClasses['error-alert']} */ ;
        (__VLS_ctx.errorMessage);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.goToSetup) },
        ...{ class: "submit-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['submit-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.mfaStep === 'none'))
                    return;
                if (!!(__VLS_ctx.mfaStep === 'verify'))
                    return;
                if (!(__VLS_ctx.mfaStep === 'setup'))
                    return;
                __VLS_ctx.mfaStep = 'none';
                __VLS_ctx.errorMessage = '';
                // @ts-ignore
                [mfaStep, mfaStep, errorMessage, errorMessage, errorMessage, goToSetup,];
            } },
        ...{ class: "back-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['back-btn']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "login-footer" },
});
/** @type {__VLS_StyleScopedClasses['login-footer']} */ ;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
