import { useState, useEffect, useRef } from 'react'
import { Card, Input, Button, Space, Avatar, Spin, message as Message, Empty, Tag, Tooltip } from 'antd'
import {
  SendOutlined, RobotOutlined, UserOutlined, ReloadOutlined,
  ThunderboltOutlined, BookOutlined, CodeOutlined, BulbOutlined,
} from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  status?: 'sending' | 'success' | 'error'
}

interface QuickPrompt {
  icon: React.ReactNode
  title: string
  prompt: string
  color: string
}

const quickPrompts: QuickPrompt[] = [
  {
    icon: <ThunderboltOutlined />,
    title: 'Slurm 作业脚本',
    prompt: '帮我写一个使用16核CPU和32GB内存的Slurm作业脚本，运行时间限制4小时',
    color: '#f59e0b',
  },
  {
    icon: <CodeOutlined />,
    title: 'Python 并行计算',
    prompt: '如何在Python中使用multiprocessing进行并行计算？请给出示例代码',
    color: '#3b82f6',
  },
  {
    icon: <BookOutlined />,
    title: 'MPI 使用指南',
    prompt: '在集群上如何使用MPI进行分布式计算？请解释基本概念和使用方法',
    color: '#8b5cf6',
  },
  {
    icon: <BulbOutlined />,
    title: '性能优化建议',
    prompt: '我的程序运行很慢，如何优化HPC作业的性能？',
    color: '#10b981',
  },
]

export default function AIAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<any>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // 初始化会话
    initSession()
  }, [])

  const initSession = async () => {
    try {
      const res = await axios.post('/ai/session')
      setSessionId(res.data.data.session_id)
      // 添加欢迎消息
      setMessages([
        {
          id: '0',
          role: 'assistant',
          content:
            '你好！我是算力小筑的 AI 助手，专门为高性能计算提供帮助。\n\n我可以协助你：\n- 编写和优化 Slurm 作业脚本\n- 解答 HPC 相关问题\n- 提供并行计算和性能优化建议\n- 推荐适合的工具和库\n\n有什么我可以帮助你的吗？',
          timestamp: new Date().toISOString(),
        },
      ])
    } catch (e: any) {
      Message.error('初始化会话失败')
    }
  }

  const handleSend = async (text?: string) => {
    const content = text || input.trim()
    if (!content) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      status: 'success',
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await axios.post('/ai/chat', {
        session_id: sessionId,
        message: content,
      })

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.data.data.response,
        timestamp: new Date().toISOString(),
        status: 'success',
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (e: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: e.response?.data?.error || '抱歉，处理您的请求时遇到了问题，请稍后重试。',
        timestamp: new Date().toISOString(),
        status: 'error',
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleReset = () => {
    setMessages([])
    initSession()
  }

  const renderMessage = (msg: ChatMessage) => {
    const isUser = msg.role === 'user'

    return (
      <div
        key={msg.id}
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 24,
          flexDirection: isUser ? 'row-reverse' : 'row',
        }}
      >
        <Avatar
          size={36}
          icon={isUser ? <UserOutlined /> : <RobotOutlined />}
          style={{
            background: isUser ? '#6366f1' : '#10b981',
            flexShrink: 0,
          }}
        />
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: isUser ? 'flex-end' : 'flex-start',
          }}
        >
          <div
            style={{
              maxWidth: '70%',
              padding: '12px 16px',
              borderRadius: 12,
              background: isUser ? '#6366f1' : '#f1f5f9',
              color: isUser ? '#fff' : '#1e293b',
              fontSize: 14,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {msg.content}
          </div>
          <div
            style={{
              fontSize: 11,
              color: '#94a3b8',
              marginTop: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {dayjs(msg.timestamp).format('HH:mm:ss')}
            {msg.status === 'error' && <Tag color="error">发送失败</Tag>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', gap: 16 }}>
      {/* 头部 */}
      <Card size="small" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <RobotOutlined style={{ fontSize: 20, color: '#10b981' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>AI 计算助手</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                专为高性能计算优化，提供智能问答和代码建议
              </div>
            </div>
          </Space>
          <Button icon={<ReloadOutlined />} onClick={handleReset} size="small">
            重置会话
          </Button>
        </div>
      </Card>

      {/* 快速提示 - 只在没有消息时显示 */}
      {messages.length <= 1 && (
        <Card size="small" style={{ flexShrink: 0 }}>
          <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 500, color: '#475569' }}>
            快速开始
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
            {quickPrompts.map((item, idx) => (
              <div
                key={idx}
                onClick={() => handleSend(item.prompt)}
                style={{
                  padding: 12,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: '#fff',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = item.color
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <Space>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: `${item.color}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: item.color,
                      fontSize: 16,
                    }}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 2 }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>
                      {item.prompt.slice(0, 30)}...
                    </div>
                  </div>
                </Space>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 消息列表 */}
      <Card
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
        bodyStyle={{
          flex: 1,
          overflow: 'auto',
          padding: messages.length === 0 ? 0 : 24,
        }}
      >
        {messages.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="开始对话吧！"
            style={{ margin: 'auto' }}
          />
        ) : (
          <div>
            {messages.map(renderMessage)}
            {loading && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                <Avatar size={36} icon={<RobotOutlined />} style={{ background: '#10b981' }} />
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: '#f1f5f9',
                  }}
                >
                  <Spin size="small" />
                  <span style={{ marginLeft: 8, color: '#64748b', fontSize: 13 }}>正在思考...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </Card>

      {/* 输入框 */}
      <Card size="small" style={{ flexShrink: 0 }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input.TextArea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="输入您的问题... (Shift+Enter 换行)"
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={loading}
            style={{ resize: 'none' }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={() => handleSend()}
            loading={loading}
            disabled={!input.trim()}
            style={{ height: 'auto' }}
          >
            发送
          </Button>
        </Space.Compact>
        <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
          AI 助手基于大语言模型，回答仅供参考。对于关键任务，请查阅官方文档或咨询管理员。
        </div>
      </Card>
    </div>
  )
}
