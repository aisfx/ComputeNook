package handlers

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

// APIDocumentation API 文档结构
type APIDocumentation struct {
	Title       string          `json:"title"`
	Version     string          `json:"version"`
	Description string          `json:"description"`
	BaseURL     string          `json:"baseUrl"`
	DevMode     bool            `json:"devMode"`
	Endpoints   []APIEndpoint   `json:"endpoints"`
}

// APIEndpoint API 端点结构
type APIEndpoint struct {
	Method      string            `json:"method"`
	Path        string            `json:"path"`
	Description string            `json:"description"`
	Auth        string            `json:"auth"`
	Request     interface{}       `json:"request,omitempty"`
	Response    interface{}       `json:"response,omitempty"`
	Example     string            `json:"example,omitempty"`
}

// GetAPIDocs 获取 API 文档
func GetAPIDocs(c *gin.Context) {
	devMode := os.Getenv("DEV_MODE") == "true"
	
	docs := APIDocumentation{
		Title:       "HPC 管理平台 API",
		Version:     "1.0.0",
		Description: "基于 LDAP 的 HPC 用户管理 API",
		BaseURL:     "http://localhost:8080/api",
		DevMode:     devMode,
		Endpoints: []APIEndpoint{
			// 认证相关
			{
				Method:      "POST",
				Path:        "/login",
				Description: "用户登录",
				Auth:        "无需认证",
				Request: map[string]interface{}{
					"username": "用户名",
					"password": "密码",
				},
				Response: map[string]interface{}{
					"token": "JWT Token",
					"user": map[string]interface{}{
						"username": "用户名",
						"uid":      "用户ID",
						"cnName":   "中文名",
						"isAdmin":  "是否管理员",
					},
				},
				Example: `curl -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'`,
			},
			{
				Method:      "GET",
				Path:        "/me",
				Description: "获取当前用户信息",
				Auth:        "需要 JWT Token",
				Response: map[string]interface{}{
					"data": map[string]interface{}{
						"username": "用户名",
						"uid":      "用户ID",
						"gid":      "组ID",
						"cnName":   "中文名",
						"email":    "邮箱",
						"phone":    "电话",
						"shell":    "Shell",
						"homeDir":  "家目录",
						"isAdmin":  "是否管理员",
					},
				},
				Example: `curl http://localhost:8080/api/me \
  -H "Authorization: Bearer YOUR_TOKEN"`,
			},
			
			// 用户管理
			{
				Method:      "GET",
				Path:        "/users",
				Description: "获取所有用户",
				Auth:        "需要管理员权限",
				Response: map[string]interface{}{
					"data": []map[string]interface{}{
						{
							"username": "用户名",
							"uid":      "用户ID",
							"gid":      "组ID",
							"cnName":   "中文名",
							"email":    "邮箱",
							"phone":    "电话",
							"shell":    "Shell",
							"homeDir":  "家目录",
							"isAdmin":  "是否管理员",
						},
					},
				},
				Example: `curl http://localhost:8080/api/users`,
			},
			{
				Method:      "GET",
				Path:        "/users/:username",
				Description: "获取单个用户",
				Auth:        "需要管理员权限",
				Response: map[string]interface{}{
					"data": map[string]interface{}{
						"username": "用户名",
						"uid":      "用户ID",
						"gid":      "组ID",
						"cnName":   "中文名",
					},
				},
				Example: `curl http://localhost:8080/api/users/admin`,
			},
			{
				Method:      "POST",
				Path:        "/users",
				Description: "创建用户",
				Auth:        "需要管理员权限",
				Request: map[string]interface{}{
					"username": "用户名 (必需)",
					"uid":      "用户ID (必需)",
					"gid":      "组ID (必需)",
					"cnName":   "中文名 (必需)",
					"email":    "邮箱",
					"phone":    "电话",
					"shell":    "Shell (默认 /bin/bash)",
					"homeDir":  "家目录 (必需)",
					"password": "密码 (必需)",
				},
				Response: map[string]interface{}{
					"message": "User created successfully",
					"data":    "用户信息",
				},
				Example: `curl -X POST http://localhost:8080/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test",
    "uid": 10001,
    "gid": 10001,
    "cnName": "测试用户",
    "email": "test@example.com",
    "phone": "13800138000",
    "shell": "/bin/bash",
    "homeDir": "/home/test",
    "password": "test123"
  }'`,
			},
			{
				Method:      "PUT",
				Path:        "/users/:username",
				Description: "更新用户",
				Auth:        "需要管理员权限",
				Request: map[string]interface{}{
					"uid":     "用户ID",
					"gid":     "组ID",
					"cnName":  "中文名",
					"email":   "邮箱",
					"phone":   "电话",
					"shell":   "Shell",
					"homeDir": "家目录",
				},
				Response: map[string]interface{}{
					"message": "User updated successfully",
				},
				Example: `curl -X PUT http://localhost:8080/api/users/test \
  -H "Content-Type: application/json" \
  -d '{"cnName":"新名字","email":"new@example.com"}'`,
			},
			{
				Method:      "DELETE",
				Path:        "/users/:username",
				Description: "删除用户",
				Auth:        "需要管理员权限",
				Response: map[string]interface{}{
					"message": "User deleted successfully",
				},
				Example: `curl -X DELETE http://localhost:8080/api/users/test`,
			},
			{
				Method:      "POST",
				Path:        "/users/:username/reset-password",
				Description: "重置用户密码",
				Auth:        "需要管理员权限",
				Request: map[string]interface{}{
					"newPassword": "新密码 (至少6个字符)",
				},
				Response: map[string]interface{}{
					"message": "Password reset successfully",
				},
				Example: `curl -X POST http://localhost:8080/api/users/test/reset-password \
  -H "Content-Type: application/json" \
  -d '{"newPassword":"newpass123"}'`,
			},
			
			// 用户组管理
			{
				Method:      "GET",
				Path:        "/groups",
				Description: "获取所有用户组",
				Auth:        "需要管理员权限",
				Response: map[string]interface{}{
					"data": []map[string]interface{}{
						{
							"groupName": "组名",
							"gid":       "组ID",
							"members":   []string{"成员列表"},
						},
					},
				},
				Example: `curl http://localhost:8080/api/groups`,
			},
			{
				Method:      "GET",
				Path:        "/groups/:gid",
				Description: "获取单个用户组",
				Auth:        "需要管理员权限",
				Response: map[string]interface{}{
					"data": map[string]interface{}{
						"groupName": "组名",
						"gid":       "组ID",
						"members":   []string{"成员列表"},
					},
				},
				Example: `curl http://localhost:8080/api/groups/1000`,
			},
			{
				Method:      "POST",
				Path:        "/groups",
				Description: "创建用户组",
				Auth:        "需要管理员权限",
				Request: map[string]interface{}{
					"groupName": "组名 (必需)",
					"gid":       "组ID (必需)",
					"members":   []string{"成员列表"},
				},
				Response: map[string]interface{}{
					"message": "Group created successfully",
					"data":    "用户组信息",
				},
				Example: `curl -X POST http://localhost:8080/api/groups \
  -H "Content-Type: application/json" \
  -d '{
    "groupName": "developers",
    "gid": 2001,
    "members": ["user1", "user2"]
  }'`,
			},
			{
				Method:      "PUT",
				Path:        "/groups/:gid",
				Description: "更新用户组",
				Auth:        "需要管理员权限",
				Request: map[string]interface{}{
					"groupName": "组名",
					"gid":       "组ID",
					"members":   []string{"成员列表"},
				},
				Response: map[string]interface{}{
					"message": "Group updated successfully",
				},
				Example: `curl -X PUT http://localhost:8080/api/groups/2001 \
  -H "Content-Type: application/json" \
  -d '{"members":["user1","user2","user3"]}'`,
			},
			{
				Method:      "DELETE",
				Path:        "/groups/:gid",
				Description: "删除用户组",
				Auth:        "需要管理员权限",
				Response: map[string]interface{}{
					"message": "Group deleted successfully",
				},
				Example: `curl -X DELETE http://localhost:8080/api/groups/2001`,
			},

			// Slurm 账户管理
			{
				Method:      "GET",
				Path:        "/accounts",
				Description: "获取所有 Slurm 账户",
				Auth:        "需要管理员权限",
				Response: map[string]interface{}{
					"data": []map[string]interface{}{
						{
							"name":         "账户名",
							"description":  "描述",
							"organization": "组织",
							"coordinators": []string{"协调员列表"},
						},
					},
				},
				Example: `curl http://localhost:8080/api/accounts`,
			},
			{
				Method:      "GET",
				Path:        "/accounts/:name",
				Description: "获取单个 Slurm 账户",
				Auth:        "需要管理员权限",
				Response: map[string]interface{}{
					"data": map[string]interface{}{
						"name":         "账户名",
						"description":  "描述",
						"organization": "组织",
						"coordinators": []string{"协调员列表"},
					},
				},
				Example: `curl http://localhost:8080/api/accounts/default`,
			},
			{
				Method:      "POST",
				Path:        "/accounts",
				Description: "创建 Slurm 账户",
				Auth:        "需要管理员权限",
				Request: map[string]interface{}{
					"name":         "账户名 (必需)",
					"description":  "描述",
					"organization": "组织",
					"coordinators": []string{"协调员列表"},
				},
				Response: map[string]interface{}{
					"message": "Account created successfully",
					"data":    "账户信息",
				},
				Example: `curl -X POST http://localhost:8080/api/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "research",
    "description": "研究账户",
    "organization": "Research Dept",
    "coordinators": ["admin"]
  }'`,
			},
			{
				Method:      "PUT",
				Path:        "/accounts/:name",
				Description: "更新 Slurm 账户",
				Auth:        "需要管理员权限",
				Request: map[string]interface{}{
					"description":  "描述",
					"organization": "组织",
					"coordinators": []string{"协调员列表"},
				},
				Response: map[string]interface{}{
					"message": "Account updated successfully",
				},
				Example: `curl -X PUT http://localhost:8080/api/accounts/research \
  -H "Content-Type: application/json" \
  -d '{"description":"更新的描述"}'`,
			},
			{
				Method:      "DELETE",
				Path:        "/accounts/:name",
				Description: "删除 Slurm 账户",
				Auth:        "需要管理员权限",
				Response: map[string]interface{}{
					"message": "Account deleted successfully",
				},
				Example: `curl -X DELETE http://localhost:8080/api/accounts/research`,
			},

			// Slurm 关联管理
			{
				Method:      "GET",
				Path:        "/associations",
				Description: "获取所有 Slurm 关联",
				Auth:        "需要管理员权限",
				Response: map[string]interface{}{
					"data": []map[string]interface{}{
						{
							"account":   "账户名",
							"user":      "用户名",
							"partition": "分区",
							"cluster":   "集群",
							"qos":       "默认 QoS",
							"qos_list":  "可用 QoS 列表",
							"max_jobs":  "最大作业数",
							"priority":  "优先级",
						},
					},
				},
				Example: `curl http://localhost:8080/api/associations`,
			},
			{
				Method:      "GET",
				Path:        "/associations/user/:username",
				Description: "获取用户的 Slurm 关联",
				Auth:        "需要管理员权限",
				Response: map[string]interface{}{
					"data": []map[string]interface{}{
						{
							"account":  "账户名",
							"user":     "用户名",
							"qos":      "默认 QoS",
							"qos_list": "可用 QoS 列表",
						},
					},
				},
				Example: `curl http://localhost:8080/api/associations/user/user1`,
			},
			{
				Method:      "POST",
				Path:        "/associations",
				Description: "创建 Slurm 关联",
				Auth:        "需要管理员权限",
				Request: map[string]interface{}{
					"account":   "账户名 (必需)",
					"user":      "用户名 (必需)",
					"cluster":   "集群名 (必需)",
					"partition": "分区",
					"qos":       "默认 QoS",
					"qos_list":  "可用 QoS 列表",
					"max_jobs":  "最大作业数",
					"priority":  "优先级",
				},
				Response: map[string]interface{}{
					"message": "Association created successfully",
					"data":    "关联信息",
				},
				Example: `curl -X POST http://localhost:8080/api/associations \
  -H "Content-Type: application/json" \
  -d '{
    "account": "default",
    "user": "user1",
    "cluster": "cluster",
    "qos": "normal",
    "qos_list": "normal,high",
    "max_jobs": 100
  }'`,
			},
			{
				Method:      "DELETE",
				Path:        "/associations",
				Description: "删除 Slurm 关联",
				Auth:        "需要管理员权限",
				Request: map[string]interface{}{
					"cluster":   "集群名 (必需)",
					"account":   "账户名 (必需)",
					"user":      "用户名 (必需)",
					"partition": "分区",
				},
				Response: map[string]interface{}{
					"message": "Association deleted successfully",
				},
				Example: `curl -X DELETE "http://localhost:8080/api/associations?cluster=cluster&account=default&user=user1"`,
			},

			// Slurm QoS 管理
			{
				Method:      "GET",
				Path:        "/qos",
				Description: "获取所有 Slurm QoS",
				Auth:        "需要管理员权限",
				Response: map[string]interface{}{
					"data": []map[string]interface{}{
						{
							"name":        "QoS 名称",
							"description": "描述",
							"priority":    "优先级",
							"max_jobs":    "每用户最大作业数",
							"max_wall":    "每作业最大运行时间（分钟）",
						},
					},
				},
				Example: `curl http://localhost:8080/api/qos`,
			},
			{
				Method:      "GET",
				Path:        "/qos/:name",
				Description: "获取单个 Slurm QoS",
				Auth:        "需要管理员权限",
				Response: map[string]interface{}{
					"data": map[string]interface{}{
						"name":        "QoS 名称",
						"description": "描述",
						"priority":    "优先级",
						"max_jobs":    "每用户最大作业数",
						"max_wall":    "每作业最大运行时间（分钟）",
					},
				},
				Example: `curl http://localhost:8080/api/qos/normal`,
			},
			{
				Method:      "POST",
				Path:        "/qos",
				Description: "创建 Slurm QoS",
				Auth:        "需要管理员权限",
				Request: map[string]interface{}{
					"name":        "QoS 名称 (必需)",
					"description": "描述",
					"priority":    "优先级",
					"max_jobs":    "每用户最大作业数",
					"max_submit":  "每用户最大提交数",
					"max_wall":    "每作业最大运行时间（分钟）",
				},
				Response: map[string]interface{}{
					"message": "QoS created successfully",
					"data":    "QoS 信息",
				},
				Example: `curl -X POST http://localhost:8080/api/qos \
  -H "Content-Type: application/json" \
  -d '{
    "name": "high",
    "description": "高优先级",
    "priority": 200,
    "max_jobs": 50,
    "max_wall": 2880
  }'`,
			},
			{
				Method:      "PUT",
				Path:        "/qos/:name",
				Description: "更新 Slurm QoS",
				Auth:        "需要管理员权限",
				Request: map[string]interface{}{
					"description": "描述",
					"priority":    "优先级",
					"max_jobs":    "每用户最大作业数",
					"max_wall":    "每作业最大运行时间（分钟）",
				},
				Response: map[string]interface{}{
					"message": "QoS updated successfully",
				},
				Example: `curl -X PUT http://localhost:8080/api/qos/high \
  -H "Content-Type: application/json" \
  -d '{"priority":250}'`,
			},
			{
				Method:      "DELETE",
				Path:        "/qos/:name",
				Description: "删除 Slurm QoS",
				Auth:        "需要管理员权限",
				Response: map[string]interface{}{
					"message": "QoS deleted successfully",
				},
				Example: `curl -X DELETE http://localhost:8080/api/qos/high`,
			},
		},
	}

	// 根据请求的 Accept 头返回不同格式
	accept := c.GetHeader("Accept")
	if accept == "text/html" || c.Query("format") == "html" {
		c.HTML(http.StatusOK, "api_docs.html", docs)
	} else {
		c.JSON(http.StatusOK, docs)
	}
}
