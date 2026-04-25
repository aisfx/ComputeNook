package middleware

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
)

// 匹配 NoSQL 注入风格的参数名，如 isAdmin[$ne]、password[$gt] 等
var suspiciousParamRe = regexp.MustCompile(`[\[\]$]`)

// SanitizeQueryMiddleware 过滤非法查询参数，防止 API 结构枚举和注入
func SanitizeQueryMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		for key := range c.Request.URL.Query() {
			if suspiciousParamRe.MatchString(key) || strings.Contains(key, "__") {
				c.JSON(http.StatusBadRequest, gin.H{"error": "非法请求参数"})
				c.Abort()
				return
			}
		}
		c.Next()
	}
}
