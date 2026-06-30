# Slurm REST API Token Generator

这个工具用于生成Slurm REST API的JWT认证token。

## 前提条件

Slurm REST API使用JWT (JSON Web Token) 进行认证，需要：
1. Slurm配置了JWT认证
2. 有访问`jwt_hs256.key`密钥文件的权限（通常在`/etc/slurm/jwt_hs256.key`）

## 使用方法

### 方法1: 使用Shell脚本（推荐）

```bash
# 基本用法（使用默认参数：root用户，1小时有效期）
./generate_token.sh

# 指定用户名
./generate_token.sh sunfx

# 指定用户名和有效期（秒）
./generate_token.sh sunfx 86400

# 指定所有参数（用户名、有效期、密钥文件路径）
./generate_token.sh sunfx 86400 /etc/slurm/jwt_hs256.key
```

### 方法2: 使用Go程序

```bash
# 编译
go build -o generate_token generate_token.go

# 使用默认参数
./generate_token

# 指定参数
./generate_token -user sunfx -lifespan 86400 -key /etc/slurm/jwt_hs256.key
```

## 参数说明

- **username**: 用户名（默认：root）
- **lifespan**: token有效期（秒），默认3600秒（1小时）
  - 1小时 = 3600
  - 24小时 = 86400
  - 7天 = 604800
  - 30天 = 2592000
- **key_file**: JWT密钥文件路径（默认：/etc/slurm/jwt_hs256.key）

## 示例输出

```
========================================
JWT Token Generated Successfully
========================================
Username:  sunfx
Issued At: 2026-03-06 20:00:00
Expires:   2026-03-07 20:00:00
Lifespan:  86400 seconds (24 hours)
========================================
Token:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE4NTkyMDA3ODMsImlhdCI6MTc3MjgwMDc4Mywic3VuIjoic3VuZngiLCJ1aWQiOjI0MTM1fQ.xBIWT7zCrbT0G5a2yXxjuR_g4-oX1LIbCQAyoaeOl0c
========================================

To use this token, update your .env file:
SLURM_REST_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
========================================
```

## 更新.env文件

生成token后，更新`slurm-web/backend/.env`文件：

```bash
SLURM_REST_TOKEN=<生成的token>
```

然后重启后端服务。

## 注意事项

1. **Token过期**: Token会在指定时间后过期，需要重新生成
2. **密钥安全**: `jwt_hs256.key`文件包含敏感信息，需要妥善保管
3. **权限**: 需要有读取密钥文件的权限
4. **用户名**: token中的用户名必须是Slurm系统中存在的用户

## 故障排查

### 错误: "authentication error"
- Token已过期，需要重新生成
- Token格式不正确
- 密钥不匹配

### 错误: "Key file not found"
- 检查密钥文件路径是否正确
- 检查是否有读取权限

### 如何查看token信息

可以使用在线工具解码JWT token（不要上传包含真实密钥的token）：
- https://jwt.io

或使用命令行：
```bash
# 查看Header和Payload（不验证签名）
echo "eyJhbGc..." | cut -d. -f1 | base64 -d
echo "eyJleH..." | cut -d. -f2 | base64 -d
```

## 在Slurm服务器上生成token

如果你有Slurm服务器的访问权限，可以使用Slurm自带的命令：

```bash
# 生成1小时有效期的token
scontrol token lifespan=3600

# 生成24小时有效期的token
scontrol token lifespan=86400
```
