package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sync"

	"github.com/gin-gonic/gin"
)

var dbMu sync.Mutex

func userDashboardPath(username string) string {
	dir := "data/dashboards"
	os.MkdirAll(dir, 0755) //nolint:errcheck
	return filepath.Join(dir, username+".json")
}

// GetUserDashboards GET /api/user/dashboards
func GetUserDashboards(c *gin.Context) {
	username, _ := c.Get("username")
	path := userDashboardPath(username.(string))

	dbMu.Lock()
	defer dbMu.Unlock()

	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		c.JSON(http.StatusOK, gin.H{"data": nil})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// 直接返回原始 JSON，前端自行解析
	c.Data(http.StatusOK, "application/json", data)
}

// SaveUserDashboards POST /api/user/dashboards
func SaveUserDashboards(c *gin.Context) {
	username, _ := c.Get("username")
	path := userDashboardPath(username.(string))

	var body json.RawMessage
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	dbMu.Lock()
	defer dbMu.Unlock()

	if err := os.WriteFile(path, body, 0644); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
