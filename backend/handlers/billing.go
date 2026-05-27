package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"hpc-backend/cache"
	"hpc-backend/models"
)

// GetBillingAccounts 获取所有机时账户
func GetBillingAccounts(c *gin.Context) {
	accounts, err := models.GetAllBillingAccounts()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取机时账户失败: " + err.Error()})
		return
	}

	// 如果没有账户，返回空数组
	if len(accounts) == 0 {
		c.JSON(http.StatusOK, gin.H{"data": []interface{}{}})
		return
	}

	// 从 Slurm 获取今年的实际消费（用于对比）
	client, err := GetSlurmAdminClient()
	if err == nil {
		now := time.Now()
		startTime := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
		allRecords, _ := client.GetAllUsersUsage(startTime, now)

		// 按 QoS 聚合实际消费
		qosUsedMap := make(map[string]float64)
		for _, r := range allRecords {
			if r.QoS != "" {
				qosUsedMap[r.QoS] += r.BillingHours
			}
		}

		// 添加实际消费到返回数据
		result := make([]map[string]interface{}, 0, len(accounts))
		for _, account := range accounts {
			actualUsed := qosUsedMap[account.QoSName]
			result = append(result, map[string]interface{}{
				"id":              account.ID,
				"qos_name":        account.QoSName,
				"total_recharged": account.TotalRecharged,
				"current_balance": account.CurrentBalance,
				"actual_used":     actualUsed, // Slurm 实际消费
				"created_at":      account.CreatedAt,
				"updated_at":      account.UpdatedAt,
			})
		}
		c.JSON(http.StatusOK, gin.H{"data": result})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": accounts})
}

