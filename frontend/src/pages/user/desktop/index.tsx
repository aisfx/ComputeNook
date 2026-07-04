import { useState, useEffect, useRef, useCallback } from 'react'
import { Button, Space, Modal, Form, Input, Select, Tag, message as Message, App, Radio, Tabs } from 'antd'
import type { TableColumnsType } from 'antd'
import {
  PlusOutlined, ReloadOutlined, PlayCircleOutlined, StopOutlined,
  DeleteOutlined, EyeOutlined, FileTextOutlined, SettingOutlined,
} from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import { isAdmin } from '@/utils/auth'

// ── 类型 ──────────────────────────────────────────────────────────────────────
interface Session {
  id: string
  name: string
  mode: 'desktop' | 'app'
  desktopEnv?: string
  appCommand?: string
  status: 'stopped' | 'pending' | 'running' | 'failed'
  partition: string
  cpus?: number
  memory?: number
  gpus?: number
  address?: string
  vncPort?: number
  xpraPort?: number
  vncPassword?: string
  jobId?: string
  createTime?: string
}

interface Partition { name: string; state: string; cpus?: number; memory?: string }
interface ResourcePreset { label: string; cpus: number; memory: number }
interface RemoteApp { id: number; name: string; icon?: string; cmd: string; modules?: string; desc?: string }

const DESKTOP_ENVS = [
  { value: 'xfce4', label: 'Xfce4', icon: '🪟' },
  { value: 'gnome', label: 'GNOME', icon: '🔵' },
  { value: 'kde',   label: 'KDE',   icon: '🟦' },
]

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  stopped: { text: '未启动', color: 'default' },
  pending: { text: '排队中', color: 'processing' },
  running: { text: '运行中', color: 'success' },
  failed:  { text: '失败',   color: 'error' },
}

