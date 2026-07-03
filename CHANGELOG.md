# Changelog

## [Unreleased]

### Fixed
- **文件管理器自动刷新问题修复**（2026-07-03 20:10）
  - 修复点击文件夹后导致页面不断自动刷新的循环依赖问题
  - 问题原因：useEffect 同时依赖 currentPath 和 loadDirectory，而 loadDirectory 又依赖 currentPath
  - 解决方案：
    - 将 loadDirectory 的 path 参数改为可选
    - 初始化时只在组件挂载时执行一次
    - 切换目录时显式传递新路径
    - 刷新当前目录时不传参数，使用当前 currentPath
  - 修改文件：`frontend/src/pages/user/files/index.tsx`

### Added
- **WebShell Mac快捷键支持优化**（2026-07-03 20:00）
  - Mac 系统使用 Cmd 键，其他系统使用 Ctrl 键
  - 自动检测平台并显示正确的快捷键符号（Mac: ⌘，其他: Ctrl）
  - 新增快捷键：
    - Cmd/Ctrl + 1~9：切换到指定Tab
    - Cmd/Ctrl + T：新建终端
    - Cmd/Ctrl + W：关闭当前Tab
    - Cmd/Ctrl + K：清屏（Mac风格）
    - Cmd/Ctrl + F：切换全屏
    - Cmd/Ctrl + ,：打开终端设置
    - Cmd/Ctrl + Shift + K：打开密钥管理
    - Cmd/Ctrl + [/]：切换前后Tab（Mac风格）
    - Cmd/Ctrl + ←/→：切换前后Tab（通用风格）
  - 快捷键提示条实时显示当前平台的修饰键
  - 所有按钮 title 提示也动态显示正确的快捷键
  - 修改文件：`frontend/src/pages/user/webshell/index.tsx`

### Fixed
- **WebShell密码认证问题修复**（2026-07-03 19:50）
  - 修复第二次打开新窗口时密码认证失败的问题
  - 前端改进：密码参数始终在提供时传递，不依赖authType状态
  - 前端改进：收到auth_required时不立即关闭Tab，而是显示提示信息让用户手动处理
  - 前端改进：弹出密码认证窗口时预设当前节点和密码认证方式
  - 后端改进：明确区分hasPrivateKey和hasPassword的认证检查逻辑
  - 后端改进：当既没有私钥又没有密码时发送auth_required消息
  - 后端改进：添加认证方法的日志输出便于调试
  - 修改文件：
    - `backend/handlers/webshell.go`
    - `frontend/src/pages/user/webshell/index.tsx`

### Added
- **作业提交表单自动获取工作目录**（2026-07-03 19:40）
  - 打开作业提交面板时自动填充用户家目录作为默认工作目录
  - 格式：`/home/用户名/jobs`
  - 普通作业和容器作业都支持自动填充
  - placeholder也显示当前用户的家目录路径
  - 用户可以手动修改工作目录
  - 修改文件：`frontend/src/pages/user/jobs/index.tsx`

- **作业提交表单智能脚本同步功能**（2026-07-03 19:35）
  - 表单参数修改时自动更新脚本内容中的SBATCH指令
  - 监听字段：作业名称、分区、节点数、CPU核数、内存、时间、GPU卡数、QOS
  - 脚本自动包含：作业信息输出、时间戳、hostname等基础信息
  - 时间支持小数（如1.5小时自动转换为01:30:00）
  - 内存从GB自动转换为SBATCH格式
  - GPU自动转换为--gres=gpu:N格式
  - QOS自动添加--qos参数
  - 用户可在自动生成的脚本基础上继续手动编辑
  - 修改文件：`frontend/src/pages/user/jobs/index.tsx`

- **分区详情查看功能**（2026-07-03 19:30）
  - 用户仪表盘分区表格增加"详情"操作按钮
  - 新增分区详情弹窗，显示完整分区信息
  - 详情包括：状态、节点数量、时间限制（最大/默认）、节点限制（最大/最小/当前）
  - 显示完整节点列表（可滚动查看）
  - 时间和节点限制支持"无限制"标签显示
  - 修改文件：`frontend/src/pages/user/dashboard/index.tsx`

- **作业日志查看和AI分析功能**（2026-07-03 01:10）
  - 作业详情弹窗增加"查看日志"按钮
  - 新增作业日志查看弹窗，支持标准输出/错误输出切换
  - 日志内容以终端样式显示（深色背景，等宽字体）
  - 支持下载日志文件到本地
  - 集成AI分析功能：点击"AI分析问题"自动诊断日志中的错误和问题
  - AI会识别资源限制、依赖问题、代码错误等，并提供解决建议
  - 后端新增API：
    - `GET /jobs/:id/logs` - 获取作业日志（stdout/stderr）
    - `POST /ai/analyze-job-log` - AI分析作业日志
  - 日志文件自动截取（超过100KB只显示最后100KB）
  - 支持权限控制：普通用户只能查看自己的作业日志
  - 修改文件：
    - `frontend/src/pages/user/jobs/index.tsx`
    - `backend/handlers/job.go` (新增GetJobLogs)
    - `backend/handlers/ai.go` (新增AnalyzeJobLog)
    - `backend/main.go` (注册新路由)

