package handlers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"image/png"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
	"hpc-backend/models"
)

// ── MFA 存储（JSON 文件） ──────────────────────────────────────

var (
	mfaMu    sync.Mutex // 单一互斥锁，保护读写全程
	mfaCache map[string]*models.MFAUserRecord
)

func mfaStorePath() string {
	// 优先使用环境变量指定的路径，否则放在可执行文件同目录
	if p := os.Getenv("MFA_STORE_FILE"); p != "" {
		return p
	}
	// 兼容：如果当前目录有 .env，说明工作目录就是 backend/
	if _, err := os.Stat(".env"); err == nil {
		return "mfa_secrets.json"
	}
	// 否则尝试 backend/ 子目录
	if _, err := os.Stat(filepath.Join("backend", ".env")); err == nil {
		return filepath.Join("backend", "mfa_secrets.json")
	}
	return "mfa_secrets.json"
}

// loadMFAStore 加载 MFA 存储（调用方必须持有 mfaMu）
func loadMFAStore() map[string]*models.MFAUserRecord {
	if mfaCache != nil {
		return mfaCache
	}
	path := mfaStorePath()
	data, err := os.ReadFile(path)
	if err != nil {
		log.Printf("[MFA] store not found at %s, starting empty", path)
		mfaCache = map[string]*models.MFAUserRecord{}
		return mfaCache
	}
	var store map[string]*models.MFAUserRecord
	if err := json.Unmarshal(data, &store); err != nil {
		log.Printf("[MFA] store parse error: %v", err)
		mfaCache = map[string]*models.MFAUserRecord{}
		return mfaCache
	}
	log.Printf("[MFA] loaded store from %s, %d records", path, len(store))
	mfaCache = store
	return mfaCache
}

// saveMFAStore 持久化 MFA 存储（调用方必须持有 mfaMu）
func saveMFAStore() error {
	path := mfaStorePath()
	data, err := json.MarshalIndent(mfaCache, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(path, data, 0600); err != nil {
		return err
	}
	log.Printf("[MFA] store saved to %s, %d records", path, len(mfaCache))
	return nil
}

// GetMFAMode 读取系统 MFA 模式，自动去除行内注释和空格
func GetMFAMode() models.MFAMode {
	raw := os.Getenv("MFA_ENABLED")
	// 去掉行内注释（# 及之后的内容）和首尾空格
	if idx := strings.Index(raw, "#"); idx >= 0 {
		raw = raw[:idx]
	}
	mode := strings.TrimSpace(raw)
	log.Printf("[MFA] GetMFAMode: MFA_ENABLED raw=%q trimmed=%q", os.Getenv("MFA_ENABLED"), mode)
	switch models.MFAMode(mode) {
	case models.MFAModeGlobal, models.MFAModeOptional:
		return models.MFAMode(mode)
	default:
		return models.MFAModeDisabled
	}
}

// IsMFARequired 判断某用户登录时是否需要输入 TOTP code
func IsMFARequired(username string) bool {
	mode := GetMFAMode()
	if mode == models.MFAModeDisabled {
		log.Printf("[MFA] IsMFARequired(%s): mode=disabled -> false", username)
		return false
	}
	mfaMu.Lock()
	store := loadMFAStore()
	rec, ok := store[username]
	mfaMu.Unlock()

	if !ok || !rec.Confirmed || !rec.Enabled {
		log.Printf("[MFA] IsMFARequired(%s): not bound (ok=%v confirmed=%v enabled=%v) -> false",
			username, ok, ok && rec.Confirmed, ok && rec.Enabled)
		return false
	}
	log.Printf("[MFA] IsMFARequired(%s): bound and confirmed -> true", username)
	return true
}

// ── 临时 Token ────────────────────────────────────────────────

const mfaTempTokenDuration = 5 * time.Minute

func issueMFATempToken(username string) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"username": username,
		"mfa_step": true,
		"exp":      time.Now().Add(mfaTempTokenDuration).Unix(),
	})
	return token.SignedString([]byte(os.Getenv("JWT_SECRET")))
}

func parseMFATempToken(tokenStr string) (string, bool) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		return []byte(os.Getenv("JWT_SECRET")), nil
	})
	if err != nil || !token.Valid {
		log.Printf("[MFA] parseMFATempToken: invalid token: %v", err)
		return "", false
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", false
	}
	mfaStep, _ := claims["mfa_step"].(bool)
	if !mfaStep {
		log.Printf("[MFA] parseMFATempToken: not a mfa_step token")
		return "", false
	}
	username, _ := claims["username"].(string)
	return username, username != ""
}

// ── HTTP Handlers ─────────────────────────────────────────────

func GetMFAStatus(c *gin.Context) {
	username, _ := c.Get("username")
	mfaMu.Lock()
	store := loadMFAStore()
	rec := store[username.(string)]
	mfaMu.Unlock()

	resp := models.MFAStatusResponse{Mode: GetMFAMode()}
	if rec != nil {
		resp.Enabled = rec.Enabled
		resp.Confirmed = rec.Confirmed
	}
	c.JSON(http.StatusOK, gin.H{"data": resp})
}

