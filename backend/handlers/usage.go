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

// GetAccountUsageWithBilling 获取账户机时使用情况（包含 billing 限制）
func GetAccountUsageWithBilling(c *gin.Context) {
	account := c.Query("account")
	if account == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "account parameter is required"})
		return
	}

	// 解析时间参数
	startTimeStr := c.DefaultQuery("start_time", "")
	endTimeStr := c.DefaultQuery("end_time", "")
	
	var startTime, endTime time.Time
	var err error
	
	if startTimeStr != "" {
		if startTimeUnix, err := strconv.ParseInt(startTimeStr, 10, 64); err == nil {
			startTime = time.Unix(startTimeUnix, 0)
		} else {
			startTime, err = time.Parse("2006-01-02", startTimeStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_time format"})
				return
			}
		}
	} else {
		// 默认为30天前
		startTime = time.Now().AddDate(0, 0, -30)
	}
	
	if endTimeStr != "" {
		if endTimeUnix, err := strconv.ParseInt(endTimeStr, 10, 64); err == nil {
			endTime = time.Unix(endTimeUnix, 0)
		} else {
			endTime, err = time.Parse("2006-01-02", endTimeStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid end_time format"})
				return
			}
		}
	} else {
		// 默认为当前时间
		endTime = time.Now()
	}

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

	// 解析时间参数
	startTimeStr := c.DefaultQuery("start_time", "")
	endTimeStr := c.DefaultQuery("end_time", "")
	
	var startTime, endTime time.Time
	var err error
	
	if startTimeStr != "" {
		if startTimeUnix, err := strconv.ParseInt(startTimeStr, 10, 64); err == nil {
			startTime = time.Unix(startTimeUnix, 0)
		} else {
			startTime, err = time.Parse("2006-01-02", startTimeStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_time format"})
				return
			}
		}
	} else {
		startTime = time.Now().AddDate(0, 0, -30)
	}
	
	if endTimeStr != "" {
		if endTimeUnix, err := strconv.ParseInt(endTimeStr, 10, 64); err == nil {
			endTime = time.Unix(endTimeUnix, 0)
		} else {
			endTime, err = time.Parse("2006-01-02", endTimeStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid end_time format"})
				return
			}
		}
	} else {
		endTime = time.Now()
	}

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

// GetAllAccountsUsage 获取所有账户的机时使用情况
func GetAllAccountsUsage(c *gin.Context) {
	// 解析时间参数
	startTimeStr := c.DefaultQuery("start_time", "")
	endTimeStr := c.DefaultQuery("end_time", "")
	
	var startTime, endTime time.Time
	var err error
	
	if startTimeStr != "" {
		if startTimeUnix, err := strconv.ParseInt(startTimeStr, 10, 64); err == nil {
			startTime = time.Unix(startTimeUnix, 0)
		} else {
			startTime, err = time.Parse("2006-01-02", startTimeStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_time format"})
				return
			}
		}
	} else {
		startTime = time.Now().AddDate(0, 0, -7) // 默认7天
	}
	
	if endTimeStr != "" {
		if endTimeUnix, err := strconv.ParseInt(endTimeStr, 10, 64); err == nil {
			endTime = time.Unix(endTimeUnix, 0)
		} else {
			endTime, err = time.Parse("2006-01-02", endTimeStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid end_time format"})
				return
			}
		}
	} else {
		endTime = time.Now()
	}

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
	
	// 解析时间参数
	startTimeStr := c.DefaultQuery("start_time", "")
	endTimeStr := c.DefaultQuery("end_time", "")
	
	var startTime, endTime time.Time
	var err error
	
	if startTimeStr != "" {
		if startTimeUnix, err := strconv.ParseInt(startTimeStr, 10, 64); err == nil {
			startTime = time.Unix(startTimeUnix, 0)
		} else {
			startTime, err = time.Parse("2006-01-02", startTimeStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_time format"})
				return
			}
		}
	} else {
		startTime = time.Now().AddDate(0, 0, -30)
	}
	
	if endTimeStr != "" {
		if endTimeUnix, err := strconv.ParseInt(endTimeStr, 10, 64); err == nil {
			endTime = time.Unix(endTimeUnix, 0)
		} else {
			endTime, err = time.Parse("2006-01-02", endTimeStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid end_time format"})
				return
			}
		}
	} else {
		endTime = time.Now()
	}

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
	// 解析时间参数
	startTimeStr := c.DefaultQuery("start_time", "")
	endTimeStr := c.DefaultQuery("end_time", "")
	
	var startTime, endTime time.Time
	var err error
	
	if startTimeStr != "" {
		if startTimeUnix, err := strconv.ParseInt(startTimeStr, 10, 64); err == nil {
			startTime = time.Unix(startTimeUnix, 0)
		} else {
			startTime, err = time.Parse("2006-01-02", startTimeStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_time format"})
				return
			}
		}
	} else {
		startTime = time.Now().AddDate(0, 0, -7) // 默认7天
	}
	
	if endTimeStr != "" {
		if endTimeUnix, err := strconv.ParseInt(endTimeStr, 10, 64); err == nil {
			endTime = time.Unix(endTimeUnix, 0)
		} else {
			endTime, err = time.Parse("2006-01-02", endTimeStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid end_time format"})
				return
			}
		}
	} else {
		endTime = time.Now()
	}

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

	startTimeStr := c.DefaultQuery("start_time", "")
	endTimeStr := c.DefaultQuery("end_time", "")

	var startTime, endTime time.Time
	var err error

	if startTimeStr != "" {
		if startTimeUnix, err2 := strconv.ParseInt(startTimeStr, 10, 64); err2 == nil {
			startTime = time.Unix(startTimeUnix, 0)
		} else {
			startTime, err = time.Parse("2006-01-02", startTimeStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_time format"})
				return
			}
		}
	} else {
		startTime = time.Now().AddDate(0, 0, -30)
	}

	if endTimeStr != "" {
		if endTimeUnix, err2 := strconv.ParseInt(endTimeStr, 10, 64); err2 == nil {
			endTime = time.Unix(endTimeUnix, 0)
		} else {
			endTime, err = time.Parse("2006-01-02", endTimeStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid end_time format"})
				return
			}
		}
	} else {
		endTime = time.Now()
	}

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

	c.JSON(http.StatusOK, gin.H{"data": usage})
}

func GetAccountUsage(c *gin.Context) {
	account := c.Query("account")
	if account == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "account parameter is required"})
		return
	}

	// 解析时间参数
	startTimeStr := c.DefaultQuery("start_time", "")
	endTimeStr := c.DefaultQuery("end_time", "")
	
	var startTime, endTime time.Time
	var err error
	
	if startTimeStr != "" {
		if startTimeUnix, err := strconv.ParseInt(startTimeStr, 10, 64); err == nil {
			startTime = time.Unix(startTimeUnix, 0)
		} else {
			startTime, err = time.Parse("2006-01-02", startTimeStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_time format"})
				return
			}
		}
	} else {
		startTime = time.Now().AddDate(0, 0, -30)
	}
	
	if endTimeStr != "" {
		if endTimeUnix, err := strconv.ParseInt(endTimeStr, 10, 64); err == nil {
			endTime = time.Unix(endTimeUnix, 0)
		} else {
			endTime, err = time.Parse("2006-01-02", endTimeStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid end_time format"})
				return
			}
		}
	} else {
		endTime = time.Now()
	}

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
