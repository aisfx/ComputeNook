package slurm

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

// Error Slurm API 错误
type Error struct {
	Error       string `json:"error"`
	ErrorNumber int    `json:"error_number"`
}

// TRESItem TRES 资源项
type TRESItem struct {
	Type  string `json:"type"`
	Name  string `json:"name"`
	ID    int    `json:"id"`
	Count int64  `json:"count"`
}

// LimitValue 限制值结构
type LimitValue struct {
	Set      bool `json:"set"`
	Infinite bool `json:"infinite"`
	Number   int  `json:"number"`
}

// QoS Slurm 服务质量
type QoS struct {
	Name        string      `json:"name"`
	Description string      `json:"description,omitempty"`
	ID          int         `json:"id,omitempty"`
	Priority    interface{} `json:"priority,omitempty"`      // 优先级（可能是对象或整数）
	Flags       interface{} `json:"flags,omitempty"`         // 标志（可能是数组或字符串）
	
	// v0.0.43 新的嵌套结构
	Limits struct {
		GraceTime int `json:"grace_time,omitempty"`
		Max       struct {
			ActiveJobs struct {
				Accruing LimitValue `json:"accruing"`
				Count    LimitValue `json:"count"`
			} `json:"active_jobs"`
			Jobs struct {
				Count      LimitValue `json:"count"`
				ActiveJobs struct {
					Per struct {
						Account LimitValue `json:"account"`
						User    LimitValue `json:"user"`
					} `json:"per"`
				} `json:"active_jobs"`
				Per struct {
					Account LimitValue `json:"account"`
					User    LimitValue `json:"user"`
				} `json:"per"`
			} `json:"jobs"`
			TRES struct {
				Total   []TRESItem `json:"total"`
				Minutes struct {
					Total []TRESItem `json:"total"`
					Per   struct {
						QoS     []TRESItem `json:"qos"`
						Job     []TRESItem `json:"job"`
						Account []TRESItem `json:"account"`
						User    []TRESItem `json:"user"`
					} `json:"per"`
				} `json:"minutes"`
				Per struct {
					Account []TRESItem `json:"account"`
					Job     []TRESItem `json:"job"`
					Node    []TRESItem `json:"node"`
					User    []TRESItem `json:"user"`
				} `json:"per"`
			} `json:"tres"`
			WallClock struct {
				Per struct {
					QoS LimitValue `json:"qos"`
					Job LimitValue `json:"job"`
				} `json:"per"`
			} `json:"wall_clock"`
		} `json:"max"`
		Min struct {
			TRES struct {
				Per struct {
					Job []TRESItem `json:"job"`
				} `json:"per"`
			} `json:"tres"`
		} `json:"min,omitempty"`
	} `json:"limits,omitempty"`
	
	// 保留旧字段以兼容，同时支持前端发送的字段名
	MaxJobs     interface{} `json:"max_jobs_pu,omitempty"`   // 每用户最大作业数
	MaxSubmit   interface{} `json:"max_submit_pu,omitempty"` // 每用户最大提交数
	MaxWallPU   interface{} `json:"max_wall_pu,omitempty"`   // 每用户最大运行时间（分钟）
	MaxNodes    interface{} `json:"max_nodes_pu,omitempty"`  // 每用户最大节点数
	MaxCPUs     interface{} `json:"max_cpus_pu,omitempty"`   // 每用户最大 CPU 核心数
	MaxGPUs     interface{} `json:"max_gpus_pu,omitempty"`   // 每用户最大 GPU 数量（独立字段）
	MaxTRES     string      `json:"max_tres_pu,omitempty"`   // 每用户最大 TRES (包含 GPU 等资源)
	MaxWall     interface{} `json:"max_wall_pj,omitempty"`   // 每作业最大运行时间（分钟）
	GrpTRESMins string      `json:"grp_tres_mins,omitempty"` // 组总机时（TRES-minutes）
	
	// 新增字段：最小资源要求
	MinCPUs     interface{} `json:"min_cpus_pj,omitempty"`   // 每作业最小 CPU 核心数
	MinNodes    interface{} `json:"min_nodes_pj,omitempty"`  // 每作业最小节点数
	MinTRES     string      `json:"min_tres_pj,omitempty"`   // 每作业最小 TRES
	
	// 新增字段：抢占和优先级控制
	Preempt     []string    `json:"preempt,omitempty"`       // 可以抢占的 QoS 列表
	PreemptMode string      `json:"preempt_mode,omitempty"`  // 抢占模式：off, suspend, requeue, cancel
	PreemptExemptTime int   `json:"preempt_exempt_time,omitempty"` // 抢占豁免时间（秒）
	
	// 新增字段：使用因子（影响公平共享调度）
	UsageFactor float64     `json:"usage_factor,omitempty"`  // 使用因子，默认 1.0
	UsageThreshold float64  `json:"usage_threshold,omitempty"` // 使用阈值
}

