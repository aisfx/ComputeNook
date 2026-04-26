package handlers

import (
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"hpc-backend/slurm"
)

// ── 响应结构体 ────────────────────────────────────────────

// MonthlyJobCount 每月各队列作业数量
type MonthlyJobCount struct {
	Month     string `json:"month"`     // "2024-01"
	Partition string `json:"partition"`
	Count     int    `json:"count"`
}

// JobScaleItem 作业规模分布项
type JobScaleItem struct {
	Range string `json:"range"` // "1-4核"
	Count int    `json:"count"`
}

// JobStatsResult 作业统计响应
type JobStatsResult struct {
	MonthlyJobCounts    []MonthlyJobCount `json:"monthly_job_counts"`
	AvgWaitTimeMinutes  float64           `json:"avg_wait_time_minutes"`
	JobScaleDistribution []JobScaleItem   `json:"job_scale_distribution"`
	TotalJobs           int               `json:"total_jobs"`
}

// UsageStatsResult 卡时/核时使用量响应
type UsageStatsResult struct {
	GPUHours          float64 `json:"gpu_hours"`
	CPUHours          float64 `json:"cpu_hours"`
	BillingHours      float64 `json:"billing_hours"`
	QuotaBillingHours float64 `json:"quota_billing_hours"`
	UsagePercent      float64 `json:"usage_percent"`
	Status            string  `json:"status"`
}

// StorageStatItem 存储用量条目
type StorageStatItem struct {
	Username      string  `json:"username"`
	Filesystem    string  `json:"filesystem"`
	UsedGB        float64 `json:"used_gb"`
	SoftLimitGB   float64 `json:"soft_limit_gb"`
	HardLimitGB   float64 `json:"hard_limit_gb"`
	UsagePercent  float64 `json:"usage_percent"`
	OverSoftLimit bool    `json:"over_soft_limit"`
}

// QuotaStatsResult 用户配额情况响应
type QuotaStatsResult struct {
	Account               string  `json:"account"`
	TotalBillingHours     float64 `json:"total_billing_hours"`
	UsedBillingHours      float64 `json:"used_billing_hours"`
	RemainingBillingHours float64 `json:"remaining_billing_hours"`
	UsagePercent          float64 `json:"usage_percent"`
	Status                string  `json:"status"`
	Message               string  `json:"message,omitempty"`
}

// ── 公共工具函数 ──────────────────────────────────────────

// parseReportTimeParams 解析报表时间参数，默认最近 30 天
func parseReportTimeParams(c *gin.Context) (time.Time, time.Time, error) {
	startTimeStr := c.DefaultQuery("start_time", "")
	endTimeStr := c.DefaultQuery("end_time", "")

	var startTime, endTime time.Time
	var err error

	if startTimeStr != "" {
		if unix, e := strconv.ParseInt(startTimeStr, 10, 64); e == nil {
			startTime = time.Unix(unix, 0)
		} else if t, e := time.ParseInLocation("2006-01-02T15:04:05", startTimeStr, time.Local); e == nil {
			startTime = t
		} else {
			startTime, err = time.Parse("2006-01-02", startTimeStr)
			if err != nil {
				return time.Time{}, time.Time{}, err
			}
		}
	} else {
		startTime = time.Now().AddDate(0, 0, -30)
	}

	if endTimeStr != "" {
		if unix, e := strconv.ParseInt(endTimeStr, 10, 64); e == nil {
			endTime = time.Unix(unix, 0)
		} else if t, e := time.ParseInLocation("2006-01-02T15:04:05", endTimeStr, time.Local); e == nil {
			endTime = t
		} else {
			endTime, err = time.Parse("2006-01-02", endTimeStr)
			if err != nil {
				return time.Time{}, time.Time{}, err
			}
			// 日期只有日期部分时，设为当天末尾，避免截断当天数据
			endTime = endTime.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
		}
	} else {
		endTime = time.Now()
	}

	return startTime, endTime, nil
}

