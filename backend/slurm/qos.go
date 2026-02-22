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
	Description string      `json:"description"`
	Priority    interface{} `json:"priority"`      // 优先级（可能是对象或整数）
	Flags       interface{} `json:"flags"`         // 标志（可能是数组或字符串）
	GraceTime   interface{} `json:"grace_time"`    // 宽限时间（秒）
	MaxJobs     interface{} `json:"max_jobs_pu"`   // 每用户最大作业数
	MaxSubmit   interface{} `json:"max_submit_pu"` // 每用户最大提交数
	MaxWall     interface{} `json:"max_wall_pj"`   // 每作业最大运行时间（分钟）
	MaxWallPU   interface{} `json:"max_wall_pu"`   // 每用户最大运行时间（分钟）
	MaxNodes    interface{} `json:"max_nodes_pu"`  // 每用户最大节点数
	MaxCPUs     interface{} `json:"max_cpus_pu"`   // 每用户最大 CPU 核心数
	MaxTRES     string      `json:"max_tres_pu"`   // 每用户最大 TRES (包含 GPU 等资源)
	MaxTRESPJ   string      `json:"max_tres_pj"`   // 每作业最大 TRES
	MinTRES     string      `json:"min_tres_pj"`   // 每作业最小 TRES
	Preempt     interface{} `json:"preempt"`       // 可抢占的 QoS（可能是数组或字符串）
	PreemptMode interface{} `json:"preempt_mode"`  // 抢占模式（可能是数组或字符串）
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
	body := map[string]interface{}{
		"qos": []QoS{*qos},
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
	body := map[string]interface{}{
		"qos": []QoS{*qos},
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
