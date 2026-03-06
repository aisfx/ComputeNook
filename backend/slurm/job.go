package slurm

import (
	"encoding/json"
	"fmt"
	"hpc-backend/logger"
	"strings"
)

// Job Slurm 作业
type Job struct {
	JobID            int64  `json:"job_id"`
	Name             string `json:"name"`
	UserName         string `json:"user_name"`
	Account          string `json:"account"`
	Partition        string `json:"partition"`
	JobState         []string `json:"job_state"`
	Nodes            string `json:"nodes"`
	CPUs             struct {
		Set      bool  `json:"set"`
		Infinite bool  `json:"infinite"`
		Number   int64 `json:"number"`
	} `json:"cpus"`
	SubmitTime struct {
		Set      bool  `json:"set"`
		Infinite bool  `json:"infinite"`
		Number   int64 `json:"number"`
	} `json:"submit_time"`
	StartTime struct {
		Set      bool  `json:"set"`
		Infinite bool  `json:"infinite"`
		Number   int64 `json:"number"`
	} `json:"start_time"`
	EndTime struct {
		Set      bool  `json:"set"`
		Infinite bool  `json:"infinite"`
		Number   int64 `json:"number"`
	} `json:"end_time"`
	CurrentWorkingDirectory string `json:"current_working_directory"`
	StandardOutput          string `json:"standard_output"`
	StandardError           string `json:"standard_error"`
	
	// 兼容旧版本API
	User  string `json:"user"`
	State struct {
		Current []string `json:"current"`
		Reason  string   `json:"reason"`
	} `json:"state"`
	Required struct {
		CPUs int `json:"CPUs"`
	} `json:"required"`
	Time struct {
		Submission int64 `json:"submission"`
		Start      int64 `json:"start"`
		End        int64 `json:"end"`
		Elapsed    int64 `json:"elapsed"`
	} `json:"time"`
	WorkingDirectory string `json:"working_directory"`
	Stdout           string `json:"stdout"`
	Stderr           string `json:"stderr"`
}

// GetJobState 获取作业状态
func (j *Job) GetJobState() string {
	// 优先使用新版本API的字段
	if len(j.JobState) > 0 {
		return j.JobState[0]
	}
	// 兼容旧版本
	if len(j.State.Current) > 0 {
		return j.State.Current[0]
	}
	return "UNKNOWN"
}

// GetCPUs 获取 CPU 数量
func (j *Job) GetCPUs() int {
	// 优先使用新版本API的字段
	if j.CPUs.Set {
		return int(j.CPUs.Number)
	}
	// 兼容旧版本
	return j.Required.CPUs
}

// GetSubmitTime 获取提交时间
func (j *Job) GetSubmitTime() int64 {
	// 优先使用新版本API的字段
	if j.SubmitTime.Set {
		return j.SubmitTime.Number
	}
	// 兼容旧版本
	return j.Time.Submission
}

// GetStartTime 获取开始时间
func (j *Job) GetStartTime() int64 {
	// 优先使用新版本API的字段
	if j.StartTime.Set {
		return j.StartTime.Number
	}
	// 兼容旧版本
	return j.Time.Start
}

// GetEndTime 获取结束时间
func (j *Job) GetEndTime() int64 {
	// 优先使用新版本API的字段
	if j.EndTime.Set {
		return j.EndTime.Number
	}
	// 兼容旧版本
	return j.Time.End
}

// GetUser 获取用户名
func (j *Job) GetUser() string {
	// 优先使用新版本API的字段
	if j.UserName != "" {
		return j.UserName
	}
	// 兼容旧版本
	return j.User
}

// GetWorkingDirectory 获取工作目录
func (j *Job) GetWorkingDirectory() string {
	// 优先使用新版本API的字段
	if j.CurrentWorkingDirectory != "" {
		return j.CurrentWorkingDirectory
	}
	// 兼容旧版本
	return j.WorkingDirectory
}

