package slurm

import (
	"encoding/json"
	"fmt"
	"hpc-backend/logger"
)

// Node Slurm 节点信息
type Node struct {
	Name        string   `json:"name"`
	Architecture string  `json:"architecture,omitempty"`
	State       []string `json:"state,omitempty"`
	Reason      string   `json:"reason,omitempty"`
	
	// CPU 信息
	CPUs struct {
		Total int `json:"total"`
	} `json:"cpus,omitempty"`
	
	// 内存信息（MB）
	RealMemory int64 `json:"real_memory,omitempty"`
	
	// GPU 信息
	Gres      string `json:"gres,omitempty"`
	GresDrain string `json:"gres_drain,omitempty"`
	GresUsed  string `json:"gres_used,omitempty"`
	
	// 分区信息
	Partitions []string `json:"partitions,omitempty"`
	
	// 其他信息
	AllocCPUs   int    `json:"alloc_cpus,omitempty"`
	AllocMemory int64  `json:"alloc_memory,omitempty"`
	Comment     string `json:"comment,omitempty"`
}

// GetNodeState 获取节点状态
func (n *Node) GetNodeState() string {
	if len(n.State) > 0 {
		return n.State[0]
	}
	return "UNKNOWN"
}

// GetCPUUsagePercent 计算CPU使用率
func (n *Node) GetCPUUsagePercent() float64 {
	if n.CPUs.Total == 0 {
		return 0
	}
	return float64(n.AllocCPUs) / float64(n.CPUs.Total) * 100
}

// GetMemoryUsagePercent 计算内存使用率
func (n *Node) GetMemoryUsagePercent() float64 {
	if n.RealMemory == 0 {
		return 0
	}
	return float64(n.AllocMemory) / float64(n.RealMemory) * 100
}

// NodesResponse Slurm 节点列表响应
type NodesResponse struct {
	Nodes  []Node  `json:"nodes"`
	Errors []Error `json:"errors"`
}

// GetNodes 获取所有节点信息
func (c *Client) GetNodes() ([]Node, error) {
	// 节点信息使用 /slurm/ 而不是 /slurmdb/
	path := fmt.Sprintf("/slurm/%s/nodes", c.apiVersion)
	
	logger.Debug("GetNodes API request: GET %s", path)
	logger.Debug("Full URL: %s%s", c.baseURL, path)
	
	respBody, err := c.doRequest("GET", path, nil)
	if err != nil {
		logger.Error("GetNodes API request failed: %v", err)
		return nil, err
	}
	
	logger.Debug("GetNodes API response length: %d bytes", len(respBody))
	
	var response NodesResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		logger.Error("Failed to parse nodes response: %v", err)
		logger.Error("Response body: %s", string(respBody))
		return nil, fmt.Errorf("failed to parse nodes response: %w", err)
	}
	
	if len(response.Errors) > 0 {
		logger.Error("Slurm API returned errors: %s", response.Errors[0].Error)
		return nil, fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}
	
	logger.Info("GetNodes returned %d nodes", len(response.Nodes))
	return response.Nodes, nil
}

// GetNode 获取单个节点信息
func (c *Client) GetNode(nodeName string) (*Node, error) {
	path := fmt.Sprintf("/slurm/%s/node/%s", c.apiVersion, nodeName)
	
	logger.Debug("GetNode API request: GET %s", path)
	logger.Debug("Full URL: %s%s", c.baseURL, path)
	
	respBody, err := c.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}
	
	logger.Debug("GetNode API response: %s", string(respBody))
	
	var response NodesResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to parse node response: %w", err)
	}
	
	if len(response.Errors) > 0 {
		return nil, fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}
	
	if len(response.Nodes) == 0 {
		return nil, fmt.Errorf("node not found")
	}
	
	return &response.Nodes[0], nil
}

// ClusterStatistics 集群统计信息
type ClusterStatistics struct {
	TotalNodes      int     `json:"total_nodes"`
	OnlineNodes     int     `json:"online_nodes"`
	IdleNodes       int     `json:"idle_nodes"`
	AllocatedNodes  int     `json:"allocated_nodes"`
	DownNodes       int     `json:"down_nodes"`
	
	TotalCPUs       int     `json:"total_cpus"`
	AllocatedCPUs   int     `json:"allocated_cpus"`
	IdleCPUs        int     `json:"idle_cpus"`
	CPUUsagePercent float64 `json:"cpu_usage_percent"`
	
	TotalMemoryMB   int64   `json:"total_memory_mb"`
	AllocatedMemoryMB int64 `json:"allocated_memory_mb"`
	FreeMemoryMB    int64   `json:"free_memory_mb"`
	MemoryUsagePercent float64 `json:"memory_usage_percent"`
	
	TotalGPUs       int     `json:"total_gpus"`
	AllocatedGPUs   int     `json:"allocated_gpus"`
	IdleGPUs        int     `json:"idle_gpus"`
}

