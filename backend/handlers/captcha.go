package handlers

import (
	"net/http"
	"sync"
	"time"

	"github.com/dchest/captcha"
	"github.com/gin-gonic/gin"
)

func init() {
	// 验证码有效期 5 分钟，长度 6 位数字
	captcha.SetCustomStore(captcha.NewMemoryStore(1024, 5*60))
}

// captchaRateLimit 验证码生成频率限制：同一 IP 每分钟最多 10 次
var (
	captchaIPMu    sync.Mutex
	captchaIPCount = map[string]struct {
		count int
		reset time.Time
	}{}
)

func captchaRateLimitCheck(ip string) bool {
	captchaIPMu.Lock()
	defer captchaIPMu.Unlock()
	now := time.Now()
	entry := captchaIPCount[ip]
	if now.After(entry.reset) {
		entry = struct {
			count int
			reset time.Time
		}{0, now.Add(time.Minute)}
	}
	entry.count++
	captchaIPCount[ip] = entry
	return entry.count <= 10
}

// GetCaptcha GET /api/captcha/new
func GetCaptcha(c *gin.Context) {
	if !captchaRateLimitCheck(c.ClientIP()) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "请求过于频繁，请稍后再试"})
		return
	}
	id := captcha.New()
	c.JSON(http.StatusOK, gin.H{"captchaId": id})
}

// GetCaptchaImage GET /api/captcha/:id.png
func GetCaptchaImage(c *gin.Context) {
	id := c.Param("id")
	if len(id) > 4 && id[len(id)-4:] == ".png" {
		id = id[:len(id)-4]
	}
	c.Header("Cache-Control", "no-cache, no-store")
	c.Header("Content-Type", "image/png")
	if err := captcha.WriteImage(c.Writer, id, 160, 60); err != nil {
		c.Status(http.StatusNotFound)
	}
}

// validateCaptcha 验证验证码（内部使用），验证后自动销毁防重放
func validateCaptcha(id, digits string) bool {
	if id == "" || digits == "" {
		return false
	}
	return captcha.VerifyString(id, digits)
}
