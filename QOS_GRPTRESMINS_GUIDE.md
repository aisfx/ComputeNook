# QoS GrpTRESMins（总机时）使用指南

## 概述

GrpTRESMins 是 Slurm QoS 中用于限制总机时的重要参数。它可以限制该 QoS 下所有用户在一定时间内可以使用的总资源量。

## 什么是 GrpTRESMins

**GrpTRESMins** = Group TRES Minutes（组总资源分钟数）

- **TRES** = Trackable RESources（可追踪资源），包括 CPU、GPU、内存等
- **Minutes** = 分钟数
- **Group** = 该 QoS 下的所有用户

## 使用场景

### 场景 1: 限制月度 CPU 使用量

假设你想限制 "normal" QoS 每月最多使用 100,000 CPU-小时：

```
GrpTRESMins = cpu=6000000
```

计算：100,000 小时 × 60 分钟 = 6,000,000 CPU-分钟

### 场景 2: 限制 GPU 使用量

假设你想限制 "gpu" QoS 每月最多使用 1,000 GPU-小时：

```
GrpTRESMins = gres/gpu=60000
```

计算：1,000 小时 × 60 分钟 = 60,000 GPU-分钟

### 场景 3: 同时限制 CPU 和 GPU

```
GrpTRESMins = cpu=6000000,gres/gpu=60000
```

## 前端界面

### 创建/编辑 QoS 时

在 QoS 管理页面，你会看到：

**总机时限制（GrpTRESMins）**
```
输入框: cpu=100000
提示: 格式: cpu=100000 表示总共 100000 CPU-分钟，gres/gpu=10000 表示 10000 GPU-分钟
```

### 表格显示

在 QoS 列表中，会显示"总机时限制"列：

| 名称 | 描述 | 优先级 | ... | 总机时限制 |
|------|------|--------|-----|-----------|
| normal | 普通 | 100 | ... | 100000 CPU-分钟 |
| gpu | GPU | 200 | ... | 10000 GPU-分钟 |

## API 使用

### 创建 QoS

```bash
POST /api/qos
{
  "name": "limited",
  "description": "限制总机时的 QoS",
  "priority": 100,
  "grp_tres_mins": "cpu=6000000,gres/gpu=60000"
}
```

### 更新 QoS

```bash
PUT /api/qos/limited
{
  "name": "limited",
  "grp_tres_mins": "cpu=12000000"
}
```

## 计算示例

### 示例 1: 月度 CPU 配额

**需求：** 每月 10 万 CPU-小时

**计算：**
- 10 万小时 = 100,000 小时
- 100,000 × 60 = 6,000,000 分钟

**配置：**
```
grp_tres_mins = cpu=6000000
```

### 示例 2: 周度 GPU 配额

**需求：** 每周 168 GPU-小时（7天 × 24小时）

**计算：**
- 168 小时 × 60 = 10,080 分钟

**配置：**
```
grp_tres_mins = gres/gpu=10080
```

### 示例 3: 混合配额

**需求：**
- 每月 5 万 CPU-小时
- 每月 500 GPU-小时

**计算：**
- CPU: 50,000 × 60 = 3,000,000 分钟
- GPU: 500 × 60 = 30,000 分钟

**配置：**
```
grp_tres_mins = cpu=3000000,gres/gpu=30000
```

## 与其他限制的区别

### GrpTRESMins vs MaxWallPU

| 参数 | 含义 | 示例 |
|------|------|------|
| **GrpTRESMins** | 所有用户的总机时 | cpu=6000000 = 所有用户共享 600 万 CPU-分钟 |
| **MaxWallPU** | 单个用户的最大运行时间 | 10080 = 单个用户最多运行 7 天 |

### GrpTRESMins vs GrpTRES

| 参数 | 含义 | 示例 |
|------|------|------|
| **GrpTRESMins** | 总机时（累计） | cpu=6000000 = 累计使用 600 万 CPU-分钟 |
| **GrpTRES** | 同时使用的资源 | cpu=1000 = 同时最多使用 1000 个 CPU 核心 |

