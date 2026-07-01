import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, Row, Col, Tag, Progress, Table, Tabs, Space, Button, Spin, Empty, Tooltip } from 'antd'
import type { TableColumnsType } from 'antd'
import { ReloadOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons'
import axios from 'axios'

// ── 类型 ──────────────────────────────────────────────────────
interface Overview {
  total_nodes: number; idle_nodes: number; allocated_nodes: number; down_nodes: number
  total_cpus: number; idle_cpus: number; allocated_cpus: number
  total_gpus: number; idle_gpus: number
  total_memory_gb: number; idle_memory_gb: number; allocated_memory_gb: number
  total_jobs: number; running_jobs: number; pending_jobs: number
}
interface NodeMetric {
  node_name: string; state: string; cpu_total: number; cpu_alloc: number; cpu_load: number
  mem_total_gb: number; mem_alloc_gb: number; mem_used_gb: number
  gpu_total?: number; gpu_alloc?: number
  net_rx_bps?: number; net_tx_bps?: number
  partition: string; features?: string; instance?: string
}
interface Service {
  name: string; display: string; active: boolean; state: string
  cpu: number; mem_mb: number; fds: number
}
interface PromAlert {
  labels: { alertname: string; severity: string; [k: string]: string }
  annotations: { summary: string; description?: string }
  state: string; activeAt: string
}

// ── 仪表盘 SVG ───────────────────────────────────────────────
function Gauge({ value, warn = 80, label }: { value: number; warn?: number; label: string }) {
  const pct = Math.min(Math.max(value, 0), 100)
  const color = pct > 90 ? '#ef4444' : pct > warn ? '#f59e0b' : '#10b981'
  const dashArray = `${pct * 1.728} 172.8`
  return (
    <div style={{ textAlign: 'center', minWidth: 100 }}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{label}</div>
      <svg viewBox="0 0 120 70" width="100" height="60">
        <path d="M10,65 A55,55 0 0,1 110,65" fill="none" stroke="#2a2a3a" strokeWidth="12" strokeLinecap="round" />
        <path d="M10,65 A55,55 0 0,1 110,65" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={dashArray} strokeDashoffset="0" />
        <text x="6" y="72" fontSize="8" fill="#666">0</text>
        <text x="54" y="16" fontSize="8" fill="#666" textAnchor="middle">50</text>
        <text x="108" y="72" fontSize="8" fill="#666" textAnchor="end">100</text>
      </svg>
      <div style={{ fontSize: 18, fontWeight: 700, color, marginTop: -4 }}>{pct.toFixed(1)}<span style={{ fontSize: 12, fontWeight: 400 }}>%</span></div>
    </div>
  )
}

// ── 迷你折线图 (纯 SVG) ──────────────────────────────────────
function SparkLine({ data, color = '#6366f1', height = 48 }: { data: number[]; color?: string; height?: number }) {
  if (!data.length) return <div style={{ height }} />
  const max = Math.max(...data, 1)
  const min = Math.min(...data)
  const w = 200, h = height
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1 || 1)) * w
    const y = h - ((v - min) / ((max - min) || 1)) * (h - 4) - 2
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" />
      <text x="2" y={h - 2} fontSize="9" fill="#888">{min.toFixed(1)}</text>
      <text x="2" y="10" fontSize="9" fill="#888">{max.toFixed(1)}</text>
    </svg>
  )
}

