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
	Mode        string `json:"mode"`        // "desktop" | "app"
	AppCommand  string `json:"appCommand,omitempty"` // 应用模式下的启动命令
	Address     string `json:"address"`
	Username    string `json:"username"`
	XpraPort    int    `json:"xpraPort,omitempty"`
	XpraDisplay int    `json:"xpraDisplay,omitempty"`
	Resolution  string `json:"resolution,omitempty"`
	Duration    int    `json:"duration,omitempty"`
	CPUs        int    `json:"cpus,omitempty"`
	Memory      int    `json:"memory,omitempty"` // GB
	Partition   string `json:"partition,omitempty"`
	CreateTime  string `json:"createTime"`
	Status      string `json:"status"`
	SlurmJobID  int64  `json:"slurmJobId,omitempty"`
	WebURL      string `json:"webUrl,omitempty"`
	// 兼容旧字�?
	Type        string `json:"type,omitempty"`
	VNCPort     int    `json:"vncPort,omitempty"`
	VNCPassword string `json:"vncPassword,omitempty"`
	NodeType    string `json:"nodeType,omitempty"`
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
// 根据分区节点最大资源动态生�?档规格（最�?2 �?份）
func GetDesktopResourcePresets(c *gin.Context) {
	if _, exists := c.Get("username"); !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授�?})
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

	// 找出指定分区（或全部）节点中的最�?CPU 和内�?
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

	// 以最大资�?2 为基准，�?档：1/8, 2/8, 4/8, 8/8（即 /8, /4, /2, 全量�?
	base := maxCPU / 2
	if base < 1 {
		base = 1
	}
	baseMemGB := int(maxMemMB / 1024 / 2)
	if baseMemGB < 1 {
		baseMemGB = 1
	}

	presets := []ResourcePreset{
		{Label: fmt.Sprintf("微型  %d�?%dGB", max1(base/4, 1), max1(baseMemGB/4, 1)), CPUs: max1(base/4, 1), Memory: max1(baseMemGB/4, 1)},
		{Label: fmt.Sprintf("小型  %d�?%dGB", max1(base/2, 1), max1(baseMemGB/2, 1)), CPUs: max1(base/2, 1), Memory: max1(baseMemGB/2, 1)},
		{Label: fmt.Sprintf("中型  %d�?%dGB", base, baseMemGB), CPUs: base, Memory: baseMemGB},
		{Label: fmt.Sprintf("大型  %d�?%dGB", base*2, baseMemGB*2), CPUs: base * 2, Memory: baseMemGB * 2},
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
Mode       string `json:"mode"`       // "desktop" | "app"
AppCommand  string `json:"appCommand"` // 应用模式启动命令
Type       string `json:"type"`
Resolution string `json:"resolution"`
Duration   int    `json:"duration"`
NodeType   string `json:"nodeType"`
CPUs       int    `json:"cpus"`
Memory     int    `json:"memory"`
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

mode := req.Mode
if mode == "" {
	mode = "desktop"
}
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
Mode:       mode,
AppCommand:  req.AppCommand,
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
sessions[i].XpraPort = 0
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

// buildDesktopScript generates sbatch script for Xpra desktop/app session.
// All runtime files go to $HOME/.xpra/job-${SLURM_JOB_ID}/ for full isolation.
// trap EXIT cleans up X locks and Xpra on job exit.
func buildDesktopScript(session *DesktopSession) string {
homeBase := os.Getenv("HOME_BASE_PATH")
if homeBase == "" {
homeBase = "/home"
}
statusDir := fmt.Sprintf("%s/%s/.desktop", homeBase, session.Username)
statusFile := fmt.Sprintf("%s/%d.status", statusDir, session.ID)

resolution := session.Resolution
if resolution == "" || resolution == "auto" {
resolution = "1920x1080"
}
mode := session.Mode
if mode == "" {
mode = "desktop"
}
desktopEnv := "xfce4"
if session.Type != "" {
switch session.Type {
case "gnome":
desktopEnv = "gnome"
case "kde":
desktopEnv = "kde"
}
}
appCmd := session.AppCommand
if mode == "app" && appCmd == "" {
appCmd = "xterm"
}
durationSec := session.Duration * 3600
if durationSec <= 0 {
durationSec = 4 * 3600
}

var b strings.Builder
b.WriteString("#!/bin/bash\n")
b.WriteString(fmt.Sprintf("export HOME=${HOME:-%s/%s}\n", homeBase, session.Username))
b.WriteString("export PATH=/opt/xpra/bin:/usr/bin:/usr/local/bin:/bin:/usr/sbin:/sbin:$PATH\n\n")

b.WriteString("JOB_ID=${SLURM_JOB_ID:-$$}\n")
b.WriteString("JOB_DIR=\"$HOME/.xpra/job-${JOB_ID}\"\n")
b.WriteString(fmt.Sprintf("mkdir -p \"$JOB_DIR\" %s\n\n", statusDir))

// trap: cleanup on job exit (SIGTERM from scancel, EXIT, etc.)
b.WriteString("DISPLAY_NUM=\nXPRA_PID=\n")
b.WriteString("cleanup() {\n")
b.WriteString("  [ -n \"$XPRA_PID\" ] && kill $XPRA_PID 2>/dev/null || true\n")
b.WriteString("  [ -n \"$DISPLAY_NUM\" ] && xpra stop :${DISPLAY_NUM} 2>/dev/null || true\n")
b.WriteString("  [ -n \"$DISPLAY_NUM\" ] && rm -f /tmp/.X${DISPLAY_NUM}-lock /tmp/.X11-unix/X${DISPLAY_NUM} 2>/dev/null || true\n")
b.WriteString("  echo 'status=stopped' >> \"$JOB_DIR/status\" 2>/dev/null || true\n")
b.WriteString("}\n")
b.WriteString("trap cleanup EXIT INT TERM\n\n")

// clean up zombie X locks (lock file exists but process is dead)
b.WriteString("for lf in /tmp/.X[0-9]*-lock; do\n")
b.WriteString("  [ -f \"$lf\" ] || continue\n")
b.WriteString("  pid=$(cat \"$lf\" 2>/dev/null | tr -d ' \\n')\n")
b.WriteString("  [ -z \"$pid\" ] && { rm -f \"$lf\"; continue; }\n")
b.WriteString("  kill -0 \"$pid\" 2>/dev/null || {\n")
b.WriteString("    dnum=$(basename \"$lf\" | grep -oE '[0-9]+')\n")
b.WriteString("    rm -f \"$lf\" /tmp/.X11-unix/X${dnum} 2>/dev/null\n")
b.WriteString("  }\n")
b.WriteString("done\n\n")

// find free display
b.WriteString("for d in $(seq 10 250); do\n")
b.WriteString("  [ -f /tmp/.X${d}-lock ] && continue\n")
b.WriteString("  [ -S /tmp/.X11-unix/X${d} ] && continue\n")
b.WriteString("  DISPLAY_NUM=$d; break\n")
b.WriteString("done\n")
b.WriteString("[ -z \"$DISPLAY_NUM\" ] && { echo 'status=failed' > \"$JOB_DIR/status\"; exit 1; }\n\n")

// find free WebSocket port
b.WriteString("WS_PORT=\n")
b.WriteString("for port in $(seq 14500 14999); do\n")
b.WriteString("  ss -tlnp 2>/dev/null | grep -q \":${port}[^0-9]\" && continue\n")
b.WriteString("  WS_PORT=$port; break\n")
b.WriteString("done\n")
b.WriteString("[ -z \"$WS_PORT\" ] && WS_PORT=14500\n\n")

// write status file + symlink for backend polling
b.WriteString("echo 'status=starting' > \"$JOB_DIR/status\"\n")
b.WriteString("echo \"node=$(hostname)\" >> \"$JOB_DIR/status\"\n")
b.WriteString("echo \"ws_port=$WS_PORT\" >> \"$JOB_DIR/status\"\n")
b.WriteString("echo \"display=$DISPLAY_NUM\" >> \"$JOB_DIR/status\"\n")
b.WriteString(fmt.Sprintf("ln -sf \"$JOB_DIR/status\" %s\n\n", statusFile))

// XDG / dbus
b.WriteString("export XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-/tmp/xpra-runtime-$(id -u)}\n")
b.WriteString("mkdir -p \"$XDG_RUNTIME_DIR\" && chmod 700 \"$XDG_RUNTIME_DIR\"\n")
b.WriteString("if [ -z \"$DBUS_SESSION_BUS_ADDRESS\" ]; then\n")
b.WriteString("  eval $(dbus-launch --sh-syntax) || true\nfi\n\n")

xpraCommon := fmt.Sprintf(
"  --bind-ws=0.0.0.0:${WS_PORT} \\\n"+
"  --html=on \\\n"+
"  --socket-dir=\"$JOB_DIR\" \\\n"+
"  --log-file=\"$JOB_DIR/xpra.log\" \\\n"+
"  --daemon=no \\\n"+
"  --resize-display=%s \\\n", resolution)

if mode == "app" {
b.WriteString(fmt.Sprintf("xpra start :${DISPLAY_NUM} \\\n%s  --start-child=\"%s\" \\\n  --exit-with-children=yes \\\n  &\n\n", xpraCommon, appCmd))
} else {
startCmd := "startxfce4"
switch desktopEnv {
case "gnome":
startCmd = "gnome-session"
case "kde":
startCmd = "startplasma-x11"
}
b.WriteString(fmt.Sprintf("xpra start-desktop :${DISPLAY_NUM} \\\n%s  --start-child=%s \\\n  --exit-with-children=no \\\n  &\n\n", xpraCommon, startCmd))
}

b.WriteString("XPRA_PID=$!\n\n")

// wait for port ready (max 90s)
b.WriteString("for i in $(seq 1 90); do\n")
b.WriteString("  ss -tlnp 2>/dev/null | grep -q \":${WS_PORT}[^0-9]\" && break\n")
b.WriteString("  sleep 1\ndone\n\n")
b.WriteString("if ! ss -tlnp 2>/dev/null | grep -q \":${WS_PORT}[^0-9]\"; then\n")
b.WriteString("  echo 'status=failed' >> \"$JOB_DIR/status\"\n  exit 1\nfi\n\n")
b.WriteString("echo 'status=running' >> \"$JOB_DIR/status\"\n\n")

// keep running
b.WriteString(fmt.Sprintf("END_TIME=$(($(date +%%s) + %d))\n", durationSec))
b.WriteString("while [ $(date +%s) -lt $END_TIME ]; do\n")
b.WriteString("  kill -0 $XPRA_PID 2>/dev/null || break\n  sleep 30\ndone\n\n")
b.WriteString("# trap EXIT will handle cleanup\n")

return b.String()
}
// pollDesktopJob 轮询 Slurm 作业状�?
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
					sessions[i].XpraPort = 0
					sessions[i].VNCPort = 0
				}
				_ = saveDesktopSessions(sessions)
				break
			}
		}
	}

	// 阶段1：等�?RUNNING，最多等 5 分钟
	running := false
	for i := 0; i < 60; i++ {
		time.Sleep(5 * time.Second)

		job, err := client.GetJob(jobID)
		if err != nil {
			continue
		}

		state := strings.ToUpper(strings.TrimSpace(job.GetJobState()))
		if state == "FAILED" || state == "CANCELLED" || state == "TIMEOUT" || state == "COMPLETED" {
			// 检查状态文件，判断�?failed 还是 stopped
			data, _ := os.ReadFile(statusFile)
			if strings.Contains(string(data), "status=failed") {
				setStatus("failed")
			} else {
				setStatus("failed") // 还没�?running 就结束了，算失败
			}
			return
		}

		if strings.HasPrefix(state, "RUNNING") {
			node := job.Nodes
			rdpPort := 5901
			vncReady := false

			// 等待状态文件里出现 status=running（最多等2分钟�?
			for w := 0; w < 24; w++ {
				time.Sleep(5 * time.Second)
				data, err := os.ReadFile(statusFile)
				if err != nil {
					continue
				}
				content := string(data)
				// 检查是否失�?
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
						case "ws_port":
							if p, err := strconv.Atoi(strings.TrimSpace(parts[1])); err == nil {
								rdpPort = p
							}
						case "node":
							if v := strings.TrimSpace(parts[1]); v != "" {
								node = v
							}
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
					sessions[i].XpraPort = rdpPort
					sessions[i].VNCPort = rdpPort // 兼容旧字�?
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
	// 连续查询失败超过 3 次才认为作业结束，避免网络抖动误�?
	failCount := 0
	for {
		time.Sleep(10 * time.Second)

		job, err := client.GetJob(jobID)
		if err != nil {
			failCount++
			if failCount >= 3 {
				// 查不到作业，尝试从状态文件判�?
				data, ferr := os.ReadFile(statusFile)
				if ferr == nil && strings.Contains(string(data), "status=stopped") {
					setStatus("stopped")
				} else {
					setStatus("stopped") // 默认标记 stopped，不�?failed
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
				// job 脚本自己写了 stopped，取�?job
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