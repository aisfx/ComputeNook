package webshell

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// SessionLogger 会话日志记录器
type SessionLogger struct {
	SessionID string
	UserID    string
	Username  string
	Host      string
	LogFile   *os.File
	StartTime time.Time
}

// LogEntry 日志条目
type LogEntry struct {
	Timestamp time.Time   `json:"timestamp"`
	Type      string      `json:"type"` // command, output, event
	Content   string      `json:"content,omitempty"`
	Event     string      `json:"event,omitempty"`
	Data      interface{} `json:"data,omitempty"`
}

// NewSessionLogger 创建新的会话日志记录器
func NewSessionLogger(sessionID, userID, username, host string) *SessionLogger {
	logger := &SessionLogger{
		SessionID: sessionID,
		UserID:    userID,
		Username:  username,
		Host:      host,
		StartTime: time.Now(),
	}
	
	if err := logger.initLogFile(); err != nil {
		fmt.Printf("Failed to initialize log file: %v\n", err)
	}
	
	return logger
}

// initLogFile 初始化日志文件
func (sl *SessionLogger) initLogFile() error {
	// 创建日志目录
	logDir := filepath.Join("logs", "webshell", sl.UserID)
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return fmt.Errorf("failed to create log directory: %w", err)
	}
	
	// 创建日志文件名
	timestamp := sl.StartTime.Format("20060102_150405")
	filename := fmt.Sprintf("%s_%s_%s.log", timestamp, sl.Host, sl.SessionID[:8])
	logPath := filepath.Join(logDir, filename)
	
	// 打开日志文件
	file, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return fmt.Errorf("failed to open log file: %w", err)
	}
	
	sl.LogFile = file
	
	// 写入会话开始信息
	sl.writeLogEntry(LogEntry{
		Timestamp: sl.StartTime,
		Type:      "event",
		Event:     "session_start",
		Data: map[string]interface{}{
			"session_id": sl.SessionID,
			"user_id":    sl.UserID,
			"username":   sl.Username,
			"host":       sl.Host,
		},
	})
	
	return nil
}

// LogCommand 记录用户命令
func (sl *SessionLogger) LogCommand(command string) {
	entry := LogEntry{
		Timestamp: time.Now(),
		Type:      "command",
		Content:   command,
	}
	sl.writeLogEntry(entry)
}

// LogOutput 记录命令输出
func (sl *SessionLogger) LogOutput(output string) {
	entry := LogEntry{
		Timestamp: time.Now(),
		Type:      "output",
		Content:   output,
	}
	sl.writeLogEntry(entry)
}

// LogEvent 记录事件
func (sl *SessionLogger) LogEvent(event string, data interface{}) {
	entry := LogEntry{
		Timestamp: time.Now(),
		Type:      "event",
		Event:     event,
		Data:      data,
	}
	sl.writeLogEntry(entry)
}

// writeLogEntry 写入日志条目
func (sl *SessionLogger) writeLogEntry(entry LogEntry) {
	if sl.LogFile == nil {
		return
	}
	
	jsonData, err := json.Marshal(entry)
	if err != nil {
		fmt.Printf("Failed to marshal log entry: %v\n", err)
		return
	}
	
	if _, err := sl.LogFile.Write(append(jsonData, '\n')); err != nil {
		fmt.Printf("Failed to write log entry: %v\n", err)
	}
}

// Close 关闭日志记录器
func (sl *SessionLogger) Close() {
	if sl.LogFile != nil {
		// 记录会话结束
		sl.writeLogEntry(LogEntry{
			Timestamp: time.Now(),
			Type:      "event",
			Event:     "session_end",
			Data: map[string]interface{}{
				"duration": time.Since(sl.StartTime).Seconds(),
			},
		})
		
		sl.LogFile.Close()
		sl.LogFile = nil
	}
}

// GetLogPath 获取日志文件路径
func (sl *SessionLogger) GetLogPath() string {
	if sl.LogFile == nil {
		return ""
	}
	return sl.LogFile.Name()
}

// ReadSessionLogs 读取会话日志
func ReadSessionLogs(logPath string) ([]LogEntry, error) {
	file, err := os.Open(logPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open log file: %w", err)
	}
	defer file.Close()
	
	var entries []LogEntry
	decoder := json.NewDecoder(file)
	
	for decoder.More() {
		var entry LogEntry
		if err := decoder.Decode(&entry); err != nil {
			continue // 跳过无效的日志条目
		}
		entries = append(entries, entry)
	}
	
	return entries, nil
}

// ListUserLogs 列出用户的所有日志文件
func ListUserLogs(userID string) ([]string, error) {
	logDir := filepath.Join("logs", "webshell", userID)
	
	entries, err := os.ReadDir(logDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return nil, fmt.Errorf("failed to read log directory: %w", err)
	}
	
	var logFiles []string
	for _, entry := range entries {
		if !entry.IsDir() && filepath.Ext(entry.Name()) == ".log" {
			logFiles = append(logFiles, filepath.Join(logDir, entry.Name()))
		}
	}
	
	return logFiles, nil
}

// SearchLogs 搜索日志内容
func SearchLogs(logPath, searchTerm string) ([]LogEntry, error) {
	entries, err := ReadSessionLogs(logPath)
	if err != nil {
		return nil, err
	}
	
	var results []LogEntry
	for _, entry := range entries {
		if entry.Content != "" && contains(entry.Content, searchTerm) {
			results = append(results, entry)
		}
	}
	
	return results, nil
}

// contains 检查字符串是否包含子字符串（不区分大小写）
func contains(s, substr string) bool {
	return len(s) >= len(substr) && 
		   (s == substr || 
		    len(s) > len(substr) && 
		    (s[:len(substr)] == substr || 
		     s[len(s)-len(substr):] == substr || 
		     containsAt(s, substr, 1)))
}

func containsAt(s, substr string, start int) bool {
	if start >= len(s) {
		return false
	}
	if start+len(substr) > len(s) {
		return containsAt(s, substr, start+1)
	}
	if s[start:start+len(substr)] == substr {
		return true
	}
	return containsAt(s, substr, start+1)
}