// SetupMFA POST /api/mfa/setup — 用临时 token 认证
func SetupMFA(c *gin.Context) {
	tempToken := ""
	if auth := c.GetHeader("Authorization"); len(auth) > 7 {
		tempToken = auth[7:]
	}
	uname, ok := parseMFATempToken(tempToken)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "临时 token 无效或已过期"})
		return
	}
	log.Printf("[MFA] SetupMFA: generating secret for user=%s", uname)

	issuer := os.Getenv("MFA_ISSUER")
	if issuer == "" {
		issuer = "HPC Platform"
	}

	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      issuer,
		AccountName: uname,
		Algorithm:   otp.AlgorithmSHA1,
		Digits:      otp.DigitsSix,
		Period:      30,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "生成 MFA 密钥失败"})
		return
	}

	img, err := key.Image(400, 400)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "生成二维码失败"})
		return
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "编码二维码失败"})
		return
	}
	qrBase64 := "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes())

	mfaMu.Lock()
	store := loadMFAStore()
	store[uname] = &models.MFAUserRecord{
		Username:  uname,
		Secret:    key.Secret(),
		Enabled:   false,
		Confirmed: false,
	}
	err = saveMFAStore()
	mfaMu.Unlock()

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存 MFA 配置失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": models.MFASetupResponse{
		Secret:     key.Secret(),
		QRCode:     qrBase64,
		OtpauthUri: key.URL(),
		Issuer:     issuer,
		Account:    uname,
	}})
}

// ConfirmMFA POST /api/mfa/confirm — 用临时 token 认证
func ConfirmMFA(c *gin.Context) {
	tempToken := ""
	if auth := c.GetHeader("Authorization"); len(auth) > 7 {
		tempToken = auth[7:]
	}
	uname, ok := parseMFATempToken(tempToken)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "临时 token 无效或已过期"})
		return
	}
	log.Printf("[MFA] ConfirmMFA: user=%s", uname)

	var req models.MFAVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	mfaMu.Lock()
	defer mfaMu.Unlock()
	store := loadMFAStore()
	rec, exists := store[uname]
	if !exists || rec.Secret == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请先调用 /api/mfa/setup 生成密钥"})
		return
	}

	if !totp.Validate(req.Code, rec.Secret) {
		log.Printf("[MFA] ConfirmMFA: invalid code for user=%s", uname)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "验证码错误"})
		return
	}

	rec.Enabled = true
	rec.Confirmed = true
	if err := saveMFAStore(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存 MFA 配置失败: " + err.Error()})
		return
	}
	log.Printf("[MFA] ConfirmMFA: user=%s bound successfully", uname)
	c.JSON(http.StatusOK, gin.H{"message": "MFA 绑定成功"})
}

// DisableMFA DELETE /api/mfa
func DisableMFA(c *gin.Context) {
	username, _ := c.Get("username")
	uname := username.(string)

	var req models.MFAVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	mfaMu.Lock()
	defer mfaMu.Unlock()
	store := loadMFAStore()
	rec, ok := store[uname]
	if !ok || !rec.Confirmed {
		c.JSON(http.StatusBadRequest, gin.H{"error": "MFA 未启用"})
		return
	}
	if !totp.Validate(req.Code, rec.Secret) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "验证码错误"})
		return
	}
	delete(store, uname)
	if err := saveMFAStore(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存 MFA 配置失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "MFA 已禁用"})
}

// AdminResetMFA DELETE /api/mfa/admin/:username
func AdminResetMFA(c *gin.Context) {
	target := c.Param("username")
	mfaMu.Lock()
	defer mfaMu.Unlock()
	store := loadMFAStore()
	delete(store, target)
	if err := saveMFAStore(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存 MFA 配置失败"})
		return
	}
	log.Printf("[MFA] AdminResetMFA: reset MFA for user=%s", target)
	c.JSON(http.StatusOK, gin.H{"message": "已重置用户 MFA"})
}

// AdminListMFA GET /api/mfa/admin/list — 管理员查看所有用户 MFA 状态
func AdminListMFA(c *gin.Context) {
	mfaMu.Lock()
	store := loadMFAStore()
	mfaMu.Unlock()

	type item struct {
		Username  string `json:"username"`
		Enabled   bool   `json:"enabled"`
		Confirmed bool   `json:"confirmed"`
	}
	list := make([]item, 0, len(store))
	for _, rec := range store {
		list = append(list, item{
			Username:  rec.Username,
			Enabled:   rec.Enabled,
			Confirmed: rec.Confirmed,
		})
	}
	c.JSON(http.StatusOK, gin.H{"data": list, "mode": GetMFAMode()})
}

// VerifyMFALogin POST /api/mfa/verify-login
func VerifyMFALogin(c *gin.Context) {
	var req models.MFATempTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	username, ok := parseMFATempToken(req.TempToken)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "临时 token 无效或已过期"})
		return
	}
	log.Printf("[MFA] VerifyMFALogin: user=%s", username)

	mfaMu.Lock()
	store := loadMFAStore()
	rec, exists := store[username]
	mfaMu.Unlock()

	if !exists || rec.Secret == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "MFA 未绑定"})
		return
	}

	if !totp.Validate(req.Code, rec.Secret) {
		log.Printf("[MFA] VerifyMFALogin: invalid code for user=%s", username)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "验证码错误"})
		return
	}

	tokenStr, user, err := issueFullJWT(username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	log.Printf("[MFA] VerifyMFALogin: user=%s login success", username)
	c.JSON(http.StatusOK, models.LoginResponse{Token: tokenStr, User: user})
}

// ValidateTOTP 验证 TOTP code（供其他模块调用）
func ValidateTOTP(username, code string) bool {
	mfaMu.Lock()
	store := loadMFAStore()
	rec, ok := store[username]
	mfaMu.Unlock()
	if !ok || rec.Secret == "" {
		return false
	}
	return totp.Validate(code, rec.Secret)
}

