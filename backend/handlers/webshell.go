package handlers

import (
	"crypto/ed25519"
	"crypto/x509"
	"encoding/pem"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/google/uuid"
	"hpc-backend/webshell"
	gossh "golang.org/x/crypto/ssh"
)

var (
	// WebSocket升级器（复用 ssh_proxy.go 里的 checkWebSocketOrigin）
	upgrader = websocket.Upgrader{
		CheckOrigin: checkWebSocketOrigin,
	}

	// 全局会话管理器
	sessionManager = webshell.NewSessionManager()
)

// NodeConfig 节点配置
type NodeConfig struct {
	Name        string `json:"name"`
	Host        string `json:"host"`
	Port        int    `json:"port"`
	Description string `json:"description"`
	Enabled     bool   `json:"enabled"`
}

// WebShellConnectRequest 连接请求
type WebShellConnectRequest struct {
	NodeName   string `json:"node_name"`
	PrivateKey string `json:"private_key,omitempty"`
}

// GetNodes 获取可用节点列表
func GetNodes(c *gin.Context) {
	nodes, err := loadNodesFromEnv()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"data": nodes})
}

// ConnectWebShell WebSocket连接处理
func ConnectWebShell(c *gin.Context) {
	// 获取用户信息（从中间件设置的 context）
	userInterface, exists := c.Get("user")
	if !exists {
		log.Printf("ConnectWebShell: User not found in context")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	
	user, ok := userInterface.(map[string]interface{})
	if !ok {
		log.Printf("ConnectWebShell: Invalid user data type")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user data"})
		return
	}
	
	userIDInterface, exists := user["uid"]
	if !exists {
		log.Printf("ConnectWebShell: UID not found in user data")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User ID not found"})
		return
	}
	
	userID, ok := userIDInterface.(string)
	if !ok {
		log.Printf("ConnectWebShell: UID is not a string, type: %T", userIDInterface)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID format"})
		return
	}
	
	usernameInterface, exists := user["username"]
	if !exists {
		log.Printf("ConnectWebShell: Username not found in user data")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Username not found"})
		return
	}
	
	username, ok := usernameInterface.(string)
	if !ok {
		log.Printf("ConnectWebShell: Username is not a string")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid username format"})
		return
	}
	
	log.Printf("ConnectWebShell: User authenticated - ID: %s, Username: %s", userID, username)

	// MFA 校验
	if IsMFARequired(username) {
		mfaCode := c.Query("mfaCode")
		if !ValidateTOTP(username, mfaCode) {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "需要双因子验证码",
				"code":  "MFA_REQUIRED",
			})
			return
		}
	}

	// 获取连接参数
	nodeName := c.Query("node")
	if nodeName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Node name is required"})
		return
	}
	
	// 获取密码（可选，如果没有私钥则必须提供）
	password := c.Query("password")
	
	// 加载节点配置
	nodes, err := loadNodesFromEnv()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	var nodeConfig *NodeConfig
	for _, node := range nodes {
		if node.Name == nodeName {
			nodeConfig = &node
			break
		}
	}
	
	if nodeConfig == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Node not found"})
		return
	}
	
	if !nodeConfig.Enabled {
		c.JSON(http.StatusForbidden, gin.H{"error": "Node is disabled"})
		return
	}
	
	// 升级到WebSocket连接
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	// 生成会话ID
	sessionID := uuid.New().String()
	
	// 尝试获取用户私钥（可选）
	privateKey, keyErr := getUserPrivateKey(userID)
	
	// 如果没有私钥且没有密码，返回错误
	if keyErr != nil && password == "" {
		// 会话还未创建，直接写入（此时没有并发问题）
		conn.WriteJSON(map[string]interface{}{
			"type": "auth_required",
			"data": "No private key found. Please provide password or upload private key.",
		})
		conn.Close()
		return
	}
	
	// 创建SSH配置（用户名固定为当前登录用户）
	sshConfig := webshell.SSHConfig{
		Host:       nodeConfig.Host,
		Port:       nodeConfig.Port,
		Username:   username, // 固定使用当前登录用户名
		PrivateKey: privateKey,
		Password:   password,
	}
	
	// 创建会话
	session, err := sessionManager.CreateSession(sessionID, userID, username, sshConfig, conn)
	if err != nil {
		// 会话创建失败，直接写入（此时没有并发问题）
		conn.WriteJSON(map[string]interface{}{
			"type": "error",
			"data": "Failed to create session: " + err.Error(),
		})
		conn.Close()
		return
	}
	
	// 启动会话
	if err := session.Start(); err != nil {
		// 使用会话的安全写入方法
		session.WriteMessage("error", "Failed to start session: "+err.Error())
		sessionManager.RemoveSession(sessionID)
		return
	}
	
	// 发送连接成功消息（使用会话的安全写入方法）
	session.WriteMessage("connected", map[string]interface{}{
		"session_id": sessionID,
		"node":       nodeName,
		"username":   username, // 返回实际使用的用户名
		"auth_method": func() string {
			if privateKey != "" {
				return "private_key"
			}
			return "password"
		}(),
	})
	
	// 处理WebSocket消息
	go handleWebSocketMessages(session, conn)
}

