<template>
  <div class="xpra-viewer" ref="containerEl">
    <div v-if="status !== 'connected'" class="xpra-overlay">
      <div v-if="status === 'connecting'" class="xpra-msg">
        <div class="xpra-spinner"></div>
        <span>正在连接...</span>
      </div>
      <div v-else-if="status === 'error'" class="xpra-msg xpra-error">
        <span>⚠️ {{ errorMsg }}</span>
        <button @click="load">重试</button>
      </div>
    </div>
    <!-- Use Xpra's built-in HTML5 client via the backend HTTP proxy -->
    <iframe
      v-if="iframeUrl"
      ref="iframeEl"
      :src="iframeUrl"
      class="xpra-frame"
      allow="autoplay; clipboard-read; clipboard-write"
      @load="onIframeLoad"
      @error="onIframeError"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  wsUrl: string       // ws(s)://host:port/path  — used to derive session id
  password?: string
}>()

const containerEl = ref<HTMLDivElement>()
const iframeEl = ref<HTMLIFrameElement>()
const status = ref<'connecting' | 'connected' | 'error'>('connecting')
const errorMsg = ref('')
const iframeUrl = ref('')

// Derive the HTTP proxy URL from the wsUrl.
// wsUrl format: ws://host:port/api/desktop/sessions/{id}/xpra-ws?token=xxx
// iframe proxy:  http://host:port/api/desktop/sessions/{id}/xpra-html/?token=xxx
function buildIframeUrl(wsUrl: string): string {
  if (!wsUrl) return ''
  try {
    const u = new URL(wsUrl)
    const proto = u.protocol === 'wss:' ? 'https:' : 'http:'
    // replace /xpra-ws with /xpra-html/
    const path = u.pathname.replace(/\/xpra-ws$/, '/xpra-html/')
    return `${proto}//${u.host}${path}${u.search}`
  } catch {
    return ''
  }
}

function load() {
  status.value = 'connecting'
  errorMsg.value = ''
  iframeUrl.value = buildIframeUrl(props.wsUrl)
}

function onIframeLoad() {
  status.value = 'connected'
}

function onIframeError() {
  status.value = 'error'
  errorMsg.value = '无法加载 Xpra 界面'
}

onMounted(load)
watch(() => props.wsUrl, load)
</script>

<style scoped>
.xpra-viewer { position: relative; width: 100%; height: 100%; background: #000; overflow: hidden; }
.xpra-frame { display: block; width: 100%; height: 100%; border: none; background: #000; }
.xpra-overlay {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.7); z-index: 1;
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
