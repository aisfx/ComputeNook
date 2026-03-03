package main

import (
	"encoding/json"
	"log"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"hpc-backend/handlers"
	"hpc-backend/middleware"
)

func main() {
	// 加载环境变量
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not found")
	}

	log.Println("========================================")
	log.Println("HPC Backend Starting")
	log.Println("========================================")
	log.Printf("LDAP_HOST: %s", os.Getenv("LDAP_HOST"))
	log.Printf("LDAP_PORT: %s", os.Getenv("LDAP_PORT"))
	log.Printf("LDAP_USE_SSL: %s", os.Getenv("LDAP_USE_SSL"))
	log.Printf("LDAP_BASE_DN: %s", os.Getenv("LDAP_BASE_DN"))
	log.Printf("DEV_MODE: %s", os.Getenv("DEV_MODE"))
	log.Println("========================================")

	// 创建 Gin 路由
	r := gin.Default()

	// 自定义模板函数（必须在加载模板之前设置）
	r.SetFuncMap(map[string]interface{}{
		"lower": func(s string) string {
			return strings.ToLower(s)
		},
		"json": func(v interface{}) string {
			b, _ := json.MarshalIndent(v, "", "  ")
			return string(b)
		},
		"contains": func(s, substr string) bool {
			return strings.Contains(s, substr)
		},
	})

	// 加载 HTML 模板
	r.LoadHTMLGlob("templates/*")

	// CORS 中间件
	r.Use(middleware.CORSMiddleware())

	// 审计日志中间件（在认证之后）
	r.Use(middleware.AuditMiddleware())

	// API 文档（公开访问）
	r.GET("/api", handlers.GetAPIDocs)
	r.GET("/api/docs", handlers.GetAPIDocs)

	// 公开路由
	api := r.Group("/api")
	{
		api.POST("/login", handlers.Login)
	}

	// 需要认证的路由
	auth := r.Group("/api")
	auth.Use(middleware.AuthMiddleware())
	{
		auth.GET("/me", handlers.GetCurrentUser)
		
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
		qos := auth.Group("/qos")
		qos.Use(middleware.AdminMiddleware())
		{
			qos.GET("", handlers.GetQoSList)
			qos.GET("/:name", handlers.GetQoS)
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
		}

		// 机时管理 API
		usage := auth.Group("/usage")
		{
			// 普通用户可以查看自己的使用情况
			usage.GET("/user", handlers.GetUserUsage)
			
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
			
			// 连接测试
			webshell.POST("/nodes/:node_name/test", handlers.TestNodeConnection)
		}

		// 文件管理 API
		files := auth.Group("/files")
		{
			// 列出目录内容
			files.GET("/list", handlers.ListDirectory)
			
			// 获取文件信息
			files.GET("/info", handlers.GetFileInfo)
			
			// 读取文件内容
			files.GET("/read", handlers.ReadFile)
			
			// 下载文件
			files.GET("/download", handlers.DownloadFile)
			
			// 写入文件
			files.POST("/write", handlers.WriteFile)
			
			// 上传文件
			files.POST("/upload", handlers.UploadFile)
			
			// 删除文件或目录
			files.DELETE("/delete", handlers.DeleteFile)
			
			// 创建目录
			files.POST("/mkdir", handlers.CreateDirectory)
			
			// 重命名文件或目录
			files.POST("/rename", handlers.RenameFile)
			
			// 复制文件
			files.POST("/copy", handlers.CopyFile)
		}

		// 仪表盘统计 API
		dashboard := auth.Group("/dashboard")
		{
			// 获取集群统计信息
			dashboard.GET("/stats", handlers.GetDashboardStats)
			
			// 获取节点列表
			dashboard.GET("/nodes", handlers.GetDashboardNodes)
		}
	}

	port := os.Getenv("SERVER_PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	log.Printf("API Documentation: http://localhost:%s/api", port)
	log.Printf("API Documentation (JSON): http://localhost:%s/api?format=json", port)
	
	if err := r.Run(":" + port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