// resolveQueryUser 根据权限决定实际查询用户
// 普通用户强制返回自身；管理员可通过 user 参数指定（空表示全部）
func resolveQueryUser(c *gin.Context) (queryUser string, isAdmin bool) {
	usernameVal, _ := c.Get("username")
	isAdminVal, _ := c.Get("isAdmin")
	username := usernameVal.(string)
	isAdmin = isAdminVal == true

	if isAdmin {
		queryUser = c.DefaultQuery("user", "")
	} else {
		queryUser = username // 普通用户强制为自身
	}
	return
}

// ── 聚合计算纯函数 ────────────────────────────────────────

// buildMonthlyJobCounts 按月份和队列统计作业数量
// 若 partition 非空则只统计该队列
func buildMonthlyJobCounts(records []slurm.UsageRecord, partition string) []MonthlyJobCount {
	type key struct{ month, partition string }
	counts := make(map[key]int)
	for _, r := range records {
		if partition != "" && r.Partition != partition {
			continue
		}
		month := r.StartTime.Format("2006-01")
		if month == "0001-01" {
			// 无效时间跳过
			continue
		}
		k := key{month, r.Partition}
		counts[k]++
	}
	result := make([]MonthlyJobCount, 0, len(counts))
	for k, cnt := range counts {
		result = append(result, MonthlyJobCount{Month: k.month, Partition: k.partition, Count: cnt})
	}
	return result
}

// buildJobScaleDistribution 按 CPU 核数分组统计作业规模分布
func buildJobScaleDistribution(records []slurm.UsageRecord) []JobScaleItem {
	ranges := []struct {
		label string
		min   int
		max   int // -1 表示无上限
	}{
		{"1-4核", 1, 4},
		{"5-16核", 5, 16},
		{"17-64核", 17, 64},
		{"64核以上", 65, -1},
	}
	counts := make([]int, len(ranges))
	for _, r := range records {
		// 从 CPUHours 和 ElapsedSecs 反推 CPU 核数
		cpuCores := 0
		if r.ElapsedSecs > 0 {
			cpuCores = int(r.CPUHours * 3600 / float64(r.ElapsedSecs))
		}
		if cpuCores <= 0 {
			cpuCores = 1
		}
		for i, rng := range ranges {
			if cpuCores >= rng.min && (rng.max == -1 || cpuCores <= rng.max) {
				counts[i]++
				break
			}
		}
	}
	result := make([]JobScaleItem, len(ranges))
	for i, rng := range ranges {
		result[i] = JobScaleItem{Range: rng.label, Count: counts[i]}
	}
	return result
}

// calcAvgWaitTimeMinutes 计算平均等待时间（分钟）
// 等待时间 = start_time - submit_time；UsageRecord 中用 StartTime 和 EndTime
// 由于 UsageRecord 没有 submit_time，此处用 StartTime 与 EndTime 差值的倒推
// 实际 submit_time 需从 Slurm 原始数据获取，这里用 StartTime 作为近似
// 注：若 records 为空返回 0
func calcAvgWaitTimeMinutes(records []slurm.UsageRecord) float64 {
	if len(records) == 0 {
		return 0
	}
	// UsageRecord 没有 SubmitTime 字段，等待时间暂设为 0（后续可扩展）
	// 当前实现：返回 0，待 UsageRecord 增加 SubmitTime 字段后完善
	return 0
}

// calcUsageStatus 根据使用率计算状态
// used/total < 0.8 → NORMAL；0.8 ≤ x < 1.0 → WARNING；≥ 1.0 → EXCEEDED
func calcUsageStatus(used, total float64) string {
	if total <= 0 {
		return "NORMAL"
	}
	ratio := used / total
	if ratio >= 1.0 {
		return "EXCEEDED"
	}
	if ratio >= 0.8 {
		return "WARNING"
	}
	return "NORMAL"
}

