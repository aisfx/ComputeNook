package handlers

import (
"fmt"
"io"
"net"
"net/http"
"os"
"path/filepath"
"strconv"
"strings"
"sync"
"time"

"hpc-backend/audit"
"hpc-backend/models"

"github.com/gin-gonic/gin"
"github.com/gorilla/websocket"
"golang.org/x/crypto/ssh"
)

var wsUpgrader = websocket.Upgrader{
CheckOrigin:     func(r *http.Request) bool { return true },
ReadBufferSize:  32 * 1024,
WriteBufferSize: 32 * 1024,
}

// vncWsUpgrader 专用于 VNC 代理，支持 binary 子协议
var vncWsUpgrader = websocket.Upgrader{
	CheckOrigin:    func(r *http.Request) bool { return true },
	ReadBufferSize:  32 * 1024,
	WriteBufferSize: 32 * 1024,
	Subprotocols:   []string{"binary"},
}
// GET /api/ssh/proxy?host=cn1&port=22&user=alice
// TCP 透传：给客户端 ssh/PuTTY 使用，WebSocket 里是原始 SSH 协议流。
// 安全：白名单 + JWT + user 必须与平台用户名一致。
func SSHWebSocketProxy(c *gin.Context) {
host := c.Query("host")
portStr := c.DefaultQuery("port", "22")
if host == "" {
c.JSON(http.StatusBadRequest, gin.H{"error": "host required"})
return
}
port, err := strconv.Atoi(portStr)
if err != nil || port <= 0 {
port = 22
}

username, _ := c.Get("username")
isAdmin, _ := c.Get("isAdmin")

sshUser := c.DefaultQuery("user", username.(string))
if sshUser != username.(string) && isAdmin != true {
c.JSON(http.StatusForbidden, gin.H{"error": "not allowed"})
return
}

// 禁止通过平台代理以 root 或其他系统账号登录
blockedUsers := []string{"root", "daemon", "bin", "sys", "nobody"}
for _, blocked := range blockedUsers {
if sshUser == blocked {
c.JSON(http.StatusForbidden, gin.H{"error": "不允许通过平台代理以 " + blocked + " 身份登录"})
return
}
}

if !isAllowedHost(host) {
c.JSON(http.StatusForbidden, gin.H{"error": "host not allowed"})
return
}

clientIP := c.ClientIP()
sshTCPProxy(c, host, port, sshUser, username.(string), clientIP)
}

// sshTCPProxy TCP 透传，给 ssh/PuTTY 客户端用
func sshTCPProxy(c *gin.Context, host string, port int, sshUser, username, clientIP string) {
target := fmt.Sprintf("%s:%d", host, port)
sshConn, err := net.Dial("tcp", target)
if err != nil {
writeSSHAudit(username, clientIP, host, port, "connect_failed", err.Error())
c.JSON(http.StatusBadGateway, gin.H{"error": "cannot connect to " + target})
return
}

wsConn, err := wsUpgrader.Upgrade(c.Writer, c.Request, nil)
if err != nil {
sshConn.Close()
return
}

writeSSHAudit(username, clientIP, host, port, "connected",
fmt.Sprintf("ssh_user=%s method=tcp_proxy", sshUser))

recorder := newSSHTunnelRecorder(username, clientIP, host, port)
defer recorder.close()

done := make(chan struct{}, 2)

go func() {
defer func() { done <- struct{}{} }()
buf := make([]byte, 32*1024)
for {
n, err := sshConn.Read(buf)
if n > 0 {
wsConn.WriteMessage(websocket.BinaryMessage, buf[:n]) //nolint:errcheck
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
recorder.mu.Lock()
recorder.inputBytes += len(msg)
recorder.mu.Unlock()
sshConn.Write(msg) //nolint:errcheck
}
}()

<-done
sshConn.Close()
wsConn.Close()

writeSSHAudit(username, clientIP, host, port, "disconnected",
fmt.Sprintf("duration=%.0fs bytes_in=%d", time.Since(recorder.startTime).Seconds(), recorder.inputBytes))
}

// sshAuthProxy 服务端认证模式：后端用私钥认证，把 shell stdio 透传给 WebSocket。
// 给浏览器 WebShell 使用，不给 ssh 命令用。
func sshAuthProxy(c *gin.Context, host string, port int, sshUser, username, clientIP, privateKey string) {
signer, err := ssh.ParsePrivateKey([]byte(privateKey))
if err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "key parse failed"})
return
}

sshCfg := &ssh.ClientConfig{
User:            sshUser,
Auth:            []ssh.AuthMethod{ssh.PublicKeys(signer)},
HostKeyCallback: ssh.InsecureIgnoreHostKey(),
Timeout:         15 * time.Second,
}

sshClient, err := ssh.Dial("tcp", fmt.Sprintf("%s:%d", host, port), sshCfg)
if err != nil {
writeSSHAudit(username, clientIP, host, port, "connect_failed", err.Error())
c.JSON(http.StatusBadGateway, gin.H{"error": "SSH auth failed: " + err.Error()})
return
}

wsConn, err := wsUpgrader.Upgrade(c.Writer, c.Request, nil)
if err != nil {
sshClient.Close()
return
}

writeSSHAudit(username, clientIP, host, port, "connected",
fmt.Sprintf("ssh_user=%s method=pubkey", sshUser))

