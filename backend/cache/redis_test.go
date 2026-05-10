package cache

import (
	"context"
	"os"
	"testing"
	"time"
)

func TestRedisConnection(t *testing.T) {
	// 设置测试环境变量
	os.Setenv("REDIS_ADDR", "localhost:6379")
	os.Setenv("REDIS_ENABLE", "true")

	// 初始化Redis
	err := InitRedis()
	if err != nil {
		t.Skipf("Redis not available: %v", err)
		return
	}
	defer Close()

	// 测试连接
	if !IsEnabled() {
		t.Fatal("Redis should be enabled")
	}
}

func TestCacheManager(t *testing.T) {
	os.Setenv("REDIS_ADDR", "localhost:6379")
	os.Setenv("REDIS_ENABLE", "true")

	if err := InitRedis(); err != nil {
		t.Skipf("Redis not available: %v", err)
		return
	}
	defer Close()

	mgr := NewManager()

	// 测试Set和Get
	t.Run("SetAndGet", func(t *testing.T) {
		key := "test:user:1"
		value := map[string]interface{}{
			"username": "testuser",
			"uid":      1000,
		}

		// Set
		err := mgr.Set(key, value, 1*time.Minute)
		if err != nil {
			t.Fatalf("Set failed: %v", err)
		}

		// Get
		var result map[string]interface{}
		err = mgr.Get(key, &result)
		if err != nil {
			t.Fatalf("Get failed: %v", err)
		}

		if result["username"] != "testuser" {
			t.Errorf("Expected username=testuser, got %v", result["username"])
		}

		// Cleanup
		mgr.Delete(key)
	})

	// 测试Incr
	t.Run("Incr", func(t *testing.T) {
		key := "test:counter"
		
		count, err := mgr.Incr(key, 1*time.Minute)
		if err != nil {
			t.Fatalf("Incr failed: %v", err)
		}
		if count != 1 {
			t.Errorf("Expected count=1, got %d", count)
		}

		count, err = mgr.Incr(key, 1*time.Minute)
		if err != nil {
			t.Fatalf("Incr failed: %v", err)
		}
		if count != 2 {
			t.Errorf("Expected count=2, got %d", count)
		}

		// Cleanup
		mgr.Delete(key)
	})

	// 测试Exists
	t.Run("Exists", func(t *testing.T) {
		key := "test:exists"
		
		if mgr.Exists(key) {
			t.Error("Key should not exist")
		}

		mgr.SetString(key, "value", 1*time.Minute)
		
		if !mgr.Exists(key) {
			t.Error("Key should exist")
		}

		// Cleanup
		mgr.Delete(key)
	})

	// 测试DeletePattern
	t.Run("DeletePattern", func(t *testing.T) {
		// 创建多个测试Key
		mgr.SetString("test:pattern:1", "value1", 1*time.Minute)
		mgr.SetString("test:pattern:2", "value2", 1*time.Minute)
		mgr.SetString("test:pattern:3", "value3", 1*time.Minute)

		// 删除匹配的Key
		err := mgr.DeletePattern("test:pattern:*")
		if err != nil {
			t.Fatalf("DeletePattern failed: %v", err)
		}

		// 验证已删除
		if mgr.Exists("test:pattern:1") {
			t.Error("Key should be deleted")
		}
	})
}

func TestDistributedLock(t *testing.T) {
	os.Setenv("REDIS_ADDR", "localhost:6379")
	os.Setenv("REDIS_ENABLE", "true")

	if err := InitRedis(); err != nil {
		t.Skipf("Redis not available: %v", err)
		return
	}
	defer Close()

	ctx := context.Background()

	t.Run("AcquireAndRelease", func(t *testing.T) {
		lock := NewLock("test:lock:1", 10*time.Second)

		// 获取锁
		err := lock.Acquire(ctx)
		if err != nil {
			t.Fatalf("Acquire failed: %v", err)
		}

		// 尝试再次获取（应该失败）
		lock2 := NewLock("test:lock:1", 10*time.Second)
		err = lock2.Acquire(ctx)
		if err != ErrLockFailed {
			t.Error("Should fail to acquire lock")
		}

		// 释放锁
		err = lock.Release(ctx)
		if err != nil {
			t.Fatalf("Release failed: %v", err)
		}

		// 现在应该可以获取
		err = lock2.Acquire(ctx)
		if err != nil {
			t.Fatalf("Should acquire lock after release: %v", err)
		}

		lock2.Release(ctx)
	})

	t.Run("WithLock", func(t *testing.T) {
		executed := false
		
		err := WithLock(ctx, "test:lock:2", 10*time.Second, func() error {
			executed = true
			return nil
		})

		if err != nil {
			t.Fatalf("WithLock failed: %v", err)
		}

		if !executed {
			t.Error("Function should be executed")
		}
	})
}

func TestMetrics(t *testing.T) {
	// 重置指标
	ResetMetrics()

	// 记录一些操作
	RecordHit()
	RecordHit()
	RecordMiss()
	RecordSet()
	RecordDelete()
	RecordOperation(100 * time.Microsecond)
	RecordOperation(200 * time.Microsecond)

	// 获取指标
	metrics := GetMetrics()

	if metrics.Hits != 2 {
		t.Errorf("Expected 2 hits, got %d", metrics.Hits)
	}

	if metrics.Misses != 1 {
		t.Errorf("Expected 1 miss, got %d", metrics.Misses)
	}

	hitRate := metrics.HitRate()
	expectedRate := 66.66666666666666
	if hitRate < expectedRate-0.1 || hitRate > expectedRate+0.1 {
		t.Errorf("Expected hit rate ~%.2f%%, got %.2f%%", expectedRate, hitRate)
	}

	avgTime := metrics.AvgOperationTime()
	expectedAvg := 150.0
	if avgTime != expectedAvg {
		t.Errorf("Expected avg time %.2f, got %.2f", expectedAvg, avgTime)
	}
}
