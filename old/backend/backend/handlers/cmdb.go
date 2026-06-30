package handlers

import (
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
	"hpc-backend/models"
)

// ── 内存存储（与 rack_layout.json 同样的模式，持久化到文件）──────

var (
	cmdbMu    sync.RWMutex
	cmdbHosts []models.Host
	cmdbFile  = "cmdb_hosts.json"
)

func init() {
	loadCMDB()
}

func loadCMDB() {
	cmdbMu.Lock()
	defer cmdbMu.Unlock()
	data, err := os.ReadFile(cmdbFile)
	if err != nil {
		cmdbHosts = []models.Host{}
		return
	}
	json.Unmarshal(data, &cmdbHosts)
}

func saveCMDB() error {
	data, err := json.MarshalIndent(cmdbHosts, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(cmdbFile, data, 0644)
}

func newHostID() string {
	return fmt.Sprintf("host-%d", time.Now().UnixMilli())
}

// GET /api/cmdb/hosts
func GetHosts(c *gin.Context) {
	cmdbMu.RLock()
	defer cmdbMu.RUnlock()

	// 支持简单过滤
	keyword := strings.ToLower(c.Query("q"))
	role := c.Query("role")
	status := c.Query("status")

	result := make([]models.Host, 0, len(cmdbHosts))
	for _, h := range cmdbHosts {
		if role != "" && h.Role != role {
			continue
		}
		if status != "" && h.Status != status {
			continue
		}
		if keyword != "" {
			hit := strings.Contains(strings.ToLower(h.Hostname), keyword) ||
				strings.Contains(strings.ToLower(h.Remark), keyword) ||
				strings.Contains(strings.ToLower(h.Rack), keyword)
			if !hit {
				for _, ip := range h.IPs {
					if strings.Contains(ip.Address, keyword) {
						hit = true
						break
					}
				}
			}
			if !hit {
				continue
			}
		}
		result = append(result, h)
	}
	c.JSON(http.StatusOK, gin.H{"data": result, "total": len(result)})
}

// POST /api/cmdb/hosts
func CreateHost(c *gin.Context) {
	var h models.Host
	if err := c.ShouldBindJSON(&h); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.ID = newHostID()
	h.CreatedAt = time.Now()
	h.UpdatedAt = time.Now()
	if h.Status == "" {
		h.Status = "online"
	}
	cmdbMu.Lock()
	cmdbHosts = append(cmdbHosts, h)
	saveCMDB()
	cmdbMu.Unlock()
	c.JSON(http.StatusOK, gin.H{"data": h})
}

// PUT /api/cmdb/hosts/:id
func UpdateHost(c *gin.Context) {
	id := c.Param("id")
	var h models.Host
	if err := c.ShouldBindJSON(&h); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	cmdbMu.Lock()
	defer cmdbMu.Unlock()
	for i, host := range cmdbHosts {
		if host.ID == id {
			h.ID = id
			h.CreatedAt = host.CreatedAt
			h.UpdatedAt = time.Now()
			cmdbHosts[i] = h
			saveCMDB()
			c.JSON(http.StatusOK, gin.H{"data": h})
			return
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"error": "主机不存在"})
}

// DELETE /api/cmdb/hosts/:id
func DeleteHost(c *gin.Context) {
	id := c.Param("id")
	cmdbMu.Lock()
	defer cmdbMu.Unlock()
	for i, h := range cmdbHosts {
		if h.ID == id {
			cmdbHosts = append(cmdbHosts[:i], cmdbHosts[i+1:]...)
			saveCMDB()
			c.JSON(http.StatusOK, gin.H{"message": "已删除"})
			return
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"error": "主机不存在"})
}

// POST /api/cmdb/hosts/import  — Excel 导入
func ImportHosts(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请上传 Excel 文件"})
		return
	}
	if ext := strings.ToLower(filepath.Ext(file.Filename)); ext != ".xlsx" && ext != ".xls" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "仅支持 .xlsx / .xls 格式"})
		return
	}

	f, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "文件读取失败"})
		return
	}
	defer f.Close()

	hosts, errs := parseExcel(f)
	if len(errs) > 0 && len(hosts) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": strings.Join(errs, "; ")})
		return
	}

	now := time.Now()
	cmdbMu.Lock()
	imported := 0
	skipped := 0
	for _, h := range hosts {
		// 按主机名去重，已存在则更新
		found := false
		for i, existing := range cmdbHosts {
			if existing.Hostname == h.Hostname {
				h.ID = existing.ID
				h.CreatedAt = existing.CreatedAt
				h.UpdatedAt = now
				cmdbHosts[i] = h
				found = true
				skipped++
				break
			}
		}
		if !found {
			h.ID = newHostID()
			h.CreatedAt = now
			h.UpdatedAt = now
			cmdbHosts = append(cmdbHosts, h)
			imported++
		}
	}
	saveCMDB()
	cmdbMu.Unlock()

	msg := fmt.Sprintf("导入成功：新增 %d 条，更新 %d 条", imported, skipped)
	if len(errs) > 0 {
		msg += fmt.Sprintf("，跳过 %d 行（%s）", len(errs), strings.Join(errs, "; "))
	}
	c.JSON(http.StatusOK, gin.H{"message": msg, "imported": imported, "updated": skipped})
}