// RechargeBilling 充值
func RechargeBilling(c *gin.Context) {
	var req struct {
		QoSName           string  `json:"qos_name" binding:"required"`
		Amount            float64 `json:"amount"`
		Notes             string  `json:"notes"`
		SetSlurmBilling   bool    `json:"set_slurm_billing"`
		SlurmBillingValue float64 `json:"slurm_billing_value"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}

	username, _ := c.Get("username")
	operator := fmt.Sprintf("%v", username)

	// 1. 如果有充值金额，更新数据库中的充值记录
	if req.Amount > 0 {
		err := models.Recharge(req.QoSName, req.Amount, operator, req.Notes)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "充值失败: " + err.Error()})
			return
		}
	}

	// 2. 获取充值后的余额
	account, err := models.GetBillingAccount(req.QoSName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取账户信息失败: " + err.Error()})
		return
	}

	fmt.Printf("[RECHARGE] QoS=%s, Amount=%.2f, CurrentBalance=%.2f, SetSlurmBilling=%v, SlurmBillingValue=%.2f\n",
		req.QoSName, req.Amount, account.CurrentBalance, req.SetSlurmBilling, req.SlurmBillingValue)

	// 3. 同步更新 Slurm QoS 的 GrpTRESMins (billing)
	client, err := GetSlurmAdminClient()
	if err != nil {
		// 数据库已更新，但 Slurm 更新失败，记录警告
		fmt.Printf("[WARNING] 充值成功但无法连接 Slurm: %v\n", err)
		c.JSON(http.StatusOK, gin.H{
			"message": "充值成功，但无法同步到 Slurm，请手动更新 QoS 配置",
			"warning": true,
		})
		return
	}

	// 获取当前 QoS 配置
	currentQoS, err := client.GetQoS(req.QoSName)
	if err != nil {
		fmt.Printf("[WARNING] 充值成功但无法获取 QoS 配置: %v\n", err)
		c.JSON(http.StatusOK, gin.H{
			"message": fmt.Sprintf("充值成功，但无法获取 QoS 配置: %v", err),
			"warning": true,
		})
		return
	}

	// 决定使用哪个值更新 Slurm billing
	var billingMinutes int64
	if req.SetSlurmBilling {
		// 使用用户指定的 Slurm billing 值
		billingMinutes = int64(req.SlurmBillingValue * 60)
		fmt.Printf("[RECHARGE] Using custom Slurm billing value: %.2f hours\n", req.SlurmBillingValue)
	} else {
		// 使用数据库中的当前余额
		billingMinutes = int64(account.CurrentBalance * 60)
		fmt.Printf("[RECHARGE] Using database balance: %.2f hours\n", account.CurrentBalance)
	}

	fmt.Printf("[RECHARGE] Converting: %.2f hours -> %d minutes\n",
		float64(billingMinutes)/60, billingMinutes)

	// 更新 GrpTRESMins
	currentQoS.GrpTRESMins = fmt.Sprintf("billing=%d", billingMinutes)

	fmt.Printf("[RECHARGE] Setting GrpTRESMins to: %s\n", currentQoS.GrpTRESMins)

	// 更新 QoS
	err = client.UpdateQoS(req.QoSName, currentQoS)
	if err != nil {
		fmt.Printf("[WARNING] 充值成功但更新 Slurm QoS 失败: %v\n", err)
		c.JSON(http.StatusOK, gin.H{
			"message": fmt.Sprintf("充值成功，但更新 Slurm QoS 失败: %v", err),
			"warning": true,
		})
		return
	}

	fmt.Printf("[INFO] 充值成功: QoS=%s, 充值金额=%.2f小时, 当前余额=%.2f小时, Slurm billing=%d分钟\n",
		req.QoSName, req.Amount, account.CurrentBalance, billingMinutes)

	c.JSON(http.StatusOK, gin.H{
		"message": "充值成功并已同步到 Slurm",
		"data": map[string]interface{}{
			"qos_name":        account.QoSName,
			"recharged":       req.Amount,
			"current_balance": account.CurrentBalance,
			"slurm_minutes":   billingMinutes,
		},
	})
}

// GetRechargeRecords 获取充值记录
func GetRechargeRecords(c *gin.Context) {
	qosName := c.Query("qos_name")
	if qosName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "qos_name is required"})
		return
	}

	records, err := models.GetRechargeRecordsV2(qosName, 100)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取充值记录失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": records})
}

// GetBillingRecords 获取消费记录
func GetBillingRecords(c *gin.Context) {
	qosName := c.Query("qos_name")
	userName := c.Query("user_name")
	
	var startTime, endTime time.Time
	if start := c.Query("start_time"); start != "" {
		startTime, _ = time.Parse("2006-01-02", start)
	}
	if end := c.Query("end_time"); end != "" {
		endTime, _ = time.Parse("2006-01-02", end)
	}

	records, err := models.GetBillingRecords(qosName, userName, startTime, endTime, 1000)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取消费记录失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": records})
}

// SyncBillingFromSlurm 从 Slurm 同步消费记录
func SyncBillingFromSlurm(c *gin.Context) {
	client, err := GetSlurmAdminClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm: " + err.Error()})
		return
	}

	// 第一步：从 Slurm QoS 列表自动创建机时账户（跳过 normal 等系统 QoS）
	qosList, err := client.GetQoSList()
	createdAccounts := 0
	if err == nil {
		for _, qos := range qosList {
			if qos.Name == "" || qos.Name == "normal" {
				continue
			}
			_, err := models.GetOrCreateBillingAccount(qos.Name)
			if err != nil {
				fmt.Printf("[SYNC] Failed to create billing account for QoS %s: %v\n", qos.Name, err)
			} else {
				createdAccounts++
			}
		}
	}

	// 第二步：获取今年的所有作业消费记录
	now := time.Now()
	startTime := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
	allRecords, err := client.GetAllUsersUsage(startTime, now)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取 Slurm 作业记录失败: " + err.Error()})
		return
	}

	// 同步每个作业
	syncedCount := 0
	skippedCount := 0
	for _, record := range allRecords {
		if record.QoS == "" || record.BillingHours <= 0 {
			skippedCount++
			continue
		}

		err := models.SyncBillingFromSlurm(
			record.JobID,
			record.QoS,
			record.User,
			record.Account,
			record.BillingHours,
			record.StartTime,
			record.EndTime,
		)
		if err != nil {
			fmt.Printf("[SYNC] Failed to sync job %d: %v\n", record.JobID, err)
			skippedCount++
		} else {
			syncedCount++
		}
	}

	// 同步完成后，更新所有 QoS 的 Slurm GrpTRESMins
	accounts, err := models.GetAllBillingAccounts()
	if err == nil {
		for _, account := range accounts {
			// 获取当前 QoS 配置
			currentQoS, err := client.GetQoS(account.QoSName)
			if err != nil {
				fmt.Printf("[SYNC] Failed to get QoS %s: %v\n", account.QoSName, err)
				continue
			}

			// 更新 GrpTRESMins
			billingMinutes := int64(account.CurrentBalance * 60)
			currentQoS.GrpTRESMins = fmt.Sprintf("billing=%d", billingMinutes)

			// 更新 QoS
			err = client.UpdateQoS(account.QoSName, currentQoS)
			if err != nil {
				fmt.Printf("[SYNC] Failed to update QoS %s: %v\n", account.QoSName, err)
			} else {
				fmt.Printf("[SYNC] Updated QoS %s: billing=%d minutes (%.2f hours)\n",
					account.QoSName, billingMinutes, account.CurrentBalance)
			}
		}
	}

	// 清除机时账户缓存，确保前端立即看到最新数据
	mgr := cache.NewManager()
	mgr.DeletePattern(cache.PrefixBilling + "*")

	c.JSON(http.StatusOK, gin.H{
		"message":          "同步完成",
		"accounts_created": createdAccounts,
		"synced":           syncedCount,
		"skipped":          skippedCount,
		"total":            len(allRecords),
	})}

// GetMyBillingInfo 获取当前用户的机时信息
func GetMyBillingInfo(c *gin.Context) {
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	client, err := GetSlurmClientForUser(username.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm: " + err.Error()})
		return
	}

	// 获取用户的 QoS
	associations, err := client.GetUserAssociations(username.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取资源关联失败: " + err.Error()})
		return
	}

	// 收集 QoS 名称
	qosNames := make(map[string]bool)
	for _, a := range associations {
		if a.Account == "root" {
			continue
		}
		for _, qos := range a.QoS {
			qosNames[qos] = true
		}
	}

	// 获取用户今年的消费记录
	now := time.Now()
	startTime := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
	userRecords, err := client.GetUserUsage(username.(string), startTime, now)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取使用记录失败: " + err.Error()})
		return
	}

	// 按 QoS 聚合用户的消费
	userUsedMap := make(map[string]float64)
	for _, record := range userRecords {
		if record.QoS != "" {
			userUsedMap[record.QoS] += record.BillingHours
		}
	}

	// 获取每个 QoS 的机时信息
	result := make([]map[string]interface{}, 0)
	for qosName := range qosNames {
		account, err := models.GetBillingAccount(qosName)
		if err != nil {
			continue
		}

		// 用户个人的消费
		userUsed := userUsedMap[qosName]

		result = append(result, map[string]interface{}{
			"qos_name":        account.QoSName,
			"total_recharged": account.TotalRecharged,     // QoS 总充值
			"used":            userUsed,                    // 用户个人已用
			"current_balance": account.CurrentBalance,      // QoS 剩余余额
			"usage_percent":   0,
		})

		if account.TotalRecharged > 0 {
			result[len(result)-1]["usage_percent"] = (userUsed / account.TotalRecharged) * 100
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}
