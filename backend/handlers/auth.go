package handlers

import (
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"hpc-backend/ldap"
	"hpc-backend/middleware"
	"hpc-backend/models"
)

// issueFullJWT 根据用户名从 LDAP 获取用户信息并颁发正式 JWT
// 供 Login（无 MFA 时）和 VerifyMFALogin（MFA 第二步）共用
func issueFullJWT(username string) (string, *models.User, error) {
	// 开发模式
	if os.Getenv("DEV_MODE") == "true" {
		user := &models.User{
			Username: username,
			UID:      1000,
			GID:      1000,
			CNName:   username,
			IsAdmin:  username == "admin",
		}
		tokenStr, err := signJWT(user)
		return tokenStr, user, err
	}

	client, err := ldap.NewClient()
	if err != nil {
		return "", nil, err
	}
	defer client.Close()

	user, err := client.GetUser(username)
	if err != nil {
		return "", nil, err
	}
	user.Password = ""

	tokenStr, err := signJWT(user)
	return tokenStr, user, err
}

func signJWT(user *models.User) (string, error) {
	// 从环境变量读取有效期，默认 4 小时（安全最佳实践）
	expHours := 4
	if v := os.Getenv("JWT_EXPIRE_HOURS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 24 {
			expHours = n
		}
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"username": user.Username,
		"uid":      user.UID,
		"isAdmin":  user.IsAdmin,
		"iss":      "hpc-platform",           // issuer，防止跨系统 token 复用
		"aud":      "hpc-platform-api",       // audience
		"exp":      time.Now().Add(time.Duration(expHours) * time.Hour).Unix(),
		"iat":      time.Now().Unix(),         // issued at
	})
	return token.SignedString([]byte(os.Getenv("JWT_SECRET")))
}

// Login 用户登录
func Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 检查账户是否被锁定
	if locked, remaining := isAccountLocked(req.Username); locked {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":       "账户已被锁定，请稍后再试",
			"code":        "ACCOUNT_LOCKED",
			"retryAfter":  remaining,
		})
		return
	}

	// 失败次数 >= 1 时要求验证码
	failCount := getFailCount(req.Username)
	if failCount >= 1 {
		if !validateCaptcha(req.CaptchaID, req.CaptchaVal) {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":          "验证码错误或已过期",
				"code":           "CAPTCHA_REQUIRED",
				"requireCaptcha": true,
			})
			return
		}
	}

	// 开发模式：允许任何用户名密码登录
	if os.Getenv("DEV_MODE") == "true" {
		user := &models.User{
			Username: req.Username,
			UID:      1000,
			GID:      1000,
			CNName:   req.Username,
			IsAdmin:  req.Username == "admin",
		}
		log.Printf("DEV MODE: User %s logged in (isAdmin: %v)", user.Username, user.IsAdmin)
		resetLoginFailure(req.Username)
		respondAfterPasswordOK(c, user)
		return
	}

	// 生产模式：使用 LDAP 认证
	client, err := ldap.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "认证服务暂时不可用"})
		return
	}
	defer client.Close()

	user, err := client.Authenticate(req.Username, req.Password)
	if err != nil {
		recordLoginFailure(req.Username)
		newFail := getFailCount(req.Username)
		// 检查是否刚触发锁定
		if locked, remaining := isAccountLocked(req.Username); locked {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":          "账户已被锁定，请稍后再试",
				"code":           "ACCOUNT_LOCKED",
				"retryAfter":     remaining,
				"requireCaptcha": true,
			})
			return
		}
		remaining := lockMaxAttempts - newFail
		if remaining < 0 {
			remaining = 0
		}
		resp := gin.H{
			"error":          "用户名或密码错误",
			"requireCaptcha": newFail >= 1,
			"attemptsLeft":   remaining,
		}
		c.JSON(http.StatusUnauthorized, resp)
		return
	}

	if user.Disabled {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
		return
	}

	resetLoginFailure(req.Username)
	user.Password = ""
	respondAfterPasswordOK(c, user)
}

