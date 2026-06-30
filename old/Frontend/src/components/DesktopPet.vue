<template>
  <div class="desktop-pet" :style="petStyle" @mousedown="startDrag" @contextmenu.prevent="showMenu">
    <!-- 宠物主体 -->
    <div class="pet-body" :class="[petState, direction]" @click="handleClick">

      <!-- 金箍棒：横在猴子手边，挥舞时旋转甩出 -->
      <Transition name="jgb">
        <div v-if="showJinguBang" class="jingu-bang-wrap">
          <div class="jgb-stick"></div>
          <div class="jgb-spark s1"></div>
          <div class="jgb-spark s2"></div>
          <div class="jgb-spark s3"></div>
          <div class="jgb-spark s4"></div>
          <div class="jgb-ring"></div>
        </div>
      </Transition>

      <!-- 五指山：从上方压下来盖住猴子 -->
      <Transition name="mountain">
        <div v-if="petState === 'trapped'" class="five-finger-mountain">
          <span class="mtn-emoji">🏔️</span>
          <div class="mtn-glow"></div>
        </div>
      </Transition>

      <!-- 唐僧：从左侧跑进来 -->
      <Transition name="tangseng">
        <div v-if="petState === 'chased'" class="tangseng-wrap">
          <span>👨‍🦲</span>
        </div>
      </Transition>

      <!-- 猴子本体 -->
      <div class="pet-sprite">
        <span class="pet-emoji">{{ petEmoji }}</span>
      </div>

      <!-- 跳跃时脚下的阴影 -->
      <div class="pet-shadow" :class="{ jumping: petState === 'jump' }"></div>
    </div>

    <!-- 消息气泡 -->
    <Transition name="bubble">
      <div v-if="showBubble" class="pet-bubble">
        {{ bubbleText }}
      </div>
    </Transition>

    <!-- 右键菜单 -->
    <Transition name="menu">
      <div v-if="menuVisible" class="pet-menu" :style="menuStyle">
        <div class="menu-item" @click="openAIAssistant"><span>💬</span> 帮我解决问题</div>
        <div class="menu-item" @click="quickAction('jobs')"><span>📋</span> 我的作业</div>
        <div class="menu-item" @click="quickAction('files')"><span>📁</span> 文件管理</div>
        <div class="menu-item" @click="quickAction('submit')"><span>🚀</span> 提交作业</div>
        <div class="menu-item" v-if="isAdmin" @click="quickAction('monitor')"><span>📊</span> 集群监控</div>
        <div class="menu-item" v-if="isAdmin" @click="quickAction('users')"><span>👥</span> 用户管理</div>
        <div class="menu-divider"></div>
        <div class="menu-item" @click="togglePetSettings"><span>⚙️</span> 宠物设置</div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getUser, getToken } from '../utils/auth'

const emit = defineEmits<{
  (e: 'openAI'): void
  (e: 'quickAction', action: string): void
}>()

const router = useRouter()

// 位置状态
const position = ref({ x: window.innerWidth - 100, y: window.innerHeight - 150 })
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })

// 宠物状态: idle, jump, run, trapped, chased, casting
const petState = ref('idle')
const direction = ref('right') // left | right
const showJinguBang = ref(false)

// 消息气泡
const showBubble = ref(false)
const bubbleText = ref('')

// 右键菜单
const menuVisible = ref(false)
const menuPosition = ref({ x: 0, y: 0 })

// 设置
const petEnabled = ref(true)

// 用户权限
const currentUser = ref<any>(null)
const isAdmin = computed(() => currentUser.value?.role === 'admin')

// 宠物表情映射
const petEmoji = computed(() => {
  const emojis: Record<string, string> = {
    idle:    '🐒',
    jump:    '🐵',
    run:     '🐒',
    trapped: '😫',
    chased:  '😱',
    casting: '🐒',
    spin:    '🐵',
    think:   '🐒',
    roar:    '🐵',
  }
  return emojis[petState.value] || '🐒'
})

// 宠物样式
const petStyle = computed(() => ({
  left: `${position.value.x}px`,
  top: `${position.value.y}px`,
  cursor: isDragging.value ? 'grabbing' : 'grab'
}))

