// hpc-client: HPC 平台隧道客户端
// 支持命令行模式和 URI scheme 模式（hpcc://）
//
// 命令行:
//   hpc-client rdp  -server https://hpc.example.com -token <jwt> -session <id>
//   hpc-client ssh  -server https://hpc.example.com -token <jwt> -host cn1
//
// URI scheme（网页点击自动拉起）:
//   hpcc://rdp?server=https://hpc.example.com&token=<jwt>&session=1&port=13389
//   hpcc://ssh?server=https://hpc.example.com&token=<jwt>&host=cn1&port=12222
//
// 安装（注册 URI scheme）:
//   hpc-client install
package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	"rdp-tunnel/mount"
	"rdp-tunnel/tunnel"
	"rdp-tunnel/ui"
)

const version = "v0.1"

func main() {
	// 双击运行（无参数）时弹框提示安装
	if len(os.Args) < 2 {
		msg := "HPC 客户端 " + version + "\n\n" +
			"首次使用请点击「是」自动注册 hpcc:// 协议。\n" +
			"注册后在网页点击「连接」按钮即可自动启动隧道。"
		if ui.Confirm("HPC 客户端", msg) {
			if err := install(); err != nil {
				ui.Error("安装失败", err.Error())
			} else {
				ui.Info("HPC 客户端", "✅ hpcc:// 协议注册成功！\n\n现在可以在网页上点击「一键连接」按钮直接启动远程桌面或挂载文件系统。")
			}
		}
		return
	}

	arg := os.Args[1]

	// URI scheme 模式：hpcc://rdp?... 或 hpcc://ssh?...
	if strings.HasPrefix(arg, "hpcc://") {
		handleURI(arg)
		return
	}

	switch arg {
	case "__fix-webclient":
		// 由 mount 提权子进程调用，修复 WebClient 注册表后退出
		if err := mount.FixWebClient(); err != nil {
			fmt.Fprintf(os.Stderr, "fix-webclient failed: %v\n", err)
			os.Exit(1)
		}
		os.Exit(0)
	case "rdp":
		runRDP(os.Args[2:])
	case "ssh":
		runSSH(os.Args[2:])
	case "mount":
		runMount(os.Args[2:])
	case "install":
		if err := install(); err != nil {
			ui.Error("安装失败", err.Error())
			log.Fatalf("安装失败: %v", err)
		}
		ui.Info("HPC 客户端", "✅ hpcc:// 协议注册成功！\n\n现在可以在网页上点击「一键连接」按钮直接启动远程桌面或挂载文件系统。")
		fmt.Println("✅ hpcc:// 协议已注册，网页点击连接将自动拉起客户端")
	case "version", "-v", "--version":
		fmt.Println("hpc-client", version)
	default:
		printUsage()
		os.Exit(1)
	}
}

