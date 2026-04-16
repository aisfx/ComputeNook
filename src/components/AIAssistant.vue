<template>
  <!-- 悬浮按钮 -->
  <div class="ai-float">
    <button class="ai-trigger" @click="toggleChat" :title="open ? '关闭助手' : '打开 AI 助手'"
      :style="{ opacity: maximized ? 0 : 1, pointerEvents: maximized ? 'none' : 'auto' }">
      <span class="ai-monkey">🐒</span>
      <span v-if="!open && unread > 0" class="ai-badge">{{ unread }}</span>
    </button>

    <!-- 聊天窗口 -->
    <Transition name="ai-slide">
      <div v-if="open" :class="['ai-window', { 'ai-window-max': maximized }]">
        <!-- Header -->
        <div class="ai-header">
          <div class="ai-header-left">
            <span class="ai-header-icon">🐒</span>
            <div>
              <div class="ai-header-title">HPC 智能助手</div>
              <div class="ai-header-sub">孙大圣为您服务</div>
            </div>
          </div>
          <div class="ai-header-actions">
            <button class="ai-icon-btn" @click="clearMessages" title="清空对话">🗑️</button>
            <button class="ai-icon-btn" @click="maximized = !maximized" :title="maximized ? '还原' : '最大化'">
              {{ maximized ? '⊡' : '⊞' }}
            </button>
            <button class="ai-icon-btn" @click="open = false" title="关闭">✕</button>
          </div>
        </div>

        <!-- Messages -->
        <div class="ai-messages" ref="messagesEl">
          <!-- Welcome -->
          <div v-if="messages.length === 0" class="ai-welcome">
            <div class="ai-welcome-icon">🐒</div>
            <div class="ai-welcome-text">俺老孙来也！有什么 HPC 问题尽管问，作业提交、资源配置、脚本编写都难不倒俺！</div>
            <div class="ai-suggestions">
              <button v-for="s in suggestions" :key="s" class="ai-suggest-btn" @click="sendSuggestion(s)">
                {{ s }}
              </button>
            </div>
          </div>

          <!-- Message list -->
          <div v-for="(msg, i) in messages" :key="i" :class="['ai-msg', `ai-msg-${msg.role}`]">
            <div class="ai-msg-avatar">{{ msg.role === 'user' ? '👤' : '🐒' }}</div>
            <div class="ai-msg-bubble">
              <div class="ai-msg-content" v-html="renderContent(msg.content)"></div>
              <div class="ai-msg-time">{{ msg.time }}</div>
            </div>
          </div>

          <!-- Loading -->
          <div v-if="loading" class="ai-msg ai-msg-assistant">
            <div class="ai-msg-avatar">🐒</div>
            <div class="ai-msg-bubble">
              <div class="ai-typing">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        </div>

        <!-- Input -->
        <div class="ai-input-area">
          <textarea
            ref="inputEl"
            v-model="input"
            class="ai-input"
            placeholder="问俺老孙任何 HPC 问题..."
            rows="1"
            @keydown.enter.exact.prevent="send"
            @keydown.enter.shift.exact="input += '\n'"
            @input="autoResize"
            :disabled="loading"
          ></textarea>
          <button class="ai-send-btn" @click="send" :disabled="loading || !input.trim()">
            {{ loading ? '⏳' : '➤' }}
          </button>
        </div>
        <div class="ai-footer">Enter 发送 · Shift+Enter 换行</div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import axios from 'axios'

interface Message {
  role: 'user' | 'assistant'
  content: string
  time: string
}

const open = ref(false)
const maximized = ref(false)
const input = ref('')
const loading = ref(false)
const messages = ref<Message[]>([])
const unread = ref(0)
const messagesEl = ref<HTMLElement>()
const inputEl = ref<HTMLTextAreaElement>()

const suggestions = [
  '如何提交一个 GPU 作业？',
  '怎么查看我的作业状态？',
  '如何写一个 Slurm 脚本？',
  '集群资源不够用怎么办？',
]

const toggleChat = () => {
  open.value = !open.value
  if (open.value) {
    unread.value = 0
    nextTick(() => {
      inputEl.value?.focus()
      scrollToBottom()
    })
  }
}

const now = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesEl.value) {
      messagesEl.value.scrollTop = messagesEl.value.scrollHeight
    }
  })
}

const autoResize = () => {
  if (!inputEl.value) return
  inputEl.value.style.height = 'auto'
  inputEl.value.style.height = Math.min(inputEl.value.scrollHeight, 120) + 'px'
}

const sendSuggestion = (text: string) => {
  input.value = text
  send()
}

const send = async () => {
  const text = input.value.trim()
  if (!text || loading.value) return

  messages.value.push({ role: 'user', content: text, time: now() })
  input.value = ''
  if (inputEl.value) inputEl.value.style.height = 'auto'
  loading.value = true
  scrollToBottom()

  try {
    const history = messages.value.slice(-10).map(m => ({
      role: m.role,
      content: m.content
    }))

    const res = await axios.post('/ai/chat', { messages: history })
    const reply = res.data.content || '抱歉，俺老孙没有理解您的问题，请重新描述。'

    messages.value.push({ role: 'assistant', content: reply, time: now() })

    if (!open.value) unread.value++
  } catch (e: any) {
    const errMsg = e.response?.data?.error || '俺老孙连接失败了，请稍后再试。'
    messages.value.push({ role: 'assistant', content: `❌ ${errMsg}`, time: now() })
  } finally {
    loading.value = false
    scrollToBottom()
  }
}