// GET /api/cmdb/hosts/template  — 下载导入模板
func DownloadTemplate(c *gin.Context) {
	f := excelize.NewFile()
	sheet := "主机信息"
	f.NewSheet(sheet)
	f.DeleteSheet("Sheet1")

	headers := []string{
		"主机名*", "IP地址(多个用逗号分隔)*", "IP类型(对应IP,逗号分隔)",
		"操作系统", "CPU型号", "CPU核数", "内存(GB)", "磁盘描述",
		"角色/用途", "机柜编号", "机柜位置", "状态", "厂商", "服务器型号",
		"序列号", "采购日期", "保修到期", "备注",
	}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, h)
	}

	// 示例行
	example := []interface{}{
		"cn001", "192.168.1.1,10.0.0.1", "业务口,管理口",
		"CentOS 7.9", "Intel Xeon Gold 6248R", 40, 256, "2×960GB SSD",
		"计算节点", "A01", "U12-U13", "online", "浪潮", "NF5280M6",
		"SN123456", "2023-01-01", "2026-01-01", "备注信息",
	}
	for i, v := range example {
		cell, _ := excelize.CoordinatesToCellName(i+1, 2)
		f.SetCellValue(sheet, cell, v)
	}

	// 设置列宽
	for i := range headers {
		col, _ := excelize.ColumnNumberToName(i + 1)
		f.SetColWidth(sheet, col, col, 18)
	}

	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", "attachment; filename=cmdb_template.xlsx")
	f.Write(c.Writer)
}

// GET /api/cmdb/hosts/export  — 导出全部
func ExportHosts(c *gin.Context) {
	cmdbMu.RLock()
	hosts := make([]models.Host, len(cmdbHosts))
	copy(hosts, cmdbHosts)
	cmdbMu.RUnlock()

	f := excelize.NewFile()
	sheet := "主机信息"
	f.NewSheet(sheet)
	f.DeleteSheet("Sheet1")

	headers := []string{
		"主机名", "IP地址", "IP类型", "操作系统", "CPU型号", "CPU核数",
		"内存(GB)", "磁盘描述", "角色/用途", "机柜编号", "机柜位置",
		"状态", "厂商", "服务器型号", "序列号", "采购日期", "保修到期", "备注",
	}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, h)
	}

	for row, h := range hosts {
		ips := make([]string, len(h.IPs))
		ipTypes := make([]string, len(h.IPs))
		for i, ip := range h.IPs {
			ips[i] = ip.Address
			ipTypes[i] = ip.Type
		}
		vals := []interface{}{
			h.Hostname, strings.Join(ips, ","), strings.Join(ipTypes, ","),
			h.OS, h.CPUModel, h.CPUCores, h.MemoryGB, h.DiskDesc,
			h.Role, h.Rack, h.RackUnit, h.Status, h.Vendor, h.Model,
			h.SN, h.PurchaseDate, h.WarrantyDate, h.Remark,
		}
		for col, v := range vals {
			cell, _ := excelize.CoordinatesToCellName(col+1, row+2)
			f.SetCellValue(sheet, cell, v)
		}
	}

	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", "attachment; filename=cmdb_hosts.xlsx")
	f.Write(c.Writer)
}

// parseExcel 解析 Excel 文件，返回主机列表和错误列表
func parseExcel(f multipart.File) ([]models.Host, []string) {
	xlsx, err := excelize.OpenReader(f)
	if err != nil {
		return nil, []string{"Excel 解析失败: " + err.Error()}
	}

	sheets := xlsx.GetSheetList()
	if len(sheets) == 0 {
		return nil, []string{"Excel 无工作表"}
	}
	sheet := sheets[0]

	rows, err := xlsx.GetRows(sheet)
	if err != nil || len(rows) < 2 {
		return nil, []string{"Excel 内容为空或格式错误"}
	}

	var hosts []models.Host
	var errs []string

	for i, row := range rows[1:] { // 跳过表头
		lineNum := i + 2
		get := func(col int) string {
			if col < len(row) {
				return strings.TrimSpace(row[col])
			}
			return ""
		}

		hostname := get(0)
		if hostname == "" {
			errs = append(errs, fmt.Sprintf("第%d行：主机名为空，已跳过", lineNum))
			continue
		}

		// 解析多 IP
		ipStrs := strings.Split(get(1), ",")
		ipTypes := strings.Split(get(2), ",")
		var ips []models.HostIP
		for j, addr := range ipStrs {
			addr = strings.TrimSpace(addr)
			if addr == "" {
				continue
			}
			ipType := "业务口"
			if j < len(ipTypes) && strings.TrimSpace(ipTypes[j]) != "" {
				ipType = strings.TrimSpace(ipTypes[j])
			}
			ips = append(ips, models.HostIP{Address: addr, Type: ipType})
		}

		cores, _ := strconv.Atoi(get(5))
		mem, _ := strconv.Atoi(get(6))
		status := get(11)
		if status == "" {
			status = "online"
		}

		hosts = append(hosts, models.Host{
			Hostname:     hostname,
			IPs:          ips,
			OS:           get(3),
			CPUModel:     get(4),
			CPUCores:     cores,
			MemoryGB:     mem,
			DiskDesc:     get(7),
			Role:         get(8),
			Rack:         get(9),
			RackUnit:     get(10),
			Status:       status,
			Vendor:       get(12),
			Model:        get(13),
			SN:           get(14),
			PurchaseDate: get(15),
			WarrantyDate: get(16),
			Remark:       get(17),
		})
	}
	return hosts, errs
}
