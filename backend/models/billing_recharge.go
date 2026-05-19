package models

import (
	"os"
	"time"
)

// BillingRecharge 机时充值记录
type BillingRecharge struct {
	ID          int64     `json:"id"`
	QoSName     string    `json:"qos_name"`      // QoS 名称
	Amount      float64   `json:"amount"`        // 充值金额（小时）
	BeforeTotal float64   `json:"before_total"`  // 充值前总配额（小时）
	AfterTotal  float64   `json:"after_total"`   // 充值后总配额（小时）
	Operator    string    `json:"operator"`      // 操作人
	Notes       string    `json:"notes"`         // 备注
	CreatedAt   time.Time `json:"created_at"`    // 充值时间
}

// CreateBillingRechargeTable 创建充值记录表
func CreateBillingRechargeTable() error {
	dbType := GetDBType()
	
	var createSQL string
	if dbType == "mysql" {
		createSQL = `
		CREATE TABLE IF NOT EXISTS billing_recharge (
			id BIGINT PRIMARY KEY AUTO_INCREMENT,
			qos_name VARCHAR(255) NOT NULL,
			amount DECIMAL(10,2) NOT NULL,
			before_total DECIMAL(10,2) NOT NULL,
			after_total DECIMAL(10,2) NOT NULL,
			operator VARCHAR(255) NOT NULL,
			notes TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_qos_name (qos_name),
			INDEX idx_created_at (created_at)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		`
	} else {
		createSQL = `
		CREATE TABLE IF NOT EXISTS billing_recharge (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			qos_name TEXT NOT NULL,
			amount REAL NOT NULL,
			before_total REAL NOT NULL,
			after_total REAL NOT NULL,
			operator TEXT NOT NULL,
			notes TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_qos_name ON billing_recharge(qos_name);
		CREATE INDEX IF NOT EXISTS idx_created_at ON billing_recharge(created_at);
		`
	}
	
	_, err := DB.Exec(createSQL)
	return err
}

// CreateRechargeRecord 创建充值记录
func CreateRechargeRecord(record *BillingRecharge) error {
	query := `
		INSERT INTO billing_recharge (qos_name, amount, before_total, after_total, operator, notes, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`
	result, err := DB.Exec(query, 
		record.QoSName, 
		record.Amount, 
		record.BeforeTotal, 
		record.AfterTotal, 
		record.Operator, 
		record.Notes,
		time.Now(),
	)
	if err != nil {
		return err
	}
	
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	record.ID = id
	return nil
}

// GetRechargeRecords 获取充值记录列表
func GetRechargeRecords(qosName string, limit int) ([]BillingRecharge, error) {
	var query string
	var args []interface{}
	
	if qosName != "" {
		query = `
			SELECT id, qos_name, amount, before_total, after_total, operator, notes, created_at
			FROM billing_recharge
			WHERE qos_name = ?
			ORDER BY created_at DESC
			LIMIT ?
		`
		args = []interface{}{qosName, limit}
	} else {
		query = `
			SELECT id, qos_name, amount, before_total, after_total, operator, notes, created_at
			FROM billing_recharge
			ORDER BY created_at DESC
			LIMIT ?
		`
		args = []interface{}{limit}
	}
	
	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var records []BillingRecharge
	for rows.Next() {
		var r BillingRecharge
		err := rows.Scan(
			&r.ID,
			&r.QoSName,
			&r.Amount,
			&r.BeforeTotal,
			&r.AfterTotal,
			&r.Operator,
			&r.Notes,
			&r.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		records = append(records, r)
	}
	
	return records, nil
}

// GetDBType 获取数据库类型
func GetDBType() string {
	dbType := os.Getenv("DB_TYPE")
	if dbType == "" {
		return "sqlite" // 默认使用 SQLite
	}
	return dbType
}
