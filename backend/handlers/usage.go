package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"hpc-backend/slurm"
)

// parseTimeParam 解析时间参数，支持 Unix 时间戳、"2006-01-02T15:04:05"、"2006-01-02" 三种格式
// isEnd=true 时，纯日期格式自动设为当天 23:59:59，避免截断当天数据
func parseTimeParam(s string, defaultVal time.Time, isEnd bool) time.Time {
	if s == "" {
		return defaultVal
	}
	if unix, err := strconv.ParseInt(s, 10, 64); err == nil {
		return time.Unix(unix, 0)
	}
	if t, err := time.ParseInLocation("2006-01-02T15:04:05", s, time.Local); err == nil {
		return t
	}
	if t, err := time.Parse("2006-01-02", s); err == nil {
		if isEnd {
			return t.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
		}
		return t
	}
	return defaultVal
}

// GetAccountUsageWithBilling 获取账户机时使用情况（包含 billing 限制）
func GetAccountUsageWithBilling(c *gin.Context) {
	account := c.Query("account")
	if account == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "account parameter is required"})
		return
	}

	startTime := parseTimeParam(c.DefaultQuery("start_time", ""), time.Now().AddDate(0, 0, -30), false)
	endTime   := parseTimeParam(c.DefaultQuery("end_time", ""),   time.Now(),                    true)

	// 获取当前用户
	username, _ := c.Get("username")
	
	client, err := GetSlurmClientForUser(username.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	usage, err := client.GetAccountUsageWithBilling(account, startTime, endTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": usage})
}

// GetUserUsageByAccount 获取用户在特定账户下的机时使用情况
func GetUserUsageByAccount(c *gin.Context) {
	user := c.Query("user")
	account := c.Query("account")
	
	if user == "" || account == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user and account parameters are required"})
		return
	}

	startTime := parseTimeParam(c.DefaultQuery("start_time", ""), time.Now().AddDate(0, 0, -30), false)
	endTime   := parseTimeParam(c.DefaultQuery("end_time", ""),   time.Now(),                    true)

	// 获取当前用户
	username, _ := c.Get("username")
	
	client, err := GetSlurmClientForUser(username.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	usage, err := client.GetUserUsageByAccount(user, account, startTime, endTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": usage})
}

// GetAllUsersUsageRecords 获取所有用户的原始使用记录（管理员专用，用于机时管理页面）
func GetAllUsersUsageRecords(c *gin.Context) {
	startTime := parseTimeParam(c.DefaultQuery("start_time", ""), time.Now().AddDate(0, 0, -7), false)
	endTime   := parseTimeParam(c.DefaultQuery("end_time", ""),   time.Now(),                   true)

	username, _ := c.Get("username")
	client, err := GetSlurmClientForUser(username.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	records, err := client.GetAllUsersUsage(startTime, endTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": records})
}

// GetAllAccountsUsage 获取所有账户的机时使用情况
func GetAllAccountsUsage(c *gin.Context) {
	startTime := parseTimeParam(c.DefaultQuery("start_time", ""), time.Now().AddDate(0, 0, -7), false)
	endTime   := parseTimeParam(c.DefaultQuery("end_time", ""),   time.Now(),                   true)

	// 获取当前用户
	username, _ := c.Get("username")
	
	client, err := GetSlurmClientForUser(username.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	usage, err := client.GetAllAccountsUsage(startTime, endTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": usage})
}

// GetUsageSummary 获取机时使用汇总
func GetUsageSummary(c *gin.Context) {
	user := c.Query("user")
	account := c.Query("account")

	startTime := parseTimeParam(c.DefaultQuery("start_time", ""), time.Now().AddDate(0, 0, -30), false)
	endTime   := parseTimeParam(c.DefaultQuery("end_time", ""),   time.Now(),                    true)

	// 获取当前用户
	username, _ := c.Get("username")
	
	client, err := GetSlurmClientForUser(username.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var records []slurm.UsageRecord
	
	if user != "" {
		records, err = client.GetUserUsage(user, startTime, endTime)
	} else if account != "" {
		records, err = client.GetAccountUsage(account, startTime, endTime)
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user or account parameter is required"})
		return
	}
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 计算汇总
	summary := map[string]interface{}{
		"total_jobs":         len(records),
		"total_cpu_hours":    0.0,
		"total_node_hours":   0.0,
		"total_gpu_hours":    0.0,
		"total_memory_hours": 0.0,
		"period":             fmt.Sprintf("%s - %s", startTime.Format("2006-01-02"), endTime.Format("2006-01-02")),
	}
	
	for _, record := range records {
		summary["total_cpu_hours"] = summary["total_cpu_hours"].(float64) + record.CPUHours
		summary["total_node_hours"] = summary["total_node_hours"].(float64) + record.NodeHours
		summary["total_gpu_hours"] = summary["total_gpu_hours"].(float64) + record.GPUHours
		summary["total_memory_hours"] = summary["total_memory_hours"].(float64) + record.MemoryHours
	}

	c.JSON(http.StatusOK, gin.H{"data": summary})
}

// GetClusterUsage 获取集群整体机时使用情况
func GetClusterUsage(c *gin.Context) {
	startTime := parseTimeParam(c.DefaultQuery("start_time", ""), time.Now().AddDate(0, 0, -7), false)
	endTime   := parseTimeParam(c.DefaultQuery("end_time", ""),   time.Now(),                   true)

	// 获取当前用户
	username, _ := c.Get("username")
	
	client, err := GetSlurmClientForUser(username.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	usage, err := client.GetAllAccountsUsage(startTime, endTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": usage})
}

// 保留原有的函数以兼容现有代码
func GetUserUsage(c *gin.Context) {
	user := c.Query("user")
	if user == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user parameter is required"})
		return
	}

	startTime := parseTimeParam(c.DefaultQuery("start_time", ""), time.Now().AddDate(0, 0, -30), false)
	endTime   := parseTimeParam(c.DefaultQuery("end_time", ""),   time.Now(),                    true)

	username, _ := c.Get("username")

	client, err := GetSlurmClientForUser(username.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "slurm client error: " + err.Error()})
		return
	}

	usage, err := client.GetUserUsage(user, startTime, endTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  err.Error(),
			"user":   user,
			"start":  startTime.Format(time.RFC3339),
			"end":    endTime.Format(time.RFC3339),
		})
		return
	}

	// UID 查不到时退回用户名
	if len(usage) == 0 {
		uid := ResolveUID(user)
		if uid != user {
			usage, _ = client.GetUserUsage(uid, startTime, endTime)
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": usage})
}

func GetAccountUsage(c *gin.Context) {
	account := c.Query("account")
	if account == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "account parameter is required"})
		return
	}

	startTime := parseTimeParam(c.DefaultQuery("start_time", ""), time.Now().AddDate(0, 0, -30), false)
	endTime   := parseTimeParam(c.DefaultQuery("end_time", ""),   time.Now(),                    true)

	// 获取当前用户
	username, _ := c.Get("username")
	
	client, err := GetSlurmClientForUser(username.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	usage, err := client.GetAccountUsage(account, startTime, endTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": usage})
}

// DebugUserUsage 调试接口：直接返回原始 Slurm jobs 数据，用于排查机时计算问题
func DebugUserUsage(c *gin.Context) {
	username, _ := c.Get("username")
	user := c.DefaultQuery("user", username.(string))

	days := 30
	if d := c.Query("days"); d != "" {
		if n, err := strconv.Atoi(d); err == nil {
			days = n
		}
	}

	startTime := time.Now().AddDate(0, 0, -days)
	endTime := time.Now()

	client, err := GetSlurmClientForUser(username.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	records, err := client.GetUserUsage(user, startTime, endTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error(), "detail": fmt.Sprintf("%+v", err)})
		return
	}

	// 汇总
	var totalBillingMins float64
	var totalCPUHours float64
	for _, r := range records {
		totalBillingMins += r.BillingHours * 60
		totalCPUHours += r.CPUHours
	}

	c.JSON(http.StatusOK, gin.H{
		"user":                user,
		"period_days":         days,
		"record_count":        len(records),
		"total_billing_mins":  totalBillingMins,
		"total_billing_hours": totalBillingMins / 60,
		"total_cpu_hours":     totalCPUHours,
		"records":             records,
	})
}

// DebugRawJobs 直接返回 Slurm jobs 原始响应，用于排查字段结构
func DebugRawJobs(c *gin.Context) {
	username, _ := c.Get("username")
	user := c.DefaultQuery("user", username.(string))
	days := 7
	if d := c.Query("days"); d != "" {
		if n, err := strconv.Atoi(d); err == nil {
			days = n
		}
	}

	startTime := time.Now().AddDate(0, 0, -days)
	endTime := time.Now()

	client, err := GetSlurmClientForUser(username.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 直接调用原始 API
	path := fmt.Sprintf("/slurmdb/%s/jobs?users=%s&start_time=%d&end_time=%d",
		"v0.0.43", user, startTime.Unix(), endTime.Unix())
	raw, err := client.RawRequest("GET", path, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 返回原始 JSON（只取前2条作业避免数据太多）
	var result map[string]interface{}
	if err := json.Unmarshal(raw, &result); err != nil {
		c.Data(http.StatusOK, "application/json", raw)
		return
	}

	if jobs, ok := result["jobs"].([]interface{}); ok && len(jobs) > 2 {
		result["jobs"] = jobs[:2]
		result["_truncated"] = fmt.Sprintf("showing 2 of %d jobs", len(jobs))
	}

	c.JSON(http.StatusOK, result)
}
