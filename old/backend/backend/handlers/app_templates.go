package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"hpc-backend/logger"
	"hpc-backend/models"
)

// ListAppTemplates GET /api/app-templates
// 普通用户：自己的 + 公共的；管理员：全部
func ListAppTemplates(c *gin.Context) {
	username := c.GetString("username")
	isAdmin, _ := c.Get("isAdmin")

	var templates []models.AppTemplate
	var err error
	if isAdmin.(bool) {
		templates, err = models.GetAllAppTemplates()
	} else {
		templates, err = models.GetAppTemplatesForUser(username)
	}
	if err != nil {
		logger.Error("Failed to get app templates: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取模板列表失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": templates})
}

// CreateAppTemplate POST /api/app-templates
func CreateAppTemplate(c *gin.Context) {
	username := c.GetString("username")
	isAdmin, _ := c.Get("isAdmin")

	var tpl models.AppTemplate
	if err := c.ShouldBindJSON(&tpl); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}

	// 强制设置 owner 为当前用户
	tpl.Owner = username
	// 只有管理员可以设置公共模板
	if !isAdmin.(bool) {
		tpl.IsPublic = false
	}

	if err := models.CreateAppTemplate(&tpl); err != nil {
		logger.Error("Failed to create app template: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建模板失败: " + err.Error()})
		return
	}

	logger.Info("AppTemplate created: id=%d name=%s owner=%s", tpl.ID, tpl.Name, tpl.Owner)
	c.JSON(http.StatusCreated, gin.H{"data": tpl})
}

// UpdateAppTemplate PUT /api/app-templates/:id
func UpdateAppTemplate(c *gin.Context) {
	username := c.GetString("username")
	isAdmin, _ := c.Get("isAdmin")

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的模板ID"})
		return
	}

	existing, err := models.GetAppTemplateByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "模板不存在"})
		return
	}

	// 权限检查：只有 owner 本人或管理员可以修改
	if !isAdmin.(bool) && existing.Owner != username {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权修改此模板"})
		return
	}

	var tpl models.AppTemplate
	if err := c.ShouldBindJSON(&tpl); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}
	tpl.ID = id
	tpl.Owner = existing.Owner // owner 不可变
	// 只有管理员可以切换 is_public
	if !isAdmin.(bool) {
		tpl.IsPublic = existing.IsPublic
	}

	if err := models.UpdateAppTemplate(&tpl); err != nil {
		logger.Error("Failed to update app template: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新模板失败: " + err.Error()})
		return
	}

	logger.Info("AppTemplate updated: id=%d name=%s", id, tpl.Name)
	c.JSON(http.StatusOK, gin.H{"data": tpl})
}

// DeleteAppTemplate DELETE /api/app-templates/:id
func DeleteAppTemplate(c *gin.Context) {
	username := c.GetString("username")
	isAdmin, _ := c.Get("isAdmin")

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的模板ID"})
		return
	}

	existing, err := models.GetAppTemplateByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "模板不存在"})
		return
	}

	// 权限检查：只有 owner 本人或管理员可以删除
	if !isAdmin.(bool) && existing.Owner != username {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权删除此模板"})
		return
	}

	if err := models.DeleteAppTemplate(id); err != nil {
		logger.Error("Failed to delete app template: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除模板失败: " + err.Error()})
		return
	}

	logger.Info("AppTemplate deleted: id=%d by=%s", id, username)
	c.JSON(http.StatusOK, gin.H{"message": "删除成功"})
}
