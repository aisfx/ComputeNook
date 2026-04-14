package handlers

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"hpc-backend/logger"
	"hpc-backend/slurm"
)

// GetJobs 获取作业列表
func GetJobs(c *gin.Context) {
	// 获取当前用户信息
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}
	
	// 安全地获取管理员状态
	isAdminVal, _ := c.Get("isAdmin")
	isAdmin := false
	if isAdminVal != nil {
		isAdmin, _ = isAdminVal.(bool)
	}
	
	log.Printf("GetJobs: username=%s, isAdmin=%v", username, isAdmin)
	
	// 获取查询参数
	queryUser := c.Query("user")
	startTimeStr := c.Query("start_time")
	endTimeStr := c.Query("end_time")
	
	log.Printf("GetJobs: queryUser=%s, startTime=%s, endTime=%s", queryUser, startTimeStr, endTimeStr)
	
	// 权限检查：非管理员只能查询自己的作业
	if !isAdmin {
		if queryUser != "" && queryUser != username.(string) {
			c.JSON(http.StatusForbidden, gin.H{"error": "无权查询其他用户的作业"})
			return
		}
		queryUser = username.(string)
	}
	
	log.Printf("GetJobs: Final queryUser=%s", queryUser)
	
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
	
	// 如果没有指定时间范围，根据视图模式设置默认时间范围
	if startTime == 0 && endTime == 0 {
		endTime = time.Now().Unix()
		
		// "我的作业"模式：显示最近1天的作业
		// "所有作业"模式：显示最近1个月的作业
		if queryUser != "" {
			// 我的作业：1天
			startTime = endTime - 24*60*60
			logger.Debug("My jobs mode: showing jobs from last 1 day")
		} else {
			// 所有作业：30天
			startTime = endTime - 30*24*60*60
			logger.Debug("All jobs mode: showing jobs from last 30 days")
		}
	}
	
	logger.Debug("Time range: start=%d, end=%d", startTime, endTime)
	
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
	
	// 使用当前登录用户的username创建Slurm客户端（而不是queryUser）
	// 这样即使查询所有作业，也会使用当前用户的JWT token
	client, err := GetSlurmClientForUser(username.(string))
	if err != nil {
		logger.Error("Failed to create Slurm client: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}
	
	// 获取分页参数
	pageStr := c.DefaultQuery("page", "1")
	pageSizeStr := c.DefaultQuery("page_size", "15")
	
	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}
	
	pageSize, err := strconv.Atoi(pageSizeStr)
	if err != nil || pageSize < 1 {
		pageSize = 15
	}
	
	logger.Debug("Getting jobs for user: %s, start_time: %d, end_time: %d, page: %d, page_size: %d", 
		queryUser, startTime, endTime, page, pageSize)
	
	jobs, err := client.GetJobs(queryUser, startTime, endTime)
	if err != nil {
		logger.Error("Failed to get jobs: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取作业列表失败: " + err.Error()})
		return
	}
	
	// 转换为前端需要的格式
	allJobs := make([]map[string]interface{}, 0, len(jobs))
	for _, job := range jobs {
		allJobs = append(allJobs, map[string]interface{}{
			"job_id":      job.JobID,
			"name":        job.Name,
			"user_name":   job.GetUser(),
			"account":     job.Account,
			"partition":   job.Partition,
			"job_state":   job.GetJobState(),
			"nodes":       job.Nodes,
			"cpus":        job.GetCPUs(),
			"submit_time": job.GetSubmitTime(),
			"start_time":  job.GetStartTime(),
			"end_time":    job.GetEndTime(),
			"work_dir":    job.GetWorkingDirectory(),
		})
	}
	
	// 按作业 ID 倒序排序（最新的作业在前面）
	sort.Slice(allJobs, func(i, j int) bool {
		return allJobs[i]["job_id"].(int64) > allJobs[j]["job_id"].(int64)
	})
	
	// 计算分页
	total := len(allJobs)
	totalPages := (total + pageSize - 1) / pageSize
	
	start := (page - 1) * pageSize
	end := start + pageSize
	
	if start >= total {
		start = 0
		end = 0
	} else if end > total {
		end = total
	}
	
	pagedJobs := []map[string]interface{}{}
	if start < end {
		pagedJobs = allJobs[start:end]
	}
	
	logger.Info("Successfully retrieved %d jobs (page %d/%d, showing %d jobs)", 
		total, page, totalPages, len(pagedJobs))
	
	c.JSON(http.StatusOK, gin.H{
		"data": pagedJobs,
		"pagination": gin.H{
			"page":        page,
			"page_size":   pageSize,
			"total":       total,
			"total_pages": totalPages,
		},
	})
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
	if !isAdmin && job.GetUser() != username.(string) {
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
	isAdminVal, _ := c.Get("isAdmin")
	isAdmin := false
	if isAdminVal != nil {
		isAdmin, _ = isAdminVal.(bool)
	}
	
	logger.Info("CancelJob: user=%s, isAdmin=%v, jobID=%d", username, isAdmin, jobID)
	
	// 开发模式：模拟取消成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusOK, gin.H{"message": "作业取消成功 (开发模式)"})
		return
	}
	
	client, err := GetSlurmClientForUser(username.(string))
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
	if !isAdmin && job.GetUser() != username.(string) {
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

// SuspendJob 暂停作业
func SuspendJob(c *gin.Context) {
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
	isAdminVal, _ := c.Get("isAdmin")
	isAdmin := false
	if isAdminVal != nil {
		isAdmin, _ = isAdminVal.(bool)
	}
	
	logger.Info("SuspendJob: user=%s, isAdmin=%v, jobID=%d", username, isAdmin, jobID)
	
	// 开发模式：模拟暂停成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusOK, gin.H{"message": "作业暂停成功 (开发模式)"})
		return
	}
	
	client, err := GetSlurmClientForUser(username.(string))
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
	
	// 权限检查：非管理员只能暂停自己的作业
	if !isAdmin && job.GetUser() != username.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权暂停此作业"})
		return
	}
	
	if err := client.SuspendJob(jobID); err != nil {
		logger.Error("Failed to suspend job: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "暂停作业失败: " + err.Error()})
		return
	}
	
	logger.Info("Job %d suspended by user %s", jobID, username.(string))
	c.JSON(http.StatusOK, gin.H{"message": "作业暂停成功"})
}

