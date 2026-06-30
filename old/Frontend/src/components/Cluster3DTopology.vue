<template>
  <div :class="['cluster-topo', { light: !isDark }]">
    <div ref="chartEl" class="chart-layer"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps<{
  nodes: any[]
  isDark: boolean
}>()

const chartEl = ref<HTMLElement>()
let chart: echarts.ECharts | null = null

const getNodeColor = (state: string) => {
  const s = (state || '').toUpperCase()
  if (s.includes('ALLOC') || s.includes('MIX')) return '#10b981'
  if (s.includes('DOWN') || s.includes('DRAIN')) return '#ef4444'
  if (s.includes('IDLE')) return '#3b82f6'
  return '#94a3b8'
}

const getNodeStatus = (state: string) => {
  const s = (state || '').toUpperCase()
  if (s.includes('ALLOC') || s.includes('MIX')) return 'running'
  if (s.includes('DOWN') || s.includes('DRAIN')) return 'offline'
  return 'idle'
}

const updateChart = () => {
  if (!chart) return

  const nodes = props.nodes
  const isDark = props.isDark

  // 分组
  const cpuNodes = nodes.filter(n => !n.name?.toLowerCase().includes('gpu') && !n.name?.toLowerCase().includes('storage') && !n.name?.toLowerCase().includes('nfs'))
  const gpuNodes = nodes.filter(n => n.name?.toLowerCase().includes('gpu'))
  const storageNodes = nodes.filter(n => n.name?.toLowerCase().includes('storage') || n.name?.toLowerCase().includes('nfs'))

  // 如果没有真实节点，生成示例数据
  const makeFakeNodes = (prefix: string, count: number, type: string) =>
    Array.from({ length: count }, (_, i) => ({
      name: `${prefix}${String(i + 1).padStart(2, '0')}`,
      state: i < Math.floor(count * 0.85) ? 'ALLOCATED' : i < count - 1 ? 'IDLE' : 'DOWN',
      cpu_usage_percent: Math.random() * 80 + 10,
      memory_usage_percent: Math.random() * 70 + 15,
      nodeType: type
    }))

  const allCpu = cpuNodes.length > 0 ? cpuNodes.map(n => ({ ...n, nodeType: 'cpu' })) : makeFakeNodes('cn', 12, 'cpu')
  const allGpu = gpuNodes.length > 0 ? gpuNodes.map(n => ({ ...n, nodeType: 'gpu' })) : makeFakeNodes('gpu', 4, 'gpu')
  const allStorage = storageNodes.length > 0 ? storageNodes.map(n => ({ ...n, nodeType: 'storage' })) : makeFakeNodes('nfs', 2, 'storage')

  const textColor = isDark ? '#94a3b8' : '#64748b'
  const dimColor = isDark ? '#1e293b' : '#f1f5f9'

  // 构建 echarts graph 数据
  const graphData: any[] = []
  const graphLinks: any[] = []

  // 中心节点
  graphData.push({
    id: 'center',
    name: '核心交换机',
    x: 400, y: 280,
    symbol: 'circle',
    symbolSize: 52,
    itemStyle: {
      color: isDark ? '#1e40af' : '#3b82f6',
      borderColor: isDark ? '#3b82f6' : '#60a5fa',
      borderWidth: 3,
      shadowBlur: 20,
      shadowColor: 'rgba(59,130,246,0.5)'
    },
    label: {
      show: true,
      formatter: '核心\n交换机',
      color: '#fff',
      fontSize: 11,
      fontWeight: 'bold',
      lineHeight: 16
    }
  })

  // 分组汇聚节点
  const groups = [
    { id: 'g-cpu', name: `计算节点\n${allCpu.length}台`, x: 180, y: 130, color: '#10b981', borderColor: '#34d399', nodes: allCpu },
    { id: 'g-gpu', name: `GPU节点\n${allGpu.length}台`, x: 620, y: 130, color: '#8b5cf6', borderColor: '#a78bfa', nodes: allGpu },
    { id: 'g-storage', name: `存储节点\n${allStorage.length}台`, x: 400, y: 460, color: '#f59e0b', borderColor: '#fbbf24', nodes: allStorage },
  ]

  groups.forEach(g => {
    graphData.push({
      id: g.id,
      name: g.name,
      x: g.x, y: g.y,
      symbol: 'roundRect',
      symbolSize: [90, 44],
      itemStyle: {
        color: g.color,
        borderColor: g.borderColor,
        borderWidth: 2,
        shadowBlur: 12,
        shadowColor: g.color + '66'
      },
      label: {
        show: true,
        formatter: g.name,
        color: '#fff',
        fontSize: 11,
        fontWeight: 'bold',
        lineHeight: 16
      }
    })
    graphLinks.push({
      source: 'center',
      target: g.id,
      lineStyle: { color: g.color, width: 2.5, curveness: 0.1, shadowBlur: 6, shadowColor: g.color + '55' }
    })

    // 各组的子节点
    const count = g.nodes.length
    const cols = Math.min(count, 6)
    const rows = Math.ceil(count / cols)
    const startX = g.x - (cols - 1) * 38 / 2
    const startY = g.y + 60

    g.nodes.forEach((node: any, i: number) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const nx = startX + col * 38
      const ny = startY + row * 38
      const color = getNodeColor(node.state)
      const nid = `node-${g.id}-${i}`

      graphData.push({
        id: nid,
        name: node.name,
        x: nx, y: ny,
        symbol: 'circle',
        symbolSize: 18,
        itemStyle: {
          color,
          borderColor: color,
          borderWidth: 1.5,
          shadowBlur: getNodeStatus(node.state) === 'running' ? 8 : 0,
          shadowColor: color + '88'
        },
        label: { show: false },
        tooltip: {
          formatter: `<b>${node.name}</b><br/>状态: ${node.state || '-'}<br/>CPU: ${Math.round(node.cpu_usage_percent || 0)}%<br/>内存: ${Math.round(node.memory_usage_percent || 0)}%`
        }
      })
      graphLinks.push({
        source: g.id,
        target: nid,
        lineStyle: { color: color + '66', width: 1, curveness: 0 }
      })
    })
  })

  // 统计
  const totalNodes = allCpu.length + allGpu.length + allStorage.length
  const runningNodes = [...allCpu, ...allGpu, ...allStorage].filter(n => getNodeStatus(n.state) === 'running').length
  const offlineNodes = [...allCpu, ...allGpu, ...allStorage].filter(n => getNodeStatus(n.state) === 'offline').length

  chart.setOption({
    backgroundColor: 'transparent',
    graphic: [
      // 图例说明
      {
        type: 'group',
        left: 16, bottom: 16,
        children: [
          { type: 'circle', shape: { r: 6 }, style: { fill: '#10b981' }, left: 0, top: 2 },
          { type: 'text', style: { text: '运行中', fill: textColor, fontSize: 11 }, left: 16, top: 0 },
          { type: 'circle', shape: { r: 6 }, style: { fill: '#3b82f6' }, left: 70, top: 2 },
          { type: 'text', style: { text: '空闲', fill: textColor, fontSize: 11 }, left: 86, top: 0 },
          { type: 'circle', shape: { r: 6 }, style: { fill: '#ef4444' }, left: 120, top: 2 },
          { type: 'text', style: { text: '离线', fill: textColor, fontSize: 11 }, left: 136, top: 0 },
        ]
      },
      // 右上角统计
      {
        type: 'group',
        right: 16, top: 16,
        children: [
          { type: 'text', style: { text: `共 ${totalNodes} 节点`, fill: textColor, fontSize: 12, fontWeight: 'bold' }, left: 0, top: 0 },
          { type: 'text', style: { text: `运行 ${runningNodes}`, fill: '#10b981', fontSize: 11 }, left: 0, top: 20 },
          { type: 'text', style: { text: `离线 ${offlineNodes}`, fill: '#ef4444', fontSize: 11 }, left: 0, top: 38 },
        ]
      }
    ],
    tooltip: {
      trigger: 'item',
      backgroundColor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.97)',
      borderColor: isDark ? '#334155' : '#e2e8f0',
      borderWidth: 1,
      textStyle: { color: isDark ? '#e2e8f0' : '#1e293b', fontSize: 12 },
      formatter: (params: any) => {
        if (params.dataType === 'node' && params.data.tooltip?.formatter) {
          return params.data.tooltip.formatter
        }
        return params.data.name || ''
      }
    },
    series: [{
      type: 'graph',
      layout: 'none',
      data: graphData,
      links: graphLinks,
      roam: true,
      draggable: false,
      lineStyle: { curveness: 0.1 },
      emphasis: {
        focus: 'adjacency',
        itemStyle: { borderWidth: 3, shadowBlur: 20 }
      },
      animation: true,
      animationDuration: 800,
      animationEasing: 'cubicOut'
    }]
  }, true)
}

