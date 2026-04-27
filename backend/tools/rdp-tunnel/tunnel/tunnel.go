// tunnel 包：管理 WebSocket -> 本地 TCP 隧道
package tunnel

import (
	"crypto/tls"
	"fmt"
	"log"
	"net"
	"net/http"
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

// insecureDialer 跳过 TLS 证书验证（内网自签名证书场景）
var insecureDialer = &websocket.Dialer{
	TLSClientConfig:  &tls.Config{InsecureSkipVerify: true}, //nolint:gosec
	HandshakeTimeout: 15 * time.Second,
}

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
// 启动前先做一次 WebSocket 连通性探测，失败直接返回错误
func (t *Tunnel) Start(wsURL, token string, localPort int) error {
	t.mu.Lock()
	defer t.mu.Unlock()

	// 预先探测 WebSocket 连通性，避免端口监听成功但每次连接都静默失败
	if err := probeWS(wsURL, token); err != nil {
		t.status = StatusError
		t.notify(StatusError, fmt.Sprintf("连接平台失败: %v", err))
		return fmt.Errorf("连接平台失败: %w", err)
	}

	if t.listener != nil {
		t.listener.Close()
	}

	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", localPort))
	if err != nil {
		t.status = StatusError
		t.notify(StatusError, fmt.Sprintf("监听端口 %d 失败: %v", localPort, err))
		return err
	}

	t.listener = ln
	t.localPort = localPort
	t.status = StatusRunning
	t.notify(StatusRunning, fmt.Sprintf("隧道已启动，监听 localhost:%d", localPort))

	go t.serve(ln, wsURL, token)
	return nil
}

// probeWS 探测 WebSocket 是否可达，成功后立即关闭
func probeWS(wsURL, token string) error {
	header := http.Header{}
	header.Set("Authorization", "Bearer "+token)
	conn, resp, err := insecureDialer.Dial(wsURL, header)
	if err != nil {
		if resp != nil {
			buf := make([]byte, 512)
			n, _ := resp.Body.Read(buf)
			resp.Body.Close()
			if n > 0 {
				return fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(buf[:n]))
			}
			return fmt.Errorf("HTTP %d: %v", resp.StatusCode, err)
		}
		return err
	}
	conn.Close()
	return nil
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

	wsConn, resp, err := insecureDialer.Dial(wsURL, header)
	if err != nil {
		if resp != nil {
			log.Printf("[tunnel] ws connect failed: %v (HTTP %d)", err, resp.StatusCode)
			buf := make([]byte, 1024)
			n, _ := resp.Body.Read(buf)
			resp.Body.Close()
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
