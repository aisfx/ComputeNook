package models

import (
	"database/sql"
	"fmt"
	"time"
)

// GetOrCreateBillingAccount 获取或创建机时账户
func GetOrCreateBillingAccount(qosName string) (*BillingAccount, error) {
	account := &BillingAccount{}
	
	// 先尝试查询
	query := `SELECT id, qos_name, total_recharged, current_balance, created_at, updated_at 
	          FROM billing_accounts WHERE qos_name = ?`
	err := DB.QueryRow(query, qosName).Scan(
		&account.ID, &account.QoSName, &account.TotalRecharged, 
		&account.CurrentBalance, &account.CreatedAt, &account.UpdatedAt,
	)
	
	if err == sql.ErrNoRows {
		// 不存在则创建
		insert := `INSERT INTO billing_accounts (qos_name, total_recharged, current_balance, created_at, updated_at) 
		           VALUES (?, 0, 0, ?, ?)`
		now := time.Now()
		result, err := DB.Exec(insert, qosName, now, now)
		if err != nil {
			return nil, fmt.Errorf("failed to create billing account: %w", err)
		}
		id, _ := result.LastInsertId()
		account.ID = uint(id)
		account.QoSName = qosName
		account.TotalRecharged = 0
		account.CurrentBalance = 0
		account.CreatedAt = now
		account.UpdatedAt = now
		return account, nil
	} else if err != nil {
		return nil, fmt.Errorf("failed to query billing account: %w", err)
	}
	
	return account, nil
}

// Recharge 充值
func Recharge(qosName string, amount float64, operator, notes string) error {
	if amount <= 0 {
		return fmt.Errorf("recharge amount must be positive")
	}
	
	tx, err := DB.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()
	
	// 1. 确保账户存在
	_, err = GetOrCreateBillingAccount(qosName)
	if err != nil {
		return err
	}
	
	// 2. 更新账户余额
	updateSQL := `UPDATE billing_accounts 
	              SET total_recharged = total_recharged + ?, 
	                  current_balance = current_balance + ?,
	                  updated_at = ?
	              WHERE qos_name = ?`
	now := time.Now()
	_, err = tx.Exec(updateSQL, amount, amount, now, qosName)
	if err != nil {
		return fmt.Errorf("failed to update billing account: %w", err)
	}
	
	// 3. 记录充值记录
	insertSQL := `INSERT INTO recharge_records (qos_name, amount, operator, notes, created_at) 
	              VALUES (?, ?, ?, ?, ?)`
	_, err = tx.Exec(insertSQL, qosName, amount, operator, notes, now)
	if err != nil {
		return fmt.Errorf("failed to insert recharge record: %w", err)
	}
	
	return tx.Commit()
}

// GetBillingAccount 获取机时账户
func GetBillingAccount(qosName string) (*BillingAccount, error) {
	return GetOrCreateBillingAccount(qosName)
}

// GetAllBillingAccounts 获取所有机时账户
func GetAllBillingAccounts() ([]BillingAccount, error) {
	query := `SELECT id, qos_name, total_recharged, current_balance, created_at, updated_at 
	          FROM billing_accounts ORDER BY qos_name`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query billing accounts: %w", err)
	}
	defer rows.Close()
	
	var accounts []BillingAccount
	for rows.Next() {
		var account BillingAccount
		err := rows.Scan(
			&account.ID, &account.QoSName, &account.TotalRecharged,
			&account.CurrentBalance, &account.CreatedAt, &account.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan billing account: %w", err)
		}
		accounts = append(accounts, account)
	}
	
	return accounts, nil
}

// GetRechargeRecordsV2 获取充值记录（新版本），qosName 为空则查全部
func GetRechargeRecordsV2(qosName string, limit int) ([]RechargeRecord, error) {
	var (
		rows *sql.Rows
		err  error
	)

	if qosName != "" {
		rows, err = DB.Query(
			`SELECT id, qos_name, amount, operator, notes, created_at
			 FROM recharge_records
			 WHERE qos_name = ?
			 ORDER BY created_at DESC LIMIT ?`,
			qosName, limit,
		)
	} else {
		rows, err = DB.Query(
			`SELECT id, qos_name, amount, operator, notes, created_at
			 FROM recharge_records
			 ORDER BY created_at DESC LIMIT ?`,
			limit,
		)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to query recharge records: %w", err)
	}
	defer rows.Close()

	var records []RechargeRecord
	for rows.Next() {
		var record RechargeRecord
		if err := rows.Scan(
			&record.ID, &record.QoSName, &record.Amount,
			&record.Operator, &record.Notes, &record.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan recharge record: %w", err)
		}
		records = append(records, record)
	}
	return records, nil
}

// SyncBillingFromSlurm 从 Slurm 同步消费记录并扣减余额
func SyncBillingFromSlurm(jobID int64, qosName, userName, account string, billingHours float64, startTime, endTime time.Time) error {
	if billingHours <= 0 {
		return nil // 跳过无消费的作业
	}
	
	tx, err := DB.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()
	
	// 1. 检查是否已同步
	var count int
	checkSQL := `SELECT COUNT(*) FROM billing_records WHERE job_id = ?`
	err = tx.QueryRow(checkSQL, jobID).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check billing record: %w", err)
	}
	if count > 0 {
		return nil // 已同步，跳过
	}
	
	// 2. 插入消费记录
	insertSQL := `INSERT INTO billing_records 
	              (job_id, qos_name, user_name, account, billing_hours, job_start_time, job_end_time, synced_at) 
	              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	now := time.Now()
	_, err = tx.Exec(insertSQL, jobID, qosName, userName, account, billingHours, startTime, endTime, now)
	if err != nil {
		return fmt.Errorf("failed to insert billing record: %w", err)
	}
	
	// 3. 扣减账户余额
	updateSQL := `UPDATE billing_accounts 
	              SET current_balance = current_balance - ?,
	                  updated_at = ?
	              WHERE qos_name = ?`
	_, err = tx.Exec(updateSQL, billingHours, now, qosName)
	if err != nil {
		return fmt.Errorf("failed to update billing account: %w", err)
	}
	
	return tx.Commit()
}

// GetBillingRecords 获取消费记录
func GetBillingRecords(qosName, userName string, startTime, endTime time.Time, limit int) ([]BillingRecord, error) {
	query := `SELECT id, job_id, qos_name, user_name, account, billing_hours, 
	          job_start_time, job_end_time, synced_at 
	          FROM billing_records WHERE 1=1`
	args := []interface{}{}
	
	if qosName != "" {
		query += ` AND qos_name = ?`
		args = append(args, qosName)
	}
	if userName != "" {
		query += ` AND user_name = ?`
		args = append(args, userName)
	}
	if !startTime.IsZero() {
		query += ` AND job_end_time >= ?`
		args = append(args, startTime)
	}
	if !endTime.IsZero() {
		query += ` AND job_start_time <= ?`
		args = append(args, endTime)
	}
	
	query += ` ORDER BY synced_at DESC LIMIT ?`
	args = append(args, limit)
	
	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query billing records: %w", err)
	}
	defer rows.Close()
	
	var records []BillingRecord
	for rows.Next() {
		var record BillingRecord
		err := rows.Scan(
			&record.ID, &record.JobID, &record.QoSName, &record.UserName,
			&record.Account, &record.BillingHours, &record.JobStartTime,
			&record.JobEndTime, &record.SyncedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan billing record: %w", err)
		}
		records = append(records, record)
	}
	
	return records, nil
}
