package main

import (
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"hpc-backend/cache"
	"hpc-backend/handlers"
	"hpc-backend/logger"
	"hpc-backend/middleware"
	"hpc-backend/models"
)

func main() {
	// 加载环境变量：优先读 ENV_FILE 指定的文件，否则依次尝试当前目录和上级目录的 .env
	envFile := os.Getenv("ENV_FILE")
	if envFile == "" {
		if _, err := os.Stat(".env"); err == nil {
			envFile = ".env"
		} else if _, err := os.Stat("../.env"); err == nil {
			envFile = "../.env"
		}
	}
	if envFile != "" {
		if err := godotenv.Load(envFile); err != nil {
			log.Printf("Warning: failed to load env file %s: %v", envFile, err)
		} else {
			log.Printf("Loaded env from: %s", envFile)
		}
	}

	// 程序退出时关闭日志文件和数据库连接
	defer logger.Close()
	defer models.CloseDatabase()

	// 初始化数据库
	if err := models.InitDatabase(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// 启动时自动从 partition.conf 导入分区配置（仅导入不存在的）
	confPath := os.Getenv("SLURM_PARTITION_CONF")
	if confPath == "" {
		confPath = "/etc/slurm/partition.conf"
	}
	if _, err := os.Stat(confPath); err == nil {
		if n, err := models.ImportPartitionsFromConfFile(confPath); err == nil && n > 0 {
			log.Printf("Auto-imported %d partition(s) from %s", n, confPath)
		}
	}

	// 初始化Redis缓存
	if os.Getenv("REDIS_ENABLE") == "true" {
		if err := cache.InitRedis(); err != nil {
			log.Printf("Warning: Redis connection failed: %v (continuing without cache)", err)
		} else {
			log.Println("Redis connected successfully")
			defer cache.Close()
		}
	}

	logger.Info("========================================")
	logger.Info("HPC Backend Starting")
	logger.Info("========================================")

	// JWT_SECRET 安全检查
	jwtSecret := os.Getenv("JWT_SECRET")
	if len(jwtSecret) < 32 {
		log.Printf("WARNING: JWT_SECRET length insufficient (%d bytes), recommend 32+ bytes", len(jwtSecret))
	}

	log.Println("========================================")
	log.Println("HPC Backend Starting")
	log.Println("========================================")
	log.Printf("DEV_MODE: %s", os.Getenv("DEV_MODE"))
	log.Println("========================================")

	// 恢复后端重启前未完成的桌面会话轮询
	handlers.RecoverDesktopSessions()
	// 加载持久化的 AI 任务
	handlers.LoadAITasks()

	// 创建 Gin 路由
	r := gin.Default()

	// CORS 中间件
	r.Use(middleware.CORSMiddleware())

	// 过滤非法查询参数（防 NoSQL 注入风格枚举）
	r.Use(middleware.SanitizeQueryMiddleware())

	// 只读演示模式（DEMO_READONLY=true 时拦截所有写操作）
	r.Use(middleware.ReadOnlyMiddleware())

	// 审计日志中间件（在认证之后）
	r.Use(middleware.AuditMiddleware())

	// 运行时配置（前端通过 /config.js 读取）
	r.GET("/config.js", handlers.GetRuntimeConfig)
	
	// 系统配置（前端通过 /api/config 读取）
	r.GET("/api/config", handlers.GetSystemConfig)

	// API 文档（公开访问）
	r.GET("/api", handlers.GetAPIDocs)
	r.GET("/api/docs", handlers.GetAPIDocs)

	// 公开路由
	api := r.Group("/api")
	{
		api.POST("/login", middleware.LoginRateLimitMiddleware(), handlers.Login)
		// MFA：登录第二步和绑定流程都只需临时 token，不走 AuthMiddleware
		api.POST("/mfa/verify-login", middleware.LoginRateLimitMiddleware(), handlers.VerifyMFALogin)
		api.POST("/mfa/setup", handlers.SetupMFA)
		api.POST("/mfa/confirm", handlers.ConfirmMFA)
		// 验证码
		api.GET("/captcha/new", handlers.GetCaptcha)
		api.GET("/captcha/:id", handlers.GetCaptchaImage)
	}

	// 客户端下载页面（公开）
	r.GET("/download", handlers.DownloadPage)

	// 需要认证的路由
	auth := r.Group("/api")
	auth.Use(middleware.AuthMiddleware())
	{
		auth.GET("/me", handlers.GetCurrentUser)
		auth.GET("/me/resources", cache.CacheMiddleware(cache.PrefixUser+"resources:", 1*time.Minute), handlers.GetMyResources)
		auth.POST("/logout", handlers.Logout)
		auth.POST("/ai/chat", handlers.AIChat)
		auth.POST("/ai/admin/chat", middleware.AdminMiddleware(), handlers.AIAdminChat)
		auth.POST("/ai/analyze-job-log", handlers.AnalyzeJobLog)

		// MFA 管理（登录用户自助）
		auth.GET("/mfa/status", handlers.GetMFAStatus)
		auth.DELETE("/mfa", handlers.DisableMFA)
		auth.POST("/mfa/setup-auth", handlers.SetupMFAAuth)     // 已登录用户自助绑定
		auth.POST("/mfa/confirm-auth", handlers.ConfirmMFAAuth) // 已登录用户确认绑定
		// 管理员 MFA 管理
		auth.GET("/mfa/admin/list", middleware.AdminMiddleware(), handlers.AdminListMFA)
		auth.DELETE("/mfa/admin/:username", middleware.AdminMiddleware(), handlers.AdminResetMFA)

		// 客户端下载文件（需认证）
		auth.GET("/download/:file", handlers.DownloadClient)

		// 普通用户可以访问的路由
		auth.POST("/profile/change-password", handlers.ChangePassword)
		auth.PUT("/profile", handlers.UpdateProfile)

		// 用户管理（需要管理员权限）
		users := auth.Group("/users")
		users.Use(middleware.AdminMiddleware())
		{
			users.GET("", handlers.GetUsers)
			users.GET("/next-uid", handlers.GetNextUID)
			users.GET("/:username", cache.CacheMiddleware(cache.PrefixUser, 3*time.Minute), handlers.GetUser)
			users.POST("", handlers.CreateUser)
			users.PUT("/:username", handlers.UpdateUser)
			users.DELETE("/:username", handlers.DeleteUser)
			users.POST("/:username/reset-password", handlers.ResetPassword)
			users.POST("/:username/set-disabled", handlers.SetUserDisabled)
			users.POST("/:username/set-password-must-change", handlers.SetPasswordMustChange)
		}

		// 用户组管理
		groups := auth.Group("/groups")
		groups.Use(middleware.AdminMiddleware())
		{
			groups.GET("", cache.CacheMiddleware(cache.PrefixGroup+"list:", 5*time.Minute), handlers.GetGroups)
			groups.GET("/next-gid", handlers.GetNextGID)
			groups.GET("/:gid", cache.CacheMiddleware(cache.PrefixGroup, 3*time.Minute), handlers.GetGroup)
			groups.POST("", handlers.CreateGroup)
			groups.PUT("/:gid", handlers.UpdateGroup)
			groups.DELETE("/:gid", handlers.DeleteGroup)
		}

		// Slurm 账户管理
		slurmAccounts := auth.Group("/slurm/accounts")
		slurmAccounts.Use(middleware.AdminMiddleware())
		{
			slurmAccounts.GET("", cache.CacheMiddleware(cache.PrefixSlurmAccount+"list:", 2*time.Minute), handlers.GetSlurmAccounts)
			slurmAccounts.GET("/:name", cache.CacheMiddleware(cache.PrefixSlurmAccount, 2*time.Minute), handlers.GetSlurmAccount)
			slurmAccounts.POST("", handlers.CreateSlurmAccount)
			slurmAccounts.PUT("/:name", handlers.UpdateSlurmAccount)
			slurmAccounts.DELETE("/:name", handlers.DeleteSlurmAccount)
		}

		// Slurm 用户管理
		slurmUsers := auth.Group("/slurm/users")
		slurmUsers.Use(middleware.AdminMiddleware())
		{
			slurmUsers.GET("", cache.CacheMiddleware(cache.PrefixSlurmUser+"list:", 2*time.Minute), handlers.GetSlurmUsers)
			slurmUsers.GET("/:name", cache.CacheMiddleware(cache.PrefixSlurmUser, 2*time.Minute), handlers.GetSlurmUser)
			slurmUsers.POST("", handlers.CreateSlurmUser)
			slurmUsers.PUT("/:name", handlers.UpdateSlurmUser)
			slurmUsers.DELETE("/:name", handlers.DeleteSlurmUser)
		}

		// Slurm QoS 管理
		auth.GET("/qos", cache.CacheMiddleware(cache.PrefixQoS+"list:", 5*time.Minute), handlers.GetQoSList)
		auth.GET("/qos/:name", cache.CacheMiddleware(cache.PrefixQoS, 5*time.Minute), handlers.GetQoS)
		qos := auth.Group("/qos")
		qos.Use(middleware.AdminMiddleware())
		{
			qos.POST("", handlers.CreateQoS)
			qos.PUT("/:name", handlers.UpdateQoS)
			qos.DELETE("/:name", handlers.DeleteQoS)
		}

		// Slurm 分区配置管理
		partitions := auth.Group("/partitions")
		partitions.Use(middleware.AdminMiddleware())
		{
			partitions.GET("", handlers.GetPartitionConfigs)
			partitions.GET("/:name", handlers.GetPartitionConfig)
			partitions.POST("", handlers.CreatePartitionConfig)
			partitions.PUT("/:name", handlers.UpdatePartitionConfig)
			partitions.DELETE("/:name", handlers.DeletePartitionConfig)
			partitions.POST("/generate", handlers.GeneratePartitionConf)
			partitions.POST("/apply", handlers.ApplyPartitionConfig)
			partitions.POST("/reload", handlers.ReloadSlurmConfig)
			partitions.POST("/restart", handlers.RestartSlurmService)
			partitions.GET("/export", handlers.ExportPartitionConfigs)
			partitions.POST("/import", handlers.ImportPartitionConfigs)
			partitions.POST("/import-conf", handlers.ImportFromConfFile)
		}

		// 机时充值管理（旧接口，保留兼容）
		billing := auth.Group("/billing")
		billing.Use(middleware.AdminMiddleware())
		{
			billing.POST("/recharge", handlers.RechargeQoS)
			billing.GET("/recharge/history", handlers.GetRechargeHistory)
		}

		// 新的机时管理系统
		billingV2 := auth.Group("/billing/v2")
		billingV2.Use(middleware.AdminMiddleware())
		{
			billingV2.GET("/accounts", cache.CacheMiddleware(cache.PrefixBilling+"accounts:", 2*time.Minute), handlers.GetBillingAccounts) // 获取所有机时账户
			billingV2.POST("/recharge", handlers.RechargeBilling)                                                                          // 充值
			billingV2.GET("/recharge/records", handlers.GetRechargeRecords)                                                                // 充值记录
			billingV2.GET("/records", handlers.GetBillingRecords)                                                                          // 消费记录
			billingV2.POST("/sync", handlers.SyncBillingFromSlurm)                                                                         // 从 Slurm 同步
		}

		// 用户查看自己的机时信息
		auth.GET("/me/billing", handlers.GetMyBillingInfo)

		// Slurm 资源绑定管理
		associations := auth.Group("/slurm/associations")
		associations.Use(middleware.AdminMiddleware())
		{
			associations.GET("", cache.CacheMiddleware(cache.PrefixAssociation+"list:", 3*time.Minute), handlers.GetAssociations)
			associations.GET("/single", cache.CacheMiddleware(cache.PrefixAssociation+"single:", 3*time.Minute), handlers.GetAssociation)
			associations.POST("", handlers.CreateAssociation)
			associations.PUT("", handlers.UpdateAssociation)
			associations.DELETE("", handlers.DeleteAssociation)
		}

		// 审计日志管理
		audit := auth.Group("/audit")
		audit.Use(middleware.AdminMiddleware())
		{
			audit.GET("/logs", handlers.GetAuditLogs)
			audit.GET("/logs/:id", handlers.GetAuditLog)
			audit.GET("/stats", handlers.GetAuditStats)
			audit.GET("/export", handlers.ExportAuditLogs)
			// SSH 隧道行为日志
			audit.GET("/ssh-logs", handlers.GetSSHTunnelLogs)
			audit.GET("/ssh-logs/download", handlers.DownloadSSHTunnelLog)
		}
		// 页面访问审计（所有登录用户均可上报，不限管理员）
		auth.POST("/audit/page-view", handlers.PageView)
		// Shell 命令审计（节点 wrapper 脚本上报）
		auth.POST("/audit/shell", handlers.ShellAudit)

		// 机时管理 API
		usage := auth.Group("/usage")
		{
			// 普通用户可以查看自己的使用情况
			usage.GET("/user", handlers.GetUserUsage)
			usage.GET("/my-resources", cache.CacheMiddleware(cache.PrefixUser+"resources:", 2*time.Minute), handlers.GetMyResources)
			usage.GET("/billing-summary", cache.CacheMiddleware(cache.PrefixUser+"billing:", 2*time.Minute), handlers.GetMyBillingInfo)
			usage.GET("/billing", handlers.GetUserUsage) // 兼容旧接口
			
			// debug 接口限管理员
			usage.GET("/debug", middleware.AdminMiddleware(), handlers.DebugUserUsage)
			usage.GET("/debug/raw", middleware.AdminMiddleware(), handlers.DebugRawJobs)

			// 管理员可以查看所有使用情况
			usage.GET("/account", middleware.AdminMiddleware(), handlers.GetAccountUsageWithBilling)
			usage.GET("/account/user", middleware.AdminMiddleware(), handlers.GetUserUsageByAccount)
			usage.GET("/accounts", middleware.AdminMiddleware(), handlers.GetAllAccountsUsage)
			usage.GET("/all-records", middleware.AdminMiddleware(), handlers.GetAllUsersUsageRecords)
			usage.GET("/summary", middleware.AdminMiddleware(), handlers.GetUsageSummary)
			usage.GET("/cluster", middleware.AdminMiddleware(), handlers.GetClusterUsage)
		}

		// 作业管理 API
		jobs := auth.Group("/jobs")
		{
			jobs.GET("", handlers.GetJobs)
			jobs.GET("/:id", handlers.GetJob)
			jobs.GET("/:id/logs", handlers.GetJobLogs)
			jobs.POST("", handlers.SubmitJob)
			jobs.DELETE("/:id", handlers.CancelJob)
			jobs.POST("/:id/suspend", handlers.SuspendJob)
			jobs.POST("/:id/resume", handlers.ResumeJob)
			jobs.GET("/partitions/list", cache.CacheMiddleware(cache.PrefixPartition+"list:", 5*time.Minute), handlers.GetPartitions)
		}

		// 作业模板 API
		appTemplates := auth.Group("/app-templates")
		{
			appTemplates.GET("", cache.CacheMiddleware(cache.PrefixAppTemplate+"list:", 10*time.Minute), handlers.ListAppTemplates)
			appTemplates.POST("", handlers.CreateAppTemplate)
			appTemplates.PUT("/:id", handlers.UpdateAppTemplate)
			appTemplates.DELETE("/:id", handlers.DeleteAppTemplate)
		}

		// Web Shell API
		webshell := auth.Group("/webshell")
		{
			// 获取可用节点
			webshell.GET("/nodes", cache.CacheMiddleware(cache.PrefixNode+"webshell:", 2*time.Minute), handlers.GetNodes)

			// WebSocket连接
			webshell.GET("/connect", handlers.ConnectWebShell)

			// 会话管理
			webshell.GET("/sessions", handlers.GetSessions)
			webshell.DELETE("/sessions/:session_id", handlers.CloseSession)

			// 日志管理
			webshell.GET("/logs", handlers.GetSessionLogs)
			webshell.GET("/logs/:log_file/download", handlers.DownloadSessionLog)

			// 私钥管理
			webshell.GET("/keys/check", handlers.CheckPrivateKey)
			webshell.GET("/has-key", handlers.CheckPrivateKey) // 别名兼容
			webshell.POST("/keys/upload", handlers.UploadPrivateKey)
			webshell.POST("/upload-key", handlers.UploadPrivateKey) // 别名兼容
			webshell.POST("/keys/generate", handlers.GenerateKeyPair)
			webshell.POST("/generate-key", handlers.GenerateKeyPair) // 别名兼容
			webshell.POST("/keys/deploy", handlers.DeployPublicKey)

			// 连接测试
			webshell.POST("/nodes/:node_name/test", handlers.TestNodeConnection)

			// 文件管理（远程节点SFTP）
			webshell.POST("/files/list", handlers.WebShellListFiles)
			webshell.POST("/files/upload", handlers.WebShellUploadFile)
			webshell.GET("/files/download", handlers.WebShellDownloadFile)
			webshell.POST("/files/delete", handlers.WebShellDeleteFile)
		}

		// 远程桌面 API
		desktop := auth.Group("/desktop")
		{
			desktop.GET("/sessions", handlers.GetDesktopSessions)
			desktop.POST("/sessions", handlers.CreateDesktopSession)
			desktop.POST("/sessions/:id/start", handlers.StartDesktopSession)
			desktop.POST("/sessions/:id/stop", handlers.StopDesktopSession)
			desktop.GET("/sessions/:id/status", handlers.GetDesktopSessionStatus)
			desktop.DELETE("/sessions/:id", handlers.DeleteDesktopSession)
			desktop.GET("/sessions/:id/logs", handlers.GetDesktopSessionLogs)
			desktop.GET("/sessions/:id/script", handlers.GetDesktopScript)
			desktop.GET("/resource-presets", cache.CacheMiddleware(cache.PrefixDesktop+"presets:", 10*time.Minute), handlers.GetDesktopResourcePresets)
			desktop.POST("/cleanup", handlers.CleanupUserSpace)
			// 应用管理
			desktop.GET("/apps", handlers.GetDesktopApps)
			desktop.POST("/apps", handlers.CreateDesktopApp)
			desktop.DELETE("/apps/:id", handlers.DeleteDesktopApp)
			// VNC WebSocket 代理：通过 SSH 隧道连接计算节点 VNC
			desktop.GET("/sessions/:id/vnc-ws", handlers.VNCWebSocketProxy)
			desktop.GET("/sessions/:id/xpra-ws", handlers.XpraWebSocketProxy)
			desktop.POST("/sessions/:id/client-exit", handlers.NotifyClientExit)
			desktop.GET("/sessions/:id/client-signal", handlers.GetClientSignal)

			// Xpra HTML5 代理：独立路由，不强制 JWT（子资源无法带 header）
			// 安全性依赖 session ID 的不可猜测性
			r.GET("/api/desktop/sessions/:id/xpra-html/*path", handlers.XpraHTTPProxy)
		}

		// SSH WebSocket 隧道：转发到计算节点 SSH 端口
		auth.GET("/ssh/proxy", handlers.SSHWebSocketProxy)

		// WebDAV 文件系统挂载（暂时禁用）
		// r.Any("/api/webdav/*path", middleware.WebDAVAuthMiddleware(), handlers.WebDAVHandler)

		// 文件管理 API (兼容旧的 filemanager 路径)
		files := auth.Group("/files")
		{
			files.GET("/list", handlers.ListDirectory)
			files.GET("/info", handlers.GetFileInfo)
			files.GET("/read", handlers.ReadFile)
			files.GET("/download", handlers.DownloadFile)
			files.POST("/write", handlers.WriteFile)
			files.POST("/upload", handlers.UploadFile)
			files.DELETE("/delete", handlers.DeleteFile)
			files.POST("/mkdir", handlers.CreateDirectory)
			files.POST("/rename", handlers.RenameFile)
			files.POST("/copy", handlers.CopyFile)
			// 配额
			files.GET("/quota", cache.CacheMiddleware(cache.PrefixQuota, 2*time.Minute), handlers.GetQuota)
			files.GET("/quota/fsinfo", cache.CacheMiddleware(cache.PrefixQuota+"fsinfo:", 5*time.Minute), handlers.GetFSInfo)
			files.GET("/quota/all", cache.CacheMiddleware(cache.PrefixQuota+"all:", 2*time.Minute), handlers.GetAllQuotas)
			files.POST("/quota", handlers.SetQuota)
			files.GET("/compress", handlers.CompressDownload)
		}
		
		// 配额 API（兼容路由）
		auth.GET("/quota", cache.CacheMiddleware(cache.PrefixQuota, 2*time.Minute), handlers.GetQuota)

		// 文件管理 API - 别名路由 (兼容旧前端)
		filemanager := auth.Group("/filemanager")
		{
			filemanager.GET("/list", handlers.ListDirectory)
			filemanager.GET("/info", handlers.GetFileInfo)
			filemanager.GET("/read", handlers.ReadFile)
			filemanager.GET("/download", handlers.DownloadFile)
			filemanager.POST("/write", handlers.WriteFile)
			filemanager.POST("/upload", handlers.UploadFile)
			filemanager.DELETE("/delete", handlers.DeleteFile)
			filemanager.POST("/mkdir", handlers.CreateDirectory)
			filemanager.POST("/rename", handlers.RenameFile)
			filemanager.POST("/copy", handlers.CopyFile)
		}

		// 仪表盘统计 API
		dashboard := auth.Group("/dashboard")
		{
			dashboard.GET("/stats", cache.CacheMiddleware(cache.PrefixDashboard+"stats:", 30*time.Second), handlers.GetDashboardStats)
			dashboard.GET("/nodes", cache.CacheMiddleware(cache.PrefixDashboard+"nodes:", 30*time.Second), handlers.GetDashboardNodes)
			dashboard.GET("/user-job-stats", cache.CacheMiddleware(cache.PrefixDashboard+"user-job-stats:", 30*time.Second), handlers.GetDashboardUserJobStats)
			// 前端新增接口（返回空数据或从监控接口获取）
			dashboard.GET("/node-metrics", cache.CacheMiddleware(cache.PrefixDashboard+"node-metrics:", 30*time.Second), handlers.GetDashboardNodeMetrics)
			dashboard.GET("/alerts", cache.CacheMiddleware(cache.PrefixDashboard+"alerts:", 30*time.Second), handlers.GetDashboardAlerts)
		}
		
		// 用户 Dashboard API（兼容性路由）
		auth.GET("/dashboard", cache.CacheMiddleware(cache.PrefixDashboard+"user:", 30*time.Second), handlers.GetUserDashboard)

		// 用户自定义看板配置（跨设备同步）
		auth.GET("/user/dashboards", handlers.GetUserDashboards)
		auth.POST("/user/dashboards", handlers.SaveUserDashboards)

		// 监控 API
		monitoring := auth.Group("/monitoring")
		{
			// 普通用户也可以查看节点信息
			monitoring.GET("/nodes", cache.CacheMiddleware(cache.PrefixMonitoring+"nodes:", 30*time.Second), handlers.GetDashboardNodes)
		}
		
		// 管理员监控功能
		monitoringAdmin := auth.Group("/monitoring")
		monitoringAdmin.Use(middleware.AdminMiddleware())
		{
			monitoringAdmin.GET("/metrics", cache.CacheMiddleware(cache.PrefixMonitoring+"metrics:", 15*time.Second), handlers.GetNodeMetrics)
			monitoringAdmin.GET("/overview", cache.CacheMiddleware(cache.PrefixMonitoring+"overview:", 15*time.Second), handlers.GetMonitoringOverview)
			monitoringAdmin.GET("/node-metrics", cache.CacheMiddleware(cache.PrefixMonitoring+"node-metrics:", 15*time.Second), handlers.GetNodeExporterMetrics)
			monitoringAdmin.GET("/local-metrics", cache.CacheMiddleware(cache.PrefixMonitoring+"local-metrics:", 15*time.Second), handlers.GetLocalMetrics)
			monitoringAdmin.GET("/mgmt-services", cache.CacheMiddleware(cache.PrefixMonitoring+"mgmt-services:", 15*time.Second), handlers.GetMgmtServices)
			monitoringAdmin.GET("/services", cache.CacheMiddleware(cache.PrefixMonitoring+"mgmt-services:", 15*time.Second), handlers.GetMgmtServices) // 别名
			monitoringAdmin.GET("/rack", handlers.GetRackLayout)
			monitoringAdmin.POST("/rack", handlers.CreateRack)
			monitoringAdmin.PUT("/rack/:id", handlers.UpdateRack)
			monitoringAdmin.DELETE("/rack/:id", handlers.DeleteRack)
			monitoringAdmin.POST("/rack/auto", handlers.AutoGenerateRacks)
			monitoringAdmin.GET("/prom-alerts", cache.CacheMiddleware(cache.PrefixMonitoring+"prom-alerts:", 15*time.Second), handlers.GetPromAlerts)
			monitoringAdmin.GET("/prom-targets", cache.CacheMiddleware(cache.PrefixMonitoring+"prom-targets:", 30*time.Second), handlers.GetPromTargets)
			monitoringAdmin.GET("/prom-rules", cache.CacheMiddleware(cache.PrefixMonitoring+"prom-rules:", 60*time.Second), handlers.GetPromRules)
			monitoringAdmin.GET("/promql", handlers.PromQueryInstant)
			monitoringAdmin.GET("/promql/range", handlers.PromQueryRange)
		}

		// 缓存监控API（管理员）
		cacheAPI := auth.Group("/cache")
		cacheAPI.Use(middleware.AdminMiddleware())
		{
			cacheAPI.GET("/metrics", handlers.GetCacheMetrics)
			cacheAPI.POST("/clear", handlers.ClearCache)
			cacheAPI.POST("/clear/:pattern", handlers.ClearCachePattern)
		}

		// 报表中心 API
		reports := auth.Group("/reports")
		{
			reports.GET("/jobs", handlers.GetJobStats)
			reports.GET("/usage", handlers.GetUsageStats)
			reports.GET("/storage", handlers.GetStorageStats)
			reports.GET("/quota", handlers.GetQuotaStats)
			reports.GET("/qos-usage", handlers.GetQoSUsage)
		}

		// AI 任务管理（训练/推理）
		aiTasks := auth.Group("/ai-tasks")
		{
			aiTasks.GET("", handlers.ListAITasks)
			aiTasks.GET("/stats", handlers.GetAITaskStats)
			aiTasks.POST("", handlers.CreateAITask)
			aiTasks.GET("/:id", handlers.GetAITask)
			aiTasks.GET("/:id/logs", handlers.GetAITaskLogs)
			aiTasks.POST("/:id/stop", handlers.StopAITask)
			aiTasks.POST("/:id/restart", handlers.RestartAITask)
			aiTasks.DELETE("/:id", handlers.DeleteAITask)
			// 推理端口发布 & API Key
			aiTasks.POST("/:id/endpoint", handlers.PublishInferencePort)
			aiTasks.GET("/:id/endpoint", handlers.GetInferenceEndpoint)
			aiTasks.DELETE("/:id/endpoint", handlers.RevokeInferenceEndpoint)
		}

		// 镜像仓库 API（Harbor 代理）
		registry := auth.Group("/registry")
		{
			registry.GET("/config", cache.CacheMiddleware(cache.PrefixRegistry+"config:", 5*time.Minute), handlers.GetRegistryConfig)
			registry.GET("/projects", cache.CacheMiddleware(cache.PrefixRegistry+"projects:", 2*time.Minute), handlers.ListProjects)
			registry.GET("/projects/:project/repositories", handlers.ListRepositories)
			registry.GET("/projects/:project/repositories/:repo/tags", handlers.ListTags)
			registry.DELETE("/projects/:project/repositories/:repo", handlers.DeleteRepository)
			registry.DELETE("/projects/:project/repositories/:repo/tags/:tag", handlers.DeleteTag)
			registry.POST("/images/save", handlers.SaveContainerImage)
			registry.GET("/images/save/task/:task_id", handlers.GetSaveImageTask)
			registry.GET("/images/save/tasks", handlers.ListSaveImageTasks)
		}
	}

	// noVNC 静态文件
	for _, novncDir := range []string{"static/novnc", "../node_modules/@novnc/novnc", "novnc"} {
		if _, err := os.Stat(novncDir); err == nil {
			r.Static("/novnc", novncDir)
			break
		}
	}

	// xpra-html5 静态文件
	for _, xpraDir := range []string{"static/xpra", "../static/xpra", "xpra-html5", "../xpra-html5"} {
		if _, err := os.Stat(xpraDir); err == nil {
			r.Static("/xpra", xpraDir)
			break
		}
	}

	port := os.Getenv("SERVER_PORT")
	if port == "" {
		port = "8080"
	}

	// 前端静态文件目录，优先级：./static > ../dist
	frontendDir := ""
	if _, err := os.Stat("static"); err == nil {
		frontendDir = "./static"
	} else if _, err := os.Stat("../dist"); err == nil {
		frontendDir = "../dist"
	}

	if frontendDir != "" {
		r.Static("/assets", frontendDir+"/assets")
		r.StaticFile("/favicon.ico", frontendDir+"/favicon.ico")
		r.NoRoute(func(c *gin.Context) {
			if !strings.HasPrefix(c.Request.URL.Path, "/api") {
				c.File(frontendDir + "/index.html")
			} else {
				c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			}
		})
	}

	log.Printf("Server starting on port %s", port)

	// 明确监听 IPv4 地址
	addr := "0.0.0.0:" + port
	if err := r.Run(addr); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
