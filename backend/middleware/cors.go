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
		c.Writer.Header().Set("X-Frame-Options", "DENY")
		c.Writer.Header().Set("X-XSS-Protection", "1; mode=block")
		c.Writer.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		// ── 2. HSTS（仅 HTTPS 环境生效，HTTP 下浏览器忽略）──────
		// max-age=31536000 = 1年；includeSubDomains 覆盖子域
		if os.Getenv("ENABLE_HSTS") == "true" {
			c.Writer.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}

		// ── 3. CSP ────────────────────────────────────────────
		// script-src 去掉 unsafe-inline，只保留 unsafe-eval（echarts 需要 new Function()）
		// style-src 保留 unsafe-inline（Vue 运行时动态注入 <style> 标签）
		// connect-src 允许 ws/wss 用于 WebSocket 隧道/Shell
		csp := strings.Join([]string{
			"default-src 'self'",
			"script-src 'self' 'unsafe-eval'",  // 去掉 unsafe-inline，echarts 需要 unsafe-eval
			"style-src 'self' 'unsafe-inline'", // Vue 动态样式必须保留 unsafe-inline
			"img-src 'self' data: blob:",
			"font-src 'self' data:",
			"connect-src 'self' ws: wss:",                     // WebSocket 隧道/Shell
			"frame-ancestors 'none'",                          // 禁止被 iframe 嵌入
			"base-uri 'self'",
			"form-action 'self'",
		}, "; ")
		c.Writer.Header().Set("Content-Security-Policy", csp)

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

