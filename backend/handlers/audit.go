package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"hpc-backend/audit"
	"hpc-backend/models"
)

// GetAuditLogs 获取审计日志列表
func GetAuditLogs(c *gin.Context) {
	logger := audit.GetLogger()

	// 解析查询参数
	filter := audit.LogFilter{
		Username: c.Query("username"),
		Action:   c.Query("action"),
		Resource: c.Query("resource"),
		Status:   c.Query("status"),
		Limit:    1000, // 默认返回最近1000条
	}

	// 解析限制数量
	if limitStr := c.Query("limit"); limitStr != "" {
		if limit, err := strconv.Atoi(limitStr); err == nil && limit > 0 {
			filter.Limit = limit
		}
	}

	// 解析时间范围
	if startTimeStr := c.Query("start_time"); startTimeStr != "" {
		if startTime, err := time.Parse(time.RFC3339, startTimeStr); err == nil {
			filter.StartTime = startTime
		}
	}
	if endTimeStr := c.Query("end_time"); endTimeStr != "" {
		if endTime, err := time.Parse(time.RFC3339, endTimeStr); err == nil {
			filter.EndTime = endTime
		}
	}

	// 获取日志
	logs := logger.GetLogs(filter)

	c.JSON(http.StatusOK, gin.H{
		"data":  logs,
		"total": len(logs),
	})
}

// GetAuditLog 获取单条审计日志
func GetAuditLog(c *gin.Context) {
	logger := audit.GetLogger()

	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid log ID"})
		return
	}

	log := logger.GetLogByID(id)
	if log == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Log not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": log})
}

// GetAuditStats 获取审计统计信息
func GetAuditStats(c *gin.Context) {
	logger := audit.GetLogger()
	stats := logger.GetStats()

	c.JSON(http.StatusOK, gin.H{"data": stats})
}

// ExportAuditLogs 导出审计日志
func ExportAuditLogs(c *gin.Context) {
	logger := audit.GetLogger()

	// 解析查询参数
	filter := audit.LogFilter{
		Username: c.Query("username"),
		Action:   c.Query("action"),
		Resource: c.Query("resource"),
		Status:   c.Query("status"),
		Limit:    10000, // 导出最多10000条
	}

	// 解析时间范围
	if startTimeStr := c.Query("start_time"); startTimeStr != "" {
		if startTime, err := time.Parse(time.RFC3339, startTimeStr); err == nil {
			filter.StartTime = startTime
		}
	}
	if endTimeStr := c.Query("end_time"); endTimeStr != "" {
		if endTime, err := time.Parse(time.RFC3339, endTimeStr); err == nil {
			filter.EndTime = endTime
		}
	}

	// 获取日志
	logs := logger.GetLogs(filter)

	// 设置响应头
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", "attachment; filename=audit_logs.csv")

	// 写入CSV头
	c.Writer.WriteString("ID,时间,用户,角色,操作,资源,资源ID,详情,客户端IP,访问地址,状态,错误信息,耗时(ms)\n")

	// 写入数据
	for _, log := range logs {
		c.Writer.WriteString(strconv.FormatInt(log.ID, 10) + ",")
		c.Writer.WriteString(log.Timestamp.Format("2006-01-02 15:04:05") + ",")
		c.Writer.WriteString(log.Username + ",")
		c.Writer.WriteString(log.UserRole + ",")
		c.Writer.WriteString(log.Action + ",")
		c.Writer.WriteString(log.Resource + ",")
		c.Writer.WriteString(log.ResourceID + ",")
		c.Writer.WriteString("\"" + log.Details + "\",")
		c.Writer.WriteString(log.IPAddress + ",")
		c.Writer.WriteString(log.AccessHost + ",")
		c.Writer.WriteString(log.Status + ",")
		c.Writer.WriteString("\"" + log.ErrorMsg + "\",")
		c.Writer.WriteString(strconv.FormatInt(log.Duration, 10) + "\n")
	}
}