// buildStorageStatItem 将 QuotaInfo 列表转换为 StorageStatItem
func buildStorageStatItem(username string, quotas []QuotaInfo) []StorageStatItem {
	result := make([]StorageStatItem, 0, len(quotas))
	for _, q := range quotas {
		const kbToGB = 1.0 / (1024 * 1024)
		usedGB := float64(q.BlockUsed) * kbToGB
		softGB := float64(q.BlockSoft) * kbToGB
		hardGB := float64(q.BlockHard) * kbToGB

		var usagePct float64
		if q.BlockSoft > 0 {
			usagePct = float64(q.BlockUsed) / float64(q.BlockSoft) * 100
		} else if q.BlockHard > 0 {
			usagePct = float64(q.BlockUsed) / float64(q.BlockHard) * 100
		}

		overSoft := q.BlockSoft > 0 && q.BlockUsed > q.BlockSoft

		result = append(result, StorageStatItem{
			Username:     username,
			Filesystem:   q.Filesystem,
			UsedGB:       usedGB,
			SoftLimitGB:  softGB,
			HardLimitGB:  hardGB,
			UsagePercent: usagePct,
			OverSoftLimit: overSoft,
		})
	}
	return result
}

// ── Handler 函数 ──────────────────────────────────────────

// GetJobStats GET /api/reports/jobs
func GetJobStats(c *gin.Context) {
	startTime, endTime, err := parseReportTimeParams(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid time parameter: " + err.Error()})
		return
	}

	queryUser, isAdmin := resolveQueryUser(c)
	partition := c.DefaultQuery("partition", "")

	usernameVal, _ := c.Get("username")
	username := usernameVal.(string)

	client, err := GetSlurmClientForUser(username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "slurm client error: " + err.Error()})
		return
	}

	var records []slurm.UsageRecord
	if isAdmin && queryUser == "" {
		// 管理员查全部：不带 users 参数，获取所有用户作业
		records, err = client.GetAllUsersUsage(startTime, endTime)
		if err != nil {
			records = []slurm.UsageRecord{}
		}
	} else {
		uid := ResolveUID(queryUser)
		records, err = client.GetUserUsage(uid, startTime, endTime)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
			return
		}
		// UID 查不到时退回用户名
		if len(records) == 0 && uid != queryUser {
			records, _ = client.GetUserUsage(queryUser, startTime, endTime)
		}
	}

	// partition 过滤
	filtered := records
	if partition != "" {
		filtered = make([]slurm.UsageRecord, 0)
		for _, r := range records {
			if r.Partition == partition {
				filtered = append(filtered, r)
			}
		}
	}

	result := JobStatsResult{
		MonthlyJobCounts:     buildMonthlyJobCounts(filtered, ""),
		AvgWaitTimeMinutes:   calcAvgWaitTimeMinutes(filtered),
		JobScaleDistribution: buildJobScaleDistribution(filtered),
		TotalJobs:            len(filtered),
	}
	if result.MonthlyJobCounts == nil {
		result.MonthlyJobCounts = []MonthlyJobCount{}
	}
	if result.JobScaleDistribution == nil {
		result.JobScaleDistribution = []JobScaleItem{}
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}

