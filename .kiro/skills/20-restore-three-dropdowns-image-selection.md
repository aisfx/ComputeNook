# 恢复容器镜像三个下拉框选择方式

## 问题描述

之前实现的镜像选择Modal弹窗方式虽然简化了步骤，但存在以下问题：
1. 点击"选择"按钮后显示"暂无可用镜像"
2. 需要加载所有项目的所有仓库，性能较差
3. 用户反馈更喜欢原来的级联下拉框方式

## 解决方案

### 1. 恢复三个下拉框UI

恢复之前的三级级联选择方式：

```tsx
<Form.Item
  label="容器镜像"
  name="containerImage"
  rules={[{ required: true, message: '请选择容器镜像' }]}
>
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {/* 第一步：选择项目 */}
    <Select
      placeholder="1. 选择项目"
      value={selectedProject}
      onChange={(value) => {
        setSelectedProject(value)
        setSelectedRepo('')
        setImageTags([])
        submitForm.setFieldsValue({ containerImage: '' })
        loadRepositories(value)
      }}
      showSearch
      loading={loadingImages}
    >
      {harborProjects.map((p: any) => (
        <Select.Option key={p.name} value={p.name}>
          {p.name} {p.public && <Tag color="success">公开</Tag>}
        </Select.Option>
      ))}
    </Select>
    
    {/* 第二步：选择仓库 */}
    {selectedProject && (
      <Select
        placeholder="2. 选择仓库"
        value={selectedRepo}
        onChange={(value) => {
          setSelectedRepo(value)
          submitForm.setFieldsValue({ containerImage: '' })
          loadImageTags(selectedProject, value)
        }}
        showSearch
        loading={loadingImages}
        disabled={!selectedProject}
      >
        {harborRepositories.map((r: any) => {
          const cleanName = r.name.replace(`${selectedProject}/`, '')
          return (
            <Select.Option key={r.name} value={cleanName}>
              {cleanName}
            </Select.Option>
          )
        })}
      </Select>
    )}
    
    {/* 第三步：选择标签 */}
    {selectedRepo && (
      <Select
        placeholder="3. 选择标签"
        onChange={async (tag) => {
          // 获取Harbor URL并生成完整镜像地址
          try {
            const configRes = await axios.get('/registry/config')
            const harborUrl = configRes.data.harbor_url || 'harbor.example.com'
            const harborHost = harborUrl.replace(/^https?:\/\//, '')
            const fullImage = `${harborHost}/${selectedProject}/${selectedRepo}:${tag}`
            submitForm.setFieldsValue({ containerImage: fullImage })
          } catch (e) {
            const fullImage = `${selectedProject}/${selectedRepo}:${tag}`
            submitForm.setFieldsValue({ containerImage: fullImage })
          }
        }}
        showSearch
        loading={loadingImages}
        disabled={!selectedRepo || imageTags.length === 0}
        notFoundContent={loadingImages ? <Spin size="small" /> : '暂无标签'}
      >
        {imageTags.map((tag: string) => (
          <Select.Option key={tag} value={tag}>
            {tag}
          </Select.Option>
        ))}
      </Select>
    )}
    
    {/* 备选：直接输入 */}
    <Input
      placeholder="或直接输入完整镜像地址，如: harbor.example.com/library/pytorch:latest"
      style={{ fontFamily: 'monospace', fontSize: 12 }}
    />
  </div>
</Form.Item>
```

### 2. 级联加载逻辑

**选择项目时**：
- 清空仓库和标签选择
- 清空表单的containerImage字段
- 加载该项目的仓库列表

**选择仓库时**：
- 清空标签选择
- 清空表单的containerImage字段
- 加载该仓库的标签列表

**选择标签时**：
- 获取Harbor URL配置
- 生成完整镜像地址：`harbor-host/project/repo:tag`
- 自动填入表单的containerImage字段

### 3. 删除Modal相关代码

删除以下内容：
- 镜像选择Modal的UI代码
- `imageSelectModalOpen` 状态
- `imageSearchText` 状态
- `availableImages` 状态
- `loadingAvailableImages` 状态
- `loadAvailableImages` 函数
- `DatabaseOutlined` 图标导入
- `List` 组件导入（Spin保留，用于加载状态）

### 4. 优化点

1. **加载提示**：
   - 标签下拉框添加 `notFoundContent` 属性
   - 加载中显示 `<Spin size="small" />`
   - 无标签时显示"暂无标签"

2. **禁用状态**：
   - 仓库下拉框在未选择项目时禁用
   - 标签下拉框在未选择仓库或无标签时禁用

3. **显示公开标识**：
   - 项目名称后显示"公开"标签
   - 方便用户识别公共镜像

4. **完整镜像地址**：
   - 自动获取Harbor配置的URL
   - 生成带域名的完整地址
   - 格式：`harbor.example.com/project/repo:tag`

## 用户体验优势

### 三个下拉框方式的优点：

1. **渐进式选择**：用户逐步缩小范围，每一步都清晰
2. **性能更好**：只加载当前需要的数据，不需要一次加载所有镜像
3. **符合习惯**：很多用户熟悉这种级联选择方式
4. **信息清晰**：每一步都能看到完整的选项列表

### Modal方式的问题：

1. **一次性加载**：需要加载所有项目的所有仓库，速度慢
2. **容易为空**：如果权限不足或没有公共镜像，显示"暂无可用镜像"
3. **多一步操作**：需要点击"选择"按钮才能开始选择

## 技术细节

### 状态管理

```tsx
// Harbor镜像相关状态
const [harborProjects, setHarborProjects] = useState<any[]>([])
const [harborRepositories, setHarborRepositories] = useState<any[]>([])
const [selectedProject, setSelectedProject] = useState<string>('')
const [selectedRepo, setSelectedRepo] = useState<string>('')
const [imageTags, setImageTags] = useState<string[]>([])
const [loadingImages, setLoadingImages] = useState(false)
```

### API调用

1. **加载项目列表**：`GET /registry/projects`
2. **加载仓库列表**：`GET /registry/projects/{project}/repositories`
3. **加载标签列表**：`GET /registry/projects/{project}/repositories/{repo}/tags`
4. **获取Harbor配置**：`GET /registry/config`

### 镜像地址格式

```
完整格式：{harbor-host}/{project}/{repository}:{tag}
示例：harbor.example.com/library/pytorch:latest
```

## 相关文件

- `frontend/src/pages/user/jobs/index.tsx` - 作业提交表单

## 提交信息

```
revert: 恢复容器镜像三个下拉框选择方式

- 恢复之前的三个下拉框UI（项目/仓库/标签）
- 移除镜像选择Modal弹窗
- 每个下拉框级联显示，更直观
- 选择标签时自动获取Harbor URL并填入完整镜像地址
- 保留直接输入镜像地址的选项
- 修复镜像选择体验，避免显示'暂无镜像'问题
```

提交哈希：`b2a10f4c`
