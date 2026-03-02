package handlers

import (
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"hpc-backend/logger"
	"hpc-backend/slurm"
)

// GetPartitions 获取分区列表
func GetPartitions(c *gin.Context) {
	// 开发模式：返回模拟数据
	if os.Getenv("DEV_MODE") == "true" {
		mockPartitions := []map[string]interface{}{
			{
				"name":         "compute",
				"state":        "UP",
				"max_time":     86400,  // 24小时
				"default_time": 3600,   // 1小时
				"max_nodes":    32,
				"min_nodes":    1,
			},
			{
				"name":         "gpu",
				"state":        "UP",
				"max_time":     172800, // 48小时
				"default_time": 7200,   // 2小时
				"max_nodes":    8,
				"min_nodes":    1,
			},
			{
				"name":         "memory",
				"state":        "UP",
				"max_time":     43200,  // 12小时
				"default_time": 3600,   // 1小时
				"max_nodes":    16,
				"min_nodes":    1,
			},
			{
				"name":         "debug",
				"state":        "UP",
				"max_time":     3600,   // 1小时
				"default_time": 600,    // 10分钟
				"max_nodes":    4,
				"min_nodes":    1,
			},
		}
		c.JSON(http.StatusOK, gin.H{"data": mockPartitions})
		return
	}
	
	client, err := slurm.NewClient()
	if err != nil {
		logger.Error("Failed to create Slurm client: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}
	
	partitions, err := client.GetPartitions()
	if err != nil {
		logger.Error("Failed to get partitions: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取分区列表失败: " + err.Error()})
		return
	}
	
	// 转换为前端需要的格式
	result := make([]map[string]interface{}, 0, len(partitions))
	for _, p := range partitions {
		result = append(result, map[string]interface{}{
			"name":  p.GetPartitionName(),
			"state": p.GetPartitionState(),
			"nodes": p.GetNodesConfigured(),
		})
	}
	
	logger.Info("Successfully retrieved %d partitions", len(result))
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// GetJobs 获取作业列表
func GetJobs(c *gin.Context) {
	// 获取当前用户信息
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}
	
	// 安全地获取管理员状态
	isAdminVal, _ := c.Get("is_admin")
	isAdmin := false
	if isAdminVal != nil {
		isAdmin, _ = isAdminVal.(bool)
	}
	
	// 获取查询参数
	queryUser := c.Query("user")
	startTimeStr := c.Query("start_time")
	endTimeStr := c.Query("end_time")
	
	// 权限检查：非管理员只能查询自己的作业
	if !isAdmin {
		if queryUser != "" && queryUser != username.(string) {
			c.JSON(http.StatusForbidden, gin.H{"error": "无权查询其他用户的作业"})
			return
		}
		queryUser = username.(string)
	}
	
	// 解析时间参数
	var startTime, endTime int64
	if startTimeStr != "" {
		st, err := strconv.ParseInt(startTimeStr, 10, 64)
		if err == nil {
			startTime = st
		}
	}
	if endTimeStr != "" {
		et, err := strconv.ParseInt(endTimeStr, 10, 64)
		if err == nil {
			endTime = et
		}
	}
	
	// 如果没有指定时间范围，默认查询最近1年
	if startTime == 0 && endTime == 0 {
		endTime = time.Now().Unix()
		startTime = endTime - 365*24*60*60 // 1年前
	}
	
	// 开发模式：返回模拟数据
	if os.Getenv("DEV_MODE") == "true" {
		now := time.Now().Unix()
		mockJobs := []map[string]interface{}{
			{
				"job_id":      12345,
				"name":        "test_job_1",
				"user_name":   queryUser,
				"account":     "default",
				"partition":   "normal",
				"job_state":   "RUNNING",
				"nodes":       "node01",
				"cpus":        4,
				"submit_time": now - 3600,
				"start_time":  now - 3000,
				"end_time":    0,
				"time_limit":  7200,
				"work_dir":    "/home/" + queryUser,
			},
			{
				"job_id":      12344,
				"name":        "completed_job",
				"user_name":   queryUser,
				"account":     "default",
				"partition":   "normal",
				"job_state":   "COMPLETED",
				"nodes":       "node02",
				"cpus":        8,
				"submit_time": now - 7200,
				"start_time":  now - 6000,
				"end_time":    now - 1800,
				"time_limit":  7200,
				"work_dir":    "/home/" + queryUser,
			},
			{
				"job_id":      12343,
				"name":        "pending_job",
				"user_name":   queryUser,
				"account":     "default",
				"partition":   "gpu",
				"job_state":   "PENDING",
				"nodes":       "",
				"cpus":        16,
				"submit_time": now - 600,
				"start_time":  0,
				"end_time":    0,
				"time_limit":  3600,
				"work_dir":    "/home/" + queryUser,
			},
		}
		
		// 如果是管理员查询所有作业，添加其他用户的作业
		if isAdmin && queryUser == "" {
			mockJobs = append(mockJobs, map[string]interface{}{
				"job_id":      12346,
				"name":        "user2_job",
				"user_name":   "user2",
				"account":     "research",
				"partition":   "compute",
				"job_state":   "RUNNING",
				"nodes":       "node03,node04",
				"cpus":        32,
				"submit_time": now - 5400,
				"start_time":  now - 4800,
				"end_time":    0,
				"time_limit":  14400,
				"work_dir":    "/home/user2",
			})
		}
		
		logger.Debug("Returning %d mock jobs for user: %s", len(mockJobs), queryUser)
		c.JSON(http.StatusOK, gin.H{"data": mockJobs})
		return
	}
	
	client, err := slurm.NewClient()
	if err != nil {
		logger.Error("Failed to create Slurm client: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}
	
	logger.Debug("Getting jobs for user: %s, start_time: %d, end_time: %d", queryUser, startTime, endTime)
	
	jobs, err := client.GetJobs(queryUser, startTime, endTime)
	if err != nil {
		logger.Error("Failed to get jobs: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取作业列表失败: " + err.Error()})
		return
	}
	
	logger.Info("Successfully retrieved %d jobs", len(jobs))
	c.JSON(http.StatusOK, gin.H{"data": jobs})
}

// GetJob 获取单个作业
func GetJob(c *gin.Context) {
	jobIDStr := c.Param("id")
	jobID, err := strconv.ParseInt(jobIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的作业ID"})
		return
	}
	
	// 获取当前用户信息
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}
	
	// 安全地获取管理员状态
	isAdminVal, _ := c.Get("is_admin")
	isAdmin := false
	if isAdminVal != nil {
		isAdmin, _ = isAdminVal.(bool)
	}
	
	// 开发模式：返回模拟数据
	if os.Getenv("DEV_MODE") == "true" {
		mockJob := map[string]interface{}{
			"job_id":      jobID,
			"name":        "test_job",
			"user_name":   username.(string),
			"account":     "default",
			"partition":   "normal",
			"job_state":   "RUNNING",
			"nodes":       "node01",
			"cpus":        4,
			"submit_time": time.Now().Unix() - 3600,
			"start_time":  time.Now().Unix() - 3000,
			"end_time":    0,
			"time_limit":  7200,
			"work_dir":    "/home/" + username.(string),
		}
		c.JSON(http.StatusOK, gin.H{"data": mockJob})
		return
	}
	
	client, err := slurm.NewClient()
	if err != nil {
		logger.Error("Failed to create Slurm client: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}
	
	job, err := client.GetJob(jobID)
	if err != nil {
		logger.Error("Failed to get job: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "作业不存在: " + err.Error()})
		return
	}
	
	// 权限检查：非管理员只能查询自己的作业
	if !isAdmin && job.User != username.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权查询此作业"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"data": job})
}

// CancelJob 取消作业
func CancelJob(c *gin.Context) {
	jobIDStr := c.Param("id")
	jobID, err := strconv.ParseInt(jobIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的作业ID"})
		return
	}
	
	// 获取当前用户信息
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}
	
	// 安全地获取管理员状态
	isAdminVal, _ := c.Get("is_admin")
	isAdmin := false
	if isAdminVal != nil {
		isAdmin, _ = isAdminVal.(bool)
	}
	
	// 开发模式：模拟取消成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusOK, gin.H{"message": "作业取消成功 (开发模式)"})
		return
	}
	
	client, err := slurm.NewClient()
	if err != nil {
		logger.Error("Failed to create Slurm client: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}
	
	// 先获取作业信息，检查权限
	job, err := client.GetJob(jobID)
	if err != nil {
		logger.Error("Failed to get job: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "作业不存在: " + err.Error()})
		return
	}
	
	// 权限检查：非管理员只能取消自己的作业
	if !isAdmin && job.User != username.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权取消此作业"})
		return
	}
	
	if err := client.CancelJob(jobID); err != nil {
		logger.Error("Failed to cancel job: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "取消作业失败: " + err.Error()})
		return
	}
	
	logger.Info("Job %d cancelled by user %s", jobID, username.(string))
	c.JSON(http.StatusOK, gin.H{"message": "作业取消成功"})
}

// SubmitJob 提交作业
func SubmitJob(c *gin.Context) {
	var req struct {
		// 作业基本信息
		Name      string `json:"name"`
		Partition string `json:"partition"`
		QoS       string `json:"qos"` // 新增QoS字段
		Script    string `json:"script"`
		
		// 资源配置
		Nodes  int `json:"nodes"`
		CPUs   int `json:"cpus"`
		Memory int `json:"memory"` // GB
		GPUs   int `json:"gpus"`
		
		// 时间配置
		TimeLimit int `json:"time"` // 小时
		
		// 文件路径
		WorkDir string `json:"workdir"`
		Output  string `json:"output"`
		Error   string `json:"error"`
		
		// 其他参数
		Priority    string `json:"priority"`
		ExtraParams string `json:"extra_params"`
	}
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求数据格式错误: " + err.Error()})
		return
	}
	
	// 获取当前用户信息
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}
	
	// 开发模式：模拟提交成功
	if os.Getenv("DEV_MODE") == "true" {
		mockJobID := time.Now().Unix()
		logger.Info("DEV MODE: Job submitted by user %s", username.(string))
		c.JSON(http.StatusCreated, gin.H{
			"message": "作业提交成功 (开发模式)",
			"job_id":  mockJobID,
		})
		return
	}
	
	client, err := slurm.NewClient()
	if err != nil {
		logger.Error("Failed to create Slurm client: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}
	
	// 构建作业提交参数
	jobParams := slurm.JobSubmitParams{
		Name:        req.Name,
		Partition:   req.Partition,
		QoS:         req.QoS,
		Script:      req.Script,
		Nodes:       req.Nodes,
		CPUs:        req.CPUs,
		Memory:      req.Memory,
		GPUs:        req.GPUs,
		TimeLimit:   req.TimeLimit,
		WorkDir:     req.WorkDir,
		Output:      req.Output,
		Error:       req.Error,
		Priority:    req.Priority,
		ExtraParams: req.ExtraParams,
	}
	
	jobID, err := client.SubmitJob(jobParams)
	if err != nil {
		logger.Error("Failed to submit job: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "提交作业失败: " + err.Error()})
		return
	}
	
	logger.Info("Job %d submitted by user %s (name: %s, partition: %s, qos: %s)", jobID, username.(string), req.Name, req.Partition, req.QoS)
	c.JSON(http.StatusCreated, gin.H{
		"message": "作业提交成功",
		"job_id":  jobID,
	})
}
