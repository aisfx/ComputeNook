package slurm

import (
	"encoding/json"
	"fmt"
	"os"
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
	JobID       int64     `json:"job_id"`        // 作业 ID
	JobName     string    `json:"job_name"`      // 作业名称
	User        string    `json:"user"`
	Account     string    `json:"account"`
	Cluster     string    `json:"cluster"`
	Partition   string    `json:"partition"`
	QoS         string    `json:"qos"`
	CPUTime     int64     `json:"cpu_time"`      // CPU 时间（秒）
	CPUHours    float64   `json:"cpu_hours"`     // CPU 小时数
	NodeHours   float64   `json:"node_hours"`
	GPUHours    float64   `json:"gpu_hours"`
	MemoryHours float64   `json:"memory_hours"`
	BillingHours float64  `json:"billing_hours"` // 计费小时数
	BillingMins  float64  `json:"billing_mins"`  // 计费分钟数（方便前端展示）
	ElapsedSecs int64     `json:"elapsed_secs"`  // 运行时长（秒）
	JobCount    int       `json:"job_count"`
	StartTime   time.Time `json:"start_time"`
	EndTime     time.Time `json:"end_time"`
	State       string    `json:"state"`
}

// UsageResponse Slurm 使用情况响应
type UsageResponse struct {
	Jobs   []map[string]interface{} `json:"jobs"`
	Errors []Error                  `json:"errors"`
}

// extractInt64 从 map 中安全提取 int64
func extractInt64(m map[string]interface{}, key string) int64 {
	v, ok := m[key]
	if !ok {
		return 0
	}
	switch val := v.(type) {
	case float64:
		return int64(val)
	case int64:
		return val
	case int:
		return int64(val)
	}
	return 0
}

