package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"net"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"hpc-backend/audit"
	"hpc-backend/models"
)

// getRealIP 优先读取反向代理传递的真实客户端 IP
// 依次尝试：X-Real-IP → X-Forwarded-For 第一个公网 IP → Origin → RemoteAddr
func getRealIP(c *gin.Context) string {
	// X-Real-IP（nginx proxy_set_header X-Real-IP $remote_addr）
	if ip := c.GetHeader("X-Real-IP"); ip != "" {
		if parsed := net.ParseIP(strings.TrimSpace(ip)); parsed != nil {
			return parsed.String()
		}
	}

	// X-Forwarded-For: client, proxy1, proxy2 — 取第一个合法公网 IP
	if xff := c.GetHeader("X-Forwarded-For"); xff != "" {
		for _, part := range strings.Split(xff, ",") {
			ip := strings.TrimSpace(part)
			if parsed := net.ParseIP(ip); parsed != nil && !isPrivateIP(parsed) {
				return parsed.String()
			}
		}
		first := strings.TrimSpace(strings.SplitN(xff, ",", 2)[0])
		if parsed := net.ParseIP(first); parsed != nil {
			return parsed.String()
		}
	}

	// Cloudflare / CDN
	if ip := c.GetHeader("CF-Connecting-IP"); ip != "" {
		if parsed := net.ParseIP(strings.TrimSpace(ip)); parsed != nil {
			return parsed.String()
		}
	}

	// 获取 RemoteAddr（去掉端口）
	remoteIP := c.Request.RemoteAddr
	if host, _, err := net.SplitHostPort(remoteIP); err == nil {
		remoteIP = host
	}
	parsed := net.ParseIP(remoteIP)

	// 如果是本地回环（hpc-client 隧道场景），从 Origin 或 Host 头提取来源标识
	if parsed != nil && isLoopback(parsed) {
		// Origin 头格式：http://101.132.157.167:3981
		if origin := c.GetHeader("Origin"); origin != "" {
			// 提取 host 部分作为来源标识（不一定是真实客户端 IP，但能区分来源）
			origin = strings.TrimPrefix(origin, "http://")
			origin = strings.TrimPrefix(origin, "https://")
			if host, _, err := net.SplitHostPort(origin); err == nil {
				origin = host
			}
			if originIP := net.ParseIP(origin); originIP != nil && !isLoopback(originIP) {
				return originIP.String() + " (via-tunnel)"
			}
			if origin != "" {
				return origin + " (via-tunnel)"
			}
		}
		// Host 头
		if host := c.Request.Host; host != "" {
			h := host
			if hp, _, err := net.SplitHostPort(host); err == nil {
				h = hp
			}
			if hIP := net.ParseIP(h); hIP != nil && !isLoopback(hIP) {
				return hIP.String() + " (via-tunnel)"
			}
		}
		return "127.0.0.1 (via-tunnel)"
	}

	return c.ClientIP()
}

// isLoopback 判断是否为回环地址
func isLoopback(ip net.IP) bool {
	return ip.IsLoopback()
}

// isPrivateIP 判断是否为私网/回环地址
func isPrivateIP(ip net.IP) bool {
	privateRanges := []string{
		"10.0.0.0/8",
		"172.16.0.0/12",
		"192.168.0.0/16",
		"127.0.0.0/8",
		"::1/128",
		"fc00::/7",
	}
	for _, cidr := range privateRanges {
		_, network, _ := net.ParseCIDR(cidr)
		if network != nil && network.Contains(ip) {
			return true
		}
	}
	return false
}

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
			IPAddress:  getRealIP(c),
			AccessHost: c.Request.Host,
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
		"/api/audit/page-view", // 页面访问由专用 handler 记录，避免重复
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
