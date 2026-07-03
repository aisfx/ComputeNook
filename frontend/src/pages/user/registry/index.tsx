import { useState, useEffect, useCallback } from 'react'
import {
  Card, Button, Space, Input, Tag, Modal, message as Message,
  Empty, Spin, List, Tooltip, Typography
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
  tags?: ImageTag[] // 添加tags字段
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

  // 加载仓库列表（包含tags）
  const loadRepositories = useCallback(async (project: Project) => {
    if (!project) return
    
    setLoadingRepos(true)
    try {
      console.log(`=== 加载项目 [${project.name}] 的仓库和标签 ===`)
      
      // 1. 获取仓库列表
      const res = await axios.get(`/registry/projects/${project.name}/repositories`)
      const repos = res.data.data || []
      console.log(`  → 找到 ${repos.length} 个仓库`)
      
      // 2. 为每个仓库加载tags
      const reposWithTags = await Promise.all(
        repos.map(async (repo: Repository) => {
          const cleanRepoName = repo.name.replace(`${project.name}/`, '')
          
          try {
            console.log(`  → 加载仓库 [${cleanRepoName}] 的标签...`)
            
            // 使用cleanRepoName而不是repo.name，因为API路径已经包含了项目名
            const tagsRes = await axios.get(
              `/registry/projects/${project.name}/repositories/${encodeURIComponent(cleanRepoName)}/tags`
            )
            
            const artifacts = tagsRes.data.data || []
            console.log(`    → 返回 ${artifacts.length} 个artifact`)
            
            // Harbor V2 API返回的是artifacts数组，每个artifact包含tags数组
            let allTags: ImageTag[] = []
            for (const artifact of artifacts) {
              if (artifact.tags && Array.isArray(artifact.tags)) {
                allTags = allTags.concat(artifact.tags)
              }
            }
            
            console.log(`    ✓ 找到 ${allTags.length} 个标签`)
            
            return {
              ...repo,
              tags: allTags
            }
          } catch (e: any) {
            console.error(`    ❌ 加载仓库 [${cleanRepoName}] 的标签失败:`, e.response?.data || e.message)
            return {
              ...repo,
              tags: []
            }
          }
        })
      )
      
      console.log('=== 仓库和标签加载完成 ===')
      setRepositories(reposWithTags)
    } catch (e: any) {
      console.error('❌ 加载仓库列表失败:', e)
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
    
    // 优先使用 Clipboard API，降级到 document.execCommand
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(imagePath).then(() => {
        Message.success('镜像地址已复制')
      }).catch(() => {
        // Clipboard API失败，尝试降级方案
        fallbackCopyTextToClipboard(imagePath)
      })
    } else {
      // 浏览器不支持 Clipboard API，使用降级方案
      fallbackCopyTextToClipboard(imagePath)
    }
  }

  // 降级复制方案（兼容HTTP环境）
  const fallbackCopyTextToClipboard = (text: string) => {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.top = '-9999px'
    textArea.style.left = '-9999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    
    try {
      const successful = document.execCommand('copy')
      if (successful) {
        Message.success('镜像地址已复制')
      } else {
        Message.error('复制失败，请手动复制')
      }
    } catch (err) {
      Message.error('复制失败，请手动复制')
    }
    
    document.body.removeChild(textArea)
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
                <Card
                  key={project.project_id}
                  onClick={() => setSelectedProject(project)}
                  size="small"
                  style={{
                    cursor: 'pointer',
                    marginBottom: 8,
                    background: selectedProject?.project_id === project.project_id ? '#e6f7ff' : '#fff',
                    borderColor: selectedProject?.project_id === project.project_id ? '#1890ff' : '#f0f0f0',
                    transition: 'all 0.2s'
                  }}
                  bodyStyle={{ padding: 12 }}
                  hoverable
                >
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    {/* 项目名称 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {project.public ? 
                        <GlobalOutlined style={{ fontSize: 16, color: '#52c41a' }} /> : 
                        <UserOutlined style={{ fontSize: 16, color: '#1890ff' }} />
                      }
                      <Text strong style={{ fontSize: 13, flex: 1 }}>
                        {project.name}
                      </Text>
                    </div>
                    
                    {/* 标签和统计 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Tag 
                        icon={project.public ? <UnlockOutlined /> : <LockOutlined />}
                        color={project.public ? 'success' : 'default'}
                        style={{ fontSize: 11, margin: 0 }}
                      >
                        {project.public ? '公开' : '私有'}
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {project.repo_count} 仓库
                      </Text>
                    </div>
                  </Space>
                </Card>
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
          <Space size={12}>
            <DatabaseOutlined style={{ fontSize: 20, color: '#faad14' }} />
            <span style={{ fontSize: 18, fontWeight: 600 }}>
              {selectedProject?.name || '请选择项目'}
            </span>
            {selectedProject && (
              <Tag color="blue" style={{ fontSize: 13 }}>
                可读写
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
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
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
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
              gap: '20px',
              alignItems: 'start'
            }}>
              {filteredRepos.map((repo) => {
                const cleanName = repo.name.replace(`${selectedProject?.name}/`, '')
                const imagePath = harborUrl 
                  ? `${harborUrl.replace(/^https?:\/\//, '')}/${selectedProject?.name}/${cleanName}`
                  : `${selectedProject?.name}/${cleanName}`

                return (
                  <Card
                    key={repo.id}
                    style={{ 
                      borderRadius: 12,
                      border: '1px solid #e8e8e8',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      height: 'fit-content'
                    }}
                    bodyStyle={{ padding: 20 }}
                  >
                    <Space direction="vertical" size={14} style={{ width: '100%' }}>
                      {/* 仓库名称和图标 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 48,
                          height: 48,
                          background: 'linear-gradient(135deg, #0db7ed 0%, #0a8ec7 100%)',
                          borderRadius: 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          fontSize: 24
                        }}>
                          🐳
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text strong style={{ fontSize: 16, display: 'block' }}>
                            {cleanName}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {repo.tags?.length || 0} 个版本 · 更新于 {formatTime(repo.update_time)}
                          </Text>
                        </div>
                      </div>

                      {/* Tag列表 */}
                      {repo.tags && repo.tags.length > 0 && (
                        <div style={{
                          padding: '10px',
                          background: '#fafafa',
                          borderRadius: 6,
                          border: '1px solid #e8e8e8',
                          maxHeight: '120px',
                          overflowY: 'auto'
                        }}>
                          <Space size={[6, 8]} wrap>
                            {repo.tags.map((tag, index) => (
                              <Tag 
                                key={index}
                                style={{
                                  margin: 0,
                                  padding: '4px 10px',
                                  fontSize: 12,
                                  fontFamily: 'monospace',
                                  background: '#fff',
                                  border: '1px solid #d9d9d9',
                                  borderRadius: 4,
                                  color: '#555'
                                }}
                              >
                                {tag.name}
                              </Tag>
                            ))}
                          </Space>
                        </div>
                      )}

                      {/* 操作按钮 */}
                      <Space size={8} style={{ width: '100%' }}>
                        <Button
                          size="small"
                          icon={<CopyOutlined />}
                          onClick={() => copyImagePath(repo.name)}
                          style={{ flex: 1, borderRadius: 6 }}
                        >
                          复制地址
                        </Button>
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          disabled
                          title="需要管理员权限"
                          style={{ borderRadius: 6 }}
                        >
                          删除
                        </Button>
                      </Space>
                    </Space>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
