package cache

import "fmt"

// 缓存Key前缀常量
const (
	PrefixUser        = "user:"
	PrefixGroup       = "group:"
	PrefixDashboard   = "dashboard:"
	PrefixNode        = "node:"
	PrefixQoS         = "qos:"
	PrefixUsage       = "usage:"
	PrefixQuota       = "quota:"
	PrefixLoginFail   = "login:fail:"
	PrefixAccountLock = "account:lock:"
	PrefixCaptcha     = "captcha:"
	PrefixMFAToken    = "mfa:token:"
	PrefixJob         = "job:"
	PrefixPartition   = "partition:"
	PrefixSlurmAccount= "slurm:account:"
	PrefixSlurmUser   = "slurm:user:"
	PrefixAssociation = "slurm:assoc:"
	PrefixReport      = "report:"
)

// UserKey 用户信息缓存Key
func UserKey(username string) string {
	return fmt.Sprintf("%s%s", PrefixUser, username)
}

// UserListKey 用户列表缓存Key
func UserListKey() string {
	return PrefixUser + "list"
}

// GroupKey 用户组缓存Key
func GroupKey(gid string) string {
	return fmt.Sprintf("%s%s", PrefixGroup, gid)
}

// GroupListKey 用户组列表缓存Key
func GroupListKey() string {
	return PrefixGroup + "list"
}

// DashboardStatsKey Dashboard统计缓存Key
func DashboardStatsKey() string {
	return PrefixDashboard + "stats"
}

// DashboardNodesKey Dashboard节点列表缓存Key
func DashboardNodesKey() string {
	return PrefixDashboard + "nodes"
}

// NodeListKey 节点列表缓存Key
func NodeListKey() string {
	return PrefixNode + "list"
}

// NodeMetricsKey 节点监控指标缓存Key
func NodeMetricsKey(nodeName string) string {
	return fmt.Sprintf("%smetrics:%s", PrefixNode, nodeName)
}

// QoSListKey QoS列表缓存Key
func QoSListKey() string {
	return PrefixQoS + "list"
}

// QoSKey 单个QoS缓存Key
func QoSKey(name string) string {
	return fmt.Sprintf("%s%s", PrefixQoS, name)
}

// UsageKey 机时使用量缓存Key
func UsageKey(account, startDate, endDate string) string {
	return fmt.Sprintf("%saccount:%s:%s:%s", PrefixUsage, account, startDate, endDate)
}

// UserUsageKey 用户机时使用量缓存Key
func UserUsageKey(username, startDate, endDate string) string {
	return fmt.Sprintf("%suser:%s:%s:%s", PrefixUsage, username, startDate, endDate)
}

// QuotaKey 配额信息缓存Key
func QuotaKey(username string) string {
	return fmt.Sprintf("%s%s", PrefixQuota, username)
}

// AllQuotasKey 所有配额列表缓存Key
func AllQuotasKey() string {
	return PrefixQuota + "all"
}

// LoginFailKey 登录失败计数Key
func LoginFailKey(username string) string {
	return fmt.Sprintf("%s%s", PrefixLoginFail, username)
}

// AccountLockKey 账户锁定Key
func AccountLockKey(username string) string {
	return fmt.Sprintf("%s%s", PrefixAccountLock, username)
}

// CaptchaKey 验证码Key
func CaptchaKey(captchaID string) string {
	return fmt.Sprintf("%s%s", PrefixCaptcha, captchaID)
}

// MFATokenKey MFA临时Token Key
func MFATokenKey(token string) string {
	return fmt.Sprintf("%s%s", PrefixMFAToken, token)
}

// JobListKey 作业列表缓存Key
func JobListKey(username string) string {
	if username == "" {
		return PrefixJob + "list:all"
	}
	return fmt.Sprintf("%slist:%s", PrefixJob, username)
}

// JobKey 单个作业缓存Key
func JobKey(jobID string) string {
	return fmt.Sprintf("%s%s", PrefixJob, jobID)
}

// PartitionListKey 分区列表缓存Key
func PartitionListKey() string {
	return PrefixPartition + "list"
}

// SlurmAccountKey Slurm账户缓存Key
func SlurmAccountKey(name string) string {
	return fmt.Sprintf("%s%s", PrefixSlurmAccount, name)
}

// SlurmAccountListKey Slurm账户列表缓存Key
func SlurmAccountListKey() string {
	return PrefixSlurmAccount + "list"
}

// SlurmUserKey Slurm用户缓存Key
func SlurmUserKey(name string) string {
	return fmt.Sprintf("%s%s", PrefixSlurmUser, name)
}

// SlurmUserListKey Slurm用户列表缓存Key
func SlurmUserListKey() string {
	return PrefixSlurmUser + "list"
}

// AssociationListKey 资源绑定列表缓存Key
func AssociationListKey() string {
	return PrefixAssociation + "list"
}

// ReportKey 报表数据缓存Key
func ReportKey(reportType, startDate, endDate string) string {
	return fmt.Sprintf("%s%s:%s:%s", PrefixReport, reportType, startDate, endDate)
}
