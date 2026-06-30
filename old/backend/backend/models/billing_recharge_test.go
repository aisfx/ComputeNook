package models

import (
	"database/sql"
	"os"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

// setupTestDB 设置测试数据库
func setupTestDB(t *testing.T) func() {
	// 使用内存SQLite数据库进行测试
	var err error
	DB, err = sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}

	// 创建billing_recharge表
	if err := CreateBillingRechargeTable(); err != nil {
		t.Fatalf("Failed to create billing_recharge table: %v", err)
	}

	// 返回清理函数
	return func() {
		if DB != nil {
			DB.Close()
			DB = nil
		}
	}
}

// TestCreateRechargeRecord 测试创建充值记录
func TestCreateRechargeRecord(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()

	record := &BillingRecharge{
		QoSName:     "normal",
		Amount:      10.5,
		BeforeTotal: 50.0,
		AfterTotal:  60.5,
		Operator:    "admin",
		Notes:       "测试充值",
		CreatedAt:   time.Now(),
	}

	err := CreateRechargeRecord(record)
	if err != nil {
		t.Fatalf("CreateRechargeRecord failed: %v", err)
	}

	// 验证ID被设置
	if record.ID == 0 {
		t.Error("Expected record ID to be set, got 0")
	}

	// 验证记录被正确保存
	records, err := GetRechargeRecords("", 10)
	if err != nil {
		t.Fatalf("GetRechargeRecords failed: %v", err)
	}

	if len(records) != 1 {
		t.Fatalf("Expected 1 record, got %d", len(records))
	}

	saved := records[0]
	if saved.QoSName != record.QoSName {
		t.Errorf("Expected QoSName %s, got %s", record.QoSName, saved.QoSName)
	}
	if saved.Amount != record.Amount {
		t.Errorf("Expected Amount %.2f, got %.2f", record.Amount, saved.Amount)
	}
	if saved.BeforeTotal != record.BeforeTotal {
		t.Errorf("Expected BeforeTotal %.2f, got %.2f", record.BeforeTotal, saved.BeforeTotal)
	}
	if saved.AfterTotal != record.AfterTotal {
		t.Errorf("Expected AfterTotal %.2f, got %.2f", record.AfterTotal, saved.AfterTotal)
	}
	if saved.Operator != record.Operator {
		t.Errorf("Expected Operator %s, got %s", record.Operator, saved.Operator)
	}
	if saved.Notes != record.Notes {
		t.Errorf("Expected Notes %s, got %s", record.Notes, saved.Notes)
	}
}

// TestGetRechargeRecords_NoFilter 测试无过滤条件的查询
func TestGetRechargeRecords_NoFilter(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()

	// 创建多条测试记录
	records := []*BillingRecharge{
		{QoSName: "normal", Amount: 10.0, BeforeTotal: 0, AfterTotal: 10.0, Operator: "admin1", Notes: "充值1"},
		{QoSName: "high", Amount: 20.0, BeforeTotal: 0, AfterTotal: 20.0, Operator: "admin2", Notes: "充值2"},
		{QoSName: "normal", Amount: 15.0, BeforeTotal: 10.0, AfterTotal: 25.0, Operator: "admin1", Notes: "充值3"},
	}

	for _, r := range records {
		if err := CreateRechargeRecord(r); err != nil {
			t.Fatalf("Failed to create record: %v", err)
		}
		// 添加小延迟确保时间戳不同
		time.Sleep(10 * time.Millisecond)
	}

	// 查询所有记录
	result, err := GetRechargeRecords("", 10)
	if err != nil {
		t.Fatalf("GetRechargeRecords failed: %v", err)
	}

	if len(result) != 3 {
		t.Fatalf("Expected 3 records, got %d", len(result))
	}

	// 验证按时间倒序排列（最新的在前）
	if result[0].Notes != "充值3" {
		t.Errorf("Expected first record to be '充值3', got '%s'", result[0].Notes)
	}
	if result[2].Notes != "充值1" {
		t.Errorf("Expected last record to be '充值1', got '%s'", result[2].Notes)
	}
}

