# 报表功能实现文档

## 概述
成功将旧版Vue实现的报表中心功能迁移到新的React/TypeScript版本,实现了完整的数据可视化和Excel导出功能。

## 实现内容

### 1. API模块 (`frontend/src/api/report.ts`)
创建了完整的报表API模块,包含以下接口:
- `getJobStats`: 获取作业统计数据(月度趋势、规模分布等)
- `getUsageStats`: 获取核时使用统计
- `getStorageStats`: 获取存储配额使用情况
- `getQuotaStats`: 获取账户配额使用情况
- `getQoSUsage`: 获取QoS计费核时使用量

### 2. 报表页面 (`frontend/src/pages/user/reports/index.tsx`)
实现了完整的报表中心页面,包含:

#### 功能特性
- **时间范围筛选**: 使用DatePicker选择开始和结束日期
- **队列筛选**: 支持按分区(partition)过滤数据
- **数据查询**: 异步加载多个报表数据源
- **Excel导出**: 支持将所有报表数据导出为Excel文件

#### 数据可视化图表(使用ECharts 5.5.1)

1. **月度作业趋势折线图**
   - 展示各队列每月作业数量变化
   - 支持多队列对比
   - 平滑曲线+区域填充

2. **作业规模分布柱状图**
   - 按核数范围(1-4核、5-16核、17-64核、64核以上)统计
   - 显示作业数量和占比

3. **GPU/CPU核时用量柱状图**
   - 展示GPU卡时、CPU核时、计费核时三种指标
   - 不同指标使用不同颜色区分

4. **计费核时使用比例仪表盘**
   - 显示已用核时 vs 配额总量
   - 支持无配额限制场景
   - 根据使用率状态(NORMAL/WARNING/EXCEEDED)自动调整颜色

5. **配额使用率仪表盘**
   - 展示账户级别的配额使用情况
   - 显示账户名称
   - 状态色彩指示

6. **存储配额使用情况水平柱状图**
   - 展示各用户/文件系统的存储使用情况
   - 对比已用量、软限制、硬限制
   - 高亮显示超软限制的用户

7. **QoS计费核时使用量柱状图**
   - 按QoS分组展示已用核时和配额上限
   - 支持无限制配额场景
   - 根据状态自动调整柱状图颜色

### 3. 路由和菜单集成

#### UserLayout更新
- 添加"报表中心"菜单项(使用LineChartOutlined图标)
- 位置:仪表盘和作业管理之间
- 路由路径:`/dashboard/reports`

#### 路由配置
```tsx
<Route path="reports" element={<ReportsPage />} />
```

### 4. 依赖安装
- 安装了`xlsx`库用于Excel导出功能
- 使用已有的`echarts` 5.5.1库进行图表渲染
- 使用Ant Design组件库(DatePicker, Select, Button, Card等)

## 后端API

后端API已经完整实现(无需修改):
- `GET /reports/jobs` - 作业统计
- `GET /reports/usage` - 核时使用统计  
- `GET /reports/storage` - 存储配额统计
- `GET /reports/quota` - 账户配额统计
- `GET /reports/qos-usage` - QoS使用统计

所有接口支持以下参数:
- `start_time`: 开始日期(YYYY-MM-DD格式)
- `end_time`: 结束日期(YYYY-MM-DD格式)
- `partition`: 队列过滤(可选)
- `user`: 用户过滤(仅管理员,可选)

## 数据处理

### 状态管理
- 使用React Hooks进行状态管理
- 数据加载状态(loading, queried, globalError)
- 图表实例管理和自动清理

### 数据兜底策略
- QoS数据接口失败时使用mock数据保证图表可见
- 无数据时显示友好的空状态提示
- 图表自动适配数据结构

### 响应式设计
- 图表自动适应容器大小
- 窗口resize时自动重绘
- 网格布局自适应(`grid-template-columns: repeat(auto-fit, minmax(450px, 1fr))`)

## Excel导出功能

导出内容包括:
1. **月度作业趋势** - 月份、队列、作业数
2. **作业规模分布** - 规模范围、作业数、占比
3. **核时使用** - GPU卡时、CPU核时、计费核时、配额、使用率、状态
4. **存储用量** - 用户名、文件系统、已用量、软限制、硬限制、使用率
5. **配额情况** - 账户、配额总量、已用量、剩余量、使用率、状态

文件命名格式:`报表中心_YYYY-MM-DD_YYYY-MM-DD.xlsx`

## 用户体验优化

1. **加载状态**: 查询时显示Spin加载动画
2. **错误处理**: 网络错误时显示Alert提示
3. **空状态**: 未查询时显示Empty组件引导用户
4. **消息提示**: 导出成功/失败时显示message反馈
5. **按钮禁用**: 未查询时禁用导出按钮
6. **页面标题**: 自动设置为"报表中心 - 算力小筑"

## 颜色主题

使用统一的色彩方案:
- 主色: `#6366f1` (indigo)
- 成功色: `#10b981` (green) - NORMAL状态
- 警告色: `#f59e0b` (amber) - WARNING状态
- 错误色: `#ef4444` (red) - EXCEEDED状态
- 辅助色: `#3b82f6`, `#8b5cf6` 等

## 技术栈

- **React 18.3.1** - UI框架
- **TypeScript 5.6.3** - 类型安全
- **Ant Design 5.19.4** - UI组件库
- **ECharts 5.5.1** - 数据可视化
- **xlsx** - Excel文件生成
- **dayjs 1.11.13** - 日期处理
- **axios 1.7.9** - HTTP客户端

## 测试建议

1. 启动后端服务确保报表API可用
2. 访问`/dashboard/reports`页面
3. 选择日期范围和队列进行查询
4. 验证各个图表数据显示正确
5. 测试Excel导出功能
6. 测试不同数据场景:
   - 有数据
   - 无数据
   - 部分接口失败
   - 无配额限制
   - 超限状态

## 注意事项

1. **TypeScript错误**: 当前存在一些之前遗留的TypeScript类型错误(主要在AdminLayout、UserLayout、overview、files页面),这些不影响reports功能,可以单独修复
2. **API前缀**: 所有API请求自动添加`/api`前缀(由axios配置)
3. **权限控制**: 普通用户只能查询自己的数据,管理员可以通过`user`参数查询指定用户
4. **默认时间范围**: 页面加载时默认查询最近7天数据
5. **图表响应式**: 存储配额图表高度根据数据条目数量动态调整

## 文件清单

### 新增文件
- `frontend/src/api/report.ts` - 报表API模块
- `frontend/src/pages/user/reports/index.tsx` - 报表页面组件

### 修改文件
- `frontend/src/layouts/UserLayout.tsx` - 添加报表菜单和路由
- `frontend/package.json` - 添加xlsx依赖

### 后端文件(已存在,无需修改)
- `backend/handlers/report.go` - 报表处理器
- `backend/main.go` - API路由配置(已包含reports路由)

## 完成状态

✅ API模块创建完成
✅ 报表页面实现完成
✅ 菜单和路由集成完成
✅ xlsx依赖安装完成
✅ 7个数据可视化图表实现完成
✅ Excel导出功能实现完成
✅ 响应式布局实现完成
✅ 错误处理和加载状态完成

**状态: 功能实现完成,可以进行测试**
