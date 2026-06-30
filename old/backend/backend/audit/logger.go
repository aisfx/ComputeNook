package audit

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"hpc-backend/models"
)

var (
	auditLogger *Logger
	once        sync.Once
)

// Logger 审计日志记录器
type Logger struct {
	logFile  *os.File
	mu       sync.Mutex
	logDir   string
	logs     []models.AuditLog // 内存中的日志缓存
	maxLogs  int               // 最大缓存日志数
	nextID   int64
}

// GetLogger 获取审计日志记录器单例
func GetLogger() *Logger {
	once.Do(func() {
		logDir := os.Getenv("AUDIT_LOG_DIR")
		if logDir == "" {
			logDir = "./logs/audit"
		}

		auditLogger = &Logger{
			logDir:  logDir,
			logs:    make([]models.AuditLog, 0),
			maxLogs: 10000, // 最多缓存10000条日志
			nextID:  1,
		}

		// 创建日志目录
		if err := os.MkdirAll(logDir, 0755); err != nil {
			fmt.Printf("Failed to create audit log directory: %v\n", err)
		}

		// 打开日志文件
		if err := auditLogger.openLogFile(); err != nil {
			fmt.Printf("Failed to open audit log file: %v\n", err)
		}

		// 加载现有日志
		auditLogger.loadLogs()
	})
	return auditLogger
}

// openLogFile 打开日志文件
func (l *Logger) openLogFile() error {
	today := time.Now().Format("2006-01-02")
	logPath := filepath.Join(l.logDir, fmt.Sprintf("audit-%s.log", today))

	file, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return err
	}

	l.logFile = file
	return nil
}

// Log 记录审计日志
func (l *Logger) Log(log models.AuditLog) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	// 设置ID和时间戳
	log.ID = l.nextID
	l.nextID++
	log.Timestamp = time.Now()

	// 写入文件
	if l.logFile != nil {
		logJSON, err := json.Marshal(log)
		if err != nil {
			return err
		}
		if _, err := l.logFile.WriteString(string(logJSON) + "\n"); err != nil {
			return err
		}
		l.logFile.Sync()
	}

	// 添加到内存缓存
	l.logs = append(l.logs, log)

	// 如果超过最大缓存数，删除最旧的日志
	if len(l.logs) > l.maxLogs {
		l.logs = l.logs[len(l.logs)-l.maxLogs:]
	}

	return nil
}

// GetLogs 获取日志列表
func (l *Logger) GetLogs(filter LogFilter) []models.AuditLog {
	l.mu.Lock()
	defer l.mu.Unlock()

	result := make([]models.AuditLog, 0)

	for i := len(l.logs) - 1; i >= 0; i-- {
		log := l.logs[i]

		// 应用过滤条件
		if filter.Username != "" && log.Username != filter.Username {
			continue
		}
		if filter.Action != "" && log.Action != filter.Action {
			continue
		}
		if filter.Resource != "" && log.Resource != filter.Resource {
			continue
		}
		if filter.Status != "" && log.Status != filter.Status {
			continue
		}
		if !filter.StartTime.IsZero() && log.Timestamp.Before(filter.StartTime) {
			continue
		}
		if !filter.EndTime.IsZero() && log.Timestamp.After(filter.EndTime) {
			continue
		}

		result = append(result, log)

		// 限制返回数量
		if filter.Limit > 0 && len(result) >= filter.Limit {
			break
		}
	}

	return result
}

// GetLogByID 根据ID获取日志
func (l *Logger) GetLogByID(id int64) *models.AuditLog {
	l.mu.Lock()
	defer l.mu.Unlock()

	for i := len(l.logs) - 1; i >= 0; i-- {
		if l.logs[i].ID == id {
			return &l.logs[i]
		}
	}

	return nil
}

// loadLogs 从文件加载日志
func (l *Logger) loadLogs() {
	today := time.Now().Format("2006-01-02")
	logPath := filepath.Join(l.logDir, fmt.Sprintf("audit-%s.log", today))

	file, err := os.Open(logPath)
	if err != nil {
		// 文件不存在是正常的
		return
	}
	defer file.Close()

	decoder := json.NewDecoder(file)
	for decoder.More() {
		var log models.AuditLog
		if err := decoder.Decode(&log); err != nil {
			continue
		}
		l.logs = append(l.logs, log)
		if log.ID >= l.nextID {
			l.nextID = log.ID + 1
		}
	}
}

// GetStats 获取统计信息
func (l *Logger) GetStats() map[string]interface{} {
	l.mu.Lock()
	defer l.mu.Unlock()

	stats := map[string]interface{}{
		"total_logs": len(l.logs),
		"by_action":  make(map[string]int),
		"by_resource": make(map[string]int),
		"by_status":  make(map[string]int),
		"by_user":    make(map[string]int),
	}

	for _, log := range l.logs {
		// 按操作类型统计
		if actionMap, ok := stats["by_action"].(map[string]int); ok {
			actionMap[log.Action]++
		}

		// 按资源类型统计
		if resourceMap, ok := stats["by_resource"].(map[string]int); ok {
			resourceMap[log.Resource]++
		}

		// 按状态统计
		if statusMap, ok := stats["by_status"].(map[string]int); ok {
			statusMap[log.Status]++
		}

		// 按用户统计
		if userMap, ok := stats["by_user"].(map[string]int); ok {
			userMap[log.Username]++
		}
	}

	return stats
}

// LogFilter 日志过滤条件
type LogFilter struct {
	Username  string
	Action    string
	Resource  string
	Status    string
	StartTime time.Time
	EndTime   time.Time
	Limit     int
}

// Close 关闭日志文件
func (l *Logger) Close() error {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.logFile != nil {
		return l.logFile.Close()
	}
	return nil
}
