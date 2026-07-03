import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Card, Table, Button, Space, Input, Select, Tag, Modal, Form, Row, Col,
  Statistic, Checkbox, message as Message, App, Empty, Typography, Spin
} from 'antd'
import type { TableColumnsType } from 'antd'
import {
  PlusOutlined, ReloadOutlined, SearchOutlined, PlayCircleOutlined,
  PauseCircleOutlined, StopOutlined, FolderOutlined, EyeOutlined,
  ExportOutlined, SettingOutlined, CheckCircleOutlined, CloseCircleOutlined,
  HourglassOutlined, SyncOutlined, DatabaseOutlined
} from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import { getUser, isAdmin } from '@/utils/auth'
import { useNavigate, useLocation } from 'react-router-dom'

const { TextArea } = Input
const { Text } = Typography

interface Job {
  id: string | number
  user: string
  name: string
  status: string
  partition: string
  nodes: number
  cpus: number
  jobType: string
  submitTime: string
  startTime: string
  runTime: string
  directory: string
  account: string
  timeLimit: number
  nodeNames: string[]
}

interface JobStats {
  running: number
  pending: number
  queued: number
  completed: number
  failed: number
  userHeld: number
  sysHeld: number
}

interface Template {
  id: string
  name: string
  icon: string
  category?: string
  appType?: string
  jobType?: string
  description?: string
  nodes: number
  cpus: number
  gpus?: number
  memory: number  // 改为number类型（MB）
  time: number    // 改为number类型（分钟）
  partition: string
  moduleLoad?: string
  executable?: string
  inputFile?: string
  containerImage?: string
  appParams?: Record<string, string>
  owner?: string
  isPublic?: boolean
  showInQuick?: boolean
  script?: string  // 如果后端返回了script字段
}

