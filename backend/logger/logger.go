package logger

import (
	"fmt"
	"log"
	"os"
)

var (
	debugEnabled = true
)

func init() {
	// 检查是否启用调试模式
	if os.Getenv("DEBUG") == "false" {
		debugEnabled = false
	}
}

// Debug 输出调试日志
func Debug(format string, v ...interface{}) {
	if debugEnabled {
		msg := fmt.Sprintf("[DEBUG] "+format, v...)
		log.Println(msg)
	}
}

// Info 输出信息日志
func Info(format string, v ...interface{}) {
	msg := fmt.Sprintf("[INFO] "+format, v...)
	log.Println(msg)
}

// Warn 输出警告日志
func Warn(format string, v ...interface{}) {
	msg := fmt.Sprintf("[WARN] "+format, v...)
	log.Println(msg)
}

// Error 输出错误日志
func Error(format string, v ...interface{}) {
	msg := fmt.Sprintf("[ERROR] "+format, v...)
	log.Println(msg)
}