// GetClusterStatistics 获取集群统计信息
func (c *Client) GetClusterStatistics() (*ClusterStatistics, error) {
	nodes, err := c.GetNodes()
	if err != nil {
		return nil, fmt.Errorf("failed to get nodes: %w", err)
	}
	
	stats := &ClusterStatistics{}
	
	for _, node := range nodes {
		stats.TotalNodes++
		
		state := node.GetNodeState()
		switch state {
		case "IDLE":
			stats.OnlineNodes++
			stats.IdleNodes++
		case "ALLOCATED", "MIXED":
			stats.OnlineNodes++
			stats.AllocatedNodes++
		case "DOWN", "DRAIN", "DRAINING":
			stats.DownNodes++
		default:
			stats.OnlineNodes++
		}
		
		// CPU 统计
		stats.TotalCPUs += node.CPUs.Total
		stats.AllocatedCPUs += node.AllocCPUs
		
		// 内存统计
		stats.TotalMemoryMB += node.RealMemory
		stats.AllocatedMemoryMB += node.AllocMemory
		
		// GPU 统计（从 gres 字段解析）
		totalGPUs, allocGPUs := parseGPUInfo(node.Gres, node.GresUsed)
		stats.TotalGPUs += totalGPUs
		stats.AllocatedGPUs += allocGPUs
	}
	
	// 计算空闲资源
	stats.IdleCPUs = stats.TotalCPUs - stats.AllocatedCPUs
	stats.FreeMemoryMB = stats.TotalMemoryMB - stats.AllocatedMemoryMB
	stats.IdleGPUs = stats.TotalGPUs - stats.AllocatedGPUs
	
	// 计算使用率
	if stats.TotalCPUs > 0 {
		stats.CPUUsagePercent = float64(stats.AllocatedCPUs) / float64(stats.TotalCPUs) * 100
	}
	if stats.TotalMemoryMB > 0 {
		stats.MemoryUsagePercent = float64(stats.AllocatedMemoryMB) / float64(stats.TotalMemoryMB) * 100
	}
	
	logger.Info("Cluster statistics: nodes=%d/%d, cpus=%d/%d (%.1f%%), memory=%dMB/%dMB (%.1f%%), gpus=%d/%d",
		stats.OnlineNodes, stats.TotalNodes,
		stats.AllocatedCPUs, stats.TotalCPUs, stats.CPUUsagePercent,
		stats.AllocatedMemoryMB, stats.TotalMemoryMB, stats.MemoryUsagePercent,
		stats.AllocatedGPUs, stats.TotalGPUs)
	
	return stats, nil
}

// parseGPUInfo 从 gres 字符串解析 GPU 信息
// 例如: "gpu:4" 或 "gpu:tesla:4"
func parseGPUInfo(gres, gresUsed string) (total, allocated int) {
	// 简单解析，实际可能需要更复杂的逻辑
	// gres 格式: "gpu:4" 或 "gpu:tesla:4"
	// gresUsed 格式: "gpu:2" 或 "gpu:tesla:2"
	
	total = parseGPUCount(gres)
	allocated = parseGPUCount(gresUsed)
	
	return
}

// parseGPUCount 从 gres 字符串中提取 GPU 数量
func parseGPUCount(gres string) int {
	if gres == "" {
		return 0
	}
	
	// 简单实现：查找 "gpu:" 后的数字
	// 实际应该使用正则表达式或更健壮的解析
	var count int
	fmt.Sscanf(gres, "gpu:%d", &count)
	if count == 0 {
		// 尝试 "gpu:type:count" 格式
		var gpuType string
		fmt.Sscanf(gres, "gpu:%s:%d", &gpuType, &count)
	}
	
	return count
}

// UserResourceStatistics 用户可用资源统计
type UserResourceStatistics struct {
	TotalNodes      int     `json:"total_nodes"`
	OnlineNodes     int     `json:"online_nodes"`
	IdleNodes       int     `json:"idle_nodes"`
	DownNodes       int     `json:"down_nodes"`
	
	TotalCPUs       int     `json:"total_cpus"`
	AllocatedCPUs   int     `json:"allocated_cpus"`
	IdleCPUs        int     `json:"idle_cpus"`
	CPUUsagePercent float64 `json:"cpu_usage_percent"`
	
	TotalMemoryMB   int64   `json:"total_memory_mb"`
	AllocatedMemoryMB int64 `json:"allocated_memory_mb"`
	FreeMemoryMB    int64   `json:"free_memory_mb"`
	MemoryUsagePercent float64 `json:"memory_usage_percent"`
	
	TotalGPUs       int     `json:"total_gpus"`
	AllocatedGPUs   int     `json:"allocated_gpus"`
	IdleGPUs        int     `json:"idle_gpus"`
	
	// 用户可访问的分区列表
	Partitions      []string `json:"partitions"`
}

