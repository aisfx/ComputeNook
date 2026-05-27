# Admin Level 修复说明

## 问题描述
在"编辑用户"界面中，选择 Admin Level 后保存不生效。

## 根本原因
后端 `UpdateSlurmUser` 函数在构造请求体时存在问题：
1. 使用了结构体而不是 map，导致某些字段可能没有正确序列化
2. 缺少调试日志，难以排查问题

## 修复内容

### 1. backend/slurm/account.go
- 修改 `UpdateSlurmUser` 函数，直接使用 map 构造请求体
- 添加调试日志，输出接收到的参数和构造的请求体
- 确保 `administrator_level` 字段正确设置为字符串数组

### 2. backend/handlers/slurm_account.go  
- 添加调试日志，输出接收到的用户数据

## 测试步骤

1. 重启后端服务
2. 打开浏览器开发者工具的 Network 标签
3. 编辑一个用户，选择不同的 Admin Level（如 Administrator）
4. 点击保存
5. 查看后端日志，确认：
   - Handler 层接收到正确的 `admin_level` 值
   - Client 层构造的请求体包含正确的 `administrator_level` 数组
6. 刷新页面，确认 Admin Level 已更新

## 预期日志输出

```
[UpdateSlurmUser Handler] name=test1, user={Name:test1 DefaultAccount: AdminLevel:Administrator ...}
[UpdateSlurmUser] name=test1, received admin_level=Administrator, setting to=Administrator
[UpdateSlurmUser] request body: map[users:[map[administrator_level:[Administrator] name:test1]]]
```

## 如果问题仍然存在

检查以下几点：
1. Slurm REST API 是否正常工作
2. 管理员权限是否足够
3. Slurm 配置是否允许修改 administrator_level
4. 查看完整的 Slurm API 响应错误信息
