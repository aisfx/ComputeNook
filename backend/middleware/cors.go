package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

// CORSMiddleware 处理 CORS 和安全响应头
func CORSMiddleware() gin.HandlerFunc {
	allowedOrigins := map[string]bool{}
	if raw := os.Getenv("CORS_ORIGINS"); raw != "" {
		for _, o := range strings.Split(raw, ",") {
			allowedOrigins[strings.TrimSpace(o)] = true
		}
	}

	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		// ── 1. 基础安全头 ──────────────────────────────────────
		c.Writer.Header().Set("X-Content-Type-Options", "nosniff")
		c.Writer.Header().Set("X-XSS-Protection", "1; mode=block")
		c.Writer.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		// ── 2. HSTS（仅 HTTPS 环境生效，HTTP 下浏览器忽略）──────
		// max-age=31536000 = 1年；includeSubDomains 覆盖子域
		if os.Getenv("ENABLE_HSTS") == "true" {
			c.Writer.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}

		// ── 3. CSP ────────────────────────────────────────────
		// xpra-html 路径需要被 iframe 嵌入，跳过 frame-ancestors 限制
		isXpraProxy := strings.HasPrefix(c.Request.URL.Path, "/api/desktop/sessions/") &&
			strings.Contains(c.Request.URL.Path, "/xpra-html")

		var csp string
		if isXpraProxy {
			// xpra 内置 HTML5 客户端页面：允许被同源 iframe 嵌入，放宽限制
			csp = strings.Join([]string{
				"default-src 'self' blob: data:",
				"script-src 'self' 'unsafe-eval' 'unsafe-inline'",
				"style-src 'self' 'unsafe-inline'",
				"img-src * data: blob:",
				"font-src 'self' data:",
				"media-src 'self' blob:",
				"connect-src 'self' ws: wss:",
				"frame-ancestors 'self'",
			}, "; ")
		} else {
			csp = strings.Join([]string{
				"default-src 'self'",
				"script-src 'self' 'unsafe-eval' 'unsafe-inline'",
				"style-src 'self' 'unsafe-inline'",
				"img-src 'self' data: blob:",
				"font-src 'self' data:",
				"media-src 'self' blob:",
				"connect-src 'self' ws: wss:",
				"frame-src 'self'",
				"frame-ancestors 'none'",
				"base-uri 'self'",
				"form-action 'self'",
			}, "; ")
		}
		c.Writer.Header().Set("Content-Security-Policy", csp)
		// xpra 代理页面也需要允许被 iframe 嵌入
		if isXpraProxy {
			c.Writer.Header().Set("X-Frame-Options", "SAMEORIGIN")
		} else {
			c.Writer.Header().Set("X-Frame-Options", "DENY")
		}

		// ── 4. CORS ───────────────────────────────────────────
		if origin != "" {
			if len(allowedOrigins) > 0 && allowedOrigins[origin] {
				c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
				c.Writer.Header().Set("Vary", "Origin")
				c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
				c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, Cache-Control")
				c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")
			} else if len(allowedOrigins) == 0 && os.Getenv("DEV_MODE") == "true" {
				c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
				c.Writer.Header().Set("Vary", "Origin")
				c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
				c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, Cache-Control")
				c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")
			}
		}

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