const clearMessages = () => {
  messages.value = []
  unread.value = 0
}

// 简单的 markdown 渲染：代码块、粗体、换行
const renderContent = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre class="ai-code"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}
</script>

<style>
/* 全局样式，因为组件会 Teleport 或直接挂载 */
.ai-float {
  position: fixed;
  bottom: 28px;
  right: 28px;
  z-index: 9000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
}

/* 触发按钮 */
.ai-trigger {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: hsl(var(--primary));
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
  transition: transform 0.2s, box-shadow 0.2s;
  position: relative;
  flex-shrink: 0;
}

.ai-trigger:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 24px rgba(0,0,0,0.3);
}

.ai-monkey { font-size: 1.75rem; line-height: 1; }

.ai-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 18px;
  height: 18px;
  background: hsl(var(--destructive));
  color: white;
  border-radius: 50%;
  font-size: 0.65rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 聊天窗口 */
.ai-window {
  width: 360px;
  height: 520px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 16px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.25s ease, height 0.25s ease, border-radius 0.25s ease;
}

/* 最大化状态 */
.ai-window-max {
  position: fixed;
  inset: 16px;
  width: auto !important;
  height: auto !important;
  border-radius: 16px;
  z-index: 9001;
}

/* Header */
.ai-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  flex-shrink: 0;
}

.ai-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ai-header-icon { font-size: 1.5rem; }

.ai-header-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: hsl(var(--primary-foreground));
}

.ai-header-sub {
  font-size: 0.7rem;
  opacity: 0.8;
  color: hsl(var(--primary-foreground));
}

.ai-header-actions { display: flex; gap: 4px; }

.ai-icon-btn {
  background: hsl(var(--primary-foreground) / 0.15);
  border: none;
  color: hsl(var(--primary-foreground));
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.ai-icon-btn:hover { background: hsl(var(--primary-foreground) / 0.25); }

/* Messages */
.ai-messages {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  scroll-behavior: smooth;
}

.ai-messages::-webkit-scrollbar { width: 4px; }
.ai-messages::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 2px; }

/* Welcome */
.ai-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px 8px;
  text-align: center;
}

.ai-welcome-icon { font-size: 2.5rem; }

.ai-welcome-text {
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
  line-height: 1.5;
}

.ai-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  margin-top: 4px;
}

.ai-suggest-btn {
  padding: 5px 10px;
  background: hsl(var(--secondary));
  border: 1px solid hsl(var(--border));
  border-radius: 20px;
  font-size: 0.75rem;
  color: hsl(var(--foreground));
  cursor: pointer;
  transition: background 0.15s;
}
.ai-suggest-btn:hover { background: hsl(var(--accent)); }

/* Message bubbles */
.ai-msg {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.ai-msg-user {
  flex-direction: row-reverse;
}

.ai-msg-avatar {
  font-size: 1.2rem;
  flex-shrink: 0;
  width: 28px;
  text-align: center;
}

.ai-msg-bubble {
  max-width: 80%;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.ai-msg-user .ai-msg-bubble { align-items: flex-end; }

.ai-msg-content {
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 0.82rem;
  line-height: 1.55;
  word-break: break-word;
}

.ai-msg-user .ai-msg-content {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-bottom-right-radius: 4px;
}

.ai-msg-assistant .ai-msg-content {
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
  border-bottom-left-radius: 4px;
}

.ai-msg-time {
  font-size: 0.65rem;
  color: hsl(var(--muted-foreground));
  padding: 0 4px;
}

/* Code */
.ai-code {
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  padding: 8px 10px;
  font-family: var(--font-family-mono);
  font-size: 0.75rem;
  overflow-x: auto;
  margin: 4px 0;
  white-space: pre;
}

.ai-inline-code {
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 3px;
  padding: 1px 4px;
  font-family: var(--font-family-mono);
  font-size: 0.8em;
}

/* Typing indicator */
.ai-typing {
  display: flex;
  gap: 4px;
  padding: 10px 14px;
  align-items: center;
}

.ai-typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: hsl(var(--muted-foreground));
  animation: ai-bounce 1.2s infinite;
}
.ai-typing span:nth-child(2) { animation-delay: 0.2s; }
.ai-typing span:nth-child(3) { animation-delay: 0.4s; }

@keyframes ai-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
  30% { transform: translateY(-6px); opacity: 1; }
}

/* Input */
.ai-input-area {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid hsl(var(--border));
  flex-shrink: 0;
}

.ai-input {
  flex: 1;
  resize: none;
  border: 1px solid hsl(var(--input));
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 0.82rem;
  font-family: inherit;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  outline: none;
  line-height: 1.4;
  max-height: 120px;
  overflow-y: auto;
  transition: border-color 0.15s;
}
.ai-input:focus { border-color: hsl(var(--ring)); }
.ai-input:disabled { opacity: 0.6; cursor: not-allowed; }

.ai-send-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border: none;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: opacity 0.15s;
}
.ai-send-btn:hover:not(:disabled) { opacity: 0.85; }
.ai-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.ai-footer {
  text-align: center;
  font-size: 0.65rem;
  color: hsl(var(--muted-foreground));
  padding: 4px 0 8px;
  flex-shrink: 0;
}

/* Transition */
.ai-slide-enter-active,
.ai-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.ai-slide-enter-from,
.ai-slide-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.96);
}
</style>