// QoSResponse Slurm QoS 列表响应
type QoSResponse struct {
	QoS    []QoS   `json:"qos"`
	Errors []Error `json:"errors"`
}

// GetQoSList 获取所有 QoS
func (c *Client) GetQoSList() ([]QoS, error) {
	respBody, err := c.doRequest("GET", c.buildAPIPath("/qos"), nil)
	if err != nil {
		return nil, err
	}

	var response QoSResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to parse qos response: %w", err)
	}

	if len(response.Errors) > 0 {
		return nil, fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}

	return response.QoS, nil
}

// GetQoS 获取单个 QoS
func (c *Client) GetQoS(name string) (*QoS, error) {
	path := c.buildAPIPath(fmt.Sprintf("/qos/%s", name))
	respBody, err := c.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var response QoSResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to parse qos response: %w", err)
	}

	if len(response.Errors) > 0 {
		return nil, fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}

	if len(response.QoS) == 0 {
		return nil, fmt.Errorf("qos not found")
	}

	return &response.QoS[0], nil
}

// buildQoSLimits 构建 Slurm v0.0.43 格式的 limits 结构
func buildQoSLimits(qos *QoS) map[string]interface{} {
	limits := map[string]interface{}{}
	maxLimits := map[string]interface{}{}
	minLimits := map[string]interface{}{}

	// ========== MAX LIMITS ==========
	// per-user TRES 限制
	userLimits := []TRESItem{}

	if qos.MaxCPUs != nil && extractNumber(qos.MaxCPUs) > 0 {
		userLimits = append(userLimits, TRESItem{Type: "cpu", Name: "", ID: 1, Count: int64(extractNumber(qos.MaxCPUs))})
	}
	// 内存：优先从 MaxTRES 字符串解析，单位 GB -> MB
	if memGB := extractMemoryFromTRES(qos.MaxTRES); memGB > 0 {
		userLimits = append(userLimits, TRESItem{Type: "mem", Name: "", ID: 2, Count: int64(memGB * 1024)})
	}
	if qos.MaxNodes != nil && extractNumber(qos.MaxNodes) > 0 {
		userLimits = append(userLimits, TRESItem{Type: "node", Name: "", ID: 4, Count: int64(extractNumber(qos.MaxNodes))})
	}
	// GPU：优先用独立字段 MaxGPUs，其次从 MaxTRES 字符串解析
	gpuCount := 0
	if qos.MaxGPUs != nil {
		gpuCount = extractNumber(qos.MaxGPUs)
	}
	if gpuCount == 0 {
		gpuCount = extractGPUCountFromTRES(qos.MaxTRES)
	}
	if gpuCount > 0 {
		userLimits = append(userLimits, TRESItem{Type: "gres/gpu", Name: "", ID: 6, Count: int64(gpuCount)})
	}

	// 总机时限制 (GrpTRESMins -> minutes.total)
	minutesTotal := []TRESItem{}
	if qos.GrpTRESMins != "" {
		minutesTotal = append(minutesTotal, TRESItem{Type: "billing", Name: "", ID: 5, Count: parseGrpTRESMins(qos.GrpTRESMins)})
	}

	tres := map[string]interface{}{
		"total": []TRESItem{},
		"per": map[string]interface{}{
			"account": []TRESItem{},
			"job":     []TRESItem{},
			"node":    []TRESItem{},
			"user":    userLimits,
		},
		"minutes": map[string]interface{}{
			"total": minutesTotal,
			"per": map[string]interface{}{
				"qos":     []TRESItem{},
				"job":     []TRESItem{},
				"account": []TRESItem{},
				"user":    []TRESItem{},
			},
		},
	}
	maxLimits["tres"] = tres

	// 作业数限制
	if qos.MaxJobs != nil && extractNumber(qos.MaxJobs) > 0 {
		maxLimits["jobs"] = map[string]interface{}{
			"per": map[string]interface{}{
				"user": LimitValue{Set: true, Infinite: false, Number: extractNumber(qos.MaxJobs)},
			},
		}
	}

	// 提交作业数限制
	if qos.MaxSubmit != nil && extractNumber(qos.MaxSubmit) > 0 {
		maxLimits["active_jobs"] = map[string]interface{}{
			"count": LimitValue{Set: true, Infinite: false, Number: extractNumber(qos.MaxSubmit)},
		}
	}

	// 作业运行时间限制（MaxWall，单位分钟）
	// v0.0.43 格式：limits.max.wall_clock.per.job，值为 LimitValue
	if qos.MaxWall != nil && extractNumber(qos.MaxWall) > 0 {
		wallMins := extractNumber(qos.MaxWall)
		maxLimits["wall_clock"] = map[string]interface{}{
			"per": map[string]interface{}{
				"job": LimitValue{Set: true, Infinite: false, Number: wallMins},
			},
		}
	}

	limits["max"] = maxLimits

	// ========== MIN LIMITS ==========
	// per-job 最小 TRES 限制
	jobMinLimits := []TRESItem{}
	
	if qos.MinCPUs != nil && extractNumber(qos.MinCPUs) > 0 {
		jobMinLimits = append(jobMinLimits, TRESItem{Type: "cpu", Name: "", ID: 1, Count: int64(extractNumber(qos.MinCPUs))})
	}
	if qos.MinNodes != nil && extractNumber(qos.MinNodes) > 0 {
		jobMinLimits = append(jobMinLimits, TRESItem{Type: "node", Name: "", ID: 4, Count: int64(extractNumber(qos.MinNodes))})
	}
	// 从 MinTRES 字符串解析其他资源
	if qos.MinTRES != "" {
		if minMemGB := extractMemoryFromTRES(qos.MinTRES); minMemGB > 0 {
			jobMinLimits = append(jobMinLimits, TRESItem{Type: "mem", Name: "", ID: 2, Count: int64(minMemGB * 1024)})
		}
		if minGPU := extractGPUCountFromTRES(qos.MinTRES); minGPU > 0 {
			jobMinLimits = append(jobMinLimits, TRESItem{Type: "gres/gpu", Name: "", ID: 6, Count: int64(minGPU)})
		}
	}

	if len(jobMinLimits) > 0 {
		minLimits["tres"] = map[string]interface{}{
			"per": map[string]interface{}{
				"job": jobMinLimits,
			},
		}
		limits["min"] = minLimits
	}

	return limits
}

