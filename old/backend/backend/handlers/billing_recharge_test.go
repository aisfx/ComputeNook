package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	_ "modernc.org/sqlite"

	"hpc-backend/models"
)

// setupHandlerTestDB 初始化内存 SQLite，创建所需表
func setupHandlerTestDB(t *testing.T) func() {
	t.Helper()
	var err error
	models.DB, err = sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	if err = models.CreateBillingRechargeTable(); err != nil {
		t.Fatalf("create billing_recharge table: %v", err)
	}
	return func() {
		if models.DB != nil {
			models.DB.Close()
			models.DB = nil
		}
	}
}

// buildRouter 构建仅含充值相关路由的测试路由器
func buildRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	// 注入固定的 username 模拟已认证管理员
	injectUser := func(c *gin.Context) {
		c.Set("username", "test-admin")
		c.Set("is_admin", true)
		c.Next()
	}

	billing := r.Group("/api/billing")
	billing.Use(injectUser)
	{
		billing.POST("/recharge", RechargeQoS)
		billing.GET("/recharge/history", GetRechargeHistory)
	}
	return r
}

// postJSON 向 router 发送 POST JSON 请求并返回响应
func postJSON(r *gin.Engine, path string, body interface{}) *httptest.ResponseRecorder {
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewBuffer(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// getQuery 向 router 发送 GET 请求（带查询参数）
func getQuery(r *gin.Engine, path string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// ─── 参数验证 ───────────────────────────────────────────────────────────────

// TestRechargeQoS_MissingQoSName 缺少 qos_name 应返回 400
func TestRechargeQoS_MissingQoSName(t *testing.T) {
	cleanup := setupHandlerTestDB(t)
	defer cleanup()
	r := buildRouter()

	w := postJSON(r, "/api/billing/recharge", map[string]interface{}{
		"amount": 10.0,
	})
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d; body: %s", w.Code, w.Body.String())
	}
}

// TestRechargeQoS_ZeroAmount 充值金额为 0 应返回 400
func TestRechargeQoS_ZeroAmount(t *testing.T) {
	cleanup := setupHandlerTestDB(t)
	defer cleanup()
	r := buildRouter()

	w := postJSON(r, "/api/billing/recharge", map[string]interface{}{
		"qos_name": "normal",
		"amount":   0,
	})
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d; body: %s", w.Code, w.Body.String())
	}
}

// TestRechargeQoS_NegativeAmount 充值金额为负数应返回 400
func TestRechargeQoS_NegativeAmount(t *testing.T) {
	cleanup := setupHandlerTestDB(t)
	defer cleanup()
	r := buildRouter()

	w := postJSON(r, "/api/billing/recharge", map[string]interface{}{
		"qos_name": "normal",
		"amount":   -5.0,
	})
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d; body: %s", w.Code, w.Body.String())
	}
}

// TestRechargeQoS_MissingAmount 缺少 amount 字段应返回 400
func TestRechargeQoS_MissingAmount(t *testing.T) {
	cleanup := setupHandlerTestDB(t)
	defer cleanup()
	r := buildRouter()

	w := postJSON(r, "/api/billing/recharge", map[string]interface{}{
		"qos_name": "normal",
	})
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d; body: %s", w.Code, w.Body.String())
	}
}

// TestRechargeQoS_EmptyBody 空请求体应返回 400
func TestRechargeQoS_EmptyBody(t *testing.T) {
	cleanup := setupHandlerTestDB(t)
	defer cleanup()
	r := buildRouter()

	req := httptest.NewRequest(http.MethodPost, "/api/billing/recharge", bytes.NewBuffer([]byte("{}")))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d; body: %s", w.Code, w.Body.String())
	}
}

// ─── 充值历史查询 ────────────────────────────────────────────────────────────

// TestGetRechargeHistory_Empty 空数据库应返回空数组
func TestGetRechargeHistory_Empty(t *testing.T) {
	cleanup := setupHandlerTestDB(t)
	defer cleanup()
	r := buildRouter()

	w := getQuery(r, "/api/billing/recharge/history")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("parse response: %v", err)
	}
	data, ok := resp["data"]
	if !ok {
		t.Fatal("response missing 'data' key")
	}
	// data 应为 null 或空切片
	if data != nil {
		arr, ok := data.([]interface{})
		if !ok {
			t.Fatalf("data is not array: %T", data)
		}
		if len(arr) != 0 {
			t.Errorf("expected empty array, got %d items", len(arr))
		}
	}
}

