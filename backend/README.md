# HPC Backend - LDAP 用户管理 API

基于 Golang + Gin + LDAP 的 HPC 用户管理后端服务。

## 功能特性

- ✅ LDAP 用户认证登录
- ✅ JWT Token 认证
- ✅ 用户管理（增删改查）
- ✅ 用户组管理
- ✅ 密码重置
- ✅ 管理员权限控制
- ✅ CORS 支持
- ✅ 开发模式

## 快速开始

### 1. 安装依赖

```bash
cd backend
go mod download
```

### 2. 配置环境变量

编辑 `.env` 文件，配置你的 LDAP 服务器：

```env
LDAP_HOST=192.168.5.250
LDAP_PORT=30833
LDAP_BIND_DN=cn=Manager,dc=thhpc,dc=cn
LDAP_BIND_PASSWORD=secret
```

### 3. 启动服务

```bash
chmod +x start.sh
./start.sh
```

或者直接运行：

```bash
go run main.go
```

服务将在 `http://localhost:8080` 启动。

## API 文档

### 认证接口

#### 登录
```http
POST /api/login
Content-Type: application/json

{
  "username": "sunfx",
  "password": "sunfx"
}

响应:
{
  "token": "eyJhbGc...",
  "user": {
    "username": "sunfx",
    "uid": 1001,
    "cnName": "孙凤霞",
    "isAdmin": false
  }
}
```

#### 获取当前用户信息
```http
GET /api/me
Authorization: Bearer <token>

响应:
{
  "data": {
    "username": "sunfx",
    "uid": 1001,
    "gid": 1001,
    "cnName": "孙凤霞",
    "email": "sunfx@thhpc.cn",
    "phone": "13800138000",
    "shell": "/bin/bash",
    "homeDir": "/home/sunfx",
    "isAdmin": false
  }
}
```

### 用户管理接口（需要管理员权限）

#### 获取所有用户
```http
GET /api/users
Authorization: Bearer <token>
```

#### 获取单个用户
```http
GET /api/users/:username
Authorization: Bearer <token>
```

#### 创建用户
```http
POST /api/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "sunfx",
  "uid": 1001,
  "gid": 1001,
  "cnName": "孙凤霞",
  "email": "sunfx@thhpc.cn",
  "phone": "13800138000",
  "shell": "/bin/bash",
  "homeDir": "/home/sunfx",
  "password": "sunfx"
}
```

#### 更新用户
```http
PUT /api/users/:username
Authorization: Bearer <token>
Content-Type: application/json

{
  "uid": 1001,
  "gid": 1001,
  "cnName": "孙凤霞",
  "email": "sunfx@thhpc.cn",
  "phone": "13800138000",
  "shell": "/bin/bash",
  "homeDir": "/home/sunfx"
}
```

#### 删除用户
```http
DELETE /api/users/:username
Authorization: Bearer <token>
```

#### 重置密码
```http
POST /api/users/:username/reset-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "newPassword": "newpassword123"
}
```

### 用户组管理接口（需要管理员权限）

#### 获取所有用户组
```http
GET /api/groups
Authorization: Bearer <token>
```

#### 获取单个用户组
```http
GET /api/groups/:gid
Authorization: Bearer <token>
```

#### 创建用户组
```http
POST /api/groups
Authorization: Bearer <token>
Content-Type: application/json

{
  "groupName": "research",
  "gid": 2001,
  "members": ["sunfx", "user2"]
}
```

#### 更新用户组
```http
PUT /api/groups/:gid
Authorization: Bearer <token>
Content-Type: application/json

{
  "groupName": "research",
  "gid": 2001,
  "members": ["sunfx", "user2", "user3"]
}
```

#### 删除用户组
```http
DELETE /api/groups/:gid
Authorization: Bearer <token>
```

## 开发模式

开发模式下，无需 LDAP 服务器即可测试 API。

在 `.env` 中设置：
```env
DEV_MODE=true
DEV_USER=admin
DEV_USER_UID=1000
DEV_USER_IS_ADMIN=true
```

开发模式下：
- 跳过 JWT 验证
- 自动使用配置的开发用户
- 无需 LDAP 连接

## 前端集成

前端使用示例（axios）：

```javascript
import axios from 'axios'

const API_BASE_URL = 'http://localhost:8080/api'

// 登录
async function login(username, password) {
  const response = await axios.post(`${API_BASE_URL}/login`, {
    username,
    password
  })
  
  const { token, user } = response.data
  localStorage.setItem('token', token)
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
  
  return user
}

// 获取用户列表
async function getUsers() {
  const response = await axios.get(`${API_BASE_URL}/users`)
  return response.data.data
}

// 创建用户
async function createUser(user) {
  const response = await axios.post(`${API_BASE_URL}/users`, user)
  return response.data
}
```

## 环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| LDAP_HOST | LDAP 服务器地址 | - |
| LDAP_PORT | LDAP 端口 | 389 |
| LDAP_USE_SSL | 是否使用 SSL | false |
| LDAP_SKIP_VERIFY | 跳过 SSL 证书验证 | false |
| LDAP_BIND_DN | 管理员 DN | - |
| LDAP_BIND_PASSWORD | 管理员密码 | - |
| LDAP_BASE_DN | 基础 DN | - |
| LDAP_USER_BASE_DN | 用户基础 DN | - |
| LDAP_GROUP_BASE_DN | 用户组基础 DN | - |
| JWT_SECRET | JWT 密钥 | - |
| DEV_MODE | 开发模式 | false |
| SERVER_PORT | 服务器端口 | 8080 |
| CORS_ALLOWED_ORIGINS | 允许的跨域来源 | * |

## 项目结构

```
backend/
├── main.go              # 主入口
├── go.mod              # Go 模块
├── .env                # 环境变量
├── handlers/           # HTTP 处理器
│   ├── auth.go        # 认证处理器
│   ├── user.go        # 用户管理
│   └── group.go       # 用户组管理
├── ldap/              # LDAP 客户端
│   ├── client.go      # LDAP 连接
│   ├── user.go        # 用户操作
│   └── group.go       # 用户组操作
├── middleware/        # 中间件
│   ├── auth.go        # 认证中间件
│   └── cors.go        # CORS 中间件
└── models/            # 数据模型
    └── user.go        # 用户模型
```

## 故障排查

### 无法连接 LDAP

检查配置：
```bash
# 测试网络连接
nc -zv 192.168.5.250 30833

# 检查环境变量
cat .env | grep LDAP
```

### Token 验证失败

确保：
1. JWT_SECRET 已设置
2. Token 格式正确：`Bearer <token>`
3. Token 未过期（24小时）

### 权限不足

确保用户属于管理员组（admin/wheel/sudo）

## 许可证

MIT License
