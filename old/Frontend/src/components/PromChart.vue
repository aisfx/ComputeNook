<template>
  <div class="prom-chart">
    <div v-if="loading" class="pc-loading">加载中...</div>
    <div v-else-if="error" class="pc-error">{{ error }}</div>
    <svg v-else-if="points.length > 1" class="pc-svg" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none">
      <!-- 网格线 -->
      <line v-for="y in gridYs" :key="y" :x1="PAD" :y1="y" :x2="W - PAD" :y2="y"
        stroke="currentColor" stroke-opacity="0.08" stroke-width="1" />
      <!-- 面积 -->
      <path :d="areaPath" :fill="color" fill-opacity="0.12" />
      <!-- 折线 -->
      <path :d="linePath" :stroke="color" stroke-width="2" fill="none" stroke-linejoin="round" />
      <!-- Y 轴标签 -->
      <text v-for="(label, i) in yLabels" :key="i"
        :x="PAD - 4" :y="gridYs[i] + 4"
        text-anchor="end" font-size="10" fill="currentColor" fill-opacity="0.5">
        {{ label }}
      </text>
      <!-- 最新值 -->
      <text :x="W - PAD" :y="H - 4" text-anchor="end" font-size="11" :fill="color" font-weight="600">
        {{ latestLabel }}
      </text>
    </svg>
    <div v-else class="pc-empty">暂无数据</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import axios from 'axios'

const props = defineProps<{
  query: string
  title?: string
  color?: string
  unit?: string
}>()

const W = 400
const H = 160
const PAD = 36

interface Point { t: number; v: number }

const points = ref<Point[]>([])
const loading = ref(false)
const error = ref('')
let timer: ReturnType<typeof setInterval> | null = null

const minV = computed(() => Math.min(...points.value.map(p => p.v)))
const maxV = computed(() => Math.max(...points.value.map(p => p.v)))
const range = computed(() => Math.max(maxV.value - minV.value, 0.001))

const toX = (t: number) => {
  const ts = points.value.map(p => p.t)
  const mn = Math.min(...ts), mx = Math.max(...ts)
  return PAD + ((t - mn) / Math.max(mx - mn, 1)) * (W - PAD * 2)
}
const toY = (v: number) => H - 16 - ((v - minV.value) / range.value) * (H - 32)

const linePath = computed(() => {
  if (!points.value.length) return ''
  return points.value.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.t).toFixed(1)},${toY(p.v).toFixed(1)}`).join(' ')
})

const areaPath = computed(() => {
  if (!points.value.length) return ''
  const base = H - 16
  const line = points.value.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.t).toFixed(1)},${toY(p.v).toFixed(1)}`).join(' ')
  const last = points.value[points.value.length - 1]
  const first = points.value[0]
  return `${line} L${toX(last.t).toFixed(1)},${base} L${toX(first.t).toFixed(1)},${base} Z`
})

const gridYs = computed(() => [0.2, 0.5, 0.8].map(r => H - 16 - r * (H - 32)))
const yLabels = computed(() => [0.8, 0.5, 0.2].map(r => {
  const v = minV.value + r * range.value
  return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(1)
}))

const latestLabel = computed(() => {
  if (!points.value.length) return ''
  const v = points.value[points.value.length - 1].v
  return `${v >= 1000 ? (v / 1000).toFixed(2) + 'k' : v.toFixed(2)} ${props.unit || ''}`
})

const fetchData = async () => {
  if (!props.query) return
  loading.value = true
  error.value = ''
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    const end = Math.floor(Date.now() / 1000)
    const start = end - 3600
    const res = await axios.get('/monitoring/query_range', {
      params: { query: props.query, start, end, step: 60 },
      headers: { Authorization: `Bearer ${token}` }
    })
    const result = res.data?.data?.result?.[0]?.values || []
    points.value = result.map(([t, v]: [number, string]) => ({ t, v: parseFloat(v) }))
  } catch (e: any) {
    error.value = e?.response?.data?.error || '查询失败'
  } finally {
    loading.value = false
  }
}

watch(() => props.query, fetchData)

onMounted(() => {
  fetchData()
  timer = setInterval(fetchData, 60000)
})
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<style scoped>
.prom-chart {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  color: hsl(var(--foreground));
}
.pc-svg { width: 100%; height: 100%; }
.pc-loading, .pc-error, .pc-empty {
  font-size: 0.8rem; color: hsl(var(--muted-foreground));
}
.pc-error { color: #ef4444; }
</style>