const menuStyle = computed(() => ({
  left: `${menuPosition.value.x}px`,
  top: `${menuPosition.value.y}px`
}))

// 随机跳跃
const randomJump = () => {
  if (isDragging.value || !petEnabled.value) return
  
  const actions = ['jump', 'run', 'idle']
  const action = actions[Math.floor(Math.random() * actions.length)]
  
  if (action === 'jump') {
    petState.value = 'jump'
    // 随机移动
    const jumpX = (Math.random() - 0.5) * 100
    const jumpY = (Math.random() - 0.5) * 50
    position.value.x = Math.max(50, Math.min(window.innerWidth - 100, position.value.x + jumpX))
    position.value.y = Math.max(100, Math.min(window.innerHeight - 150, position.value.y + jumpY))
    
    direction.value = jumpX > 0 ? 'right' : 'left'
    
    setTimeout(() => {
      petState.value = 'idle'
    }, 600)
  } else if (action === 'run') {
    petState.value = 'run'
    direction.value = Math.random() > 0.5 ? 'right' : 'left'
    
    setTimeout(() => {
      petState.value = 'idle'
    }, 1000)
  }
}

// 显示消息气泡
const showBubbleMessage = (text: string, duration = 3000) => {
  bubbleText.value = text
  showBubble.value = true
  setTimeout(() => {
    showBubble.value = false
  }, duration)
}

// 挥舞金箍棒特效
const castSpell = () => {
  if (petState.value === 'casting') return // 防重复
  petState.value = 'casting'
  showJinguBang.value = true
  setTimeout(() => {
    showJinguBang.value = false
    petState.value = 'idle'
    showBubbleMessage('有什么问题，尽管问俺老孙！🪄')
  }, 900)
}

// 五指山效果（权限不足时）
const showTrappedEffect = () => {
  petState.value = 'trapped'
  showBubbleMessage('师父念紧箍咒了！头疼...')
  
  setTimeout(() => {
    petState.value = 'idle'
  }, 3000)
}

// 唐僧追赶效果（做坏事时）
const showChasedEffect = () => {
  petState.value = 'chased'
  showBubbleMessage('师父来追我了！快跑！')
  
  // 快速移动
  const escapeX = direction.value === 'right' ? 80 : -80
  position.value.x = Math.max(50, Math.min(window.innerWidth - 100, position.value.x + escapeX))
  
  setTimeout(() => {
    petState.value = 'idle'
  }, 2000)
}

// 点击动作池 — 随机挑一个，同时打开 AI
const clickActions = [
  // 挥金箍棒
  () => {
    petState.value = 'casting'
    showJinguBang.value = true
    showBubbleMessage('有什么问题，尽管问俺老孙！🪄')
    setTimeout(() => { showJinguBang.value = false; petState.value = 'idle' }, 900)
  },
  // 跳一下
  () => {
    petState.value = 'jump'
    showBubbleMessage('俺来啦！🐵')
    setTimeout(() => { petState.value = 'idle' }, 700)
  },
  // 翻跟斗（spin）
  () => {
    petState.value = 'spin'
    showBubbleMessage('筋斗云！☁️')
    setTimeout(() => { petState.value = 'idle' }, 800)
  },
  // 挠头思考
  () => {
    petState.value = 'think'
    showBubbleMessage('俺老孙帮你想想... 🤔')
    setTimeout(() => { petState.value = 'idle' }, 1200)
  },
  // 抖威风
  () => {
    petState.value = 'roar'
    showBubbleMessage('齐天大圣到此！✨')
    setTimeout(() => { petState.value = 'idle' }, 800)
  },
]

const handleClick = (e: MouseEvent) => {
  if (isDragging.value) return
  // 随机挑一个动作
  const action = clickActions[Math.floor(Math.random() * clickActions.length)]
  action()
  // 动作开始后 500ms 弹出 AI 窗口
  setTimeout(() => emit('openAI'), 500)
}

// 拖拽开始
const startDrag = (e: MouseEvent) => {
  if (e.button !== 0) return // 只响应左键
  isDragging.value = true
  dragOffset.value = {
    x: e.clientX - position.value.x,
    y: e.clientY - position.value.y
  }
  petState.value = 'run'
}

