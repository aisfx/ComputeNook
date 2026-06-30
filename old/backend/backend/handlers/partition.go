package handlers

import (
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"hpc-backend/logger"
	"hpc-backend/models"
)

// GetPartitionConfigs 获取所有分区配置
func GetPartitionConfigs(c *gin.Context) {
	partitions, err := models.GetAllPartitions()
	if err != nil {
		logger.Error("Failed to get partitions: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取分区配置失败"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"data": partitions})
}

// GetPartitionConfig 获取单个分区配置
func GetPartitionConfig(c *gin.Context) {
	name := c.Param("name")
	
	partition, err := models.GetPartitionByName(name)
	if err != nil {
		logger.Error("Failed to get partition %s: %v", name, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "分区配置不存在"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"data": partition})
}

// CreatePartitionConfig 创建分区配置
func CreatePartitionConfig(c *gin.Context) {
	var partition models.Partition
	if err := c.ShouldBindJSON(&partition); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求数据: " + err.Error()})
		return
	}
	
	// 验证必填字段
	if partition.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "分区名称不能为空"})
		return
	}
	
	// 设置默认值
	if partition.Nodes == "" {
		partition.Nodes = "ALL"
	}
	if partition.OverSubscribe == "" {
		partition.OverSubscribe = "Exclusive"
	}
	if partition.MaxTime == "" {
		partition.MaxTime = "INFINITE"
	}
	if partition.State == "" {
		partition.State = "UP"
	}
	
	if err := models.CreatePartition(&partition); err != nil {
		logger.Error("Failed to create partition: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建分区配置失败: " + err.Error()})
		return
	}
	
	logger.Info("Partition %s created successfully", partition.Name)
	c.JSON(http.StatusCreated, gin.H{
		"message": "分区配置创建成功",
		"data":    partition,
	})
}

// UpdatePartitionConfig 更新分区配置
func UpdatePartitionConfig(c *gin.Context) {
	name := c.Param("name")
	
	var partition models.Partition
	if err := c.ShouldBindJSON(&partition); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求数据: " + err.Error()})
		return
	}
	
	// 确保名称匹配
	partition.Name = name
	
	// 检查分区是否存在
	existing, err := models.GetPartitionByName(name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "分区配置不存在"})
		return
	}
	
	partition.ID = existing.ID
	
	if err := models.UpdatePartition(&partition); err != nil {
		logger.Error("Failed to update partition %s: %v", name, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新分区配置失败: " + err.Error()})
		return
	}
	
	logger.Info("Partition %s updated successfully", name)
	c.JSON(http.StatusOK, gin.H{
		"message": "分区配置更新成功",
		"data":    partition,
	})
}

// DeletePartitionConfig 删除分区配置
func DeletePartitionConfig(c *gin.Context) {
	name := c.Param("name")
	
	// 检查分区是否存在
	_, err := models.GetPartitionByName(name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "分区配置不存在"})
		return
	}
	
	if err := models.DeletePartition(name); err != nil {
		logger.Error("Failed to delete partition %s: %v", name, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除分区配置失败: " + err.Error()})
		return
	}
	
	logger.Info("Partition %s deleted successfully", name)
	c.JSON(http.StatusOK, gin.H{"message": "分区配置删除成功"})
}

// GeneratePartitionConf 从数据库生成 partition.conf 配置文件
func GeneratePartitionConf(c *gin.Context) {
	partitions, err := models.GetAllPartitions()
	if err != nil {
		logger.Error("Failed to get partitions: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取分区配置失败"})
		return
	}
	
	if len(partitions) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "没有可用的分区配置"})
		return
	}
	
	// 生成配置文件内容
	var configLines []string
	configLines = append(configLines, "# Slurm Partition Configuration")
	configLines = append(configLines, "# Generated from database at "+fmt.Sprintf("%v", partitions[0].UpdatedAt))
	configLines = append(configLines, "")
	
	for _, p := range partitions {
		configLines = append(configLines, p.ToConfigLine())
	}
	
	configContent := strings.Join(configLines, "\n")
	
	// 获取配置文件路径
	confPath := os.Getenv("SLURM_PARTITION_CONF")
	if confPath == "" {
		confPath = "/etc/slurm/partition.conf"
	}
	
	// 写入配置文件
	if err := os.WriteFile(confPath, []byte(configContent), 0644); err != nil {
		logger.Error("Failed to write partition.conf: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "写入配置文件失败: " + err.Error()})
		return
	}
	
	logger.Info("Partition configuration file generated: %s", confPath)
	c.JSON(http.StatusOK, gin.H{
		"message": "配置文件生成成功",
		"path":    confPath,
		"content": configContent,
	})
}

// RestartSlurmService 重启 Slurm 服务
func RestartSlurmService(c *gin.Context) {
	// 获取服务名称
	serviceName := os.Getenv("SLURM_SERVICE_NAME")
	if serviceName == "" {
		serviceName = "slurmctld"
	}
	
	// 执行重启命令
	cmd := exec.Command("systemctl", "restart", serviceName)
	output, err := cmd.CombinedOutput()
	
	if err != nil {
		logger.Error("Failed to restart Slurm service: %v, output: %s", err, string(output))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "重启 Slurm 服务失败: " + err.Error(),
			"output": string(output),
		})
		return
	}
	
	logger.Info("Slurm service %s restarted successfully", serviceName)
	c.JSON(http.StatusOK, gin.H{
		"message": "Slurm 服务重启成功",
		"service": serviceName,
		"output":  string(output),
	})
}

