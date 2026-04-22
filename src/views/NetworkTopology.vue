<template>
  <div class="topo-page">
    <div class="topo-toolbar">
      <div class="topo-legend">
        <span class="leg-item"><span class="leg-dot dot-compute"></span>计算节点</span>
        <span class="leg-item"><span class="leg-dot dot-gpu"></span>GPU节点</span>
        <span class="leg-item"><span class="leg-dot dot-switch"></span>交换机</span>
        <span class="leg-item"><span class="leg-dot dot-storage"></span>存储</span>
        <span class="leg-item"><span class="leg-dot dot-router"></span>路由器</span>
        <span class="leg-sep"></span>
        <span class="leg-item"><span class="leg-dot dot-up"></span>正常</span>
        <span class="leg-item"><span class="leg-dot dot-latency"></span>延迟</span>
        <span class="leg-item"><span class="leg-dot dot-dn"></span>离线</span>
      </div>
      <div class="topo-toolbar-right">
        <button class="btn-sec" :class="{active:linkMode}" @click="toggleLinkMode">{{ linkMode ? "连线中..." : "手动连线" }}</button>
        <button class="btn-sec" @click="clearLinks" :disabled="edges.length===0">清空连线</button>
        <button class="btn-sec" @click="loadData" :disabled="loading">{{ loading?"加载中...":"刷新" }}</button>
        <button class="btn-sec" @click="resetView">重置视图</button>
      </div>
    </div>
    <div v-if="error" class="topo-err">{{ error }}</div>
    <div class="topo-canvas-wrap" ref="wrapRef">
      <svg ref="svgRef" class="topo-svg"
        @wheel.prevent="onWheel"
        @mousedown="onSvgMouseDown"
        @mousemove="onSvgMouseMove"
        @mouseup="onSvgMouseUp"
        @mouseleave="onSvgMouseUp">
        <defs>
          <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
          </marker>
        </defs>
        <g :transform="`translate(${pan.x},${pan.y}) scale(${zoom})`">
          <line v-for="e in edges" :key="e.id"
            :x1="nodeById[e.from] ? nodeById[e.from].x : 0"
            :y1="nodeById[e.from] ? nodeById[e.from].y : 0"
            :x2="nodeById[e.to] ? nodeById[e.to].x : 0"
            :y2="nodeById[e.to] ? nodeById[e.to].y : 0"
            :stroke="edgeColor(e)" stroke-width="2" stroke-opacity="0.75"
            marker-end="url(#arr)"
            class="topo-edge" @click.stop="removeEdge(e.id)" />
          <g v-for="n in topoNodes" :key="n.id"
            :transform="`translate(${n.x},${n.y})`"
            @mousedown.stop="startDrag($event,n)"
            @click.stop="onNodeClick(n)"
            :class="[linkMode ? `link-cursor` : `drag-cursor`, linkSrc===n.id ? `link-src` : ``, selected && selected.id===n.id ? `node-sel` : ``]">
            <circle :r="n.r" :fill="nodeFill(n)" :stroke="nodeStroke(n)" stroke-width="2.5" />
            <text v-if="n.promHealth" text-anchor="middle" y="5" font-size="9" fill="#fff" font-weight="700" style="pointer-events:none">{{ n.promHealth === `up` ? `UP` : `DN` }}</text>
            <text text-anchor="middle" :y="n.r+14" font-size="11" :fill="labelColor(n)" style="pointer-events:none;user-select:none;font-family:system-ui">{{ n.label }}</text>
          </g>
        </g>
      </svg>
      <div v-if="selected" class="topo-tooltip">
        <button class="tt-close" @click="selected=null">x</button>
        <div class="tt-name">{{ selected.label }}</div>
        <div class="tt-row"><span>类型</span><span>{{ typeLabel(selected.type) }}</span></div>
        <div class="tt-row" v-if="selected.model"><span>型号</span><span>{{ selected.model }}</span></div>
        <div class="tt-row" v-if="selected.ip"><span>IP</span><span class="mono">{{ selected.ip }}</span></div>
        <div class="tt-row" v-if="selected.promHealth">
          <span>监控</span>
          <span :class="[`tt-health`, `health-`+selected.promHealth]">{{ healthLabel(selected.promHealth) }}</span>
        </div>
        <div class="tt-row" v-if="selected.latency"><span>延迟</span><span>{{ selected.latency }}ms</span></div>
        <div class="tt-row" v-if="selected.cpu!=null"><span>CPU</span><span>{{ selected.cpu }}%</span></div>
        <div class="tt-row" v-if="selected.mem!=null"><span>内存</span><span>{{ selected.mem }}%</span></div>
        <div class="tt-row" v-if="selected.promError" style="color:#ef4444"><span>错误</span><span>{{ selected.promError }}</span></div>
        <div class="tt-actions"><button class="tt-btn-del" @click="removeNode(selected.id)">删除节点</button></div>
      </div>
      <div v-if="linkMode" class="link-hint">{{ linkSrc ? "再点击目标节点完成连线，Esc取消" : "点击源节点开始连线" }}</div>
      <div v-if="loading" class="topo-loading"><div class="spin"></div><span>加载中...</span></div>
      <div v-if="!loading&&topoNodes.length===0&&!error" class="topo-empty">暂无设备，点击「添加设备」或先在机柜管理中录入设备</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { getApiBase } from '../utils/auth'

