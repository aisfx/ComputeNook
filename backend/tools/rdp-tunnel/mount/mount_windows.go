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

func fixWebClientRegistry() error {
	return fixWebClientRegistryForPort(18080)
}

func fixWebClientRegistryForPort(port int) error {
	key, err := registry.OpenKey(registry.LOCAL_MACHINE, webclientKey, registry.SET_VALUE|registry.QUERY_VALUE)
	if err != nil {
		return fmt.Errorf("打开注册表失败（需要管理员权限）: %w", err)
	}
	defer key.Close()
	key.SetDWordValue("BasicAuthLevel", 2)                                                                    //nolint:errcheck
	key.SetStringsValue("AuthForwardServerList", []string{"127.0.0.1", fmt.Sprintf("127.0.0.1:%d", port)}) //nolint:errcheck
	key.SetDWordValue("FileSizeLimitInBytes", 0xffffffff)                                                    //nolint:errcheck
	return nil
}

func isAdmin() bool {
	_, err := os.Open(`\\.\PHYSICALDRIVE0`)
	return err == nil
}

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
	r, _, _ := shellExecute.Call(0,
		uintptr(unsafe.Pointer(verb)), uintptr(unsafe.Pointer(file)),
		uintptr(unsafe.Pointer(params)), uintptr(unsafe.Pointer(dir)), 1)
	if r <= 32 {
		return fmt.Errorf("ShellExecuteW 失败，错误码: %d", r)
	}
	return nil
}

// findRclone 查找 rclone 可执行文件
func findRclone() string {
	if p, err := exec.LookPath("rclone"); err == nil {
		return p
	}
	candidates := []string{
		`C:\Program Files\rclone\rclone.exe`,
		`C:\rclone\rclone.exe`,
		os.Getenv("USERPROFILE") + `\rclone\rclone.exe`,
		os.Getenv("LOCALAPPDATA") + `\rclone\rclone.exe`,
	}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return ""
}

// mountWindows 优先用 rclone 挂载，回退到 WebClient net use
func mountWindows(port int, driveLetter string) error {
	if driveLetter == "" {
		driveLetter = "Z:"
	}
	// 去掉盘符后的冒号用于 rclone remote 名
	letter := strings.TrimSuffix(driveLetter, ":")

	// ── 方案1：rclone mount（推荐，不依赖 WebClient）──
	if rclone := findRclone(); rclone != "" {
		return mountWithRclone(rclone, port, letter, driveLetter)
	}

	// ── 方案2：回退到 WebClient net use ──
	return mountWithWebClient(port, driveLetter)
}

func mountWithRclone(rclone string, port int, letter, driveLetter string) error {
	// rclone 需要 WinFsp，检查是否安装
	if _, err := os.Stat(`C:\Program Files\WinFsp\bin\winfsp-x64.dll`); os.IsNotExist(err) {
		if _, err2 := os.Stat(`C:\Program Files (x86)\WinFsp\bin\winfsp-x86.dll`); os.IsNotExist(err2) {
			return fmt.Errorf("rclone 挂载需要 WinFsp，请先安装: https://winfsp.dev/rel/")
		}
	}

	davURL := fmt.Sprintf("http://127.0.0.1:%d", port)
	remoteName := fmt.Sprintf("hpc-webdav-%s", letter)

	// 先卸载旧的
	exec.Command(rclone, "mount", "--daemon-stop", remoteName+":").Run() //nolint:errcheck
	time.Sleep(500 * time.Millisecond)

	// rclone mount 在后台运行
	cmd := exec.Command(rclone,
		"mount",
		fmt.Sprintf(":webdav,url=%s,vendor=other:", davURL),
		driveLetter,
		"--vfs-cache-mode", "writes",
		"--no-console",
		"--daemon",
	)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("rclone mount 失败: %w\n%s", err, string(out))
	}
	time.Sleep(2 * time.Second)
	return nil
}

func mountWithWebClient(port int, driveLetter string) error {
	// 修注册表
	if isAdmin() {
		fixWebClientRegistryForPort(port) //nolint:errcheck
		exec.Command("net", "stop", "WebClient").Run()
		time.Sleep(800 * time.Millisecond)
		exec.Command("net", "start", "WebClient").Run()
		time.Sleep(1200 * time.Millisecond)
	} else {
		runAsAdmin("__fix-webclient") //nolint:errcheck
		time.Sleep(4 * time.Second)
		exec.Command("net", "start", "WebClient").Run()
		time.Sleep(1 * time.Second)
	}
	exec.Command("net", "use", driveLetter, "/delete", "/y").Run() //nolint:errcheck
	unc := fmt.Sprintf(`\\127.0.0.1@%d\DavWWWRoot`, port)
	return run("net", "use", driveLetter, unc)
}
