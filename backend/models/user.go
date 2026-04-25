package models

// User LDAP 用户模型
type User struct {
	Username           string   `json:"username" binding:"required"`
	UID                int      `json:"uid" binding:"required,min=1"`
	GID                int      `json:"gid" binding:"required,min=1"`
	CNName             string   `json:"cnName" binding:"required"`
	Email              string   `json:"email"`
	Phone              string   `json:"phone"`
	Shell              string   `json:"shell"`
	HomeDir            string   `json:"homeDir" binding:"required"`
	Password           string   `json:"password,omitempty"`
	Groups             []string `json:"groups"`
	IsAdmin            bool     `json:"isAdmin"`
	Disabled           bool     `json:"disabled"`
	PasswordMustChange bool     `json:"passwordMustChange"`
}

// Group LDAP 用户组模型
type Group struct {
	GroupName string   `json:"groupName" binding:"required"`
	GID       int      `json:"gid" binding:"required"`
	Members   []string `json:"members"`
}

// LoginRequest 登录请求
type LoginRequest struct {
	Username   string `json:"username" binding:"required"`
	Password   string `json:"password" binding:"required"`
	CaptchaID  string `json:"captchaId"`
	CaptchaVal string `json:"captchaVal"`
}

// LoginResponse 登录响应
type LoginResponse struct {
	Token string `json:"token"`
	User  *User  `json:"user"`
}

// PasswordReset 密码重置请求
type PasswordReset struct {
	NewPassword string `json:"newPassword" binding:"required,min=6"`
}

// ChangePassword 修改密码请求（需要旧密码）
type ChangePassword struct {
	OldPassword string `json:"oldPassword" binding:"required"`
	NewPassword string `json:"newPassword" binding:"required,min=6"`
}

// UpdateProfile 更新个人信息请求
type UpdateProfile struct {
	CNName string `json:"cnName"`
	Email  string `json:"email"`
	Phone  string `json:"phone"`
}

// UpdateUserRequest 更新用户请求（管理员用，字段均为可选）
type UpdateUserRequest struct {
	UID                int    `json:"uid"`
	GID                int    `json:"gid"`
	CNName             string `json:"cnName"`
	Email              string `json:"email"`
	Phone              string `json:"phone"`
	Shell              string `json:"shell"`
	HomeDir            string `json:"homeDir"`
	Disabled           bool   `json:"disabled"`
	PasswordMustChange bool   `json:"passwordMustChange"`
}