interface TopoNode {
  id: string; label: string; type: string; model: string; ip: string
  promHealth: string; promError: string; latency: number | null
  cpu: number | null; mem: number | null
  x: number; y: number; r: number
}
interface Edge { id: string; from: string; to: string; dashed: boolean }

const STORAGE_KEY = 'topo-v2'
const wrapRef = ref<HTMLElement | null>(null)
const svgRef = ref<SVGSVGElement | null>(null)
const loading = ref(false)
const error = ref('')
const topoNodes = ref<TopoNode[]>([])
const edges = ref<Edge[]>([])
const selected = ref<TopoNode | null>(null)
const zoom = ref(1)
const pan = ref({ x: 60, y: 60 })
const linkMode = ref(false)
const linkSrc = ref('')

let dragging: TopoNode | null = null
let dragOffX = 0, dragOffY = 0
let panning = false, panStart = { x: 0, y: 0 }

const token = () => localStorage.getItem('token') || sessionStorage.getItem('token') || ''

const nodeById = computed(() => Object.fromEntries(topoNodes.value.map(n => [n.id, n])))

const COLORS: Record<string, { fill: string; stroke: string }> = {
  compute: { fill: '#dbeafe', stroke: '#3b82f6' },
  gpu: { fill: '#ede9fe', stroke: '#8b5cf6' },
  switch: { fill: '#e2e8f0', stroke: '#475569' },
  storage: { fill: '#d1fae5', stroke: '#10b981' },
  router: { fill: '#fce7f3', stroke: '#ec4899' },
  firewall: { fill: '#fee2e2', stroke: '#ef4444' },
}

const HEALTH_STROKE: Record<string, string> = {
  up: '#22c55e',
  warn: '#f59e0b',
  down: '#ef4444',
  unknown: '#94a3b8',
}

