package handlers

import (
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"
	"unicode"

	"github.com/gin-gonic/gin"
	"hpc-backend/cache"
	"hpc-backend/ldap"
	"hpc-backend/models"
	"hpc-backend/slurm"
)

// validatePasswordStrength 校验密码复杂度：至少8位，含大写、小写、数字
func validatePasswordStrength(password string) string {
	if len(password) < 8 {
		return "密码长度至少 8 位"
	}
	var hasUpper, hasLower, hasDigit bool
	for _, r := range password {
		switch {
		case unicode.IsUpper(r):
			hasUpper = true
		case unicode.IsLower(r):
			hasLower = true
		case unicode.IsDigit(r):
			hasDigit = true
		}
	}
	if !hasUpper {
		return "密码必须包含至少一个大写字母"
	}
	if !hasLower {
		return "密码必须包含至少一个小写字母"
	}
	if !hasDigit {
		return "密码必须包含至少一个数字"
	}
	return ""
}

// GetUsers 获取用户列表（支持分页，防止枚举）
func GetUsers(c *gin.Context) {
	// 解析分页参数，限制最大 page size
	page := 1
	limit := 20
	if p := c.Query("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			page = v
		}
	}
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			if v > 100 {
				v = 100 // 硬上限
			}
			limit = v
		}
	}

	// 开发模式：返回模拟数据
	if os.Getenv("DEV_MODE") == "true" {
		mockUsers := []*models.User{
			{
				Username: "admin",
				UID:      1000,
				GID:      1000,
				CNName:   "管理员",
				Email:    "admin@example.com",
				Shell:    "/bin/bash",
				HomeDir:  "/home/admin",
				IsAdmin:  true,
			},
			{
				Username: "user1",
				UID:      1001,
				GID:      1001,
				CNName:   "用户1",
				Email:    "user1@example.com",
				Shell:    "/bin/bash",
				HomeDir:  "/home/user1",
				IsAdmin:  false,
			},
		}
		c.JSON(http.StatusOK, gin.H{"data": mockUsers, "total": len(mockUsers), "page": page, "limit": limit})
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

	// 分页切片
	total := len(users)
	start := (page - 1) * limit
	end := start + limit
	if start >= total {
		users = []*models.User{}
	} else {
		if end > total {
			end = total
		}
		users = users[start:end]
	}

	c.JSON(http.StatusOK, gin.H{"data": users, "total": total, "page": page, "limit": limit})
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

	// 尝试从缓存获取
	cacheKey := cache.UserKey(username)
	var user models.User
	mgr := cache.NewManager()
	
	if err := mgr.Get(cacheKey, &user); err == nil {
		c.Header("X-Cache", "HIT")
		c.JSON(http.StatusOK, gin.H{"data": user})
		return
	}

	// 缓存未命中，查询LDAP
	c.Header("X-Cache", "MISS")
	client, err := ldap.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer client.Close()

	userPtr, err := client.GetUser(username)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// 写入缓存（5分钟TTL）
	mgr.Set(cacheKey, userPtr, 5*time.Minute)

	c.JSON(http.StatusOK, gin.H{"data": userPtr})
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

	// 尝试绑定同名 QoS（非阻塞，失败不影响用户创建）
	go func() {
		slurmClient, err := GetSlurmAdminClient()
		if err != nil {
			return
		}
		qosList, err := slurmClient.GetQoSList()
		if err != nil {
			return
		}
		for _, q := range qosList {
			if q.Name == user.Username {
				// 找到同名 QoS，绑定到用户的默认账户（与用户名相同）
				assoc := &slurm.Association{
					User:    user.Username,
					Account: user.Username,
					Cluster: "cluster",
					QoS:     []string{q.Name},
				}
				_ = slurmClient.CreateAssociation(assoc)
				break
			}
		}
	}()

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

	if msg := validatePasswordStrength(req.NewPassword); msg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
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

	if msg := validatePasswordStrength(req.NewPassword); msg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
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

// extractTRESCount 从 TRES 列表中提取指定类型的 count
func extractTRESCount(items []slurm.TRESItem, tresType string) int64 {
	for _, t := range items {
		if t.Type == tresType {
			return t.Count
		}
	}
	return 0
}

// extractLimitValue 从 LimitValue 中提取数值（未设置或无限制时返回 0）
func extractLimitValue(lv slurm.LimitValue) int {
	if lv.Set && !lv.Infinite {
		return lv.Number
	}
	return 0
}

// extractQoSCPULimit 兼容新旧结构提取 CPU 限制（与 AdminQoS 前端逻辑一致）
// 优先 per.user，其次 total（GrpTRES）
func extractQoSCPULimit(q slurm.QoS) int64 {
	if v := extractTRESCount(q.Limits.Max.TRES.Per.User, "cpu"); v > 0 {
		return v
	}
	if v := extractTRESCount(q.Limits.Max.TRES.Total, "cpu"); v > 0 {
		return v
	}
	if q.MaxCPUs != nil {
		if n := slurm.ExtractNumber(q.MaxCPUs); n > 0 {
			return int64(n)
		}
	}
	return 0
}

// extractQoSNodeLimit 兼容新旧结构提取节点限制
func extractQoSNodeLimit(q slurm.QoS) int64 {
	if v := extractTRESCount(q.Limits.Max.TRES.Per.User, "node"); v > 0 {
		return v
	}
	if v := extractTRESCount(q.Limits.Max.TRES.Total, "node"); v > 0 {
		return v
	}
	if q.MaxNodes != nil {
		if n := slurm.ExtractNumber(q.MaxNodes); n > 0 {
			return int64(n)
		}
	}
	return 0
}

// extractQoSGPULimit 兼容新旧结构提取 GPU 限制
func extractQoSGPULimit(q slurm.QoS) int64 {
	if v := extractTRESCount(q.Limits.Max.TRES.Per.User, "gres/gpu"); v > 0 {
		return v
	}
	if v := extractTRESCount(q.Limits.Max.TRES.Total, "gres/gpu"); v > 0 {
		return v
	}
	return 0
}

// extractQoSMemoryMB 兼容新旧结构提取内存限制（MB）
func extractQoSMemoryMB(q slurm.QoS) int64 {
	if v := extractTRESCount(q.Limits.Max.TRES.Per.User, "mem"); v > 0 {
		return v
	}
	if v := extractTRESCount(q.Limits.Max.TRES.Total, "mem"); v > 0 {
		return v
	}
	return 0
}

// extractQoSJobsLimit 兼容新旧结构提取每用户最大运行作业数
// 对应 AdminQoS 的 extractJobsLimit：limits.max.jobs.per.user
func extractQoSJobsLimit(q slurm.QoS) int {
	if v := extractLimitValue(q.Limits.Max.Jobs.Per.User); v > 0 {
		return v
	}
	if q.MaxJobs != nil {
		if n := slurm.ExtractNumber(q.MaxJobs); n > 0 {
			return n
		}
	}
	return 0
}

// extractQoSSubmitLimit 兼容新旧结构提取最大提交作业数
// active_jobs.count 对应 sacctmgr 的 MaxSubmitPU
func extractQoSSubmitLimit(q slurm.QoS) int {
	// 优先 active_jobs.count（Slurm REST API 实际存放位置）
	if v := extractLimitValue(q.Limits.Max.ActiveJobs.Count); v > 0 {
		return v
	}
	// 兼容 jobs.count
	if v := extractLimitValue(q.Limits.Max.Jobs.Count); v > 0 {
		return v
	}
	if q.MaxSubmit != nil {
		if n := slurm.ExtractNumber(q.MaxSubmit); n > 0 {
			return n
		}
	}
	return 0
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
	fmt.Printf("[RESOURCES] user=%s total_associations=%d\n", username, len(associations))
	for _, a := range associations {
		fmt.Printf("[RESOURCES] assoc: account=%s partition=%s qos=%v\n", a.Account, a.Partition, a.QoS)
		// 过滤掉 root account
		if a.Account == "root" {
			continue
		}
		qosList := a.QoS
		// 如果 association 没有绑定 QoS，尝试用账户名作为同名 QoS（常见约定）
		if len(qosList) == 0 && a.Account != "" {
			qosList = []string{a.Account}
		}
		item := map[string]interface{}{
			"account":   a.Account,
			"partition": a.Partition,
			"qos":       "",
			"qos_list":  qosList,
			"max_jobs":  0,
		}
		assocList = append(assocList, item)
		for _, q := range qosList {
			qosNames[q] = true
		}
	}
	fmt.Printf("[RESOURCES] collected qosNames=%v\n", qosNames)

	// 获取相关 QoS 的限制
	allQoS, err := client.GetQoSList()
	qosLimits := make([]map[string]interface{}, 0)
	if err == nil {
		// 获取所有用户的历史作业（用于统计 QoS 总使用量）
		// 因为一个 account 对应一个 QoS，需要统计该 QoS 下所有用户的使用量
		var allUsersRecords []slurm.UsageRecord
		startTime := time.Now().AddDate(-1, 0, 0) // 近一年
		endTime := time.Now()
		// 使用空字符串获取所有用户的记录
		allUsersRecords, _ = client.GetUserUsage("", startTime, endTime)
		fmt.Printf("[BILLING] fetched all users records, total=%d\n", len(allUsersRecords))

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

			// 统计该 QoS 下的已使用 billing-minutes（按 QoS 过滤作业）
			// 注意：一个 account 对应一个 QoS，统计该 QoS 下所有用户的使用量
			var usedBillingMins float64
			if billingLimit > 0 {
				for _, r := range allUsersRecords {
					// 按 QoS 过滤（因为一个 account 对应一个 QoS）
					if r.QoS == q.Name {
						usedBillingMins += r.BillingMins
					}
				}
				// 如果按 QoS 过滤后为 0，可能是 slurmdb 不返回 QoS 字段
				// 尝试按 account 过滤（假设 QoS 名称 == account 名称）
				if usedBillingMins == 0 {
					for _, r := range allUsersRecords {
						if r.Account == q.Name {
							usedBillingMins += r.BillingMins
						}
					}
				}
				fmt.Printf("[BILLING] qos=%s limit=%d used=%.4f mins (all users in this account)\n",
					q.Name, billingLimit, usedBillingMins)
			}

			item := map[string]interface{}{
				"name":               q.Name,
				"description":        q.Description,
				"max_cpus":           extractQoSCPULimit(q),
				"max_nodes":          extractQoSNodeLimit(q),
				"max_gpus":           extractQoSGPULimit(q),
				"max_memory_mb":      extractQoSMemoryMB(q),
				"max_jobs":           extractQoSJobsLimit(q),
				"max_submit":         extractQoSSubmitLimit(q),
				"max_wall_pj":        q.MaxWall,
				"grp_tres_mins":      q.GrpTRESMins,
				"billing_limit_mins": billingLimit,
				"billing_used_mins":  usedBillingMins,
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
