package slurm

import (
	"encoding/json"
	"fmt"
	"time"
)

// AccountUsage 账户机时使用情况
type AccountUsage struct {
	Account          string    `json:"account"`
	Cluster          string    `json:"cluster"`
	User             string    `json:"user,omitempty"`
	TotalBilling     int64     `json:"total_billing"`      // 总分配机时（从 QoS 获取）
	UsedBilling      int64     `json:"used_billing"`       // 已使用机时
	RemainingBilling int64     `json:"remaining_billing"`  // 剩余机时
	UsagePercent     float64   `json:"usage_percent"`      // 使用百分比
	Status           string    `json:"status"`             // 状态：NORMAL, WARNING, EXCEEDED
	CPUHours         float64   `json:"cpu_hours"`          // CPU 小时数
	NodeHours        float64   `json:"node_hours"`         // 节点小时数
	GPUHours         float64   `json:"gpu_hours"`          // GPU 小时数
	MemoryHours      float64   `json:"memory_hours"`       // 内存小时数（GB·小时）
	JobCount         int       `json:"job_count"`          // 作业数量
	LastUpdated      time.Time `json:"last_updated"`       // 最后更新时间
}

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
	BillingHours float64  `json:"billing_hours"` // 计费小时数
	JobCount    int       `json:"job_count"`     // 作业数量
	StartTime   time.Time `json:"start_time"`    // 开始时间
	EndTime     time.Time `json:"end_time"`      // 结束时间
	State       string    `json:"state"`         // 作业状态
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

// GetAccountBillingLimit 获取账户的 billing 限制（从 QoS 获取）
func (c *Client) GetAccountBillingLimit(account string) (int64, error) {
	// 获取账户关联信息以找到 QoS
	associations, err := c.GetAssociations()
	if err != nil {
		return 0, fmt.Errorf("failed to get associations: %w", err)
	}
	
	// 查找账户的 QoS
	var qosName string
	for _, assoc := range associations {
		if assoc.Account == account && len(assoc.QoS) > 0 {
			qosName = assoc.QoS[0] // 使用第一个 QoS
			break
		}
	}
	
	// 如果没有找到 QoS，使用默认值
	if qosName == "" {
		qosName = "normal"
	}
	
	// 获取 QoS 信息
	qos, err := c.GetQoS(qosName)
	if err != nil {
		return 0, fmt.Errorf("failed to get QoS info: %w", err)
	}
	
	// 从 QoS 的 TRES minutes total 中提取 billing 限制
	if qos.Limits.Max.TRES.Minutes.Total != nil {
		for _, tres := range qos.Limits.Max.TRES.Minutes.Total {
			if tres.Type == "billing" {
				return tres.Count, nil
			}
		}
	}
	
	// 如果没有找到 billing 限制，返回 0（无限制）
	return 0, nil
}

// GetAccountUsageWithBilling 获取账户机时使用情况（包含 billing 限制检查）
func (c *Client) GetAccountUsageWithBilling(account string, startTime, endTime time.Time) (*AccountUsage, error) {
	// 获取账户的 billing 限制
	totalBilling, err := c.GetAccountBillingLimit(account)
	if err != nil {
		return nil, fmt.Errorf("failed to get billing limit: %w", err)
	}
	
	// 获取账户使用记录
	records, err := c.GetAccountUsage(account, startTime, endTime)
	if err != nil {
		return nil, fmt.Errorf("failed to get account usage: %w", err)
	}
	
	// 计算总使用量
	var usedBilling int64
	var totalCPUHours, totalNodeHours, totalGPUHours, totalMemoryHours float64
	var totalJobs int
	
	for _, record := range records {
		// 计算 billing 小时数（通常等于 CPU 小时数，但可以根据实际情况调整）
		billingHours := record.CPUHours
		usedBilling += int64(billingHours * 60) // 转换为分钟
		
		totalCPUHours += record.CPUHours
		totalNodeHours += record.NodeHours
		totalGPUHours += record.GPUHours
		totalMemoryHours += record.MemoryHours
		totalJobs += record.JobCount
	}
	
	// 计算剩余机时和使用百分比
	remainingBilling := totalBilling - usedBilling
	var usagePercent float64
	if totalBilling > 0 {
		usagePercent = float64(usedBilling) / float64(totalBilling) * 100
	}
	
	// 确定状态
	status := "NORMAL"
	if totalBilling > 0 {
		if usagePercent >= 100 {
			status = "EXCEEDED"
		} else if usagePercent >= 80 {
			status = "WARNING"
		}
	}
	
	return &AccountUsage{
		Account:          account,
		Cluster:          "cluster", // 可以从配置获取
		TotalBilling:     totalBilling,
		UsedBilling:      usedBilling,
		RemainingBilling: remainingBilling,
		UsagePercent:     usagePercent,
		Status:           status,
		CPUHours:         totalCPUHours,
		NodeHours:        totalNodeHours,
		GPUHours:         totalGPUHours,
		MemoryHours:      totalMemoryHours,
		JobCount:         totalJobs,
		LastUpdated:      time.Now(),
	}, nil
}

