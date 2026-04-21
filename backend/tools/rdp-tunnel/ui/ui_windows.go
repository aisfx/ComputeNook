//go:build windows

package ui

import (
	"syscall"
	"unsafe"
)

var (
	user32      = syscall.NewLazyDLL("user32.dll")
	messageBox  = user32.NewProc("MessageBoxW")
)

const (
	mbOK        = 0x00000000
	mbOKCancel  = 0x00000001
	mbIconInfo  = 0x00000040
	mbIconWarn  = 0x00000030
	mbIconError = 0x00000010
)

func toUTF16(s string) *uint16 {
	p, _ := syscall.UTF16PtrFromString(s)
	return p
}

// Info 弹出信息框
func Info(title, msg string) {
	messageBox.Call(0,
		uintptr(unsafe.Pointer(toUTF16(msg))),
		uintptr(unsafe.Pointer(toUTF16(title))),
		mbOK|mbIconInfo)
}

// Warn 弹出警告框
func Warn(title, msg string) {
	messageBox.Call(0,
		uintptr(unsafe.Pointer(toUTF16(msg))),
		uintptr(unsafe.Pointer(toUTF16(title))),
		mbOK|mbIconWarn)
}

// Error 弹出错误框
func Error(title, msg string) {
	messageBox.Call(0,
		uintptr(unsafe.Pointer(toUTF16(msg))),
		uintptr(unsafe.Pointer(toUTF16(title))),
		mbOK|mbIconError)
}
