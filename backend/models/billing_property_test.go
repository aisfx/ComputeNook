package models

import (
	"database/sql"
	"fmt"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/leanovate/gopter"
	"github.com/leanovate/gopter/gen"
	"github.com/leanovate/gopter/prop"
	_ "modernc.org/sqlite"
)

// setupPropertyTestDB 为属性测试设置独立的内存数据库
func setupPropertyTestDB(t *testing.T) func() {
	t.Helper()
	var err error
	DB, err = sql.Open("sqlite", ":memory:?_journal=WAL&cache=shared")
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	DB.SetMaxOpenConns(1) // SQLite 内存库单连接，避免并发锁冲突
	if err = CreateBillingRechargeTable(); err != nil {
		t.Fatalf("create billing_recharge table: %v", err)
	}
	return func() {
		if DB != nil {
			DB.Close()
			DB = nil
		}
	}
}

// ── Property 4: 充值记录创建一致性 ─────────────────────────────────────────
// 验证: 需求 2.1 — 成功充值后数据库记录数量增加 1

// TestProperty_RechargeRecordCreationConsistency 属性测试：充值记录创建一致性
// Feature: machine-time-management, Property 4
// Validates: Requirement 2.1
func TestProperty_RechargeRecordCreationConsistency(t *testing.T) {
	cleanup := setupPropertyTestDB(t)
	defer cleanup()

	params := gopter.DefaultTestParameters()
	params.MinSuccessfulTests = 100
	properties := gopter.NewProperties(params)

	// 用固定 QoS 名，避免 SuchThat 大量丢弃
	properties.Property("Each recharge creates exactly one new record", prop.ForAll(
		func(amount float64) bool {
			if amount <= 0 {
				return true
			}
			before, err := GetRechargeRecords("", 100000)
			if err != nil {
				return false
			}
			if err := CreateRechargeRecord(&BillingRecharge{
				QoSName:  "prop4-qos",
				Amount:   amount,
				Operator: "admin",
			}); err != nil {
				return false
			}
			after, err := GetRechargeRecords("", 100000)
			if err != nil {
				return false
			}
			return len(after) == len(before)+1
		},
		gen.Float64Range(0.1, 10000.0),
	))

	properties.TestingRun(t, gopter.NewFormatedReporter(false, 80, os.Stdout))
}

// ── Property 5: 充值记录字段完整性 ─────────────────────────────────────────
// 验证: 需求 2.2 — 保存的记录包含所有必需字段

// TestProperty_RechargeRecordFieldCompleteness 属性测试：充值记录字段完整性
// Feature: machine-time-management, Property 5
// Validates: Requirement 2.2
func TestProperty_RechargeRecordFieldCompleteness(t *testing.T) {
	cleanup := setupPropertyTestDB(t)
	defer cleanup()

	params := gopter.DefaultTestParameters()
	params.MinSuccessfulTests = 100
	properties := gopter.NewProperties(params)

	// 用整数小时数（转为 float64），完全规避浮点加法误差
	var fieldCounter uint64
	properties.Property("Saved record contains all required fields with correct values", prop.ForAll(
		func(amountH uint16, beforeH uint32) bool {
			amount := float64(amountH) + 1.0  // 1 ~ 65536 整数小时，确保 > 0
			before := float64(beforeH)         // 0 ~ 100000 整数小时
			after := before + amount           // 整数 + 整数 = 精确整数，无浮点误差
			// 用自增 counter 隔离每次迭代，避免 LIMIT 1 取到旧记录
			qosName := fmt.Sprintf("prop5-%d", atomic.AddUint64(&fieldCounter, 1))
			operator := "prop5-admin"
			notes := "test notes"

			record := &BillingRecharge{
				QoSName:     qosName,
				Amount:      amount,
				BeforeTotal: before,
				AfterTotal:  after,
				Operator:    operator,
				Notes:       notes,
			}
			if err := CreateRechargeRecord(record); err != nil {
				return false
			}
			if record.ID == 0 {
				return false
			}

			// 只有这一条记录，读回后必定就是它
			records, err := GetRechargeRecords(qosName, 1)
			if err != nil || len(records) == 0 {
				return false
			}
			saved := records[0]
			return saved.QoSName == qosName &&
				saved.Amount == amount &&
				saved.BeforeTotal == before &&
				saved.AfterTotal == after &&
				saved.Operator == operator &&
				saved.Notes == notes &&
				!saved.CreatedAt.IsZero()
		},
		gen.UInt16(),
		gen.UInt32Range(0, 100000),
	))

	properties.TestingRun(t, gopter.NewFormatedReporter(false, 80, os.Stdout))
}

// ── Property 6: 充值历史时间排序 ────────────────────────────────────────────
// 验证: 需求 2.3 — 查询结果按时间倒序

