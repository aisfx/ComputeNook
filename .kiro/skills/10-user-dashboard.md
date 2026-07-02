# 用户仪表盘功能

## 概述
用户仪表盘（User Dashboard）是系统的核心功能页面，为用户提供集群资源、作业状态、配额信息的实时概览。

## 文件位置
- **前端**: `frontend/src/pages/user/dashboard/index.tsx`
- **后端**: `backend/handlers/dashboard.go`
- **路由**: `backend/main.go`

## 主要功能模块

### 0. 资源视图Tab切换（2026-07-03新增）
统一的资源视图，支持在作业、分区、节点之间快速切换：

**Tab选项**：
- **作业**：显示正在运行的作业列表（默认Tab）
- **分区**：显示分区信息（开发中）
- **节点**：显示节点状态表格

**交互设计**：
- Tab按钮组样式，带圆角和边框
- 当前激活Tab显示为primary类型
- 每个Tab显示对应的数据计数（Tag标签）
- 右上角显示"历史记录"链接（仅作业Tab）和"刷新"按钮

**实现方式**：
```typescript
const [activeViewTab, setActiveViewTab] = useState<'jobs' | 'partitions' | 'nodes'>('jobs')
```

### 1. 集群资源统计
显示集群总体资源使用情况：
- **节点**: 在线节点数 / 总节点数
- **CPU**: 已分配核数 / 总核数
- **GPU**: 已使用卡数 / 总卡数  
- **内存**: 已使用量 / 总量（支持GB/TB格式）

**API**: `GET /api/dashboard`
- 返回字段: `nodes`, `nodes_online`, `cpu_cores`, `cpu_usage`, `memory`, `memory_free`, `gpu_cards`, `gpu_in_use`

### 2. 节点状态表格
以表格形式展示所有计算节点的状态：
- **表格列**:
  - 节点名称（带状态指示灯：🟢在线 🔴离线 🟡其他）
  - 状态标签（idle/allocated/mixed/down等）
  - CPU: 总数 / 已用 / 使用率（进度条）
  - 内存: 总量 / 已用 / 使用率（进度条）
  - 运行作业数

**API**: `GET /api/monitoring/nodes`
- 返回字段: `name`, `state`, `cpu_total`, `cpu_allocated`, `cpu_usage_percent`, `memory_total_mb`, `memory_allocated_mb`, `memory_usage_percent`, `running_jobs`, `partitions`

**交互**:
- 点击表格行打开节点详情弹窗
- 详情弹窗显示GPU信息、分区列表等完整信息

### 3. 作业统计卡片
显示当前用户的作业状态分布：
- 运行中（RUNNING）- 蓝色
- 等待中（PENDING）- 橙色
- 已完成（COMPLETED）- 绿色
- 失败（FAILED）- 红色

**功能**:
- 点击各状态项跳转到作业管理页，自动按状态筛选
- 点击"历史记录"按钮打开作业历史弹窗，支持日期范围筛选和导出

### 4. 账户配额卡片
显示用户在各Slurm账户下的资源配额：
- **有配额限制**: 显示CPU使用百分比，超过70%显示橙色警告，超过90%显示红色告警
- **无限制有作业**: 显示当前使用的CPU核数，标注"⚠️ 无配额限制"
- **无限制无作业**: 显示"🎯 当前无运行作业" 空闲状态

**数据来源**: `GET /api/usage/my-resources`
- 返回: `associations` (账户关联), `qos_limits` (QoS限制)
- 合并账户和QoS信息计算配额

**显示信息**:
- CPU限额、节点限额、作业上限
- 分区、QoS名称
- 多账户时显示下拉选择器

### 5. 机时信息卡片
显示用户的计算机时配额和使用情况：
- **有配额**: 显示使用百分比、已用机时、剩余机时
- **无配额有使用**: 显示已用机时，标注"无配额限制"
- **无配额无使用**: 显示"暂无机时使用记录"

**API**: `GET /api/usage/billing-summary`
- 返回字段: `qos_name`, `total_quota`, `used_hours`
- 支持多QoS切换（胶囊tab形式）

**功能**:
- 点击"消费记录"打开机时历史弹窗
- 支持日期范围筛选、导出Excel

### 6. 存储配额卡片
显示用户的存储空间使用情况：
- **容量配额**: 已用 / 总量（支持MB/GB/TB格式）
- **文件数配额**: 已用文件数 / 上限

**API**: `GET /api/quota`
- 返回字段: `quota_used`, `quota_limit`, `files_used`, `files_limit`
- 未配置XFS配额系统时显示"未配置存储配额系统"

## 数据刷新机制

### 初始化加载
```typescript
useEffect(() => {
  refreshAll()
}, [])
```

只在组件挂载时执行一次，避免无限循环刷新。