// GetUsageStats GET /api/reports/usage
func GetUsageStats(c *gin.Context) {
	startTime, endTime, err := parseReportTimeParams(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid time parameter: " + err.Error()})
		return
	}

	queryUser, _ := resolveQueryUser(c)
	usernameVal, _ := c.Get("username")
	username := usernameVal.(string)

	client, err := GetSlurmClientForUser(username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "slurm client error: " + err.Error()})
		return
	}

	// 管理员无指定用户时查全部，否则查指定用户
	var records []slurm.UsageRecord
	if queryUser == "" {
		records, err = client.GetAllUsersUsage(startTime, endTime)
	} else {
		uid := ResolveUID(queryUser)
		records, err = client.GetUserUsage(uid, startTime, endTime)
		if err == nil && len(records) == 0 && uid != queryUser {
			records, _ = client.GetUserUsage(queryUser, startTime, endTime)
		}
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}

	var gpuHours, cpuHours, billingHours float64
	for _, r := range records {
		gpuHours += r.GPUHours
		cpuHours += r.CPUHours
		billingHours += r.BillingHours
	}

	// 获取配额上限（billing-minutes → hours）
	var quotaBillingHours float64
	// 尝试获取用户所属账户的 billing 限制
	slurmUser, err2 := client.GetSlurmUser(queryUser)
	if err2 == nil {
		account := ""
		if slurmUser.Default != nil {
			account = slurmUser.Default.Account
		}
		if account == "" {
			account = slurmUser.DefaultAccount
		}
		if account != "" {
			limitMins, err3 := client.GetAccountBillingLimit(account)
			if err3 == nil && limitMins > 0 {
				quotaBillingHours = float64(limitMins) / 60.0
			}
		}
	}

	usagePct := 0.0
	if quotaBillingHours > 0 {
		usagePct = billingHours / quotaBillingHours * 100
	}

	result := UsageStatsResult{
		GPUHours:          gpuHours,
		CPUHours:          cpuHours,
		BillingHours:      billingHours,
		QuotaBillingHours: quotaBillingHours,
		UsagePercent:      usagePct,
		Status:            calcUsageStatus(billingHours, quotaBillingHours),
	}
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// GetStorageStats GET /api/reports/storage
func GetStorageStats(c *gin.Context) {
	usernameVal, _ := c.Get("username")
	isAdminVal, _ := c.Get("isAdmin")
	username := usernameVal.(string)
	isAdmin := isAdminVal == true

	type UserQuotaResult struct {
		Username string            `json:"username"`
		Items    []StorageStatItem `json:"items"`
	}

	if isAdmin {
		targetUser := c.DefaultQuery("user", "")
		if targetUser != "" {
			// 管理员指定了用户，只查该用户
			quotas, err := queryQuota(targetUser, "")
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "存储配额查询失败: " + err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"data": buildStorageStatItem(targetUser, quotas)})
			return
		}

		// 管理员未指定用户：查所有用户（复用 GetAllQuotas 逻辑）
		basePath := os.Getenv("FILEMANAGER_BASE_PATH")
		if basePath == "" {
			basePath = "/home"
		}
		var allItems []StorageStatItem
		accountUsers, _ := getUsersInSameAccount(username)
		var userList []string
		if len(accountUsers) > 0 {
			for _, u := range accountUsers {
				if u != "root" {
					userList = append(userList, u)
				}
			}
		} else {
			entries, _ := os.ReadDir(basePath)
			for _, e := range entries {
				if e.IsDir() && e.Name() != "root" {
					userList = append(userList, e.Name())
				}
			}
		}
		for _, u := range userList {
			quotas, err := queryQuota(u, basePath+"/"+u)
			if err != nil || len(quotas) == 0 {
				continue
			}
			allItems = append(allItems, buildStorageStatItem(u, quotas)...)
		}
		if allItems == nil {
			allItems = []StorageStatItem{}
		}
		c.JSON(http.StatusOK, gin.H{"data": allItems})
		return
	}

	// 普通用户：只查自身
	quotas, err := queryQuota(username, "")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "存储配额查询失败: " + err.Error()})
		return
	}
	items := buildStorageStatItem(username, quotas)
	if items == nil {
		items = []StorageStatItem{}
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

// GetQuotaStats GET /api/reports/quota
func GetQuotaStats(c *gin.Context) {
	usernameVal, _ := c.Get("username")
	isAdminVal, _ := c.Get("isAdmin")
	username := usernameVal.(string)
	isAdmin := isAdminVal == true

	client, err := GetSlurmClientForUser(username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "slurm client error: " + err.Error()})
		return
	}

	startTime, endTime, err := parseReportTimeParams(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid time parameter: " + err.Error()})
		return
	}

	// 确定要查询的账户
	account := c.DefaultQuery("account", "")
	if !isAdmin || account == "" {
		// 普通用户或管理员未指定账户：查当前用户所属账户
		// 方法1：通过 GetSlurmUser 获取默认账户
		slurmUser, err2 := client.GetSlurmUser(username)
		if err2 == nil && slurmUser != nil {
			if slurmUser.Default != nil && slurmUser.Default.Account != "" {
				account = slurmUser.Default.Account
			} else {
				account = slurmUser.DefaultAccount
			}
		}

		// 方法2：GetSlurmUser 失败或无默认账户时，通过 associations 查找
		if account == "" {
			associations, err3 := client.GetAssociations()
			if err3 == nil {
				for _, assoc := range associations {
					if assoc.User == username && assoc.Account != "" {
						account = assoc.Account
						break
					}
				}
			}
		}

		if account == "" {
			c.JSON(http.StatusOK, gin.H{"data": QuotaStatsResult{
				Message: "用户无关联的 Slurm 账户",
			}})
			return
		}
	}

	usage, err := client.GetAccountUsageWithBilling(account, startTime, endTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}

	totalHours := float64(usage.TotalBilling) / 60.0
	usedHours := float64(usage.UsedBilling) / 60.0
	remainingHours := float64(usage.RemainingBilling) / 60.0

	result := QuotaStatsResult{
		Account:               account,
		TotalBillingHours:     totalHours,
		UsedBillingHours:      usedHours,
		RemainingBillingHours: remainingHours,
		UsagePercent:          usage.UsagePercent,
		Status:                usage.Status,
	}
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// QoSUsageItem QoS 计费核时使用情况
type QoSUsageItem struct {
	QoSName          string  `json:"qos_name"`
	UsedBillingHours float64 `json:"used_billing_hours"`
	TotalBillingHours float64 `json:"total_billing_hours"` // 0 = 无限制
	UsagePercent     float64 `json:"usage_percent"`
	Status           string  `json:"status"`
}