recorder := newSSHTunnelRecorder(username, clientIP, host, port)
defer recorder.close()

sess, err := sshClient.NewSession()
if err != nil {
wsConn.Close()
sshClient.Close()
return
}
defer sess.Close()

modes := ssh.TerminalModes{ssh.ECHO: 1, ssh.TTY_OP_ISPEED: 38400, ssh.TTY_OP_OSPEED: 38400}
sess.RequestPty("xterm-256color", 40, 200, modes) //nolint:errcheck
stdin, _ := sess.StdinPipe()
stdout, _ := sess.StdoutPipe()
stderr, _ := sess.StderrPipe()
sess.Shell() //nolint:errcheck

done := make(chan struct{}, 3)

go func() {
defer func() { done <- struct{}{} }()
buf := make([]byte, 32*1024)
for {
n, err := stdout.Read(buf)
if n > 0 {
wsConn.WriteMessage(websocket.BinaryMessage, buf[:n]) //nolint:errcheck
}
if err != nil {
return
}
}
}()

go func() {
defer func() { done <- struct{}{} }()
buf := make([]byte, 4*1024)
for {
n, err := stderr.Read(buf)
if n > 0 {
wsConn.WriteMessage(websocket.BinaryMessage, buf[:n]) //nolint:errcheck
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
recorder.mu.Lock()
recorder.inputBytes += len(msg)
recorder.mu.Unlock()
io.WriteString(stdin, string(msg)) //nolint:errcheck
}
}()

<-done
sess.Close()
sshClient.Close()
wsConn.Close()

writeSSHAudit(username, clientIP, host, port, "disconnected",
fmt.Sprintf("duration=%.0fs bytes_in=%d", time.Since(recorder.startTime).Seconds(), recorder.inputBytes))
}

func isAllowedHost(host string) bool {
nodes, err := loadNodesFromEnv()
if err != nil || len(nodes) == 0 {
return true
}
for _, n := range nodes {
if n.Host == host || n.Name == host {
return true
}
}
return false
}

func writeSSHAudit(username, clientIP, host string, port int, action, detail string) {
status := models.StatusSuccess
errMsg := ""
if action == "connect_failed" {
status = models.StatusFailed
errMsg = detail
detail = ""
}
audit.GetLogger().Log(models.AuditLog{
Username:   username,
Action:     "ssh_" + action,
Resource:   "ssh_tunnel",
ResourceID: fmt.Sprintf("%s:%d", host, port),
Details:    detail,
IPAddress:  clientIP,
Status:     status,
ErrorMsg:   errMsg,
})
}

type sshTunnelRecorder struct {
username   string
clientIP   string
host       string
port       int
startTime  time.Time
inputBytes int
logFile    *os.File
mu         sync.Mutex
}

func newSSHTunnelRecorder(username, clientIP, host string, port int) *sshTunnelRecorder {
r := &sshTunnelRecorder{
username:  username,
clientIP:  clientIP,
host:      host,
port:      port,
startTime: time.Now(),
}
logDir := filepath.Join("logs", "ssh_tunnel", username)
if err := os.MkdirAll(logDir, 0755); err == nil {
ts := time.Now().Format("20060102_150405")
fname := fmt.Sprintf("%s_%s_%d.log", ts, host, port)
f, err := os.OpenFile(filepath.Join(logDir, fname), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
if err == nil {
r.logFile = f
r.writeLine(fmt.Sprintf("[SESSION_START] user=%s client_ip=%s target=%s:%d time=%s",
username, clientIP, host, port, time.Now().Format(time.RFC3339)))
}
}
return r
}

func (r *sshTunnelRecorder) writeLine(s string) {
if r.logFile == nil {
return
}
r.logFile.WriteString(time.Now().Format("2006-01-02T15:04:05") + " " + s + "\n")
}

func (r *sshTunnelRecorder) close() {
r.mu.Lock()
defer r.mu.Unlock()
if r.logFile != nil {
r.writeLine(fmt.Sprintf("[SESSION_END] duration=%.0fs bytes_in=%d",
time.Since(r.startTime).Seconds(), r.inputBytes))
r.logFile.Close()
r.logFile = nil
}
}

func isDangerousCommand(cmd string) bool {
dangerous := []string{"rm -rf", "mkfs", "dd if=", "shutdown", "reboot", "halt", "poweroff"}
lower := strings.ToLower(cmd)
for _, d := range dangerous {
if strings.Contains(lower, d) {
return true
}
}
return false
}

func isSignificantOutput(line string) bool {
keywords := []string{"permission denied", "error:", "failed", "denied"}
lower := strings.ToLower(line)
for _, kw := range keywords {
if strings.Contains(lower, kw) {
return true
}
}
return false
}

func stripANSIBytes(data []byte) string {
var out strings.Builder
i := 0
for i < len(data) {
if data[i] == 0x1b && i+1 < len(data) && data[i+1] == '[' {
i += 2
for i < len(data) && (data[i] < 0x40 || data[i] > 0x7e) {
i++
}
i++
} else if data[i] >= 0x20 || data[i] == '\n' || data[i] == '\r' || data[i] == '\t' {
out.WriteByte(data[i])
i++
} else {
i++
}
}
return out.String()
}