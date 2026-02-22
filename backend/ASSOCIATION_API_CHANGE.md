# 资源绑定API修改说明

## 修改内容

### 1. API端点变更
创建和更新资源绑定时使用新的API端点：
- **旧端点**: `/slurmdb/v0.0.40/associations`
- **新端点**: `/slurmdb/v0.0.44/accounts/associations`

查询和删除仍使用旧端点：
- **查询**: `/slurmdb/v0.0.40/associations`
- **删除**: `/slurmdb/v0.0.40/association`

### 2. 请求格式
```json
{
  "associations": [
    {
      "user": "bob",
      "account": "test",
      "cluster": "cluster"
    }
  ]
}
```

### 3. 修改的文件
- `backend/slurm/account.go`
  - `CreateAssociation` 方法 - 使用 v0.0.44 API
  - `UpdateAssociation` 方法 - 使用 v0.0.44 API

### 4. 使用场景

#### 创建Slurm账户时
```go
// 创建账户后，自动创建 root 用户到该账户的绑定
rootAssoc := &slurm.Association{
    Account: account.Name,
    User:    "root",
    Cluster: "cluster",
}
client.CreateAssociation(rootAssoc)
```
**API调用**: `POST /slurmdb/v0.0.44/accounts/associations`

#### 创建Slurm用户时
```go
// 创建用户后，自动创建用户到指定账户的绑定
userAssoc := &slurm.Association{
    Account: user.DefaultAccount,
    User:    user.Name,
    Cluster: "cluster",
}
client.CreateAssociation(userAssoc)
```
**API调用**: `POST /slurmdb/v0.0.44/accounts/associations`

### 5. 工作流程

**创建账户流程：**
1. 验证账户名称
2. 检查账户是否已存在
3. 调用 Slurm API 创建账户
4. 调用 `POST /slurmdb/v0.0.44/accounts/associations` 创建 root 用户绑定
5. 返回成功消息："账户创建成功，并已创建资源绑定"

**创建用户流程：**
1. 验证用户名和默认账户（**必填**）
2. 检查用户是否已存在
3. 验证指定的账户是否存在
4. 调用 Slurm API 创建用户
5. 调用 `POST /slurmdb/v0.0.44/accounts/associations` 创建用户到账户的绑定
6. 返回成功消息："用户创建成功，并已创建资源绑定"

### 6. 错误处理
- 如果创建绑定失败，整个操作失败
- 返回详细的错误信息给前端
- 前端显示友好的错误提示

### 7. 前端要求
- 创建Slurm用户时，**必须**选择默认账户（Def Acct字段标记为必填）
- 前端验证：如果未选择默认账户，显示错误："必须选择默认账户"

### 8. 测试步骤
重启后端服务：
```bash
cd backend
./hpc-backend
```

测试流程：
1. **创建Slurm账户**
   - 输入账户名称、描述、组织
   - 点击创建
   - 验证：在资源绑定页面应该能看到 root 用户到该账户的绑定

2. **创建Slurm用户**
   - 输入用户名
   - **必须选择**默认账户
   - 选择管理员级别
   - 点击创建
   - 验证：在资源绑定页面应该能看到该用户到指定账户的绑定

3. **检查资源绑定**
   - 打开"资源绑定"页面
   - 应该能看到所有自动创建的绑定
   - 默认账户应该有⭐标记

### 9. API版本说明
- **v0.0.40**: 用于查询（GET）和删除（DELETE）操作
- **v0.0.44**: 用于创建（POST）和更新（POST）操作

这是因为 Slurm REST API 在不同版本中对 associations 的处理方式不同。

