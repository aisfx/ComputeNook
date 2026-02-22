package middleware

import (
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"hpc-backend/ldap"
)

// AuthMiddleware JWT 认证中间件
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		devMode := os.Getenv("DEV_MODE")
		
		// 调试日志
		if devMode == "true" {
			log.Println("DEV_MODE is enabled, skipping authentication")
		}
		
		// 开发模式：跳过认证
		if devMode == "true" {
			username := os.Getenv("DEV_USER")
			if username == "" {
				username = "admin"
			}

			uidStr := os.Getenv("DEV_USER_UID")
			uid, _ := strconv.Atoi(uidStr)
			if uid == 0 {
				uid = 1000
			}

			isAdmin := os.Getenv("DEV_USER_IS_ADMIN") == "true"

			c.Set("username", username)
			c.Set("uid", uid)
			c.Set("isAdmin", isAdmin)
			c.Next()
			return
		}

		// 生产模式：验证 JWT
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization header format"})
			c.Abort()
			return
		}

		tokenString := parts[1]
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return []byte(os.Getenv("JWT_SECRET")), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			username := claims["username"].(string)
			
			// 从 LDAP 获取用户最新状态
			client, err := ldap.NewClient()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to LDAP"})
				c.Abort()
				return
			}
			defer client.Close()

			user, err := client.GetUser(username)
			if err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "用户不存在或已被删除"})
				c.Abort()
				return
			}

			// 检查用户是否被禁用
			if user.Disabled {
				c.JSON(http.StatusForbidden, gin.H{
					"error": "账户已被禁用，请联系管理员",
					"code": "ACCOUNT_DISABLED",
				})
				c.Abort()
				return
			}

			// 检查是否需要强制修改密码（除了修改密码的 API 外）
			if user.PasswordMustChange && !strings.Contains(c.Request.URL.Path, "/password") {
				c.JSON(http.StatusForbidden, gin.H{
					"error": "您需要先修改密码才能继续使用系统",
					"code": "PASSWORD_MUST_CHANGE",
					"passwordMustChange": true,
				})
				c.Abort()
				return
			}

			c.Set("username", username)
			c.Set("uid", int(claims["uid"].(float64)))
			c.Set("isAdmin", claims["isAdmin"])
		}

		c.Next()
	}
}

// AdminMiddleware 管理员权限中间件
func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		isAdmin, exists := c.Get("isAdmin")
		if !exists || !isAdmin.(bool) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
			c.Abort()
			return
		}

		c.Next()
	}
}