// JobsResponse Slurm 作业列表响应
type JobsResponse struct {
	Jobs   []Job   `json:"jobs"`
	Errors []Error `json:"errors"`
}

// JobResponse Slurm 单个作业响应
type JobResponse struct {
	Jobs   []Job   `json:"jobs"`
	Errors []Error `json:"errors"`
}

// GetJobs 获取作业列表
// username: 用户名（为空则查询所有）
// startTime: 开始时间（Unix时间戳，为0则不限制）
// endTime: 结束时间（Unix时间戳，为0则不限制）
func (c *Client) GetJobs(username string, startTime, endTime int64) ([]Job, error) {
	allJobs := []Job{}
	
	// 1. 获取当前运行的作业（使用 /slurm/ API）
	runningPath := fmt.Sprintf("/slurm/%s/jobs", c.apiVersion)
	if username != "" {
		runningPath += fmt.Sprintf("?user_name=%s", username)
	}
	
	logger.Debug("GetJobs (running) API request: GET %s", runningPath)
	logger.Debug("Full URL: %s%s", c.baseURL, runningPath)
	
	runningRespBody, err := c.doRequest("GET", runningPath, nil)
	if err != nil {
		logger.Info("Failed to get running jobs: %v", err)
		// 继续执行，不返回错误
	} else {
		var runningResponse JobsResponse
		if err := json.Unmarshal(runningRespBody, &runningResponse); err != nil {
			logger.Info("Failed to parse running jobs response: %v", err)
		} else if len(runningResponse.Errors) > 0 {
			logger.Info("Slurm API returned errors for running jobs: %s", runningResponse.Errors[0].Error)
		} else {
			logger.Info("Found %d running jobs", len(runningResponse.Jobs))
			allJobs = append(allJobs, runningResponse.Jobs...)
		}
	}
	
	// 2. 获取历史作业（使用 /slurmdb/ API）
	historyPath := fmt.Sprintf("/slurmdb/%s/jobs", c.apiVersion)
	
	// 添加查询参数
	hasParams := false
	
	// 添加用户过滤
	if username != "" {
		if hasParams {
			historyPath += "&"
		} else {
			historyPath += "?"
			hasParams = true
		}
		historyPath += fmt.Sprintf("users=%s", username)
	}
	
	// 添加时间范围过滤（slurmdb 支持时间过滤）
	if startTime > 0 {
		if hasParams {
			historyPath += "&"
		} else {
			historyPath += "?"
			hasParams = true
		}
		historyPath += fmt.Sprintf("submit_time=%d", startTime)
	}
	
	if endTime > 0 {
		if hasParams {
			historyPath += "&"
		} else {
			historyPath += "?"
			hasParams = true
		}
		historyPath += fmt.Sprintf("end_time=%d", endTime)
	}
	
	logger.Debug("GetJobs (history) API request: GET %s", historyPath)
	logger.Debug("Full URL: %s%s", c.baseURL, historyPath)
	
	historyRespBody, err := c.doRequest("GET", historyPath, nil)
	if err != nil {
		logger.Info("Failed to get history jobs: %v", err)
		// 如果运行中的作业也失败了，返回错误
		if len(allJobs) == 0 {
			return nil, err
		}
	} else {
		logger.Debug("GetJobs (history) API response length: %d bytes", len(historyRespBody))
		
		var historyResponse JobsResponse
		if err := json.Unmarshal(historyRespBody, &historyResponse); err != nil {
			logger.Info("Failed to parse history jobs response: %v", err)
		} else if len(historyResponse.Errors) > 0 {
			logger.Info("Slurm API returned errors for history jobs: %s", historyResponse.Errors[0].Error)
		} else {
			logger.Info("Found %d history jobs", len(historyResponse.Jobs))
			allJobs = append(allJobs, historyResponse.Jobs...)
		}
	}
	
	// 客户端时间过滤（作为备用）
	jobs := allJobs
	if startTime > 0 || endTime > 0 {
		filteredJobs := []Job{}
		for _, job := range jobs {
			submitTime := job.GetSubmitTime()
			
			// 跳过时间范围外的作业
			if startTime > 0 && submitTime < startTime {
				continue
			}
			if endTime > 0 && submitTime > endTime {
				continue
			}
			
			filteredJobs = append(filteredJobs, job)
		}
		jobs = filteredJobs
	}
	
	// 去重（根据job_id）
	jobMap := make(map[int64]Job)
	for _, job := range jobs {
		// 如果已存在，保留状态更新的（运行中的优先）
		if existingJob, exists := jobMap[job.JobID]; exists {
			// 如果新作业是运行中的，替换旧的
			if job.GetJobState() == "RUNNING" || job.GetJobState() == "PENDING" {
				jobMap[job.JobID] = job
			} else if existingJob.GetJobState() != "RUNNING" && existingJob.GetJobState() != "PENDING" {
				// 两个都是完成状态，保留提交时间更晚的
				if job.GetSubmitTime() > existingJob.GetSubmitTime() {
					jobMap[job.JobID] = job
				}
			}
		} else {
			jobMap[job.JobID] = job
		}
	}
	
	// 转换回数组
	uniqueJobs := []Job{}
	for _, job := range jobMap {
		uniqueJobs = append(uniqueJobs, job)
	}
	
	logger.Info("GetJobs returned %d unique jobs (from %d total)", len(uniqueJobs), len(allJobs))
	return uniqueJobs, nil
}