function formatTime(ts: number): string {
  if (!ts || ts === 0) return '-'
  return dayjs(ts * 1000).format('YYYY-MM-DD HH:mm')
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '-'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}天${h}时${m}分`
  if (h > 0) return `${h}时${m}分`
  if (m > 0) return `${m}分`
  return `${seconds}秒`
}

function expandHostList(hostlist: string): string[] {
  const result: string[] = []
  const parts: string[] = []
  let depth = 0, cur = ''
  for (const ch of hostlist) {
    if (ch === '[') { depth++; cur += ch }
    else if (ch === ']') { depth--; cur += ch }
    else if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = '' }
    else { cur += ch }
  }
  if (cur.trim()) parts.push(cur.trim())
  for (const part of parts) {
    const m = part.match(/^(.*?)\[([^\]]+)\](.*)$/)
    if (!m) { if (part) result.push(part); continue }
    const [, prefix, ranges, suffix] = m
    for (const seg of ranges.split(',')) {
      const range = seg.trim()
      const dash = range.match(/^(\d+)-(\d+)$/)
      if (dash) {
        const from = parseInt(dash[1]), to = parseInt(dash[2])
        const pad = dash[1].length > 1 ? dash[1].length : 0
        for (let i = from; i <= to; i++)
          result.push(prefix + (pad ? String(i).padStart(pad, '0') : i) + suffix)
      } else { result.push(prefix + range + suffix) }
    }
  }
  return result
}

export default function JobManagement() {
  const navigate = useNavigate()
  const location = useLocation()
  const { modal } = App.useApp()
  const user = getUser()
  const admin = isAdmin()
  
  // 状态
  const [loading, setLoading] = useState(false)
  const [jobs, setJobs] = useState<Job[]>([])
  const [stats, setStats] = useState<JobStats>({
    running: 0, pending: 0, queued: 0, completed: 0,
    failed: 0, userHeld: 0, sysHeld: 0
  })
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [viewMode, setViewMode] = useState<'my' | 'all'>(admin ? 'my' : 'my')
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [partitionFilter, setPartitionFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [partitions, setPartitions] = useState<string[]>([])
  
  // 分页
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 15,
    total: 0
  })
  
  // 提交作业抽屉
  const [submitOpen, setSubmitOpen] = useState(false)
  const [submitTab, setSubmitTab] = useState<'manual' | 'template'>('manual')
  const [jobMode, setJobMode] = useState<'normal' | 'container'>('normal') // 作业模式
  
  // 当前表单资源统计
  const [currentResources, setCurrentResources] = useState({
    nodes: 0,
    cpus: 0,
    gpus: 0,
    memory: 0
  })
  const [templateJobType, setTemplateJobType] = useState<'normal' | 'container'>('normal') // 模板管理中的作业类型
  const [submitForm] = Form.useForm()
  
  // 新建模板
  const [createTemplateOpen, setCreateTemplateOpen] = useState(false)
  const [createTemplateForm] = Form.useForm()
  const [templates, setTemplates] = useState<Template[]>([])
  
  // 查看/编辑模板
  const [viewTemplateOpen, setViewTemplateOpen] = useState(false)
  const [editTemplateOpen, setEditTemplateOpen] = useState(false)
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null)
  const [editTemplateForm] = Form.useForm()
  
  // Harbor镜像相关
  const [harborProjects, setHarborProjects] = useState<any[]>([])
  const [harborRepositories, setHarborRepositories] = useState<any[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [selectedRepo, setSelectedRepo] = useState<string>('')
  const [imageTags, setImageTags] = useState<string[]>([])
  const [loadingImages, setLoadingImages] = useState(false)
  
  // 镜像选择Modal
  const [imageSelectModalOpen, setImageSelectModalOpen] = useState(false)
  const [imageSearchText, setImageSearchText] = useState('')
  const [availableImages, setAvailableImages] = useState<any[]>([])
  const [loadingAvailableImages, setLoadingAvailableImages] = useState(false)
  
  // 作业详情
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  
  // 作业日志
  const [jobLogOpen, setJobLogOpen] = useState(false)
  const [jobLogLoading, setJobLogLoading] = useState(false)
  const [jobLogContent, setJobLogContent] = useState<{stdout: string, stderr: string}>({stdout: '', stderr: ''})
  const [logType, setLogType] = useState<'stdout' | 'stderr'>('stdout')
  
  // 从URL参数获取初始状态筛选
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const state = params.get('state')
    if (state) setStatusFilter(state)
  }, [location])
  
  // 加载作业列表
  const loadJobs = useCallback(async () => {
    if (!user?.username) return // 没有用户信息时不加载
    
    setLoading(true)
    try {
      let url = `/jobs?page=${pagination.current}&page_size=${pagination.pageSize}`
      if (viewMode === 'my') url += `&user=${encodeURIComponent(user.username)}`
      else if (viewMode === 'all' && userFilter.trim()) url += `&user=${encodeURIComponent(userFilter.trim())}`
      
      const res = await axios.get(url)
      const data = res.data.data || []
      
      const jobList = data.map((job: any) => {
        let runTime = 0
        if (job.end_time && job.start_time && job.end_time > 0 && job.start_time > 0) {
          runTime = job.end_time - job.start_time
        } else if (job.start_time && job.start_time > 0) {
          runTime = Math.floor(Date.now() / 1000) - job.start_time
        }
        
        let nodeNames: string[] = []
        if (typeof job.nodes === 'string' && job.nodes && job.nodes !== 'None assigned') {
          nodeNames = expandHostList(job.nodes)
        }
        if (nodeNames.length === 0 && job.batch_host) nodeNames = [job.batch_host]
        
        return {
          id: job.job_id || job.id,
          user: job.user_name || job.user,
          name: job.name || `Job ${job.job_id || job.id}`,
          status: job.job_state || job.status || 'UNKNOWN',
          partition: job.partition || '-',
          nodes: nodeNames.length || (typeof job.nodes === 'number' ? job.nodes : 0),
          nodeNames,
          cpus: job.cpus || 0,
          jobType: job.job_type || 'batch',
          submitTime: formatTime(job.submit_time),
          startTime: formatTime(job.start_time),
          runTime: formatDuration(runTime),
          directory: job.work_dir || job.directory || '-',
          account: job.account || '-',
          timeLimit: job.time_limit || 0
        }
      })
      
      setJobs(jobList)
      
      // 更新分页
      if (res.data.pagination) {
        setPagination(prev => ({
          ...prev,
          current: res.data.pagination.page,
          total: res.data.pagination.total
        }))
      }
      
      // 更新统计
      const currentJobs = viewMode === 'my'
        ? jobList.filter((j: Job) => j.user === user?.username)
        : jobList
      
      setStats({
        running: currentJobs.filter((j: Job) => j.status === 'RUNNING').length,
        pending: currentJobs.filter((j: Job) => j.status === 'PENDING').length,
        queued: currentJobs.filter((j: Job) => j.status === 'PENDING').length,
        completed: currentJobs.filter((j: Job) => j.status === 'COMPLETED').length,
        failed: currentJobs.filter((j: Job) => j.status === 'FAILED').length,
        userHeld: currentJobs.filter((j: Job) => j.status === 'SUSPENDED').length,
        sysHeld: 0
      })
    } catch (e: any) {
      Message.error(e.response?.data?.error || '加载作业列表失败')
    } finally {
      setLoading(false)
    }
  }, [pagination.current, pagination.pageSize, viewMode, userFilter, user])
  
  useEffect(() => {
    if (user?.username) {
      loadJobs()
    }
  }, [user?.username]) // 只在用户信息变化时加载，不依赖loadJobs
  
  // 加载分区列表
  const loadPartitions = useCallback(async () => {
    try {
      const res = await axios.get('/partitions')
      setPartitions((res.data.data || []).map((p: any) => p.name).filter(Boolean))
    } catch (e) {
      setPartitions(['compute', 'gpu', 'memory', 'debug'])
    }
  }, [])
  
  // 加载模板
  const loadTemplates = useCallback(async () => {
    try {
      const res = await axios.get('/app-templates')
      setTemplates((res.data.data || []).filter((t: any) => t.showInQuick))
    } catch (e) {
      console.error('加载模板失败:', e)
    }
  }, [])
  
  // 加载Harbor项目列表
  const loadHarborProjects = useCallback(async () => {
    try {
      const res = await axios.get('/registry/projects')
      setHarborProjects(res.data.data || [])
    } catch (e) {
      console.error('加载Harbor项目失败:', e)
    }
  }, [])
  
  // 加载项目的仓库列表
  const loadRepositories = useCallback(async (project: string) => {
    if (!project) return
    setLoadingImages(true)
    try {
      const res = await axios.get(`/registry/projects/${project}/repositories`)
      setHarborRepositories(res.data.data || [])
    } catch (e) {
      Message.error('加载仓库列表失败')
    } finally {
      setLoadingImages(false)
    }
  }, [])
  
  // 加载镜像标签
  const loadImageTags = useCallback(async (project: string, repo: string) => {
    if (!project || !repo) return
    setLoadingImages(true)
    try {
      const res = await axios.get(`/registry/projects/${project}/repositories/${encodeURIComponent(repo)}/tags`)
      const tags = (res.data.data || []).map((t: any) => t.name)
      setImageTags(tags)
    } catch (e) {
      Message.error('加载标签失败')
    } finally {
      setLoadingImages(false)
    }
  }, [])
  
  
  // 加载所有可用镜像（用于镜像选择Modal）
  const loadAvailableImages = useCallback(async () => {
    setLoadingAvailableImages(true)
    try {
      // 获取Harbor配置
      const configRes = await axios.get('/registry/config')
      const harborUrl = configRes.data.harbor_url || 'harbor.example.com'
      const harborHost = harborUrl.replace(/^https?:\/\//, '')
      
      // 获取所有项目
      const projectsRes = await axios.get('/registry/projects')
      const projects = projectsRes.data.data || []
      
      // 获取所有项目的镜像（包括公共项目和个人项目）
      const allImages: any[] = []
      for (const project of projects) {
        try {
          const reposRes = await axios.get(`/registry/projects/${project.name}/repositories`)
          const repos = reposRes.data.data || []
          
          for (const repo of repos) {
            const cleanRepoName = repo.name.replace(`${project.name}/`, '')
            
            // 获取该仓库的标签
            try {
              const tagsRes = await axios.get(`/registry/projects/${project.name}/repositories/${encodeURIComponent(repo.name)}/tags`)
              const tags = tagsRes.data.data || []
              
              // 为每个标签创建一个镜像条目
              for (const tag of tags) {
                allImages.push({
                  projectName: project.name,
                  repoName: cleanRepoName,
                  tag: tag.name,
                  fullName: `${project.name}/${cleanRepoName}:${tag.name}`,
                  displayName: `${project.name}/${cleanRepoName}:${tag.name}`,
                  imagePath: `${harborHost}/${project.name}/${cleanRepoName}:${tag.name}`,
                  isPublic: project.public,
                  updateTime: tag.push_time
                })
              }
            } catch (e) {
              console.error(`加载仓库${repo.name}的标签失败:`, e)
            }
          }
        } catch (e) {
          console.error(`加载项目${project.name}的仓库失败:`, e)
        }
      }
      
      // 按更新时间倒序排列
      allImages.sort((a, b) => {
        const timeA = a.updateTime ? new Date(a.updateTime).getTime() : 0
        const timeB = b.updateTime ? new Date(b.updateTime).getTime() : 0
        return timeB - timeA
      })
      
      setAvailableImages(allImages)
    } catch (e: any) {
      console.error('加载镜像列表失败:', e)
      Message.error('加载镜像列表失败')
    } finally {
      setLoadingAvailableImages(false)
    }
  }, [])
  
  // 根据表单参数自动生成/更新脚本内容
  const updateScriptFromForm = useCallback(() => {
    const values = submitForm.getFieldsValue()
    const name = values.name || 'my_job'
    const partition = values.partition || 'compute'
    const nodes = values.nodes || 1
    const cpus = values.cpus || 8
    const memory = values.memory || 0
    const timeHours = values.time_hours || 0
    const gpus = values.gpus || 0
    const qos = values.qos || ''
    
    let script = '#!/bin/bash\n'
    script += `#SBATCH -J ${name}\n`
    script += `#SBATCH -p ${partition}\n`
    script += `#SBATCH -N ${nodes}\n`
    script += `#SBATCH -n ${cpus}\n`  // 改为 -n（任务数）
    
    if (memory > 0) {
      script += `#SBATCH --mem=${memory}G\n`
    }
    
    if (timeHours > 0) {
      const hours = Math.floor(timeHours)
      const mins = Math.round((timeHours - hours) * 60)
      script += `#SBATCH -t ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00\n`
    }
    
    if (gpus > 0) {
      script += `#SBATCH --gres=gpu:${gpus}\n`
    }
    
    if (qos) {
      script += `#SBATCH --qos=${qos}\n`
    }
    
    script += '\n'
    script += 'echo "Job started: $(date)"\n'
    script += 'echo "Running on node: $(hostname)"\n'
    script += '\n'
    script += '# 在此处添加你的命令\n'
    script += 'srun ./my-program\n'
    script += '\n'
    script += 'echo "Job finished: $(date)"\n'
    
    submitForm.setFieldsValue({ script })
  }, [submitForm])
  
  useEffect(() => {
    loadPartitions()
    loadTemplates()
    loadHarborProjects()
  }, [loadPartitions, loadTemplates, loadHarborProjects])
  
  // 初始化作业提交表单的脚本内容和工作目录
  useEffect(() => {
    if (submitOpen) {
      const user = getUser()
      
      if (user?.username) {
        // 设置默认工作目录
        const currentWorkdir = submitForm.getFieldValue('workdir')
        if (!currentWorkdir) {
          submitForm.setFieldsValue({ 
            workdir: `/fs/home/${user.username}`
          })
        }
        
        // 容器作业需要初始化挂载目录
        if (jobMode === 'container') {
          const currentMountDir = submitForm.getFieldValue('mountDir')
          if (!currentMountDir) {
            submitForm.setFieldsValue({
              mountDir: `/fs/home/${user.username}:/fs/home/${user.username}`
            })
          }
        }
      }
      
      // 只有普通作业需要初始化脚本
      if (jobMode === 'normal') {
        // 延迟执行，确保表单已初始化
        setTimeout(() => {
          const currentScript = submitForm.getFieldValue('script')
          // 只在脚本为空时初始化
          if (!currentScript) {
            updateScriptFromForm()
          }
        }, 100)
      }
    }
  }, [submitOpen, jobMode, submitForm, updateScriptFromForm])
  
  // 继续下一部分...

  // 取消作业
  const cancelJob = useCallback(async (job: Job) => {
    modal.confirm({
      title: '取消作业',
      content: `确定要取消作业 ${job.id} - ${job.name} 吗？`,
      okText: '确定',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await axios.delete(`/jobs/${job.id}`)
          Message.success('作业已取消')
          loadJobs()
        } catch (e: any) {
          Message.error(e.response?.data?.error || '取消作业失败')
        }
      }
    })
  }, [modal, loadJobs])
  
  // 批量操作
  const batchAction = useCallback(async (action: string) => {
    if (selectedRowKeys.length === 0) {
      Message.warning('请先选择作业')
      return
    }
    
    const labels: Record<string, string> = {
      restart: '重启',
      suspend: '挂起',
      resume: '恢复',
      cancel: '停止'
    }
    
    modal.confirm({
      title: '批量操作',
      content: `确定要${labels[action]}选中的 ${selectedRowKeys.length} 个作业吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        Message.success(`已发送${labels[action]}指令`)
        setSelectedRowKeys([])
        // TODO: 实际的批量操作API调用
      }
    })
  }, [selectedRowKeys, modal])
  
  // 提交作业
  const handleSubmit = useCallback(async (values: any) => {
    try {
      await axios.post('/jobs', values)
      Message.success('作业提交成功')
      setSubmitOpen(false)
      submitForm.resetFields()
      loadJobs()
    } catch (e: any) {
      Message.error(e.response?.data?.error || '作业提交失败')
    }
  }, [submitForm, loadJobs])
  
  // 创建模板
  const handleCreateTemplate = async (values: any) => {
    try {
      await axios.post('/app-templates', {
        ...values,
        jobType: templateJobType,
        owner: user?.username,
        isPublic: false
      })
      Message.success('模板创建成功')
      setCreateTemplateOpen(false)
      createTemplateForm.resetFields()
      loadTemplates()
    } catch (e: any) {
      Message.error(e.response?.data?.error || '创建模板失败')
    }
  }
  
  // 查看模板详情
  const handleViewTemplate = useCallback(async (tpl: Template) => {
    try {
      // 如果需要从后端获取完整信息
      const res = await axios.get(`/app-templates/${tpl.id}`)
      setCurrentTemplate(res.data.data || tpl)
      setViewTemplateOpen(true)
    } catch (e: any) {
      // 如果API失败，直接使用现有数据
      setCurrentTemplate(tpl)
      setViewTemplateOpen(true)
    }
  }, [])
  
  // 编辑模板
  const handleEditTemplate = useCallback(async (tpl: Template) => {
    try {
      // 如果需要从后端获取完整信息
      const res = await axios.get(`/app-templates/${tpl.id}`)
      const templateData = res.data.data || tpl
      setCurrentTemplate(templateData)
      
      // 填充编辑表单
      editTemplateForm.setFieldsValue({
        name: templateData.name,
        appType: templateData.appType,
        jobType: templateData.jobType || 'normal',
        icon: templateData.icon,
        category: templateData.category || 'general',
        description: templateData.description,
        partition: templateData.partition,
        nodes: templateData.nodes,
        cpus: templateData.cpus,
        gpus: templateData.gpus || 0,
        memory: Math.floor(templateData.memory / 1024), // 转换为GB
        time: Math.floor(templateData.time / 60), // 转换为小时
        moduleLoad: templateData.moduleLoad,
        executable: templateData.executable,
        inputFile: templateData.inputFile,
        containerImage: templateData.containerImage,
        showInQuick: templateData.showInQuick || false
      })
      
      setEditTemplateOpen(true)
    } catch (e: any) {
      // 如果API失败，直接使用现有数据
      setCurrentTemplate(tpl)
      editTemplateForm.setFieldsValue({
        name: tpl.name,
        appType: tpl.appType,
        jobType: tpl.jobType || 'normal',
        icon: tpl.icon,
        category: tpl.category || 'general',
        description: tpl.description,
        partition: tpl.partition,
        nodes: tpl.nodes,
        cpus: tpl.cpus,
        gpus: tpl.gpus || 0,
        memory: Math.floor(tpl.memory / 1024),
        time: Math.floor(tpl.time / 60),
        moduleLoad: tpl.moduleLoad,
        executable: tpl.executable,
        inputFile: tpl.inputFile,
        containerImage: tpl.containerImage,
        showInQuick: tpl.showInQuick || false
      })
      setEditTemplateOpen(true)
    }
  }, [editTemplateForm])
  
  // 保存模板编辑
  const handleSaveTemplate = async (values: any) => {
    if (!currentTemplate) return
    
    try {
      await axios.put(`/app-templates/${currentTemplate.id}`, {
        ...values,
        memory: values.memory * 1024, // 转换为MB
        time: values.time * 60, // 转换为分钟
        owner: user?.username
      })
      Message.success('模板更新成功')
      setEditTemplateOpen(false)
      editTemplateForm.resetFields()
      setCurrentTemplate(null)
      loadTemplates()
    } catch (e: any) {
      Message.error(e.response?.data?.error || '更新模板失败')
    }
  }
  
  // 删除模板
  const handleDeleteTemplate = useCallback(async (tpl: Template) => {
    modal.confirm({
      title: '删除模板',
      content: `确定要删除模板"${tpl.name}"吗？此操作不可恢复。`,
      okText: '确定删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await axios.delete(`/app-templates/${tpl.id}`)
          Message.success('模板已删除')
          loadTemplates()
        } catch (e: any) {
          Message.error(e.response?.data?.error || '删除模板失败')
        }
      }
    })
  }, [modal, loadTemplates])
  const applyTemplate = useCallback((tpl: Template) => {
    // 构建脚本内容
    let scriptContent = '#!/bin/bash\n'
    scriptContent += `#SBATCH -J ${tpl.name}\n`
    scriptContent += `#SBATCH -p ${tpl.partition || 'compute'}\n`
    scriptContent += `#SBATCH -N ${tpl.nodes || 1}\n`
    scriptContent += `#SBATCH -n ${tpl.cpus}\n`
    if (tpl.memory > 0) {
      scriptContent += `#SBATCH --mem=${tpl.memory}M\n`
    }
    if (tpl.time > 0) {
      const hours = Math.floor(tpl.time / 60)
      const mins = tpl.time % 60
      scriptContent += `#SBATCH -t ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00\n`
    }
    if (tpl.gpus && tpl.gpus > 0) {
      scriptContent += `#SBATCH --gres=gpu:${tpl.gpus}\n`
    }
    scriptContent += '\n'
    
    // 添加模块加载
    if (tpl.moduleLoad) {
      scriptContent += `module load ${tpl.moduleLoad}\n\n`
    }
    
    // 添加执行命令
    if (tpl.executable) {
      if (tpl.inputFile) {
        scriptContent += `srun ${tpl.executable} ${tpl.inputFile}\n`
      } else {
        scriptContent += `srun ${tpl.executable}\n`
      }
    } else {
      scriptContent += 'srun ./my-program\n'
    }
    
    const memoryGB = Math.floor(tpl.memory / 1024) || 0
    const timeHours = Math.floor(tpl.time / 60) || 0
    
    submitForm.setFieldsValue({
      name: tpl.name,
      partition: tpl.partition || 'compute',
      nodes: tpl.nodes || 1,
      cpus: tpl.cpus,
      memory: memoryGB,
      time_hours: timeHours,
      gpus: tpl.gpus || 0,
      qos: '',
      workdir: '',
      script: scriptContent
    })
    
    // 更新资源统计
    setCurrentResources({
      nodes: tpl.nodes || 1,
      cpus: tpl.cpus,
      gpus: tpl.gpus || 0,
      memory: memoryGB
    })
    
    setSubmitTab('manual')
  }, [submitForm])
  
  // 查看作业详情
  const viewJobDetail = useCallback((job: Job) => {
    setSelectedJob(job)
    setDetailOpen(true)
  }, [])
  
  // 获取作业日志
  const fetchJobLog = useCallback(async (job: Job) => {
    setJobLogLoading(true)
    setJobLogOpen(true)
    try {
      const res = await axios.get(`/jobs/${job.id}/logs`)
      setJobLogContent({
        stdout: res.data.data?.stdout || '暂无标准输出日志',
        stderr: res.data.data?.stderr || '暂无错误日志'
      })
    } catch (e: any) {
      Message.error(e.response?.data?.error || '获取作业日志失败')
      setJobLogContent({
        stdout: '获取日志失败',
        stderr: '获取日志失败'
      })
    } finally {
      setJobLogLoading(false)
    }
  }, [])
  
  // 打开目录
  const openDirectory = useCallback((job: Job) => {
    if (!job.directory || job.directory === '-') {
      Message.error('作业目录不可用')
      return
    }
    navigate('/dashboard/files?path=' + encodeURIComponent(job.directory))
  }, [navigate])
  
  // 过滤作业
  const filteredJobs = jobs.filter(job => {
    if (statusFilter && job.status !== statusFilter) return false
    if (partitionFilter && job.partition !== partitionFilter) return false
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase()
      if (!job.name?.toLowerCase().includes(q) && !String(job.id).includes(q)) return false
    }
    return true
  })
  
  // 状态标签颜色
  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      RUNNING: 'processing',
      PENDING: 'warning',
      COMPLETED: 'success',
      FAILED: 'error',
      CANCELLED: 'default',
      TIMEOUT: 'error',
      SUSPENDED: 'default',
      UNKNOWN: 'default'
    }
    return colorMap[status] || 'default'
  }
  
  // 状态标签文本
  const getStatusLabel = (status: string) => {
    const labelMap: Record<string, string> = {
      RUNNING: '运行中',
      PENDING: '等待中',
      COMPLETED: '已完成',
      FAILED: '失败',
      CANCELLED: '已取消',
      TIMEOUT: '超时',
      SUSPENDED: '已挂起',
      UNKNOWN: '未知'
    }
    return labelMap[status] || status
  }
  
  // 表格列定义
  const columns: TableColumnsType<Job> = [
    {
      title: '作业ID',
      dataIndex: 'id',
      width: 120,
      fixed: 'left',
      render: (id) => <code style={{ fontSize: 12 }}>{id}</code>
    },
    ...(viewMode === 'all' ? [{
      title: '用户',
      dataIndex: 'user',
      width: 100
    }] : []),
    {
      title: '作业名称',
      dataIndex: 'name',
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {getStatusLabel(status)}
        </Tag>
      )
    },
    {
      title: '作业类型',
      dataIndex: 'jobType',
      width: 100
    },
    {
      title: '分区',
      dataIndex: 'partition',
      width: 100
    },
    {
      title: '核心数',
      dataIndex: 'cpus',
      width: 80
    },
    {
      title: '提交时间',
      dataIndex: 'submitTime',
      width: 150
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      width: 150
    },
    {
      title: '运行时长',
      dataIndex: 'runTime',
      width: 120
    },
    {
      title: '操作',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => viewJobDetail(record)}
          >
            详情
          </Button>
          {(record.status === 'RUNNING' || record.status === 'PENDING') &&
            (admin || record.user === user?.username) && (
            <Button
              type="link"
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => cancelJob(record)}
            >
              取消
            </Button>
          )}
          <Button
            type="link"
            size="small"
            icon={<FolderOutlined />}
            onClick={() => openDirectory(record)}
          >
            目录
          </Button>
        </Space>
      )
    }
  ]
  
  return (
    <div style={{
      display: 'flex',
      width: '100%',
      height: '100%',
      gap: 16,
      overflow: 'hidden'
    }}>
      {/* 左侧：作业列表 */}
      <div style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        overflowY: 'auto'
      }}>
      {/* 统计卡片 */}
      <Row gutter={16}>
        <Col span={4}>
          <Card size="small" style={{ height: 120 }}>
            <Statistic
              title="作业总数"
              value={jobs.length}
              valueStyle={{ fontSize: 28, fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" style={{ height: 120 }}>
            <Statistic
              title="等待资源"
              value={stats.pending}
              prefix={<HourglassOutlined />}
              valueStyle={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}
            />
            <Tag color="warning" style={{ marginTop: 8 }}>等待</Tag>
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" style={{ height: 120 }}>
            <Statistic
              title="作业调度"
              value={stats.queued}
              prefix={<SyncOutlined />}
              valueStyle={{ fontSize: 28, fontWeight: 700, color: '#3b82f6' }}
            />
            <Tag color="processing" style={{ marginTop: 8 }}>排队</Tag>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ height: 120 }}>
            <div style={{ marginBottom: 8, fontSize: 12, color: '#64748b', fontWeight: 500 }}>
              作业执行
            </div>
            <Row gutter={8}>
              <Col span={8}>
                <Statistic
                  title={<span style={{ fontSize: 11 }}>运行</span>}
                  value={stats.running}
                  prefix={<PlayCircleOutlined />}
                  valueStyle={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title={<span style={{ fontSize: 11 }}>用户挂起</span>}
                  value={stats.userHeld}
                  prefix={<PauseCircleOutlined />}
                  valueStyle={{ fontSize: 20, fontWeight: 700, color: '#6366f1' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title={<span style={{ fontSize: 11 }}>系统挂起</span>}
                  value={stats.sysHeld}
                  prefix={<PauseCircleOutlined />}
                  valueStyle={{ fontSize: 20, fontWeight: 700, color: '#6366f1' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ height: 120 }}>
            <div style={{ marginBottom: 8, fontSize: 12, color: '#64748b', fontWeight: 500 }}>
              作业完成
            </div>
            <Row gutter={8}>
              <Col span={12}>
                <Statistic
                  title={<span style={{ fontSize: 11 }}>完成</span>}
                  value={stats.completed}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title={<span style={{ fontSize: 11 }}>失败</span>}
                  value={stats.failed}
                  prefix={<CloseCircleOutlined />}
                  valueStyle={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
      
      {/* 工具栏 */}
      <Card size="small">
        <Space style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setSubmitOpen(true)}>
              提交作业
            </Button>
            <Button onClick={() => batchAction('restart')} disabled={selectedRowKeys.length === 0}>
              重启
            </Button>
            <Button onClick={() => batchAction('suspend')} disabled={selectedRowKeys.length === 0}>
              挂起
            </Button>
            <Button onClick={() => batchAction('resume')} disabled={selectedRowKeys.length === 0}>
              恢复
            </Button>
            <Button
              danger
              onClick={() => batchAction('cancel')}
              disabled={selectedRowKeys.length === 0}
            >
              停止
            </Button>
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadJobs} loading={loading}>
              刷新
            </Button>
            <Button icon={<ExportOutlined />}>导出</Button>
          </Space>
        </Space>
      </Card>
      
      {/* 筛选栏 */}
      <Card size="small">
        <Space style={{ width: '100%', flexWrap: 'wrap' }}>
          <Input
            placeholder="默认按照作业名称搜索"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          
          {admin && (
            <Space>
              <Button
                type={viewMode === 'my' ? 'primary' : 'default'}
                onClick={() => {
                  setViewMode('my')
                  setUserFilter('')
                  setPagination(prev => ({ ...prev, current: 1 }))
                }}
              >
                我的作业
              </Button>
              <Button
                type={viewMode === 'all' ? 'primary' : 'default'}
                onClick={() => {
                  setViewMode('all')
                  setPagination(prev => ({ ...prev, current: 1 }))
                }}
              >
                所有作业
              </Button>
            </Space>
          )}
          
          {viewMode === 'all' && admin && (
            <Input
              placeholder="按用户名筛选..."
              value={userFilter}
              onChange={(e) => {
                setUserFilter(e.target.value)
                setPagination(prev => ({ ...prev, current: 1 }))
              }}
              style={{ width: 150 }}
              allowClear
            />
          )}
          
          <Select
            placeholder="全部状态"
            value={statusFilter || undefined}
            onChange={(v) => {
              setStatusFilter(v || '')
              setPagination(prev => ({ ...prev, current: 1 }))
            }}
            style={{ width: 120 }}
            allowClear
          >
            <Select.Option value="RUNNING">运行中</Select.Option>
            <Select.Option value="PENDING">等待中</Select.Option>
            <Select.Option value="COMPLETED">已完成</Select.Option>
            <Select.Option value="FAILED">失败</Select.Option>
            <Select.Option value="SUSPENDED">已挂起</Select.Option>
          </Select>
          
          <Select
            placeholder="全部分区"
            value={partitionFilter || undefined}
            onChange={(v) => {
              setPartitionFilter(v || '')
              setPagination(prev => ({ ...prev, current: 1 }))
            }}
            style={{ width: 120 }}
            allowClear
          >
            {partitions.map(p => (
              <Select.Option key={p} value={p}>{p}</Select.Option>
            ))}
          </Select>
        </Space>
      </Card>
      
      {/* 作业表格 */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredJobs}
          rowKey="id"
          loading={loading}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys
          }}
          pagination={{
            ...pagination,
            onChange: (page, pageSize) => {
              setPagination(prev => ({ ...prev, current: page, pageSize: pageSize || 15 }))
            },
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个作业`
          }}
          scroll={{ x: 1400 }}
          size="small"
        />
      </Card>
      </div>
      
      {/* 右侧：提交面板 */}
      {submitOpen && (
        <div style={{
          width: 460,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          border: '1px solid #d9d9d9',
          borderRadius: 8,
          overflow: 'hidden',
          height: 'fit-content',
          maxHeight: '100%'
        }}>
          {/* 面板头部 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 12px',
            borderBottom: '1px solid #d9d9d9',
            flexShrink: 0
          }}>
            <Space size={2} style={{
              background: '#f5f5f5',
              borderRadius: 6,
              padding: 2
            }}>
              <Button
                type={submitTab === 'manual' ? 'primary' : 'text'}
                size="small"
                onClick={() => setSubmitTab('manual')}
                style={{
                  fontSize: '0.8rem',
                  fontWeight: submitTab === 'manual' ? 600 : 500,
                  height: 28
                }}
              >
                提交作业
              </Button>
              <Button
                type={submitTab === 'template' ? 'primary' : 'text'}
                size="small"
                onClick={() => setSubmitTab('template')}
                style={{
                  fontSize: '0.8rem',
                  fontWeight: submitTab === 'template' ? 600 : 500,
                  height: 28
                }}
              >
                模板管理
              </Button>
            </Space>
            <Button
              type="text"
              size="small"
              onClick={() => setSubmitOpen(false)}
              style={{ fontSize: '0.9rem', padding: '4px 6px' }}
            >
              ✕
            </Button>
          </div>
          
          {/* 面板内容 */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {submitTab === 'manual' ? (
              <>
                {/* 快速模板 */}
                {templates.length > 0 && (
                  <div style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid #d9d9d9',
                    flexShrink: 0,
                    background: 'rgba(0,0,0,0.02)',
                    maxHeight: 160,
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    <div style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      color: '#8c8c8c',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: 7,
                      flexShrink: 0
                    }}>
                      快速模板
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 5,
                      overflowY: 'auto'
                    }}>
                      {templates.map(tpl => (
                        <div
                          key={tpl.id}
                          onClick={() => applyTemplate(tpl)}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            gap: 2,
                            padding: '7px 9px',
                            background: '#fff',
                            border: '1px solid #d9d9d9',
                            borderRadius: 7,
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(0,0,0,0.25)'
                            e.currentTarget.style.background = '#fafafa'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#d9d9d9'
                            e.currentTarget.style.background = '#fff'
                          }}
                        >
                          <div style={{ fontSize: '0.95rem', lineHeight: 1 }}>{tpl.icon}</div>
                          <div style={{ fontSize: '0.73rem', fontWeight: 600, lineHeight: 1.2 }}>{tpl.name}</div>
                          <div style={{ fontSize: '0.67rem', color: '#8c8c8c' }}>
                            {tpl.cpus}核 · {Math.floor(tpl.memory / 1024)}GB
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 提交表单 */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                  {/* 模式切换 */}
                  <div style={{
                    display: 'flex',
                    gap: 8,
                    marginBottom: 16,
                    padding: '8px',
                    background: '#f5f5f5',
                    borderRadius: 6
                  }}>
                    <Button
                      type={jobMode === 'normal' ? 'primary' : 'default'}
                      size="small"
                      onClick={() => setJobMode('normal')}
                      style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      📝 普通作业
                    </Button>
                    <Button
                      type={jobMode === 'container' ? 'primary' : 'default'}
                      size="small"
                      onClick={() => setJobMode('container')}
                      style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      🐳 容器作业
                    </Button>
                  </div>
                  
                  {/* 普通作业表单 */}
                  {jobMode === 'normal' ? (
                  <Form
                    form={submitForm}
                    layout="vertical"
                    onFinish={handleSubmit}
                  >
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          label="作业名称"
                          name="name"
                          rules={[{ required: true, message: '请输入作业名称' }]}
                        >
                          <Input placeholder="my_job" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          label="队列/分区"
                          name="partition"
                          rules={[{ required: true, message: '请选择分区' }]}
                        >
                          <Select placeholder="选择计算分区">
                            {partitions.map(p => (
                              <Select.Option key={p} value={p}>{p}</Select.Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                    </Row>
                    
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          label="节点数"
                          name="nodes"
                          rules={[{ required: true, message: '请输入节点数' }]}
                          initialValue={1}
                        >
                          <Input type="number" min={1} placeholder="1" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          label="CPU 核心数"
                          name="cpus"
                          rules={[{ required: true, message: '请输入CPU核数' }]}
                          initialValue={8}
                        >
                          <Input type="number" min={1} placeholder="8" />
                        </Form.Item>
                      </Col>
                    </Row>
                    
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          label="内存 (GB)"
                          name="memory"
                          initialValue={0}
                        >
                          <Input type="number" min={0} placeholder="0" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          label="时间 (小时)"
                          name="time_hours"
                          initialValue={0}
                        >
                          <Input type="number" min={0} placeholder="0" step={0.5} />
                        </Form.Item>
                      </Col>
                    </Row>
                    
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          label="GPU 卡数"
                          name="gpus"
                          initialValue={0}
                        >
                          <Input type="number" min={0} placeholder="0" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          label="QOS（服务质量）"
                          name="qos"
                        >
                          <Input placeholder="默认" />
                        </Form.Item>
                      </Col>
                    </Row>
                    
                    <Form.Item
                      label="工作目录"
                      name="workdir"
                      tooltip="作业执行的工作目录，可以手动输入路径"
                    >
                      <Input 
                        placeholder={`例如：/home/${getUser()?.username || 'username'}/jobs`}
                        style={{ backgroundColor: '#fff' }}
                        addonAfter={
                          <Button 
                            type="link" 
                            size="small" 
                            icon={<FolderOutlined />}
                            onClick={() => {
                              Message.info('请直接在输入框中输入或修改目录路径')
                            }}
                            style={{ padding: 0 }}
                          >
                            提示
                          </Button>
                        }
                      />
                    </Form.Item>
                    
                    <Form.Item
                      label="脚本内容"
                      name="script"
                      rules={[{ required: true, message: '请输入作业脚本' }]}
                      tooltip="可以点击下方按钮根据参数生成模板，也可以直接编辑修改"
                    >
                      <TextArea
                        rows={12}
                        style={{ 
                          fontFamily: 'monospace', 
                          fontSize: 13,
                          backgroundColor: '#fff'
                        }}
                        placeholder="点击下方【生成脚本模板】按钮，或直接在此输入脚本内容"
                      />
                    </Form.Item>
                    
                    <Form.Item>
                      <Space>
                        <Button 
                          onClick={() => updateScriptFromForm()}
                          icon={<SyncOutlined />}
                        >
                          生成脚本模板
                        </Button>
                        <span style={{ color: '#999', fontSize: 12 }}>
                          根据上方参数生成SBATCH脚本模板
                        </span>
                      </Space>
                    </Form.Item>
                    
                    <Form.Item>
                      <Space>
                        <Button type="primary" htmlType="submit" size="large">
                          提交作业
                        </Button>
                        <Button onClick={() => submitForm.resetFields()} size="large">
                          重置
                        </Button>
                      </Space>
                    </Form.Item>
                  </Form>
                  ) : (
                    // 容器作业表单
                    <div style={{ padding: '16px', background: '#f5f5f5', borderRadius: 8 }}>
                      <div style={{ marginBottom: 12, fontSize: 13, color: '#666', lineHeight: 1.6 }}>
                        容器作业支持使用Docker/Singularity镜像运行作业。
                      </div>
                      <Form
                        form={submitForm}
                        layout="vertical"
                        onFinish={handleSubmit}
                      >
                        <Form.Item
                          label="作业名称"
                          name="name"
                          rules={[{ required: true, message: '请输入作业名称' }]}
                        >
                          <Input placeholder="my-container-job" />
                        </Form.Item>
                        
                        <Form.Item
                          label="容器镜像"
                          name="containerImage"
                          rules={[{ required: true, message: '请选择容器镜像' }]}
                        >
                          <Input
                            placeholder="点击右侧按钮选择镜像"
                            readOnly
                            suffix={
                              <Button
                                type="primary"
                                size="small"
                                icon={<DatabaseOutlined />}
                                onClick={() => {
                                  setImageSelectModalOpen(true)
                                  loadAvailableImages()
                                }}
                              >
                                选择
                              </Button>
                            }
                            style={{ backgroundColor: 'white' }}
                          />
                        </Form.Item>
                        
                        <Form.Item
                          label="分区"
                          name="partition"
                          rules={[{ required: true, message: '请选择分区' }]}
                        >
                          <Select placeholder="选择计算分区">
                            {partitions.map(p => (
                              <Select.Option key={p} value={p}>{p}</Select.Option>
                            ))}
                          </Select>
                        </Form.Item>
                        
                        <Row gutter={16}>
                          <Col span={12}>
                            <Form.Item
                              label="节点数"
                              name="nodes"
                              rules={[{ required: true, message: '请输入节点数' }]}
                            >
                              <Input type="number" min={1} suffix="个" />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item
                              label="CPU核数"
                              name="cpus"
                              rules={[{ required: true, message: '请输入CPU核数' }]}
                            >
                              <Input type="number" min={1} suffix="核" />
                            </Form.Item>
                          </Col>
                        </Row>
                        
                        <Row gutter={16}>
                          <Col span={12}>
                            <Form.Item label="GPU卡数" name="gpus">
                              <Input type="number" min={0} placeholder="0" suffix="卡" />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item label="内存" name="memory">
                              <Input placeholder="8GB" />
                            </Form.Item>
                          </Col>
                        </Row>
                        
                        <Form.Item
                          label="时间限制"
                          name="time"
                          rules={[{ required: true, message: '请输入时间限制' }]}
                        >
                          <Input placeholder="格式：HH:MM:SS，例如：04:00:00" />
                        </Form.Item>
                        
                        <Form.Item 
                          label="挂载目录" 
                          name="mountDir"
                          tooltip="逗号分隔，格式：宿主机路径:容器内路径"
                        >
                          <Input 
                            placeholder={`/fs/home/${getUser()?.username || 'username'}:/fs/home/${getUser()?.username || 'username'}`}
                            style={{ fontFamily: 'monospace', fontSize: 13 }}
                          />
                        </Form.Item>
                        
                        <Form.Item 
                          label="工作目录" 
                          name="workdir"
                          tooltip="容器内的工作目录"
                        >
                          <Input 
                            placeholder={`/fs/home/${getUser()?.username || 'username'}`}
                            style={{ fontFamily: 'monospace', fontSize: 13 }}
                          />
                        </Form.Item>
                        
                        <Form.Item
                          label="运行命令（可选）"
                          name="command"
                          tooltip="留空 = 交互模式（sleep infinity），可通过【进入容器】连接"
                        >
                          <TextArea
                            rows={6}
                            placeholder="python /workspace/train.py"
                            style={{ fontFamily: 'monospace', fontSize: 12 }}
                          />
                        </Form.Item>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#fffbe6', 
                          border: '1px solid #ffe58f',
                          borderRadius: 4,
                          marginBottom: 16
                        }}>
                          <Space>
                            <span style={{ fontSize: 16 }}>💡</span>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              留空 = 交互模式（sleep infinity），可通过【进入容器】连接
                            </Text>
                          </Space>
                        </div>
                        
                        <Form.Item>
                          <Space>
                            <Button type="primary" htmlType="submit">
                              提交容器作业
                            </Button>
                            <Button onClick={() => submitForm.resetFields()}>
                              重置
                            </Button>
                          </Space>
                        </Form.Item>
                      </Form>
                    </div>
                  )}
                </div>
              </>
            ) : (
              // 模板管理面板
              <div style={{ padding: '16px', overflowY: 'auto' }}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>📄 作业模板库</h3>
                    <Button
                      type="primary"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => setCreateTemplateOpen(true)}
                    >
                      新建模板
                    </Button>
                  </div>
                  
                  {/* 作业类型标签 */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <Button
                      type="default"
                      size="small"
                      onClick={() => setTemplateJobType('normal')}
                      style={{
                        borderRadius: 6,
                        fontWeight: 600,
                        background: templateJobType === 'normal' ? '#1890ff' : '#fff',
                        color: templateJobType === 'normal' ? '#fff' : '#000',
                        border: templateJobType === 'normal' ? 'none' : '1px solid #d9d9d9'
                      }}
                    >
                      ⚙️ 普通作业
                    </Button>
                    <Button
                      type="default"
                      size="small"
                      onClick={() => setTemplateJobType('container')}
                      style={{
                        borderRadius: 6,
                        fontWeight: templateJobType === 'container' ? 600 : 500,
                        background: templateJobType === 'container' ? '#1890ff' : '#fff',
                        color: templateJobType === 'container' ? '#fff' : '#000',
                        border: templateJobType === 'container' ? 'none' : '1px solid #d9d9d9'
                      }}
                    >
                      🐳 容器作业
                    </Button>
                  </div>
                  
                  {/* 应用分类 */}
                  <div style={{
                    display: 'flex',
                    gap: 6,
                    flexWrap: 'wrap',
                    marginBottom: 16,
                    paddingBottom: 12,
                    borderBottom: '1px solid #f0f0f0'
                  }}>
                    {['全部', 'CFD', '化学', '分子动力学', 'AI训练', 'AI推理', '通用'].map((cat, idx) => (
                      <Button
                        key={cat}
                        type={idx === 0 ? 'primary' : 'default'}
                        size="small"
                        style={{
                          fontSize: 11,
                          height: 24,
                          padding: '0 8px',
                          borderRadius: 4
                        }}
                      >
                        {cat}
                      </Button>
                    ))}
                  </div>
                </div>
                
                {/* 模板列表 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* 模板卡片 */}
                  {templates.slice(0, 3).map((tpl) => (
                    <div
                      key={tpl.id}
                      style={{
                        border: '1px solid #e8e8e8',
                        borderRadius: 8,
                        padding: 12,
                        background: '#fafafa',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#1890ff'
                        e.currentTarget.style.background = '#fff'
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e8e8e8'
                        e.currentTarget.style.background = '#fafafa'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      {/* 头部 */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 18 }}>{tpl.icon}</span>
                          <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{tpl.name}</h4>
                        </div>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <Tag color="blue" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                            🌐 公共
                          </Tag>
                          <Tag style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                            通用
                          </Tag>
                        </div>
                      </div>
                      
                      {/* 描述 */}
                      <div style={{ fontSize: 11, color: '#666', marginBottom: 8, lineHeight: 1.4 }}>
                        高性能计算作业模板，适用于各类科学计算任务
                      </div>
                      
                      {/* 规格 */}
                      <div style={{
                        display: 'flex',
                        gap: 8,
                        fontSize: 10,
                        color: '#888',
                        marginBottom: 8,
                        flexWrap: 'wrap'
                      }}>
                        <span>📦 节点: 1</span>
                        <span>⚡ CPU: {tpl.cpus}</span>
                        <span>💾 内存: {tpl.memory}</span>
                        <span>⏱️ 时间: 4h</span>
                      </div>
                      
                      {/* 操作按钮 */}
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button
                          type="primary"
                          size="small"
                          onClick={() => applyTemplate(tpl)}
                          style={{ fontSize: 11, height: 24, flex: 1 }}
                        >
                          🚀 使用模板
                        </Button>
                        <Button
                          size="small"
                          onClick={() => handleViewTemplate(tpl)}
                          style={{ fontSize: 11, height: 24 }}
                        >
                          📄 查看
                        </Button>
                        <Button
                          size="small"
                          onClick={() => handleEditTemplate(tpl)}
                          style={{ fontSize: 11, height: 24 }}
                        >
                          ✏️ 编辑
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {templates.length === 0 && (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="暂无模板"
                      style={{ padding: '40px 0' }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 新建模板弹窗 */}
      <Modal
        title="+ 新建模板"
        open={createTemplateOpen}
        onCancel={() => {
          setCreateTemplateOpen(false)
          createTemplateForm.resetFields()
        }}
        width={700}
        footer={null}
      >
        <Form
          form={createTemplateForm}
          layout="vertical"
          onFinish={handleCreateTemplate}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="模板名称"
                name="name"
                rules={[{ required: true, message: '请输入模板名称' }]}
              >
                <Input placeholder="例：My LAMMPS 模板" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="应用类型"
                name="appType"
                rules={[{ required: true, message: '请输入应用类型' }]}
              >
                <Input placeholder="例：LAMMPS" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="作业类型" name="jobType" initialValue="normal">
                <Select>
                  <Select.Option value="normal">⚙️ 普通作业</Select.Option>
                  <Select.Option value="container">🐳 容器作业</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="图标（emoji）" name="icon" initialValue="🔬">
                <Input placeholder="🔬" maxLength={4} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="分类" name="category" initialValue="general">
                <Select>
                  <Select.Option value="cfd">CFD</Select.Option>
                  <Select.Option value="chemistry">化学</Select.Option>
                  <Select.Option value="md">分子动力学</Select.Option>
                  <Select.Option value="ai">AI 训练</Select.Option>
                  <Select.Option value="ai-inference">AI 推理</Select.Option>
                  <Select.Option value="general">通用</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.jobType !== currentValues.jobType}
          >
            {({ getFieldValue }) =>
              getFieldValue('jobType') === 'container' ? (
                <Form.Item label="容器镜像" name="containerImage" rules={[{ required: true, message: '请选择容器镜像' }]}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Select
                      placeholder="1. 选择项目"
                      onChange={(value) => {
                        setSelectedProject(value)
                        setSelectedRepo('')
                        setImageTags([])
                        loadRepositories(value)
                      }}
                      showSearch
                      loading={loadingImages}
                    >
                      {harborProjects.map((p: any) => (
                        <Select.Option key={p.name} value={p.name}>
                          {p.name}
                        </Select.Option>
                      ))}
                    </Select>
                    
                    {selectedProject && (
                      <Select
                        placeholder="2. 选择仓库"
                        onChange={(value) => {
                          setSelectedRepo(value)
                          loadImageTags(selectedProject, value)
                        }}
                        showSearch
                        loading={loadingImages}
                        disabled={!selectedProject}
                      >
                        {harborRepositories.map((r: any) => (
                          <Select.Option key={r.name} value={r.name}>
                            {r.name.replace(`${selectedProject}/`, '')}
                          </Select.Option>
                        ))}
                      </Select>
                    )}
                    
                    {selectedRepo && imageTags.length > 0 && (
                      <Select
                        placeholder="3. 选择标签"
                        onChange={(tag) => {
                          const fullImage = `${selectedProject}/${selectedRepo.replace(`${selectedProject}/`, '')}:${tag}`
                          createTemplateForm.setFieldsValue({ containerImage: fullImage })
                        }}
                        showSearch
                        loading={loadingImages}
                        disabled={!selectedRepo}
                      >
                        {imageTags.map((tag: string) => (
                          <Select.Option key={tag} value={tag}>
                            {tag}
                          </Select.Option>
                        ))}
                      </Select>
                    )}
                    
                    <Input
                      placeholder="或直接输入完整镜像地址: harbor.example.com/library/pytorch:latest"
                      style={{ marginTop: 4 }}
                    />
                  </div>
                </Form.Item>
              ) : null
            }
          </Form.Item>
          
          <Form.Item label="描述" name="description">
            <Input placeholder="简短描述此模板用途" />
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="分区" name="partition" initialValue="compute">
                <Select>
                  {partitions.map(p => (
                    <Select.Option key={p} value={p}>{p}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="节点数" name="nodes" initialValue={1}>
                <Input type="number" min={1} />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="CPU 核心数" name="cpus" initialValue={8}>
                <Input type="number" min={1} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="内存 (GB)" name="memory" initialValue={32}>
                <Input type="number" min={1} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="GPU 卡数" name="gpus" initialValue={0}>
                <Input type="number" min={0} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="时间 (小时)" name="time" initialValue={24}>
                <Input type="number" min={1} />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.jobType !== currentValues.jobType}
          >
            {({ getFieldValue }) =>
              getFieldValue('jobType') === 'container' ? (
                <Form.Item
                  label="启动命令"
                  name="command"
                  rules={[{ required: true, message: '请输入启动命令' }]}
                >
                  <TextArea
                    rows={6}
                    placeholder="python train.py --epochs 100"
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                  />
                </Form.Item>
              ) : (
                <Form.Item
                  label="脚本内容"
                  name="scriptContent"
                  rules={[{ required: true, message: '请输入脚本内容' }]}
                  initialValue={`#!/bin/bash
#SBATCH -J my_job
#SBATCH -p compute
#SBATCH -N 1
#SBATCH -n 4
#SBATCH --mem=8G
#SBATCH -t 01:00:00
#SBATCH -o output_%j.log
#SBATCH -e error_%j.log

echo "Job started: $(date)"
echo "Running on node: $(hostname)"

# 在此处添加你的命令
hostname

echo "Job finished: $(date)"`}
                >
                  <TextArea
                    rows={10}
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                    placeholder="#!/bin/bash&#10;#SBATCH -J my_job&#10;..."
                  />
                </Form.Item>
              )
            }
          </Form.Item>
          
          <Form.Item name="showInQuick" valuePropName="checked" initialValue={false}>
            <Checkbox>显示在快速模板栏</Checkbox>
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
                💾 创建
              </Button>
              <Button onClick={() => {
                setCreateTemplateOpen(false)
                createTemplateForm.resetFields()
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 查看模板弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>{currentTemplate?.icon}</span>
            <span>{currentTemplate?.name}</span>
          </div>
        }
        open={viewTemplateOpen}
        onCancel={() => {
          setViewTemplateOpen(false)
          setCurrentTemplate(null)
        }}
        width={700}
        footer={
          <Space>
            <Button onClick={() => {
              setViewTemplateOpen(false)
              setCurrentTemplate(null)
            }}>
              关闭
            </Button>
            {currentTemplate && (admin || currentTemplate.owner === user?.username) && (
              <>
                <Button 
                  type="primary"
                  onClick={() => {
                    setViewTemplateOpen(false)
                    handleEditTemplate(currentTemplate)
                  }}
                >
                  编辑模板
                </Button>
                <Button 
                  danger
                  onClick={() => {
                    setViewTemplateOpen(false)
                    handleDeleteTemplate(currentTemplate)
                  }}
                >
                  删除模板
                </Button>
              </>
            )}
          </Space>
        }
      >
        {currentTemplate && (
          <div style={{ padding: '8px 0' }}>
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <div style={{ marginBottom: 12, padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
                  <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
                    {currentTemplate.description || '暂无描述'}
                  </div>
                  <Space size="small" wrap style={{ marginTop: 8 }}>
                    <Tag color="blue">{currentTemplate.jobType === 'container' ? '🐳 容器作业' : '⚙️ 普通作业'}</Tag>
                    <Tag>{currentTemplate.category || '通用'}</Tag>
                    {currentTemplate.isPublic && <Tag color="green">🌐 公共</Tag>}
                    {currentTemplate.showInQuick && <Tag color="orange">⭐ 快速模板</Tag>}
                  </Space>
                </div>
              </Col>
              
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ color: '#64748b', fontSize: 12 }}>应用类型:</strong>
                  <div style={{ marginTop: 4 }}>{currentTemplate.appType || '-'}</div>
                </div>
              </Col>
              
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ color: '#64748b', fontSize: 12 }}>所有者:</strong>
                  <div style={{ marginTop: 4 }}>{currentTemplate.owner || '-'}</div>
                </div>
              </Col>
              
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
                    资源配置
                  </div>
                  <Row gutter={[12, 12]}>
                    <Col span={6}>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>分区</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{currentTemplate.partition || 'compute'}</div>
                    </Col>
                    <Col span={6}>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>节点数</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{currentTemplate.nodes || 1} 个</div>
                    </Col>
                    <Col span={6}>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>CPU核数</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{currentTemplate.cpus || 0} 核</div>
                    </Col>
                    <Col span={6}>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>GPU卡数</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{currentTemplate.gpus || 0} 卡</div>
                    </Col>
                    <Col span={12}>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>内存</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {Math.floor(currentTemplate.memory / 1024)} GB
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>时间限制</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {Math.floor(currentTemplate.time / 60)} 小时
                      </div>
                    </Col>
                  </Row>
                </div>
              </Col>
              
              {currentTemplate.jobType === 'container' ? (
                <Col span={24}>
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: '#64748b', fontSize: 12 }}>容器镜像:</strong>
                    <div style={{ 
                      marginTop: 4, 
                      padding: 8, 
                      background: '#f9fafb', 
                      borderRadius: 4,
                      fontFamily: 'monospace',
                      fontSize: 12,
                      wordBreak: 'break-all'
                    }}>
                      {currentTemplate.containerImage || '-'}
                    </div>
                  </div>
                </Col>
              ) : (
                <>
                  {currentTemplate.moduleLoad && (
                    <Col span={24}>
                      <div style={{ marginBottom: 8 }}>
                        <strong style={{ color: '#64748b', fontSize: 12 }}>模块加载:</strong>
                        <div style={{ 
                          marginTop: 4, 
                          padding: 8, 
                          background: '#f9fafb', 
                          borderRadius: 4,
                          fontFamily: 'monospace',
                          fontSize: 12
                        }}>
                          {currentTemplate.moduleLoad}
                        </div>
                      </div>
                    </Col>
                  )}
                  
                  {currentTemplate.executable && (
                    <Col span={24}>
                      <div style={{ marginBottom: 8 }}>
                        <strong style={{ color: '#64748b', fontSize: 12 }}>执行命令:</strong>
                        <div style={{ 
                          marginTop: 4, 
                          padding: 8, 
                          background: '#f9fafb', 
                          borderRadius: 4,
                          fontFamily: 'monospace',
                          fontSize: 12
                        }}>
                          {currentTemplate.executable}
                        </div>
                      </div>
                    </Col>
                  )}
                  
                  {currentTemplate.inputFile && (
                    <Col span={24}>
                      <div style={{ marginBottom: 8 }}>
                        <strong style={{ color: '#64748b', fontSize: 12 }}>输入文件:</strong>
                        <div style={{ 
                          marginTop: 4, 
                          padding: 8, 
                          background: '#f9fafb', 
                          borderRadius: 4,
                          fontFamily: 'monospace',
                          fontSize: 12
                        }}>
                          {currentTemplate.inputFile}
                        </div>
                      </div>
                    </Col>
                  )}
                </>
              )}
            </Row>
          </div>
        )}
      </Modal>

      {/* 编辑模板弹窗 */}
      <Modal
        title="✏️ 编辑模板"
        open={editTemplateOpen}
        onCancel={() => {
          setEditTemplateOpen(false)
          setCurrentTemplate(null)
          editTemplateForm.resetFields()
        }}
        width={700}
        footer={null}
      >
        <Form
          form={editTemplateForm}
          layout="vertical"
          onFinish={handleSaveTemplate}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="模板名称"
                name="name"
                rules={[{ required: true, message: '请输入模板名称' }]}
              >
                <Input placeholder="例：My LAMMPS 模板" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="应用类型"
                name="appType"
                rules={[{ required: true, message: '请输入应用类型' }]}
              >
                <Input placeholder="例：LAMMPS" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="作业类型" name="jobType">
                <Select>
                  <Select.Option value="normal">⚙️ 普通作业</Select.Option>
                  <Select.Option value="container">🐳 容器作业</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="图标（emoji）" name="icon">
                <Input placeholder="🔬" maxLength={4} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="分类" name="category">
                <Select>
                  <Select.Option value="cfd">CFD</Select.Option>
                  <Select.Option value="chemistry">化学</Select.Option>
                  <Select.Option value="md">分子动力学</Select.Option>
                  <Select.Option value="ai">AI 训练</Select.Option>
                  <Select.Option value="ai-inference">AI 推理</Select.Option>
                  <Select.Option value="general">通用</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item label="描述" name="description">
            <Input placeholder="简短描述此模板用途" />
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="分区" name="partition">
                <Select>
                  {partitions.map(p => (
                    <Select.Option key={p} value={p}>{p}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="节点数" name="nodes">
                <Input type="number" min={1} />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="CPU 核心数" name="cpus">
                <Input type="number" min={1} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="内存 (GB)" name="memory">
                <Input type="number" min={1} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="GPU 卡数" name="gpus">
                <Input type="number" min={0} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="时间 (小时)" name="time">
                <Input type="number" min={1} />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.jobType !== currentValues.jobType}
          >
            {({ getFieldValue }) =>
              getFieldValue('jobType') === 'container' ? (
                <Form.Item label="容器镜像" name="containerImage">
                  <Input placeholder="harbor.example.com/library/pytorch:latest" />
                </Form.Item>
              ) : (
                <>
                  <Form.Item label="模块加载" name="moduleLoad">
                    <Input placeholder="例：gcc/9.3.0 openmpi/4.0.3" />
                  </Form.Item>
                  
                  <Form.Item label="执行命令" name="executable">
                    <Input placeholder="例：./my-program 或 python script.py" />
                  </Form.Item>
                  
                  <Form.Item label="输入文件" name="inputFile">
                    <Input placeholder="例：input.dat" />
                  </Form.Item>
                </>
              )
            }
          </Form.Item>
          
          <Form.Item name="showInQuick" valuePropName="checked">
            <Checkbox>显示在快速模板栏</Checkbox>
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                💾 保存
              </Button>
              <Button onClick={() => {
                setEditTemplateOpen(false)
                setCurrentTemplate(null)
                editTemplateForm.resetFields()
              }}>
                取消
              </Button>
              {currentTemplate && (admin || currentTemplate.owner === user?.username) && (
                <Button 
                  danger
                  onClick={() => {
                    setEditTemplateOpen(false)
                    handleDeleteTemplate(currentTemplate)
                  }}
                >
                  删除模板
                </Button>
              )}
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 作业详情弹窗 */}
      <Modal
        title={`作业详情 - ${selectedJob?.id}`}
        open={detailOpen}
        onCancel={() => {
          setDetailOpen(false)
          setSelectedJob(null)
        }}
        width={800}
        footer={
          <Space>
            <Button onClick={() => {
              setDetailOpen(false)
              setSelectedJob(null)
            }}>
              关闭
            </Button>
            {selectedJob && (
              <Button 
                type="primary"
                icon={<EyeOutlined />}
                onClick={() => {
                  if (selectedJob) {
                    fetchJobLog(selectedJob)
                  }
                }}
              >
                查看日志
              </Button>
            )}
            {selectedJob && (selectedJob.status === 'RUNNING' || selectedJob.status === 'PENDING') &&
              (admin || selectedJob.user === user?.username) && (
              <Button 
                danger 
                icon={<StopOutlined />}
                onClick={() => {
                  if (selectedJob) {
                    cancelJob(selectedJob)
                    setDetailOpen(false)
                    setSelectedJob(null)
                  }
                }}
              >
                取消作业
              </Button>
            )}
          </Space>
        }
      >
        {selectedJob && (
          <div>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ color: '#64748b' }}>作业名:</strong>
                  <div style={{ marginTop: 4 }}>{selectedJob.name}</div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ color: '#64748b' }}>状态:</strong>
                  <div style={{ marginTop: 4 }}>
                    <Tag color={getStatusColor(selectedJob.status)}>
                      {getStatusLabel(selectedJob.status)}
                    </Tag>
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ color: '#64748b' }}>用户:</strong>
                  <div style={{ marginTop: 4 }}>{selectedJob.user}</div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ color: '#64748b' }}>账户:</strong>
                  <div style={{ marginTop: 4 }}>{selectedJob.account}</div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ color: '#64748b' }}>分区:</strong>
                  <div style={{ marginTop: 4 }}>{selectedJob.partition}</div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ color: '#64748b' }}>作业类型:</strong>
                  <div style={{ marginTop: 4 }}>{selectedJob.jobType}</div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ color: '#64748b' }}>节点数:</strong>
                  <div style={{ marginTop: 4 }}>{selectedJob.nodes}</div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ color: '#64748b' }}>CPU核数:</strong>
                  <div style={{ marginTop: 4 }}>{selectedJob.cpus}</div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ color: '#64748b' }}>提交时间:</strong>
                  <div style={{ marginTop: 4 }}>{selectedJob.submitTime}</div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ color: '#64748b' }}>开始时间:</strong>
                  <div style={{ marginTop: 4 }}>{selectedJob.startTime}</div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ color: '#64748b' }}>运行时长:</strong>
                  <div style={{ marginTop: 4 }}>{selectedJob.runTime}</div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ color: '#64748b' }}>时间限制:</strong>
                  <div style={{ marginTop: 4 }}>{formatDuration(selectedJob.timeLimit)}</div>
                </div>
              </Col>
              <Col span={24}>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ color: '#64748b' }}>工作目录:</strong>
                  <div style={{ marginTop: 4, wordBreak: 'break-all' }}>{selectedJob.directory}</div>
                </div>
              </Col>
              {selectedJob.nodeNames.length > 0 && (
                <Col span={24}>
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: '#64748b' }}>运行节点:</strong>
                    <div style={{ marginTop: 4 }}>
                      <Space wrap>
                        {selectedJob.nodeNames.map(node => (
                          <Tag key={node}>{node}</Tag>
                        ))}
                      </Space>
                    </div>
                  </div>
                </Col>
              )}
            </Row>
          </div>
        )}
      </Modal>

      {/* 作业日志查看弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>📋 作业日志 - {selectedJob?.id}</span>
            <Space size={4} style={{
              background: '#f5f5f5',
              borderRadius: 6,
              padding: 2
            }}>
              <Button
                type={logType === 'stdout' ? 'primary' : 'text'}
                size="small"
                onClick={() => setLogType('stdout')}
                style={{
                  fontSize: '0.8rem',
                  height: 28
                }}
              >
                标准输出
              </Button>
              <Button
                type={logType === 'stderr' ? 'primary' : 'text'}
                size="small"
                onClick={() => setLogType('stderr')}
                style={{
                  fontSize: '0.8rem',
                  height: 28
                }}
              >
                错误输出
              </Button>
            </Space>
          </div>
        }
        open={jobLogOpen}
        onCancel={() => {
          setJobLogOpen(false)
          setJobLogContent({stdout: '', stderr: ''})
          setLogType('stdout')
        }}
        width={900}
        footer={
          <Space>
            <Button onClick={() => {
              setJobLogOpen(false)
              setJobLogContent({stdout: '', stderr: ''})
              setLogType('stdout')
            }}>
              关闭
            </Button>
            <Button
              onClick={() => {
                const content = logType === 'stdout' ? jobLogContent.stdout : jobLogContent.stderr
                const blob = new Blob([content], { type: 'text/plain' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `job-${selectedJob?.id}-${logType}.log`
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              下载日志
            </Button>
          </Space>
        }
      >
        {jobLogLoading ? (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            minHeight: 400 
          }}>
            <Space direction="vertical" align="center">
              <SyncOutlined spin style={{ fontSize: 32, color: '#1890ff' }} />
              <div>加载日志中...</div>
            </Space>
          </div>
        ) : (
          <div style={{
            background: '#1e1e1e',
            borderRadius: 6,
            padding: 16,
            maxHeight: 500,
            overflowY: 'auto',
            fontFamily: 'Monaco, Menlo, "Courier New", monospace',
            fontSize: 12,
            lineHeight: 1.6,
            color: '#d4d4d4',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {logType === 'stdout' ? jobLogContent.stdout : jobLogContent.stderr}
          </div>
        )}
      </Modal>

      {/* 镜像选择Modal */}
      <Modal
        title="选择容器镜像"
        open={imageSelectModalOpen}
        onCancel={() => {
          setImageSelectModalOpen(false)
          setImageSearchText('')
        }}
        width={1000}
        footer={null}
        style={{ top: 20 }}
      >
        <div style={{ marginBottom: 16 }}>
          <Input
            placeholder="搜索镜像..."
            prefix={<SearchOutlined />}
            value={imageSearchText}
            onChange={(e) => setImageSearchText(e.target.value)}
            allowClear
            size="large"
          />
        </div>

        {loadingAvailableImages ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <Spin size="large" tip="加载镜像列表中..." />
          </div>
        ) : availableImages.length === 0 ? (
          <Empty
            description="暂无可用镜像"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: 60 }}
          />
        ) : (
          <div>
            <div style={{ 
              marginBottom: 12, 
              fontSize: 13, 
              color: '#666',
              fontWeight: 500,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>公共镜像</span>
              <span>共 {availableImages.filter(img => {
                if (!imageSearchText.trim()) return true
                return img.displayName.toLowerCase().includes(imageSearchText.toLowerCase())
              }).length} 个镜像</span>
            </div>
            
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              {availableImages
                .filter(img => {
                  if (!imageSearchText.trim()) return true
                  return img.displayName.toLowerCase().includes(imageSearchText.toLowerCase())
                })
                .map((img, index) => (
                  <Card
                    key={index}
                    size="small"
                    hoverable
                    onClick={() => {
                      submitForm.setFieldsValue({ containerImage: img.imagePath })
                      setImageSelectModalOpen(false)
                      setImageSearchText('')
                      Message.success('已选择镜像：' + img.displayName)
                    }}
                    style={{ 
                      marginBottom: 8, 
                      cursor: 'pointer',
                      transition: 'all 0.3s'
                    }}
                    bodyStyle={{ padding: 16 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ 
                          fontWeight: 600, 
                          marginBottom: 8,
                          fontSize: 14,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8
                        }}>
                          <span>{img.displayName}</span>
                          <Tag color={img.isPublic ? 'success' : 'default'} style={{ margin: 0 }}>
                            {img.isPublic ? '公开' : '私有'}
                          </Tag>
                        </div>
                        <div style={{ 
                          fontSize: 12, 
                          color: '#999',
                          fontFamily: 'monospace',
                          wordBreak: 'break-all'
                        }}>
                          {img.imagePath}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
