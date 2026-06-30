package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"hpc-backend/cache"
)

// GetCacheMetrics 获取缓存指标
func GetCacheMetrics(c *gin.Context) {
	if !cache.IsEnabled() {
		c.JSON(http.StatusOK, gin.H{
			"enabled": false,
			"message": "Redis cache is disabled",
		})
		return
	}

	metrics := cache.GetMetrics()
	
	c.JSON(http.StatusOK, gin.H{
		"enabled":    true,
		"hits":       metrics.Hits,
		"misses":     metrics.Misses,
		"sets":       metrics.Sets,
		"deletes":    metrics.Deletes,
		"errors":     metrics.Errors,
		"operations": metrics.Operations,
		"hitRate":    metrics.HitRate(),
		"avgOpTime":  metrics.AvgOperationTime(),
	})
}

// ClearCache 清空所有缓存
func ClearCache(c *gin.Context) {
	if !cache.IsEnabled() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Redis cache is disabled"})
		return
	}

	mgr := cache.NewManager()
	if err := mgr.FlushAll(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Cache cleared successfully"})
}

// ClearCachePattern 清空匹配模式的缓存
func ClearCachePattern(c *gin.Context) {
	pattern := c.Param("pattern")
	if pattern == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pattern is required"})
		return
	}

	if !cache.IsEnabled() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Redis cache is disabled"})
		return
	}

	mgr := cache.NewManager()
	if err := mgr.DeletePattern(pattern + "*"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Cache pattern cleared successfully", "pattern": pattern})
}
