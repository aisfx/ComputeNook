# Slurm QoS 资源限制改进说明

## 概述

本次改进增强了 Slurm QoS (Quality of Service) 的功能，支持更细粒度的资源控制、作业抢占、优先级管理等高级特性。

## 新增功能

### 1. 最小资源要求 (Minimum Limits)

允许为 QoS 设置最小资源要求，确保作业至少使用指定的资源量：

- **MinCPUs** (`min_cpus_pj`): 每作业最小 CPU 核心数
- **MinNodes** (`min_nodes_pj`): 每作业最小节点数
- **MinTRES** (`min_tres_pj`): 每作业最小 TRES 资源（如内存、GPU）

**使用场景**：
- 防止用户提交过小的作业占用调度资源
- 确保特定 QoS 的作业使用足够的资源以提高效率
- 强制 GPU 作业至少使用一定数量的 GPU

**示例**：
```json
{
  "name": "gpu-qos",
  "min_cpus_pj": 4,
  "min_nodes_pj": 1,
  "min_tres_pj": "gres/gpu=1,mem=16G"
}
```

### 2. 作业抢占 (Preemption)

支持高优先级 QoS 抢占低优先级 QoS 的作业：

- **Preempt** (`preempt`): 可以抢占的 QoS 列表
- **PreemptMode** (`preempt_mode`): 抢占模式
  - `off`: 不抢占（默认）
  - `suspend`: 挂起被抢占的作业
  - `requeue`: 重新排队被抢占的作业
  - `cancel`: 取消被抢占的作业
- **PreemptExemptTime** (`preempt_exempt_time`): 抢占豁免时间（秒），作业运行超过此时间后不会被抢占

**使用场景**：
- 紧急作业需要立即运行
- 高优先级用户需要优先获得资源
- 实现多级优先级调度策略

**示例**：
```json
{
  "name": "urgent",
  "priority": 1000,
  "preempt": ["normal", "low"],
  "preempt_mode": "requeue",
  "preempt_exempt_time": 3600
}
```

### 3. 使用因子 (Usage Factor)

控制 QoS 对公平共享调度的影响：

- **UsageFactor** (`usage_factor`): 使用因子，默认 1.0
  - 值 > 1.0: 作业消耗更多的公平共享资源
  - 值 < 1.0: 作业消耗更少的公平共享资源
- **UsageThreshold** (`usage_threshold`): 使用阈值（0-1），超过此阈值后作业优先级降低

**使用场景**：
- 鼓励使用特定 QoS（设置较低的 usage_factor）
- 限制某些 QoS 的过度使用
- 实现更复杂的公平共享策略

**示例**：
```json
{
  "name": "economy",
  "usage_factor": 0.5,
  "usage_threshold": 0.8
}
```

### 4. 优先级控制增强

改进了优先级的处理和验证：

- 支持 0-65535 的优先级范围
- 自动验证优先级的合法性
- 统一处理不同格式的优先级数据

### 5. 配置验证

新增 `ValidateQoS()` 函数，自动验证 QoS 配置的合理性：

- 检查必填字段
- 验证数值范围
- 确保最小值不超过最大值
- 验证抢占模式的合法性
- 检查使用因子和阈值的范围

## API 变更

### QoS 结构体新增字段

```go
type QoS struct {
    // ... 原有字段 ...
    
    // 最小资源要求
    MinCPUs     interface{} `json:"min_cpus_pj,omitempty"`
    MinNodes    interface{} `json:"min_nodes_pj,omitempty"`
    MinTRES     string      `json:"min_tres_pj,omitempty"`
    
    // 抢占配置
    Preempt           []string `json:"preempt,omitempty"`
    PreemptMode       string   `json:"preempt_mode,omitempty"`
    PreemptExemptTime int      `json:"preempt_exempt_time,omitempty"`
    
    // 使用因子
    UsageFactor    float64 `json:"usage_factor,omitempty"`
    UsageThreshold float64 `json:"usage_threshold,omitempty"`
}
```

### 新增辅助函数

```go
// 验证 QoS 配置
func ValidateQoS(qos *QoS) error

// 获取 QoS 优先级
func GetQoSPriority(qos *QoS) int

// 获取每用户最大作业数
func GetQoSMaxJobsPerUser(qos *QoS) int

// 获取每作业最大运行时间
func GetQoSMaxWallPerJob(qos *QoS) int

// 获取指定类型的 TRES 限制
func GetQoSTRESLimit(qos *QoS, tresType string) int64
```

## 使用示例

### 创建多级优先级 QoS 系统