function nodeFill(n: TopoNode) {
  if (n.promHealth === 'down') return '#f3f4f6'
  return COLORS[n.type]?.fill || '#f1f5f9'
}
function nodeStroke(n: TopoNode) {
  if (n.promHealth && n.promHealth !== 'unknown') return HEALTH_STROKE[n.promHealth] || COLORS[n.type]?.stroke || '#94a3b8'
  return COLORS[n.type]?.stroke || '#94a3b8'
}
function labelColor(n: TopoNode) { return n.promHealth === 'down' ? '#9ca3af' : '#1e293b' }
function edgeColor(e: Edge) {
  const from = nodeById.value[e.from]
  const to = nodeById.value[e.to]
  if (!from || !to) return '#94a3b8'
  if (from.promHealth === 'down' || to.promHealth === 'down') return '#ef4444'
  if (from.promHealth === 'warn' || to.promHealth === 'warn') return '#f59e0b'
  if (from.promHealth === 'up' && to.promHealth === 'up') return '#22c55e'
  return '#94a3b8'
}
const typeLabel = (t: string) => ({ switch: '交换机', compute: '计算节点', gpu: 'GPU节点', storage: '存储', router: '路由器', firewall: '防火墙' }[t] || t)
const healthLabel = (h: string) => ({ up: '正常', warn: '延迟', down: '离线', unknown: '未知' }[h] || h)

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes: topoNodes.value, edges: edges.value }))
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (d?.nodes) { topoNodes.value = d.nodes; edges.value = d.edges || [] }
  } catch {}
}

const loadData = async () => {
  loading.value = true; error.value = ''
  try {
    const [rRes, tRes] = await Promise.allSettled([
      fetch(getApiBase() + '/api/monitoring/rack', { headers: { Authorization: 'Bearer ' + token() } }),
      fetch(getApiBase() + '/api/monitoring/prom-targets', { headers: { Authorization: 'Bearer ' + token() } }),
    ])
    const racks = rRes.status === 'fulfilled' && rRes.value.ok ? (await rRes.value.json()).data || [] : []
    const targetsData = tRes.status === 'fulfilled' && tRes.value.ok ? await tRes.value.json() : { targets: [] }
    const targets: any[] = targetsData.targets || []

    const healthMap: Record<string, { health: string; error: string; latency: number | null }> = {}
    for (const t of targets) {
      const key = (t.instance || '').replace(/:\d+$/, '')
      const latency = t.last_scrape ? Math.round(parseFloat(t.last_scrape) * 1000) : null
      const health = t.health === 'up' ? (latency && latency > 500 ? 'warn' : 'up') : t.health === 'down' ? 'down' : 'unknown'
      healthMap[key] = { health, error: t.last_error || '', latency }
      if (t.labels?.hostname) healthMap[t.labels.hostname] = healthMap[key]
    }

    const newNodes: TopoNode[] = []
    for (const rack of racks) {
      for (const dev of (rack.devices || [])) {
        if (dev.type === 'empty' || dev.type === 'pdu') continue
        const hk = (dev.ip || dev.name || '').replace(/:\d+$/, '')
        const h = healthMap[hk] || healthMap[dev.name] || { health: 'unknown', error: '', latency: null }
        const prev = topoNodes.value.find(n => n.id === dev.id)
        newNodes.push({
          id: dev.id, label: dev.name, type: dev.type, model: dev.model || '',
          ip: dev.ip || '', promHealth: h.health, promError: h.error, latency: h.latency,
          cpu: null, mem: null,
          x: prev?.x ?? (Math.random() * 600 + 100),
          y: prev?.y ?? (Math.random() * 400 + 80),
          r: dev.type === 'switch' ? 24 : 18,
        })
      }
    }
    topoNodes.value = newNodes
    save()
  } catch (e: any) { error.value = e.message }
  finally { loading.value = false }
}

function removeNode(id: string) {
  topoNodes.value = topoNodes.value.filter(n => n.id !== id)
  edges.value = edges.value.filter(e => e.from !== id && e.to !== id)
  selected.value = null
  save()
}

function toggleLinkMode() {
  linkMode.value = !linkMode.value
  linkSrc.value = ''
}

function onNodeClick(n: TopoNode) {
  if (!linkMode.value) { selected.value = n; return }
  if (!linkSrc.value) { linkSrc.value = n.id; return }
  if (linkSrc.value === n.id) { linkSrc.value = ''; return }
  const exists = edges.value.find(e => (e.from === linkSrc.value && e.to === n.id) || (e.from === n.id && e.to === linkSrc.value))
  if (!exists) {
    edges.value.push({ id: 'e-' + Date.now(), from: linkSrc.value, to: n.id, dashed: false })
    save()
  }
  linkSrc.value = ''
}

