package handlers

import (
"encoding/json"
"fmt"
"net/http"
"os"
"strconv"
"strings"
"sync"
"time"

"hpc-backend/slurm"

"github.com/gin-gonic/gin"
)

type DesktopSession struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Type        string `json:"type"`
	Address     string `json:"address"`
	Username    string `json:"username"`
	VNCPassword string `json:"vncPassword,omitempty"`
	Resolution  string `json:"resolution,omitempty"`
	Duration    int    `json:"duration,omitempty"`
	NodeType    string `json:"nodeType,omitempty"`
	CPUs        int    `json:"cpus,omitempty"`
	Memory      int    `json:"memory,omitempty"` // GB
	Partition   string `json:"partition,omitempty"`
	CreateTime  string `json:"createTime"`
	Status      string `json:"status"`
	SlurmJobID  int64  `json:"slurmJobId,omitempty"`
	VNCPort     int    `json:"vncPort,omitempty"`
	WebURL      string `json:"webUrl,omitempty"`
}

const desktopDataFile = "desktop_sessions.json"

var desktopMu sync.Mutex

func loadDesktopSessions() ([]DesktopSession, error) {
desktopMu.Lock()
defer desktopMu.Unlock()
data, err := os.ReadFile(desktopDataFile)
if os.IsNotExist(err) {
return []DesktopSession{}, nil
}
if err != nil {
return nil, err
}
var sessions []DesktopSession
if err := json.Unmarshal(data, &sessions); err != nil {
return nil, err
}
return sessions, nil
}

func saveDesktopSessions(sessions []DesktopSession) error {
desktopMu.Lock()
defer desktopMu.Unlock()
data, err := json.MarshalIndent(sessions, "", "  ")
if err != nil {
return err
}
return os.WriteFile(desktopDataFile, data, 0644)
}

// ResourcePreset 资源规格预设
type ResourcePreset struct {
	Label  string `json:"label"`
	CPUs   int    `json:"cpus"`
	Memory int    `json:"memory"` // GB
}

// GetDesktopResourcePresets GET /api/desktop/resource-presets?partition=xxx
// 根据分区节点最大资源动态生成4档规格（最大/2 分4份）
func GetDesktopResourcePresets(c *gin.Context) {
	if _, exists := c.Get("username"); !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	username, _ := c.Get("username")
	partition := c.Query("partition")

	client, err := GetSlurmClientForUser(username.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	nodes, err := client.GetNodes()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 找出指定分区（或全部）节点中的最大 CPU 和内存
	maxCPU := 0
	maxMemMB := int64(0)
	for _, node := range nodes {
		if partition != "" {
			inPartition := false
			for _, p := range node.Partitions {
				if p == partition {
					inPartition = true
					break
				}
			}
			if !inPartition {
				continue
			}
		}
		if cpu := node.GetTotalCPUs(); cpu > maxCPU {
			maxCPU = cpu
		}
		if node.RealMemory > maxMemMB {
			maxMemMB = node.RealMemory
		}
	}

	// 默认兜底
	if maxCPU == 0 {
		maxCPU = 16
	}
	if maxMemMB == 0 {
		maxMemMB = 32 * 1024
	}

	// 以最大资源/2 为基准，分4档：1/8, 2/8, 4/8, 8/8（即 /8, /4, /2, 全量）
	base := maxCPU / 2
	if base < 1 {
		base = 1
	}
	baseMemGB := int(maxMemMB / 1024 / 2)
	if baseMemGB < 1 {
		baseMemGB = 1
	}

	presets := []ResourcePreset{
		{Label: fmt.Sprintf("微型  %d核/%dGB", max1(base/4, 1), max1(baseMemGB/4, 1)), CPUs: max1(base/4, 1), Memory: max1(baseMemGB/4, 1)},
		{Label: fmt.Sprintf("小型  %d核/%dGB", max1(base/2, 1), max1(baseMemGB/2, 1)), CPUs: max1(base/2, 1), Memory: max1(baseMemGB/2, 1)},
		{Label: fmt.Sprintf("中型  %d核/%dGB", base, baseMemGB), CPUs: base, Memory: baseMemGB},
		{Label: fmt.Sprintf("大型  %d核/%dGB", base*2, baseMemGB*2), CPUs: base * 2, Memory: baseMemGB * 2},
	}

	c.JSON(http.StatusOK, gin.H{"data": presets, "maxCPU": maxCPU, "maxMemGB": int(maxMemMB / 1024)})
}

func max1(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// GET /api/desktop/sessions
func GetDesktopSessions(c *gin.Context) {
sessions, err := loadDesktopSessions()
if err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
return
}
username, _ := c.Get("username")
isAdmin, _ := c.Get("is_admin")
if isAdmin != true {
filtered := []DesktopSession{}
for _, s := range sessions {
if s.Username == username {
filtered = append(filtered, s)
}
}
sessions = filtered
}
c.JSON(http.StatusOK, gin.H{"data": sessions})
}

// POST /api/desktop/sessions
func CreateDesktopSession(c *gin.Context) {
var req struct {
Name       string `json:"name" binding:"required"`
Type       string `json:"type" binding:"required"`
Resolution string `json:"resolution"`
Duration   int    `json:"duration"`
NodeType   string `json:"nodeType"`
CPUs       int    `json:"cpus"`
Memory     int    `json:"memory"` // GB
Partition  string `json:"partition"`
}
if err := c.ShouldBindJSON(&req); err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
return
}

sessions, err := loadDesktopSessions()
if err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
return
}

