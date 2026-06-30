package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"hpc-backend/logger"
	"hpc-backend/slurm"
)

// AITaskType 任务类型
type AITaskType string

const (
	AITaskTrain   AITaskType = "train"
	AITaskInfer   AITaskType = "infer"
)

// AITaskStatus 任务状态
type AITaskStatus string

const (
	AITaskPending   AITaskStatus = "PENDING"
	AITaskRunning   AITaskStatus = "RUNNING"
	AITaskCompleted AITaskStatus = "COMPLETED"
	AITaskFailed    AITaskStatus = "FAILED"
	AITaskRestart   AITaskStatus = "RESTARTING"
)

// AITask AI任务定义
type AITask struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	Type        AITaskType   `json:"type"`        // train / infer
	Owner       string       `json:"owner"`
	JobID       int64        `json:"job_id"`       // 当前 Slurm 作业 ID
	Status      AITaskStatus `json:"status"`
	Partition   string       `json:"partition"`
	Nodes       int          `json:"nodes"`
	CPUs        int          `json:"cpus"`
	GPUs        int          `json:"gpus"`
	Memory      int          `json:"memory"`
	TimeLimit   int          `json:"time_limit"`   // 小时，0=不限
	Image       string       `json:"image"`        // 容器镜像（可选）
	WorkDir     string       `json:"work_dir"`
	Script      string       `json:"script"`
	// 推理服务专用
	ServicePort int          `json:"service_port"` // 推理服务端口
	// 自动重启配置
	AutoRestart    bool   `json:"auto_restart"`
	MaxRetries     int    `json:"max_retries"`
	RetryCount     int    `json:"retry_count"`
	RestartOnNodes bool   `json:"restart_on_nodes"` // 节点故障时重启
	// 元数据
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
	StartedAt  *time.Time `json:"started_at,omitempty"`
	FinishedAt *time.Time `json:"finished_at,omitempty"`
	LastError  string    `json:"last_error,omitempty"`
}

// aiTaskStore 内存存储（生产可换 DB）
var (
	aiTaskStore   = map[string]*AITask{}
	aiTaskMu      sync.RWMutex
	aiTaskWatcher *AITaskWatcher
)

// AITaskWatcher 后台监控器，定时检查任务状态并自动重启
type AITaskWatcher struct {
	stop chan struct{}
}

func init() {
	aiTaskWatcher = &AITaskWatcher{stop: make(chan struct{})}
	go aiTaskWatcher.run()
}

func (w *AITaskWatcher) run() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			w.checkAll()
		case <-w.stop:
			return
		}
	}
}

func (w *AITaskWatcher) checkAll() {
	aiTaskMu.Lock()
	tasks := make([]*AITask, 0, len(aiTaskStore))
	for _, t := range aiTaskStore {
		tasks = append(tasks, t)
	}
	aiTaskMu.Unlock()

	for _, task := range tasks {
		if task.Status != AITaskRunning && task.Status != AITaskPending {
			continue
		}
		if task.JobID == 0 {
			continue
		}
		w.checkTask(task)
	}
}

func (w *AITaskWatcher) checkTask(task *AITask) {
	client, err := GetSlurmClientForUser(task.Owner)
	if err != nil {
		return
	}
	job, err := client.GetJob(task.JobID)
	if err != nil {
		return
	}

	state := job.GetJobState()
	aiTaskMu.Lock()
	defer aiTaskMu.Unlock()

	t, ok := aiTaskStore[task.ID]
	if !ok {
		return
	}

	switch state {
	case "RUNNING":
		t.Status = AITaskRunning
		now := time.Now()
		t.StartedAt = &now
	case "COMPLETED":
		t.Status = AITaskCompleted
		now := time.Now()
		t.FinishedAt = &now
	case "FAILED", "NODE_FAIL", "TIMEOUT", "PREEMPTED":
		t.LastError = fmt.Sprintf("作业 %d 状态: %s", task.JobID, state)
		// 自动重启判断
		if t.AutoRestart && (state == "NODE_FAIL" || t.RestartOnNodes || state == "FAILED") {
			if t.RetryCount < t.MaxRetries {
				t.Status = AITaskRestart
				t.RetryCount++
				logger.Info("AITask %s: auto-restarting (attempt %d/%d), reason: %s",
					t.ID, t.RetryCount, t.MaxRetries, state)
				go w.resubmit(t)
			} else {
				t.Status = AITaskFailed
				logger.Info("AITask %s: max retries reached (%d), giving up", t.ID, t.MaxRetries)
			}
		} else {
			t.Status = AITaskFailed
		}
	case "CANCELLED":
		t.Status = AITaskFailed
		t.LastError = "作业已取消"
	}
	t.UpdatedAt = time.Now()
}

