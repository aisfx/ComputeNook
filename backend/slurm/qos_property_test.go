package slurm

import (
	"os"
	"testing"

	"github.com/leanovate/gopter"
	"github.com/leanovate/gopter/gen"
	"github.com/leanovate/gopter/prop"
)

// TestProperty_UnitConversionCorrectness 属性测试：单位转换正确性
// Feature: machine-time-management, Property 9: 单位转换正确性
// Validates: Requirements 4.1, 4.4
func TestProperty_UnitConversionCorrectness(t *testing.T) {
	params := gopter.DefaultTestParameters()
	params.MinSuccessfulTests = 100
	properties := gopter.NewProperties(params)

	// 属性1: 分钟转小时再转回分钟应该保持一致（允许1分钟误差）
	properties.Property("Minutes -> Hours -> Minutes round trip", prop.ForAll(
		func(minutes int64) bool {
			// 转换为小时
			hours := MinutesToHours(minutes)
			// 再转回分钟
			backToMinutes := HoursToMinutes(hours)
			// 由于浮点数精度问题，允许1分钟的误差
			diff := backToMinutes - minutes
			if diff < 0 {
				diff = -diff
			}
			return diff <= 1
		},
		gen.Int64Range(0, 1000000), // 生成0到1000000之间的分钟数
	))

	// 属性2: 小时转分钟的结果应该是60的倍数（对于整数小时）
	properties.Property("Integer hours to minutes is multiple of 60", prop.ForAll(
		func(hours int64) bool {
			minutes := HoursToMinutes(float64(hours))
			return minutes%60 == 0
		},
		gen.Int64Range(0, 10000),
	))

	// 属性3: 转换应该保持比例关系
	properties.Property("Conversion maintains ratio", prop.ForAll(
		func(minutes int64) bool {
			if minutes == 0 {
				return true // 跳过零值
			}
			hours := MinutesToHours(minutes)
			// 验证比例：minutes / 60 = hours
			expectedHours := float64(minutes) / 60.0
			// 使用小的误差范围来处理浮点数精度问题
			diff := hours - expectedHours
			if diff < 0 {
				diff = -diff
			}
			return diff < 0.0001
		},
		gen.Int64Range(1, 1000000),
	))

	// 属性4: 零值转换
	properties.Property("Zero conversion", prop.ForAll(
		func() bool {
			return MinutesToHours(0) == 0.0 && HoursToMinutes(0.0) == 0
		},
	))

	// 属性5: 正值转换结果也应该是正值
	properties.Property("Positive input yields positive output", prop.ForAll(
		func(minutes int64) bool {
			if minutes <= 0 {
				return true // 跳过非正值
			}
			hours := MinutesToHours(minutes)
			return hours > 0
		},
		gen.Int64Range(1, 1000000),
	))

	// 属性6: 小时转分钟，分钟转小时应该保持一致
	properties.Property("Hours -> Minutes -> Hours round trip", prop.ForAll(
		func(hours float64) bool {
			if hours < 0 {
				return true // 跳过负值
			}
			// 转换为分钟
			minutes := HoursToMinutes(hours)
			// 再转回小时
			backToHours := MinutesToHours(minutes)
			// 由于整数截断，可能会有小的误差
			diff := backToHours - hours
			if diff < 0 {
				diff = -diff
			}
			// 允许小于1分钟的误差（1/60小时）
			return diff < 1.0/60.0
		},
		gen.Float64Range(0, 10000),
	))

	// 运行属性测试
	properties.TestingRun(t, gopter.NewFormatedReporter(false, 80, os.Stdout))
}

// TestProperty_BillingQuotaExtraction 属性测试：billing配额提取
// Feature: machine-time-management, Property 9: 单位转换正确性
// Validates: Requirements 4.1, 4.4
func TestProperty_BillingQuotaExtraction(t *testing.T) {
	params := gopter.DefaultTestParameters()
	params.MinSuccessfulTests = 100
	properties := gopter.NewProperties(params)

	// 属性1: 从新格式QoS提取的配额应该等于设置的值
	properties.Property("Extract billing from new format QoS", prop.ForAll(
		func(billingMinutes int64) bool {
			qos := &QoS{Name: "test"}
			qos.Limits.Max.TRES.Minutes.Total = []TRESItem{
				{Type: "billing", ID: 5, Count: billingMinutes},
			}
			extracted := ExtractBillingQuota(qos)
			return extracted == billingMinutes
		},
		gen.Int64Range(0, 1000000),
	))

	// 属性2: 空QoS应该返回0
	properties.Property("Empty QoS returns zero", prop.ForAll(
		func() bool {
			qos := &QoS{Name: "test"}
			extracted := ExtractBillingQuota(qos)
			return extracted == 0
		},
	))

	// 属性3: 新格式优先于旧格式
	properties.Property("New format takes precedence over old format", prop.ForAll(
		func(newValue int64) bool {
			qos := &QoS{
				Name:        "test",
				GrpTRESMins: "50000", // 旧格式固定值
			}
			qos.Limits.Max.TRES.Minutes.Total = []TRESItem{
				{Type: "billing", ID: 5, Count: newValue},
			}
			extracted := ExtractBillingQuota(qos)
			return extracted == newValue // 应该返回新格式的值
		},
		gen.Int64Range(0, 100000),
	))

	// 运行属性测试
	properties.TestingRun(t, gopter.NewFormatedReporter(false, 80, os.Stdout))
}

// TestProperty_ConversionMonotonicity 属性测试：转换单调性
// Feature: machine-time-management, Property 9: 单位转换正确性
// Validates: Requirements 4.1, 4.4
func TestProperty_ConversionMonotonicity(t *testing.T) {
	params := gopter.DefaultTestParameters()
	params.MinSuccessfulTests = 100
	properties := gopter.NewProperties(params)

	// 属性1: 如果分钟数A > 分钟数B，则转换后的小时数A > 小时数B
	properties.Property("Minutes conversion is monotonic", prop.ForAll(
		func(minutesA int64, minutesB int64) bool {
			if minutesA <= minutesB {
				return true // 跳过不满足前提的情况
			}
			hoursA := MinutesToHours(minutesA)
			hoursB := MinutesToHours(minutesB)
			return hoursA > hoursB
		},
		gen.Int64Range(0, 1000000),
		gen.Int64Range(0, 1000000),
	))

	// 属性2: 如果小时数A > 小时数B，则转换后的分钟数A > 分钟数B
	properties.Property("Hours conversion is monotonic", prop.ForAll(
		func(hoursA float64, hoursB float64) bool {
			if hoursA <= hoursB || hoursA < 0 || hoursB < 0 {
				return true // 跳过不满足前提的情况
			}
			minutesA := HoursToMinutes(hoursA)
			minutesB := HoursToMinutes(hoursB)
			return minutesA > minutesB
		},
		gen.Float64Range(0, 10000),
		gen.Float64Range(0, 10000),
	))

	// 运行属性测试
	properties.TestingRun(t, gopter.NewFormatedReporter(false, 80, os.Stdout))
}
