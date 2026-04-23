package models

import "time"

// HostIP 主机的一个 IP 地址条目
type HostIP struct {
	Address string `json:"address"` // IP 地址
	Type    string `json:"type"`    // 类型：管理口/业务口/IB口/BMC 等
}

// Host CMDB 主机记录
type Host struct {
	ID          string    `json:"id"`
	Hostname    string    `json:"hostname"`     // 主机名
	IPs         []HostIP  `json:"ips"`          // IP 列表（多个）
	OS          string    `json:"os"`           // 操作系统
	CPUModel    string    `json:"cpu_model"`    // CPU 型号
	CPUCores    int       `json:"cpu_cores"`    // CPU 核数
	MemoryGB    int       `json:"memory_gb"`    // 内存 GB
	DiskDesc    string    `json:"disk_desc"`    // 磁盘描述，如 "2×960GB SSD + 4×4TB HDD"
	Role        string    `json:"role"`         // 角色/用途：登录节点/计算节点/存储节点/管理节点
	Rack        string    `json:"rack"`         // 机柜编号
	RackUnit    string    `json:"rack_unit"`    // 机柜位置，如 "U12-U13"
	Status      string    `json:"status"`       // 状态：online/offline/maintenance
	Vendor      string    `json:"vendor"`       // 厂商
	Model       string    `json:"model"`        // 服务器型号
	SN          string    `json:"sn"`           // 序列号
	PurchaseDate string   `json:"purchase_date"` // 采购日期
	WarrantyDate string   `json:"warranty_date"` // 保修到期
	Remark      string    `json:"remark"`       // 备注
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