// GetUserUsageByAccount 获取用户在特定账户下的机时使用情况
func (c *Client) GetUserUsageByAccount(user, account string, startTime, endTime time.Time) (*AccountUsage, error) {
	// 获取账户的 billing 限制
	totalBilling, err := c.GetAccountBillingLimit(account)
	if err != nil {
		return nil, fmt.Errorf("failed to get billing limit: %w", err)
	}
	
	// 获取用户使用记录
	records, err := c.GetUserUsage(user, startTime, endTime)
	if err != nil {
		return nil, fmt.Errorf("failed to get user usage: %w", err)
	}
	
	// 过滤指定账户的记录
	var accountRecords []UsageRecord
	for _, record := range records {
		if record.Account == account {
			accountRecords = append(accountRecords, record)
		}
	}
	
	// 计算用户在该账户下的使用量
	var usedBilling int64
	var totalCPUHours, totalNodeHours, totalGPUHours, totalMemoryHours float64
	var totalJobs int
	
	for _, record := range accountRecords {
		billingHours := record.CPUHours
		usedBilling += int64(billingHours * 60) // 转换为分钟
		
		totalCPUHours += record.CPUHours
		totalNodeHours += record.NodeHours
		totalGPUHours += record.GPUHours
		totalMemoryHours += record.MemoryHours
		totalJobs += record.JobCount
	}
	
	// 计算剩余机时和使用百分比
	remainingBilling := totalBilling - usedBilling
	var usagePercent float64
	if totalBilling > 0 {
		usagePercent = float64(usedBilling) / float64(totalBilling) * 100
	}
	
	// 确定状态
	status := "NORMAL"
	if totalBilling > 0 {
		if usagePercent >= 100 {
			status = "EXCEEDED"
		} else if usagePercent >= 80 {
			status = "WARNING"
		}
	}
	
	return &AccountUsage{
		Account:          account,
		Cluster:          "cluster",
		User:             user,
		TotalBilling:     totalBilling,
		UsedBilling:      usedBilling,
		RemainingBilling: remainingBilling,
		UsagePercent:     usagePercent,
		Status:           status,
		CPUHours:         totalCPUHours,
		NodeHours:        totalNodeHours,
		GPUHours:         totalGPUHours,
		MemoryHours:      totalMemoryHours,
		JobCount:         totalJobs,
		LastUpdated:      time.Now(),
	}, nil
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
		
		// 计算 billing 小时数（通常等于 CPU 小时数）
		record.BillingHours = record.CPUHours
		
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
		
		// 计算 billing 小时数
		record.BillingHours = record.CPUHours
		
		records = append(records, record)
	}

	return records, nil
}

// GetAllAccountsUsage 获取所有账户的机时使用情况
func (c *Client) GetAllAccountsUsage(startTime, endTime time.Time) (map[string]*AccountUsage, error) {
	// 获取所有账户
	accounts, err := c.GetAccounts()
	if err != nil {
		return nil, fmt.Errorf("failed to get accounts: %w", err)
	}
	
	result := make(map[string]*AccountUsage)
	
	for _, account := range accounts {
		usage, err := c.GetAccountUsageWithBilling(account.Name, startTime, endTime)
		if err != nil {
			// 记录错误但继续处理其他账户
			fmt.Printf("Warning: failed to get usage for account %s: %v\n", account.Name, err)
			continue
		}
		result[account.Name] = usage
	}
	
	return result, nil
}