// respondAfterPasswordOK 密码验证通过后，根据 MFA 状态决定返回临时 token 还是正式 JWT
func respondAfterPasswordOK(c *gin.Context, user *models.User) {
	mode := GetMFAMode()

	// global 模式：用户未完成 MFA 绑定时，仍需引导其完成绑定
	// optional 模式：用户已启用 MFA 时需要验证
	if IsMFARequired(user.Username) {
		tempToken, err := issueMFATempToken(user.Username)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "生成临时 token 失败"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"mfaRequired": true,
			"tempToken":   tempToken,
		})
		return
	}

	// global 模式下用户尚未绑定 MFA：引导绑定（颁发临时 token，前端跳转绑定页）
	if mode == models.MFAModeGlobal {
		tempToken, err := issueMFATempToken(user.Username)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "生成临时 token 失败"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"mfaRequired": true,
			"mfaSetup":    true, // 前端据此跳转到绑定页面
			"tempToken":   tempToken,
		})
		return
	}

	// 不需要 MFA，直接颁发正式 JWT
	tokenStr, err := signJWT(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}
	c.JSON(http.StatusOK, models.LoginResponse{Token: tokenStr, User: user})
}

// GetCurrentUser 获取当前用户信息
func GetCurrentUser(c *gin.Context) {
	username, _ := c.Get("username")
	uid, _ := c.Get("uid")
	isAdmin, _ := c.Get("isAdmin")

	log.Printf("GetCurrentUser: username=%v, uid=%v, isAdmin=%v", username, uid, isAdmin)

	// 尝试从 LDAP 获取完整用户信息
	client, err := ldap.NewClient()
	if err != nil {
		log.Printf("GetCurrentUser: Failed to connect to LDAP: %v", err)
		// 如果 LDAP 连接失败，返回基本信息
		c.JSON(http.StatusOK, gin.H{
			"data": models.User{
				Username: username.(string),
				UID:      uid.(int),
				CNName:   username.(string),
				IsAdmin:  isAdmin.(bool),
			},
		})
		return
	}
	defer client.Close()

	user, err := client.GetUser(username.(string))
	if err != nil {
		log.Printf("GetCurrentUser: Failed to get user from LDAP: %v", err)
		// 如果用户不存在于 LDAP，返回基本信息
		c.JSON(http.StatusOK, gin.H{
			"data": models.User{
				Username: username.(string),
				UID:      uid.(int),
				CNName:   username.(string),
				IsAdmin:  isAdmin.(bool),
			},
		})
		return
	}

	log.Printf("GetCurrentUser: Successfully retrieved user: %s", user.Username)
	// 清除敏感字段再返回
	user.Password = ""
	user.HomeDir = ""
	c.JSON(http.StatusOK, gin.H{"data": user})
}

// Logout 登出：将当前 token 加入黑名单，使所有持有该 token 的客户端（含 SSH 隧道）立即失效
func Logout(c *gin.Context) {
	tokenString := ""
	authHeader := c.GetHeader("Authorization")
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		tokenString = authHeader[7:]
	}
	if tokenString == "" {
		c.JSON(http.StatusOK, gin.H{"message": "已登出"})
		return
	}

	// 解析 token 获取过期时间，用于黑名单自动清理
	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		return []byte(os.Getenv("JWT_SECRET")), nil
	})
	expiry := time.Now().Add(25 * time.Hour) // 默认 25h，比 token 有效期略长
	if err == nil {
		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			if exp, ok := claims["exp"].(float64); ok {
				expiry = time.Unix(int64(exp), 0)
			}
		}
	}

	middleware.RevokeToken(tokenString, expiry)
	log.Printf("Logout: token revoked for user session")
	c.JSON(http.StatusOK, gin.H{"message": "已登出"})
}

