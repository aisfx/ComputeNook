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
	client, err := ldap.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "认证服务暂时不可用"})
		return
	}
	defer client.Close()

	user, err := client.Authenticate(req.Username, req.Password)
	if err != nil {
		// 统一错误信息，防止用户名枚举
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
		return
	}

	if user.Disabled {
		// 不透露账户是否存在，统一返回相同错误
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
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

