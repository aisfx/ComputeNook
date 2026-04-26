<template>
  <div class="download-page">
    <h1>HPC 平台客户端</h1>
    <p class="subtitle">支持 RDP 远程桌面 + SSH 隧道，下载后自动激活，网页一键连接</p>

    <div class="detected">
      🖥️ 检测到你的系统: <strong>{{ currentOS.label }}</strong>
    </div>

    <!-- 步骤提示 -->
    <div class="flow">
      <div class="flow-step" :class="{ done: step >= 1, active: step === 0 }">
        <div class="flow-num">{{ step >= 1 ? '✓' : '1' }}</div>
        <span>下载客户端</span>
      </div>
      <div class="flow-arrow">→</div>
      <div class="flow-step" :class="{ done: step >= 2, active: step === 1 }">
        <div class="flow-num">{{ step >= 2 ? '✓' : '2' }}</div>
        <span>运行激活</span>
      </div>
      <div class="flow-arrow">→</div>
      <div class="flow-step" :class="{ done: step >= 3, active: step === 2 }">
        <div class="flow-num">{{ step >= 3 ? '✓' : '3' }}</div>
        <span>一键连接</span>
      </div>
    </div>

    <!-- 下载卡片 -->
    <div v-if="step === 0" class="cards">
      <div
        v-for="item in orderedPlatforms"
        :key="item.key"
        class="card"
        :class="{ current: item.key === osKey, disabled: item.disabled }"
      >
        <div class="icon">{{ item.icon }}</div>
        <h3>{{ item.label }} <span v-if="item.key === osKey && !item.disabled">⭐</span></h3>
        <p>{{ item.desc }}</p>
        <button class="btn" @click="downloadAndActivate(item)" :disabled="item.disabled || downloading === item.name">
          {{ item.disabled ? '暂未开放' : downloading === item.name ? '下载中...' : '下载并激活' }}
        </button>
      </div>
    </div>

    <!-- 激活等待 -->
    <div v-else-if="step === 1" class="activate-box">
      <div class="activate-icon">⏳</div>
      <h3>请运行下载的客户端文件</h3>
      <p>双击运行 <code>{{ downloadedFile }}</code>，客户端会自动完成激活</p>
      <p class="hint">Windows 可能弹出 UAC 确认框，点击"是"即可</p>
      <button class="btn-outline" @click="checkActivated">我已运行，检测激活</button>
      <button class="btn-text" @click="step = 0">重新下载</button>
    </div>

    <!-- 已激活 -->
    <div v-else-if="step >= 2" class="success-box">
      <div class="success-icon">✅</div>
      <h3>客户端已就绪</h3>
      <p>现在可以在远程桌面或 WebShell 页面点击"一键连接"按钮</p>
      <button class="btn" @click="$emit('go-desktop')">前往远程桌面</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import axios from 'axios'

defineEmits(['go-desktop'])

const step = ref(0)
const downloading = ref('')
const downloadedFile = ref('')

const platforms = [
  { key: 'windows', icon: '🪟', label: 'Windows', desc: 'Windows 10/11 x64',     name: 'hpc-client-windows.exe', disabled: false },
  { key: 'darwin',  icon: '🍎', label: 'macOS',   desc: 'Intel / Apple Silicon', name: 'hpc-client-mac',         disabled: true  },
  { key: 'linux',   icon: '🐧', label: 'Linux',   desc: 'x86_64',                name: 'hpc-client-linux',       disabled: true  },
]

const osKey = computed(() => {
  const ua = navigator.userAgent
  if (ua.includes('Windows')) return 'windows'
  if (ua.includes('Mac')) return 'darwin'
  return 'linux'
})

const currentOS = computed(() => platforms.find(p => p.key === osKey.value)!)

const orderedPlatforms = computed(() => [
  ...platforms.filter(p => p.key === osKey.value),
  ...platforms.filter(p => p.key !== osKey.value),
])

