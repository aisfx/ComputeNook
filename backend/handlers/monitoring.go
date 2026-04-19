package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"hpc-backend/logger"
)

// ─────────────────────────────────────────────
// Prometheus 客户端
// ─────────────────────────────────────────────

func getPrometheusURL() string {
	if v := os.Getenv("PROMETHEUS_URL"); v != "" {
		return strings.TrimRight(v, "/")
	}
	return ""
}

// promQuery 执行 instant query，返回第一个结果的 value
func promQuery(query string) (map[string]float64, error) {
	base := getPrometheusURL()
	if base == "" {
		return nil, fmt.Errorf("PROMETHEUS_URL not configured")
	}
	apiURL := base + "/api/v1/query?query=" + url.QueryEscape(query)
	resp, err := http.Get(apiURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var result struct {
		Status string `json:"status"`
		Data   struct {
			ResultType string `json:"resultType"`
			Result     []struct {
				Metric map[string]string `json:"metric"`
				Value  []interface{}     `json:"value"`
			} `json:"result"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	if result.Status != "success" {
		return nil, fmt.Errorf("prometheus query failed: %s", result.Status)
	}

	out := make(map[string]float64)
	for _, r := range result.Data.Result {
		// 用 instance 或 nodename 作为 key
		key := r.Metric["instance"]
		if n := r.Metric["nodename"]; n != "" {
			key = n
		}
		if n := r.Metric["node"]; n != "" {
			key = n
		}
		// 去掉端口
		if idx := strings.LastIndex(key, ":"); idx > 0 {
			key = key[:idx]
		}
		if len(r.Value) >= 2 {
			if s, ok := r.Value[1].(string); ok {
				if v, err := strconv.ParseFloat(s, 64); err == nil {
					out[key] = v
				}
			}
		}
	}
	return out, nil
}

// ─────────────────────────────────────────────
// NodeMetrics
// ─────────────────────────────────────────────

type NodeMetrics struct {
	Name        string    `json:"name"`
	Temperature float64   `json:"temperature"`
	Power       float64   `json:"power"`
	FanSpeed    float64   `json:"fan_speed"`
	Inlet       float64   `json:"inlet"`
	CPUUsage    float64   `json:"cpu_usage"`
	MemUsage    float64   `json:"mem_usage"`
	Timestamp   time.Time `json:"timestamp"`
	Source      string    `json:"source"` // "prometheus" | "simulated"
}

// GetNodeMetrics 从 Prometheus 查询节点温度/功耗，无 Prometheus 时用模拟数据
func GetNodeMetrics(c *gin.Context) {
	defer func() {
		if r := recover(); r != nil {
			logger.Warn("GetNodeMetrics panic recovered: %v", r)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "监控数据获取异常"})
		}
	}()
	_, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	username, _ := c.Get("username")
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

	promOK := getPrometheusURL() != ""
	var (
		tempMap, powerMap, fanMap, inletMap, cpuMap, memMap map[string]float64
	)

	if promOK {
		var wg sync.WaitGroup
		queries := []struct {
			// PromQL → 目标 map
			q string
			m *map[string]float64
		}{
			// node_exporter: CPU 温度（取 package 0）
			{`avg by (instance) (node_hwmon_temp_celsius{chip=~".*coretemp.*|.*k10temp.*",sensor="temp1"})`, &tempMap},
			// DCMI / IPMI exporter 功耗
			{`ipmi_power_watts`, &powerMap},
			// 风扇转速（取最大值）
			{`max by (instance) (node_hwmon_fan_rpm)`, &fanMap},
			// 进风口温度
			{`avg by (instance) (node_hwmon_temp_celsius{sensor="temp1_input",chip=~".*acpitz.*"})`, &inletMap},
			// CPU 使用率
			{`100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[2m])) * 100)`, &cpuMap},
			// 内存使用率
			{`100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)`, &memMap},
		}
		for i := range queries {
			wg.Add(1)
			go func(idx int) {
				defer wg.Done()
				defer func() {
					if r := recover(); r != nil {
						logger.Warn("Prometheus query panic recovered: %v", r)
					}
				}()
				m, err := promQuery(queries[idx].q)
				if err != nil {
					q := queries[idx].q
					if len(q) > 30 {
						q = q[:30]
					}
					logger.Warn("Prometheus query failed [%s]: %v", q, err)
					return
				}
				*queries[idx].m = m
			}(i)
		}
		wg.Wait()
	}

	metrics := make([]NodeMetrics, 0, len(nodes))
	for _, node := range nodes {
		m := NodeMetrics{Name: node.Name, Timestamp: time.Now()}

		if promOK && (tempMap != nil || cpuMap != nil) {
			m.Source = "prometheus"
			m.Temperature = lookupMetric(tempMap, node.Name)
			m.Power = lookupMetric(powerMap, node.Name)
			m.FanSpeed = lookupMetric(fanMap, node.Name)
			m.Inlet = lookupMetric(inletMap, node.Name)
			m.CPUUsage = lookupMetric(cpuMap, node.Name)
			m.MemUsage = lookupMetric(memMap, node.Name)
			// 温度为 0 说明没采集到，用模拟补充
			if m.Temperature == 0 {
				cpuPct := node.GetCPUUsagePercent()
				m.Temperature = 35 + cpuPct*0.45 + rand.Float64()*3
			}
			if m.Power == 0 {
				cpuPct := node.GetCPUUsagePercent()
				m.Power = 80 + cpuPct*2.2 + rand.Float64()*15
			}
		} else {
			m.Source = "simulated"
			cpuPct := node.GetCPUUsagePercent()
			m.CPUUsage = cpuPct
			m.MemUsage = node.GetMemoryUsagePercent()
			m.Temperature = 35 + cpuPct*0.45 + rand.Float64()*3
			m.Power = 80 + cpuPct*2.2 + rand.Float64()*15
			m.FanSpeed = 2000 + cpuPct*30 + rand.Float64()*200
			m.Inlet = 22 + rand.Float64()*4
		}
		metrics = append(metrics, m)
	}

	c.JSON(http.StatusOK, gin.H{"data": metrics, "prometheus": promOK})
}

// lookupMetric 在 map 中查找节点名（支持 hostname 和 IP 两种 key）
func lookupMetric(m map[string]float64, nodeName string) float64 {
	if m == nil {
		return 0
	}
	if v, ok := m[nodeName]; ok {
		return v
	}
	// 模糊匹配：map key 可能包含节点名
	for k, v := range m {
		if strings.Contains(k, nodeName) || strings.Contains(nodeName, k) {
			return v
		}
	}
	return 0
}

// ─────────────────────────────────────────────
// 机柜布局 — 持久化到文件
// ─────────────────────────────────────────────

type RackDevice struct {
	ID       string `json:"id"`
	Unit     int    `json:"unit"`    // 起始 U（从下往上，1=最底）
	Height   int    `json:"height"`  // 占用 U 数
	Name     string `json:"name"`    // 显示名称
	NodeName string `json:"node_name"` // 关联 Slurm 节点（可空）
	Type     string `json:"type"`    // compute|gpu|storage|switch|pdu|empty
	Model    string `json:"model"`
}

type RackLayout struct {
	ID       string       `json:"id"`
	Name     string       `json:"name"`
	Location string       `json:"location"` // 机房位置描述
	Units    int          `json:"units"`    // 机柜 U 数
	Devices  []RackDevice `json:"devices"`
}

var (
	rackMu      sync.RWMutex
	rackLayouts []RackLayout
	rackFile    = "rack_layout.json"
)

func loadRackFile() {
	rackMu.Lock()
	defer rackMu.Unlock()
	data, err := os.ReadFile(rackFile)
	if err != nil {
		rackLayouts = []RackLayout{}
		return
	}
	json.Unmarshal(data, &rackLayouts)
}

func saveRackFile() error {
	data, err := json.MarshalIndent(rackLayouts, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(rackFile, data, 0644)
}

func init() {
	loadRackFile()
}

// GetRackLayout GET /api/monitoring/rack
func GetRackLayout(c *gin.Context) {
	if _, exists := c.Get("username"); !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}
	rackMu.RLock()
	defer rackMu.RUnlock()
	c.JSON(http.StatusOK, gin.H{"data": rackLayouts})
}

// CreateRack POST /api/monitoring/rack
func CreateRack(c *gin.Context) {
	if _, exists := c.Get("username"); !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}
	var rack RackLayout
	if err := c.ShouldBindJSON(&rack); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if rack.Units == 0 {
		rack.Units = 42
	}
	rack.ID = fmt.Sprintf("rack-%d", time.Now().UnixMilli())
	if rack.Devices == nil {
		rack.Devices = []RackDevice{}
	}
	rackMu.Lock()
	rackLayouts = append(rackLayouts, rack)
	saveRackFile()
	rackMu.Unlock()
	c.JSON(http.StatusOK, gin.H{"data": rack})
}

// UpdateRack PUT /api/monitoring/rack/:id
func UpdateRack(c *gin.Context) {
	if _, exists := c.Get("username"); !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}
	id := c.Param("id")
	var rack RackLayout
	if err := c.ShouldBindJSON(&rack); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	rack.ID = id
	rackMu.Lock()
	defer rackMu.Unlock()
	for i, r := range rackLayouts {
		if r.ID == id {
			rackLayouts[i] = rack
			saveRackFile()
			c.JSON(http.StatusOK, gin.H{"data": rack})
			return
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"error": "机柜不存在"})
}

// DeleteRack DELETE /api/monitoring/rack/:id
func DeleteRack(c *gin.Context) {
	if _, exists := c.Get("username"); !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}
	id := c.Param("id")
	rackMu.Lock()
	defer rackMu.Unlock()
	for i, r := range rackLayouts {
		if r.ID == id {
			rackLayouts = append(rackLayouts[:i], rackLayouts[i+1:]...)
			saveRackFile()
			c.JSON(http.StatusOK, gin.H{"message": "已删除"})
			return
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"error": "机柜不存在"})
}

// AutoGenerateRacks POST /api/monitoring/rack/auto — 根据 Slurm 节点自动生成布局
func AutoGenerateRacks(c *gin.Context) {
	if _, exists := c.Get("username"); !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}
	username, _ := c.Get("username")
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

	const nodesPerRack = 20
	newRacks := []RackLayout{}

	for i := 0; i < len(nodes); i += nodesPerRack {
		rackIdx := i/nodesPerRack + 1
		rack := RackLayout{
			ID:       fmt.Sprintf("rack-%d", rackIdx),
			Name:     fmt.Sprintf("A%02d", rackIdx),
			Location: "数据中心",
			Units:    42,
			Devices:  []RackDevice{},
		}
		// 顶部交换机
		rack.Devices = append(rack.Devices,
			RackDevice{ID: fmt.Sprintf("sw-core-%d", rackIdx), Unit: 42, Height: 1, Name: "万兆交换机", Type: "switch", Model: "Cisco 9300"},
			RackDevice{ID: fmt.Sprintf("sw-acc-%d", rackIdx), Unit: 41, Height: 1, Name: "千兆交换机", Type: "switch", Model: "H3C S5130"},
		)
		// 底部 PDU
		rack.Devices = append(rack.Devices,
			RackDevice{ID: fmt.Sprintf("pdu1-%d", rackIdx), Unit: 1, Height: 1, Name: "PDU-01", Type: "pdu"},
			RackDevice{ID: fmt.Sprintf("pdu2-%d", rackIdx), Unit: 2, Height: 1, Name: "PDU-02", Type: "pdu"},
		)
		// 节点从 U39 往下
		unit := 39
		end := i + nodesPerRack
		if end > len(nodes) {
			end = len(nodes)
		}
		for _, node := range nodes[i:end] {
			devType := "compute"
			if strings.Contains(strings.ToLower(node.Gres), "gpu") {
				devType = "gpu"
			}
			rack.Devices = append(rack.Devices, RackDevice{
				ID:       "dev-" + node.Name,
				Unit:     unit,
				Height:   2,
				Name:     node.Name,
				NodeName: node.Name,
				Type:     devType,
			})
			unit -= 2
		}
		newRacks = append(newRacks, rack)
	}

	rackMu.Lock()
	rackLayouts = newRacks
	saveRackFile()
	rackMu.Unlock()

	c.JSON(http.StatusOK, gin.H{"data": newRacks, "message": fmt.Sprintf("已生成 %d 个机柜", len(newRacks))})
}

// ─────────────────────────────────────────────
// Prometheus 告警代理
// ─────────────────────────────────────────────

// GetPromAlerts GET /api/monitoring/prom-alerts
// 从 Prometheus /api/v1/alerts 拉取活跃告警并转发给前端
func GetPromAlerts(c *gin.Context) {
	if _, exists := c.Get("username"); !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	base := getPrometheusURL()
	if base == "" {
		c.JSON(http.StatusOK, gin.H{"connected": false, "alerts": []interface{}{}})
		return
	}

	resp, err := http.Get(base + "/api/v1/alerts")
	if err != nil {
		logger.Warn("Prometheus alerts fetch failed: %v", err)
		c.JSON(http.StatusOK, gin.H{"connected": false, "alerts": []interface{}{}})
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var result struct {
		Status string `json:"status"`
		Data   struct {
			Alerts []json.RawMessage `json:"alerts"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil || result.Status != "success" {
		c.JSON(http.StatusOK, gin.H{"connected": false, "alerts": []interface{}{}})
		return
	}

	// 只返回 state=firing 的告警
	firing := []json.RawMessage{}
	for _, raw := range result.Data.Alerts {
		var a struct {
			State string `json:"state"`
		}
		if json.Unmarshal(raw, &a) == nil && a.State == "firing" {
			firing = append(firing, raw)
		}
	}

	c.JSON(http.StatusOK, gin.H{"connected": true, "alerts": firing})
}

