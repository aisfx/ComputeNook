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
  total_nodes: number
  online_nodes: number
  idle_nodes: number
  down_nodes: number
  total_cpus: number
  allocated_cpus: number
  idle_cpus: number
  cpu_usage_percent: number
  total_memory_gb: number
  allocated_memory_gb: number
  free_memory_gb: number
  memory_usage_percent: number
  total_gpus: number
  allocated_gpus: number
  idle_gpus: number
  total_users?: number
  active_users?: number
}

interface NodeInfo {
  name: string
  state: string
  cpu_total: number
  cpu_allocated: number
  cpu_usage_percent: number
  memory_total_mb: number
  memory_allocated_mb: number
  memory_usage_percent: number
  gpu_info?: string
  gpu_used?: string
  partitions?: string[]
  running_jobs?: number
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
  const [userJobStats, setUserJobStats] = useState<{ username: string; job_count: number }[]>([])

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
      const [statsData, nodeData, alertData, userJobData] = await Promise.allSettled([
        dashboardAPI.getStats(),
        dashboardAPI.getNodeMetrics(),
        dashboardAPI.getAlerts(),
        dashboardAPI.getUserJobStats(),
      ])
      
      if (statsData.status === 'fulfilled') {
        setStats(statsData.value)
      }
      
      if (nodeData.status === 'fulfilled') {
        setNodes(nodeData.value || [])
      }
      
      if (alertData.status === 'fulfilled') {
        setAlerts(alertData.value || [])
      }
      
