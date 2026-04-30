package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	gossh "golang.org/x/crypto/ssh"
	"hpc-backend/logger"
)

// SaveImageTask 保存镜像任务状态
type SaveImageTask struct {
	TaskID      string `json:"task_id"`
	Status      string `json:"status"`   // pending / running / done / error
	Step        int    `json:"step"`     // 1-4
	TotalSteps  int    `json:"total_steps"`
	StepDesc    string `json:"step_desc"`
	TargetImage string `json:"target_image"`
	Error       string `json:"error,omitempty"`
	UpdatedAt   int64  `json:"updated_at"`
}

var (
	saveImageTasks   = map[string]*SaveImageTask{}
	saveImageTasksMu sync.RWMutex
)

func setSaveTask(t *SaveImageTask) {
	t.UpdatedAt = time.Now().Unix()
	saveImageTasksMu.Lock()
	saveImageTasks[t.TaskID] = t
	saveImageTasksMu.Unlock()
}

func getSaveTask(taskID string) (*SaveImageTask, bool) {
	saveImageTasksMu.RLock()
	defer saveImageTasksMu.RUnlock()
	t, ok := saveImageTasks[taskID]
	return t, ok
}

// GetSaveImageTask 查询保存镜像任务进度
func GetSaveImageTask(c *gin.Context) {
	taskID := c.Param("task_id")
	t, ok := getSaveTask(taskID)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "任务不存在"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": t})
}

// harborAdmin 用管理员凭证向 Harbor API 发起请求
// 权限控制由我们的后端逻辑负责，不依赖 Harbor 自身的用户权限
func harborAdmin(method, path string, body io.Reader) (*http.Response, error) {
	harborURL := strings.TrimSpace(strings.TrimRight(os.Getenv("HARBOR_URL"), "/"))
	if harborURL == "" {
		return nil, fmt.Errorf("HARBOR_URL 未配置")
	}
	req, err := http.NewRequest(method, harborURL+path, body)
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(os.Getenv("HARBOR_ADMIN_USER"), os.Getenv("HARBOR_ADMIN_PASS"))
	req.Header.Set("Content-Type", "application/json")
	return (&http.Client{Timeout: 15 * time.Second}).Do(req)
}

// isPublicProject 判断是否为公共项目（按名称配置）
func isPublicProject(name string) bool {
	raw := os.Getenv("HARBOR_PUBLIC_PROJECTS")
	var list []string
	if raw == "" {
		list = []string{"library", "base", "public"}
	} else {
		list = strings.Split(raw, ",")
	}
	for _, p := range list {
		if strings.TrimSpace(p) == name {
			return true
		}
	}
	return false
}

// checkProjectPublic 查询 Harbor 确认项目是否公开（public 或在配置名单里）
func checkProjectPublic(projectName string) bool {
	if isPublicProject(projectName) {
		return true
	}
	resp, err := harborAdmin("GET", fmt.Sprintf("/api/v2.0/projects/%s", projectName), nil)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	var p map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&p); err != nil {
		return false
	}
	if meta, ok := p["metadata"].(map[string]interface{}); ok {
		return meta["public"] == "true"
	}
	return false
}

