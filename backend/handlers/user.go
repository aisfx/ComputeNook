package handlers

import (
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"hpc-backend/ldap"
	"hpc-backend/models"
)

// GetUsers 获取所有用户
func GetUsers(c *gin.Context) {
	// 开发模式：返回模拟数据
	if os.Getenv("DEV_MODE") == "true" {
		mockUsers := []*models.User{
			{
				Username: "admin",
				UID:      1000,
				GID:      1000,
				CNName:   "管理员",
				Email:    "admin@thhpc.cn",
				Phone:    "13800138000",
				Shell:    "/bin/bash",
				HomeDir:  "/home/admin",
				IsAdmin:  true,
			},
			{
				Username: "user1",
				UID:      1001,
				GID:      1001,
				CNName:   "用户1",
				Email:    "user1@thhpc.cn",
				Phone:    "13800138001",
				Shell:    "/bin/bash",
				HomeDir:  "/home/user1",
				IsAdmin:  false,
			},
		}
		c.JSON(http.StatusOK, gin.H{"data": mockUsers})
		return
	}

	client, err := ldap.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer client.Close()

	users, err := client.GetUsers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": users})
}

// GetUser 获取单个用户
func GetUser(c *gin.Context) {
	username := c.Param("username")

	// 开发模式：返回模拟数据
	if os.Getenv("DEV_MODE") == "true" {
		mockUser := &models.User{
			Username: username,
			UID:      1000,
			GID:      1000,
			CNName:   "测试用户",
			Email:    username + "@thhpc.cn",
			Phone:    "13800138000",
			Shell:    "/bin/bash",
			HomeDir:  "/home/" + username,
			IsAdmin:  username == "admin",
		}
		c.JSON(http.StatusOK, gin.H{"data": mockUser})
		return
	}

	client, err := ldap.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer client.Close()

	user, err := client.GetUser(username)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": user})
}

// CreateUser 创建用户
func CreateUser(c *gin.Context) {
	var user models.User
	if err := c.ShouldBindJSON(&user); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 设置默认值
	if user.Shell == "" {
		user.Shell = "/bin/bash"
	}

	// 密码是必需的
	if user.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Password is required"})
		return
	}

	// 开发模式：模拟创建成功
	if os.Getenv("DEV_MODE") == "true" {
		user.Password = "" // 不返回密码
		c.JSON(http.StatusCreated, gin.H{"message": "User created successfully (dev mode)", "data": user})
		return
	}

	client, err := ldap.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer client.Close()

	if err := client.CreateUser(&user, user.Password); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 不返回密码
	user.Password = ""
	c.JSON(http.StatusCreated, gin.H{"message": "User created successfully", "data": user})
}

// UpdateUser 更新用户
func UpdateUser(c *gin.Context) {
	username := c.Param("username")

	var req models.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 开发模式：模拟更新成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusOK, gin.H{"message": "User updated successfully (dev mode)"})
		return
	}

	client, err := ldap.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer client.Close()

	user := &models.User{
		Username: username,
		UID:      req.UID,
		GID:      req.GID,
		CNName:   req.CNName,
		Email:    req.Email,
		Phone:    req.Phone,
		Shell:    req.Shell,
		HomeDir:  req.HomeDir,
	}

	if err := client.UpdateUser(username, user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User updated successfully"})
}

// DeleteUser 删除用户
func DeleteUser(c *gin.Context) {
	username := c.Param("username")

	// 开发模式：模拟删除成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully (dev mode)"})
		return
	}

	client, err := ldap.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer client.Close()

	if err := client.DeleteUser(username); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully"})
}

// ResetPassword 重置密码
func ResetPassword(c *gin.Context) {
	username := c.Param("username")

	var req models.PasswordReset
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 开发模式：模拟重置成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusOK, gin.H{"message": "Password reset successfully (dev mode)"})
		return
	}

	client, err := ldap.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer client.Close()

	if err := client.ResetPassword(username, req.NewPassword); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password reset successfully"})
}

// GetNextUID 获取下一个可用的 UID
func GetNextUID(c *gin.Context) {
	// 开发模式：返回模拟数据
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusOK, gin.H{"uid": 1002})
		return
	}

	client, err := ldap.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer client.Close()

	uid, err := client.GetNextAvailableUID()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"uid": uid})
}

// GetNextGID 获取下一个可用的 GID
func GetNextGID(c *gin.Context) {
	// 开发模式：返回模拟数据
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusOK, gin.H{"gid": 1002})
		return
	}

	client, err := ldap.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer client.Close()

	gid, err := client.GetNextAvailableGID()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"gid": gid})
}

// SetUserDisabled 禁用/启用用户
func SetUserDisabled(c *gin.Context) {
	username := c.Param("username")

	var req struct {
		Disabled bool `json:"disabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 开发模式：模拟成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusOK, gin.H{"message": "User status updated successfully (dev mode)"})
		return
	}

	client, err := ldap.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer client.Close()

	if err := client.SetUserDisabled(username, req.Disabled); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User status updated successfully"})
}

// SetPasswordMustChange 设置用户首次登录必须修改密码
func SetPasswordMustChange(c *gin.Context) {
	username := c.Param("username")

	var req struct {
		MustChange bool `json:"mustChange"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 开发模式：模拟成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusOK, gin.H{"message": "Password policy updated successfully (dev mode)"})
		return
	}

	client, err := ldap.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer client.Close()

	if err := client.SetPasswordMustChange(username, req.MustChange); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password policy updated successfully"})
}

