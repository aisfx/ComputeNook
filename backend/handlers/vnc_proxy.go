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

// XpraHTTPProxy GET /api/desktop/sessions/:id/xpra-html/*path
// 将 Xpra 内置 HTML5 客户端的 HTTP 请求反向代理到计算节点
func XpraHTTPProxy(c *gin.Context) {
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

	if session.Status != "running" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session is not running"})
		return
	}

	port := session.XpraPort
	if port == 0 {
		port = session.VNCPort
	}

	subPath := c.Param("path")
	if subPath == "" || subPath == "/" {
		subPath = "/"
	}

	target := fmt.Sprintf("http://%s:%d%s", session.Address, port, subPath)
	if c.Request.URL.RawQuery != "" {
		target += "?" + c.Request.URL.RawQuery
	}

	proxyReq, err := http.NewRequest(c.Request.Method, target, c.Request.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	for k, vv := range c.Request.Header {
		for _, v := range vv {
			proxyReq.Header.Add(k, v)
		}
	}
	proxyReq.Header.Set("Host", fmt.Sprintf("%s:%d", session.Address, port))

	httpClient := &http.Client{Timeout: 30 * time.Second}
	resp, err := httpClient.Do(proxyReq)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "xpra http proxy failed: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	for k, vv := range resp.Header {
		for _, v := range vv {
			c.Header(k, v)
		}
	}
	c.Status(resp.StatusCode)

	buf := make([]byte, 32*1024)
	for {
		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			c.Writer.Write(buf[:n])
		}
		if readErr != nil {
			break
		}
	}
}
