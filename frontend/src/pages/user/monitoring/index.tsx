import { useState, useEffect, useCallback } from 'react'
import { Card, Row, Col, Tag, Progress, Button, Spin, Empty, Table, Space, Statistic, Tabs } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ReloadOutlined, CheckCircleOutlined, WarningOutlined, ThunderboltOutlined,
  DatabaseOutlined, HddOutlined, DesktopOutlined, ApiOutlined, ClockCircleOutlined,
  CloudServerOutlined, SafetyOutlined, DashboardOutlined
} from '@ant-design/icons'
import axios from 'axios'

// ─── 类型定义 ─────────────────────────────────────────────────
interface Overview {
  total_nodes: number; idle_nodes: number; allocated_nodes: number; down_nodes: number
  total_cpus: number; idle_cpus: number; allocated_cpus: number
  total_gpus: number; idle_gpus: number
  total_memory_gb: number; idle_memory_gb: number; allocated_memory_gb: number
  total_jobs: number; running_jobs: number; pending_jobs: number
}

interface NodeMetric {
  node_name: string; state: string
  cpu_total: number; cpu_alloc: number; cpu_load: number
  mem_total_gb: number; mem_alloc_gb: number; mem_used_gb: number
  gpu_total?: number; gpu_alloc?: number
  net_rx_bps?: number; net_tx_bps?: number
  partition: string; features?: string
}

interface PromAlert {
  labels: { alertname: string; severity: string; [k: string]: string }
  annotations: { summary: string; description?: string }
  state: string; activeAt: string
}

// ─── 节点状态配置 ─────────────────────────────────────────────
const NODE_STATE_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  idle: { color: '#52c41a', label: '空闲', icon: '●' },
  allocated: { color: '#1890ff', label: '已分配', icon: '●' },
  mixed: { color: '#fa8c16', label: '混合', icon: '●' },
  down: { color: '#ff4d4f', label: '故障', icon: '●' },
  drained: { color: '#8c8c8c', label: '已排空', icon: '●' },
  draining: { color: '#faad14', label: '排空中', icon: '●' }
}

