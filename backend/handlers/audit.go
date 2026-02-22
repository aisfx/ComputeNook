package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"hpc-backend/audit"
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
	c.Writer.WriteString("ID,时间,用户,角色,操作,资源,资源ID,详情,IP地址,状态,错误信息,耗时(ms)\n")

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
		c.Writer.WriteString(log.Status + ",")
		c.Writer.WriteString("\"" + log.ErrorMsg + "\",")
		c.Writer.WriteString(strconv.FormatInt(log.Duration, 10) + "\n")
	}
}
