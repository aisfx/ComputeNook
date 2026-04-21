//go:build darwin

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"text/template"
	"bytes"
)

const plistTmpl = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key>
  <string>com.hpc.client</string>
  <key>CFBundleName</key>
  <string>HPC Client</string>
  <key>CFBundleExecutable</key>
  <string>hpc-client</string>
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleURLName</key>
      <string>HPC Client Protocol</string>
      <key>CFBundleURLSchemes</key>
      <array>
        <string>hpcc</string>
      </array>
    </dict>
  </array>
  <key>LSUIElement</key>
  <true/>
</dict>
</plist>
`

func install() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	exe, _ = filepath.Abs(exe)

	// 创建 .app bundle
	appDir := filepath.Join(os.Getenv("HOME"), "Applications", "HPC Client.app")
	macosDir := filepath.Join(appDir, "Contents", "MacOS")
	if err := os.MkdirAll(macosDir, 0755); err != nil {
		return err
	}

	// 复制可执行文件
	dst := filepath.Join(macosDir, "hpc-client")
	data, err := os.ReadFile(exe)
	if err != nil {
		return err
	}
	if err := os.WriteFile(dst, data, 0755); err != nil {
		return err
	}

	// 写 Info.plist
	var buf bytes.Buffer
	tmpl, _ := template.New("plist").Parse(plistTmpl)
	tmpl.Execute(&buf, nil)
	plistPath := filepath.Join(appDir, "Contents", "Info.plist")
	if err := os.WriteFile(plistPath, buf.Bytes(), 0644); err != nil {
		return err
	}

	// 注册 URL scheme
	exec.Command("lsregister", "-f", appDir).Run()
	exec.Command("/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister",
		"-f", appDir).Run()

	fmt.Printf("✅ 已安装到 %s\n", appDir)
	return nil
}