function removeEdge(id: string) {
  if (!confirm('删除该连线？')) return
  edges.value = edges.value.filter(e => e.id !== id)
  save()
}

function clearLinks() {
  if (!confirm('清空所有连线？')) return
  edges.value = []
  save()
}

function startDrag(e: MouseEvent, n: TopoNode) {
  if (linkMode.value) return
  dragging = n
  const r = svgRef.value!.getBoundingClientRect()
  dragOffX = (e.clientX - r.left) / zoom.value - pan.value.x / zoom.value - n.x
  dragOffY = (e.clientY - r.top) / zoom.value - pan.value.y / zoom.value - n.y
}
function onSvgMouseDown(e: MouseEvent) {
  const t = e.target as SVGElement
  if (t === svgRef.value || t.tagName === 'svg' || t.tagName === 'line') {
    panning = true; panStart = { x: e.clientX - pan.value.x, y: e.clientY - pan.value.y }
  }
}
function onSvgMouseMove(e: MouseEvent) {
  if (dragging) {
    const r = svgRef.value!.getBoundingClientRect()
    dragging.x = (e.clientX - r.left - pan.value.x) / zoom.value - dragOffX
    dragging.y = (e.clientY - r.top - pan.value.y) / zoom.value - dragOffY
  } else if (panning) {
    pan.value = { x: e.clientX - panStart.x, y: e.clientY - panStart.y }
  }
}
function onSvgMouseUp() { if (dragging) save(); dragging = null; panning = false }
function onWheel(e: WheelEvent) { zoom.value = Math.min(3, Math.max(0.15, zoom.value * (e.deltaY > 0 ? 0.9 : 1.1))) }
function resetView() { zoom.value = 1; pan.value = { x: 60, y: 60 } }

function onKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') { linkMode.value = false; linkSrc.value = '' } }

let refreshTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  load()
  loadData()
  window.addEventListener('keydown', onKeyDown)
  refreshTimer = setInterval(loadData, 30000)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>
