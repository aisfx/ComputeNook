package main

import (
	"bufio"
	"fmt"
	"log"
	"net/http"
	"os/exec"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// QuotaInfo 配额信息
type QuotaInfo struct {
	Filesystem  string `json:"filesystem"`
	Type        string `json:"type"` // "lustre" | "nfs" | "unknown"
	BlockUsed   int64  `json:"block_used_kb"`
	BlockSoft   int64  `json:"block_soft_kb"`
	BlockHard   int64  `json:"block_hard_kb"`
	InodeUsed   int64  `json:"inode_used"`
	InodeSoft   int64  `json:"inode_soft"`
	InodeHard   int64  `json:"inode_hard"`
	BlockGrace  string `json:"block_grace,omitempty"`
	InodeGrace  string `json:"inode_grace,omitempty"`
}

// GetQuota 查询用户存储配额
// GET /api/files/quota?path=/home/user  (可选，默认查所有挂载点)
func GetQuota(c *gin.Context) {
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}
	user := username.(string)

	// 可选：指定挂载点
	mountpoint := c.Query("path")

	quotas, err := queryQuota(user, mountpoint)
	if err != nil {
		log.Printf("GetQuota error for user %s: %v", user, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"username": user,
		"quotas":   quotas,
	})
}

// queryQuota 根据挂载点类型选择查询方式
func queryQuota(username, mountpoint string) ([]QuotaInfo, error) {
	if mountpoint != "" {
		fsType := detectFSType(mountpoint)
		switch fsType {
		case "lustre":
			return queryLustreQuota(username, mountpoint)
		case "nfs":
			return queryNFSQuota(username, mountpoint)
		default:
			return nil, fmt.Errorf("不支持的文件系统类型或无法检测: %s", mountpoint)
		}
	}

	// 未指定挂载点：扫描所有 lustre/nfs 挂载点
	return queryAllQuotas(username)
}

// detectFSType 通过 /proc/mounts 检测挂载点文件系统类型
func detectFSType(mountpoint string) string {
	out, err := exec.Command("findmnt", "-n", "-o", "FSTYPE", mountpoint).Output()
	if err != nil {
		// fallback: 读 /proc/mounts
		return detectFSTypeFromProcMounts(mountpoint)
	}
	fstype := strings.TrimSpace(string(out))
	if strings.Contains(fstype, "lustre") {
		return "lustre"
	}
	if fstype == "nfs" || fstype == "nfs4" {
		return "nfs"
	}
	return fstype
}

func detectFSTypeFromProcMounts(mountpoint string) string {
	out, err := exec.Command("cat", "/proc/mounts").Output()
	if err != nil {
		return "unknown"
	}
	scanner := bufio.NewScanner(strings.NewReader(string(out)))
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
			return fstype
		}
	}
	return "unknown"
}

// queryAllQuotas 扫描所有 lustre/nfs 挂载点并查询配额
func queryAllQuotas(username string) ([]QuotaInfo, error) {
	out, err := exec.Command("findmnt", "-n", "-o", "TARGET,FSTYPE", "-t", "lustre,nfs,nfs4").Output()
	if err != nil {
		// findmnt 不可用时 fallback 到 /proc/mounts
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
			log.Printf("quota query failed for %s (%s): %v", target, fstype, err)
			continue
		}
		results = append(results, quotas...)
	}
	return results, nil
}

func queryAllQuotasFromProcMounts(username string) ([]QuotaInfo, error) {
	out, err := exec.Command("cat", "/proc/mounts").Output()
	if err != nil {
		return nil, fmt.Errorf("无法读取挂载信息")
	}

	var results []QuotaInfo
	scanner := bufio.NewScanner(strings.NewReader(string(out)))
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
			log.Printf("quota query failed for %s: %v", target, err)
			continue
		}
		results = append(results, quotas...)
	}
	return results, nil
}

// queryLustreQuota 使用 lfs quota 查询 Lustre 配额
// 输出示例:
// Disk quotas for usr testuser (uid 1001):
//      Filesystem  kbytes   quota   limit   grace   files   quota   limit   grace
// /mnt/lustre     102400  512000 1024000       -    1234   10000   20000       -
func queryLustreQuota(username, mountpoint string) ([]QuotaInfo, error) {
	out, err := exec.Command("lfs", "quota", "-u", username, mountpoint).Output()
	if err != nil {
		return nil, fmt.Errorf("lfs quota 执行失败: %v", err)
	}

	var results []QuotaInfo
	scanner := bufio.NewScanner(strings.NewReader(string(out)))
	for scanner.Scan() {
		line := scanner.Text()
		// 跳过标题行
		if strings.HasPrefix(line, "Disk quotas") || strings.HasPrefix(line, "Filesystem") || strings.TrimSpace(line) == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 9 {
			continue
		}
		q := QuotaInfo{
			Filesystem: fields[0],
			Type:       "lustre",
			BlockUsed:  parseInt64(fields[1]),
			BlockSoft:  parseInt64(fields[2]),
			BlockHard:  parseInt64(fields[3]),
			BlockGrace: fields[4],
			InodeUsed:  parseInt64(fields[5]),
			InodeSoft:  parseInt64(fields[6]),
			InodeHard:  parseInt64(fields[7]),
			InodeGrace: fields[8],
		}
		results = append(results, q)
	}
	return results, nil
}

// queryNFSQuota 使用 quota 命令查询 NFS 配额（依赖服务端 rpc.rquotad）
// 输出示例:
// Disk quotas for user testuser (uid 1001):
//      Filesystem  blocks   quota   limit   grace   files   quota   limit   grace
// server:/export   51200  512000 1024000       -     234    5000   10000       -
func queryNFSQuota(username, mountpoint string) ([]QuotaInfo, error) {
	// -u: 用户配额, -f: 指定文件系统, --show-mntpoint
	out, err := exec.Command("quota", "-u", username, "-f", mountpoint, "--no-wrap").Output()
	if err != nil {
		// quota 命令可能以非0退出但仍有输出（超限时）
		if len(out) == 0 {
			return nil, fmt.Errorf("quota 执行失败: %v", err)
		}
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
			Filesystem: fields[0],
			Type:       "nfs",
			BlockUsed:  parseInt64(fields[1]),
			BlockSoft:  parseInt64(fields[2]),
			BlockHard:  parseInt64(fields[3]),
			BlockGrace: fields[4],
			InodeUsed:  parseInt64(fields[5]),
			InodeSoft:  parseInt64(fields[6]),
			InodeHard:  parseInt64(fields[7]),
		}
		if len(fields) >= 9 {
			q.InodeGrace = fields[8]
		}
		results = append(results, q)
	}
	return results, nil
}

func parseInt64(s string) int64 {
	// lustre/quota 输出中超限时会带 * 后缀
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
