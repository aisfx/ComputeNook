package webshell

import (
	"fmt"
	"io"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// SessionManager 会话管理器
type SessionManager struct {
	sessions map[string]*WebShellSession
	mutex    sync.RWMutex
}

// WebShellSession Web Shell会话
type WebShellSession struct {
	ID        string           `json:"id"`
	UserID    string           `json:"user_id"`
	Username  string           `json:"username"`
	Host      string           `json:"host"`
	Port      int              `json:"port"`
	CreatedAt time.Time        `json:"created_at"`
	LastUsed  time.Time        `json:"last_used"`
	Status    string           `json:"status"` // connecting, connected, disconnected, error
	
	sshClient *SSHClient
	wsConn    *websocket.Conn
	logger    *SessionLogger
	
	// 控制通道
	done     chan struct{}
	resize   chan ResizeMsg
	input    chan []byte
	output   chan []byte
}

// ResizeMsg 终端大小调整消息
type ResizeMsg struct {
	Rows int `json:"rows"`
	Cols int `json:"cols"`
}

// WebSocketMessage WebSocket消息
type WebSocketMessage struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

// NewSessionManager 创建会话管理器
func NewSessionManager() *SessionManager {
	return &SessionManager{
		sessions: make(map[string]*WebShellSession),
	}
}

// CreateSession 创建新会话
func (sm *SessionManager) CreateSession(sessionID, userID, username string, config SSHConfig, wsConn *websocket.Conn) (*WebShellSession, error) {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()

	// 检查会话是否已存在
	if _, exists := sm.sessions[sessionID]; exists {
		return nil, fmt.Errorf("session already exists")
	}

	// 创建SSH客户端
	sshClient := NewSSHClient(config)

	// 创建会话日志记录器
	logger := NewSessionLogger(sessionID, userID, username, config.Host)

	// 创建会话
	session := &WebShellSession{
		ID:        sessionID,
		UserID:    userID,
		Username:  username,
		Host:      config.Host,
		Port:      config.Port,
		CreatedAt: time.Now(),
		LastUsed:  time.Now(),
		Status:    "connecting",
		sshClient: sshClient,
		wsConn:    wsConn,
		logger:    logger,
		done:      make(chan struct{}),
		resize:    make(chan ResizeMsg, 10),
		input:     make(chan []byte, 100),
		output:    make(chan []byte, 100),
	}

	sm.sessions[sessionID] = session

	// 记录会话创建
	logger.LogEvent("session_created", map[string]interface{}{
		"host": config.Host,
		"port": config.Port,
	})

	return session, nil
}

// GetSession 获取会话
func (sm *SessionManager) GetSession(sessionID string) (*WebShellSession, bool) {
	sm.mutex.RLock()
	defer sm.mutex.RUnlock()
	
	session, exists := sm.sessions[sessionID]
	if exists {
		session.LastUsed = time.Now()
	}
	return session, exists
}

// RemoveSession 移除会话
func (sm *SessionManager) RemoveSession(sessionID string) {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()
	
	if session, exists := sm.sessions[sessionID]; exists {
		session.Close()
		delete(sm.sessions, sessionID)
	}
}

// ListSessions 列出所有会话
func (sm *SessionManager) ListSessions() []*WebShellSession {
	sm.mutex.RLock()
	defer sm.mutex.RUnlock()
	
	sessions := make([]*WebShellSession, 0, len(sm.sessions))
	for _, session := range sm.sessions {
		sessions = append(sessions, session)
	}
	return sessions
}

// CleanupExpiredSessions 清理过期会话
func (sm *SessionManager) CleanupExpiredSessions(timeout time.Duration) {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()
	
	now := time.Now()
	for sessionID, session := range sm.sessions {
		if now.Sub(session.LastUsed) > timeout {
			log.Printf("Cleaning up expired session: %s", sessionID)
			session.Close()
			delete(sm.sessions, sessionID)
		}
	}
}

// Start 启动会话
func (s *WebShellSession) Start() error {
	// 连接SSH
	if err := s.sshClient.Connect(); err != nil {
		s.Status = "error"
		s.logger.LogEvent("connection_failed", map[string]interface{}{
			"error": err.Error(),
		})
		return fmt.Errorf("failed to connect SSH: %w", err)
	}

	// 创建SSH会话
	if err := s.sshClient.CreateSession(); err != nil {
		s.Status = "error"
		s.logger.LogEvent("session_creation_failed", map[string]interface{}{
			"error": err.Error(),
		})
		return fmt.Errorf("failed to create SSH session: %w", err)
	}

	// 请求伪终端
	if err := s.sshClient.RequestPty("xterm-256color", 24, 80); err != nil {
		s.Status = "error"
		return fmt.Errorf("failed to request pty: %w", err)
	}

	// 设置输入输出
	stdinPipe, err := s.sshClient.session.StdinPipe()
	if err != nil {
		s.Status = "error"
		return fmt.Errorf("failed to get stdin pipe: %w", err)
	}

	stdoutPipe, err := s.sshClient.session.StdoutPipe()
	if err != nil {
		s.Status = "error"
		return fmt.Errorf("failed to get stdout pipe: %w", err)
	}

	stderrPipe, err := s.sshClient.session.StderrPipe()
	if err != nil {
		s.Status = "error"
		return fmt.Errorf("failed to get stderr pipe: %w", err)
	}

	// 启动shell
	if err := s.sshClient.Shell(); err != nil {
		s.Status = "error"
		return fmt.Errorf("failed to start shell: %w", err)
	}

	s.Status = "connected"
	s.logger.LogEvent("connection_established", nil)

	// 启动goroutines处理输入输出
	go s.handleInput(stdinPipe)
	go s.handleOutput(stdoutPipe, stderrPipe)
	go s.handleWebSocket()
	go s.handleResize()

	return nil
}

// handleInput 处理输入
func (s *WebShellSession) handleInput(stdin io.WriteCloser) {
	defer stdin.Close()
	
	for {
		select {
		case data := <-s.input:
			if _, err := stdin.Write(data); err != nil {
				log.Printf("Failed to write to stdin: %v", err)
				return
			}
			// 记录用户输入
			s.logger.LogCommand(string(data))
		case <-s.done:
			return
		}
	}
}

// handleOutput 处理输出
func (s *WebShellSession) handleOutput(stdout, stderr io.Reader) {
	// 合并stdout和stderr
	combined := io.MultiReader(stdout, stderr)
	buffer := make([]byte, 1024)
	
	for {
		select {
		case <-s.done:
			return
		default:
			n, err := combined.Read(buffer)
			if err != nil {
				if err != io.EOF {
					log.Printf("Failed to read from output: %v", err)
				}
				return
			}
			
			if n > 0 {
				data := make([]byte, n)
				copy(data, buffer[:n])
				
				select {
				case s.output <- data:
					// 记录输出
					s.logger.LogOutput(string(data))
				case <-s.done:
					return
				}
			}
		}
	}
}

// handleWebSocket 处理WebSocket消息
func (s *WebShellSession) handleWebSocket() {
	defer s.Close()
	
	for {
		select {
		case data := <-s.output:
			// 发送输出到WebSocket
			msg := WebSocketMessage{
				Type: "output",
				Data: string(data),
			}
			if err := s.wsConn.WriteJSON(msg); err != nil {
				log.Printf("Failed to write to WebSocket: %v", err)
				return
			}
			
		case <-s.done:
			return
		}
	}
}

// handleResize 处理终端大小调整
func (s *WebShellSession) handleResize() {
	for {
		select {
		case resize := <-s.resize:
			if err := s.sshClient.ResizeWindow(resize.Rows, resize.Cols); err != nil {
				log.Printf("Failed to resize terminal: %v", err)
			}
		case <-s.done:
			return
		}
	}
}

// SendInput 发送输入
func (s *WebShellSession) SendInput(data []byte) {
	select {
	case s.input <- data:
	case <-s.done:
	}
}

// Resize 调整终端大小
func (s *WebShellSession) Resize(rows, cols int) {
	select {
	case s.resize <- ResizeMsg{Rows: rows, Cols: cols}:
	case <-s.done:
	}
}

// Close 关闭会话
func (s *WebShellSession) Close() {
	select {
	case <-s.done:
		return // 已经关闭
	default:
		close(s.done)
	}
	
	s.Status = "disconnected"
	
	if s.sshClient != nil {
		s.sshClient.Close()
	}
	
	if s.wsConn != nil {
		s.wsConn.Close()
	}
	
	if s.logger != nil {
		s.logger.LogEvent("session_closed", nil)
		s.logger.Close()
	}
}

// GetInfo 获取会话信息
func (s *WebShellSession) GetInfo() map[string]interface{} {
	return map[string]interface{}{
		"id":         s.ID,
		"user_id":    s.UserID,
		"username":   s.Username,
		"host":       s.Host,
		"port":       s.Port,
		"created_at": s.CreatedAt,
		"last_used":  s.LastUsed,
		"status":     s.Status,
	}
}