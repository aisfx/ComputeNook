package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"hpc-backend/audit"
	"hpc-backend/models"
)

// AuditMiddleware 审计日志中间件
func AuditMiddleware() gin.HandlerFunc {
	logger := audit.GetLogger()

	return func(c *gin.Context) {
		// 跳过某些不需要审计的路径
		if shouldSkipAudit(c.FullPath()) {
			c.Next()
			return
		}

		startTime := time.Now()

		// 读取请求体（用于记录详情）
		var requestBody []byte
		if c.Request.Body != nil {
			requestBody, _ = io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
		}

		// 创建响应写入器包装器
		blw := &bodyLogWriter{body: bytes.NewBufferString(""), ResponseWriter: c.Writer}
		c.Writer = blw

		// 处理请求
		c.Next()

		// 计算耗时
		duration := time.Since(startTime).Milliseconds()

		// 获取用户信息
		username := "anonymous"
		userRole := "guest"
		if user, exists := c.Get("user"); exists {
			if userMap, ok := user.(map[string]interface{}); ok {
				if un, ok := userMap["username"].(string); ok {
					username = un
				}
				if role, ok := userMap["role"].(string); ok {
					userRole = role
				}
			}
		}

		// 解析操作和资源
		action, resource, resourceID := parseRequest(c.Request.Method, c.FullPath(), c.Param("name"), c.Param("username"), c.Param("gid"))

		// 构建详情
		details := buildDetails(c.Request.Method, c.FullPath(), requestBody)

		// 判断状态
		status := models.StatusSuccess
		errorMsg := ""
		if c.Writer.Status() >= 400 {
			status = models.StatusFailed
			// 尝试从响应中提取错误信息
			var respData map[string]interface{}
			if err := json.Unmarshal(blw.body.Bytes(), &respData); err == nil {
				if errMsg, ok := respData["error"].(string); ok {
					errorMsg = errMsg
				}
			}
		}

		// 记录审计日志
		log := models.AuditLog{
			Username:   username,
			UserRole:   userRole,
			Action:     action,
			Resource:   resource,
			ResourceID: resourceID,
			Details:    details,
			IPAddress:  c.ClientIP(),
			UserAgent:  c.Request.UserAgent(),
			Status:     status,
			ErrorMsg:   errorMsg,
			Duration:   duration,
		}

		logger.Log(log)
	}
}

// bodyLogWriter 响应写入器包装器
type bodyLogWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w bodyLogWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

// shouldSkipAudit 判断是否跳过审计
func shouldSkipAudit(path string) bool {
	skipPaths := []string{
		"/api/health",
		"/api/ping",
		"/api/metrics",
	}

	for _, skipPath := range skipPaths {
		if path == skipPath {
			return true
		}
	}

	return false
}

// parseRequest 解析请求，提取操作类型和资源类型
func parseRequest(method, path, name, username, gid string) (action, resource, resourceID string) {
	// 默认操作
	switch method {
	case "GET":
		action = models.ActionRead
	case "POST":
		action = models.ActionCreate
	case "PUT", "PATCH":
		action = models.ActionUpdate
	case "DELETE":
		action = models.ActionDelete
	}

	// 解析资源类型
	if strings.Contains(path, "/users") {
		resource = models.ResourceUser
		if username != "" {
			resourceID = username
		} else if name != "" {
			resourceID = name
		}
	} else if strings.Contains(path, "/groups") {
		resource = models.ResourceGroup
		if gid != "" {
			resourceID = gid
		}
	} else if strings.Contains(path, "/accounts") {
		resource = models.ResourceAccount
		if name != "" {
			resourceID = name
		}
	} else if strings.Contains(path, "/associations") {
		resource = models.ResourceAssociation
	} else if strings.Contains(path, "/qos") {
		resource = models.ResourceQoS
		if name != "" {
			resourceID = name
		}
	} else if strings.Contains(path, "/jobs") {
		resource = models.ResourceJob
	} else if strings.Contains(path, "/login") {
		action = models.ActionLogin
		resource = "auth"
	} else if strings.Contains(path, "/logout") {
		action = models.ActionLogout
		resource = "auth"
	}

	// 特殊操作
	if strings.Contains(path, "reset-password") {
		action = "reset_password"
	} else if strings.Contains(path, "set-disabled") {
		action = "set_disabled"
	} else if strings.Contains(path, "change-password") {
		action = "change_password"
	}

	return
}

// buildDetails 构建操作详情
func buildDetails(method, path string, requestBody []byte) string {
	details := method + " " + path

	// 如果有请求体，尝试解析并添加关键信息
	if len(requestBody) > 0 && len(requestBody) < 1000 {
		var data map[string]interface{}
		if err := json.Unmarshal(requestBody, &data); err == nil {
			// 移除敏感信息
			delete(data, "password")
			delete(data, "oldPassword")
			delete(data, "newPassword")

			if detailsJSON, err := json.Marshal(data); err == nil {
				details += " | " + string(detailsJSON)
			}
		}
	}

	return details
}
