package webshell

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"unicode"
)

// SessionLogger 会话日志记录器
type SessionLogger struct {
	SessionID string
	UserID    string
	Username  string
	Host      string
	LogFile   *os.File
	StartTime time.Time
	mu        sync.Mutex

	// 命令缓冲：从原始终端字节流中重建用户输入的命令
	cmdBuf    strings.Builder
	lastFlush time.Time
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
		lastFlush: time.Now(),
	}
	if err := logger.initLogFile(); err != nil {
		fmt.Printf("Failed to initialize log file: %v\n", err)
	}
	return logger
}

func (sl *SessionLogger) initLogFile() error {
	logDir := filepath.Join("logs", "webshell", sl.UserID)
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return fmt.Errorf("failed to create log directory: %w", err)
	}
	timestamp := sl.StartTime.Format("20060102_150405")
	filename := fmt.Sprintf("%s_%s_%s.log", timestamp, sl.Host, sl.SessionID[:8])
	logPath := filepath.Join(logDir, filename)
	file, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return fmt.Errorf("failed to open log file: %w", err)
	}
	sl.LogFile = file
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

// LogInput 记录原始终端输入，解析出完整命令行后再落盘
func (sl *SessionLogger) LogInput(raw []byte) {
	sl.mu.Lock()
	defer sl.mu.Unlock()
	for _, b := range raw {
		switch {
		case b == '\r' || b == '\n':
			cmd := strings.TrimSpace(sl.cmdBuf.String())
			if cmd != "" {
				sl.writeLogEntry(LogEntry{
					Timestamp: time.Now(),
					Type:      "command",
					Content:   cmd,
				})
			}
			sl.cmdBuf.Reset()
		case b == 127 || b == '\b':
			s := sl.cmdBuf.String()
			if len(s) > 0 {
				runes := []rune(s)
				sl.cmdBuf.Reset()
				sl.cmdBuf.WriteString(string(runes[:len(runes)-1]))
			}
		case b == 3:
			if sl.cmdBuf.Len() > 0 {
				sl.writeLogEntry(LogEntry{
					Timestamp: time.Now(),
					Type:      "command",
					Content:   sl.cmdBuf.String() + " [^C]",
				})
				sl.cmdBuf.Reset()
			}
		case b == 4:
			sl.writeLogEntry(LogEntry{Timestamp: time.Now(), Type: "event", Event: "ctrl_d"})
		case b < 32:
			// 其他控制字符忽略
		default:
			if unicode.IsPrint(rune(b)) {
				sl.cmdBuf.WriteByte(b)
			}
		}
	}
	if sl.cmdBuf.Len() > 0 && time.Since(sl.lastFlush) > 5*time.Second {
		sl.writeLogEntry(LogEntry{
			Timestamp: time.Now(),
			Type:      "command",
			Content:   sl.cmdBuf.String() + " [partial]",
		})
		sl.cmdBuf.Reset()
		sl.lastFlush = time.Now()
	}
}

// LogCommand 直接记录命令字符串
func (sl *SessionLogger) LogCommand(command string) {
	sl.mu.Lock()
	defer sl.mu.Unlock()
	sl.writeLogEntry(LogEntry{Timestamp: time.Now(), Type: "command", Content: command})
}

// LogOutput 记录命令输出（过滤 ANSI 转义序列）
func (sl *SessionLogger) LogOutput(output string) {
	cleaned := stripANSI(output)
	if strings.TrimSpace(cleaned) == "" {
		return
	}
	sl.mu.Lock()
	defer sl.mu.Unlock()
	sl.writeLogEntry(LogEntry{Timestamp: time.Now(), Type: "output", Content: cleaned})
}

// LogEvent 记录事件
func (sl *SessionLogger) LogEvent(event string, data interface{}) {
	sl.mu.Lock()
	defer sl.mu.Unlock()
	sl.writeLogEntry(LogEntry{Timestamp: time.Now(), Type: "event", Event: event, Data: data})
}

func (sl *SessionLogger) writeLogEntry(entry LogEntry) {
	if sl.LogFile == nil {
		return
	}
	jsonData, err := json.Marshal(entry)
	if err != nil {
		return
	}
	sl.LogFile.Write(append(jsonData, '\n'))
	sl.LogFile.Sync()
}

// Close 关闭日志记录器
func (sl *SessionLogger) Close() {
	sl.mu.Lock()
	defer sl.mu.Unlock()
	if sl.LogFile != nil {
		sl.writeLogEntry(LogEntry{
			Timestamp: time.Now(),
			Type:      "event",
			Event:     "session_end",
			Data:      map[string]interface{}{"duration_seconds": time.Since(sl.StartTime).Seconds()},
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
			continue
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
	lower := strings.ToLower(searchTerm)
	var results []LogEntry
	for _, entry := range entries {
		if strings.Contains(strings.ToLower(entry.Content), lower) {
			results = append(results, entry)
		}
	}
	return results, nil
}

// stripANSI 去除 ANSI 转义序列
func stripANSI(s string) string {
	var out strings.Builder
	i := 0
	for i < len(s) {
		if s[i] == '\x1b' && i+1 < len(s) && s[i+1] == '[' {
			i += 2
			for i < len(s) && (s[i] < 0x40 || s[i] > 0x7e) {
				i++
			}
			i++
		} else if s[i] >= 0x20 || s[i] == '\n' || s[i] == '\r' || s[i] == '\t' {
			out.WriteByte(s[i])
			i++
		} else {
			i++
		}
	}
	return out.String()
}
