package models

// MFAMode MFA 启用模式
// global  - 全局强制，所有用户必须使用 MFA
// optional - 可选，用户自行决定是否启用
// false   - 关闭，不使用 MFA
type MFAMode string

const (
	MFAModeGlobal   MFAMode = "global"
	MFAModeOptional MFAMode = "optional"
	MFAModeDisabled MFAMode = "false"
)

// MFAUserRecord 单个用户的 MFA 配置，持久化到 JSON 文件
type MFAUserRecord struct {
	Username  string `json:"username"`
	Secret    string `json:"secret"`    // TOTP 密钥（base32）
	Enabled   bool   `json:"enabled"`   // 用户是否已启用 MFA
	Confirmed bool   `json:"confirmed"` // 是否已完成首次验证（绑定确认）
}

// MFASetupResponse 返回给前端的 MFA 绑定信息
type MFASetupResponse struct {
	Secret      string `json:"secret"`      // base32 密钥，供手动输入
	QRCode      string `json:"qrCode"`      // data:image/png;base64,... 二维码（备用）
	OtpauthUri  string `json:"otpauthUri"`  // otpauth:// URI，前端自行渲染二维码
	Issuer      string `json:"issuer"`
	Account     string `json:"account"`
}

// MFAVerifyRequest 验证 TOTP code
type MFAVerifyRequest struct {
	Code string `json:"code" binding:"required"`
}

// MFATempTokenRequest 第二步登录：用临时 token + TOTP code 换正式 JWT
type MFATempTokenRequest struct {
	TempToken string `json:"tempToken" binding:"required"`
	Code      string `json:"code" binding:"required"`
}

// MFAStatusResponse 返回当前用户 MFA 状态
type MFAStatusResponse struct {
	Enabled   bool    `json:"enabled"`
	Confirmed bool    `json:"confirmed"`
	Mode      MFAMode `json:"mode"` // 系统当前模式
}
