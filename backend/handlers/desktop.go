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
	ID         int    `json:"id"`
	Name       string `json:"name"`
	Type       string `json:"type"`
	Protocol   string `json:"protocol"`
	Address    string `json:"address"`
	Username   string `json:"username"`
	CreateTime string `json:"createTime"`
	Status     string `json:"status"`
	Image      string `json:"image,omitempty"`
	SlurmJobID int64  `json:"slurmJobId,omitempty"`
	VNCPort    int    `json:"vncPort,omitempty"`
	RDPPort    int    `json:"rdpPort,omitempty"`
	Password   string `json:"password,omitempty"`
	WebURL     string `json:"webUrl,omitempty"`
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

func updateDesktopSession(updated DesktopSession) error {
	sessions, err := loadDesktopSessions()
	if err != nil {
		return err
	}
	for i, s := range sessions {
		if s.ID == updated.ID {
			sessions[i] = updated
			return saveDesktopSessions(sessions)
		}
	}
	return fmt.Errorf("session not found")
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
		Name     string `json:"name" binding:"required"`
		Type     string `json:"type" binding:"required"`
		Protocol string `json:"protocol" binding:"required"`
		Address  string `json:"address"`
		Image    string `json:"image"`
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
	session := DesktopSession{
		ID:         maxID + 1,
		Name:       req.Name,
		Type:       req.Type,
		Protocol:   req.Protocol,
		Address:    req.Address,
		Image:      req.Image,
		Username:   username.(string),
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

// POST /api/desktop/sessions/:id/start  — submit Slurm job to launch desktop container
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

	// Build the sbatch script
	script := buildDesktopScript(session)

	// Submit via Slurm
	client, err := GetSlurmClientForUser(username.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "slurm client error: " + err.Error()})
		return
	}

	partition := os.Getenv("DESKTOP_PARTITION")
	if partition == "" {
		partition = "compute"
	}

	jobID, err := client.SubmitJob(slurm.JobSubmitParams{
		Name:      "desktop-" + session.Name,
		Partition: partition,
		Script:    script,
		Nodes:     1,
		CPUs:      2,
		Memory:    4, // 4GB
		TimeLimit: 8, // 8 hours
		WorkDir:   fmt.Sprintf("/home/%s", username.(string)),
		Output:    fmt.Sprintf("/home/%s/.desktop/%d.out", username.(string), session.ID),
		Error:     fmt.Sprintf("/home/%s/.desktop/%d.err", username.(string), session.ID),
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

	// Start background polling
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
			sessions[i].Password = ""
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

// buildDesktopScript generates the sbatch script to launch a desktop container
func buildDesktopScript(session *DesktopSession) string {
	// VNC display number based on session ID to avoid conflicts
	display := 10 + session.ID
	vncPort := 5900 + display

	// Container image: session-specific > env default > fallback path
	image := session.Image
	if image == "" {
		image = os.Getenv("DESKTOP_IMAGE")
	}
	if image == "" {
		image = "/opt/containers/desktop.sif"
	}

	statusDir := fmt.Sprintf("/home/%s/.desktop", session.Username)
	statusFile := fmt.Sprintf("%s/%d.status", statusDir, session.ID)

	var scriptLines []string
	scriptLines = append(scriptLines, "#!/bin/bash")
	scriptLines = append(scriptLines, fmt.Sprintf("mkdir -p %s", statusDir))

	// Write initial status
	scriptLines = append(scriptLines, fmt.Sprintf(`echo "status=starting" > %s`, statusFile))
	scriptLines = append(scriptLines, fmt.Sprintf(`echo "node=$(hostname)" >> %s`, statusFile))
	scriptLines = append(scriptLines, fmt.Sprintf(`echo "vnc_port=%d" >> %s`, vncPort, statusFile))

	// Check if Singularity/Apptainer is available
	scriptLines = append(scriptLines, ``)
	scriptLines = append(scriptLines, `# Detect container runtime`)
	scriptLines = append(scriptLines, `if command -v apptainer &>/dev/null; then CONTAINER_CMD=apptainer`)
	scriptLines = append(scriptLines, `elif command -v singularity &>/dev/null; then CONTAINER_CMD=singularity`)
	scriptLines = append(scriptLines, `else CONTAINER_CMD=""; fi`)
	scriptLines = append(scriptLines, ``)

	// Generate VNC password
	scriptLines = append(scriptLines, `VNC_PASS=$(openssl rand -base64 8 | tr -d '/+=' | head -c 8)`)
	scriptLines = append(scriptLines, fmt.Sprintf(`echo "password=$VNC_PASS" >> %s`, statusFile))

	// Start VNC server
	scriptLines = append(scriptLines, ``)
	scriptLines = append(scriptLines, fmt.Sprintf(`if [ -n "$CONTAINER_CMD" ] && [ -f "%s" ]; then`, image))
	scriptLines = append(scriptLines, fmt.Sprintf(`  # Launch via container`))
	scriptLines = append(scriptLines, fmt.Sprintf(`  $CONTAINER_CMD exec --bind /home %s \`, image))
	scriptLines = append(scriptLines, fmt.Sprintf(`    vncserver :%d -geometry 1920x1080 -depth 24 -SecurityTypes VncAuth -PasswordFile /tmp/vnc%d.pass`, display, display))
	scriptLines = append(scriptLines, `else`)
	scriptLines = append(scriptLines, `  # Fallback: use system VNC if available`)
	scriptLines = append(scriptLines, fmt.Sprintf(`  if command -v vncserver &>/dev/null; then`))
	scriptLines = append(scriptLines, fmt.Sprintf(`    mkdir -p ~/.vnc`))
	scriptLines = append(scriptLines, fmt.Sprintf(`    echo "$VNC_PASS" | vncpasswd -f > ~/.vnc/passwd`))
	scriptLines = append(scriptLines, fmt.Sprintf(`    chmod 600 ~/.vnc/passwd`))
	scriptLines = append(scriptLines, fmt.Sprintf(`    vncserver :%d -geometry 1920x1080 -depth 24`, display))
	scriptLines = append(scriptLines, `  fi`)
	scriptLines = append(scriptLines, `fi`)
	scriptLines = append(scriptLines, ``)
	scriptLines = append(scriptLines, fmt.Sprintf(`echo "status=running" >> %s`, statusFile))
	scriptLines = append(scriptLines, ``)
	scriptLines = append(scriptLines, `# Keep job alive`)
	scriptLines = append(scriptLines, `echo "Desktop started, waiting..."`)
	scriptLines = append(scriptLines, `wait`)

	return strings.Join(scriptLines, "\n")
}

// pollDesktopJob polls Slurm job status and updates session when running
func pollDesktopJob(sessionID int, jobID int64, username string) {
	client, err := GetSlurmClientForUser(username)
	if err != nil {
		return
	}

	statusFile := fmt.Sprintf("/home/%s/.desktop/%d.status", username, sessionID)

	for i := 0; i < 60; i++ { // poll up to 5 minutes
		time.Sleep(5 * time.Second)

		job, err := client.GetJob(jobID)
		if err != nil {
			continue
		}

		state := job.GetJobState()
		if state == "FAILED" || state == "CANCELLED" || state == "TIMEOUT" {
			sessions, _ := loadDesktopSessions()
			for i := range sessions {
				if sessions[i].ID == sessionID {
					sessions[i].Status = "failed"
					_ = saveDesktopSessions(sessions)
					break
				}
			}
			return
		}

		if state == "RUNNING" {
			// Try to read status file written by the job script
			node := job.BatchHost
			if node == "" {
				node = job.Nodes
			}

			vncPort := 5910 + sessionID
			password := ""

			// Try to read the status file
			data, err := os.ReadFile(statusFile)
			if err == nil {
				for _, line := range strings.Split(string(data), "\n") {
					parts := strings.SplitN(line, "=", 2)
					if len(parts) != 2 {
						continue
					}
					switch parts[0] {
					case "vnc_port":
						if p, err := strconv.Atoi(strings.TrimSpace(parts[1])); err == nil {
							vncPort = p
						}
					case "password":
						password = strings.TrimSpace(parts[1])
					case "node":
						if parts[1] != "" {
							node = strings.TrimSpace(parts[1])
						}
					}
				}
			}

			sessions, _ := loadDesktopSessions()
			for i := range sessions {
				if sessions[i].ID == sessionID {
					sessions[i].Status = "running"
					sessions[i].Address = node
					sessions[i].VNCPort = vncPort
					sessions[i].Password = password
					_ = saveDesktopSessions(sessions)
					break
				}
			}
			return
		}
	}
}
