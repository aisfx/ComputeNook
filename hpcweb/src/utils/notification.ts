// 统一的通知工具
// 使用浏览器原生的 alert 和 confirm，但格式统一

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

/**
 * 显示成功消息
 */
export function showSuccess(message: string, title?: string) {
  const fullMessage = title ? `✅ ${title}\n\n${message}` : `✅ ${message}`
  alert(fullMessage)
}

/**
 * 显示错误消息
 */
export function showError(message: string, title?: string) {
  const fullMessage = title ? `❌ ${title}\n\n${message}` : `❌ ${message}`
  alert(fullMessage)
}

/**
 * 显示警告消息
 */
export function showWarning(message: string, title?: string) {
  const fullMessage = title ? `⚠️ ${title}\n\n${message}` : `⚠️ ${message}`
  alert(fullMessage)
}

/**
 * 显示信息消息
 */
export function showInfo(message: string, title?: string) {
  const fullMessage = title ? `ℹ️ ${title}\n\n${message}` : `ℹ️ ${message}`
  alert(fullMessage)
}

/**
 * 显示确认对话框
 */
export function showConfirm(options: string | ConfirmOptions): boolean {
  if (typeof options === 'string') {
    return confirm(`❓ ${options}`)
  }
  
  const { title, message } = options
  const fullMessage = title ? `❓ ${title}\n\n${message}` : `❓ ${message}`
  return confirm(fullMessage)
}

/**
 * 显示删除确认对话框
 */
export function confirmDelete(itemName: string, itemType: string = '项目'): boolean {
  return confirm(`🗑️ 确认删除\n\n确定要删除${itemType} "${itemName}" 吗？\n\n此操作不可恢复！`)
}

/**
 * 显示操作确认对话框
 */
export function confirmAction(action: string, itemName: string): boolean {
  return confirm(`❓ 确认操作\n\n确定要${action} "${itemName}" 吗？`)
}

/**
 * 通用通知函数
 */
export function notify(options: NotificationOptions) {
  const { title, message, type = 'info' } = options
  
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  }
  
  const icon = icons[type]
  const fullMessage = title ? `${icon} ${title}\n\n${message}` : `${icon} ${message}`
  alert(fullMessage)
}

// 默认导出
export default {
  success: showSuccess,
  error: showError,
  warning: showWarning,
  info: showInfo,
  confirm: showConfirm,
  confirmDelete,
  confirmAction,
  notify
}