// handleURI 解析 hpcc:// URI 并启动对应隧道
func handleURI(uri string) {
	// 调试：打印原始 URI（前 200 字符）
	preview := uri
	if len(preview) > 200 {
		preview = preview[:200] + "..."
	}
	log.Printf("[URI] raw: %s", preview)

	// Windows 注册表传递 URI 时可能对 %xx 做一次 decode，导致 url.Parse 解析错误
	// 在解析前把 server 参数里的 http:// 重新 encode，保护 URL 结构
	uri = fixURIEncoding(uri)

	u, err := url.Parse(uri)
	if err != nil {
		log.Fatalf("无效 URI: %v", err)
	}

	mode := u.Host
	q := u.Query()

	server := q.Get("server")
	token := q.Get("token")

	log.Printf("[URI] mode=%s server=%s", mode, server)

	switch mode {
	case "vnc":
		sessionID := q.Get("session")
		port, _ := strconv.Atoi(q.Get("port"))
		if port <= 0 {
			port = 15900
		}
		if server == "" || token == "" || sessionID == "" {
			log.Fatal("URI 缺少必要参数: server, token, session")
		}
		wsURL := toWS(server + fmt.Sprintf("/api/desktop/sessions/%s/vnc-ws", sessionID))
		startTunnel("VNC", wsURL, token, port, func(p int) {
			launchVNCViewer(p)
		})

	case "xpra":
		sessionID := q.Get("session")
		port, _ := strconv.Atoi(q.Get("port"))
		if port <= 0 {
			port = 14500
		}
		if server == "" || token == "" || sessionID == "" {
			log.Fatal("URI 缺少必要参数: server, token, session")
		}
		wsURL := toWS(server + fmt.Sprintf("/api/desktop/sessions/%s/xpra-ws", sessionID))
		startTunnelWithSignal("Xpra", wsURL, token, port, server, sessionID, func(p int) {
			launchXpraClient(p)
		})

	case "rdp":
		sessionID := q.Get("session")
		port, _ := strconv.Atoi(q.Get("port"))
		if port <= 0 {
			port = 13389
		}
		rdpUser := q.Get("user")
		rdpPass := q.Get("pass")
		if server == "" || token == "" || sessionID == "" {
			log.Fatal("URI 缺少必要参数: server, token, session")
		}
		wsURL := toWS(server + fmt.Sprintf("/api/desktop/sessions/%s/rdp-ws", sessionID))
		startTunnel("RDP", wsURL, token, port, func(p int) {
			launchRDPWithCreds(p, rdpUser, rdpPass)
		})

	case "ssh":
		host := q.Get("host")
		sshPort, _ := strconv.Atoi(q.Get("ssh-port"))
		if sshPort <= 0 {
			sshPort = 22
		}
		port, _ := strconv.Atoi(q.Get("port"))
		if port <= 0 {
			port = 12222
		}
		user := q.Get("user")
		if server == "" || token == "" || host == "" {
			log.Fatal("URI 缺少必要参数: server, token, host")
		}
		wsPath := fmt.Sprintf("%s/api/ssh/proxy?host=%s&port=%d", server, host, sshPort)
		if user != "" {
			wsPath += "&user=" + url.QueryEscape(user)
		}
		wsURL := toWS(wsPath)
		// URI 模式默认自动拉起 SSH 客户端，SSH 隧道不需要 exit signal（无 session ID）
		startTunnel("SSH", wsURL, token, port, func(p int) {
			launchSSH(p, user)
		})

	case "install":
		// 被浏览器通过 hpcc://install 触发，自动注册协议后退出
		if err := install(); err != nil {
			ui.Error("安装失败", err.Error())
			log.Fatalf("注册失败: %v", err)
		}
		ui.Info("HPC 客户端", "✅ hpcc:// 协议注册成功！\n\n现在可以在网页上点击「一键连接」按钮直接启动远程桌面或挂载文件系统。")
		fmt.Println("✅ hpcc:// 协议注册成功")

	case "mount":
		port, _ := strconv.Atoi(q.Get("port"))
		if port <= 0 {
			port = 18080
		}
		mountPoint := q.Get("mountpoint")
		if server == "" || token == "" {
			log.Fatal("URI 缺少必要参数: server, token")
		}
		runMountDirect(server, token, port, mountPoint)

	default:
		log.Fatalf("未知模式: %s，支持 rdp / ssh / install", mode)
	}
}

func startTunnel(label, wsURL, token string, port int, onReady func(int)) {
	startTunnelWithSignal(label, wsURL, token, port, "", "", onReady)
}

func startTunnelWithSignal(label, wsURL, token string, port int, signalServer, sessionID string, onReady func(int)) {
	t := tunnel.New()
	t.OnStatus = func(s tunnel.Status, msg string) {
		log.Printf("[%s] %s", label, msg)
	}

	log.Printf("启动 %s 隧道: localhost:%d", label, port)
	if err := t.Start(wsURL, token, port); err != nil {
		ui.Error("隧道启动失败", fmt.Sprintf("无法连接到平台：\n%v\n\n请检查：\n1. 网络是否可达\n2. 是否已登录（Token 是否过期）\n3. 平台地址是否正确", err))
		log.Fatalf("启动失败: %v", err)
	}

	fmt.Printf("\n✅ %s 隧道已就绪，监听 localhost:%d\n\n", label, port)
	if onReady != nil {
		onReady(port)
	}

	// 如果有 signalServer，启动心跳轮询，收到 exit 信号自动退出
	if signalServer != "" && sessionID != "" {
		go pollExitSignal(signalServer, token, sessionID, t)
	}

	waitSignal(t)
}

