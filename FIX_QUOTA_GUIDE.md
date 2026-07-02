# 存储配额显示修复指南

## 问题现象

✅ 服务器上已配置 XFS 配额系统：
```bash
xfs_quota -x -c 'report -u' /fs
User quota on /fs (/dev/sdb)
                        Blocks                     
User ID          Used       Soft       Hard    Warn/Grace     
---------- -------------------------------------------------- 
root         10304612          0          0     00 [--------]
admin            2260    1048576    1572864     00 [--------]
```

❌ 但是前端仪表盘显示"存储配额系统未配置"

## 根本原因

后端缺少环境变量配置：
- `QUOTA_FS_TYPE`：文件系统类型（xfs/nfs/lustre）
- `QUOTA_PATH`：配额挂载点（如 /fs）

## 解决方案

### 方案 1：一键修复（推荐）

在**本地电脑**运行：

```bash
cd /Users/sunfx/workspace/ComputeNook

# 远程执行配置脚本
ssh root@192.168.18.150 'bash -s' < quick_fix_quota.sh

# 远程重启服务
ssh root@192.168.18.150 'pkill -f computenook && cd /root/test/computenook && nohup ./computenook > /dev/null 2>&1 &'

# 等待 3 秒让服务启动
sleep 3

# 测试配额 API
./test_api.sh
```

### 方案 2：手动配置

SSH 到服务器手动配置：

```bash
# 1. SSH 到服务器
ssh root@192.168.18.150

# 2. 编辑配置文件
vi /root/test/computenook/backend/.env

# 3. 添加以下配置（在文件末尾）
# 存储配额系统配置
QUOTA_FS_TYPE=xfs
QUOTA_PATH=/fs

# 4. 保存并退出（按 ESC，输入 :wq）

# 5. 重启服务
pkill -f computenook
cd /root/test/computenook
nohup ./computenook > /dev/null 2>&1 &

# 6. 验证服务启动
ps aux | grep computenook
tail -f backend/logs/compute-nook.log
```

## 配置说明

### QUOTA_FS_TYPE

文件系统类型，支持以下值：
- `xfs` - XFS 文件系统（你的服务器是这个）
- `nfs` - NFS 网络文件系统
- `lustre` - Lustre 并行文件系统

### QUOTA_PATH

配额系统的挂载点：
- 根据你的服务器，应该设置为：`/fs`
- 对应设备：`/dev/sdb`

## 验证步骤

### 1. 检查配置文件

```bash
ssh root@192.168.18.150 'grep QUOTA /root/test/computenook/backend/.env'

# 期望输出：
# QUOTA_FS_TYPE=xfs
# QUOTA_PATH=/fs
```

### 2. 检查服务状态

```bash
ssh root@192.168.18.150 'ps aux | grep computenook | grep -v grep'

# 应该能看到 computenook 进程
```

### 3. 测试 API

在本地运行：
```bash
cd /Users/sunfx/workspace/ComputeNook
./test_api.sh
```

期望输出：
```
3. 测试存储配额 API (/api/quota)...
响应:
{
    "data": {
        "quota_used": 2260,
        "quota_limit": 1572864,
        "files_used": XXX,
        "files_limit": XXX
    }
}
✅ 存储配额有数据
```

### 4. 检查前端显示

1. 访问：http://192.168.18.150:8081
2. 登录：admin / admin
3. 用户仪表盘应该显示：
   - **存储配额**：2.2 MB / 1.5 GB (使用率 0.14%)
   - **文件数**：显示实际使用数量

## 完整操作命令

一键执行所有步骤（在本地运行）：

```bash
cd /Users/sunfx/workspace/ComputeNook

# 1. 配置环境变量
ssh root@192.168.18.150 'bash -s' << 'EOF'
ENV_FILE="/root/test/computenook/backend/.env"
cp "$ENV_FILE" "${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
if ! grep -q "^QUOTA_FS_TYPE=" "$ENV_FILE"; then
    echo "" >> "$ENV_FILE"
    echo "# 存储配额系统配置" >> "$ENV_FILE"
    echo "QUOTA_FS_TYPE=xfs" >> "$ENV_FILE"
    echo "QUOTA_PATH=/fs" >> "$ENV_FILE"
    echo "✅ 已添加配额配置"
else
    sed -i 's|^QUOTA_FS_TYPE=.*|QUOTA_FS_TYPE=xfs|' "$ENV_FILE"
    sed -i 's|^QUOTA_PATH=.*|QUOTA_PATH=/fs|' "$ENV_FILE"
    echo "✅ 已更新配额配置"
fi
grep QUOTA "$ENV_FILE"
EOF

# 2. 重启服务
ssh root@192.168.18.150 'pkill -f computenook && cd /root/test/computenook && nohup ./computenook > /dev/null 2>&1 &'

# 3. 等待服务启动
echo "等待服务启动..."
sleep 5

# 4. 测试 API
./test_api.sh

# 5. 查看服务日志
ssh root@192.168.18.150 'tail -20 /root/test/computenook/backend/logs/compute-nook.log'
```

## 故障排查

### 问题 1：配额 API 仍返回空数据

**排查步骤：**

```bash
# 检查配置是否生效
ssh root@192.168.18.150 'grep QUOTA /root/test/computenook/backend/.env'

# 检查服务是否重启
ssh root@192.168.18.150 'ps aux | grep computenook'

# 查看后端日志
ssh root@192.168.18.150 'tail -50 /root/test/computenook/backend/logs/compute-nook.log'
```

### 问题 2：权限不足

XFS 配额查询需要 root 权限，确保：
- 后端程序以 root 用户运行
- 或者配置 sudo 免密执行 xfs_quota

### 问题 3：挂载点路径错误

确认挂载点：
```bash
ssh root@192.168.18.150 'df -h | grep /fs'
ssh root@192.168.18.150 'mount | grep /fs'
```

## 测试数据

根据你的服务器配额信息：
- **admin 用户**：
  - 已用：2260 KB (2.2 MB)
  - 软限制：1048576 KB (1 GB)
  - 硬限制：1572864 KB (1.5 GB)
  - 使用率：约 0.14%

## 参考文档

- 配额查询逻辑：`backend/handlers/quota.go`
- XFS 配额命令：`xfs_quota -x -c 'report -ubih' /fs`
- 环境变量配置：`backend/.env`

---

**创建时间**：2026-07-02 22:30  
**状态**：✅ 待执行
