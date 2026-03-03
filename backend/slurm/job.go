package slurm

import (
	"encoding/json"
	"fmt"
	"hpc-backend/logger"
	"strings"
)

// Job Slurm 作业
type Job struct {
	JobID       int64  `json:"job_id"`
	Name        string `json:"name"`
	User        string `json:"user"`
	Account     string `json:"account"`
	Partition   string `json:"partition"`
	State       struct {
		Current []string `json:"current"`
		Reason  string   `json:"reason"`
	} `json:"state"`
	Nodes       string `json:"nodes"`
	CPUs        int    `json:"-"` // 从 required.CPUs 获取
	Required    struct {
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
	if len(j.State.Current) > 0 {
		return j.State.Current[0]
	}
	return "UNKNOWN"
}

// GetCPUs 获取 CPU 数量
func (j *Job) GetCPUs() int {
	return j.Required.CPUs
}

// GetSubmitTime 获取提交时间
func (j *Job) GetSubmitTime() int64 {
	return j.Time.Submission
}

// GetStartTime 获取开始时间
func (j *Job) GetStartTime() int64 {
	return j.Time.Start
}

// GetEndTime 获取结束时间
func (j *Job) GetEndTime() int64 {
	return j.Time.End
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
	// 使用 slurmdb API 获取作业信息（包括历史和当前作业）
	path := fmt.Sprintf("/slurmdb/%s/jobs", c.apiVersion)
	
	// 添加查询参数
	hasParams := false
	
	// 添加用户过滤
	if username != "" {
		if hasParams {
			path += "&"
		} else {
			path += "?"
			hasParams = true
		}
		path += fmt.Sprintf("users=%s", username)
	}
	
	// 添加时间范围过滤（slurmdb 支持时间过滤）
	if startTime > 0 {
		if hasParams {
			path += "&"
		} else {
			path += "?"
			hasParams = true
		}
		path += fmt.Sprintf("submit_time=%d", startTime)
	}
	
	if endTime > 0 {
		if hasParams {
			path += "&"
		} else {
			path += "?"
			hasParams = true
		}
		path += fmt.Sprintf("end_time=%d", endTime)
	}
	
	logger.Debug("GetJobs API request: GET %s", path)
	logger.Debug("Full URL: %s%s", c.baseURL, path)
	
	respBody, err := c.doRequest("GET", path, nil)
	if err != nil {
		logger.Error("GetJobs API request failed: %v", err)
		return nil, err
	}
	
	logger.Debug("GetJobs API response length: %d bytes", len(respBody))
	
	var response JobsResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		logger.Error("Failed to parse jobs response: %v", err)
		return nil, fmt.Errorf("failed to parse jobs response: %w", err)
	}
	
	if len(response.Errors) > 0 {
		logger.Error("Slurm API returned errors: %s", response.Errors[0].Error)
		return nil, fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}
	
	// 客户端时间过滤（作为备用）
	jobs := response.Jobs
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
	
	logger.Info("GetJobs returned %d jobs (filtered from %d)", len(jobs), len(response.Jobs))
	return jobs, nil
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
	
	logger.Info("Submitting job: name=%s, partition=%s, nodes=%d, cpus=%d", 
		params.Name, params.Partition, params.Nodes, params.CPUs)
	
	// 构建作业描述 - 只包含必需和有效的字段
	job := map[string]interface{}{
		"name":   params.Name,
		"script": params.Script,
	}
	
	// 分区是必需的
	job["partition"] = params.Partition
	
	// QoS配置（可选）
	if params.QoS != "" {
		job["qos"] = params.QoS
	}
	
	// 资源配置（可选，但建议设置）
	if params.Nodes > 0 {
		job["nodes"] = params.Nodes
	}
	if params.CPUs > 0 {
		job["cpus_per_task"] = params.CPUs
	}
	if params.Memory > 0 {
		job["memory_per_node"] = params.Memory * 1024 // 转换为MB
	}
	if params.GPUs > 0 {
		job["gres"] = fmt.Sprintf("gpu:%d", params.GPUs)
	}
	
	// 时间限制（转换为分钟）
	if params.TimeLimit > 0 {
		job["time_limit"] = params.TimeLimit * 60
	}
	
	// 工作目录和输出文件（可选）
	if params.WorkDir != "" {
		job["current_working_directory"] = params.WorkDir
	}
	if params.Output != "" {
		job["standard_output"] = params.Output
	}
	if params.Error != "" {
		job["standard_error"] = params.Error
	}
	
	// 优先级（可选）
	if params.Priority != "" {
		switch params.Priority {
		case "high":
			job["priority"] = 1000
		case "low":
			job["priority"] = 100
		default:
			job["priority"] = 500
		}
	}
	
	// 构建请求体
	body := map[string]interface{}{
		"job": job,
	}
	
	bodyJSON, _ := json.Marshal(body)
	path := fmt.Sprintf("/slurm/%s/job/submit", c.apiVersion)
	logger.Debug("SubmitJob API request: POST %s", path)
	logger.Debug("Full URL: %s%s", c.baseURL, path)
	logger.Debug("Request body: %s", string(bodyJSON))
	
	respBody, err := c.doRequest("POST", path, body)
	if err != nil {
		logger.Error("Job submission failed: %v", err)
		
		// 如果是分区错误，尝试获取可用分区列表并提示
		if contains(err.Error(), "Invalid partition") {
			partitions, pErr := c.GetPartitions()
			if pErr == nil && len(partitions) > 0 {
				availablePartitions := []string{}
				for _, p := range partitions {
					availablePartitions = append(availablePartitions, p.Name)
				}
				return 0, fmt.Errorf("invalid partition '%s'. Available partitions: %v", params.Partition, availablePartitions)
			}
		}
		
		return 0, fmt.Errorf("API request failed: %w", err)
	}
	
	logger.Debug("SubmitJob API response: %s", string(respBody))
	
	var response struct {
		JobID  int64   `json:"job_id"`
		Errors []Error `json:"errors"`
	}
	
	if err := json.Unmarshal(respBody, &response); err != nil {
		return 0, fmt.Errorf("failed to parse response: %w", err)
	}
	
	if len(response.Errors) > 0 {
		return 0, fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}
	
	return response.JobID, nil
}


// contains 检查字符串是否包含子串
func contains(s, substr string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(substr))
}
