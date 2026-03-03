package handlers

import (
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"hpc-backend/slurm"
)

// GetUserUsage 获取用户机时使用情况
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

	// 开发模式：返回模拟数据
	if os.Getenv("DEV_MODE") == "true" {
		mockUsage := []slurm.UsageRecord{
			{
				User:         user,
				Account:      "default",
				Cluster:      "cluster",
				Partition:    "compute",
				QoS:          "normal",
				CPUTime:      36000,  // 10小时
				CPUHours:     10.0,
				NodeHours:    5.0,
				GPUHours:     2.0,
				MemoryHours:  50.0,
				JobCount:     1,
				StartTime:    startTime,
				EndTime:      endTime,
				State:        "COMPLETED",
			},
			{
				User:         user,
				Account:      "default",
				Cluster:      "cluster",
				Partition:    "gpu",
				QoS:          "high",
				CPUTime:      72000,  // 20小时
				CPUHours:     20.0,
				NodeHours:    10.0,
				GPUHours:     8.0,
				MemoryHours:  100.0,
				JobCount:     1,
				StartTime:    startTime.Add(24 * time.Hour),
				EndTime:      endTime,
				State:        "COMPLETED",
			},
		}
		c.JSON(http.StatusOK, gin.H{"data": mockUsage})
		return
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

// GetAccountUsage 获取账户机时使用情况
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

	// 开发模式：返回模拟数据
	if os.Getenv("DEV_MODE") == "true" {
		mockUsage := []slurm.UsageRecord{
			{
				User:         "user1",
				Account:      account,
				Cluster:      "cluster",
				Partition:    "compute",
				QoS:          "normal",
				CPUTime:      180000, // 50小时
				CPUHours:     50.0,
				NodeHours:    25.0,
				GPUHours:     10.0,
				MemoryHours:  250.0,
				JobCount:     5,
				StartTime:    startTime,
				EndTime:      endTime,
				State:        "COMPLETED",
			},
			{
				User:         "user2",
				Account:      account,
				Cluster:      "cluster",
				Partition:    "gpu",
				QoS:          "high",
				CPUTime:      144000, // 40小时
				CPUHours:     40.0,
				NodeHours:    20.0,
				GPUHours:     16.0,
				MemoryHours:  200.0,
				JobCount:     3,
				StartTime:    startTime,
				EndTime:      endTime,
				State:        "COMPLETED",
			},
		}
		c.JSON(http.StatusOK, gin.H{"data": mockUsage})
		return
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

// GetUsageSummary 获取机时使用汇总
func GetUsageSummary(c *gin.Context) {
	user := c.Query("user")
	account := c.Query("account")
	
	if user == "" && account == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user or account parameter is required"})
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

	// 开发模式：返回模拟数据
	if os.Getenv("DEV_MODE") == "true" {
		mockSummary := &slurm.UsageSummary{
			User:             user,
			Account:          account,
			TotalCPUTime:     324000, // 90小时
			TotalCPUHours:    90.0,
			TotalNodeHours:   45.0,
			TotalGPUHours:    18.0,
			TotalMemoryHours: 450.0,
			TotalJobs:        8,
			Period:           fmt.Sprintf("%s - %s", startTime.Format("2006-01-02"), endTime.Format("2006-01-02")),
		}
		c.JSON(http.StatusOK, gin.H{"data": mockSummary})
		return
	}

	client, err := slurm.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	summary, err := client.GetUsageSummary(user, account, startTime, endTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
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

	// 开发模式：返回模拟数据
	if os.Getenv("DEV_MODE") == "true" {
		mockClusterUsage := map[string]*slurm.UsageSummary{
			"user1@account1": {
				User:             "user1",
				Account:          "account1",
				TotalCPUTime:     180000,
				TotalCPUHours:    50.0,
				TotalNodeHours:   25.0,
				TotalGPUHours:    10.0,
				TotalMemoryHours: 250.0,
				TotalJobs:        5,
				Period:           fmt.Sprintf("%s - %s", startTime.Format("2006-01-02"), endTime.Format("2006-01-02")),
			},
			"user2@account1": {
				User:             "user2",
				Account:          "account1",
				TotalCPUTime:     144000,
				TotalCPUHours:    40.0,
				TotalNodeHours:   20.0,
				TotalGPUHours:    16.0,
				TotalMemoryHours: 200.0,
				TotalJobs:        3,
				Period:           fmt.Sprintf("%s - %s", startTime.Format("2006-01-02"), endTime.Format("2006-01-02")),
			},
		}
		c.JSON(http.StatusOK, gin.H{"data": mockClusterUsage})
		return
	}

	client, err := slurm.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	usage, err := client.GetClusterUsage(startTime, endTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": usage})
}