package handlers

import (
	"log"
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
