//go:build windows

package mount

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows/registry"
)

const webclientKey = `SYSTEM\CurrentControlSet\Services\WebClient\Parameters`

// fixWebClientRegistry 修复 WebClient 注册表，需要管理员权限
func fixWebClientRegistry() error {
	return fixWebClientRegistryForPort(18080)
}

func fixWebClientRegistryForPort(port int) error {
	key, err := registry.OpenKey(registry.LOCAL_MACHINE, webclientKey, registry.SET_VALUE|registry.QUERY_VALUE)
	if err != nil {
		return fmt.Errorf("打开注册表失败（需要管理员权限）: %w", err)
	}
	defer key.Close()

	// BasicAuthLevel=2：允许 HTTP WebDAV BasicAuth
	if err := key.SetDWordValue("BasicAuthLevel", 2); err != nil {
		return fmt.Errorf("设置 BasicAuthLevel 失败: %w", err)
	}

	// AuthForwardServerList：加入 127.0.0.1 和 127.0.0.1:<port>
	// WebClient 对非标准端口需要明确列出 host:port
	entries := []string{"127.0.0.1", fmt.Sprintf("127.0.0.1:%d", port)}
	if err := key.SetStringsValue("AuthForwardServerList", entries); err != nil {
		return fmt.Errorf("设置 AuthForwardServerList 失败: %w", err)
	}

	// FileSizeLimitInBytes：调大到 4GB，避免大文件被截断
	if err := key.SetDWordValue("FileSizeLimitInBytes", 0xffffffff); err != nil {
		return fmt.Errorf("设置 FileSizeLimitInBytes 失败: %w", err)
	}

	return nil
}

// isAdmin 检查当前进程是否有管理员权限
func isAdmin() bool {
	_, err := os.Open(`\\.\PHYSICALDRIVE0`)
	return err == nil
}

// runAsAdmin 用 ShellExecuteW runas 提权重新运行当前程序
func runAsAdmin(args ...string) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}

	verb, _ := syscall.UTF16PtrFromString("runas")
	file, _ := syscall.UTF16PtrFromString(exe)
	params, _ := syscall.UTF16PtrFromString(strings.Join(args, " "))
	dir, _ := syscall.UTF16PtrFromString("")

	shell32 := syscall.NewLazyDLL("shell32.dll")
	shellExecute := shell32.NewProc("ShellExecuteW")

	r, _, _ := shellExecute.Call(
		0,
		uintptr(unsafe.Pointer(verb)),
		uintptr(unsafe.Pointer(file)),
		uintptr(unsafe.Pointer(params)),
		uintptr(unsafe.Pointer(dir)),
		1, // SW_SHOWNORMAL
	)
	if r <= 32 {
		return fmt.Errorf("ShellExecuteW 失败，错误码: %d", r)
	}
	return nil
}

// mountWindows 挂载 WebDAV 到 Windows 盘符
func mountWindows(port int, driveLetter string) error {
	if driveLetter == "" {
		driveLetter = "Z:"
	}

	// 1. 修注册表（需要管理员权限）
	if isAdmin() {
		if err := fixWebClientRegistryForPort(port); err != nil {
			return fmt.Errorf("修复注册表失败: %w", err)
		}
		// 重启 WebClient 使配置生效
		exec.Command("net", "stop", "WebClient").Run()
		time.Sleep(800 * time.Millisecond)
		exec.Command("net", "start", "WebClient").Run()
		time.Sleep(1200 * time.Millisecond)
	} else {
		if err := runAsAdmin("__fix-webclient"); err == nil {
			time.Sleep(4 * time.Second)
		}
		exec.Command("net", "start", "WebClient").Run()
		time.Sleep(1 * time.Second)
	}

	// 2. 清理旧映射
	exec.Command("net", "use", driveLetter, "/delete", "/y").Run()

	// 3. 挂载，统一用 @port 格式
	unc := fmt.Sprintf(`\\127.0.0.1@%d\DavWWWRoot`, port)
	return run("net", "use", driveLetter, unc)
}