maxID := 0
for _, s := range sessions {
if s.ID > maxID {
maxID = s.ID
}
}

username, _ := c.Get("username")

resolution := req.Resolution
if resolution == "" {
resolution = "1920x1080"
}
duration := req.Duration
if duration == 0 {
duration = 4
}

session := DesktopSession{
ID:         maxID + 1,
Name:       req.Name,
Type:       req.Type,
Username:   username.(string),
Resolution: resolution,
Duration:   duration,
NodeType:   req.NodeType,
CPUs:       req.CPUs,
Memory:     req.Memory,
Partition:  req.Partition,
CreateTime: time.Now().Format("2006-01-02T15:04:05"),
Status:     "stopped",
}

sessions = append([]DesktopSession{session}, sessions...)
if err := saveDesktopSessions(sessions); err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
return
}
c.JSON(http.StatusOK, gin.H{"data": session})
}

// POST /api/desktop/sessions/:id/start
func StartDesktopSession(c *gin.Context) {
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
if session.Username != username.(string) {
isAdmin, _ := c.Get("is_admin")
if isAdmin != true {
c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
return
}
}

script := buildDesktopScript(session)

client, err := GetSlurmClientForUser(username.(string))
if err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "slurm client error: " + err.Error()})
return
}

var startReq struct {
Partition string `json:"partition"`
}
_ = c.ShouldBindJSON(&startReq)

partition := startReq.Partition
if partition == "" {
partition = session.Partition
}
if partition == "" {
partition = os.Getenv("DESKTOP_PARTITION")
}
if partition == "" {
partition = "compute"
}
session.Partition = partition

timeLimit := session.Duration
if timeLimit == 0 {
timeLimit = 8
}

homeBase := os.Getenv("HOME_BASE_PATH")
if homeBase == "" {
homeBase = "/home"
}

cpus, memory := 2, 4
// 优先使用 session 中直接存储的 cpus/memory（来自动态预设）
if session.CPUs > 0 {
	cpus = session.CPUs
} else {
	switch session.NodeType {
	case "small":
		cpus, memory = 1, 2
	case "medium":
		cpus, memory = 2, 4
	case "large":
		cpus, memory = 4, 8
	case "debug":
		cpus, memory = 1, 2
	case "standard":
		cpus, memory = 2, 4
	case "high-mem":
		cpus, memory = 4, 8
	case "gpu":
		cpus, memory = 4, 8
	}
}
if session.Memory > 0 {
	memory = session.Memory
}

jobID, err := client.SubmitJob(slurm.JobSubmitParams{
Name:      "desktop-" + session.Name,
Partition: partition,
Script:    script,
Nodes:     1,
CPUs:      cpus,
Memory:    memory,
TimeLimit: timeLimit,
WorkDir:   fmt.Sprintf("%s/%s", homeBase, username.(string)),
Output:    fmt.Sprintf("%s/%s/.desktop/%d.out", homeBase, username.(string), session.ID),
Error:     fmt.Sprintf("%s/%s/.desktop/%d.err", homeBase, username.(string), session.ID),
Username:  username.(string),
})
if err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "submit job failed: " + err.Error()})
return
}

session.SlurmJobID = jobID
session.Status = "pending"
if err := saveDesktopSessions(sessions); err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
return
}

