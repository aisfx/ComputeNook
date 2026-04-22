package handlers

import (
	"fmt"
	"log"
	"net"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// GET /api/desktop/sessions/:id/vnc-ws
// 直接 TCP 连接计算节点的 VNC 端口，转为 WebSocket 供 noVNC 使用
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

	// 直接 TCP 连接计算节点 VNC 端口
	addr := fmt.Sprintf("%s:%d", session.Address, session.VNCPort)
	log.Printf("[VNC-WS] session %d: connecting to %s", id, addr)

	vncConn, err := net.DialTimeout("tcp", addr, 10*time.Second)
	if err != nil {
		log.Printf("[VNC-WS] session %d: tcp connect failed: %v", id, err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "vnc connect failed: " + err.Error()})
		return
	}

	wsConn, err := vncWsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		vncConn.Close()
		log.Printf("[VNC-WS] upgrade failed: %v", err)
		return
	}

	log.Printf("[VNC-WS] session %d: connected, subprotocol=%s", id, wsConn.Subprotocol())

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
