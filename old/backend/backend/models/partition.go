package models

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"
)

// Partition Slurm 分区配置
type Partition struct {
	ID                  int       `json:"id"`
	Name                string    `json:"name"`
	Nodes               string    `json:"nodes"`
	OverSubscribe       string    `json:"over_subscribe"`
	IsDefault           bool      `json:"is_default"`
	MaxTime             string    `json:"max_time"`
	State               string    `json:"state"`
	AllowGroups         string    `json:"allow_groups"`
	AllowAccounts       string    `json:"allow_accounts"`
	TRESBillingWeights  string    `json:"tres_billing_weights"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

// CreatePartitionTable 创建分区配置表
func CreatePartitionTable() error {
	var query string
	
	if DB.Driver() == nil {
		return fmt.Errorf("database not initialized")
	}
	
	// 检查数据库类型
	dbType := "sqlite"
	if _, err := DB.Exec("SELECT 1"); err == nil {
		// 尝试 MySQL 特定语法
		if _, err := DB.Exec("SELECT VERSION()"); err == nil {
			dbType = "mysql"
		}
	}
	
	if dbType == "mysql" {
		query = `
		CREATE TABLE IF NOT EXISTS partitions (
			id INT AUTO_INCREMENT PRIMARY KEY,
			name VARCHAR(100) NOT NULL UNIQUE,
			nodes VARCHAR(255) NOT NULL DEFAULT 'ALL',
			over_subscribe VARCHAR(50) NOT NULL DEFAULT 'Exclusive',
			is_default TINYINT(1) NOT NULL DEFAULT 0,
			max_time VARCHAR(50) NOT NULL DEFAULT 'INFINITE',
			state VARCHAR(50) NOT NULL DEFAULT 'UP',
			allow_groups TEXT,
			allow_accounts TEXT,
			tres_billing_weights VARCHAR(255),
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		`
	} else {
		query = `
		CREATE TABLE IF NOT EXISTS partitions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			nodes TEXT NOT NULL DEFAULT 'ALL',
			over_subscribe TEXT NOT NULL DEFAULT 'Exclusive',
			is_default INTEGER NOT NULL DEFAULT 0,
			max_time TEXT NOT NULL DEFAULT 'INFINITE',
			state TEXT NOT NULL DEFAULT 'UP',
			allow_groups TEXT,
			allow_accounts TEXT,
			tres_billing_weights TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);
		`
	}
	
	_, err := DB.Exec(query)
	return err
}

// GetAllPartitions 获取所有分区配置
func GetAllPartitions() ([]Partition, error) {
	query := `SELECT id, name, nodes, over_subscribe, is_default, max_time, state, 
	          allow_groups, allow_accounts, tres_billing_weights, created_at, updated_at 
	          FROM partitions ORDER BY is_default DESC, name ASC`
	
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var partitions []Partition
	for rows.Next() {
		var p Partition
		var allowGroups, allowAccounts, tresBillingWeights sql.NullString
		
		err := rows.Scan(&p.ID, &p.Name, &p.Nodes, &p.OverSubscribe, &p.IsDefault, 
			&p.MaxTime, &p.State, &allowGroups, &allowAccounts, &tresBillingWeights,
			&p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			return nil, err
		}
		
		p.AllowGroups = allowGroups.String
		p.AllowAccounts = allowAccounts.String
		p.TRESBillingWeights = tresBillingWeights.String
		
		partitions = append(partitions, p)
	}
	
	return partitions, nil
}

// GetPartitionByName 根据名称获取分区配置
func GetPartitionByName(name string) (*Partition, error) {
	query := `SELECT id, name, nodes, over_subscribe, is_default, max_time, state, 
	          allow_groups, allow_accounts, tres_billing_weights, created_at, updated_at 
	          FROM partitions WHERE name = ?`
	
	var p Partition
	var allowGroups, allowAccounts, tresBillingWeights sql.NullString
	
	err := DB.QueryRow(query, name).Scan(&p.ID, &p.Name, &p.Nodes, &p.OverSubscribe, 
		&p.IsDefault, &p.MaxTime, &p.State, &allowGroups, &allowAccounts, 
		&tresBillingWeights, &p.CreatedAt, &p.UpdatedAt)
	
	if err != nil {
		return nil, err
	}
	
	p.AllowGroups = allowGroups.String
	p.AllowAccounts = allowAccounts.String
	p.TRESBillingWeights = tresBillingWeights.String
	
	return &p, nil
}

// CreatePartition 创建分区配置
func CreatePartition(p *Partition) error {
	// 如果设置为默认分区，先取消其他分区的默认状态
	if p.IsDefault {
		_, err := DB.Exec("UPDATE partitions SET is_default = 0")
		if err != nil {
			return err
		}
	}
	
	query := `INSERT INTO partitions (name, nodes, over_subscribe, is_default, max_time, 
	          state, allow_groups, allow_accounts, tres_billing_weights) 
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	
	result, err := DB.Exec(query, p.Name, p.Nodes, p.OverSubscribe, p.IsDefault, 
		p.MaxTime, p.State, p.AllowGroups, p.AllowAccounts, p.TRESBillingWeights)
	if err != nil {
		return err
	}
	
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	
	p.ID = int(id)
	return nil
}

