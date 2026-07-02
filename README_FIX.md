# ComputeNook 修复说明

## 问题诊断结果

### 1. 前端无限刷新问题 ✅ 已修复

**原因**：
- `useEffect` 依赖项中包含 `useCallback` 创建的函数
- `useCallback` 每次渲染都重新创建函数引用
- 导致 `useEffect` 不断触发，形成无限循环

**修复位置**：
- `frontend/src/pages/admin/overview/index.tsx` 第 154 行
- `frontend/src/pages/user/dashboard/index.tsx` 第 335 行

**修复方法**：
```typescript
// 修复前
useEffect(() => {
  loadData()
  const timer = setInterval(loadData, 30_000)
  return () => clearInterval(timer)
}, [loadData])  // ❌ 依赖 useCallback 函数

// 修复后
useEffect(() => {
  loadData()
  const timer = setInterval(loadData, 30_000)
  return () => clearInterval(timer)
}, [])  // ✅ 空依赖，只在组件挂载时执行一次
```

### 2. Dashboard 数据为空问题 🔍 需要检查

**诊断结果**：
- ✅ Slurm REST API 工作正常（7个节点）
- ✅ slurmrestd 服务运行正常
- ✅ JWT Token 生成正常
- ⚠️ 后端可能返回了数据，但前端显示为 0

**可能原因**：
1. 前端数据字段映射错误
2. 后端返回格式与前端期望不一致
3. 用户权限问题

## 诊断工具使用

### 1. 快速检测（推荐）
```bash
./quick_check.sh 192.168.18.150 8081
```
检查所有关键 API 是否正常。

### 2. 详细监控
```bash
./monitor_api.sh 192.168.18.150 8081
```
全面检测 API 状态和响应内容。

### 3. 检查刷新频率
```bash
./check_refresh_rate.sh hpc 10
```
监控 10 秒内的前端请求频率。

### 4. Slurm API 诊断
```bash
./diagnose_slurm_api.sh hpc
```
检查 Slurm REST API 连接和配置。

### 5. 直接测试 Slurm
```bash
./test_slurm_direct.sh hpc
```
直接调用 Slurm REST API 查看返回数据。

## 部署步骤

### 1. 停止旧服务
```bash
ssh root@hpc
cd /root/test/computenook
pkill -f computenook
```

### 2. 确认配置
```bash
cat .env | grep -E 'PORT|REDIS|SLURM'
```

确保：
- `SERVER_PORT=8081`
- `REDIS_ENABLE=false`（如果没有 Redis）
- `SLURM_REST_URL=http://localhost:6820`
- `SLURM_API_VERSION=v0.0.44`

### 3. 启动服务
```bash
cd /root/test/computenook
./computenook &
```

或使用后台运行：
```bash
nohup ./computenook > /dev/null 2>&1 &
```

### 4. 检查日志
```bash
tail -f /root/test/computenook/logs/compute-nook.log
```

### 5. 测试前端
打开浏览器：`http://192.168.18.150:8081`

## 下一步检查清单

1. [ ] 启动测试环境后端
2. [ ] 运行 `quick_check.sh` 查看 API 状态
3. [ ] 检查 Dashboard API 返回的具体数据
4. [ ] 对比前端期望的数据字段
5. [ ] 查看浏览器控制台是否有错误
6. [ ] 确认刷新频率是否正常（应该30秒一次）

## API 数据字段对比

### 后端返回（dashboard.go）：
```json
{
  "data": {
    "total_nodes": 7,
    "online_nodes": 7,
    "total_cpus": 56,
    "allocated_cpus": 0,
    "total_memory_gb": 53.76,
    "allocated_memory_gb": 0.0,
    "total_gpus": 0,
    "allocated_gpus": 0
  }
}
```

### 前端期望（userdashboard.go）：
```json
{
  "data": {
    "nodes": 7,
    "nodes_online": 7,
    "cpu_cores": 56,
    "cpu_usage": 0,
    "memory": 55040,  // MB
    "memory_free": 55040,
    "gpu_cards": 0,
    "gpu_in_use": 0
  }
}
```

**字段不匹配！** 需要检查前端调用的是哪个 API。

## 可能需要的修复

如果数据字段不匹配，需要：

1. 检查前端 `api/index.ts` 中 Dashboard API 的定义
2. 确认前端使用的是 `/api/dashboard` 还是其他端点
3. 统一后端返回字段或修改前端解析逻辑

## 联系方式

如果问题依然存在，请提供：
1. `quick_check.sh` 的输出
2. 浏览器控制台的错误信息
3. 后端日志中的相关错误
