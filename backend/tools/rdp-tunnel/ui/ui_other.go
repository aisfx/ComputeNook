//go:build !windows

package ui

import "fmt"

func Info(title, msg string)          { fmt.Printf("[%s] %s\n", title, msg) }
func Warn(title, msg string)          { fmt.Printf("[%s] WARNING: %s\n", title, msg) }
func Error(title, msg string)         { fmt.Printf("[%s] ERROR: %s\n", title, msg) }
func CmdWindow(title, content string) { fmt.Printf("[%s]\n%s\n", title, content) }
func Confirm(title, msg string) bool  { fmt.Printf("[%s] %s\n", title, msg); return false }
