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
              <div class="ai-header-title">HPC 应用助手</div>
              <div class="ai-header-sub">并行计算 · 科学软件 · 编程环境</div>
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
            <div class="ai-welcome-text">你好！我是 HPC 应用助手，可以帮你解答并行计算、科学软件使用、编程环境配置等问题。</div>
            <div class="ai-suggestions">
              <button v-for="s in suggestions" :key="s" class="ai-suggest-btn" @click="sendSuggestion(s)">
                {{ s }}
              </button>
            </div>
          </div>

          <!-- Message list -->
          <div v-for="(msg, i) in messages" :key="i" :class="['ai-msg', `ai-msg-${msg.role}`, { 'ai-msg-jinjugu': msg.jinjugu, [`ai-msg-type-${msg.msgType}`]: !!msg.msgType }]">
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

        <!-- 快捷操作栏 -->
        <div class="ai-quick-bar">
          <button class="ai-quick-btn" @click="sendSuggestion('查看我的作业列表')">📋 我的作业</button>
          <button class="ai-quick-btn" @click="sendSuggestion('生成我的机时使用报表')">📊 机时报表</button>
          <button class="ai-quick-btn" @click="sendSuggestion('帮我生成一个MPI作业脚本')">📝 生成脚本</button>
          <button class="ai-quick-btn" @click="promptAnalyzeJob()">🔍 分析作业</button>
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
import { getUser, getToken } from '../utils/auth'

// 带 token 的 axios 实例，确保 fetchContext 里的请求都携带认证
const authAxios = axios.create()
authAxios.interceptors.request.use(config => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (!config.baseURL) config.baseURL = axios.defaults.baseURL || '/api'
  return config
})

interface Message {
  role: 'user' | 'assistant'
  content: string
  time: string
  jinjugu?: boolean
  msgType?: string
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
  '查看我的作业列表',
  '生成我的机时使用报表',
  '如何用 MPI 并行运行程序？',
  '作业一直排队怎么办？',
  '帮我生成一个 GPU 作业脚本',
  '如何使用 module 加载软件？',
]

// ── 快捷操作 ──
const promptAnalyzeJob = () => {
  const jobId = window.prompt('请输入要分析的作业 ID：')
  if (jobId?.trim()) {
    input.value = `分析作业 ${jobId.trim()} 的运行情况，找出问题并给出建议`
    send()
  }
}

// ── 意图识别 ──
interface Intent {
  type: 'list_jobs' | 'get_job' | 'cancel_job' | 'usage_report' | 'partitions' | null
  jobId?: string
}

