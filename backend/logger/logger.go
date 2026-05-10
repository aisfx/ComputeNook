package logger

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	levelDebug = iota
	levelInfo
	levelWarn
	levelError
)

var (
	minLevel   = levelInfo
	fileLogger *log.Logger
	logFile    *os.File
)

func init() {
	// Support both LOG_LEVEL and legacy DEBUG=false
	switch strings.ToLower(strings.TrimSpace(os.Getenv("LOG_LEVEL"))) {
	case "debug":
		minLevel = levelDebug
	case "warn", "warning":
		minLevel = levelWarn
	case "error":
		minLevel = levelError
	default:
		minLevel = levelInfo
	}
	// Legacy: DEBUG=false suppresses debug output
	if os.Getenv("DEBUG") == "false" && minLevel < levelInfo {
		minLevel = levelInfo
	}

	initFileLogger()
}

func initFileLogger() {
	logPath := os.Getenv("LOG_FILE")
	if logPath == "" {
		logPath = "logs/compute-nook.log"
	}

	if dir := filepath.Dir(logPath); dir != "." && dir != "" {
		_ = os.MkdirAll(dir, 0755)
	}

	f, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		log.Printf("[WARN] Failed to open log file %s: %v, logging to stdout only\n", logPath, err)
		return
	}
	logFile = f

	multi := io.MultiWriter(os.Stdout, f)
	log.SetOutput(multi)
	log.SetFlags(0)
	fileLogger = log.New(multi, "", 0)
}

// Close closes the log file (call on program exit)
func Close() {
	if logFile != nil {
		_ = logFile.Close()
	}
}

func timestamp() string {
	return time.Now().Format("2006-01-02 15:04:05")
}

func write(label, format string, v ...interface{}) {
	msg := fmt.Sprintf(format, v...)
	log.Printf("%s [%s] %s", timestamp(), label, msg)
}

// Debug logs at DEBUG level
func Debug(format string, v ...interface{}) {
	if minLevel <= levelDebug {
		write("DEBUG", format, v...)
	}
}

// Info logs at INFO level
func Info(format string, v ...interface{}) {
	if minLevel <= levelInfo {
		write("INFO", format, v...)
	}
}

// Warn logs at WARN level
func Warn(format string, v ...interface{}) {
	if minLevel <= levelWarn {
		write("WARN", format, v...)
	}
}

// Error logs at ERROR level
func Error(format string, v ...interface{}) {
	if minLevel <= levelError {
		write("ERROR", format, v...)
	}
}
