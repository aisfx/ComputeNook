package handlers

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"hpc-backend/audit"
	"hpc-backend/middleware"
	"hpc-backend/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
)

const xpraAuthCookiePrefix = "xpra_auth_"

// writeDesktopAudit 记录远程桌面隧道审计日志
func writeDesktopAudit(username, clientIP string, sessionID int, action, detail string) {
	status := models.StatusSuccess
	errMsg := ""
	if action == "connect_failed" {
		status = models.StatusFailed
		errMsg = detail
		detail = ""
	}
	audit.GetLogger().Log(models.AuditLog{
		Username:   username,
		Action:     "desktop_" + action,
		Resource:   "desktop_tunnel",
		ResourceID: fmt.Sprintf("session-%d", sessionID),
		Details:    detail,
		IPAddress:  clientIP,
		Status:     status,
		ErrorMsg:   errMsg,
	})
}

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

	// 升级前端连接为 WebSocket
	wsConn, err := vncWsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[XPRA-WS] upgrade failed: %v", err)
		return
	}

	// 以 WebSocket 客户端连接到 Xpra（Xpra --bind-ws 监听的是 WS 协议，不是裸 TCP）
	xpraURL := fmt.Sprintf("ws://%s/", addr)
	xpraDialer := websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
		Subprotocols:     []string{"binary"},
	}
	xpraWs, _, err := xpraDialer.Dial(xpraURL, http.Header{
		"Origin": []string{fmt.Sprintf("http://%s", addr)},
	})
	if err != nil {
		wsConn.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseInternalServerErr, "xpra connect failed: "+err.Error()))
		wsConn.Close()
		log.Printf("[XPRA-WS] session %d: ws connect failed: %v", id, err)
		writeDesktopAudit(username.(string), c.ClientIP(), id, "connect_failed", err.Error())
		return
	}

	log.Printf("[XPRA-WS] session %d: connected", id)
	writeDesktopAudit(username.(string), c.ClientIP(), id,
		"connected", fmt.Sprintf("node=%s port=%d", session.Address, port))

	start := time.Now()
	done := make(chan struct{}, 2)

	// xpra → browser
	go func() {
		defer func() { done <- struct{}{} }()
		for {
			mt, msg, err := xpraWs.ReadMessage()
			if err != nil {
				return
			}
			if err := wsConn.WriteMessage(mt, msg); err != nil {
				return
			}
		}
	}()

	// browser → xpra
	go func() {
		defer func() { done <- struct{}{} }()
		for {
			mt, msg, err := wsConn.ReadMessage()
			if err != nil {
				return
			}
			if err := xpraWs.WriteMessage(mt, msg); err != nil {
				return
			}
		}
	}()

	<-done
	xpraWs.Close()
	wsConn.Close()
	writeDesktopAudit(username.(string), c.ClientIP(), id,
		"disconnected", fmt.Sprintf("duration=%.0fs", time.Since(start).Seconds()))
}

// VNCWebSocketProxy 保留兼容旧路由
func VNCWebSocketProxy(c *gin.Context) {
	XpraWebSocketProxy(c)
}

func authenticateXpraHTTPProxy(c *gin.Context, session *DesktopSession, sessionID int) (string, bool) {
	tokenString := c.Query("token")
	if tokenString == "" {
		if cookie, err := c.Cookie(xpraAuthCookiePrefix + strconv.Itoa(sessionID)); err == nil {
			tokenString = cookie
		}
	}
	if tokenString == "" || middleware.IsTokenRevoked(tokenString) {
		return "", false
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(os.Getenv("JWT_SECRET")), nil
	})
	if err != nil || !token.Valid {
		return "", false
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", false
	}
	if iss, ok := claims["iss"].(string); ok && iss != "" && iss != "hpc-platform" {
		return "", false
	}
	username, ok := claims["username"].(string)
	if !ok || username == "" {
		return "", false
	}
	isAdmin, _ := claims["isAdmin"].(bool)
	if session.Username != username && !isAdmin {
		return "", false
	}

	c.SetCookie(
		xpraAuthCookiePrefix+strconv.Itoa(sessionID),
		tokenString,
		3600,
		fmt.Sprintf("/api/desktop/sessions/%d/xpra-html", sessionID),
		"",
		c.Request.TLS != nil,
		true,
	)
	return username, true
}

