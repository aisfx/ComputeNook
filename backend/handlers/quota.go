package handlers

import (
	"bufio"
	"bytes"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"hpc-backend/logger"
	"hpc-backend/slurm"
)

// QuotaInfo 配额信息
type QuotaInfo struct {
	Filesystem string `json:"filesystem"`
	Type       string `json:"type"`
	BlockUsed  int64  `json:"block_used_kb"`
	BlockSoft  int64  `json:"block_soft_kb"`
	BlockHard  int64  `json:"block_hard_kb"`
	InodeUsed  int64  `json:"inode_used"`
	InodeSoft  int64  `json:"inode_soft"`
	InodeHard  int64  `json:"inode_hard"`
	BlockGrace string `json:"block_grace,omitempty"`
	InodeGrace string `json:"inode_grace,omitempty"`
}

// SetQuotaRequest 设置配额请求
type SetQuotaRequest struct {
	Username    string `json:"username" binding:"required"`
	BlockHardKB int64  `json:"block_hard_kb"`
	BlockSoftKB int64  `json:"block_soft_kb"`
	InodeHard   int64  `json:"inode_hard"`
	InodeSoft   int64  `json:"inode_soft"`
}

func getQuotaFSType() string {
	t := strings.ToLower(strings.TrimSpace(os.Getenv("QUOTA_FS_TYPE")))
	if t == "lustre" || t == "nfs" || t == "xfs" {
		return t
	}
	return ""
}

func getQuotaPath(userHome string) string {
	if p := strings.TrimSpace(os.Getenv("QUOTA_PATH")); p != "" {
		return p
	}
	return userHome
}

// GetQuota GET /api/files/quota
func GetQuota(c *gin.Context) {
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}
	user := username.(string)
	mountpoint := c.Query("path")
	quotas, err := queryQuota(user, mountpoint)
	if err != nil {
		logger.Error("GetQuota error for user %s: %v", user, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"username": user, "quotas": quotas})
}

// GetFSInfo GET /api/files/quota/fsinfo  返回挂载点的真实容量
func GetFSInfo(c *gin.Context) {
	path := getQuotaPath("")
	if path == "" {
		path = os.Getenv("FILEMANAGER_BASE_PATH")
		if path == "" {
			path = "/home"
		}
	}
	totalKB, usedKB, freeKB, err := getFSStats(path)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"path":     path,
		"total_kb": totalKB,
		"used_kb":  usedKB,
		"free_kb":  freeKB,
	})
}

// GetAllQuotas GET /api/files/quota/all  (admin)
// GetAllQuotas GET /api/files/quota/all  (admin)
func GetAllQuotas(c *gin.Context) {
	isAdmin, _ := c.Get("isAdmin")
	if isAdmin != true {
		c.JSON(http.StatusForbidden, gin.H{"error": "需要管理员权限"})
		return
	}

	username, _ := c.Get("username")
	currentUser := username.(string)

	basePath := os.Getenv("FILEMANAGER_BASE_PATH")
	if basePath == "" {
		basePath = "/home"
	}

	// 获取当前用户所属 account 下的用户列表
	accountUsers, err := getUsersInSameAccount(currentUser)
	if err != nil {
		logger.Warn("GetAllQuotas: failed to get slurm account users for %s: %v, falling back to home dir", currentUser, err)
		accountUsers = nil
	}

	type UserQuota struct {
		Username string      `json:"username"`
		Path     string      `json:"path"`
		Quotas   []QuotaInfo `json:"quotas"`
		Error    string      `json:"error,omitempty"`
	}

	results := make([]UserQuota, 0)

	if len(accountUsers) > 0 {
		// 只查 account 下的用户，排除 root
		for _, uname := range accountUsers {
			if uname == "root" {
				continue
			}
			userHome := basePath + "/" + uname
			quotas, err := queryQuota(uname, userHome)
			uq := UserQuota{Username: uname, Path: userHome, Quotas: quotas}
			if err != nil {
				uq.Error = err.Error()
				if uq.Quotas == nil {
					uq.Quotas = []QuotaInfo{}
				}
			}
			results = append(results, uq)
		}
	} else {
		// fallback：枚举 home 目录，排除 root
		entries, err := os.ReadDir(basePath)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "读取用户目录失败: " + err.Error()})
			return
		}
		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}
			uname := entry.Name()
			if uname == "root" {
				continue
			}
			userHome := basePath + "/" + uname
			quotas, err := queryQuota(uname, userHome)
			uq := UserQuota{Username: uname, Path: userHome, Quotas: quotas}
			if err != nil {
				uq.Error = err.Error()
				if uq.Quotas == nil {
					uq.Quotas = []QuotaInfo{}
				}
			}
			results = append(results, uq)
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": results})
}