func (w *AITaskWatcher) resubmit(task *AITask) {
	time.Sleep(10 * time.Second) // 等待节点恢复
	jobID, err := submitAITaskJob(task)
	aiTaskMu.Lock()
	defer aiTaskMu.Unlock()
	t, ok := aiTaskStore[task.ID]
	if !ok {
		return
	}
	if err != nil {
		t.Status = AITaskFailed
		t.LastError = "重启失败: " + err.Error()
		logger.Error("AITask %s resubmit failed: %v", task.ID, err)
		return
	}
	t.JobID = jobID
	t.Status = AITaskPending
	t.UpdatedAt = time.Now()
	logger.Info("AITask %s resubmitted as job %d", task.ID, jobID)
}

// submitAITaskJob 向 Slurm 提交 AI 任务作业
func submitAITaskJob(task *AITask) (int64, error) {
	if os.Getenv("DEV_MODE") == "true" {
		return time.Now().Unix() % 100000, nil
	}
	client, err := GetSlurmClientForUser(task.Owner)
	if err != nil {
		return 0, err
	}

	script := task.Script
	// 如果指定了容器镜像，在脚本 #!/bin/bash 后插入 --container-image
	if task.Image != "" {
		containerLine := fmt.Sprintf("#SBATCH --container-image=%s\n", task.Image)
		if len(script) >= 11 && script[:11] == "#!/bin/bash" {
			nlIdx := 11
			for nlIdx < len(script) && script[nlIdx] != '\n' {
				nlIdx++
			}
			if nlIdx < len(script) {
				script = script[:nlIdx+1] + containerLine + script[nlIdx+1:]
			}
		}
	}

	params := slurm.JobSubmitParams{
		Name:      task.Name,
		Partition: task.Partition,
		Script:    script,
		Nodes:     task.Nodes,
		CPUs:      task.CPUs,
		Memory:    task.Memory,
		GPUs:      task.GPUs,
		TimeLimit: task.TimeLimit,
		WorkDir:   task.WorkDir,
		Username:  task.Owner,
	}
	return client.SubmitJob(params)
}

// slurmJobParams 占位，已由 submitAITaskJob 直接使用 slurm.JobSubmitParams
func slurmJobParams(task *AITask, script string) interface{} { return nil }

// ── HTTP Handlers ──────────────────────────────────────────────

// ListAITasks 列出当前用户的 AI 任务
func ListAITasks(c *gin.Context) {
	username, _ := c.Get("username")
	isAdminVal, _ := c.Get("isAdmin")
	isAdmin, _ := isAdminVal.(bool)

	aiTaskMu.RLock()
	defer aiTaskMu.RUnlock()

	var tasks []*AITask
	for _, t := range aiTaskStore {
		if isAdmin || t.Owner == username.(string) {
			tasks = append(tasks, t)
		}
	}
	if tasks == nil {
		tasks = []*AITask{}
	}
	c.JSON(http.StatusOK, gin.H{"data": tasks})
}

