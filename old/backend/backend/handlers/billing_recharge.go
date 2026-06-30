package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"hpc-backend/models"
	"hpc-backend/slurm"
)

// RechargeRequest 充值请求
type RechargeRequest struct {
	QoSName string  `json:"qos_name" binding:"required"`
	Amount  float64 `json:"amount" binding:"required,gt=0"`
	Notes   string  `json:"notes"`
}

// RechargeQoS 充值机时
func RechargeQoS(c *gin.Context) {
	var req RechargeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}

	username, _ := c.Get("username")
	operator := username.(string)

	// 获取管理员 Slurm 客户端
	client, err := GetSlurmAdminClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm: " + err.Error()})
		return
	}

	// 获取当前 QoS 配置
	qos, err := client.GetQoS(req.QoSName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "QoS 不存在: " + err.Error()})
		return
	}

	// 提取当前 billing 配额（分钟）
	currentBillingMins := slurm.ExtractBillingQuota(qos)

	beforeTotalHours := slurm.MinutesToHours(currentBillingMins)
	afterTotalHours := beforeTotalHours + req.Amount
	newBillingMins := slurm.HoursToMinutes(afterTotalHours)

	// 更新 QoS 配额
	updateQoS := &slurm.QoS{
		Name:        req.QoSName,
		GrpTRESMins: strconv.FormatInt(newBillingMins, 10),
	}
	if err := client.UpdateQoS(req.QoSName, updateQoS); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新 QoS 失败: " + err.Error()})
		return
	}

	// 记录充值历史
	record := &models.BillingRecharge{
		QoSName:     req.QoSName,
		Amount:      req.Amount,
		BeforeTotal: beforeTotalHours,
		AfterTotal:  afterTotalHours,
		Operator:    operator,
		Notes:       req.Notes,
	}
	if err := models.CreateRechargeRecord(record); err != nil {
		// 记录失败不影响充值成功
		c.JSON(http.StatusOK, gin.H{
			"message": "充值成功，但记录保存失败",
			"data": gin.H{
				"before_total": beforeTotalHours,
				"after_total":  afterTotalHours,
				"amount":       req.Amount,
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "充值成功",
		"data": gin.H{
			"before_total": beforeTotalHours,
			"after_total":  afterTotalHours,
			"amount":       req.Amount,
			"record_id":    record.ID,
		},
	})
}

// GetRechargeHistory 获取充值历史
func GetRechargeHistory(c *gin.Context) {
	qosName := c.Query("qos_name")
	limitStr := c.DefaultQuery("limit", "100")
	
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 100
	}
	if limit > 1000 {
		limit = 1000
	}

	records, err := models.GetRechargeRecords(qosName, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取充值记录失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": records})
}