// handleWebSocketMessages 处理WebSocket消息
func handleWebSocketMessages(session *webshell.WebShellSession, conn *websocket.Conn) {
	defer sessionManager.RemoveSession(session.ID)
	
	for {
		var msg map[string]interface{}
		if err := conn.ReadJSON(&msg); err != nil {
			break
		}
		
		msgType, ok := msg["type"].(string)
		if !ok {
			continue
		}
		
		switch msgType {
		case "input":
			if data, ok := msg["data"].(string); ok {
				session.SendInput([]byte(data))
			}
			
		case "resize":
			if data, ok := msg["data"].(map[string]interface{}); ok {
				if rows, ok := data["rows"].(float64); ok {
					if cols, ok := data["cols"].(float64); ok {
						session.Resize(int(rows), int(cols))
					}
				}
			}
			
		case "ping":
			// 使用会话的安全写入方法
			session.WriteMessage("pong", nil)
		}
	}
}

// GetSessions 获取用户会话列表
func GetSessions(c *gin.Context) {
	// 获取用户信息
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	
	user := userInterface.(map[string]interface{})
	userID := user["uid"].(string)
	
	// 获取所有会话
	allSessions := sessionManager.ListSessions()
	
	// 过滤用户会话
	var userSessions []map[string]interface{}
	for _, session := range allSessions {
		if session.UserID == userID {
			userSessions = append(userSessions, session.GetInfo())
		}
	}
	
	c.JSON(http.StatusOK, gin.H{"data": userSessions})
}

// CloseSession 关闭会话
func CloseSession(c *gin.Context) {
	sessionID := c.Param("session_id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Session ID is required"})
		return
	}
	
	// 获取用户信息
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	
	user := userInterface.(map[string]interface{})
	userID := user["uid"].(string)
	
	// 检查会话是否存在且属于当前用户
	session, exists := sessionManager.GetSession(sessionID)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"})
		return
	}
	
	if session.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}
	
	// 关闭会话
	sessionManager.RemoveSession(sessionID)
	
	c.JSON(http.StatusOK, gin.H{"message": "Session closed"})
}

