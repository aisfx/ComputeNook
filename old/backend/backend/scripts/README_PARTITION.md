# Slurm 分区配置管理脚本

本目录包含用于管理 Slurm 分区配置的脚本和示例文件。

## 文件说明

- `init_partition.sh` - Linux/Unix 初始化脚本
- `init_partition.ps1` - Windows PowerShell 初始化脚本
- `partitions_example.json` - 示例分区配置文件

## 快速开始

### Linux/Unix

```bash
# 设置管理员 Token
export ADMIN_TOKEN="your_admin_token_here"

# 运行初始化脚本
cd backend/scripts
bash init_partition.sh
```

### Windows PowerShell

```powershell
# 设置管理员 Token
$env:ADMIN_TOKEN = "your_admin_token_here"

# 运行初始化脚本
cd backend\scripts
.\init_partition.ps1
```

或者直接传递 Token：

```powershell
.\init_partition.ps1 -Token "your_admin_token_here" -ApiUrl "http://localhost:8080"
```

## 使用示例配置文件

### 方法 1: 使用 curl (Linux/Unix)

```bash
# 读取 JSON 文件并导入
curl -X POST http://localhost:8080/api/partitions/import \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"data\":\"$(cat partitions_example.json | jq -c .)\"}"

# 应用配置
curl -X POST http://localhost:8080/api/partitions/apply \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 方法 2: 使用 PowerShell (Windows)

```powershell
# 读取 JSON 文件
$jsonContent = Get-Content partitions_example.json -Raw | ConvertFrom-Json | ConvertTo-Json -Compress

# 导入配置
$body = @{ data = $jsonContent } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8080/api/partitions/import" `
  -Method Post `
  -Headers @{ "Authorization" = "Bearer $env:ADMIN_TOKEN"; "Content-Type" = "application/json" } `
  -Body $body

# 应用配置
Invoke-RestMethod -Uri "http://localhost:8080/api/partitions/apply" `
  -Method Post `
  -Headers @{ "Authorization" = "Bearer $env:ADMIN_TOKEN" }
```

## 自定义配置

### 编辑示例配置文件

编辑 `partitions_example.json` 文件，根据你的集群环境修改：

```json
[
  {
    "name": "all",
    "nodes": "ALL",
    "over_subscribe": "Exclusive",
    "is_default": true,
    "max_time": "INFINITE",
    "state": "UP",
    "allow_groups": "root,test1,hpc-admin",
    "allow_accounts": "root,test1,hpc-admin",
    "tres_billing_weights": "node=0,CPU=1.0,mem=1.0G"
  }
]
```

### 字段说明

- `name`: 分区名称（必填）
- `nodes`: 节点列表，如 "ALL"、"node[01-10]"、"gpu[01-04]"
- `over_subscribe`: 超额订阅策略
  - `Exclusive`: 独占模式
  - `NO`: 不允许超额订阅
  - `YES`: 允许超额订阅
  - `FORCE`: 强制超额订阅
- `is_default`: 是否为默认分区（只能有一个）
- `max_time`: 最大运行时间
  - `INFINITE`: 无限制
  - `7-00:00:00`: 7天
  - `01:00:00`: 1小时
- `state`: 分区状态
  - `UP`: 正常运行
  - `DOWN`: 关闭
  - `DRAIN`: 排空
  - `INACTIVE`: 不活动
- `allow_groups`: 允许的用户组（逗号分隔）
- `allow_accounts`: 允许的账户（逗号分隔）
- `tres_billing_weights`: TRES 计费权重

## 常见操作

### 1. 查看当前配置

```bash
curl -X GET http://localhost:8080/api/partitions \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

### 2. 创建新分区

```bash
curl -X POST http://localhost:8080/api/partitions \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test",
    "nodes": "test[01-05]",
    "over_subscribe": "NO",
    "max_time": "1-00:00:00",
    "state": "UP"
  }'
```

### 3. 更新分区

```bash
curl -X PUT http://localhost:8080/api/partitions/test \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "max_time": "2-00:00:00"
  }'
```

### 4. 删除分区

```bash
curl -X DELETE http://localhost:8080/api/partitions/test \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 5. 导出配置

```bash
curl -X GET http://localhost:8080/api/partitions/export \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -o partitions_backup.json
```

### 6. 应用配置到 Slurm

```bash
curl -X POST http://localhost:8080/api/partitions/apply \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## 验证配置

应用配置后，可以使用以下命令验证：

```bash
# 查看所有分区
scontrol show partition

# 查看特定分区
scontrol show partition all

# 查看分区配置文件
cat /etc/slurm/partition.conf
```

## 故障排查

### 问题 1: Token 认证失败

确保使用的是管理员账户的 Token：

```bash
# 登录获取 Token
curl -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}'
```

### 问题 2: 配置文件写入失败

检查文件权限：

```bash
ls -la /etc/slurm/partition.conf
sudo chmod 644 /etc/slurm/partition.conf
```

### 问题 3: Slurm 服务重启失败

检查服务状态：

```bash
systemctl status slurmctld
journalctl -u slurmctld -n 50
```

### 问题 4: 配置未生效

手动重新加载配置：

```bash
scontrol reconfigure
```

## 环境变量

在 `.env` 文件中配置：

```bash
# Slurm 分区配置文件路径
SLURM_PARTITION_CONF=/etc/slurm/partition.conf

# Slurm 服务名称
SLURM_SERVICE_NAME=slurmctld

# 配置重新加载方法：reconfigure 或 restart
SLURM_RELOAD_METHOD=reconfigure
```

## 注意事项

1. 所有操作都需要管理员权限
2. 应用配置前会自动备份原配置文件
3. 推荐使用 `reconfigure` 方式重新加载配置，避免中断作业
4. 确保分区名称、节点名称与实际集群配置一致
5. 只能有一个默认分区

## 更多信息

详细文档请参考：`backend/PARTITION_CONFIG.md`