- **作业模板查看和编辑功能**（2026-07-03 00:52）
  - 实现作业模板库的"查看"和"编辑"按钮功能
  - 添加查看模板弹窗：显示完整模板信息（资源配置、容器镜像、模块加载等）
  - 添加编辑模板弹窗：支持修改模板所有字段
  - 查看模板时可直接跳转到编辑或删除
  - 编辑模板时支持切换作业类型（普通/容器）
  - 编辑时内存和时间自动转换为用户友好单位（GB和小时）
  - 保存时自动转换回后端格式（MB和分钟）
  - 只有管理员或模板所有者可以编辑/删除模板
  - 修改文件：`frontend/src/pages/user/jobs/index.tsx`

- **用户仪表盘Tab视图切换功能**（2026-07-03 00:05）
  - 将"正在运行的作业"和"节点状态"合并为统一的"资源视图"卡片
  - 添加Tab切换按钮：作业 | 分区 | 节点
  - Tab按钮样式类似按钮组，带计数标签
  - 作业Tab显示运行中的作业列表，支持查看历史记录
  - 节点Tab显示节点状态表格，点击行可查看详情
  - 分区Tab预留接口（开发中）
  - 修改文件：`frontend/src/pages/user/dashboard/index.tsx`

- **分区视图功能实现**（2026-07-03 00:25）
  - 实现用户仪表盘分区Tab的完整功能
  - 显示分区列表表格：名称（带状态指示灯）、状态标签、时间限制、节点数量、节点列表、最大/最小节点数
  - 后端API增强：返回更多分区详细信息（max_time, default_time, max_nodes, min_nodes, node_count）
  - 时间限制智能显示：转换为小时/分钟格式，infinite显示为"无限制"标签
  - 节点限制智能显示：数字或"无限制"标签
  - 修改文件：
    - `backend/handlers/job.go` - 增强GetPartitions返回信息
    - `frontend/src/pages/user/dashboard/index.tsx` - 实现分区视图

### Changed
- **用户仪表盘卡片布局优化为左右布局**（2026-07-03 00:38）
  - 将作业统计、账户配额、机时信息、存储配额四个卡片由上下布局改为左右布局
  - 左侧显示主要指标（大数字/百分比/图标），右侧显示详细信息列表
  - 统一使用 `bodyStyle={{ height: 140 }}` 固定卡片内容区高度，确保四个卡片高度完全一致
  - 四个卡片平均分配宽度：每个占6列（共24列），充分利用横向空间
  - 机时信息字体缩小：主要文字从13px改为12px，大数字从48px改为42px，间距从8px改为6px
  - 内容区使用 `height: 100%` 和 `display: flex` 垂直居中对齐
  - 修改文件：`frontend/src/pages/user/dashboard/index.tsx`

- **作业提交表单布局优化**（2026-07-03 00:42）
  - 调整表单布局为左右对齐，更符合原版样式
  - 作业名称和队列/分区放在同一行（各占50%宽度）
  - 节点数和CPU核心数放在同一行
  - 内存和时间放在同一行
  - GPU卡数和QOS放在同一行
  - 工作目录单独一行
  - 优化字段标签和占位符文本
  - 添加默认值：节点数=1, CPU=8, 内存/时间/GPU=0
  - 脚本示例更新为SBATCH短参数格式（-J, -p, -N, -c等）
  - 修改文件：`frontend/src/pages/user/jobs/index.tsx`

### Fixed
- **用户仪表盘前端无限刷新问题**（2026-07-02 23:00）
  - 修复 `frontend/src/pages/user/dashboard/index.tsx` 中 useEffect 依赖导致的无限重渲染
  - 将 `useEffect([loadData])` 改为 `useEffect([])` 避免循环调用
  
- **用户仪表盘 API 404 错误**（2026-07-02 23:10）
  - 后端 `backend/main.go` 添加 `/api/dashboard` 路由，映射到 `GetUserDashboard` 处理函数
  - 后端 `backend/main.go` 添加 `/api/monitoring/nodes` 路由，映射到 `GetDashboardNodes` 处理函数
  - 在 `backend/handlers/dashboard.go` 中实现 `GetUserDashboard` 和 `GetDashboardNodes` 函数
  
- **机时信息和存储配额无法显示**（2026-07-02 23:20）
  - 添加 `/api/usage/my-resources` 路由获取用户资源和QoS信息
  - 添加 `/api/usage/billing-summary` 路由获取机时汇总信息
  - 修复 `GetMyBillingInfo` 返回字段：`total_recharged` 改为 `total_quota`
  - 添加 `/api/quota` 兼容路由，修改返回格式匹配前端期望的字段
  - 前端优化：无配额时也显示已用机时；存储配额未配置时显示友好提示
  
