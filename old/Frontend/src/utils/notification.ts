// 统一的通知工具 —— 基于 dialog 服务，不再使用原生 alert/confirm
import { dialog } from './dialog'

export interface NotificationOptions {
  title?: string
  message: string
  type?: 'success' | 'error' | 'warning' | 'info'
}

export interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
}

export const showSuccess  = (message: string, title?: string) => dialog.success(message, title)
export const showError    = (message: string, title?: string) => dialog.error(message, title)
export const showWarning  = (message: string, title?: string) => dialog.warning(message, title)
export const showInfo     = (message: string, title?: string) => dialog.info(message, title)

export const showConfirm = (options: string | ConfirmOptions): Promise<boolean> => {
  if (typeof options === 'string') return dialog.confirm(options)
  return dialog.confirm(options.message, { title: options.title, confirmText: options.confirmText, cancelText: options.cancelText })
}

export const confirmDelete = (itemName: string, itemType = '项目'): Promise<boolean> =>
  dialog.confirmDelete(itemName, itemType)

export const confirmAction = (action: string, itemName: string): Promise<boolean> =>
  dialog.confirm(`确定要${action} "${itemName}" 吗？`)

export const notify = (options: NotificationOptions) => {
  const fn = dialog[options.type || 'info'] as (msg: string, title?: string) => void
  fn(options.message, options.title)
}

export default {
  success: showSuccess,
  error:   showError,
  warning: showWarning,
  info:    showInfo,
  confirm: showConfirm,
  confirmDelete,
  confirmAction,
  notify,
}
