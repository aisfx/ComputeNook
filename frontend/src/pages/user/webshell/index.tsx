import { useState, useEffect, useRef, useCallback } from 'react'
import { Button, Space, Modal, Input, Radio, message as Message } from 'antd'
import {
  PlusOutlined, CloseOutlined, SettingOutlined, KeyOutlined,
  ReloadOutlined, FullscreenOutlined, FullscreenExitOutlined,
  ClearOutlined, DisconnectOutlined, LeftOutlined, RightOutlined,
} from '@ant-design/icons'
import { getWsBase, getToken, getUser } from '@/utils/auth'
import axios from 'axios'

interface Node {
  name: string; host: string; port: number
  description?: string; enabled: boolean
}
interface ShellTab {
  id: string; node: Node; terminal: any; fitAddon: any
  websocket: WebSocket | null; connected: boolean; status: string
}

const THEMES: Record<string, { background: string; foreground: string; cursor: string }> = {
  dark:    { background: '#1e1e1e', foreground: '#ffffff', cursor: '#ffffff' },
  light:   { background: '#ffffff', foreground: '#000000', cursor: '#000000' },
  monokai: { background: '#272822', foreground: '#f8f8f2', cursor: '#f8f8f0' },
  dracula: { background: '#282a36', foreground: '#f8f8f2', cursor: '#f8f8f2' },
  nord:    { background: '#2e3440', foreground: '#d8dee9', cursor: '#d8dee9' },
}