// 拖拽中
const onDrag = (e: MouseEvent) => {
  if (!isDragging.value) return
  position.value = {
    x: e.clientX - dragOffset.value.x,
    y: e.clientY - dragOffset.value.y
  }
  direction.value = e.movementX > 0 ? 'right' : 'left'
}

// 拖拽结束
const endDrag = () => {
  if (isDragging.value) {
    isDragging.value = false
    petState.value = 'idle'
  }
}

// 显示右键菜单
const showMenu = (e: MouseEvent) => {
  menuPosition.value = { x: e.clientX, y: e.clientY }
  menuVisible.value = true
}

// 关闭菜单
const closeMenu = () => {
  menuVisible.value = false
}

// 打开AI助手
const openAIAssistant = () => {
  closeMenu()
  emit('openAI')
}

// 快捷操作
const quickAction = (action: string) => {
  closeMenu()
  emit('quickAction', action)
  
  const actionTexts: Record<string, string> = {
    jobs: '带你去作业列表！',
    files: '打开文件管理！',
    submit: '来提交作业吧！',
    monitor: '查看集群状态！',
    users: '管理用户！'
  }
  
  showBubbleMessage(actionTexts[action] || '好的！')
  castSpell()
}

// 宠物设置
const togglePetSettings = () => {
  closeMenu()
  showBubbleMessage('设置功能开发中...')
}

// 加载用户信息
const loadUser = () => {
  const user = getUser()
  currentUser.value = user
}

// 定时器ID
let jumpInterval: number | null = null

onMounted(() => {
  loadUser()
  
  // 绑定事件
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', endDrag)
  document.addEventListener('click', (e) => {
    if (menuVisible.value) closeMenu()
  })
  
  // 定时随机跳跃
  jumpInterval = window.setInterval(randomJump, 5000)
  
  // 欢迎消息
  setTimeout(() => {
    showBubbleMessage('俺老孙来也！点我帮你解决问题！')
  }, 1000)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', endDrag)
  if (jumpInterval) clearInterval(jumpInterval)
})

// 暴露方法供父组件调用
defineExpose({
  showBubbleMessage,
  castSpell,
  showTrappedEffect,
  showChasedEffect
})
</script>

<style scoped>
.desktop-pet {
  position: fixed;
  z-index: 9999;
  user-select: none;
  /* 拖拽时不要 transition，否则会滞后 */
}

/* ── 宠物主体容器 ── */
.pet-body {
  position: relative;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  animation: pet-float 3s ease-in-out infinite;
}

.pet-body.left .pet-sprite { transform: scaleX(-1); }

/* 各状态动画 */
.pet-body.jump    { animation: pet-jump 0.7s cubic-bezier(.36,.07,.19,.97) forwards; }
.pet-body.run     { animation: pet-run 0.25s ease-in-out infinite; }
.pet-body.casting { animation: pet-cast 0.9s ease-in-out forwards; }
.pet-body.trapped { animation: pet-trapped 0.15s ease-in-out infinite; }
.pet-body.chased  { animation: pet-flee 0.4s ease-out forwards; }
.pet-body.spin    { animation: pet-spin 0.8s cubic-bezier(.4,0,.2,1) forwards; }
.pet-body.think   { animation: pet-think 1.2s ease-in-out forwards; }
.pet-body.roar    { animation: pet-roar 0.8s ease-in-out forwards; }

/* 猴子 emoji */
.pet-sprite {
  font-size: 2.8rem;
  line-height: 1;
  filter: drop-shadow(0 4px 8px rgba(0,0,0,0.25));
  position: relative;
  z-index: 2;
  transition: transform 0.1s;
}
.pet-body:hover .pet-sprite {
  transform: scale(1.12);
}

/* 脚下阴影 */
.pet-shadow {
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 36px;
  height: 8px;
  background: radial-gradient(ellipse, rgba(0,0,0,0.2) 0%, transparent 70%);
  border-radius: 50%;
  transition: all 0.3s;
}
.pet-shadow.jumping {
  width: 20px;
  height: 4px;
  opacity: 0.4;
}

