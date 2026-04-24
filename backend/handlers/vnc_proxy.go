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

// GET /api/desktop/sessions/:id/xpra-ws
// 将后端到计算节点 Xpra WebSocket 端口的 TCP 连接代理给前端
func XpraWebSocketProxy(c *gin.Context) {
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

	port := session.XpraPort
	if port == 0 {
		port = session.VNCPort // 兼容旧数据
	}
	addr := fmt.Sprintf("%s:%d", session.Address, port)
	log.Printf("[XPRA-WS] session %d: connecting to %s", id, addr)

	xpraConn, err := net.DialTimeout("tcp", addr, 10*time.Second)
	if err != nil {
		log.Printf("[XPRA-WS] session %d: tcp connect failed: %v", id, err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "xpra connect failed: " + err.Error()})
		return
	}

	wsConn, err := vncWsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		xpraConn.Close()
		log.Printf("[XPRA-WS] upgrade failed: %v", err)
		return
	}

	log.Printf("[XPRA-WS] session %d: connected", id)
	done := make(chan struct{}, 2)

	go func() {
		defer func() { done <- struct{}{} }()
		buf := make([]byte, 32*1024)
		for {
			n, err := xpraConn.Read(buf)
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

	go func() {
		defer func() { done <- struct{}{} }()
		for {
			_, msg, err := wsConn.ReadMessage()
			if err != nil {
				return
			}
			if _, err := xpraConn.Write(msg); err != nil {
				return
			}
		}
	}()

	<-done
	xpraConn.Close()
	wsConn.Close()
}

// VNCWebSocketProxy 保留兼容旧路由
func VNCWebSocketProxy(c *gin.Context) {
	XpraWebSocketProxy(c)
}