export default function WebShell() {
  const user = getUser()
  const containerRef = useRef<HTMLDivElement>(null)
  const termRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const [nodes, setNodes]                 = useState<Node[]>([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [tabs, setTabs]                   = useState<ShellTab[]>([])
  const [activeTabId, setActiveTabId]     = useState('')

  const [authOpen, setAuthOpen]           = useState(false)
  const [authType, setAuthType]           = useState<'key' | 'password'>('key')
  const [password, setPassword]           = useState('')
  const [hasKey, setHasKey]               = useState(false)
  const [pendingNode, setPendingNode]     = useState<Node | null>(null)

  const [settingsOpen, setSettingsOpen]   = useState(false)
  const [keyOpen, setKeyOpen]             = useState(false)
  const [keyTab, setKeyTab]               = useState<'generate' | 'upload'>('generate')
  const [generatingKey, setGeneratingKey] = useState(false)
  const [generatedPubKey, setGeneratedPubKey] = useState('')
  const [fontSize, setFontSize]           = useState(14)
  const [theme, setTheme]                 = useState('dark')
  const [cursorBlink, setCursorBlink]     = useState(true)
  const [isFullscreen, setIsFullscreen]   = useState(false)

  // ── init ───────────────────────────────────────────────────
  useEffect(() => {
    loadNodes()
    checkPrivateKey()
    try {
      const s = JSON.parse(localStorage.getItem('ws-term-settings') || '{}')
      if (s.fontSize) setFontSize(s.fontSize)
      if (s.theme)    setTheme(s.theme)
      if (s.cursorBlink !== undefined) setCursorBlink(s.cursorBlink)
    } catch { /**/ }
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      tabs.forEach(t => { t.websocket?.close(); t.terminal?.dispose() })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // fullscreen: watch browser fullscreen change
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const loadNodes = async () => {
    try {
      const res = await axios.get('/webshell/nodes')
      setNodes((res.data.data || []).filter((x: Node) => x.enabled))
    } catch {
      setNodes([{ name: 'ln0', host: 'localhost', port: 22, description: '登录节点', enabled: true }])
    }
  }

  const checkPrivateKey = async () => {
    try { setHasKey(!!(await axios.get('/webshell/has-key')).data.has_key) } catch { /**/ }
  }

  const createTerm = useCallback(async (tabId: string) => {
    const el = termRefs.current.get(tabId)
    if (!el) return null
    try {
      const { Terminal } = await import('xterm')
      const { FitAddon } = await import('xterm-addon-fit')
      await import('xterm/css/xterm.css')
      const term = new Terminal({ theme: THEMES[theme] || THEMES.dark, fontFamily: '"Cascadia Code","Fira Code",Consolas,monospace', fontSize, cursorBlink, scrollback: 5000 })
      const fit  = new FitAddon()
      term.loadAddon(fit)
      term.open(el)
      fit.fit()
      const ro = new ResizeObserver(() => { try { fit.fit() } catch { /**/ } })
      ro.observe(el)
      return { terminal: term, fitAddon: fit }
    } catch (e) { console.error(e); return null }
  }, [fontSize, theme, cursorBlink])

  const connectToNode = useCallback(async (node: Node, pwd?: string) => {
    const tabId = `tab-${Date.now()}`
    setTabs(prev => [...prev, { id: tabId, node, terminal: null, fitAddon: null, websocket: null, connected: false, status: 'connecting' }])
    setActiveTabId(tabId)
    await new Promise(r => setTimeout(r, 130))

    const inst = await createTerm(tabId)
    if (!inst) { Message.error('创建终端失败'); return }
    const { terminal, fitAddon } = inst

    // 根据当前的认证类型决定传递哪些参数
    const params = new URLSearchParams({ 
      node: node.name, 
      token: getToken() || ''
    })
    
    // 密码认证：传递密码
    if (pwd) {
      params.append('password', pwd)
    }
    // 如果既没有密码也没有私钥，这里先尝试连接，后端会返回auth_required
    
    const ws = new WebSocket(`${getWsBase()}/api/webshell/connect?${params}`)

    ws.onopen = () => {
      terminal.writeln(`\r\n\x1b[32m✓ Connected to ${node.name}  (${node.host})\x1b[0m\r\n`)
      fitAddon.fit()
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, terminal, fitAddon, websocket: ws, connected: true, status: 'connected' } : t))
      ws.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }))
      terminal.onData((d: string) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'input', data: d })))
      terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'resize', cols, rows })))
    }
    ws.onmessage = e => {
      try { 
        const m = JSON.parse(e.data)
        if (m.type === 'output') {
          terminal.write(m.data)
        } else if (m.type === 'auth_required') {
          // 需要重新认证
          terminal.writeln('\r\n\x1b[33m⚠ 需要密码认证\x1b[0m')
          terminal.writeln('\x1b[90m提示：请关闭此窗口并使用密码重新连接\x1b[0m\r\n')
          ws.close()
          // 更新Tab状态为需要认证
          setTabs(prev => prev.map(t => t.id === tabId ? { ...t, connected: false, status: 'auth_required' } : t))
          // 不要自动关闭Tab，让用户看到提示信息
          // 弹出密码认证窗口，预设当前节点
          setTimeout(() => {
            setPendingNode(node)
            setAuthType('password') // 强制使用密码认证
            setPassword('') // 清空之前的密码
            setAuthOpen(true)
          }, 100)
        } else if (m.type === 'connected') {
          terminal.writeln(`\x1b[90m认证方式: ${m.data?.auth_method === 'private_key' ? '私钥' : '密码'}\x1b[0m\r\n`)
        }
      }
      catch { terminal.write(e.data) }
    }
    ws.onerror = () => { terminal.writeln('\r\n\x1b[31m✗ Connection error\x1b[0m'); setTabs(prev => prev.map(t => t.id === tabId ? { ...t, connected: false, status: 'error' } : t)) }
    ws.onclose = () => { terminal.writeln('\r\n\x1b[33m─── Connection closed ───\x1b[0m'); setTabs(prev => prev.map(t => t.id === tabId ? { ...t, connected: false, status: 'disconnected' } : t)) }
  }, [createTerm])

  const handleNodeClick = (node: Node) => { 
    setPendingNode(node)
    // 根据是否有密钥自动选择认证方式
    setAuthType(hasKey ? 'key' : 'password')
    setAuthOpen(true) 
  }

  const handleConnect = () => {
    if (!pendingNode) return
    if (authType === 'password' && !password) { Message.warning('请输入密码'); return }
    setAuthOpen(false)
    connectToNode(pendingNode, password)
    setPassword(''); setPendingNode(null)
  }

  const closeTab = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId)
    tab?.websocket?.close(); tab?.terminal?.dispose(); termRefs.current.delete(tabId)
    const rest = tabs.filter(t => t.id !== tabId)
    setTabs(rest)
    if (activeTabId === tabId) setActiveTabId(rest.length ? rest[rest.length - 1].id : '')
  }

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch (e) { console.error(e) }
  }

  const saveSettings = (fs: number, th: string, bl: boolean) =>
    localStorage.setItem('ws-term-settings', JSON.stringify({ fontSize: fs, theme: th, cursorBlink: bl }))

  const generateKey = async () => {
    setGeneratingKey(true)
    try {
      const res = await axios.post('/webshell/generate-key')
      setGeneratedPubKey(res.data.public_key || '')
      Message.success('密钥生成成功')
      checkPrivateKey()
    } catch (e: any) { Message.error(e.response?.data?.error || '生成失败') }
    finally { setGeneratingKey(false) }
  }

  const activeTab = tabs.find(t => t.id === activeTabId)

  // ── 快捷键 ─────────────────────────────────────────────────
  // 用 ref 持有最新的 tabs / activeTabId，避免 stale closure
  const tabsRef = useRef(tabs)
  const activeTabIdRef = useRef(activeTabId)
  useEffect(() => { tabsRef.current = tabs }, [tabs])
  useEffect(() => { activeTabIdRef.current = activeTabId }, [activeTabId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 检测平台：Mac 用 Cmd，其他用 Ctrl
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const modifier = isMac ? e.metaKey : e.ctrlKey
      
      // 主修饰键未按下则返回（Mac: Cmd，其他: Ctrl）
      if (!modifier) return
      
      // Cmd/Ctrl + 1~9  切换 Tab
      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const idx = parseInt(e.key) - 1
        const t = tabsRef.current[idx]
        if (t) setActiveTabId(t.id)
        return
      }
      
      // Cmd/Ctrl + T  新建 Tab（打开认证弹窗）
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        setAuthOpen(true)
        return
      }
      
      // Cmd/Ctrl + W  关闭当前 Tab
      if (e.key === 'w' || e.key === 'W') {
        e.preventDefault()
        if (activeTabIdRef.current) closeTab(activeTabIdRef.current)
        return
      }
      
      // Cmd/Ctrl + F  切换全屏
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        toggleFullscreen()
        return
      }
      
      // Cmd/Ctrl + K  清屏（Mac 风格）
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        tabs.find(t => t.id === activeTabIdRef.current)?.terminal?.clear()
        return
      }
      
      // Cmd/Ctrl + ,  打开终端设置
      if (e.key === ',') {
        e.preventDefault()
        setSettingsOpen(true)
        return
      }
      
      // Cmd/Ctrl + Shift + K  打开密钥管理
      if (e.shiftKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setKeyOpen(true)
        return
      }
      
      // Cmd/Ctrl + [/]  切换相邻 Tab（Mac 风格）
      if (e.key === '[') {
        e.preventDefault()
        const cur = tabsRef.current.findIndex(t => t.id === activeTabIdRef.current)
        if (cur > 0) setActiveTabId(tabsRef.current[cur - 1].id)
        return
      }
      if (e.key === ']') {
        e.preventDefault()
        const cur = tabsRef.current.findIndex(t => t.id === activeTabIdRef.current)
        if (cur < tabsRef.current.length - 1) setActiveTabId(tabsRef.current[cur + 1].id)
        return
      }
      
      // Cmd/Ctrl + ←/→  也支持箭头切换
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        const cur = tabsRef.current.findIndex(t => t.id === activeTabIdRef.current)
        if (cur > 0) setActiveTabId(tabsRef.current[cur - 1].id)
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        const cur = tabsRef.current.findIndex(t => t.id === activeTabIdRef.current)
        if (cur < tabsRef.current.length - 1) setActiveTabId(tabsRef.current[cur + 1].id)
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Modal 全屏时需要挂载到容器内
  const modalProps = { getContainer: () => containerRef.current || document.body }

  // 检测平台，显示对应的修饰键符号
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const modKey = isMac ? '⌘' : 'Ctrl'

  // ── render ─────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', overflow: 'hidden', background: '#f5f5f5' }}
    >
      {/* 页面头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', background: '#fff', borderBottom: '1px solid #e8e8e8', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🖥️</span>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Web Shell</span>
          {tabs.length > 0 && (
            <span style={{ fontSize: 12, color: '#888', marginLeft: 4 }}>
              {tabs.filter(t => t.connected).length}/{tabs.length} 已连接
            </span>
          )}
        </div>
        <Space>
          <Button size="small" icon={<KeyOutlined />} onClick={() => setKeyOpen(true)}>密钥管理</Button>
          <Button size="small" icon={<SettingOutlined />} onClick={() => setSettingsOpen(true)}>终端设置</Button>
        </Space>
      </div>
      {/* 快捷键提示条 */}
      {tabs.length > 0 && (
        <div style={{ padding: '3px 20px', background: '#f0f0f0', borderBottom: '1px solid #e8e8e8', fontSize: 11, color: '#999', display: 'flex', gap: 16, flexShrink: 0 }}>
          <span>{modKey}+1~9 切换Tab</span>
          <span>{modKey}+[/] 前后Tab</span>
          <span>{modKey}+T 新建</span>
          <span>{modKey}+W 关闭</span>
          <span>{modKey}+K 清屏</span>
          <span>{modKey}+F 全屏</span>
          <span>{modKey}+, 设置</span>
        </div>
      )}

      {/* 主工作区 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* 左侧：主机列表 */}
        <div style={{ width: sidebarCollapsed ? 48 : 260, flexShrink: 0, background: '#fff', borderRight: '1px solid #e8e8e8', display: 'flex', flexDirection: 'column', transition: 'width 0.25s' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #e8e8e8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
            {!sidebarCollapsed && <span style={{ fontSize: 13, fontWeight: 600 }}>主机列表</span>}
            <div style={{ display: 'flex', gap: 2, marginLeft: sidebarCollapsed ? 'auto' : 0 }}>
              {!sidebarCollapsed && <Button type="text" size="small" icon={<ReloadOutlined />} onClick={loadNodes} />}
              <Button type="text" size="small" icon={sidebarCollapsed ? <RightOutlined /> : <LeftOutlined />} onClick={() => setSidebarCollapsed(v => !v)} />
            </div>
          </div>

          {!sidebarCollapsed && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
              {nodes.length === 0 && <div style={{ fontSize: 12, color: '#999', textAlign: 'center', marginTop: 24 }}>暂无主机</div>}
              {nodes.map(node => {
                const isConn = tabs.some(t => t.node.name === node.name && t.connected)
                return (
                  <div
                    key={node.name}
                    onClick={() => handleNodeClick(node)}
                    style={{ padding: '9px 11px', marginBottom: 4, background: isConn ? '#f6ffed' : '#fff', border: `1px solid ${isConn ? '#b7eb8f' : '#e8e8e8'}`, borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => { if (!isConn) { e.currentTarget.style.borderColor = '#d9d9d9'; e.currentTarget.style.background = '#fafafa' } }}
                    onMouseLeave={e => { if (!isConn) { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.background = '#fff' } }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{node.name}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.host}</div>
                        {node.description && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{node.description}</div>}
                      </div>
                      {isConn && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#52c41a', marginLeft: 8, flexShrink: 0 }} />}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {!sidebarCollapsed && (
            <div style={{ padding: 10, borderTop: '1px solid #e8e8e8', background: '#fafafa', fontSize: 11, color: '#aaa', textAlign: 'center' }}>
              {tabs.length} 个会话
            </div>
          )}
        </div>

        {/* 右侧：终端区域 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1e1e1e', overflow: 'hidden' }}>

          {tabs.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#555' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>💻</div>
              <div style={{ fontSize: 15, marginBottom: 6, color: '#888' }}>Web Shell</div>
              <div style={{ fontSize: 12, color: '#555' }}>从左侧选择主机建立 SSH 连接</div>
            </div>
          ) : (
            <>
              {/* Tab 栏 */}
              <div style={{ display: 'flex', alignItems: 'center', background: '#252526', borderBottom: '1px solid #3e3e3e', padding: '4px 8px 0', gap: 2, overflowX: 'auto', flexShrink: 0 }}>
                {tabs.map(tab => (
                  <div
                    key={tab.id}
                    onClick={() => setActiveTabId(tab.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px 6px 10px', background: activeTabId === tab.id ? '#1e1e1e' : 'transparent', borderRadius: '4px 4px 0 0', cursor: 'pointer', border: activeTabId === tab.id ? '1px solid #3e3e3e' : '1px solid transparent', borderBottom: activeTabId === tab.id ? '1px solid #1e1e1e' : 'none', minWidth: 110, maxWidth: 180, userSelect: 'none' }}
                    onMouseEnter={e => { if (activeTabId !== tab.id) e.currentTarget.style.background = '#2d2d2d' }}
                    onMouseLeave={e => { if (activeTabId !== tab.id) e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: tab.status === 'connected' ? '#52c41a' : tab.status === 'connecting' ? '#faad14' : '#ff4d4f', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#ccc', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tab.node.name}</span>
                    <CloseOutlined onClick={e => { e.stopPropagation(); closeTab(tab.id) }} style={{ fontSize: 10, color: '#666' }} />
                  </div>
                ))}
                <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => setAuthOpen(true)} style={{ color: '#666', marginLeft: 4 }} title={`新建终端 (${modKey}+T)`} />
              </div>

              {/* 工具栏 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 12px', background: '#2d2d2d', borderBottom: '1px solid #3e3e3e', flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: '#888' }}>
                  {activeTab?.node.host}
                  {activeTab?.status === 'connected' ? '  ● 已连接' : activeTab?.status === 'connecting' ? '  ⏳ 连接中' : '  ○ 已断开'}
                </span>
                <Space size={2}>
                  <Button type="text" size="small" icon={<ClearOutlined />} onClick={() => tabs.find(t => t.id === activeTabId)?.terminal?.clear()} title={`清屏 (${modKey}+K)`} style={{ color: '#888' }} />
                  <Button type="text" size="small" icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} onClick={toggleFullscreen} title={`${isFullscreen ? '退出全屏' : '全屏'} (${modKey}+F)`} style={{ color: '#888' }} />
                  <Button type="text" size="small" icon={<DisconnectOutlined />} onClick={() => tabs.find(t => t.id === activeTabId)?.websocket?.close()} title={`断开 (${modKey}+W)`} style={{ color: '#ff6b6b' }} />
                </Space>
              </div>

              {/* xterm 容器 */}
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                {tabs.map(tab => (
                  <div
                    key={tab.id}
                    style={{ position: 'absolute', inset: 0, padding: 4, display: activeTabId === tab.id ? 'block' : 'none' }}
                  >
                    <div
                      style={{ width: '100%', height: '100%' }}
                      ref={el => { if (el) termRefs.current.set(tab.id, el as HTMLDivElement) }}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 认证弹窗 ── */}
      <Modal
        title="SSH 连接"
        open={authOpen}
        okText="连接"
        cancelText="取消"
        onOk={handleConnect}
        onCancel={() => { setAuthOpen(false); setPassword(''); setPendingNode(null) }}
        {...modalProps}
      >
        {/* 节点选择（未预设节点时显示） */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>目标节点</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {nodes.map(node => (
              <div
                key={node.name}
                onClick={() => setPendingNode(node)}
                style={{ padding: '6px 12px', border: `1.5px solid ${pendingNode?.name === node.name ? '#1890ff' : '#d9d9d9'}`, borderRadius: 6, cursor: 'pointer', fontSize: 13, background: pendingNode?.name === node.name ? '#e6f7ff' : '#fff', transition: 'all 0.15s' }}
              >
                <div style={{ fontWeight: 600 }}>{node.name}</div>
                <div style={{ fontSize: 11, color: '#888' }}>{node.host}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 12, fontSize: 13, color: '#555' }}>
          <b>用户：</b>{user?.username}
        </div>
        <Radio.Group value={authType} onChange={e => setAuthType(e.target.value)} style={{ marginBottom: 16 }}>
          <Space direction="vertical">
            <Radio value="key">
              <Space>
                <span>🔑 私钥认证</span>
                {hasKey
                  ? <span style={{ color: '#52c41a', fontSize: 11 }}>✓ 已上传</span>
                  : <span style={{ color: '#faad14', fontSize: 11 }}>⚠ 未上传</span>
                }
              </Space>
            </Radio>
            <Radio value="password">🔐 密码认证</Radio>
          </Space>
        </Radio.Group>
        {authType === 'password' && (
          <Input.Password value={password} onChange={e => setPassword(e.target.value)} placeholder="SSH 密码（不会被保存）" onPressEnter={handleConnect} autoFocus />
        )}
      </Modal>

      {/* ── 终端设置弹窗 ── */}
      <Modal
        title="⚙️ 终端设置"
        open={settingsOpen}
        onCancel={() => setSettingsOpen(false)}
        {...modalProps}
        footer={[
          <Button key="reset" onClick={() => { setFontSize(14); setTheme('dark'); setCursorBlink(true); saveSettings(14, 'dark', true) }}>恢复默认</Button>,
          <Button key="ok" type="primary" onClick={() => { saveSettings(fontSize, theme, cursorBlink); setSettingsOpen(false) }}>确定</Button>,
        ]}
      >
        <div style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 6, fontWeight: 500, fontSize: 13 }}>字体大小</div>
          <Space>
            <input type="range" min={10} max={24} step={1} value={fontSize} onChange={e => setFontSize(Number(e.target.value))} style={{ width: 200 }} />
            <span style={{ fontSize: 13, minWidth: 36 }}>{fontSize}px</span>
          </Space>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 13 }}>配色方案</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {Object.entries(THEMES).map(([key, t]) => (
              <div key={key} onClick={() => setTheme(key)} style={{ padding: '8px 10px', background: t.background, color: t.foreground, border: `2px solid ${theme === key ? '#1890ff' : 'transparent'}`, borderRadius: 6, cursor: 'pointer', fontSize: 12, textAlign: 'center', fontWeight: theme === key ? 600 : 400 }}>
                {key}
              </div>
            ))}
          </div>
        </div>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={cursorBlink} onChange={e => setCursorBlink(e.target.checked)} />
          光标闪烁
        </label>
        <div style={{ marginTop: 16, fontSize: 11, color: '#999' }}>* 设置将在下次新建终端时生效</div>
      </Modal>

      {/* ── 密钥管理弹窗 ── */}
      <Modal
        title="🔑 SSH 密钥管理"
        open={keyOpen}
        onCancel={() => setKeyOpen(false)}
        {...modalProps}
        footer={[<Button key="close" onClick={() => setKeyOpen(false)}>关闭</Button>]}
        width={560}
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['generate', 'upload'] as const).map(k => (
            <Button key={k} type={keyTab === k ? 'primary' : 'default'} size="small" onClick={() => setKeyTab(k)}>
              {k === 'generate' ? '自动生成' : '手动上传'}
            </Button>
          ))}
        </div>
        <div style={{ marginBottom: 12, padding: 10, background: '#f5f5f5', borderRadius: 6, fontSize: 13 }}>
          私钥状态：{hasKey
            ? <span style={{ color: '#52c41a', fontWeight: 600 }}>✓ 已上传</span>
            : <span style={{ color: '#faad14', fontWeight: 600 }}>⚠ 未上传</span>
          }
        </div>
        {keyTab === 'generate' ? (
          <div>
            <p style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>平台自动生成 ED25519 密钥对，私钥保存在服务端，公钥自动部署到计算节点。</p>
            <Button type="primary" loading={generatingKey} onClick={generateKey} block>🔐 一键生成密钥对</Button>
            {generatedPubKey && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>公钥（已自动部署）</div>
                <pre style={{ background: '#f5f5f5', padding: 10, borderRadius: 6, fontSize: 11, overflowX: 'auto', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{generatedPubKey}</pre>
                <Button size="small" onClick={() => { navigator.clipboard.writeText(generatedPubKey); Message.success('已复制') }}>📋 复制</Button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>上传您的 SSH 私钥文件，支持 OpenSSH / PEM 格式。</p>
            <input
              type="file"
              accept=".pem,.key,*"
              style={{ display: 'block', width: '100%', padding: 8, border: '1px solid #d9d9d9', borderRadius: 4, fontSize: 13 }}
              onChange={async e => {
                const file = e.target.files?.[0]
                if (!file) return
                const fd = new FormData()
                fd.append('key', file)
                try {
                  await axios.post('/webshell/upload-key', fd)
                  Message.success('私钥上传成功')
                  checkPrivateKey()
                } catch (err: any) {
                  Message.error(err.response?.data?.error || '上传失败')
                }
              }}
            />
            <div style={{ marginTop: 10, fontSize: 11, color: '#999' }}>💡 私钥将加密保存在服务器，仅用于 SSH 认证</div>
          </div>
        )}
      </Modal>
    </div>
  )
}
