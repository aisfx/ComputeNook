# Changelog

## [Unreleased]

## [0.2.1] - 2026-04-18

### Fixed
- 修复按钮及图标 emoji 乱码问题，字体栈新增中文字体（Noto Sans SC、PingFang SC、Microsoft YaHei）及 emoji 字体支持
- 修复所有对话框（modal）在输入内容时因点击背景意外关闭的问题，统一添加 `@click.self` 事件保护
- 修复 Profile.vue 编辑个人信息弹窗未使用 `Teleport to="body"` 导致层叠上下文异常的问题

## [0.2.0] - 2026-04-16

### Added
- 仪表盘新增「账户配额」图表卡片，以甜甜圈图展示用户在各 Slurm 账户下的 CPU 使用率，支持多账户切换
- 作业详情弹窗新增「恢复作业」按钮，支持对 SUSPENDED 状态作业执行恢复操作

### Changed
- 仪表盘图表行由 3 列扩展为 4 列（作业统计 / 账户配额 / 机时信息 / 存储配额）
- 存储配额卡片移至图表行最后位置
- 仪表盘作业统计（loadJobStats）和历史记录（loadJobHistory）固定传入当前用户名，管理员在仪表盘也只查看自己的作业
- 暂停作业成功后不再关闭详情弹窗，改为将状态更新为 SUSPENDED
- 修复 suspendJob / cancelJob 中硬编码 `http://localhost:8080`，改为读取 `VITE_API_URL` 环境变量
- 账户配额下拉列表按 account 去重，避免同一账户因多分区 association 重复出现

### Fixed
- 点击「暂停作业」按钮无反应的问题（API 路径正确但错误被静默吞掉，改用 console.error + window.alert 输出）

---

## [0.1.0] - 2026-04-15

### Added
- 仪表盘：集群概览、节点状态、CPU/GPU/内存实时统计、作业统计饼图
- 作业管理：作业列表、提交作业、作业模板库（CFD/化学/AI/ML 等预设模板）
- Web Shell：浏览器内 SSH 终端，支持多节点连接
- 远程桌面：VNC 远程访问计算节点图形界面
- 文件管理：集群文件系统浏览、上传下载、重命名删除
- 报表中心：机时使用统计与报表导出
- 集群监控：Grafana 集成（管理员）
- 系统管理：用户/用户组、Slurm 账户/用户、QoS、资源绑定、机时管理、存储配额、数据审计
- 亮色/暗色双主题支持
- LDAP + JWT 认证
- Slurm REST API 集成
- 独立文件管理服务（Go）
