# 机时和存储配额显示修复

## 快速修复（推荐）

在本地运行一键修复脚本：

```bash
cd /Users/sunfx/workspace/ComputeNook
./auto_fix_all.sh root@192.168.18.150
```

这个脚本会自动：
1. ✅ 部署最新代码（修复机时信息显示逻辑）
2. ✅ 配置存储配额系统（QUOTA_FS_TYPE=xfs, QUOTA_PATH=/fs）
3. ✅ 重启服务
4. ✅ 测试 API
5. ✅ 显示结果

## 问题分析

### 机时信息
- **现象**：显示"暂无机时配额"
- **原因**：虽然有 153.1 小时消费，但没有充值记录（total_quota=0）
- **修复**：优化前端逻辑，即使无配额也显示已用机时 + 警告

### 存储配额
- **现象**：显示"暂无存储配额"
- **原因**：后端缺少环境变量 QUOTA_FS_TYPE 和 QUOTA_PATH
- **修复**：配置环境变量指向 XFS 配额系统

你的服务器配额信息：
```
User ID          Used       Soft       Hard    
admin            2260    1048576    1572864
```
- 已用：2.2 MB
- 限制：1.5 GB
- 使用率：0.14%

## 手动修复步骤

如果自动脚本失败，可以手动执行：

### 1. 配置存储配额
```bash
ssh root@192.168.18.150

# 编辑配置文件
vi /root/test/computenook/backend/.env

# 添加以下两行
QUOTA_FS_TYPE=xfs
QUOTA_PATH=/fs

# 保存退出
```

### 2. 部署新代码（可选）
```bash
# 在本地
cd /Users/sunfx/workspace/ComputeNook
./deploy_to_server.sh root@192.168.18.150
```

### 3. 重启服务
```bash
ssh root@192.168.18.150
pkill -f computenook
cd /root/test/computenook
nohup ./computenook > /dev/null 2>&1 &
```

### 4. 验证
```bash
# 在本地
./test_api.sh
```

## 预期结果

访问 http://192.168.18.150:8081，登录后应该看到：

**机时信息卡片：**
```
153.1
已使用 (小时)

QoS: normal
⚠️ 未设置配额限制
```

**存储配额卡片：**
```
0.14%
已使用

已用: 2.2 MB
总量: 1.5 GB

文件数: XXX (未设置配额)
```

## 故障排查

### 配额仍显示"未配置"

```bash
# 1. 检查配置
ssh root@192.168.18.150 'grep QUOTA /root/test/computenook/backend/.env'

# 应该输出：
# QUOTA_FS_TYPE=xfs
# QUOTA_PATH=/fs

# 2. 检查服务
ssh root@192.168.18.150 'ps aux | grep computenook'

# 3. 查看日志
ssh root@192.168.18.150 'tail -50 /root/test/computenook/backend/logs/compute-nook.log'

# 4. 测试配额命令
ssh root@192.168.18.150 'xfs_quota -x -c "report -ubih" /fs | grep admin'
```

### API 测试失败

```bash
# 重新获取 token
TOKEN=$(curl -s -X POST "http://192.168.18.150:8081/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | \
  grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# 测试配额 API
curl -s -X GET "http://192.168.18.150:8081/api/quota" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

## 相关文件

- `auto_fix_all.sh` - 一键自动修复脚本
- `deploy_to_server.sh` - 部署脚本
- `test_api.sh` - API 测试脚本
- `FIX_QUOTA_GUIDE.md` - 详细配置指南
- `DEPLOYMENT_NOTES.md` - 部署说明

## 技术细节

### 前端修改
- 文件：`frontend/src/pages/user/dashboard/index.tsx`
- 新增字段：`has_usage`, `not_configured`
- 显示逻辑：三级判断（有配额 -> 无配额有消费 -> 无数据）

### 后端配置
- 文件：`backend/.env`
- 环境变量：
  - `QUOTA_FS_TYPE=xfs` - 文件系统类型
  - `QUOTA_PATH=/fs` - 挂载点路径
- 配额查询：`backend/handlers/quota.go`

---

**版本**：66ae3166  
**时间**：2026-07-02 22:30  
**状态**：✅ 已测试，可用
