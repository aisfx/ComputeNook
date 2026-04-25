//go:build windows

package ui

import (
	"fmt"
	"os"
	"os/exec"
	"syscall"
	"unsafe"
)

var (
	user32     = syscall.NewLazyDLL("user32.dll")
	messageBox = user32.NewProc("MessageBoxW")
)

const (
	mbOK        = 0x00000000
	mbIconInfo  = 0x00000040
	mbIconWarn  = 0x00000030
	mbIconError = 0x00000010
)

func toUTF16(s string) *uint16 {
	p, _ := syscall.UTF16PtrFromString(s)
	return p
}

// Info 弹出 MessageBox 信息框（用于安装成功等需要用户确认的场景）
func Info(title, msg string) {
	messageBox.Call(0,
		uintptr(unsafe.Pointer(toUTF16(msg))),
		uintptr(unsafe.Pointer(toUTF16(title))),
		mbOK|mbIconInfo)
}

// Warn 弹出 MessageBox 警告框
func Warn(title, msg string) {
	messageBox.Call(0,
		uintptr(unsafe.Pointer(toUTF16(msg))),
		uintptr(unsafe.Pointer(toUTF16(title))),
		mbOK|mbIconWarn)
}

// Error 弹出 MessageBox 错误框
func Error(title, msg string) {
	messageBox.Call(0,
		uintptr(unsafe.Pointer(toUTF16(msg))),
		uintptr(unsafe.Pointer(toUTF16(title))),
		mbOK|mbIconError)
}

// CmdWindow 弹出 cmd 窗口显示内容（用于 SSH 连接信息等需要用户操作的场景）
func CmdWindow(title, content string) {
	script := fmt.Sprintf("@echo off\r\ntitle %s\r\n%s\r\n", title, content)
	batFile := os.TempDir() + `\hpc-client-cmd.bat`
	if err := os.WriteFile(batFile, []byte(script), 0600); err == nil {
		exec.Command("cmd", "/c", "start", "cmd", "/k", batFile).Start() //nolint:errcheck
	}
}