// ResumeJob 恢复作业
func ResumeJob(c *gin.Context) {
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
	isAdminVal, _ := c.Get("isAdmin")
	isAdmin := false
	if isAdminVal != nil {
		isAdmin, _ = isAdminVal.(bool)
	}
	
	logger.Info("ResumeJob: user=%s, isAdmin=%v, jobID=%d", username, isAdmin, jobID)
	
	// 开发模式：模拟恢复成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusOK, gin.H{"message": "作业恢复成功 (开发模式)"})
		return
	}
	
	client, err := GetSlurmClientForUser(username.(string))
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
	
	// 权限检查：非管理员只能恢复自己的作业
	if !isAdmin && job.GetUser() != username.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权恢复此作业"})
		return
	}
	
	if err := client.ResumeJob(jobID); err != nil {
		logger.Error("Failed to resume job: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "恢复作业失败: " + err.Error()})
		return
	}
	
	logger.Info("Job %d resumed by user %s", jobID, username.(string))
	c.JSON(http.StatusOK, gin.H{"message": "作业恢复成功"})
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
	
	logger.Info("========== SUBMIT JOB REQUEST ==========")
	logger.Info("Authenticated user: %s", username.(string))
	logger.Info("Request: name=%s, partition=%s, qos=%s", req.Name, req.Partition, req.QoS)
	logger.Info("Resources: nodes=%d, cpus=%d, memory=%dGB, gpus=%d, time=%dh", 
		req.Nodes, req.CPUs, req.Memory, req.GPUs, req.TimeLimit)
	logger.Info("=========================================")
	
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
	
	client, err := GetSlurmClientForUser(username.(string))
	if err != nil {
		logger.Error("Failed to create Slurm client: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}
	
	// 如果没有指定工作目录，使用用户的home目录
	workDir := req.WorkDir
	if workDir == "" {
		// 从环境变量获取home目录基础路径
		homeBasePath := os.Getenv("HOME_BASE_PATH")
		if homeBasePath == "" {
			homeBasePath = "/home" // 默认值
		}
		// 从用户名构建home目录路径
		workDir = fmt.Sprintf("%s/%s", homeBasePath, username.(string))
		logger.Info("No working directory specified, using default: %s", workDir)
	}
	
	// 验证工作目录路径
	logger.Info("Job submission request: name=%s, partition=%s, workdir=%s, script_length=%d", 
		req.Name, req.Partition, workDir, len(req.Script))
	
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
		WorkDir:     workDir,
		Output:      "",  // 不指定，让Slurm使用默认值
		Error:       "",  // 不指定，让Slurm使用默认值
		Priority:    req.Priority,
		ExtraParams: req.ExtraParams,
		Username:    username.(string), // 传递LDAP用户名
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

// GetPartitions 获取分区列表
func GetPartitions(c *gin.Context) {
	// 获取当前用户信息
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}
	
	// 创建 Slurm 客户端（使用当前用户的JWT token）
	client, err := GetSlurmClientForUser(username.(string))
	if err != nil {
		logger.Error("Failed to create Slurm client: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to Slurm"})
		return
	}
	
	// 获取分区列表
	partitions, err := client.GetPartitions()
	if err != nil {
		logger.Error("Failed to get partitions: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get partitions: " + err.Error()})
		return
	}
	
	// 转换为前端格式
	partitionList := make([]map[string]interface{}, 0, len(partitions))
	for _, partition := range partitions {
		partitionInfo := map[string]interface{}{
			"name":  partition.GetPartitionName(),
			"state": partition.GetPartitionState(),
			"nodes": partition.GetNodesConfigured(),
		}
		partitionList = append(partitionList, partitionInfo)
	}
	
	logger.Info("Retrieved %d partitions", len(partitionList))
	c.JSON(http.StatusOK, gin.H{"data": partitionList})
}
