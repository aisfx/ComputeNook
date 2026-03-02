package slurm

import (
	"encoding/json"
	"fmt"
)

// Error Slurm API 错误
type Error struct {
	Error       string `json:"error"`
	ErrorNumber int    `json:"error_number"`
}

// QoS Slurm 服务质量
type QoS struct {
	Name        string      `json:"name"`
	Description string      `json:"description,omitempty"`
	Priority    interface{} `json:"priority,omitempty"`      // 优先级（可能是对象或整数）
	Flags       interface{} `json:"flags,omitempty"`         // 标志（可能是数组或字符串）
	GraceTime   interface{} `json:"grace_time,omitempty"`    // 宽限时间（秒）
	
	// 每用户限制
	MaxJobs     interface{} `json:"max_jobs_pu,omitempty"`   // 每用户最大作业数
	MaxSubmit   interface{} `json:"max_submit_pu,omitempty"` // 每用户最大提交数
	MaxWallPU   interface{} `json:"max_wall_pu,omitempty"`   // 每用户最大运行时间（分钟）
	MaxNodes    interface{} `json:"max_nodes_pu,omitempty"`  // 每用户最大节点数
	MaxCPUs     interface{} `json:"max_cpus_pu,omitempty"`   // 每用户最大 CPU 核心数
	MaxTRES     string      `json:"max_tres_pu,omitempty"`   // 每用户最大 TRES (包含 GPU 等资源)
	
	// 每作业限制
	MaxWall     interface{} `json:"max_wall_pj,omitempty"`   // 每作业最大运行时间（分钟）
	MaxTRESPJ   string      `json:"max_tres_pj,omitempty"`   // 每作业最大 TRES
	MinTRES     string      `json:"min_tres_pj,omitempty"`   // 每作业最小 TRES
	
	// 组限制（总机时等）
	GrpTRES     string      `json:"grp_tres,omitempty"`      // 组总 TRES 限制
	GrpTRESMins string      `json:"grp_tres_mins,omitempty"` // 组总机时（TRES-minutes）
	GrpJobs     interface{} `json:"grp_jobs,omitempty"`      // 组总作业数
	GrpSubmit   interface{} `json:"grp_submit,omitempty"`    // 组总提交数
	GrpWall     interface{} `json:"grp_wall,omitempty"`      // 组总运行时间
	
	// 抢占相关
	Preempt     interface{} `json:"preempt,omitempty"`       // 可抢占的 QoS（可能是数组或字符串）
	PreemptMode interface{} `json:"preempt_mode,omitempty"`  // 抢占模式（可能是数组或字符串）
}

// QoSResponse Slurm QoS 列表响应
type QoSResponse struct {
	QoS    []QoS   `json:"qos"`
	Errors []Error `json:"errors"`
}

// GetQoSList 获取所有 QoS
func (c *Client) GetQoSList() ([]QoS, error) {
	respBody, err := c.doRequest("GET", "/slurmdb/v0.0.40/qos", nil)
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
	path := fmt.Sprintf("/slurmdb/v0.0.40/qos/%s", name)
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

// CreateQoS 创建 QoS
func (c *Client) CreateQoS(qos *QoS) error {
	// 构建只包含有效字段的 QoS 对象
	qosData := map[string]interface{}{
		"name":  qos.Name,
		"flags": []string{}, // 空的flags数组
	}
	
	// 只添加非空字段
	if qos.Description != "" {
		qosData["description"] = qos.Description
	}
	
	// 构建 MaxTRESPerUser 字符串（组合 CPU、GPU、节点等）
	maxTresPerUser := ""
	if qos.MaxCPUs != nil && qos.MaxCPUs != 0 {
		maxTresPerUser = fmt.Sprintf("cpu=%v", qos.MaxCPUs)
	}
	if qos.MaxTRES != "" {
		// 如果有 GPU 限制，添加到 MaxTRESPerUser
		if maxTresPerUser != "" {
			maxTresPerUser += ","
		}
		maxTresPerUser += qos.MaxTRES
	}
	if maxTresPerUser != "" {
		qosData["max_tres_pu"] = maxTresPerUser
	}
	
	// 添加作业数限制
	if qos.MaxJobs != nil && qos.MaxJobs != 0 {
		qosData["max_jobs_pu"] = qos.MaxJobs
	}
	if qos.MaxSubmit != nil && qos.MaxSubmit != 0 {
		qosData["max_submit_pu"] = qos.MaxSubmit
	}
	
	// 添加运行时间限制
	if qos.MaxWall != nil && qos.MaxWall != 0 {
		qosData["max_wall_pj"] = qos.MaxWall
	}
	
	// 添加总机时限制（自动添加billing=前缀）
	if qos.GrpTRESMins != "" {
		qosData["grp_tres_mins"] = fmt.Sprintf("billing=%s", qos.GrpTRESMins)
	}
	
	body := map[string]interface{}{
		"qos": []map[string]interface{}{qosData},
	}

	respBody, err := c.doRequest("POST", "/slurmdb/v0.0.40/qos", body)
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
	// 构建只包含有效字段的 QoS 对象
	qosData := map[string]interface{}{
		"name":  qos.Name,
		"flags": []string{}, // 空的flags数组
	}
	
	// 只添加非空字段
	if qos.Description != "" {
		qosData["description"] = qos.Description
	}
	
	// 构建 MaxTRESPerUser 字符串（组合 CPU、GPU、节点等）
	maxTresPerUser := ""
	if qos.MaxCPUs != nil && qos.MaxCPUs != 0 {
		maxTresPerUser = fmt.Sprintf("cpu=%v", qos.MaxCPUs)
	}
	if qos.MaxTRES != "" {
		// 如果有 GPU 限制，添加到 MaxTRESPerUser
		if maxTresPerUser != "" {
			maxTresPerUser += ","
		}
		maxTresPerUser += qos.MaxTRES
	}
	if maxTresPerUser != "" {
		qosData["max_tres_pu"] = maxTresPerUser
	}
	
	// 添加作业数限制
	if qos.MaxJobs != nil && qos.MaxJobs != 0 {
		qosData["max_jobs_pu"] = qos.MaxJobs
	}
	if qos.MaxSubmit != nil && qos.MaxSubmit != 0 {
		qosData["max_submit_pu"] = qos.MaxSubmit
	}
	
	// 添加运行时间限制
	if qos.MaxWall != nil && qos.MaxWall != 0 {
		qosData["max_wall_pj"] = qos.MaxWall
	}
	
	// 添加总机时限制（自动添加billing=前缀）
	if qos.GrpTRESMins != "" {
		qosData["grp_tres_mins"] = fmt.Sprintf("billing=%s", qos.GrpTRESMins)
	}
	
	body := map[string]interface{}{
		"qos": []map[string]interface{}{qosData},
	}

	respBody, err := c.doRequest("POST", "/slurmdb/v0.0.40/qos", body)
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
	path := fmt.Sprintf("/slurmdb/v0.0.40/qos/%s", name)
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
