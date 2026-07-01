import { useState, useRef, useEffect, useCallback } from 'react'
import axios from 'axios'
import { getUser, getToken } from '@/utils/auth'

interface Message {
  role: 'user' | 'assistant'
  content: string
  time: string
  type?: string
  jinjugu?: boolean
}

// 快捷操作建议
const SUGGESTIONS = [
  '查看我的作业列表',
  '生成机时使用报表',
  '如何用 MPI 并行运行程序？',
  '作业一直排队怎么办？',
  '帮我生成一个 GPU 作业脚本',
  '如何使用 module 加载软件？',
]

// 禁区规则
const FORBIDDEN_RULES = [
  {
    keywords: ['添加用户', '删除用户', '创建用户账号', '重置用户密码', '修改系统配置', '修改slurm配置', '服务器运维', '集群运维', '管理后台', '后台管理'],
    type: 'jinjugu',
    replies: [
      '哎哟！头好痛！🤕\n\n师父又念紧箍咒了！「**嗡嘛呢叭咪吽……**」\n\n俺老孙只管帮用户跑程序、搞科学计算，运维的事儿师父不让管！\n\n👉 这种问题请找**系统管理员**！',
      '「紧箍咒」发动！😵‍💫\n\n头……头好疼……俺老孙只负责帮你跑 MPI、调 Python、提交作业！\n\n🙏 请联系**管理员**，他们有"如来佛祖"级别的权限！',
    ],
  },
  {
    keywords: ['节点宕机了', '服务器挂了', '服务器崩了', 'kernel panic', '硬件故障', '磁盘坏了'],
    type: 'crash',
    replies: [
      '哎……俺老孙也……突然……\n\n```\nKernel panic - not syncing: 听到"宕机"二字\n悟空进程已停止\n```\n\n开玩笑的！😄 这种**硬件/系统故障**请联系**系统管理员**现场处理！',
    ],
  },
  {
    keywords: ['重启节点', '重启服务器', '重启集群', '关闭服务器'],
    type: 'scared',
    replies: [
      '等等等等！！😱\n\n"重启"这个词！会中断所有正在运行的作业！\n\n🚨 请联系**系统管理员**，他们会安排维护窗口！',
    ],
  },
  {
    keywords: ['傻逼', '废物', '垃圾系统', '蠢货', '白痴', '脑残', 'fuck you'],
    type: 'strike',
    force: true,
    replies: [
      '俺老孙忍了。\n\n「**嗡嘛呢叭咪吽**」——让自己冷静一下。\n\n有什么正经问题，说吧。😑',
    ],
  },
]

// 彩蛋
const EASTER_EGGS = [
  { keywords: ['你是谁', '你叫什么', '自我介绍', '介绍一下自己'], reply: '🐒✨ 俺乃——**齐天大圣孙悟空**是也！\n\n花果山出身，如今镇守此 **HPC 高性能计算平台**！\n\n🧮 并行计算 · 🐍 科学软件 · 📋 作业调度 · 🔧 环境配置\n\n有什么计算难题，尽管问俺老孙！💪', type: 'intro' },
  { keywords: ['你好', 'hello', 'hi', '嗨', '在吗'], reply: '俺在！俺在！🐒\n\n**齐天大圣**随时待命！有什么 HPC 问题，尽管说！', type: 'welcome' },
  { keywords: ['谢谢', '感谢', 'thanks', '谢了'], reply: '哎，这都是俺分内之事！🐒\n\n俺老孙最喜欢帮人解决问题了，比打妖怪还爽！', type: 'success' },
  { keywords: ['累了', '好累', '太难了', '搞不定', '放弃'], reply: '俺老孙当年被压在五行山下**五百年**……那才叫真的累！😅\n\n说说看，卡在哪里了？俺帮你想办法！💪', type: 'welcome' },
]

