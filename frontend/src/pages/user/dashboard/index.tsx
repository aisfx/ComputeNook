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
  cpu_total: number
  cpu_allocated: number
  cpu_usage_percent: number
  memory_total_mb: number
  memory_allocated_mb: number
  memory_usage_percent: number
  gpu_info: string
  gpu_used: string
  partitions: string[]
  running_jobs: number
}

interface PartitionInfo {
  name: string
  state: string
  nodes: string
  node_count: number
  max_time: number | string  // 可能是数字(分钟)或"infinite"
  default_time: number | null
  max_nodes: number | string  // 可能是数字或"infinite"
  min_nodes: number
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
  has_usage?: boolean  // 新增：是否有使用记录
}

interface StorageQuota {
  has_data: boolean
  not_configured?: boolean  // 新增：标记配额系统未配置
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
  const [partitions, setPartitions] = useState<PartitionInfo[]>([])
  
  // 分区详情
  const [selectedPartition, setSelectedPartition] = useState<PartitionInfo | null>(null)
  const [partitionDetailOpen, setPartitionDetailOpen] = useState(false)
  
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
  
  // 节点详情弹窗
  const [selectedNode, setSelectedNode] = useState<NodeInfo | null>(null)
  const [nodeDetailOpen, setNodeDetailOpen] = useState(false)
  
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
  
  // Tab视图切换（作业 | 分区 | 节点）
  const [activeViewTab, setActiveViewTab] = useState<'jobs' | 'partitions' | 'nodes'>('jobs')
  
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
  
  // 加载分区信息
  const loadPartitions = useCallback(async () => {
    try {
      const res = await axios.get('/jobs/partitions/list')
      setPartitions(res.data.data || [])
    } catch (e) {
      console.error('加载分区失败:', e)
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
        has_limit: (item.total_quota || 0) > 0,
        has_usage: (item.used_hours || 0) > 0  // 新增：标记是否有使用记录
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
      } else {
        // 配额系统未配置，设置标记
        setStorageQuota({
          has_data: false,
          not_configured: true,
          capacity: { used: '0 KB', total: '0 KB', percentage: 0 },
          files: { used: 0, total: 0, percentage: 0, no_limit: true }
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
      loadPartitions(),
      loadAccountQuotas(),
      loadMachineTime(),
      loadStorageQuota()
    ])
  }, [loadDashboard, loadJobStats, loadNodes, loadPartitions, loadAccountQuotas, loadMachineTime, loadStorageQuota])
  
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

      {/* 四个图表卡片 - 改为左右布局，统一高度，平均分配宽度 */}
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
            styles={{ body: { height: 140 } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, height: '100%' }}>
              {/* 左侧：大数字 */}
              <div style={{ flex: '0 0 auto', textAlign: 'center' }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: '#1f2937', lineHeight: 1 }}>
                  {jobStatsTotal}
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>总作业</div>
              </div>
              
