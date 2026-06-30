/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import QRCode from 'qrcode';
import '@/api/index';
import dialog from '../utils/dialog';
const router = useRouter();
const step = ref('install');
const qrDataUrl = ref('');
const secret = ref('');
const account = ref('');
const code = ref('');
const error = ref('');
const loading = ref(false);
const loadingQR = ref(false);
const showManual = ref(false);
// 腾讯身份验证器微信小程序链接（用户微信扫码可直接打开）
// 小程序原始ID: gh_b896c9b1f9e0，搜索"腾讯身份验证器"
const wxQrUrl = ref('');
onMounted(async () => {
    if (!tempToken) {
        router.push('/login');
        return;
    }
    // 生成腾讯身份验证器小程序二维码（微信扫码跳转）
    try {
        wxQrUrl.value = await QRCode.toDataURL('https://weixin.qq.com/r/qS_c7XjEg9-KrXiP9xmN', { width: 130, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#000', light: '#fff' } });
    }
    catch (_) {
        // 生成失败时用外部服务兜底
        wxQrUrl.value = 'https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=https%3A%2F%2Fweixin.qq.com%2Fr%2FqS_c7XjEg9-KrXiP9xmN';
    }
});
const tempToken = sessionStorage.getItem('mfa_temp_token') || '';
function getBase() {
    if (axios.defaults.baseURL)
        return axios.defaults.baseURL;
    const w = window;
    if (w.__CONFIG__?.apiUrl)
        return w.__CONFIG__.apiUrl + '/api';
    if (import.meta.env.DEV)
        return `${location.protocol}//${location.hostname}:8080/api`;
    return '/api';
}
const mfaAxios = axios.create();
mfaAxios.interceptors.request.use(cfg => {
    if (!cfg.baseURL)
        cfg.baseURL = getBase();
    cfg.headers.Authorization = `Bearer ${tempToken}`;
    return cfg;
});
// 点击"已安装"时才请求后端生成 secret，避免页面加载就跳 login
const goToScan = async () => {
    if (!tempToken) {
        router.push('/login');
        return;
    }
    if (secret.value) {
        // 已经获取过，直接跳
        step.value = 'scan';
        return;
    }
    loadingQR.value = true;
    step.value = 'scan';
    try {
        const res = await mfaAxios.post('mfa/setup');
        const data = res.data.data;
        secret.value = data.secret;
        account.value = data.account || '';
        const uri = data.otpauthUri;
        if (uri) {
            qrDataUrl.value = await QRCode.toDataURL(uri, {
                width: 280,
                margin: 2,
                errorCorrectionLevel: 'M',
                color: { dark: '#000000', light: '#ffffff' }
            });
        }
    }
    catch (e) {
        error.value = e.response?.data?.error || '获取二维码失败，请重新登录';
        step.value = 'install';
    }
    finally {
        loadingQR.value = false;
    }
};
onMounted(() => {
    if (!tempToken) {
        router.push('/login');
    }
    // 不在 onMounted 里请求，等用户点"已安装"再请求
});
const copySecret = () => {
    navigator.clipboard?.writeText(secret.value)
        .then(() => dialog.success('密钥已复制'))
        .catch(() => dialog.info(secret.value, '密钥'));
};
const handleConfirm = async () => {
    error.value = '';
    loading.value = true;
    try {
        await mfaAxios.post('mfa/confirm', { code: code.value });
        sessionStorage.removeItem('mfa_temp_token');
        sessionStorage.removeItem('mfa_setup_username');
        step.value = 'done';
    }
    catch (e) {
        error.value = e.response?.data?.error || '验证码错误，请重试';
    }
    finally {
        loading.value = false;
    }
};
const goLogin = () => router.push('/login');
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['step-header']} */ ;
/** @type {__VLS_StyleScopedClasses['step-header']} */ ;
/** @type {__VLS_StyleScopedClasses['install-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['app-item']} */ ;
/** @type {__VLS_StyleScopedClasses['app-link']} */ ;
/** @type {__VLS_StyleScopedClasses['code-input']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-back']} */ ;
/** @type {__VLS_StyleScopedClasses['done-section']} */ ;
/** @type {__VLS_StyleScopedClasses['done-section']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mfa-setup-root" },
});
/** @type {__VLS_StyleScopedClasses['mfa-setup-root']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mfa-setup-box" },
});
/** @type {__VLS_StyleScopedClasses['mfa-setup-box']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "step-header" },
});
/** @type {__VLS_StyleScopedClasses['step-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "step-icon" },
});
/** @type {__VLS_StyleScopedClasses['step-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
if (__VLS_ctx.step === 'install') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "install-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['install-hint']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "app-download" },
    });
    /** @type {__VLS_StyleScopedClasses['app-download']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "app-item recommended" },
    });
    /** @type {__VLS_StyleScopedClasses['app-item']} */ ;
    /** @type {__VLS_StyleScopedClasses['recommended']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "recommend-badge" },
    });
    /** @type {__VLS_StyleScopedClasses['recommend-badge']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        src: (__VLS_ctx.wxQrUrl),
        alt: "腾讯身份验证器",
        ...{ class: "app-qr" },
    });
    /** @type {__VLS_StyleScopedClasses['app-qr']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "app-label" },
    });
    /** @type {__VLS_StyleScopedClasses['app-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "app-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['app-sub']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "app-divider" },
    });
    /** @type {__VLS_StyleScopedClasses['app-divider']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "app-item" },
    });
    /** @type {__VLS_StyleScopedClasses['app-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        src: "https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=https://appgallery.huawei.com/app/C100162",
        alt: "Google Authenticator",
        ...{ class: "app-qr" },
    });
    /** @type {__VLS_StyleScopedClasses['app-qr']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "app-label" },
    });
    /** @type {__VLS_StyleScopedClasses['app-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "app-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['app-sub']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "install-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['install-sub']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.goToScan) },
        ...{ class: "btn-primary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
}
else if (__VLS_ctx.step === 'scan') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    if (__VLS_ctx.loadingQR) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "loading" },
        });
        /** @type {__VLS_StyleScopedClasses['loading']} */ ;
    }
    else if (__VLS_ctx.secret) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "qr-section" },
        });
        /** @type {__VLS_StyleScopedClasses['qr-section']} */ ;
        if (__VLS_ctx.qrDataUrl) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
                src: (__VLS_ctx.qrDataUrl),
                alt: "MFA QR Code",
                ...{ class: "qr-img" },
            });
            /** @type {__VLS_StyleScopedClasses['qr-img']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "loading" },
            });
            /** @type {__VLS_StyleScopedClasses['loading']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.step === 'install'))
                        return;
                    if (!(__VLS_ctx.step === 'scan'))
                        return;
                    if (!!(__VLS_ctx.loadingQR))
                        return;
                    if (!(__VLS_ctx.secret))
                        return;
                    __VLS_ctx.showManual = !__VLS_ctx.showManual;
                    // @ts-ignore
                    [step, step, wxQrUrl, goToScan, loadingQR, secret, qrDataUrl, qrDataUrl, showManual, showManual,];
                } },
            ...{ class: "manual-toggle" },
        });
        /** @type {__VLS_StyleScopedClasses['manual-toggle']} */ ;
        (__VLS_ctx.showManual ? '▲ 收起' : '▼ 无法扫码？手动输入密钥');
        if (__VLS_ctx.showManual) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "manual-section" },
            });
            /** @type {__VLS_StyleScopedClasses['manual-section']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "manual-row" },
            });
            /** @type {__VLS_StyleScopedClasses['manual-row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "manual-label" },
            });
            /** @type {__VLS_StyleScopedClasses['manual-label']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({
                ...{ class: "manual-val" },
            });
            /** @type {__VLS_StyleScopedClasses['manual-val']} */ ;
            (__VLS_ctx.account);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "manual-row" },
            });
            /** @type {__VLS_StyleScopedClasses['manual-row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "manual-label" },
            });
            /** @type {__VLS_StyleScopedClasses['manual-label']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({
                ...{ class: "manual-val" },
            });
            /** @type {__VLS_StyleScopedClasses['manual-val']} */ ;
            (__VLS_ctx.secret);
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.copySecret) },
                ...{ class: "btn-copy" },
            });
            /** @type {__VLS_StyleScopedClasses['btn-copy']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "manual-row" },
            });
            /** @type {__VLS_StyleScopedClasses['manual-row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "manual-label" },
            });
            /** @type {__VLS_StyleScopedClasses['manual-label']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({
                ...{ class: "manual-val" },
            });
            /** @type {__VLS_StyleScopedClasses['manual-val']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "manual-row" },
            });
            /** @type {__VLS_StyleScopedClasses['manual-row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "manual-label" },
            });
            /** @type {__VLS_StyleScopedClasses['manual-label']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({
                ...{ class: "manual-val" },
            });
            /** @type {__VLS_StyleScopedClasses['manual-val']} */ ;
        }
    }
    if (__VLS_ctx.error) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "error-alert" },
        });
        /** @type {__VLS_StyleScopedClasses['error-alert']} */ ;
        (__VLS_ctx.error);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.step === 'install'))
                    return;
                if (!(__VLS_ctx.step === 'scan'))
                    return;
                __VLS_ctx.step = 'confirm';
                // @ts-ignore
                [step, secret, showManual, showManual, account, copySecret, error, error,];
            } },
        ...{ class: "btn-primary" },
        disabled: (!__VLS_ctx.secret),
    });
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.step === 'install'))
                    return;
                if (!(__VLS_ctx.step === 'scan'))
                    return;
                __VLS_ctx.step = 'install';
                // @ts-ignore
                [step, secret,];
            } },
        ...{ class: "btn-back" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-back']} */ ;
}
else if (__VLS_ctx.step === 'confirm') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "confirm-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['confirm-hint']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "field" },
    });
    /** @type {__VLS_StyleScopedClasses['field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onKeyup: (__VLS_ctx.handleConfirm) },
        value: (__VLS_ctx.code),
        type: "text",
        inputmode: "numeric",
        maxlength: "6",
        placeholder: "000000",
        ...{ class: "code-input" },
        autofocus: true,
    });
    /** @type {__VLS_StyleScopedClasses['code-input']} */ ;
    if (__VLS_ctx.error) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "error-alert" },
        });
        /** @type {__VLS_StyleScopedClasses['error-alert']} */ ;
        (__VLS_ctx.error);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.handleConfirm) },
        ...{ class: "btn-primary" },
        disabled: (__VLS_ctx.loading || __VLS_ctx.code.length !== 6),
    });
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    if (__VLS_ctx.loading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "spinner" },
        });
        /** @type {__VLS_StyleScopedClasses['spinner']} */ ;
    }
    (__VLS_ctx.loading ? '验证中...' : '确认绑定');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.step === 'install'))
                    return;
                if (!!(__VLS_ctx.step === 'scan'))
                    return;
                if (!(__VLS_ctx.step === 'confirm'))
                    return;
                __VLS_ctx.step = 'scan';
                __VLS_ctx.error = '';
                // @ts-ignore
                [step, step, error, error, error, handleConfirm, handleConfirm, code, code, loading, loading, loading,];
            } },
        ...{ class: "btn-back" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-back']} */ ;
}
else if (__VLS_ctx.step === 'done') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "done-section" },
    });
    /** @type {__VLS_StyleScopedClasses['done-section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "done-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['done-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.goLogin) },
        ...{ class: "btn-primary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
}
// @ts-ignore
[step, goLogin,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
