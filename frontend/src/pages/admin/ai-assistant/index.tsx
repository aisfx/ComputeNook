import React, { useState, useRef, useEffect } from 'react'
import {
  Card, Input, Button, Space, Typography, Spin, Empty, Divider, Tag, App, Row, Col, Statistic,
} from 'antd'
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  DeleteOutlined,
  BarChartOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import axios from 'axios'

const { TextArea } = Input
const { Text } = Typography

// ─── 类型 ─────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

interface ClusterStats {
  nodes_total: number
  nodes_up: number
  jobs_running: number
  jobs_pending: number
  cpu_utilization: number
  gpu_utilization: number
  memory_utilization: number
}

// ─── 预设场景 ─────────────────────────────────────────────
const SCENARIOS = [
  {
    key: 'resource-analysis',
    label: '资源分析',
    icon: <BarChartOutlined />,
    prompt: '请分析当前集群的资源使用情况，包括节点状态、作业队列、CPU/GPU利用率等，并给出优化建议。',
  },
  {
    key: 'troubleshooting',
    label: '问题诊断',
    icon: <ThunderboltOutlined />,
    prompt: '请帮我诊断集群中可能存在的问题，比如异常节点、等待时间过长的作业、资源瓶颈等。',
  },
  {
    key: 'performance',
    label: '性能优化',
    icon: <ClockCircleOutlined />,
    prompt: '请分析集群性能瓶颈，并提供调优建议，包括资源配置、QoS策略、作业调度等方面。',
  },
]