## 监控和重置

### 查看当前使用量

Slurm 会自动追踪每个 QoS 的资源使用量。可以使用以下命令查看：

```bash
sacctmgr show qos format=name,grptresmins,grptresrunmins
```

### 重置使用量

GrpTRESMins 的使用量会随时间自动衰减。Slurm 使用滑动窗口机制：

- 默认窗口：30 天
- 超过窗口的使用量会自动清除

## 实际应用场景

### 场景 1: 学术机构月度配额

```json
{
  "name": "student",
  "description": "学生配额",
  "grp_tres_mins": "cpu=3000000",
  "max_wall_pj": 1440,
  "max_jobs_pu": 10
}
```

- 每月 5 万 CPU-小时的总配额
- 单个作业最多运行 24 小时
- 每个学生最多 10 个作业

### 场景 2: 企业 GPU 资源管理

```json
{
  "name": "ml_team",
  "description": "机器学习团队",
  "grp_tres_mins": "gres/gpu=43200",
  "grp_tres": "gres/gpu=8",
  "max_wall_pj": 10080
}
```

- 每月 720 GPU-小时（30天 × 24小时）
- 同时最多使用 8 张 GPU
- 单个作业最多运行 7 天

### 场景 3: 分级 QoS 系统

```json
[
  {
    "name": "low",
    "priority": 50,
    "grp_tres_mins": "cpu=1000000"
  },
  {
    "name": "normal",
    "priority": 100,
    "grp_tres_mins": "cpu=3000000"
  },
  {
    "name": "high",
    "priority": 200,
    "grp_tres_mins": "cpu=6000000"
  }
]
```

## 注意事项

1. **单位是分钟**：所有时间都以分钟为单位，不是小时
2. **累计使用**：GrpTRESMins 是累计值，不是瞬时值
3. **滑动窗口**：使用量会随时间衰减
4. **多资源**：可以同时限制多种资源，用逗号分隔
5. **格式严格**：必须使用 `resource=value` 格式

## 常见错误

### 错误 1: 单位错误

❌ 错误：`grp_tres_mins = cpu=100000`（想表示 100000 小时）
✅ 正确：`grp_tres_mins = cpu=6000000`（100000 小时 × 60）

### 错误 2: 格式错误

❌ 错误：`grp_tres_mins = cpu:100000`
✅ 正确：`grp_tres_mins = cpu=100000`

### 错误 3: GPU 资源名称错误

❌ 错误：`grp_tres_mins = gpu=10000`
✅ 正确：`grp_tres_mins = gres/gpu=10000`

## 测试

### PowerShell 测试脚本

```powershell
# 登录
$loginBody = @{
    username = "admin"
    password = "your_password"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "http://localhost:8080/api/login" -Method Post -Body $loginBody -ContentType "application/json"
$token = $loginResponse.token

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# 创建带总机时限制的 QoS
$qosBody = @{
    name = "limited_monthly"
    description = "月度限制 QoS"
    priority = 100
    grp_tres_mins = "cpu=6000000,gres/gpu=60000"
    max_wall_pj = 1440
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/api/qos" -Headers $headers -Method Post -Body $qosBody

# 查看创建的 QoS
$qos = Invoke-RestMethod -Uri "http://localhost:8080/api/qos/limited_monthly" -Headers $headers -Method Get
Write-Host "QoS 名称: $($qos.data.name)"
Write-Host "总机时限制: $($qos.data.grp_tres_mins)"
```

## 总结

GrpTRESMins 是管理集群资源配额的强大工具：

✅ 可以限制总资源使用量
✅ 支持多种资源类型（CPU、GPU 等）
✅ 自动追踪和衰减
✅ 灵活的配额管理

现在你可以在前端界面中轻松配置和管理总机时限制了！
