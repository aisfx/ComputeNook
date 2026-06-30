package handlers

import (
	"fmt"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

// GetRuntimeConfig 返回前端运行时配置的 JS 文件
func GetRuntimeConfig(c *gin.Context) {
	apiURL := os.Getenv("PUBLIC_API_URL")
	fileManagerURL := os.Getenv("PUBLIC_FILEMANAGER_URL")
	homeBasePath := os.Getenv("HOME_BASE_PATH")
	if homeBasePath == "" {
		homeBasePath = "/home"
	}

	js := fmt.Sprintf(`window.__CONFIG__ = {
  apiUrl: %q,
  fileManagerUrl: %q,
  homeBasePath: %q
};
`, apiURL, fileManagerURL, homeBasePath)

	c.Header("Content-Type", "application/javascript")
	c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
	c.String(http.StatusOK, js)
}