go pollDesktopJob(session.ID, jobID, username.(string))

c.JSON(http.StatusOK, gin.H{"data": session, "jobId": jobID})
}

// GET /api/desktop/sessions/:id/status
func GetDesktopSessionStatus(c *gin.Context) {
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

for _, s := range sessions {
if s.ID == id {
c.JSON(http.StatusOK, gin.H{"data": s})
return
}
}
c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
}

// POST /api/desktop/sessions/:id/stop
func StopDesktopSession(c *gin.Context) {
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

for i := range sessions {
if sessions[i].ID == id {
if sessions[i].SlurmJobID > 0 {
username, _ := c.Get("username")
client, err := GetSlurmClientForUser(username.(string))
if err == nil {
_ = client.CancelJob(sessions[i].SlurmJobID)
}
}
sessions[i].Status = "stopped"
sessions[i].SlurmJobID = 0
sessions[i].VNCPort = 0
_ = saveDesktopSessions(sessions)
c.JSON(http.StatusOK, gin.H{"data": sessions[i]})
return
}
}
c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
}

// DELETE /api/desktop/sessions/:id
func DeleteDesktopSession(c *gin.Context) {
idStr := c.Param("id")
sessions, err := loadDesktopSessions()
if err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
return
}
filtered := []DesktopSession{}
for _, s := range sessions {
if fmt.Sprintf("%d", s.ID) != idStr {
filtered = append(filtered, s)
}
}
if err := saveDesktopSessions(filtered); err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
return
}
c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// buildDesktopScript 生成 sbatch 脚本：TurboVNC + xfce4
// 每个 session 使用独立的 VNC 配置目录 ~/.vnc-job-{id}，密码和日志完全隔离
func buildDesktopScript(session *DesktopSession) string {
	baseDisplay := session.ID
	baseVncPort := 5900 + baseDisplay

	resolution := session.Resolution
	if resolution == "" || resolution == "auto" {
		resolution = "1920x1080"
	}
	desktopType := session.Type
	if desktopType == "" {
		desktopType = "xfce"
	}

	homeBase := os.Getenv("HOME_BASE_PATH")
	if homeBase == "" {
		homeBase = "/home"
	}
	statusDir := fmt.Sprintf("%s/%s/.desktop", homeBase, session.Username)
	statusFile := fmt.Sprintf("%s/%d.status", statusDir, session.ID)
	// 每个 job 独立 VNC 目录，密码/passwd/pid/log 完全隔离
	vncDir := fmt.Sprintf("%s/%s/.vnc-job-%d", homeBase, session.Username, session.ID)

	var b strings.Builder
	b.WriteString("#!/bin/bash\n")
	b.WriteString(fmt.Sprintf("mkdir -p %s %s\n\n", statusDir, vncDir))
	b.WriteString(fmt.Sprintf("export HOME=${HOME:-%s/%s}\n", homeBase, session.Username))
	b.WriteString("export PATH=/opt/TurboVNC/bin:/usr/bin:/usr/local/bin:/bin:/usr/sbin:/sbin:$PATH\n")
	b.WriteString(fmt.Sprintf("export VNCUSERDIR=%s\n\n", vncDir))

	// xstartup
	b.WriteString(fmt.Sprintf("cat > %s/xstartup << 'XSTARTUP'\n", vncDir))
	b.WriteString("#!/bin/bash\n")
	b.WriteString("unset SESSION_MANAGER\nunset DBUS_SESSION_BUS_ADDRESS\n")
	b.WriteString("export XDG_SESSION_TYPE=x11\n")
	b.WriteString("export XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-/tmp/runtime-$(id -u)}\n")
	b.WriteString("mkdir -p $XDG_RUNTIME_DIR && chmod 700 $XDG_RUNTIME_DIR\n")
	switch desktopType {
	case "xfce", "xfce4":
		b.WriteString("exec startxfce4\n")
	case "gnome":
		b.WriteString("exec gnome-session\n")
	case "kde":
		b.WriteString("exec startkde\n")
	default:
		b.WriteString("if command -v startxfce4 &>/dev/null; then exec startxfce4\n")
		b.WriteString("elif command -v gnome-session &>/dev/null; then exec gnome-session\n")
		b.WriteString("elif command -v startkde &>/dev/null; then exec startkde\n")
		b.WriteString("else exec xterm; fi\n")
	}
	b.WriteString("XSTARTUP\n")
	b.WriteString(fmt.Sprintf("chmod +x %s/xstartup\n\n", vncDir))

	// 独立 VNC 密码
	b.WriteString("VNC_PASS=$(openssl rand -base64 6 | tr -d '/+=' | head -c 8)\n")
	b.WriteString(fmt.Sprintf("echo \"$VNC_PASS\" | vncpasswd -f > %s/passwd\n", vncDir))
	b.WriteString(fmt.Sprintf("chmod 600 %s/passwd\n\n", vncDir))

	// 动态查找空闲 display/port
	b.WriteString(fmt.Sprintf("BASE_DISPLAY=%d\nBASE_PORT=%d\n", baseDisplay, baseVncPort))
	b.WriteString("DISPLAY_NUM=$BASE_DISPLAY\nVNC_PORT=$BASE_PORT\n")
	b.WriteString("for try in $(seq 0 19); do\n")
	b.WriteString("  DISPLAY_NUM=$((BASE_DISPLAY + try))\n  VNC_PORT=$((BASE_PORT + try))\n")
	b.WriteString("  if [ ! -f /tmp/.X${DISPLAY_NUM}-lock ] && ! ss -tlnp 2>/dev/null | grep -q \":${VNC_PORT}\"; then\n    break\n  fi\ndone\n\n")

	// 状态文件
	b.WriteString(fmt.Sprintf("echo 'status=starting' > %s\n", statusFile))
	b.WriteString(fmt.Sprintf("echo \"node=$(hostname)\" >> %s\n", statusFile))
	b.WriteString(fmt.Sprintf("echo \"vnc_port=$VNC_PORT\" >> %s\n", statusFile))
	b.WriteString(fmt.Sprintf("echo \"display=$DISPLAY_NUM\" >> %s\n", statusFile))
	b.WriteString(fmt.Sprintf("echo \"password=$VNC_PASS\" >> %s\n", statusFile))
	b.WriteString(fmt.Sprintf("echo \"vnc_dir=%s\" >> %s\n", vncDir, statusFile))

	// 清理残留
	b.WriteString("vncserver -kill :${DISPLAY_NUM} 2>/dev/null || true\nsleep 1\n")
	b.WriteString("pkill -f \"Xvnc :${DISPLAY_NUM}\" 2>/dev/null || true\n")
	b.WriteString("pkill -f \"Xtigervnc :${DISPLAY_NUM}\" 2>/dev/null || true\n")
	b.WriteString(fmt.Sprintf("kill -9 $(cat %s/$(hostname):${DISPLAY_NUM}.pid 2>/dev/null) 2>/dev/null || true\n", vncDir))
	b.WriteString("sleep 1\n")
	b.WriteString("rm -f /tmp/.X${DISPLAY_NUM}-lock /tmp/.X11-unix/X${DISPLAY_NUM} 2>/dev/null || true\n\n")

	// 启动 TurboVNC，使用独立目录
	startCmd := fmt.Sprintf("vncserver :${DISPLAY_NUM} -geometry %s -depth 24 -rfbauth %s/passwd -alwaysshared -rfbport ${VNC_PORT} -vncUserDir %s -log %s/vnc.log\n",
		resolution, vncDir, vncDir, vncDir)
	b.WriteString(startCmd)
	b.WriteString("VNC_EXIT=$?\n")
	b.WriteString("if [ $VNC_EXIT -ne 0 ]; then\n")
	b.WriteString("  pkill -9 -f \"Xvnc :${DISPLAY_NUM}\" 2>/dev/null || true\n")
	b.WriteString("  rm -f /tmp/.X${DISPLAY_NUM}-lock /tmp/.X11-unix/X${DISPLAY_NUM} 2>/dev/null || true\n")
	b.WriteString("  sleep 3\n")
	b.WriteString("  " + startCmd)
	b.WriteString("  VNC_EXIT=$?\nfi\n")
	b.WriteString("if [ $VNC_EXIT -ne 0 ]; then\n")
	b.WriteString(fmt.Sprintf("  echo 'status=failed' >> %s\n  exit 1\nfi\n\n", statusFile))

	// 等待端口就绪
	b.WriteString("for i in $(seq 1 20); do\n")
	b.WriteString("  ss -tlnp 2>/dev/null | grep -q \":${VNC_PORT}\" && break\n  sleep 1\ndone\n\n")
	b.WriteString(fmt.Sprintf("echo 'status=running' >> %s\n\n", statusFile))

	// 保持运行
	durationSec := session.Duration * 3600
	if durationSec <= 0 {
		durationSec = 4 * 3600
	}
	b.WriteString(fmt.Sprintf("END_TIME=$(($(date +%%s) + %d))\n", durationSec))
	b.WriteString("while [ $(date +%s) -lt $END_TIME ]; do\n")
	b.WriteString("  ss -tlnp 2>/dev/null | grep -q \":${VNC_PORT}\" || break\n  sleep 30\ndone\n\n")
	b.WriteString("vncserver -kill :${DISPLAY_NUM} 2>/dev/null || true\n")
	b.WriteString(fmt.Sprintf("echo 'status=stopped' >> %s\n", statusFile))

	return b.String()
}
func buildDesktopScript(session *DesktopSession) string {
	// display 从 :1 开始，vncPort 从 5901 开始
	// 脚本里会动态检测端口是否被占用，自动往后找空闲的
	baseDisplay := session.ID  // :1, :2, :3 ...
	baseVncPort := 5900 + baseDisplay

	resolution := session.Resolution
	if resolution == "" || resolution == "auto" {
		resolution = "1920x1080"
	}
	desktopType := session.Type
	if desktopType == "" {
		desktopType = "xfce"
	}

	homeBase := os.Getenv("HOME_BASE_PATH")
	if homeBase == "" {
		homeBase = "/home"
	}
	statusDir := fmt.Sprintf("%s/%s/.desktop", homeBase, session.Username)
	statusFile := fmt.Sprintf("%s/%d.status", statusDir, session.ID)

	var b strings.Builder
	b.WriteString("#!/bin/bash\n")
	b.WriteString(fmt.Sprintf("mkdir -p %s\n\n", statusDir))
	// 补全环境变量，Slurm 有时不传 HOME
	b.WriteString(fmt.Sprintf("export HOME=${HOME:-%s/%s}\n", homeBase, session.Username))
	b.WriteString("export PATH=/opt/TurboVNC/bin:/usr/bin:/usr/local/bin:/bin:/usr/sbin:/sbin:$PATH\n\n")

	// ── xstartup：自适应桌面环境 ──
	b.WriteString("mkdir -p ~/.vnc\n")
	b.WriteString("cat > ~/.vnc/xstartup << 'XSTARTUP'\n")
	b.WriteString("#!/bin/bash\n")
	b.WriteString("unset SESSION_MANAGER\n")
	b.WriteString("unset DBUS_SESSION_BUS_ADDRESS\n")
	b.WriteString("export XDG_SESSION_TYPE=x11\n")
	b.WriteString("export XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-/tmp/runtime-$(id -u)}\n")
	b.WriteString("mkdir -p $XDG_RUNTIME_DIR && chmod 700 $XDG_RUNTIME_DIR\n")
	if desktopType != "" && desktopType != "auto" {
		switch desktopType {
		case "xfce", "xfce4":
			b.WriteString("exec startxfce4\n")
		case "gnome":
			b.WriteString("exec gnome-session\n")
		case "kde":
			b.WriteString("exec startkde\n")
		default:
			b.WriteString("exec startxfce4\n")
		}
	} else {
		// 自适应：按优先级检测已安装的桌面环境
		b.WriteString("if command -v startxfce4 &>/dev/null; then\n")
		b.WriteString("  exec startxfce4\n")
		b.WriteString("elif command -v gnome-session &>/dev/null; then\n")
		b.WriteString("  exec gnome-session\n")
		b.WriteString("elif command -v startkde &>/dev/null; then\n")
		b.WriteString("  exec startkde\n")
		b.WriteString("elif command -v startlxde &>/dev/null; then\n")
		b.WriteString("  exec startlxde\n")
		b.WriteString("elif command -v openbox-session &>/dev/null; then\n")
		b.WriteString("  exec openbox-session\n")
		b.WriteString("else\n")
		b.WriteString("  exec xterm\n")
		b.WriteString("fi\n")
	}
	b.WriteString("XSTARTUP\n")
	b.WriteString("chmod +x ~/.vnc/xstartup\n\n")

	// ── 生成 VNC 密码（随机8位）──
	b.WriteString("VNC_PASS=$(openssl rand -base64 6 | tr -d '/+=' | head -c 8)\n")
	b.WriteString("echo \"$VNC_PASS\" | vncpasswd -f > ~/.vnc/passwd\n")
	b.WriteString("chmod 600 ~/.vnc/passwd\n\n")

	// ── 动态查找空闲的 display 和 rfbport（从指定基准开始往后找）──
	b.WriteString(fmt.Sprintf("BASE_DISPLAY=%d\n", baseDisplay))
	b.WriteString(fmt.Sprintf("BASE_PORT=%d\n", baseVncPort))
	b.WriteString("DISPLAY_NUM=$BASE_DISPLAY\n")
	b.WriteString("VNC_PORT=$BASE_PORT\n")
	b.WriteString("# 找一个没有锁文件且端口未被占用的 display\n")
	b.WriteString("for try in $(seq 0 19); do\n")
	b.WriteString("  DISPLAY_NUM=$((BASE_DISPLAY + try))\n")
	b.WriteString("  VNC_PORT=$((BASE_PORT + try))\n")
	b.WriteString("  # 检查 X lock 文件和端口是否空闲\n")
	b.WriteString("  if [ ! -f /tmp/.X${DISPLAY_NUM}-lock ] && ! ss -tlnp 2>/dev/null | grep -q \":${VNC_PORT}\"; then\n")
	b.WriteString("    break\n")
	b.WriteString("  fi\n")
	b.WriteString("done\n\n")

	// ── 状态文件 ──
	b.WriteString(fmt.Sprintf("echo 'status=starting' > %s\n", statusFile))
	b.WriteString(fmt.Sprintf("echo \"node=$(hostname)\" >> %s\n", statusFile))
	b.WriteString(fmt.Sprintf("echo \"vnc_port=$VNC_PORT\" >> %s\n", statusFile))
	b.WriteString(fmt.Sprintf("echo \"display=$DISPLAY_NUM\" >> %s\n", statusFile))
	b.WriteString(fmt.Sprintf("echo \"password=$VNC_PASS\" >> %s\n", statusFile))

	// ── 清理该 display 可能残留的旧进程 ──
	b.WriteString("vncserver -kill :${DISPLAY_NUM} 2>/dev/null || true\n")
	b.WriteString("sleep 1\n")
	b.WriteString("pkill -f \"Xvnc :${DISPLAY_NUM}\" 2>/dev/null || true\n")
	b.WriteString("pkill -f \"Xtigervnc :${DISPLAY_NUM}\" 2>/dev/null || true\n")
	b.WriteString("if [ -f ~/.vnc/$(hostname):${DISPLAY_NUM}.pid ]; then\n")
	b.WriteString("  kill -9 $(cat ~/.vnc/$(hostname):${DISPLAY_NUM}.pid) 2>/dev/null || true\n")
	b.WriteString("fi\n")
	b.WriteString("sleep 1\n")
	b.WriteString("rm -f /tmp/.X${DISPLAY_NUM}-lock /tmp/.X11-unix/X${DISPLAY_NUM} 2>/dev/null || true\n")
	b.WriteString("rm -f ~/.vnc/*:${DISPLAY_NUM}.pid ~/.vnc/*:${DISPLAY_NUM}.log 2>/dev/null || true\n\n")

	// ── 启动 TurboVNC server ──
	b.WriteString(fmt.Sprintf("vncserver :${DISPLAY_NUM} -geometry %s -depth 24 -rfbauth ~/.vnc/passwd -alwaysshared -rfbport ${VNC_PORT}\n", resolution))
	b.WriteString("VNC_EXIT=$?\n")
	b.WriteString("if [ $VNC_EXIT -ne 0 ]; then\n")
	b.WriteString("  echo '[desktop] first attempt failed, retrying after hard cleanup...' >&2\n")
	b.WriteString("  pkill -9 -f \"Xvnc :${DISPLAY_NUM}\" 2>/dev/null || true\n")
	b.WriteString("  pkill -9 -f \"Xtigervnc :${DISPLAY_NUM}\" 2>/dev/null || true\n")
	b.WriteString("  rm -f /tmp/.X${DISPLAY_NUM}-lock /tmp/.X11-unix/X${DISPLAY_NUM} ~/.vnc/*:${DISPLAY_NUM}.pid 2>/dev/null || true\n")
	b.WriteString("  sleep 3\n")
	b.WriteString(fmt.Sprintf("  vncserver :${DISPLAY_NUM} -geometry %s -depth 24 -rfbauth ~/.vnc/passwd -alwaysshared -rfbport ${VNC_PORT}\n", resolution))
	b.WriteString("  VNC_EXIT=$?\n")
	b.WriteString("fi\n")
	b.WriteString("if [ $VNC_EXIT -ne 0 ]; then\n")
	b.WriteString(fmt.Sprintf("  echo 'status=failed' >> %s\n", statusFile))
	b.WriteString("  echo '[desktop] vncserver failed, exit code: '$VNC_EXIT >&2\n")
	b.WriteString("  exit 1\n")
	b.WriteString("fi\n\n")

	// 等待 VNC 端口就绪（最多20秒）
	b.WriteString("for i in $(seq 1 20); do\n")
	b.WriteString("  ss -tlnp 2>/dev/null | grep -q \":${VNC_PORT}\" && break\n")
	b.WriteString("  sleep 1\n")
	b.WriteString("done\n\n")

	b.WriteString(fmt.Sprintf("echo 'status=running' >> %s\n\n", statusFile))

	// 保持 job 运行到时间到期，每30秒检查 VNC 是否还在
	durationSec := session.Duration * 3600
	if durationSec <= 0 {
		durationSec = 4 * 3600
	}
	b.WriteString(fmt.Sprintf("END_TIME=$(($(date +%%s) + %d))\n", durationSec))
	b.WriteString("while [ $(date +%s) -lt $END_TIME ]; do\n")
	b.WriteString("  ss -tlnp 2>/dev/null | grep -q \":${VNC_PORT}\" || break\n")
	b.WriteString("  sleep 30\n")
	b.WriteString("done\n\n")

	b.WriteString("vncserver -kill :${DISPLAY_NUM} 2>/dev/null || true\n")
	b.WriteString(fmt.Sprintf("echo 'status=stopped' >> %s\n", statusFile))

	return b.String()
}