// TestGetRechargeRecords_WithQoSFilter 测试按QoS名称过滤
func TestGetRechargeRecords_WithQoSFilter(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()

	// 创建多条测试记录
	records := []*BillingRecharge{
		{QoSName: "normal", Amount: 10.0, BeforeTotal: 0, AfterTotal: 10.0, Operator: "admin1", Notes: "normal1"},
		{QoSName: "high", Amount: 20.0, BeforeTotal: 0, AfterTotal: 20.0, Operator: "admin2", Notes: "high1"},
		{QoSName: "normal", Amount: 15.0, BeforeTotal: 10.0, AfterTotal: 25.0, Operator: "admin1", Notes: "normal2"},
		{QoSName: "high", Amount: 25.0, BeforeTotal: 20.0, AfterTotal: 45.0, Operator: "admin2", Notes: "high2"},
	}

	for _, r := range records {
		if err := CreateRechargeRecord(r); err != nil {
			t.Fatalf("Failed to create record: %v", err)
		}
		time.Sleep(10 * time.Millisecond)
	}

	// 查询normal QoS的记录
	result, err := GetRechargeRecords("normal", 10)
	if err != nil {
		t.Fatalf("GetRechargeRecords failed: %v", err)
	}

	if len(result) != 2 {
		t.Fatalf("Expected 2 records for 'normal', got %d", len(result))
	}

	// 验证所有记录都是normal QoS
	for _, r := range result {
		if r.QoSName != "normal" {
			t.Errorf("Expected QoSName 'normal', got '%s'", r.QoSName)
		}
	}

	// 验证按时间倒序
	if result[0].Notes != "normal2" {
		t.Errorf("Expected first record to be 'normal2', got '%s'", result[0].Notes)
	}
}

// TestGetRechargeRecords_WithLimit 测试查询数量限制
func TestGetRechargeRecords_WithLimit(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()

	// 创建5条测试记录
	for i := 1; i <= 5; i++ {
		record := &BillingRecharge{
			QoSName:     "normal",
			Amount:      float64(i * 10),
			BeforeTotal: 0,
			AfterTotal:  float64(i * 10),
			Operator:    "admin",
			Notes:       "",
		}
		if err := CreateRechargeRecord(record); err != nil {
			t.Fatalf("Failed to create record: %v", err)
		}
		time.Sleep(10 * time.Millisecond)
	}

	// 测试限制为3条
	result, err := GetRechargeRecords("", 3)
	if err != nil {
		t.Fatalf("GetRechargeRecords failed: %v", err)
	}

	if len(result) != 3 {
		t.Fatalf("Expected 3 records with limit=3, got %d", len(result))
	}

	// 验证返回的是最新的3条
	if result[0].Amount != 50.0 {
		t.Errorf("Expected first record amount 50.0, got %.2f", result[0].Amount)
	}
	if result[2].Amount != 30.0 {
		t.Errorf("Expected third record amount 30.0, got %.2f", result[2].Amount)
	}
}

// TestGetDBType 测试数据库类型检测
func TestGetDBType(t *testing.T) {
	// 测试默认值
	os.Unsetenv("DB_TYPE")
	dbType := GetDBType()
	if dbType != "sqlite" {
		t.Errorf("Expected default DB type 'sqlite', got '%s'", dbType)
	}

	// 测试MySQL
	os.Setenv("DB_TYPE", "mysql")
	dbType = GetDBType()
	if dbType != "mysql" {
		t.Errorf("Expected DB type 'mysql', got '%s'", dbType)
	}

	// 测试SQLite
	os.Setenv("DB_TYPE", "sqlite")
	dbType = GetDBType()
	if dbType != "sqlite" {
		t.Errorf("Expected DB type 'sqlite', got '%s'", dbType)
	}

	// 清理
	os.Unsetenv("DB_TYPE")
}

// TestCreateRechargeRecord_EmptyNotes 测试空备注
func TestCreateRechargeRecord_EmptyNotes(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()

	record := &BillingRecharge{
		QoSName:     "normal",
		Amount:      10.0,
		BeforeTotal: 0,
		AfterTotal:  10.0,
		Operator:    "admin",
		Notes:       "", // 空备注
	}

	err := CreateRechargeRecord(record)
	if err != nil {
		t.Fatalf("CreateRechargeRecord with empty notes failed: %v", err)
	}

	// 验证记录被正确保存
	records, err := GetRechargeRecords("", 10)
	if err != nil {
		t.Fatalf("GetRechargeRecords failed: %v", err)
	}

	if len(records) != 1 {
		t.Fatalf("Expected 1 record, got %d", len(records))
	}

	if records[0].Notes != "" {
		t.Errorf("Expected empty notes, got '%s'", records[0].Notes)
	}
}

// TestGetRechargeRecords_EmptyDatabase 测试空数据库查询
func TestGetRechargeRecords_EmptyDatabase(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()

	result, err := GetRechargeRecords("", 10)
	if err != nil {
		t.Fatalf("GetRechargeRecords failed: %v", err)
	}

	if len(result) != 0 {
		t.Fatalf("Expected 0 records from empty database, got %d", len(result))
	}
}
