package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// GetAPIDocs API 文档接口已关闭（安全原因，防止架构信息泄露）
func GetAPIDocs(c *gin.Context) {
	c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
}