// TestProperty_RechargeHistoryTimeOrdering 属性测试：充值历史时间排序
// Feature: machine-time-management, Property 6
// Validates: Requirement 2.3
func TestProperty_RechargeHistoryTimeOrdering(t *testing.T) {
	cleanup := setupPropertyTestDB(t)
	defer cleanup()

	params := gopter.DefaultTestParameters()
	params.MinSuccessfulTests = 50
	properties := gopter.NewProperties(params)

	properties.Property("Records are returned in reverse chronological order", prop.ForAll(
		func(n uint8) bool {
			count := int(n)%10 + 2 // 2 ~ 11 条记录

			// 按顺序插入，用小延迟保证时间戳递增
			for i := 0; i < count; i++ {
				_ = CreateRechargeRecord(&BillingRecharge{
					QoSName:  "ordering-qos",
					Amount:   float64(i + 1),
					Operator: "admin",
				})
				time.Sleep(5 * time.Millisecond)
			}

			records, err := GetRechargeRecords("ordering-qos", 1000)
			if err != nil || len(records) < 2 {
				return false
			}

			// 验证倒序
			for i := 1; i < len(records); i++ {
				if records[i-1].CreatedAt.Before(records[i].CreatedAt) {
					return false
				}
			}
			return true
		},
		gen.UInt8Range(0, 9),
	))

	properties.TestingRun(t, gopter.NewFormatedReporter(false, 80, os.Stdout))
}

// ── Property 7: QoS 过滤正确性 ──────────────────────────────────────────────
// 验证: 需求 2.4 — 过滤结果只包含指定 QoS

// TestProperty_QoSFilterCorrectness 属性测试：QoS过滤正确性
// Feature: machine-time-management, Property 7
// Validates: Requirement 2.4
func TestProperty_QoSFilterCorrectness(t *testing.T) {
	cleanup := setupPropertyTestDB(t)
	defer cleanup()

	params := gopter.DefaultTestParameters()
	params.MinSuccessfulTests = 100
	properties := gopter.NewProperties(params)

	properties.Property("Filter returns only records matching the specified QoS", prop.ForAll(
		func(suffix uint8) bool {
			// 使用数字后缀生成确定性 QoS 名，完全避免 SuchThat 丢弃
			targetQoS := fmt.Sprintf("qos-filter-%d", suffix)
			otherQoS := fmt.Sprintf("qos-other-%d", suffix)

			_ = CreateRechargeRecord(&BillingRecharge{QoSName: targetQoS, Amount: 1.0, Operator: "admin"})
			_ = CreateRechargeRecord(&BillingRecharge{QoSName: otherQoS, Amount: 1.0, Operator: "admin"})

			records, err := GetRechargeRecords(targetQoS, 1000)
			if err != nil {
				return false
			}
			for _, r := range records {
				if r.QoSName != targetQoS {
					return false
				}
			}
			return true
		},
		gen.UInt8(),
	))

	properties.TestingRun(t, gopter.NewFormatedReporter(false, 80, os.Stdout))
}

// ── Property 8: 查询数量限制 ─────────────────────────────────────────────────
// 验证: 需求 2.5 — 返回数量不超过 limit

// TestProperty_QueryLimitRespected 属性测试：查询数量限制
// Feature: machine-time-management, Property 8
// Validates: Requirement 2.5
func TestProperty_QueryLimitRespected(t *testing.T) {
	cleanup := setupPropertyTestDB(t)
	defer cleanup()

	// 预先插入 50 条记录
	for i := 0; i < 50; i++ {
		_ = CreateRechargeRecord(&BillingRecharge{
			QoSName: "limit-test", Amount: 1.0, Operator: "admin",
		})
	}

	params := gopter.DefaultTestParameters()
	params.MinSuccessfulTests = 100
	properties := gopter.NewProperties(params)

	properties.Property("Returned record count never exceeds the limit", prop.ForAll(
		func(limit uint8) bool {
			lim := int(limit)
			if lim <= 0 {
				lim = 1
			}
			records, err := GetRechargeRecords("", lim)
			if err != nil {
				return false
			}
			return len(records) <= lim
		},
		gen.UInt8Range(1, 200),
	))

	properties.TestingRun(t, gopter.NewFormatedReporter(false, 80, os.Stdout))
}

// ── Property 10: 累计充值总额计算 ────────────────────────────────────────────
// 验证: 需求 4.2 — 累计总额等于所有充值 amount 之和

// TestProperty_TotalRechargeCalculation 属性测试：累计充值总额计算
// Feature: machine-time-management, Property 10
// Validates: Requirement 4.2
func TestProperty_TotalRechargeCalculation(t *testing.T) {
	cleanup := setupPropertyTestDB(t)
	defer cleanup()

	params := gopter.DefaultTestParameters()
	params.MinSuccessfulTests = 100
	properties := gopter.NewProperties(params)

	// 使用自增序号隔离每次测试的 QoS，避免跨调用数据污染
	var counter uint64

	properties.Property("Sum of all amounts equals total recharged", prop.ForAll(
		func(a1, a2, a3 float64) bool {
			qosName := fmt.Sprintf("total-test-%d", atomic.AddUint64(&counter, 1))
			amounts := []float64{a1, a2, a3}

			var expectedTotal float64
			for _, a := range amounts {
				if a <= 0 {
					continue
				}
				expectedTotal += a
				_ = CreateRechargeRecord(&BillingRecharge{
					QoSName: qosName, Amount: a, Operator: "admin",
				})
			}

			records, err := GetRechargeRecords(qosName, 10000)
			if err != nil {
				return false
			}

			var actualTotal float64
			for _, r := range records {
				actualTotal += r.Amount
			}

			diff := actualTotal - expectedTotal
			if diff < 0 {
				diff = -diff
			}
			return diff < 0.001
		},
		gen.Float64Range(0.1, 1000.0),
		gen.Float64Range(0.1, 1000.0),
		gen.Float64Range(0.1, 1000.0),
	))

	properties.TestingRun(t, gopter.NewFormatedReporter(false, 80, os.Stdout))
}