// GetSessionLogs 获取会话日志
func GetSessionLogs(c *gin.Context) {
	// 获取用户信息
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	
	user := userInterface.(map[string]interface{})
	userID := user["uid"].(string)
	
	// 获取查询参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	search := c.Query("search")
	
	// 列出用户日志文件
	logFiles, err := webshell.ListUserLogs(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	// 分页处理
	start := (page - 1) * limit
	end := start + limit
	if start >= len(logFiles) {
		c.JSON(http.StatusOK, gin.H{
			"data": []string{},
			"total": len(logFiles),
			"page": page,
			"limit": limit,
		})
		return
	}
	
	if end > len(logFiles) {
		end = len(logFiles)
	}
	
	pageFiles := logFiles[start:end]
	
	// 如果有搜索条件，搜索日志内容
	var results []map[string]interface{}
	for _, logFile := range pageFiles {
		logInfo := map[string]interface{}{
			"file": filepath.Base(logFile),
			"path": logFile,
		}
		
		if search != "" {
			entries, err := webshell.SearchLogs(logFile, search)
			if err == nil && len(entries) > 0 {
				logInfo["matches"] = len(entries)
				logInfo["entries"] = entries
			}
		}
		
		results = append(results, logInfo)
	}
	
	c.JSON(http.StatusOK, gin.H{
		"data": results,
		"total": len(logFiles),
		"page": page,
		"limit": limit,
	})
}

// DownloadSessionLog 下载会话日志
func DownloadSessionLog(c *gin.Context) {
	logFile := c.Param("log_file")
	if logFile == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Log file is required"})
		return
	}
	
	// 获取用户信息
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	
	user := userInterface.(map[string]interface{})
	userID := user["uid"].(string)
	
	// 构建日志文件路径
	logPath := filepath.Join("logs", "webshell", userID, logFile)
	
	// 检查文件是否存在
	if _, err := os.Stat(logPath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Log file not found"})
		return
	}
	
	// 设置响应头
	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Transfer-Encoding", "binary")
	c.Header("Content-Disposition", "attachment; filename="+logFile)
	c.Header("Content-Type", "application/octet-stream")
	
	// 发送文件
	c.File(logPath)
}

// loadNodesFromEnv 从环境变量加载节点配置
func loadNodesFromEnv() ([]NodeConfig, error) {
	nodesEnv := os.Getenv("WEBSHELL_NODES")
	if nodesEnv == "" {
		return []NodeConfig{}, nil
	}
	
	var nodes []NodeConfig
	if err := json.Unmarshal([]byte(nodesEnv), &nodes); err != nil {
		return nil, fmt.Errorf("failed to parse nodes configuration: %w", err)
	}
	
	return nodes, nil
}

// getUserPrivateKey 获取用户私钥
func getUserPrivateKey(userID string) (string, error) {
	// 从用户目录加载私钥
	keyPath := filepath.Join("keys", userID, "id_rsa")
	
	// 检查文件是否存在
	if _, err := os.Stat(keyPath); os.IsNotExist(err) {
		return "", fmt.Errorf("private key not found for user %s", userID)
	}
	
	// 读取私钥文件
	keyBytes, err := os.ReadFile(keyPath)
	if err != nil {
		return "", fmt.Errorf("failed to read private key: %w", err)
	}
	
	return string(keyBytes), nil
}

// UploadPrivateKey 上传用户私钥
func UploadPrivateKey(c *gin.Context) {
	// 获取用户信息
	userInterface, exists := c.Get("user")
	if !exists {
		log.Printf("UploadPrivateKey: User not found in context")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	
	user, ok := userInterface.(map[string]interface{})
	if !ok {
		log.Printf("UploadPrivateKey: Invalid user data type")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user data"})
		return
	}
	
	userIDInterface, exists := user["uid"]
	if !exists {
		log.Printf("UploadPrivateKey: UID not found in user data")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User ID not found"})
		return
	}
	
	userID, ok := userIDInterface.(string)
	if !ok {
		log.Printf("UploadPrivateKey: UID is not a string")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID format"})
		return
	}
	
	log.Printf("UploadPrivateKey: Processing upload for user %s", userID)
	
	// 获取上传的文件
	file, err := c.FormFile("private_key")
	if err != nil {
		log.Printf("UploadPrivateKey: No file uploaded: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}
	
	log.Printf("UploadPrivateKey: Received file %s", file.Filename)
	
	// 创建用户密钥目录
	keyDir := filepath.Join("keys", userID)
	if err := os.MkdirAll(keyDir, 0700); err != nil {
		log.Printf("UploadPrivateKey: Failed to create key directory: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create key directory"})
		return
	}
	
	// 保存私钥文件
	keyPath := filepath.Join(keyDir, "id_rsa")
	if err := c.SaveUploadedFile(file, keyPath); err != nil {
		log.Printf("UploadPrivateKey: Failed to save private key: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save private key"})
		return
	}
	
	// 设置文件权限
	if err := os.Chmod(keyPath, 0600); err != nil {
		log.Printf("UploadPrivateKey: Failed to set key permissions: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set key permissions"})
		return
	}
	
	log.Printf("UploadPrivateKey: Successfully uploaded key for user %s", userID)
	c.JSON(http.StatusOK, gin.H{"message": "Private key uploaded successfully"})
}

