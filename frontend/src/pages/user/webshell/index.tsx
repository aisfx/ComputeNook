import { useState, useEffect, useRef, useCallback } from 'react'
import { Button, Space, Modal, Input, Radio, message as Message, Upload, Table, Breadcrumb, Tooltip, Select, notification } from 'antd'
import type { UploadProps } from 'antd'
import {
  PlusOutlined, CloseOutlined, SettingOutlined, KeyOutlined,
  ReloadOutlined, FullscreenOutlined, FullscreenExitOutlined,
  ClearOutlined, DisconnectOutlined, LeftOutlined, RightOutlined,
  FolderOutlined, FileOutlined, DownloadOutlined, DeleteOutlined,
  UploadOutlined, HomeOutlined, ArrowLeftOutlined, FileTextOutlined,
} from '@ant-design/icons'
import { getWsBase, getToken, getUser, getApiBase } from '@/utils/auth'
import axios from 'axios'

interface Node {
  name: string; host: string; port: number
  description?: string; enabled: boolean
}
interface ShellTab {
  id: string; node: Node; terminal: any; fitAddon: any
  websocket: WebSocket | null; connected: boolean; status: string
}

interface FileItem {
  name: string
  path: string
  is_dir: boolean
  size: number
  mod_time: string
  permissions: string
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
  
  // 文件管理器状态
  const [filesPanelOpen, setFilesPanelOpen] = useState(false)
  const [filesPanelWidth, setFilesPanelWidth] = useState(400)
  const [currentNode, setCurrentNode]     = useState<Node | null>(null)
  const [currentPath, setCurrentPath]     = useState('')
  const [files, setFiles]                 = useState<FileItem[]>([])
  const [filesLoading, setFilesLoading]   = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([])
  
  // 上传进度管理
  interface UploadTask {
    id: string
    fileName: string
    fileSize: number
    uploadedSize: number
    progress: number
    speed: number
    status: 'uploading' | 'paused' | 'completed' | 'error'
    startTime: number
    error?: string
  }
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([])
  const [showUploadPanel, setShowUploadPanel] = useState(false)

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
  const [deployKeyOpen, setDeployKeyOpen] = useState(false)
  const [deployPassword, setDeployPassword] = useState('')
  const [deploying, setDeploying] = useState(false)
  const [deployedNodes, setDeployedNodes] = useState<string[]>([])
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
  
  // 单独处理容器作业提示，只显示一次
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const jobIdParam = urlParams.get('jobId')
    const isContainer = urlParams.get('container') === 'true'
    