// ── Property 12: 备注字段可选性 ──────────────────────────────────────────────
// 验证: 需求 7.1, 7.3 — 无论是否有备注都能成功

// TestProperty_NotesFieldOptional 属性测试：备注字段可选性
// Feature: machine-time-management, Property 12
// Validates: Requirements 7.1, 7.3
func TestProperty_NotesFieldOptional(t *testing.T) {
	cleanup := setupPropertyTestDB(t)
	defer cleanup()

	params := gopter.DefaultTestParameters()
	params.MinSuccessfulTests = 100
	properties := gopter.NewProperties(params)

	properties.Property("Recharge succeeds with or without notes", prop.ForAll(
		func(hasNotes bool, notes string) bool {
			actualNotes := ""
			if hasNotes {
				actualNotes = notes
			}
			record := &BillingRecharge{
				QoSName:  "notes-test",
				Amount:   10.0,
				Operator: "admin",
				Notes:    actualNotes,
			}
			return CreateRechargeRecord(record) == nil
		},
		gen.Bool(),
		gen.AlphaString(),
	))

	properties.TestingRun(t, gopter.NewFormatedReporter(false, 80, os.Stdout))
}

// ── Property 13: 备注保存一致性 ──────────────────────────────────────────────
// 验证: 需求 7.2, 7.4 — 保存的备注与输入一致

// TestProperty_NotesSavedConsistently 属性测试：备注保存一致性
// Feature: machine-time-management, Property 13
// Validates: Requirements 7.2, 7.4
func TestProperty_NotesSavedConsistently(t *testing.T) {
	cleanup := setupPropertyTestDB(t)
	defer cleanup()

	params := gopter.DefaultTestParameters()
	params.MinSuccessfulTests = 100
	properties := gopter.NewProperties(params)

	var noteCounter uint64

	properties.Property("Notes are saved and retrieved correctly", prop.ForAll(
		func(notes string) bool {
			qosName := fmt.Sprintf("notes-test-%d", atomic.AddUint64(&noteCounter, 1))
			// 限制长度
			if len(notes) > 200 {
				notes = notes[:200]
			}
			record := &BillingRecharge{
				QoSName:  qosName,
				Amount:   5.0,
				Operator: "admin",
				Notes:    notes,
			}
			if err := CreateRechargeRecord(record); err != nil {
				return false
			}
			records, err := GetRechargeRecords(qosName, 1)
			if err != nil || len(records) == 0 {
				return false
			}
			return records[0].Notes == notes
		},
		gen.AlphaString(),
	))

	properties.TestingRun(t, gopter.NewFormatedReporter(false, 80, os.Stdout))
}

// ── Property 11: 并发充值一致性 ──────────────────────────────────────────────
// 验证: 需求 6.3 — 并发写入后记录数量正确

// TestProperty_ConcurrentRechargeConsistency 属性测试：并发充值一致性
// Feature: machine-time-management, Property 11
// Validates: Requirement 6.3
func TestProperty_ConcurrentRechargeConsistency(t *testing.T) {
	cleanup := setupPropertyTestDB(t)
	defer cleanup()

	params := gopter.DefaultTestParameters()
	params.MinSuccessfulTests = 20
	properties := gopter.NewProperties(params)

	var concCounter uint64

	properties.Property("Concurrent recharges all persist correctly", prop.ForAll(
		func(n uint8) bool {
			concurrency := int(n)%8 + 2 // 2~9 并发
			qosName := fmt.Sprintf("concurrent-%d", atomic.AddUint64(&concCounter, 1))

			var wg sync.WaitGroup
			errCh := make(chan error, concurrency)

			for i := 0; i < concurrency; i++ {
				wg.Add(1)
				go func(idx int) {
					defer wg.Done()
					err := CreateRechargeRecord(&BillingRecharge{
						QoSName:  qosName,
						Amount:   float64(idx + 1),
						Operator: "admin",
					})
					errCh <- err
				}(i)
			}
			wg.Wait()
			close(errCh)

			successCount := 0
			for err := range errCh {
				if err == nil {
					successCount++
				}
			}

			if successCount != concurrency {
				return false
			}

			// 验证记录数正确
			records, err := GetRechargeRecords(qosName, 10000)
			if err != nil {
				return false
			}
			return len(records) == concurrency
		},
		gen.UInt8Range(0, 7),
	))

	properties.TestingRun(t, gopter.NewFormatedReporter(false, 80, os.Stdout))
}
