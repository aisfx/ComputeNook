package handlers

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"golang.org/x/net/webdav"
)

// WebDAVHandler 处理 WebDAV 请求
// 支持两种认证方式：
//  1. Bearer Token（前端/API 调用）
//  2. Basic Auth（Windows/macOS 原生 WebDAV 挂载）
func WebDAVHandler(c *gin.Context) {
	username, exists := c.Get("username")

	// 如果 AuthMiddleware 没有设置用户（不应该发生），尝试 Basic Auth
	if !exists || username == nil || username.(string) == "" {
		c.Header("WWW-Authenticate", `Basic realm="HPC WebDAV"`)
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	uname := username.(string)

	homeBase := os.Getenv("HOME_BASE_PATH")
	if homeBase == "" {
		homeBase = "/home"
	}
	root := homeBase + "/" + uname

	if _, err := os.Stat(root); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "home directory not found"})
		return
	}

	prefix := "/api/webdav"
	handler := &webdav.Handler{
		Prefix:     prefix,
		FileSystem: webdav.Dir(root),
		LockSystem: webdav.NewMemLS(),
	}

	reqPath := c.Request.URL.Path
	if strings.Contains(reqPath, "..") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid path"})
		return
	}

	handler.ServeHTTP(c.Writer, c.Request)
}
