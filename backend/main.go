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