// buildQoSData 构建提交给 Slurm API 的 QoS 对象
func buildQoSData(qos *QoS) map[string]interface{} {
	qosData := map[string]interface{}{
		"name":   qos.Name,
		"flags":  []string{},
		"limits": buildQoSLimits(qos),
	}
	
	if qos.Description != "" {
		qosData["description"] = qos.Description
	}
	
	// 优先级
	if qos.Priority != nil {
		if priority := extractNumber(qos.Priority); priority > 0 {
			qosData["priority"] = map[string]interface{}{
				"set":    true,
				"number": priority,
			}
		}
	}
	
	// 抢占配置
	if len(qos.Preempt) > 0 {
		qosData["preempt"] = map[string]interface{}{
			"list": qos.Preempt,
			"mode": qos.PreemptMode,
		}
	}
	
	// 抢占豁免时间
	if qos.PreemptExemptTime > 0 {
		qosData["preempt"] = map[string]interface{}{
			"exempt_time": map[string]interface{}{
				"set":    true,
				"number": qos.PreemptExemptTime,
			},
		}
	}
	
	// 使用因子
	if qos.UsageFactor > 0 {
		qosData["usage_factor"] = qos.UsageFactor
	}
	
	if qos.UsageThreshold > 0 {
		qosData["usage_threshold"] = qos.UsageThreshold
	}
	
	return qosData
}

