package handlers

import (
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

	client, err := slurm.NewClient()
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

	client, err := slurm.NewClient()
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

	client, err := slurm.NewClient()
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

	client, err := slurm.NewClient()
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

	client, err := slurm.NewClient()
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

	client, err := slurm.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	usage, err := client.GetUserUsage(user, startTime, endTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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

	client, err := slurm.NewClient()
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