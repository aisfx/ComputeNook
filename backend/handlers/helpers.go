package handlers

import (
	"os"
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

// GetSlurmAdminClient 使用管理员账户创建Slurm客户端
// 用于需要管理员权限的写操作（创建/更新/删除账户、用户等）
func GetSlurmAdminClient() (*slurm.Client, error) {
	adminUser := os.Getenv("SLURM_ADMIN_USER")
	if adminUser == "" {
		adminUser = "root"
	}
	return slurm.NewClientForUser(adminUser)
}