    if (jobIdParam && isContainer) {
      // 显示右下角通知，带关闭按钮
      const timer = setTimeout(() => {
        notification.info({
          message: '🐳 容器连接步骤',
          description: (
            <div style={{ fontSize: 13, lineHeight: 1.8 }}>
              <div>
                <strong>1.</strong> 选择左侧登录节点<br/>
                <strong>2.</strong> 进入作业：
                <code style={{ 
                  background: '#f0f0f0', 
                  padding: '2px 6px', 
                  borderRadius: 3,
                  color: '#d4380d',
                  fontSize: 11,
                  marginLeft: 4
                }}>
                  srun --jobid={jobIdParam} --pty --overlap bash
                </code><br/>
                <strong>3.</strong> 查看容器：
                <code style={{ 
                  background: '#f0f0f0', 
                  padding: '2px 6px', 
                  borderRadius: 3,
                  color: '#d4380d',
                  fontSize: 11,
                  marginLeft: 4
                }}>
                  enroot list
                </code><br/>
                <strong>4.</strong> 进入容器：
                <code style={{ 
                  background: '#f0f0f0', 
                  padding: '2px 6px', 
                  borderRadius: 3,
                  color: '#d4380d',
                  fontSize: 11,
                  marginLeft: 4
                }}>
                  enroot start -w pyxis_{jobIdParam}.0 bash
                </code>
              </div>
            </div>
          ),
          duration: 0, // 不自动关闭
          placement: 'bottomRight',
          style: { width: 480 }
        })
      }, 500)
      
      return () => clearTimeout(timer)
    }
  }, []) // 空依赖数组，只在组件挂载时执行一次

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

  // ── 文件管理器功能 ────────────────────────────────────────
  const loadFiles = useCallback(async (node: Node, path: string) => {
    setFilesLoading(true)
    try {
      const res = await axios.post('/webshell/files/list', {
        node: node.name,
        path: path || `/home/${user?.username || ''}`
      })
      setFiles(res.data.files || [])
    } catch (e: any) {
      const errorMsg = e.response?.data?.error || '加载文件列表失败'
      
      // 如果是路径不存在错误，且不是根目录，尝试根目录
      if (errorMsg.includes('does not exist') && path !== '/') {
        Message.warning(`目录 ${path} 不存在，切换到根目录`)
        setCurrentPath('/')
        loadFiles(node, '/')
        return
      }
      
      // 如果是私钥相关错误，给出明确提示
      if (errorMsg.includes('私钥') || errorMsg.includes('private key')) {
        Message.error({
          content: (
            <div>
              <div>{errorMsg}</div>
              <div style={{ marginTop: 8, fontSize: 12 }}>
                提示：请在 WebShell 页面点击"密钥管理"按钮生成或上传 SSH 密钥
              </div>
            </div>
          ),
          duration: 5000
        })
      } else {
        Message.error(errorMsg)
      }
      
      setFiles([])
    } finally {
      setFilesLoading(false)
    }
  }, [user])

  const openFilesPanel = async (node: Node) => {
    console.log('=== 打开文件管理面板 ===')
    console.log('节点:', node)
    console.log('当前用户(localStorage):', user)
    
    setCurrentNode(node)
    setFilesPanelOpen(true)
    
    // 实时从后端获取用户信息（包含最新的 homeDir）
    console.log('开始调用 /api/me 获取用户信息...')
    try {
      const res = await axios.get('/me')
      console.log('/api/me 响应:', res.data)
      const userData = res.data.data
      console.log('解析的用户数据:', userData)
      console.log('用户的 homeDir:', userData.homeDir)
      console.log('用户的 home_dir:', userData.home_dir)
      
      const homePath = userData.homeDir || userData.home_dir || `/home/${userData.username || user?.username || ''}`
      console.log('最终使用的 home 路径:', homePath)
      
      setCurrentPath(homePath)
      loadFiles(node, homePath)
    } catch (error) {
      // 如果获取失败，使用本地用户信息
      console.error('获取用户信息失败，使用本地缓存', error)
      const homePath = user?.homeDir || `/home/${user?.username || ''}`
      console.log('降级使用本地 home 路径:', homePath)
      setCurrentPath(homePath)
      loadFiles(node, homePath)
    }
  }

  const changeDirectory = (path: string) => {
    if (!currentNode) return
    setCurrentPath(path)
    loadFiles(currentNode, path)
  }

  const goBack = () => {
    if (!currentPath || currentPath === '/') return
    const parts = currentPath.split('/').filter(Boolean)
    parts.pop()
    const newPath = '/' + parts.join('/')
    changeDirectory(newPath || '/')
  }

  const downloadFile = async (file: FileItem) => {
    if (!currentNode || file.is_dir) return
    try {
      const token = getToken() || ''
      // 下载需要完整 URL，因为不经过 axios 的 baseURL
      const apiBase = getApiBase()
      const url = `${apiBase}/api/webshell/files/download?node=${encodeURIComponent(currentNode.name)}&path=${encodeURIComponent(file.path)}&token=${token}`
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (e: any) {
      Message.error('下载失败')
    }
  }

  const deleteFile = async (file: FileItem) => {
    if (!currentNode) return
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除 "${file.name}" 吗？`,
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await axios.post('/webshell/files/delete', {
            node: currentNode.name,
            path: file.path
          })
          Message.success('删除成功')
          loadFiles(currentNode, currentPath)
        } catch (e: any) {
          Message.error(e.response?.data?.error || '删除失败')
        }
      }
    })
  }

  const uploadProps: UploadProps = {
    name: 'file',
    action: `${getApiBase()}/api/webshell/files/upload`,
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
    data: {
      node: currentNode?.name || '',
      path: currentPath,
    },
    showUploadList: false,
    customRequest: async (options) => {
      const { file, onProgress, onSuccess, onError } = options as any
      const formData = new FormData()
      formData.append('file', file)
      formData.append('node', currentNode?.name || '')
      formData.append('path', currentPath)
      
      const taskId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const task: UploadTask = {
        id: taskId,
        fileName: file.name,
        fileSize: file.size,
        uploadedSize: 0,
        progress: 0,
        speed: 0,
        status: 'uploading',
        startTime: Date.now()
      }
      
      setUploadTasks(prev => [...prev, task])
      setShowUploadPanel(true)
      
      try {
        const xhr = new XMLHttpRequest()
        
        // 进度回调
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100)
            const elapsed = (Date.now() - task.startTime) / 1000 // 秒
            const speed = elapsed > 0 ? e.loaded / elapsed : 0 // 字节/秒
            
            setUploadTasks(prev => prev.map(t => 
              t.id === taskId 
                ? { ...t, uploadedSize: e.loaded, progress, speed }
                : t
            ))
            
            onProgress?.({ percent: progress })
          }
        }
        
        // 完成回调
        xhr.onload = () => {
          if (xhr.status === 200) {
            setUploadTasks(prev => prev.map(t => 
              t.id === taskId 
                ? { ...t, status: 'completed', progress: 100 }
                : t
            ))
            Message.success(`${file.name} 上传成功`)
            if (currentNode) loadFiles(currentNode, currentPath)
            onSuccess?.(xhr.response, xhr)
            
            // 3秒后自动移除已完成的任务
            setTimeout(() => {
              setUploadTasks(prev => prev.filter(t => t.id !== taskId))
            }, 3000)
          } else {
            throw new Error(xhr.statusText || '上传失败')
          }
        }
        
        // 错误回调
        xhr.onerror = () => {
          const error = '上传失败'
          setUploadTasks(prev => prev.map(t => 
            t.id === taskId 
              ? { ...t, status: 'error', error }
              : t
          ))
          Message.error(`${file.name} ${error}`)
          onError?.(new Error(error))
        }
        
        // 发送请求
        xhr.open('POST', `${getApiBase()}/api/webshell/files/upload`)
        xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`)
        xhr.send(formData)
      } catch (err: any) {
        const error = err.message || '上传失败'
        setUploadTasks(prev => prev.map(t => 
          t.id === taskId 
            ? { ...t, status: 'error', error }
            : t
        ))
        Message.error(`${file.name} ${error}`)
        onError?.(err)
      }
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '-'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i]
  }
  
  const formatSpeed = (bytesPerSecond: number): string => {
    return formatFileSize(bytesPerSecond) + '/s'
  }
  
  const clearCompletedTasks = () => {
    setUploadTasks(prev => prev.filter(t => t.status !== 'completed'))
  }
  
  const removeTask = (taskId: string) => {
    setUploadTasks(prev => prev.filter(t => t.id !== taskId))
  }

  const fileColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: FileItem) => (
        <Space 
          style={{ cursor: 'pointer' }} 
          onClick={() => record.is_dir && changeDirectory(record.path)}
        >
          {record.is_dir ? (
            <FolderOutlined style={{ color: '#faad14', fontSize: 16 }} />
          ) : (
            <FileTextOutlined style={{ color: '#1890ff', fontSize: 16 }} />
          )}
          <span>{name}</span>
        </Space>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 100,
      render: (size: number, record: FileItem) => record.is_dir ? '-' : formatFileSize(size),
    },
    {
      title: '权限',
      dataIndex: 'permissions',
      key: 'permissions',
      width: 100,
      render: (perm: string) => <code style={{ fontSize: 11 }}>{perm}</code>,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: FileItem) => (
        <Space size="small">
          {!record.is_dir && (
            <Tooltip title="下载">
              <Button
                type="text"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => downloadFile(record)}
              />
            </Tooltip>
          )}
          <Tooltip title="删除">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => deleteFile(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

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

  // 连接节点并进入容器
  const connectAndEnterContainer = useCallback(async (node: Node, jobId: string) => {
    const tabId = `tab-${Date.now()}`
    setTabs(prev => [...prev, { id: tabId, node, terminal: null, fitAddon: null, websocket: null, connected: false, status: 'connecting' }])
    setActiveTabId(tabId)
    await new Promise(r => setTimeout(r, 130))

    const inst = await createTerm(tabId)
    if (!inst) { Message.error('创建终端失败'); return }
    const { terminal, fitAddon } = inst

    const params = new URLSearchParams({ 
      node: node.name, 
      token: getToken() || ''
    })
    
    const ws = new WebSocket(`${getWsBase()}/api/webshell/connect?${params}`)
    let containerEntered = false

    ws.onopen = () => {
      terminal.writeln(`\r\n\x1b[32m✓ Connected to ${node.name}  (${node.host})\x1b[0m`)
      terminal.writeln(`\x1b[36m正在进入作业 ${jobId} 的容器...\x1b[0m\r\n`)
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
        } else if (m.type === 'connected') {
          terminal.writeln(`\x1b[90m认证方式: ${m.data?.auth_method === 'private_key' ? '私钥' : '密码'}\x1b[0m\r\n`)
          // 连接成功后，自动执行进入容器的命令
          if (!containerEntered) {
            containerEntered = true
            setTimeout(() => {
              // 使用 srun 进入容器
              const enterCmd = `srun --jobid=${jobId} --pty bash\\n`
              ws.send(JSON.stringify({ type: 'input', data: enterCmd }))
            }, 500)
          }
        } else if (m.type === 'auth_required') {
          terminal.writeln('\r\n\x1b[33m⚠ 需要密码认证\x1b[0m')
          terminal.writeln('\x1b[90m提示：请先配置SSH密钥或使用密码连接\x1b[0m\r\n')
          ws.close()
          setTabs(prev => prev.map(t => t.id === tabId ? { ...t, connected: false, status: 'auth_required' } : t))
        }
      }
      catch { terminal.write(e.data) }
    }
    ws.onerror = () => { 
      terminal.writeln('\r\n\x1b[31m✗ Connection error\x1b[0m')
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, connected: false, status: 'error' } : t))
    }
    ws.onclose = () => { 
      terminal.writeln('\r\n\x1b[33m─── Connection closed ───\x1b[0m')
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, connected: false, status: 'disconnected' } : t))
    }
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
      Message.success('密钥生成成功！请部署到登录节点')
      checkPrivateKey()
      // 自动打开部署对话框
      setDeployKeyOpen(true)
    } catch (e: any) { Message.error(e.response?.data?.error || '生成失败') }
    finally { setGeneratingKey(false) }
  }

  // 部署公钥到节点
  const deployPublicKey = async () => {
    if (!deployPassword) {
      Message.error('请输入SSH密码')
      return
    }
    
    setDeploying(true)
    const deployed: string[] = []
    const failed: string[] = []
    
    try {
      // 部署到所有节点
      for (const node of nodes) {
        try {
          await axios.post('/webshell/keys/deploy', {
            node_name: node.name,
            password: deployPassword
          })
          deployed.push(node.name)
        } catch (e: any) {
          console.error(`部署到${node.name}失败:`, e)
          failed.push(node.name)
        }
      }
      
      setDeployedNodes(deployed)
      
      if (failed.length === 0) {
        Message.success(`成功部署到 ${deployed.length} 个节点`)
        setDeployKeyOpen(false)
        setDeployPassword('')
      } else {
        Message.warning(`成功: ${deployed.length}, 失败: ${failed.length}`)
      }
    } catch (e: any) {
      Message.error(e.response?.data?.error || '部署失败')
    } finally {
      setDeploying(false)
    }
  }

  const activeTab = tabs.find(t => t.id === activeTabId)

  // 当切换 tab 时，自动聚焦到终端
  useEffect(() => {
    if (!activeTabId) return
    
    const tab = tabs.find(t => t.id === activeTabId)
    if (tab?.terminal) {
      // 使用 requestAnimationFrame 确保 DOM 完全渲染后再聚焦
      requestAnimationFrame(() => {
        setTimeout(() => {
          tab.terminal.focus()
        }, 100)
      })
    }
  }, [activeTabId, tabs])

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
                    style={{ padding: '9px 11px', marginBottom: 4, background: isConn ? '#f6ffed' : '#fff', border: `1px solid ${isConn ? '#b7eb8f' : '#e8e8e8'}`, borderRadius: 6, transition: 'all 0.15s' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div 
                        style={{ minWidth: 0, flex: 1, cursor: 'pointer' }}
                        onClick={() => handleNodeClick(node)}
                      >
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{node.name}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.host}</div>
                        {node.description && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{node.description}</div>}
                      </div>
                      <Space size={4}>
                        {isConn && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#52c41a', flexShrink: 0 }} />}
                        <Tooltip title="文件管理">
                          <Button
                            type="text"
                            size="small"
                            icon={<FolderOutlined />}
                            onClick={(e) => {
                              e.stopPropagation()
                              openFilesPanel(node)
                            }}
                            style={{ padding: '2px 4px', height: 24 }}
                          />
                        </Tooltip>
                      </Space>
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
                {tabs.map(tab => {
                  const isActive = activeTabId === tab.id
                  return (
                    <div
                      key={tab.id}
                      style={{ position: 'absolute', inset: 0, padding: 4, display: isActive ? 'block' : 'none' }}
                      ref={el => {
                        // 当容器显示时，自动聚焦终端
                        if (el && isActive && tab.terminal) {
                          requestAnimationFrame(() => {
                            tab.terminal.focus()
                          })
                        }
                      }}
                    >
                      <div
                        style={{ width: '100%', height: '100%' }}
                        ref={el => { if (el) termRefs.current.set(tab.id, el as HTMLDivElement) }}
                      />
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* 文件管理面板 */}
        {filesPanelOpen && (
          <div style={{
            width: filesPanelWidth,
            borderLeft: '1px solid #e8e8e8',
            background: '#fff',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0
          }}>
            {/* 文件面板头部 */}
            <div style={{
              padding: '10px 12px',
              borderBottom: '1px solid #e8e8e8',
              background: '#fafafa',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Space>
                <FolderOutlined style={{ color: '#1890ff' }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>文件管理</span>
                {currentNode && (
                  <span style={{ fontSize: 11, color: '#888' }}>({currentNode.name})</span>
                )}
              </Space>
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={() => setFilesPanelOpen(false)}
              />
            </div>

            {/* 主机切换 */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', background: '#fff' }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>切换主机</div>
              <Select
                value={currentNode?.name}
                onChange={(nodeName) => {
                  const node = nodes.find(n => n.name === nodeName)
                  if (node) openFilesPanel(node)
                }}
                style={{ width: '100%' }}
                size="small"
              >
                {nodes.map(node => (
                  <Select.Option key={node.name} value={node.name}>
                    {node.name} - {node.host}
                  </Select.Option>
                ))}
              </Select>
            </div>

            {/* 路径导航 */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', background: '#fff' }}>
              <Space size={4}>
                <Button
                  type="text"
                  size="small"
                  icon={<ArrowLeftOutlined />}
                  onClick={goBack}
                  disabled={!currentPath || currentPath === '/'}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<HomeOutlined />}
                  onClick={() => changeDirectory(`/home/${user?.username || ''}`)}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => currentNode && loadFiles(currentNode, currentPath)}
                  loading={filesLoading}
                />
              </Space>
              <div style={{ fontSize: 11, color: '#666', marginTop: 4, wordBreak: 'break-all' }}>
                {currentPath || '/'}
              </div>
            </div>

            {/* 上传区域 */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', background: '#fff' }}>
              <Upload.Dragger {...uploadProps} style={{ padding: '12px 0' }}>
                <div style={{ fontSize: 11 }}>
                  <UploadOutlined style={{ marginRight: 4 }} />
                  拖拽文件到此处或点击上传
                </div>
              </Upload.Dragger>
            </div>

            {/* 文件列表 */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              <Table
                columns={fileColumns}
                dataSource={files}
                rowKey="path"
                loading={filesLoading}
                pagination={false}
                size="small"
                locale={{ emptyText: '目录为空' }}
              />
            </div>
          </div>
        )}
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
            <p style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>
              平台自动生成 RSA 4096 密钥对，私钥保存在服务端，需要手动部署公钥到登录节点。
            </p>
            <Button type="primary" loading={generatingKey} onClick={generateKey} block>
              🔐 生成密钥对
            </Button>
            {generatedPubKey && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>公钥内容：</div>
                <pre style={{ background: '#f5f5f5', padding: 10, borderRadius: 6, fontSize: 11, overflowX: 'auto', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{generatedPubKey}</pre>
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <Button size="small" onClick={() => { navigator.clipboard.writeText(generatedPubKey); Message.success('已复制') }}>
                    📋 复制公钥
                  </Button>
                  <Button type="primary" size="small" onClick={() => setDeployKeyOpen(true)}>
                    🚀 部署到节点
                  </Button>
                </div>
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

      {/* 部署公钥弹窗 */}
      <Modal
        title="🚀 部署公钥到登录节点"
        open={deployKeyOpen}
        onCancel={() => {
          setDeployKeyOpen(false)
          setDeployPassword('')
        }}
        {...modalProps}
        footer={[
          <Button key="cancel" onClick={() => {
            setDeployKeyOpen(false)
            setDeployPassword('')
          }}>
            取消
          </Button>,
          <Button key="deploy" type="primary" loading={deploying} onClick={deployPublicKey}>
            部署到所有节点
          </Button>
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>
            需要使用您的SSH密码登录到各个节点，将公钥部署到 <code>~/.ssh/authorized_keys</code>
          </p>
        </div>
        
        <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>将部署到以下节点：</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {nodes.map(node => (
              <div 
                key={node.name}
                style={{
                  padding: '4px 8px',
                  background: deployedNodes.includes(node.name) ? '#52c41a' : '#fff',
                  color: deployedNodes.includes(node.name) ? '#fff' : '#000',
                  border: '1px solid #d9d9d9',
                  borderRadius: 4,
                  fontSize: 12
                }}
              >
                {deployedNodes.includes(node.name) && '✓ '}
                {node.name}
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>SSH 登录密码</div>
          <Input.Password
            value={deployPassword}
            onChange={(e) => setDeployPassword(e.target.value)}
            placeholder="输入您的SSH密码"
            onPressEnter={deployPublicKey}
            autoFocus
          />
          <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>
            💡 密码仅用于一次性部署公钥，不会被保存
          </div>
        </div>
        
        {deployedNodes.length > 0 && (
          <div style={{ marginTop: 12, padding: 10, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6 }}>
            <div style={{ fontSize: 12, color: '#52c41a' }}>
              ✓ 已成功部署到 {deployedNodes.length} 个节点
            </div>
          </div>
        )}
      </Modal>

      {/* 上传进度面板 */}
      {uploadTasks.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          right: filesPanelOpen ? filesPanelWidth + 20 : 20,
          width: 420,
          maxHeight: 300,
          background: '#fff',
          border: '1px solid #d9d9d9',
          borderRadius: '8px 8px 0 0',
          boxShadow: '0 -2px 8px rgba(0,0,0,0.15)',
          transition: 'right 0.25s',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* 头部 */}
          <div style={{
            padding: '8px 12px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#fafafa',
            borderRadius: '8px 8px 0 0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UploadOutlined style={{ color: '#1890ff' }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                传输列表 ({uploadTasks.filter(t => t.status === 'uploading').length}/{uploadTasks.length})
              </span>
            </div>
            <Space size="small">
              {uploadTasks.some(t => t.status === 'completed') && (
                <Button
                  type="text"
                  size="small"
                  onClick={clearCompletedTasks}
                  style={{ fontSize: 11 }}
                >
                  清除已完成
                </Button>
              )}
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={() => setShowUploadPanel(false)}
              />
            </Space>
          </div>

          {/* 任务列表 */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 8
          }}>
            {uploadTasks.map(task => (
              <div
                key={task.id}
                style={{
                  padding: '10px 12px',
                  marginBottom: 8,
                  background: '#fafafa',
                  borderRadius: 6,
                  border: '1px solid #f0f0f0'
                }}
              >
                {/* 文件名和状态 */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6
                }}>
                  <div style={{
                    flex: 1,
                    fontSize: 12,
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginRight: 8
                  }}>
                    <FileTextOutlined style={{ marginRight: 4, color: '#1890ff' }} />
                    {task.fileName}
                  </div>
                  <div style={{ fontSize: 11 }}>
                    {task.status === 'uploading' && (
                      <span style={{ color: '#1890ff' }}>⏫ 上传中</span>
                    )}
                    {task.status === 'completed' && (
                      <span style={{ color: '#52c41a' }}>✓ 完成</span>
                    )}
                    {task.status === 'error' && (
                      <span style={{ color: '#ff4d4f' }}>✗ 失败</span>
                    )}
                    {task.status === 'paused' && (
                      <span style={{ color: '#faad14' }}>⏸ 暂停</span>
                    )}
                  </div>
                </div>

                {/* 进度条 */}
                <div style={{
                  width: '100%',
                  height: 4,
                  background: '#f0f0f0',
                  borderRadius: 2,
                  overflow: 'hidden',
                  marginBottom: 6
                }}>
                  <div style={{
                    width: `${task.progress}%`,
                    height: '100%',
                    background: task.status === 'error' ? '#ff4d4f' : 
                               task.status === 'completed' ? '#52c41a' : '#1890ff',
                    transition: 'width 0.3s'
                  }} />
                </div>

                {/* 传输信息 */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 11,
                  color: '#666'
                }}>
                  <div>
                    {formatFileSize(task.uploadedSize)} / {formatFileSize(task.fileSize)}
                    {task.status === 'uploading' && task.speed > 0 && (
                      <span style={{ marginLeft: 8, color: '#1890ff' }}>
                        {formatSpeed(task.speed)}
                      </span>
                    )}
                  </div>
                  <div>
                    {task.progress}%
                  </div>
                </div>

                {/* 错误信息 */}
                {task.error && (
                  <div style={{
                    marginTop: 6,
                    fontSize: 11,
                    color: '#ff4d4f',
                    background: '#fff2f0',
                    padding: '4px 8px',
                    borderRadius: 4
                  }}>
                    {task.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
