# 部署说明 - 修复机时信息和存储配额显示

## 修复内容

### 1. 机时信息显示优化
**问题**：当 QoS 没有充值记录（total_quota = 0）时，即使用户有机时消费记录，仍显示"暂无机时配额"

**修复**：
- 添加 `has_usage` 字段判断是否有使用记录
- 当 `total_quota = 0` 但 `used_hours > 0` 时，显示已使用的机时数
- 提示用户"⚠️ 未设置配额限制"

**效果**：
- ✅ 有配额限制：显示使用率、已用/剩余机时
- ✅ 无配额但有消费：显示已用机时 + 未设置配额警告
- ⚠️ 无配额无消费：显示"暂无机时配额"

### 2. 存储配额显示优化
**问题**：当配额系统未配置时（返回空对象），显示"暂无存储配额"

**修复**：
- 添加 `not_configured` 字段标记配额系统未配置
- 显示友好提示："存储配额系统未配置，请联系管理员配置配额系统"

**效果**：
- ✅ 有配额数据：显示容量和文件数使用情况
- ✅ 未配置：显示友好的未配置提示
- ⚠️ 其他情况：显示"暂无存储配额"

## 部署步骤

### 方案 1：使用预编译包（推荐）

```bash
# 1. 上传到服务器
scp release/computenook-66ae3166-darwin-20260702-222410.tar.gz root@192.168.18.150:/tmp/

# 2. SSH 到服务器
ssh root@192.168.18.150

# 3. 停止当前服务
cd /root/test/computenook
pkill -f computenook

# 4. 备份当前版本
cd /root/test
mv computenook computenook.backup.$(date +%Y%m%d_%H%M%S)

# 5. 解压新版本
tar -xzf /tmp/computenook-66ae3166-darwin-20260702-222410.tar.gz -C /root/test/

# 6. 恢复 .env 配置（如果需要）
cp computenook.backup.*/backend/.env computenook/backend/

# 7. 启动服务
cd /root/test/computenook
./computenook
```

### 方案 2：本地构建部署

```bash
# 1. 在本地拉取最新代码
cd /Users/sunfx/workspace/ComputeNook
git pull

# 2. 构建发布版本
make release

# 3. 后续步骤同方案 1
```

## 测试验证

### 1. 测试 API 返回
```bash
# 在本地运行测试脚本
cd /Users/sunfx/workspace/ComputeNook
./test_api.sh

# 期望输出：
# ✅ 机时信息返回 N 条记录
# ⚠️ 存储配额返回空数据（如未配置）
```

### 2. 测试前端显示
1. 访问 http://192.168.18.150:8081
2. 使用 admin/admin 登录
3. 检查用户仪表盘：
   - **机时信息**：应显示已使用的 153.1 小时 + "未设置配额限制" 警告
   - **存储配额**：应显示 "📦 存储配额系统未配置" 提示

## 技术细节

### 前端修改
- 文件：`frontend/src/pages/user/dashboard/index.tsx`
- 接口定义：
  ```typescript
  interface MachineTime {
    has_usage?: boolean  // 新增
  }
  
  interface StorageQuota {
    not_configured?: boolean  // 新增
  }
  ```

### 后端无修改
- 后端 API 返回格式保持不变
- `/api/usage/billing-summary` 返回正常
- `/api/quota` 返回正常（空对象表示未配置）

## 回滚方案

如果新版本有问题，快速回滚：

```bash
cd /root/test
pkill -f computenook
rm -rf computenook
mv computenook.backup.YYYYMMDD_HHMMSS computenook
cd computenook
./computenook
```

## 注意事项

1. **机时配额充值**：如果需要设置机时配额限制，需要在管理后台进行充值操作
2. **存储配额配置**：需要配置 `QUOTA_FS_TYPE` 和 `QUOTA_PATH` 环境变量，并安装对应的配额工具
3. **缓存清理**：部署后前端可能有缓存，建议 Ctrl+Shift+R 强制刷新

## 相关文件

- 测试脚本：`test_api.sh`
- 发布包：`release/computenook-66ae3166-darwin-20260702-222410.tar.gz`
- Git 提交：`66ae3166`

## 问题排查

如果部署后仍有问题：

1. 检查后端日志：`tail -f /root/test/computenook/backend/logs/compute-nook.log`
2. 检查 API 响应：使用 test_api.sh 脚本测试
3. 检查浏览器控制台：是否有 JS 错误
4. 清除浏览器缓存：Ctrl+Shift+Delete

---

构建时间：2026-07-02 22:24
版本：66ae3166
