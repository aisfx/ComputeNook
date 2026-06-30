# 数据模型参考

## SQLite/MySQL 数据库（models/ 包）

数据库初始化入口：`models.InitDatabase()`
数据库文件路径：`DB_PATH=./data/computenook.db`（SQLite）

### 用户相关（LDAP，不存数据库）

```go
// models/user.go
type User struct {
    Username           string   `json:"username"`
    UID                int      `json:"uid"`
    GID                int      `json:"gid"`
    CNName             string   `json:"cnName"`
    Email              string   `json:"email"`
    Phone              string   `json:"phone"`
    Shell              string   `json:"shell"`
    HomeDir            string   `json:"homeDir"`
    Password           string   `json:"password,omitempty"`
    Groups             []string `json:"groups"`
    IsAdmin            bool     `json:"isAdmin"`
    Disabled           bool     `json:"disabled"`
    PasswordMustChange bool     `json:"passwordMustChange"`
}

type Group struct {
    GroupName string   `json:"groupName"`
    GID       int      `json:"gid"`
    Members   []string `json:"members"`
}
```

### 分区配置（存数据库）

```go
// models/partition.go
type PartitionConfig struct {
    ID          int    `json:"id"`
    Name        string `json:"name"`
    Nodes       string `json:"nodes"`       // 节点列表，如 "node[1-10]"
    MaxTime     string `json:"max_time"`    // "UNLIMITED" 或 "1-00:00:00"
    DefaultTime string `json:"default_time"`
    State       string `json:"state"`       // "UP" | "DOWN" | "DRAIN"
    Default     bool   `json:"default"`
    Hidden      bool   `json:"hidden"`
    Shared      string `json:"shared"`
    MaxNodes    int    `json:"max_nodes"`
    MinNodes    int    `json:"min_nodes"`
    MaxCPUsPerNode int `json:"max_cpus_per_node"`
    ExtraConfig string `json:"extra_config"` // 额外 slurm 配置行
    CreatedAt   string `json:"created_at"`
    UpdatedAt   string `json:"updated_at"`
}
```

### 机时计费（存数据库）

```go
// models/billing.go
type BillingAccount struct {
    ID          int     `json:"id"`
    Account     string  `json:"account"`     // Slurm 账户名
    QoSName     string  `json:"qos_name"`
    TotalMins   int64   `json:"total_mins"`  // 总配额（分钟）
    UsedMins    int64   `json:"used_mins"`   // 已使用（分钟）
    RemainMins  int64   `json:"remain_mins"` // 剩余
    UpdatedAt   string  `json:"updated_at"`
}

type BillingRecord struct {
    ID        int    `json:"id"`
    Account   string `json:"account"`
    User      string `json:"user"`
    JobID     int    `json:"job_id"`
    QoSName   string `json:"qos_name"`
    BillingMins int64 `json:"billing_mins"`
    StartTime string `json:"start_time"`
    EndTime   string `json:"end_time"`
}

type RechargeRecord struct {
    ID        int    `json:"id"`
    Account   string `json:"account"`
    QoSName   string `json:"qos_name"`
    Amount    int64  `json:"amount"`     // 充值分钟数
    Notes     string `json:"notes"`
    Operator  string `json:"operator"`
    CreatedAt string `json:"created_at"`
}
```

### 审计日志（存数据库）

```go
// models/audit.go
type AuditLog struct {
    ID         int    `json:"id"`
    Username   string `json:"username"`
    Action     string `json:"action"`      // CREATE_USER, DELETE_JOB 等
    Resource   string `json:"resource"`    // 资源类型
    ResourceID string `json:"resource_id"` // 资源 ID
    Detail     string `json:"detail"`      // JSON 详情
    IP         string `json:"ip"`
    UserAgent  string `json:"user_agent"`
    Status     int    `json:"status"`      // HTTP 状态码
    CreatedAt  string `json:"created_at"`
}
```

### MFA（存数据库）

```go
// models/mfa.go
type MFARecord struct {
    ID        int    `json:"id"`
    Username  string `json:"username"`
    Secret    string `json:"-"`         // TOTP 密钥（不对外暴露）
    Enabled   bool   `json:"enabled"`
    CreatedAt string `json:"created_at"`
    UpdatedAt string `json:"updated_at"`
}
```

### 作业应用模板（存数据库）