// extractString 从 map 中安全提取 string
func extractString(m map[string]interface{}, key string) string {
	v, ok := m[key]
	if !ok {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

// extractNestedInt64 从嵌套 map 中提取 int64，如 time.elapsed
func extractNestedInt64(m map[string]interface{}, keys ...string) int64 {
	cur := m
	for i, k := range keys {
		v, ok := cur[k]
		if !ok {
			return 0
		}
		if i == len(keys)-1 {
			switch val := v.(type) {
			case float64:
				return int64(val)
			case int64:
				return val
			case int:
				return int64(val)
			}
			return 0
		}
		next, ok := v.(map[string]interface{})
		if !ok {
			return 0
		}
		cur = next
	}
	return 0
}

// extractNestedString 从嵌套 map 中提取 string
func extractNestedString(m map[string]interface{}, keys ...string) string {
	cur := m
	for i, k := range keys {
		v, ok := cur[k]
		if !ok {
			return ""
		}
		if i == len(keys)-1 {
			if s, ok := v.(string); ok {
				return s
			}
			return ""
		}
		next, ok := v.(map[string]interface{})
		if !ok {
			return ""
		}
		cur = next
	}
	return ""
}

// parseTRES 从 job map 中解析 TRES 列表
func parseTRES(job map[string]interface{}, path ...string) []TRESItem {
	cur := map[string]interface{}(job)
	for _, k := range path {
		v, ok := cur[k]
		if !ok {
			return nil
		}
		next, ok := v.(map[string]interface{})
		if !ok {
			return nil
		}
		cur = next
	}
	// 最后一层应该是数组
	return nil
}

// parseTRESList 解析 TRES 数组
func parseTRESList(raw interface{}) []TRESItem {
	arr, ok := raw.([]interface{})
	if !ok {
		return nil
	}
	var result []TRESItem
	for _, item := range arr {
		m, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		t := TRESItem{
			Type: extractString(m, "type"),
			Name: extractString(m, "name"),
		}
		t.Count = extractInt64(m, "count")
		result = append(result, t)
	}
	return result
}

// jobToRecord 将 Slurm API 返回的 job map 转换为 UsageRecord
func jobToRecord(job map[string]interface{}) UsageRecord {
	record := UsageRecord{
		JobID:    extractInt64(job, "job_id"),
		JobName:  extractString(job, "name"),
		User:     extractString(job, "user"),
		Account:  extractString(job, "account"),
		Cluster:  extractString(job, "cluster"),
		Partition: extractString(job, "partition"),
		QoS:      extractString(job, "qos"),
		JobCount: 1,
	}

	// state: 字符串 或 {current: [...]}
	if stateRaw, ok := job["state"]; ok {
		switch sv := stateRaw.(type) {
		case string:
			record.State = sv
		case map[string]interface{}:
			if cur, ok := sv["current"]; ok {
				switch cv := cur.(type) {
				case string:
					record.State = cv
				case []interface{}:
					if len(cv) > 0 {
						if s, ok := cv[0].(string); ok {
							record.State = s
						}
					}
				}
			}
		}
	}

	// elapsed: time.elapsed（秒）
	elapsed := extractNestedInt64(job, "time", "elapsed")
	if elapsed == 0 {
		elapsed = extractInt64(job, "elapsed_time")
	}
	record.ElapsedSecs = elapsed

	// start/end time
	startTs := extractNestedInt64(job, "time", "start")
	if startTs == 0 {
		startTs = extractInt64(job, "start_time")
	}
	if startTs > 0 {
		record.StartTime = time.Unix(startTs, 0)
	}

	endTs := extractNestedInt64(job, "time", "end")
	if endTs == 0 {
		endTs = extractInt64(job, "end_time")
	}
	if endTs > 0 {
		record.EndTime = time.Unix(endTs, 0)
	}

	// cpu time: time.total（秒）
	cpuTime := extractNestedInt64(job, "time", "total")
	if cpuTime == 0 {
		cpuTime = extractInt64(job, "cpu_time")
	}
	record.CPUTime = cpuTime
	record.CPUHours = float64(cpuTime) / 3600.0

	// alloc nodes
	allocNodes := int(extractInt64(job, "allocation_nodes"))
	if allocNodes == 0 {
		allocNodes = int(extractNestedInt64(job, "allocation_nodes"))
	}

	if elapsed > 0 {
		if allocNodes > 0 {
			record.NodeHours = float64(elapsed) * float64(allocNodes) / 3600.0
		}
	}

	// TRES: tres.allocated 数组
	var allocTRES []TRESItem
	if tresRaw, ok := job["tres"]; ok {
		if tresMap, ok := tresRaw.(map[string]interface{}); ok {
			if alloc, ok := tresMap["allocated"]; ok {
				allocTRES = parseTRESList(alloc)
			}
		}
	}

	// 打印原始 TRES 数据，帮助调试
	fmt.Printf("[USAGE-RAW] job_id=%d tres_count=%d elapsed=%d cpuTime=%d\n",
		record.JobID, len(allocTRES), elapsed, cpuTime)
	for _, t := range allocTRES {
		fmt.Printf("[USAGE-TRES] type=%s name=%s count=%d\n", t.Type, t.Name, t.Count)
	}
	// 如果 TRES 为空，打印原始 tres 字段
	if len(allocTRES) == 0 {
		if tresRaw, ok := job["tres"]; ok {
			fmt.Printf("[USAGE-TRES-RAW] %+v\n", tresRaw)
		} else {
			fmt.Printf("[USAGE-TRES-RAW] no tres field in job\n")
		}
	}

	for _, tres := range allocTRES {
		switch tres.Type {
		case "gres/gpu", "gpu":
			if elapsed > 0 {
				record.GPUHours = float64(elapsed) * float64(tres.Count) / 3600.0
			}
		case "billing":
			// billing count = 权重（如 CPU 核数），乘以运行时间得到 billing-seconds
			if elapsed > 0 {
				record.BillingHours = float64(tres.Count) * float64(elapsed) / 3600.0
			}
		case "cpu":
			// 如果没有 billing TRES，用 cpu count * elapsed 作为 billing
			if record.BillingHours == 0 && elapsed > 0 {
				record.BillingHours = float64(tres.Count) * float64(elapsed) / 3600.0
			}
		}
	}

	// 最终退回：没有 billing 也没有 cpu TRES，用 cpu_time
	if record.BillingHours == 0 {
		record.BillingHours = record.CPUHours
	}

	record.BillingMins = record.BillingHours * 60

	fmt.Printf("[USAGE] job_id=%d name=%s user=%s state=%s elapsed=%ds billing=%.4fh (%.2fmins) cpu=%.4fh\n",
		record.JobID, record.JobName, record.User, record.State,
		elapsed, record.BillingHours, record.BillingMins, record.CPUHours)

	return record
}

// GetAccountBillingLimit 获取账户的 billing 限制（从 QoS 获取，单位：billing-minutes）
func (c *Client) GetAccountBillingLimit(account string) (int64, error) {
	// 获取账户关联信息以找到 QoS
	associations, err := c.GetAssociations()
	if err != nil {
		return 0, fmt.Errorf("failed to get associations: %w", err)
	}

	// 收集该账户所有 QoS 名称（账户级别关联，user 为空）
	qosNames := []string{}
	for _, assoc := range associations {
		if assoc.Account == account && assoc.User == "" {
			qosNames = append(qosNames, assoc.QoS...)
			break
		}
	}
	// 如果账户级别没有，再找用户关联中的 QoS
	if len(qosNames) == 0 {
		for _, assoc := range associations {
			if assoc.Account == account && len(assoc.QoS) > 0 {
				qosNames = assoc.QoS
				break
			}
		}
	}
	if len(qosNames) == 0 {
		qosNames = []string{"normal"}
	}

	// 遍历 QoS，取第一个有 billing 限制的值
	for _, qosName := range qosNames {
		qos, err := c.GetQoS(qosName)
		if err != nil {
			continue
		}
		for _, tres := range qos.Limits.Max.TRES.Minutes.Total {
			if tres.Type == "billing" && tres.Count > 0 {
				return tres.Count, nil
			}
		}
	}

	// 没有找到 billing 限制，返回 0（无限制）
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
		// billing-minutes = BillingHours * 60（BillingHours 已从 TRES billing 中提取，否则退回 CPUHours）
		usedBilling += int64(record.BillingHours * 60)

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
		Cluster:          os.Getenv("SLURM_CLUSTER_NAME"),
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
		usedBilling += int64(record.BillingHours * 60)

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
		Cluster:          os.Getenv("SLURM_CLUSTER_NAME"),
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
	params := fmt.Sprintf("?users=%s&start_time=%d&end_time=%d",
		user, startTime.Unix(), endTime.Unix())

	path := c.buildAPIPath("/jobs") + params
	respBody, err := c.doRequest("GET", path, nil)
	if err != nil {
		// 404 / not found 视为无记录，返回空列表
		errStr := err.Error()
		if contains(errStr, "not found") || contains(errStr, "404") || contains(errStr, "No jobs") {
			return []UsageRecord{}, nil
		}
		return nil, err
	}

	var response UsageResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to parse usage response: %w", err)
	}

	// Slurm 有时把 "not found" 放在 errors 里，视为无记录
	if len(response.Errors) > 0 {
		errMsg := response.Errors[0].Error
		if contains(errMsg, "not found") || contains(errMsg, "No jobs") || contains(errMsg, "Invalid user") {
			return []UsageRecord{}, nil
		}
		return nil, fmt.Errorf("slurm API error: %s", errMsg)
	}

	fmt.Printf("[USAGE-API] GetUserUsage returned %d jobs for user=%s start=%d end=%d\n",
		len(response.Jobs), user, startTime.Unix(), endTime.Unix())

	var records []UsageRecord
	for _, job := range response.Jobs {
		records = append(records, jobToRecord(job))
	}
	if records == nil {
		records = []UsageRecord{}
	}
	return records, nil
}

// GetAccountUsage 获取账户机时使用情况
func (c *Client) GetAccountUsage(account string, startTime, endTime time.Time) ([]UsageRecord, error) {
	// 构建查询参数
	params := fmt.Sprintf("?accounts=%s&start_time=%d&end_time=%d",
		account, startTime.Unix(), endTime.Unix())

	path := c.buildAPIPath("/jobs") + params
	respBody, err := c.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var response UsageResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to parse usage response: %w", err)
	}

	if len(response.Errors) > 0 {
		errMsg := response.Errors[0].Error
		if contains(errMsg, "not found") || contains(errMsg, "No jobs") {
			return []UsageRecord{}, nil
		}
		return nil, fmt.Errorf("slurm API error: %s", errMsg)
	}

	// 转换为 UsageRecord
	var records []UsageRecord
	for _, job := range response.Jobs {
		records = append(records, jobToRecord(job))
	}
	if records == nil {
		records = []UsageRecord{}
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
			fmt.Printf("Warning: failed to get usage for account %s: %v\n", account.Name, err)
			continue
		}
		result[account.Name] = usage
	}
	
	return result, nil
}