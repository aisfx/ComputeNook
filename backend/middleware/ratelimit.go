package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type loginAttempt struct {
	count    int
	firstAt  time.Time
	lockedAt time.Time
}

var (
	loginMu      sync.Mutex
	loginAttempts = map[string]*loginAttempt{}
)

const (
	maxAttempts = 5             // IP 级别：5次/窗口锁定（配合账户级3次）
	windowDur   = 10 * time.Minute
	lockDur     = 5 * time.Minute
)

// LoginRateLimitMiddleware 登录接口速率限制，防暴力破解
func LoginRateLimitMiddleware() gin.HandlerFunc {
	// 定期清理过期记录
	go func() {
		for range time.Tick(5 * time.Minute) {
			loginMu.Lock()
			now := time.Now()
			for ip, a := range loginAttempts {
				if now.Sub(a.firstAt) > windowDur && now.Sub(a.lockedAt) > lockDur {
					delete(loginAttempts, ip)
				}
			}
			loginMu.Unlock()
		}
	}()

	return func(c *gin.Context) {
		ip := c.ClientIP()
		loginMu.Lock()
		a, ok := loginAttempts[ip]
		if !ok {
			a = &loginAttempt{}
			loginAttempts[ip] = a
		}
		now := time.Now()
		// 锁定期检查
		if !a.lockedAt.IsZero() && now.Sub(a.lockedAt) < lockDur {
			loginMu.Unlock()
			remaining := int((lockDur - now.Sub(a.lockedAt)).Seconds())
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "登录尝试过多，请稍后再试",
				"retry_after": remaining,
			})
			c.Abort()
			return
		}
		// 窗口重置
		if now.Sub(a.firstAt) > windowDur {
			a.count = 0
			a.firstAt = now
			a.lockedAt = time.Time{}
		}
		loginMu.Unlock()

		c.Next()

		// 登录失败时计数
		if c.Writer.Status() == http.StatusUnauthorized {
			loginMu.Lock()
			if a.count == 0 {
				a.firstAt = time.Now()
			}
			a.count++
			if a.count >= maxAttempts {
				a.lockedAt = time.Now()
			}
			loginMu.Unlock()
		} else if c.Writer.Status() == http.StatusOK {
			// 登录成功重置
			loginMu.Lock()
			delete(loginAttempts, ip)
			loginMu.Unlock()
		}
	}
}
