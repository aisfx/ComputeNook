import { useState, useEffect, useCallback } from 'react'
import {
  Card, Button, Space, Input, Tag, Modal, message as Message,
  Empty, Spin, List, Badge, Tooltip, Typography
} from 'antd'
import {
  ReloadOutlined, SearchOutlined, DatabaseOutlined, LockOutlined,
  UnlockOutlined, UserOutlined, GlobalOutlined, CopyOutlined,
  DeleteOutlined, QuestionCircleOutlined
} from '@ant-design/icons'
import axios from 'axios'
import { getUser } from '@/utils/auth'

const { Text } = Typography

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
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [harborUrl, setHarborUrl] = useState('')

  // 加载项目列表
  const loadProjects = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axios.get('/registry/projects')
      const projectList = res.data.data || []
      setProjects(projectList)
      
      // 默认选中第一个项目
      if (projectList.length > 0 && !selectedProject) {
        setSelectedProject(projectList[0])
      }
    } catch (e: any) {
      Message.error(e.response?.data?.error || '加载项目列表失败')
    } finally {
      setLoading(false)
    }
  }, [selectedProject])

  // 加载配置信息（获取Harbor URL）
  const loadHarborConfig = useCallback(async () => {
    try {
      const res = await axios.get('/registry/config')
      setHarborUrl(res.data.harbor_url || '')
    } catch (e: any) {
      console.error('加载Harbor配置失败:', e)
    }
  }, [])

  // 加载仓库列表
  const loadRepositories = useCallback(async (project: Project) => {
    if (!project) return
    
    setLoadingRepos(true)
    try {
      const res = await axios.get(`/registry/projects/${project.name}/repositories`)
      setRepositories(res.data.data || [])
    } catch (e: any) {
      Message.error(e.response?.data?.error || '加载仓库列表失败')
      setRepositories([])
    } finally {
      setLoadingRepos(false)
    }
  }, [])

  // 初始化
  useEffect(() => {
    loadProjects()
    loadHarborConfig()
  }, [loadProjects, loadHarborConfig])

  // 当选中项目变化时，加载仓库列表
  useEffect(() => {
    if (selectedProject) {
      loadRepositories(selectedProject)
    }
  }, [selectedProject, loadRepositories])

  // 格式化时间
  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '-'
    const date = new Date(timeStr)
    return date.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    })
  }

  // 复制镜像地址
  const copyImagePath = (repoName: string) => {
    // 移除项目前缀
    const cleanName = repoName.replace(`${selectedProject?.name}/`, '')
    const imagePath = harborUrl 
      ? `${harborUrl.replace(/^https?:\/\//, '')}/${selectedProject?.name}/${cleanName}`
      : `harbor.example.com/${selectedProject?.name}/${cleanName}`
    
    navigator.clipboard.writeText(imagePath).then(() => {
      Message.success('镜像地址已复制')
    }).catch(() => {
      Message.error('复制失败')
    })
  }

  // 显示使用说明
  const showUsageGuide = () => {
    Modal.info({
      title: '📖 使用说明',
      width: 600,
      content: (
        <div style={{ lineHeight: 1.8 }}>
          <h4>如何使用容器镜像：</h4>
          <ol>
            <li>点击仓库列表中的"📋 复制地址"按钮复制镜像地址</li>
            <li>在作业提交页面选择"容器作业"</li>
            <li>粘贴镜像地址到容器镜像输入框</li>
            <li>配置资源参数并提交作业</li>
          </ol>
          <h4>项目说明：</h4>
          <ul>
            <li><strong>library</strong>: 公共基础镜像库</li>
            <li><strong>用户名</strong>: 个人私有项目</li>
            <li><strong>其他</strong>: 团队共享项目</li>
          </ul>
        </div>
      ),
    })
  }

  // 过滤仓库
  const filteredRepos = repositories.filter(r => {
    if (!searchText.trim()) return true
    return r.name.toLowerCase().includes(searchText.toLowerCase())
  })

  return (
    <div style={{ 
      display: 'flex', 
      height: '100%', 
      gap: 0,
      overflow: 'hidden'
    }}>
      {/* 左侧项目列表 */}
      <div style={{ 
        width: 240, 
        borderRight: '1px solid #f0f0f0',
        display: 'flex',
        flexDirection: 'column',
        background: '#fafafa'
      }}>
        {/* 项目列表标题 */}
        <div style={{ 
          padding: '16px',
          borderBottom: '1px solid #f0f0f0',
          background: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Space>
            <DatabaseOutlined style={{ fontSize: 16 }} />
            <span style={{ fontWeight: 600 }}>项目</span>
          </Space>
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={loadProjects}
            loading={loading}
          />
        </div>

        {/* 项目列表 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin size="small" />
            </div>
          ) : (
            <List
              dataSource={projects}
              renderItem={(project) => (
                <List.Item
                  key={project.project_id}
                  onClick={() => setSelectedProject(project)}
                  style={{
                    cursor: 'pointer',
                    padding: '12px',
                    marginBottom: 4,
                    borderRadius: 6,
                    background: selectedProject?.project_id === project.project_id ? '#e6f7ff' : '#fff',
                    border: selectedProject?.project_id === project.project_id ? '1px solid #1890ff' : '1px solid #f0f0f0',
                    transition: 'all 0.2s'
                  }}
                >
                  <List.Item.Meta
                    avatar={
                      project.public ? 
                        <GlobalOutlined style={{ fontSize: 18, color: '#52c41a' }} /> : 
                        <UserOutlined style={{ fontSize: 18, color: '#1890ff' }} />
                    }
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 500 }}>{project.name}</span>
                      </div>
                    }
                    description={
                      <Space size={4}>
                        <Tag 
                          icon={project.public ? <UnlockOutlined /> : <LockOutlined />}
                          color={project.public ? 'success' : 'default'}
                          style={{ fontSize: 11 }}
                        >
                          {project.public ? '公开' : '私有'}
                        </Tag>
                        <Badge 
                          count={project.repo_count} 
                          showZero
                          style={{ backgroundColor: '#1890ff' }}
                        />
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </div>
      </div>

      {/* 右侧仓库列表 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        {/* 顶部工具栏 */}
        <div style={{ 
          padding: '16px 24px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Space>
            <DatabaseOutlined style={{ fontSize: 18, color: '#1890ff' }} />
            <span style={{ fontSize: 16, fontWeight: 600 }}>
              {selectedProject?.name || '请选择项目'}
            </span>
            {selectedProject && (
              <Tag color={selectedProject.public ? 'success' : 'default'}>
                {selectedProject.public ? '公开' : '私有'}
              </Tag>
            )}
          </Space>

          <Space>
            <Input
              placeholder="搜索镜像..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 220 }}
              allowClear
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => selectedProject && loadRepositories(selectedProject)}
              loading={loadingRepos}
            >
              刷新
            </Button>
            <Button
              icon={<QuestionCircleOutlined />}
              onClick={showUsageGuide}
            >
              使用说明
            </Button>
          </Space>
        </div>

        {/* 仓库列表 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
          {!selectedProject ? (
            <Empty
              description="请从左侧选择一个项目"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ marginTop: 80 }}
            />
          ) : loadingRepos ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <Spin tip="加载仓库列表中..." />
            </div>
          ) : filteredRepos.length === 0 ? (
            <Empty
              description={searchText ? '没有找到匹配的仓库' : '该项目下暂无仓库'}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ marginTop: 80 }}
            />
          ) : (
            <List
              dataSource={filteredRepos}
              renderItem={(repo) => {
                const cleanName = repo.name.replace(`${selectedProject?.name}/`, '')
                const imagePath = harborUrl 
                  ? `${harborUrl.replace(/^https?:\/\//, '')}/${selectedProject?.name}/${cleanName}`
                  : `${selectedProject?.name}/${cleanName}`

                return (
                  <Card
                    size="small"
                    key={repo.id}
                    style={{ marginBottom: 16 }}
                    bodyStyle={{ padding: 16 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <Space direction="vertical" size={8} style={{ width: '100%' }}>
                          {/* 仓库名称 */}
                          <Space>
                            <DatabaseOutlined style={{ fontSize: 18, color: '#52c41a' }} />
                            <Text strong style={{ fontSize: 15 }}>
                              {cleanName}
                            </Text>
                          </Space>

                          {/* 统计信息 */}
                          <Space size={16} style={{ fontSize: 12, color: '#666' }}>
                            <span>
                              <Text type="secondary">镜像数: </Text>
                              <Text strong>{repo.artifact_count}</Text>
                            </span>
                            <span>
                              <Text type="secondary">更新于: </Text>
                              <Text>{formatTime(repo.update_time)}</Text>
                            </span>
                          </Space>

                          {/* 镜像地址 */}
                          <div style={{
                            background: '#f5f5f5',
                            padding: '8px 12px',
                            borderRadius: 4,
                            fontFamily: 'monospace',
                            fontSize: 12,
                            color: '#1890ff'
                          }}>
                            {imagePath}
                          </div>
                        </Space>
                      </div>

                      {/* 操作按钮 */}
                      <Space direction="vertical" size={8} style={{ marginLeft: 16 }}>
                        <Button
                          size="small"
                          icon={<CopyOutlined />}
                          onClick={() => copyImagePath(repo.name)}
                        >
                          复制地址
                        </Button>
                        {/* 删除按钮暂时隐藏，需要管理员权限 */}
                        {/* <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                        >
                          删除
                        </Button> */}
                      </Space>
                    </div>
                  </Card>
                )
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
