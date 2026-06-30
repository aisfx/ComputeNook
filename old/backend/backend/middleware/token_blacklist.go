package middleware

import (
	"sync"
	"time"
)

// tokenBlacklist 存储已登出的 token，key 为 token 字符串，value 为过期时间
type tokenBlacklist struct {
	mu      sync.RWMutex
	entries map[string]time.Time
}

var blacklist = &tokenBlacklist{
	entries: make(map[string]time.Time),
}

// RevokeToken 将 token 加入黑名单，expiry 为 JWT 的过期时间
func RevokeToken(token string, expiry time.Time) {
	blacklist.mu.Lock()
	defer blacklist.mu.Unlock()
	blacklist.entries[token] = expiry
	// 顺手清理已过期的条目
	now := time.Now()
	for k, v := range blacklist.entries {
		if now.After(v) {
			delete(blacklist.entries, k)
		}
	}
}

// IsTokenRevoked 检查 token 是否已被吊销
func IsTokenRevoked(token string) bool {
	blacklist.mu.RLock()
	defer blacklist.mu.RUnlock()
	exp, ok := blacklist.entries[token]
	if !ok {
		return false
	}
	// 已过期的条目视为无效（不是被吊销，而是自然过期）
	return time.Now().Before(exp)
}