// pollExitSignal 轮询后端 client-signal 接口，收到 exit 信号后退出
func pollExitSignal(server, token, sessionID string, t *tunnel.Tunnel) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		url := fmt.Sprintf("%s/api/desktop/sessions/%s/client-signal", server, sessionID)
		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			continue
		}
		req.Header.Set("Authorization", "Bearer "+token)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			continue
		}
		body := make([]byte, 256)
		n, _ := resp.Body.Read(body)
		resp.Body.Close()
		if strings.Contains(string(body[:n]), `"exit"`) {
			log.Printf("[signal] 收到退出信号，正在关闭...")
			t.Stop()
			os.Exit(0)
		}
	}
}
func runRDP(args []string) {
	fs := flag.NewFlagSet("rdp", flag.ExitOnError)
	server := fs.String("server", "", "平台地址")
	token := fs.String("token", "", "登录 Token")
	sessionID := fs.String("session", "", "Session ID")
	port := fs.Int("port", 13389, "本地端口")
	launch := fs.Bool("launch", false, "自动打开 RDP 客户端")
	fs.Parse(args)

	if *server == "" || *token == "" || *sessionID == "" {
		fmt.Fprintln(os.Stderr, "错误: -server, -token, -session 为必填项")
		os.Exit(1)
	}

	wsURL := toWS(*server + fmt.Sprintf("/api/desktop/sessions/%s/rdp-ws", *sessionID))
	var onReady func(int)
	if *launch {
		onReady = launchRDP
	}
	startTunnel("RDP", wsURL, *token, *port, onReady)
}

func runSSH(args []string) {
	fs := flag.NewFlagSet("ssh", flag.ExitOnError)
	server := fs.String("server", "", "平台地址")
	token := fs.String("token", "", "登录 Token")
	host := fs.String("host", "", "节点名称")
	user := fs.String("user", "", "平台登录用户名（用于后端校验）")
	sshPort := fs.Int("ssh-port", 22, "SSH 端口")
	port := fs.Int("port", 12222, "本地端口")
	fs.Parse(args)

	if *server == "" || *token == "" || *host == "" {
		fmt.Fprintln(os.Stderr, "错误: -server, -token, -host 为必填项")
		os.Exit(1)
	}

	wsPath := fmt.Sprintf("%s/api/ssh/proxy?host=%s&port=%d", *server, *host, *sshPort)
	if *user != "" {
		wsPath += "&user=" + url.QueryEscape(*user)
	}
	wsURL := toWS(wsPath)
	startTunnel("SSH", wsURL, *token, *port, nil)
}

func waitSignal(t *tunnel.Tunnel) {
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
	fmt.Println("\n正在关闭隧道...")
	t.Stop()
}

func launchVNCViewer(port int) {
	addr := fmt.Sprintf("localhost::%d", port) // TurboVNC 格式
	switch runtime.GOOS {
	case "windows":
		// 优先 TurboVNC，其次 TigerVNC，最后 RealVNC
		for _, viewer := range []string{"vncviewer", "tvnviewer"} {
			if p, err := exec.LookPath(viewer); err == nil {
				exec.Command(p, addr).Start() //nolint:errcheck
				return
			}
		}
		// 尝试常见安装路径
		for _, p := range []string{
			`C:\Program Files\TurboVNC\vncviewer.exe`,
			`C:\Program Files\TigerVNC\vncviewer.exe`,
			`C:\Program Files\RealVNC\VNC Viewer\vncviewer.exe`,
		} {
			if _, err := os.Stat(p); err == nil {
				exec.Command(p, addr).Start() //nolint:errcheck
				return
			}
		}
		fmt.Printf("\n请手动连接 VNC: localhost::%d\n", port)
		fmt.Println("推荐安装 TurboVNC: https://turbovnc.org/")
	case "darwin":
		exec.Command("open", fmt.Sprintf("vnc://localhost:%d", port)).Start() //nolint:errcheck
	default:
		for _, viewer := range []string{"vncviewer", "turbovncviewer", "tigervncviewer"} {
			if p, err := exec.LookPath(viewer); err == nil {
				exec.Command(p, addr).Start() //nolint:errcheck
				return
			}
		}
		fmt.Printf("\n请手动连接 VNC: localhost::%d\n", port)
	}
}

func launchRDP(port int) {
	launchRDPWithCreds(port, "", "")
}

