package logger

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"time"
)

var (
	debugEnabled = true
	fileLogger   *log.Logger
	logFile      *os.File
)

func init() {
	if os.Getenv("DEBUG") == "false" {
		debugEnabled = false
	}
	initFileLogger()
}

func initFileLogger() {
	logPath := os.Getenv("LOG_FILE")
	if logPath == "" {
		logPath = "slurm-web.log"
	}

	// 确保日志目录存在
	if dir := filepath.Dir(logPath); dir != "." && dir != "" {
		_ = os.MkdirAll(dir, 0755)
	}

	f, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		log.Printf("[WARN] Failed to open log file %s: %v, logging to stdout only\n", logPath, err)
		return
	}
	logFile = f

	// 同时写文件和 stdout
	multi := io.MultiWriter(os.Stdout, f)
	log.SetOutput(multi)
	log.SetFlags(0) // 关闭默认前缀，由我们自己加时间戳

	fileLogger = log.New(multi, "", 0)
}

// Close 关闭日志文件（程序退出时调用）
func Close() {
	if logFile != nil {
		_ = logFile.Close()
	}
}

func timestamp() string {
	return time.Now().Format("2006-01-02 15:04:05")
}

func write(level, format string, v ...interface{}) {
	msg := fmt.Sprintf(format, v...)
	line := fmt.Sprintf("%s [%s] %s", timestamp(), level, msg)
	log.Println(line)
}

// Debug 输出调试日志
func Debug(format string, v ...interface{}) {
	if debugEnabled {
		write("DEBUG", format, v...)
	}
}

// Info 输出信息日志
func Info(format string, v ...interface{}) {
	write("INFO", format, v...)
}

// Warn 输出警告日志
func Warn(format string, v ...interface{}) {
	write("WARN", format, v...)
}

// Error 输出错误日志
func Error(format string, v ...interface{}) {
	write("ERROR", format, v...)
}
