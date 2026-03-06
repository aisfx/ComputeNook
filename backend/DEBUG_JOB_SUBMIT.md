# 作业提交调试指南

## 问题描述

提交作业时，environment中的USER变量应该使用当前登录的LDAP用户，而不是root或其他用户。

## 代码流程

### 1. 前端登录
用户在前端输入用户名和密码 → 后端验证 → 返回JWT token（包含username）

### 2. 提交作业请求
前端发送作业提交请求，携带JWT token → 后端认证中间件解析token → 设置username到context

### 3. 后端处理
```
handlers/job.go:SubmitJob()
  ↓
获取 username from context
  ↓
构建 JobSubmitParams (包含Username字段)
  ↓
slurm/job.go:SubmitJob()
  ↓
设置 job["environment"]["USER"] = params.Username
  ↓
发送到 Slurm REST API
```

## 调试步骤

### 步骤1: 检查后端日志

重启后端服务并提交作业，查看日志：

```bash
cd slurm-web/backend
./hpc-backend 2>&1 | tee logs/backend.log
```

关键日志输出：
```
========== SUBMIT JOB REQUEST ==========
Authenticated user: sunfx
Request: name=test, partition=slurm-bridge, qos=
Resources: nodes=1, cpus=1, memory=0GB, gpus=0, time=0h
=========================================

========== JOB SUBMISSION START ==========
Submitting job: name=test, partition=slurm-bridge, nodes=1, cpus=1, workdir=/fs/home/sunfx, username=sunfx, script_length=50
QoS=, Memory=0GB, GPUs=0, TimeLimit=0h
✓ Working directory: /fs/home/sunfx
✓ USER environment variable: sunfx
✓ Nodes: 1
✓ CPUs per task: 1

========== JOB OBJECT ==========
{
  "current_working_directory": "/fs/home/sunfx",
  "environment": {
    "USER": "sunfx"
  },
  "name": "test",
  "nodes": "1",
  "partition": "slurm-bridge",
  "tasks": 1
}
================================

========== SCRIPT CONTENT ==========
#!/bin/bash
echo "User: $USER"
whoami
====================================

========== API REQUEST ==========
Method: POST
Path: /slurm/v0.0.43/job/submit
Full URL: http://192.168.5.250:30099/slurm/v0.0.43/job/submit
API Version: v0.0.43
=================================
```

### 步骤2: 验证JWT token

检查JWT token是否包含正确的用户名：

```bash
# 获取token（从浏览器开发者工具或登录响应）
TOKEN="eyJhbGc..."

# 解码payload（第二部分）
echo $TOKEN | cut -d. -f2 | base64 -d | jq .
```

应该看到：
```json
{
  "username": "sunfx",
  "uid": 24135,
  "isAdmin": false,
  "exp": 1234567890
}
```

### 步骤3: 检查认证中间件

查看认证中间件日志：

```bash
grep "AuthMiddleware" logs/backend.log
```

应该看到：
```
AuthMiddleware: Authenticated user - Username: sunfx, UID: 24135, IsAdmin: false
```

### 步骤4: 检查Slurm API请求

查看发送到Slurm API的完整请求：

```bash
grep -A 20 "Request body:" logs/backend.log
```

应该看到：
```json
{
  "script": "#!/bin/bash\necho \"User: $USER\"\nwhoami\n",
  "job": {
    "name": "test",
    "partition": "slurm-bridge",
    "tasks": 1,
    "current_working_directory": "/fs/home/sunfx",
    "environment": {
      "USER": "sunfx"
    },
    "nodes": "1",
    "cpus_per_task": 1
  }
}
```

### 步骤5: 验证作业运行结果

在Slurm服务器上查看作业输出：

```bash
ssh root@192.168.5.250
cat /fs/home/sunfx/slurm-<job_id>.out
```

应该看到：
```
User: sunfx
sunfx
```

## 常见问题

### 问题1: USER显示为root

**原因**: 
- JWT token中的username不正确
- 认证中间件没有正确设置username到context
- handlers没有正确传递username

**解决**:
1. 检查登录时是否使用了正确的用户名
2. 检查JWT token payload
3. 查看认证中间件日志

### 问题2: USER显示为${USER}

**原因**: params.Username为空

**解决**:
1. 检查handlers/job.go中是否正确传递了Username字段
2. 检查context中是否有username

### 问题3: 作业提交失败

**原因**: 
- 工作目录不存在或无权限
- Slurm API token过期
- 分区不存在

**解决**:
1. 检查工作目录: `ls -la /fs/home/sunfx`
2. 重新生成Slurm API token
3. 检查分区: `sinfo`

## 使用测试脚本

运行自动化测试脚本：

```bash
cd slurm-web/backend
./test_job_submit_debug.sh
```

这个脚本会：
1. 登录获取token
2. 提交测试作业
3. 显示后端日志
4. 查询作业详情
5. 提示如何查看作业输出

## 手动测试

### 1. 登录
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"sunfx","password":"your_password"}'
```

### 2. 提交作业
```bash
TOKEN="<从登录响应获取>"

curl -X POST http://localhost:8080/api/jobs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "test_user",
    "partition": "slurm-bridge",
    "script": "#!/bin/bash\necho \"User: $USER\"\nwhoami\nid\n",
    "nodes": 1,
    "cpus": 1
  }'
```

### 3. 查看日志
```bash
tail -f logs/backend.log | grep -E "SUBMIT|USER|environment"
```

## 总结

当前代码已经正确实现了使用LDAP用户名作为environment.USER的功能。如果仍然显示root或其他用户，请：

1. 确认使用正确的用户登录
2. 检查JWT token是否包含正确的username
3. 查看后端日志确认username传递正确
4. 验证Slurm API请求中的environment.USER字段
