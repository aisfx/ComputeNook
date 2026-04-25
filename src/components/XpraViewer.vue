<template>
  <div class="xpra-viewer" ref="containerEl">
    <canvas ref="canvasEl" class="xpra-canvas"
      @mousemove="onMouseMove" @mousedown="onMouseDown" @mouseup="onMouseUp"
      @wheel.prevent="onWheel" @contextmenu.prevent
      @keydown="onKeyDown" @keyup="onKeyUp"
      tabindex="0" />
    <div v-if="status !== 'connected'" class="xpra-overlay">
      <div v-if="status === 'connecting'" class="xpra-msg">
        <div class="xpra-spinner"></div>
        <span>正在连接...</span>
      </div>
      <div v-else-if="status === 'error'" class="xpra-msg xpra-error">
        <span>⚠️ {{ errorMsg }}</span>
        <button @click="connect">重试</button>
      </div>
      <div v-else-if="status === 'disconnected'" class="xpra-msg">
        <span>已断开连接</span>
        <button @click="connect">重新连接</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
// @ts-ignore
import { XpraClient } from 'xpra-html5-client'

// 内联必要类型，避免包 exports 路径问题
interface XpraWindow { wid: number; x: number; y: number; w: number; h: number; [k: string]: any }
interface XpraDraw { wid: number; x: number; y: number; w: number; h: number; packetSequence: number; [k: string]: any }
interface XpraWindowMoveResize { wid: number; x: number; y: number; w: number; h: number }

const props = defineProps<{
  wsUrl: string       // ws(s)://host:port/path
  password?: string
}>()

const containerEl = ref<HTMLDivElement>()
const canvasEl = ref<HTMLCanvasElement>()
const status = ref<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting')
const errorMsg = ref('')

let client: XpraClient | null = null
let ctx: CanvasRenderingContext2D | null = null

// 窗口位置映射 wid -> {x,y,w,h}
const windows = new Map<number, { x: number; y: number; w: number; h: number }>()
let activeWid = 0

function getCanvas() {
  return canvasEl.value!
}

function resizeCanvas() {
  const c = getCanvas()
  const el = containerEl.value!
  c.width = el.clientWidth
  c.height = el.clientHeight
}

async function connect() {
  if (client) {
    client.disconnect()
    client.removeAllListeners()
  }

  status.value = 'connecting'
  errorMsg.value = ''

  const c = getCanvas()
  ctx = c.getContext('2d')!
  resizeCanvas()

  client = new XpraClient({})
  await client.init()

  client.on('connect', () => { status.value = 'connected' })
  client.on('disconnect', () => { status.value = 'disconnected' })
  client.on('error', (msg: string) => { status.value = 'error'; errorMsg.value = msg })

  client.on('newWindow', (win: XpraWindow) => {
    windows.set(win.wid, { x: win.x, y: win.y, w: win.w, h: win.h })
    if (!activeWid) activeWid = win.wid
    client!.sendMapWindow(win)
  })

  client.on('removeWindow', (wid: number) => {
    windows.delete(wid)
    if (activeWid === wid) activeWid = [...windows.keys()][0] || 0
  })

  client.on('moveResizeWindow', (data: XpraWindowMoveResize) => {
    const w = windows.get(data.wid)
    if (w) Object.assign(w, { x: data.x, y: data.y, w: data.w, h: data.h })
  })

  // 画面渲染
  client.on('drawBuffer', (draw: XpraDraw, bitmap: ImageBitmap | null) => {
    if (!ctx || !bitmap) return
    const win = windows.get(draw.wid)
    const ox = win?.x ?? 0
    const oy = win?.y ?? 0
    ctx.drawImage(bitmap, ox + draw.x, oy + draw.y, draw.w, draw.h)
    client!.sendDamageSequence(draw.packetSequence, draw.wid, [draw.w, draw.h], 0)
  })

  // 解析 wsUrl
  const url = new URL(props.wsUrl)
  const ssl = url.protocol === 'wss:'
  const host = `${url.protocol}//${url.host}${url.pathname}${url.search}`

  client.connect(host, {
    ssl,
    password: props.password || '',
    shareSession: true,
    username: '',
  })
}

// 鼠标事件
function canvasPos(e: MouseEvent): [number, number] {
  const r = getCanvas().getBoundingClientRect()
  const win = windows.get(activeWid)
  return [Math.round(e.clientX - r.left - (win?.x ?? 0)), Math.round(e.clientY - r.top - (win?.y ?? 0))]
}

function onMouseMove(e: MouseEvent) {
  if (!client || !activeWid) return
  client.sendMouseMove(activeWid, canvasPos(e), [])
}

function onMouseDown(e: MouseEvent) {
  if (!client || !activeWid) return
  getCanvas().focus()
  client.sendMouseButton(activeWid, canvasPos(e), e.button + 1, true, [])
}

function onMouseUp(e: MouseEvent) {
  if (!client || !activeWid) return
  client.sendMouseButton(activeWid, canvasPos(e), e.button + 1, false, [])
}

function onWheel(e: WheelEvent) {
  if (!client || !activeWid) return
  const btn = e.deltaY > 0 ? 5 : 4
  const pos = canvasPos(e)
  client.sendMouseButton(activeWid, pos, btn, true, [])
  client.sendMouseButton(activeWid, pos, btn, false, [])
}

function onKeyDown(e: KeyboardEvent) {
  if (!client || !activeWid) return
  e.preventDefault()
  client.sendKeyAction(activeWid, e.key, true, [], e.key, e.keyCode, 0)
}

function onKeyUp(e: KeyboardEvent) {
  if (!client || !activeWid) return
  e.preventDefault()
  client.sendKeyAction(activeWid, e.key, false, [], e.key, e.keyCode, 0)
}

const ro = new ResizeObserver(() => {
  resizeCanvas()
  if (client && activeWid) {
    const c = getCanvas()
    client.sendResize(c.width, c.height)
  }
})

onMounted(() => {
  ro.observe(containerEl.value!)
  connect()
})

onUnmounted(() => {
  ro.disconnect()
  client?.disconnect()
})

watch(() => props.wsUrl, connect)
</script>

<style scoped>
.xpra-viewer { position: relative; width: 100%; height: 100%; background: #000; overflow: hidden; }
.xpra-canvas { display: block; width: 100%; height: 100%; cursor: default; outline: none; }
.xpra-overlay {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.6);
}
.xpra-msg {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  color: #fff; font-size: 0.95rem;
}
.xpra-error { color: #fca5a5; }
.xpra-msg button {
  padding: 6px 18px; background: #667eea; color: #fff; border: none;
  border-radius: 6px; cursor: pointer; font-size: 0.85rem;
}
.xpra-spinner {
  width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.3);
  border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