              {/* 右侧：状态列表 */}
              <Space direction="vertical" style={{ flex: 1 }} size={6}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => openJobList('RUNNING')}
                >
                  <Space size={6}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
                    <span style={{ fontSize: 13 }}>运行中</span>
                  </Space>
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#3b82f6' }}>{jobStats.running}</span>
                </div>
                
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => openJobList('PENDING')}
                >
                  <Space size={6}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                    <span style={{ fontSize: 13 }}>等待中</span>
                  </Space>
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#f59e0b' }}>{jobStats.pending}</span>
                </div>
                
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => openJobList('COMPLETED')}
                >
                  <Space size={6}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                    <span style={{ fontSize: 13 }}>已完成</span>
                  </Space>
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#10b981' }}>{jobStats.completed}</span>
                </div>
                
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => openJobList('FAILED')}
                >
                  <Space size={6}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                    <span style={{ fontSize: 13 }}>失败</span>
                  </Space>
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#ef4444' }}>{jobStats.failed}</span>
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
            styles={{ body: { height: 140 } }}
          >
            {accountQuotas.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, height: '100%' }}>
                {/* 左侧：百分比或数字 */}
                <div style={{ flex: '0 0 auto', textAlign: 'center', minWidth: 100 }}>
                  {currentAccountQuota.max_cpus > 0 ? (
                    <>
                      <div style={{ fontSize: 48, fontWeight: 700, lineHeight: 1 }}>
                        <span style={{ color: currentAccountQuota.cpu_pct > 90 ? '#ef4444' : currentAccountQuota.cpu_pct > 70 ? '#f59e0b' : '#667eea' }}>
                          {currentAccountQuota.cpu_pct}
                        </span>
                        <span style={{ fontSize: 20, color: '#9ca3af' }}>%</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                        {currentAccountQuota.used_cpus}/{currentAccountQuota.max_cpus} 核
                      </div>
                    </>
                  ) : currentAccountQuota.used_cpus > 0 ? (
                    <>
                      <div style={{ fontSize: 48, fontWeight: 700, color: '#667eea', lineHeight: 1 }}>
                        {currentAccountQuota.used_cpus}
                      </div>
                      <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>
                        ⚠️ 无限制
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 36 }}>🎯</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                        无作业
                      </div>
                    </>
                  )}
                </div>
                
                {/* 右侧：详细信息 */}
                <Space direction="vertical" style={{ flex: 1 }} size={6}>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>
                    账户: {currentAccountQuota.account}
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space size={4}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#667eea' }} />
                      <span style={{ fontSize: 12 }}>CPU限额</span>
                    </Space>
                    <span style={{ fontSize: 12 }}>
                      {currentAccountQuota.max_cpus > 0 ? `${currentAccountQuota.max_cpus}核` : '无限制'}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space size={4}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                      <span style={{ fontSize: 12 }}>节点限额</span>
                    </Space>
                    <span style={{ fontSize: 12 }}>
                      {currentAccountQuota.max_nodes > 0 ? `${currentAccountQuota.max_nodes}个` : '无限制'}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space size={4}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
                      <span style={{ fontSize: 12 }}>作业上限</span>
                    </Space>
                    <span style={{ fontSize: 12 }}>
                      {currentAccountQuota.max_jobs > 0 ? currentAccountQuota.max_jobs : '无限制'}
                    </span>
                  </div>
                  
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4, paddingTop: 4, borderTop: '1px solid #f3f4f6' }}>
                    分区: {currentAccountQuota.partition || '全部'} · QoS: {currentAccountQuota.qos || '-'}
                  </div>
                </Space>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无账户配额" />
              </div>
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
            styles={{ body: { height: 140 } }}
          >
            {machineTimeList.length > 1 && (
              <div style={{ marginBottom: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
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
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, height: machineTimeList.length > 1 ? 'calc(100% - 40px)' : '100%' }}>
              {currentMachineTime.has_limit ? (
                <>
                  {/* 左侧：百分比 */}
                  <div style={{ flex: '0 0 auto', textAlign: 'center', minWidth: 100 }}>
                    <div style={{ fontSize: 42, fontWeight: 700, lineHeight: 1 }}>
                      <span style={{ color: currentMachineTime.usage_rate > 90 ? '#ef4444' : currentMachineTime.usage_rate > 70 ? '#f59e0b' : '#667eea' }}>
                        {currentMachineTime.usage_rate < 0.01 && currentMachineTime.usage_rate > 0 ? '<0.01' : currentMachineTime.usage_rate}
                      </span>
                      <span style={{ fontSize: 20, color: '#9ca3af' }}>%</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>使用率</div>
                  </div>
                  
                  {/* 右侧：详细信息 */}
                  <Space direction="vertical" style={{ flex: 1 }} size={6}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space size={6}>
                        <div style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: currentMachineTime.usage_rate > 90 ? '#ef4444' : currentMachineTime.usage_rate > 70 ? '#f59e0b' : '#667eea'
                        }} />
                        <span style={{ fontSize: 12 }}>已用</span>
                      </Space>
                      <span style={{ fontSize: 12 }}>{currentMachineTime.used.toFixed(1)} 小时</span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space size={6}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                        <span style={{ fontSize: 12 }}>剩余</span>
                      </Space>
                      <span style={{ fontSize: 12 }}>{currentMachineTime.remaining.toFixed(1)} 小时</span>
                    </div>
                    
                    <div style={{ fontSize: 10, color: '#9ca3af', paddingTop: 4, borderTop: '1px solid #f3f4f6' }}>
                      总配额: {currentMachineTime.total_quota.toLocaleString()} 小时
                    </div>
                  </Space>
                </>
              ) : currentMachineTime.has_usage ? (
                <>
                  {/* 左侧：已用小时数 */}
                  <div style={{ flex: '0 0 auto', textAlign: 'center', minWidth: 100 }}>
                    <div style={{ fontSize: 42, fontWeight: 700, color: '#667eea', lineHeight: 1 }}>
                      {currentMachineTime.used.toFixed(1)}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>已用小时</div>
                  </div>
                  
                  {/* 右侧：提示信息 */}
                  <Space direction="vertical" style={{ flex: 1 }} size={6}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space size={6}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#667eea' }} />
                        <span style={{ fontSize: 12 }}>QoS</span>
                      </Space>
                      <span style={{ fontSize: 12 }}>{currentMachineTime.qos_name}</span>
                    </div>
                    
                    <div style={{ fontSize: 11, color: '#f59e0b', textAlign: 'center', marginTop: 6 }}>
                      ⚠️ 未设置配额限制
                    </div>
                  </Space>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>⏰</div>
                  <div style={{ fontSize: 13, color: '#9ca3af' }}>暂无机时使用记录</div>
                </div>
              )}
            </div>
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
            styles={{ body: { height: 140 } }}
          >
            {storageQuota.has_data ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, height: '100%' }}>
                {/* 左侧：百分比 */}
                <div style={{ flex: '0 0 auto', textAlign: 'center', minWidth: 100 }}>
                  <div style={{ fontSize: 48, fontWeight: 700, lineHeight: 1 }}>
                    <span style={{ color: storageQuota.capacity.percentage > 90 ? '#ef4444' : storageQuota.capacity.percentage > 80 ? '#f59e0b' : '#667eea' }}>
                      {storageQuota.capacity.percentage}
                    </span>
                    <span style={{ fontSize: 24, color: '#9ca3af' }}>%</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>已使用</div>
                </div>
                
                {/* 右侧：详细信息 */}
                <Space direction="vertical" style={{ flex: 1 }} size={8}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space size={6}>
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
                    <Space size={6}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e5e7eb' }} />
                      <span style={{ fontSize: 13 }}>总量</span>
                    </Space>
                    <span style={{ fontSize: 13 }}>{storageQuota.capacity.total}</span>
                  </div>
                  
                  <div style={{ fontSize: 11, color: '#9ca3af', paddingTop: 6, borderTop: '1px solid #f3f4f6' }}>
                    {storageQuota.files.no_limit
                      ? `文件数: ${storageQuota.files.used.toLocaleString()} (未设限)`
                      : `文件数: ${storageQuota.files.used.toLocaleString()} / ${storageQuota.files.total.toLocaleString()} (${storageQuota.files.percentage}%)`
                    }
                  </div>
                </Space>
              </div>
            ) : storageQuota.not_configured ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📦</div>
                <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 4 }}>
                  存储配额系统未配置
                </div>
                <div style={{ fontSize: 11, color: '#d1d5db' }}>
                  请联系管理员配置配额系统
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无存储配额" />
              </div>
            )}
          </Card>
        </Col>
      </Row>
      
      {/* 作业/分区/节点 Tab视图 */}
      <Card
        title={
          <Space size="large">
            <Space style={{ fontSize: 16, fontWeight: 600 }}>
              <CloudServerOutlined />
              资源视图
            </Space>
            <Space size={0} style={{ 
              border: '1px solid #d9d9d9', 
              borderRadius: 4,
              overflow: 'hidden'
            }}>
              <Button
                type={activeViewTab === 'jobs' ? 'primary' : 'text'}
                size="small"
                onClick={() => setActiveViewTab('jobs')}
                style={{ 
                  borderRadius: 0,
                  border: 'none'
                }}
              >
                作业 {runningJobs.length > 0 && (
                  <Tag 
                    color={activeViewTab === 'jobs' ? 'blue' : 'default'} 
                    style={{ marginLeft: 4, fontSize: 11 }}
                  >
                    {runningJobs.length}
                  </Tag>
                )}
              </Button>
              <div style={{ width: 1, height: 20, background: '#d9d9d9' }} />
              <Button
                type={activeViewTab === 'partitions' ? 'primary' : 'text'}
                size="small"
                onClick={() => setActiveViewTab('partitions')}
                style={{ 
                  borderRadius: 0,
                  border: 'none'
                }}
              >
                分区
              </Button>
              <div style={{ width: 1, height: 20, background: '#d9d9d9' }} />
              <Button
                type={activeViewTab === 'nodes' ? 'primary' : 'text'}
                size="small"
                onClick={() => setActiveViewTab('nodes')}
                style={{ 
                  borderRadius: 0,
                  border: 'none'
                }}
              >
                节点 {nodes.length > 0 && (
                  <Tag 
                    color={activeViewTab === 'nodes' ? 'green' : 'default'} 
                    style={{ marginLeft: 4, fontSize: 11 }}
                  >
                    {nodes.length}
                  </Tag>
                )}
              </Button>
            </Space>
          </Space>
        }
        extra={
          <Space>
            {activeViewTab === 'jobs' && (
              <Button type="link" size="small" onClick={() => setJobHistoryOpen(true)}>
                历史记录 →
              </Button>
            )}
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              onClick={
                activeViewTab === 'jobs' ? loadJobStats : 
                activeViewTab === 'partitions' ? loadPartitions : 
                loadNodes
              }
            >
              刷新
            </Button>
          </Space>
        }
      >
        {/* 作业视图 */}
        {activeViewTab === 'jobs' && (
          runningJobs.length === 0 ? (
            <Empty description="暂无运行中的作业" />
          ) : (
            <Table
              columns={runningJobColumns}
              dataSource={runningJobs}
              rowKey="job_id"
              pagination={false}
              size="small"
            />
          )
        )}
        
        {/* 分区视图 */}
        {activeViewTab === 'partitions' && (
          partitions.length === 0 ? (
            <Empty description="暂无分区数据" />
          ) : (
            <Table
              columns={[
                {
                  title: '分区名称',
                  dataIndex: 'name',
                  key: 'name',
                  width: 150,
                  render: (name: string, record: PartitionInfo) => {
                    const stateColors: Record<string, string> = {
                      up: '#10b981',
                      down: '#ef4444',
                      drain: '#f59e0b',
                      inactive: '#94a3b8'
                    }
                    return (
                      <Space>
                        <div style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: stateColors[record.state.toLowerCase()] || '#10b981'
                        }} />
                        <span style={{ fontWeight: 500 }}>{name}</span>
                      </Space>
                    )
                  }
                },
                {
                  title: '状态',
                  dataIndex: 'state',
                  key: 'state',
                  width: 100,
                  render: (state: string) => {
                    const stateColorMap: Record<string, string> = {
                      up: 'success',
                      down: 'error',
                      drain: 'warning',
                      inactive: 'default'
                    }
                    return (
                      <Tag color={stateColorMap[state.toLowerCase()] || 'success'}>
                        {state.toUpperCase()}
                      </Tag>
                    )
                  }
                },
                {
                  title: '时间限制',
                  dataIndex: 'max_time',
                  key: 'max_time',
                  width: 150,
                  render: (time: number | string) => {
                    if (time === 'infinite') {
                      return <Tag color="blue">无限制</Tag>
                    }
                    const hours = Math.floor(Number(time) / 60)
                    const mins = Number(time) % 60
                    return `${hours}小时${mins > 0 ? mins + '分' : ''}`
                  }
                },
                {
                  title: '节点数量',
                  dataIndex: 'node_count',
                  key: 'node_count',
                  width: 100,
                  align: 'center' as const,
                  render: (count: number) => <span style={{ fontWeight: 500 }}>{count}</span>
                },
                {
                  title: '节点列表',
                  dataIndex: 'nodes',
                  key: 'nodes',
                  ellipsis: true,
                  render: (nodes: string) => (
                    <span style={{ fontSize: 12, color: '#64748b' }}>{nodes || '-'}</span>
                  )
                },
                {
                  title: '最大节点数',
                  dataIndex: 'max_nodes',
                  key: 'max_nodes',
                  width: 120,
                  align: 'center' as const,
                  render: (maxNodes: number | string) => {
                    if (maxNodes === 'infinite') {
                      return <Tag color="blue">无限制</Tag>
                    }
                    return maxNodes
                  }
                },
                {
                  title: '最小节点数',
                  dataIndex: 'min_nodes',
                  key: 'min_nodes',
                  width: 120,
                  align: 'center' as const,
                },
                {
                  title: '操作',
                  key: 'action',
                  width: 100,
                  align: 'center' as const,
                  render: (_: any, record: PartitionInfo) => (
                    <Button
                      type="link"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => {
                        setSelectedPartition(record)
                        setPartitionDetailOpen(true)
                      }}
                    >
                      详情
                    </Button>
                  )
                }
              ]}
              dataSource={partitions}
              rowKey="name"
              pagination={false}
              size="small"
            />
          )
        )}
        
        {/* 节点视图 */}
        {activeViewTab === 'nodes' && (
          nodes.length === 0 ? (
            <Empty description="暂无节点数据" />
          ) : (
            <Table
              columns={[
                {
                  title: '节点名称',
                  dataIndex: 'name',
                  key: 'name',
                  width: 200,
                  render: (name: string, record: NodeInfo) => {
                    const stateColors: Record<string, string> = {
                      idle: '#10b981',
                      allocated: '#3b82f6',
                      mixed: '#f59e0b',
                      down: '#ef4444',
                      drain: '#94a3b8'
                    }
                    return (
                      <Space>
                        <div style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: stateColors[record.state.toLowerCase()] || '#94a3b8'
                        }} />
                        <span style={{ fontWeight: 500 }}>{name}</span>
                      </Space>
                    )
                  }
                },
                {
                  title: '状态',
                  dataIndex: 'state',
                  key: 'state',
                  width: 100,
                  render: (state: string) => {
                    const stateColorMap: Record<string, string> = {
                      idle: 'success',
                      allocated: 'processing',
                      mixed: 'warning',
                      down: 'error',
                      drain: 'default'
                    }
                    return (
                      <Tag color={stateColorMap[state.toLowerCase()] || 'default'}>
                        {state.toUpperCase()}
                      </Tag>
                    )
                  }
                },
                {
                  title: 'CPU 总数',
                  dataIndex: 'cpu_total',
                  key: 'cpu_total',
                  width: 100,
                  align: 'center' as const,
                  render: (cpus: number) => <span style={{ fontWeight: 500 }}>{cpus}</span>
                },
                {
                  title: 'CPU 已用',
                  dataIndex: 'cpu_allocated',
                  key: 'cpu_allocated',
                  width: 100,
                  align: 'center' as const,
                  render: (allocated: number, record: NodeInfo) => {
                    const usage = record.cpu_usage_percent
                    return (
                      <span style={{ 
                        fontWeight: 500,
                        color: usage > 80 ? '#ef4444' : usage > 50 ? '#f59e0b' : '#10b981'
                      }}>
                        {allocated}
                      </span>
                    )
                  }
                },
                {
                  title: 'CPU 使用率',
                  key: 'cpu_usage',
                  width: 150,
                  render: (_, record: NodeInfo) => {
                    const usage = Math.round(record.cpu_usage_percent)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Progress 
                          percent={usage} 
                          size="small" 
                          strokeColor={usage > 80 ? '#ef4444' : usage > 50 ? '#f59e0b' : '#3b82f6'}
                          style={{ flex: 1, margin: 0 }}
                        />
                        <span style={{ fontSize: 12, minWidth: 35 }}>{usage}%</span>
                      </div>
                    )
                  }
                },
                {
                  title: '内存总量',
                  dataIndex: 'memory_total_mb',
                  key: 'memory_total_mb',
                  width: 120,
                  align: 'center' as const,
                  render: (mem: number) => `${(mem / 1024).toFixed(1)} GB`
                },
                {
                  title: '内存已用',
                  dataIndex: 'memory_allocated_mb',
                  key: 'memory_allocated_mb',
                  width: 120,
                  align: 'center' as const,
                  render: (mem: number) => `${(mem / 1024).toFixed(1)} GB`
                },
                {
                  title: '内存使用率',
                  key: 'mem_usage',
                  width: 150,
                  render: (_, record: NodeInfo) => {
                    const usage = Math.round(record.memory_usage_percent)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Progress 
                          percent={usage} 
                          size="small" 
                          strokeColor={usage > 80 ? '#ef4444' : usage > 50 ? '#f59e0b' : '#10b981'}
                          style={{ flex: 1, margin: 0 }}
                        />
                        <span style={{ fontSize: 12, minWidth: 35 }}>{usage}%</span>
                      </div>
                    )
                  }
                },
                {
                  title: '作业数',
                  dataIndex: 'running_jobs',
                  key: 'running_jobs',
                  width: 80,
                  align: 'center' as const,
                  render: (jobs: number) => (
                    <span style={{ fontWeight: 500, color: jobs > 0 ? '#3b82f6' : '#9ca3af' }}>
                      {jobs}
                    </span>
                  )
                }
              ]}
              dataSource={nodes}
              rowKey="name"
              pagination={false}
              size="small"
              onRow={(record) => ({
                onClick: () => {
                  setSelectedNode(record)
                  setNodeDetailOpen(true)
                },
                style: { cursor: 'pointer' }
              })}
            />
          )
        )}
      </Card>
      
      {/* 节点详情弹窗 */}
      <Modal
        title={
          <Space>
            <CloudServerOutlined />
            <span>节点详情</span>
            {selectedNode && (
              <Tag color={
                selectedNode.state.toLowerCase() === 'idle' ? 'success' :
                selectedNode.state.toLowerCase() === 'allocated' ? 'processing' :
                selectedNode.state.toLowerCase() === 'mixed' ? 'warning' :
                selectedNode.state.toLowerCase() === 'down' ? 'error' : 'default'
              }>
                {selectedNode.state}
              </Tag>
            )}
          </Space>
        }
        open={nodeDetailOpen}
        onCancel={() => {
          setNodeDetailOpen(false)
          setSelectedNode(null)
        }}
        width={700}
        footer={[
          <Button key="close" onClick={() => {
            setNodeDetailOpen(false)
            setSelectedNode(null)
          }}>
            关闭
          </Button>
        ]}
      >
        {selectedNode && (() => {
          const cpuUsage = Math.round(selectedNode.cpu_usage_percent)
          const memUsage = Math.round(selectedNode.memory_usage_percent)
          const memUsageGB = (selectedNode.memory_allocated_mb / 1024).toFixed(1)
          const memTotalGB = (selectedNode.memory_total_mb / 1024).toFixed(1)
          
          return (
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {/* 基本信息 */}
              <Card size="small" title="基本信息">
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>节点名称</div>
                      <div style={{ fontWeight: 600 }}>{selectedNode.name}</div>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>运行作业数</div>
                      <div style={{ fontWeight: 600, color: '#3b82f6' }}>{selectedNode.running_jobs} 个</div>
                    </div>
                  </Col>
                </Row>
              </Card>
              
              {/* CPU 使用情况 */}
              <Card size="small" title="CPU 使用情况">
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span>CPU 负载</span>
                    <span style={{ fontWeight: 600, color: '#3b82f6' }}>
                      {selectedNode.cpu_allocated} / {selectedNode.cpu_total} 核
                    </span>
                  </div>
                  <Progress 
                    percent={cpuUsage} 
                    strokeColor={{
                      '0%': '#3b82f6',
                      '100%': cpuUsage > 90 ? '#ef4444' : cpuUsage > 70 ? '#f59e0b' : '#10b981'
                    }}
                  />
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  使用率: {cpuUsage}%
                </div>
              </Card>
              
              {/* 内存使用情况 */}
              <Card size="small" title="内存使用情况">
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span>内存占用</span>
                    <span style={{ fontWeight: 600, color: '#10b981' }}>
                      {memUsageGB} GB / {memTotalGB} GB
                    </span>
                  </div>
                  <Progress 
                    percent={memUsage} 
                    strokeColor={{
                      '0%': '#10b981',
                      '100%': memUsage > 90 ? '#ef4444' : memUsage > 70 ? '#f59e0b' : '#10b981'
                    }}
                  />
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  使用率: {memUsage}%
                </div>
              </Card>
            </Space>
          )
        })()}
      </Modal>
      
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

      {/* 分区详情弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CloudServerOutlined style={{ color: '#3b82f6' }} />
            <span>分区详情 - {selectedPartition?.name}</span>
          </div>
        }
        open={partitionDetailOpen}
        onCancel={() => {
          setPartitionDetailOpen(false)
          setSelectedPartition(null)
        }}
        width={700}
        footer={
          <Button onClick={() => {
            setPartitionDetailOpen(false)
            setSelectedPartition(null)
          }}>
            关闭
          </Button>
        }
      >
        {selectedPartition && (
          <div style={{ padding: '8px 0' }}>
            <Row gutter={[16, 16]}>
              {/* 状态信息 */}
              <Col span={24}>
                <div style={{ 
                  padding: 12, 
                  background: '#f5f5f5', 
                  borderRadius: 6,
                  marginBottom: 16
                }}>
                  <Space size="large">
                    <div>
                      <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>状态</div>
                      <Tag color={selectedPartition.state.toLowerCase() === 'up' ? 'success' : 'error'} style={{ fontSize: 13 }}>
                        {selectedPartition.state.toUpperCase()}
                      </Tag>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>节点数量</div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{selectedPartition.node_count} 个</div>
                    </div>
                  </Space>
                </div>
              </Col>
              
              {/* 时间限制 */}
              <Col span={24}>
                <div style={{ 
                  padding: 12, 
                  background: '#f9fafb', 
                  borderRadius: 6,
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ 
                    fontSize: 11, 
                    fontWeight: 600, 
                    color: '#6b7280', 
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    时间限制
                  </div>
                  <Row gutter={16}>
                    <Col span={12}>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>最大时间</div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                        {selectedPartition.max_time === 'infinite' ? (
                          <Tag color="blue">无限制</Tag>
                        ) : (
                          `${Math.floor(Number(selectedPartition.max_time) / 60)} 小时 ${Number(selectedPartition.max_time) % 60} 分`
                        )}
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>默认时间</div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                        {selectedPartition.default_time ? (
                          `${Math.floor(Number(selectedPartition.default_time) / 60)} 小时 ${Number(selectedPartition.default_time) % 60} 分`
                        ) : (
                          <span style={{ color: '#9ca3af' }}>未设置</span>
                        )}
                      </div>
                    </Col>
                  </Row>
                </div>
              </Col>
              
              {/* 节点限制 */}
              <Col span={24}>
                <div style={{ 
                  padding: 12, 
                  background: '#f9fafb', 
                  borderRadius: 6,
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ 
                    fontSize: 11, 
                    fontWeight: 600, 
                    color: '#6b7280', 
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    节点限制
                  </div>
                  <Row gutter={16}>
                    <Col span={8}>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>最大节点数</div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                        {selectedPartition.max_nodes === 'infinite' ? (
                          <Tag color="blue">无限制</Tag>
                        ) : (
                          selectedPartition.max_nodes
                        )}
                      </div>
                    </Col>
                    <Col span={8}>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>最小节点数</div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                        {selectedPartition.min_nodes || 1}
                      </div>
                    </Col>
                    <Col span={8}>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>当前节点数</div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                        {selectedPartition.node_count}
                      </div>
                    </Col>
                  </Row>
                </div>
              </Col>
              
              {/* 节点列表 */}
              <Col span={24}>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ color: '#64748b', fontSize: 12 }}>节点列表:</strong>
                  <div style={{ 
                    marginTop: 8, 
                    padding: 12, 
                    background: '#f9fafb', 
                    borderRadius: 4,
                    fontFamily: 'monospace',
                    fontSize: 12,
                    wordBreak: 'break-all',
                    maxHeight: 150,
                    overflowY: 'auto'
                  }}>
                    {selectedPartition.nodes || '暂无节点信息'}
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  )
}