// CreateQoS 创建 QoS
func (c *Client) CreateQoS(qos *QoS) error {
	body := map[string]interface{}{
		"qos": []map[string]interface{}{buildQoSData(qos)},
	}
	respBody, err := c.doRequest("POST", c.buildAPIPath("/qos"), body)
	if err != nil {
		return err
	}
	var response QoSResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}
	if len(response.Errors) > 0 {
		return fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}
	return nil
}

// UpdateQoS 更新 QoS
func (c *Client) UpdateQoS(name string, qos *QoS) error {
	body := map[string]interface{}{
		"qos": []map[string]interface{}{buildQoSData(qos)},
	}
	respBody, err := c.doRequest("POST", c.buildAPIPath("/qos"), body)
	if err != nil {
		return err
	}
	var response QoSResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}
	if len(response.Errors) > 0 {
		return fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}
	return nil
}

// DeleteQoS 删除 QoS
func (c *Client) DeleteQoS(name string) error {
	path := c.buildAPIPath(fmt.Sprintf("/qos/%s", name))
	respBody, err := c.doRequest("DELETE", path, nil)
	if err != nil {
		return err
	}

	var response QoSResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}

	if len(response.Errors) > 0 {
		return fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}

	return nil
}

// 辅助函数：从 TRES 字符串中提取 GPU 数量
// 支持格式: "gres/gpu=4" 或 "gres/gpu=2,mem=11G" 等逗号分隔
func extractGPUCountFromTRES(tres string) int {
	if len(tres) == 0 {
		return 0
	}
	for _, part := range strings.Split(tres, ",") {
		part = strings.TrimSpace(part)
		if strings.Contains(part, "gpu") {
			kv := strings.SplitN(part, "=", 2)
			if len(kv) == 2 {
				if count, err := strconv.Atoi(strings.TrimSpace(kv[1])); err == nil {
					return count
				}
			}
		}
	}
	return 0
}

// 辅助函数：从 TRES 字符串中提取内存 (GB)
// 支持格式: "mem=256G"、"mem=262144M"、"gres/gpu=2,mem=11G" 等
func extractMemoryFromTRES(tres string) int {
	if len(tres) == 0 {
		return 0
	}
	for _, part := range strings.Split(tres, ",") {
		part = strings.TrimSpace(part)
		if strings.HasPrefix(part, "mem=") {
			memStr := strings.TrimPrefix(part, "mem=")
			if strings.HasSuffix(memStr, "G") {
				if gb, err := strconv.Atoi(strings.TrimSuffix(memStr, "G")); err == nil {
					return gb
				}
			} else if strings.HasSuffix(memStr, "M") {
				if mb, err := strconv.Atoi(strings.TrimSuffix(memStr, "M")); err == nil {
					return mb / 1024
				}
			} else {
				// 纯数字，单位 MB
				if mb, err := strconv.Atoi(memStr); err == nil {
					return mb / 1024
				}
			}
		}
	}
	return 0
}

// ExtractNumber 提取数值（处理可能是对象的情况），供外部包使用
func ExtractNumber(value interface{}) int {
	return extractNumber(value)
}

// 辅助函数：提取数值（处理可能是对象的情况）
func extractNumber(value interface{}) int {
	if value == nil {
		return 0
	}
	switch v := value.(type) {
	case int:
		return v
	case float64:
		return int(v)
	case string:
		if num, err := strconv.Atoi(v); err == nil {
			return num
		}
	case map[string]interface{}:
		// 如果是对象，尝试提取 number 字段
		if num, ok := v["number"].(int); ok {
			return num
		}
		if num, ok := v["number"].(float64); ok {
			return int(num)
		}
	}
	return 0
}

// 辅助函数：解析 GrpTRESMins
func parseGrpTRESMins(grpTresMins string) int64 {
	// 输入可能是数字字符串，需要转换为整数
	if count, err := strconv.ParseInt(grpTresMins, 10, 64); err == nil {
		return count
	}
	return 0
}

