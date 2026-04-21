package handlers

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"golang.org/x/net/webdav"
)

// WebDAV 处理器，挂载用户 home 目录
// GET/PUT/DELETE/MKCOL/COPY/MOVE/PROPFIND/PROPPATCH/LOCK/UNLOCK
// 路由：/api/webdav/*path
func WebDAVHandler(c *gin.Context) {
	username, _ := c.Get("username")
	uname := username.(string)

	homeBase := os.Getenv("HOME_BASE_PATH")
	if homeBase == "" {
		homeBase = "/home"
	}
	root := homeBase + "/" + uname

	// 确保目录存在
	if _, err := os.Stat(root); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "home directory not found"})
		return
	}

	// 从路径中去掉 /api/webdav 前缀，交给 webdav.Handler 处理
	prefix := "/api/webdav"
	handler := &webdav.Handler{
		Prefix:     prefix,
		FileSystem: webdav.Dir(root),
		LockSystem: webdav.NewMemLS(),
	}

	// 安全检查：防止路径穿越
	reqPath := c.Request.URL.Path
	if strings.Contains(reqPath, "..") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid path"})
		return
	}

	handler.ServeHTTP(c.Writer, c.Request)
}
