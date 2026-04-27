package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"hpc-backend/handlers"
	"hpc-backend/logger"
	"hpc-backend/middleware"
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

	// 程序退出时关闭日志文件
	defer logger.Close()

	logger.Info("========================================")
	logger.Info("HPC Backend Starting")
	logger.Info("========================================")
	logger.Info("LDAP_HOST: %s", os.Getenv("LDAP_HOST"))
	logger.Info("LDAP_PORT: %s", os.Getenv("LDAP_PORT"))
	logger.Info("DEV_MODE: %s", os.Getenv("DEV_MODE"))

	// JWT_SECRET 安全检查
	jwtSecret := os.Getenv("JWT_SECRET")
	if len(jwtSecret) < 32 {
		log.Printf("WARNING: JWT_SECRET 长度不足 32 字节（当前 %d 字节），建议使用更长的随机字符串", len(jwtSecret))
	}
	logFile := os.Getenv("LOG_FILE")
	if logFile == "" {
		logFile = "slurm-web.log"
	}
	logger.Info("LOG_FILE: %s", logFile)
	logger.Info("========================================")

	log.Println("========================================")
	log.Println("HPC Backend Starting")
	log.Println("========================================")
	log.Printf("LDAP_HOST: %s", os.Getenv("LDAP_HOST"))
	log.Printf("LDAP_PORT: %s", os.Getenv("LDAP_PORT"))
	log.Printf("LDAP_USE_SSL: %s", os.Getenv("LDAP_USE_SSL"))
	log.Printf("LDAP_BASE_DN: %s", os.Getenv("LDAP_BASE_DN"))
	log.Printf("DEV_MODE: %s", os.Getenv("DEV_MODE"))
	log.Println("========================================")

	// 恢复后端重启前未完成的桌面会话轮询
	handlers.RecoverDesktopSessions()

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
		auth.GET("/me/resources", handlers.GetMyResources)
		auth.POST("/logout", handlers.Logout)
		auth.POST("/ai/chat", handlers.AIChat)

		// MFA 管理（登录用户自助）
		auth.GET("/mfa/status", handlers.GetMFAStatus)
		auth.DELETE("/mfa", handlers.DisableMFA)
		auth.POST("/mfa/setup-auth", handlers.SetupMFAAuth)   // 已登录用户自助绑定
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
			users.GET("/:username", handlers.GetUser)
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
			groups.GET("", handlers.GetGroups)
			groups.GET("/next-gid", handlers.GetNextGID)
			groups.GET("/:gid", handlers.GetGroup)
			groups.POST("", handlers.CreateGroup)
			groups.PUT("/:gid", handlers.UpdateGroup)
			groups.DELETE("/:gid", handlers.DeleteGroup)
		}

		// Slurm 账户管理
		slurmAccounts := auth.Group("/slurm/accounts")
		slurmAccounts.Use(middleware.AdminMiddleware())
		{
			slurmAccounts.GET("", handlers.GetSlurmAccounts)
			slurmAccounts.GET("/:name", handlers.GetSlurmAccount)
			slurmAccounts.POST("", handlers.CreateSlurmAccount)
			slurmAccounts.PUT("/:name", handlers.UpdateSlurmAccount)
			slurmAccounts.DELETE("/:name", handlers.DeleteSlurmAccount)
		}

		// Slurm 用户管理
		slurmUsers := auth.Group("/slurm/users")
		slurmUsers.Use(middleware.AdminMiddleware())
		{
			slurmUsers.GET("", handlers.GetSlurmUsers)
			slurmUsers.GET("/:name", handlers.GetSlurmUser)
			slurmUsers.POST("", handlers.CreateSlurmUser)
			slurmUsers.PUT("/:name", handlers.UpdateSlurmUser)
			slurmUsers.DELETE("/:name", handlers.DeleteSlurmUser)
		}

		// Slurm QoS 管理
		// GET 接口普通用户也需要（作业提交时选择 QoS），写操作仅管理员
		auth.GET("/qos", handlers.GetQoSList)
		auth.GET("/qos/:name", handlers.GetQoS)
		qos := auth.Group("/qos")
		qos.Use(middleware.AdminMiddleware())
		{
			qos.POST("", handlers.CreateQoS)
			qos.PUT("/:name", handlers.UpdateQoS)
			qos.DELETE("/:name", handlers.DeleteQoS)
		}

		// Slurm 资源绑定管理
		associations := auth.Group("/slurm/associations")
		associations.Use(middleware.AdminMiddleware())
		{
			associations.GET("", handlers.GetAssociations)
			associations.GET("/single", handlers.GetAssociation)
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
			// debug 接口限管理员
			usage.GET("/debug", middleware.AdminMiddleware(), handlers.DebugUserUsage)
			usage.GET("/debug/raw", middleware.AdminMiddleware(), handlers.DebugRawJobs)
			
			// 管理员可以查看所有使用情况
			usage.GET("/account", middleware.AdminMiddleware(), handlers.GetAccountUsageWithBilling)
			usage.GET("/account/user", middleware.AdminMiddleware(), handlers.GetUserUsageByAccount)
			usage.GET("/accounts", middleware.AdminMiddleware(), handlers.GetAllAccountsUsage)
			usage.GET("/summary", middleware.AdminMiddleware(), handlers.GetUsageSummary)
			usage.GET("/cluster", middleware.AdminMiddleware(), handlers.GetClusterUsage)
		}

		// 作业管理 API
		jobs := auth.Group("/jobs")
		{
			// 获取作业列表（普通用户只能看自己的，管理员可以看所有）
			jobs.GET("", handlers.GetJobs)
			
			// 获取单个作业详情
			jobs.GET("/:id", handlers.GetJob)
			
			// 提交作业
			jobs.POST("", handlers.SubmitJob)
			
			// 取消作业
			jobs.DELETE("/:id", handlers.CancelJob)
			
			// 暂停作业
			jobs.POST("/:id/suspend", handlers.SuspendJob)
			
			// 恢复作业
			jobs.POST("/:id/resume", handlers.ResumeJob)
			
			// 获取分区列表
			jobs.GET("/partitions/list", handlers.GetPartitions)
		}

		// Web Shell API
		webshell := auth.Group("/webshell")
		{
			// 获取可用节点
			webshell.GET("/nodes", handlers.GetNodes)
			
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
			webshell.POST("/keys/upload", handlers.UploadPrivateKey)
			webshell.POST("/keys/generate", handlers.GenerateKeyPair)
			webshell.POST("/keys/deploy", handlers.DeployPublicKey)
			
			// 连接测试
			webshell.POST("/nodes/:node_name/test", handlers.TestNodeConnection)
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
			desktop.GET("/resource-presets", handlers.GetDesktopResourcePresets)
			// VNC WebSocket 代理：通过 SSH 隧道连接计算节点 VNC
			desktop.GET("/sessions/:id/vnc-ws", handlers.VNCWebSocketProxy)
			desktop.GET("/sessions/:id/xpra-ws", handlers.XpraWebSocketProxy)

		// Xpra HTML5 代理：独立路由，不强制 JWT（子资源无法带 header）
		// 安全性依赖 session ID 的不可猜测性
		r.GET("/api/desktop/sessions/:id/xpra-html/*path", handlers.XpraHTTPProxy)
		}

		// SSH WebSocket 隧道：转发到计算节点 SSH 端口
		auth.GET("/ssh/proxy", handlers.SSHWebSocketProxy)

		// WebDAV 文件系统挂载（暂时禁用）
		// r.Any("/api/webdav/*path", middleware.WebDAVAuthMiddleware(), handlers.WebDAVHandler)

		// 文件管理 API
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
			files.GET("/quota", handlers.GetQuota)
			files.GET("/quota/fsinfo", handlers.GetFSInfo)
			files.GET("/quota/all", handlers.GetAllQuotas)
			files.POST("/quota", handlers.SetQuota)
			files.GET("/compress", handlers.CompressDownload)
		}

		// 仪表盘统计 API
		dashboard := auth.Group("/dashboard")
		{
			dashboard.GET("/stats", handlers.GetDashboardStats)
			dashboard.GET("/nodes", handlers.GetDashboardNodes)
		}

		// 用户自定义看板配置（跨设备同步）
		auth.GET("/user/dashboards", handlers.GetUserDashboards)
		auth.POST("/user/dashboards", handlers.SaveUserDashboards)

		// 监控 API
		monitoring := auth.Group("/monitoring")
		{
			monitoring.GET("/metrics", handlers.GetNodeMetrics)
			monitoring.GET("/node-metrics", handlers.GetNodeExporterMetrics)
			monitoring.GET("/local-metrics", handlers.GetLocalMetrics)
			monitoring.GET("/rack", handlers.GetRackLayout)
			monitoring.POST("/rack", handlers.CreateRack)
			monitoring.PUT("/rack/:id", handlers.UpdateRack)
			monitoring.DELETE("/rack/:id", handlers.DeleteRack)
			monitoring.POST("/rack/auto", handlers.AutoGenerateRacks)
			monitoring.GET("/prom-alerts", handlers.GetPromAlerts)
			monitoring.GET("/prom-targets", handlers.GetPromTargets)
			monitoring.GET("/prom-rules", handlers.GetPromRules)
		monitoring.GET("/promql", handlers.PromQueryInstant)
		monitoring.GET("/promql/range", handlers.PromQueryRange)
		}

		// 报表中心 API
		reports := auth.Group("/reports")
		{
			reports.GET("/jobs",      handlers.GetJobStats)
			reports.GET("/usage",     handlers.GetUsageStats)
			reports.GET("/storage",   handlers.GetStorageStats)
			reports.GET("/quota",     handlers.GetQuotaStats)
			reports.GET("/qos-usage", handlers.GetQoSUsage)
		}

		// CMDB 主机资产管理
		cmdb := auth.Group("/cmdb")
		cmdb.Use(middleware.AdminMiddleware())
		{
			cmdb.GET("/hosts", handlers.GetHosts)
			cmdb.POST("/hosts", handlers.CreateHost)
			cmdb.PUT("/hosts/:id", handlers.UpdateHost)
			cmdb.DELETE("/hosts/:id", handlers.DeleteHost)
			cmdb.POST("/hosts/import", handlers.ImportHosts)
			cmdb.GET("/hosts/template", handlers.DownloadTemplate)
			cmdb.GET("/hosts/export", handlers.ExportHosts)
		}
	}

	// noVNC 静态文件，优先从 static/novnc，其次从 node_modules
	for _, novncDir := range []string{"static/novnc", "../node_modules/@novnc/novnc", "novnc"} {
		if _, err := os.Stat(novncDir); err == nil {
			r.Static("/novnc", novncDir)
			log.Printf("noVNC served from %s", novncDir)
			break
		}
	}

	// xpra-html5 静态文件：放在 static/xpra 或 xpra-html5 目录
	for _, xpraDir := range []string{"static/xpra", "../static/xpra", "xpra-html5", "../xpra-html5"} {
		if _, err := os.Stat(xpraDir); err == nil {
			r.Static("/xpra", xpraDir)
			log.Printf("xpra-html5 served from %s", xpraDir)
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
		log.Printf("Frontend static files served from %s", frontendDir)
	}

	log.Printf("Server starting on port %s", port)
	log.Printf("API Documentation: http://localhost:%s/api", port)
	
	if err := r.Run(":" + port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