      if (userJobData.status === 'fulfilled') {
        setUserJobStats(userJobData.value || [])
      }
    } catch (err) {
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
          data: Array.from({ length: 12 }, () => Math.round((stats?.cpu_usage_percent ?? 60) + Math.random() * 10 - 5)),
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
          data: Array.from({ length: 12 }, () => Math.round((stats?.memory_usage_percent ?? 40) + Math.random() * 8 - 4)),
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

    if (!userJobStats || userJobStats.length === 0) {
      chart.setOption({
        backgroundColor: 'transparent',
        graphic: [{
          type: 'text',
          left: 'center',
          top: 'middle',
          style: {
            text: '暂无数据',
            fontSize: 14,
            fill: chartTextColor,
          },
        }],
      })
      return
    }

    chart.setOption({
      backgroundColor: 'transparent',
      grid: { top: 8, right: 12, bottom: 24, left: 12 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { 
        type: 'category', 
        data: userJobStats.map((u) => u.username), 
        axisLabel: { color: chartTextColor, fontSize: 10, rotate: 0 },
        axisLine: { lineStyle: { color: splitLineColor } },
      },
      yAxis: { 
        type: 'value', 
        axisLabel: { color: chartTextColor, fontSize: 10 }, 
        splitLine: { lineStyle: { color: splitLineColor } },
      },
      series: [{
        type: 'bar',
        data: userJobStats.map((u) => u.job_count),
        barMaxWidth: 32,
        itemStyle: { color: getChartColor('primary'), borderRadius: [4, 4, 0, 0] },
      }],
    })
  }, [userJobStats, isDark, mode, chartTextColor, splitLineColor])

  // 节点使用 TOP10
  useEffect(() => {
    if (!nodeTop10Ref.current) return
    if (!nodeTop10Chart.current) nodeTop10Chart.current = echarts.init(nodeTop10Ref.current)
    const chart = nodeTop10Chart.current

    if (!nodes || nodes.length === 0) {
      chart.setOption({
        backgroundColor: 'transparent',
        graphic: [{
          type: 'text',
          left: 'center',
          top: 'middle',
          style: {
            text: '暂无数据',
            fontSize: 14,
            fill: chartTextColor,
          },
        }],
      })
      return
    }

    const sorted = [...nodes]
      .sort((a, b) => (b.cpu_allocated / (b.cpu_total || 1)) - (a.cpu_allocated / (a.cpu_total || 1)))
      .slice(0, 8)

    // 提取节点名称的短名称（域名第一个点之前的部分）
    const getShortNodeName = (name: string) => {
      return name.split('.')[0]
    }

    chart.setOption({
      backgroundColor: 'transparent',
      grid: { top: 8, right: 12, bottom: 24, left: 12 },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const n = sorted[params[0].dataIndex]
          return `${getShortNodeName(n?.name)}<br/>CPU: ${n?.cpu_allocated}/${n?.cpu_total}`
        },
      },
      xAxis: {
        type: 'category',
        data: sorted.map((n) => getShortNodeName(n.name)),
        axisLabel: { color: chartTextColor, fontSize: 10, rotate: 0 },
        axisLine: { lineStyle: { color: splitLineColor } },
      },
      yAxis: { 
        type: 'value', 
        max: 100, 
        axisLabel: { color: chartTextColor, fontSize: 10, formatter: '{value}%' }, 
        splitLine: { lineStyle: { color: splitLineColor } },
      },
      series: [{
        type: 'bar',
        data: sorted.map((n) => n.cpu_total > 0 ? Math.round((n.cpu_allocated / n.cpu_total) * 100) : 0),
        barMaxWidth: 32,
        itemStyle: { color: getChartColor('warning'), borderRadius: [4, 4, 0, 0] },
      }],
    })
  }, [nodes, isDark, mode, chartTextColor, splitLineColor])

  // 分区作业 TOP10
  useEffect(() => {
    if (!partitionTop10Ref.current) return
    if (!partitionTop10Chart.current) partitionTop10Chart.current = echarts.init(partitionTop10Ref.current)
    const chart = partitionTop10Chart.current

    // 按分区聚合运行作业的节点数
    const partMap: Record<string, number> = {}
    nodes.forEach((n) => {
      const parts = n.partitions || []
      if (parts.length === 0) return
      parts.forEach(p => {
        if (!partMap[p]) partMap[p] = 0
        // 统计该分区下运行作业的节点数量
        if (n.running_jobs && n.running_jobs > 0) {
          partMap[p] += n.running_jobs
        }
      })
    })
    
    const partData = Object.entries(partMap)
      .filter(([_, v]) => v > 0) // 只显示有作业的分区
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)

    if (partData.length === 0) {
      chart.setOption({
        backgroundColor: 'transparent',
        graphic: [{
          type: 'text',
          left: 'center',
          top: 'middle',
          style: {
            text: '暂无运行作业',
            fontSize: 14,
            fill: chartTextColor,
          },
        }],
      })
      return
    }

    chart.setOption({
      backgroundColor: 'transparent',
      grid: { top: 8, right: 12, bottom: 24, left: 12 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { 
        type: 'category', 
        data: partData.map(([p]) => p), 
        axisLabel: { color: chartTextColor, fontSize: 10, rotate: 0 },
        axisLine: { lineStyle: { color: splitLineColor } },
      },
      yAxis: { 
        type: 'value', 
        axisLabel: { color: chartTextColor, fontSize: 10 }, 
        splitLine: { lineStyle: { color: splitLineColor } },
      },
      series: [{
        type: 'bar',
        data: partData.map(([, v]) => v),
        barMaxWidth: 32,
        itemStyle: { color: getChartColor('success'), borderRadius: [4, 4, 0, 0] },
      }],
    })
  }, [nodes, isDark, mode, chartTextColor, splitLineColor])

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
    { 
      title: '节点', 
      dataIndex: 'name', 
      width: 120, 
      fixed: 'left',
      render: (name: string) => name.split('.')[0]
    },
    { title: '状态', dataIndex: 'state', width: 90, render: nodeStateTag },
    {
      title: 'CPU',
      width: 180,
      render: (_, n) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, minWidth: 64, color: '#64748b' }}>{n.cpu_allocated}/{n.cpu_total}</span>
          <Progress
            percent={n.cpu_total > 0 ? Math.round((n.cpu_allocated / n.cpu_total) * 100) : 0}
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
      render: (_, n) => {
        const memTotalGB = Math.round(n.memory_total_mb / 1024)
        const memAllocGB = Math.round(n.memory_allocated_mb / 1024)
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, minWidth: 64, color: '#64748b' }}>{memAllocGB}/{memTotalGB}G</span>
            <Progress
              percent={n.memory_total_mb > 0 ? Math.round((n.memory_allocated_mb / n.memory_total_mb) * 100) : 0}
              size="small"
              style={{ flex: 1, marginBottom: 0 }}
              strokeColor={mode === 'ocean' ? '#06ffa5' : '#10b981'}
            />
          </div>
        )
      },
    },
    { title: '分区', dataIndex: 'partitions', width: 120, render: (v) => v?.join(', ') || '-' },
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
              value={stats?.total_nodes ?? '-'}
              suffix="台"
              prefix={<CloudServerOutlined style={{ color: mode === 'ocean' ? '#00b4d8' : '#3b82f6' }} />}
              valueStyle={{ fontSize: 24, fontWeight: 700, color: mode === 'ocean' ? '#00b4d8' : '#3b82f6' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card bordered={false} style={{ borderRadius: 10 }}>
            <Statistic
              title="在线节点"
              value={stats?.online_nodes ?? '-'}
              suffix="台"
              prefix={<ThunderboltOutlined style={{ color: mode === 'ocean' ? '#06ffa5' : '#10b981' }} />}
              valueStyle={{ fontSize: 24, fontWeight: 700, color: mode === 'ocean' ? '#06ffa5' : '#10b981' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card bordered={false} style={{ borderRadius: 10 }}>
            <Statistic
              title="空闲节点"
              value={stats?.idle_nodes ?? '-'}
              suffix="台"
              prefix={<BarChartOutlined style={{ color: mode === 'ocean' ? '#ffd166' : '#f59e0b' }} />}
              valueStyle={{ fontSize: 24, fontWeight: 700, color: mode === 'ocean' ? '#ffd166' : '#f59e0b' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card bordered={false} style={{ borderRadius: 10 }}>
            <Statistic
              title="CPU 利用率"
              value={stats?.cpu_usage_percent != null ? stats.cpu_usage_percent.toFixed(2) : '-'}
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
              value={stats?.memory_usage_percent != null ? stats.memory_usage_percent.toFixed(2) : '-'}
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
              value={stats ? `${stats.active_users ?? 0}/${stats.total_users ?? 0}` : '-'}
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
