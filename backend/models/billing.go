package models

import (
	"time"
)

// BillingAccount 机时账户表
type BillingAccount struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	QoSName        string    `gorm:"uniqueIndex;size:255;not null" json:"qos_name"`
	TotalRecharged float64   `gorm:"type:decimal(10,2);default:0" json:"total_recharged"` // 累计充值总额（小时）
	CurrentBalance float64   `gorm:"type:decimal(10,2);default:0" json:"current_balance"` // 当前余额（小时）
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// RechargeRecord 充值记录表
type RechargeRecord struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	QoSName   string    `gorm:"size:255;not null;index" json:"qos_name"`
	Amount    float64   `gorm:"type:decimal(10,2);not null" json:"amount"` // 充值金额（小时）
	Operator  string    `gorm:"size:255" json:"operator"`                   // 操作员
	Notes     string    `gorm:"type:text" json:"notes"`                     // 备注
	CreatedAt time.Time `json:"created_at"`
}

// BillingRecord 消费记录表（从 Slurm 作业同步）
type BillingRecord struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	JobID        int64     `gorm:"not null;index" json:"job_id"`
	QoSName      string    `gorm:"size:255;not null;index" json:"qos_name"`
	UserName     string    `gorm:"size:255;not null;index" json:"user_name"`
	Account      string    `gorm:"size:255" json:"account"`
	BillingHours float64   `gorm:"type:decimal(10,4);not null" json:"billing_hours"` // 消耗小时数
	JobStartTime time.Time `json:"job_start_time"`
	JobEndTime   time.Time `json:"job_end_time"`
	SyncedAt     time.Time `json:"synced_at"` // 同步时间
}

// TableName 指定表名
func (BillingAccount) TableName() string {
	return "billing_accounts"
}

func (RechargeRecord) TableName() string {
	return "recharge_records"
}

func (BillingRecord) TableName() string {
	return "billing_records"
}
