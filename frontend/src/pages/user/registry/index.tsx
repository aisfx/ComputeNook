import { useState, useEffect, useCallback } from 'react'
import {
  Card, Table, Button, Space, Input, Tag, Modal, Form, message as Message,
  Tabs, Empty, Spin, Tooltip
} from 'antd'
import type { TableColumnsType } from 'antd'
import {
  ReloadOutlined, SearchOutlined, DatabaseOutlined, LockOutlined,
  UnlockOutlined, EyeOutlined, FolderOutlined
} from '@ant-design/icons'
import axios from 'axios'
import { getUser } from '@/utils/auth'

const { TabPane } = Tabs

interface Project {
  project_id: number
  name: string
  owner_name?: string
  public: boolean
  repo_count: number
  creation_time?: string
  update_time?: string
}

interface Repository {
  id: number
  name: string
  project_id: number
  description?: string
  pull_count: number
  artifact_count: number
  creation_time?: string
  update_time?: string
}

interface ImageTag {
  name: string
  push_time?: string
  pull_time?: string
  size?: number
}

export default function RegistryManagement() {
  const user = getUser()
  const [loading, setLoading] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [searchText, setSearchText] = useState('')
  const [activeTab, setActiveTab] = useState('project')
  
  // 仓库相关
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  
  // 镜像标签相关
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null)
  const [imageTags, setImageTags] = useState<ImageTag[]>([])
  const [loadingTags, setLoadingTags] = useState(false)
  const [tagsModalOpen, setTagsModalOpen] = useState(false)

  // 加载项目列表
  const loadProjects = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axios.get('/registry/projects')
      setProjects(res.data.data || [])
    } catch (e: any) {
      Message.error(e.response?.data?.error || '加载项目列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  // 加载仓库列表
  const loadRepositories = useCallback(async (project: Project) => {
    setLoadingRepos(true)
    try {
      const res = await axios.get(`/registry/projects/${project.name}/repositories`)
      setRepositories(res.data.data || [])
      setSelectedProject(project)
      setActiveTab('repository')
    } catch (e: any) {
      Message.error(e.response?.data?.error || '加载仓库列表失败')
    } finally {
      setLoadingRepos(false)
    }
  }, [])

  // 加载镜像标签
  const loadImageTags = useCallback(async (repo: Repository) => {
    setLoadingTags(true)
    setSelectedRepo(repo)
    setTagsModalOpen(true)
    try {
      const res = await axios.get(
        `/registry/projects/${selectedProject?.name}/repositories/${encodeURIComponent(repo.name)}/tags`
      )
      setImageTags(res.data.data || [])
    } catch (e: any) {
      Message.error(e.response?.data?.error || '加载标签列表失败')
    } finally {
      setLoadingTags(false)
    }
  }, [selectedProject])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // 格式化文件大小
  const formatSize = (bytes?: number) => {
    if (!bytes) return '-'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
  }

  // 格式化时间
  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '-'
    return new Date(timeStr).toLocaleString('zh-CN')
  }

  // 过滤项目
  const filteredProjects = projects.filter(p => {
    if (!searchText.trim()) return true
    return p.name.toLowerCase().includes(searchText.toLowerCase())
  })

  // 项目表格列定义
  const projectColumns: TableColumnsType<Project> = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Project) => (
        <Space>
          <FolderOutlined style={{ fontSize: 18, color: '#1890ff' }} />
          <span style={{ fontWeight: 500 }}>{name}</span>
        </Space>
      ),
    },
    {
      title: '可见性',
      dataIndex: 'public',
      key: 'public',
      width: 100,
      render: (isPublic: boolean) => (
        <Tag icon={isPublic ? <UnlockOutlined /> : <LockOutlined />} color={isPublic ? 'green' : 'default'}>
          {isPublic ? '公开' : '私有'}
        </Tag>
      ),
    },
    {
      title: '仓库数',
      dataIndex: 'repo_count',
      key: 'repo_count',
      width: 100,
      align: 'center',
    },
    {
      title: '创建时间',
      dataIndex: 'creation_time',
      key: 'creation_time',
      width: 180,
      render: formatTime,
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: any, record: Project) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => loadRepositories(record)}
          >
            查看仓库
          </Button>
        </Space>
      ),
    },
  ]

  // 仓库表格列定义
  const repoColumns: TableColumnsType<Repository> = [
    {
      title: '仓库名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Space>
          <DatabaseOutlined style={{ fontSize: 16, color: '#52c41a' }} />
          <span>{name.replace(`${selectedProject?.name}/`, '')}</span>
        </Space>
      ),
    },
    {
      title: '镜像数',
      dataIndex: 'artifact_count',
      key: 'artifact_count',
      width: 100,
      align: 'center',
    },
    {
      title: '拉取次数',
      dataIndex: 'pull_count',
      key: 'pull_count',
      width: 100,
      align: 'center',
    },
    {
      title: '最后更新',
      dataIndex: 'update_time',
      key: 'update_time',
      width: 180,
      render: formatTime,
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: any, record: Repository) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => loadImageTags(record)}
          >
            查看标签
          </Button>
        </Space>
      ),
    },
  ]

  // 标签表格列定义
  const tagColumns: TableColumnsType<ImageTag> = [
    {
      title: '标签名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <code style={{ fontSize: 12 }}>{name}</code>,
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 120,
      render: formatSize,
    },
    {
      title: '推送时间',
      dataIndex: 'push_time',
      key: 'push_time',
      width: 180,
      render: formatTime,
    },
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 页面标题栏 */}
      <Card
        size="small"
        style={{ marginBottom: 16 }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <DatabaseOutlined style={{ fontSize: 20, color: '#1890ff' }} />
            <span style={{ fontSize: 16, fontWeight: 600 }}>
              {activeTab === 'project' ? '镜像仓库' : `${selectedProject?.name} / 仓库列表`}
            </span>
          </Space>
          <Space>
            {activeTab === 'repository' && (
              <Button
                onClick={() => {
                  setActiveTab('project')
                  setSelectedProject(null)
                  setRepositories([])
                }}
              >
                返回项目列表
              </Button>
            )}
            <Input
              placeholder={activeTab === 'project' ? '搜索项目...' : '搜索仓库...'}
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 250 }}
              allowClear
            />
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={activeTab === 'project' ? loadProjects : () => selectedProject && loadRepositories(selectedProject)}
              loading={loading || loadingRepos}
            >
              刷新
            </Button>
          </Space>
        </div>
      </Card>

      {/* 主内容区 */}
      <Card
        style={{ flex: 1 }}
        bodyStyle={{ padding: 0, height: '100%' }}
      >
        {activeTab === 'project' ? (
          <Table
            columns={projectColumns}
            dataSource={filteredProjects}
            rowKey="project_id"
            loading={loading}
            pagination={{
              total: filteredProjects.length,
              pageSize: 15,
              showTotal: (total) => `共 ${total} 个项目`,
              showSizeChanger: false,
            }}
            locale={{
              emptyText: (
                <Empty
                  description="暂无项目"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ),
            }}
          />
        ) : (
          <Table
            columns={repoColumns}
            dataSource={repositories.filter(r => {
              if (!searchText.trim()) return true
              return r.name.toLowerCase().includes(searchText.toLowerCase())
            })}
            rowKey="id"
            loading={loadingRepos}
            pagination={{
              total: repositories.length,
              pageSize: 15,
              showTotal: (total) => `共 ${total} 个仓库`,
              showSizeChanger: false,
            }}
            locale={{
              emptyText: (
                <Empty
                  description="暂无仓库"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ),
            }}
          />
        )}
      </Card>

      {/* 镜像标签弹窗 */}
      <Modal
        title={
          <Space>
            <DatabaseOutlined />
            <span>{selectedRepo?.name} - 标签列表</span>
          </Space>
        }
        open={tagsModalOpen}
        onCancel={() => {
          setTagsModalOpen(false)
          setSelectedRepo(null)
          setImageTags([])
        }}
        width={800}
        footer={
          <Button onClick={() => {
            setTagsModalOpen(false)
            setSelectedRepo(null)
            setImageTags([])
          }}>
            关闭
          </Button>
        }
      >
        {loadingTags ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin tip="加载标签列表中..." />
          </div>
        ) : (
          <Table
            columns={tagColumns}
            dataSource={imageTags}
            rowKey="name"
            pagination={{
              pageSize: 10,
              showTotal: (total) => `共 ${total} 个标签`,
            }}
            size="small"
            locale={{
              emptyText: (
                <Empty
                  description="暂无标签"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ),
            }}
          />
        )}
      </Modal>
    </div>
  )
}
