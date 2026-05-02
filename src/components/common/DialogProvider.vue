<template>
  <Teleport to="body">
    <!-- Toast 通知堆叠 -->
    <div class="toast-stack" aria-live="polite">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="['toast', `toast--${toast.type}`]"
          role="alert"
        >
          <span class="toast-icon" aria-hidden="true">
            <component :is="iconMap[toast.type]" />
          </span>
          <div class="toast-body">
            <div v-if="toast.title" class="toast-title">{{ toast.title }}</div>
            <div class="toast-message">{{ toast.message }}</div>
          </div>
          <button class="toast-close" @click="removeToast(toast.id)" aria-label="关闭">
            <XIcon />
          </button>
          <div class="toast-progress" :style="{ animationDuration: toast.duration + 'ms' }" />
        </div>
      </TransitionGroup>
    </div>

    <!-- Confirm 对话框 -->
    <Transition name="dialog-fade">
      <div v-if="dialog" class="dialog-backdrop" @click.self="onBackdropClick">
        <div
          :class="['dialog', `dialog--${dialog.type}`]"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="'dialog-title'"
        >
          <div class="dialog-icon-wrap">
            <span class="dialog-icon" aria-hidden="true">
              <component :is="iconMap[dialog.type]" />
            </span>
          </div>
          <div class="dialog-content">
            <h3 id="dialog-title" class="dialog-title">{{ dialog.title }}</h3>
            <p class="dialog-message">{{ dialog.message }}</p>
          </div>
          <div class="dialog-actions">
            <button
              v-if="dialog.showCancel !== false"
              class="dialog-btn dialog-btn--cancel"
              @click="resolveDialog(false)"
            >
              {{ dialog.cancelText || '取消' }}
            </button>
            <button
              :class="['dialog-btn', `dialog-btn--${dialog.type === 'error' || dialog.type === 'warning' ? 'danger' : 'confirm'}`]"
              @click="resolveDialog(true)"
              ref="confirmBtnRef"
            >
              {{ dialog.confirmText || '确定' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, nextTick, defineComponent, h } from 'vue'

// ── 图标组件 ──
const CheckIcon = defineComponent({ render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [h('polyline', { points: '20 6 9 17 4 12' })]) })
const XCircleIcon = defineComponent({ render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [h('circle', { cx: '12', cy: '12', r: '10' }), h('line', { x1: '15', y1: '9', x2: '9', y2: '15' }), h('line', { x1: '9', y1: '9', x2: '15', y2: '15' })]) })
const AlertTriangleIcon = defineComponent({ render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [h('path', { d: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z' }), h('line', { x1: '12', y1: '9', x2: '12', y2: '13' }), h('line', { x1: '12', y1: '17', x2: '12.01', y2: '17' })]) })
const InfoIcon = defineComponent({ render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [h('circle', { cx: '12', cy: '12', r: '10' }), h('line', { x1: '12', y1: '16', x2: '12', y2: '12' }), h('line', { x1: '12', y1: '8', x2: '12.01', y2: '8' })]) })
const HelpCircleIcon = defineComponent({ render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [h('circle', { cx: '12', cy: '12', r: '10' }), h('path', { d: 'M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3' }), h('line', { x1: '12', y1: '17', x2: '12.01', y2: '17' })]) })
const XIcon = defineComponent({ render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round' }, [h('line', { x1: '18', y1: '6', x2: '6', y2: '18' }), h('line', { x1: '6', y1: '6', x2: '18', y2: '18' })]) })

const iconMap: Record<string, any> = {
  success: CheckIcon,
  error: XCircleIcon,
  warning: AlertTriangleIcon,
  info: InfoIcon,
  confirm: HelpCircleIcon,
}

// ── Toast ──
interface Toast {
  id: number
  type: 'success' | 'error' | 'warning' | 'info'
  title?: string
  message: string
  duration: number
}

const toasts = ref<Toast[]>([])
let toastId = 0

const addToast = (type: Toast['type'], message: string, title?: string, duration = 3500) => {
  const id = ++toastId
  toasts.value.push({ id, type, message, title, duration })
  setTimeout(() => removeToast(id), duration)
}

const removeToast = (id: number) => {
  const idx = toasts.value.findIndex(t => t.id === id)
  if (idx !== -1) toasts.value.splice(idx, 1)
}

// ── Dialog ──
interface DialogOptions {
  type: 'success' | 'error' | 'warning' | 'info' | 'confirm'
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  showCancel?: boolean
}

const dialog = ref<DialogOptions | null>(null)
const confirmBtnRef = ref<HTMLButtonElement | null>(null)
let dialogResolve: ((v: boolean) => void) | null = null

const showDialog = (options: DialogOptions): Promise<boolean> => {
  return new Promise(resolve => {
    dialog.value = options
    dialogResolve = resolve
    nextTick(() => confirmBtnRef.value?.focus())
  })
}

const resolveDialog = (result: boolean) => {
  dialog.value = null
  dialogResolve?.(result)
  dialogResolve = null
}

const onBackdropClick = () => {
  if (dialog.value?.showCancel !== false) resolveDialog(false)
}

// ── 公开 API ──
defineExpose({
  // Toast
  success: (msg: string, title?: string) => addToast('success', msg, title),
  error:   (msg: string, title?: string) => addToast('error',   msg, title),
  warning: (msg: string, title?: string) => addToast('warning', msg, title),
  info:    (msg: string, title?: string) => addToast('info',    msg, title),
  // Dialog
  confirm: (message: string, options?: Partial<DialogOptions>) =>
    showDialog({ type: 'confirm', title: options?.title || '确认操作', message, showCancel: true, ...options }),
  alert: (message: string, options?: Partial<DialogOptions>) =>
    showDialog({ type: options?.type || 'info', title: options?.title || '提示', message, showCancel: false, ...options }),
})
</script>

<style scoped>
/* ── Toast Stack ── */
.toast-stack {
  position: fixed;
  top: 72px;
  right: 20px;
  z-index: 99999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
  width: 360px;
  max-width: calc(100vw - 40px);
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 12px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08);
  pointer-events: all;
  position: relative;
  overflow: hidden;
}

.toast--success { border-left: 3px solid hsl(var(--success)); }
.toast--error   { border-left: 3px solid hsl(var(--destructive)); }
.toast--warning { border-left: 3px solid hsl(var(--warning)); }
.toast--info    { border-left: 3px solid hsl(var(--primary)); }

.toast-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-top: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.toast-icon svg { width: 18px; height: 18px; }

.toast--success .toast-icon { color: hsl(var(--success)); }
.toast--error   .toast-icon { color: hsl(var(--destructive)); }
.toast--warning .toast-icon { color: hsl(var(--warning)); }
.toast--info    .toast-icon { color: hsl(var(--primary)); }

.toast-body { flex: 1; min-width: 0; }
.toast-title {
  font-size: 0.83rem;
  font-weight: 600;
  color: hsl(var(--foreground));
  margin-bottom: 2px;
}
.toast-message {
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
  line-height: 1.45;
  word-break: break-word;
}

.toast-close {
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: hsl(var(--muted-foreground));
  padding: 2px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background 0.15s;
  margin-top: -1px;
}
.toast-close svg { width: 14px; height: 14px; }
.toast-close:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--accent));
}

/* 进度条 */
.toast-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  width: 100%;
  transform-origin: left;
  animation: toast-shrink linear forwards;
}
.toast--success .toast-progress { background: hsl(var(--success) / 0.5); }
.toast--error   .toast-progress { background: hsl(var(--destructive) / 0.5); }
.toast--warning .toast-progress { background: hsl(var(--warning) / 0.5); }
.toast--info    .toast-progress { background: hsl(var(--primary) / 0.5); }

