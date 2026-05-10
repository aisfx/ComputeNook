package cache

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// CacheMiddleware 通用缓存中间件
func CacheMiddleware(keyPrefix string, ttl time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 只缓存GET请求
		if c.Request.Method != http.MethodGet {
			c.Next()
			return
		}

		// 如果Redis未启用，直接跳过
		if !IsEnabled() {
			c.Next()
			return
		}

		// 生成缓存Key（包含路径和查询参数）
		cacheKey := generateCacheKey(keyPrefix, c.Request.URL.String())

		// 尝试从缓存获取
		mgr := NewManager()
		var cachedData interface{}
		
		start := time.Now()
		err := mgr.Get(cacheKey, &cachedData)
		RecordOperation(time.Since(start))

		if err == nil {
			// 缓存命中
			RecordHit()
			c.Header("X-Cache", "HIT")
			c.JSON(http.StatusOK, cachedData)
			c.Abort()
			return
		}

		// 缓存未命中
		RecordMiss()
		c.Header("X-Cache", "MISS")

		// 创建响应写入器来捕获响应
		writer := &responseWriter{
			ResponseWriter: c.Writer,
			body:           []byte{},
		}
		c.Writer = writer

		// 继续处理请求
		c.Next()

		// 如果响应成功，缓存结果
		if c.Writer.Status() == http.StatusOK && len(writer.body) > 0 {
			start := time.Now()
			mgr.Set(cacheKey, writer.body, ttl)
			RecordSet()
			RecordOperation(time.Since(start))
		}
	}
}

// responseWriter 自定义响应写入器
type responseWriter struct {
	gin.ResponseWriter
	body []byte
}

func (w *responseWriter) Write(b []byte) (int, error) {
	w.body = append(w.body, b...)
	return w.ResponseWriter.Write(b)
}

// generateCacheKey 生成缓存Key
func generateCacheKey(prefix, url string) string {
	hash := md5.Sum([]byte(url))
	return fmt.Sprintf("%s%s", prefix, hex.EncodeToString(hash[:]))
}

// InvalidateCache 缓存失效中间件（用于写操作）
func InvalidateCache(patterns ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		// 如果请求成功，清除相关缓存
		if c.Writer.Status() >= 200 && c.Writer.Status() < 300 {
			mgr := NewManager()
			for _, pattern := range patterns {
				start := time.Now()
				mgr.DeletePattern(pattern)
				RecordDelete()
				RecordOperation(time.Since(start))
			}
		}
	}
}