// ensureUserProject 确保用户在 Harbor 中有自己的私有项目，并拥有管理员角色
func ensureUserProject(username string) error {
	// 检查项目是否存在
	resp, err := harborAdmin("HEAD", fmt.Sprintf("/api/v2.0/projects?project_name=%s", username), nil)
	if err != nil {
		return err
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		// 创建私有项目，Harbor v2 只通过 metadata.public 控制可见性
		payload := map[string]interface{}{
			"project_name": username,
			"metadata":     map[string]string{"public": "false"},
		}
		body, _ := json.Marshal(payload)
		createResp, err := harborAdmin("POST", "/api/v2.0/projects", bytes.NewReader(body))
		if err != nil {
			return err
		}
		createResp.Body.Close()
		if createResp.StatusCode != http.StatusCreated && createResp.StatusCode != http.StatusConflict {
			return fmt.Errorf("创建项目失败，状态码: %d", createResp.StatusCode)
		}
		logger.Info("Harbor: created private project for user %s", username)
	}

	// 确保用户是项目的管理员成员（role_id=1: ProjectAdmin）
	// 先查用户是否已经是成员
	memberResp, err := harborAdmin("GET", fmt.Sprintf("/api/v2.0/projects/%s/members?entityname=%s", username, username), nil)
	if err != nil {
		return err
	}
	defer memberResp.Body.Close()

	var members []map[string]interface{}
	json.NewDecoder(memberResp.Body).Decode(&members)
	if len(members) > 0 {
		return nil // 已经是成员
	}

	// 添加用户为项目管理员
	memberPayload := map[string]interface{}{
		"role_id": 1, // 1=ProjectAdmin, 2=Developer, 3=Guest
		"member_user": map[string]string{
			"username": username,
		},
	}
	memberBody, _ := json.Marshal(memberPayload)
	addResp, err := harborAdmin("POST", fmt.Sprintf("/api/v2.0/projects/%s/members", username), bytes.NewReader(memberBody))
	if err != nil {
		return err
	}
	defer addResp.Body.Close()

	if addResp.StatusCode == http.StatusCreated || addResp.StatusCode == http.StatusConflict {
		logger.Info("Harbor: added %s as project admin of project %s", username, username)
	} else {
		logger.Error("Harbor: failed to add member %s to project %s, status: %d", username, username, addResp.StatusCode)
	}
	return nil
}

// GetRegistryConfig 返回前端需要的仓库配置，并确保用户私有项目存在
func GetRegistryConfig(c *gin.Context) {
	username, _ := c.Get("username")
	isAdminVal, _ := c.Get("isAdmin")
	isAdmin, _ := isAdminVal.(bool)

	harborURL := strings.TrimSpace(os.Getenv("HARBOR_URL"))

	publicProjects := []string{"library", "base", "public"}
	if raw := os.Getenv("HARBOR_PUBLIC_PROJECTS"); raw != "" {
		publicProjects = []string{}
		for _, p := range strings.Split(raw, ",") {
			if t := strings.TrimSpace(p); t != "" {
				publicProjects = append(publicProjects, t)
			}
		}
	}

	// 异步确保用户私有项目存在（不阻塞响应）
	go func() {
		if err := ensureUserProject(username.(string)); err != nil {
			logger.Error("ensureUserProject(%s): %v", username, err)
		}
	}()

	c.JSON(http.StatusOK, gin.H{
		"harbor_url":      harborURL,
		"user_project":    username,
		"public_projects": publicProjects,
		"is_admin":        isAdmin,
	})
}

// ListProjects 列出用户有权访问的项目
// 普通用户：公共项目 + 自己的私有项目
// 管理员：全部项目
func ListProjects(c *gin.Context) {
	username, _ := c.Get("username")
	isAdminVal, _ := c.Get("isAdmin")
	isAdmin, _ := isAdminVal.(bool)

	resp, err := harborAdmin("GET", "/api/v2.0/projects?page_size=100", nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到镜像仓库: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	var all []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&all); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "解析响应失败"})
		return
	}

	var visible []map[string]interface{}
	for _, p := range all {
		name, _ := p["name"].(string)

		// Harbor 公开项目：metadata.public == "true" 或在配置的公共项目名单里
		harborPublic := false
		if meta, ok := p["metadata"].(map[string]interface{}); ok {
			harborPublic = meta["public"] == "true"
		}
		isPublic := harborPublic || isPublicProject(name)

		canSee := isAdmin || isPublic || name == username.(string)
		if !canSee {
			continue
		}
		p["is_public_project"] = isPublic
		p["is_own_project"] = name == username.(string)
		p["can_write"] = isAdmin || name == username.(string)
		visible = append(visible, p)
	}
	if visible == nil {
		visible = []map[string]interface{}{}
	}
	c.JSON(http.StatusOK, gin.H{"data": visible})
}