// getUsersInSameAccount 获取与当前用户同属一个 slurm account 的所有用户（去重）
func getUsersInSameAccount(currentUser string) ([]string, error) {
	if os.Getenv("DEV_MODE") == "true" {
		return nil, nil
	}

	client, err := slurm.NewClientForUser(currentUser)
	if err != nil {
		return nil, err
	}

	// 先找当前用户所属的 account
	slurmUser, err := client.GetSlurmUser(currentUser)
	if err != nil {
		return nil, err
	}

	userAccount := ""
	if slurmUser.Default != nil && slurmUser.Default.Account != "" {
		userAccount = slurmUser.Default.Account
	}
	if userAccount == "" && slurmUser.DefaultAccount != "" {
		userAccount = slurmUser.DefaultAccount
	}
	if userAccount == "" {
		return nil, fmt.Errorf("user %s has no default account", currentUser)
	}

	// 获取该 account 下的所有 associations
	associations, err := client.GetAssociations()
	if err != nil {
		return nil, err
	}

	seen := make(map[string]bool)
	users := make([]string, 0)
	for _, assoc := range associations {
		if assoc.Account == userAccount && assoc.User != "" {
			if !seen[assoc.User] {
				seen[assoc.User] = true
				users = append(users, assoc.User)
			}
		}
	}
	return users, nil
}

// SetQuota POST /api/files/quota  (admin)
func SetQuota(c *gin.Context) {
	isAdmin, _ := c.Get("isAdmin")
	if isAdmin != true {
		c.JSON(http.StatusForbidden, gin.H{"error": "需要管理员权限"})
		return
	}

	var req SetQuotaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误: " + err.Error()})
		return
	}

	path := getQuotaPath("")
	if path == "" {
		basePath := os.Getenv("FILEMANAGER_BASE_PATH")
		if basePath == "" {
			basePath = "/home"
		}
		path = basePath
	}

	if err := execSetQuota(req, path); err != nil {
		logger.Error("SetQuota error for user %s: %v", req.Username, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	logger.Info("SetQuota success: user=%s block_hard=%dKB inode_hard=%d", req.Username, req.BlockHardKB, req.InodeHard)
	c.JSON(http.StatusOK, gin.H{"message": "配额设置成功", "username": req.Username})
}

// ── 内部实现 ──────────────────────────────────────────────

func queryQuota(username, mountpoint string) ([]QuotaInfo, error) {
	fsType := getQuotaFSType()
	path := getQuotaPath(mountpoint)
	if path == "" {
		if fsType == "lustre" || fsType == "nfs" {
			return nil, fmt.Errorf("QUOTA_FS_TYPE=%s 时必须设置 QUOTA_PATH 或传入 path 参数", fsType)
		}
		return queryAllQuotas(username)
	}
	switch fsType {
	case "lustre":
		return queryLustreQuota(username, path)
	case "nfs":
		return queryNFSQuota(username, path)
	case "xfs":
		return queryXFSQuota(username, path)
	default:
		detected := detectFSType(path)
		switch detected {
		case "lustre":
			return queryLustreQuota(username, path)
		case "nfs":
			return queryNFSQuota(username, path)
		case "xfs":
			return queryXFSQuota(username, path)
		default:
			return nil, fmt.Errorf("无法检测文件系统类型: %s，请设置 QUOTA_FS_TYPE 环境变量", path)
		}
	}
}

func execSetQuota(req SetQuotaRequest, mountpoint string) error {
	fsType := getQuotaFSType()
	if fsType == "" {
		fsType = detectFSType(mountpoint)
	}
	logger.Info("execSetQuota: fsType=%s mountpoint=%s user=%s blockHard=%dKB", fsType, mountpoint, req.Username, req.BlockHardKB)
	var cmd *exec.Cmd
	switch fsType {
	case "lustre":
		args := []string{"setquota", "-u", req.Username}
		// 块配额
		if req.BlockSoftKB > 0 {
			args = append(args, "--block-softlimit", fmt.Sprintf("%dk", req.BlockSoftKB))
		}
		if req.BlockHardKB > 0 {
			args = append(args, "--block-hardlimit", fmt.Sprintf("%dk", req.BlockHardKB))
		} else {
			args = append(args, "--block-hardlimit", "0")
		}
		// 文件数配额（inode）- 始终设置，0 表示无限制
		if req.InodeSoft > 0 {
			args = append(args, "--inode-softlimit", fmt.Sprintf("%d", req.InodeSoft))
		} else {
			args = append(args, "--inode-softlimit", "0")
		}
		if req.InodeHard > 0 {
			args = append(args, "--inode-hardlimit", fmt.Sprintf("%d", req.InodeHard))
		} else {
			args = append(args, "--inode-hardlimit", "0")
		}
		args = append(args, mountpoint)
		cmd = exec.Command("lfs", args...)
	case "nfs":
		cmd = exec.Command("setquota", "-u", req.Username,
			fmt.Sprintf("%d", req.BlockSoftKB), fmt.Sprintf("%d", req.BlockHardKB),
			fmt.Sprintf("%d", req.InodeSoft), fmt.Sprintf("%d", req.InodeHard),
			mountpoint)
	case "xfs":
		// xfs_quota -x -c "limit -u bsoft=Xk bhard=Xk isoft=X ihard=X username" mountpoint
		// 注意：XFS 配额必须同时设置块和 inode 限制
		// 块配额（空间）- 使用 KB 单位
		bsoft := req.BlockSoftKB
		bhard := req.BlockHardKB
		
		// 文件数配额（inode）
		isoft := req.InodeSoft
		ihard := req.InodeHard
		
		// 构建完整的 limit 命令
		limitStr := fmt.Sprintf("limit -u bsoft=%dk bhard=%dk isoft=%d ihard=%d %s",
			bsoft, bhard, isoft, ihard, req.Username)
		
		cmd = exec.Command("xfs_quota", "-x", "-c", limitStr, mountpoint)
		logger.Info("XFS quota command: xfs_quota -x -c \"%s\" %s", limitStr, mountpoint)
	default:
		return fmt.Errorf("无法确定文件系统类型 (detected=%s)，请设置 QUOTA_FS_TYPE 环境变量 (lustre / nfs / xfs)", fsType)
	}
	logger.Info("execSetQuota cmd: %v", cmd.Args)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		errMsg := strings.TrimSpace(stderr.String())
		if errMsg == "" {
			errMsg = err.Error()
		}
		return fmt.Errorf("%s 执行失败: %s (cmd: %v)", fsType, errMsg, cmd.Args)
	}
	return nil
}

