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
		} `json:"max"`
	} `json:"limits,omitempty"`
	
	// 保留旧字段以兼容，同时支持前端发送的字段名
	MaxJobs     interface{} `json:"max_jobs_pu,omitempty"`   // 每用户最大作业数
	MaxSubmit   interface{} `json:"max_submit_pu,omitempty"` // 每用户最大提交数
	MaxWallPU   interface{} `json:"max_wall_pu,omitempty"`   // 每用户最大运行时间（分钟）
	MaxNodes    interface{} `json:"max_nodes_pu,omitempty"`  // 每用户最大节点数
	MaxCPUs     interface{} `json:"max_cpus_pu,omitempty"`   // 每用户最大 CPU 核心数
	MaxTRES     string      `json:"max_tres_pu,omitempty"`   // 每用户最大 TRES (包含 GPU 等资源)
	MaxWall     interface{} `json:"max_wall_pj,omitempty"`   // 每作业最大运行时间（分钟）
	GrpTRESMins string      `json:"grp_tres_mins,omitempty"` // 组总机时（TRES-minutes）
}

// QoSResponse Slurm QoS 列表响应
type QoSResponse struct {
	QoS    []QoS   `json:"qos"`
	Errors []Error `json:"errors"`
}

// GetQoSList 获取所有 QoS
func (c *Client) GetQoSList() ([]QoS, error) {
	respBody, err := c.doRequest("GET", "/slurmdb/v0.0.43/qos", nil)
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
	path := fmt.Sprintf("/slurmdb/v0.0.43/qos/%s", name)
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
// CPU/内存/节点/GPU 放入 tres.per.user（per-user 限制）
// 总机时放入 tres.minutes.total（GrpTRESMins）
func buildQoSLimits(qos *QoS) map[string]interface{} {
	maxLimits := map[string]interface{}{}

	// per-user TRES 限制
	userLimits := []TRESItem{}

	if qos.MaxCPUs != nil && extractNumber(qos.MaxCPUs) > 0 {
		userLimits = append(userLimits, TRESItem{Type: "cpu", Name: "", ID: 1, Count: int64(extractNumber(qos.MaxCPUs))})
	}
	if memGB := extractMemoryFromTRES(qos.MaxTRES); memGB > 0 {
		userLimits = append(userLimits, TRESItem{Type: "mem", Name: "", ID: 2, Count: int64(memGB * 1024)})
	}
	if qos.MaxNodes != nil && extractNumber(qos.MaxNodes) > 0 {
		userLimits = append(userLimits, TRESItem{Type: "node", Name: "", ID: 4, Count: int64(extractNumber(qos.MaxNodes))})
	}
	if gpuCount := extractGPUCountFromTRES(qos.MaxTRES); gpuCount > 0 {
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

	return map[string]interface{}{"max": maxLimits}
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
	return qosData
}

// CreateQoS 创建 QoS
func (c *Client) CreateQoS(qos *QoS) error {
	body := map[string]interface{}{
		"qos": []map[string]interface{}{buildQoSData(qos)},
	}
	respBody, err := c.doRequest("POST", "/slurmdb/v0.0.43/qos", body)
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
	respBody, err := c.doRequest("POST", "/slurmdb/v0.0.43/qos", body)
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
	path := fmt.Sprintf("/slurmdb/v0.0.43/qos/%s", name)
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
func extractGPUCountFromTRES(tres string) int {
	// 解析 "gres/gpu=4" 格式
	if len(tres) > 0 {
		parts := strings.Split(tres, "=")
		if len(parts) == 2 && strings.Contains(parts[0], "gpu") {
			if count, err := strconv.Atoi(parts[1]); err == nil {
				return count
			}
		}
	}
	return 0
}

// 辅助函数：从 TRES 字符串中提取内存 (GB)
func extractMemoryFromTRES(tres string) int {
	// 解析 "mem=256G" 或 "mem=262144M" 格式
	if len(tres) > 0 {
		parts := strings.Split(tres, ",")
		for _, part := range parts {
			if strings.Contains(part, "mem=") {
				memStr := strings.Split(part, "=")[1]
				if strings.HasSuffix(memStr, "G") {
					if gb, err := strconv.Atoi(strings.TrimSuffix(memStr, "G")); err == nil {
						return gb
					}
				} else if strings.HasSuffix(memStr, "M") {
					if mb, err := strconv.Atoi(strings.TrimSuffix(memStr, "M")); err == nil {
						return mb / 1024 // 转换为 GB
					}
				}
			}
		}
	}
	return 0
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