package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	gossh "golang.org/x/crypto/ssh"
	"hpc-backend/logger"
)

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
	nodeHost := nodeName
	nodePort := 22
	nodes, _ := loadNodesFromEnv()
	for _, n := range nodes {
		if n.Name == nodeName {
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

	// 构建 enroot export + skopeo push 命令
	// enroot 容器名格式：pyxis.<job_id>（Pyxis 插件约定）
	exportPath := fmt.Sprintf("/tmp/hpc_img_%d_%d.sqsh", req.JobID, time.Now().Unix())
	saveScript := fmt.Sprintf(`set -e
CONTAINER="pyxis.%d"
EXPORT="%s"
echo "[1/3] Exporting container $CONTAINER..."
enroot export --output "$EXPORT" "$CONTAINER"
echo "[2/3] Pushing to Harbor..."
skopeo copy --insecure-policy \
  --dest-creds "%s:%s" \
  --dest-tls-verify=false \
  oci-archive:"$EXPORT" \
  docker://%s
echo "[3/3] Cleaning up..."
rm -f "$EXPORT"
echo "Done: %s"`,
		req.JobID, exportPath,
		harborUser, harborPass,
		targetImage, targetImage,
	)

	// 异步 SSH 执行，立即返回给前端
	go func() {
		sshCfg := &gossh.ClientConfig{
			User:            username.(string),
			HostKeyCallback: gossh.InsecureIgnoreHostKey(),
			Timeout:         10 * time.Second,
		}
		// 解析私钥
		signer, err := gossh.ParsePrivateKey([]byte(privateKey))
		if err != nil {
			logger.Error("SaveContainerImage: parse private key failed: %v", err)
			return
		}
		sshCfg.Auth = []gossh.AuthMethod{gossh.PublicKeys(signer)}

		addr := fmt.Sprintf("%s:%d", nodeHost, nodePort)
		client, err := gossh.Dial("tcp", addr, sshCfg)
		if err != nil {
			logger.Error("SaveContainerImage: SSH dial %s failed: %v", addr, err)
			return
		}
		defer client.Close()

		sess, err := client.NewSession()
		if err != nil {
			logger.Error("SaveContainerImage: new session failed: %v", err)
			return
		}
		defer sess.Close()

		out, err := sess.CombinedOutput("bash -c " + shellescape(saveScript))
		if err != nil {
			logger.Error("SaveContainerImage: script failed: %v\nOutput: %s", err, string(out))
		} else {
			logger.Info("SaveContainerImage: success job=%d target=%s\n%s", req.JobID, targetImage, string(out))
		}
	}()

	logger.Info("SaveContainerImage: submitted async job=%d node=%s target=%s user=%s",
		req.JobID, nodeName, targetImage, username)
	c.JSON(http.StatusOK, gin.H{
		"message":      "镜像保存任务已在后台执行，完成后可在镜像仓库查看",
		"target_image": targetImage,
		"node":         nodeName,
	})
}

// shellescape 对 shell 脚本内容做单引号转义，安全传给 bash -c
func shellescape(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "'\\''") + "'"
}
