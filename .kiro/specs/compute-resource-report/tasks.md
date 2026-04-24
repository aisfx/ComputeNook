# 实现计划：报表中心（compute-resource-report）

## 概述

按照设计文档，分步实现后端报表 API、前端报表页面及测试。每个任务均可独立执行，后续任务在前序任务基础上构建。

## 任务

- [x] 1. 后端：定义报表数据结构与聚合函数
  - [x] 1.1 在 `backend/handlers/report.go` 中定义响应结构体
    - 定义 `JobStatsResult`、`MonthlyJobCount`、`JobScaleItem`、`UsageStatsResult`、`StorageStatItem`、`QuotaStatsResult` 结构体
    - 实现 `parseTimeParams(c *gin.Context) (time.Time, time.Time, error)` 公共时间参数解析函数（复用 usage.go 中的解析逻辑）
    - _需求：1.1、1.2、1.3、2.1、3.1、4.1_

  - [x] 1.2 实现聚合计算纯函数
    - 实现 `buildMonthlyJobCounts(records []slurm.UsageRecord, partition string) []MonthlyJobCount`
    - 实现 `buildJobScaleDistribution(records []slurm.UsageRecord) []JobScaleItem`（按 CPU 核数分组：1-4、5-16、17-64、64+）
    - 实现 `calcAvgWaitTimeMinutes(records []slurm.UsageRecord) float64`
    - 实现 `calcUsageStatus(used, total float64) string`（返回 NORMAL/WARNING/EXCEEDED）
    - 实现 `buildStorageStatItem(username string, quotas []QuotaInfo) StorageStatItem`（含 over_soft_limit 标记）
    - _需求：1.1、1.2、1.3、2.2、3.4、4.3、4.4_

  - [ ]* 1.3 为聚合函数编写属性测试
    - **属性 3：配额使用率计算与状态分类正确性**
    - **属性 6：存储超软限制标记一致性**
    - **属性 7：聚合统计分组之和等于总数**
    - **属性 8：平均等待时间计算正确性**
    - 使用 `gopter` 库，每个属性至少 100 次随机输入
    - _需求：1.1、1.2、1.3、2.2、3.4、4.3、4.4_

- [x] 2. 后端：实现报表 Handler 函数

  - [x] 2.1 实现 `GetJobStats` Handler（`GET /api/reports/jobs`）
    - 从 JWT context 获取 `username` 和 `isAdmin`
    - 普通用户：强制 `queryUser = username`；管理员：使用请求参数中的 `user`（可为空表示全部）
    - 调用 `Slurm_Client.GetUserUsage` 或 `GetAccountUsage` 获取作业记录
    - 支持 `partition` 参数过滤
    - 调用聚合函数构建响应，无数据时返回零值结构（HTTP 200）
    - _需求：1.1、1.2、1.3、1.4、1.5、1.6、5.4、7.1、7.3_

  - [x] 2.2 实现 `GetUsageStats` Handler（`GET /api/reports/usage`）
    - 权限控制逻辑同 2.1
    - 调用 `Slurm_Client.GetUserUsage` 聚合 GPU/CPU/billing 小时数
    - 调用 `Slurm_Client.GetAccountBillingLimit` 获取配额上限
    - 计算 `usage_percent` 和 `status`
    - _需求：2.1、2.2、2.3、2.4、2.5_

  - [x] 2.3 实现 `GetStorageStats` Handler（`GET /api/reports/storage`）
    - 普通用户：调用 `queryQuota(username, "")` 获取自身配额
    - 管理员：复用 `GetAllQuotas` 逻辑获取所有用户配额
    - 将 `QuotaInfo` 转换为 `StorageStatItem`，计算 `over_soft_limit`
    - 存储系统不可用时返回 HTTP 500 及明确错误信息
    - _需求：3.1、3.2、3.3、3.4、3.5_

  - [x] 2.4 实现 `GetQuotaStats` Handler（`GET /api/reports/quota`）
    - 普通用户：获取自身所属 Slurm account 的配额使用情况
    - 管理员：支持 `account` 参数查询指定账户，或返回所有账户汇总
    - 复用 `Slurm_Client.GetAccountUsageWithBilling` 逻辑
    - 无关联账户时返回空配额数据（HTTP 200）及说明字段
    - _需求：4.1、4.2、4.3、4.4、4.5、4.6_

  - [ ]* 2.5 为 Handler 编写集成测试（DEV_MODE）
    - **属性 1：普通用户权限隔离**——验证普通用户无法通过参数查询他人数据
    - **属性 2：管理员可查询指定用户数据**——验证管理员 user=X 参数生效
    - **属性 4：队列过滤一致性**——验证 partition 参数过滤结果
    - **属性 5：空数据返回 200**——验证无数据时返回 200 及零值结构
    - _需求：1.4、1.5、1.6、5.4、7.1、7.2、7.3_