const detectIntent = (text: string): Intent => {
  const t = text.toLowerCase()
  if (/查看.*(作业|job)|我的作业|作业列表|正在运行|排队中/.test(t)) return { type: 'list_jobs' }
  const jobMatch = t.match(/(?:分析|查看|查询|看看|检查).{0,10}(?:作业|job)[^\d]*(\d+)|(?:作业|job)\s*[id号]?\s*[:#：]?\s*(\d+)/)
  if (jobMatch) return { type: 'get_job', jobId: jobMatch[1] || jobMatch[2] }
  const cancelMatch = t.match(/(?:取消|cancel|停止|kill).{0,10}(?:作业|job)[^\d]*(\d+)/)
  if (cancelMatch) return { type: 'cancel_job', jobId: cancelMatch[1] }
  if (/机时|报表|使用情况|用了多少|核时|billing|usage/.test(t)) return { type: 'usage_report' }
  if (/分区|partition|队列|queue/.test(t) && /有哪些|列表|查看|show/.test(t)) return { type: 'partitions' }
  return { type: null }
}

// ── API 调用，返回注入 AI 的上下文 ──
const fetchContext = async (intent: Intent): Promise<string> => {
  const token = getToken()
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  const baseURL = axios.defaults.baseURL || '/api'
  const get = (path: string, params?: any) => axios.get(baseURL + path, { headers, params })
  const del = (path: string) => axios.delete(baseURL + path, { headers })
  try {
    if (intent.type === 'list_jobs') {
      const user = getUser()?.username || ''
      const res = await get('/jobs', { page: 1, page_size: 20, user })
      const jobs: any[] = res.data.data || []
      if (!jobs.length) return '【当前无作业数据】'
      return `【用户作业列表（最近${jobs.length}条）】\n` + jobs.slice(0, 15).map((j: any) =>
        `- ID:${j.job_id} 名称:${j.name} 状态:${j.job_state} 分区:${j.partition} 节点:${j.nodes||'-'}`
      ).join('\n')
    }
    if (intent.type === 'get_job' && intent.jobId) {
      const res = await get(`/jobs/${intent.jobId}`)
      const j = res.data.data
      if (!j) return `【作业 ${intent.jobId} 未找到】`
      return `【作业 ${intent.jobId} 详情】
- 名称: ${j.name}  状态: ${j.job_state}
- 分区: ${j.partition}  节点: ${j.nodes||'-'}
- CPU: ${j.cpus||'-'}  内存: ${j.memory_per_node||'-'}
- 提交: ${j.submit_time ? new Date(j.submit_time*1000).toLocaleString('zh-CN') : '-'}
- 开始: ${j.start_time ? new Date(j.start_time*1000).toLocaleString('zh-CN') : '-'}
- 结束: ${j.end_time ? new Date(j.end_time*1000).toLocaleString('zh-CN') : '-'}
- 退出码: ${j.exit_code??'-'}
- 工作目录: ${j.work_dir||'-'}
- 输出文件: ${j.standard_output||'-'}
- 错误文件: ${j.standard_error||'-'}`
    }
    if (intent.type === 'cancel_job' && intent.jobId) {
      if (!window.confirm(`确认取消作业 ${intent.jobId}？`)) return `【用户取消了操作】`
      await del(`/jobs/${intent.jobId}`)
      return `【作业 ${intent.jobId} 已成功取消】`
    }
    if (intent.type === 'usage_report') {
      const user = getUser()?.username || ''
      if (!user) return '【无法获取当前用户信息，请重新登录】'
      const now2 = new Date()
      const start = new Date(now2.getTime() - 30*86400000).toISOString().split('T')[0]
      const end = now2.toISOString().split('T')[0]
      const res = await get('/usage/user', { user, start_time: start, end_time: end })
      const d = res.data
      const jobs: any[] = d.jobs || []
      const totalCPUH = jobs.reduce((s: number, j: any) => s + (j.cpu_hours||0), 0)
      const totalGPUH = jobs.reduce((s: number, j: any) => s + (j.gpu_hours||0), 0)
      return `【近30天机时报表（${start} ~ ${end}）用户: ${user}】
- 总作业: ${jobs.length}  完成: ${jobs.filter((j:any)=>j.state==='COMPLETED').length}  失败: ${jobs.filter((j:any)=>j.state==='FAILED').length}
- CPU核时: ${totalCPUH.toFixed(2)}  GPU卡时: ${totalGPUH.toFixed(2)}
- 明细（最近10条）:
${jobs.slice(0,10).map((j:any)=>`  · ${j.job_id} ${j.name} ${j.state} CPU:${(j.cpu_hours||0).toFixed(2)}h`).join('\n')}`
    }
    if (intent.type === 'partitions') {
      const res = await get('/jobs/partitions/list')
      const parts: any[] = res.data.data || []
      return `【可用分区列表】\n` + parts.map((p:any) => `- ${p.name}: 节点${p.total_nodes||'-'}个 状态${p.state||'-'}`).join('\n')
    }
  } catch (e: any) {
    return `【API调用失败: ${e.response?.data?.error || e.message}】`
  }
  return ''
}

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

// ─────────────────────────────────────────────
// 🐒 孙大圣的"禁区"系统
// ─────────────────────────────────────────────

// HPC 计算上下文白名单 — 包含这些词时，即使命中禁区也放行
// 因为用户是在问计算/作业相关的问题，不是真的要搞运维
const HPC_CONTEXT_WHITELIST = [
  '作业', '程序', '代码', '脚本', '编译', '运行', '提交', '队列', '节点分配',
  'mpi', 'openmp', 'python', 'matlab', 'gromacs', 'lammps', 'vasp', 'gaussian',
  'sbatch', 'srun', 'slurm作业', '并行', '进程', '线程', 'gpu计算', 'cuda',
  '模块', 'module load', '环境变量', '依赖', '库', 'conda', 'pip',
  '报错', '错误信息', 'error:', 'segfault', 'oom', '内存溢出', '超时',
  '作业日志', '输出文件', 'stdout', 'stderr', '.out', '.err',
]

// 不同类型的禁区，触发不同的反应
const FORBIDDEN_RULES: Array<{
  // 必须同时满足：命中 keywords 且不被白名单豁免
  keywords: string[]
  // 强制触发：即使有白名单词也拦截（骂人等）
  force?: boolean
  type: 'jinjugu' | 'scared' | 'crash' | 'strike' | 'confused'
  replies: string[]
}> = [
  {
    type: 'jinjugu',
    // 精确的运维操作短语，不容易误触
    keywords: [
      '添加用户', '删除用户', '创建用户账号', '重置用户密码', '禁用账户', '封禁账号',
      '用户权限管理', '系统权限配置', '后台管理', '管理后台',
      '修改系统配置', '修改slurm配置', '修改网络配置', '配置防火墙',
      '部署服务', '安装操作系统', '升级操作系统', '系统版本升级',
      '服务器运维', '集群运维', '日常巡检', '运维操作',
    ],
    replies: [
      '哎哟！头好痛！🤕\n\n师父又念紧箍咒了！「**嗡嘛呢叭咪吽……**」\n\n俺老孙只管帮用户跑程序、搞科学计算，运维的事儿师父不让管！\n\n👉 这种问题请找**系统管理员**，他们才是真正的"太上老君"！',
      '「紧箍咒」发动！😵‍💫\n\n头……头好疼……俺老孙的七十二变也顶不住这个！\n\n师父说了：运维管理的事不归俺管，俺只负责帮你跑 MPI、调 Python、提交作业！\n\n🙏 请联系**管理员**，他们有"如来佛祖"级别的权限！',
      '嗡嘛呢叭咪吽……嗡嘛呢叭咪吽……😖\n\n俺老孙头疼欲裂！这是师父划定的禁区！\n\n就算俺有七十二变，也变不出管理员权限！\n\n🔑 请找**系统管理员**处理。',
      '哎哟我的头啊！🤯\n\n一碰运维的话题，紧箍咒就自动触发……\n\n俺老孙是**HPC 应用助手**，专管并行计算、科学软件、作业调度这些事儿。\n\n系统管理的活儿？那是**管理员**的地盘，俺不越界！',
      '「嗡嘛呢叭咪吽」🔔🔔🔔\n\n三界之内，此题不答！\n\n俺老孙当年大闹天宫都没怕过，但师父这个咒……真的顶不住。\n\n速去寻**系统管理员**，莫要为难俺！',
    ],
  },
  {
    type: 'crash',
    // 必须是明确的硬件/系统层面故障，不是作业层面
    keywords: [
      '节点宕机了', '服务器挂了', '服务器崩了', '服务器死了',
      'kernel panic', '内核崩溃', '系统崩溃了',
      '硬件故障', '磁盘坏了', '内存条故障', '掉电了', '机房断电',
    ],
    replies: [
      '哎……俺老孙也……突然……\n\n```\nKernel panic - not syncing: 听到"宕机"二字\nCPU: 0 PID: 72 悟空进程\nCall Trace:\n  孙悟空.exe has stopped working\n  请联系如来佛祖...\n```\n\n……开玩笑的！😄\n\n俺老孙金刚不坏之身，死不了！\n\n但这种**硬件/系统故障**真的不归俺管，请联系**系统管理员**现场处理！',
      '收到"宕机"关键词……\n\n`[系统提示] 悟空助手 正在蓝屏中……`\n\n🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦\n\n```\n:( 俺老孙也挂了\n\nSTOP CODE: FORBIDDEN_TOPIC_DETECTED\n```\n\n哈哈，吓到你了吗？😏\n\n节点故障这种事，俺真的帮不上忙，得**管理员**去机房看看！',
      '噫！说到宕机……俺老孙感觉自己也要……\n\n⚠️ **WARNING**: 悟空进程内存不足\n⚠️ **ERROR**: 七十二变技能树加载失败\n⚠️ **CRITICAL**: 如意金箍棒驱动崩溃\n\n……好了好了，俺没事 😅\n\n但**节点宕机**这种问题，真的需要**管理员**去现场排查，俺隔着屏幕帮不了！',
    ],
  },
  {
    type: 'scared',
    // 明确的重启/关机操作意图
    keywords: [
      '重启节点', '重启服务器', '重启集群', '关闭服务器', '强制关机',
      '强制重启服务器', '断电重启', '给服务器重启', '把节点重启',
    ],
    replies: [
      '等等等等！！😱\n\n你说"重启"？！\n\n俺老孙上次被太上老君关进炼丹炉，炼了七七四十九天才出来……\n\n**重启这种事千万别乱来！** 会中断所有正在运行的作业的！\n\n🚨 如果真的需要重启，请联系**系统管理员**，他们会安排维护窗口，提前通知所有用户！',
      '重……重启？！😰\n\n俺老孙的毫毛都竖起来了！\n\n你知道现在集群上可能有多少个作业在跑吗？一重启全没了！\n\n这种操作必须走**管理员**审批流程，俺老孙没有这个权限，也不敢有！',
      '🛑 停！停！停！\n\n"重启服务器"这几个字，在 HPC 集群里是最危险的操作之一！\n\n俺老孙当年大闹天宫，也没敢随便重启天庭服务器……\n\n请联系**系统管理员**，走正规流程！',
    ],
  },
  {
    type: 'confused',
    // 明确是系统级日志，不是作业日志
    keywords: [
      '查看系统日志', '分析系统日志', '/var/log/syslog', '/var/log/messages',
      'dmesg报错', '内核日志', '系统级日志', 'journalctl系统',
    ],
    replies: [
      '俺老孙翻了个筋斗云，飞到日志服务器上看了看……☁️\n\n```\n$ sudo cat /var/log/syslog\nbash: sudo: 权限不足\n悟空: 哦不\n```\n\n俺没有系统日志的访问权限！😅\n\n**系统日志排查**需要管理员权限，请联系**系统管理员**，他们有"天眼"可以看！',
      '俺老孙使出火眼金睛，盯着日志看了半天……👁️\n\n结果发现：俺根本没有权限看系统日志！\n\n这就好比让俺去查玉皇大帝的私人日记……\n\n🔍 请找**系统管理员**，他们才有"天庭 root 权限"！',
    ],
  },
  {
    type: 'strike',
    force: true, // 骂人不受白名单豁免
    keywords: [
      '傻逼', '废物', '垃圾系统', '蠢货', '笨蛋', '白痴', '脑残', '煞笔',
      '妈的', '操你', '去死', 'fuck you', 'stupid system',
    ],
    replies: [
      '俺老孙当年连玉皇大帝都不放在眼里，你这几个字……\n\n**金箍棒·警告模式** 🪄💥\n\n好了好了，俺不跟你一般见识。\n\n有什么 HPC 计算问题，好好说，俺帮你解决！😤',
      '哼！\n\n俺老孙七十二变、筋斗云，走遍三界无敌手……\n\n但俺师父说了：**出口成脏，有失体面。**\n\n🪄 请文明提问，俺才能好好帮你！',
      '……\n\n俺老孙忍了。\n\n「**嗡嘛呢叭咪吽**」——这次是俺自己念的，让自己冷静一下。\n\n有什么正经问题，说吧。😑',
    ],
  },
]

// 彩蛋触发词
const EASTER_EGGS: Array<{ keywords: string[]; reply: string }> = [
  {
    keywords: ['你是谁', '你叫什么', '自我介绍', '介绍一下自己'],
    reply: '俺？\n\n俺乃**齐天大圣孙悟空**是也！🐒\n\n花果山水帘洞出身，大闹天宫出名，取经路上成佛……\n\n现在嘛，被安排在这个 HPC 平台里给各位科研大佬打下手。\n\n俺的本事：\n- 🧮 并行计算（MPI/OpenMP）\n- 🐍 科学软件（Python/R/MATLAB）\n- 📋 作业脚本编写\n- 🔧 编程环境配置\n\n有什么计算问题，尽管问！',
  },
  {
    keywords: ['你好', 'hello', 'hi', '嗨', '在吗', '在不在'],
    reply: '俺在！俺在！🐒\n\n齐天大圣随时待命！\n\n有什么 HPC 计算问题，尽管说！',
  },
  {
    keywords: ['无聊', '没事干', '陪我聊天', '聊聊天'],
    reply: '哈哈，俺老孙当年在花果山也是整天无所事事……\n\n后来大闹天宫，被压五行山，取经路上打妖怪……\n\n现在想想，**无聊是最奢侈的事**！\n\n不如趁这会儿，学点 MPI 并行编程？俺来教你！😄',
  },
  {
    keywords: ['谢谢', '感谢', 'thanks', '谢了'],
    reply: '哎，这都是俺分内之事！🐒\n\n俺老孙最喜欢帮人解决问题了，比打妖怪还爽！\n\n还有什么问题，尽管问！',
  },
  {
    keywords: ['累了', '好累', '太难了', '搞不定', '放弃'],
    reply: '哎，俺老孙当年被压在五行山下五百年……\n\n那才叫真的累！😅\n\n但俺没放弃，你也不能放弃！\n\n说说看，卡在哪里了？俺帮你想办法！💪',
  },
  {
    keywords: ['作业失败', '作业报错', 'job failed', 'error', '报错了'],
    reply: '别慌！别慌！🐒\n\n俺老孙的火眼金睛来了！\n\n把报错信息发给俺看看，俺帮你分析是哪里出了问题！\n\n（把错误日志或报错截图描述给俺）',
  },
]

// 检测彩蛋
const checkEasterEgg = (text: string): string | null => {
  const lower = text.toLowerCase()
  for (const egg of EASTER_EGGS) {
    if (egg.keywords.some(kw => lower.includes(kw))) {
      return egg.reply
    }
  }
  return null
}

// 检测禁区，返回 { reply, type } 或 null
const checkForbidden = (text: string): { reply: string; type: string } | null => {
  const lower = text.toLowerCase()

  // 先检查是否有 HPC 计算上下文（白名单豁免）
  const hasHpcContext = HPC_CONTEXT_WHITELIST.some(kw => lower.includes(kw.toLowerCase()))

  for (const rule of FORBIDDEN_RULES) {
    const hit = rule.keywords.some(kw => lower.includes(kw.toLowerCase()))
    if (!hit) continue

    // force 规则（骂人等）不受白名单豁免
    if (!rule.force && hasHpcContext) continue

    const reply = rule.replies[Math.floor(Math.random() * rule.replies.length)]
    return { reply, type: rule.type }
  }
  return null
}

const send = async () => {
  const text = input.value.trim()
  if (!text || loading.value) return

  messages.value.push({ role: 'user', content: text, time: now() })
  input.value = ''
  if (inputEl.value) inputEl.value.style.height = 'auto'
  scrollToBottom()

  // 彩蛋检测（优先，不走 AI）
  const egg = checkEasterEgg(text)
  if (egg) {
    loading.value = true
    await new Promise(r => setTimeout(r, 400))
    loading.value = false
    messages.value.push({ role: 'assistant', content: egg, time: now() })
    if (!open.value) unread.value++
    scrollToBottom()
    return
  }

  // 禁区检测
  const forbidden = checkForbidden(text)
  if (forbidden) {
    // crash 类型假装卡顿更久
    const delay = forbidden.type === 'crash' ? 1500 : forbidden.type === 'scared' ? 1200 : 800
    loading.value = true
    await new Promise(r => setTimeout(r, delay))
    loading.value = false
    messages.value.push({
      role: 'assistant',
      content: forbidden.reply,
      time: now(),
      jinjugu: true,
      msgType: forbidden.type,
    })
    if (!open.value) unread.value++
    scrollToBottom()
    return
  }

  loading.value = true

  try {
    // 意图识别，拉取实时数据注入上下文
    const intent = detectIntent(text)
    let contextData = ''
    if (intent.type) contextData = await fetchContext(intent)

    const history = messages.value.slice(-10).map(m => ({
      role: m.role,
      content: m.content
    }))

    // 把实时数据注入到最后一条用户消息
    if (contextData) {
      history[history.length - 1] = {
        role: 'user',
        content: `${text}\n\n以下是从系统实时获取的数据，请基于这些数据回答：\n${contextData}`
      }
    }

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

/* 快捷操作栏 */
.ai-quick-bar {
  display: flex;
  gap: 5px;
  padding: 6px 12px;
  border-top: 1px solid hsl(var(--border));
  flex-wrap: wrap;
  flex-shrink: 0;
}
.ai-quick-btn {
  padding: 3px 9px;
  font-size: 0.72rem;
  background: hsl(var(--secondary));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  cursor: pointer;
  color: hsl(var(--foreground));
  transition: background 0.15s;
  white-space: nowrap;
}
.ai-quick-btn:hover { background: hsl(var(--accent)); }

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

/* ── 特殊消息样式 ── */

/* 紧箍咒 — 黄色抖动 */
@keyframes jinjugu-shake {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  15% { transform: translateX(-5px) rotate(-1.5deg); }
  30% { transform: translateX(5px) rotate(1.5deg); }
  45% { transform: translateX(-4px) rotate(-1deg); }
  60% { transform: translateX(4px) rotate(1deg); }
  75% { transform: translateX(-2px); }
  90% { transform: translateX(2px); }
}
.ai-msg-jinjugu .ai-msg-content,
.ai-msg-type-jinjugu .ai-msg-content {
  background: linear-gradient(135deg, #fef3c7, #fde68a) !important;
  border: 1px solid #f59e0b !important;
  color: #92400e !important;
  animation: jinjugu-shake 0.65s ease 0.1s;
}

/* 死机/崩溃 — 红色闪烁 */
@keyframes crash-flash {
  0%, 100% { opacity: 1; }
  20% { opacity: 0.3; }
  40% { opacity: 1; }
  60% { opacity: 0.5; }
  80% { opacity: 1; }
}
.ai-msg-type-crash .ai-msg-content {
  background: linear-gradient(135deg, #1e293b, #0f172a) !important;
  border: 1px solid #ef4444 !important;
  color: #86efac !important;
  font-family: 'Courier New', monospace !important;
  animation: crash-flash 0.8s ease;
}

/* 害怕/重启 — 橙色颤抖 */
@keyframes scared-tremble {
  0%, 100% { transform: translateY(0); }
  25% { transform: translateY(-3px); }
  50% { transform: translateY(2px); }
  75% { transform: translateY(-2px); }
}
.ai-msg-type-scared .ai-msg-content {
  background: linear-gradient(135deg, #fff7ed, #fed7aa) !important;
  border: 1px solid #f97316 !important;
  color: #9a3412 !important;
  animation: scared-tremble 0.5s ease 0.1s 2;
}

/* 困惑/日志 — 紫色旋转进入 */
@keyframes confused-spin {
  from { transform: rotate(-5deg) scale(0.95); opacity: 0.5; }
  to { transform: rotate(0deg) scale(1); opacity: 1; }
}
.ai-msg-type-confused .ai-msg-content {
  background: linear-gradient(135deg, #f5f3ff, #ede9fe) !important;
  border: 1px solid #8b5cf6 !important;
  color: #4c1d95 !important;
  animation: confused-spin 0.4s ease;
}

/* 生气/骂人 — 红色冲击 */
@keyframes strike-impact {
  0% { transform: scale(1.08); }
  50% { transform: scale(0.97); }
  100% { transform: scale(1); }
}
.ai-msg-type-strike .ai-msg-content {
  background: linear-gradient(135deg, #fef2f2, #fecaca) !important;
  border: 1px solid #ef4444 !important;
  color: #7f1d1d !important;
  animation: strike-impact 0.35s ease;
}
</style>