- **账户配额卡片显示异常**（2026-07-02 23:30）
  - 优化显示逻辑：有限制显示百分比，无限制有作业显示核数，无限制无作业显示友好提示
  - 优化布局：减小内边距(20→12px)、主数字字体(48→42px)、说明文字(13→12px)
  - 减小间距：Space size small→4px，指示点8→6px
  - 添加分隔线区分底部QoS信息，确保所有内容在320px高度内完整显示
  
- **节点状态改用表格显示**（2026-07-02 23:40）
  - 将节点卡片布局改为表格布局
  - 表格列：节点名称(带状态指示灯)、状态标签、CPU总数/已用/使用率、内存总量/已用/使用率、作业数
  - 点击表格行打开详情弹窗查看完整节点信息
  - 使用进度条可视化CPU和内存使用率
  
- **节点内存显示NaN问题**（2026-07-02 23:50）
  - 修复前后端字段名不一致导致的显示异常
  - 后端返回：`memory_total_mb`, `memory_allocated_mb`, `cpu_total`, `cpu_allocated`, `running_jobs`
  - 更新前端 `NodeInfo` 接口定义，修改表格列和详情弹窗的字段引用
  - 内存正常显示为 GB/TB 格式

## [Unreleased]

### Security
- 收紧监控 API 权限边界，`/api/monitoring/*` 默认需要管理员权限；PromQL 代理增加 5 秒超时、查询长度限制、`query_range` 最大 24 小时时间窗和最小 15 秒 step 限制。
- Redis GET 缓存 key 增加用户身份与管理员状态隔离，避免相同 URL 的用户级数据在开启缓存后串读。
- 加固 Xpra HTML 代理访问控制：`/api/desktop/sessions/:id/xpra-html/*path` 现在会校验 JWT、撤销状态和会话归属，并通过 HttpOnly 会话路径 Cookie 支持 iframe 子资源继续访问。
- 移除下载页和 API 文档页中的内联 `onclick` 与字符串拼接 HTML，改为 DOM API 和事件委托，降低 XSS 风险。
- JWT 中间件增加 claims 类型校验，避免异常或伪造 token 触发后端 panic。

### Fixed
- 修复后端部分接口误读 `is_admin` 导致管理员权限判断失效的问题，统一使用 `isAdmin`，并保留前端/接口的 `is_admin` 兼容读取。
- 修复 `vue-tsc` 构建时尝试把编译产物写回 `src/*.js` 的问题，`tsconfig.json` 增加 `noEmit: true`。

### Changed
- 监控页优先使用新的 `/api/monitoring/overview` 聚合接口刷新核心数据，减少总览页轮询时的接口扇出；作业趋势图去掉随机模拟曲线，改为稳定的当前快照展示。
- 增强移动端和不同显示器分辨率下的全局响应式兜底：表格横向滚动、卡片/弹窗宽度约束、移动端按钮与表单换行、固定根字号避免布局随视口异常缩放。
- 精简前端源码目录，删除与 `.ts` 文件成对的旧 `.js` 编译副本，避免无扩展导入命中旧文件并减少维护面。

### Added
- **作业历史增强功能**
  - 新增"开始时间"和"结束时间"两列
  - 提交时间、开始时间、结束时间列支持点击排序（升序/降序切换）
  - 新增"自选列"功能，用户可自定义显示的列（⚙️ 列按钮）
  - 导出Excel功能根据用户选择的可见列动态生成
  - 机时消费记录导出也增加了结束时间列

### Performance
- **Redis 缓存优化**（2025-05-22）
  - 新增 14 个 API 缓存，显著提升系统性能
  - P0 高优先级：用户列表（5分钟）、单个用户（3分钟）、用户组列表（5分钟）、单个用户组（3分钟）、用户资源信息（1分钟）
  - P1 中优先级：资源绑定列表（3分钟）、单个资源绑定（3分钟）、作业模板列表（10分钟）、WebShell 节点列表（2分钟）
  - P2 低优先级：Harbor 配置（5分钟）、Harbor 项目列表（2分钟）、桌面资源预设（10分钟）、机时账户列表（2分钟）、CMDB 主机列表（5分钟）
  - 实现 15 个缓存失效逻辑，保证数据一致性（用户、用户组、Slurm 账户、Slurm 用户、资源绑定的创建/更新/删除操作）
  - 预期性能提升：API 响应时间提升 50-95%，LDAP 查询压力降低 80%+，Harbor API 调用减少 90%+
  - 新增缓存 Key 常量：`PrefixAppTemplate`、`PrefixDesktop`、`PrefixRegistry`、`PrefixBilling`、`PrefixCMDB`

### Code Quality
- **代码清理与优化**（2025-05-22）
  - 删除 40+ 处前端调试语句（console.log/error/warn）
  - 删除 6 处后端调试输出（fmt.Printf）
  - 删除 8 个临时调试文件（_ds.txt、_tpl_p1.txt 等）
  - 删除 70+ 个编译产物文件（.vue.js）
  - 改进 .gitignore 规则，排除编译产物、临时文件、数据库文件
  - 简化错误处理逻辑，统一使用用户友好的错误提示
  - 优化语音识别代码，删除详细的状态跟踪日志

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