- [x] 3. 后端：注册路由

  - [x] 3.1 在 `backend/main.go` 中注册报表路由
    - 在 `auth` 路由组下新增 `reports` 子组
    - 注册 4 个端点：`GET /reports/jobs`、`/reports/usage`、`/reports/storage`、`/reports/quota`
    - _需求：7.4_

- [x] 4. 检查点——确保后端测试通过
  - 确保所有测试通过，如有问题请告知。

- [x] 5. 前端：新增报表 API 封装

  - [x] 5.1 创建 `src/api/report.ts`
    - 实现 `reportAPI.getJobStats(params)`、`getUsageStats(params)`、`getStorageStats(params)`、`getQuotaStats(params)`
    - 参数类型：`{ start_time, end_time, partition?, user? }`
    - _需求：5.1、5.2、5.3、5.4_

- [x] 6. 前端：重构并扩展 Reports.vue

  - [x] 6.1 实现筛选条件区域
    - 日期选择器（默认最近 30 天）
    - 队列下拉（调用 `/api/jobs/partitions/list` 动态获取，含"全部"选项）
    - 报表类型切换 Tab（作业统计、卡时/核时、存储用量、配额情况）
    - 日期范围校验：start > end 时提示并禁用查询按钮
    - _需求：5.1、5.2、5.3、5.5_

  - [x] 6.2 实现作业统计报表 Tab
    - 使用 ECharts 柱状图展示每月各队列新建作业数（`monthly_job_counts`）
    - 展示平均等待时间（`avg_wait_time_minutes`）数值卡片
    - 使用 ECharts 饼图展示作业规模分布（`job_scale_distribution`）
    - 无数据时展示空状态提示
    - _需求：1.1、1.2、1.3、1.6_

  - [x] 6.3 实现卡时/核时使用量报表 Tab
    - 展示 GPU 小时数、CPU 小时数数值卡片
    - 展示使用比例进度条（颜色随 `status` 变化：NORMAL=绿、WARNING=橙、EXCEEDED=红）
    - 无配额限制（`quota_billing_hours=0`）时标注"无限制"
    - _需求：2.1、2.2、2.5、4.2、4.3、4.4_

  - [x] 6.4 实现存储用量报表 Tab
    - 以表格展示存储配额数据（用户名、文件系统、已用量、软限制、硬限制、使用率）
    - 超软限制的行以警告样式（橙色背景或图标）高亮
    - _需求：3.1、3.4_

  - [x] 6.5 实现用户配额情况报表 Tab
    - 展示计费核时总量、已用量、剩余量数值卡片
    - 展示使用率进度条（颜色逻辑同 6.3）
    - 无关联账户时展示说明信息
    - _需求：4.1、4.2、4.3、4.4、4.6_

  - [x] 6.6 实现 CSV 导出功能
    - 导出当前 Tab 的数据为 UTF-8 CSV 文件
    - 文件名格式：`report-{type}-{startDate}-{endDate}.csv`
    - 无数据时禁用导出按钮
    - _需求：6.1、6.2、6.3、6.4_

  - [ ]* 6.7 为前端工具函数编写测试
    - **属性 9：CSV 导出 round-trip 一致性**——导出后解析，数值字段与原始数据等价
    - **属性 10：日期范围校验**——对任意 start > end 输入，校验函数返回 false
    - _需求：5.5、6.2_

- [x] 7. 最终检查点——确保所有测试通过
  - 确保所有测试通过，如有问题请告知。

## 备注

- 标有 `*` 的子任务为可选测试任务，可跳过以加快 MVP 交付
- 每个任务均引用了具体需求编号，便于追溯
- 属性测试使用 `gopter` 库（Go），每个属性至少 100 次随机输入
- 前端测试可使用 Vitest（项目已有 vite 配置）
