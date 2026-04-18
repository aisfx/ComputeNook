package handlers

import (
	"fmt"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

// GetRuntimeConfig 返回前端运行时配置的 JS 文件
// 挂载到 /config.js，前端 index.html 通过 <script src="/config.js"> 加载
func GetRuntimeConfig(c *gin.Context) {
	apiURL := os.Getenv("PUBLIC_API_URL")
	if apiURL == "" {
		// 默认同域，前端和后端同端口
		apiURL = ""
	}

	fileManagerURL := os.Getenv("PUBLIC_FILEMANAGER_URL")
	if fileManagerURL == "" {
		fileManagerURL = ""
	}

	js := fmt.Sprintf(`window.__CONFIG__ = {
  apiUrl: %q,
  fileManagerUrl: %q
};
`, apiURL, fileManagerURL)

	c.Header("Content-Type", "application/javascript")
	c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
	c.String(http.StatusOK, js)
}