<style scoped>
.topo-page{display:flex;flex-direction:column;height:100%;gap:0.6rem;overflow:hidden}
.topo-toolbar{display:flex;justify-content:space-between;align-items:center;flex-shrink:0;gap:1rem;flex-wrap:wrap}
.topo-toolbar-right{display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap}
.topo-legend{display:flex;gap:0.6rem;flex-wrap:wrap;font-size:0.75rem;color:#6b7280;align-items:center}
.leg-item{display:flex;align-items:center;gap:0.25rem}
.leg-dot{width:10px;height:10px;border-radius:50%;border:1.5px solid rgba(0,0,0,.12)}
.leg-sep{width:1px;height:14px;background:#e2e8f0;margin:0 4px}
.dot-compute{background:#dbeafe;border-color:#93c5fd}
.dot-gpu{background:#ede9fe;border-color:#c4b5fd}
.dot-switch{background:#e2e8f0;border-color:#64748b}
.dot-storage{background:#d1fae5;border-color:#6ee7b7}
.dot-router{background:#fce7f3;border-color:#ec4899}
.dot-up{background:#22c55e;border-color:#16a34a}
.dot-latency{background:#f59e0b;border-color:#d97706}
.dot-dn{background:#ef4444;border-color:#dc2626}
.btn-sec{padding:5px 11px;border:1px solid #e2e8f0;border-radius:6px;font-size:0.8rem;background:#fff;cursor:pointer;transition:all 0.15s;white-space:nowrap}
.btn-sec:hover:not(:disabled){background:#f1f5f9}
.btn-sec:disabled{opacity:0.45;cursor:not-allowed}
.btn-sec.active{background:#eff6ff;border-color:#93c5fd;color:#1d4ed8;font-weight:600}
.btn-pri{padding:5px 14px;border:none;border-radius:6px;font-size:0.8rem;background:#3b82f6;color:#fff;cursor:pointer;font-weight:600}
.btn-pri:hover:not(:disabled){opacity:0.88}
.btn-pri:disabled{opacity:0.4;cursor:not-allowed}
.topo-err{color:#ef4444;font-size:0.8rem;flex-shrink:0}
.topo-canvas-wrap{flex:1;position:relative;overflow:hidden;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;min-height:0}
.topo-svg{width:100%;height:100%;display:block}
.topo-edge{cursor:pointer;transition:stroke-width 0.15s}
.topo-edge:hover{stroke-width:4 !important}
.drag-cursor{cursor:grab}
.drag-cursor:active{cursor:grabbing}
.link-cursor{cursor:crosshair}
.link-src circle{stroke-width:4 !important;filter:drop-shadow(0 0 6px #6366f1)}
.node-sel circle{stroke-width:4 !important}
.topo-tooltip{position:absolute;top:12px;right:12px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;min-width:190px;box-shadow:0 4px 20px rgba(0,0,0,.1);z-index:10}
.tt-close{position:absolute;top:8px;right:8px;background:none;border:none;cursor:pointer;color:#94a3b8;font-size:14px;padding:2px 5px}
.tt-close:hover{color:#374151}
.tt-name{font-weight:700;font-size:0.9rem;color:#1e293b;margin-bottom:8px;padding-right:20px}
.tt-row{display:flex;justify-content:space-between;font-size:0.78rem;padding:2px 0;color:#64748b;gap:8px}
.tt-row span:last-child{color:#1e293b;font-weight:500;text-align:right}
.tt-health{padding:1px 7px;border-radius:4px;font-size:0.72rem;font-weight:600}
.health-up{background:#dcfce7;color:#166534}
.health-warn{background:#fef9c3;color:#854d0e}
.health-down{background:#fee2e2;color:#991b1b}
.health-unknown{background:#f1f5f9;color:#64748b}
.mono{font-family:monospace;font-size:0.75rem}
.tt-actions{margin-top:10px;padding-top:8px;border-top:1px solid #f1f5f9}
.tt-btn-del{padding:3px 10px;border:1px solid #fca5a5;border-radius:5px;background:#fff;color:#ef4444;font-size:0.75rem;cursor:pointer}
.tt-btn-del:hover{background:#fee2e2}
.link-hint{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);background:rgba(99,102,241,0.9);color:#fff;padding:6px 16px;border-radius:20px;font-size:0.8rem;pointer-events:none}
.topo-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:0.75rem;background:rgba(248,250,252,0.85);font-size:0.875rem;color:#64748b}
.spin{width:20px;height:20px;border:2px solid #e2e8f0;border-top-color:#6366f1;border-radius:50%;animation:spin 0.7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.topo-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:0.875rem;text-align:center;padding:2rem}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:1000}
.add-modal{background:#fff;border-radius:12px;width:380px;display:flex;flex-direction:column}
.add-modal-hd{display:flex;justify-content:space-between;align-items:center;padding:1rem 1.25rem;border-bottom:1px solid #e5e7eb;font-weight:600}
.x-btn{background:none;border:none;font-size:1.2rem;cursor:pointer;color:#9ca3af}
.add-modal-bd{padding:1.25rem;display:flex;flex-direction:column;gap:0.75rem}
.add-modal-ft{display:flex;justify-content:flex-end;gap:0.5rem;padding:0.75rem 1.25rem;border-top:1px solid #e5e7eb}
.fg{display:flex;flex-direction:column;gap:0.3rem}
.fg label{font-size:0.8rem;font-weight:600;color:#374151}
.fg input,.fg select{padding:0.45rem 0.65rem;border:1.5px solid #e5e7eb;border-radius:7px;font-size:0.85rem}
.fg input:focus,.fg select:focus{outline:none;border-color:#6366f1}
</style>