/* ══════════════════════════════════
   金箍棒特效 — 全部在猴子身上
══════════════════════════════════ */
.jingu-bang-wrap {
  position: absolute;
  inset: -20px;
  pointer-events: none;
  z-index: 10;
}

/* 棒子本体：一条金色竖线从猴子右侧甩出 */
.jgb-stick {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 6px;
  height: 44px;
  margin-left: 4px;
  margin-top: -22px;
  background: linear-gradient(180deg, #ffd700 0%, #ff8c00 50%, #ffd700 100%);
  border-radius: 3px;
  box-shadow: 0 0 8px #ffd700, 0 0 16px #ff8c00;
  transform-origin: center bottom;
  animation: jgb-swing 0.9s cubic-bezier(.36,.07,.19,.97) forwards;
}

/* 金色光环 */
.jgb-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 56px;
  height: 56px;
  margin: -28px 0 0 -28px;
  border: 3px solid #ffd700;
  border-radius: 50%;
  box-shadow: 0 0 12px #ffd700;
  animation: jgb-ring 0.9s ease-out forwards;
}

/* 四散的星星火花 */
.jgb-spark {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ffd700;
  box-shadow: 0 0 6px #ffd700;
}
.jgb-spark.s1 { animation: spark-fly 0.8s ease-out forwards; --dx: -30px; --dy: -35px; }
.jgb-spark.s2 { animation: spark-fly 0.8s 0.05s ease-out forwards; --dx: 32px; --dy: -28px; background: #ff8c00; }
.jgb-spark.s3 { animation: spark-fly 0.8s 0.1s ease-out forwards; --dx: -28px; --dy: 30px; background: #fff176; }
.jgb-spark.s4 { animation: spark-fly 0.8s 0.08s ease-out forwards; --dx: 36px; --dy: 26px; }

/* 进入/离开过渡 */
.jgb-enter-active { animation: none; }
.jgb-leave-active { animation: none; }

/* ══════════════════════════════════
   五指山 — 从上方压下来
══════════════════════════════════ */
.five-finger-mountain {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  pointer-events: none;
  animation: mtn-press 0.5s cubic-bezier(.36,.07,.19,.97) forwards;
}
.mtn-emoji { font-size: 3.2rem; display: block; }
.mtn-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse, rgba(255,200,0,0.3) 0%, transparent 70%);
  animation: mtn-glow-pulse 1s ease-in-out infinite;
}

.mountain-enter-active { animation: mtn-press 0.5s cubic-bezier(.36,.07,.19,.97) forwards; }
.mountain-leave-active { animation: mtn-lift 0.4s ease-in forwards; }

/* ══════════════════════════════════
   唐僧追赶 — 从左侧跑进来
══════════════════════════════════ */
.tangseng-wrap {
  position: absolute;
  left: -44px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 1.8rem;
  z-index: 3;
  pointer-events: none;
  animation: tangseng-run 2s ease-in-out forwards;
}

.tangseng-enter-active { animation: tangseng-run 2s ease-in-out forwards; }
.tangseng-leave-active { opacity: 0; transition: opacity 0.3s; }

/* ══════════════════════════════════
   消息气泡
══════════════════════════════════ */
.pet-bubble {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  padding: 7px 12px;
  font-size: 0.75rem;
  white-space: nowrap;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  pointer-events: none;
  z-index: 20;
}
.pet-bubble::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: hsl(var(--card));
}

/* ══════════════════════════════════
   右键菜单
══════════════════════════════════ */
.pet-menu {
  position: fixed;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  padding: 4px 0;
  min-width: 160px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.2);
  z-index: 10001;
}
.menu-item {
  padding: 8px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  transition: background 0.15s;
}
.menu-item:hover { background: hsl(var(--accent)); }
.menu-divider { height: 1px; background: hsl(var(--border)); margin: 4px 0; }