func detectFSType(mountpoint string) string {
	out, err := exec.Command("findmnt", "-n", "-o", "FSTYPE", mountpoint).Output()
	if err != nil {
		return detectFSTypeFromProcMounts(mountpoint)
	}
	fstype := strings.TrimSpace(string(out))
	if strings.Contains(fstype, "lustre") {
		return "lustre"
	}
	if fstype == "nfs" || fstype == "nfs4" {
		return "nfs"
	}
	if fstype == "xfs" {
		return "xfs"
	}
	return fstype
}

func detectFSTypeFromProcMounts(mountpoint string) string {
	data, err := os.ReadFile("/proc/mounts")
	if err != nil {
		return "unknown"
	}
	scanner := bufio.NewScanner(strings.NewReader(string(data)))
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) >= 3 && fields[1] == mountpoint {
			fstype := fields[2]
			if strings.Contains(fstype, "lustre") {
				return "lustre"
			}
			if fstype == "nfs" || fstype == "nfs4" {
				return "nfs"
			}
			if fstype == "xfs" {
				return "xfs"
			}
			return fstype
		}
	}
	return "unknown"
}

func queryAllQuotas(username string) ([]QuotaInfo, error) {
	out, err := exec.Command("findmnt", "-n", "-o", "TARGET,FSTYPE", "-t", "lustre,nfs,nfs4").Output()
	if err != nil {
		return queryAllQuotasFromProcMounts(username)
	}
	var results []QuotaInfo
	scanner := bufio.NewScanner(strings.NewReader(string(out)))
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 2 {
			continue
		}
		target, fstype := fields[0], fields[1]
		var quotas []QuotaInfo
		if strings.Contains(fstype, "lustre") {
			quotas, err = queryLustreQuota(username, target)
		} else if fstype == "nfs" || fstype == "nfs4" {
			quotas, err = queryNFSQuota(username, target)
		}
		if err != nil {
			logger.Warn("quota query failed for %s (%s): %v", target, fstype, err)
			continue
		}
		results = append(results, quotas...)
	}
	return results, nil
}

func queryAllQuotasFromProcMounts(username string) ([]QuotaInfo, error) {
	data, err := os.ReadFile("/proc/mounts")
	if err != nil {
		return nil, fmt.Errorf("无法读取挂载信息")
	}
	var results []QuotaInfo
	scanner := bufio.NewScanner(strings.NewReader(string(data)))
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 3 {
			continue
		}
		target, fstype := fields[1], fields[2]
		var quotas []QuotaInfo
		if strings.Contains(fstype, "lustre") {
			quotas, err = queryLustreQuota(username, target)
		} else if fstype == "nfs" || fstype == "nfs4" {
			quotas, err = queryNFSQuota(username, target)
		} else {
			continue
		}
		if err != nil {
			logger.Warn("quota query failed for %s: %v", target, err)
			continue
		}
		results = append(results, quotas...)
	}
	return results, nil
}