```go
// models/app_template.go
type AppTemplate struct {
    ID          int    `json:"id"`
    Name        string `json:"name"`
    Description string `json:"description"`
    Category    string `json:"category"`   // gpu, mpi, python 等
    Icon        string `json:"icon"`
    Script      string `json:"script"`     // Slurm 作业脚本模板
    Params      string `json:"params"`     // JSON 参数定义
    IsPublic    bool   `json:"is_public"`
    Creator     string `json:"creator"`
    CreatedAt   string `json:"created_at"`
}
```

### CMDB 主机资产（存数据库）

```go
// models/cmdb.go
type Host struct {
    ID          int    `json:"id"`
    Hostname    string `json:"hostname"`
    IP          string `json:"ip"`
    Role        string `json:"role"`        // login, compute, storage, mgmt
    CPU         string `json:"cpu"`
    Memory      string `json:"memory"`
    Disk        string `json:"disk"`
    GPU         string `json:"gpu"`
    OS          string `json:"os"`
    Status      string `json:"status"`      // online, offline, maintenance
    RackID      int    `json:"rack_id"`
    RackUnit    int    `json:"rack_unit"`
    Description string `json:"description"`
    CreatedAt   string `json:"created_at"`
    UpdatedAt   string `json:"updated_at"`
}
```

## Slurm 数据模型（slurm/ 包）

### QoS 完整结构

```go
type QoS struct {
    Name        string      // QoS 名称（唯一）
    Description string
    ID          int
    Priority    interface{} // int 或 {"set":true,"number":100}
    Flags       interface{} // []string 或对象

    // Slurm v0.0.43+ 嵌套结构（读取时填充）
    Limits struct {
        Max struct {
            ActiveJobs struct { Count LimitValue }
            Jobs struct {
                Per struct { User LimitValue; Account LimitValue }
            }
            TRES struct {
                Total   []TRESItem
                Per struct { User []TRESItem; Job []TRESItem; ... }
                Minutes struct {
                    Total []TRESItem  // billing 配额在这里
                }
            }
            WallClock struct {
                Per struct { Job LimitValue }
            }
        }
    }

    // 前端发送字段（写入时使用）
    MaxJobs     interface{} // max_jobs_pu
    MaxSubmit   interface{} // max_submit_pu
    MaxWallPU   interface{} // max_wall_pu（分钟）
    MaxNodes    interface{} // max_nodes_pu
    MaxCPUs     interface{} // max_cpus_pu
    MaxGPUs     interface{} // max_gpus_pu（独立字段）
    MaxTRES     string      // max_tres_pu，如 "gres/gpu=4,mem=256G"
    MaxWall     interface{} // max_wall_pj（分钟）
    GrpTRESMins string      // grp_tres_mins，billing 机时（分钟字符串）
    MinCPUs     interface{} // min_cpus_pj
    MinNodes    interface{} // min_nodes_pj
    MinTRES     string      // min_tres_pj

    // 抢占
    Preempt           interface{} // []string（发送）或对象（接收）
    PreemptMode       string      // off/suspend/requeue/cancel
    PreemptExemptTime int         // 秒

    // 使用因子
    UsageFactor    interface{} // float64
    UsageThreshold interface{} // float64，0~1
}

type LimitValue struct {
    Set      bool
    Infinite bool
    Number   int
}

type TRESItem struct {
    Type  string  // "cpu","mem","node","gres/gpu","billing"
    Name  string
    ID    int     // 1=cpu,2=mem,4=node,5=billing,6=gres/gpu
    Count int64
}
```

### Slurm Job 结构（部分）

```go
type Job struct {
    JobID       int    `json:"job_id"`
    Name        string `json:"name"`
    User        string `json:"user_name"`
    Account     string `json:"account"`
    QoS         string `json:"qos"`
    Partition   string `json:"partition"`
    State       string `json:"job_state"`  // PENDING/RUNNING/COMPLETED/FAILED/CANCELLED
    Nodes       string `json:"nodes"`
    NumCPUs     int    `json:"num_cpus"`
    TimeLimit   int    `json:"time_limit"` // 分钟
    SubmitTime  int64  `json:"submit_time"`
    StartTime   int64  `json:"start_time"`
    EndTime     int64  `json:"end_time"`
    WorkDir     string `json:"current_working_directory"`
    StdOut      string `json:"standard_output"`
    StdErr      string `json:"standard_error"`
    Comment     string `json:"comment"`
    ExitCode    struct { ReturnCode int } `json:"exit_code"`
}
```