func findDesktopSessionByID(c *gin.Context, sessionID int) (*DesktopSession, bool) {
	sessions, err := loadDesktopSessions()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return nil, false
	}
	for i := range sessions {
		if sessions[i].ID == sessionID {
			return &sessions[i], true
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
	return nil, false
}

// clientExitSignals 存储各 session 的退出信号（内存，重启后清空）
var clientExitSignals = struct {
	sync.Mutex
	m map[int]bool
}{m: make(map[int]bool)}

// POST /api/desktop/sessions/:id/client-exit
// 前端页面关闭时调用，通知 hpc-client 退出
// 注意：此接口接受 body 中的 token，因为 sendBeacon 无法设置自定义 header
func NotifyClientExit(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	session, ok := findDesktopSessionByID(c, id)
	if !ok {
		return
	}
	if !canAccessDesktopSession(c, session) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	// 从请求体中获取 token 并验证
	var body struct {
		Token string `json:"token"`
	}
	if err := c.ShouldBindJSON(&body); err == nil && body.Token != "" {
		// 简单验证 token 格式和签名
		token, err := jwt.Parse(body.Token, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(os.Getenv("JWT_SECRET")), nil
		})
		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
	}
	// 如果没有 body token，这只是一个通知信号，不强制要求认证

	clientExitSignals.Lock()
	clientExitSignals.m[id] = true
	clientExitSignals.Unlock()
	// 5分钟后自动清除信号，避免内存泄漏
	go func() {
		time.Sleep(5 * time.Minute)
		clientExitSignals.Lock()
		delete(clientExitSignals.m, id)
		clientExitSignals.Unlock()
	}()
	c.JSON(http.StatusOK, gin.H{"signal": "exit"})
}

// GET /api/desktop/sessions/:id/client-signal
// hpc-client 轮询此接口，收到 exit 信号后自动退出
func GetClientSignal(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	session, ok := findDesktopSessionByID(c, id)
	if !ok {
		return
	}
	if !canAccessDesktopSession(c, session) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	clientExitSignals.Lock()
	exit := clientExitSignals.m[id]
	if exit {
		delete(clientExitSignals.m, id)
	}
	clientExitSignals.Unlock()
	if exit {
		c.JSON(http.StatusOK, gin.H{"signal": "exit"})
	} else {
		c.JSON(http.StatusOK, gin.H{"signal": "ok"})
	}
}

