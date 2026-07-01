# 模板管理面板实现文档

## 实现内容

### 模板管理面板 (`/dashboard/jobs` 右侧面板 - 模板管理标签)

已完成从原Vue版本到React版本的基础功能迁移。

## 功能特性

### 1. 面板布局

**顶部标题栏**：
- 📄 作业模板库 标题
- ➕ 新建模板按钮（右上角）

**作业类型切换**：
- ⚙️ 普通作业（激活状态 - 蓝色背景）
- 🐳 容器作业（默认状态 - 灰色背景）

**应用分类筛选**：
- 全部（激活状态 - 主色调按钮）
- CFD
- 化学
- 分子动力学
- AI训练
- AI推理
- 通用

### 2. 模板卡片

每个模板卡片包含：

**顶部信息**：
- 图标 + 模板名称
- 标签组：
  - 🌐 公共（公共模板标识）
  - 分类标签（CFD、化学等）

**描述信息**：
- 简短的模板描述文字

**资源规格**：
- 📦 节点数
- ⚡ CPU核数
- 💾 内存大小
- ⏱️ 时间限制

**操作按钮**：
- 🚀 使用模板（主按钮）
- 📄 查看配置
- ✏️ 编辑模板

**交互效果**：
- 鼠标悬停时：
  - 边框变蓝色
  - 背景变白色
  - 添加阴影效果

### 3. 样式特点

**整体风格**：
- 紧凑型布局（适配460px宽度面板）
- 小字号（10-13px）确保信息密度
- 卡片式设计，清晰分隔