func launchRDPWithCreds(port int, user, pass string) {
	addr := fmt.Sprintf("localhost:%d", port)
	switch runtime.GOOS {
	case "windows":
		rdpContent := fmt.Sprintf(`full address:s:%s
authentication level:i:0
negotiate security layer:i:0
enablecredsspsupport:i:0
screen mode id:i:2
use multimon:i:0
desktopwidth:i:1920
desktopheight:i:1080
session bpp:i:32
compression:i:1
keyboardhook:i:2
audiocapturemode:i:0
videoplaybackmode:i:1
connection type:i:7
networkautodetect:i:1
bandwidthautodetect:i:1
displayconnectionbar:i:1
disable wallpaper:i:0
allow font smoothing:i:1
allow desktop composition:i:1
redirectclipboard:i:1
autoreconnection enabled:i:1
`, addr)
		if user != "" {
			rdpContent += fmt.Sprintf("username:s:%s\n", user)
		}
		// 注意：mstsc 不支持在 .rdp 文件里明文写密码，需要用 cmdkey 预存凭据
		if pass != "" && user != "" {
			// 用 cmdkey 存储凭据，mstsc 会自动使用
			exec.Command("cmdkey", fmt.Sprintf("/generic:TERMSRV/%s", addr),
				fmt.Sprintf("/user:%s", user),
				fmt.Sprintf("/pass:%s", pass)).Run() //nolint:errcheck
		}
		tmpFile := os.TempDir() + "\\hpc-rdp.rdp"
		if err := os.WriteFile(tmpFile, []byte(rdpContent), 0600); err == nil {
			exec.Command("mstsc", tmpFile).Start() //nolint:errcheck
		} else {
			exec.Command("mstsc", fmt.Sprintf("/v:%s", addr)).Start() //nolint:errcheck
		}
	case "darwin":
		// 优先用 Microsoft Remote Desktop（App Store 版，支持 Apple Silicon）
		// 尝试直接调用 mstsc 兼容路径，再 fallback 到 open rdp://
		mrdpPaths := []string{
			"/Applications/Microsoft Remote Desktop.app/Contents/MacOS/Microsoft Remote Desktop",
			"/Applications/Microsoft Remote Desktop Beta.app/Contents/MacOS/Microsoft Remote Desktop Beta",
		}
		launched := false
		for _, p := range mrdpPaths {
			if _, err := os.Stat(p); err == nil {
				// 生成临时 .rdp 文件，Microsoft Remote Desktop 可直接打开
				rdpContent := fmt.Sprintf("full address:s:%s\nauthentication level:i:0\n", addr)
				if user != "" {
					rdpContent += fmt.Sprintf("username:s:%s\n", user)
				}
				tmpFile := os.TempDir() + "/hpc-rdp.rdp"
				if err := os.WriteFile(tmpFile, []byte(rdpContent), 0600); err == nil {
					exec.Command("open", "-a", p, tmpFile).Start() //nolint:errcheck
					launched = true
				}
				break
			}
		}
		if !launched {
			// fallback: open rdp:// URI（需要 Microsoft Remote Desktop 注册了协议）
			rdpURI := fmt.Sprintf("rdp://full%%20address=s:%s", addr)
			if user != "" {
				rdpURI += fmt.Sprintf("&username=s:%s", url.QueryEscape(user))
			}
			if err := exec.Command("open", rdpURI).Run(); err != nil {
				// 最后兜底：Terminal 提示
				script := fmt.Sprintf(
					`tell application "Terminal" to do script "echo '✅ RDP 隧道已就绪'; echo '地址: %s'; echo '请安装 Microsoft Remote Desktop（App Store）后连接'"`,
					addr,
				)
				exec.Command("osascript", "-e", script).Start() //nolint:errcheck
			}
		}
	default:
		args := []string{fmt.Sprintf("/v:%s", addr), "/dynamic-resolution", "+clipboard", "/sec:rdp"}
		if user != "" {
			args = append(args, fmt.Sprintf("/u:%s", user))
		}
		if pass != "" {
			args = append(args, fmt.Sprintf("/p:%s", pass))
		}
		if p, err := exec.LookPath("xfreerdp"); err == nil {
			exec.Command(p, args...).Start() //nolint:errcheck
		} else if p, err := exec.LookPath("remmina"); err == nil {
			exec.Command(p, fmt.Sprintf("rdp://%s", addr)).Start() //nolint:errcheck
		}
	}
}

