package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// 加载环境变量
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not found")
	}

	log.Println("========================================")
	log.Println("File Manager Service Starting")
	log.Println("========================================")
	log.Printf("SERVICE_PORT: %s", os.Getenv("FILEMANAGER_PORT"))
	log.Printf("BASE_PATH: %s", os.Getenv("FILEMANAGER_BASE_PATH"))
	log.Println("========================================")

	// 创建 Gin 路由
	r := gin.Default()

	// CORS 中间件
	r.Use(CORSMiddleware())

	// 健康检查
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "filemanager",
		})
	})

	// 文件管理 API
	api := r.Group("/api/files")
	{
		// 列出目录内容
		api.GET("/list", ListDirectory)
		
		// 获取文件信息
		api.GET("/info", GetFileInfo)
		
		// 读取文件内容
		api.GET("/read", ReadFile)
		
		// 下载文件
		api.GET("/download", DownloadFile)
		
		// 写入文件
		api.POST("/write", WriteFile)
		
		// 上传文件
		api.POST("/upload", UploadFile)
		
		// 删除文件或目录
		api.DELETE("/delete", DeleteFile)
		
		// 创建目录
		api.POST("/mkdir", CreateDirectory)
		
		// 重命名文件或目录
		api.POST("/rename", RenameFile)
		
		// 复制文件
		api.POST("/copy", CopyFile)
	}

	port := os.Getenv("FILEMANAGER_PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("File Manager Service starting on port %s", port)
	log.Printf("API Endpoint: http://localhost:%s/api/files", port)
	
	if err := r.Run(":" + port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}

// CORSMiddleware CORS 中间件
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