// UpdatePartition 更新分区配置
func UpdatePartition(p *Partition) error {
	// 如果设置为默认分区，先取消其他分区的默认状态
	if p.IsDefault {
		_, err := DB.Exec("UPDATE partitions SET is_default = 0 WHERE id != ?", p.ID)
		if err != nil {
			return err
		}
	}
	
	query := `UPDATE partitions SET nodes = ?, over_subscribe = ?, is_default = ?, 
	          max_time = ?, state = ?, allow_groups = ?, allow_accounts = ?, 
	          tres_billing_weights = ?, updated_at = ? WHERE name = ?`
	
	_, err := DB.Exec(query, p.Nodes, p.OverSubscribe, p.IsDefault, p.MaxTime, 
		p.State, p.AllowGroups, p.AllowAccounts, p.TRESBillingWeights, 
		time.Now(), p.Name)
	
	return err
}

// DeletePartition 删除分区配置
func DeletePartition(name string) error {
	query := `DELETE FROM partitions WHERE name = ?`
	_, err := DB.Exec(query, name)
	return err
}

// ToConfigLine 将分区配置转换为 partition.conf 格式的一行
func (p *Partition) ToConfigLine() string {
	// OverSubscribe 值需要首字母大写，Slurm 对大小写敏感
	overSub := p.OverSubscribe
	switch strings.ToUpper(overSub) {
	case "EXCLUSIVE":
		overSub = "Exclusive"
	case "YES":
		overSub = "YES"
	case "NO":
		overSub = "NO"
	case "FORCE":
		overSub = "FORCE"
	}

	line := fmt.Sprintf("PartitionName=%s Nodes=%s OverSubscribe=%s",
		p.Name, p.Nodes, overSub)

	if p.IsDefault {
		line += " Default=YES"
	} else {
		line += " Default=NO"
	}

	line += fmt.Sprintf(" MaxTime=%s State=%s", p.MaxTime, p.State)

	if p.AllowGroups != "" {
		line += fmt.Sprintf(" AllowGroups=%s", p.AllowGroups)
	}

	if p.AllowAccounts != "" {
		line += fmt.Sprintf(" AllowAccounts=%s", p.AllowAccounts)
	}

	if p.TRESBillingWeights != "" {
		line += fmt.Sprintf(" TRESBillingWeights=\"%s\"", p.TRESBillingWeights)
	}

	return line
}

// ExportToJSON 导出分区配置为 JSON
func ExportPartitionsToJSON() (string, error) {
	partitions, err := GetAllPartitions()
	if err != nil {
		return "", err
	}
	
	data, err := json.MarshalIndent(partitions, "", "  ")
	if err != nil {
		return "", err
	}
	
	return string(data), nil
}

// ImportFromJSON 从 JSON 导入分区配置
func ImportPartitionsFromJSON(jsonData string) error {
	var partitions []Partition
	err := json.Unmarshal([]byte(jsonData), &partitions)
	if err != nil {
		return err
	}
	
	for _, p := range partitions {
		// 检查是否已存在
		existing, err := GetPartitionByName(p.Name)
		if err == nil && existing != nil {
			// 更新现有配置
			p.ID = existing.ID
			if err := UpdatePartition(&p); err != nil {
				return err
			}
		} else {
			// 创建新配置
			if err := CreatePartition(&p); err != nil {
				return err
			}
		}
	}
	
	return nil
}

// ImportFromConfFile 读取 partition.conf 文件并导入到数据库（已存在的跳过）
func ImportPartitionsFromConfFile(confPath string) (int, error) {
	data, err := os.ReadFile(confPath)
	if err != nil {
		return 0, fmt.Errorf("无法读取文件 %s: %w", confPath, err)
	}

	imported := 0
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		// 跳过注释和空行
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		// 只处理 PartitionName= 开头的行
		if !strings.Contains(line, "PartitionName=") {
			continue
		}

		p := parsePartitionLine(line)
		if p == nil || p.Name == "" {
			continue
		}

		// 已存在则跳过
		if _, err := GetPartitionByName(p.Name); err == nil {
			continue
		}

		if err := CreatePartition(p); err != nil {
			return imported, fmt.Errorf("导入分区 %s 失败: %w", p.Name, err)
		}
		imported++
	}

	return imported, nil
}

// parsePartitionLine 解析一行 partition.conf 配置
func parsePartitionLine(line string) *Partition {
	p := &Partition{
		OverSubscribe: "Exclusive",
		MaxTime:       "INFINITE",
		State:         "UP",
		Nodes:         "ALL",
	}

	for _, field := range strings.Fields(line) {
		kv := strings.SplitN(field, "=", 2)
		if len(kv) != 2 {
			continue
		}
		key := strings.TrimSpace(kv[0])
		val := strings.Trim(strings.TrimSpace(kv[1]), "\"")

		switch strings.ToLower(key) {
		case "partitionname":
			p.Name = val
		case "nodes":
			p.Nodes = val
		case "oversubscribe":
			p.OverSubscribe = val
		case "default":
			p.IsDefault = strings.EqualFold(val, "yes")
		case "maxtime":
			p.MaxTime = val
		case "state":
			p.State = val
		case "allowgroups":
			p.AllowGroups = val
		case "allowaccounts":
			p.AllowAccounts = val
		case "tresbillingweights":
			p.TRESBillingWeights = val
		}
	}

	return p
}
