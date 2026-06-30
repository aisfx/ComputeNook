package handlers

import (
	"net/http"
	"time"

	"github.com/dchest/captcha"
	"github.com/gin-gonic/gin"
	"hpc-backend/cache"
)

func init() {
	// 验证码有效期 5 分钟，长度 6 位数字
	captcha.SetCustomStore(captcha.NewMemoryStore(1024, 5*60))
}

// captchaRateLimitCheck 验证码生成频率限制：同一 IP 每分钟最多 10 次
func captchaRateLimitCheck(ip string) bool {
	// 优先使用Redis
	if cache.IsEnabled() {
		mgr := cache.NewManager()
		key := "captcha:ratelimit:" + ip
		count, err := mgr.Incr(key, time.Minute)
		return err == nil && count <= 10
	}

	// Redis不可用时使用内存（原有逻辑保留作为备份）
	return true
}

// GetCaptcha GET /api/captcha/new
func GetCaptcha(c *gin.Context) {
	if !captchaRateLimitCheck(c.ClientIP()) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "请求过于频繁，请稍后再试"})
		return
	}
	id := captcha.New()
	
	// 如果Redis可用，同时存储到Redis（用于分布式验证）
	if cache.IsEnabled() {
		mgr := cache.NewManager()
		mgr.SetString(cache.CaptchaKey(id), "pending", 5*time.Minute)
	}
	
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
	if err := captcha.WriteImage(c.Writer, id, 240, 80); err != nil {
		c.Status(http.StatusNotFound)
	}
}

// validateCaptcha 验证验证码（内部使用），验证后自动销毁防重放
func validateCaptcha(id, digits string) bool {
	if id == "" || digits == "" {
		return false
	}
	
	// 验证验证码
	valid := captcha.VerifyString(id, digits)
	
	// 如果Redis可用，删除缓存的验证码记录
	if valid && cache.IsEnabled() {
		mgr := cache.NewManager()
		mgr.Delete(cache.CaptchaKey(id))
	}
	
	return valid
}