function renderMarkdown(text: string): string {
  return text
    .replace(/```([\s\S]*?)```/g, '<pre style="background:#1e1e1e;color:#e8e8e8;padding:10px;border-radius:6px;font-size:12px;overflow-x:auto;margin:6px 0">$1</pre>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
}

function now() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

export default function AIAssistant() {
  const [open, setOpen]         = useState(false)
  const [maximized, setMaximized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [unread, setUnread]     = useState(0)
  const messagesRef = useRef<HTMLDivElement>(null)
  const inputRef    = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }, 50)
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  const addMsg = (msg: Message) => setMessages(prev => [...prev, msg])

  const checkForbidden = (text: string) => {
    const lower = text.toLowerCase()
    for (const rule of FORBIDDEN_RULES) {
      if (rule.keywords.some(kw => lower.includes(kw))) {
        return rule.replies[Math.floor(Math.random() * rule.replies.length)]
      }
    }
    return null
  }

  const checkEasterEgg = (text: string) => {
    const lower = text.toLowerCase()
    for (const egg of EASTER_EGGS) {
      if (egg.keywords.some(kw => lower.includes(kw))) return egg
    }
    return null
  }

  const fetchContext = async (text: string): Promise<string> => {
    const lower = text.toLowerCase()
    const token = getToken() || ''
    const headers = { Authorization: `Bearer ${token}` }
    try {
      if (/查看.*(作业|job)|我的作业|作业列表/.test(lower)) {
        const user = getUser()?.username || ''
        const res = await axios.get('/jobs', { params: { page: 1, page_size: 20, user }, headers })
        const jobs: any[] = res.data.data || []
        if (!jobs.length) return '【当前无作业数据】'
        return `【作业列表（最近${jobs.length}条）】\n` + jobs.slice(0, 15).map((j: any) =>
          `- ID:${j.job_id} ${j.name} ${j.job_state} ${j.partition}`).join('\n')
      }
      if (/机时|报表|使用情况|billing|usage/.test(lower)) {
        const user = getUser()?.username || ''
        const now2 = new Date()
        const start = new Date(now2.getTime() - 30 * 86400000).toISOString().split('T')[0]
        const res = await axios.get('/usage/user', { params: { user, start_time: start, end_time: now2.toISOString().split('T')[0] }, headers })
        const jobs: any[] = res.data.data || []
        const cpuH = jobs.reduce((s, j) => s + (j.cpu_hours || 0), 0)
        return `【近30天机时报表 用户:${user}】\n总作业:${jobs.length} CPU核时:${cpuH.toFixed(2)}`
      }
      if (/分区|partition|队列/.test(lower) && /有哪些|列表|查看/.test(lower)) {
        const res = await axios.get('/jobs/partitions/list', { headers })
        const parts: any[] = res.data.data || []
        return `【可用分区】\n` + parts.map((p: any) => `- ${p.name}: 节点${p.total_nodes || '-'}个`).join('\n')
      }
    } catch (e: any) {
      return `【API调用失败: ${e.response?.data?.error || e.message}】`
    }
    return ''
  }

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    addMsg({ role: 'user', content: text, time: now() })
    setLoading(true)

    // 禁区检测
    const forbidden = checkForbidden(text)
    if (forbidden) {
      setTimeout(() => {
        addMsg({ role: 'assistant', content: forbidden, time: now(), jinjugu: true })
        setLoading(false)
      }, 600)
      return
    }

    // 彩蛋检测
    const egg = checkEasterEgg(text)
    if (egg) {
      setTimeout(() => {
        addMsg({ role: 'assistant', content: egg.reply, time: now(), type: egg.type })
        setLoading(false)
      }, 400)
      return
    }

    try {
      const context = await fetchContext(text)
      const res = await axios.post('/ai/chat', {
        message: context ? `${context}\n\n用户问题：${text}` : text
      })
      const reply = res.data.data?.response || res.data.response || '抱歉，处理请求时出错了。'
      addMsg({ role: 'assistant', content: reply, time: now() })
    } catch (e: any) {
      addMsg({ role: 'assistant', content: e.response?.data?.error || '抱歉，出错了，请稍后重试。', time: now() })
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const toggle = () => {
    setOpen(v => !v)
    if (!open) setUnread(0)
  }

  const clear = () => setMessages([])

  // ── render ────────────────────────────────────────────────
  const winW  = maximized ? 'min(90vw, 900px)' : '380px'
  const winH  = maximized ? 'min(90vh, 800px)' : '560px'

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>

      {/* 悬浮触发按钮 */}
      {!maximized && (
        <button
          onClick={toggle}
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            border: 'none', cursor: 'pointer', fontSize: 26,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            position: 'relative'
          }}
          onMouseEnter={e => { (e.currentTarget as any).style.transform = 'scale(1.1)' }}
          onMouseLeave={e => { (e.currentTarget as any).style.transform = 'scale(1)' }}
          title={open ? '关闭助手' : '打开 AI 助手'}
        >
          🐒
          {!open && unread > 0 && (
            <span style={{ position: 'absolute', top: -2, right: -2, background: '#ef4444', color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
              {unread}
            </span>
          )}
        </button>
      )}

      {/* 聊天窗口 */}
      {open && (
        <div style={{
          position: 'fixed', bottom: maximized ? '5vh' : 90, right: maximized ? '5vw' : 24,
          width: winW, height: winH,
          background: '#fff', borderRadius: 16,
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', transition: 'all 0.3s',
          border: '1px solid #e8e8e8'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>🐒</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>HPC 应用助手</div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>并行计算 · 科学软件 · 编程环境</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { icon: '🗑️', title: '清空对话', onClick: clear },
                { icon: maximized ? '⊡' : '⊞', title: maximized ? '还原' : '最大化', onClick: () => setMaximized(v => !v) },
                { icon: '✕', title: '关闭', onClick: toggle },
              ].map((btn, i) => (
                <button key={i} onClick={btn.onClick} title={btn.title} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', width: 28, height: 28, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.3)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
                >
                  {btn.icon}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div ref={messagesRef} style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🐒</div>
                <div style={{ fontSize: 13, color: '#555', marginBottom: 16, lineHeight: 1.6 }}>
                  你好！我是 HPC 应用助手，可以帮你解答并行计算、科学软件使用、编程环境配置等问题。
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                  {SUGGESTIONS.map((s, i) => (
                    <button key={i} onClick={() => { setInput(s); setTimeout(() => inputRef.current?.focus(), 50) }}
                      style={{ padding: '5px 10px', background: '#f0f0ff', border: '1px solid #c7d2fe', borderRadius: 14, cursor: 'pointer', fontSize: 12, color: '#6366f1', transition: 'all 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#e0e7ff')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#f0f0ff')}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => {
              const isUser = msg.role === 'user'
              return (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 16, flexDirection: isUser ? 'row-reverse' : 'row' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, background: isUser ? '#6366f1' : '#f0f0f0' }}>
                    {isUser ? '👤' : '🐒'}
                  </div>
                  <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                    <div
                      style={{
                        padding: '10px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.6, wordBreak: 'break-word',
                        background: isUser ? '#6366f1' : msg.jinjugu ? '#fff7e6' : '#f5f5f5',
                        color: isUser ? '#fff' : '#222',
                        border: msg.jinjugu ? '1px solid #ffd591' : 'none',
                        animation: 'fadeIn 0.2s ease'
                      }}
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                    />
                    <div style={{ fontSize: 10, color: '#bbb', marginTop: 4 }}>{msg.time}</div>
                  </div>
                </div>
              )
            })}

            {loading && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🐒</div>
                <div style={{ padding: '10px 14px', background: '#f5f5f5', borderRadius: 12, display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0, 1, 2].map(j => (
                    <span key={j} style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1', display: 'inline-block', animation: `bounce 1.2s ${j * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 快捷操作栏 */}
          <div style={{ padding: '6px 12px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 4, flexWrap: 'wrap', flexShrink: 0, background: '#fafafa' }}>
            {[
              { icon: '📋', label: '我的作业', text: '查看我的作业列表' },
              { icon: '📊', label: '机时报表', text: '生成我的机时使用报表' },
              { icon: '🚀', label: '生成脚本', text: '帮我生成一个MPI作业脚本' },
              { icon: '🔍', label: '分析问题', text: '帮我分析这个错误：' },
            ].map((btn, i) => (
              <button key={i} onClick={() => { setInput(btn.text); setTimeout(() => inputRef.current?.focus(), 50) }}
                style={{ padding: '3px 8px', background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12, cursor: 'pointer', fontSize: 11, color: '#555', display: 'flex', alignItems: 'center', gap: 3 }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#6366f1')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#e8e8e8')}
              >
                {btn.icon} {btn.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding: '8px 12px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="问俺老孙任何 HPC 问题... (Enter发送)"
              rows={1}
              disabled={loading}
              style={{ flex: 1, border: '1px solid #d9d9d9', borderRadius: 8, padding: '8px 10px', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, maxHeight: 100, overflowY: 'auto' }}
              onInput={e => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 100) + 'px'
              }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              style={{
                width: 36, height: 36, borderRadius: 8, border: 'none',
                background: loading || !input.trim() ? '#e8e8e8' : '#6366f1',
                color: loading || !input.trim() ? '#aaa' : '#fff',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}
            >
              ➤
            </button>
          </div>
          <div style={{ padding: '4px 12px 8px', fontSize: 10, color: '#bbb', textAlign: 'center' }}>
            Enter 发送 · Shift+Enter 换行
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:scale(0.6)} 40%{transform:scale(1)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}