**颜色系统**：
- 主色调：蓝色 (#1890ff)
- 背景色：浅灰 (#fafafa)
- 边框色：灰色 (#e8e8e8)
- 文字色：深灰 (#666) / 浅灰 (#888)

**间距规范**：
- 外边距：16px（面板padding）
- 卡片间距：12px
- 内部间距：8-12px
- 按钮间距：4-6px

### 4. 当前实现状态

✅ **已实现**：
- 模板管理面板基础布局
- 作业类型切换按钮（UI）
- 应用分类筛选按钮（UI）
- 模板卡片展示（使用快速模板数据）
- 卡片悬停效果
- 使用模板按钮（调用已有applyTemplate函数）
- 空状态展示

⏳ **待实现**（可根据需要扩展）：
- 新建模板功能
- 编辑模板功能
- 查看配置功能
- 删除模板功能
- 作业类型切换逻辑
- 分类筛选逻辑
- 从后端API加载完整模板列表
- 模板搜索功能
- 模板排序功能

## 对比原Vue版本

### 保持一致的特性

✅ 顶部标题 + 新建按钮
✅ 作业类型切换（普通/容器）
✅ 应用分类筛选
✅ 模板卡片展示
✅ 卡片信息结构（图标、名称、标签、规格、操作）
✅ 紧凑的布局设计

### 简化的功能

当前版本为了快速实现，做了以下简化：

1. **模板数据源**：使用快速模板数据（`templates`）而不是完整的模板库
2. **分类逻辑**：UI展示，但未实现实际筛选
3. **模态框功能**：未实现新建/编辑/查看配置的模态框
4. **容器作业**：未实现容器作业相关的特殊字段展示

这些功能可以根据实际需求逐步添加。

## 技术实现细节

### 1. 布局结构

```tsx
<div style={{ padding: '16px', overflowY: 'auto' }}>
  {/* 头部：标题 + 新建按钮 */}
  <div>
    <h3>📄 作业模板库</h3>
    <Button>新建模板</Button>
  </div>
  
  {/* 作业类型标签 */}
  <div>
    <Button>⚙️ 普通作业</Button>
    <Button>🐳 容器作业</Button>
  </div>
  
  {/* 应用分类 */}
  <div>
    {categories.map(cat => <Button>{cat}</Button>)}
  </div>
  
  {/* 模板列表 */}
  <div>
    {templates.map(tpl => (
      <div key={tpl.id} className="template-card">
        {/* 卡片内容 */}
      </div>
    ))}
  </div>
</div>
```

### 2. 卡片样式实现

使用内联样式实现响应式交互：

```tsx
<div
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
```

优点：
- 直接控制DOM样式，性能好
- 过渡动画流畅
- 不需要额外的CSS类

### 3. 数据复用

直接使用已有的 `templates` 数组：

```tsx
{templates.slice(0, 3).map((tpl) => (
  <div key={tpl.id}>
    {/* 模板卡片 */}
  </div>
))}
```

- `.slice(0, 3)` 限制显示3个模板（避免面板过长）
- 复用 `applyTemplate(tpl)` 函数处理模板应用

### 4. 空状态处理

```tsx
{templates.length === 0 && (
  <Empty
    image={Empty.PRESENTED_IMAGE_SIMPLE}
    description="暂无模板"
    style={{ padding: '40px 0' }}
  />
)}
```

## API接口（待实现）

当需要完整实现时，需要以下API：

### 1. 获取模板列表
```
GET /api/app-templates
Query: 
  - job_type: 'normal' | 'container'
  - category: 'cfd' | 'chemistry' | 'md' | 'ai' | ...
Response:
  {
    data: [
      {
        id: string
        name: string
        icon: string
        description: string
        jobType: 'normal' | 'container'
        category: string
        appType: string
        partition: string
        nodes: number
        cpus: number
        memory: string
        gpus: number
        time: number
        isPublic: boolean
        owner: string
        scriptContent: string
        containerImage?: string
        ...
      }
    ]
  }
```

### 2. 创建模板
```
POST /api/app-templates
Body: { 模板数据 }
```

### 3. 更新模板
```
PUT /api/app-templates/:id
Body: { 更新的字段 }
```

### 4. 删除模板
```
DELETE /api/app-templates/:id
```

### 5. 设置公共模板
```
POST /api/app-templates/:id/public
```

## 扩展建议

### 短期优化（1-2小时）

1. **实现分类筛选逻辑**：
```tsx
const [selectedCategory, setSelectedCategory] = useState('all')
const filteredTemplates = templates.filter(t => 
  selectedCategory === 'all' || t.category === selectedCategory
)
```

2. **实现作业类型切换**：
```tsx
const [jobType, setJobType] = useState<'normal' | 'container'>('normal')
// 切换时重新加载对应类型的模板
```

3. **添加加载状态**：
```tsx
const [loading, setLoading] = useState(false)
{loading ? <Spin /> : <TemplateList />}
```

### 中期完善（半天）

1. **实现新建模板功能**：
   - 添加模态框组件
   - 表单验证
   - API调用

2. **实现编辑功能**：
   - 权限检查（只能编辑自己的或管理员）
   - 表单预填充
   - 更新API调用

3. **实现查看配置功能**：
   - 显示完整的脚本内容
   - 代码高亮
   - 复制/下载功能

### 长期增强（1天）

1. **完整的模板库管理**：
   - 搜索功能
   - 排序功能
   - 批量操作

2. **容器作业特性**：
   - 镜像选择
   - 挂载点配置
   - 环境变量设置

3. **模板共享机制**：
   - 公共/私有切换
   - 用户收藏
   - 使用统计

## 测试建议

### 功能测试
1. ✅ 点击"模板管理"标签，面板应该切换
2. ✅ 模板卡片应该正确展示
3. ✅ 鼠标悬停时应该有高亮效果
4. ✅ 点击"使用模板"应该应用到提交表单
5. ✅ 空状态应该正确显示

### 样式测试
1. ✅ 面板宽度460px内容应该合理排布
2. ✅ 卡片间距均匀
3. ✅ 文字大小适中，可读性好
4. ✅ 按钮大小一致
5. ✅ 颜色搭配协调

### 交互测试
1. ✅ 悬停效果流畅
2. ✅ 按钮点击响应快速
3. ✅ 标签切换自然
4. ✅ 滚动流畅

## 文件修改

### 修改的文件
- `/Users/sunfx/workspace/ComputeNook/frontend/src/pages/user/jobs/index.tsx`

### 主要改动
1. 将"模板管理功能开发中..."占位符替换为完整的模板管理面板
2. 添加了 Empty 组件的导入
3. 实现了模板列表展示
4. 添加了分类筛选UI
5. 添加了作业类型切换UI
6. 实现了模板卡片的悬停效果

### 代码行数
- 模板管理面板代码：约150行

## 总结

模板管理面板已经实现了基础的UI和交互，包括：

✅ 完整的布局结构
✅ 作业类型切换UI
✅ 应用分类筛选UI
✅ 模板卡片展示
✅ 悬停交互效果
✅ 使用模板功能集成
✅ 空状态处理

当前版本可以满足基本的模板浏览和使用需求。如果需要完整的CRUD功能，可以根据上述扩展建议逐步实现。

**推荐使用流程**：
1. 用户点击"提交作业"按钮打开右侧面板
2. 切换到"模板管理"标签
3. 浏览模板列表
4. 点击"使用模板"应用到提交表单
5. 切回"提交作业"标签继续编辑和提交

整体实现简洁高效，与原Vue版本保持一致的视觉风格！
