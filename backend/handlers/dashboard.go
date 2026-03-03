package handlers

import (
	"net/http"
	"strings"
	"github.com/gin-gonic/gin"
	"hpc-backend/slurm"
	"hpc-backend/logger"
)

// DashboardStats 仪表盘统计信息
type DashboardStats struct {
	// 节点统计
	TotalNodes  int `json:"total_nodes"`
	OnlineNodes int `json:"online_nodes"`
	IdleNodes   int `json:"idle_nodes"`
	DownNodes   int `json:"down_nodes"`
	
	// CPU 统计
	TotalCPUs       int     `json:"total_cpus"`
	AllocatedCPUs   int     `json:"allocated_cpus"`
	IdleCPUs        int     `json:"idle_cpus"`
	CPUUsagePercent float64 `json:"cpu_usage_percent"`
	
	// 内存统计（转换为 GB 和 TB）
	TotalMemoryGB   float64 `json:"total_memory_gb"`
	TotalMemoryTB   float64 `json:"total_memory_tb"`
	AllocatedMemoryGB float64 `json:"allocated_memory_gb"`
	FreeMemoryGB    float64 `json:"free_memory_gb"`
	FreeMemoryTB    float64 `json:"free_memory_tb"`
	MemoryUsagePercent float64 `json:"memory_usage_percent"`
	
	// GPU 统计
	TotalGPUs     int `json:"total_gpus"`
	AllocatedGPUs int `json:"allocated_gpus"`
	IdleGPUs      int `json:"idle_gpus"`
}

// GetDashboardStats 获取仪表盘统计信息
func GetDashboardStats(c *gin.Context) {
	// 获取当前用户信息
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}
	
	isAdmin, _ := c.Get("isAdmin")
	
	// 创建 Slurm 客户端
	client, err := slurm.NewClient()
	if err != nil {
		logger.Error("Failed to create Slurm client: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to Slurm"})
		return
	}
	
	var stats DashboardStats
	
	// 管理员可以看到全部资源
	if isAdmin.(bool) {
		// 获取集群统计信息
		clusterStats, err := client.GetClusterStatistics()
		if err != nil {
			logger.Error("Failed to get cluster statistics: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get cluster statistics: " + err.Error()})
			return
		}
		
		// 转换内存单位（MB -> GB -> TB）
		totalMemoryGB := float64(clusterStats.TotalMemoryMB) / 1024
		totalMemoryTB := totalMemoryGB / 1024
		allocatedMemoryGB := float64(clusterStats.AllocatedMemoryMB) / 1024
		freeMemoryGB := float64(clusterStats.FreeMemoryMB) / 1024
		freeMemoryTB := freeMemoryGB / 1024
		
		stats = DashboardStats{
			TotalNodes:  clusterStats.TotalNodes,
			OnlineNodes: clusterStats.OnlineNodes,
			IdleNodes:   clusterStats.IdleNodes,
			DownNodes:   clusterStats.DownNodes,
			
			TotalCPUs:       clusterStats.TotalCPUs,
			AllocatedCPUs:   clusterStats.AllocatedCPUs,
			IdleCPUs:        clusterStats.IdleCPUs,
			CPUUsagePercent: clusterStats.CPUUsagePercent,
			
			TotalMemoryGB:      totalMemoryGB,
			TotalMemoryTB:      totalMemoryTB,
			AllocatedMemoryGB:  allocatedMemoryGB,
			FreeMemoryGB:       freeMemoryGB,
			FreeMemoryTB:       freeMemoryTB,
			MemoryUsagePercent: clusterStats.MemoryUsagePercent,
			
			TotalGPUs:     clusterStats.TotalGPUs,
			AllocatedGPUs: clusterStats.AllocatedGPUs,
			IdleGPUs:      clusterStats.IdleGPUs,
		}
	} else {
		// 普通用户：获取用户可用的资源（通过关联和QoS）
		userStats, err := client.GetUserAvailableResources(username.(string))
		if err != nil {
			logger.Error("Failed to get user resources: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user resources: " + err.Error()})
			return
		}
		
		// 转换内存单位
		totalMemoryGB := float64(userStats.TotalMemoryMB) / 1024
		totalMemoryTB := totalMemoryGB / 1024
		allocatedMemoryGB := float64(userStats.AllocatedMemoryMB) / 1024
		freeMemoryGB := float64(userStats.FreeMemoryMB) / 1024
		freeMemoryTB := freeMemoryGB / 1024
		
		stats = DashboardStats{
			TotalNodes:  userStats.TotalNodes,
			OnlineNodes: userStats.OnlineNodes,
			IdleNodes:   userStats.IdleNodes,
			DownNodes:   userStats.DownNodes,
			
			TotalCPUs:       userStats.TotalCPUs,
			AllocatedCPUs:   userStats.AllocatedCPUs,
			IdleCPUs:        userStats.IdleCPUs,
			CPUUsagePercent: userStats.CPUUsagePercent,
			
			TotalMemoryGB:      totalMemoryGB,
			TotalMemoryTB:      totalMemoryTB,
			AllocatedMemoryGB:  allocatedMemoryGB,
			FreeMemoryGB:       freeMemoryGB,
			FreeMemoryTB:       freeMemoryTB,
			MemoryUsagePercent: userStats.MemoryUsagePercent,
			
			TotalGPUs:     userStats.TotalGPUs,
			AllocatedGPUs: userStats.AllocatedGPUs,
			IdleGPUs:      userStats.IdleGPUs,
		}
	}
	
	logger.Info("Dashboard stats retrieved successfully for user: %s (admin: %v)", username, isAdmin)
	c.JSON(http.StatusOK, gin.H{"data": stats})
}

