package handlers

import (
	"net/http"

	"github.com/dchest/captcha"
	"github.com/gin-gonic/gin"
)

func init() {
	// 验证码有效期 5 分钟，长度 6 位数字
	captcha.SetCustomStore(captcha.NewMemoryStore(1024, 5*60))
}

// GetCaptcha GET /api/captcha/new
// 返回验证码 ID 和 PNG 图片（base64）
func GetCaptcha(c *gin.Context) {
	id := captcha.New()
	c.JSON(http.StatusOK, gin.H{"captchaId": id})
}

// GetCaptchaImage GET /api/captcha/:id.png
// 直接返回验证码图片
func GetCaptchaImage(c *gin.Context) {
	id := c.Param("id")
	// 去掉 .png 后缀
	if len(id) > 4 && id[len(id)-4:] == ".png" {
		id = id[:len(id)-4]
	}
	c.Header("Cache-Control", "no-cache, no-store")
	c.Header("Content-Type", "image/png")
	if err := captcha.WriteImage(c.Writer, id, 160, 60); err != nil {
		c.Status(http.StatusNotFound)
	}
}

// validateCaptcha 验证验证码（内部使用）
// 验证后自动销毁，防止重放
func validateCaptcha(id, digits string) bool {
	if id == "" || digits == "" {
		return false
	}
	return captcha.VerifyString(id, digits)
}