export default function RemoteDesktop() {
  const { modal } = App.useApp()
  const admin = isAdmin()

  const [sessions, setSessions]   = useState<Session[]>([])
  const [partitions, setPartitions] = useState<Partition[]>([])
  const [presets, setPresets]     = useState<ResourcePreset[]>([])
  const [remoteApps, setRemoteApps] = useState<RemoteApp[]>([])
  const [loading, setLoading]     = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 弹窗状态
  const [createOpen, setCreateOpen]     = useState(false)
  const [readyOpen, setReadyOpen]       = useState(false)
  const [xpraOpen, setXpraOpen]         = useState(false)
  const [scriptOpen, setScriptOpen]     = useState(false)
  const [logOpen, setLogOpen]           = useState(false)
  const [manageAppsOpen, setManageAppsOpen] = useState(false)
  const [launchFloatVisible, setLaunchFloatVisible] = useState(false)
  const [launchMinimized, setLaunchMinimized] = useState(false)

  // 表单
  const [createMode, setCreateMode]     = useState<'desktop' | 'app'>('desktop')
  const [desktopEnv, setDesktopEnv]     = useState('xfce4')
  const [sessionName, setSessionName]   = useState('')
  const [partition, setPartition]       = useState('')
  const [presetIndex, setPresetIndex]   = useState(1)
  const [duration, setDuration]         = useState(4)
  const [gpus, setGpus]                 = useState(0)
  const [appCommand, setAppCommand]     = useState('')
  const [modules, setModules]           = useState('')
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null)

  // 当前操作的会话
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [scriptContent, setScriptContent]     = useState('')
  const [logContent, setLogContent]           = useState('')
  const [logType, setLogType]                 = useState<'out' | 'err'>('out')
  const [logLoading, setLogLoading]           = useState(false)
  const [xpraWsUrl, setXpraWsUrl]             = useState('')

  // 启动进度
  const [launchStatus, setLaunchStatus] = useState<'starting' | 'ready' | 'failed' | null>(null)
  const [launchJobId, setLaunchJobId]   = useState('')
  const [launchProgress, setLaunchProgress] = useState(0)
  const [launchLogs, setLaunchLogs]     = useState<string[]>([])
  const [launchError, setLaunchError]   = useState('')
  const [launchLogType, setLaunchLogType] = useState<'out' | 'err'>('out')

  // 客户端隧道
  const [tunnelStatus, setTunnelStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle')
  const [clientMinimized, setClientMinimized] = useState(false)

  const timerRef  = useRef<any>(null)
  const launchRef = useRef<any>(null)

  // ── 新增应用表单 ──────────────────────────────────────────
  const [newApp, setNewApp] = useState({ name: '', icon: '', cmd: '', modules: '', desc: '' })

  // ── API ───────────────────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axios.get('/desktop/sessions')
      setSessions(res.data.data || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  const loadPartitions = async () => {
    try {
      const res = await axios.get('/jobs/partitions/list')
      const list: Partition[] = res.data.data || []
      setPartitions(list)
      if (list.length > 0) {
        const avail = list.find(p => p.state === 'UP') || list[0]
        setPartition(avail.name)
        loadPresets(avail.name)
      }
    } catch { setPartitions([]) }
  }

  const loadPresets = async (part: string) => {
    try {
      const res = await axios.get('/desktop/resource-presets', { params: { partition: part } })
      setPresets(res.data.data || [])
      setPresetIndex(1)
    } catch {
      setPresets([
        { label: '小型  1核/2GB', cpus: 1, memory: 2 },
        { label: '中型  2核/4GB', cpus: 2, memory: 4 },
        { label: '大型  4核/8GB', cpus: 4, memory: 8 },
        { label: '超大  8核/16GB', cpus: 8, memory: 16 },
      ])
    }
  }

  const loadRemoteApps = async () => {
    try {
      const res = await axios.get('/desktop/apps')
      setRemoteApps(res.data.data || [])
    } catch {
      setRemoteApps([
        { id: 1, name: 'Terminal',  cmd: 'xterm',            icon: '💻' },
        { id: 2, name: 'Firefox',   cmd: 'firefox',          icon: '🦊' },
        { id: 3, name: 'VSCode',    cmd: 'code',             icon: '📝' },
        { id: 4, name: 'MATLAB',    cmd: 'matlab -desktop',  icon: '🔢' },
        { id: 5, name: 'ParaView',  cmd: 'paraview',         icon: '📊' },
        { id: 6, name: 'VMD',       cmd: 'vmd',              icon: '🧬' },
      ])
    }
  }

  useEffect(() => {
    loadSessions()
    loadRemoteApps()
    timerRef.current = setInterval(() => {
      setSessions(prev => {
        if (prev.some(s => s.status === 'pending' || s.status === 'running')) loadSessions()
        return prev
      })
    }, 8000)
    return () => {
      clearInterval(timerRef.current)
      clearInterval(launchRef.current)
    }
  }, [loadSessions])

  // ── 创建 ──────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!sessionName.trim()) { Message.warning('请输入会话名称'); return }
    if (!partition) { Message.warning('请选择分区'); return }
    if (createMode === 'app' && !appCommand.trim()) { Message.warning('请选择或输入应用命令'); return }

    setSubmitting(true)
    try {
      const preset = presets[presetIndex] || presets[0] || { cpus: 2, memory: 4 }
      const res = await axios.post('/desktop/sessions', {
        name: sessionName.trim(),
        mode: createMode,
        type: createMode === 'desktop' ? desktopEnv : undefined,
        appCommand: createMode === 'app' ? appCommand : undefined,
        modules: createMode === 'app' ? modules : undefined,
        resolution: 'auto',
        duration,
        cpus: preset.cpus,
        memory: preset.memory,
        gpus,
        partition,
      })
      const newSession = res.data.data
      setSessions(prev => [newSession, ...prev])
      setCreateOpen(false)
      resetCreateForm()
      Message.success('会话创建成功')
    } catch (e: any) {
      Message.error(e.response?.data?.error || '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  const resetCreateForm = () => {
    setSessionName(''); setCreateMode('desktop'); setDesktopEnv('xfce4')
    setAppCommand(''); setModules(''); setSelectedAppId(null)
    setDuration(4); setGpus(0); setPresetIndex(1)
  }

  // ── 启动 ──────────────────────────────────────────────────
  const startSession = async (session: Session) => {
    setSelectedSession(session)
    setLaunchStatus('starting')
    setLaunchProgress(0)
    setLaunchLogs([])
    setLaunchJobId('')
    setLaunchError('')
    setLaunchFloatVisible(true)
    setLaunchMinimized(false)

    try {
      const res = await axios.post(`/desktop/sessions/${session.id}/start`)
      const jobId = res.data.job_id || ''
      setLaunchJobId(jobId)
      // 轮询进度
      pollLaunchStatus(session.id)
    } catch (e: any) {
      setLaunchStatus('failed')
      setLaunchError(e.response?.data?.error || '启动失败')
      setReadyOpen(true)
    }
  }

  const pollLaunchStatus = (sessionId: string) => {
    let elapsed = 0
    clearInterval(launchRef.current)
    launchRef.current = setInterval(async () => {
      elapsed += 3
      setLaunchProgress(Math.min(90, (elapsed / 120) * 90))
      try {
        const res = await axios.get(`/desktop/sessions/${sessionId}/status`)
        const status = res.data.status
        const logs: string[] = res.data.logs || []
        setLaunchLogs(logs)

        if (status === 'running') {
          setLaunchProgress(100)
          setLaunchStatus('ready')
          clearInterval(launchRef.current)
          setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ...res.data.session } : s))
          setSelectedSession(res.data.session)
          setLaunchFloatVisible(false)
          setReadyOpen(true)
          loadSessions()
        } else if (status === 'failed') {
          setLaunchStatus('failed')
          setLaunchError(res.data.error || '启动失败')
          clearInterval(launchRef.current)
          setLaunchFloatVisible(false)
          setReadyOpen(true)
        }
      } catch { /**/ }
    }, 3000)
  }

  // ── 停止 ──────────────────────────────────────────────────
  const stopSession = (session: Session) => {
    modal.confirm({
      title: '停止会话',
      content: `确定停止 "${session.name}" 吗？`,
      okText: '停止', okButtonProps: { danger: true }, cancelText: '取消',
      onOk: async () => {
        try {
          await axios.post(`/desktop/sessions/${session.id}/stop`)
          Message.success('已发送停止指令')
          loadSessions()
        } catch (e: any) { Message.error(e.response?.data?.error || '停止失败') }
      },
    })
  }

  // ── 删除 ──────────────────────────────────────────────────
  const deleteSession = (session: Session) => {
    modal.confirm({
      title: '删除会话',
      content: `确定删除 "${session.name}"？此操作不可恢复。`,
      okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
      onOk: async () => {
        try {
          await axios.delete(`/desktop/sessions/${session.id}`)
          setSessions(prev => prev.filter(s => s.id !== session.id))
          Message.success('删除成功')
        } catch (e: any) { Message.error(e.response?.data?.error || '删除失败') }
      },
    })
  }

  // ── 连接 ──────────────────────────────────────────────────
  const connectSession = (session: Session) => {
    setSelectedSession(session)
    setReadyOpen(true)
    setLaunchStatus('ready')
  }

  const openNoVNC = () => {
    if (!selectedSession) return
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || ''
    // 使用后端已注册的 xpra-html 代理路由，内嵌 Xpra HTML5 客户端
    window.open(`/api/desktop/sessions/${selectedSession.id}/xpra-html/?token=${token}`, '_blank')
  }

  const openXpra = () => {
    if (!selectedSession) return
    setXpraWsUrl(`/api/desktop/xpra/${selectedSession.id}`)
    setXpraOpen(true)
    setReadyOpen(false)
  }

  const launchTunnel = async () => {
    if (!selectedSession) return
    setTunnelStatus('connecting')
    try {
      await axios.post(`/desktop/sessions/${selectedSession.id}/tunnel`)
      setTunnelStatus('connected')
    } catch { setTunnelStatus('disconnected') }
  }

  // ── 脚本/日志 ─────────────────────────────────────────────
  const viewScript = async (session: Session) => {
    try {
      const res = await axios.get(`/desktop/sessions/${session.id}/script`)
      setScriptContent(res.data.script || '（无脚本内容）')
      setScriptOpen(true)
    } catch { setScriptContent('加载失败'); setScriptOpen(true) }
  }

  const viewLog = async (session: Session, type: 'out' | 'err' = 'out') => {
    setSelectedSession(session)
    setLogType(type)
    setLogOpen(true)
    setLogLoading(true)
    try {
      const res = await axios.get(`/desktop/sessions/${session.id}/logs`, { params: { type, lines: 200 } })
      setLogContent((res.data.lines || []).join('\n') || '（暂无日志）')
    } catch { setLogContent('加载失败') }
    finally { setLogLoading(false) }
  }

  const switchLogType = async (type: 'out' | 'err') => {
    if (!selectedSession) return
    setLogType(type)
    setLogLoading(true)
    try {
      const res = await axios.get(`/desktop/sessions/${selectedSession.id}/logs`, { params: { type, lines: 200 } })
      setLogContent((res.data.lines || []).join('\n') || '（暂无日志）')
    } catch { setLogContent('加载失败') }
    finally { setLogLoading(false) }
  }

  // ── 应用管理 ──────────────────────────────────────────────
  const addApp = async () => {
    if (!newApp.name || !newApp.cmd) { Message.warning('请填写名称和命令'); return }
    try {
      await axios.post('/desktop/apps', newApp)
      setNewApp({ name: '', icon: '', cmd: '', modules: '', desc: '' })
      loadRemoteApps()
      Message.success('添加成功')
    } catch (e: any) { Message.error(e.response?.data?.error || '添加失败') }
  }

  const deleteApp = async (id: number) => {
    try {
      await axios.delete(`/desktop/apps/${id}`)
      loadRemoteApps()
    } catch (e: any) { Message.error(e.response?.data?.error || '删除失败') }
  }

  const cleanupSpace = async () => {
    try {
      await axios.post('/desktop/cleanup')
      Message.success('清理完成')
    } catch (e: any) { Message.error(e.response?.data?.error || '清理失败') }
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 0 16px' }}>

      {/* 页面头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>远程会话</h3>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>管理远程桌面与应用会话</div>
        </div>
        <Space>
          <Button onClick={cleanupSpace} title="清理旧文件释放磁盘空间">🧹 清理空间</Button>
          <Button icon={<ReloadOutlined />} onClick={loadSessions} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setCreateOpen(true); loadPartitions(); loadRemoteApps() }}>
            新建会话
          </Button>
        </Space>
      </div>

      {/* 会话列表 */}
      {sessions.length === 0 && !loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', background: '#fff', borderRadius: 8, border: '1px solid #e8e8e8' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🖥️</div>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6, color: '#333' }}>暂无会话</div>
          <div style={{ fontSize: 13, color: '#999', marginBottom: 20 }}>点击「新建会话」创建远程桌面或应用会话</div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setCreateOpen(true); loadPartitions(); loadRemoteApps() }}>
            新建会话
          </Button>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e8e8e8', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa', borderBottom: '1px solid #e8e8e8' }}>
                {['名称', '模式', '节点/地址', '状态', '创建时间', '操作'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#555', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, idx) => {
                const st = STATUS_MAP[s.status] || { text: s.status, color: 'default' }
                return (
                  <tr key={s.id} style={{ borderBottom: idx < sessions.length - 1 ? '1px solid #f0f0f0' : 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                      {s.appCommand && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{s.appCommand}</div>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: s.mode === 'app' ? '#f0f5ff' : '#f6ffed', color: s.mode === 'app' ? '#2f54eb' : '#52c41a', border: `1px solid ${s.mode === 'app' ? '#adc6ff' : '#b7eb8f'}` }}>
                        {s.mode === 'app' ? '📦 应用' : '🖥️ 桌面'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#555' }}>
                      {s.status === 'running' && s.address ? <code style={{ fontSize: 12 }}>{s.address}</code> : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Tag color={st.color}>{st.text}</Tag>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>
                      {s.createTime ? dayjs(s.createTime).format('YYYY-MM-DD HH:mm') : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Space size={4}>
                        {s.status === 'running' && (
                          <>
                            <Button type="primary" size="small" icon={<EyeOutlined />} onClick={() => connectSession(s)}>连接</Button>
                            <Button size="small" danger icon={<StopOutlined />} onClick={() => stopSession(s)}>停止</Button>
                          </>
                        )}
                        {(s.status === 'stopped' || s.status === 'failed') && (
                          <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={() => startSession(s)}>启动</Button>
                        )}
                        {s.status === 'pending' && (
                          <Button size="small" disabled>排队中...</Button>
                        )}
                        <Button size="small" icon={<FileTextOutlined />} onClick={() => viewScript(s)}>脚本</Button>
                        <Button size="small" onClick={() => viewLog(s, 'out')}>日志</Button>
                        <Button size="small" danger icon={<DeleteOutlined />}
                          disabled={s.status === 'running' || s.status === 'pending'}
                          onClick={() => deleteSession(s)}
                        >删除</Button>
                      </Space>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 悬浮启动进度条 ── */}
      {launchFloatVisible && launchStatus === 'starting' && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12,
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          width: launchMinimized ? 280 : 420, overflow: 'hidden', transition: 'all 0.25s'
        }}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#1890ff', color: '#fff', cursor: 'pointer' }}
            onClick={() => setLaunchMinimized(v => !v)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#fff', opacity: 0.8, animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>启动中 · {selectedSession?.name}</span>
              {launchJobId && <span style={{ fontSize: 11, opacity: 0.8 }}>作业 #{launchJobId}</span>}
            </div>
            <span style={{ fontSize: 14 }}>{launchMinimized ? '▲' : '▼'}</span>
          </div>
          {!launchMinimized && (
            <div style={{ padding: 16 }}>
              <div style={{ background: '#f5f5f5', borderRadius: 4, height: 6, marginBottom: 12 }}>
                <div style={{ height: '100%', background: '#1890ff', borderRadius: 4, width: `${launchProgress}%`, transition: 'width 0.5s' }} />
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {(['out', 'err'] as const).map(t => (
                  <Button key={t} size="small" type={launchLogType === t ? 'primary' : 'default'} onClick={() => setLaunchLogType(t)}>{t === 'out' ? 'stdout' : 'stderr'}</Button>
                ))}
              </div>
              <div style={{ height: 120, overflowY: 'auto', background: '#1e1e1e', borderRadius: 4, padding: 8 }}>
                {launchLogs.length === 0
                  ? <span style={{ fontSize: 11, color: '#666' }}>等待日志...</span>
                  : launchLogs.map((l, i) => <div key={i} style={{ fontSize: 11, color: '#ccc', lineHeight: 1.5 }}>{l}</div>)
                }
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 客户端最小化悬浮条 ── */}
      {clientMinimized && (tunnelStatus === 'connected' || tunnelStatus === 'disconnected') && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          background: tunnelStatus === 'connected' ? '#fff' : '#fff1f0',
          border: `1px solid ${tunnelStatus === 'connected' ? '#e8e8e8' : '#ffccc7'}`,
          borderRadius: 8, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 2px 12px rgba(0,0,0,0.1)'
        }}>
          <span>🖥️</span>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{selectedSession?.name}</span>
          <span style={{ fontSize: 12, color: tunnelStatus === 'connected' ? '#52c41a' : '#ff4d4f' }}>
            {tunnelStatus === 'connected' ? '● 客户端已连接' : '⚠ 已断开'}
          </span>
          <Button size="small" type="primary" onClick={() => { setReadyOpen(true); setClientMinimized(false) }}>
            {tunnelStatus === 'disconnected' ? '重新连接' : '恢复'}
          </Button>
          <Button size="small" danger onClick={() => selectedSession && stopSession(selectedSession)}>停止</Button>
        </div>
      )}

      {/* ── 新建会话弹窗 ── */}
      <Modal
        title="新建远程会话"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); resetCreateForm() }}
        onOk={handleCreate}
        okText={submitting ? '创建中...' : '创建'}
        okButtonProps={{ loading: submitting }}
        cancelText="取消"
        width={600}
      >
        {/* 模式选择 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>会话模式</div>
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { value: 'desktop', icon: '🖥️', label: '完整桌面', desc: '启动完整桌面环境（xfce4/gnome/kde）' },
              { value: 'app',     icon: '📦', label: '发布应用', desc: '直接启动单个应用，更轻量' },
            ].map(m => (
              <div
                key={m.value}
                onClick={() => setCreateMode(m.value as any)}
                style={{ flex: 1, padding: '14px 16px', border: `2px solid ${createMode === m.value ? '#1890ff' : '#e8e8e8'}`, borderRadius: 8, cursor: 'pointer', background: createMode === m.value ? '#e6f7ff' : '#fff', transition: 'all 0.15s' }}
              >
                <div style={{ fontSize: 22, marginBottom: 6 }}>{m.icon}</div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 11, color: '#888' }}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 桌面环境选择 */}
        {createMode === 'desktop' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>桌面环境</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {DESKTOP_ENVS.map(e => (
                <div
                  key={e.value}
                  onClick={() => setDesktopEnv(e.value)}
                  style={{ padding: '8px 16px', border: `1.5px solid ${desktopEnv === e.value ? '#1890ff' : '#e8e8e8'}`, borderRadius: 6, cursor: 'pointer', background: desktopEnv === e.value ? '#e6f7ff' : '#fff', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {e.icon} {e.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 应用选择 */}
        {createMode === 'app' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>选择应用</span>
              {admin && <Button size="small" icon={<SettingOutlined />} onClick={() => setManageAppsOpen(true)}>管理应用</Button>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
              {remoteApps.map(app => (
                <div
                  key={app.id}
                  onClick={() => { setSelectedAppId(app.id); setAppCommand(app.cmd); setModules(app.modules || '') }}
                  style={{ padding: '10px 8px', border: `1.5px solid ${selectedAppId === app.id ? '#1890ff' : '#e8e8e8'}`, borderRadius: 6, cursor: 'pointer', background: selectedAppId === app.id ? '#e6f7ff' : '#fff', textAlign: 'center', transition: 'all 0.15s' }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{app.icon || '📦'}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#333' }}>{app.name}</div>
                </div>
              ))}
            </div>
            <Input
              placeholder="或输入自定义命令，如 gedit、matlab..."
              value={appCommand}
              onChange={e => setAppCommand(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            {appCommand && (
              <div>
                <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>加载 Modules（可选）</div>
                <Input
                  placeholder="如: matlab/R2024a gcc/12.3（空格分隔）"
                  value={modules}
                  onChange={e => setModules(e.target.value)}
                />
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>启动前自动执行 module load</div>
              </div>
            )}
          </div>
        )}

        {/* 基本信息 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>会话名称 *</div>
            <Input value={sessionName} onChange={e => setSessionName(e.target.value)} placeholder="my-session" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>分区 *</div>
            <Select
              value={partition || undefined}
              onChange={v => { setPartition(v); loadPresets(v) }}
              placeholder="请选择分区"
              style={{ width: '100%' }}
            >
              {partitions.map(p => (
                <Select.Option key={p.name} value={p.name} disabled={p.state !== 'UP'}>
                  {p.name}{p.state !== 'UP' ? ` (${p.state === 'DOWN' ? '已停用' : p.state})` : ''}
                </Select.Option>
              ))}
            </Select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>资源规格</div>
            <Select value={presetIndex} onChange={setPresetIndex} style={{ width: '100%' }}>
              {presets.map((p, i) => (
                <Select.Option key={i} value={i}>{p.label}</Select.Option>
              ))}
            </Select>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>时长（小时）</div>
            <Input type="number" min={1} max={24} value={duration} onChange={e => setDuration(Number(e.target.value))} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>GPU 数量</div>
            <Select value={gpus} onChange={setGpus} style={{ width: '100%' }}>
              {[0, 1, 2, 4, 8].map(n => (
                <Select.Option key={n} value={n}>{n === 0 ? '不使用' : `${n} 卡`}</Select.Option>
              ))}
            </Select>
          </div>
        </div>
      </Modal>

      {/* ── 启动结果弹窗（就绪 / 失败） ── */}
      <Modal
        title={launchStatus === 'ready' ? '✅ 会话已就绪' : '❌ 启动失败'}
        open={readyOpen}
        onCancel={() => setReadyOpen(false)}
        footer={null}
        width={520}
      >
        {launchStatus === 'failed' ? (
          <div>
            <div style={{ color: '#ff4d4f', marginBottom: 12, fontSize: 13 }}>{launchError}</div>
            <div style={{ background: '#1e1e1e', borderRadius: 6, padding: 10, maxHeight: 200, overflowY: 'auto' }}>
              {launchLogs.map((l, i) => <div key={i} style={{ fontSize: 11, color: '#ccc', lineHeight: 1.5 }}>{l}</div>)}
            </div>
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Button onClick={() => setReadyOpen(false)}>关闭</Button>
            </div>
          </div>
        ) : (
          <div>
            {/* 连接信息 */}
            {selectedSession && (
              <div style={{ background: '#f5f5f5', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                {[
                  { label: '节点', value: selectedSession.address },
                  { label: '网页端口(WS)', value: selectedSession.vncPort },
                  { label: '客户端端口(TCP)', value: selectedSession.xpraPort },
                ].map(row => row.value ? (
                  <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 13 }}>
                    <span style={{ color: '#888', minWidth: 120 }}>{row.label}:</span>
                    <code style={{ fontSize: 12 }}>{row.value}</code>
                  </div>
                ) : null)}
              </div>
            )}

            {/* 方式1：浏览器直连 */}
            <div style={{ border: '1.5px solid #1890ff', borderRadius: 8, padding: 14, marginBottom: 12, background: '#e6f7ff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                    🌐 浏览器连接
                    <span style={{ marginLeft: 8, fontSize: 11, background: '#1890ff', color: '#fff', padding: '1px 6px', borderRadius: 10 }}>推荐</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#555' }}>无需安装软件，直接在浏览器中打开图形界面</div>
                </div>
                <Button type="primary" onClick={openNoVNC}>立即打开</Button>
              </div>
            </div>

            {/* 方式2：本地客户端 */}
            <div style={{ border: '1px solid #e8e8e8', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>🖥️ 本地 Xpra 客户端</div>
                  <div style={{ fontSize: 12, color: '#555' }}>需安装 hpc-client，性能更好，适合图形密集型应用</div>
                </div>
                <Space>
                  {tunnelStatus !== 'idle' && (
                    <span style={{ fontSize: 12, color: tunnelStatus === 'connected' ? '#52c41a' : tunnelStatus === 'connecting' ? '#faad14' : '#ff4d4f' }}>
                      {tunnelStatus === 'connected' ? '✓ 已连接' : tunnelStatus === 'connecting' ? '⏳ 连接中...' : '⚠ 已断开'}
                    </span>
                  )}
                  <Button type={tunnelStatus === 'disconnected' ? 'default' : 'primary'} danger={tunnelStatus === 'disconnected'} onClick={launchTunnel} loading={tunnelStatus === 'connecting'}>
                    {tunnelStatus === 'idle' ? '一键连接' : '重新连接'}
                  </Button>
                </Space>
              </div>
              <div style={{ fontSize: 11, color: '#aaa', lineHeight: 1.8 }}>
                <div>TCP 端口: <code>{selectedSession?.xpraPort}</code></div>
                <div>未安装 hpc-client？<a href="/download" target="_blank" style={{ color: '#1890ff' }}>点此下载</a></div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              {selectedSession && <Button danger onClick={() => { stopSession(selectedSession); setReadyOpen(false) }}>停止会话</Button>}
              {tunnelStatus === 'connected' && <Button onClick={() => { setReadyOpen(false); setClientMinimized(true) }}>最小化</Button>}
              <Button onClick={() => setReadyOpen(false)}>关闭</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Xpra 内嵌全屏 ── */}
      {xpraOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#000', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', background: '#1e1e1e', color: '#fff', flexShrink: 0 }}>
            <span style={{ fontSize: 13 }}>🖥️ {selectedSession?.name} — {selectedSession?.address}</span>
            <Space>
              <Button size="small" onClick={() => { setXpraOpen(false); setReadyOpen(true) }}>返回</Button>
              <Button size="small" danger onClick={() => setXpraOpen(false)}>关闭</Button>
            </Space>
          </div>
          <iframe
            src={xpraWsUrl}
            style={{ flex: 1, border: 'none', width: '100%' }}
            title="Remote Desktop"
            allowFullScreen
          />
        </div>
      )}

      {/* ── 脚本预览弹窗 ── */}
      <Modal
        title="📄 提交脚本"
        open={scriptOpen}
        onCancel={() => setScriptOpen(false)}
        footer={[
          <Button key="copy" onClick={() => { navigator.clipboard.writeText(scriptContent); Message.success('已复制') }}>复制</Button>,
          <Button key="close" onClick={() => setScriptOpen(false)}>关闭</Button>,
        ]}
        width={640}
      >
        <pre style={{ background: '#1e1e1e', color: '#e8e8e8', padding: 16, borderRadius: 6, maxHeight: 400, overflowY: 'auto', fontSize: 12, lineHeight: 1.6, margin: 0 }}>
          {scriptContent}
        </pre>
      </Modal>

      {/* ── 日志弹窗 ── */}
      <Modal
        title={`📄 作业日志 — ${selectedSession?.name}`}
        open={logOpen}
        onCancel={() => setLogOpen(false)}
        footer={[<Button key="close" onClick={() => setLogOpen(false)}>关闭</Button>]}
        width={700}
      >
        <Space style={{ marginBottom: 10 }}>
          <Button size="small" type={logType === 'out' ? 'primary' : 'default'} onClick={() => switchLogType('out')}>标准输出</Button>
          <Button size="small" type={logType === 'err' ? 'primary' : 'default'} onClick={() => switchLogType('err')}>错误输出</Button>
        </Space>
        {logLoading
          ? <div style={{ textAlign: 'center', padding: '32px 0', color: '#888' }}>加载中...</div>
          : <pre style={{ background: '#1e1e1e', color: '#e8e8e8', padding: 16, borderRadius: 6, maxHeight: 400, overflowY: 'auto', fontSize: 12, lineHeight: 1.6, margin: 0 }}>
              {logContent || '（暂无日志内容）'}
            </pre>
        }
      </Modal>

      {/* ── 管理应用弹窗（管理员） ── */}
      <Modal
        title="管理远程应用"
        open={manageAppsOpen}
        onCancel={() => setManageAppsOpen(false)}
        footer={[<Button key="close" onClick={() => setManageAppsOpen(false)}>关闭</Button>]}
        width={580}
      >
        {/* 应用列表 */}
        {remoteApps.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#fafafa', borderBottom: '1px solid #e8e8e8' }}>
                {['图标', '名称', '命令', 'Modules', '操作'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#555' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {remoteApps.map(app => (
                <tr key={app.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '8px 10px', fontSize: 18 }}>{app.icon || '📦'}</td>
                  <td style={{ padding: '8px 10px' }}>{app.name}</td>
                  <td style={{ padding: '8px 10px' }}><code style={{ fontSize: 11 }}>{app.cmd}</code></td>
                  <td style={{ padding: '8px 10px', fontSize: 11, color: '#888' }}>{app.modules || '—'}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <Button size="small" danger onClick={() => modal.confirm({ title: '删除应用', content: `确定删除 ${app.name}？`, okText: '删除', okButtonProps: { danger: true }, onOk: () => deleteApp(app.id) })}>
                      删除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ color: '#aaa', textAlign: 'center', padding: '16px 0', marginBottom: 20 }}>暂无应用</div>
        )}

        {/* 添加应用 */}
        <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>添加应用</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: 8, marginBottom: 8 }}>
            <Input placeholder="名称 *" value={newApp.name} onChange={e => setNewApp(p => ({ ...p, name: e.target.value }))} />
            <Input placeholder="图标" value={newApp.icon} onChange={e => setNewApp(p => ({ ...p, icon: e.target.value }))} />
          </div>
          <Input placeholder="启动命令 *（如 matlab -desktop）" value={newApp.cmd} onChange={e => setNewApp(p => ({ ...p, cmd: e.target.value }))} style={{ marginBottom: 8 }} />
          <Input placeholder="预加载 Modules（如 matlab/R2024a，空格分隔）" value={newApp.modules} onChange={e => setNewApp(p => ({ ...p, modules: e.target.value }))} style={{ marginBottom: 8 }} />
          <Input placeholder="描述（可选）" value={newApp.desc} onChange={e => setNewApp(p => ({ ...p, desc: e.target.value }))} style={{ marginBottom: 12 }} />
          <Button type="primary" onClick={addApp} disabled={!newApp.name || !newApp.cmd}>添加应用</Button>
        </div>
      </Modal>

    </div>
  )
}
