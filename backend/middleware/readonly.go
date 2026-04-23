package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

// ReadOnlyMiddleware 只读演示模式：仅拦截用户信息和密码相关的写操作
// 在 .env 中设置 DEMO_READONLY=true 启用
func ReadOnlyMiddleware() gin.HandlerFunc {
	enabled := strings.ToLower(strings.TrimSpace(os.Getenv("DEMO_READONLY"))) == "true"

	// 只保护这些路径前缀（用户/密码相关）
	protectedPrefixes := []string{
		"/api/users",
		"/api/groups",
		"/api/profile/change-password",
		"/api/profile",
	}

	return func(c *gin.Context) {
		if !enabled {
			c.Next()
			return
		}
		method := c.Request.Method
		if method == http.MethodGet || method == http.MethodHead || method == http.MethodOptions {
			c.Next()
			return
		}
		path := c.Request.URL.Path
		for _, prefix := range protectedPrefixes {
			if strings.HasPrefix(path, prefix) {
				c.JSON(http.StatusForbidden, gin.H{
					"error": "演示模式：用户信息不允许修改",
					"code":  "DEMO_READONLY",
				})
				c.Abort()
				return
			}
		}
		c.Next()
	}
}
