<template>
  <div class="diag-page">
    <!-- 顶部快照摘要区 -->
    <div class="diag-header">
      <div class="snapshot-cards" v-if="snapshot">
        <div class="snap-card">
          <div class="snap-val">{{ snapshot.stats.totalNodes }}</div>
          <div class="snap-label">总节点</div>
        </div>
        <div class="snap-card snap-ok">
          <div class="snap-val">{{ snapshot.stats.onlineNodes }}</div>
          <div class="snap-label">在线</div>
        </div>
        <div class="snap-card" :class="snapshot.stats.downNodes > 0 ? 'snap-err' : 'snap-ok'">
          <div class="snap-val">{{ snapshot.stats.downNodes }}</div>
          <div class="snap-label">离线</div>
        </div>
        <div class="snap-card" :class="snapshot.stats.cpuUsage > 90 ? 'snap-err' : snapshot.stats.cpuUsage > 70 ? 'snap-warn' : ''">
          <div class="snap-val">{{ snapshot.stats.cpuUsage.toFixed(1) }}%</div>
          <div class="snap-label">CPU</div>
        </div>
        <div class="snap-card" :class="snapshot.stats.memUsage > 90 ? 'snap-err' : snapshot.stats.memUsage > 70 ? 'snap-warn' : ''">
          <div class="snap-val">{{ snapshot.stats.memUsage.toFixed(1) }}%</div>
          <div class="snap-label">内存</div>
        </div>
        <div class="snap-card" :class="snapshot.alerts.length > 0 ? 'snap-err' : 'snap-ok'">
          <div class="snap-val">{{ snapshot.alerts.length }}</div>
          <div class="snap-label">活跃告警</div>
        </div>
        <div class="snap-card">
          <div class="snap-val">{{ snapshot.stats.allocGPUs }}/{{ snapshot.stats.totalGPUs }}</div>
          <div class="snap-label">GPU</div>
        </div>
      </div>
      <div class="snapshot-meta" v-if="snapshot">
        <span :class="['prom-dot', snapshot.promConnected ? 'dot-ok' : 'dot-na']"></span>
        <span class="snap-time">{{ snapshot.promConnected ? 'Prometheus 已连接' : 'Prometheus 未连接' }}  快照时间 {{ snapshot.fetchedAt }}</span>
        <button class="btn-refresh" @click="loadSnapshot" :disabled="snapshotLoading">
          {{ snapshotLoading ? '采集中...' : '刷新上下文' }}
        </button>
      </div>
      <div v-if="snapshotLoading && !snapshot" class="snap-loading">正在采集集群数据...</div>
      <div v-if="snapshotError" class="snap-error">{{ snapshotError }}</div>
    </div>

    <!-- 快捷诊断按钮 -->
    <div class="quick-actions">
      <button v-for="qa in QUICK_ACTIONS" :key="qa.label"
        class="qa-btn" @click="sendQuick(qa.prompt)" :disabled="chatLoading || snapshotLoading">
        {{ qa.label }}
      </button>
    </div>

    <!-- 对话区 -->
    <div class="chat-area">
      <div class="chat-messages" ref="messagesEl">
        <div v-if="messages.length === 0" class="chat-empty">
          <div class="chat-empty-icon">📡</div>
          <div class="chat-empty-text">Prometheus 监控数据已就绪。点击快捷按钮开始分析，或直接描述你观察到的异常现象。</div>
        </div>
        <div v-for="(msg, i) in messages" :key="i" :class="['msg', 'msg-' + msg.role]">
          <div class="msg-avatar">{{ msg.role === 'user' ? '' : '' }}</div>
          <div class="msg-bubble">
            <div class="msg-content" v-html="renderContent(msg.content)"></div>
            <div class="msg-time">{{ msg.time }}</div>
          </div>
        </div>
        <div v-if="chatLoading" class="msg msg-assistant">
          <div class="msg-avatar"></div>
          <div class="msg-bubble">
            <div class="typing"><span></span><span></span><span></span></div>
          </div>
        </div>
      </div>

      <div class="chat-toolbar">
        <button class="btn-clear" @click="clearMessages" :disabled="messages.length === 0">清空对话</button>
      </div>

      <div class="chat-input-row">
        <textarea ref="inputEl" v-model="inputText" class="chat-input"
          placeholder="描述观察到的异常现象，或询问监控数据分析... (Enter 发送，Shift+Enter 换行)"
          rows="2"
          @keydown.enter.exact.prevent="send(inputText)"
          @keydown.enter.shift.exact="inputText += '\n'"
          @input="autoResize"
          :disabled="chatLoading || snapshotLoading">
        </textarea>
        <button class="btn-send" @click="send(inputText)"
          :disabled="chatLoading || snapshotLoading || !inputText.trim()">
          {{ chatLoading ? '' : '发送' }}
        </button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { getApiBase, getToken } from '../utils/auth'
import { fetchSnapshot, buildSystemPrompt, type ClusterSnapshot } from '../utils/diagnostics'

interface Message { role: 'user' | 'assistant'; content: string; time: string }

