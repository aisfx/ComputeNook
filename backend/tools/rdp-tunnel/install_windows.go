//go:build windows

package main

import (
	"fmt"
	"os"
	"path/filepath"

	"golang.org/x/sys/windows/registry"
)

func install() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	exe, _ = filepath.Abs(exe)

	// HKEY_CURRENT_USER\Software\Classes\hpcc
	key, _, err := registry.CreateKey(registry.CURRENT_USER,
		`Software\Classes\hpcc`, registry.ALL_ACCESS)
	if err != nil {
		return fmt.Errorf("创建注册表键失败: %w", err)
	}
	defer key.Close()

	key.SetStringValue("", "URL:HPC Client Protocol")
	key.SetStringValue("URL Protocol", "")

	iconKey, _, _ := registry.CreateKey(key, `DefaultIcon`, registry.ALL_ACCESS)
	iconKey.SetStringValue("", exe+",0")
	iconKey.Close()

	cmdKey, _, _ := registry.CreateKey(key, `shell\open\command`, registry.ALL_ACCESS)
	cmdKey.SetStringValue("", fmt.Sprintf(`"%s" "%%1"`, exe))
	cmdKey.Close()

	return nil
}
