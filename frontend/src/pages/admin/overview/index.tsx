import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Row, Col, Card, Statistic, Table, Tag, Progress, Spin, Button, Space, Alert } from 'antd'
import {
  ReloadOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  CloudServerOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
  TeamOutlined,
  BarChartOutlined,
  TrophyOutlined,
} from '@ant-design/icons'
import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { dashboardAPI } from '@/api'
import { useTheme } from '@/hooks/useTheme'
import { usePageTitle } from '@/hooks/usePageTitle'
import type { ColumnsType } from 'antd/es/table'

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const TOP10_HEIGHT = 320

// ─── 类型 ─────────────────────────────────────────────────
interface ClusterStats {
  totalNodes: number
  runningJobs: number
  pendingJobs: number
  completedJobs: number
  cpuUtil: number
  memUtil: number
  activeUsers: number
  totalUsers: number
  totalGpus: number
  allocGpus: number
  totalCpus: number
  allocCpus: number
  totalMemGb: number
  freeMemGb: number
}

interface NodeInfo {
  name: string
  state: string
  cpuTotal: number
  cpuAlloc: number
  memTotal: number
  memAlloc: number
  gpuTotal?: number
  gpuAlloc?: number
  partition?: string
}

interface AlertItem {
  id: number
  name: string
  level: 'error' | 'warning' | 'info'
  time: string
}

// ─── 工具函数 ─────────────────────────────────────────────
function nodeStateTag(state: string) {
  const s = state.toLowerCase()
  if (s.includes('down') || s.includes('drain')) return <Tag color="error">下线</Tag>
  if (s.includes('alloc') || s.includes('mix')) return <Tag color="warning">使用中</Tag>
  if (s.includes('idle')) return <Tag color="success">空闲</Tag>
  return <Tag>{state}</Tag>
}