func queryLustreQuota(username, mountpoint string) ([]QuotaInfo, error) {
	out, err := exec.Command("lfs", "quota", "-u", username, mountpoint).Output()
	if err != nil {
		return nil, fmt.Errorf("lfs quota 执行失败: %v", err)
	}
	var results []QuotaInfo
	scanner := bufio.NewScanner(strings.NewReader(string(out)))
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "Disk quotas") || strings.HasPrefix(line, "Filesystem") || strings.TrimSpace(line) == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 9 {
			continue
		}
		results = append(results, QuotaInfo{
			Filesystem: fields[0], Type: "lustre",
			BlockUsed: parseInt64(fields[1]), BlockSoft: parseInt64(fields[2]), BlockHard: parseInt64(fields[3]), BlockGrace: fields[4],
			InodeUsed: parseInt64(fields[5]), InodeSoft: parseInt64(fields[6]), InodeHard: parseInt64(fields[7]), InodeGrace: fields[8],
		})
	}
	return results, nil
}

func queryNFSQuota(username, mountpoint string) ([]QuotaInfo, error) {
	out, err := exec.Command("quota", "-u", username, "-f", mountpoint, "--no-wrap").Output()
	if err != nil && len(out) == 0 {
		return nil, fmt.Errorf("quota 执行失败: %v", err)
	}
	var results []QuotaInfo
	scanner := bufio.NewScanner(strings.NewReader(string(out)))
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "Disk quotas") || strings.HasPrefix(line, "Filesystem") || strings.TrimSpace(line) == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 8 {
			continue
		}
		q := QuotaInfo{
			Filesystem: fields[0], Type: "nfs",
			BlockUsed: parseInt64(fields[1]), BlockSoft: parseInt64(fields[2]), BlockHard: parseInt64(fields[3]), BlockGrace: fields[4],
			InodeUsed: parseInt64(fields[5]), InodeSoft: parseInt64(fields[6]), InodeHard: parseInt64(fields[7]),
		}
		if len(fields) >= 9 {
			q.InodeGrace = fields[8]
		}
		results = append(results, q)
	}
	return results, nil
}

func queryXFSQuota(username, mountpoint string) ([]QuotaInfo, error) {
	out, err := exec.Command("xfs_quota", "-x", "-c", "report -ubih", mountpoint).Output()
	if err != nil {
		return nil, fmt.Errorf("xfs_quota 执行失败: %v", err)
	}
	var results []QuotaInfo
	scanner := bufio.NewScanner(strings.NewReader(string(out)))
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 5 || fields[0] != username {
			continue
		}
		q := QuotaInfo{
			Filesystem: mountpoint, Type: "xfs",
			BlockUsed: parseXFSSize(fields[1]), BlockSoft: parseXFSSize(fields[2]), BlockHard: parseXFSSize(fields[3]),
		}
		if len(fields) >= 10 {
			q.InodeUsed = parseInodeCount(fields[6])
			q.InodeSoft = parseInodeCount(fields[7])
			q.InodeHard = parseInodeCount(fields[8])
		}
		results = append(results, q)
	}
	return results, nil
}

func parseXFSSize(s string) int64 {
	s = strings.TrimSuffix(s, "*")
	if s == "-" || s == "0" || s == "" {
		return 0
	}
	s = strings.ToUpper(s)
	var multiplier int64 = 1
	if strings.HasSuffix(s, "T") {
		multiplier = 1024 * 1024 * 1024
		s = s[:len(s)-1]
	} else if strings.HasSuffix(s, "G") {
		multiplier = 1024 * 1024
		s = s[:len(s)-1]
	} else if strings.HasSuffix(s, "M") {
		multiplier = 1024
		s = s[:len(s)-1]
	} else if strings.HasSuffix(s, "K") {
		multiplier = 1
		s = s[:len(s)-1]
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	return int64(v * float64(multiplier))
}

func parseInodeCount(s string) int64 {
	s = strings.TrimSuffix(s, "*")
	if s == "-" || s == "0" || s == "" {
		return 0
	}
	s = strings.ToUpper(s)
	var multiplier int64 = 1
	if strings.HasSuffix(s, "M") {
		multiplier = 1000000
		s = s[:len(s)-1]
	} else if strings.HasSuffix(s, "K") {
		multiplier = 1000
		s = s[:len(s)-1]
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	return int64(v * float64(multiplier))
}

func parseInt64(s string) int64 {
	s = strings.TrimSuffix(s, "*")
	if s == "-" || s == "" {
		return 0
	}
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0
	}
	return v
}
