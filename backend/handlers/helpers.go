package handlers

import (
	"hpc-backend/slurm"
)

// GetSlurmClientForUser 为当前用户创建Slurm客户端
// 如果配置了SLURM_JWT_KEY，会动态生成用户的token
// 否则使用固定的SLURM_REST_TOKEN
func GetSlurmClientForUser(username string) (*slurm.Client, error) {
	if username != "" {
		return slurm.NewClientForUser(username)
	}
	return slurm.NewClient()
}
