import { useState, useEffect, useCallback } from 'react'
import {
  Card, Row, Col, Statistic, Progress, Table, Tag, Space, Button, Empty, Modal,
  Select, DatePicker, Spin, message as Message, App
} from 'antd'
import type { TableColumnsType } from 'antd'
import {
  ClockCircleOutlined, DatabaseOutlined, ThunderboltOutlined, CloudServerOutlined,
  ReloadOutlined, CheckCircleOutlined, SyncOutlined, CloseCircleOutlined,
  HourglassOutlined, DesktopOutlined, HddOutlined, TeamOutlined, FundOutlined,
  ExportOutlined, SettingOutlined, PlayCircleOutlined, PauseCircleOutlined,
  StopOutlined, EyeOutlined, BarChartOutlined, SearchOutlined
} from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { usePageTitle } from '@/hooks/usePageTitle'

const { RangePicker } = DatePicker

// 类型定义
interface DashboardStats {
  nodes: number
  nodes_online: number
  cpu_cores: number
  cpu_usage: number
  memory: number
  memory_free: number
  gpu_cards: number
  gpu_in_use: number
}

interface JobStats {
  running: number
  pending: number
  completed: number
  failed: number
  cancelled: number
}

interface RunningJob {
  job_id: string
  name: string
  partition: string
  num_nodes: number
  cpus: number
  run_time: number
  account?: string
  user?: string
  state?: string
}

interface NodeInfo {
  name: string
  state: string
  cpus: number
  cpu_load: number
  real_memory: number
  alloc_memory: number
  jobs: number
}

interface AccountQuota {
  account: string
  partition: string
  qos: string
  max_cpus: number
  max_nodes: number
  max_jobs: number
  used_cpus: number
  cpu_pct: number
}

interface MachineTime {
  qos_name: string
  total_quota: number
  used: number
  remaining: number
  usage_rate: number
  has_limit: boolean
}

interface StorageQuota {
  has_data: boolean
  capacity: {
    used: string
    total: string
    percentage: number
  }
  files: {
    used: number
    total: number
    percentage: number
    no_limit: boolean
  }
}

