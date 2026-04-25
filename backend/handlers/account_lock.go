package handlers

import (
	"sync"
	"time"
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
	// 定期清理过期记录
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

// recordLoginFailure 记录一次登录失败，返回是否刚刚触发锁定
func recordLoginFailure(username string) {
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
	accountLockMu.Lock()
	defer accountLockMu.Unlock()
	delete(accountLocks, username)
}

// getFailCount 获取当前失败次数（用于告知前端还剩几次）
func getFailCount(username string) int {
	accountLockMu.Lock()
	defer accountLockMu.Unlock()
	if e, ok := accountLocks[username]; ok {
		return e.failCount
	}
	return 0
}
