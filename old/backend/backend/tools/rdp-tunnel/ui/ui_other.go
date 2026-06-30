//go:build !windows

package ui

import (
	"fmt"
	"os/exec"
	"runtime"
	"strings"
)

func Info(title, msg string) {
	if runtime.GOOS == "darwin" {
		darwinDialog("msgbox", title, msg)
		return
	}
	fmt.Printf("[%s] %s\n", title, msg)
}

func Warn(title, msg string) {
	if runtime.GOOS == "darwin" {
		darwinDialog("msgbox", title, msg)
		return
	}
	fmt.Printf("[%s] WARNING: %s\n", title, msg)
}

func Error(title, msg string) {
	if runtime.GOOS == "darwin" {
		darwinDialog("msgbox", title, msg)
		return
	}
	fmt.Printf("[%s] ERROR: %s\n", title, msg)
}

func CmdWindow(title, content string) { fmt.Printf("[%s]\n%s\n", title, content) }

// Confirm 弹出系统对话框，用户点「是」返回 true
func Confirm(title, msg string) bool {
	if runtime.GOOS == "darwin" {
		return darwinConfirm(title, msg)
	}
	fmt.Printf("[%s] %s\n", title, msg)
	return false
}

// darwinDialog 用 osascript 弹出信息框
func darwinDialog(kind, title, msg string) {
	script := fmt.Sprintf(`display dialog %q with title %q buttons {"确定"} default button "确定"`,
		msg, title)
	exec.Command("osascript", "-e", script).Run() //nolint:errcheck
}

// darwinConfirm 用 osascript 弹出是/否对话框，返回用户选择
func darwinConfirm(title, msg string) bool {
	script := fmt.Sprintf(`display dialog %q with title %q buttons {"否", "是"} default button "是"`,
		msg, title)
	out, err := exec.Command("osascript", "-e", script).Output()
	if err != nil {
		return false
	}
	return strings.Contains(string(out), "是")
}
