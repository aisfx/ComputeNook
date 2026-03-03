package slurm

import (
	"encoding/json"
	"fmt"
	"time"
)

// UsageRecord 机时使用记录
type UsageRecord struct {
	User        string    `json:"user"`
	Account     string    `json:"account"`
	Cluster     string    `json:"cluster"`
	Partition   string    `json:"partition"`
	QoS         string    `json:"qos"`
	CPUTime     int64     `json:"cpu_time"`      // CPU 时间（秒）
	CPUHours    float64   `json:"cpu_hours"`     // CPU 小时数
	NodeHours   float64   `json:"node_hours"`    // 节点小时数
	GPUHours    float64   `json:"gpu_hours"`     // GPU 小时数
	MemoryHours float64   `json:"memory_hours"`  // 内存小时数（GB·小时）
	JobCount    int       `json:"job_count"`     // 作业数量
	StartTime   time.Time `json:"start_time"`    // 开始时间
	EndTime     time.Time `json:"end_time"`      // 结束时间
	State       string    `json:"state"`         // 作业状态
}

// UsageSummary 机时使用汇总
type UsageSummary struct {
	User         string  `json:"user"`
	Account      string  `json:"account"`
	TotalCPUTime int64   `json:"total_cpu_time"`    // 总 CPU 时间（秒）
	TotalCPUHours float64 `json:"total_cpu_hours"`   // 总 CPU 小时数
	TotalNodeHours float64 `json:"total_node_hours"` // 总节点小时数
	TotalGPUHours float64 `json:"total_gpu_hours"`   // 总 GPU 小时数
	TotalMemoryHours float64 `json:"total_memory_hours"` // 总内存小时数
	TotalJobs    int     `json:"total_jobs"`        // 总作业数
	Period       string  `json:"period"`            // 统计周期
}

// UsageResponse Slurm 使用情况响应
type UsageResponse struct {
	Jobs   []JobUsage `json:"jobs"`
	Errors []Error    `json:"errors"`
}

// JobUsage 作业使用情况
type JobUsage struct {
	JobID       int       `json:"job_id"`
	User        string    `json:"user"`
	Account     string    `json:"account"`
	Cluster     string    `json:"cluster"`
	Partition   string    `json:"partition"`
	QoS         string    `json:"qos"`
	State       string    `json:"state"`
	StartTime   time.Time `json:"start_time"`
	EndTime     time.Time `json:"end_time"`
	ElapsedTime int64     `json:"elapsed_time"` // 运行时间（秒）
	CPUTime     int64     `json:"cpu_time"`     // CPU 时间（秒）
	
	// 资源分配
	AllocCPUs  int `json:"alloc_cpus"`  // 分配的 CPU 核心数
	AllocNodes int `json:"alloc_nodes"` // 分配的节点数
	AllocMem   int `json:"alloc_mem"`   // 分配的内存（MB）
	
	// TRES 使用情况
	TRES struct {
		Allocated []TRESItem `json:"allocated"` // 分配的资源
		Requested []TRESItem `json:"requested"` // 请求的资源
	} `json:"tres"`
}

// GetUserUsage 获取用户机时使用情况
func (c *Client) GetUserUsage(user string, startTime, endTime time.Time) ([]UsageRecord, error) {
	// 构建查询参数
	params := fmt.Sprintf("?users=%s&start_time=%d&end_time=%d&state=COMPLETED,FAILED,CANCELLED,TIMEOUT",
		user, startTime.Unix(), endTime.Unix())
	
	path := "/slurmdb/v0.0.43/jobs" + params
	respBody, err := c.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var response UsageResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to parse usage response: %w", err)
	}

	if len(response.Errors) > 0 {
		return nil, fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}

	// 转换为 UsageRecord
	var records []UsageRecord
	for _, job := range response.Jobs {
		record := UsageRecord{
			User:      job.User,
			Account:   job.Account,
			Cluster:   job.Cluster,
			Partition: job.Partition,
			QoS:       job.QoS,
			CPUTime:   job.CPUTime,
			CPUHours:  float64(job.CPUTime) / 3600.0, // 秒转小时
			JobCount:  1,
			StartTime: job.StartTime,
			EndTime:   job.EndTime,
			State:     job.State,
		}
		
		// 计算节点小时数
		if job.ElapsedTime > 0 && job.AllocNodes > 0 {
			record.NodeHours = float64(job.ElapsedTime) * float64(job.AllocNodes) / 3600.0
		}
		
		// 计算内存小时数（GB·小时）
		if job.ElapsedTime > 0 && job.AllocMem > 0 {
			record.MemoryHours = float64(job.ElapsedTime) * float64(job.AllocMem) / (1024.0 * 3600.0)
		}
		
		// 从 TRES 中提取 GPU 使用情况
		for _, tres := range job.TRES.Allocated {
			if tres.Type == "gres/gpu" {
				record.GPUHours = float64(job.ElapsedTime) * float64(tres.Count) / 3600.0
				break
			}
		}
		
		records = append(records, record)
	}

	return records, nil
}