// 工具函数
function formatMemory(mb: number): string {
  if (!mb || mb === 0) return '0 MB'
  if (mb < 1024) return `${mb.toFixed(0)} MB`
  if (mb < 1024 * 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${(mb / 1024 / 1024).toFixed(2)} TB`
}

function formatElapsed(seconds: number): string {
  if (!seconds || seconds === 0) return '-'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatTime(timestamp: number): string {
  if (!timestamp || timestamp === 0) return '-'
  return dayjs(timestamp * 1000).format('YYYY-MM-DD HH:mm')
}

export default function UserDashboard() {
  const navigate = useNavigate()
  const { modal } = App.useApp()
  usePageTitle('仪表盘')
  
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState('')
  
  // 统计数据
  const [stats, setStats] = useState<DashboardStats>({
    nodes: 0, nodes_online: 0, cpu_cores: 0, cpu_usage: 0,
    memory: 0, memory_free: 0, gpu_cards: 0, gpu_in_use: 0
  })
  const [jobStats, setJobStats] = useState<JobStats>({
    running: 0, pending: 0, completed: 0, failed: 0, cancelled: 0
  })
  const [runningJobs, setRunningJobs] = useState<RunningJob[]>([])
  const [nodes, setNodes] = useState<NodeInfo[]>([])
  
  // 配额信息
  const [accountQuotas, setAccountQuotas] = useState<AccountQuota[]>([])
  const [selectedAccountIdx, setSelectedAccountIdx] = useState(0)
  const [machineTimeList, setMachineTimeList] = useState<MachineTime[]>([])
  const [machineTimeIdx, setMachineTimeIdx] = useState(0)
  const [storageQuota, setStorageQuota] = useState<StorageQuota>({
    has_data: false,
    capacity: { used: '-', total: '-', percentage: 0 },
    files: { used: 0, total: 0, percentage: 0, no_limit: true }
  })
  
  // 作业历史弹窗
  const [jobHistoryOpen, setJobHistoryOpen] = useState(false)
  const [jobHistoryLoading, setJobHistoryLoading] = useState(false)
  const [jobHistoryList, setJobHistoryList] = useState<any[]>([])
  const [jobHistoryFilter, setJobHistoryFilter] = useState('')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(7, 'day'),
    dayjs()
  ])
  
  // 机时历史弹窗
  const [billingHistoryOpen, setBillingHistoryOpen] = useState(false)
  const [billingHistoryLoading, setBillingHistoryLoading] = useState(false)
  const [billingHistoryList, setBillingHistoryList] = useState<any[]>([])
  const [billingDateRange, setBillingDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs()
  ])
  
  // 作业详情
  const [selectedJob, setSelectedJob] = useState<any>(null)
  
  // 加载仪表盘统计
  const loadDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axios.get('/dashboard')
      const data = res.data.data || {}
      setStats({
        nodes: data.nodes || 0,
        nodes_online: data.nodes_online || 0,
        cpu_cores: data.cpu_cores || 0,
        cpu_usage: data.cpu_usage || 0,
        memory: data.memory || 0,
        memory_free: data.memory_free || 0,
        gpu_cards: data.gpu_cards || 0,
        gpu_in_use: data.gpu_in_use || 0
      })
      setLastUpdate(dayjs().format('HH:mm:ss'))
    } catch (e: any) {
      console.error('加载仪表盘失败:', e)
    } finally {
      setLoading(false)
    }
  }, [])
  
  // 加载作业统计
  const loadJobStats = useCallback(async () => {
    try {
      const res = await axios.get('/jobs', { params: { limit: 100 } })
      const jobs = res.data.data || []
      
      const stats = {
        running: jobs.filter((j: any) => j.job_state === 'RUNNING').length,
        pending: jobs.filter((j: any) => j.job_state === 'PENDING').length,
        completed: jobs.filter((j: any) => j.job_state === 'COMPLETED').length,
        failed: jobs.filter((j: any) => j.job_state === 'FAILED').length,
        cancelled: jobs.filter((j: any) => j.job_state === 'CANCELLED').length
      }
      setJobStats(stats)
      
      const running = jobs
        .filter((j: any) => j.job_state === 'RUNNING')
        .slice(0, 10)
      setRunningJobs(running)
    } catch (e) {
      console.error('加载作业统计失败:', e)
    }
  }, [])
  
  // 加载节点信息
  const loadNodes = useCallback(async () => {
    try {
      const res = await axios.get('/monitoring/nodes')
      setNodes(res.data.data || [])
    } catch (e) {
      console.error('加载节点失败:', e)
    }
  }, [])
  
  // 加载账户配额
  const loadAccountQuotas = useCallback(async () => {
    try {
      const res = await axios.get('/usage/my-resources')
      const data = res.data.data || { associations: [], qos_limits: [] }
      
      // 合并账户和QoS信息
      const assocs = data.associations || []
      const qosList = data.qos_limits || []
      
      const accountMap = new Map<string, string[]>()
      for (const a of assocs) {
        const key = a.account || '-'
        const existing = accountMap.get(key) || []
        const names: string[] = a.qos_list || (a.qos ? [a.qos] : [])
        for (const n of names) {
          if (!existing.includes(n)) existing.push(n)
        }
        accountMap.set(key, existing)
      }
      
      const quotas = Array.from(accountMap.entries()).map(([account, qosNames]) => {
        const qosInfo = qosList.find((q: any) =>
          qosNames.includes(q.name) && (q.max_cpus > 0 || q.max_nodes > 0 || q.max_jobs > 0)
        ) || qosList.find((q: any) => qosNames.includes(q.name)) || {}
        
        const maxCpus = Number(qosInfo.max_cpus) || 0
        const maxNodes = Number(qosInfo.max_nodes) || 0
        const maxJobs = Number(qosInfo.max_jobs) || 0
        const usedCpus = runningJobs
          .filter(j => !account || j.account === account)
          .reduce((s, j) => s + (j.cpus || 0), 0)
        const cpuPct = maxCpus > 0 ? Math.min(100, Math.round(usedCpus / maxCpus * 100)) : 0
        
        const assoc = assocs.find((a: any) => (a.account || '-') === account) || {}
        
        return {
          account,
          partition: assoc.partition || '',
          qos: qosInfo.name || qosNames.join(', '),
          max_cpus: maxCpus,
          max_nodes: maxNodes,
          max_jobs: maxJobs,
          used_cpus: usedCpus,
          cpu_pct: cpuPct
        }
      })
      
      setAccountQuotas(quotas)
    } catch (e) {
      console.error('加载账户配额失败:', e)
    }
  }, [runningJobs])
  
  // 加载机时信息
  const loadMachineTime = useCallback(async () => {
    try {
      const res = await axios.get('/usage/billing-summary')
      const data = res.data.data || []
      
      const timeList = data.map((item: any) => ({
        qos_name: item.qos_name || 'default',
        total_quota: item.total_quota || 0,
        used: item.used_hours || 0,
        remaining: Math.max(0, (item.total_quota || 0) - (item.used_hours || 0)),
        usage_rate: item.total_quota > 0
          ? parseFloat(((item.used_hours / item.total_quota) * 100).toFixed(2))
          : 0,
        has_limit: (item.total_quota || 0) > 0
      }))
      
      setMachineTimeList(timeList)
    } catch (e) {
      console.error('加载机时信息失败:', e)
    }
  }, [])
  
  // 加载存储配额
  const loadStorageQuota = useCallback(async () => {
    try {
      const res = await axios.get('/quota')
      const data = res.data.data || {}
      
      if (data.quota_used !== undefined) {
        setStorageQuota({
          has_data: true,
          capacity: {
            used: formatMemory(data.quota_used),
            total: formatMemory(data.quota_limit),
            percentage: data.quota_limit > 0
              ? Math.round((data.quota_used / data.quota_limit) * 100)
              : 0
          },
          files: {
            used: data.files_used || 0,
            total: data.files_limit || 0,
            percentage: data.files_limit > 0
              ? Math.round((data.files_used / data.files_limit) * 100)
              : 0,
            no_limit: !data.files_limit || data.files_limit === 0
          }
        })
      }
    } catch (e) {
      console.error('加载存储配额失败:', e)
    }
  }, [])
  
  // 刷新所有数据
  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadDashboard(),
      loadJobStats(),
      loadNodes(),
      loadAccountQuotas(),
      loadMachineTime(),
      loadStorageQuota()
    ])
  }, [loadDashboard, loadJobStats, loadNodes, loadAccountQuotas, loadMachineTime, loadStorageQuota])
  
  useEffect(() => {
    refreshAll()
  }, [])
  
  // 继续在下一段...
  

  // 加载作业历史
  const loadJobHistory = useCallback(async () => {
    setJobHistoryLoading(true)
    try {
      const res = await axios.get('/jobs', {
        params: {
          start_time: dateRange[0].unix(),
          end_time: dateRange[1].unix(),
          limit: 1000
        }
      })
      setJobHistoryList(res.data.data || [])
    } catch (e: any) {
      Message.error(e.response?.data?.error || '加载作业历史失败')
    } finally {
      setJobHistoryLoading(false)
    }
  }, [dateRange])
  
  // 加载机时历史
  const loadBillingHistory = useCallback(async () => {
    setBillingHistoryLoading(true)
    try {
      const res = await axios.get('/usage/billing', {
        params: {
          start_time: billingDateRange[0].unix(),
          end_time: billingDateRange[1].unix()
        }
      })
      setBillingHistoryList(res.data.data || [])
    } catch (e: any) {
      Message.error(e.response?.data?.error || '加载机时历史失败')
    } finally {
      setBillingHistoryLoading(false)
    }
  }, [billingDateRange])
  
  // 计算作业统计百分比
  const jobStatsTotal = jobStats.running + jobStats.pending + jobStats.completed + jobStats.failed
  const jobStatsPercentages = {
    running: jobStatsTotal > 0 ? (jobStats.running / jobStatsTotal) * 100 : 0,
    pending: jobStatsTotal > 0 ? (jobStats.pending / jobStatsTotal) * 100 : 0,
    completed: jobStatsTotal > 0 ? (jobStats.completed / jobStatsTotal) * 100 : 0,
    failed: jobStatsTotal > 0 ? (jobStats.failed / jobStatsTotal) * 100 : 0
  }
  
  // 当前选中的账户配额
  const currentAccountQuota = accountQuotas[selectedAccountIdx] || {
    account: '-', partition: '', qos: '-',
    max_cpus: 0, max_nodes: 0, max_jobs: 0,
    used_cpus: 0, cpu_pct: 0
  }
  
  // 当前选中的机时
  const currentMachineTime = machineTimeList[machineTimeIdx] || {
    qos_name: 'default',
    total_quota: 0,
    used: 0,
    remaining: 0,
    usage_rate: 0,
    has_limit: false
  }
  
  // 跳转到作业管理（带状态筛选）
  const openJobList = (state?: string) => {
    navigate('/dashboard/jobs' + (state ? `?state=${state}` : ''))
  }
  
  // 查看作业详情
  const viewJobDetail = (job: any) => {
    setSelectedJob(job)
  }
  
  // 取消作业
  const cancelJob = async (jobId: string) => {
    try {
      await axios.delete(`/jobs/${jobId}`)
      Message.success('作业已取消')
      refreshAll()
      setSelectedJob(null)
    } catch (e: any) {
      Message.error(e.response?.data?.error || '取消作业失败')
    }
  }
  
  // 过滤作业历史
  const filteredJobHistory = jobHistoryList.filter(j =>
    !jobHistoryFilter || j.job_state === jobHistoryFilter
  )
  
  // 机时统计
  const billingValidRecords = billingHistoryList.filter(r => r.billing_mins > 0 || r.billing_hours > 0)
  const billingTotalMins = billingValidRecords.reduce((s, r) =>
    s + (r.billing_mins || r.billing_hours * 60 || 0), 0
  )
  const billingCpuHours = billingValidRecords.reduce((s, r) => s + (r.cpu_hours || 0), 0)
  const billingGpuHours = billingValidRecords.reduce((s, r) => s + (r.gpu_hours || 0), 0)
  
  // 正在运行的作业表格列
  const runningJobColumns: TableColumnsType<RunningJob> = [
    {
      title: '作业ID',
      dataIndex: 'job_id',
      width: 120,
      render: (id) => <code style={{ fontSize: 12 }}>{id}</code>
    },
    { title: '作业名', dataIndex: 'name', ellipsis: true },
    { title: '分区', dataIndex: 'partition', width: 120 },
    { title: '节点数', dataIndex: 'num_nodes', width: 80 },
    { title: 'CPU核', dataIndex: 'cpus', width: 80 },
    {
      title: '已运行',
      dataIndex: 'run_time',
      width: 120,
      render: (time) => <Tag color="blue">{formatElapsed(time)}</Tag>
    },
    {
      title: '操作',
      width: 80,
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => viewJobDetail(record)}>
          详情
        </Button>
      )
    }
  ]
  
  // 作业历史表格列
  const jobHistoryColumns: TableColumnsType<any> = [
    {
      title: '作业ID',
      dataIndex: 'job_id',
      width: 120,
      render: (id) => <code style={{ fontSize: 12 }}>{id}</code>
    },
    { title: '作业名', dataIndex: 'name', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'job_state',
      width: 100,
      render: (state) => {
        const colorMap: Record<string, string> = {
          RUNNING: 'blue',
          PENDING: 'orange',
          COMPLETED: 'green',
          FAILED: 'red',
          CANCELLED: 'default'
        }
        return <Tag color={colorMap[state]}>{state}</Tag>
      }
    },
    { title: '分区', dataIndex: 'partition', width: 100 },
    { title: 'CPU核', dataIndex: 'cpus', width: 80 },
    {
      title: '提交时间',
      dataIndex: 'submit_time',
      width: 150,
      render: formatTime
    },
    {
      title: '开始时间',
      dataIndex: 'start_time',
      width: 150,
      render: formatTime
    },
    {
      title: '结束时间',
      dataIndex: 'end_time',
      width: 150,
      render: formatTime
    },
    {
      title: '运行时长',
      dataIndex: 'run_time',
      width: 120,
      render: formatElapsed
    },
    {
      title: '操作',
      width: 80,
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => viewJobDetail(record)}>
          详情
        </Button>
      )
    }
  ]
  
  // 机时历史表格列
  const billingColumns: TableColumnsType<any> = [
    {
      title: '作业ID',
      dataIndex: 'job_id',
      width: 120,
      render: (id) => <code style={{ fontSize: 12 }}>{id || '-'}</code>
    },
    { title: '作业名', dataIndex: 'job_name', ellipsis: true },
    { title: '账户', dataIndex: 'account', width: 120 },
    { title: '分区', dataIndex: 'partition', width: 100 },
    { title: 'QoS', dataIndex: 'qos', width: 100 },
    {
      title: '状态',
      dataIndex: 'state',
      width: 100,
      render: (state) => <Tag>{state || '-'}</Tag>
    },
    {
      title: '开始时间',
      dataIndex: 'start_time',
      width: 150,
      render: formatTime
    },
    {
      title: '结束时间',
      dataIndex: 'end_time',
      width: 150,
      render: formatTime
    },
    {
      title: '运行时长',
      dataIndex: 'elapsed_secs',
      width: 120,
      render: formatElapsed
    },
    {
      title: 'CPU 小时',
      dataIndex: 'cpu_hours',
      width: 100,
      render: (v) => (v || 0).toFixed(2)
    },
    {
      title: 'GPU 小时',
      dataIndex: 'gpu_hours',
      width: 100,
      render: (v) => (v || 0).toFixed(2)
    },
    {
      title: '消耗小时',
      width: 120,
      render: (_, record) => {
        const hours = ((record.billing_mins || record.billing_hours * 60 || record.cpu_hours * 60 || 0) / 60).toFixed(1)
        return <strong style={{ color: '#667eea' }}>{hours}</strong>
      }
    }
  ]
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 头部 */}
      <Card size="small">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
            <span style={{ fontSize: 18, fontWeight: 600 }}>集群总览</span>
            <Tag color="blue">Slurm</Tag>
            {lastUpdate && (
              <span style={{ fontSize: 12, color: '#94a3b8' }}>最后更新 {lastUpdate}</span>
            )}
          </Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={refreshAll}
            loading={loading}
            size="small"
          >
            刷新
          </Button>
        </div>
      </Card>
      
      {/* 集群资源统计卡片 - 移到顶部 */}
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="节点"
              value={stats.nodes_online}
              suffix={`/ ${stats.nodes}`}
              prefix={<CloudServerOutlined />}
              valueStyle={{ color: '#3b82f6' }}
            />
            <Progress
              percent={stats.nodes > 0 ? Math.round((stats.nodes_online / stats.nodes) * 100) : 0}
              strokeColor="#3b82f6"
              showInfo={false}
              style={{ marginTop: 8 }}
            />
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>可用 / 总数</div>
          </Card>
        </Col>
        
        <Col span={6}>
          <Card>
            <Statistic
              title="CPU"
              value={stats.cpu_usage}
              suffix={`/ ${stats.cpu_cores}`}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#10b981' }}
            />
            <Progress
              percent={stats.cpu_cores > 0 ? Math.round((stats.cpu_usage / stats.cpu_cores) * 100) : 0}
              strokeColor="#10b981"
              showInfo={false}
              style={{ marginTop: 8 }}
            />
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>已分配 / 总核数</div>
          </Card>
        </Col>
        
        <Col span={6}>
          <Card>
            <Statistic
              title="GPU"
              value={stats.gpu_in_use}
              suffix={`/ ${stats.gpu_cards}`}
              prefix={<DesktopOutlined />}
              valueStyle={{ color: '#8b5cf6' }}
            />
            <Progress
              percent={stats.gpu_cards > 0 ? Math.round((stats.gpu_in_use / stats.gpu_cards) * 100) : 0}
              strokeColor="#8b5cf6"
              showInfo={false}
              style={{ marginTop: 8 }}
            />
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>已使用 / 总卡数</div>
          </Card>
        </Col>
        
        <Col span={6}>
          <Card>
            <Statistic
              title="内存"
              value={formatMemory(stats.memory - stats.memory_free)}
              suffix={`/ ${formatMemory(stats.memory)}`}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#06b6d4' }}
            />
            <Progress
              percent={stats.memory > 0 ? Math.round(((stats.memory - stats.memory_free) / stats.memory) * 100) : 0}
              strokeColor="#06b6d4"
              showInfo={false}
              style={{ marginTop: 8 }}
            />
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>已使用 / 总量</div>
          </Card>
        </Col>
      </Row>

      {/* 四个图表卡片 */}
      <Row gutter={16}>
        {/* 作业统计 */}
        <Col span={6}>
          <Card
            size="small"
            title={
              <Space>
                <BarChartOutlined />
                作业统计
              </Space>
            }
            extra={
              <Button type="link" size="small" onClick={() => setJobHistoryOpen(true)}>
                历史记录 →
              </Button>
            }
            style={{ height: 320 }}
          >
            <div style={{ textAlign: 'center', paddingTop: 20 }}>
              <div style={{ fontSize: 48, fontWeight: 700, color: '#1f2937', marginBottom: 8 }}>
                {jobStatsTotal}
              </div>
              <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 24 }}>总作业</div>
              
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => openJobList('RUNNING')}
                >
                  <Space>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
                    <span style={{ fontSize: 13 }}>运行中</span>
                  </Space>
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#3b82f6' }}>{jobStats.running}</span>
                </div>
                
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => openJobList('PENDING')}
                >
                  <Space>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                    <span style={{ fontSize: 13 }}>等待中</span>
                  </Space>
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#f59e0b' }}>{jobStats.pending}</span>
                </div>
                
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => openJobList('COMPLETED')}
                >
                  <Space>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                    <span style={{ fontSize: 13 }}>已完成</span>
                  </Space>
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#10b981' }}>{jobStats.completed}</span>
                </div>
                
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => openJobList('FAILED')}
                >
                  <Space>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                    <span style={{ fontSize: 13 }}>失败</span>
                  </Space>
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#ef4444' }}>{jobStats.failed}</span>
                </div>
              </Space>
            </div>
          </Card>
        </Col>
        
        {/* 账户配额 */}
        <Col span={6}>
          <Card
            size="small"
            title={
              <Space>
                <TeamOutlined />
                账户配额
              </Space>
            }
            extra={
              accountQuotas.length > 1 && (
                <Select
                  size="small"
                  value={selectedAccountIdx}
                  onChange={setSelectedAccountIdx}
                  style={{ width: 120 }}
                >
                  {accountQuotas.map((a, i) => (
                    <Select.Option key={i} value={i}>{a.account}</Select.Option>
                  ))}
                </Select>
              )
            }
            style={{ height: 320 }}
          >
            {accountQuotas.length > 0 ? (
              <div style={{ textAlign: 'center', paddingTop: 20 }}>
                <div style={{ fontSize: 48, fontWeight: 700, marginBottom: 8 }}>
                  <span style={{ color: currentAccountQuota.cpu_pct > 90 ? '#ef4444' : currentAccountQuota.cpu_pct > 70 ? '#f59e0b' : '#667eea' }}>
                    {currentAccountQuota.cpu_pct}
                  </span>
                  <span style={{ fontSize: 24, color: '#9ca3af' }}>%</span>
                </div>
                <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8 }}>CPU 使用</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 24 }}>{currentAccountQuota.account}</div>
                
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#667eea' }} />
                      <span style={{ fontSize: 13 }}>CPU 限额</span>
                    </Space>
                    <span style={{ fontSize: 13 }}>
                      {currentAccountQuota.max_cpus > 0 ? `${currentAccountQuota.max_cpus} 核` : '无限制'}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                      <span style={{ fontSize: 13 }}>节点限额</span>
                    </Space>
                    <span style={{ fontSize: 13 }}>
                      {currentAccountQuota.max_nodes > 0 ? `${currentAccountQuota.max_nodes} 个` : '无限制'}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                      <span style={{ fontSize: 13 }}>作业上限</span>
                    </Space>
                    <span style={{ fontSize: 13 }}>
                      {currentAccountQuota.max_jobs > 0 ? currentAccountQuota.max_jobs : '无限制'}
                    </span>
                  </div>
                  
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
                    分区: {currentAccountQuota.partition || '全部'} · QoS: {currentAccountQuota.qos || '-'}
                  </div>
                </Space>
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无账户配额" />
            )}
          </Card>
        </Col>
        
        {/* 机时信息 */}
        <Col span={6}>
          <Card
            size="small"
            title={
              <Space>
                <ClockCircleOutlined />
                机时信息
              </Space>
            }
            extra={
              currentMachineTime.has_limit && (
                <Button type="link" size="small" onClick={() => setBillingHistoryOpen(true)}>
                  消费记录 →
                </Button>
              )
            }
            style={{ height: 320 }}
          >
            {machineTimeList.length > 1 && (
              <div style={{ marginBottom: 12, display: 'flex', gap: 4 }}>
                {machineTimeList.map((item, idx) => (
                  <Button
                    key={idx}
                    size="small"
                    type={machineTimeIdx === idx ? 'primary' : 'default'}
                    onClick={() => setMachineTimeIdx(idx)}
                  >
                    {item.qos_name}
                  </Button>
                ))}
              </div>
            )}
            
            {currentMachineTime.has_limit ? (
              <div style={{ textAlign: 'center', paddingTop: 20 }}>
                <div style={{ fontSize: 48, fontWeight: 700, marginBottom: 8 }}>
                  <span style={{ color: currentMachineTime.usage_rate > 90 ? '#ef4444' : currentMachineTime.usage_rate > 70 ? '#f59e0b' : '#667eea' }}>
                    {currentMachineTime.usage_rate < 0.01 && currentMachineTime.usage_rate > 0 ? '<0.01' : currentMachineTime.usage_rate}
                  </span>
                  <span style={{ fontSize: 24, color: '#9ca3af' }}>%</span>
                </div>
                <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 24 }}>使用率</div>
                
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: currentMachineTime.usage_rate > 90 ? '#ef4444' : currentMachineTime.usage_rate > 70 ? '#f59e0b' : '#667eea'
                      }} />
                      <span style={{ fontSize: 13 }}>已用</span>
                    </Space>
                    <span style={{ fontSize: 13 }}>{currentMachineTime.used.toFixed(1)} 小时</span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                      <span style={{ fontSize: 13 }}>剩余</span>
                    </Space>
                    <span style={{ fontSize: 13 }}>{currentMachineTime.remaining.toFixed(1)} 小时</span>
                  </div>
                  
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
                    总配额: {currentMachineTime.total_quota.toLocaleString()} 小时
                  </div>
                </Space>
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无机时配额" />
            )}
          </Card>
        </Col>
        
        {/* 存储配额 */}
        <Col span={6}>
          <Card
            size="small"
            title={
              <Space>
                <HddOutlined />
                存储配额
              </Space>
            }
            style={{ height: 320 }}
          >
            {storageQuota.has_data ? (
              <div style={{ textAlign: 'center', paddingTop: 20 }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: '#1f2937', marginBottom: 8 }}>
                  <span style={{ color: storageQuota.capacity.percentage > 90 ? '#ef4444' : storageQuota.capacity.percentage > 80 ? '#f59e0b' : '#667eea' }}>
                    {storageQuota.capacity.percentage}
                  </span>
                  <span style={{ fontSize: 24, color: '#9ca3af' }}>%</span>
                </div>
                <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 24 }}>已使用</div>
                
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: storageQuota.capacity.percentage > 90 ? '#ef4444' : storageQuota.capacity.percentage > 80 ? '#f59e0b' : '#667eea'
                      }} />
                      <span style={{ fontSize: 13 }}>已用</span>
                    </Space>
                    <span style={{ fontSize: 13 }}>{storageQuota.capacity.used}</span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e5e7eb' }} />
                      <span style={{ fontSize: 13 }}>总量</span>
                    </Space>
                    <span style={{ fontSize: 13 }}>{storageQuota.capacity.total}</span>
                  </div>
                  
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
                    {storageQuota.files.no_limit
                      ? `文件数: ${storageQuota.files.used.toLocaleString()} (未设置配额)`
                      : `文件数: ${storageQuota.files.used.toLocaleString()} / ${storageQuota.files.total.toLocaleString()} (${storageQuota.files.percentage}%)`
                    }
                  </div>
                </Space>
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无存储配额" />
            )}
          </Card>
        </Col>
      </Row>
      
      {/* 正在运行的作业 */}
      <Card
        title={
          <Space>
            <PlayCircleOutlined />
            正在运行的作业
            <Tag color="blue">{runningJobs.length} 个运行中</Tag>
          </Space>
        }
        extra={
          <Button
            type="link"
            size="small"
            icon={<ReloadOutlined />}
            onClick={loadJobStats}
          >
            刷新
          </Button>
        }
      >
        {runningJobs.length === 0 ? (
          <Empty description="暂无运行中的作业" />
        ) : (
          <Table
            columns={runningJobColumns}
            dataSource={runningJobs}
            rowKey="job_id"
            pagination={false}
            size="small"
          />
        )}
      </Card>
      
      {/* 节点状态 */}
      <Card
        title={
          <Space>
            <CloudServerOutlined />
            节点状态
            <Tag>{nodes.length} 个节点</Tag>
          </Space>
        }
      >
        {nodes.length === 0 ? (
          <Empty description="暂无节点数据" />
        ) : (
          <Row gutter={[16, 16]}>
            {nodes.map(node => {
              const cpuUsage = node.cpus > 0 ? Math.round((node.cpu_load / node.cpus) * 100) : 0
              const memUsage = node.real_memory > 0 ? Math.round((node.alloc_memory / node.real_memory) * 100) : 0
              
              const stateColor: Record<string, string> = {
                idle: '#10b981',
                allocated: '#3b82f6',
                mixed: '#f59e0b',
                down: '#ef4444',
                drain: '#94a3b8'
              }
              
              return (
                <Col span={6} key={node.name}>
                  <Card size="small" style={{ height: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontWeight: 600 }}>{node.name}</span>
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: stateColor[node.state.toLowerCase()] || '#94a3b8'
                      }} />
                    </div>
                    
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>CPU</span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{cpuUsage}%</span>
                      </div>
                      <Progress percent={cpuUsage} strokeColor="#3b82f6" showInfo={false} size="small" />
                    </div>
                    
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>MEM</span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{memUsage}%</span>
                      </div>
                      <Progress percent={memUsage} strokeColor="#10b981" showInfo={false} size="small" />
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: '#64748b' }}>作业数</span>
                      <span style={{ fontWeight: 600 }}>{node.jobs}</span>
                    </div>
                    
                    <Tag
                      color={stateColor[node.state.toLowerCase()] || 'default'}
                      style={{ marginTop: 8, width: '100%', textAlign: 'center' }}
                    >
                      {node.state}
                    </Tag>
                  </Card>
                </Col>
              )
            })}
          </Row>
        )}
      </Card>
      
      {/* 作业历史弹窗 */}
      <Modal
        title={
          <Space>
            <BarChartOutlined />
            <span>作业历史记录</span>
          </Space>
        }
        open={jobHistoryOpen}
        onCancel={() => setJobHistoryOpen(false)}
        width="90%"
        footer={null}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <RangePicker
                value={dateRange}
                onChange={(dates) => dates && setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
                placeholder={['开始日期', '结束日期']}
              />
              <Select
                value={jobHistoryFilter}
                onChange={setJobHistoryFilter}
                style={{ width: 140 }}
                placeholder="全部状态"
                allowClear
              >
                <Select.Option value="RUNNING">运行中</Select.Option>
                <Select.Option value="PENDING">等待中</Select.Option>
                <Select.Option value="COMPLETED">已完成</Select.Option>
                <Select.Option value="FAILED">失败</Select.Option>
                <Select.Option value="CANCELLED">已取消</Select.Option>
              </Select>
              <Button type="primary" onClick={loadJobHistory} icon={<SearchOutlined />}>
                查询
              </Button>
            </Space>
            <Button icon={<ExportOutlined />}>导出</Button>
          </Space>
          
          <Table
            columns={jobHistoryColumns}
            dataSource={filteredJobHistory}
            rowKey="job_id"
            loading={jobHistoryLoading}
            pagination={{ 
              pageSize: 20, 
              showSizeChanger: true, 
              showTotal: (total) => `共 ${total} 条记录`,
              pageSizeOptions: ['10', '20', '50', '100']
            }}
            scroll={{ x: 1200 }}
            size="small"
          />
        </Space>
      </Modal>
      
      {/* 机时历史弹窗 */}
      <Modal
        title="机时消费记录"
        open={billingHistoryOpen}
        onCancel={() => setBillingHistoryOpen(false)}
        width="90%"
        footer={null}
        destroyOnClose
      >
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <RangePicker
              value={billingDateRange}
              onChange={(dates) => dates && setBillingDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
            />
            <Button type="primary" onClick={loadBillingHistory}>
              查询
            </Button>
          </Space>
          <Button icon={<ExportOutlined />}>导出</Button>
        </Space>
        
        {/* 汇总卡片 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="总消耗"
                value={(billingTotalMins / 60).toFixed(1)}
                suffix="小时"
                valueStyle={{ color: '#667eea' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic title="有效作业数" value={billingValidRecords.length} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="CPU 小时"
                value={billingCpuHours.toFixed(2)}
                valueStyle={{ color: '#3b82f6' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="GPU 小时"
                value={billingGpuHours.toFixed(2)}
                valueStyle={{ color: '#8b5cf6' }}
              />
            </Card>
          </Col>
        </Row>
        
        <Table
          columns={billingColumns}
          dataSource={billingValidRecords}
          rowKey={(r) => r.job_id || Math.random()}
          loading={billingHistoryLoading}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
          scroll={{ x: 1400 }}
          size="small"
        />
      </Modal>
      
      {/* 作业详情弹窗 */}
      <Modal
        title={`作业详情 - ${selectedJob?.job_id}`}
        open={!!selectedJob}
        onCancel={() => setSelectedJob(null)}
        width={800}
        footer={
          selectedJob && selectedJob.job_state === 'RUNNING' ? (
            <Space>
              <Button onClick={() => setSelectedJob(null)}>关闭</Button>
              <Button danger onClick={() => cancelJob(selectedJob.job_id)}>
                取消作业
              </Button>
            </Space>
          ) : (
            <Button onClick={() => setSelectedJob(null)}>关闭</Button>
          )
        }
      >
        {selectedJob && (
          <div>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <div><strong>作业名:</strong> {selectedJob.name || '-'}</div>
              </Col>
              <Col span={12}>
                <div><strong>状态:</strong> <Tag>{selectedJob.job_state}</Tag></div>
              </Col>
              <Col span={12}>
                <div><strong>分区:</strong> {selectedJob.partition || '-'}</div>
              </Col>
              <Col span={12}>
                <div><strong>账户:</strong> {selectedJob.account || '-'}</div>
              </Col>
              <Col span={12}>
                <div><strong>节点数:</strong> {selectedJob.num_nodes || '-'}</div>
              </Col>
              <Col span={12}>
                <div><strong>CPU核:</strong> {selectedJob.cpus || '-'}</div>
              </Col>
              <Col span={12}>
                <div><strong>提交时间:</strong> {formatTime(selectedJob.submit_time)}</div>
              </Col>
              <Col span={12}>
                <div><strong>开始时间:</strong> {formatTime(selectedJob.start_time)}</div>
              </Col>
              {selectedJob.end_time > 0 && (
                <Col span={12}>
                  <div><strong>结束时间:</strong> {formatTime(selectedJob.end_time)}</div>
                </Col>
              )}
              <Col span={12}>
                <div><strong>运行时长:</strong> {formatElapsed(selectedJob.run_time)}</div>
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  )
}
