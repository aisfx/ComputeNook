package cache

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrLockFailed   = errors.New("failed to acquire lock")
	ErrLockNotHeld  = errors.New("lock not held")
)

// DistributedLock 分布式锁
type DistributedLock struct {
	key   string
	value string
	ttl   time.Duration
}

// NewLock 创建分布式锁
func NewLock(key string, ttl time.Duration) *DistributedLock {
	return &DistributedLock{
		key:   "lock:" + key,
		value: uuid.New().String(),
		ttl:   ttl,
	}
}

// Acquire 获取锁
func (l *DistributedLock) Acquire(ctx context.Context) error {
	if !IsEnabled() {
		return ErrCacheDisabled
	}

	ok, err := Client.SetNX(ctx, l.key, l.value, l.ttl).Result()
	if err != nil {
		return err
	}

	if !ok {
		return ErrLockFailed
	}

	return nil
}

// TryAcquire 尝试获取锁（带重试）
func (l *DistributedLock) TryAcquire(ctx context.Context, retries int, interval time.Duration) error {
	for i := 0; i < retries; i++ {
		err := l.Acquire(ctx)
		if err == nil {
			return nil
		}

		if err != ErrLockFailed {
			return err
		}

		// 等待后重试
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(interval):
			continue
		}
	}

	return ErrLockFailed
}

// Release 释放锁（使用Lua脚本保证原子性）
func (l *DistributedLock) Release(ctx context.Context) error {
	if !IsEnabled() {
		return ErrCacheDisabled
	}

	// Lua脚本：只有持有锁的客户端才能释放
	script := `
		if redis.call("get", KEYS[1]) == ARGV[1] then
			return redis.call("del", KEYS[1])
		else
			return 0
		end
	`

	result, err := Client.Eval(ctx, script, []string{l.key}, l.value).Result()
	if err != nil {
		return err
	}

	if result.(int64) == 0 {
		return ErrLockNotHeld
	}

	return nil
}

// Extend 延长锁的过期时间
func (l *DistributedLock) Extend(ctx context.Context, ttl time.Duration) error {
	if !IsEnabled() {
		return ErrCacheDisabled
	}

	// Lua脚本：只有持有锁的客户端才能延期
	script := `
		if redis.call("get", KEYS[1]) == ARGV[1] then
			return redis.call("expire", KEYS[1], ARGV[2])
		else
			return 0
		end
	`

	result, err := Client.Eval(ctx, script, []string{l.key}, l.value, int(ttl.Seconds())).Result()
	if err != nil {
		return err
	}

	if result.(int64) == 0 {
		return ErrLockNotHeld
	}

	return nil
}

// WithLock 在锁保护下执行函数
func WithLock(ctx context.Context, key string, ttl time.Duration, fn func() error) error {
	lock := NewLock(key, ttl)

	// 获取锁
	if err := lock.Acquire(ctx); err != nil {
		return err
	}

	// 确保释放锁
	defer lock.Release(ctx)

	// 执行函数
	return fn()
}