const QUICK_ACTIONS = [
  { label: '🔴 分析活跃告警', prompt: '请分析当前所有活跃告警的根因，判断严重程度和影响范围' },
  { label: '📴 离线节点分析', prompt: '请根据监控数据分析离线节点的可能原因，评估对集群的影响' },
  { label: '📊 性能瓶颈识别', prompt: '请根据 Prometheus 实时指标，识别当前集群的性能瓶颈节点和资源异常' },
  { label: '🌡️ 高负载节点', prompt: '请分析 CPU 或内存使用率异常高的节点，判断是否存在资源争用或泄漏' },
  { label: '🔍 集群健康评估', prompt: '请基于当前所有监控数据，给出集群整体健康状态评分和需要关注的风险点' },
]

const snapshot = ref<ClusterSnapshot | null>(null)
const snapshotLoading = ref(false)
const snapshotError = ref('')
const messages = ref<Message[]>([])
const chatLoading = ref(false)
const inputText = ref('')
const messagesEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)

const token = () => getToken() || ''
const now = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

async function loadSnapshot() {
  snapshotLoading.value = true
  snapshotError.value = ''
  try {
    snapshot.value = await fetchSnapshot()
  } catch (e: any) {
    snapshotError.value = 'Failed to collect cluster data: ' + e.message
  } finally {
    snapshotLoading.value = false
  }
}

async function send(text: string) {
  const t = text.trim()
  if (!t || chatLoading.value) return
  inputText.value = ''
  if (inputEl.value) inputEl.value.style.height = 'auto'
  messages.value.push({ role: 'user', content: t, time: now() })
  chatLoading.value = true
  scrollToBottom()
  try {
    const history = messages.value.slice(-10).map(m => ({ role: m.role, content: m.content }))
    const systemContent = snapshot.value ? buildSystemPrompt(snapshot.value) : '你是一个专业的 HPC 集群监控分析 AI，专注于基于 Prometheus 实时数据进行性能诊断、告警分析和基础设施健康评估，请用中文回答。'
    const res = await fetch(getApiBase() + '/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ messages: [{ role: 'system', content: systemContent }, ...history] }),
    })
    if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error(err.error || 'Request failed') }
    const data = await res.json()
    messages.value.push({ role: 'assistant', content: data.content || 'No response', time: now() })
  } catch (e: any) {
    messages.value.push({ role: 'assistant', content: 'Error: ' + e.message, time: now() })
  } finally {
    chatLoading.value = false
    scrollToBottom()
  }
}

function sendQuick(prompt: string) { inputText.value = prompt; send(prompt) }
function clearMessages() { messages.value = [] }
function scrollToBottom() { nextTick(() => { if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight }) }
function autoResize() { if (!inputEl.value) return; inputEl.value.style.height = 'auto'; inputEl.value.style.height = Math.min(inputEl.value.scrollHeight, 140) + 'px' }

function renderContent(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return escaped
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, lang, code) => {
      const id = 'cb-' + Math.random().toString(36).slice(2, 8)
      return `<div class="code-block"><div class="code-header"><span class="code-lang">${lang || 'code'}</span><button class="copy-btn" onclick="(function(){var el=document.getElementById('${id}');navigator.clipboard.writeText(el.innerText).then(function(){var b=el.parentElement.querySelector('.copy-btn');b.textContent='Copied';setTimeout(function(){b.textContent='Copy'},1500)})})()">Copy</button></div><pre id="${id}"><code>${code.trim()}</code></pre></div>`
    })
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}

onMounted(() => loadSnapshot())
</script>
<style scoped>
.diag-page { display:flex; flex-direction:column; height:100%; gap:0.75rem; overflow:hidden; }

