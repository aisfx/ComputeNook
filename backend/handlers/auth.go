package handlers

import (
	"log"
	"net/http"
	"os"
	"time"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"hpc-backend/ldap"
	"hpc-backend/middleware"
	"hpc-backend/models"
)

// Login 用户登录
func Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 开发模式：允许任何用户名密码登录
	if os.Getenv("DEV_MODE") == "true" {
		// 创建模拟用户
		user := &models.User{
			Username: req.Username,
			UID:      1000,
			GID:      1000,
			CNName:   req.Username,
			IsAdmin:  req.Username == "admin", // admin用户是管理员
		}

		// 生成 JWT Token
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"username": user.Username,
			"uid":      user.UID,
			"isAdmin":  user.IsAdmin,
			"exp":      time.Now().Add(time.Hour * 24).Unix(),
		})

		tokenString, err := token.SignedString([]byte(os.Getenv("JWT_SECRET")))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
			return
		}

		log.Printf("DEV MODE: User %s logged in (isAdmin: %v)", user.Username, user.IsAdmin)
		c.JSON(http.StatusOK, models.LoginResponse{
			Token: tokenString,
			User:  user,
		})
		return
	}

	// 生产模式：使用LDAP认证
	// 创建 LDAP 客户端
	client, err := ldap.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to LDAP: " + err.Error()})
		return
	}
	defer client.Close()

	// 验证用户
	user, err := client.Authenticate(req.Username, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
		return
	}

	// 检查用户是否被禁用
	if user.Disabled {
		c.JSON(http.StatusForbidden, gin.H{"error": "账户已被禁用，请联系管理员"})
		return
	}

	// 检查是否需要强制修改密码
	// 如果 passwordMustChange 为 true，仍然允许登录，但前端会强制跳转到修改密码页面
	// 这样用户可以获得 token 来调用修改密码的 API

	// 生成 JWT Token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"username": user.Username,
		"uid":      user.UID,
		"isAdmin":  user.IsAdmin,
		"exp":      time.Now().Add(time.Hour * 24).Unix(),
	})

	tokenString, err := token.SignedString([]byte(os.Getenv("JWT_SECRET")))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	// 不返回密码
	user.Password = ""

	c.JSON(http.StatusOK, models.LoginResponse{
		Token: tokenString,
		User:  user,
	})
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

// DebugIP 调试接口：显示后端收到的所有 IP 相关请求头（仅开发/排查用）
// GET /api/debug/ip
func DebugIP(c *gin.Context) {
	remoteIP := c.Request.RemoteAddr
	info := map[string]string{
		"remote_addr":       remoteIP,
		"x_real_ip":         c.GetHeader("X-Real-IP"),
		"x_forwarded_for":   c.GetHeader("X-Forwarded-For"),
		"x_forwarded_proto": c.GetHeader("X-Forwarded-Proto"),
		"x_forwarded_host":  c.GetHeader("X-Forwarded-Host"),
		"cf_connecting_ip":  c.GetHeader("CF-Connecting-IP"),
		"true_client_ip":    c.GetHeader("True-Client-IP"),
		"origin":            c.GetHeader("Origin"),
		"referer":           c.GetHeader("Referer"),
		"host":              c.Request.Host,
		"user_agent":        c.Request.UserAgent(),
		"gin_client_ip":     c.ClientIP(),
	}
	c.JSON(200, info)
}
