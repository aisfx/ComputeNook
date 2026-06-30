# Slurm 分区配置初始化脚本 (PowerShell)
# 用于快速创建示例分区配置

param(
    [string]$ApiUrl = "http://localhost:8080",
    [string]$Token = $env:ADMIN_TOKEN
)

if ([string]::IsNullOrEmpty($Token)) {
    Write-Host "错误: 请设置 ADMIN_TOKEN 环境变量或使用 -Token 参数" -ForegroundColor Red
    Write-Host "用法: .\init_partition.ps1 -Token your_token"
    exit 1
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Slurm 分区配置初始化" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "API URL: $ApiUrl"
Write-Host ""

$headers = @{
    "Authorization" = "Bearer $Token"
    "Content-Type" = "application/json"
}

# 创建默认分区 "all"
Write-Host "1. 创建默认分区 'all'..." -ForegroundColor Yellow
$partition1 = @{
    name = "all"
    nodes = "ALL"
    over_subscribe = "Exclusive"
    is_default = $true
    max_time = "INFINITE"
    state = "UP"
    allow_groups = "root,test1,hpc-admin"
    allow_accounts = "root,test1,hpc-admin"
    tres_billing_weights = "node=0,CPU=1.0,mem=1.0G"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$ApiUrl/api/partitions" -Method Post -Headers $headers -Body $partition1
    Write-Host "✓ 创建成功" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    Write-Host "✗ 创建失败: $_" -ForegroundColor Red
}

Write-Host ""

# 创建 GPU 分区
Write-Host "2. 创建 GPU 分区 'gpu'..." -ForegroundColor Yellow
$partition2 = @{
    name = "gpu"
    nodes = "gpu[01-04]"
    over_subscribe = "NO"
    is_default = $false
    max_time = "7-00:00:00"
    state = "UP"
    allow_groups = "gpu-users,hpc-admin"
    allow_accounts = "gpu-account,hpc-admin"
    tres_billing_weights = "node=0,CPU=1.0,mem=1.0G,gres/gpu=10.0"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$ApiUrl/api/partitions" -Method Post -Headers $headers -Body $partition2
    Write-Host "✓ 创建成功" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    Write-Host "✗ 创建失败: $_" -ForegroundColor Red
}

Write-Host ""

# 创建高优先级分区
Write-Host "3. 创建高优先级分区 'high'..." -ForegroundColor Yellow
$partition3 = @{
    name = "high"
    nodes = "node[01-10]"
    over_subscribe = "NO"
    is_default = $false
    max_time = "3-00:00:00"
    state = "UP"
    allow_groups = "vip-users,hpc-admin"
    allow_accounts = "vip-account,hpc-admin"
    tres_billing_weights = "node=0,CPU=2.0,mem=2.0G"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$ApiUrl/api/partitions" -Method Post -Headers $headers -Body $partition3
    Write-Host "✓ 创建成功" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    Write-Host "✗ 创建失败: $_" -ForegroundColor Red
}

Write-Host ""

# 查看所有分区配置
Write-Host "4. 查看所有分区配置..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$ApiUrl/api/partitions" -Method Get -Headers $headers
    Write-Host "✓ 获取成功" -ForegroundColor Green
    $response.data | Format-Table -Property name, nodes, is_default, max_time, state
} catch {
    Write-Host "✗ 获取失败: $_" -ForegroundColor Red
}

Write-Host ""

# 应用配置到 Slurm
Write-Host "5. 应用配置到 Slurm..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$ApiUrl/api/partitions/apply" -Method Post -Headers $headers
    Write-Host "✓ 应用成功" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    Write-Host "✗ 应用失败: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "分区配置初始化完成！" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "可以使用以下命令验证："
Write-Host "  scontrol show partition"
Write-Host ""