export default function AdminOverview() {
  const { mode } = useTheme()
  const isDark = mode === 'dark' || mode === 'ocean'
  usePageTitle('集群总览')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<ClusterStats | null>(null)
  const [nodes, setNodes] = useState<NodeInfo[]>([])
  const [alerts, setAlerts] = useState<AlertItem[]>([])

  // ECharts refs
  const cpuChartRef = useRef<HTMLDivElement>(null)
  const userTop10Ref = useRef<HTMLDivElement>(null)
  const nodeTop10Ref = useRef<HTMLDivElement>(null)
  const partitionTop10Ref = useRef<HTMLDivElement>(null)
  const cpuChart = useRef<echarts.ECharts | null>(null)
  const userTop10Chart = useRef<echarts.ECharts | null>(null)
  const nodeTop10Chart = useRef<echarts.ECharts | null>(null)
  const partitionTop10Chart = useRef<echarts.ECharts | null>(null)

  const chartTextColor = isDark ? '#94a3b8' : '#64748b'
  const splitLineColor = isDark ? '#1e293b' : '#e2e8f0'
  
  // 根据主题选择图表颜色
  const getChartColor = (type: 'primary' | 'success' | 'warning' | 'cpu' | 'memory') => {
    if (mode === 'ocean') {
      const oceanColors = {
        primary: '#00b4d8',
        success: '#06ffa5',
        warning: '#ffd166',
        cpu: '#00b4d8',
        memory: '#06ffa5',
      }
      return oceanColors[type]
    }
    const colors = {
      primary: '#6366f1',
      success: '#10b981',
      warning: '#f59e0b',
      cpu: '#6366f1',
      memory: '#10b981',
    }
    return colors[type]
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [statsData, nodeData, alertData] = await Promise.allSettled([
        dashboardAPI.getStats(),
        dashboardAPI.getNodeMetrics(),
        dashboardAPI.getAlerts(),
      ])
      if (statsData.status === 'fulfilled') setStats(statsData.value)
      if (nodeData.status === 'fulfilled') setNodes(nodeData.value || [])
      if (alertData.status === 'fulfilled') setAlerts(alertData.value || [])
    } catch {
      setError('加载数据失败，请刷新重试')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const timer = setInterval(loadData, 30_000)
    return () => clearInterval(timer)
  }, [])

  // CPU 利用率折线图
  useEffect(() => {
    if (!cpuChartRef.current) return
    if (!cpuChart.current) cpuChart.current = echarts.init(cpuChartRef.current)
    const chart = cpuChart.current
    chart.setOption({
      backgroundColor: 'transparent',
      grid: { top: 30, right: 10, bottom: 30, left: 42 },
      tooltip: { trigger: 'axis' },
      legend: {
        top: 0,
        textStyle: { color: chartTextColor, fontSize: 12 },
      },
      xAxis: {
        type: 'category',
        data: Array.from({ length: 12 }, (_, i) => `${i * 5}分`),
        axisLabel: { color: chartTextColor, fontSize: 11 },
        axisLine: { lineStyle: { color: splitLineColor } },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: { color: chartTextColor, fontSize: 11, formatter: '{value}%' },
        splitLine: { lineStyle: { color: splitLineColor } },
      },
      series: [
        {
          name: 'CPU',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          data: Array.from({ length: 12 }, () => Math.round((stats?.cpuUtil ?? 60) + Math.random() * 10 - 5)),
          lineStyle: { color: getChartColor('cpu'), width: 2 },
          areaStyle: { color: `${getChartColor('cpu')}20` },
          itemStyle: { color: getChartColor('cpu') },
        },
        {
          name: '内存',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          data: Array.from({ length: 12 }, () => Math.round((stats?.memUtil ?? 40) + Math.random() * 8 - 4)),
          lineStyle: { color: getChartColor('memory'), width: 2 },
          areaStyle: { color: `${getChartColor('memory')}15` },
          itemStyle: { color: getChartColor('memory') },
        },
      ],
    })
  }, [stats, isDark, mode])

  // 用户活跃 TOP10（按作业数）
  useEffect(() => {
    if (!userTop10Ref.current) return
    if (!userTop10Chart.current) userTop10Chart.current = echarts.init(userTop10Ref.current)
    const chart = userTop10Chart.current

    // 从 nodes 中统计各用户（这里用模拟数据，实际从 jobs API 聚合）
    const users = Array.from({ length: 8 }, (_, i) => ({
      name: `user${i + 1}`,
      count: Math.floor(Math.random() * 30) + 1,
    })).sort((a, b) => b.count - a.count)

    chart.setOption({
      backgroundColor: 'transparent',
      grid: { top: 8, right: 12, bottom: 4, left: 56 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value', axisLabel: { color: chartTextColor, fontSize: 10 }, splitLine: { lineStyle: { color: splitLineColor } } },
      yAxis: { type: 'category', data: users.map((u) => u.name), axisLabel: { color: chartTextColor, fontSize: 10 } },
      series: [{
        type: 'bar',
        data: users.map((u) => u.count),
        barMaxWidth: 16,
        itemStyle: { color: getChartColor('primary'), borderRadius: [0, 4, 4, 0] },
      }],
    })
  }, [nodes, isDark, mode])

  // 节点使用 TOP10
  useEffect(() => {
    if (!nodeTop10Ref.current) return
    if (!nodeTop10Chart.current) nodeTop10Chart.current = echarts.init(nodeTop10Ref.current)
    const chart = nodeTop10Chart.current

    const sorted = [...nodes]
      .sort((a, b) => (b.cpuAlloc / (b.cpuTotal || 1)) - (a.cpuAlloc / (a.cpuTotal || 1)))
      .slice(0, 8)

    chart.setOption({
      backgroundColor: 'transparent',
      grid: { top: 8, right: 12, bottom: 4, left: 64 },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const n = sorted[params[0].dataIndex]
          return `${n?.name}<br/>CPU: ${n?.cpuAlloc}/${n?.cpuTotal}`
        },
      },
      xAxis: { type: 'value', max: 100, axisLabel: { color: chartTextColor, fontSize: 10, formatter: '{value}%' }, splitLine: { lineStyle: { color: splitLineColor } } },
      yAxis: {
        type: 'category',
        data: sorted.map((n) => n.name),
        axisLabel: { color: chartTextColor, fontSize: 10 },
      },
      series: [{
        type: 'bar',
        data: sorted.map((n) => n.cpuTotal > 0 ? Math.round((n.cpuAlloc / n.cpuTotal) * 100) : 0),
        barMaxWidth: 16,
        itemStyle: { color: getChartColor('warning'), borderRadius: [0, 4, 4, 0] },
      }],
    })
  }, [nodes, isDark, mode])

  // 分区作业 TOP10
  useEffect(() => {
    if (!partitionTop10Ref.current) return
    if (!partitionTop10Chart.current) partitionTop10Chart.current = echarts.init(partitionTop10Ref.current)
    const chart = partitionTop10Chart.current

    // 按分区聚合节点数（实际应从作业统计）
    const partMap: Record<string, number> = {}
    nodes.forEach((n) => {
      const p = n.partition || 'default'
      partMap[p] = (partMap[p] || 0) + (n.cpuAlloc > 0 ? 1 : 0)
    })
    const partData = Object.entries(partMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)

    chart.setOption({
      backgroundColor: 'transparent',
      grid: { top: 8, right: 12, bottom: 4, left: 72 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value', axisLabel: { color: chartTextColor, fontSize: 10 }, splitLine: { lineStyle: { color: splitLineColor } } },
      yAxis: { type: 'category', data: partData.map(([p]) => p), axisLabel: { color: chartTextColor, fontSize: 10 } },
      series: [{
        type: 'bar',
        data: partData.map(([, v]) => v),
        barMaxWidth: 16,
        itemStyle: { color: getChartColor('success'), borderRadius: [0, 4, 4, 0] },
      }],
    })
  }, [nodes, isDark, mode])

  // 响应 resize
  useEffect(() => {
    const handler = () => {
      cpuChart.current?.resize()
      userTop10Chart.current?.resize()
      nodeTop10Chart.current?.resize()
      partitionTop10Chart.current?.resize()
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // 节点状态总览表格
  const nodeColumns: ColumnsType<NodeInfo> = [
    { title: '节点', dataIndex: 'name', width: 120, fixed: 'left' },
    { title: '状态', dataIndex: 'state', width: 90, render: nodeStateTag },
    {
      title: 'CPU',
      width: 180,
      render: (_, n) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, minWidth: 64, color: '#64748b' }}>{n.cpuAlloc}/{n.cpuTotal}</span>
          <Progress
            percent={n.cpuTotal > 0 ? Math.round((n.cpuAlloc / n.cpuTotal) * 100) : 0}
            size="small"
            style={{ flex: 1, marginBottom: 0 }}
            strokeColor={mode === 'ocean' ? '#00b4d8' : '#6366f1'}
          />
        </div>
      ),
    },
    {
      title: '内存',
      width: 180,
      render: (_, n) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, minWidth: 64, color: '#64748b' }}>{n.memAlloc}/{n.memTotal}G</span>
          <Progress
            percent={n.memTotal > 0 ? Math.round((n.memAlloc / n.memTotal) * 100) : 0}
            size="small"
            style={{ flex: 1, marginBottom: 0 }}
            strokeColor={mode === 'ocean' ? '#06ffa5' : '#10b981'}
          />
        </div>
      ),
    },
    { title: '分区', dataIndex: 'partition', width: 100, render: (v) => v || '-' },
  ]

  if (loading && !stats) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 顶部标题栏 */}
      <Card size="small">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
            <span style={{ fontSize: 18, fontWeight: 600 }}>集群总览</span>
            <Tag color={mode === 'ocean' ? 'cyan' : 'blue'}>管理后台</Tag>
          </Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading} size="small">
            刷新
          </Button>
        </div>
      </Card>

      {error && <Alert message={error} type="error" showIcon closable />}

      {/* KPI 卡片行 */}
      <Row gutter={16}>
        <Col xs={12} sm={8} lg={4}>
          <Card bordered={false} style={{ borderRadius: 10 }}>
            <Statistic
              title="总节点"
              value={stats?.totalNodes ?? '-'}
              suffix="台"
              prefix={<CloudServerOutlined style={{ color: mode === 'ocean' ? '#00b4d8' : '#3b82f6' }} />}
              valueStyle={{ fontSize: 24, fontWeight: 700, color: mode === 'ocean' ? '#00b4d8' : '#3b82f6' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card bordered={false} style={{ borderRadius: 10 }}>
            <Statistic
              title="运行作业"
              value={stats?.runningJobs ?? '-'}
              suffix="个"
              prefix={<ThunderboltOutlined style={{ color: mode === 'ocean' ? '#06ffa5' : '#10b981' }} />}
              valueStyle={{ fontSize: 24, fontWeight: 700, color: mode === 'ocean' ? '#06ffa5' : '#10b981' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card bordered={false} style={{ borderRadius: 10 }}>
            <Statistic
              title="排队作业"
              value={stats?.pendingJobs ?? '-'}
              suffix="个"
              prefix={<BarChartOutlined style={{ color: mode === 'ocean' ? '#ffd166' : '#f59e0b' }} />}
              valueStyle={{ fontSize: 24, fontWeight: 700, color: mode === 'ocean' ? '#ffd166' : '#f59e0b' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card bordered={false} style={{ borderRadius: 10 }}>
            <Statistic
              title="CPU 利用率"
              value={stats?.cpuUtil ?? '-'}
              suffix="%"
              prefix={<DatabaseOutlined style={{ color: mode === 'ocean' ? '#00b4d8' : '#6366f1' }} />}
              valueStyle={{ fontSize: 24, fontWeight: 700, color: mode === 'ocean' ? '#00b4d8' : '#6366f1' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card bordered={false} style={{ borderRadius: 10 }}>
            <Statistic
              title="内存利用率"
              value={stats?.memUtil ?? '-'}
              suffix="%"
              prefix={<DatabaseOutlined style={{ color: mode === 'ocean' ? '#06ffa5' : '#10b981' }} />}
              valueStyle={{ fontSize: 24, fontWeight: 700, color: mode === 'ocean' ? '#06ffa5' : '#10b981' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card bordered={false} style={{ borderRadius: 10 }}>
            <Statistic
              title="活跃用户"
              value={stats ? `${stats.activeUsers}/${stats.totalUsers}` : '-'}
              prefix={<TeamOutlined style={{ color: mode === 'ocean' ? '#00b4d8' : '#8b5cf6' }} />}
              valueStyle={{ fontSize: 24, fontWeight: 700, color: mode === 'ocean' ? '#00b4d8' : '#8b5cf6' }}
            />
          </Card>
        </Col>
      </Row>

      {/* CPU/内存趋势图 */}
      <Card 
        size="small" 
        title={
          <Space>
            <TrophyOutlined />
            资源利用率趋势
          </Space>
        }
        bordered={false}
        style={{ borderRadius: 10 }}
      >
        <div ref={cpuChartRef} style={{ height: 220 }} />
      </Card>

      {/* TOP10 三列 */}
      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Card
            size="small"
            title={
              <Space>
                <TeamOutlined />
                用户活跃 TOP10
              </Space>
            }
            bordered={false}
            style={{ height: TOP10_HEIGHT, borderRadius: 10 }}
            styles={{ body: { height: TOP10_HEIGHT - 56, overflow: 'auto', padding: '8px 12px' } }}
          >
            <div ref={userTop10Ref} style={{ height: '100%' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            size="small"
            title={
              <Space>
                <CloudServerOutlined />
                节点使用 TOP10
              </Space>
            }
            bordered={false}
            style={{ height: TOP10_HEIGHT, borderRadius: 10 }}
            styles={{ body: { height: TOP10_HEIGHT - 56, overflow: 'auto', padding: '8px 12px' } }}
          >
            <div ref={nodeTop10Ref} style={{ height: '100%' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            size="small"
            title={
              <Space>
                <BarChartOutlined />
                分区作业 TOP10
              </Space>
            }
            bordered={false}
            style={{ height: TOP10_HEIGHT, borderRadius: 10 }}
            styles={{ body: { height: TOP10_HEIGHT - 56, overflow: 'auto', padding: '8px 12px' } }}
          >
            <div ref={partitionTop10Ref} style={{ height: '100%' }} />
          </Card>
        </Col>
      </Row>

      {/* 告警监控 */}
      <Card
        size="small"
        title={
          <Space>
            <WarningOutlined />
            告警监控
          </Space>
        }
        bordered={false}
        style={{ borderRadius: 10 }}
      >
        {alerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <CheckCircleOutlined style={{ fontSize: 48, color: '#10b981', marginBottom: 16 }} />
            <div style={{ fontSize: 16, color: '#64748b' }}>系统正常，无告警</div>
          </div>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            {alerts.map((a) => (
              <Alert
                key={a.id}
                message={a.name}
                description={a.time}
                type={a.level === 'error' ? 'error' : a.level === 'warning' ? 'warning' : 'info'}
                showIcon
                style={{ padding: '8px 12px' }}
              />
            ))}
          </Space>
        )}
      </Card>

      {/* 节点状态总览 */}
      <Card 
        size="small" 
        title={
          <Space>
            <CloudServerOutlined />
            节点状态总览
          </Space>
        }
        bordered={false}
        style={{ borderRadius: 10 }}
      >
        <Table
          columns={nodeColumns}
          dataSource={nodes}
          rowKey="name"
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 个节点` }}
          scroll={{ x: 700 }}
        />
      </Card>
    </div>
  )
}
