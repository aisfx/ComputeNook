import { useState, useEffect, useCallback } from 'react'
import {
  Card, Button, Space, Input, Modal, Upload, message, Table, Tag, Breadcrumb, Tooltip, App
} from 'antd'
import type { TableColumnsType } from 'antd'
import {
  HomeOutlined, FolderOutlined, FileOutlined, UploadOutlined,
  DownloadOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  FolderAddOutlined, FileAddOutlined, ReloadOutlined, SearchOutlined,
  CodeOutlined, FileImageOutlined, FileZipOutlined, FilePdfOutlined,
  FileTextOutlined, PlayCircleOutlined, AudioOutlined, ArrowLeftOutlined
} from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import { getUser, getToken } from '@/utils/auth'
import { usePageTitle } from '@/hooks/usePageTitle'

const { TextArea } = Input

interface FileItem {
  name: string
  path: string
  is_dir: boolean
  size: number
  mod_time: string
  permissions: string
}

// 文件类型映射
const EXT_MAP: Record<string, string> = {
  py: 'code', js: 'code', ts: 'code', tsx: 'code', jsx: 'code', go: 'code',
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', svg: 'image',
  mp4: 'video', avi: 'video', mov: 'video',
  mp3: 'audio', wav: 'audio',
  zip: 'archive', tar: 'archive', gz: 'archive',
  pdf: 'pdf',
  txt: 'text', md: 'text', log: 'text',
}

function getFileType(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  return EXT_MAP[ext] || 'file'
}

// 文件图标组件
function FileIcon({ name, isDir }: { name: string; isDir: boolean }) {
  if (isDir) return <FolderOutlined style={{ color: '#faad14', fontSize: 18 }} />
  
  const type = getFileType(name)
  const iconStyle = { fontSize: 18 }
  
  const iconMap: Record<string, React.ReactNode> = {
    code: <CodeOutlined style={{ ...iconStyle, color: '#1890ff' }} />,
    image: <FileImageOutlined style={{ ...iconStyle, color: '#52c41a' }} />,
    video: <PlayCircleOutlined style={{ ...iconStyle, color: '#eb2f96' }} />,
    audio: <AudioOutlined style={{ ...iconStyle, color: '#722ed1' }} />,
    archive: <FileZipOutlined style={{ ...iconStyle, color: '#fa8c16' }} />,
    pdf: <FilePdfOutlined style={{ ...iconStyle, color: '#f5222d' }} />,
    text: <FileTextOutlined style={{ ...iconStyle, color: '#13c2c2' }} />,
  }
  
  return iconMap[type] || <FileOutlined style={{ ...iconStyle, color: '#8c8c8c' }} />
}

// 格式化文件大小
function formatSize(bytes: number): string {
  if (!bytes) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i]
}

// 格式化时间
function formatTime(time: string): string {
  if (!time) return '-'
  return dayjs(time).format('YYYY-MM-DD HH:mm')
}

