// mount 包：本地 WebDAV 代理 + 系统挂载
package mount

import (
	"fmt"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

// Start 启动本地 WebDAV 代理并挂载
func Start(server, token string, port int, mountPoint string) error {
	if !strings.HasPrefix(server, "http://") && !strings.HasPrefix(server, "https://") {
		server = "http://" + server
	}

	davURL := strings.TrimRight(server, "/") + "/api/webdav"
	target, err := url.Parse(davURL)
	if err != nil {
		return fmt.Errorf("invalid server URL: %w", err)
	}

	listenPort := port

	// 反向代理：注入 Authorization 头
	proxy := httputil.NewSingleHostReverseProxy(target)
	origDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		origDirector(req)
		req.Header.Set("Authorization", "Bearer "+token)
		req.Host = target.Host
	}

	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", listenPort))
	if err != nil {
		return fmt.Errorf("listen on port %d failed: %w", listenPort, err)
	}

	srv := &http.Server{Handler: proxy}
	go srv.Serve(ln) //nolint:errcheck

	time.Sleep(500 * time.Millisecond)
	log.Printf("[mount] WebDAV proxy: http://127.0.0.1:%d -> %s", listenPort, davURL)

	if err := mountLocal(listenPort, mountPoint); err != nil {
		log.Printf("[mount] 自动挂载失败: %v", err)
		log.Printf("[mount] 代理仍在运行，可手动挂载:")
		printManualInstructions(listenPort, mountPoint)
		return fmt.Errorf("mount failed: %w", err)
	}

	log.Printf("[mount] 已挂载到 %s", mountPoint)
	return nil
}

func printManualInstructions(port int, mountPoint string) {
	switch runtime.GOOS {
	case "windows":
		var unc string
		if port == 80 {
			unc = `\\127.0.0.1\DavWWWRoot`
		} else {
			unc = fmt.Sprintf(`\\127.0.0.1@%d\DavWWWRoot`, port)
		}
		davURL := fmt.Sprintf("http://127.0.0.1:%d", port)
		log.Printf("[mount] ── 挂载方式（任选其一）──")
		log.Printf("[mount] 方法1 - rclone（推荐，需安装 rclone + WinFsp）:")
		log.Printf("[mount]   rclone mount \":webdav,url=%s,vendor=other:\" %s --vfs-cache-mode writes", davURL, mountPoint)
		log.Printf("[mount] 方法2 - 文件管理器: 地址栏输入 %s", unc)
		log.Printf("[mount] 方法3 - 命令行(管理员): net use %s %s", mountPoint, unc)
		log.Printf("[mount] 方法4 - 映射网络驱动器: 右键「此电脑」-> 映射网络驱动器 -> 输入 %s", unc)
		log.Printf("[mount] rclone 下载: https://rclone.org/downloads/")
		log.Printf("[mount] WinFsp 下载: https://winfsp.dev/rel/")
	default:
		log.Printf("[mount] 手动挂载: mount -t davfs http://127.0.0.1:%d %s", port, mountPoint)
	}
}

// Unmount 卸载挂载点
func Unmount(mountPoint string) error {
	return unmountLocal(mountPoint)
}

func mountLocal(port int, mountPoint string) error {
	switch runtime.GOOS {
	case "windows":
		return mountWindows(port, mountPoint)
	case "darwin":
		return mountDarwin(port, mountPoint)
	default:
		return mountLinux(port, mountPoint)
	}
}

func unmountLocal(mountPoint string) error {
	switch runtime.GOOS {
	case "windows":
		exec.Command("net", "use", mountPoint, "/delete", "/y").Run() //nolint:errcheck
		return nil
	case "darwin":
		return run("umount", mountPoint)
	default:
		if err := run("fusermount", "-u", mountPoint); err != nil {
			return run("umount", mountPoint)
		}
		return nil
	}
}

// mountWindows 已移至 mount_windows.go（平台特定实现）

func mountDarwin(port int, mountPoint string) error {
	if mountPoint == "" {
		mountPoint = "/Volumes/HPC"
	}
	exec.Command("mkdir", "-p", mountPoint).Run() //nolint:errcheck
	return run("mount_webdav", fmt.Sprintf("http://127.0.0.1:%d", port), mountPoint)
}

func mountLinux(port int, mountPoint string) error {
	if mountPoint == "" {
		mountPoint = "/mnt/hpc"
	}
	exec.Command("mkdir", "-p", mountPoint).Run() //nolint:errcheck
	return run("mount", "-t", "davfs", fmt.Sprintf("http://127.0.0.1:%d", port), mountPoint)
}

func run(name string, args ...string) error {
	cmd := exec.Command(name, args...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s %v: %w\n%s", name, args, err, string(out))
	}
	return nil
}
