package models

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

// AppTemplate 作业模板
type AppTemplate struct {
	ID             int               `json:"id"`
	Name           string            `json:"name"`
	Icon           string            `json:"icon"`
	Category       string            `json:"category"`
	AppType        string            `json:"appType"`
	JobType        string            `json:"jobType"`
	Description    string            `json:"description"`
	Nodes          int               `json:"nodes"`
	CPUs           int               `json:"cpus"`
	GPUs           int               `json:"gpus"`
	Memory         int               `json:"memory"`
	Time           int               `json:"time"`
	Partition      string            `json:"partition"`
	ModuleLoad     string            `json:"moduleLoad"`
	Executable     string            `json:"executable"`
	InputFile      string            `json:"inputFile"`
	ContainerImage string            `json:"containerImage"`
	AppParams      map[string]string `json:"appParams"`
	Owner          string            `json:"owner"`
	IsPublic       bool              `json:"isPublic"`
	ShowInQuick    bool              `json:"showInQuick"`
	CreatedAt      time.Time         `json:"createdAt"`
	UpdatedAt      time.Time         `json:"updatedAt"`
}

const templateSelectCols = `id, name, icon, category, app_type, job_type, description,
	nodes, cpus, gpus, memory, time, partition,
	module_load, executable, input_file, container_image, app_params,
	owner, is_public, show_in_quick, created_at, updated_at`

type rowScanner interface {
	Scan(...any) error
}

func scanTemplate(row rowScanner) (AppTemplate, error) {
	var t AppTemplate
	var appParamsJSON string
	var showInQuickInt, isPublicInt int

	err := row.Scan(
		&t.ID, &t.Name, &t.Icon, &t.Category, &t.AppType, &t.JobType, &t.Description,
		&t.Nodes, &t.CPUs, &t.GPUs, &t.Memory, &t.Time, &t.Partition,
		&t.ModuleLoad, &t.Executable, &t.InputFile, &t.ContainerImage, &appParamsJSON,
		&t.Owner, &isPublicInt, &showInQuickInt, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		return t, err
	}
	if appParamsJSON != "" {
		if err := json.Unmarshal([]byte(appParamsJSON), &t.AppParams); err != nil {
			t.AppParams = make(map[string]string)
		}
	} else {
		t.AppParams = make(map[string]string)
	}
	if t.JobType == "" {
		t.JobType = "normal"
	}
	t.IsPublic = isPublicInt != 0
	t.ShowInQuick = showInQuickInt != 0
	return t, nil
}

// GetAppTemplatesForUser 普通用户：自己的 + 公共的 + 系统内置(owner='')
func GetAppTemplatesForUser(username string) ([]AppTemplate, error) {
	query := fmt.Sprintf("SELECT %s FROM app_templates WHERE owner = ? OR is_public = 1 OR owner = '' ORDER BY is_public DESC, owner ASC, id ASC", templateSelectCols)
	rows, err := DB.Query(query, username)
	if err != nil {
		return nil, fmt.Errorf("failed to query app templates: %w", err)
	}
	defer rows.Close()

	templates := []AppTemplate{}
	for rows.Next() {
		t, err := scanTemplate(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan app template: %w", err)
		}
		templates = append(templates, t)
	}
	return templates, nil
}

// GetAllAppTemplates 管理员：所有模板
func GetAllAppTemplates() ([]AppTemplate, error) {
	query := fmt.Sprintf("SELECT %s FROM app_templates ORDER BY is_public DESC, owner ASC, id ASC", templateSelectCols)
	rows, err := DB.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query app templates: %w", err)
	}
	defer rows.Close()

	templates := []AppTemplate{}
	for rows.Next() {
		t, err := scanTemplate(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan app template: %w", err)
		}
		templates = append(templates, t)
	}
	return templates, nil
}

// GetAppTemplateByID 根据ID获取模板
func GetAppTemplateByID(id int) (*AppTemplate, error) {
	query := fmt.Sprintf("SELECT %s FROM app_templates WHERE id = ?", templateSelectCols)
	row := DB.QueryRow(query, id)
	t, err := scanTemplate(row)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("app template not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query app template: %w", err)
	}
	return &t, nil
}

// CreateAppTemplate 创建模板
func CreateAppTemplate(t *AppTemplate) error {
	appParamsJSON, err := json.Marshal(t.AppParams)
	if err != nil {
		return fmt.Errorf("failed to marshal app params: %w", err)
	}
	if t.JobType == "" {
		t.JobType = "normal"
	}

	query := `INSERT INTO app_templates (
		name, icon, category, app_type, job_type, description,
		nodes, cpus, gpus, memory, time, partition,
		module_load, executable, input_file, container_image, app_params,
		owner, is_public, show_in_quick
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	result, err := DB.Exec(query,
		t.Name, t.Icon, t.Category, t.AppType, t.JobType, t.Description,
		t.Nodes, t.CPUs, t.GPUs, t.Memory, t.Time, t.Partition,
		t.ModuleLoad, t.Executable, t.InputFile, t.ContainerImage, string(appParamsJSON),
		t.Owner, boolToInt(t.IsPublic), boolToInt(t.ShowInQuick),
	)
	if err != nil {
		return fmt.Errorf("failed to create app template: %w", err)
	}
	id, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("failed to get last insert id: %w", err)
	}
	t.ID = int(id)
	return nil
}

// UpdateAppTemplate 更新模板
func UpdateAppTemplate(t *AppTemplate) error {
	appParamsJSON, err := json.Marshal(t.AppParams)
	if err != nil {
		return fmt.Errorf("failed to marshal app params: %w", err)
	}
	if t.JobType == "" {
		t.JobType = "normal"
	}

	query := `UPDATE app_templates SET
		name = ?, icon = ?, category = ?, app_type = ?, job_type = ?, description = ?,
		nodes = ?, cpus = ?, gpus = ?, memory = ?, time = ?, partition = ?,
		module_load = ?, executable = ?, input_file = ?, container_image = ?,
		app_params = ?, is_public = ?, show_in_quick = ?, updated_at = ?
	WHERE id = ?`

	_, err = DB.Exec(query,
		t.Name, t.Icon, t.Category, t.AppType, t.JobType, t.Description,
		t.Nodes, t.CPUs, t.GPUs, t.Memory, t.Time, t.Partition,
		t.ModuleLoad, t.Executable, t.InputFile, t.ContainerImage,
		string(appParamsJSON), boolToInt(t.IsPublic), boolToInt(t.ShowInQuick), time.Now(), t.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update app template: %w", err)
	}
	return nil
}

// DeleteAppTemplate 删除模板
func DeleteAppTemplate(id int) error {
	result, err := DB.Exec("DELETE FROM app_templates WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete app template: %w", err)
	}
	n, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if n == 0 {
		return fmt.Errorf("app template not found")
	}
	return nil
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