// GetJob 获取单个作业
func (c *Client) GetJob(jobID int64) (*Job, error) {
	path := fmt.Sprintf("/slurm/%s/job/%d", c.apiVersion, jobID)
	
	logger.Debug("GetJob API request: GET %s", path)
	logger.Debug("Full URL: %s%s", c.baseURL, path)
	
	respBody, err := c.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}
	
	logger.Debug("GetJob API response: %s", string(respBody))
	
	var response JobResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to parse job response: %w", err)
	}
	
	if len(response.Errors) > 0 {
		return nil, fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}
	
	if len(response.Jobs) == 0 {
		return nil, fmt.Errorf("job not found")
	}
	
	return &response.Jobs[0], nil
}

// CancelJob 取消作业
func (c *Client) CancelJob(jobID int64) error {
	path := fmt.Sprintf("/slurm/%s/job/%d", c.apiVersion, jobID)
	
	logger.Debug("CancelJob API request: DELETE %s", path)
	logger.Debug("Full URL: %s%s", c.baseURL, path)
	
	respBody, err := c.doRequest("DELETE", path, nil)
	if err != nil {
		return fmt.Errorf("API request failed: %w", err)
	}
	
	logger.Debug("CancelJob API response: %s", string(respBody))
	
	var response JobResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}
	
	if len(response.Errors) > 0 {
		return fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}
	
	return nil
}

// SuspendJob 暂停作业
func (c *Client) SuspendJob(jobID int64) error {
	path := fmt.Sprintf("/slurm/%s/job/%d", c.apiVersion, jobID)
	
	// 构建请求体 - 设置作业状态为 SUSPENDED
	body := map[string]interface{}{
		"job": map[string]interface{}{
			"job_state": []string{"SUSPEND"},
		},
	}
	
	logger.Debug("SuspendJob API request: POST %s", path)
	logger.Debug("Full URL: %s%s", c.baseURL, path)
	
	respBody, err := c.doRequest("POST", path, body)
	if err != nil {
		return fmt.Errorf("API request failed: %w", err)
	}
	
	logger.Debug("SuspendJob API response: %s", string(respBody))
	
	var response JobResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}
	
	if len(response.Errors) > 0 {
		return fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}
	
	return nil
}