// ListRepositories 列出项目下的镜像（带权限检查）
func ListRepositories(c *gin.Context) {
	username, _ := c.Get("username")
	isAdminVal, _ := c.Get("isAdmin")
	isAdmin, _ := isAdminVal.(bool)
	project := c.Param("project")

	// 权限检查：管理员全通，自己的项目全通，其他项目查 Harbor 确认是否公开
	if !isAdmin && project != username.(string) {
		if !checkProjectPublic(project) {
			c.JSON(http.StatusForbidden, gin.H{"error": "无权访问此项目"})
			return
		}
	}

	resp, err := harborAdmin("GET", fmt.Sprintf("/api/v2.0/projects/%s/repositories?page_size=100", project), nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到镜像仓库: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	var repos []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&repos); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "解析响应失败"})
		return
	}
	if repos == nil {
		repos = []map[string]interface{}{}
	}
	c.JSON(http.StatusOK, gin.H{"data": repos})
}

// ListTags 列出镜像的 artifact/tag 列表（带权限检查）
func ListTags(c *gin.Context) {
	username, _ := c.Get("username")
	isAdminVal, _ := c.Get("isAdmin")
	isAdmin, _ := isAdminVal.(bool)
	project := c.Param("project")
	repo := c.Param("repo")

	if !isAdmin && project != username.(string) {
		if !checkProjectPublic(project) {
			c.JSON(http.StatusForbidden, gin.H{"error": "无权访问此项目"})
			return
		}
	}

	resp, err := harborAdmin("GET",
		fmt.Sprintf("/api/v2.0/projects/%s/repositories/%s/artifacts?with_tag=true&page_size=50", project, repo),
		nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到镜像仓库: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	var artifacts []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&artifacts); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "解析响应失败"})
		return
	}
	if artifacts == nil {
		artifacts = []map[string]interface{}{}
	}
	c.JSON(http.StatusOK, gin.H{"data": artifacts})
}

// DeleteRepository 删除整个镜像仓库
// 私有项目：只有本人或管理员可删
// 公共项目：只有管理员可删
func DeleteRepository(c *gin.Context) {
	username, _ := c.Get("username")
	isAdminVal, _ := c.Get("isAdmin")
	isAdmin, _ := isAdminVal.(bool)
	project := c.Param("project")
	repo := c.Param("repo")

	if isPublicProject(project) && !isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "公共项目镜像只有管理员可以删除"})
		return
	}
	if !isPublicProject(project) && !isAdmin && project != username.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权删除此镜像"})
		return
	}

	resp, err := harborAdmin("DELETE",
		fmt.Sprintf("/api/v2.0/projects/%s/repositories/%s", project, repo),
		nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除失败: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("删除失败，状态码: %d", resp.StatusCode)})
		return
	}
	logger.Info("Repository deleted: %s/%s by %s", project, repo, username)
	c.JSON(http.StatusOK, gin.H{"message": "删除成功"})
}

// DeleteTag 删除单个 tag（digest）
func DeleteTag(c *gin.Context) {
	username, _ := c.Get("username")
	isAdminVal, _ := c.Get("isAdmin")
	isAdmin, _ := isAdminVal.(bool)
	project := c.Param("project")
	repo := c.Param("repo")
	tag := c.Param("tag") // digest 或 tag name

	if isPublicProject(project) && !isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "公共项目镜像只有管理员可以删除"})
		return
	}
	if !isPublicProject(project) && !isAdmin && project != username.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权删除此镜像"})
		return
	}

	resp, err := harborAdmin("DELETE",
		fmt.Sprintf("/api/v2.0/projects/%s/repositories/%s/artifacts/%s", project, repo, tag),
		nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除失败: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("删除失败，状态码: %d", resp.StatusCode)})
		return
	}
	logger.Info("Tag deleted: %s/%s:%s by %s", project, repo, tag, username)
	c.JSON(http.StatusOK, gin.H{"message": "删除成功"})
}