// GetQoSUsage GET /api/reports/qos-usage
// 按 QoS 分组统计当前用户的计费核时使用量，并附上 QoS 配额上限
func GetQoSUsage(c *gin.Context) {
	startTime, endTime, err := parseReportTimeParams(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid time parameter: " + err.Error()})
		return
	}

	queryUser, _ := resolveQueryUser(c)
	usernameVal, _ := c.Get("username")
	username := usernameVal.(string)

	client, err := GetSlurmClientForUser(username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "slurm client error: " + err.Error()})
		return
	}

	// 获取用户作业记录（管理员无指定用户时查全部）
	var records []slurm.UsageRecord
	if queryUser == "" {
		records, err = client.GetAllUsersUsage(startTime, endTime)
	} else {
		uid := ResolveUID(queryUser)
		records, err = client.GetUserUsage(uid, startTime, endTime)
		if err == nil && len(records) == 0 && uid != queryUser {
			records, _ = client.GetUserUsage(queryUser, startTime, endTime)
		}
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}

	// 按 QoS 分组累计 billing hours
	qosUsed := make(map[string]float64)
	for _, r := range records {
		qosName := r.QoS
		if qosName == "" {
			qosName = "normal"
		}
		qosUsed[qosName] += r.BillingHours
	}

	// 获取所有 QoS 列表，补充配额上限
	qosList, err := client.GetQoSList()
	if err != nil {
		// QoS 列表获取失败时，只返回有用量的 QoS，配额设为 0
		qosList = nil
	}

	// 构建 QoS 配额 map（billing minutes → hours）
	qosLimit := make(map[string]float64)
	for _, q := range qosList {
		for _, tres := range q.Limits.Max.TRES.Minutes.Total {
			if tres.Type == "billing" && tres.Count > 0 {
				qosLimit[q.Name] = float64(tres.Count) / 60.0
				break
			}
		}
	}

	// 合并：有用量的 QoS + QoS 列表中有配额的 QoS（即使用量为 0 也显示）
	allQoS := make(map[string]struct{})
	for k := range qosUsed {
		allQoS[k] = struct{}{}
	}
	for _, q := range qosList {
		if _, hasLimit := qosLimit[q.Name]; hasLimit {
			allQoS[q.Name] = struct{}{}
		}
	}

	// 如果完全没有数据，返回空列表（前端 mock 兜底）
	result := make([]QoSUsageItem, 0, len(allQoS))
	for qosName := range allQoS {
		used := qosUsed[qosName]
		total := qosLimit[qosName] // 0 = 无限制

		var pct float64
		if total > 0 {
			pct = used / total * 100
		}

		result = append(result, QoSUsageItem{
			QoSName:           qosName,
			UsedBillingHours:  used,
			TotalBillingHours: total,
			UsagePercent:      pct,
			Status:            calcUsageStatus(used, total),
		})
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}
