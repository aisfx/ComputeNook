# Changelog

## [Unreleased]

## [0.4.1] - 2026-05-16

### Added
- **机时管理单位统一**：AdminQoS 和 AdminHours 两个页面的总机时字段统一使用小时为单位，编辑时输入小时数，系统自动换算为分钟写入 Slurm
- **Dashboard 多 QoS 机时切换**：用户绑定多个有机时限制的 QoS 时，机时信息卡片顶部显示胶囊 tab，可切换查看各 QoS 的已用/剩余/使用率
- **创建用户自动绑定同名 QoS**：创建用户时，若 Slurm 中存在与用户名同名的 QoS，自动创建 Association 并绑定，无需手动操作

### Fixed
- **QoS 资源限制写入位置修正**：CPU / 内存 / 节点 / GPU 限制从 `tres.total`（全局总量）改为写入 `tres.per.user`（per-user 限制），与 Slurm 语义一致，修复设置后前端仍显示"无限制"的问题
- **账户配额卡片数据来源修正**：从 `tres.per.user` 正确提取 CPU / 节点 / 作业数限制，修复配额始终显示"无限制"的问题
- **Dashboard QoS 名称字段修正**：`me/resources` 接口返回的 QoS 名称字段为 `name`，修复前端读取 `qos_name` 导致 tab 标签为空的问题

## [0.4.0] - 2026-05-15

### Added
- **Web Shell 会话持久化**：使用 `<KeepAlive>` 保持 WebShell 组件状态，切换页面后 WebSocket 连接不断开，回到 Shell 页面时会话依然在线
- **文件上传后台持续**：上传任务提升为全局状态（`uploadManager.ts`），切换到其他页面上传不中断，右下角进度面板全局可见
- **登录验证码放大**：图形验证码生成尺寸从 160×60 提升至 240×80，前端显示高度同步增大，字符更清晰易读

### Fixed
- 修复 Layout.vue 中 `<KeepAlive>` 与 `v-else-if` 混用导致条件渲染链断裂的问题，所有页面组件改为独立 `v-if`
- 修复 FileManager.vue 上传任务类型定义过窄（`status: 'pending' as const`）导致的 7 处 TypeScript 编译错误

## [Unreleased - 待发布]

### Added
- 数据库支持（SQLite 默认 / MySQL 可选），作业模板从 TOML 文件迁移至数据库存储，支持动态增删改查
- 提供 `make migrate-templates` 迁移工具，将现有 `app-templates.toml` 导入数据库
- Redis 缓存集成，提升高频查询性能；支持分布式锁，用于桌面会话创建等临界区保护
- 容器作业智能识别：基于 `--container-image` 参数自动判断，作业详情页仅对容器作业显示「进入容器」和「保存镜像」按钮

## [0.3.0] - 2026-04-25

### Added
- **多因子认证（MFA / TOTP）**
  - 新增 `MFA_ENABLED` 配置项，支持三种模式：`false`（关闭）、`optional`（用户自选）、`global`（全局强制）
  - 登录流程：密码验证通过后，若需要 MFA 则返回临时 token，前端弹出 TOTP 验证码输入框
  - 首次绑定：`global` 模式下未绑定用户自动跳转绑定页，扫描二维码后输入验证码完成绑定
  - 绑定页支持"无法扫码"备用方案，可手动复制密钥到 Authenticator App
  - 管理员可在用户管理页查看所有用户 MFA 绑定状态，并一键重置
  - Web Shell 和 SSH 隧道连接时，若用户已绑定 MFA，需额外输入 TOTP 验证码
  - MFA 密钥存储在 `mfa_secrets.json`（权限 0600），支持 `MFA_STORE_FILE` 环境变量自定义路径
  - 兼容 Google Authenticator、Authy 等标准 TOTP 应用

- **账户锁定 + 图形验证码**
  - 登录失败 1 次后出现图形验证码（`/api/captcha/new` + `/api/captcha/:id.png`）
  - 连续失败 3 次锁定账户 10 分钟，前端显示倒计时
  - 锁定基于用户名（非 IP），防止账号暴力破解

- **安全加固**
  - CORS：生产模式下未配置 `CORS_ORIGINS` 时拒绝所有跨域请求，仅 `DEV_MODE=true` 时放行
  - WebSocket 来源校验：`wsUpgrader` 和 `vncWsUpgrader` 统一使用 `checkWebSocketOrigin`，与 CORS 策略一致
  - 用户列表分页：`GET /api/users` 支持 `page`/`limit` 参数，最大 100 条，防止枚举
  - 参数注入过滤：全局中间件拦截含 `[$]` 或 `__` 的查询参数，返回 400
  - Token 有效期：默认从 24 小时缩短为 8 小时，支持 `JWT_EXPIRE_HOURS` 自定义
  - IP 级速率限制收紧：5 次/10 分钟窗口，锁定 5 分钟

- **报表数据一致性**
  - AdminAudit 报表 tab 补充 QoS 计费核时使用率图表，与 Reports.vue 数据维度对齐
  - 修复 tab 切换时 echarts `resize` 的 TypeScript `never` 类型错误

### Fixed
- MFA `GetMFAMode` 自动去除行内注释（`# ...`）和首尾空格，避免 `.env` 注释污染配置值
- MFA 存储并发 bug：统一使用单一 `sync.Mutex` 保护读-改-写全程，修复写入丢失问题
- MFA 文件路径自动探测工作目录，支持 `MFA_STORE_FILE` 环境变量显式指定
- `ratelimit.go` 中 `int(lockDur - now.Sub(a.lockedAt)).Seconds()` 类型错误

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