```json
// 1. 低优先级 QoS - 适合批处理作业
{
  "name": "low",
  "description": "低优先级批处理",
  "priority": 100,
  "max_jobs_pu": 200,
  "max_cpus_pu": 64,
  "max_wall_pj": 10080,
  "usage_factor": 1.5
}

// 2. 普通优先级 QoS - 默认 QoS
{
  "name": "normal",
  "description": "普通优先级",
  "priority": 500,
  "max_jobs_pu": 100,
  "max_cpus_pu": 128,
  "max_gpus_pu": 4,
  "max_wall_pj": 2880,
  "preempt": ["low"],
  "preempt_mode": "requeue",
  "usage_factor": 1.0
}

// 3. 高优先级 QoS - 适合交互式作业
{
  "name": "high",
  "description": "高优先级交互式",
  "priority": 1000,
  "max_jobs_pu": 50,
  "max_cpus_pu": 256,
  "max_gpus_pu": 8,
  "max_wall_pj": 1440,
  "preempt": ["normal", "low"],
  "preempt_mode": "suspend",
  "preempt_exempt_time": 1800,
  "usage_factor": 0.8
}

// 4. 紧急 QoS - 最高优先级
{
  "name": "urgent",
  "description": "紧急作业",
  "priority": 5000,
  "max_jobs_pu": 10,
  "max_wall_pj": 480,
  "preempt": ["high", "normal", "low"],
  "preempt_mode": "requeue",
  "usage_factor": 0.5
}
```

### GPU 专用 QoS

```json
{
  "name": "gpu",
  "description": "GPU 计算专用",
  "priority": 800,
  "max_jobs_pu": 20,
  "max_gpus_pu": 8,
  "max_cpus_pu": 64,
  "max_tres_pu": "gres/gpu=8,mem=256G",
  "max_wall_pj": 2880,
  "min_cpus_pj": 4,
  "min_tres_pj": "gres/gpu=1,mem=16G",
  "preempt": ["normal"],
  "preempt_mode": "suspend"
}
```

### 经济型 QoS（鼓励使用）

```json
{
  "name": "economy",
  "description": "经济型 QoS，使用因子低",
  "priority": 300,
  "max_jobs_pu": 500,
  "max_cpus_pu": 32,
  "max_wall_pj": 20160,
  "usage_factor": 0.3,
  "usage_threshold": 0.9
}
```

## 最佳实践

### 1. QoS 层级设计

建议创建 3-5 个 QoS 层级：
- **urgent**: 紧急作业，最高优先级，严格限制数量
- **high**: 交互式作业，高优先级，中等限制
- **normal**: 默认 QoS，平衡的资源限制
- **low**: 批处理作业，低优先级，宽松限制
- **economy**: 经济型，最低优先级，最宽松限制，但使用因子低

### 2. 抢占策略

- **suspend**: 适合可以暂停的作业（如 CPU 密集型计算）
- **requeue**: 适合可以重新运行的作业（需要支持 checkpoint）
- **cancel**: 仅用于最紧急的情况
- 设置合理的 `preempt_exempt_time`，避免频繁抢占刚启动的作业

### 3. 资源限制

- 最大值（max）应该基于集群总资源的合理比例
- 最小值（min）应该确保作业效率，但不要设置过高
- GPU QoS 应该设置最小 GPU 数量，避免浪费
- 使用 `max_wall_pj` 限制单个作业的运行时间，防止长时间占用资源

### 4. 使用因子调优

- 默认 QoS 使用 `usage_factor = 1.0`
- 鼓励使用的 QoS 设置 `usage_factor < 1.0`
- 限制使用的 QoS 设置 `usage_factor > 1.0`
- 配合 `usage_threshold` 实现动态优先级调整

### 5. 监控和调整

定期检查：
- 各 QoS 的使用率
- 作业等待时间分布
- 抢占发生的频率
- 资源利用率

根据实际使用情况调整 QoS 参数。

## 兼容性说明

- 完全向后兼容旧的 QoS 配置
- 新字段为可选字段，不影响现有配置
- 自动处理 Slurm v0.0.43 API 的嵌套结构
- 支持旧格式和新格式的数据转换

## 注意事项

1. **权限要求**: 创建、修改、删除 QoS 需要管理员权限
2. **生效时间**: QoS 修改后立即生效，但不影响已运行的作业
3. **抢占风险**: 配置抢占时要谨慎，避免影响用户体验
4. **资源冲突**: 确保 QoS 的资源限制与分区（Partition）的限制协调一致
5. **公平共享**: 使用因子会影响公平共享调度，需要配合 Slurm 的 FairShare 配置

## 测试建议

1. 在测试环境中先验证 QoS 配置
2. 逐步引入抢占功能，从 suspend 模式开始
3. 监控作业调度行为，确保符合预期
4. 收集用户反馈，调整参数
5. 使用 `scontrol show qos` 命令验证配置

## 相关命令

```bash
# 查看所有 QoS
scontrol show qos

# 查看特定 QoS
scontrol show qos <qos_name>

# 查看用户的 QoS
sacctmgr show user <username> format=user,account,qos

# 提交作业时指定 QoS
sbatch --qos=<qos_name> job_script.sh

# 查看作业的 QoS
squeue -o "%.18i %.9P %.8j %.8u %.10a %.10q %.2t %.10M %.6D %R"
```

## 参考资源

- [Slurm QoS Documentation](https://slurm.schedmd.com/qos.html)
- [Slurm Fair Tree Algorithm](https://slurm.schedmd.com/fair_tree.html)
- [Slurm Preemption](https://slurm.schedmd.com/preempt.html)
- [Slurm REST API v0.0.43](https://slurm.schedmd.com/rest_api.html)
