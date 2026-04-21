package handlers

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"golang.org/x/crypto/ssh"
)

// GET /api/desktop/sessions/:id/vnc-ws
// 通过 SSH 隧道把 WebSocket 连接转发到计算节点的 VNC 端口（只监听 127.0.0.1）
// 供 noVNC 网页客户端使用
func VNCWebSocketProxy(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	sessions, err := loadDesktopSessions()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var session *DesktopSession
	for i := range sessions {
		if sessions[i].ID == id {
			session = &sessions[i]
			break
		}
	}
	if session == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}

	username, _ := c.Get("username")
	isAdmin, _ := c.Get("isAdmin")
	if session.Username != username.(string) && isAdmin != true {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	if session.Status != "running" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session is not running"})
		return
	}

	// 通过 SSH 隧道连接 VNC
	vncConn, sshClient, err := sshDialVNC(session.Address, session.VNCPort)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "ssh tunnel failed: " + err.Error()})
		return
	}
	defer sshClient.Close()

	wsConn, err := wsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		vncConn.Close()
		log.Printf("[VNC-WS] upgrade failed: %v", err)
		return
	}

	log.Printf("[VNC-WS] session %d: ws -> ssh(%s) -> vnc(127.0.0.1:%d)", id, session.Address, session.VNCPort)

	done := make(chan struct{}, 2)

	// VNC -> WS
	go func() {
		defer func() { done <- struct{}{} }()
		buf := make([]byte, 32*1024)
		for {
			n, err := vncConn.Read(buf)
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

	// WS -> VNC
	go func() {
		defer func() { done <- struct{}{} }()
		for {
			_, msg, err := wsConn.ReadMessage()
			if err != nil {
				return
			}
			if _, err := vncConn.Write(msg); err != nil {
				return
			}
		}
	}()

	<-done
	vncConn.Close()
	wsConn.Close()
}

func sshDialVNC(node string, vncPort int) (interface{ Read([]byte) (int, error); Write([]byte) (int, error); Close() error }, *ssh.Client, error) {
	keyPath := os.Getenv("DESKTOP_SSH_KEY")
	if keyPath == "" {
		keyPath = os.Getenv("HOME") + "/.ssh/id_rsa"
	}
	sshUser := os.Getenv("DESKTOP_SSH_USER")
	if sshUser == "" {
		sshUser = "root"
	}
	sshPort := 22
	if p := os.Getenv("DESKTOP_SSH_PORT"); p != "" {
		if v, err := strconv.Atoi(p); err == nil {
			sshPort = v
		}
	}

	keyBytes, err := os.ReadFile(keyPath)
	if err != nil {
		return nil, nil, fmt.Errorf("read ssh key %s: %w", keyPath, err)
	}
	signer, err := ssh.ParsePrivateKey(keyBytes)
	if err != nil {
		return nil, nil, fmt.Errorf("parse ssh key: %w", err)
	}

	cfg := &ssh.ClientConfig{
		User:            sshUser,
		Auth:            []ssh.AuthMethod{ssh.PublicKeys(signer)},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}

	sshConn, err := ssh.Dial("tcp", fmt.Sprintf("%s:%d", node, sshPort), cfg)
	if err != nil {
		return nil, nil, fmt.Errorf("ssh dial %s:%d: %w", node, sshPort, err)
	}

	vncConn, err := sshConn.Dial("tcp", fmt.Sprintf("127.0.0.1:%d", vncPort))
	if err != nil {
		sshConn.Close()
		return nil, nil, fmt.Errorf("tunnel to vnc port %d: %w", vncPort, err)
	}

	return vncConn, sshConn, nil
}