### Slurm Node 结构（部分）

```go
type Node struct {
    Name          string   `json:"name"`
    State         []string `json:"state"`   // IDLE/ALLOCATED/DOWN/DRAIN
    CPUTot        int      `json:"cpus"`
    CPULoad       float64  `json:"cpu_load"`
    RealMemory    int64    `json:"real_memory"`   // MB
    FreeMemory    int64    `json:"free_memory"`
    Partitions    []string `json:"partitions"`
    Gres          string   `json:"gres"`    // "gpu:4"
    GresUsed      string   `json:"gres_used"`
    OS            string   `json:"operating_system"`
    Version       string   `json:"architecture"`
}
```

## Redis 缓存键前缀（cache/keys.go）

| 前缀常量 | 值 | 缓存时间 |
|---------|-----|---------|
| PrefixUser | "user:" | 3分钟 |
| PrefixGroup | "group:" | 5分钟 |
| PrefixQoS | "qos:" | 5分钟 |
| PrefixSlurmAccount | "slurm_account:" | 2分钟 |
| PrefixSlurmUser | "slurm_user:" | 2分钟 |
| PrefixAssociation | "association:" | 3分钟 |
| PrefixPartition | "partition:" | 5分钟 |
| PrefixDashboard | "dashboard:" | 30秒 |
| PrefixMonitoring | "monitoring:" | 15秒 |
| PrefixNode | "node:" | 2分钟 |
| PrefixBilling | "billing:" | 2分钟 |
| PrefixQuota | "quota:" | 2分钟 |
| PrefixDesktop | "desktop:" | 10分钟 |
| PrefixAppTemplate | "app_template:" | 10分钟 |
| PrefixRegistry | "registry:" | 2~5分钟 |
| PrefixCMDB | "cmdb:" | 5分钟 |

缓存管理：
```go
mgr := cache.NewManager()
mgr.DeletePattern(cache.PrefixQoS + "*")  // 清除所有 QoS 缓存
```

## LDAP 结构

连接配置（通过环境变量）：
- `LDAP_HOST` / `LDAP_PORT`
- `LDAP_BIND_DN` + `LDAP_BIND_PASSWORD`
- `LDAP_BASE_DN`
- `LDAP_USER_BASE_DN`（如 `ou=people,dc=example,dc=com`）
- `LDAP_GROUP_BASE_DN`（如 `ou=group,dc=example,dc=com`）

用户 objectClass：`inetOrgPerson` + `posixAccount` + `shadowAccount`

关键属性映射：
| LDAP 属性 | Go 字段 |
|-----------|---------|
| uid | Username |
| uidNumber | UID |
| gidNumber | GID |
| cn | CNName |
| mail | Email |
| mobile | Phone |
| loginShell | Shell |
| homeDirectory | HomeDir |
| memberOf / isMemberOf | Groups |
| shadowExpire=-1 | Disabled=true |

管理员判断：用户属于 `adminGroup`（环境变量 `LDAP_ADMIN_GROUP`，默认 `admins`）

## 远程桌面会话模型（内存/SQLite）

```go
type DesktopSession struct {
    ID          int    `json:"id"`
    Username    string `json:"username"`
    JobID       int    `json:"job_id"`    // Slurm 作业 ID
    NodeName    string `json:"node_name"` // 分配的计算节点
    VNCPort     int    `json:"vnc_port"`
    XpraPort    int    `json:"xpra_port"`
    Status      string `json:"status"`   // pending/running/stopped/failed
    DisplayType string `json:"display_type"` // vnc/xpra
    Partition   string `json:"partition"`
    CPUs        int    `json:"cpus"`
    Memory      string `json:"memory"`
    GPUs        int    `json:"gpus"`
    TimeLimit   int    `json:"time_limit"`
    CreatedAt   string `json:"created_at"`
    StartedAt   string `json:"started_at"`
}
```

## WebShell 会话模型（内存管理）

```go
// webshell/session_manager.go
type Session struct {
    ID        string
    Username  string
    NodeName  string
    Host      string
    Port      int
    Client    *ssh.Client
    Logger    *SessionLogger
    CreatedAt time.Time
}
```
