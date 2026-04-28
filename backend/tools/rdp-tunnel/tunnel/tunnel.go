// tunnel 包：管理 WebSocket -> 本地 TCP 隧道
package tunnel

import (
	"fmt"
	"log"
	"net"
	"net/http"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Status string

const (
	StatusIdle    Status = "idle"
	StatusRunning Status = "running"
	StatusError   Status = "error"
)

type Tunnel struct {
	mu        sync.Mutex
	listener  net.Listener
	status    Status
	localPort int
	OnStatus  func(Status, string) // 状态变化回调
}

func New() *Tunnel {
	return &Tunnel{status: StatusIdle}
}

func (t *Tunnel) Status() Status {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.status
}

// Start 启动隧道：监听 localPort，转发到 wsURL（携带 token 认证）
func (t *Tunnel) Start(wsURL, token string, localPort int) error {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.listener != nil {
		t.listener.Close()
	}

	// 端口被占用时，kill 占用进程后重试
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", localPort))
	if err != nil {
		log.Printf("[tunnel] 端口 %d 被占用，尝试释放...", localPort)
		if killErr := killPortProcess(localPort); killErr != nil {
			log.Printf("[tunnel] 释放端口失败: %v", killErr)
		} else {
			time.Sleep(500 * time.Millisecond)
		}
		ln, err = net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", localPort))
		if err != nil {
			t.status = StatusError
			t.notify(StatusError, fmt.Sprintf("监听端口 %d 失败: %v", localPort, err))
			return err
		}
	}

	t.listener = ln
	t.localPort = localPort
	t.status = StatusRunning
	t.notify(StatusRunning, fmt.Sprintf("隧道已启动，监听 localhost:%d", localPort))

	go t.serve(ln, wsURL, token)
	return nil
}

// killPortProcess 杀掉占用指定端口的进程
func killPortProcess(port int) error {
	switch runtime.GOOS {
	case "windows":
		// netstat 找 PID，然后 taskkill
		out, err := exec.Command("cmd", "/c",
			fmt.Sprintf(`netstat -ano | findstr "127.0.0.1:%d "`, port),
		).Output()
		if err != nil || len(out) == 0 {
			return fmt.Errorf("未找到占用端口 %d 的进程", port)
		}
		pid := extractPIDWindows(string(out))
		if pid == "" {
			return fmt.Errorf("无法解析 PID")
		}
		log.Printf("[tunnel] 杀掉进程 PID=%s (占用端口 %d)", pid, port)
		return exec.Command("taskkill", "/F", "/PID", pid).Run()
	default:
		// macOS / Linux: lsof
		out, err := exec.Command("lsof", "-ti", fmt.Sprintf("tcp:%d", port)).Output()
		if err != nil || len(out) == 0 {
			return fmt.Errorf("未找到占用端口 %d 的进程", port)
		}
		pid := strings.TrimSpace(string(out))
		log.Printf("[tunnel] 杀掉进程 PID=%s (占用端口 %d)", pid, port)
		return exec.Command("kill", "-9", pid).Run()
	}
}

// extractPIDWindows 从 netstat 输出中提取最后一列 PID
func extractPIDWindows(output string) string {
	for _, line := range strings.Split(output, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) >= 5 {
			return fields[len(fields)-1]
		}
	}
	return ""
}

// Stop 停止隧道
func (t *Tunnel) Stop() {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.listener != nil {
		t.listener.Close()
		t.listener = nil
	}
	t.status = StatusIdle
	t.notify(StatusIdle, "隧道已停止")
}

func (t *Tunnel) serve(ln net.Listener, wsURL, token string) {
	defer func() {
		t.mu.Lock()
		if t.status == StatusRunning {
			t.status = StatusIdle
			t.notify(StatusIdle, "隧道已关闭")
		}
		t.mu.Unlock()
	}()

	// 多连接模式：持续接受连接，直到隧道被主动停止
	// （RDP 客户端会建多个连接，单连接模式会导致第二次握手失败）
	for {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		go t.handleConn(conn, wsURL, token)
	}
}

func (t *Tunnel) handleConn(local net.Conn, wsURL, token string) {
	defer local.Close()

	header := http.Header{}
	header.Set("Authorization", "Bearer "+token)

	wsConn, resp, err := websocket.DefaultDialer.Dial(wsURL, header)
	if err != nil {
		if resp != nil {
			log.Printf("[tunnel] ws connect failed: %v (HTTP %d)", err, resp.StatusCode)
			// 读取响应体，显示后端返回的错误信息
			buf := make([]byte, 1024)
			n, _ := resp.Body.Read(buf)
			if n > 0 {
				log.Printf("[tunnel] server response: %s", string(buf[:n]))
			}
		} else {
			log.Printf("[tunnel] ws connect failed: %v", err)
		}
		t.notify(StatusError, "连接平台失败: "+err.Error())
		return
	}
	defer wsConn.Close()

	log.Printf("[tunnel] connected: %s -> %s", local.RemoteAddr(), wsURL)

	done := make(chan struct{}, 2)

	// local -> ws
	go func() {
		defer func() { done <- struct{}{} }()
		buf := make([]byte, 32*1024)
		for {
			n, err := local.Read(buf)
			if n > 0 {
				if e := wsConn.WriteMessage(websocket.BinaryMessage, buf[:n]); e != nil {
					return
				}
			}
			if err != nil {
				return
			}
		}
	}()

	// ws -> local
	go func() {
		defer func() { done <- struct{}{} }()
		for {
			_, msg, err := wsConn.ReadMessage()
			if err != nil {
				return
			}
			if _, err := local.Write(msg); err != nil {
				return
			}
		}
	}()

	<-done
}

func (t *Tunnel) notify(s Status, msg string) {
	if t.OnStatus != nil {
		go t.OnStatus(s, msg)
	}
}