// SaveContainerImage 将运行中容器通过 enroot export + skopeo 推送到用户私有项目
// 流程：查作业节点 → SSH 到节点 → enroot export → skopeo push → Harbor 用户私有项目
func SaveContainerImage(c *gin.Context) {
	username, _ := c.Get("username")
	uid, _ := c.Get("uid")

	var req struct {
		JobID     int64  `json:"job_id" binding:"required"`
		ImageName string `json:"image_name" binding:"required"`
		Tag       string `json:"tag"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}
	if req.Tag == "" {
		req.Tag = "latest"
	}

	harborURL := strings.TrimSpace(os.Getenv("HARBOR_URL"))
	harborHost := strings.TrimPrefix(strings.TrimPrefix(harborURL, "https://"), "http://")
	harborHost = strings.TrimRight(harborHost, "/")
	harborUser := os.Getenv("HARBOR_ADMIN_USER")
	harborPass := os.Getenv("HARBOR_ADMIN_PASS")

	// 目标镜像推到用户自己的私有项目
	targetImage := fmt.Sprintf("%s/%s/%s:%s", harborHost, username, req.ImageName, req.Tag)

	// 确保用户私有项目存在
	go func() {
		if err := ensureUserProject(username.(string)); err != nil {
			logger.Error("ensureUserProject: %v", err)
		}
	}()

	// 开发模式
	if os.Getenv("DEV_MODE") == "true" {
		logger.Info("DEV: SaveContainerImage job=%d target=%s", req.JobID, targetImage)
		c.JSON(http.StatusOK, gin.H{
			"message":      "镜像保存成功（开发模式）",
			"target_image": targetImage,
		})
		return
	}

	// 查询作业获取运行节点
	slurmClient, err := GetSlurmClientForUser(username.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接 Slurm: " + err.Error()})
		return
	}
	job, err := slurmClient.GetJob(req.JobID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "作业不存在或已结束: " + err.Error()})
		return
	}
	if job.GetJobState() != "RUNNING" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "作业未在运行中，无法保存镜像"})
		return
	}
	// 取第一个节点
	nodeName := strings.Split(job.Nodes, ",")[0]
	if nodeName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无法获取作业运行节点"})
		return
	}

	// 找节点 SSH 地址（从 WEBSHELL_NODES 配置里查，找不到就直接用节点名）
	// enroot list/export 在登录节点上执行（pyxis 实例挂载在提交用户的登录节点空间）
	nodeHost := nodeName
	nodePort := 22
	nodes, _ := loadNodesFromEnv()
	// 优先使用登录节点（WEBSHELL_NODES 第一个 enabled 节点）
	for _, n := range nodes {
		if n.Enabled {
			nodeHost = n.Host
			nodePort = n.Port
			break
		}
	}

	// 获取用户私钥（用于 SSH 到节点）
	uidStr := fmt.Sprintf("%d", uid)
	privateKey, err := getUserPrivateKey(uidStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请先在 Web Shell 页面配置 SSH 密钥"})
		return
	}

	// 构建 enroot export → docker-archive → skopeo push 命令
	// pyxis 实例名格式：pyxis_<jobid>.<stepid>
	// 流程：enroot export (squashfs) → unsquashfs (rootfs) → tar (docker archive) → skopeo push
	ts := time.Now().Unix()
	exportPath := fmt.Sprintf("/tmp/hpc_img_%d_%d.sqsh", req.JobID, ts)
	rootfsDir := fmt.Sprintf("/tmp/hpc_rootfs_%d_%d", req.JobID, ts)
	layerTar := fmt.Sprintf("/tmp/hpc_layer_%d_%d.tar", req.JobID, ts)
	ociWorkDir := fmt.Sprintf("/tmp/hpc_oci_%d_%d", req.JobID, ts)
	dockerTar := fmt.Sprintf("/tmp/hpc_docker_%d_%d.tar", req.JobID, ts)
	// 生成任务ID
	taskID := fmt.Sprintf("save_%d_%d", req.JobID, ts)
	task := &SaveImageTask{
		TaskID:      taskID,
		Status:      "pending",
		Step:        0,
		TotalSteps:  4,
		StepDesc:    "准备中...",
		TargetImage: targetImage,
	}
	setSaveTask(task)

	// 异步 SSH 分步执行，实时更新任务状态
	go func() {
		updateTask := func(step int, desc, status string, errMsg string) {
			task.Step = step
			task.StepDesc = desc
			task.Status = status
			task.Error = errMsg
			setSaveTask(task)
		}

		sshCfg := &gossh.ClientConfig{
			User:            username.(string),
			HostKeyCallback: gossh.InsecureIgnoreHostKey(),
			Timeout:         10 * time.Second,
		}
		signer, err := gossh.ParsePrivateKey([]byte(privateKey))
		if err != nil {
			updateTask(0, "SSH 密钥解析失败", "error", err.Error())
			return
		}
		sshCfg.Auth = []gossh.AuthMethod{gossh.PublicKeys(signer)}

		addr := fmt.Sprintf("%s:%d", nodeHost, nodePort)
		client, err := gossh.Dial("tcp", addr, sshCfg)
		if err != nil {
			updateTask(0, "SSH 连接失败", "error", err.Error())
			return
		}
		defer client.Close()

		// 分步执行，每步单独 SSH session 以便实时更新进度
		steps := []struct {
			step int
			desc string
			cmd  string
		}{
			{1, "导出容器 squashfs...", fmt.Sprintf(
				`CONTAINER=$(enroot list 2>/dev/null | grep "^pyxis_%d\." | head -1); `+
					`if [ -z "$CONTAINER" ]; then echo "ERROR: 未找到容器实例 pyxis_%d.*" >&2; exit 1; fi; `+
					`enroot export --output "%s" "$CONTAINER"`,
				req.JobID, req.JobID, exportPath)},
			{2, "解压 rootfs...", fmt.Sprintf(
				`unsquashfs -f -d "%s" "%s"`,
				rootfsDir, exportPath)},
			{3, "构建 docker archive...", fmt.Sprintf(
				`tar -C "%s" -cf "%s" . && `+
					`LAYER_SHA=$(sha256sum "%s" | awk '{print $1}') && `+
					`CONFIG_JSON="{\"architecture\":\"amd64\",\"os\":\"linux\",\"rootfs\":{\"type\":\"layers\",\"diff_ids\":[\"sha256:$LAYER_SHA\"]}}" && `+
					`CONFIG_SHA=$(echo -n "$CONFIG_JSON" | sha256sum | awk '{print $1}') && `+
					`mkdir -p "%s" && `+
					`echo -n "$CONFIG_JSON" > "%s/${CONFIG_SHA}.json" && `+
					`cp "%s" "%s/${LAYER_SHA}.tar" && `+
					`echo "[{\"Config\":\"${CONFIG_SHA}.json\",\"RepoTags\":[\"%s\"],\"Layers\":[\"${LAYER_SHA}.tar\"]}]" > "%s/manifest.json" && `+
					`tar -C "%s" -cf "%s" .`,
				rootfsDir, layerTar,
				layerTar,
				ociWorkDir,
				ociWorkDir, layerTar, ociWorkDir,
				targetImage, ociWorkDir,
				ociWorkDir, dockerTar)},
			{4, "推送到 Harbor...", fmt.Sprintf(
				`skopeo copy --insecure-policy --dest-creds "%s:%s" --dest-tls-verify=false docker-archive:"%s" docker://%s && `+
					`rm -rf "%s" "%s" "%s" "%s" "%s"`,
				harborUser, harborPass, dockerTar, targetImage,
				exportPath, rootfsDir, layerTar, ociWorkDir, dockerTar)},
		}

		for _, s := range steps {
			updateTask(s.step, s.desc, "running", "")
			sess, err := client.NewSession()
			if err != nil {
				updateTask(s.step, s.desc, "error", "创建 SSH session 失败: "+err.Error())
				return
			}
			out, err := sess.CombinedOutput("bash -c " + shellescape(s.cmd))
			sess.Close()
			if err != nil {
				errMsg := fmt.Sprintf("%v\n%s", err, string(out))
				logger.Error("SaveContainerImage step %d failed: %s", s.step, errMsg)
				updateTask(s.step, s.desc, "error", string(out))
				return
			}
			logger.Info("SaveContainerImage step %d done: %s", s.step, string(out))
		}

		updateTask(4, "完成", "done", "")
		logger.Info("SaveContainerImage: success job=%d target=%s", req.JobID, targetImage)
	}()

	logger.Info("SaveContainerImage: task=%s job=%d target=%s user=%s", taskID, req.JobID, targetImage, username)
	c.JSON(http.StatusOK, gin.H{
		"message":      "镜像保存任务已启动",
		"target_image": targetImage,
		"task_id":      taskID,
	})
}

// shellescape 对 shell 脚本内容做单引号转义，安全传给 bash -c
func shellescape(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "'\\''") + "'"
}