/* snapshot header */
.diag-header { flex-shrink:0; display:flex; flex-direction:column; gap:0.5rem; }
.snapshot-cards { display:flex; gap:0.5rem; flex-wrap:wrap; }
.snap-card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.5rem 0.9rem; text-align:center; min-width:72px; }
.snap-card.snap-ok { border-color:#86efac; background:#f0fdf4; }
.snap-card.snap-warn { border-color:#fcd34d; background:#fffbeb; }
.snap-card.snap-err { border-color:#fca5a5; background:#fef2f2; }
.snap-val { font-size:1.1rem; font-weight:700; color:#1e293b; }
.snap-label { font-size:0.68rem; color:#64748b; margin-top:1px; }
.snapshot-meta { display:flex; align-items:center; gap:0.5rem; font-size:0.78rem; color:#64748b; }
.prom-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.dot-ok { background:#22c55e; }
.dot-na { background:#94a3b8; }
.snap-time { flex:1; }
.btn-refresh { padding:3px 10px; border:1px solid #e2e8f0; border-radius:6px; font-size:0.75rem; background:#fff; cursor:pointer; transition:background 0.15s; }
.btn-refresh:hover:not(:disabled) { background:#f1f5f9; }
.btn-refresh:disabled { opacity:0.5; cursor:not-allowed; }
.snap-loading { font-size:0.82rem; color:#64748b; padding:0.5rem 0; }
.snap-error { font-size:0.78rem; color:#ef4444; padding:0.25rem 0; }

/* quick actions */
.quick-actions { display:flex; gap:0.5rem; flex-wrap:wrap; flex-shrink:0; }
.qa-btn { padding:5px 12px; border:1px solid #e2e8f0; border-radius:20px; font-size:0.78rem; background:#fff; cursor:pointer; transition:all 0.15s; white-space:nowrap; }
.qa-btn:hover:not(:disabled) { background:#eff6ff; border-color:#93c5fd; color:#1d4ed8; }
.qa-btn:disabled { opacity:0.45; cursor:not-allowed; }

/* chat area */
.chat-area { flex:1; display:flex; flex-direction:column; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; background:#fff; min-height:0; }
.chat-messages { flex:1; overflow-y:auto; padding:1rem; display:flex; flex-direction:column; gap:0.75rem; }
.chat-messages::-webkit-scrollbar { width:4px; }
.chat-messages::-webkit-scrollbar-thumb { background:#e2e8f0; border-radius:2px; }
.chat-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.5rem; height:100%; text-align:center; color:#94a3b8; }
.chat-empty-icon { font-size:2.5rem; }
.chat-empty-text { font-size:0.82rem; max-width:320px; line-height:1.5; }

/* messages */
.msg { display:flex; gap:0.5rem; align-items:flex-start; }
.msg-user { flex-direction:row-reverse; }
.msg-avatar { font-size:1.1rem; flex-shrink:0; width:26px; text-align:center; margin-top:2px; }
.msg-bubble { max-width:82%; display:flex; flex-direction:column; gap:2px; }
.msg-user .msg-bubble { align-items:flex-end; }
.msg-content { padding:8px 12px; border-radius:10px; font-size:0.82rem; line-height:1.6; word-break:break-word; }
.msg-user .msg-content { background:#3b82f6; color:#fff; border-bottom-right-radius:3px; }
.msg-assistant .msg-content { background:#f1f5f9; color:#1e293b; border-bottom-left-radius:3px; }
.msg-time { font-size:0.65rem; color:#94a3b8; padding:0 4px; }

/* typing */
.typing { display:flex; gap:4px; padding:10px 14px; align-items:center; }
.typing span { width:6px; height:6px; border-radius:50%; background:#94a3b8; animation:bounce 1.2s infinite; }
.typing span:nth-child(2) { animation-delay:0.2s; }
.typing span:nth-child(3) { animation-delay:0.4s; }
@keyframes bounce { 0%,60%,100%{transform:translateY(0);opacity:0.5} 30%{transform:translateY(-5px);opacity:1} }

/* toolbar + input */
.chat-toolbar { display:flex; justify-content:flex-end; padding:0.25rem 0.75rem; border-top:1px solid #f1f5f9; }
.btn-clear { padding:3px 10px; border:1px solid #e2e8f0; border-radius:6px; font-size:0.75rem; background:none; cursor:pointer; color:#94a3b8; transition:all 0.15s; }
.btn-clear:hover:not(:disabled) { color:#ef4444; border-color:#fca5a5; }
.btn-clear:disabled { opacity:0.3; cursor:not-allowed; }
.chat-input-row { display:flex; gap:0.5rem; padding:0.6rem 0.75rem; border-top:1px solid #e2e8f0; align-items:flex-end; flex-shrink:0; }
.chat-input { flex:1; resize:none; border:1px solid #e2e8f0; border-radius:8px; padding:8px 12px; font-size:0.82rem; font-family:inherit; outline:none; line-height:1.5; max-height:140px; overflow-y:auto; transition:border-color 0.15s; background:#fafafa; }
.chat-input:focus { border-color:#93c5fd; background:#fff; }
.chat-input:disabled { opacity:0.6; cursor:not-allowed; }
.btn-send { padding:8px 18px; border:none; border-radius:8px; background:#3b82f6; color:#fff; font-size:0.82rem; font-weight:600; cursor:pointer; transition:opacity 0.15s; flex-shrink:0; }
.btn-send:hover:not(:disabled) { opacity:0.85; }
.btn-send:disabled { opacity:0.4; cursor:not-allowed; }
</style>

<style>
/* global: code block styles (not scoped so v-html can use them) */
.code-block { margin:6px 0; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; font-size:0.78rem; }
.code-header { display:flex; justify-content:space-between; align-items:center; padding:4px 10px; background:#f8fafc; border-bottom:1px solid #e2e8f0; }
.code-lang { font-size:0.7rem; color:#64748b; font-family:monospace; }
.copy-btn { padding:2px 8px; border:1px solid #e2e8f0; border-radius:4px; font-size:0.7rem; background:#fff; cursor:pointer; color:#64748b; }
.copy-btn:hover { background:#f1f5f9; }
.code-block pre { margin:0; padding:10px 12px; overflow-x:auto; background:#1e293b; }
.code-block code { color:#e2e8f0; font-family:monospace; white-space:pre; }
.inline-code { background:#f1f5f9; border:1px solid #e2e8f0; border-radius:3px; padding:1px 4px; font-family:monospace; font-size:0.8em; color:#1e293b; }
</style>