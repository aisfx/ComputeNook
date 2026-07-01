import React, { useRef, useState, useEffect } from 'react'
import { Card, DatePicker, Select, Button, Space, Spin, Empty, Alert, message } from 'antd'
import { SearchOutlined, DownloadOutlined, BarChartOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import * as echarts from 'echarts'
import { reportAPI, type JobStatsResult, type UsageStatsResult, type StorageStatItem, type QuotaStatsResult, type QoSUsageItem } from '@/api/report'
import { usePageTitle } from '@/hooks/usePageTitle'
import axios from 'axios'

const { RangePicker } = DatePicker

export default function ReportsPage() {
  usePageTitle('报表中心')

  const [loading, setLoading] = useState(false)
  const [globalError, setGlobalError] = useState('')
  const [queried, setQueried] = useState(false)
  const [partitions, setPartitions] = useState<string[]>([])
  
  // 默认查询最近7天
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(7, 'days'),
    dayjs(),
  ])
  const [partition, setPartition] = useState<string>('')

  // 数据状态
  const [jobStats, setJobStats] = useState<JobStatsResult | null>(null)
  const [usageStats, setUsageStats] = useState<UsageStatsResult | null>(null)
  const [storageStats, setStorageStats] = useState<StorageStatItem[] | null>(null)
  const [quotaStats, setQuotaStats] = useState<QuotaStatsResult | null>(null)
  const [qosUsage, setQosUsage] = useState<QoSUsageItem[]>([])

  // 图表引用
  const lineChartRef = useRef<HTMLDivElement>(null)
  const scaleChartRef = useRef<HTMLDivElement>(null)
  const usageChartRef = useRef<HTMLDivElement>(null)
  const storageChartRef = useRef<HTMLDivElement>(null)
  const qosChartRef = useRef<HTMLDivElement>(null)
  const billingChartRef = useRef<HTMLDivElement>(null)
  const quotaChartRef = useRef<HTMLDivElement>(null)

  // 图表实例
  const [charts, setCharts] = useState<{
    line: echarts.ECharts | null
    scale: echarts.ECharts | null
    usage: echarts.ECharts | null
    storage: echarts.ECharts | null
    qos: echarts.ECharts | null
    billing: echarts.ECharts | null
    quota: echarts.ECharts | null
  }>({
    line: null,
    scale: null,
    usage: null,
    storage: null,
    qos: null,
    billing: null,
    quota: null,
  })

  // 加载分区列表
  useEffect(() => {
    loadPartitions()
  }, [])

  const loadPartitions = async () => {
    try {
      const res = await axios.get<{ data: string[] }>('/jobs/partitions/list')
      setPartitions(res.data?.data ?? [])
    } catch {
      setPartitions([])
    }
  }

  // 查询所有数据
  const handleQuery = async () => {
    if (!dateRange) {
      message.warning('请选择日期范围')
      return
    }

    setLoading(true)
    setGlobalError('')
    setQueried(false)
    
    // 清空旧数据
    setJobStats(null)
    setUsageStats(null)
    setStorageStats(null)
    setQuotaStats(null)
    setQosUsage([])
    
    // 销毁图表
    disposeCharts()

    const params = {
      start_time: dateRange[0].format('YYYY-MM-DD'),
      end_time: dateRange[1].format('YYYY-MM-DD'),
      partition: partition || undefined,
    }

    try {
      const results = await Promise.allSettled([
        reportAPI.getJobStats(params),
        reportAPI.getUsageStats(params),
        reportAPI.getStorageStats(params),
        reportAPI.getQuotaStats(params),
        reportAPI.getQoSUsage(params),
      ])

      if (results[0].status === 'fulfilled') setJobStats(results[0].value.data)
      if (results[1].status === 'fulfilled') setUsageStats(results[1].value.data)
      if (results[2].status === 'fulfilled') setStorageStats(results[2].value.data)
      if (results[3].status === 'fulfilled') setQuotaStats(results[3].value.data)
      
      // QoS 接口失败时用 mock 数据兜底
      if (results[4].status === 'fulfilled' && results[4].value.data?.length) {
        setQosUsage(results[4].value.data)
      } else {
        setQosUsage([
          { qos_name: 'normal', used_billing_hours: 0, total_billing_hours: 0, usage_percent: 0, status: 'NORMAL' },
          { qos_name: 'high', used_billing_hours: 0, total_billing_hours: 0, usage_percent: 0, status: 'NORMAL' },
          { qos_name: 'gpu', used_billing_hours: 0, total_billing_hours: 0, usage_percent: 0, status: 'NORMAL' },
        ])
      }

      setQueried(true)
      
      // 立即渲染图表
      setTimeout(() => {
        renderAllCharts()
      }, 150)
    } catch (err: any) {
      setGlobalError(err?.message || '查询失败')
      message.error('查询失败')
    } finally {
      setLoading(false)
    }
  }

  const disposeCharts = () => {
    Object.values(charts).forEach((chart) => chart?.dispose())
    setCharts({
      line: null,
      scale: null,
      usage: null,
      storage: null,
      qos: null,
      billing: null,
      quota: null,
    })
  }

  const renderAllCharts = () => {
    renderLineChart()
    renderScaleChart()
    renderUsageChart()
    renderStorageChart()
    renderQoSChart()
    renderBillingChart()
    renderQuotaChart()
  }

  // 渲染所有图表
  useEffect(() => {
    if (queried) {
      // 延迟渲染确保DOM已经挂载
      const timer = setTimeout(() => {
        renderAllCharts()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [queried])

  // 窗口resize时重绘图表
  useEffect(() => {
    const handleResize = () => {
      Object.values(charts).forEach((chart) => chart?.resize())
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [charts])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 筛选栏 */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <Space size="large">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChartOutlined style={{ fontSize: 18, color: '#6366f1' }} />
              <span style={{ fontSize: 16, fontWeight: 600 }}>报表中心</span>
            </div>
          </Space>
          
          <Space wrap>
            <RangePicker
              value={dateRange}
              onChange={(dates) => dates && setDateRange(dates as [Dayjs, Dayjs])}
              format="YYYY-MM-DD"
              placeholder={['开始日期', '结束日期']}
            />
            <Select
              value={partition}
              onChange={setPartition}
              placeholder="选择队列"
              allowClear
              style={{ width: 150 }}
            >
              {partitions.map((p) => (
                <Select.Option key={p} value={p}>
                  {p}
                </Select.Option>
              ))}
            </Select>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleQuery}
              loading={loading}
            >
              查询
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={exportExcel}
              disabled={!queried}
            >
              导出 Excel
            </Button>
          </Space>
        </div>
      </Card>

      {/* 加载状态 */}
      {loading && (
        <Card>
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16, color: '#666' }}>加载中...</div>
          </div>
        </Card>
      )}

      {/* 错误提示 */}
      {globalError && !loading && (
        <Alert message="查询失败" description={globalError} type="error" showIcon />
      )}

      {/* 空状态 */}
      {!queried && !loading && (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="选择时间范围后点击查询"
            style={{ padding: '60px 0' }}
          />
        </Card>
      )}

      {/* 图表区域 */}
      {queried && (
        <>
          {/* 月度作业趋势 */}
          <Card title="每月各队列作业数趋势" bordered={false}>
            <div ref={lineChartRef} style={{ width: '100%', height: 300 }} />
          </Card>

          {/* 作业规模 + 核时用量 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 16 }}>
            <Card title="作业规模分布" bordered={false}>
              <div ref={scaleChartRef} style={{ width: '100%', height: 280 }} />
            </Card>
            <Card title="GPU / CPU 核时用量" bordered={false}>
              <div ref={usageChartRef} style={{ width: '100%', height: 280 }} />
            </Card>
          </div>

          {/* 计费核时 + 配额使用率 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 16 }}>
            <Card title="计费核时使用比例" bordered={false}>
              <div ref={billingChartRef} style={{ width: '100%', height: 280 }} />
            </Card>
            <Card
              title={
                <span>
                  配额使用率
                  {quotaStats?.account && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: '#666', fontWeight: 'normal' }}>
                      ({quotaStats.account})
                    </span>
                  )}
                </span>
              }
              bordered={false}
            >
              <div ref={quotaChartRef} style={{ width: '100%', height: 280 }} />
            </Card>
          </div>

          {/* 存储用量 */}
          {storageStats && storageStats.length > 0 && (
            <Card title="存储配额使用情况" bordered={false}>
              <div
                ref={storageChartRef}
                style={{ width: '100%', height: Math.max(260, storageStats.length * 60) }}
              />
            </Card>
          )}

          {/* QoS 计费核时 */}
          <Card title="QoS 计费核时使用量" bordered={false}>
            <div ref={qosChartRef} style={{ width: '100%', height: 280 }} />
          </Card>
        </>
      )}
    </div>
  )

  // 图表渲染函数在下一部分继续
  function renderLineChart() {
    if (!lineChartRef.current) return
    
    let chart = charts.line
    if (!chart) {
      chart = echarts.init(lineChartRef.current)
      setCharts((prev) => ({ ...prev, line: chart }))
    }

    const counts = jobStats?.monthly_job_counts ?? []
    const hasData = counts.length > 0
    const months = hasData
      ? [...new Set(counts.map((c) => c.month))].sort()
      : ['2026-01', '2026-02', '2026-03', '2026-04']
    const queues = hasData ? [...new Set(counts.map((c) => c.partition))] : ['normal', 'gpu']

    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6']

    chart.setOption({
      tooltip: {
        trigger: 'axis',
      },
      legend: {
        data: queues,
        bottom: 4,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '14%',
        top: '6%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: months,
        boundaryGap: false,
      },
      yAxis: {
        type: 'value',
        name: '作业数',
      },
      series: queues.map((q, i) => ({
        name: q,
        type: 'line' as const,
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: {
          width: 2.5,
          color: colors[i % colors.length],
        },
        itemStyle: {
          color: colors[i % colors.length],
        },
        areaStyle: {
          color: colors[i % colors.length],
          opacity: 0.06,
        },
        data: hasData
          ? months.map((m) => counts.find((c) => c.month === m && c.partition === q)?.count ?? 0)
          : [0, 0, 0, 0],
      })),
    })
  }

  function renderScaleChart() {
    if (!scaleChartRef.current) return

    let chart = charts.scale
    if (!chart) {
      chart = echarts.init(scaleChartRef.current)
      setCharts((prev) => ({ ...prev, scale: chart }))
    }

    const dist = jobStats?.job_scale_distribution ?? []
    const total = jobStats?.total_jobs ?? 0
    const ranges =
      dist.length > 0
        ? dist
        : [
            { range: '1-4核', count: 0 },
            { range: '5-16核', count: 0 },
            { range: '17-64核', count: 0 },
            { range: '64核以上', count: 0 },
          ]

    chart.setOption({
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const pct = total > 0 ? ((params[0].value / total) * 100).toFixed(1) : 0
          return `${params[0].name}<br/>作业数: <b>${params[0].value}</b> (${pct}%)`
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '6%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: ranges.map((d) => d.range),
      },
      yAxis: {
        type: 'value',
        name: '作业数',
      },
      series: [
        {
          type: 'bar',
          data: ranges.map((d) => d.count),
          itemStyle: {
            color: '#6366f1',
            borderRadius: [6, 6, 0, 0],
          },
          label: {
            show: true,
            position: 'top',
            fontSize: 12,
          },
          barMaxWidth: 56,
        },
      ],
    })
  }

  function renderUsageChart() {
    if (!usageChartRef.current) return

    let chart = charts.usage
    if (!chart) {
      chart = echarts.init(usageChartRef.current)
      setCharts((prev) => ({ ...prev, usage: chart }))
    }

    const u = usageStats

    chart.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '6%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: ['GPU 卡时', 'CPU 核时', '计费核时'],
      },
      yAxis: {
        type: 'value',
        name: '小时(h)',
      },
      series: [
        {
          type: 'bar',
          data: [
            { value: u ? +u.gpu_hours.toFixed(2) : 0, itemStyle: { color: '#6366f1' } },
            { value: u ? +u.cpu_hours.toFixed(2) : 0, itemStyle: { color: '#10b981' } },
            { value: u ? +u.billing_hours.toFixed(2) : 0, itemStyle: { color: '#f59e0b' } },
          ],
          label: {
            show: true,
            position: 'top',
            fontSize: 12,
            formatter: (p: any) => `${p.value}h`,
          },
          barMaxWidth: 56,
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
          },
        },
      ],
    })
  }

  function renderStorageChart() {
    if (!storageChartRef.current || !storageStats?.length) return

    let chart = charts.storage
    if (!chart) {
      chart = echarts.init(storageChartRef.current)
      setCharts((prev) => ({ ...prev, storage: chart }))
    }

    const items = storageStats
    const labels = items.map((i) => `${i.username}  ${i.filesystem}`)
    const barColors = items.map((i) => (i.over_soft_limit ? '#f59e0b' : '#10b981'))

    chart.resize()
    chart.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any[]) => {
          const i = items[params[0].dataIndex]
          return `<b>${i.username}</b> ${i.filesystem}<br/>已用: <b>${i.used_gb.toFixed(
            2
          )} GB</b><br/>软限制: ${i.soft_limit_gb.toFixed(2)} GB<br/>硬限制: ${i.hard_limit_gb.toFixed(
            2
          )} GB<br/>使用率: <b>${i.usage_percent.toFixed(1)}%</b>${
            i.over_soft_limit ? '<br/><span style="color:#f59e0b">⚠ 超软限制</span>' : ''
          }`
        },
      },
      legend: {
        data: ['已用量', '软限制', '硬限制'],
        top: 4,
      },
      grid: {
        left: '2%',
        right: '8%',
        top: 36,
        bottom: '2%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        name: 'GB',
      },
      yAxis: {
        type: 'category',
        data: labels,
      },
      series: [
        {
          name: '已用量',
          type: 'bar',
          data: items.map((v, i) => ({
            value: +v.used_gb.toFixed(2),
            itemStyle: { color: barColors[i] },
          })),
          label: {
            show: true,
            position: 'right',
            fontSize: 11,
            formatter: (p: any) => `${p.value} GB`,
          },
          barMaxWidth: 28,
          z: 3,
        },
        {
          name: '软限制',
          type: 'bar',
          data: items.map((i) => +i.soft_limit_gb.toFixed(2)),
          itemStyle: {
            color: 'rgba(245,158,11,0.15)',
            borderColor: '#f59e0b',
            borderWidth: 1,
          },
          barMaxWidth: 28,
          barGap: '-100%',
          z: 2,
        },
        {
          name: '硬限制',
          type: 'bar',
          data: items.map((i) => +i.hard_limit_gb.toFixed(2)),
          itemStyle: {
            color: 'rgba(107,114,128,0.08)',
            borderColor: '#d1d5db',
            borderWidth: 1,
          },
          barMaxWidth: 28,
          barGap: '-100%',
          z: 1,
        },
      ],
    })
  }

  function renderBillingChart() {
    if (!billingChartRef.current || !usageStats) return

    let chart = charts.billing
    if (!chart) {
      chart = echarts.init(billingChartRef.current)
      setCharts((prev) => ({ ...prev, billing: chart }))
    }

    const u = usageStats
    const noLimit = u.quota_billing_hours === 0
    const used = +u.billing_hours.toFixed(2)
    const total = noLimit ? Math.max(used * 1.5, 100) : +u.quota_billing_hours.toFixed(2)
    const pct = noLimit ? 0 : +u.usage_percent.toFixed(1)
    const color = noLimit ? '#6366f1' : getStatusColor(u.status)

    chart.setOption({
      series: [
        {
          type: 'gauge',
          startAngle: 200,
          endAngle: -20,
          min: 0,
          max: 100,
          radius: '88%',
          pointer: {
            show: !noLimit,
            length: '60%',
            width: 4,
            itemStyle: { color },
          },
          progress: {
            show: true,
            width: 16,
            itemStyle: { color },
          },
          axisLine: {
            lineStyle: {
              width: 16,
              color: [[1, '#f3f4f6']],
            },
          },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          detail: {
            valueAnimation: true,
            formatter: noLimit ? `${used}h` : '{value}%',
            fontSize: 22,
            fontWeight: 700,
            offsetCenter: [0, '15%'],
          },
          title: {
            show: true,
            offsetCenter: [0, '50%'],
            fontSize: 13,
            formatter: noLimit ? '无配额限制' : `${used} / ${total} h`,
          },
          data: [
            {
              value: noLimit ? 0 : pct,
              name: noLimit ? '无配额限制' : `${used} / ${total} h`,
            },
          ],
        },
      ],
    })
  }

  function renderQuotaChart() {
    if (!quotaChartRef.current) return

    let chart = charts.quota
    if (!chart) {
      chart = echarts.init(quotaChartRef.current)
      setCharts((prev) => ({ ...prev, quota: chart }))
    }

    const q = quotaStats
    const used = q ? +q.used_billing_hours.toFixed(2) : 0
    const total = q ? +q.total_billing_hours.toFixed(2) : 0
    const pct = q ? +q.usage_percent.toFixed(1) : 0
    const color = q ? getStatusColor(q.status) : '#d1d5db'
    const noData = !q?.account

    chart.setOption({
      series: [
        {
          type: 'gauge',
          startAngle: 200,
          endAngle: -20,
          min: 0,
          max: 100,
          radius: '88%',
          pointer: {
            show: !noData,
            length: '60%',
            width: 4,
            itemStyle: { color },
          },
          progress: {
            show: true,
            width: 16,
            itemStyle: { color },
          },
          axisLine: {
            lineStyle: {
              width: 16,
              color: [[1, '#f3f4f6']],
            },
          },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          detail: {
            valueAnimation: true,
            formatter: noData ? '-' : '{value}%',
            color: noData ? '#d1d5db' : undefined,
            fontSize: 22,
            fontWeight: 700,
            offsetCenter: [0, '15%'],
          },
          title: {
            show: true,
            offsetCenter: [0, '50%'],
            fontSize: 13,
            formatter: noData ? '暂无配额数据' : `${used} / ${total} h`,
          },
          data: [
            {
              value: pct,
              name: noData ? '暂无配额数据' : `${used} / ${total} h`,
            },
          ],
        },
      ],
    })
  }

  function renderQoSChart() {
    if (!qosChartRef.current || !qosUsage.length) return

    let chart = charts.qos
    if (!chart) {
      chart = echarts.init(qosChartRef.current)
      setCharts((prev) => ({ ...prev, qos: chart }))
    }

    const items = qosUsage
    const names = items.map((i) => i.qos_name)
    const usedData = items.map((i) => +i.used_billing_hours.toFixed(2))
    const totalData = items.map((i) =>
      i.total_billing_hours > 0 ? +i.total_billing_hours.toFixed(2) : 0
    )
    const barColors = items.map((i) => getStatusColor(i.status))

    chart.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any[]) => {
          const idx = params[0].dataIndex
          const item = items[idx]
          const quota =
            item.total_billing_hours > 0
              ? `配额: ${item.total_billing_hours.toFixed(2)} h<br/>使用率: <b>${item.usage_percent.toFixed(
                  1
                )}%</b>`
              : '配额: 无限制'
          return `<b>${item.qos_name}</b><br/>已用: <b>${item.used_billing_hours.toFixed(
            2
          )} h</b><br/>${quota}`
        },
      },
      legend: {
        data: ['已用核时', '配额上限'],
        bottom: 4,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '14%',
        top: '6%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: names,
      },
      yAxis: {
        type: 'value',
        name: '核时(h)',
      },
      series: [
        {
          name: '已用核时',
          type: 'bar',
          data: usedData.map((v, i) => ({
            value: v,
            itemStyle: { color: barColors[i], borderRadius: [6, 6, 0, 0] },
          })),
          label: {
            show: true,
            position: 'top',
            fontSize: 12,
            formatter: (p: any) => `${p.value}h`,
          },
          barMaxWidth: 56,
          z: 2,
        },
        {
          name: '配额上限',
          type: 'bar',
          data: totalData,
          itemStyle: {
            color: 'rgba(99,102,241,0.08)',
            borderColor: '#c7d2fe',
            borderWidth: 1,
            borderRadius: [6, 6, 0, 0],
          },
          barMaxWidth: 56,
          barGap: '-100%',
          z: 1,
        },
      ],
    })
  }

  function getStatusColor(status: string) {
    return status === 'EXCEEDED' ? '#ef4444' : status === 'WARNING' ? '#f59e0b' : '#10b981'
  }

  function getStatusLabel(status: string) {
    return status === 'EXCEEDED' ? '已超限' : status === 'WARNING' ? '警告' : '正常'
  }

  async function exportExcel() {
    if (!dateRange) return

    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      const startDate = dateRange[0].format('YYYY-MM-DD')
      const endDate = dateRange[1].format('YYYY-MM-DD')

      // 月度作业趋势
      if (jobStats) {
        const j = jobStats
        const ws1 = XLSX.utils.aoa_to_sheet([
          ['月份', '队列', '作业数'],
          ...j.monthly_job_counts.map((r) => [r.month, r.partition, r.count]),
        ])
        ws1['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 10 }]
        XLSX.utils.book_append_sheet(wb, ws1, '月度作业趋势')

        // 作业规模分布
        const ws2 = XLSX.utils.aoa_to_sheet([
          ['规模范围', '作业数', '占比(%)'],
          ...j.job_scale_distribution.map((r) => [
            r.range,
            r.count,
            j.total_jobs > 0 ? +((r.count / j.total_jobs) * 100).toFixed(1) : 0,
          ]),
          ['合计', j.total_jobs, 100],
        ])
        ws2['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 10 }]
        XLSX.utils.book_append_sheet(wb, ws2, '作业规模分布')
      }

      // 核时使用
      if (usageStats) {
        const u = usageStats
        const ws = XLSX.utils.aoa_to_sheet([
          ['指标', '数值', '单位'],
          ['统计周期', `${startDate} ~ ${endDate}`, ''],
          ['GPU 卡时', +u.gpu_hours.toFixed(2), 'h'],
          ['CPU 核时', +u.cpu_hours.toFixed(2), 'h'],
          ['计费核时', +u.billing_hours.toFixed(2), 'h'],
          [
            '配额总量',
            u.quota_billing_hours === 0 ? '无限制' : +u.quota_billing_hours.toFixed(2),
            u.quota_billing_hours === 0 ? '' : 'h',
          ],
          ['使用率', +u.usage_percent.toFixed(2), '%'],
          ['状态', getStatusLabel(u.status), ''],
        ])
        ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 8 }]
        XLSX.utils.book_append_sheet(wb, ws, '核时使用')
      }

      // 存储用量
      if (storageStats?.length) {
        const ws = XLSX.utils.aoa_to_sheet([
          ['用户名', '文件系统', '已用量(GB)', '软限制(GB)', '硬限制(GB)', '使用率(%)', '超软限制'],
          ...storageStats.map((r) => [
            r.username,
            r.filesystem,
            +r.used_gb.toFixed(2),
            +r.soft_limit_gb.toFixed(2),
            +r.hard_limit_gb.toFixed(2),
            +r.usage_percent.toFixed(2),
            r.over_soft_limit ? '是' : '否',
          ]),
        ])
        ws['!cols'] = [
          { wch: 14 },
          { wch: 20 },
          { wch: 12 },
          { wch: 12 },
          { wch: 12 },
          { wch: 10 },
          { wch: 10 },
        ]
        XLSX.utils.book_append_sheet(wb, ws, '存储用量')
      }

      // 配额情况
      if (quotaStats?.account) {
        const q = quotaStats
        const ws = XLSX.utils.aoa_to_sheet([
          ['指标', '数值', '单位'],
          ['统计周期', `${startDate} ~ ${endDate}`, ''],
          ['账户', q.account, ''],
          ['配额总量', +q.total_billing_hours.toFixed(2), 'h'],
          ['已用量', +q.used_billing_hours.toFixed(2), 'h'],
          ['剩余量', +q.remaining_billing_hours.toFixed(2), 'h'],
          ['使用率', +q.usage_percent.toFixed(2), '%'],
          ['状态', getStatusLabel(q.status), ''],
        ])
        ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 8 }]
        XLSX.utils.book_append_sheet(wb, ws, '配额情况')
      }

      if (wb.SheetNames.length === 0) {
        message.warning('没有可导出的数据')
        return
      }

      XLSX.writeFile(wb, `报表中心_${startDate}_${endDate}.xlsx`)
      message.success('导出成功')
    } catch (err) {
      message.error('导出失败')
      console.error(err)
    }
  }
}
