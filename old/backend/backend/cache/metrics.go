package cache

import (
	"sync/atomic"
	"time"
)

// Metrics 缓存指标统计
type Metrics struct {
	Hits       int64
	Misses     int64
	Sets       int64
	Deletes    int64
	Errors     int64
	TotalTime  int64 // 微秒
	Operations int64
}

var globalMetrics = &Metrics{}

// RecordHit 记录缓存命中
func RecordHit() {
	atomic.AddInt64(&globalMetrics.Hits, 1)
}

// RecordMiss 记录缓存未命中
func RecordMiss() {
	atomic.AddInt64(&globalMetrics.Misses, 1)
}

// RecordSet 记录缓存写入
func RecordSet() {
	atomic.AddInt64(&globalMetrics.Sets, 1)
}

// RecordDelete 记录缓存删除
func RecordDelete() {
	atomic.AddInt64(&globalMetrics.Deletes, 1)
}

// RecordError 记录错误
func RecordError() {
	atomic.AddInt64(&globalMetrics.Errors, 1)
}

// RecordOperation 记录操作耗时（微秒）
func RecordOperation(duration time.Duration) {
	atomic.AddInt64(&globalMetrics.TotalTime, duration.Microseconds())
	atomic.AddInt64(&globalMetrics.Operations, 1)
}

// GetMetrics 获取当前指标
func GetMetrics() *Metrics {
	return &Metrics{
		Hits:       atomic.LoadInt64(&globalMetrics.Hits),
		Misses:     atomic.LoadInt64(&globalMetrics.Misses),
		Sets:       atomic.LoadInt64(&globalMetrics.Sets),
		Deletes:    atomic.LoadInt64(&globalMetrics.Deletes),
		Errors:     atomic.LoadInt64(&globalMetrics.Errors),
		TotalTime:  atomic.LoadInt64(&globalMetrics.TotalTime),
		Operations: atomic.LoadInt64(&globalMetrics.Operations),
	}
}

// HitRate 计算缓存命中率
func (m *Metrics) HitRate() float64 {
	total := m.Hits + m.Misses
	if total == 0 {
		return 0
	}
	return float64(m.Hits) / float64(total) * 100
}

// AvgOperationTime 计算平均操作耗时（微秒）
func (m *Metrics) AvgOperationTime() float64 {
	if m.Operations == 0 {
		return 0
	}
	return float64(m.TotalTime) / float64(m.Operations)
}

// ResetMetrics 重置指标
func ResetMetrics() {
	atomic.StoreInt64(&globalMetrics.Hits, 0)
	atomic.StoreInt64(&globalMetrics.Misses, 0)
	atomic.StoreInt64(&globalMetrics.Sets, 0)
	atomic.StoreInt64(&globalMetrics.Deletes, 0)
	atomic.StoreInt64(&globalMetrics.Errors, 0)
	atomic.StoreInt64(&globalMetrics.TotalTime, 0)
	atomic.StoreInt64(&globalMetrics.Operations, 0)
}
