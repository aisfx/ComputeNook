<template>
  <!-- 全局报警通知 -->
  <Teleport to="body">
    <!-- 通知列表（右上角堆叠） -->
    <div class="alert-stack">
      <transition-group name="alert-slide">
        <div
          v-for="alert in visibleAlerts"
          :key="alert.id"
          :class="['alert-toast', `alert-toast--${alert.level}`]"
        >
          <span class="alert-toast-icon">{{ levelIcon(alert.level) }}</span>
          <div class="alert-toast-body">
            <div class="alert-toast-title">{{ alert.title }}</div>
            <div class="alert-toast-msg">{{ alert.message }}</div>
          </div>
          <button class="alert-toast-close" @click="dismiss(alert.id)">×</button>
        </div>
      </transition-group>
    </div>

    <!-- 铃铛图标（topbar 用） -->
    <div v-if="showBell" class="alert-bell-wrap" :style="bellStyle">
      <button class="alert-bell-btn" @click="panelOpen = !panelOpen" :title="`${activeAlerts.length} 条告警`">
        <span class="alert-bell-icon">🔔</span>
        <span v-if="activeAlerts.length" class="alert-bell-badge">{{ activeAlerts.length > 9 ? '9+' : activeAlerts.length }}</span>
      </button>

      <!-- 告警面板 -->
      <div v-if="panelOpen" class="alert-panel">
        <div class="alert-panel-header">
          <span>告警通知</span>
          <button class="alert-panel-clear" @click="clearAll">清空</button>
        </div>
        <div class="alert-panel-list">
          <div v-if="activeAlerts.length === 0" class="alert-panel-empty">暂无告警</div>
          <div
            v-for="a in activeAlerts"
            :key="a.id"
            :class="['alert-panel-item', `alert-panel-item--${a.level}`]"
          >
            <span class="api-icon">{{ levelIcon(a.level) }}</span>
            <div class="api-body">
              <div class="api-title">{{ a.title }}</div>
              <div class="api-msg">{{ a.message }}</div>
              <div class="api-time">{{ a.time }}</div>
            </div>
            <button class="api-close" @click="dismiss(a.id)">×</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import axios from 'axios'

interface AlertItem {
  id: number
  level: 'critical' | 'warning' | 'info'
  title: string
  message: string
  time: string
  dismissed: boolean
  shown: boolean
}

const props = withDefaults(defineProps<{
  showBell?: boolean
  bellStyle?: string
  pollInterval?: number  // 秒
  cpuWarn?: number
  memWarn?: number
}>(), {
  showBell: true,
  bellStyle: '',
  pollInterval: 60,
  cpuWarn: 85,
  memWarn: 90,
})

const alerts = ref<AlertItem[]>([])
const panelOpen = ref(false)
let idSeq = 0
let timer: ReturnType<typeof setInterval> | null = null

const activeAlerts = computed(() => alerts.value.filter(a => !a.dismissed))
const visibleAlerts = computed(() => alerts.value.filter(a => !a.dismissed && !a.shown).slice(0, 4))

const levelIcon = (level: string) => ({ critical: '🔴', warning: '🟡', info: '🔵' }[level] || '⚪')

const dismiss = (id: number) => {
  const a = alerts.value.find(x => x.id === id)
  if (a) a.dismissed = true
}

const clearAll = () => alerts.value.forEach(a => a.dismissed = true)

const addAlert = (level: AlertItem['level'], title: string, message: string) => {
  // 去重：同 title+message 未 dismiss 的不重复加
  const dup = alerts.value.find(a => !a.dismissed && a.title === title && a.message === message)
  if (dup) return
  const item: AlertItem = {
    id: ++idSeq,
    level, title, message,
    time: new Date().toLocaleTimeString(),
    dismissed: false,
    shown: false,
  }
  alerts.value.unshift(item)
  // 5 秒后自动标记为 shown（从 toast 消失，但留在面板）
  setTimeout(() => { item.shown = true }, 5000)
  // 最多保留 50 条
  if (alerts.value.length > 50) alerts.value = alerts.value.slice(0, 50)
}

// 暴露给父组件手动触发
defineExpose({ addAlert })

