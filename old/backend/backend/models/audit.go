package models

import "time"

// AuditLog 审计日志
type AuditLog struct {
	ID          int64     `json:"id"`
	Timestamp   time.Time `json:"timestamp"`    // 操作时间
	Username    string    `json:"username"`     // 操作用户
	UserRole    string    `json:"user_role"`    // 用户角色
	Action      string    `json:"action"`       // 操作类型
	Resource    string    `json:"resource"`     // 资源类型
	ResourceID  string    `json:"resource_id"`  // 资源ID
	Details     string    `json:"details"`      // 操作详情
	IPAddress   string    `json:"ip_address"`   // 客户端 IP
	AccessHost  string    `json:"access_host"`  // 访问的域名/地址（Host 头）
	UserAgent   string    `json:"user_agent"`   // 用户代理
	Status      string    `json:"status"`       // 操作状态: success, failed
	ErrorMsg    string    `json:"error_msg"`    // 错误信息（如果失败）
	Duration    int64     `json:"duration"`     // 操作耗时（毫秒）
}

// 操作类型常量
const (
	ActionCreate   = "create"
	ActionUpdate   = "update"
	ActionDelete   = "delete"
	ActionRead     = "read"
	ActionLogin    = "login"
	ActionLogout   = "logout"
	ActionExport   = "export"
	ActionPageView = "page_view"
)

// 资源类型常量
const (
	ResourceUser        = "user"
	ResourceGroup       = "group"
	ResourceAccount     = "account"
	ResourceAssociation = "association"
	ResourceQoS         = "qos"
	ResourceJob         = "job"
	ResourceFile        = "file"
)

// 状态常量
const (
	StatusSuccess = "success"
	StatusFailed  = "failed"
)
