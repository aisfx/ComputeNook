<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="modal-backdrop" @click.self="handleClose">
        <div class="modal" :style="{ maxWidth: width }">
          <div class="modal-header">
            <h3 class="modal-title">{{ title }}</h3>
            <button class="modal-close" @click="handleClose" aria-label="关闭">
              ×
            </button>
          </div>
          
          <div class="modal-body">
            <slot></slot>
          </div>
          
          <div v-if="$slots.footer || showFooter" class="modal-footer">
            <slot name="footer">
              <button class="btn btn-outline" @click="handleClose">取消</button>
              <button class="btn btn-primary" @click="handleConfirm">确定</button>
            </slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
  title: string
  width?: string
  showFooter?: boolean
  closeOnClickOutside?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  width: '600px',
  showFooter: true,
  closeOnClickOutside: true
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'confirm': []
  'close': []
}>()

const handleClose = () => {
  if (props.closeOnClickOutside) {
    emit('update:modelValue', false)
    emit('close')
  }
}

const handleConfirm = () => {
  emit('confirm')
}
</script>

<style scoped>
/* 样式已在 styles/components.css 中定义 */

.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--transition-normal);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal,
.modal-leave-active .modal {
  transition: transform var(--transition-normal);
}

.modal-enter-from .modal,
.modal-leave-to .modal {
  transform: scale(0.9);
}
</style>
