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
		
		var tokenString string
		
		// 首先检查 Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && parts[0] == "Bearer" {
				tokenString = parts[1]
			}
		}
		
		// 如果 header 中没有 token，检查 URL 参数（用于 WebSocket 连接）
		if tokenString == "" {
			tokenString = c.Query("token")
		}
		
		// 如果有 JWT token，优先使用 JWT 认证（即使在开发模式下）
		if tokenString != "" {
			token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
				// 确保算法是 HS256，防止 alg:none 攻击
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, jwt.ErrSignatureInvalid
				}
				return []byte(os.Getenv("JWT_SECRET")), nil
			})

			if err == nil && token.Valid {
				if claims, ok := token.Claims.(jwt.MapClaims); ok {
					// 校验 issuer（新 token 才有，旧 token 兼容跳过）
					if iss, ok := claims["iss"].(string); ok && iss != "" && iss != "hpc-platform" {
						c.JSON(http.StatusUnauthorized, gin.H{"error": "token来源无效"})
						c.Abort()
						return
					}
					// 检查 token 是否已被吊销（用户已登出）
					if IsTokenRevoked(tokenString) {
						c.JSON(http.StatusUnauthorized, gin.H{"error": "token已失效，请重新登录"})
						c.Abort()
						return
					}

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

					uid := int(claims["uid"].(float64))
					isAdmin := claims["isAdmin"].(bool)
					
					log.Printf("AuthMiddleware: Authenticated user - Username: %s, UID: %d, IsAdmin: %v", username, uid, isAdmin)
					
					// 设置用户对象和单独的字段（兼容两种访问方式）
					c.Set("user", map[string]interface{}{
						"username": username,
						"uid":      strconv.Itoa(uid),
						"isAdmin":  isAdmin,
					})
					c.Set("username", username)
					c.Set("uid", uid)
					c.Set("isAdmin", isAdmin)
					c.Next()
					return
				}
			} else {
				log.Printf("AuthMiddleware: Token validation failed - Error: %v", err)
			}
		}
		
		// 开发模式：如果没有有效的 JWT token，使用默认用户
		if devMode == "true" {
			log.Println("DEV_MODE is enabled, using default dev user")
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

			// 设置用户对象和单独的字段（兼容两种访问方式）
			c.Set("user", map[string]interface{}{
				"username": username,
				"uid":      strconv.Itoa(uid),
				"isAdmin":  isAdmin,
			})
			c.Set("username", username)
			c.Set("uid", uid)
			c.Set("isAdmin", isAdmin)
			c.Next()
			return
		}

		// 生产模式且没有 token：返回错误
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
		c.Abort()
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

// WebDAVAuthMiddleware 支持 Bearer Token 和 Basic Auth 两种认证方式
// Windows/macOS 原生 WebDAV 客户端使用 Basic Auth
func WebDAVAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. 先尝试 Bearer Token（和 AuthMiddleware 一样）
		tokenString := ""
		authHeader := c.GetHeader("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenString = strings.TrimPrefix(authHeader, "Bearer ")
		}
		if tokenString == "" {
			tokenString = c.Query("token")
		}

		if tokenString != "" {
			token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
				return []byte(os.Getenv("JWT_SECRET")), nil
			})
			if err == nil && token.Valid {
				if claims, ok := token.Claims.(jwt.MapClaims); ok {
					username := claims["username"].(string)
					uid := int(claims["uid"].(float64))
					isAdmin := claims["isAdmin"].(bool)
					c.Set("username", username)
					c.Set("uid", uid)
					c.Set("isAdmin", isAdmin)
					c.Next()
					return
				}
			}
		}

		// 2. 尝试 Basic Auth（Windows/macOS 原生挂载）
		user, pass, ok := c.Request.BasicAuth()
		if ok && user != "" && pass != "" {
			client, err := ldap.NewClient()
			if err == nil {
				defer client.Close()
				ldapUser, authErr := client.Authenticate(user, pass)
				if authErr == nil && ldapUser != nil && !ldapUser.Disabled {
					c.Set("username", user)
					c.Set("uid", ldapUser.UID)
					c.Set("isAdmin", ldapUser.IsAdmin)
					c.Next()
					return
				}
			}
		}

		// 3. 未认证：返回 401 并要求 Basic Auth
		c.Header("WWW-Authenticate", `Basic realm="HPC WebDAV", charset="UTF-8"`)
		c.AbortWithStatus(http.StatusUnauthorized)
	}
}