/* ══════════════════════════════════
   关键帧
══════════════════════════════════ */
@keyframes pet-float {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-10px); }
}
@keyframes pet-jump {
  0%   { transform: translateY(0) scale(1); }
  40%  { transform: translateY(-48px) scale(1.05, 0.95); }
  60%  { transform: translateY(-52px) scale(0.95, 1.05); }
  80%  { transform: translateY(-8px) scale(1.02, 0.98); }
  100% { transform: translateY(0) scale(1); }
}
@keyframes pet-run {
  0%, 100% { transform: rotate(-4deg) translateX(0); }
  50%       { transform: rotate(4deg) translateX(3px); }
}
@keyframes pet-cast {
  0%   { transform: rotate(0deg) scale(1); }
  20%  { transform: rotate(-18deg) scale(1.15); }
  50%  { transform: rotate(22deg) scale(1.2); }
  75%  { transform: rotate(-8deg) scale(1.1); }
  100% { transform: rotate(0deg) scale(1); }
}
@keyframes pet-trapped {
  0%, 100% { transform: translateX(0) translateY(0); }
  25%       { transform: translateX(-3px) translateY(1px); }
  75%       { transform: translateX(3px) translateY(-1px); }
}
@keyframes pet-flee {
  0%   { transform: translateX(0); }
  100% { transform: translateX(28px); }
}

/* 翻跟斗 */
@keyframes pet-spin {
  0%   { transform: rotate(0deg) scale(1); }
  40%  { transform: rotate(200deg) scale(1.2) translateY(-20px); }
  70%  { transform: rotate(340deg) scale(1.1) translateY(-8px); }
  100% { transform: rotate(360deg) scale(1); }
}

/* 挠头思考 */
@keyframes pet-think {
  0%   { transform: translateX(0) rotate(0deg); }
  20%  { transform: translateX(-4px) rotate(-8deg); }
  40%  { transform: translateX(4px) rotate(8deg); }
  60%  { transform: translateX(-3px) rotate(-5deg); }
  80%  { transform: translateX(3px) rotate(5deg); }
  100% { transform: translateX(0) rotate(0deg); }
}

/* 抖威风 */
@keyframes pet-roar {
  0%   { transform: scale(1); }
  25%  { transform: scale(1.3) rotate(-5deg); }
  50%  { transform: scale(1.35) rotate(5deg); }
  75%  { transform: scale(1.2) rotate(-3deg); }
  100% { transform: scale(1) rotate(0deg); }
}

/* 金箍棒挥舞 */
@keyframes jgb-swing {
  0%   { transform: rotate(-60deg) scaleY(0.3); opacity: 0; }
  30%  { transform: rotate(20deg) scaleY(1.2); opacity: 1; }
  60%  { transform: rotate(-10deg) scaleY(1); opacity: 1; }
  100% { transform: rotate(80deg) scaleY(0.5); opacity: 0; }
}
@keyframes jgb-ring {
  0%   { transform: scale(0.2); opacity: 1; }
  60%  { transform: scale(1.4); opacity: 0.8; }
  100% { transform: scale(2); opacity: 0; }
}
@keyframes spark-fly {
  0%   { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
}

/* 五指山 */
@keyframes mtn-press {
  0%   { transform: translateX(-50%) translateY(-60px); opacity: 0; }
  60%  { transform: translateX(-50%) translateY(4px); opacity: 1; }
  80%  { transform: translateX(-50%) translateY(-4px); }
  100% { transform: translateX(-50%) translateY(0); opacity: 1; }
}
@keyframes mtn-lift {
  0%   { transform: translateX(-50%) translateY(0); opacity: 1; }
  100% { transform: translateX(-50%) translateY(-60px); opacity: 0; }
}
@keyframes mtn-glow-pulse {
  0%, 100% { opacity: 0.5; }
  50%       { opacity: 1; }
}

/* 唐僧追赶 */
@keyframes tangseng-run {
  0%   { transform: translateY(-50%) translateX(-20px); opacity: 0; }
  20%  { opacity: 1; }
  70%  { transform: translateY(-50%) translateX(0px); opacity: 1; }
  100% { transform: translateY(-50%) translateX(8px); opacity: 0.7; }
}

/* 气泡过渡 */
.bubble-enter-active, .bubble-leave-active { transition: all 0.25s ease; }
.bubble-enter-from, .bubble-leave-to { opacity: 0; transform: translateX(-50%) translateY(6px); }

/* 菜单过渡 */
.menu-enter-active, .menu-leave-active { transition: all 0.15s ease; }
.menu-enter-from, .menu-leave-to { opacity: 0; transform: scale(0.92); }
</style>
