package slurm

import (
	"os"
)

// GetDefaultClusterName 获取默认集群名称
// 优先从环境变量读取，如果未配置则使用 "cluster" 作为默认值
func GetDefaultClusterName() string {
	clusterName := os.Getenv("SLURM_CLUSTER_NAME")
	if clusterName == "" {
		clusterName = "cluster"
	}
	return clusterName
}