// ─────────────────────────────────────────────
// Prometheus Targets（节点采集状态）
// ─────────────────────────────────────────────

type PromTarget struct {
	Instance   string            `json:"instance"`
	Job        string            `json:"job"`
	Health     string            `json:"health"` // "up" | "down" | "unknown"
	Labels     map[string]string `json:"labels"`
	LastScrape string            `json:"last_scrape"`
	LastError  string            `json:"last_error"`
}

// GetPromTargets GET /api/monitoring/prom-targets
func GetPromTargets(c *gin.Context) {
	if _, exists := c.Get("username"); !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	base := getPrometheusURL()
	if base == "" {
		c.JSON(http.StatusOK, gin.H{"connected": false, "targets": []PromTarget{}})
		return
	}

	resp, err := http.Get(base + "/api/v1/targets?state=any")
	if err != nil {
		logger.Warn("Prometheus targets fetch failed: %v", err)
		c.JSON(http.StatusOK, gin.H{"connected": false, "targets": []PromTarget{}})
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var raw struct {
		Status string `json:"status"`
		Data   struct {
			ActiveTargets []struct {
				Labels          map[string]string `json:"labels"`
				DiscoveredLabels map[string]string `json:"discoveredLabels"`
				ScrapeURL       string            `json:"scrapeUrl"`
				Health          string            `json:"health"`
				LastScrape      string            `json:"lastScrape"`
				LastError       string            `json:"lastError"`
			} `json:"activeTargets"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &raw); err != nil || raw.Status != "success" {
		c.JSON(http.StatusOK, gin.H{"connected": false, "targets": []PromTarget{}})
		return
	}

	targets := make([]PromTarget, 0, len(raw.Data.ActiveTargets))
	for _, t := range raw.Data.ActiveTargets {
		instance := t.Labels["instance"]
		// 去掉端口，保留 hostname/IP
		host := instance
		if idx := strings.LastIndex(instance, ":"); idx > 0 {
			host = instance[:idx]
		}
		targets = append(targets, PromTarget{
			Instance:   host,
			Job:        t.Labels["job"],
			Health:     t.Health,
			Labels:     t.Labels,
			LastScrape: t.LastScrape,
			LastError:  t.LastError,
		})
	}

	c.JSON(http.StatusOK, gin.H{"connected": true, "targets": targets})
}

// ─────────────────────────────────────────────
// Prometheus 多指标查询（node_exporter）
// ─────────────────────────────────────────────

// NodeExporterMetrics 单节点全量指标
type NodeExporterMetrics struct {
	Instance   string  `json:"instance"`
	CPUUsage   float64 `json:"cpu_usage"`    // %
	MemUsage   float64 `json:"mem_usage"`    // %
	MemTotal   float64 `json:"mem_total_gb"` // GB
	MemFree    float64 `json:"mem_free_gb"`  // GB
	DiskUsage  float64 `json:"disk_usage"`   // % (root fs)
	DiskTotal  float64 `json:"disk_total_gb"`
	DiskFree   float64 `json:"disk_free_gb"`
	NetRxBytes float64 `json:"net_rx_bps"` // bytes/s
	NetTxBytes float64 `json:"net_tx_bps"` // bytes/s
	Load1      float64 `json:"load1"`
	Load5      float64 `json:"load5"`
	Uptime     float64 `json:"uptime_seconds"`
}

// GetNodeExporterMetrics GET /api/monitoring/node-metrics
// 从 Prometheus 批量查询所有 node_exporter 节点的 CPU/内存/磁盘/网络指标
func GetNodeExporterMetrics(c *gin.Context) {
	if _, exists := c.Get("username"); !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	base := getPrometheusURL()
	if base == "" {
		c.JSON(http.StatusOK, gin.H{"connected": false, "nodes": []interface{}{}})
		return
	}

	type queryDef struct {
		q   string
		key string
	}
	queries := []queryDef{
		{`100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[2m])) * 100)`, "cpu"},
		{`100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)`, "mem_pct"},
		{`node_memory_MemTotal_bytes / 1073741824`, "mem_total"},
		{`node_memory_MemAvailable_bytes / 1073741824`, "mem_free"},
		{`100 - (node_filesystem_avail_bytes{mountpoint="/",fstype!="tmpfs"} / node_filesystem_size_bytes{mountpoint="/",fstype!="tmpfs"} * 100)`, "disk_pct"},
		{`node_filesystem_size_bytes{mountpoint="/",fstype!="tmpfs"} / 1073741824`, "disk_total"},
		{`node_filesystem_avail_bytes{mountpoint="/",fstype!="tmpfs"} / 1073741824`, "disk_free"},
		{`rate(node_network_receive_bytes_total{device!~"lo|docker.*|veth.*"}[2m])`, "net_rx"},
		{`rate(node_network_transmit_bytes_total{device!~"lo|docker.*|veth.*"}[2m])`, "net_tx"},
		{`node_load1`, "load1"},
		{`node_load5`, "load5"},
		{`time() - node_boot_time_seconds`, "uptime"},
	}

	results := make(map[string]map[string]float64)
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, q := range queries {
		wg.Add(1)
		go func(qd queryDef) {
			defer wg.Done()
			m, err := promQuery(qd.q)
			if err != nil {
				return
			}
			mu.Lock()
			results[qd.key] = m
			mu.Unlock()
		}(q)
	}
	wg.Wait()

	// 收集所有 instance
	instanceSet := map[string]bool{}
	for _, m := range results {
		for k := range m {
			instanceSet[k] = true
		}
	}

	nodes := make([]NodeExporterMetrics, 0, len(instanceSet))
	for inst := range instanceSet {
		get := func(key string) float64 {
			if m, ok := results[key]; ok {
				if v, ok2 := m[inst]; ok2 {
					return v
				}
			}
			return 0
		}
		// net_rx/tx: sum across interfaces
		netRx := 0.0
		netTx := 0.0
		if m, ok := results["net_rx"]; ok {
			for k, v := range m {
				if strings.HasPrefix(k, inst) || k == inst {
					netRx += v
				}
			}
		}
		if m, ok := results["net_tx"]; ok {
			for k, v := range m {
				if strings.HasPrefix(k, inst) || k == inst {
					netTx += v
				}
			}
		}
		nodes = append(nodes, NodeExporterMetrics{
			Instance:   inst,
			CPUUsage:   get("cpu"),
			MemUsage:   get("mem_pct"),
			MemTotal:   get("mem_total"),
			MemFree:    get("mem_free"),
			DiskUsage:  get("disk_pct"),
			DiskTotal:  get("disk_total"),
			DiskFree:   get("disk_free"),
			NetRxBytes: netRx,
			NetTxBytes: netTx,
			Load1:      get("load1"),
			Load5:      get("load5"),
			Uptime:     get("uptime"),
		})
	}

	c.JSON(http.StatusOK, gin.H{"connected": true, "nodes": nodes})
}

// ─────────────────────────────────────────────
// Prometheus 告警规则代理
// ─────────────────────────────────────────────

// GetPromRules GET /api/monitoring/prom-rules
// 从 Prometheus /api/v1/rules 获取所有告警规则
func GetPromRules(c *gin.Context) {
	if _, exists := c.Get("username"); !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	base := getPrometheusURL()
	if base == "" {
		c.JSON(http.StatusOK, gin.H{"connected": false, "groups": []interface{}{}})
		return
	}

	resp, err := http.Get(base + "/api/v1/rules?type=alert")
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"connected": false, "groups": []interface{}{}, "error": err.Error()})
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var raw map[string]interface{}
	if err := json.Unmarshal(body, &raw); err != nil {
		c.JSON(http.StatusOK, gin.H{"connected": false, "groups": []interface{}{}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"connected": true, "data": raw})
}

// ─────────────────────────────────────────────
// 本机状态（运行后端服务的主机）
// ─────────────────────────────────────────────

// LocalHostMetrics 本机实时指标
type LocalHostMetrics struct {
	Hostname   string  `json:"hostname"`
	CPUUsage   float64 `json:"cpu_usage"`
	MemUsage   float64 `json:"mem_usage"`
	MemTotalGB float64 `json:"mem_total_gb"`
	MemUsedGB  float64 `json:"mem_used_gb"`
	DiskUsage  float64 `json:"disk_usage"`
	DiskTotalGB float64 `json:"disk_total_gb"`
	DiskUsedGB  float64 `json:"disk_used_gb"`
	NetRxBps   float64 `json:"net_rx_bps"`
	NetTxBps   float64 `json:"net_tx_bps"`
	Load1      float64 `json:"load1"`
	Load5      float64 `json:"load5"`
	Load15     float64 `json:"load15"`
	UptimeSecs float64 `json:"uptime_seconds"`
	Connected  bool    `json:"connected"`
}

// GetLocalMetrics GET /api/monitoring/local-metrics
// 从 Prometheus 查询本机（后端所在主机）的 node_exporter 指标
func GetLocalMetrics(c *gin.Context) {
	if _, exists := c.Get("username"); !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	hostname, _ := os.Hostname()
	base := getPrometheusURL()

	result := LocalHostMetrics{Hostname: hostname, Connected: false}

	if base == "" {
		c.JSON(http.StatusOK, result)
		return
	}

	// 尝试用 hostname 匹配，也尝试 localhost/127.0.0.1
	// node_exporter 的 instance label 通常是 hostname:9100
	type qdef struct {
		q   string
		key string
	}
	queries := []qdef{
		{`100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[2m])) * 100)`, "cpu"},
		{`100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)`, "mem_pct"},
		{`node_memory_MemTotal_bytes / 1073741824`, "mem_total"},
		{`(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / 1073741824`, "mem_used"},
		{`100 - (node_filesystem_avail_bytes{mountpoint="/",fstype!="tmpfs"} / node_filesystem_size_bytes{mountpoint="/",fstype!="tmpfs"} * 100)`, "disk_pct"},
		{`node_filesystem_size_bytes{mountpoint="/",fstype!="tmpfs"} / 1073741824`, "disk_total"},
		{`(node_filesystem_size_bytes{mountpoint="/",fstype!="tmpfs"} - node_filesystem_avail_bytes{mountpoint="/",fstype!="tmpfs"}) / 1073741824`, "disk_used"},
		{`sum by (instance) (rate(node_network_receive_bytes_total{device!~"lo|docker.*|veth.*"}[2m]))`, "net_rx"},
		{`sum by (instance) (rate(node_network_transmit_bytes_total{device!~"lo|docker.*|veth.*"}[2m]))`, "net_tx"},
		{`node_load1`, "load1"},
		{`node_load5`, "load5"},
		{`node_load15`, "load15"},
		{`time() - node_boot_time_seconds`, "uptime"},
	}

	maps := make(map[string]map[string]float64)
	var mu sync.Mutex
	var wg sync.WaitGroup
	for _, q := range queries {
		wg.Add(1)
		go func(qd qdef) {
			defer wg.Done()
			m, err := promQuery(qd.q)
			if err != nil {
				return
			}
			mu.Lock()
			maps[qd.key] = m
			mu.Unlock()
		}(q)
	}
	wg.Wait()

	// 查找本机对应的 instance key
	// 优先匹配 hostname，其次匹配 localhost/127.0.0.1
	findVal := func(key string) (float64, string) {
		m, ok := maps[key]
		if !ok || len(m) == 0 {
			return 0, ""
		}
		candidates := []string{hostname, "localhost", "127.0.0.1"}
		for _, cand := range candidates {
			for k, v := range m {
				if strings.Contains(strings.ToLower(k), strings.ToLower(cand)) {
					return v, k
				}
			}
		}
		// 如果只有一个节点，直接用它
		if len(m) == 1 {
			for k, v := range m {
				return v, k
			}
		}
		return 0, ""
	}

	cpu, instKey := findVal("cpu")
	if instKey != "" {
		result.Connected = true
		result.CPUUsage = cpu
		result.MemUsage, _ = findVal("mem_pct")
		result.MemTotalGB, _ = findVal("mem_total")
		result.MemUsedGB, _ = findVal("mem_used")
		result.DiskUsage, _ = findVal("disk_pct")
		result.DiskTotalGB, _ = findVal("disk_total")
		result.DiskUsedGB, _ = findVal("disk_used")
		result.NetRxBps, _ = findVal("net_rx")
		result.NetTxBps, _ = findVal("net_tx")
		result.Load1, _ = findVal("load1")
		result.Load5, _ = findVal("load5")
		result.Load15, _ = findVal("load15")
		result.UptimeSecs, _ = findVal("uptime")
		// 用实际匹配到的 instance 作为 hostname 显示
		result.Hostname = strings.TrimSuffix(instKey, ":9100")
		result.Hostname = strings.TrimSuffix(result.Hostname, ":9101")
	}

	c.JSON(http.StatusOK, result)
}

// ─────────────────────────────────────────────
// PromQL 直接查询接口
// ─────────────────────────────────────────────

// PromQueryInstant  GET /api/monitoring/promql?query=xxx
func PromQueryInstant(c *gin.Context) {
	query := c.Query("query")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query is required"})
		return
	}
	base := getPrometheusURL()
	if base == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "PROMETHEUS_URL not configured"})
		return
	}
	apiURL := base + "/api/v1/query?query=" + url.QueryEscape(query)
	resp, err := http.Get(apiURL)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	c.Data(resp.StatusCode, "application/json", body)
}

// PromQueryRange  GET /api/monitoring/promql/range?query=xxx&start=xxx&end=xxx&step=xxx
func PromQueryRange(c *gin.Context) {
	query := c.Query("query")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query is required"})
		return
	}
	base := getPrometheusURL()
	if base == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "PROMETHEUS_URL not configured"})
		return
	}
	start := c.DefaultQuery("start", fmt.Sprintf("%d", time.Now().Add(-1*time.Hour).Unix()))
	end := c.DefaultQuery("end", fmt.Sprintf("%d", time.Now().Unix()))
	step := c.DefaultQuery("step", "60")

	apiURL := fmt.Sprintf("%s/api/v1/query_range?query=%s&start=%s&end=%s&step=%s",
		base, url.QueryEscape(query), start, end, step)
	resp, err := http.Get(apiURL)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	c.Data(resp.StatusCode, "application/json", body)
}
