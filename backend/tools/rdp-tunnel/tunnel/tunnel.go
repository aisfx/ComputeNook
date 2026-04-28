// tunnel 包：管理 WebSocket -> 本地 TCP 隧道
package tunnel

import (
	"fmt"
	"log"
	"net"
	"net/http"
	"sync"

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