// MinutesToHours 将分钟转换为小时
func MinutesToHours(minutes int64) float64 {
	return float64(minutes) / 60.0
}

// HoursToMinutes 将小时转换为分钟
func HoursToMinutes(hours float64) int64 {
	return int64(hours * 60)
}

// ExtractBillingQuota 从QoS中提取billing配额（分钟）
func ExtractBillingQuota(qos *QoS) int64 {
	// 优先从新格式提取
	for _, tres := range qos.Limits.Max.TRES.Minutes.Total {
		if tres.Type == "billing" {
			return tres.Count
		}
	}
	// 兼容旧格式
	if qos.GrpTRESMins != "" {
		return parseGrpTRESMins(qos.GrpTRESMins)
	}
	return 0
}

// ValidateQoS 验证 QoS 配置的合理性
func ValidateQoS(qos *QoS) error {
	if qos.Name == "" {
		return fmt.Errorf("QoS name is required")
	}
	
	// 验证优先级范围 (通常 0-65535)
	if qos.Priority != nil {
		priority := extractNumber(qos.Priority)
		if priority < 0 || priority > 65535 {
			return fmt.Errorf("priority must be between 0 and 65535")
		}
	}
	
	// 验证最小值不超过最大值
	if qos.MinCPUs != nil && qos.MaxCPUs != nil {
		minCPU := extractNumber(qos.MinCPUs)
		maxCPU := extractNumber(qos.MaxCPUs)
		if minCPU > 0 && maxCPU > 0 && minCPU > maxCPU {
			return fmt.Errorf("min_cpus_pj (%d) cannot exceed max_cpus_pu (%d)", minCPU, maxCPU)
		}
	}
	
	if qos.MinNodes != nil && qos.MaxNodes != nil {
		minNodes := extractNumber(qos.MinNodes)
		maxNodes := extractNumber(qos.MaxNodes)
		if minNodes > 0 && maxNodes > 0 && minNodes > maxNodes {
			return fmt.Errorf("min_nodes_pj (%d) cannot exceed max_nodes_pu (%d)", minNodes, maxNodes)
		}
	}
	
	// 验证抢占模式
	if qos.PreemptMode != "" {
		validModes := map[string]bool{
			"off":     true,
			"suspend": true,
			"requeue": true,
			"cancel":  true,
		}
		if !validModes[qos.PreemptMode] {
			return fmt.Errorf("invalid preempt_mode: %s (must be off, suspend, requeue, or cancel)", qos.PreemptMode)
		}
	}
	
	// 验证使用因子范围
	if qos.UsageFactor < 0 {
		return fmt.Errorf("usage_factor cannot be negative")
	}
	
	if qos.UsageThreshold < 0 || qos.UsageThreshold > 1 {
		return fmt.Errorf("usage_threshold must be between 0 and 1")
	}
	
	return nil
}

// GetQoSPriority 获取 QoS 优先级（处理不同格式）
func GetQoSPriority(qos *QoS) int {
	return extractNumber(qos.Priority)
}

// GetQoSMaxJobsPerUser 获取每用户最大作业数
func GetQoSMaxJobsPerUser(qos *QoS) int {
	// 优先从新格式提取
	if qos.Limits.Max.Jobs.Per.User.Set {
		return qos.Limits.Max.Jobs.Per.User.Number
	}
	// 兼容旧格式
	return extractNumber(qos.MaxJobs)
}

// GetQoSMaxWallPerJob 获取每作业最大运行时间（分钟）
func GetQoSMaxWallPerJob(qos *QoS) int {
	// 优先从新格式提取
	if qos.Limits.Max.WallClock.Per.Job.Set {
		return qos.Limits.Max.WallClock.Per.Job.Number
	}
	// 兼容旧格式
	return extractNumber(qos.MaxWall)
}

// GetQoSTRESLimit 从 QoS 中提取指定类型的 TRES 限制
func GetQoSTRESLimit(qos *QoS, tresType string) int64 {
	// 从 per-user TRES 限制中查找
	for _, tres := range qos.Limits.Max.TRES.Per.User {
		if tres.Type == tresType || strings.Contains(tres.Type, tresType) {
			return tres.Count
		}
	}
	return 0
}