# 容器镜像选择UI重构

## 问题描述

容器作业提交表单中的镜像选择方式过于复杂，需要用户在三个下拉框中依次选择：
1. Harbor项目
2. 仓库
3. 标签

这种方式用户体验差，操作繁琐。

## 解决方案

### 1. 简化UI交互

将三个下拉框改为：
- 一个输入框（显示选中的镜像地址）
- 一个"选择"按钮（打开镜像选择Modal）

```tsx
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
        type="link"
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
```

### 2. 镜像选择Modal

点击"选择"按钮后弹出Modal，显示所有可用镜像：

```tsx
<Modal
  title="选择容器镜像"
  open={imageSelectModalOpen}
  onCancel={() => {
    setImageSelectModalOpen(false)
    setImageSearchText('')
  }}
  width={900}
  footer={null}
>
  {/* 搜索框 */}
  <Input
    placeholder="搜索镜像..."
    prefix={<SearchOutlined />}
    value={imageSearchText}
    onChange={(e) => setImageSearchText(e.target.value)}
    allowClear
  />
  
  {/* 镜像列表 */}
  <List
    dataSource={availableImages.filter(img => {
      if (!imageSearchText.trim()) return true
      return img.displayName.toLowerCase().includes(imageSearchText.toLowerCase())
    })}
    renderItem={(img) => (
      <Card
        size="small"
        hoverable
        onClick={() => {
          submitForm.setFieldsValue({ containerImage: img.imagePath })
          setImageSelectModalOpen(false)
          setImageSearchText('')
          Message.success('已选择镜像：' + img.displayName)
        }}
        style={{ marginBottom: 8, cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{img.displayName}</div>
            <div style={{ fontSize: 12, color: '#999' }}>{img.imagePath}</div>
          </div>
          <Tag color={img.isPublic ? 'success' : 'default'}>
            {img.isPublic ? '公开' : '私有'}
          </Tag>
        </div>
      </Card>
    )}
  />
</Modal>
```

### 3. 加载所有可用镜像

新增`loadAvailableImages`函数，加载所有公共镜像和个人镜像：

```tsx
const loadAvailableImages = useCallback(async () => {
  setLoadingAvailableImages(true)
  try {
    // 获取所有项目
    const projectsRes = await axios.get('/registry/projects')
    const projects = projectsRes.data.data || []
    
    // 获取所有公共项目的镜像
    const allImages: any[] = []
    for (const project of projects) {
      if (project.public || project.name === user?.username) {
        const reposRes = await axios.get(`/registry/projects/${project.name}/repositories`)
        const repos = reposRes.data.data || []
        
        for (const repo of repos) {
          const cleanRepoName = repo.name.replace(`${project.name}/`, '')
          const configRes = await axios.get('/registry/config')
          const harborUrl = configRes.data.harbor_url || 'harbor.example.com'
          const harborHost = harborUrl.replace(/^https?:\/\//, '')
          
          allImages.push({
            projectName: project.name,
            repoName: cleanRepoName,
            fullName: `${project.name}/${cleanRepoName}`,
            displayName: `${project.name}/${cleanRepoName}`,
            imagePath: `${harborHost}/${project.name}/${cleanRepoName}`,
            artifactCount: repo.artifact_count,
            isPublic: project.public
          })
        }
      }
    }
    
    setAvailableImages(allImages)
  } catch (e: any) {
    Message.error('加载镜像列表失败')
  } finally {
    setLoadingAvailableImages(false)
  }
}, [user])
```

### 4. 缺失组件导入

修复代码中缺失的组件导入：

```tsx
// 添加到 antd 导入
import {
  Card, Table, Button, Space, Input, Select, Tag, Modal, Form, Row, Col,
  Statistic, Checkbox, message as Message, App, Empty, Typography, List, Spin
} from 'antd'

// 添加到 @ant-design/icons 导入
import {
  PlusOutlined, ReloadOutlined, SearchOutlined, PlayCircleOutlined,
  PauseCircleOutlined, StopOutlined, FolderOutlined, EyeOutlined,
  ExportOutlined, SettingOutlined, CheckCircleOutlined, CloseCircleOutlined,
  HourglassOutlined, SyncOutlined, DatabaseOutlined
} from '@ant-design/icons'
```

## 技术要点

1. **Modal交互模式**：
   - 使用Modal而不是下拉框，提供更好的浏览体验
   - 支持搜索过滤，快速定位镜像
   - 点击即选择，无需多步操作

2. **镜像列表加载**：
   - 只显示公共镜像和用户个人镜像
   - 一次加载，避免多次API调用
   - 显示镜像完整路径，方便用户识别

3. **用户体验优化**：
   - 输入框只读，防止手动输入错误格式
   - 选择后自动关闭Modal
   - 显示选择成功提示消息
   - 支持搜索，方便在大量镜像中查找

## 相关文件

- `frontend/src/pages/user/jobs/index.tsx` - 作业提交页面

## 提交信息

```
feat: 容器镜像选择UI重构

- 移除三个下拉框（项目/仓库/标签）的复杂选择方式
- 新增镜像选择Modal，支持搜索过滤
- 显示所有公共镜像，点击即可选择
- 添加缺失的List、Spin、DatabaseOutlined组件导入
- 优化用户体验，简化镜像选择流程
```

提交哈希：`f53cf279`