// pollDesktopJob 轮询 Slurm 作业状态：
// 阶段1：等待作业进入 RUNNING，更新 session 地址和端口
// 阶段2：持续监控，作业结束后自动将 session 标记为 stopped
func pollDesktopJob(sessionID int, jobID int64, username string) {
	client, err := GetSlurmClientForUser(username)
	if err != nil {
		return
	}

	homeBase := os.Getenv("HOME_BASE_PATH")
	if homeBase == "" {
		homeBase = "/home"
	}
	statusFile := fmt.Sprintf("%s/%s/.desktop/%d.status", homeBase, username, sessionID)

	setStatus := func(status string) {
		sessions, _ := loadDesktopSessions()
		for i := range sessions {
			if sessions[i].ID == sessionID {
				sessions[i].Status = status
				if status == "stopped" || status == "failed" {
					sessions[i].SlurmJobID = 0
					sessions[i].VNCPort = 0
				}
				_ = saveDesktopSessions(sessions)
				break
			}
		}
	}

	// 阶段1：等待 RUNNING，最多等 5 分钟
	running := false
	for i := 0; i < 60; i++ {
		time.Sleep(5 * time.Second)

		job, err := client.GetJob(jobID)
		if err != nil {
			continue
		}

		state := strings.ToUpper(strings.TrimSpace(job.GetJobState()))
		if state == "FAILED" || state == "CANCELLED" || state == "TIMEOUT" || state == "COMPLETED" {
			// 检查状态文件，判断是 failed 还是 stopped
			data, _ := os.ReadFile(statusFile)
			if strings.Contains(string(data), "status=failed") {
				setStatus("failed")
			} else {
				setStatus("failed") // 还没到 running 就结束了，算失败
			}
			return
		}

		if strings.HasPrefix(state, "RUNNING") {
			node := job.Nodes
			rdpPort := 5901 // 默认从5901开始
			vncPassword := ""
			vncReady := false

			// 等待状态文件里出现 status=running（最多等2分钟）
			for w := 0; w < 24; w++ {
				time.Sleep(5 * time.Second)
				data, err := os.ReadFile(statusFile)
				if err != nil {
					continue
				}
				content := string(data)
				// 检查是否失败
				if strings.Contains(content, "status=failed") {
					setStatus("failed")
					return
				}
				if strings.Contains(content, "status=running") {
					for _, line := range strings.Split(content, "\n") {
						parts := strings.SplitN(line, "=", 2)
						if len(parts) != 2 {
							continue
						}
						switch strings.TrimSpace(parts[0]) {
						case "vnc_port":
							if p, err := strconv.Atoi(strings.TrimSpace(parts[1])); err == nil {
								rdpPort = p
							}
						case "node":
							if v := strings.TrimSpace(parts[1]); v != "" {
								node = v
							}
						case "password":
							vncPassword = strings.TrimSpace(parts[1])
						}
					}
					vncReady = true
					break
				}
			}

			if !vncReady {
				setStatus("failed")
				return
			}

			sessions, _ := loadDesktopSessions()
			for i := range sessions {
				if sessions[i].ID == sessionID {
					sessions[i].Status = "running"
					sessions[i].Address = node
					sessions[i].VNCPort = rdpPort
					if vncPassword != "" {
						sessions[i].VNCPassword = vncPassword
					}
					_ = saveDesktopSessions(sessions)
					break
				}
			}
			running = true
			break
		}
	}

	if !running {
		setStatus("failed")
		return
	}

	// 阶段2：持续监控，直到作业结束
	// 连续查询失败超过 3 次才认为作业结束，避免网络抖动误判
	failCount := 0
	for {
		time.Sleep(10 * time.Second)

		job, err := client.GetJob(jobID)
		if err != nil {
			failCount++
			if failCount >= 3 {
				// 查不到作业，尝试从状态文件判断
				data, ferr := os.ReadFile(statusFile)
				if ferr == nil && strings.Contains(string(data), "status=stopped") {
					setStatus("stopped")
				} else {
					setStatus("stopped") // 默认标记 stopped，不标 failed
				}
				return
			}
			continue
		}
		failCount = 0

		state := strings.ToUpper(strings.TrimSpace(job.GetJobState()))
		switch {
		case state == "FAILED" || state == "TIMEOUT" || state == "NODE_FAIL" || state == "PREEMPTED":
			setStatus("failed")
			return
		case state == "CANCELLED" || state == "COMPLETED":
			setStatus("stopped")
			return
		case strings.HasPrefix(state, "RUNNING"):
			// 继续监控，同时检查状态文件是否有 stopped 标记
			data, ferr := os.ReadFile(statusFile)
			if ferr == nil && strings.Contains(string(data), "status=stopped") {
				// job 脚本自己写了 stopped，取消 job
				_ = client.CancelJob(jobID)
				setStatus("stopped")
				return
			}
		case state == "COMPLETING":
			// 正在收尾
		}
	}
}

