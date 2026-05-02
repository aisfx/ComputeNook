// 统一的通知工具 —— 基于 dialog 服务，不再使用原生 alert/confirm
import { dialog } from './dialog';
export const showSuccess = (message, title) => dialog.success(message, title);
export const showError = (message, title) => dialog.error(message, title);
export const showWarning = (message, title) => dialog.warning(message, title);
export const showInfo = (message, title) => dialog.info(message, title);
export const showConfirm = (options) => {
    if (typeof options === 'string')
        return dialog.confirm(options);
    return dialog.confirm(options.message, { title: options.title, confirmText: options.confirmText, cancelText: options.cancelText });
};
export const confirmDelete = (itemName, itemType = '项目') => dialog.confirmDelete(itemName, itemType);
export const confirmAction = (action, itemName) => dialog.confirm(`确定要${action} "${itemName}" 吗？`);
export const notify = (options) => {
    const fn = dialog[options.type || 'info'];
    fn(options.message, options.title);
};
export default {
    success: showSuccess,
    error: showError,
    warning: showWarning,
    info: showInfo,
    confirm: showConfirm,
    confirmDelete,
    confirmAction,
    notify,
};