// TestGetRechargeHistory_DefaultLimit 默认 limit 为 100
func TestGetRechargeHistory_DefaultLimit(t *testing.T) {
	cleanup := setupHandlerTestDB(t)
	defer cleanup()

	// 插入 105 条记录
	for i := 0; i < 105; i++ {
		_ = models.CreateRechargeRecord(&models.BillingRecharge{
			QoSName:     "normal",
			Amount:      1.0,
			BeforeTotal: float64(i),
			AfterTotal:  float64(i + 1),
			Operator:    "admin",
			Notes:       "",
		})
	}

	r := buildRouter()
	w := getQuery(r, "/api/billing/recharge/history")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp map[string][]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("parse response: %v", err)
	}
	if len(resp["data"]) != 100 {
		t.Errorf("expected 100 records (default limit), got %d", len(resp["data"]))
	}
}

// TestGetRechargeHistory_CustomLimit 指定 limit 参数
func TestGetRechargeHistory_CustomLimit(t *testing.T) {
	cleanup := setupHandlerTestDB(t)
	defer cleanup()

	for i := 0; i < 20; i++ {
		_ = models.CreateRechargeRecord(&models.BillingRecharge{
			QoSName: "normal", Amount: 1.0,
			BeforeTotal: float64(i), AfterTotal: float64(i + 1),
			Operator: "admin",
		})
	}

	r := buildRouter()
	w := getQuery(r, "/api/billing/recharge/history?limit=5")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp map[string][]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("parse response: %v", err)
	}
	if len(resp["data"]) != 5 {
		t.Errorf("expected 5 records, got %d", len(resp["data"]))
	}
}

// TestGetRechargeHistory_MaxLimit limit 超过 1000 时应被截断为 1000
func TestGetRechargeHistory_MaxLimit(t *testing.T) {
	cleanup := setupHandlerTestDB(t)
	defer cleanup()
	r := buildRouter()

	// 只需验证不返回错误，不验证实际数量（数据库为空）
	w := getQuery(r, "/api/billing/recharge/history?limit=9999")
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d; body: %s", w.Code, w.Body.String())
	}
}

// TestGetRechargeHistory_InvalidLimit 无效 limit 应使用默认值 100
func TestGetRechargeHistory_InvalidLimit(t *testing.T) {
	cleanup := setupHandlerTestDB(t)
	defer cleanup()
	r := buildRouter()

	w := getQuery(r, "/api/billing/recharge/history?limit=abc")
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d; body: %s", w.Code, w.Body.String())
	}
}

// TestGetRechargeHistory_QoSFilter qos_name 过滤
func TestGetRechargeHistory_QoSFilter(t *testing.T) {
	cleanup := setupHandlerTestDB(t)
	defer cleanup()

	// 插入 normal 和 high 两种 QoS 的记录
	for i := 0; i < 3; i++ {
		_ = models.CreateRechargeRecord(&models.BillingRecharge{
			QoSName: "normal", Amount: 1.0, Operator: "admin",
		})
		_ = models.CreateRechargeRecord(&models.BillingRecharge{
			QoSName: "high", Amount: 2.0, Operator: "admin",
		})
	}

	r := buildRouter()
	w := getQuery(r, "/api/billing/recharge/history?qos_name=high")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp map[string][]map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("parse response: %v", err)
	}
	for _, rec := range resp["data"] {
		if rec["qos_name"] != "high" {
			t.Errorf("expected qos_name='high', got '%v'", rec["qos_name"])
		}
	}
	if len(resp["data"]) != 3 {
		t.Errorf("expected 3 'high' records, got %d", len(resp["data"]))
	}
}

// TestGetRechargeHistory_ResponseStructure 响应结构完整性
func TestGetRechargeHistory_ResponseStructure(t *testing.T) {
	cleanup := setupHandlerTestDB(t)
	defer cleanup()

	_ = models.CreateRechargeRecord(&models.BillingRecharge{
		QoSName:     "normal",
		Amount:      10.5,
		BeforeTotal: 5.0,
		AfterTotal:  15.5,
		Operator:    "admin",
		Notes:       "monthly recharge",
	})

	r := buildRouter()
	w := getQuery(r, "/api/billing/recharge/history")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp map[string][]map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("parse response: %v", err)
	}
	if len(resp["data"]) != 1 {
		t.Fatalf("expected 1 record, got %d", len(resp["data"]))
	}

	rec := resp["data"][0]
	requiredFields := []string{"id", "qos_name", "amount", "before_total", "after_total", "operator", "notes", "created_at"}
	for _, f := range requiredFields {
		if _, ok := rec[f]; !ok {
			t.Errorf("response record missing field '%s'", f)
		}
	}
}
