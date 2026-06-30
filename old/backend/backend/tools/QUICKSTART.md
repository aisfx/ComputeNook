# 快速开始 - 生成Slurm REST API Token

## 最简单的方法

### 1. 在Slurm服务器上直接生成（推荐）

如果你有Slurm服务器的SSH访问权限：

```bash
# SSH到Slurm服务器
ssh root@192.168.5.250

# 生成24小时有效期的token
scontrol token lifespan=86400
```

复制输出的token，更新`.env`文件中的`SLURM_REST_TOKEN`。

### 2. 使用本地工具生成

如果你有`jwt_hs256.key`文件的副本：

```bash
cd slurm-web/backend/tools

# 方式A: 使用Shell脚本（需要openssl）
./generate_token.sh sunfx 86400 /path/to/jwt_hs256.key

# 方式B: 使用Go程序
./generate_token -user sunfx -lifespan 86400 -key /path/to/jwt_hs256.key

# 方式C: 使用Makefile
make token-24h USERNAME=sunfx KEY_FILE=/path/to/jwt_hs256.key
```

## 常用命令

```bash
# 生成1小时token（默认）
make token USERNAME=sunfx

# 生成24小时token
make token-24h USERNAME=sunfx

# 生成7天token
make token-7d USERNAME=sunfx

# 生成30天token
make token-30d USERNAME=sunfx
```

## 更新.env文件

生成token后，编辑`slurm-web/backend/.env`：

```bash
# 找到这一行
SLURM_REST_TOKEN=旧的token

# 替换为新生成的token
SLURM_REST_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE4NTkyMDA3ODMsImlhdCI6MTc3MjgwMDc4Mywic3VuIjoic3VuZngiLCJ1aWQiOjI0MTM1fQ.xBIWT7zCrbT0G5a2yXxjuR_g4-oX1LIbCQAyoaeOl0c
```

## 重启后端服务

```bash
cd slurm-web/backend

# 停止旧服务
pkill hpc-backend

# 启动新服务
./hpc-backend
```

## 验证Token是否有效

```bash
# 测试API连接
curl -H "X-SLURM-USER-TOKEN: <your-token>" \
     http://192.168.5.250:30099/slurm/v0.0.43/jobs
```

如果返回作业列表，说明token有效。

## 故障排查

### Token过期
症状：API返回"authentication error"

解决：重新生成token并更新`.env`文件

### 找不到密钥文件
症状：Error: Key file not found

解决：
1. 从Slurm服务器复制密钥文件：
   ```bash
   scp root@192.168.5.250:/etc/slurm/jwt_hs256.key ./
   ```
2. 或者直接在Slurm服务器上生成token

### 权限问题
症状：Permission denied

解决：
```bash
chmod 600 jwt_hs256.key
```

## 安全提示

⚠️ **重要**: 
- `jwt_hs256.key`文件包含敏感信息，不要提交到Git
- Token可以访问Slurm API，妥善保管
- 定期更换token（建议每月一次）
- 不要在公共场合分享token
