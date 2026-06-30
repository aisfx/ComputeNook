//go:build linux

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"text/template"
	"bytes"
)

const desktopTmpl = `[Desktop Entry]
Name=HPC Client
Exec={{.Exe}} %u
Type=Application
NoDisplay=true
MimeType=x-scheme-handler/hpcc;
`

func install() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	exe, _ = filepath.Abs(exe)

	// 复制到 ~/.local/bin/
	binDir := filepath.Join(os.Getenv("HOME"), ".local", "bin")
	os.MkdirAll(binDir, 0755)
	dst := filepath.Join(binDir, "hpc-client")
	data, _ := os.ReadFile(exe)
	if err := os.WriteFile(dst, data, 0755); err != nil {
		return fmt.Errorf("复制可执行文件失败: %w", err)
	}

	// 写 .desktop 文件
	desktopDir := filepath.Join(os.Getenv("HOME"), ".local", "share", "applications")
	os.MkdirAll(desktopDir, 0755)

	var buf bytes.Buffer
	tmpl, _ := template.New("desktop").Parse(desktopTmpl)
	tmpl.Execute(&buf, map[string]string{"Exe": dst})

	desktopFile := filepath.Join(desktopDir, "hpc-client.desktop")
	if err := os.WriteFile(desktopFile, buf.Bytes(), 0644); err != nil {
		return fmt.Errorf("写 .desktop 文件失败: %w", err)
	}

	// 注册 MIME handler
	exec.Command("xdg-mime", "default", "hpc-client.desktop", "x-scheme-handler/hpcc").Run()
	exec.Command("update-desktop-database", desktopDir).Run()

	fmt.Printf("✅ 已安装到 %s\n", dst)
	fmt.Println("   如果浏览器无法识别，请运行:")
	fmt.Printf("   xdg-mime default hpc-client.desktop x-scheme-handler/hpcc\n")
	return nil
}
