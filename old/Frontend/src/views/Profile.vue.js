/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import QRCode from 'qrcode';
import { authAPI, mfaAPI } from '../api';
import { getUser } from '../utils/auth';
const router = useRouter();
const user = ref(null);
const showEditModal = ref(false);
const editError = ref('');
const passwordError = ref('');
const passwordSuccess = ref('');
const updating = ref(false);
const changingPassword = ref(false);
const showSuccessToast = ref(false);
const successMessage = ref('');
// MFA
const mfaStatus = ref(null);
const mfaMode = ref('false');
const mfaDisableCode = ref('');
const mfaDisableError = ref('');
const mfaDisabling = ref(false);
const editForm = ref({
    cnName: '',
    email: '',
    phone: ''
});
const passwordForm = ref({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
});
// 加载用户信息
const loadUser = () => {
    user.value = getUser();
    if (user.value) {
        editForm.value = {
            cnName: user.value.cnName || '',
            email: user.value.email || '',
            phone: user.value.phone || ''
        };
    }
};
// 加载 MFA 状态
const loadMFAStatus = async () => {
    try {
        const status = await mfaAPI.getStatus();
        mfaStatus.value = status;
        mfaMode.value = String(status.mode);
    }
    catch (_) { }
};
// MFA 绑定弹窗状态
const showMFABindModal = ref(false);
const mfaBindStep = ref('scan');
const mfaBindQrUrl = ref(''); // data URL，直接给 img src
const mfaBindSecret = ref('');
const mfaBindAccount = ref('');
const mfaBindCode = ref('');
const mfaBindError = ref('');
const mfaBindLoading = ref(false);
const mfaBindShowManual = ref(false);
const goBindMFA = async () => {
    showMFABindModal.value = true;
    mfaBindStep.value = 'scan';
    mfaBindQrUrl.value = '';
    mfaBindCode.value = '';
    mfaBindError.value = '';
    mfaBindShowManual.value = false;
    try {
        const data = await mfaAPI.setupAuth();
        mfaBindSecret.value = data.secret;
        mfaBindAccount.value = data.account || '';
        // toDataURL 纯 JS，不依赖 DOM
        mfaBindQrUrl.value = await QRCode.toDataURL(data.otpauthUri, {
            width: 220, margin: 2, errorCorrectionLevel: 'M',
            color: { dark: '#000000', light: '#ffffff' }
        });
    }
    catch (e) {
        mfaBindError.value = e.response?.data?.error || '获取二维码失败';
    }
};
const handleMFABindConfirm = async () => {
    mfaBindError.value = '';
    mfaBindLoading.value = true;
    try {
        await mfaAPI.confirmAuth(mfaBindCode.value);
        mfaBindStep.value = 'done';
        await loadMFAStatus();
    }
    catch (e) {
        mfaBindError.value = e.response?.data?.error || '验证码错误，请重试';
    }
    finally {
        mfaBindLoading.value = false;
    }
};
const closeMFABindModal = () => {
    showMFABindModal.value = false;
};
// 解绑 MFA
const handleDisableMFA = async () => {
    mfaDisableError.value = '';
    mfaDisabling.value = true;
    try {
        await mfaAPI.disable(mfaDisableCode.value);
        mfaDisableCode.value = '';
        showSuccess('✅ MFA 已成功解绑');
        await loadMFAStatus();
    }
    catch (err) {
        mfaDisableError.value = err.response?.data?.error || '解绑失败，请检查验证码';
    }
    finally {
        mfaDisabling.value = false;
    }
};
// 显示成功提示
const showSuccess = (message) => {
    successMessage.value = message;
    showSuccessToast.value = true;
    setTimeout(() => {
        showSuccessToast.value = false;
    }, 3000);
};
// 更新个人信息
const updateProfile = async () => {
    editError.value = '';
    if (!editForm.value.cnName) {
        editError.value = '显示名称不能为空';
        return;
    }
    updating.value = true;
    try {
        await authAPI.updateProfile(editForm.value);
        // 更新本地用户信息
        if (user.value) {
            user.value.cnName = editForm.value.cnName;
            user.value.email = editForm.value.email;
            user.value.phone = editForm.value.phone;
            // 更新 localStorage 或 sessionStorage
            const storage = localStorage.getItem('user') ? localStorage : sessionStorage;
            storage.setItem('user', JSON.stringify(user.value));
        }
        // 关闭模态框
        closeEditModal();
        // 显示成功提示
        showSuccess('✅ 个人信息更新成功！');
    }
    catch (err) {
        editError.value = err.response?.data?.error || '更新失败';
    }
    finally {
        updating.value = false;
    }
};
// 修改密码
const changePassword = async () => {
    passwordError.value = '';
    passwordSuccess.value = '';
    // 验证
    if (!passwordForm.value.oldPassword) {
        passwordError.value = '请输入旧密码';
        return;
    }
    if (!passwordForm.value.newPassword || passwordForm.value.newPassword.length < 8) {
        passwordError.value = '新密码至少需要8个字符';
        return;
    }
    // 密码复杂度校验
    const pwd = passwordForm.value.newPassword;
    if (!/[A-Z]/.test(pwd)) {
        passwordError.value = '新密码必须包含至少一个大写字母';
        return;
    }
    if (!/[a-z]/.test(pwd)) {
        passwordError.value = '新密码必须包含至少一个小写字母';
        return;
    }
    if (!/[0-9]/.test(pwd)) {
        passwordError.value = '新密码必须包含至少一个数字';
        return;
    }
    if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
        passwordError.value = '两次输入的密码不一致';
        return;
    }
    if (passwordForm.value.oldPassword === passwordForm.value.newPassword) {
        passwordError.value = '新密码不能与旧密码相同';
        return;
    }
    changingPassword.value = true;
    try {
        await authAPI.changePassword(passwordForm.value.oldPassword, passwordForm.value.newPassword);
        // 更新本地用户信息，清除强制修改密码标记
        if (user.value) {
            user.value.passwordMustChange = false;
            const storage = localStorage.getItem('user') ? localStorage : sessionStorage;
            storage.setItem('user', JSON.stringify(user.value));
        }
        // 显示成功提示
        passwordSuccess.value = '✅ 密码修改成功！下次登录请使用新密码。';
        // 清空表单
        passwordForm.value = {
            oldPassword: '',
            newPassword: '',
            confirmPassword: ''
        };
        // 5秒后自动清除成功提示
        setTimeout(() => {
            passwordSuccess.value = '';
        }, 5000);
    }
    catch (err) {
        passwordError.value = err.response?.data?.error || '密码修改失败';
    }
    finally {
        changingPassword.value = false;
    }
};
// 关闭编辑模态框
const closeEditModal = () => {
    showEditModal.value = false;
    editError.value = '';
    loadUser(); // 重新加载，恢复原始值
};
onMounted(() => {
    loadUser();
    loadMFAStatus();
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
/** @type {__VLS_StyleScopedClasses['profile-container']} */ ;
/** @type {__VLS_StyleScopedClasses['info-row']} */ ;
/** @type {__VLS_StyleScopedClasses['card-header']} */ ;
/** @type {__VLS_StyleScopedClasses['info-row']} */ ;
/** @type {__VLS_StyleScopedClasses['info-row']} */ ;
/** @type {__VLS_StyleScopedClasses['info-row']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['info-row']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-danger']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-danger']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "profile" },
});
/** @type {__VLS_StyleScopedClasses['profile']} */ ;
if (__VLS_ctx.showSuccessToast) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "success-toast" },
    });
    /** @type {__VLS_StyleScopedClasses['success-toast']} */ ;
    (__VLS_ctx.successMessage);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "page-header" },
});
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "profile-container" },
});
/** @type {__VLS_StyleScopedClasses['profile-container']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-header" },
});
/** @type {__VLS_StyleScopedClasses['card-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showEditModal = true;
            // @ts-ignore
            [showSuccessToast, successMessage, showEditModal,];
        } },
    ...{ class: "btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-body" },
});
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "info-row" },
});
/** @type {__VLS_StyleScopedClasses['info-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "label" },
});
/** @type {__VLS_StyleScopedClasses['label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "value" },
});
/** @type {__VLS_StyleScopedClasses['value']} */ ;
(__VLS_ctx.user?.cnName);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "info-row" },
});
/** @type {__VLS_StyleScopedClasses['info-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "label" },
});
/** @type {__VLS_StyleScopedClasses['label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "value" },
});
/** @type {__VLS_StyleScopedClasses['value']} */ ;
(__VLS_ctx.user?.email || '-');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "info-row" },
});
/** @type {__VLS_StyleScopedClasses['info-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "label" },
});
/** @type {__VLS_StyleScopedClasses['label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "value" },
});
/** @type {__VLS_StyleScopedClasses['value']} */ ;
(__VLS_ctx.user?.phone || '-');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "info-row" },
});
/** @type {__VLS_StyleScopedClasses['info-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "label" },
});
/** @type {__VLS_StyleScopedClasses['label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "value" },
});
/** @type {__VLS_StyleScopedClasses['value']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
(__VLS_ctx.user?.username);
if (__VLS_ctx.mfaMode !== 'false') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card" },
    });
    /** @type {__VLS_StyleScopedClasses['card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card-header" },
    });
    /** @type {__VLS_StyleScopedClasses['card-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge" },
        ...{ class: (__VLS_ctx.mfaStatus?.confirmed ? 'badge-admin' : 'badge-user') },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    (__VLS_ctx.mfaStatus?.confirmed ? '已启用' : '未绑定');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card-body" },
    });
    /** @type {__VLS_StyleScopedClasses['card-body']} */ ;
    if (__VLS_ctx.mfaMode === 'global') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "alert alert-info" },
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['alert']} */ ;
        /** @type {__VLS_StyleScopedClasses['alert-info']} */ ;
    }
    if (__VLS_ctx.mfaStatus?.confirmed) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ style: {} },
        });
        if (__VLS_ctx.mfaDisableError) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "alert alert-error" },
            });
            /** @type {__VLS_StyleScopedClasses['alert']} */ ;
            /** @type {__VLS_StyleScopedClasses['alert-error']} */ ;
            (__VLS_ctx.mfaDisableError);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "form-group" },
        });
        /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.mfaDisableCode),
            type: "text",
            inputmode: "numeric",
            maxlength: "6",
            placeholder: "000000",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.handleDisableMFA) },
            ...{ class: "btn-danger" },
            disabled: (__VLS_ctx.mfaDisableCode.length !== 6 || __VLS_ctx.mfaDisabling),
        });
        /** @type {__VLS_StyleScopedClasses['btn-danger']} */ ;
        (__VLS_ctx.mfaDisabling ? '解绑中...' : '解绑 MFA');
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.goBindMFA) },
            ...{ class: "btn-primary" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-header" },
});
/** @type {__VLS_StyleScopedClasses['card-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-body" },
});
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
if (__VLS_ctx.passwordError) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "alert alert-error" },
    });
    /** @type {__VLS_StyleScopedClasses['alert']} */ ;
    /** @type {__VLS_StyleScopedClasses['alert-error']} */ ;
    (__VLS_ctx.passwordError);
}
if (__VLS_ctx.passwordSuccess) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "alert alert-success" },
    });
    /** @type {__VLS_StyleScopedClasses['alert']} */ ;
    /** @type {__VLS_StyleScopedClasses['alert-success']} */ ;
    (__VLS_ctx.passwordSuccess);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "form-group" },
});
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "password",
});
(__VLS_ctx.passwordForm.oldPassword);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "form-group" },
});
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "password",
    placeholder: "至少8位，含大小写字母和数字",
});
(__VLS_ctx.passwordForm.newPassword);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "form-group" },
});
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "password",
});
(__VLS_ctx.passwordForm.confirmPassword);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.changePassword) },
    ...{ class: "btn-primary" },
    disabled: (__VLS_ctx.changingPassword),
});
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
(__VLS_ctx.changingPassword ? '修改中...' : '修改密码');
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
if (__VLS_ctx.showMFABindModal) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (__VLS_ctx.closeMFABindModal) },
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
        ...{ onClick: (__VLS_ctx.closeMFABindModal) },
        ...{ class: "btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    if (__VLS_ctx.mfaBindStep === 'scan') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ style: {} },
        });
        if (!__VLS_ctx.mfaBindQrUrl && !__VLS_ctx.mfaBindError) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ style: {} },
            });
        }
        else if (__VLS_ctx.mfaBindQrUrl) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ style: {} },
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
                src: (__VLS_ctx.mfaBindQrUrl),
                alt: "MFA QR",
                ...{ style: {} },
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.showMFABindModal))
                            return;
                        if (!(__VLS_ctx.mfaBindStep === 'scan'))
                            return;
                        if (!!(!__VLS_ctx.mfaBindQrUrl && !__VLS_ctx.mfaBindError))
                            return;
                        if (!(__VLS_ctx.mfaBindQrUrl))
                            return;
                        __VLS_ctx.mfaBindShowManual = !__VLS_ctx.mfaBindShowManual;
                        // @ts-ignore
                        [user, user, user, user, mfaMode, mfaMode, mfaStatus, mfaStatus, mfaStatus, mfaDisableError, mfaDisableError, mfaDisableCode, mfaDisableCode, handleDisableMFA, mfaDisabling, mfaDisabling, goBindMFA, passwordError, passwordError, passwordSuccess, passwordSuccess, passwordForm, passwordForm, passwordForm, changePassword, changingPassword, changingPassword, showMFABindModal, closeMFABindModal, closeMFABindModal, mfaBindStep, mfaBindQrUrl, mfaBindQrUrl, mfaBindQrUrl, mfaBindError, mfaBindShowManual, mfaBindShowManual,];
                    } },
                ...{ style: {} },
            });
            (__VLS_ctx.mfaBindShowManual ? '▲ 收起' : '▼ 无法扫码？手动输入');
            if (__VLS_ctx.mfaBindShowManual) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ style: {} },
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ style: {} },
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ style: {} },
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
                (__VLS_ctx.mfaBindAccount);
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ style: {} },
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({
                    ...{ style: {} },
                });
                (__VLS_ctx.mfaBindSecret);
            }
        }
        if (__VLS_ctx.mfaBindError) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "alert alert-error" },
            });
            /** @type {__VLS_StyleScopedClasses['alert']} */ ;
            /** @type {__VLS_StyleScopedClasses['alert-error']} */ ;
            (__VLS_ctx.mfaBindError);
        }
    }
    else if (__VLS_ctx.mfaBindStep === 'confirm') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "form-group" },
        });
        /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onKeyup: (__VLS_ctx.handleMFABindConfirm) },
            value: (__VLS_ctx.mfaBindCode),
            type: "text",
            inputmode: "numeric",
            maxlength: "6",
            placeholder: "000000",
            ...{ style: {} },
            autofocus: true,
        });
        if (__VLS_ctx.mfaBindError) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "alert alert-error" },
            });
            /** @type {__VLS_StyleScopedClasses['alert']} */ ;
            /** @type {__VLS_StyleScopedClasses['alert-error']} */ ;
            (__VLS_ctx.mfaBindError);
        }
    }
    else if (__VLS_ctx.mfaBindStep === 'done') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ style: {} },
        });
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-footer" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-footer']} */ ;
    if (__VLS_ctx.mfaBindStep === 'scan') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.closeMFABindModal) },
            ...{ class: "btn-secondary" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showMFABindModal))
                        return;
                    if (!(__VLS_ctx.mfaBindStep === 'scan'))
                        return;
                    __VLS_ctx.mfaBindStep = 'confirm';
                    // @ts-ignore
                    [closeMFABindModal, mfaBindStep, mfaBindStep, mfaBindStep, mfaBindStep, mfaBindError, mfaBindError, mfaBindError, mfaBindError, mfaBindShowManual, mfaBindShowManual, mfaBindAccount, mfaBindSecret, handleMFABindConfirm, mfaBindCode,];
                } },
            ...{ class: "btn-primary" },
            disabled: (!__VLS_ctx.mfaBindQrUrl),
        });
        /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    }
    else if (__VLS_ctx.mfaBindStep === 'confirm') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showMFABindModal))
                        return;
                    if (!!(__VLS_ctx.mfaBindStep === 'scan'))
                        return;
                    if (!(__VLS_ctx.mfaBindStep === 'confirm'))
                        return;
                    __VLS_ctx.mfaBindStep = 'scan';
                    // @ts-ignore
                    [mfaBindStep, mfaBindStep, mfaBindQrUrl,];
                } },
            ...{ class: "btn-secondary" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.handleMFABindConfirm) },
            ...{ class: "btn-primary" },
            disabled: (__VLS_ctx.mfaBindCode.length !== 6 || __VLS_ctx.mfaBindLoading),
        });
        /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
        (__VLS_ctx.mfaBindLoading ? '验证中...' : '确认绑定');
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.closeMFABindModal) },
            ...{ class: "btn-primary" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    }
}
if (__VLS_ctx.showEditModal) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (__VLS_ctx.closeEditModal) },
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
        ...{ onClick: (__VLS_ctx.closeEditModal) },
        ...{ class: "btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    if (__VLS_ctx.editError) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "alert alert-error" },
        });
        /** @type {__VLS_StyleScopedClasses['alert']} */ ;
        /** @type {__VLS_StyleScopedClasses['alert-error']} */ ;
        (__VLS_ctx.editError);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "请输入显示名称",
    });
    (__VLS_ctx.editForm.cnName);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "email",
        placeholder: "请输入邮箱地址",
    });
    (__VLS_ctx.editForm.email);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form-group" },
    });
    /** @type {__VLS_StyleScopedClasses['form-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "请输入手机号码",
    });
    (__VLS_ctx.editForm.phone);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-footer" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-footer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeEditModal) },
        ...{ class: "btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.updateProfile) },
        ...{ class: "btn-primary" },
        disabled: (__VLS_ctx.updating),
    });
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    (__VLS_ctx.updating ? '保存中...' : '保存');
}
// @ts-ignore
[showEditModal, closeMFABindModal, handleMFABindConfirm, mfaBindCode, mfaBindLoading, mfaBindLoading, closeEditModal, closeEditModal, closeEditModal, editError, editError, editForm, editForm, editForm, updateProfile, updating, updating,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