// GET /api/desktop/sessions/:id/logs?type=out|err&lines=100
func GetDesktopSessionLogs(c *gin.Context) {
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
isAdmin, _ := c.Get("is_admin")
if session.Username != username.(string) && isAdmin != true {
c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
return
}

logType := c.DefaultQuery("type", "out")
linesStr := c.DefaultQuery("lines", "100")
maxLines, _ := strconv.Atoi(linesStr)
if maxLines <= 0 || maxLines > 500 {
maxLines = 100
}

homeBase := os.Getenv("HOME_BASE_PATH")
if homeBase == "" {
homeBase = "/home"
}
logFile := fmt.Sprintf("%s/%s/.desktop/%d.%s", homeBase, session.Username, id, logType)
data, err := os.ReadFile(logFile)
if err != nil {
if os.IsNotExist(err) {
c.JSON(http.StatusOK, gin.H{"lines": []string{}, "file": logFile, "exists": false})
return
}
c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
return
}

allLines := strings.Split(string(data), "\n")
if len(allLines) > maxLines {
allLines = allLines[len(allLines)-maxLines:]
}

c.JSON(http.StatusOK, gin.H{
"lines":  allLines,
"file":   logFile,
"exists": true,
"total":  len(allLines),
})
}

// GET /api/desktop/sessions/:id/script
func GetDesktopScript(c *gin.Context) {
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
isAdmin, _ := c.Get("is_admin")
if session.Username != username.(string) && isAdmin != true {
c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
return
}

script := buildDesktopScript(session)

homeBase := os.Getenv("HOME_BASE_PATH")
if homeBase == "" {
homeBase = "/home"
}
partition := session.Partition
if partition == "" {
partition = os.Getenv("DESKTOP_PARTITION")
}
if partition == "" {
partition = "compute"
}

c.JSON(http.StatusOK, gin.H{
"script":    script,
"partition": partition,
"workdir":   fmt.Sprintf("%s/%s", homeBase, session.Username),
"output":    fmt.Sprintf("%s/%s/.desktop/%d.out", homeBase, session.Username, id),
"error":     fmt.Sprintf("%s/%s/.desktop/%d.err", homeBase, session.Username, id),
})
}