// ResumeJob 恢复作业
func (c *Client) ResumeJob(jobID int64) error {
	path := fmt.Sprintf("/slurm/%s/job/%d", c.apiVersion, jobID)
	
	// 构建请求体 - 设置作业状态为 RESUME
	body := map[string]interface{}{
		"job": map[string]interface{}{
			"job_state": []string{"RESUME"},
		},
	}
	
	logger.Debug("ResumeJob API request: POST %s", path)
	logger.Debug("Full URL: %s%s", c.baseURL, path)
	
	respBody, err := c.doRequest("POST", path, body)
	if err != nil {
		return fmt.Errorf("API request failed: %w", err)
	}
	
	logger.Debug("ResumeJob API response: %s", string(respBody))
	
	var response JobResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}
	
	if len(response.Errors) > 0 {
		return fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}
	
	return nil
}

// JobSubmitParams 作业提交参数
type JobSubmitParams struct {
	Name        string
	Partition   string
	QoS         string // 新增QoS参数
	Script      string
	Nodes       int
	CPUs        int
	Memory      int // GB
	GPUs        int
	TimeLimit   int // 小时
	WorkDir     string
	Output      string
	Error       string
	Priority    string
	ExtraParams string
	Username    string // LDAP用户名
}

// Partition 分区信息
type Partition struct {
	Name  string `json:"name"`
	State struct {
		State []string `json:"state"`
	} `json:"partition,omitempty"`
	Nodes struct {
		Configured string `json:"configured"`
		Total      int    `json:"total"`
	} `json:"nodes,omitempty"`
	Maximums struct {
		Time struct {
			Set      bool  `json:"set"`
			Infinite bool  `json:"infinite"`
			Number   int64 `json:"number"`
		} `json:"time,omitempty"`
		Nodes struct {
			Set      bool `json:"set"`
			Infinite bool `json:"infinite"`
			Number   int  `json:"number"`
		} `json:"nodes,omitempty"`
	} `json:"maximums,omitempty"`
	Minimums struct {
		Nodes int `json:"nodes"`
	} `json:"minimums,omitempty"`
	Defaults struct {
		Time struct {
			Set      bool  `json:"set"`
			Infinite bool  `json:"infinite"`
			Number   int64 `json:"number"`
		} `json:"time,omitempty"`
	} `json:"defaults,omitempty"`
}

// GetPartitionName 获取分区名称
func (p *Partition) GetPartitionName() string {
	return p.Name
}

// GetPartitionState 获取分区状态
func (p *Partition) GetPartitionState() string {
	if len(p.State.State) > 0 {
		return p.State.State[0]
	}
	return "UNKNOWN"
}

// GetNodesConfigured 获取配置的节点
func (p *Partition) GetNodesConfigured() string {
	return p.Nodes.Configured
}

// PartitionsResponse 分区列表响应
type PartitionsResponse struct {
	Partitions []Partition `json:"partitions"`
	Errors     []Error     `json:"errors"`
}

// GetPartitions 获取分区列表
func (c *Client) GetPartitions() ([]Partition, error) {
	path := fmt.Sprintf("/slurm/%s/partitions", c.apiVersion)
	
	logger.Debug("GetPartitions API request: GET %s", path)
	logger.Debug("Full URL: %s%s", c.baseURL, path)
	
	respBody, err := c.doRequest("GET", path, nil)
	if err != nil {
		logger.Error("GetPartitions API request failed: %v", err)
		return nil, err
	}
	
	logger.Debug("GetPartitions API response: %s", string(respBody))
	
	var response PartitionsResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		logger.Error("Failed to parse partitions response: %v", err)
		logger.Error("Response body was: %s", string(respBody))
		return nil, fmt.Errorf("failed to parse partitions response: %w", err)
	}
	
	if len(response.Errors) > 0 {
		logger.Error("Slurm API returned errors: %s", response.Errors[0].Error)
		return nil, fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}
	
	logger.Info("GetPartitions returned %d partitions", len(response.Partitions))
	for i, p := range response.Partitions {
		logger.Debug("Partition %d: name=%s, state=%s, nodes=%s", 
			i, p.GetPartitionName(), p.GetPartitionState(), p.GetNodesConfigured())
	}
	
	return response.Partitions, nil
}