const downloadAndActivate = async (item: typeof platforms[0]) => {
  downloading.value = item.name
  try {
    const res = await axios.get(`/download/${item.name}`, {
      responseType: 'blob',
      validateStatus: () => true,
    })
    if (res.status === 404) {
      alert('客户端文件尚未生成，请联系管理员运行 npm run release 编译客户端\n默认输出目录：/opt/hpc-platform/clients')
      return
    }
    if (res.status === 401) {
      alert('登录已过期，请重新登录')
      window.location.href = '/'
      return
    }
    if (res.status !== 200) {
      // 尝试读取 blob 中的错误信息
      const text = await res.data.text()
      let msg = '下载失败'
      try { msg = JSON.parse(text).error || msg } catch { /* ignore */ }
      alert(msg)
      return
    }
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    // 加时间戳避免覆盖被占用的旧文件
    const ext = item.name.includes('.') ? item.name.slice(item.name.lastIndexOf('.')) : ''
    const base = item.name.slice(0, item.name.length - ext.length)
    const saveName = `${base}-new${ext}`
    a.href = url; a.download = saveName; a.click()
    URL.revokeObjectURL(url)

    downloadedFile.value = saveName
    step.value = 1

  } catch (e: any) {
    alert('下载失败: ' + (e.message || '网络错误'))
  } finally {
    downloading.value = ''
  }
}

// 检测是否已激活（尝试触发 hpcc://install，如果没报错说明已注册）
const checkActivated = () => {
  window.location.href = 'hpcc://install'
  setTimeout(() => {
    step.value = 2
  }, 500)
}
</script>

<style scoped>
.download-page { max-width: 760px; margin: 40px auto; padding: 0 20px; }
h1 { font-size: 26px; margin-bottom: 8px; }
.subtitle { color: #666; margin-bottom: 20px; font-size: 14px; }
.detected { background: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 8px; padding: 10px 16px; margin-bottom: 28px; font-size: 14px; }

.flow { display: flex; align-items: center; gap: 8px; margin-bottom: 32px; }
.flow-step { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #9ca3af; }
.flow-step.active { color: #6366f1; font-weight: 600; }
.flow-step.done { color: #10b981; }
.flow-num { width: 24px; height: 24px; border-radius: 50%; background: #e5e7eb; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; }
.flow-step.active .flow-num { background: #6366f1; color: #fff; }
.flow-step.done .flow-num { background: #10b981; color: #fff; }
.flow-arrow { color: #d1d5db; font-size: 18px; }

.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
.card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; text-align: center; }
.card.current { border-color: #6366f1; box-shadow: 0 0 0 2px #e0e7ff; }
.card.disabled { opacity: 0.45; background: #f3f4f6; }
.icon { font-size: 40px; margin-bottom: 8px; }
h3 { margin: 0 0 4px; font-size: 16px; }
.card p { color: #666; font-size: 12px; margin: 0 0 14px; }

.btn { padding: 9px 22px; background: #6366f1; color: #fff; border-radius: 8px; font-size: 14px; cursor: pointer; border: none; }
.btn:hover { background: #4f46e5; }
.btn:disabled { background: #a5b4fc; cursor: not-allowed; }
.btn-outline { padding: 9px 22px; background: transparent; border: 1px solid #6366f1; color: #6366f1; border-radius: 8px; font-size: 14px; cursor: pointer; margin-right: 8px; }
.btn-text { background: none; border: none; color: #9ca3af; font-size: 13px; cursor: pointer; }

.activate-box, .success-box { text-align: center; padding: 40px 20px; background: #f9fafb; border-radius: 12px; }
.activate-icon, .success-icon { font-size: 48px; margin-bottom: 16px; }
.activate-box h3, .success-box h3 { margin: 0 0 8px; }
.activate-box p, .success-box p { color: #555; font-size: 14px; margin: 0 0 8px; }
.hint { color: #9ca3af !important; font-size: 12px !important; margin-bottom: 20px !important; }
code { background: #e5e7eb; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
</style>