// launchSSH 隧道就绪后直接打开终端并执行 SSH 连接
func launchSSH(port int, sshUser string) {
	// sshUser 为空时不拼 user@，让 SSH 用系统当前用户
	var sshCmd string
	if sshUser != "" {
		sshCmd = fmt.Sprintf("ssh -p %d %s@localhost", port, sshUser)
	} else {
		sshCmd = fmt.Sprintf("ssh -p %d localhost", port)
	}

	switch runtime.GOOS {
	case "windows":
		// 直接弹出 cmd 窗口并执行 SSH，连接断开后窗口保持（pause）
		content := fmt.Sprintf(
			"@echo off\r\n"+
				"chcp 65001 >nul\r\n"+
				"%s\r\n"+
				"pause\r\n",
			sshCmd,
		)
		ui.CmdWindow("HPC SSH Tunnel", content)
	case "darwin":
		// 优先 iTerm2，其次系统 Terminal
		iTerm2 := "/Applications/iTerm.app"
		if _, err := os.Stat(iTerm2); err == nil {
			script := fmt.Sprintf(
				`tell application "iTerm2"
  activate
  tell current window
    create tab with default profile
    tell current session
      write text "%s"
    end tell
  end tell
end tell`, sshCmd)
			if err := exec.Command("osascript", "-e", script).Run(); err == nil {
				return
			}
		}
		// fallback: Terminal.app
		script := fmt.Sprintf(`tell application "Terminal"
  activate
  do script "%s"
end tell`, sshCmd)
		exec.Command("osascript", "-e", script).Start() //nolint:errcheck
	default:
		addr := fmt.Sprintf("%s@localhost", sshUser)
		portStr := fmt.Sprintf("%d", port)
		for _, term := range [][]string{
			{"gnome-terminal", "--", "bash", "-c", fmt.Sprintf("ssh -p %s %s; read", portStr, addr)},
			{"xterm", "-e", "bash", "-c", fmt.Sprintf("ssh -p %s %s; read", portStr, addr)},
			{"konsole", "-e", "bash", "-c", fmt.Sprintf("ssh -p %s %s; read", portStr, addr)},
		} {
			if _, err := exec.LookPath(term[0]); err == nil {
				exec.Command(term[0], term[1:]...).Start() //nolint:errcheck
				return
			}
		}
		fmt.Printf("\n✅ SSH 隧道已就绪\n连接命令: ssh -p %d %s@localhost\n", port, sshUser)
	}
}

// launchXpraClient 隧道就绪后启动 Xpra 客户端
func launchXpraClient(port int) {
	switch runtime.GOOS {
	case "windows":
		// 尝试启动 Xpra 客户端
		for _, p := range []string{
			`C:\Program Files\Xpra\Xpra.exe`,
			`C:\Program Files (x86)\Xpra\Xpra.exe`,
		} {
			if _, err := os.Stat(p); err == nil {
				exec.Command(p, "attach", fmt.Sprintf("tcp://localhost:%d/", port)).Start() //nolint:errcheck
				return
			}
		}
		// 没有 Xpra 客户端，弹出提示
		content := fmt.Sprintf(
			"@echo off\r\nchcp 65001 >nul\r\necho Xpra 隧道已就绪，本地端口: %d\r\necho 请安装 Xpra 客户端后连接 tcp://localhost:%d/\r\npause\r\n",
			port, port,
		)
		ui.CmdWindow("HPC Xpra Tunnel", content)
	case "darwin":
		// 优先用命令行 xpra attach（比 open xpra:// 更可靠，尤其是 Apple Silicon）
		xpraPaths := []string{
			"/Applications/Xpra.app/Contents/MacOS/Xpra",
			"/usr/local/bin/xpra",
			"/opt/homebrew/bin/xpra",
			"/usr/bin/xpra",
		}
		for _, p := range xpraPaths {
			if _, err := os.Stat(p); err == nil {
				exec.Command(p, "attach", fmt.Sprintf("tcp://localhost:%d/", port)).Start() //nolint:errcheck
				return
			}
		}
		// 尝试 PATH 里的 xpra
		if p, err := exec.LookPath("xpra"); err == nil {
			exec.Command(p, "attach", fmt.Sprintf("tcp://localhost:%d/", port)).Start() //nolint:errcheck
			return
		}
		// 尝试通过 open 触发 xpra:// 协议（旧版兼容）
		if err := exec.Command("open", fmt.Sprintf("xpra://tcp/localhost:%d/", port)).Run(); err != nil {
			// 所有方式都失败，用 Terminal 弹窗提示
			script := fmt.Sprintf(
				`tell application "Terminal" to do script "echo '✅ Xpra 隧道已就绪，端口: %d'; echo '请安装 Xpra 后运行: xpra attach tcp://localhost:%d/'; echo '下载: https://xpra.org/'"`,
				port, port,
			)
			exec.Command("osascript", "-e", script).Start() //nolint:errcheck
		}
	default:
		if p, err := exec.LookPath("xpra"); err == nil {
			exec.Command(p, "attach", fmt.Sprintf("tcp://localhost:%d/", port)).Start() //nolint:errcheck
		} else {
			fmt.Printf("\n✅ Xpra 隧道已就绪，本地端口: %d\n连接命令: xpra attach tcp://localhost:%d/\n", port, port)
		}
	}
}

