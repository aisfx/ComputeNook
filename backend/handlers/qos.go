package handlers

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"hpc-backend/slurm"
)

// GetQoSList 获取所有 QoS
func GetQoSList(c *gin.Context) {
	// 开发模式：返回模拟数据
	if os.Getenv("DEV_MODE") == "true" {
		mockQoS := []slurm.QoS{
			{
				Name:        "normal",
				Description: "普通优先级",
				Priority:    100,
				MaxJobs:     100,
				MaxSubmit:   200,
				MaxWall:     1440,   // 24小时
				MaxWallPU:   10080,  // 7天
			},
			{
				Name:        "high",
				Description: "高优先级",
				Priority:    200,
				MaxJobs:     50,
				MaxSubmit:   100,
				MaxWall:     2880,   // 48小时
				MaxWallPU:   20160,  // 14天
			},
			{
				Name:        "low",
				Description: "低优先级",
				Priority:    50,
				MaxJobs:     200,
				MaxSubmit:   400,
				MaxWall:     720,    // 12小时
				MaxWallPU:   5040,   // 3.5天
			},
		}
		c.JSON(http.StatusOK, gin.H{"data": mockQoS})
		return
	}

	// 获取当前用户
	username, _ := c.Get("username")
	
	client, err := GetSlurmClientForUser(username.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	qosList, err := client.GetQoSList()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": qosList})
}

// GetQoS 获取单个 QoS
func GetQoS(c *gin.Context) {
	name := c.Param("name")

	// 开发模式：返回模拟数据
	if os.Getenv("DEV_MODE") == "true" {
		mockQoS := slurm.QoS{
			Name:        name,
			Description: "测试 QoS",
			Priority:    100,
			MaxJobs:     100,
			MaxSubmit:   200,
			MaxWall:     1440,
			MaxWallPU:   10080,
		}
		c.JSON(http.StatusOK, gin.H{"data": mockQoS})
		return
	}

	// 获取当前用户
	username, _ := c.Get("username")
	
	client, err := GetSlurmClientForUser(username.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	qos, err := client.GetQoS(name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "QoS not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": qos})
}

// CreateQoS 创建 QoS
func CreateQoS(c *gin.Context) {
	var qos slurm.QoS
	if err := c.ShouldBindJSON(&qos); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 开发模式：模拟创建成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusCreated, gin.H{"message": "QoS created successfully (dev mode)", "data": qos})
		return
	}

	client, err := GetSlurmAdminClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := client.CreateQoS(&qos); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "QoS created successfully", "data": qos})
}

// UpdateQoS 更新 QoS
func UpdateQoS(c *gin.Context) {
	name := c.Param("name")

	var qos slurm.QoS
	if err := c.ShouldBindJSON(&qos); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 开发模式：模拟更新成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusOK, gin.H{"message": "QoS updated successfully (dev mode)"})
		return
	}

	client, err := GetSlurmAdminClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := client.UpdateQoS(name, &qos); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "QoS updated successfully"})
}

// DeleteQoS 删除 QoS
func DeleteQoS(c *gin.Context) {
	name := c.Param("name")

	// 开发模式：模拟删除成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusOK, gin.H{"message": "QoS deleted successfully (dev mode)"})
		return
	}

	client, err := GetSlurmAdminClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := client.DeleteQoS(name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "QoS deleted successfully"})
}
