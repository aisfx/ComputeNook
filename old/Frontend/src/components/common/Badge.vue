<template>
  <span :class="badgeClasses">
    <slot></slot>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'primary' | 'success' | 'warning' | 'error'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary'
})

const badgeClasses = computed(() => {
  return ['badge', `badge-${props.variant}`]
})
</script>

<style scoped>
/* 样式已在 styles/components.css 中定义 */
</style>
