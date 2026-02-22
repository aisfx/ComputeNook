package handlers

import (
	"net/http"
	"os"
	"strconv"

	"github.com/gin-gonic/gin"
	"hpc-backend/ldap"
	"hpc-backend/models"
)

// GetGroups 获取所有用户组
func GetGroups(c *gin.Context) {
	// 开发模式：返回模拟数据
	if os.Getenv("DEV_MODE") == "true" {
		mockGroups := []*models.Group{
			{
				GroupName: "admin",
				GID:       1000,
				Members:   []string{"admin"},
			},
			{
				GroupName: "users",
				GID:       1001,
				Members:   []string{"user1", "user2"},
			},
		}
		c.JSON(http.StatusOK, gin.H{"data": mockGroups})
		return
	}

	client, err := ldap.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer client.Close()

	groups, err := client.GetGroups()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": groups})
}

// GetGroup 获取单个用户组
func GetGroup(c *gin.Context) {
	gidStr := c.Param("gid")
	gid, err := strconv.Atoi(gidStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid GID"})
		return
	}

	// 开发模式：返回模拟数据
	if os.Getenv("DEV_MODE") == "true" {
		mockGroup := &models.Group{
			GroupName: "testgroup",
			GID:       gid,
			Members:   []string{"user1", "user2"},
		}
		c.JSON(http.StatusOK, gin.H{"data": mockGroup})
		return
	}

	client, err := ldap.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer client.Close()

	group, err := client.GetGroup(gid)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Group not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": group})
}

// CreateGroup 创建用户组
func CreateGroup(c *gin.Context) {
	var group models.Group
	if err := c.ShouldBindJSON(&group); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 开发模式：模拟创建成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusCreated, gin.H{"message": "Group created successfully (dev mode)", "data": group})
		return
	}

	client, err := ldap.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer client.Close()

	if err := client.CreateGroup(&group); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Group created successfully", "data": group})
}

// UpdateGroup 更新用户组
func UpdateGroup(c *gin.Context) {
	gidStr := c.Param("gid")
	gid, err := strconv.Atoi(gidStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid GID"})
		return
	}

	var group models.Group
	if err := c.ShouldBindJSON(&group); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 开发模式：模拟更新成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusOK, gin.H{"message": "Group updated successfully (dev mode)"})
		return
	}

	client, err := ldap.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer client.Close()

	if err := client.UpdateGroup(gid, &group); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Group updated successfully"})
}

// DeleteGroup 删除用户组
func DeleteGroup(c *gin.Context) {
	gidStr := c.Param("gid")
	gid, err := strconv.Atoi(gidStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid GID"})
		return
	}

	// 开发模式：模拟删除成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusOK, gin.H{"message": "Group deleted successfully (dev mode)"})
		return
	}

	client, err := ldap.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer client.Close()

	if err := client.DeleteGroup(gid); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Group deleted successfully"})
}
