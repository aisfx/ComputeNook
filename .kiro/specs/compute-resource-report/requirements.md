# 需求文档

## 简介

本功能为 HPC（高性能计算）集群管理平台新增"报表中心"模块，提供算力资源使用情况的可视化报表。报表涵盖作业统计、卡时/核时使用量、存储用量及用户配额等核心指标，支持按时间范围和队列（分区）筛选。系统通过权限控制确保普通用户只能查看自身数据，管理员可查看全局数据。

## 术语表

- **Report_Center**：报表中心模块，负责聚合和展示算力资源使用数据
- **Report_API**：后端报表数据接口，负责从 Slurm 及存储系统聚合数据并返回
- **Report_View**：前端报表页面（Vue.js 组件），负责展示图表和数据表格
- **Auth_Middleware**：已有的 JWT 认证中间件（backend/middleware/auth.go）
- **Slurm_Client**：已有的 Slurm REST API 客户端（backend/slurm/）
- **普通用户**：通过 JWT 认证、isAdmin 为 false 的登录用户
- **管理员**：通过 JWT 认证、isAdmin 为 true 的登录用户
- **队列**：Slurm 中的 Partition（分区），作业提交的目标队列
- **卡时**：GPU 小时数，即 GPU 数量 × 运行时长（小时）
- **核时**：CPU 小时数，即 CPU 核数 × 运行时长（小时）
- **计费核时**：基于 Slurm billing TRES 计算的计费小时数

---

## 需求

### 需求 1：作业统计报表

**用户故事：** 作为一名 HPC 用户，我希望查看指定时间范围内各队列的作业统计数据，以便了解我的作业提交和运行情况。

#### 验收标准

1. WHEN 用户访问报表中心并选择时间范围，THE Report_View SHALL 展示该时间段内每月各队列新建作业数量的统计图表
2. WHEN 用户选择时间范围，THE Report_View SHALL 展示该时间段内作业平均等待时间（从提交到开始运行的时长，单位：分钟）
3. WHEN 用户选择时间范围，THE Report_View SHALL 展示作业规模分布（按所用 CPU 核数或节点数分组的作业数量）
4. WHEN 普通用户查询报表，THE Report_API SHALL 仅返回该用户自身的作业数据
5. WHEN 管理员查询报表，THE Report_API SHALL 返回所有用户的作业数据
6. IF 指定时间范围内无作业数据，THEN THE Report_View SHALL 展示空状态提示而非报错

### 需求 2：卡时/核时使用量报表

**用户故事：** 作为一名 HPC 用户，我希望查看我的卡时和核时使用情况，以便合理规划算力资源的使用。

#### 验收标准

1. WHEN 用户访问报表中心，THE Report_View SHALL 展示指定时间范围内的 GPU 小时数（卡时）和 CPU 小时数（核时）
2. WHEN 用户访问报表中心，THE Report_View SHALL 展示卡时/核时使用比例（已用量占配额总量的百分比）
3. WHEN 普通用户查询卡时/核时数据，THE Report_API SHALL 仅聚合该用户名下的作业记录
4. WHEN 管理员查询卡时/核时数据，THE Report_API SHALL 支持按账户（account）或全局聚合
5. IF 用户无配额限制（billing 为 0），THEN THE Report_View SHALL 展示实际使用量并标注"无限制"

### 需求 3：存储用量报表

**用户故事：** 作为一名 HPC 用户，我希望查看我的存储配额使用情况，以便及时清理文件避免超额。

#### 验收标准

1. WHEN 用户访问报表中心，THE Report_View SHALL 展示当前存储已用量、配额上限及使用百分比
2. WHEN 普通用户查询存储数据，THE Report_API SHALL 仅返回该用户自身的配额信息
3. WHEN 管理员查询存储数据，THE Report_API SHALL 返回所有用户的存储配额汇总
4. IF 存储使用量超过软限制（block_soft），THEN THE Report_View SHALL 以警告样式高亮显示该条目
5. IF 存储系统不可用或查询失败，THEN THE Report_API SHALL 返回明确的错误信息而非空数据

### 需求 4：用户配额情况报表

**用户故事：** 作为一名 HPC 用户，我希望查看我的算力配额使用情况，以便了解剩余可用资源。

#### 验收标准

1. WHEN 用户访问报表中心，THE Report_View SHALL 展示用户的计费核时配额总量、已用量和剩余量
2. WHEN 用户访问报表中心，THE Report_View SHALL 以进度条形式展示配额使用百分比
3. WHEN 配额使用率达到 80% 及以上，THE Report_View SHALL 以警告色（橙色）展示进度条
4. WHEN 配额使用率达到 100% 及以上，THE Report_View SHALL 以超限色（红色）展示进度条
5. WHEN 管理员查询配额数据，THE Report_API SHALL 返回所有账户的配额使用汇总
6. IF 用户无关联的 Slurm 账户，THEN THE Report_API SHALL 返回空配额数据并附带说明信息

### 需求 5：时间范围与队列筛选

**用户故事：** 作为一名 HPC 用户，我希望能够按时间范围和队列筛选报表数据，以便聚焦于特定时段或特定队列的使用情况。

#### 验收标准

1. THE Report_View SHALL 提供开始日期和结束日期选择器，默认展示最近 30 天的数据
2. WHEN 用户选择时间范围后点击查询，THE Report_View SHALL 重新加载并展示该时间段的数据
3. THE Report_View SHALL 提供队列（分区）下拉筛选，选项从 Slurm 分区列表动态获取
4. WHEN 用户选择特定队列，THE Report_API SHALL 仅返回该队列下的作业统计数据
5. IF 用户提交的开始日期晚于结束日期，THEN THE Report_View SHALL 提示日期范围无效并阻止查询

### 需求 6：数据导出

**用户故事：** 作为一名 HPC 用户，我希望能够将报表数据导出为 CSV 文件，以便进行离线分析。

#### 验收标准

1. WHEN 报表数据加载完成，THE Report_View SHALL 提供"导出 CSV"按钮
2. WHEN 用户点击导出，THE Report_View SHALL 将当前展示的报表数据导出为 UTF-8 编码的 CSV 文件
3. THE Report_View SHALL 在导出的 CSV 文件名中包含报表类型和时间范围信息
4. WHEN 报表无数据时，THE Report_View SHALL 禁用导出按钮

### 需求 7：权限控制

**用户故事：** 作为系统管理员，我希望确保用户只能查看自己的数据，以保护数据隐私。

#### 验收标准

1. WHEN 普通用户请求报表数据，THE Report_API SHALL 从 JWT token 中提取用户名并强制限定查询范围为该用户
2. WHEN 管理员请求报表数据，THE Report_API SHALL 允许查询任意用户或全局数据
3. IF 普通用户尝试通过 API 参数查询其他用户的数据，THEN THE Report_API SHALL 忽略该参数并仅返回当前用户数据
4. IF 请求未携带有效 JWT token，THEN THE Report_API SHALL 返回 HTTP 401 状态码