// GetSSHTunnelLogs 获取 SSH 隧道行为日志（管理员）
// GET /api/audit/ssh-logs?username=xxx&date=2006-01-02
func GetSSHTunnelLogs(c *gin.Context) {
	username := c.Query("username")
	date := c.Query("date") // 可选，格式 2006-01-02

	baseDir := "logs/ssh_tunnel"
	type fileInfo struct {
		Username string `json:"username"`
		File     string `json:"file"`
		Path     string `json:"path"`
		Size     int64  `json:"size"`
		ModTime  string `json:"mod_time"`
	}

	var results []fileInfo

	// 遍历用户目录
	userDirs, err := os.ReadDir(baseDir)
	if err != nil {
		if os.IsNotExist(err) {
			c.JSON(http.StatusOK, gin.H{"data": []fileInfo{}})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	for _, ud := range userDirs {
		if !ud.IsDir() {
			continue
		}
		if username != "" && ud.Name() != username {
			continue
		}
		userDir := filepath.Join(baseDir, ud.Name())
		files, _ := os.ReadDir(userDir)
		for _, f := range files {
			if f.IsDir() || filepath.Ext(f.Name()) != ".log" {
				continue
			}
			if date != "" && !strings.HasPrefix(f.Name(), strings.ReplaceAll(date, "-", "")) {
				continue
			}
			info, _ := f.Info()
			results = append(results, fileInfo{
				Username: ud.Name(),
				File:     f.Name(),
				Path:     filepath.Join(userDir, f.Name()),
				Size:     info.Size(),
				ModTime:  info.ModTime().Format("2006-01-02T15:04:05"),
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": results, "total": len(results)})
}

// DownloadSSHTunnelLog 下载 SSH 隧道日志文件
// GET /api/audit/ssh-logs/download?username=xxx&file=xxx.log
func DownloadSSHTunnelLog(c *gin.Context) {
	username := c.Query("username")
	file := c.Query("file")
	if username == "" || file == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username and file required"})
		return
	}
	file = filepath.Base(file)
	logPath := filepath.Join("logs", "ssh_tunnel", username, file)
	if _, err := os.Stat(logPath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
		return
	}

	// 读取并清洗非 UTF-8 / 非可打印字节，避免前端乱码
	raw, err := os.ReadFile(logPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	clean := sanitizeLogBytes(raw)

	// view=1 时直接返回文本内容（供前端弹窗展示），否则触发下载
	if c.Query("view") == "1" {
		c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte(clean))
	} else {
		c.Header("Content-Disposition", "attachment; filename="+file)
		c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte(clean))
	}
}

// sanitizeLogBytes 清洗日志字节：保留可打印 ASCII、UTF-8 多字节字符、换行/制表符，
// 将无法解码的字节替换为 <0xXX> 占位符
func sanitizeLogBytes(data []byte) string {
	var b strings.Builder
	i := 0
	for i < len(data) {
		// 换行、回车、制表符直接保留
		if data[i] == '\n' || data[i] == '\r' || data[i] == '\t' {
			b.WriteByte(data[i])
			i++
			continue
		}
		// 可打印 ASCII
		if data[i] >= 0x20 && data[i] < 0x7f {
			b.WriteByte(data[i])
			i++
			continue
		}
		// 尝试解码 UTF-8 多字节字符
		if data[i] >= 0x80 {
			r, size := decodeUTF8(data[i:])
			if r != 0xFFFD && size > 1 {
				b.WriteRune(r)
				i += size
				continue
			}
		}
		// 无法识别的字节，跳过（不写入，避免乱码）
		i++
	}
	return b.String()
}

func decodeUTF8(b []byte) (rune, int) {
	if len(b) == 0 {
		return 0xFFFD, 1
	}
	// 2字节
	if b[0]&0xE0 == 0xC0 && len(b) >= 2 && b[1]&0xC0 == 0x80 {
		r := rune(b[0]&0x1F)<<6 | rune(b[1]&0x3F)
		if r >= 0x80 {
			return r, 2
		}
	}
	// 3字节
	if b[0]&0xF0 == 0xE0 && len(b) >= 3 && b[1]&0xC0 == 0x80 && b[2]&0xC0 == 0x80 {
		r := rune(b[0]&0x0F)<<12 | rune(b[1]&0x3F)<<6 | rune(b[2]&0x3F)
		if r >= 0x800 {
			return r, 3
		}
	}
	// 4字节
	if b[0]&0xF8 == 0xF0 && len(b) >= 4 && b[1]&0xC0 == 0x80 && b[2]&0xC0 == 0x80 && b[3]&0xC0 == 0x80 {
		r := rune(b[0]&0x07)<<18 | rune(b[1]&0x3F)<<12 | rune(b[2]&0x3F)<<6 | rune(b[3]&0x3F)
		if r >= 0x10000 {
			return r, 4
		}
	}
	return 0xFFFD, 1
}

// PageView 记录前端页面访问
// POST /api/audit/page-view
func PageView(c *gin.Context) {
	username, _ := c.Get("username")
	userRole := "user"
	if isAdmin, ok := c.Get("isAdmin"); ok && isAdmin.(bool) {
		userRole = "admin"
	}

	var body struct {
		Page  string `json:"page"`  // 页面标识，如 "dashboard"、"jobs"
		Title string `json:"title"` // 页面中文名，如 "仪表盘"
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.Page == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "page required"})
		return
	}

	logger := audit.GetLogger()
	logger.Log(models.AuditLog{
		Username:   username.(string),
		UserRole:   userRole,
		Action:     models.ActionPageView,
		Resource:   "page",
		ResourceID: body.Page,
		Details:    body.Title,
		IPAddress:  c.ClientIP(),
		AccessHost: c.Request.Host,
		UserAgent:  c.Request.UserAgent(),
		Status:     models.StatusSuccess,
	})

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// ShellAudit 接收节点 shell wrapper 上报的命令记录
// POST /api/audit/shell  （节点脚本调用，用 JWT token 认证）
func ShellAudit(c *gin.Context) {
	username, _ := c.Get("username")

	var body struct {
		Command  string `json:"command"`
		ExitCode int    `json:"exit_code"`
		WorkDir  string `json:"work_dir"`
		Node     string `json:"node"`
		Blocked  bool   `json:"blocked"` // 是否被拦截
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	action := "shell_command"
	if body.Blocked {
		action = "shell_blocked"
	}

	logger := audit.GetLogger()
	logger.Log(models.AuditLog{
		Username:   username.(string),
		Action:     action,
		Resource:   "shell",
		ResourceID: body.Node,
		Details:    fmt.Sprintf("[%s] %s (exit=%d, dir=%s)", body.Node, body.Command, body.ExitCode, body.WorkDir),
		IPAddress:  c.ClientIP(),
		AccessHost: c.Request.Host,
		UserAgent:  c.Request.UserAgent(),
		Status:     models.StatusSuccess,
	})

	c.JSON(http.StatusOK, gin.H{"ok": true})
}
