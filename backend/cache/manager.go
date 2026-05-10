package cache

import (
	"context"
	"encoding/json"
	"errors"
	"time"
)

var (
	ErrCacheDisabled = errors.New("cache is disabled")
	ErrCacheMiss     = errors.New("cache miss")
)

// Manager 缓存管理器
type Manager struct {
	ctx context.Context
}

// NewManager 创建缓存管理器实例
func NewManager() *Manager {
	return &Manager{ctx: context.Background()}
}

// Get 获取缓存数据
func (m *Manager) Get(key string, dest interface{}) error {
	if !IsEnabled() {
		return ErrCacheDisabled
	}

	val, err := Client.Get(m.ctx, key).Result()
	if err != nil {
		if err.Error() == "redis: nil" {
			return ErrCacheMiss
		}
		return err
	}

	return json.Unmarshal([]byte(val), dest)
}

// Set 设置缓存数据
func (m *Manager) Set(key string, value interface{}, ttl time.Duration) error {
	if !IsEnabled() {
		return ErrCacheDisabled
	}

	data, err := json.Marshal(value)
	if err != nil {
		return err
	}

	return Client.Set(m.ctx, key, data, ttl).Err()
}

// Delete 删除单个或多个缓存Key
func (m *Manager) Delete(keys ...string) error {
	if !IsEnabled() {
		return ErrCacheDisabled
	}

	if len(keys) == 0 {
		return nil
	}

	return Client.Del(m.ctx, keys...).Err()
}

// DeletePattern 批量删除匹配模式的Key
func (m *Manager) DeletePattern(pattern string) error {
	if !IsEnabled() {
		return ErrCacheDisabled
	}

	iter := Client.Scan(m.ctx, 0, pattern, 0).Iterator()
	var keys []string
	
	for iter.Next(m.ctx) {
		keys = append(keys, iter.Val())
	}
	
	if err := iter.Err(); err != nil {
		return err
	}

	if len(keys) > 0 {
		return Client.Del(m.ctx, keys...).Err()
	}

	return nil
}

// Exists 检查Key是否存在
func (m *Manager) Exists(key string) bool {
	if !IsEnabled() {
		return false
	}

	n, err := Client.Exists(m.ctx, key).Result()
	return err == nil && n > 0
}

// Incr 计数器递增
func (m *Manager) Incr(key string, ttl time.Duration) (int64, error) {
	if !IsEnabled() {
		return 0, ErrCacheDisabled
	}

	val, err := Client.Incr(m.ctx, key).Result()
	if err != nil {
		return 0, err
	}

	// 如果是第一次递增，设置过期时间
	if val == 1 && ttl > 0 {
		Client.Expire(m.ctx, key, ttl)
	}

	return val, nil
}

// Decr 计数器递减
func (m *Manager) Decr(key string) (int64, error) {
	if !IsEnabled() {
		return 0, ErrCacheDisabled
	}

	return Client.Decr(m.ctx, key).Result()
}

// GetInt 获取整数值
func (m *Manager) GetInt(key string) (int64, error) {
	if !IsEnabled() {
		return 0, ErrCacheDisabled
	}

	return Client.Get(m.ctx, key).Int64()
}

// SetInt 设置整数值
func (m *Manager) SetInt(key string, value int64, ttl time.Duration) error {
	if !IsEnabled() {
		return ErrCacheDisabled
	}

	return Client.Set(m.ctx, key, value, ttl).Err()
}

// GetString 获取字符串值
func (m *Manager) GetString(key string) (string, error) {
	if !IsEnabled() {
		return "", ErrCacheDisabled
	}

	return Client.Get(m.ctx, key).Result()
}

// SetString 设置字符串值
func (m *Manager) SetString(key string, value string, ttl time.Duration) error {
	if !IsEnabled() {
		return ErrCacheDisabled
	}

	return Client.Set(m.ctx, key, value, ttl).Err()
}

// Expire 设置Key过期时间
func (m *Manager) Expire(key string, ttl time.Duration) error {
	if !IsEnabled() {
		return ErrCacheDisabled
	}

	return Client.Expire(m.ctx, key, ttl).Err()
}

// TTL 获取Key剩余过期时间
func (m *Manager) TTL(key string) (time.Duration, error) {
	if !IsEnabled() {
		return 0, ErrCacheDisabled
	}

	return Client.TTL(m.ctx, key).Result()
}

// FlushAll 清空所有缓存（慎用）
func (m *Manager) FlushAll() error {
	if !IsEnabled() {
		return ErrCacheDisabled
	}

	return Client.FlushDB(m.ctx).Err()
}

// GetOrSet 获取缓存，如果不存在则执行回调函数并缓存结果
func (m *Manager) GetOrSet(key string, dest interface{}, ttl time.Duration, fn func() (interface{}, error)) error {
	// 尝试从缓存获取
	err := m.Get(key, dest)
	if err == nil {
		return nil
	}

	// 缓存未命中，执行回调函数
	if err == ErrCacheMiss || err == ErrCacheDisabled {
		result, err := fn()
		if err != nil {
			return err
		}

		// 缓存结果
		if IsEnabled() {
			m.Set(key, result, ttl)
		}

		// 将结果赋值给dest
		data, _ := json.Marshal(result)
		return json.Unmarshal(data, dest)
	}

	return err
}