// CreateAITask 创建并提交 AI 任务
func CreateAITask(c *gin.Context) {
	username, _ := c.Get("username")

	var req struct {
		Name           string     `json:"name" binding:"required"`
		Type           AITaskType `json:"type" binding:"required"`
		Partition      string     `json:"partition" binding:"required"`
		Nodes          int        `json:"nodes"`
		CPUs           int        `json:"cpus"`
		GPUs           int        `json:"gpus"`
		Memory         int        `json:"memory"`
		TimeLimit      int        `json:"time_limit"`
		Image          string     `json:"image"`
		WorkDir        string     `json:"work_dir"`
		Script         string     `json:"script" binding:"required"`
		ServicePort    int        `json:"service_port"`
		AutoRestart    bool       `json:"auto_restart"`
		MaxRetries     int        `json:"max_retries"`
		RestartOnNodes bool       `json:"restart_on_nodes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Nodes == 0 {
		req.Nodes = 1
	}
	if req.CPUs == 0 {
		req.CPUs = 8
	}
	if req.MaxRetries == 0 {
		req.MaxRetries = 3
	}

	task := &AITask{
		ID:             fmt.Sprintf("aitask-%d", time.Now().UnixNano()),
		Name:           req.Name,
		Type:           req.Type,
		Owner:          username.(string),
		Status:         AITaskPending,
		Partition:      req.Partition,
		Nodes:          req.Nodes,
		CPUs:           req.CPUs,
		GPUs:           req.GPUs,
		Memory:         req.Memory,
		TimeLimit:      req.TimeLimit,
		Image:          req.Image,
		WorkDir:        req.WorkDir,
		Script:         req.Script,
		ServicePort:    req.ServicePort,
		AutoRestart:    req.AutoRestart,
		MaxRetries:     req.MaxRetries,
		RestartOnNodes: req.RestartOnNodes,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	jobID, err := submitAITaskJob(task)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "提交作业失败: " + err.Error()})
		return
	}
	task.JobID = jobID

	aiTaskMu.Lock()
	aiTaskStore[task.ID] = task
	aiTaskMu.Unlock()

	logger.Info("AITask created: id=%s name=%s type=%s job=%d user=%s",
		task.ID, task.Name, task.Type, jobID, username)
	c.JSON(http.StatusCreated, gin.H{"data": task})
}

// GetAITask 获取单个任务详情
func GetAITask(c *gin.Context) {
	id := c.Param("id")
	username, _ := c.Get("username")
	isAdminVal, _ := c.Get("isAdmin")
	isAdmin, _ := isAdminVal.(bool)

	aiTaskMu.RLock()
	task, ok := aiTaskStore[id]
	aiTaskMu.RUnlock()

	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "任务不存在"})
		return
	}
	if !isAdmin && task.Owner != username.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权访问"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": task})
}

// StopAITask 停止任务（取消 Slurm 作业）
func StopAITask(c *gin.Context) {
	id := c.Param("id")
	username, _ := c.Get("username")
	isAdminVal, _ := c.Get("isAdmin")
	isAdmin, _ := isAdminVal.(bool)

	aiTaskMu.Lock()
	task, ok := aiTaskStore[id]
	if !ok {
		aiTaskMu.Unlock()
		c.JSON(http.StatusNotFound, gin.H{"error": "任务不存在"})
		return
	}
	if !isAdmin && task.Owner != username.(string) {
		aiTaskMu.Unlock()
		c.JSON(http.StatusForbidden, gin.H{"error": "无权操作"})
		return
	}
	// 关闭自动重启，防止停止后又重启
	task.AutoRestart = false
	jobID := task.JobID
	task.Status = AITaskFailed
	task.UpdatedAt = time.Now()
	aiTaskMu.Unlock()

	if jobID > 0 && os.Getenv("DEV_MODE") != "true" {
		client, err := GetSlurmClientForUser(username.(string))
		if err == nil {
			client.CancelJob(jobID)
		}
	}
	logger.Info("AITask stopped: id=%s job=%d by %s", id, jobID, username)
	c.JSON(http.StatusOK, gin.H{"message": "任务已停止"})
}

// DeleteAITask 删除任务记录
func DeleteAITask(c *gin.Context) {
	id := c.Param("id")
	username, _ := c.Get("username")
	isAdminVal, _ := c.Get("isAdmin")
	isAdmin, _ := isAdminVal.(bool)

	aiTaskMu.Lock()
	defer aiTaskMu.Unlock()

	task, ok := aiTaskStore[id]
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "任务不存在"})
		return
	}
	if !isAdmin && task.Owner != username.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权操作"})
		return
	}
	delete(aiTaskStore, id)
	c.JSON(http.StatusOK, gin.H{"message": "删除成功"})
}

// RestartAITask 手动重启任务
func RestartAITask(c *gin.Context) {
	id := c.Param("id")
	username, _ := c.Get("username")
	isAdminVal, _ := c.Get("isAdmin")
	isAdmin, _ := isAdminVal.(bool)

	aiTaskMu.Lock()
	task, ok := aiTaskStore[id]
	if !ok {
		aiTaskMu.Unlock()
		c.JSON(http.StatusNotFound, gin.H{"error": "任务不存在"})
		return
	}
	if !isAdmin && task.Owner != username.(string) {
		aiTaskMu.Unlock()
		c.JSON(http.StatusForbidden, gin.H{"error": "无权操作"})
		return
	}
	task.Status = AITaskRestart
	task.RetryCount = 0
	aiTaskMu.Unlock()

	go aiTaskWatcher.resubmit(task)
	c.JSON(http.StatusOK, gin.H{"message": "重启任务已提交"})
}

// GetAITaskStats 获取任务统计
func GetAITaskStats(c *gin.Context) {
	username, _ := c.Get("username")
	isAdminVal, _ := c.Get("isAdmin")
	isAdmin, _ := isAdminVal.(bool)

	aiTaskMu.RLock()
	defer aiTaskMu.RUnlock()

	stats := map[string]int{
		"total": 0, "running": 0, "pending": 0,
		"completed": 0, "failed": 0, "train": 0, "infer": 0,
	}
	for _, t := range aiTaskStore {
		if !isAdmin && t.Owner != username.(string) {
			continue
		}
		stats["total"]++
		switch t.Status {
		case AITaskRunning:
			stats["running"]++
		case AITaskPending, AITaskRestart:
			stats["pending"]++
		case AITaskCompleted:
			stats["completed"]++
		case AITaskFailed:
			stats["failed"]++
		}
		if t.Type == AITaskTrain {
			stats["train"]++
		} else {
			stats["infer"]++
		}
	}
	c.JSON(http.StatusOK, gin.H{"data": stats})
}

// ── 端口发布 & API Key ──────────────────────────────────────────

// InferenceEndpoint 推理服务访问端点
type InferenceEndpoint struct {
	TaskID    string    `json:"task_id"`
	Port      int       `json:"port"`
	APIKey    string    `json:"api_key"`
	CreatedAt time.Time `json:"created_at"`
	CreatedBy string    `json:"created_by"`
	Note      string    `json:"note"`
}

var (
	inferEndpoints   = map[string]*InferenceEndpoint{} // key = task_id
	inferEndpointsMu sync.RWMutex
)

// PublishInferencePort 为推理任务发布端口并生成 API Key
func PublishInferencePort(c *gin.Context) {
	id := c.Param("id")
	username, _ := c.Get("username")
	isAdminVal, _ := c.Get("isAdmin")
	isAdmin, _ := isAdminVal.(bool)

	aiTaskMu.RLock()
	task, ok := aiTaskStore[id]
	aiTaskMu.RUnlock()

	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "任务不存在"})
		return
	}
	if !isAdmin && task.Owner != username.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权操作"})
		return
	}
	if task.Type != AITaskInfer {
		c.JSON(http.StatusBadRequest, gin.H{"error": "仅推理任务支持端口发布"})
		return
	}
	if task.ServicePort == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "任务未配置服务端口"})
		return
	}

	var req struct {
		Note string `json:"note"`
	}
	_ = c.ShouldBindJSON(&req)

	// 生成随机 API Key
	apiKey := generateAPIKey()

	ep := &InferenceEndpoint{
		TaskID:    id,
		Port:      task.ServicePort,
		APIKey:    apiKey,
		CreatedAt: time.Now(),
		CreatedBy: username.(string),
		Note:      req.Note,
	}

	inferEndpointsMu.Lock()
	inferEndpoints[id] = ep
	inferEndpointsMu.Unlock()

	logger.Info("InferenceEndpoint published: task=%s port=%d by %s", id, task.ServicePort, username)
	c.JSON(http.StatusOK, gin.H{"data": ep})
}

// GetInferenceEndpoint 获取推理端点信息
func GetInferenceEndpoint(c *gin.Context) {
	id := c.Param("id")
	username, _ := c.Get("username")
	isAdminVal, _ := c.Get("isAdmin")
	isAdmin, _ := isAdminVal.(bool)

	aiTaskMu.RLock()
	task, ok := aiTaskStore[id]
	aiTaskMu.RUnlock()
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "任务不存在"})
		return
	}
	if !isAdmin && task.Owner != username.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权访问"})
		return
	}

	inferEndpointsMu.RLock()
	ep, exists := inferEndpoints[id]
	inferEndpointsMu.RUnlock()

	if !exists {
		c.JSON(http.StatusOK, gin.H{"data": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": ep})
}

// RevokeInferenceEndpoint 撤销端点（删除 API Key）
func RevokeInferenceEndpoint(c *gin.Context) {
	id := c.Param("id")
	username, _ := c.Get("username")
	isAdminVal, _ := c.Get("isAdmin")
	isAdmin, _ := isAdminVal.(bool)

	aiTaskMu.RLock()
	task, ok := aiTaskStore[id]
	aiTaskMu.RUnlock()
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "任务不存在"})
		return
	}
	if !isAdmin && task.Owner != username.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权操作"})
		return
	}

	inferEndpointsMu.Lock()
	delete(inferEndpoints, id)
	inferEndpointsMu.Unlock()

	c.JSON(http.StatusOK, gin.H{"message": "端点已撤销"})
}

// generateAPIKey 生成随机 API Key
func generateAPIKey() string {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		// fallback
		return fmt.Sprintf("sk-%d", time.Now().UnixNano())
	}
	return "sk-" + hex.EncodeToString(b)
}

// persistAITasks 持久化到文件（简单 JSON 文件）
func persistAITasks() {
	aiTaskMu.RLock()
	data, _ := json.Marshal(aiTaskStore)
	aiTaskMu.RUnlock()
	_ = os.WriteFile("ai_tasks.json", data, 0644)
}

// loadAITasks 从文件加载
func LoadAITasks() {
	data, err := os.ReadFile("ai_tasks.json")
	if err != nil {
		return
	}
	aiTaskMu.Lock()
	defer aiTaskMu.Unlock()
	_ = json.Unmarshal(data, &aiTaskStore)
	logger.Info("Loaded %d AI tasks from disk", len(aiTaskStore))
}

// GetAITaskLogs 获取任务日志（读取 Slurm 输出文件）
func GetAITaskLogs(c *gin.Context) {
	id := c.Param("id")
	username, _ := c.Get("username")
	isAdminVal, _ := c.Get("isAdmin")
	isAdmin, _ := isAdminVal.(bool)

	aiTaskMu.RLock()
	task, ok := aiTaskStore[id]
	aiTaskMu.RUnlock()

	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "任务不存在"})
		return
	}
	if !isAdmin && task.Owner != username.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权访问"})
		return
	}

	// 读取 Slurm 输出文件
	logPath := fmt.Sprintf("%s/slurm-%d.out", task.WorkDir, task.JobID)
	content, err := os.ReadFile(logPath)
	if err != nil {
		// 尝试当前目录
		logPath = fmt.Sprintf("slurm-%d.out", task.JobID)
		content, err = os.ReadFile(logPath)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"log": "", "message": "日志文件暂不可用"})
			return
		}
	}

	// 只返回最后 200 行
	lines := splitLines(string(content))
	if len(lines) > 200 {
		lines = lines[len(lines)-200:]
	}
	c.JSON(http.StatusOK, gin.H{"log": joinLines(lines), "path": logPath})
}

func splitLines(s string) []string {
	var lines []string
	start := 0
	for i, c := range s {
		if c == '\n' {
			lines = append(lines, s[start:i])
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}

func joinLines(lines []string) string {
	result := ""
	for _, l := range lines {
		result += l + "\n"
	}
	return result
}