// 轮询 Prometheus 节点指标
const poll = async () => {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    const res = await axios.get('/monitoring/metrics', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const nodes: any[] = res.data?.data || []
    nodes.forEach(n => {
      const name = n.instance || n.node || 'unknown'
      if ((n.cpu_usage ?? 0) >= props.cpuWarn) {
        addAlert('warning', `CPU 告警: ${name}`, `CPU 使用率 ${n.cpu_usage?.toFixed(1)}% 超过阈值 ${props.cpuWarn}%`)
      }
      if ((n.mem_usage ?? 0) >= props.memWarn) {
        addAlert('critical', `内存告警: ${name}`, `内存使用率 ${n.mem_usage?.toFixed(1)}% 超过阈值 ${props.memWarn}%`)
      }
    })
  } catch {
    // 静默失败，不影响主界面
  }
}

onMounted(() => {
  poll()
  timer = setInterval(poll, props.pollInterval * 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
/* ── Toast 堆叠 ── */
.alert-stack {
  position: fixed;
  top: 68px;
  right: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.alert-toast {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  min-width: 280px;
  max-width: 360px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  pointer-events: all;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
}

.alert-toast--critical { border-left: 4px solid #ef4444; }
.alert-toast--warning  { border-left: 4px solid #f59e0b; }
.alert-toast--info     { border-left: 4px solid #3b82f6; }

.alert-toast-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }

.alert-toast-body { flex: 1; min-width: 0; }
.alert-toast-title { font-size: 0.82rem; font-weight: 600; color: hsl(var(--foreground)); }
.alert-toast-msg   { font-size: 0.75rem; color: hsl(var(--muted-foreground)); margin-top: 2px; }

.alert-toast-close {
  background: none; border: none; cursor: pointer;
  color: hsl(var(--muted-foreground)); font-size: 16px; line-height: 1;
  padding: 0 2px; flex-shrink: 0;
}
.alert-toast-close:hover { color: hsl(var(--foreground)); }

/* 动画 */
.alert-slide-enter-active { transition: all 0.3s ease; }
.alert-slide-leave-active { transition: all 0.25s ease; }
.alert-slide-enter-from  { opacity: 0; transform: translateX(40px); }
.alert-slide-leave-to    { opacity: 0; transform: translateX(40px); }

/* ── 铃铛 ── */
.alert-bell-wrap {
  position: relative;
  display: inline-block;
}

.alert-bell-btn {
  position: relative;
  width: 34px; height: 34px;
  border: none; background: none;
  border-radius: 6px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px;
  color: hsl(var(--muted-foreground));
  transition: background 0.15s;
}
.alert-bell-btn:hover { background: hsl(var(--accent)); }

.alert-bell-badge {
  position: absolute;
  top: 2px; right: 2px;
  background: #ef4444;
  color: #fff;
  font-size: 0.6rem;
  font-weight: 700;
  border-radius: 10px;
  padding: 0 4px;
  min-width: 16px;
  height: 16px;
  display: flex; align-items: center; justify-content: center;
  line-height: 1;
}

/* ── 面板 ── */
.alert-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 340px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
  z-index: 9998;
  overflow: hidden;
}

.alert-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid hsl(var(--border));
  font-size: 0.85rem; font-weight: 600;
  color: hsl(var(--foreground));
}

.alert-panel-clear {
  background: none; border: none; cursor: pointer;
  font-size: 0.75rem; color: hsl(var(--muted-foreground));
  padding: 2px 6px; border-radius: 4px;
}
.alert-panel-clear:hover { background: hsl(var(--accent)); }

.alert-panel-list { max-height: 400px; overflow-y: auto; }

.alert-panel-empty {
  padding: 24px; text-align: center;
  font-size: 0.82rem; color: hsl(var(--muted-foreground));
}

.alert-panel-item {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid hsl(var(--border) / 0.5);
  transition: background 0.15s;
}
.alert-panel-item:hover { background: hsl(var(--accent) / 0.5); }
.alert-panel-item--critical { border-left: 3px solid #ef4444; }
.alert-panel-item--warning  { border-left: 3px solid #f59e0b; }
.alert-panel-item--info     { border-left: 3px solid #3b82f6; }

.api-icon { font-size: 14px; flex-shrink: 0; margin-top: 2px; }
.api-body { flex: 1; min-width: 0; }
.api-title { font-size: 0.8rem; font-weight: 600; color: hsl(var(--foreground)); }
.api-msg   { font-size: 0.75rem; color: hsl(var(--muted-foreground)); margin-top: 2px; }
.api-time  { font-size: 0.7rem; color: hsl(var(--muted-foreground)); margin-top: 4px; }

.api-close {
  background: none; border: none; cursor: pointer;
  color: hsl(var(--muted-foreground)); font-size: 14px;
  padding: 0 2px; flex-shrink: 0;
}
.api-close:hover { color: hsl(var(--foreground)); }
</style>
