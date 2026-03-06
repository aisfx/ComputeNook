# Slurm JWT 动态Token配置指南

## 概述

系统已升级为动态JWT token生成模式。每个用户登录时，系统会自动为该用户生成专属的Slurm REST API token，无需手动管理token过期问题。

## 工作原理

1. **用户登录** → 前端发送用户名和密码
2. **认证成功** → 后端验证LDAP用户
3. **生成Token** → 使用SLURM_JWT_KEY为该用户生成JWT token
4. **API调用** → 使用用户专属token访问Slurm REST API
5. **作业提交** → 作业以该用户身份运行

## 配置步骤

### 步骤1: 获取Slurm JWT密钥

从Slurm服务器获取JWT密钥文件：

```bash
# 方法1: 直接复制密钥文件
scp root@192.168.5.250:/etc/slurm/jwt_hs256.key ./

# 方法2: 查看密钥内容
ssh root@192.168.5.250 "cat /etc/slurm/jwt_hs256.key"
```

### 步骤2: 配置.env文件

编辑`slurm-web/backend/.env`文件：

```bash
# Slurm REST API 配置
SLURM_REST_URL=http://192.168.5.250:30099
SLURM_API_VERSION=v0.0.43

# Slurm JWT 密钥配置（必需）
# 将从Slurm服务器获取的密钥内容粘贴到这里
SLURM_JWT_KEY=YEoqs4yNYiqeL6X4CHmAokT0cm+yBr7qUT1bxHGUMYI=

# Token有效期（秒）- 默认24小时
SLURM_JWT_LIFESPAN=86400
```

**重要提示**:
- `SLURM_JWT_KEY` 必须与Slurm服务器上的 `/etc/slurm/jwt_hs256.key` 内容完全一致
- 密钥内容应该是一行，去除所有换行符
- 不要在密钥前后添加引号

### 步骤3: 重启后端服务

```bash
cd slurm-web/backend

# 停止旧服务
pkill hpc-backend

# 启动新服务
./hpc-backend
```

### 步骤4: 验证配置

查看启动日志，确认配置正确：

```bash
tail -f logs/backend.log
```

应该看到类似的日志：
```
Generated Slurm JWT token for user: sunfx (expires in 86400 seconds)
Using dynamically generated Slurm token for user: sunfx
```

## 配置验证

### 测试1: 检查密钥配置

```bash
# 查看.env中的密钥
grep SLURM_JWT_KEY slurm-web/backend/.env

# 查看Slurm服务器上的密钥
ssh root@192.168.5.250 "cat /etc/slurm/jwt_hs256.key"

# 两者应该完全一致
```

### 测试2: 测试token生成

使用工具测试token生成：

```bash
cd slurm-web/backend/tools

# 生成测试token
./generate_token.sh sunfx 3600 <(echo "$SLURM_JWT_KEY")
```

### 测试3: 测试API访问

```bash
# 1. 登录获取JWT token
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"sunfx","password":"your_password"}' | jq -r '.token')

# 2. 提交测试作业
curl -X POST http://localhost:8080/api/jobs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "test_dynamic_token",
    "partition": "slurm-bridge",
    "script": "#!/bin/bash\necho \"User: $USER\"\nwhoami\n",
    "nodes": 1,
    "cpus": 1
  }'
```

## 优势

### 相比固定Token的优势

1. **安全性提升**
   - 每个用户使用自己的token
   - 作业以正确的用户身份运行
   - 避免所有用户共享root token

2. **无需手动管理**
   - 不需要定期更新SLURM_REST_TOKEN
   - 系统自动为每个用户生成token
   - Token过期时间可配置

3. **审计追踪**
   - 每个作业都有明确的用户身份
   - 便于追踪和审计
   - 符合安全最佳实践

4. **灵活性**
   - 可以为不同用户设置不同的权限
   - 支持用户级别的资源配额
   - 便于多租户管理

## 故障排查

### 问题1: "SLURM_JWT_KEY not configured"

**原因**: .env文件中没有配置SLURM_JWT_KEY或值为默认值

**解决**:
```bash
# 检查配置
grep SLURM_JWT_KEY .env

# 确保不是默认值
# 错误: SLURM_JWT_KEY=your_jwt_hs256_key_here
# 正确: SLURM_JWT_KEY=YEoqs4yNYiqeL6X4CHmAokT0cm+yBr7qUT1bxHGUMYI=
```

### 问题2: "authentication error"

**原因**: 密钥不匹配或token格式错误

**解决**:
1. 确认密钥与Slurm服务器一致
2. 检查密钥中是否有多余的空格或换行符
3. 重新从Slurm服务器复制密钥

```bash
# 获取正确的密钥
ssh root@192.168.5.250 "cat /etc/slurm/jwt_hs256.key | tr -d '\n'"
```

### 问题3: Token过期太快

**原因**: SLURM_JWT_LIFESPAN设置太短

**解决**:
```bash
# 修改.env文件
SLURM_JWT_LIFESPAN=86400  # 24小时
# 或
SLURM_JWT_LIFESPAN=604800  # 7天
```

### 问题4: 作业仍然以root身份运行

**原因**: 
- 密钥配置错误，系统回退到旧的token
- 代码没有正确使用NewClientForUser

**解决**:
1. 检查日志中是否有"Generated Slurm token for user"
2. 确认没有"Falling back to default SLURM_REST_TOKEN"的日志
3. 重新配置密钥并重启服务

## 安全建议

1. **保护密钥文件**
   ```bash
   chmod 600 .env
   ```

2. **不要提交到Git**
   ```bash
   # 确保.env在.gitignore中
   echo ".env" >> .gitignore
   ```

3. **定期轮换密钥**
   - 建议每季度更换一次JWT密钥
   - 更换时需要同时更新Slurm服务器和.env文件

4. **监控Token使用**
   - 定期检查日志中的token生成记录
   - 监控异常的API访问

## 迁移说明

### 从固定Token迁移

如果你之前使用固定的SLURM_REST_TOKEN，迁移步骤：

1. **备份当前配置**
   ```bash
   cp .env .env.backup
   ```

2. **获取JWT密钥**
   ```bash
   scp root@192.168.5.250:/etc/slurm/jwt_hs256.key ./
   ```

3. **更新.env文件**
   - 删除或注释掉 `SLURM_REST_TOKEN`
   - 添加 `SLURM_JWT_KEY`

4. **重启服务**
   ```bash
   pkill hpc-backend
   ./hpc-backend
   ```

5. **验证功能**
   - 测试用户登录
   - 测试作业提交
   - 检查作业用户身份

## 参考资料

- Slurm JWT认证文档: https://slurm.schedmd.com/jwt.html
- JWT标准: https://jwt.io
- 工具目录: `slurm-web/backend/tools/`
