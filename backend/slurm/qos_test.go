package slurm

import (
	"testing"
)

// TestMinutesToHours 测试分钟转小时
func TestMinutesToHours(t *testing.T) {
	tests := []struct {
		name     string
		minutes  int64
		expected float64
	}{
		{"零分钟", 0, 0.0},
		{"60分钟", 60, 1.0},
		{"90分钟", 90, 1.5},
		{"120分钟", 120, 2.0},
		{"3600分钟", 3600, 60.0},
		{"61200分钟", 61200, 1020.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := MinutesToHours(tt.minutes)
			if result != tt.expected {
				t.Errorf("MinutesToHours(%d) = %.2f, expected %.2f", tt.minutes, result, tt.expected)
			}
		})
	}
}

// TestHoursToMinutes 测试小时转分钟
func TestHoursToMinutes(t *testing.T) {
	tests := []struct {
		name     string
		hours    float64
		expected int64
	}{
		{"零小时", 0.0, 0},
		{"1小时", 1.0, 60},
		{"1.5小时", 1.5, 90},
		{"2小时", 2.0, 120},
		{"60小时", 60.0, 3600},
		{"1020小时", 1020.0, 61200},
		{"0.5小时", 0.5, 30},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := HoursToMinutes(tt.hours)
			if result != tt.expected {
				t.Errorf("HoursToMinutes(%.2f) = %d, expected %d", tt.hours, result, tt.expected)
			}
		})
	}
}

// TestRoundTripConversion 测试往返转换
func TestRoundTripConversion(t *testing.T) {
	testMinutes := []int64{0, 60, 90, 120, 3600, 61200, 102000}

	for _, minutes := range testMinutes {
		hours := MinutesToHours(minutes)
		backToMinutes := HoursToMinutes(hours)
		if backToMinutes != minutes {
			t.Errorf("Round trip failed: %d -> %.2f -> %d", minutes, hours, backToMinutes)
		}
	}
}

// TestExtractBillingQuota 测试提取billing配额
func TestExtractBillingQuota(t *testing.T) {
	// 测试新格式（v0.0.43）
	qosNew := &QoS{
		Name: "test",
	}
	qosNew.Limits.Max.TRES.Minutes.Total = []TRESItem{
		{Type: "billing", ID: 5, Count: 61200},
	}

	quota := ExtractBillingQuota(qosNew)
	if quota != 61200 {
		t.Errorf("ExtractBillingQuota (new format) = %d, expected 61200", quota)
	}

	// 测试旧格式
	qosOld := &QoS{
		Name:        "test",
		GrpTRESMins: "102000",
	}

	quota = ExtractBillingQuota(qosOld)
	if quota != 102000 {
		t.Errorf("ExtractBillingQuota (old format) = %d, expected 102000", quota)
	}

	// 测试空QoS
	qosEmpty := &QoS{
		Name: "test",
	}

	quota = ExtractBillingQuota(qosEmpty)
	if quota != 0 {
		t.Errorf("ExtractBillingQuota (empty) = %d, expected 0", quota)
	}

	// 测试新格式优先于旧格式
	qosBoth := &QoS{
		Name:        "test",
		GrpTRESMins: "50000",
	}
	qosBoth.Limits.Max.TRES.Minutes.Total = []TRESItem{
		{Type: "billing", ID: 5, Count: 61200},
	}

	quota = ExtractBillingQuota(qosBoth)
	if quota != 61200 {
		t.Errorf("ExtractBillingQuota (both formats) = %d, expected 61200 (new format should take precedence)", quota)
	}
}

// TestParseGrpTRESMins 测试解析GrpTRESMins
func TestParseGrpTRESMins(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected int64
	}{
		{"有效数字", "61200", 61200},
		{"零", "0", 0},
		{"大数字", "999999999", 999999999},
		{"无效字符串", "invalid", 0},
		{"空字符串", "", 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parseGrpTRESMins(tt.input)
			if result != tt.expected {
				t.Errorf("parseGrpTRESMins(%s) = %d, expected %d", tt.input, result, tt.expected)
			}
		})
	}
}

// TestExtractNumber 测试提取数值
func TestExtractNumber(t *testing.T) {
	tests := []struct {
		name     string
		input    interface{}
		expected int
	}{
		{"整数", 42, 42},
		{"浮点数", 42.7, 42},
		{"字符串数字", "42", 42},
		{"nil", nil, 0},
		{"无效字符串", "invalid", 0},
		{"对象with number", map[string]interface{}{"number": 42}, 42},
		{"对象with float number", map[string]interface{}{"number": 42.5}, 42},
		{"空对象", map[string]interface{}{}, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ExtractNumber(tt.input)
			if result != tt.expected {
				t.Errorf("ExtractNumber(%v) = %d, expected %d", tt.input, result, tt.expected)
			}
		})
	}
}

// TestExtractGPUCountFromTRES 测试从TRES提取GPU数量
func TestExtractGPUCountFromTRES(t *testing.T) {
	tests := []struct {
		name     string
		tres     string
		expected int
	}{
		{"单独GPU", "gres/gpu=4", 4},
		{"GPU和内存", "gres/gpu=2,mem=11G", 2},
		{"无GPU", "mem=256G", 0},
		{"空字符串", "", 0},
		{"GPU=0", "gres/gpu=0", 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractGPUCountFromTRES(tt.tres)
			if result != tt.expected {
				t.Errorf("extractGPUCountFromTRES(%s) = %d, expected %d", tt.tres, result, tt.expected)
			}
		})
	}
}

// TestExtractMemoryFromTRES 测试从TRES提取内存
func TestExtractMemoryFromTRES(t *testing.T) {
	tests := []struct {
		name     string
		tres     string
		expected int
	}{
		{"GB格式", "mem=256G", 256},
		{"MB格式", "mem=262144M", 256},
		{"GPU和内存", "gres/gpu=2,mem=11G", 11},
		{"无内存", "gres/gpu=4", 0},
		{"空字符串", "", 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractMemoryFromTRES(tt.tres)
			if result != tt.expected {
				t.Errorf("extractMemoryFromTRES(%s) = %d, expected %d", tt.tres, result, tt.expected)
			}
		})
	}
}
