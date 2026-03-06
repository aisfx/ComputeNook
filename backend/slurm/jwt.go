package slurm

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"hpc-backend/logger"
)

// JWTHeader JWT Header结构
type JWTHeader struct {
	Alg string `json:"alg"`
	Typ string `json:"typ"`
}

// JWTPayload JWT Payload结构
type JWTPayload struct {
	Exp int64  `json:"exp"` // 过期时间
	Iat int64  `json:"iat"` // 签发时间
	Sun string `json:"sun"` // 用户名
}

// GenerateSlurmToken 为指定用户生成Slurm REST API JWT token
func GenerateSlurmToken(username string) (string, error) {
	// 从环境变量获取JWT密钥
	secret := os.Getenv("SLURM_JWT_KEY")
	if secret == "" {
		return "", fmt.Errorf("SLURM_JWT_KEY not configured in .env file")
	}

	// 去除密钥中的空白字符
	secret = strings.TrimSpace(secret)
	
	logger.Info("========== GENERATING SLURM JWT TOKEN ==========")
	logger.Info("Username: %s", username)
	logger.Info("Secret length: %d bytes", len(secret))
	logger.Debug("Secret (first 20 chars): %s...", secret[:min(20, len(secret))])

	// 获取token有效期（默认24小时）
	lifespanStr := os.Getenv("SLURM_JWT_LIFESPAN")
	lifespan := int64(86400) // 默认24小时
	if lifespanStr != "" {
		if l, err := strconv.ParseInt(lifespanStr, 10, 64); err == nil {
			lifespan = l
		}
	}

	// 创建JWT Header
	header := JWTHeader{
		Alg: "HS256",
		Typ: "JWT",
	}

	// 创建JWT Payload
	now := time.Now().Unix()
	payload := JWTPayload{
		Iat: now,
		Exp: now + lifespan,
		Sun: username,
	}
	
	logger.Info("Token issued at: %d (%s)", now, time.Unix(now, 0).Format(time.RFC3339))
	logger.Info("Token expires at: %d (%s)", now+lifespan, time.Unix(now+lifespan, 0).Format(time.RFC3339))
	logger.Info("Token lifespan: %d seconds (%d hours)", lifespan, lifespan/3600)

	// 编码Header
	headerJSON, err := json.Marshal(header)
	if err != nil {
		return "", fmt.Errorf("failed to marshal header: %w", err)
	}
	headerB64 := base64.RawURLEncoding.EncodeToString(headerJSON)
	logger.Debug("Header (base64): %s", headerB64)

	// 编码Payload
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal payload: %w", err)
	}
	payloadB64 := base64.RawURLEncoding.EncodeToString(payloadJSON)
	logger.Debug("Payload (JSON): %s", string(payloadJSON))
	logger.Debug("Payload (base64): %s", payloadB64)

	// 创建签名
	message := headerB64 + "." + payloadB64
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(message))
	signature := base64.RawURLEncoding.EncodeToString(h.Sum(nil))
	logger.Debug("Signature (base64): %s", signature)

	// 生成完整的JWT token
	token := message + "." + signature

	logger.Info("✓ Token generated successfully")
	logger.Info("Token length: %d bytes", len(token))
	logger.Info("Token (first 50 chars): %s...", token[:min(50, len(token))])
	logger.Info("Token (last 50 chars): ...%s", token[max(0, len(token)-50):])
	logger.Info("================================================")

	return token, nil
}

// ValidateSlurmToken 验证Slurm JWT token是否有效
func ValidateSlurmToken(token string) (string, error) {
	// 分割token
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return "", fmt.Errorf("invalid token format")
	}

	// 解码payload
	payloadJSON, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", fmt.Errorf("failed to decode payload: %w", err)
	}

	var payload JWTPayload
	if err := json.Unmarshal(payloadJSON, &payload); err != nil {
		return "", fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	// 检查是否过期
	now := time.Now().Unix()
	if payload.Exp < now {
		return "", fmt.Errorf("token expired")
	}

	return payload.Sun, nil
}

// GetSlurmTokenForUser 获取用户的Slurm token（动态生成）
func GetSlurmTokenForUser(username string) (string, error) {
	// 检查是否配置了JWT密钥
	jwtKey := os.Getenv("SLURM_JWT_KEY")
	if jwtKey == "" || jwtKey == "your_jwt_hs256_key_here" {
		return "", fmt.Errorf("SLURM_JWT_KEY not configured in .env file. Please set the JWT key from /etc/slurm/jwt_hs256.key")
	}

	// 动态生成用户token
	token, err := GenerateSlurmToken(username)
	if err != nil {
		return "", fmt.Errorf("failed to generate Slurm token for user %s: %w", username, err)
	}
	
	logger.Info("Generated Slurm token for user: %s", username)
	return token, nil
}
