# 快速部署指南

## 问题描述

用户仪表盘的**机时信息**和**存储配额**卡片显示"暂无数据"。

## 问题原因

1. **机时信息**：虽然用户有 153.1 小时的机时消费，但因为没有充值记录（total_quota = 0），前端判断为"无数据"
2. **存储配额**：配额系统未配置，API 返回空对象，前端显示"暂无数据"

## 解决方案

优化前端显示逻辑：
- ✅ 机时信息：即使没有配额限制，也显示已使用的机时 + 警告提示
- ✅ 存储配额：显示"配额系统未配置"的友好提示

## 一键部署

```bash
# 在本地运行（macOS）
cd /Users/sunfx/workspace/ComputeNook
./deploy_to_server.sh root@192.168.18.150
```

部署脚本会自动：
1. ✅ 上传最新发布包到服务器
2. ✅ 停止当前服务
3. ✅ 备份旧版本
4. ✅ 解压新版本
5. ✅ 恢复 .env 配置

## 手动部署

如果一键脚本失败，可以手动部署：

```bash
# 1. 上传到服务器
scp release/computenook-*.tar.gz root@192.168.18.150:/tmp/

# 2. SSH 到服务器并部署
ssh root@192.168.18.150
cd /root/test
pkill -f computenook
mv computenook computenook.backup.$(date +%Y%m%d_%H%M%S)
tar -xzf /tmp/computenook-*.tar.gz
cp computenook.backup.*/backend/.env computenook/backend/
cd computenook
./computenook
```

## 启动服务

```bash
# SSH 到服务器
ssh root@192.168.18.150

# 启动服务
cd /root/test/computenook
./computenook

# 或者后台启动
nohup ./computenook > /dev/null 2>&1 &
```

## 验证部署

1. 访问：http://192.168.18.150:8081
2. 登录：admin / admin
3. 检查用户仪表盘：
   - **机时信息**：显示 "153.1 已使用 (小时)" + "⚠️ 未设置配额限制"
   - **存储配额**：显示 "📦 存储配额系统未配置"

## 测试脚本

```bash
# 在本地测试 API
./test_api.sh

# 期望输出：
# ✅ 机时信息返回 1 条记录 (used_hours: 153.1)
# ⚠️ 存储配额返回空数据
```

## 文件清单

- ✅ 发布包：`release/computenook-66ae3166-darwin-20260702-222410.tar.gz`
- ✅ 部署脚本：`deploy_to_server.sh`
- ✅ 测试脚本：`test_api.sh`
- ✅ 详细说明：`DEPLOYMENT_NOTES.md`
- ✅ Git 提交：`66ae3166`

## 快速命令

```bash
# 本地构建
make release

# 一键部署
./deploy_to_server.sh root@192.168.18.150

# 远程启动
ssh root@192.168.18.150 'cd /root/test/computenook && nohup ./computenook > /dev/null 2>&1 &'

# 查看日志
ssh root@192.168.18.150 'tail -f /root/test/computenook/backend/logs/compute-nook.log'

# 测试 API
./test_api.sh
```

## 注意事项

1. **配额充值**：如果需要设置机时配额，在管理后台 -> 机时管理 -> 充值
2. **存储配额**：需要配置环境变量 `QUOTA_FS_TYPE` 和 `QUOTA_PATH`
3. **清除缓存**：部署后按 Ctrl+Shift+R 强制刷新浏览器

## 回滚

如果有问题，快速回滚：

```bash
ssh root@192.168.18.150
cd /root/test
pkill -f computenook
rm -rf computenook
mv computenook.backup.* computenook
cd computenook
./computenook
```

---

**部署时间**：2026-07-02 22:24  
**版本号**：66ae3166  
**状态**：✅ 已测试，可以部署