// ChangePassword 修改自己的密码（需要旧密码验证）
func ChangePassword(c *gin.Context) {
	// 从上下文获取用户名
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found in context"})
		return
	}

	var req models.ChangePassword
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 开发模式：模拟成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusOK, gin.H{
			"message": "密码修改成功 (dev mode)",
			"passwordMustChange": false,
		})
		return
	}

	client, err := ldap.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer client.Close()

	// 验证旧密码
	_, err = client.Authenticate(username.(string), req.OldPassword)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "旧密码不正确"})
		return
	}

	// 修改密码
	if err := client.ResetPassword(username.(string), req.NewPassword); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 清除强制修改密码标记（无论之前是否被标记）
	if err := client.SetPasswordMustChange(username.(string), false); err != nil {
		// 即使清除标记失败，密码已经修改成功，只记录错误
		c.JSON(http.StatusOK, gin.H{
			"message": "密码修改成功，但清除强制修改标记失败",
			"passwordMustChange": false,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "密码修改成功",
		"passwordMustChange": false,
	})
}

// UpdateProfile 更新个人信息
func UpdateProfile(c *gin.Context) {
	// 从上下文获取用户名
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found in context"})
		return
	}

	var req models.UpdateProfile
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 开发模式：模拟成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusOK, gin.H{"message": "个人信息更新成功 (dev mode)"})
		return
	}

	client, err := ldap.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer client.Close()

	// 先获取当前用户的完整信息
	currentUser, err := client.GetUser(username.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法获取用户信息"})
		return
	}

	// 更新用户信息（只允许修改部分字段）
	updateUser := &models.User{
		Username: currentUser.Username,
		UID:      currentUser.UID,
		GID:      currentUser.GID,
		CNName:   req.CNName,
		Email:    req.Email,
		Phone:    req.Phone,
		Shell:    currentUser.Shell,
		HomeDir:  currentUser.HomeDir,
	}

	if err := client.UpdateUser(username.(string), updateUser); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "个人信息更新成功"})
}

// GetMyResources 获取当前用户的资源限制（Association + QoS）
func GetMyResources(c *gin.Context) {
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	// 开发模式：返回模拟数据
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusOK, gin.H{
			"data": map[string]interface{}{
				"associations": []map[string]interface{}{
					{
						"account":   "default",
						"partition": "compute",
						"qos":       "normal",
						"qos_list":  []string{"normal", "high"},
						"max_jobs":  100,
					},
				},
				"qos_limits": []map[string]interface{}{
					{
						"name":        "normal",
						"max_cpus":    128,
						"max_nodes":   4,
						"max_memory":  256,
						"max_gpus":    0,
						"max_jobs":    100,
						"max_submit":  200,
						"max_wall":    72,
						"grp_tres_mins": 0,
					},
				},
			},
		})
		return
	}

	client, err := GetSlurmClientForUser(username.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm: " + err.Error()})
		return
	}

	// 获取用户的 association
	associations, err := client.GetUserAssociations(username.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取资源关联失败: " + err.Error()})
		return
	}

	// 收集用户可用的 QoS 名称
	qosNames := make(map[string]bool)
	assocList := make([]map[string]interface{}, 0)
	for _, a := range associations {
		item := map[string]interface{}{
			"account":   a.Account,
			"partition": a.Partition,
			"qos":       "",
			"qos_list":  a.QoS,
			"max_jobs":  0,
		}
		assocList = append(assocList, item)
		for _, q := range a.QoS {
			qosNames[q] = true
		}
	}

	// 获取相关 QoS 的限制
	allQoS, err := client.GetQoSList()
	qosLimits := make([]map[string]interface{}, 0)
	if err == nil {
		for _, q := range allQoS {
			if !qosNames[q.Name] {
				continue
			}

			// 从新版嵌套结构提取 billing 限制（billing-minutes）
			var billingLimit int64
			for _, tres := range q.Limits.Max.TRES.Minutes.Total {
				if tres.Type == "billing" {
					billingLimit = tres.Count
					break
				}
			}
			// 兼容旧版 GrpTRESMins 字段
			if billingLimit == 0 && q.GrpTRESMins != "" {
				fmt.Sscanf(q.GrpTRESMins, "%d", &billingLimit)
			}

			// 查询该用户在此 QoS 关联账户下的已使用 billing-minutes
			var usedBillingMins float64
			if billingLimit > 0 {
				startTime := time.Now().AddDate(-1, 0, 0) // 近一年
				endTime := time.Now()
				records, uerr := client.GetUserUsage(username.(string), startTime, endTime)
				if uerr == nil {
					for _, r := range records {
						usedBillingMins += r.BillingMins // 直接用已计算好的 BillingMins
					}
				}
				fmt.Printf("[BILLING] user=%s qos=%s limit=%d used=%.4f mins\n",
					username, q.Name, billingLimit, usedBillingMins)
			}

			item := map[string]interface{}{
				"name":               q.Name,
				"description":        q.Description,
				"max_cpus":           q.MaxCPUs,
				"max_nodes":          q.MaxNodes,
				"max_tres":           q.MaxTRES,
				"max_jobs":           q.MaxJobs,
				"max_submit":         q.MaxSubmit,
				"max_wall_pu":        q.MaxWallPU,
				"max_wall_pj":        q.MaxWall,
				"grp_tres_mins":      q.GrpTRESMins,
				"billing_limit_mins": billingLimit,
				"billing_used_mins":  usedBillingMins, // float64，保留小数
			}
			qosLimits = append(qosLimits, item)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data": map[string]interface{}{
			"associations": assocList,
			"qos_limits":   qosLimits,
		},
	})
}