// ── 堆叠条形图 ───────────────────────────────────────────────
function StackBars({ data, height = 240 }: {
  data: { label: string; segments: { name: string; value: number; color: string }[] }[]
  height?: number
}) {
  if (!data.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无数据" />
  const maxVal = Math.max(...data.map(d => d.segments.reduce((s, x) => s + x.value, 0)), 1)
  const barW = Math.max(16, Math.min(48, Math.floor(580 / data.length) - 4))
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height, overflowX: 'auto', paddingBottom: 28, borderBottom: '1px solid #f0f0f0' }}>
        {data.map((d, i) => {
          const total = d.segments.reduce((s, x) => s + x.value, 0)
          return (
            <Tooltip key={i} title={<div><b>{d.label}</b><br />{d.segments.map(s => <div key={s.name}>{s.name}: {s.value.toFixed(1)}</div>)}</div>}>
              <div style={{ display: 'flex', flexDirection: 'column-reverse', width: barW, flexShrink: 0, cursor: 'pointer', position: 'relative' }}>
                <div style={{ position: 'absolute', bottom: -20, left: 0, right: 0, textAlign: 'center', fontSize: 9, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</div>
                {d.segments.map((seg, j) => (
                  <div key={j} style={{ height: Math.max((seg.value / maxVal) * (height - 32), seg.value > 0 ? 2 : 0), background: seg.color, transition: 'height 0.3s' }} />
                ))}
              </div>
            </Tooltip>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
        {data[0]?.segments.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
            <span style={{ color: '#666' }}>{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 节点状态色 ───────────────────────────────────────────────
const STATE_COLOR: Record<string, string> = { idle: '#52c41a', allocated: '#1890ff', mixed: '#fa8c16', down: '#ff4d4f', drained: '#8c8c8c', draining: '#faad14' }
const STATE_LABEL: Record<string, string> = { idle: '空闲', allocated: '已分配', mixed: '混合', down: '故障', drained: '已排空', draining: '排空中' }

export default function Monitoring() {
  const [loading, setLoading]       = useState(false)
  const [mainTab, setMainTab]       = useState('cluster')
  const [chartTab, setChartTab]     = useState('cpu')
  const [overview, setOverview]     = useState<Overview | null>(null)
  const [nodes, setNodes]           = useState<NodeMetric[]>([])
  const [services, setServices]     = useState<Service[]>([])
  const [alerts, setAlerts]         = useState<PromAlert[]>([])
  const [promOk, setPromOk]         = useState(false)

  // 时序数据 (最近 20 个点)
  const [cpuHistory, setCpuHistory]   = useState<number[]>([])
  const [memHistory, setMemHistory]   = useState<number[]>([])
  const [gpuHistory, setGpuHistory]   = useState<number[]>([])
  const [lastRefresh, setLastRefresh] = useState('')
  const timerRef = useRef<any>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ovRes, nodeRes, svcRes, alertRes] = await Promise.allSettled([
        axios.get('/monitoring/overview'),
        axios.get('/monitoring/node-metrics'),
        axios.get('/monitoring/services').catch(() => ({ data: { data: [] } })),
        axios.get('/monitoring/prom-alerts').catch(() => ({ data: { data: { alerts: [] } } })),
      ])

      if (ovRes.status === 'fulfilled') {
        const ov: Overview = ovRes.value.data.data
        setOverview(ov)
        setPromOk(true)
        const cpuPct = ov.total_cpus > 0 ? (ov.allocated_cpus / ov.total_cpus) * 100 : 0
        const memPct = ov.total_memory_gb > 0 ? (ov.allocated_memory_gb / ov.total_memory_gb) * 100 : 0
        const gpuPct = ov.total_gpus > 0 ? ((ov.total_gpus - ov.idle_gpus) / ov.total_gpus) * 100 : 0
        setCpuHistory(p => [...p.slice(-19), cpuPct])
        setMemHistory(p => [...p.slice(-19), memPct])
        setGpuHistory(p => [...p.slice(-19), gpuPct])
      } else { setPromOk(false) }

      if (nodeRes.status === 'fulfilled') setNodes(nodeRes.value.data.data || [])
      if (svcRes.status === 'fulfilled')  setServices(svcRes.value.data.data || [])
      if (alertRes.status === 'fulfilled') setAlerts(alertRes.value.data.data?.alerts || [])

      setLastRefresh(new Date().toLocaleTimeString())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    timerRef.current = setInterval(load, 30000)
    return () => clearInterval(timerRef.current)
  }, [load])

  // 集群节点状态统计
  const nodeStates = nodes.reduce((acc, n) => {
    const s = n.state?.toLowerCase() || 'unknown'
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // 资源汇总
  const clusterRes = {
    cpuTotal: overview?.total_cpus || 0,
    cpuFree:  overview?.idle_cpus  || 0,
    gpuTotal: overview?.total_gpus || 0,
    gpuFree:  overview?.idle_gpus  || 0,
    memTotal: overview?.total_memory_gb?.toFixed(0) || 0,
    memFree:  overview?.idle_memory_gb?.toFixed(0)  || 0,
  }

  const cpuPct = overview && overview.total_cpus > 0 ? (overview.allocated_cpus / overview.total_cpus) * 100 : 0
  const memPct = overview && overview.total_memory_gb > 0 ? (overview.allocated_memory_gb / overview.total_memory_gb) * 100 : 0
  const gpuPct = overview && overview.total_gpus > 0 ? ((overview.total_gpus - overview.idle_gpus) / overview.total_gpus) * 100 : 0

  // ── render ────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* 页面头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 600 }}>📈 集群监控</span>
          <span style={{ fontSize: 12, color: promOk ? '#52c41a' : '#ff4d4f', padding: '2px 8px', borderRadius: 10, border: `1px solid ${promOk ? '#b7eb8f' : '#ffccc7'}`, background: promOk ? '#f6ffed' : '#fff1f0' }}>
            {promOk ? '● 已连接' : '○ 未连接'}
          </span>
          {lastRefresh && <span style={{ fontSize: 12, color: '#aaa' }}>上次更新: {lastRefresh}</span>}
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading} size="small">刷新</Button>
      </div>

      {/* 主 Tab */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid #f0f0f0' }}>
        {[
          { key: 'cluster', label: '⚡ 计算节点' },
          { key: 'mgmt',    label: '🖥️ 管理节点' },
          { key: 'network', label: '🌐 网络监控' },
          { key: 'alerts',  label: `🔔 告警${alerts.length > 0 ? ` (${alerts.length})` : ''}` },
        ].map(t => (
          <button key={t.key} onClick={() => setMainTab(t.key)} style={{ padding: '8px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: mainTab === t.key ? 600 : 400, color: mainTab === t.key ? '#1890ff' : '#555', borderBottom: mainTab === t.key ? '2px solid #1890ff' : '2px solid transparent', marginBottom: -2 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ 计算节点 Tab ══ */}
      {mainTab === 'cluster' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 节点状态 + 仪表盘 + 资源统计 三列 */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>

            {/* 左：节点状态 */}
            <div style={{ minWidth: 160, background: '#fff', borderRadius: 8, border: '1px solid #e8e8e8', padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#555' }}>节点状态</div>
              <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>{nodes.length}</div>
              {[
                { key: 'idle',      label: '空闲',   color: '#52c41a' },
                { key: 'allocated', label: '已分配', color: '#1890ff' },
                { key: 'mixed',     label: '混合',   color: '#fa8c16' },
                { key: 'down',      label: '故障',   color: '#ff4d4f' },
              ].map(s => (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                  <span style={{ fontSize: 12, color: '#666', flex: 1 }}>{s.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{nodeStates[s.key] || 0}</span>
                </div>
              ))}
            </div>

            {/* 中：仪表盘 */}
            <div style={{ flex: 1, background: '#fff', borderRadius: 8, border: '1px solid #e8e8e8', padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#555' }}>实时利用率</div>
              <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 8 }}>
                <Gauge value={cpuPct} label="CPU 利用率" />
                <Gauge value={memPct} label="内存利用率" />
                <Gauge value={gpuPct} label="GPU 利用率" />
                <Gauge value={overview && overview.total_jobs > 0 ? (overview.running_jobs / overview.total_jobs) * 100 : 0} label="作业运行率" warn={70} />
              </div>
            </div>

            {/* 右：资源数量 */}
            <div style={{ minWidth: 200, background: '#fff', borderRadius: 8, border: '1px solid #e8e8e8', padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#555' }}>资源汇总</div>
              {[
                { label: 'CPU 总核数', value: clusterRes.cpuTotal, unit: '核' },
                { label: 'CPU 空闲', value: clusterRes.cpuFree, unit: '核', green: true },
                { label: 'GPU 总卡数', value: clusterRes.gpuTotal, unit: '卡' },
                { label: 'GPU 空闲', value: clusterRes.gpuFree, unit: '卡', green: true },
                { label: '内存总量', value: clusterRes.memTotal, unit: 'GB' },
                { label: '内存空闲', value: clusterRes.memFree, unit: 'GB', green: true },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #f5f5f5' }}>
                  <span style={{ fontSize: 12, color: '#666' }}>{r.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: (r as any).green ? '#52c41a' : '#333' }}>{r.value} <span style={{ fontSize: 11, fontWeight: 400 }}>{r.unit}</span></span>
                </div>
              ))}
            </div>
          </div>

          {/* 时序图 Tab */}
          <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e8e8e8', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              {[
                { key: 'cpu', label: 'CPU' },
                { key: 'gpu', label: 'GPU' },
                { key: 'mem', label: '内存' },
              ].map(t => (
                <button key={t.key} onClick={() => setChartTab(t.key)} style={{ padding: '5px 14px', border: `1px solid ${chartTab === t.key ? '#1890ff' : '#d9d9d9'}`, borderRadius: 4, background: chartTab === t.key ? '#e6f7ff' : '#fff', color: chartTab === t.key ? '#1890ff' : '#555', cursor: 'pointer', fontSize: 13, fontWeight: chartTab === t.key ? 600 : 400 }}>
                  {t.label}
                </button>
              ))}
            </div>

            {chartTab === 'cpu' && (
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>CPU 调度率</div>
                  <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>已调度核数/总核数 (%)</div>
                  <SparkLine data={cpuHistory} color="#6366f1" height={60} />
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#888' }}>当前: {cpuPct.toFixed(1)}%</div>
                </Col>
                <Col span={12}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>各节点 CPU 分配</div>
                  <StackBars height={160} data={nodes.map(n => ({ label: n.node_name, segments: [{ name: '已分配', value: n.cpu_alloc, color: '#6366f1' }, { name: '空闲', value: Math.max(n.cpu_total - n.cpu_alloc, 0), color: '#e0e7ff' }] }))} />
                </Col>
              </Row>
            )}

            {chartTab === 'gpu' && (
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>GPU 使用率趋势</div>
                  <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>(总卡-空闲)/总卡 (%)</div>
                  <SparkLine data={gpuHistory} color="#f59e0b" height={60} />
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#888' }}>当前: {gpuPct.toFixed(1)}%</div>
                </Col>
                <Col span={12}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>各节点 GPU 分配</div>
                  <StackBars height={160} data={nodes.filter(n => (n.gpu_total || 0) > 0).map(n => ({ label: n.node_name, segments: [{ name: '已分配', value: n.gpu_alloc || 0, color: '#f59e0b' }, { name: '空闲', value: Math.max((n.gpu_total || 0) - (n.gpu_alloc || 0), 0), color: '#fef3c7' }] }))} />
                </Col>
              </Row>
            )}

            {chartTab === 'mem' && (
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>内存使用率趋势</div>
                  <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>(已分配/总量) (%)</div>
                  <SparkLine data={memHistory} color="#10b981" height={60} />
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#888' }}>当前: {memPct.toFixed(1)}%</div>
                </Col>
                <Col span={12}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>各节点内存分配</div>
                  <StackBars height={160} data={nodes.map(n => ({ label: n.node_name, segments: [{ name: '已分配', value: n.mem_alloc_gb, color: '#10b981' }, { name: '空闲', value: Math.max(n.mem_total_gb - n.mem_alloc_gb, 0), color: '#d1fae5' }] }))} />
                </Col>
              </Row>
            )}
          </div>

          {/* 节点详情表 */}
          <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e8e8e8', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13, borderBottom: '1px solid #f0f0f0' }}>▾ 节点列表</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    {['节点名称', '状态', '分区', 'CPU 使用', '内存使用', 'GPU', '负载', '特性'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#555', whiteSpace: 'nowrap', borderBottom: '1px solid #e8e8e8' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {nodes.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#aaa' }}>暂无节点数据</td></tr>
                  ) : nodes.map(n => {
                    const cpuP = n.cpu_total > 0 ? Math.round((n.cpu_alloc / n.cpu_total) * 100) : 0
                    const memP = n.mem_total_gb > 0 ? Math.round((n.mem_alloc_gb / n.mem_total_gb) * 100) : 0
                    const stColor = STATE_COLOR[n.state?.toLowerCase()] || '#8c8c8c'
                    return (
                      <tr key={n.node_name} style={{ borderBottom: '1px solid #f5f5f5' }} onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <td style={{ padding: '8px 12px', fontWeight: 500 }}>{n.node_name}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, fontSize: 11, background: stColor + '20', color: stColor, border: `1px solid ${stColor}40` }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: stColor }} />
                            {STATE_LABEL[n.state?.toLowerCase()] || n.state}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', color: '#888' }}>{n.partition}</td>
                        <td style={{ padding: '8px 12px', minWidth: 140 }}>
                          <Progress percent={cpuP} size="small" status={cpuP > 90 ? 'exception' : 'normal'} />
                          <div style={{ fontSize: 11, color: '#aaa' }}>{n.cpu_alloc}/{n.cpu_total} 核</div>
                        </td>
                        <td style={{ padding: '8px 12px', minWidth: 140 }}>
                          <Progress percent={memP} size="small" strokeColor="#10b981" status={memP > 90 ? 'exception' : 'normal'} />
                          <div style={{ fontSize: 11, color: '#aaa' }}>{n.mem_alloc_gb.toFixed(1)}/{n.mem_total_gb.toFixed(1)} GB</div>
                        </td>
                        <td style={{ padding: '8px 12px', color: '#555' }}>{n.gpu_total ? `${n.gpu_alloc || 0}/${n.gpu_total}` : '—'}</td>
                        <td style={{ padding: '8px 12px', color: n.cpu_load > n.cpu_total ? '#ff4d4f' : '#555' }}>{n.cpu_load > 0 ? n.cpu_load.toFixed(1) : '—'}</td>
                        <td style={{ padding: '8px 12px', fontSize: 11, color: '#aaa', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.features || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ 管理节点 Tab ══ */}
      {mainTab === 'mgmt' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#555' }}>▾ 管理服务健康</div>
          {services.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e8e8e8', padding: 32, textAlign: 'center', color: '#aaa' }}>
              暂无服务数据，请确认后端可访问管理节点
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {services.map(svc => (
                <div key={svc.name} style={{ background: '#fff', borderRadius: 8, border: `1px solid ${svc.active ? '#b7eb8f' : '#ffccc7'}`, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: svc.active ? '#52c41a' : '#ff4d4f', flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{svc.display}</span>
                    <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 8, background: svc.active ? '#f6ffed' : '#fff1f0', color: svc.active ? '#52c41a' : '#ff4d4f', border: `1px solid ${svc.active ? '#b7eb8f' : '#ffccc7'}` }}>
                      {svc.state || 'unknown'}
                    </span>
                  </div>
                  {[
                    { label: 'CPU', value: `${svc.cpu.toFixed(1)}%`, pct: Math.min(svc.cpu, 100), color: svc.cpu > 80 ? '#ef4444' : svc.cpu > 50 ? '#f59e0b' : '#10b981' },
                    { label: '内存', value: `${svc.mem_mb.toFixed(0)} MB`, pct: Math.min(svc.mem_mb / 10, 100), color: '#6366f1' },
                  ].map(m => (
                    <div key={m.label} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginBottom: 3 }}>
                        <span>{m.label}</span><span>{m.value}</span>
                      </div>
                      <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${m.pct}%`, background: m.color, borderRadius: 2, transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  ))}
                  {svc.fds > 0 && <div style={{ fontSize: 11, color: '#aaa' }}>文件句柄: {svc.fds}</div>}
                </div>
              ))}
            </div>
          )}

          <div style={{ fontWeight: 600, fontSize: 13, color: '#555' }}>▾ 节点列表（基础信息）</div>
          <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e8e8e8', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #e8e8e8' }}>
                  {['节点名称', '节点IP', '服务', '状态'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: '#555' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nodes.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: '#aaa' }}>暂无节点数据</td></tr>
                ) : nodes.map(n => {
                  const stColor = STATE_COLOR[n.state?.toLowerCase()] || '#8c8c8c'
                  return (
                    <tr key={n.node_name} style={{ borderBottom: '1px solid #f5f5f5' }}>
                      <td style={{ padding: '8px 14px', fontFamily: 'monospace' }}>{n.node_name}</td>
                      <td style={{ padding: '8px 14px', color: '#888', fontSize: 12 }}>{n.instance || '—'}</td>
                      <td style={{ padding: '8px 14px', fontSize: 12, color: '#aaa' }}>node_exporter</td>
                      <td style={{ padding: '8px 14px' }}>
                        <span style={{ fontSize: 11, color: stColor, padding: '2px 8px', borderRadius: 10, background: stColor + '15', border: `1px solid ${stColor}30` }}>
                          {STATE_LABEL[n.state?.toLowerCase()] || n.state}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ 网络监控 Tab ══ */}
      {mainTab === 'network' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#555' }}>▾ 网卡总览</div>
          <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e8e8e8', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#fafafa', borderBottom: '1px solid #e8e8e8' }}>
                    {['节点', '网卡收包 (B/s)', '网卡发包 (B/s)', '收包速率', '发包速率'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#555', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {nodes.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#aaa' }}>暂无网络数据</td></tr>
                  ) : nodes.map(n => {
                    const rx = n.net_rx_bps || 0
                    const tx = n.net_tx_bps || 0
                    const fmtBps = (v: number) => v > 1e6 ? `${(v / 1e6).toFixed(1)} MB/s` : v > 1e3 ? `${(v / 1e3).toFixed(1)} KB/s` : `${v.toFixed(0)} B/s`
                    return (
                      <tr key={n.node_name} style={{ borderBottom: '1px solid #f5f5f5' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 500 }}>{n.node_name}</td>
                        <td style={{ padding: '8px 12px', color: '#1890ff' }}>{rx > 0 ? rx.toFixed(0) : '—'}</td>
                        <td style={{ padding: '8px 12px', color: '#52c41a' }}>{tx > 0 ? tx.toFixed(0) : '—'}</td>
                        <td style={{ padding: '8px 12px' }}>{rx > 0 ? fmtBps(rx) : '—'}</td>
                        <td style={{ padding: '8px 12px' }}>{tx > 0 ? fmtBps(tx) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ 告警 Tab ══ */}
      {mainTab === 'alerts' && (
        <div>
          {alerts.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e8e8e8', padding: '48px 0', textAlign: 'center' }}>
              <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 12 }} />
              <div style={{ fontSize: 15, color: '#555' }}>当前无活跃告警</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {alerts.map((a, i) => {
                const sev = a.labels.severity || 'info'
                const sevColor = sev === 'critical' ? '#ff4d4f' : sev === 'warning' ? '#fa8c16' : '#1890ff'
                return (
                  <div key={i} style={{ background: '#fff', borderRadius: 8, border: `1px solid ${sevColor}30`, borderLeft: `4px solid ${sevColor}`, padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <WarningOutlined style={{ color: sevColor }} />
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{a.labels.alertname}</span>
                      <span style={{ padding: '1px 8px', borderRadius: 10, fontSize: 11, background: sevColor + '15', color: sevColor, border: `1px solid ${sevColor}30` }}>{sev.toUpperCase()}</span>
                      <span style={{ padding: '1px 8px', borderRadius: 10, fontSize: 11, background: '#f5f5f5', color: '#888' }}>{a.state}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>{a.annotations.summary}</div>
                    {a.annotations.description && (
                      <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{a.annotations.description}</div>
                    )}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {Object.entries(a.labels).filter(([k]) => !['alertname', 'severity'].includes(k)).map(([k, v]) => (
                        <span key={k} style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: '#f0f0f0', color: '#666' }}>{k}: {v}</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: '#bbb', marginTop: 6 }}>激活时间: {new Date(a.activeAt).toLocaleString()}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