@keyframes toast-shrink {
  from { transform: scaleX(1); }
  to   { transform: scaleX(0); }
}

/* Toast 动画 */
.toast-enter-active { transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.toast-leave-active { transition: all 0.2s ease; }
.toast-enter-from   { opacity: 0; transform: translateX(100%) scale(0.9); }
.toast-leave-to     { opacity: 0; transform: translateX(100%) scale(0.95); }
.toast-move         { transition: transform 0.25s ease; }

/* ── Dialog ── */
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  z-index: 99998;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.dialog {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.2), 0 8px 24px rgba(0,0,0,0.12);
  width: 100%;
  max-width: 420px;
  padding: 28px 28px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
}

.dialog-icon-wrap {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.dialog-icon-wrap svg { width: 28px; height: 28px; }

.dialog--success .dialog-icon-wrap { background: hsl(var(--success) / 0.12); color: hsl(var(--success)); }
.dialog--error   .dialog-icon-wrap { background: hsl(var(--destructive) / 0.12); color: hsl(var(--destructive)); }
.dialog--warning .dialog-icon-wrap { background: hsl(var(--warning) / 0.12); color: hsl(var(--warning)); }
.dialog--info    .dialog-icon-wrap { background: hsl(var(--primary) / 0.12); color: hsl(var(--primary)); }
.dialog--confirm .dialog-icon-wrap { background: hsl(var(--primary) / 0.1); color: hsl(var(--primary)); }

.dialog-content { width: 100%; }
.dialog-title {
  font-size: 1rem;
  font-weight: 600;
  color: hsl(var(--foreground));
  margin: 0 0 8px;
}
.dialog-message {
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
  line-height: 1.6;
  margin: 0;
  word-break: break-word;
}

.dialog-actions {
  display: flex;
  gap: 10px;
  width: 100%;
  justify-content: center;
  margin-top: 4px;
}

.dialog-btn {
  flex: 1;
  max-width: 160px;
  padding: 9px 20px;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s ease;
  outline: none;
}
.dialog-btn:focus-visible {
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.4);
}

.dialog-btn--cancel {
  background: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
  border-color: hsl(var(--border));
}
.dialog-btn--cancel:hover {
  background: hsl(var(--accent));
}

.dialog-btn--confirm {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}
.dialog-btn--confirm:hover {
  opacity: 0.9;
}

.dialog-btn--danger {
  background: hsl(var(--destructive));
  color: hsl(var(--destructive-foreground));
}
.dialog-btn--danger:hover {
  opacity: 0.9;
}

/* Dialog 动画 */
.dialog-fade-enter-active { transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
.dialog-fade-leave-active { transition: all 0.18s ease; }
.dialog-fade-enter-from   { opacity: 0; }
.dialog-fade-leave-to     { opacity: 0; }
.dialog-fade-enter-from .dialog { transform: scale(0.88) translateY(16px); }
.dialog-fade-leave-to .dialog   { transform: scale(0.95); }
</style>