// GetUserAvailableResources 获取用户可用的资源
// 通过用户的账户关联和QoS配置来确定用户可以使用哪些资源
func (c *Client) GetUserAvailableResources(username string) (*UserResourceStatistics, error) {
	// 1. 获取用户的关联信息，确定用户可以访问哪些分区
	associations, err := c.GetUserAssociations(username)
	if err != nil {
		logger.Error("Failed to get user associations: %v", err)
		// 如果获取失败，返回空资源
		return &UserResourceStatistics{}, nil
	}
	
	if len(associations) == 0 {
		logger.Info("User %s has no associations, returning empty resources", username)
		return &UserResourceStatistics{}, nil
	}
	
	// 2. 收集用户可以访问的分区
	partitionMap := make(map[string]bool)
	for _, assoc := range associations {
		if assoc.Partition != "" {
			partitionMap[assoc.Partition] = true
		}
	}
	
	// 如果没有指定分区，获取所有分区
	if len(partitionMap) == 0 {
		partitions, err := c.GetPartitions()
		if err == nil {
			for _, p := range partitions {
				partitionMap[p.GetPartitionName()] = true
			}
		}
	}
	
	// 3. 获取所有节点
	nodes, err := c.GetNodes()
	if err != nil {
		return nil, fmt.Errorf("failed to get nodes: %w", err)
	}
	
	// 4. 统计用户可访问分区中的资源
	stats := &UserResourceStatistics{
		Partitions: make([]string, 0, len(partitionMap)),
	}
	
	for partition := range partitionMap {
		stats.Partitions = append(stats.Partitions, partition)
	}
	
	// 统计节点资源
	for _, node := range nodes {
		// 检查节点是否属于用户可访问的分区
		nodeInUserPartition := false
		for _, nodePartition := range node.Partitions {
			if partitionMap[nodePartition] {
				nodeInUserPartition = true
				break
			}
		}
		
		if !nodeInUserPartition {
			continue
		}
		
		stats.TotalNodes++
		
		state := node.GetNodeState()
		switch state {
		case "IDLE":
			stats.OnlineNodes++
			stats.IdleNodes++
		case "ALLOCATED", "MIXED":
			stats.OnlineNodes++
		case "DOWN", "DRAIN", "DRAINING":
			stats.DownNodes++
		default:
			stats.OnlineNodes++
		}
		
		// CPU 统计
		stats.TotalCPUs += node.CPUs.Total
		stats.AllocatedCPUs += node.AllocCPUs
		
		// 内存统计
		stats.TotalMemoryMB += node.RealMemory
		stats.AllocatedMemoryMB += node.AllocMemory
		
		// GPU 统计
		totalGPUs, allocGPUs := parseGPUInfo(node.Gres, node.GresUsed)
		stats.TotalGPUs += totalGPUs
		stats.AllocatedGPUs += allocGPUs
	}
	
	// 计算空闲资源
	stats.IdleCPUs = stats.TotalCPUs - stats.AllocatedCPUs
	stats.FreeMemoryMB = stats.TotalMemoryMB - stats.AllocatedMemoryMB
	stats.IdleGPUs = stats.TotalGPUs - stats.AllocatedGPUs
	
	// 计算使用率
	if stats.TotalCPUs > 0 {
		stats.CPUUsagePercent = float64(stats.AllocatedCPUs) / float64(stats.TotalCPUs) * 100
	}
	if stats.TotalMemoryMB > 0 {
		stats.MemoryUsagePercent = float64(stats.AllocatedMemoryMB) / float64(stats.TotalMemoryMB) * 100
	}
	
	logger.Info("User %s available resources: nodes=%d/%d, cpus=%d/%d (%.1f%%), memory=%dMB/%dMB (%.1f%%), gpus=%d/%d, partitions=%v",
		username,
		stats.OnlineNodes, stats.TotalNodes,
		stats.AllocatedCPUs, stats.TotalCPUs, stats.CPUUsagePercent,
		stats.AllocatedMemoryMB, stats.TotalMemoryMB, stats.MemoryUsagePercent,
		stats.AllocatedGPUs, stats.TotalGPUs,
		stats.Partitions)
	
	return stats, nil
}

// GetUserAssociations 获取用户的关联信息
func (c *Client) GetUserAssociations(username string) ([]Association, error) {
	// 使用 slurmdb API 获取用户关联
	path := fmt.Sprintf("/slurmdb/%s/associations?users=%s", c.apiVersion, username)
	
	logger.Debug("GetUserAssociations API request: GET %s", path)
	
	respBody, err := c.doRequest("GET", path, nil)
	if err != nil {
		logger.Error("GetUserAssociations API request failed: %v", err)
		return nil, err
	}
	
	var response AssociationsResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		logger.Error("Failed to parse associations response: %v", err)
		return nil, fmt.Errorf("failed to parse associations response: %w", err)
	}
	
	if len(response.Errors) > 0 {
		logger.Error("Slurm API returned errors: %s", response.Errors[0].Error)
		return nil, fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}
	
	logger.Info("GetUserAssociations returned %d associations for user %s", len(response.Associations), username)
	return response.Associations, nil
}
