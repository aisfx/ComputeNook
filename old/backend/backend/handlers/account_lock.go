package handlers

import (
	"sync"
	"time"

	"hpc-backend/cache"
)

const (
	lockMaxAttempts = 3
	lockDuration    = 10 * time.Minute
)

type accountLockEntry struct {
	failCount int
	lockedAt  time.Time
	lastFail  time.Time
}

var (
	accountLockMu sync.Mutex
	accountLocks  = map[string]*accountLockEntry{}
)

func init() {
	// 定期清理过期记录（仅用于内存备份）
	go func() {
		for range time.Tick(5 * time.Minute) {
			accountLockMu.Lock()
			now := time.Now()
			for username, e := range accountLocks {
				// 锁定已过期且最后失败超过30分钟，清理
				if now.Sub(e.lastFail) > 30*time.Minute {
					delete(accountLocks, username)
				}
			}
			accountLockMu.Unlock()
		}
	}()
}

// isAccountLocked 检查账户是否被锁定，返回 (locked, remainingSeconds)
func isAccountLocked(username string) (bool, int) {
	// 优先使用Redis
	if cache.IsEnabled() {
		lockKey := cache.AccountLockKey(username)
		ttl, err := cache.NewManager().TTL(lockKey)
		if err == nil && ttl > 0 {
			return true, int(ttl.Seconds()) + 1
		}
		return false, 0
	}

	// Redis不可用时使用内存备份
	accountLockMu.Lock()
	defer accountLockMu.Unlock()

	e, ok := accountLocks[username]
	if !ok {
		return false, 0
	}
	if e.lockedAt.IsZero() {
		return false, 0
	}
	remaining := lockDuration - time.Since(e.lockedAt)
	if remaining <= 0 {
		// 锁定已过期，重置
		delete(accountLocks, username)
		return false, 0
	}
	return true, int(remaining.Seconds()) + 1
}

// recordLoginFailure 记录一次登录失败
func recordLoginFailure(username string) {
	// 优先使用Redis
	if cache.IsEnabled() {
		mgr := cache.NewManager()
		failKey := cache.LoginFailKey(username)
		
		// 递增失败计数
		count, err := mgr.Incr(failKey, 15*time.Minute)
		if err == nil && count >= lockMaxAttempts {
			// 触发锁定
			lockKey := cache.AccountLockKey(username)
			mgr.SetString(lockKey, "locked", lockDuration)
		}
		return
	}

	// Redis不可用时使用内存备份
	accountLockMu.Lock()
	defer accountLockMu.Unlock()

	e, ok := accountLocks[username]
	if !ok {
		e = &accountLockEntry{}
		accountLocks[username] = e
	}
	e.failCount++
	e.lastFail = time.Now()
	if e.failCount >= lockMaxAttempts {
		e.lockedAt = time.Now()
	}
}

// resetLoginFailure 登录成功后重置
func resetLoginFailure(username string) {
	// 优先使用Redis
	if cache.IsEnabled() {
		mgr := cache.NewManager()
		mgr.Delete(cache.LoginFailKey(username), cache.AccountLockKey(username))
		return
	}

	// Redis不可用时使用内存备份
	accountLockMu.Lock()
	defer accountLockMu.Unlock()
	delete(accountLocks, username)
}

// getFailCount 获取当前失败次数（用于告知前端还剩几次）
func getFailCount(username string) int {
	// 优先使用Redis
	if cache.IsEnabled() {
		failKey := cache.LoginFailKey(username)
		count, err := cache.NewManager().GetInt(failKey)
		if err == nil {
			return int(count)
		}
		return 0
	}

	// Redis不可用时使用内存备份
	accountLockMu.Lock()
	defer accountLockMu.Unlock()
	if e, ok := accountLocks[username]; ok {
		return e.failCount
	}
	return 0
}