func toWS(u string) string {
	if strings.HasPrefix(u, "https") {
		return "wss" + u[5:]
	}
	if strings.HasPrefix(u, "http") {
		return "ws" + u[4:]
	}
	return u
}

func printUsage() {
	fmt.Printf(`hpc-client %s

用法:
  hpc-client install              注册 hpcc:// 协议（首次安装运行）
  hpc-client rdp  [选项]          命令行启动 RDP 隧道
  hpc-client ssh  [选项]          命令行启动 SSH 隧道
  hpc-client mount [选项]         挂载 HPC 文件系统到本地
  hpc-client version              显示版本

网页点击连接时会自动以 URI 模式启动:
  hpcc://rdp?server=...&token=...&session=1
  hpcc://ssh?server=...&token=...&host=cn1
  hpcc://mount?server=...&token=...&mountpoint=Z:
`, version)
}

func runMount(args []string) {
	fs := flag.NewFlagSet("mount", flag.ExitOnError)
	server := fs.String("server", "", "平台地址")
	token := fs.String("token", "", "登录 Token")
	port := fs.Int("port", 18080, "本地代理端口")
	mountPoint := fs.String("mountpoint", "", "挂载点（Windows: Z:，macOS: /Volumes/HPC，Linux: /mnt/hpc）")
	fs.Parse(args)

	if *server == "" || *token == "" {
		fmt.Fprintln(os.Stderr, "错误: -server, -token 为必填项")
		os.Exit(1)
	}
	runMountDirect(*server, *token, *port, *mountPoint)
}

func runMountDirect(server, token string, port int, mountPoint string) {
	// Windows 控制台切换到 UTF-8，避免中文乱码
	if runtime.GOOS == "windows" {
		exec.Command("cmd", "/c", "chcp 65001").Run() //nolint:errcheck
	}

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)

	mountErr := make(chan error, 1)
	go func() {
		mountErr <- mount.Start(server, token, port, mountPoint)
	}()

	// 等待挂载结果或信号
	select {
	case err := <-mountErr:
		if err != nil {
			fmt.Printf("\n[ERROR] 挂载失败: %v\n\n", err)
			fmt.Println("WebDAV 代理仍在运行，可手动挂载:")
			fmt.Println("  文件管理器地址栏输入: \\\\127.0.0.1\\DavWWWRoot")
			fmt.Printf("  或命令行(管理员): net use %s \\\\127.0.0.1\\DavWWWRoot\n\n", mountPoint)
			fmt.Println("按 Ctrl+C 退出...")
			<-sig
		} else {
			// 挂载成功，等待退出信号
			fmt.Printf("\n✅ HPC 文件系统已挂载到 %s\n", mountPoint)
			fmt.Printf("   WebDAV 代理: http://127.0.0.1:%d\n\n", port)
			fmt.Println("按 Ctrl+C 卸载并退出...")
			<-sig
			fmt.Println("\n正在卸载...")
			if mountPoint != "" {
				if err := mount.Unmount(mountPoint); err != nil {
					fmt.Printf("卸载失败: %v\n", err)
				}
			}
		}
	case <-sig:
		fmt.Println("\n正在退出...")
	}
}

// fixURIEncoding 修复 Windows 注册表传递 URI 时对 %xx 做 decode 导致的解析问题
// 例如 server=http://202.189.51.151:18081 中的 :// 会破坏 url.Parse 的解析
// 策略：找到每个参数值，如果包含未编码的 ://，用 url.QueryEscape 重新编码
func fixURIEncoding(uri string) string {
	// 找到 ? 开始的 query 部分，逐参数修复
	qIdx := strings.Index(uri, "?")
	if qIdx < 0 {
		return uri
	}
	base := uri[:qIdx+1]
	query := uri[qIdx+1:]

	// 逐个 & 分割参数，对每个值单独处理
	parts := strings.Split(query, "&")
	for i, part := range parts {
		eqIdx := strings.Index(part, "=")
		if eqIdx < 0 {
			continue
		}
		key := part[:eqIdx]
		val := part[eqIdx+1:]
		// 如果值里有未编码的 ://，说明被 Windows shell 做了一次 decode，重新 encode
		if strings.Contains(val, "://") {
			parts[i] = key + "=" + url.QueryEscape(val)
		}
	}
	return base + strings.Join(parts, "&")
}