// CheckPrivateKey 检查用户是否已上传私钥
func CheckPrivateKey(c *gin.Context) {
	// 获取用户信息
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	
	user := userInterface.(map[string]interface{})
	userID := user["uid"].(string)
	
	// 检查私钥文件是否存在
	keyPath := filepath.Join("keys", userID, "id_rsa")
	_, err := os.Stat(keyPath)
	
	c.JSON(http.StatusOK, gin.H{
		"has_key": err == nil,
	})
}

// TestNodeConnection 测试节点连接
func TestNodeConnection(c *gin.Context) {
	nodeName := c.Param("node_name")
	if nodeName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Node name is required"})
		return
	}
	
	// 获取用户信息
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	
	user := userInterface.(map[string]interface{})
	userID := user["uid"].(string)
	username := user["username"].(string)
	
	// 加载节点配置
	nodes, err := loadNodesFromEnv()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	var nodeConfig *NodeConfig
	for _, node := range nodes {
		if node.Name == nodeName {
			nodeConfig = &node
			break
		}
	}
	
	if nodeConfig == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Node not found"})
		return
	}
	
	// 获取用户私钥
	privateKey, err := getUserPrivateKey(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// 创建SSH配置
	sshConfig := webshell.SSHConfig{
		Host:       nodeConfig.Host,
		Port:       nodeConfig.Port,
		Username:   username,
		PrivateKey: privateKey,
	}
	
	// 测试连接
	if err := webshell.TestConnection(sshConfig); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"error": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Connection successful",
	})
}

// 启动会话清理定时任务
func init() {
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		
		for range ticker.C {
			sessionManager.CleanupExpiredSessions(30 * time.Minute)
		}
	}()
}

// GenerateKeyPair 为当前用户生成 SSH 密钥对
// POST /api/webshell/keys/generate
// 私钥存 keys/{uid}/id_rsa，公钥返回给前端（用于添加到计算节点 authorized_keys）
func GenerateKeyPair(c *gin.Context) {
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	user := userInterface.(map[string]interface{})
	userID := user["uid"].(string)
	username := user["username"].(string)

	// 生成 ED25519 密钥对
	pubKey, privKey, err := generateED25519KeyPair(username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "生成密钥失败: " + err.Error()})
		return
	}

	// 保存私钥
	keyDir := filepath.Join("keys", userID)
	if err := os.MkdirAll(keyDir, 0700); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建目录失败"})
		return
	}
	keyPath := filepath.Join(keyDir, "id_rsa")
	if err := os.WriteFile(keyPath, []byte(privKey), 0600); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存私钥失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"public_key":  pubKey,
		"private_key": privKey,
		"message":     "密钥生成成功，请将公钥添加到计算节点的 ~/.ssh/authorized_keys",
	})
}

// generateED25519KeyPair 生成 ED25519 密钥对，返回 (公钥, 私钥PEM, error)
func generateED25519KeyPair(comment string) (string, string, error) {
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		return "", "", err
	}

	// 私钥转 PEM
	privBytes, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		return "", "", err
	}
	privPEM := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: privBytes})

	// 公钥转 authorized_keys 格式
	sshPub, err := gossh.NewPublicKey(pub)
	if err != nil {
		return "", "", err
	}
	pubStr := string(gossh.MarshalAuthorizedKey(sshPub))
	// 追加注释
	pubStr = strings.TrimRight(pubStr, "\n") + " " + comment + "\n"

	return pubStr, string(privPEM), nil
}