// SubmitJob 提交作业
func (c *Client) SubmitJob(params JobSubmitParams) (int64, error) {
	// 验证必需参数
	if params.Name == "" {
		return 0, fmt.Errorf("job name is required")
	}
	if params.Partition == "" {
		return 0, fmt.Errorf("partition is required")
	}
	if params.Script == "" {
		return 0, fmt.Errorf("script is required")
	}
	
	logger.Info("========== JOB SUBMISSION START ==========")
	logger.Info("Submitting job: name=%s, partition=%s, nodes=%d, cpus=%d, workdir=%s, username=%s, script_length=%d", 
		params.Name, params.Partition, params.Nodes, params.CPUs, params.WorkDir, params.Username, len(params.Script))
	logger.Info("QoS=%s, Memory=%dGB, GPUs=%d, TimeLimit=%dh", params.QoS, params.Memory, params.GPUs, params.TimeLimit)
	
	// 构建作业描述 - 按照v0.0.44格式
	job := map[string]interface{}{
		"name":      params.Name,
		"partition": params.Partition,
		"tasks":     1, // 默认1个任务
	}
	
	// 用户名和账户（必需）
	if params.Username != "" {
		job["user_name"] = params.Username
		job["account"] = params.Username // 使用用户名作为account
		logger.Info("✓ User: %s", params.Username)
		logger.Info("✓ Account: %s", params.Username)
	} else {
		logger.Error("✗ Username is empty!")
	}
	
	// 工作目录（必需）
	if params.WorkDir != "" {
		job["current_working_directory"] = params.WorkDir
		logger.Info("✓ Working directory: %s", params.WorkDir)
	} else {
		logger.Error("✗ Working directory is empty!")
	}
	
	// environment - 在job对象内部，使用LDAP用户名
	if params.Username != "" {
		job["environment"] = map[string]string{
			"USER": params.Username,
		}
		logger.Info("✓ USER environment variable: %s", params.Username)
	} else {
		job["environment"] = map[string]string{
			"USER": "${USER}",
		}
		logger.Info("⚠ USER environment variable: ${USER} (using default)")
	}
	
	// 资源配置
	if params.Nodes > 0 {
		job["nodes"] = fmt.Sprintf("%d", params.Nodes) // 转换为字符串
		logger.Info("✓ Nodes: %d", params.Nodes)
	}
	if params.CPUs > 0 {
		job["cpus_per_task"] = params.CPUs
		logger.Info("✓ CPUs per task: %d", params.CPUs)
	}
	if params.Memory > 0 {
		job["memory_per_node"] = params.Memory * 1024 // MB
		logger.Info("✓ Memory per node: %d MB", params.Memory*1024)
	}
	if params.GPUs > 0 {
		job["gres"] = fmt.Sprintf("gpu:%d", params.GPUs)
		logger.Info("✓ GPUs: %d", params.GPUs)
	}
	if params.TimeLimit > 0 {
		job["time_limit"] = params.TimeLimit * 60 // 分钟
		logger.Info("✓ Time limit: %d minutes", params.TimeLimit*60)
	}
	
	// QoS - 如果没有指定，使用用户名作为QoS
	if params.QoS != "" {
		job["qos"] = params.QoS
		logger.Info("✓ QoS: %s", params.QoS)
	} else if params.Username != "" {
		job["qos"] = params.Username
		logger.Info("✓ QoS: %s (using username as default)", params.Username)
	}
	
	// 不设置输出和错误文件路径，让Slurm使用默认值
	logger.Info("ℹ Using Slurm default paths for output and error files")
	
	// 根据API版本构建请求体
	// v0.0.44格式: {"script": "...", "job": {"environment": {...}, ...}}
	body := map[string]interface{}{
		"script": params.Script,
		"job":    job,
	}
	
	// 打印完整的job对象（用于调试）
	jobJSON, _ := json.MarshalIndent(job, "", "  ")
	logger.Info("========== JOB OBJECT ==========")
	logger.Info("%s", string(jobJSON))
	logger.Info("================================")
	
	// 打印脚本内容（限制长度）
	scriptPreview := params.Script
	if len(scriptPreview) > 200 {
		scriptPreview = scriptPreview[:200] + "..."
	}
	logger.Info("========== SCRIPT CONTENT ==========")
	logger.Info("%s", scriptPreview)
	logger.Info("====================================")
	
	bodyJSON, _ := json.Marshal(body)
	path := fmt.Sprintf("/slurm/%s/job/submit", c.apiVersion)
	logger.Info("========== API REQUEST ==========")
	logger.Info("Method: POST")
	logger.Info("Path: %s", path)
	logger.Info("Full URL: %s%s", c.baseURL, path)
	logger.Info("API Version: %s", c.apiVersion)
	logger.Info("=================================")
	
	// 记录完整请求体
	bodyStr := string(bodyJSON)
	if len(bodyStr) > 2000 {
		logger.Info("Request body (first 2000 chars):")
		logger.Info("%s...", bodyStr[:2000])
	} else {
		logger.Info("Request body:")
		logger.Info("%s", bodyStr)
	}
	
	respBody, err := c.doRequest("POST", path, body)
	if err != nil {
		logger.Error("========== JOB SUBMISSION FAILED ==========")
		logger.Error("Error: %v", err)
		logger.Error("===========================================")
		return 0, fmt.Errorf("API request failed: %w", err)
	}
	
	// 记录响应
	respStr := string(respBody)
	logger.Info("========== API RESPONSE ==========")
	if len(respStr) > 2000 {
		logger.Info("Response (first 2000 chars):")
		logger.Info("%s...", respStr[:2000])
	} else {
		logger.Info("Response:")
		logger.Info("%s", respStr)
	}
	logger.Info("==================================")
	
	// 解析响应 - 支持不同版本的响应格式
	var response struct {
		JobID   int64   `json:"job_id"`    // v0.0.43+
		JobId   int64   `json:"jobId"`     // 旧版本兼容
		Errors  []Error `json:"errors"`
		Warnings []Error `json:"warnings"`
	}
	
	if err := json.Unmarshal(respBody, &response); err != nil {
		logger.Error("========== RESPONSE PARSE FAILED ==========")
		logger.Error("Error: %v", err)
		logger.Error("Response body: %s", respStr)
		logger.Error("===========================================")
		return 0, fmt.Errorf("failed to parse response: %w", err)
	}
	
	if len(response.Errors) > 0 {
		logger.Error("========== SLURM API ERROR ==========")
		for i, err := range response.Errors {
			logger.Error("Error %d: %s", i+1, err.Error)
		}
		logger.Error("=====================================")
		return 0, fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}
	
	if len(response.Warnings) > 0 {
		logger.Info("========== SLURM API WARNINGS ==========")
		for i, warn := range response.Warnings {
			logger.Info("Warning %d: %s", i+1, warn.Error)
		}
		logger.Info("========================================")
	}
	
	// 获取作业ID（兼容不同字段名）
	jobID := response.JobID
	if jobID == 0 {
		jobID = response.JobId
	}
	
	if jobID == 0 {
		logger.Error("========== NO JOB ID RETURNED ==========")
		logger.Error("Response: %s", respStr)
		logger.Error("========================================")
		return 0, fmt.Errorf("no job ID returned in response")
	}
	
	logger.Info("========== JOB SUBMISSION SUCCESS ==========")
	logger.Info("✓ Job ID: %d", jobID)
	logger.Info("✓ Job Name: %s", params.Name)
	logger.Info("✓ Partition: %s", params.Partition)
	logger.Info("✓ User: %s", params.Username)
	logger.Info("============================================")
	return jobID, nil
}


// contains 检查字符串是否包含子串
func contains(s, substr string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(substr))
}
