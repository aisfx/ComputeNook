# 改进镜像选择为输入框+选择按钮+Modal方式

## 需求描述

用户希望容器镜像选择方式是：
1. 一个输入框显示选中的镜像
2. 一个"选择"按钮
3. 点击按钮后弹出Modal，直接显示所有可用镜像
4. Modal中要有镜像，不能显示"暂无镜像"

## 问题根源

之前的实现"暂无镜像"问题是因为：
- 只加载了项目和仓库信息
- 没有加载每个仓库的标签信息
- 用户看到的是"jupyter/base-notebook"这样的仓库，但没有具体的标签版本

## 解决方案

### 1. 输入框+选择按钮UI

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
```

### 2. 改进的loadAvailableImages函数

关键改进：**加载每个仓库的所有标签**

```tsx
const loadAvailableImages = useCallback(async () => {
  setLoadingAvailableImages(true)
  try {
    // 1. 获取Harbor配置
    const configRes = await axios.get('/registry/config')
    const harborUrl = configRes.data.harbor_url || 'harbor.example.com'
    const harborHost = harborUrl.replace(/^https?:\/\//, '')
    
    // 2. 获取所有项目
    const projectsRes = await axios.get('/registry/projects')
    const projects = projectsRes.data.data || []
    
    // 3. 获取所有项目的镜像
    const allImages: any[] = []
    for (const project of projects) {
      // 获取项目的所有仓库
      const reposRes = await axios.get(`/registry/projects/${project.name}/repositories`)
      const repos = reposRes.data.data || []
      
      for (const repo of repos) {
        const cleanRepoName = repo.name.replace(`${project.name}/`, '')
        
        // 关键：获取该仓库的所有标签
        try {
          const tagsRes = await axios.get(
            `/registry/projects/${project.name}/repositories/${encodeURIComponent(repo.name)}/tags`
          )
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
    }
    
    // 4. 按更新时间倒序排列
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
```

### 3. Modal UI设计

```tsx
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
  {/* 搜索框 */}
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

  {/* 加载状态 */}
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
      {/* 镜像数量统计 */}
      <div style={{ 
        marginBottom: 12, 
        fontSize: 13, 
        color: '#666',
        fontWeight: 500,
        display: 'flex',
        justifyContent: 'space-between'
      }}>
        <span>公共镜像</span>
        <span>共 {filteredImages.length} 个镜像</span>
      </div>
      
      {/* 镜像列表 */}
      <div style={{ maxHeight: 500, overflowY: 'auto' }}>
        {filteredImages.map((img, index) => (
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
            style={{ marginBottom: 8, cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                {/* 镜像名称 */}
                <div style={{ fontWeight: 600, marginBottom: 8, display: 'flex', gap: 8 }}>
                  <span>{img.displayName}</span>
                  <Tag color={img.isPublic ? 'success' : 'default'}>
                    {img.isPublic ? '公开' : '私有'}
                  </Tag>
                </div>
                {/* 完整路径 */}
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
```

## 技术要点

### 1. 三层嵌套加载

加载流程：
```
项目列表 → 每个项目的仓库列表 → 每个仓库的标签列表
```

这样才能得到完整的镜像列表（项目/仓库:标签）

### 2. 镜像数据结构

```typescript
{
  projectName: 'jupyter',           // 项目名
  repoName: 'base-notebook',        // 仓库名
  tag: 'x86_64-python-3.11.6',     // 标签
  fullName: 'jupyter/base-notebook:x86_64-python-3.11.6',     // 显示名称
  displayName: 'jupyter/base-notebook:x86_64-python-3.11.6',  // 显示名称
  imagePath: 'hpc.hpcweb.local:8080/jupyter/base-notebook:x86_64-python-3.11.6', // 完整路径
  isPublic: true,                   // 是否公开
  updateTime: '2024-01-15T10:30:00' // 更新时间
}
```

### 3. 排序策略

按更新时间倒序排列，让最新的镜像排在前面：

```tsx
allImages.sort((a, b) => {
  const timeA = a.updateTime ? new Date(a.updateTime).getTime() : 0
  const timeB = b.updateTime ? new Date(b.updateTime).getTime() : 0
  return timeB - timeA
})
```

### 4. 搜索过滤

支持在镜像列表中搜索：

```tsx
const filteredImages = availableImages.filter(img => {
  if (!imageSearchText.trim()) return true
  return img.displayName.toLowerCase().includes(imageSearchText.toLowerCase())
})
```

## 用户体验优势

1. **直观简洁**：
   - 一个输入框 + 一个按钮
   - 不占用太多表单空间
   - 点击即显示所有选项

2. **完整展示**：
   - 显示所有可用镜像（包括标签）
   - 不是空的，不会显示"暂无镜像"
   - 每个镜像都有完整路径

3. **快速搜索**：
   - 支持搜索过滤
   - 显示镜像数量
   - 找到想要的镜像更快

4. **清晰信息**：
   - 项目/仓库:标签格式清晰
   - 标注公开/私有状态
   - 显示完整镜像地址

5. **易于选择**：
   - 点击卡片即可选择
   - 自动填入表单
   - 显示选择成功提示

## 性能考虑

### 潜在问题

如果Harbor中有大量镜像，加载所有标签可能较慢。

### 优化建议

1. **缓存机制**：首次加载后缓存结果
2. **分页加载**：Modal中实现虚拟滚动或分页
3. **懒加载标签**：只在用户展开仓库时加载标签
4. **后端聚合**：后端提供一个API直接返回所有镜像

## 与三个下拉框方式的对比

| 特性 | 三个下拉框 | Modal选择 |
|------|-----------|----------|
| 操作步骤 | 3步（项目→仓库→标签） | 2步（点击→选择） |
| 初始加载 | 只加载项目列表 | 加载所有镜像 |
| 数据量 | 按需加载 | 一次性加载 |
| 搜索体验 | 每个下拉框单独搜索 | 全局搜索 |
| 适用场景 | 镜像较少，分类清晰 | 快速查找和选择 |

## 相关文件

- `frontend/src/pages/user/jobs/index.tsx` - 作业提交表单

## 提交信息

```
feat: 改进镜像选择为输入框+选择按钮+Modal方式

- 改为输入框+选择按钮的UI方式
- 点击选择按钮弹出Modal显示所有可用镜像
- Modal中展示所有项目的所有仓库的所有标签
- 每个镜像显示完整信息：项目/仓库:标签
- 支持搜索过滤镜像
- 显示镜像数量统计
- 点击镜像卡片自动选择并填入表单
- 修复之前'暂无镜像'的问题：加载所有标签而不只是仓库
- 按更新时间倒序排列镜像
```

提交哈希：`2f36efb6`