const initChart = () => {
  if (!chartEl.value) return
  chart = echarts.init(chartEl.value)
  updateChart()
  window.addEventListener('resize', () => chart?.resize())
}

watch(() => [props.nodes, props.isDark], () => updateChart(), { deep: true })

onMounted(() => initChart())
onUnmounted(() => {
  chart?.dispose()
  window.removeEventListener('resize', () => chart?.resize())
})
</script>

<style scoped>
.cluster-topo {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 400px;
  border-radius: 12px;
  overflow: hidden;
  background: #0f172a;
  background-image:
    radial-gradient(circle at 20% 25%, rgba(59,130,246,0.12) 0%, transparent 45%),
    radial-gradient(circle at 80% 75%, rgba(139,92,246,0.10) 0%, transparent 45%),
    repeating-linear-gradient(0deg, transparent, transparent 28px, rgba(59,130,246,0.04) 28px, rgba(59,130,246,0.04) 29px),
    repeating-linear-gradient(90deg, transparent, transparent 28px, rgba(59,130,246,0.04) 28px, rgba(59,130,246,0.04) 29px);
}

.cluster-topo.light {
  background: #f8fafc;
  background-image:
    radial-gradient(circle at 20% 25%, rgba(59,130,246,0.06) 0%, transparent 45%),
    radial-gradient(circle at 80% 75%, rgba(139,92,246,0.05) 0%, transparent 45%),
    repeating-linear-gradient(0deg, transparent, transparent 28px, rgba(59,130,246,0.04) 28px, rgba(59,130,246,0.04) 29px),
    repeating-linear-gradient(90deg, transparent, transparent 28px, rgba(59,130,246,0.04) 28px, rgba(59,130,246,0.04) 29px);
}

.chart-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
