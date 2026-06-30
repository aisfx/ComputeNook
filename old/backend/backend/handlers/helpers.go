package handlers

import (
	"fmt"
	"os"
	"hpc-backend/ldap"
	"hpc-backend/slurm"
)

// GetSlurmClientForUser 为当前用户创建Slurm客户端
func GetSlurmClientForUser(username string) (*slurm.Client, error) {
	if username != "" {
		return slurm.NewClientForUser(username)
	}
	return slurm.NewClient()
}

// GetSlurmAdminClient 使用管理员账户创建Slurm客户端
func GetSlurmAdminClient() (*slurm.Client, error) {
	adminUser := os.Getenv("SLURM_ADMIN_USER")
	if adminUser == "" {
		adminUser = "root"
	}
	return slurm.NewClientForUser(adminUser)
}

// ResolveUID 通过 LDAP 将用户名解析为 UID 字符串
// slurmdbd v0.0.43 要求传 UID 而非用户名
// 如果 LDAP 未配置或查询失败，直接返回用户名（兼容旧版本）
func ResolveUID(username string) string {
	if username == "" {
		return username
	}
	client, err := ldap.NewClient()
	if err != nil {
		return username
	}
	defer client.Close()
	user, err := client.GetUser(username)
	if err != nil || user.UID == 0 {
		return username
	}
	return fmt.Sprintf("%d", user.UID)
}
