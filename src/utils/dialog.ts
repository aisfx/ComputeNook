/**
 * 全局弹框/通知服务
 * 替代原生 alert() / confirm()，提供美观的 UI 弹框
 */
import { createApp, defineComponent, h, ref, nextTick } from 'vue'
import DialogProvider from '../components/common/DialogProvider.vue'

// 单例实例
let providerInstance: any = null

function getProvider() {
  if (providerInstance) return providerInstance

  const container = document.createElement('div')
  document.body.appendChild(container)

  const providerRef = ref<any>(null)

  const WrapperApp = defineComponent({
    setup() {
      return () => h(DialogProvider, { ref: providerRef })
    }
  })

  const app = createApp(WrapperApp)
  app.mount(container)

  // 等待下一帧确保组件已挂载
  providerInstance = new Proxy({} as any, {
    get(_, key: string) {
      return (...args: any[]) => {
        if (providerRef.value) {
          return (providerRef.value as any)[key]?.(...args)
        }
        // 如果还没挂载，等一帧再调用
        return nextTick().then(() => (providerRef.value as any)?.[key]?.(...args))
      }
    }
  })

  return providerInstance
}

export const dialog = {
  /** 成功 Toast */
  success(message: string, title?: string) {
    getProvider().success(message, title)
  },
  /** 错误 Toast */
  error(message: string, title?: string) {
    getProvider().error(message, title)
  },
  /** 警告 Toast */
  warning(message: string, title?: string) {
    getProvider().warning(message, title)
  },
  /** 信息 Toast */
  info(message: string, title?: string) {
    getProvider().info(message, title)
  },
  /** 确认对话框，返回 Promise<boolean> */
  confirm(message: string, options?: { title?: string; confirmText?: string; cancelText?: string; danger?: boolean }): Promise<boolean> {
    return getProvider().confirm(message, {
      title: options?.title,
      confirmText: options?.confirmText,
      cancelText: options?.cancelText,
      type: options?.danger ? 'warning' : 'confirm',
    })
  },
  /** 删除确认，默认危险样式 */
  confirmDelete(itemName: string, itemType = '项目'): Promise<boolean> {
    return getProvider().confirm(`确定要删除${itemType} "${itemName}" 吗？此操作不可恢复！`, {
      title: '确认删除',
      confirmText: '删除',
      cancelText: '取消',
      type: 'error',
    })
  },
  /** 纯提示弹框（无取消按钮），返回 Promise<boolean> */
  alert(message: string, options?: { title?: string; type?: 'success' | 'error' | 'warning' | 'info' }): Promise<boolean> {
    return getProvider().alert(message, options)
  },
}

export default dialog
