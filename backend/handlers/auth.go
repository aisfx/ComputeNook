package handlers

import (
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"hpc-backend/ldap"
	"hpc-backend/models"
)

// Login 用户登录
func Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

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

	// 开发模式
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusOK, gin.H{
			"data": models.User{
				Username: username.(string),
				UID:      uid.(int),
				CNName:   "开发用户",
				IsAdmin:  isAdmin.(bool),
			},
		})
		return
	}

	// 生产模式：从 LDAP 获取完整信息
	client, err := ldap.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer client.Close()

	user, err := client.GetUser(username.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": user})
}