// GetAccountUsage 获取账户机时使用情况
func (c *Client) GetAccountUsage(account string, startTime, endTime time.Time) ([]UsageRecord, error) {
	// 构建查询参数
	params := fmt.Sprintf("?accounts=%s&start_time=%d&end_time=%d&state=COMPLETED,FAILED,CANCELLED,TIMEOUT",
		account, startTime.Unix(), endTime.Unix())
	
	path := "/slurmdb/v0.0.43/jobs" + params
	respBody, err := c.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var response UsageResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to parse usage response: %w", err)
	}

	if len(response.Errors) > 0 {
		return nil, fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}

	// 转换为 UsageRecord
	var records []UsageRecord
	for _, job := range response.Jobs {
		record := UsageRecord{
			User:      job.User,
			Account:   job.Account,
			Cluster:   job.Cluster,
			Partition: job.Partition,
			QoS:       job.QoS,
			CPUTime:   job.CPUTime,
			CPUHours:  float64(job.CPUTime) / 3600.0,
			JobCount:  1,
			StartTime: job.StartTime,
			EndTime:   job.EndTime,
			State:     job.State,
		}
		
		// 计算资源使用时间
		if job.ElapsedTime > 0 {
			if job.AllocNodes > 0 {
				record.NodeHours = float64(job.ElapsedTime) * float64(job.AllocNodes) / 3600.0
			}
			if job.AllocMem > 0 {
				record.MemoryHours = float64(job.ElapsedTime) * float64(job.AllocMem) / (1024.0 * 3600.0)
			}
		}
		
		// 从 TRES 中提取 GPU 使用情况
		for _, tres := range job.TRES.Allocated {
			if tres.Type == "gres/gpu" {
				record.GPUHours = float64(job.ElapsedTime) * float64(tres.Count) / 3600.0
				break
			}
		}
		
		records = append(records, record)
	}

	return records, nil
}

// GetUsageSummary 获取机时使用汇总
func (c *Client) GetUsageSummary(user, account string, startTime, endTime time.Time) (*UsageSummary, error) {
	var records []UsageRecord
	var err error
	
	if user != "" {
		records, err = c.GetUserUsage(user, startTime, endTime)
	} else if account != "" {
		records, err = c.GetAccountUsage(account, startTime, endTime)
	} else {
		return nil, fmt.Errorf("user or account must be specified")
	}
	
	if err != nil {
		return nil, err
	}
	
	// 汇总统计
	summary := &UsageSummary{
		User:    user,
		Account: account,
		Period:  fmt.Sprintf("%s - %s", startTime.Format("2006-01-02"), endTime.Format("2006-01-02")),
	}
	
	for _, record := range records {
		summary.TotalCPUTime += record.CPUTime
		summary.TotalCPUHours += record.CPUHours
		summary.TotalNodeHours += record.NodeHours
		summary.TotalGPUHours += record.GPUHours
		summary.TotalMemoryHours += record.MemoryHours
		summary.TotalJobs += record.JobCount
	}
	
	return summary, nil
}

// GetClusterUsage 获取集群整体机时使用情况
func (c *Client) GetClusterUsage(startTime, endTime time.Time) (map[string]*UsageSummary, error) {
	// 获取所有作业
	params := fmt.Sprintf("?start_time=%d&end_time=%d&state=COMPLETED,FAILED,CANCELLED,TIMEOUT",
		startTime.Unix(), endTime.Unix())
	
	path := "/slurmdb/v0.0.43/jobs" + params
	respBody, err := c.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var response UsageResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to parse usage response: %w", err)
	}

	if len(response.Errors) > 0 {
		return nil, fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}

	// 按用户汇总
	userSummaries := make(map[string]*UsageSummary)
	
	for _, job := range response.Jobs {
		key := fmt.Sprintf("%s@%s", job.User, job.Account)
		
		if userSummaries[key] == nil {
			userSummaries[key] = &UsageSummary{
				User:    job.User,
				Account: job.Account,
				Period:  fmt.Sprintf("%s - %s", startTime.Format("2006-01-02"), endTime.Format("2006-01-02")),
			}
		}
		
		summary := userSummaries[key]
		summary.TotalCPUTime += job.CPUTime
		summary.TotalCPUHours += float64(job.CPUTime) / 3600.0
		summary.TotalJobs++
		
		// 计算资源使用时间
		if job.ElapsedTime > 0 {
			if job.AllocNodes > 0 {
				summary.TotalNodeHours += float64(job.ElapsedTime) * float64(job.AllocNodes) / 3600.0
			}
			if job.AllocMem > 0 {
				summary.TotalMemoryHours += float64(job.ElapsedTime) * float64(job.AllocMem) / (1024.0 * 3600.0)
			}
		}
		
		// 从 TRES 中提取 GPU 使用情况
		for _, tres := range job.TRES.Allocated {
			if tres.Type == "gres/gpu" {
				summary.TotalGPUHours += float64(job.ElapsedTime) * float64(tres.Count) / 3600.0
				break
			}
		}
	}
	
	return userSummaries, nil
}