export default function FileManager() {
  const user = getUser()
  const { modal } = App.useApp()
  usePageTitle('文件管理')
  
  const [loading, setLoading] = useState(false)
  const [currentPath, setCurrentPath] = useState('')
  const [files, setFiles] = useState<FileItem[]>([])
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [searchText, setSearchText] = useState('')
  
  // 文件查看/编辑
  const [viewOpen, setViewOpen] = useState(false)
  const [viewingFile, setViewingFile] = useState<FileItem | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // 初始化
  useEffect(() => {
    const homePath = (user as any)?.homeDir || `/home/${user?.username || ''}`
    setCurrentPath(homePath)
  }, [user])
  
  // 加载目录
  const loadDirectory = useCallback(async (path?: string) => {
    const targetPath = path ?? currentPath
    if (!targetPath) return
    
    setLoading(true)
    setSelectedRowKeys([])
    try {
      const res = await axios.get('/filemanager/list', { params: { path: targetPath } })
      setFiles(res.data.files || [])
      setCurrentPath(res.data.path || targetPath)
    } catch (e: any) {
      message.error(e.response?.data?.error || '读取目录失败')
      setFiles([])
    } finally {
      setLoading(false)
    }
  }, [currentPath])
  
  useEffect(() => {
    if (currentPath) loadDirectory()
  }, [currentPath, loadDirectory])
  
  // 面包屑导航
  const homePath = (user as any)?.homeDir || `/home/${user?.username || ''}`
  const pathParts = currentPath.split('/').filter(Boolean)
  
  const breadcrumbItems = [
    {
      title: <HomeOutlined />,
      onClick: () => setCurrentPath(homePath),
    },
    ...pathParts.map((part, index) => ({
      title: part,
      onClick: () => {
        const newPath = '/' + pathParts.slice(0, index + 1).join('/')
        setCurrentPath(newPath)
      },
    })),
  ]
  
  // 上一级目录
  const goBack = () => {
    const parts = currentPath.split('/').filter(Boolean)
    parts.pop()
    setCurrentPath('/' + parts.join('/') || '/')
  }
  
  const canGoBack = currentPath !== homePath && currentPath !== '/'
  
  // 排序文件列表
  const sortedFiles = [...files]
    .filter(file => 
      !searchText || file.name.toLowerCase().includes(searchText.toLowerCase())
    )
    .sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1
      return a.name.localeCompare(b.name, 'zh-CN')
    })
  
  // 打开目录
  const openDirectory = (file: FileItem) => {
    if (file.is_dir) {
      setCurrentPath(file.path)
    }
  }
  
  // 查看文件
  const viewFile = async (file: FileItem) => {
    if (file.is_dir) {
      openDirectory(file)
      return
    }
    
    try {
      const res = await axios.get('/filemanager/read', { params: { path: file.path } })
      setFileContent(res.data.content || '')
      setViewingFile(file)
      setViewOpen(true)
      setIsEditing(false)
    } catch (e: any) {
      message.error(e.response?.data?.error || '读取文件失败')
    }
  }
  
  // 保存文件
  const saveFile = async () => {
    if (!viewingFile) return
    
    setSaving(true)
    try {
      await axios.post('/filemanager/write', {
        path: viewingFile.path,
        content: fileContent,
      })
      message.success('保存成功')
      setIsEditing(false)
      loadDirectory()
    } catch (e: any) {
      message.error(e.response?.data?.error || '保存失败')
    } finally {
      setSaving(false)
    }
  }
  
  // 下载文件
  const downloadFile = (file: FileItem) => {
    const token = getToken() || ''
    const url = `/api/filemanager/download?path=${encodeURIComponent(file.path)}&token=${token}`
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
  
  // 删除文件
  const deleteFile = (file: FileItem) => {
    modal.confirm({
      title: '确认删除',
      content: `确定要删除 "${file.name}" 吗？此操作不可恢复！`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await axios.delete('/filemanager/delete', { params: { path: file.path } })
          message.success('删除成功')
          loadDirectory()
        } catch (e: any) {
          message.error(e.response?.data?.error || '删除失败')
        }
      },
    })
  }
  
  // 批量删除
  const batchDelete = () => {
    if (selectedRowKeys.length === 0) return
    
    modal.confirm({
      title: '批量删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 个文件吗？此操作不可恢复！`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        let successCount = 0
        for (const key of selectedRowKeys) {
          try {
            await axios.delete('/filemanager/delete', { params: { path: key } })
            successCount++
          } catch (e) {
            console.error('删除失败:', key)
          }
        }
        message.success(`成功删除 ${successCount} 个文件`)
        setSelectedRowKeys([])
        loadDirectory()
      },
    })
  }
  
  // 重命名
  const renameFile = (file: FileItem) => {
    let newName = file.name
    
    modal.confirm({
      title: '重命名',
      content: (
        <Input
          defaultValue={file.name}
          onChange={(e) => (newName = e.target.value)}
          onPressEnter={() => modal.destroyAll()}
        />
      ),
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        if (!newName || newName === file.name) return
        
        const parts = file.path.split('/')
        parts[parts.length - 1] = newName
        const newPath = parts.join('/')
        
        try {
          await axios.post('/filemanager/rename', {
            old_path: file.path,
            new_path: newPath,
          })
          message.success('重命名成功')
          loadDirectory()
        } catch (e: any) {
          message.error(e.response?.data?.error || '重命名失败')
        }
      },
    })
  }
  
  // 新建文件夹
  const createFolder = () => {
    let folderName = ''
    
    modal.confirm({
      title: '新建文件夹',
      content: (
        <Input
          placeholder="请输入文件夹名称"
          onChange={(e) => (folderName = e.target.value)}
          onPressEnter={() => modal.destroyAll()}
        />
      ),
      okText: '创建',
      cancelText: '取消',
      onOk: async () => {
        if (!folderName) {
          message.error('请输入文件夹名称')
          return Promise.reject()
        }
        
        try {
          await axios.post('/filemanager/mkdir', {
            path: `${currentPath}/${folderName}`,
          })
          message.success('创建成功')
          loadDirectory()
        } catch (e: any) {
          message.error(e.response?.data?.error || '创建失败')
          return Promise.reject()
        }
      },
    })
  }
  
  // 新建文件
  const createFile = () => {
    let fileName = ''
    
    modal.confirm({
      title: '新建文件',
      content: (
        <Input
          placeholder="请输入文件名称"
          onChange={(e) => (fileName = e.target.value)}
          onPressEnter={() => modal.destroyAll()}
        />
      ),
      okText: '创建',
      cancelText: '取消',
      onOk: async () => {
        if (!fileName) {
          message.error('请输入文件名称')
          return Promise.reject()
        }
        
        try {
          await axios.post('/filemanager/write', {
            path: `${currentPath}/${fileName}`,
            content: '',
          })
          message.success('创建成功')
          loadDirectory()
        } catch (e: any) {
          message.error(e.response?.data?.error || '创建失败')
          return Promise.reject()
        }
      },
    })
  }
  
  // 上传配置
  const uploadProps = {
    name: 'file',
    action: '/api/filemanager/upload',
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
    data: {
      path: currentPath,
    },
    showUploadList: false,
    onChange(info: any) {
      if (info.file.status === 'done') {
        message.success(`${info.file.name} 上传成功`)
        loadDirectory()
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} 上传失败`)
      }
    },
  }
  
  // 表格列定义
  const columns: TableColumnsType<FileItem> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space style={{ cursor: 'pointer' }} onClick={() => viewFile(record)}>
          <FileIcon name={name} isDir={record.is_dir} />
          <span style={{ fontWeight: record.is_dir ? 600 : 400 }}>{name}</span>
        </Space>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 120,
      render: (size, record) => record.is_dir ? '-' : formatSize(size),
    },
    {
      title: '修改时间',
      dataIndex: 'mod_time',
      key: 'mod_time',
      width: 180,
      render: (time) => formatTime(time),
    },
    {
      title: '权限',
      dataIndex: 'permissions',
      key: 'permissions',
      width: 120,
      render: (perm) => <code style={{ fontSize: 12, color: '#888' }}>{perm}</code>,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          {!record.is_dir && (
            <>
              <Tooltip title="查看">
                <Button
                  type="text"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => viewFile(record)}
                />
              </Tooltip>
              <Tooltip title="下载">
                <Button
                  type="text"
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() => downloadFile(record)}
                />
              </Tooltip>
            </>
          )}
          <Tooltip title="重命名">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => renameFile(record)}
            />
          </Tooltip>
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
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 头部卡片 */}
      <Card size="small">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          {/* 左侧：导航 */}
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={goBack}
              disabled={!canGoBack}
              title="返回上级"
            />
            <Button
              icon={<HomeOutlined />}
              onClick={() => setCurrentPath(homePath)}
              title="返回主目录"
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadDirectory()}
              loading={loading}
              title="刷新"
            />
          </Space>
          
          {/* 右侧：操作 */}
          <Space>
            <Input
              placeholder="搜索文件..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 200 }}
              allowClear
            />
            <Upload {...uploadProps}>
              <Button type="primary" icon={<UploadOutlined />}>
                上传文件
              </Button>
            </Upload>
            <Button icon={<FolderAddOutlined />} onClick={createFolder}>
              新建文件夹
            </Button>
            <Button icon={<FileAddOutlined />} onClick={createFile}>
              新建文件
            </Button>
          </Space>
        </div>
        
        {/* 面包屑导航 */}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
          <Breadcrumb
            items={breadcrumbItems.map((item) => ({
              ...item,
              className: 'breadcrumb-item',
            }))}
            style={{ fontSize: 13 }}
          />
        </div>
      </Card>
      
      {/* 批量操作栏 */}
      {selectedRowKeys.length > 0 && (
        <Card size="small" style={{ background: '#e6f7ff', borderColor: '#91d5ff' }}>
          <Space>
            <span style={{ fontWeight: 500 }}>已选择 {selectedRowKeys.length} 项</span>
            <Button danger size="small" icon={<DeleteOutlined />} onClick={batchDelete}>
              批量删除
            </Button>
            <Button size="small" onClick={() => setSelectedRowKeys([])}>
              取消选择
            </Button>
          </Space>
        </Card>
      )}
      
      {/* 文件列表 */}
      <Card size="small">
        <Table
          columns={columns}
          dataSource={sortedFiles}
          rowKey="path"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 项`,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          locale={{
            emptyText: searchText ? '未找到匹配的文件' : '此目录为空',
          }}
          size="small"
        />
      </Card>
      
      {/* 文件查看/编辑弹窗 */}
      <Modal
        title={
          <Space>
            {viewingFile && <FileIcon name={viewingFile.name} isDir={false} />}
            <span>{viewingFile?.name}</span>
            {isEditing && <Tag color="blue">编辑模式</Tag>}
          </Space>
        }
        open={viewOpen}
        onCancel={() => {
          setViewOpen(false)
          setViewingFile(null)
          setFileContent('')
          setIsEditing(false)
        }}
        width={900}
        footer={
          <Space>
            <Button onClick={() => setViewOpen(false)}>关闭</Button>
            {!isEditing && (
              <>
                <Button icon={<EditOutlined />} onClick={() => setIsEditing(true)}>
                  编辑
                </Button>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={() => viewingFile && downloadFile(viewingFile)}
                >
                  下载
                </Button>
              </>
            )}
            {isEditing && (
              <>
                <Button onClick={() => setIsEditing(false)}>取消编辑</Button>
                <Button type="primary" loading={saving} onClick={saveFile}>
                  保存
                </Button>
              </>
            )}
          </Space>
        }
      >
        {isEditing ? (
          <TextArea
            value={fileContent}
            onChange={(e) => setFileContent(e.target.value)}
            autoSize={{ minRows: 20, maxRows: 30 }}
            style={{ fontFamily: 'monospace', fontSize: 13 }}
          />
        ) : (
          <pre
            style={{
              background: '#f5f5f5',
              padding: 16,
              borderRadius: 6,
              maxHeight: 600,
              overflow: 'auto',
              fontSize: 13,
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            {fileContent || '(空文件)'}
          </pre>
        )}
      </Modal>
    </div>
  )
}