// ReloadSlurmConfig 重新加载 Slurm 配置（不重启服务）
func ReloadSlurmConfig(c *gin.Context) {
	// 使用 scontrol reconfigure 命令
	cmd := exec.Command("scontrol", "reconfigure")
	output, err := cmd.CombinedOutput()
	
	if err != nil {
		logger.Error("Failed to reload Slurm config: %v, output: %s", err, string(output))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "重新加载配置失败: " + err.Error(),
			"output": string(output),
		})
		return
	}
	
	logger.Info("Slurm configuration reloaded successfully")
	c.JSON(http.StatusOK, gin.H{
		"message": "Slurm 配置重新加载成功",
		"output":  string(output),
	})
}

// ApplyPartitionConfig 应用分区配置（写入 partition.conf 并确保 slurm.conf 有 include）
func ApplyPartitionConfig(c *gin.Context) {
	// 1. 从数据库获取分区配置
	partitions, err := models.GetAllPartitions()
	if err != nil {
		logger.Error("Failed to get partitions: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取分区配置失败"})
		return
	}

	if len(partitions) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "没有可用的分区配置"})
		return
	}

	// 2. 生成 partition.conf 内容
	var lines []string
	lines = append(lines, "# Slurm Partition Configuration")
	lines = append(lines, "# Managed by ComputeNook - do not edit manually")
	lines = append(lines, "")
	for _, p := range partitions {
		lines = append(lines, p.ToConfigLine())
	}
	partitionContent := strings.Join(lines, "\n") + "\n"

	// 3. 写入 partition.conf
	partitionConf := os.Getenv("SLURM_PARTITION_CONF")
	if partitionConf == "" {
		partitionConf = "/etc/slurm/partition.conf"
	}
	if err := os.WriteFile(partitionConf, []byte(partitionContent), 0644); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "写入 partition.conf 失败: " + err.Error()})
		return
	}
	logger.Info("Partition config written to %s", partitionConf)

	// 4. 确保 slurm.conf 里有 include partition.conf
	slurmConf := os.Getenv("SLURM_CONF")
	if slurmConf == "" {
		slurmConf = "/etc/slurm/slurm.conf"
	}
	includeAdded := false
	includeLine := fmt.Sprintf("include %s", partitionConf)

	if raw, err := os.ReadFile(slurmConf); err == nil {
		content := string(raw)
		if !strings.Contains(content, includeLine) {
			// 去掉旧的 PartitionName 行（避免与 include 冲突）
			var kept []string
			for _, line := range strings.Split(content, "\n") {
				if strings.HasPrefix(strings.TrimSpace(line), "PartitionName=") {
					continue
				}
				kept = append(kept, line)
			}
			newContent := strings.TrimRight(strings.Join(kept, "\n"), "\n")
			newContent += "\n\n# Partition config managed by ComputeNook\n" + includeLine + "\n"
			if err := os.WriteFile(slurmConf, []byte(newContent), 0644); err != nil {
				logger.Warn("Failed to add include to slurm.conf: %v", err)
			} else {
				includeAdded = true
				logger.Info("Added include to slurm.conf: %s", includeLine)
			}
		}
	}

	// 5. 先 reconfigure 让 Slurm 读取新的 partition.conf，再 write config 持久化
	reconfOutput, reconfErr := exec.Command("scontrol", "reconfigure").CombinedOutput()
	writeOutput, writeErr := exec.Command("scontrol", "write", "config").CombinedOutput()

	msg := fmt.Sprintf("分区配置已写入 %s", partitionConf)
	if includeAdded {
		msg += fmt.Sprintf("，并在 %s 中添加了 include", slurmConf)
	}

	resp := gin.H{
		"message":        msg,
		"partition_conf": partitionConf,
		"content":        partitionContent,
		"partitions":     len(partitions),
		"reconfigure":    string(reconfOutput),
		"write_config":   string(writeOutput),
	}

	if reconfErr != nil {
		resp["reconfigure_error"] = reconfErr.Error()
		logger.Error("scontrol reconfigure failed: %v, output: %s", reconfErr, string(reconfOutput))
	}
	if writeErr != nil {
		resp["write_config_error"] = writeErr.Error()
		logger.Error("scontrol write config failed: %v, output: %s", writeErr, string(writeOutput))
	}

	c.JSON(http.StatusOK, resp)
}

// ExportPartitionConfigs 导出分区配置为 JSON
func ExportPartitionConfigs(c *gin.Context) {
	jsonData, err := models.ExportPartitionsToJSON()
	if err != nil {
		logger.Error("Failed to export partitions: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "导出配置失败"})
		return
	}
	
	// 设置下载文件名
	filename := fmt.Sprintf("partitions_%s.json", filepath.Base(os.Getenv("HOSTNAME")))
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Data(http.StatusOK, "application/json", []byte(jsonData))
}

// ImportPartitionConfigs 从 JSON 导入分区配置
func ImportPartitionConfigs(c *gin.Context) {
	var req struct {
		Data string `json:"data" binding:"required"`
	}
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求数据"})
		return
	}
	
	if err := models.ImportPartitionsFromJSON(req.Data); err != nil {
		logger.Error("Failed to import partitions: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "导入配置失败: " + err.Error()})
		return
	}
	
	logger.Info("Partitions imported successfully")
	c.JSON(http.StatusOK, gin.H{"message": "配置导入成功"})
}

// ImportFromConfFile 从 partition.conf 文件导入分区配置到数据库
func ImportFromConfFile(c *gin.Context) {
	confPath := os.Getenv("SLURM_PARTITION_CONF")
	if confPath == "" {
		confPath = "/etc/slurm/partition.conf"
	}

	n, err := models.ImportPartitionsFromConfFile(confPath)
	if err != nil {
		logger.Error("Failed to import from conf file: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "导入失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  fmt.Sprintf("成功导入 %d 个分区配置", n),
		"imported": n,
		"path":     confPath,
	})
}
