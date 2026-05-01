package handlers

import (
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pelletier/go-toml/v2"
	"hpc-backend/logger"
)

// appTemplatesPath 返回 app-templates.toml 的绝对路径
// 优先使用可执行文件同目录（生产部署），找不到则 fallback 到工作目录（开发模式）
func appTemplatesPath() string {
	// 1. 可执行文件同目录（生产：/opt/hpc-platform/app-templates.toml）
	if exe, err := os.Executable(); err == nil {
		p := filepath.Join(filepath.Dir(exe), "app-templates.toml")
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	// 2. 工作目录（开发模式：backend/app-templates.toml）
	if wd, err := os.Getwd(); err == nil {
		return filepath.Join(wd, "app-templates.toml")
	}
	return "app-templates.toml"
}

// AppTemplate 作业模板
type AppTemplate struct {
	ID            int               `toml:"id"             json:"id"`
	Name          string            `toml:"name"           json:"name"`
	Icon          string            `toml:"icon"           json:"icon"`
	Category      string            `toml:"category"       json:"category"`
	AppType       string            `toml:"app_type"       json:"appType"`
	Description   string            `toml:"description"    json:"description"`
	Nodes         int               `toml:"nodes"          json:"nodes"`
	CPUs          int               `toml:"cpus"           json:"cpus"`
	GPUs          int               `toml:"gpus"           json:"gpus"`
	Memory        int               `toml:"memory"         json:"memory"`
	Time          int               `toml:"time"           json:"time"`
	Partition     string            `toml:"partition"      json:"partition"`
	ModuleLoad    string            `toml:"module_load"    json:"moduleLoad"`
	Executable    string            `toml:"executable"     json:"executable"`
	InputFile     string            `toml:"input_file"     json:"inputFile"`
	AppParams     map[string]string `toml:"app_params"     json:"appParams"`
	ShowInQuick   bool              `toml:"show_in_quick"  json:"showInQuick"`
}

type appTemplatesDoc struct {
	Templates []AppTemplate `toml:"template"`
}

var (
	templatesMu   sync.RWMutex
	templatesData []AppTemplate
	templatesLoaded bool
)

func loadTemplates() ([]AppTemplate, error) {
	p := appTemplatesPath()
	logger.Info("loadTemplates: reading %s", p)
	data, err := os.ReadFile(p)
	if err != nil {
		if os.IsNotExist(err) {
			logger.Warn("loadTemplates: file not found: %s", p)
			return []AppTemplate{}, nil
		}
		return nil, err
	}
	var f appTemplatesDoc
	if err := toml.Unmarshal(data, &f); err != nil {
		logger.Error("loadTemplates: parse error: %v", err)
		return nil, err
	}
	logger.Info("loadTemplates: loaded %d templates", len(f.Templates))
	return f.Templates, nil
}

func saveTemplates(templates []AppTemplate) error {
	p := appTemplatesPath()
	f := appTemplatesDoc{Templates: templates}
	data, err := toml.Marshal(f)
	if err != nil {
		return err
	}
	return os.WriteFile(p, data, 0644)
}

func getTemplates() []AppTemplate {
	templatesMu.RLock()
	if templatesLoaded {
		t := make([]AppTemplate, len(templatesData))
		copy(t, templatesData)
		templatesMu.RUnlock()
		return t
	}
	templatesMu.RUnlock()

	templatesMu.Lock()
	defer templatesMu.Unlock()
	t, err := loadTemplates()
	if err != nil {
		logger.Error("loadTemplates: %v", err)
		return []AppTemplate{}
	}
	templatesData = t
	templatesLoaded = true
	return t
}

func invalidateTemplatesCache() {
	templatesMu.Lock()
	templatesLoaded = false
	templatesMu.Unlock()
}

// ListAppTemplates GET /api/app-templates
func ListAppTemplates(c *gin.Context) {
	templates := getTemplates()
	c.JSON(http.StatusOK, gin.H{"data": templates})
}

// CreateAppTemplate POST /api/app-templates
func CreateAppTemplate(c *gin.Context) {
	var tpl AppTemplate
	if err := c.ShouldBindJSON(&tpl); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}

	templatesMu.Lock()
	defer templatesMu.Unlock()

	templates, err := loadTemplates()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "读取模板文件失败"})
		return
	}

	// 自动分配 ID
	if tpl.ID == 0 {
		maxID := 0
		for _, t := range templates {
			if t.ID > maxID {
				maxID = t.ID
			}
		}
		tpl.ID = maxID + 1
	}
	// 检查 ID 重复
	for _, t := range templates {
		if t.ID == tpl.ID {
			tpl.ID = int(time.Now().UnixMilli() % 100000)
			break
		}
	}

	templates = append(templates, tpl)
	if err := saveTemplates(templates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存失败: " + err.Error()})
		return
	}
	templatesLoaded = false
	logger.Info("AppTemplate created: id=%d name=%s", tpl.ID, tpl.Name)
	c.JSON(http.StatusCreated, gin.H{"data": tpl})
}

// UpdateAppTemplate PUT /api/app-templates/:id
func UpdateAppTemplate(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的模板ID"})
		return
	}

	var tpl AppTemplate
	if err := c.ShouldBindJSON(&tpl); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}
	tpl.ID = id

	templatesMu.Lock()
	defer templatesMu.Unlock()

	templates, err := loadTemplates()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "读取模板文件失败"})
		return
	}

	found := false
	for i, t := range templates {
		if t.ID == id {
			templates[i] = tpl
			found = true
			break
		}
	}
	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "模板不存在"})
		return
	}

	if err := saveTemplates(templates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存失败: " + err.Error()})
		return
	}
	templatesLoaded = false
	logger.Info("AppTemplate updated: id=%d name=%s", id, tpl.Name)
	c.JSON(http.StatusOK, gin.H{"data": tpl})
}

// DeleteAppTemplate DELETE /api/app-templates/:id
func DeleteAppTemplate(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的模板ID"})
		return
	}

	templatesMu.Lock()
	defer templatesMu.Unlock()

	templates, err := loadTemplates()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "读取模板文件失败"})
		return
	}

	newTemplates := templates[:0]
	found := false
	for _, t := range templates {
		if t.ID == id {
			found = true
			continue
		}
		newTemplates = append(newTemplates, t)
	}
	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "模板不存在"})
		return
	}

	if err := saveTemplates(newTemplates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存失败: " + err.Error()})
		return
	}
	templatesLoaded = false
	logger.Info("AppTemplate deleted: id=%d", id)
	c.JSON(http.StatusOK, gin.H{"message": "删除成功"})
}