// XpraHTTPProxy GET /api/desktop/sessions/:id/xpra-html/*path
// 将 Xpra 内置 HTML5 客户端的 HTTP 请求反向代理到计算节点
// WebSocket 升级请求转发到 WS 端口（VNCPort）
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
	username, ok := authenticateXpraHTTPProxy(c, session, id)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	if session.Status != "running" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session is not running"})
		return
	}

	// WebSocket 升级请求 → 转发到 Xpra WS 端口（VNCPort = ws_port）
	if websocket.IsWebSocketUpgrade(c.Request) {
		wsPort := session.VNCPort
		if wsPort == 0 {
			wsPort = session.XpraPort
		}
		addr := fmt.Sprintf("%s:%d", session.Address, wsPort)
		log.Printf("[XPRA-HTML-WS] session %d: ws upgrade → %s", id, addr)

		clientWs, err := vncWsUpgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("[XPRA-HTML-WS] upgrade failed: %v", err)
			return
		}

		xpraURL := fmt.Sprintf("ws://%s/", addr)
		xpraDialer := websocket.Dialer{
			HandshakeTimeout: 10 * time.Second,
			Subprotocols:     []string{"binary"},
		}
		xpraWs, _, err := xpraDialer.Dial(xpraURL, http.Header{
			"Origin": []string{fmt.Sprintf("http://%s", addr)},
		})
		if err != nil {
			clientWs.WriteMessage(websocket.CloseMessage,
				websocket.FormatCloseMessage(websocket.CloseInternalServerErr, "xpra ws connect failed: "+err.Error()))
			clientWs.Close()
			log.Printf("[XPRA-HTML-WS] session %d: ws connect failed: %v", id, err)
			writeDesktopAudit(username, c.ClientIP(), id, "connect_failed", err.Error())
			return
		}

		done := make(chan struct{}, 2)
		go func() {
			defer func() { done <- struct{}{} }()
			for {
				mt, msg, err := xpraWs.ReadMessage()
				if err != nil {
					return
				}
				if err := clientWs.WriteMessage(mt, msg); err != nil {
					return
				}
			}
		}()
		go func() {
			defer func() { done <- struct{}{} }()
			for {
				mt, msg, err := clientWs.ReadMessage()
				if err != nil {
					return
				}
				if err := xpraWs.WriteMessage(mt, msg); err != nil {
					return
				}
			}
		}()
		<-done
		xpraWs.Close()
		clientWs.Close()
		return
	}

	// 普通 HTTP 请求 → 代理到 Xpra WS 端口（--html=on 的 HTTP 服务也在同一端口）
	wsPort := session.VNCPort
	if wsPort == 0 {
		wsPort = session.XpraPort
	}

	subPath := c.Param("path")
	if subPath == "" || subPath == "/" {
		subPath = "/"
	}

	target := fmt.Sprintf("http://%s:%d%s", session.Address, wsPort, subPath)
	// 过滤掉 token 参数，不传给 Xpra
	if c.Request.URL.RawQuery != "" {
		q := c.Request.URL.Query()
		q.Del("token")
		if encoded := q.Encode(); encoded != "" {
			target += "?" + encoded
		}
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
	proxyReq.Header.Set("Host", fmt.Sprintf("%s:%d", session.Address, wsPort))

	httpClient := &http.Client{Timeout: 30 * time.Second}
	resp, err := httpClient.Do(proxyReq)
	if err != nil {
		log.Printf("[XPRA-HTML] session %d: http proxy failed: %v", id, err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "xpra http proxy failed: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	for k, vv := range resp.Header {
		for _, v := range vv {
			c.Header(k, v)
		}
	}

	// 对根路径的 HTML 响应注入自适应脚本
	contentType := resp.Header.Get("Content-Type")
	isHTML := strings.Contains(contentType, "text/html")
	isRoot := subPath == "/" || subPath == "/index.html"

	if isHTML && isRoot {
		// 读取全部响应体
		bodyBytes, readErr := io.ReadAll(resp.Body)
		if readErr != nil {
			c.Status(resp.StatusCode)
			return
		}
		body := string(bodyBytes)

		// 注入脚本：禁用浏览器缩放、强制 canvas 填满视口、修复鼠标坐标
		injectScript := `<script>
// ComputeNook: 自适应分辨率和鼠标坐标修复
(function() {
  // 禁用页面缩放
  var meta = document.querySelector('meta[name=viewport]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'viewport';
    document.head.appendChild(meta);
  }
  meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';

  function fixCanvas() {
    var canvas = document.getElementById('canvas') || document.querySelector('canvas');
    if (!canvas) return;

    // 强制 canvas 填满视口，无滚动条
    document.body.style.overflow = 'hidden';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.documentElement.style.overflow = 'hidden';

    var w = window.innerWidth;
    var h = window.innerHeight;

    // 设置 canvas 的 CSS 尺寸铺满
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.style.cursor = 'default';
  }

  // 页面加载后修复
  window.addEventListener('load', function() {
    fixCanvas();
    // 持续监听直到 canvas 出现
    var tries = 0;
    var timer = setInterval(function() {
      fixCanvas();
      if (++tries > 60) clearInterval(timer);
    }, 500);
  });

  // 窗口大小改变时重新修复
  window.addEventListener('resize', fixCanvas);
})();
</script>`

		// 在 </head> 前注入，如果没有 </head> 则在 </body> 前注入
		if strings.Contains(body, "</head>") {
			body = strings.Replace(body, "</head>", injectScript+"</head>", 1)
		} else if strings.Contains(body, "</body>") {
			body = strings.Replace(body, "</body>", injectScript+"</body>", 1)
		} else {
			body = body + injectScript
		}

		// 移除 Content-Length（因为内容变了）
		c.Header("Content-Length", "")
		c.Header("Content-Type", "text/html; charset=utf-8")
		c.Status(resp.StatusCode)
		c.Writer.WriteString(body)
		return
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