// ─── 工具函数 ─────────────────────────────────────────────────
function formatBandwidth(bps: number): string {
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(2)} Gbps`
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(2)} Mbps`
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(2)} Kbps`
  return `${bps.toFixed(0)} bps`
}

// ─── 仪表盘组件 ───────────────────────────────────────────────
function GaugeCard({ title, value, total, unit, icon, color }: {
  title: string; value: number; total: number; unit: string; icon: React.ReactNode; color: string
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <Card bordered={false} style={{ background: '#fff', borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#333' }}>
            {value}<span style={{ fontSize: 14, fontWeight: 400, color: '#999' }}>/{total}</span>
          </div>
        </div>
      </div>
      <Progress percent={percent} strokeColor={color} trailColor='#f0f0f0' showInfo={false} style={{ marginBottom: 8 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#999' }}>
        <span>使用率</span>
        <span style={{ color, fontWeight: 600 }}>{percent}%</span>
      </div>
    </Card>
  )
}

export default function Monitoring() {
  const [loading, setLoading] = useState(false)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [nodes, setNodes] = useState<NodeMetric[]>([])
  const [alerts, setAlerts] = useState<PromAlert[]>([])
  const [promConnected, setPromConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState('')
  const [activeTab, setActiveTab] = useState('resource')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [overviewRes, nodesRes, alertsRes] = await Promise.allSettled([
        axios.get('/monitoring/overview'),
        axios.get('/monitoring/node-metrics'),
        axios.get('/monitoring/prom-alerts').catch(() => ({ data: { data: { alerts: [] } } }))
      ])
      if (overviewRes.status === 'fulfilled') {
        setOverview(overviewRes.value.data.data)
        setPromConnected(true)
      } else { setPromConnected(false) }
      if (nodesRes.status === 'fulfilled') setNodes(nodesRes.value.data.data || [])
      if (alertsRes.status === 'fulfilled') setAlerts(alertsRes.value.data.data?.alerts || [])
      setLastUpdate(new Date().toLocaleTimeString('zh-CN'))
    } catch (err) {
      console.error('加载监控数据失败:', err)
      setPromConnected(false)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    loadData()
    const timer = setInterval(loadData, 30000)
    return () => clearInterval(timer)
  }, [loadData])

  const nodeStats = nodes.reduce((acc, node) => {
    const state = node.state?.toLowerCase() || 'unknown'
    acc[state] = (acc[state] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // 资源使用表格
  const resourceColumns: ColumnsType<NodeMetric> = [
    { title: '节点名称', dataIndex: 'node_name', key: 'node_name', width: 180, fixed: 'left',
      render: (name: string) => <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{name}</span> },
    { title: '状态', dataIndex: 'state', key: 'state', width: 100,
      render: (state: string) => {
        const stateKey = state?.toLowerCase() || 'unknown'
        const config = NODE_STATE_CONFIG[stateKey] || { color: '#8c8c8c', label: state, icon: '●' }
        return <Tag color={config.color} style={{ margin: 0 }}>{config.icon} {config.label}</Tag>
      } },
    { title: '分区', dataIndex: 'partition', key: 'partition', width: 120,
      render: (partition: string) => <span style={{ fontSize: 12, color: '#666' }}>{partition || '-'}</span> },
    { title: 'CPU 使用', key: 'cpu', width: 200,
      render: (_, record) => {
        const percent = record.cpu_total > 0 ? Math.round((record.cpu_alloc / record.cpu_total) * 100) : 0
        return (
          <div>
            <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#666' }}>{record.cpu_alloc}/{record.cpu_total} 核</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1890ff' }}>{percent}%</span>
            </div>
            <Progress percent={percent} strokeColor='#1890ff' trailColor='#f0f0f0' size="small" showInfo={false}
              status={percent > 90 ? 'exception' : 'normal'} />
          </div>
        )
      } },
    { title: '内存使用', key: 'memory', width: 200,
      render: (_, record) => {
        const percent = record.mem_total_gb > 0 ? Math.round((record.mem_alloc_gb / record.mem_total_gb) * 100) : 0
        return (
          <div>
            <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#666' }}>
                {record.mem_alloc_gb.toFixed(1)}/{record.mem_total_gb.toFixed(1)} GB
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#52c41a' }}>{percent}%</span>
            </div>
            <Progress percent={percent} strokeColor='#52c41a' trailColor='#f0f0f0' size="small" showInfo={false}
              status={percent > 90 ? 'exception' : 'normal'} />
          </div>
        )
      } },
    { title: 'GPU', key: 'gpu', width: 100, align: 'center' as const,
      render: (_, record) => !record.gpu_total || record.gpu_total === 0 ? <span style={{ color: '#ccc' }}>-</span> :
        <span style={{ fontWeight: 600, color: '#fa8c16' }}>{record.gpu_alloc || 0}/{record.gpu_total}</span> },
    { title: '负载', dataIndex: 'cpu_load', key: 'cpu_load', width: 100, align: 'right' as const,
      render: (load: number, record) => {
        const isOverload = load > record.cpu_total
        return load > 0 ? <span style={{ color: isOverload ? '#ff4d4f' : '#666', fontWeight: isOverload ? 600 : 400 }}>
          {load.toFixed(1)}</span> : <span style={{ color: '#ccc' }}>-</span>
      } }
  ]

  // 网络IO表格
  const networkColumns: ColumnsType<NodeMetric> = [
    { title: '节点名称', dataIndex: 'node_name', key: 'node_name', width: 180, fixed: 'left',
      render: (name: string) => <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{name}</span> },
    { title: '状态', dataIndex: 'state', key: 'state', width: 100,
      render: (state: string) => {
        const stateKey = state?.toLowerCase() || 'unknown'
        const config = NODE_STATE_CONFIG[stateKey] || { color: '#8c8c8c', label: state, icon: '●' }
        return <Tag color={config.color} style={{ margin: 0 }}>{config.icon} {config.label}</Tag>
      } },
    { title: '入站流量', key: 'net_rx', width: 180,
      render: (_, record) => {
        const rx = record.net_rx_bps || 0
        return (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1890ff' }}>{formatBandwidth(rx)}</div>
            <div style={{ fontSize: 11, color: '#999' }}>{rx > 0 ? `${(rx / 1024 / 1024).toFixed(2)} MB/s` : '-'}</div>
          </div>
        )
      },
      sorter: (a, b) => (a.net_rx_bps || 0) - (b.net_rx_bps || 0) },
    { title: '出站流量', key: 'net_tx', width: 180,
      render: (_, record) => {
        const tx = record.net_tx_bps || 0
        return (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#52c41a' }}>{formatBandwidth(tx)}</div>
            <div style={{ fontSize: 11, color: '#999' }}>{tx > 0 ? `${(tx / 1024 / 1024).toFixed(2)} MB/s` : '-'}</div>
          </div>
        )
      },
      sorter: (a, b) => (a.net_tx_bps || 0) - (b.net_tx_bps || 0) },
    { title: '总流量', key: 'net_total', width: 180,
      render: (_, record) => {
        const total = (record.net_rx_bps || 0) + (record.net_tx_bps || 0)
        return (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#722ed1' }}>{formatBandwidth(total)}</div>
            <div style={{ fontSize: 11, color: '#999' }}>{total > 0 ? `${(total / 1024 / 1024).toFixed(2)} MB/s` : '-'}</div>
          </div>
        )
      },
      sorter: (a, b) => {
        const totalA = (a.net_rx_bps || 0) + (a.net_tx_bps || 0)
        const totalB = (b.net_rx_bps || 0) + (b.net_tx_bps || 0)
        return totalA - totalB
      } },
    { title: '流量可视化', key: 'net_visual', width: 200,
      render: (_, record) => {
        const rx = record.net_rx_bps || 0
        const tx = record.net_tx_bps || 0
        const maxBandwidth = 10e9 // 最大带宽 10Gbps
        const rxPercent = Math.min((rx / maxBandwidth) * 100, 100)
        const txPercent = Math.min((tx / maxBandwidth) * 100, 100)
        return (
          <div>
            <div style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: '#1890ff' }}>↓ 入站</span>
              <Progress percent={rxPercent} strokeColor='#1890ff' size="small" showInfo={false} style={{ margin: '2px 0' }} />
            </div>
            <div>
              <span style={{ fontSize: 11, color: '#52c41a' }}>↑ 出站</span>
              <Progress percent={txPercent} strokeColor='#52c41a' size="small" showInfo={false} style={{ margin: '2px 0' }} />
            </div>
          </div>
        )
      } },
    { title: '分区', dataIndex: 'partition', key: 'partition', width: 120 }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 页面头部 */}
      <Card size="small" bordered={false}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <DashboardOutlined style={{ fontSize: 20, color: '#1890ff' }} />
            <span style={{ fontSize: 18, fontWeight: 600 }}>集群监控</span>
            <Tag color={promConnected ? 'success' : 'error'} 
              icon={promConnected ? <CheckCircleOutlined /> : <WarningOutlined />}>
              {promConnected ? '监控正常' : '监控异常'}
            </Tag>
            {alerts.length > 0 && <Tag color="warning" icon={<WarningOutlined />}>{alerts.length} 个告警</Tag>}
            {lastUpdate && <span style={{ fontSize: 12, color: '#999', marginLeft: 8 }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />{lastUpdate}</span>}
          </Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading} type="primary" size="small">刷新</Button>
        </div>
      </Card>

      {loading && !overview ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Spin size="large" tip="加载中..." />
        </div>
      ) : !overview ? (
        <Empty description="无法获取监控数据" />
      ) : (
        <>
          {/* 统计卡片 */}
          <Row gutter={16}>
            <Col xs={24} sm={12} lg={6}>
              <GaugeCard title="CPU 核心" value={overview.allocated_cpus} total={overview.total_cpus}
                unit="核" icon={<ThunderboltOutlined />} color="#1890ff" />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <GaugeCard title="内存" value={Math.round(overview.allocated_memory_gb)} 
                total={Math.round(overview.total_memory_gb)} unit="GB" icon={<DatabaseOutlined />} color="#52c41a" />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <GaugeCard title="GPU 卡数" value={overview.total_gpus - overview.idle_gpus} total={overview.total_gpus}
                unit="卡" icon={<HddOutlined />} color="#fa8c16" />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <GaugeCard title="运行作业" value={overview.running_jobs} total={overview.total_jobs}
                unit="个" icon={<ApiOutlined />} color="#722ed1" />
            </Col>
          </Row>

          {/* 节点状态统计 */}
          <Card title={<Space><CloudServerOutlined />节点状态分布</Space>} bordered={false}>
            <Row gutter={16}>
              {Object.entries(NODE_STATE_CONFIG).map(([key, config]) => {
                const count = nodeStats[key] || 0
                return (
                  <Col key={key} xs={12} sm={8} lg={4}>
                    <Card size="small" style={{ background: `${config.color}08`, border: `1px solid ${config.color}30` }}>
                      <Statistic
                        title={<span style={{ color: config.color, fontSize: 13 }}>{config.icon} {config.label}</span>}
                        value={count} suffix="台"
                        valueStyle={{ fontSize: 24, fontWeight: 700, color: config.color }}
                      />
                    </Card>
                  </Col>
                )
              })}
            </Row>
          </Card>

          {/* 多维度监控 Tab */}
          <Card bordered={false}>
            <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
              { key: 'resource', label: <span><DesktopOutlined />资源使用</span>,
                children: <Table columns={resourceColumns} dataSource={nodes} rowKey="node_name" size="small"
                  pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 台节点` }}
                  scroll={{ x: 1200 }} /> },
              { key: 'network', label: <span><ApiOutlined />网络 I/O</span>,
                children: <Table columns={networkColumns} dataSource={nodes} rowKey="node_name" size="small"
                  pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 台节点` }}
                  scroll={{ x: 1100 }} /> },
              { key: 'alerts', label: <span><SafetyOutlined />告警
                  {alerts.length > 0 && <Tag color="error" style={{ marginLeft: 8 }}>{alerts.length}</Tag>}</span>,
                children: alerts.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前无活跃告警" style={{ padding: '60px 0' }} />
                ) : (
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    {alerts.map((alert, index) => {
                      const severity = alert.labels.severity || 'info'
                      const severityColors: Record<string, string> = {
                        critical: '#ff4d4f', warning: '#fa8c16', info: '#1890ff' }
                      const color = severityColors[severity] || '#1890ff'
                      return (
                        <Card key={index} size="small" 
                          style={{ borderLeft: `4px solid ${color}`, background: `${color}05` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Space>
                              <WarningOutlined style={{ color, fontSize: 16 }} />
                              <span style={{ fontWeight: 600, fontSize: 14 }}>{alert.labels.alertname}</span>
                              <Tag color={severity === 'critical' ? 'error' : severity === 'warning' ? 'warning' : 'default'}>
                                {severity.toUpperCase()}
                              </Tag>
                            </Space>
                            <span style={{ fontSize: 12, color: '#999' }}>
                              {new Date(alert.activeAt).toLocaleString('zh-CN')}
                            </span>
                          </div>
                          {alert.annotations.summary && (
                            <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>{alert.annotations.summary}</div>
                          )}
                          {alert.annotations.description && (
                            <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>{alert.annotations.description}</div>
                          )}
                        </Card>
                      )
                    })}
                  </Space>
                ) }
            ]} />
          </Card>
        </>
      )}
    </div>
  )
}