// NodeInfo 节点详细信息
type NodeInfo struct {
	Name            string  `json:"name"`
	State           string  `json:"state"`
	CPUTotal        int     `json:"cpu_total"`
	CPUAllocated    int     `json:"cpu_allocated"`
	CPUUsagePercent float64 `json:"cpu_usage_percent"`
	MemoryTotalMB   int64   `json:"memory_total_mb"`
	MemoryAllocatedMB int64 `json:"memory_allocated_mb"`
	MemoryUsagePercent float64 `json:"memory_usage_percent"`
	GPUInfo         string  `json:"gpu_info"`
	GPUUsed         string  `json:"gpu_used"`
	Partitions      []string `json:"partitions"`
	RunningJobs     int     `json:"running_jobs"`
}

// GetDashboardNodes 获取节点列表（用于仪表盘）
func GetDashboardNodes(c *gin.Context) {
	// 获取当前用户信息
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}
	
	isAdmin, _ := c.Get("isAdmin")
	
	// 创建 Slurm 客户端
	client, err := slurm.NewClient()
	if err != nil {
		logger.Error("Failed to create Slurm client: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to Slurm"})
		return
	}
	
	// 获取节点信息
	nodes, err := client.GetNodes()
	if err != nil {
		logger.Error("Failed to get nodes: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get nodes: " + err.Error()})
		return
	}
	
	// 获取当前运行的作业，用于统计每个节点的作业数
	jobs, err := client.GetJobs("", 0, 0)
	if err != nil {
		logger.Warn("Failed to get jobs for node statistics: %v", err)
		jobs = []slurm.Job{} // 如果获取失败，使用空列表
	}
	
	// 统计每个节点的运行作业数
	nodeJobCount := make(map[string]int)
	for _, job := range jobs {
		jobState := job.GetJobState()
		if jobState == "RUNNING" || jobState == "COMPLETING" {
			// 解析节点列表
			nodeList := parseNodeList(job.Nodes)
			for _, nodeName := range nodeList {
				nodeJobCount[nodeName]++
			}
		}
	}
	
	// 如果是普通用户，需要过滤只显示用户可访问的节点
	var userPartitions map[string]bool
	if !isAdmin.(bool) {
		// 获取用户的关联信息
		associations, err := client.GetUserAssociations(username.(string))
		if err != nil {
			logger.Error("Failed to get user associations: %v", err)
			// 如果获取失败，返回空列表
			c.JSON(http.StatusOK, gin.H{"data": []NodeInfo{}})
			return
		}
		
		// 收集用户可访问的分区
		userPartitions = make(map[string]bool)
		for _, assoc := range associations {
			if assoc.Partition != "" {
				userPartitions[assoc.Partition] = true
			}
		}
		
		// 如果没有指定分区，获取所有分区
		if len(userPartitions) == 0 {
			partitions, err := client.GetPartitions()
			if err == nil {
				for _, p := range partitions {
					userPartitions[p.GetPartitionName()] = true
				}
			}
		}
	}
	
	// 转换为前端格式
	nodeInfos := make([]NodeInfo, 0)
	for _, node := range nodes {
		// 如果是普通用户，检查节点是否在用户可访问的分区中
		if !isAdmin.(bool) {
			nodeInUserPartition := false
			for _, nodePartition := range node.Partitions {
				if userPartitions[nodePartition] {
					nodeInUserPartition = true
					break
				}
			}
			
			if !nodeInUserPartition {
				continue
			}
		}
		
		nodeInfo := NodeInfo{
			Name:               node.Name,
			State:              node.GetNodeState(),
			CPUTotal:           node.CPUs.Total,
			CPUAllocated:       node.AllocCPUs,
			CPUUsagePercent:    node.GetCPUUsagePercent(),
			MemoryTotalMB:      node.RealMemory,
			MemoryAllocatedMB:  node.AllocMemory,
			MemoryUsagePercent: node.GetMemoryUsagePercent(),
			GPUInfo:            node.Gres,
			GPUUsed:            node.GresUsed,
			Partitions:         node.Partitions,
			RunningJobs:        nodeJobCount[node.Name],
		}
		nodeInfos = append(nodeInfos, nodeInfo)
	}
	
	logger.Info("Retrieved %d nodes for user %s (admin: %v)", len(nodeInfos), username, isAdmin)
	c.JSON(http.StatusOK, gin.H{"data": nodeInfos})
}

// parseNodeList 解析节点列表字符串
// 支持格式: "node01", "node01,node02", "node[01-04]"
func parseNodeList(nodeStr string) []string {
	if nodeStr == "" || nodeStr == "None assigned" {
		return []string{}
	}
	
	nodes := []string{}
	
	// 简单实现：按逗号分割
	// TODO: 支持更复杂的节点范围表达式如 node[01-04]
	parts := strings.Split(nodeStr, ",")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" && part != "None assigned" {
			nodes = append(nodes, part)
		}
	}
	
	return nodes
}