// ─── 主组件 ──────────────────────────────────────────────
export default function AIAssistant() {
  const { message: toast } = App.useApp()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<ClusterStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 加载集群统计
  const loadStats = async () => {
    setStatsLoading(true)
    try {
      const res = await axios.get('/api/dashboard/stats')
      setStats(res.data.data)
    } catch (err: any) {
      console.error('加载统计失败:', err)
    } finally {
      setStatsLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  // 构建系统提示（包含集群数据）
  const buildSystemPrompt = (): string => {
    if (!stats) {
      return '你是一个专业的HPC集群管理AI助手，请用中文回答管理员的问题。'
    }

    return `你是一个专业的HPC集群管理AI助手，请用中文回答管理员的问题。

当前集群状态：
- 节点总数：${stats.nodes_total}
- 在线节点：${stats.nodes_up}
- 运行中作业：${stats.jobs_running}
- 等待中作业：${stats.jobs_pending}
- CPU利用率：${stats.cpu_utilization?.toFixed(1)}%
- GPU利用率：${stats.gpu_utilization?.toFixed(1)}%
- 内存利用率：${stats.memory_utilization?.toFixed(1)}%

请基于以上数据分析问题并提供建议。`
  }

  // 发送消息
  const sendMessage = async (customInput?: string) => {
    const content = customInput || input.trim()
    if (!content) return

    const userMsg: Message = {
      role: 'user',
      content,
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      // 构建消息列表（包含系统提示）
      const systemMsg: Message = {
        role: 'system',
        content: buildSystemPrompt(),
        timestamp: Date.now(),
      }

      const apiMessages = [
        systemMsg,
        ...messages.filter((m) => m.role !== 'system'),
        userMsg,
      ]

      const res = await axios.post('/api/ai/admin/chat', {
        messages: apiMessages,
      })

      const assistantMsg: Message = {
        role: 'assistant',
        content: res.data.content,
        timestamp: Date.now(),
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'AI请求失败')
      // 移除用户消息
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  // 清空对话
  const clearMessages = () => {
    setMessages([])
  }

  // 快捷场景
  const handleScenario = (scenario: typeof SCENARIOS[0]) => {
    sendMessage(scenario.prompt)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* 页头 */}
      <Card size="small" bordered={false}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <RobotOutlined style={{ fontSize: 20, color: '#6366f1' }} />
            <span style={{ fontSize: 18, fontWeight: 600 }}>AI 管理助手</span>
            <Tag color="blue">智能诊断</Tag>
          </Space>
          <Space>
            <Button
              size="small"
              icon={<DeleteOutlined />}
              onClick={clearMessages}
              disabled={messages.length === 0}
            >
              清空对话
            </Button>
          </Space>
        </div>
      </Card>

      {/* 集群状态卡片 */}
      <Card
        size="small"
        bordered={false}
        loading={statsLoading}
        title={
          <Space>
            <BarChartOutlined />
            <span style={{ fontSize: 14 }}>集群状态概览</span>
          </Space>
        }
      >
        {stats && (
          <Row gutter={16}>
            <Col xs={12} sm={6}>
              <Statistic
                title="节点状态"
                value={stats.nodes_up}
                suffix={`/ ${stats.nodes_total}`}
                valueStyle={{ fontSize: 20, color: '#10b981' }}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="运行作业"
                value={stats.jobs_running}
                valueStyle={{ fontSize: 20, color: '#3b82f6' }}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="等待作业"
                value={stats.jobs_pending}
                valueStyle={{ fontSize: 20, color: '#f59e0b' }}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="CPU利用率"
                value={stats.cpu_utilization?.toFixed(1)}
                suffix="%"
                valueStyle={{
                  fontSize: 20,
                  color: stats.cpu_utilization > 80 ? '#ef4444' : '#6366f1',
                }}
              />
            </Col>
          </Row>
        )}
      </Card>

      {/* 快捷场景 */}
      {messages.length === 0 && (
        <Card size="small" bordered={false} title={<span style={{ fontSize: 14 }}>快捷场景</span>}>
          <Space wrap>
            {SCENARIOS.map((scenario) => (
              <Button
                key={scenario.key}
                icon={scenario.icon}
                onClick={() => handleScenario(scenario)}
                disabled={loading}
              >
                {scenario.label}
              </Button>
            ))}
          </Space>
        </Card>
      )}

      {/* 对话区域 */}
      <Card
        bordered={false}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        styles={{ body: { flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', padding: 16 } }}
      >
        {messages.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="开始与AI助手对话，获取集群管理建议"
            style={{ marginTop: 80 }}
          />
        ) : (
          <div style={{ flex: 1, overflow: 'auto' }}>
            {messages
              .filter((m) => m.role !== 'system')
              .map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    gap: 12,
                    marginBottom: 24,
                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  }}
                >
                  {/* 头像 */}
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: msg.role === 'user' ? '#3b82f6' : '#6366f1',
                      color: '#fff',
                      flexShrink: 0,
                    }}
                  >
                    {msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                  </div>

                  {/* 消息内容 */}
                  <div
                    style={{
                      flex: 1,
                      maxWidth: '80%',
                      background: msg.role === 'user' ? '#f0f9ff' : '#f8fafc',
                      borderRadius: 12,
                      padding: '12px 16px',
                      border: '1px solid',
                      borderColor: msg.role === 'user' ? '#bae6fd' : '#e2e8f0',
                    }}
                  >
                    <div style={{ 
                      whiteSpace: 'pre-wrap', 
                      lineHeight: 1.7,
                      fontSize: msg.role === 'assistant' ? 14 : undefined,
                    }}>
                      {msg.content}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}

            {loading && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#6366f1',
                    color: '#fff',
                  }}
                >
                  <RobotOutlined />
                </div>
                <div
                  style={{
                    background: '#f8fafc',
                    borderRadius: 12,
                    padding: '12px 16px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <Spin size="small" />
                  <Text style={{ marginLeft: 8, color: '#64748b' }}>AI 正在思考...</Text>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        <Divider style={{ margin: '16px 0' }} />

        {/* 输入框 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入您的问题，例如：分析当前集群的资源利用率..."
            autoSize={{ minRows: 2, maxRows: 6 }}
            onPressEnter={(e) => {
              if (e.ctrlKey || e.metaKey) {
                sendMessage()
              }
            }}
            disabled={loading}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={() => sendMessage()}
            loading={loading}
            disabled={!input.trim()}
            size="large"
            style={{ height: 'auto' }}
          >
            发送
          </Button>
        </div>
        <Text type="secondary" style={{ fontSize: 11, marginTop: 8 }}>
          按 Ctrl+Enter 快速发送
        </Text>
      </Card>
    </div>
  )
}
