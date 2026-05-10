package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/pelletier/go-toml/v2"
	"hpc-backend/models"
)

type AppTemplateToml struct {
	ID          int               `toml:"id"`
	Name        string            `toml:"name"`
	Icon        string            `toml:"icon"`
	Category    string            `toml:"category"`
	AppType     string            `toml:"app_type"`
	Description string            `toml:"description"`
	Nodes       int               `toml:"nodes"`
	CPUs        int               `toml:"cpus"`
	GPUs        int               `toml:"gpus"`
	Memory      int               `toml:"memory"`
	Time        int               `toml:"time"`
	Partition   string            `toml:"partition"`
	ModuleLoad  string            `toml:"module_load"`
	Executable  string            `toml:"executable"`
	InputFile   string            `toml:"input_file"`
	AppParams   map[string]string `toml:"app_params"`
	ShowInQuick bool              `toml:"show_in_quick"`
}

type appTemplatesDoc struct {
	Templates []AppTemplateToml `toml:"template"`
}

func main() {
	// 加载环境变量
	if err := godotenv.Load("../.env"); err != nil {
		log.Printf("Warning: .env file not found, using default values")
	}

	// 初始化数据库
	if err := models.InitDatabase(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer models.CloseDatabase()

	// 读取 TOML 文件
	tomlPath := "../app-templates.toml"
	if len(os.Args) > 1 {
		tomlPath = os.Args[1]
	}

	log.Printf("Reading templates from: %s", tomlPath)
	data, err := os.ReadFile(tomlPath)
	if err != nil {
		log.Fatalf("Failed to read TOML file: %v", err)
	}

	var doc appTemplatesDoc
	if err := toml.Unmarshal(data, &doc); err != nil {
		log.Fatalf("Failed to parse TOML: %v", err)
	}

	log.Printf("Found %d templates in TOML file", len(doc.Templates))

	// 导入到数据库
	successCount := 0
	for _, tpl := range doc.Templates {
		// 检查是否已存在
		existing, _ := models.GetAppTemplateByID(tpl.ID)
		if existing != nil {
			log.Printf("Template ID %d already exists, skipping", tpl.ID)
			continue
		}

		// 转换为数据库模型
		dbTemplate := &models.AppTemplate{
			ID:          tpl.ID,
			Name:        tpl.Name,
			Icon:        tpl.Icon,
			Category:    tpl.Category,
			AppType:     tpl.AppType,
			Description: tpl.Description,
			Nodes:       tpl.Nodes,
			CPUs:        tpl.CPUs,
			GPUs:        tpl.GPUs,
			Memory:      tpl.Memory,
			Time:        tpl.Time,
			Partition:   tpl.Partition,
			ModuleLoad:  tpl.ModuleLoad,
			Executable:  tpl.Executable,
			InputFile:   tpl.InputFile,
			AppParams:   tpl.AppParams,
			ShowInQuick: tpl.ShowInQuick,
		}

		// 插入数据库（使用指定的ID）
		if err := insertTemplateWithID(dbTemplate); err != nil {
			log.Printf("Failed to insert template %d (%s): %v", tpl.ID, tpl.Name, err)
			continue
		}

		successCount++
		log.Printf("✓ Imported template: %d - %s", tpl.ID, tpl.Name)
	}

	log.Printf("\n========================================")
	log.Printf("Migration completed!")
	log.Printf("Total templates: %d", len(doc.Templates))
	log.Printf("Successfully imported: %d", successCount)
	log.Printf("========================================")
}

// insertTemplateWithID 插入模板并使用指定的ID
func insertTemplateWithID(t *models.AppTemplate) error {
	appParamsJSON, err := json.Marshal(t.AppParams)
	if err != nil {
		return fmt.Errorf("failed to marshal app params: %w", err)
	}

	showInQuickInt := 0
	if t.ShowInQuick {
		showInQuickInt = 1
	}

	dbType := os.Getenv("DB_TYPE")
	if dbType == "" {
		dbType = "sqlite"
	}

	var query string
	if dbType == "mysql" {
		query = `
			INSERT INTO app_templates (
				id, name, icon, category, app_type, description, 
				nodes, cpus, gpus, memory, time, partition, 
				module_load, executable, input_file, app_params, show_in_quick
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`
	} else {
		query = `
			INSERT INTO app_templates (
				id, name, icon, category, app_type, description, 
				nodes, cpus, gpus, memory, time, partition, 
				module_load, executable, input_file, app_params, show_in_quick
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`
	}

	_, err = models.DB.Exec(query,
		t.ID, t.Name, t.Icon, t.Category, t.AppType, t.Description,
		t.Nodes, t.CPUs, t.GPUs, t.Memory, t.Time, t.Partition,
		t.ModuleLoad, t.Executable, t.InputFile, string(appParamsJSON), showInQuickInt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert template: %w", err)
	}

	return nil
}