### 手动刷新
用户点击右上角"刷新"按钮，并发请求所有数据：
```typescript
const refreshAll = async () => {
  await Promise.all([
    loadDashboard(),
    loadJobStats(),
    loadNodes(),
    loadAccountQuotas(),
    loadMachineTime(),
    loadStorageQuota()
  ])
}
```

## 常见问题与修复

### 问题1: 无限刷新
**原因**: `useEffect([loadData])` 将函数作为依赖，每次渲染都创建新函数导致循环
**修复**: 改为 `useEffect([])` 只在挂载时执行

### 问题2: API 404错误
**原因**: 后端缺少 `/api/dashboard` 和 `/api/monitoring/nodes` 路由
**修复**: 在 `backend/main.go` 添加路由映射，实现对应handler函数

### 问题3: 字段名不匹配
**原因**: 前端期望的字段名与后端返回的不一致（如 `real_memory` vs `memory_total_mb`）
**修复**: 统一前端接口定义，使用后端实际返回的字段名

### 问题4: 配额显示"无限制"
**原因**: QoS限制从`tres.total`读取，应从`tres.per.user`读取
**修复**: 后端正确提取per-user限制，前端正确解析QoS数据

### 问题5: 内存显示NaN
**原因**: 前端字段名错误（`real_memory` vs `memory_total_mb`）
**修复**: 更新TypeScript接口定义和字段引用

## 布局规范

### 卡片布局（2026-07-02更新）
所有统计卡片采用**左右布局**，不再使用固定高度：
- **左侧区域**：显示主要指标
  - 大数字（48px字体）
  - 百分比或核数
  - emoji图标（空状态时）
  - 固定宽度：约100px（`flex: 0 0 auto; minWidth: 100`）
  
- **右侧区域**：显示详细信息
  - 状态列表/明细项
  - 补充说明文字
  - 自适应宽度（`flex: 1`）

- **整体容器**：
  - `display: flex; alignItems: center; gap: 20px`
  - `padding: 12px 0`
  - 无固定高度，自适应内容

### 卡片高度
- ~~集群资源统计卡片: 自适应~~（保持不变）
- ~~四个图表卡片（作业/配额/机时/存储）: 固定 320px~~（已废弃）
- ✅ **新布局**：所有卡片自适应高度，根据内容动态调整
- ✅ 优点：不会出现内容被截断的问题，适配各种数据量

### 响应式布局
- 桌面: 4列布局 `<Col span={6}>`
- 平板: 2列布局
- 移动: 1列布局

### 字体大小规范
- 主数字: 42-48px
- 说明文字: 12-13px
- 列表项: 12-13px
- 卡片标题: 14px

### 颜色规范
- 运行中/在线: `#3b82f6` (蓝色)
- 等待中/警告: `#f59e0b` (橙色)
- 成功/完成: `#10b981` (绿色)
- 失败/错误: `#ef4444` (红色)
- 文字说明: `#9ca3af` (灰色)
- 主要数据: `#667eea` (紫蓝)

## 性能优化

1. **useCallback包装数据加载函数**，避免不必要的重新创建
2. **并发请求数据**，使用 `Promise.all` 提高加载速度
3. **错误静默处理**，单个接口失败不影响其他模块显示
4. **条件渲染**，数据未加载完成前显示骨架屏或Empty状态

## 开发注意事项

1. **useEffect依赖**: 永远使用空数组`[]`作为依赖，只在挂载时加载
2. **字段名一致性**: 前端TypeScript接口必须与后端返回字段完全匹配
3. **单位转换**: 内存统一用MB传输，前端格式化为GB/TB显示；机时统一用小时
4. **权限控制**: 管理员看全局统计，普通用户看可用资源
5. **错误处理**: 所有API调用必须try-catch，失败时console.error输出
6. **数据兜底**: 所有数据字段使用 `|| 0` 或 `|| []` 提供默认值，防止undefined

## 测试检查清单

- [ ] 页面加载无无限刷新
- [ ] 所有API返回200状态码
- [ ] 集群资源统计数字正确
- [ ] 节点表格显示完整，内存不为NaN
- [ ] 点击节点行能打开详情弹窗
- [ ] 作业统计数字正确，点击能跳转
- [ ] 账户配额显示逻辑正确（有限制/无限制）
- [ ] 机时信息显示正确，无配额时有提示
- [ ] 存储配额显示正确，未配置时有提示
- [ ] 多账户/多QoS时切换功能正常
- [ ] 历史记录弹窗数据加载正确
- [ ] 导出功能正常
- [ ] 响应式布局在不同屏幕尺寸下正常
- [ ] 卡片内容不被截断

## 相关文档

- `/api/dashboard` - 集群统计接口文档
- `/api/monitoring/nodes` - 节点状态接口文档
- `/api/usage/my-resources` - 用户资源接口文档
- `/api/usage/billing-summary` - 机时汇总接口文档
- `/api/quota` - 存储配额接口文档
- Slurm REST API 文档
- Ant Design Table组件文档
- Ant Design Progress组件文档
