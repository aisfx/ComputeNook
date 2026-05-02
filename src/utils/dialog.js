/**
 * 全局弹框/通知服务
 * 替代原生 alert() / confirm()，提供美观的 UI 弹框
 */
import { createApp, defineComponent, h, ref, nextTick } from 'vue';
import DialogProvider from '../components/common/DialogProvider.vue';
// 单例实例
let providerInstance = null;
function getProvider() {
    if (providerInstance)
        return providerInstance;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const providerRef = ref(null);
    const WrapperApp = defineComponent({
        setup() {
            return () => h(DialogProvider, { ref: providerRef });
        }
    });
    const app = createApp(WrapperApp);
    app.mount(container);
    // 等待下一帧确保组件已挂载
    providerInstance = new Proxy({}, {
        get(_, key) {
            return (...args) => {
                if (providerRef.value) {
                    return providerRef.value[key]?.(...args);
                }
                // 如果还没挂载，等一帧再调用
                return nextTick().then(() => providerRef.value?.[key]?.(...args));
            };
        }
    });
    return providerInstance;
}
export const dialog = {
    /** 成功 Toast */
    success(message, title) {
        getProvider().success(message, title);
    },
    /** 错误 Toast */
    error(message, title) {
        getProvider().error(message, title);
    },
    /** 警告 Toast */
    warning(message, title) {
        getProvider().warning(message, title);
    },
    /** 信息 Toast */
    info(message, title) {
        getProvider().info(message, title);
    },
    /** 确认对话框，返回 Promise<boolean> */
    confirm(message, options) {
        return getProvider().confirm(message, {
            title: options?.title,
            confirmText: options?.confirmText,
            cancelText: options?.cancelText,
            type: options?.danger ? 'warning' : 'confirm',
        });
    },
    /** 删除确认，默认危险样式 */
    confirmDelete(itemName, itemType = '项目') {
        return getProvider().confirm(`确定要删除${itemType} "${itemName}" 吗？此操作不可恢复！`, {
            title: '确认删除',
            confirmText: '删除',
            cancelText: '取消',
            type: 'error',
        });
    },
    /** 纯提示弹框（无取消按钮），返回 Promise<boolean> */
    alert(message, options) {
        return getProvider().alert(message, options);
    },
};
export default dialog;
