# Harbor 与 LDAP 集成说明

## 问题背景

用户提问："Harbor 不是 LDAP 吗？为什么在 `.env` 里面还有些配置呢？"

这是一个很好的问题！让我详细解释 Harbor 和 LDAP 的关系。

## Harbor 认证方式

### Harbor 支持多种认证方式

1. **数据库认证**（默认）
   - Harbor 自己的用户数据库
   - 用户在 Harbor 中注册账号

2. **LDAP 认证**（推荐）
   - Harbor 连接到 LDAP 服务器
   - 用户使用 LDAP 账号密码登录 Harbor
   - 实现统一认证，无需单独注册

3. **OIDC/OAuth**
   - 通过第三方身份提供商认证

## 为什么需要 `.env` 中的 Harbor 配置

### 配置内容

```bash
# Harbor 服务地址
HARBOR_URL=http://harbor.example.com

# Harbor 管理员账号（用于 API 代理和镜像推送）
HARBOR_ADMIN_USER=admin
HARBOR_ADMIN_PASS=Harbor12345
```

### 配置原因

ComputeNook 后端需要以**管理员身份**调用 Harbor API，原因：

1. **API 代理**：
   - 前端通过后端代理访问 Harbor API
   - 避免跨域问题
   - 统一认证和权限控制

2. **镜像管理**：
   - 获取所有项目列表（需要管理员权限）
   - 获取所有仓库列表
   - 推送和拉取镜像

3. **自动化操作**：
   - 保存容器作业时自动推送镜像
   - 为用户创建私有项目
   - 镜像标签管理

## 架构说明

### 两层认证架构

```
┌─────────────────────────────────────────────────────────┐
│                     用户                                 │
└────────────┬────────────────────────────────────────────┘
             │
             ├─────────────┐
             │             │
             ▼             ▼
    ┌────────────┐  ┌──────────────┐
    │ 直接访问   │  │ 通过ComputeNook │
    │  Harbor    │  │   访问Harbor    │
    └─────┬──────┘  └────────┬───────┘
          │                  │
          │                  ▼
          │         ┌─────────────────┐
          │         │ ComputeNook后端  │
          │         │ (使用管理员账号)  │
          │         └────────┬────────┘
          │                  │
          └──────────┬───────┘
                     │
                     ▼
          ┌──────────────────┐
          │      Harbor       │
          │ (配置LDAP认证)     │
          └─────────┬─────────┘
                    │
                    ▼
          ┌──────────────────┐
          │       LDAP        │
          │   (用户数据库)     │
          └──────────────────┘
```

### 认证流程对比

#### 场景1：用户直接登录 Harbor Web 界面

```
用户 → Harbor 登录页面 → 输入 LDAP 账号密码
     → Harbor 连接 LDAP 验证
     → 登录成功
```

在这个场景中，Harbor 使用 **LDAP 认证**。

#### 场景2：用户通过 ComputeNook 使用 Harbor

```
用户 → ComputeNook 前端 → 选择镜像
     → 后端 API (使用 Harbor 管理员账号)
     → Harbor API
     → 返回镜像列表
```

在这个场景中，ComputeNook 后端使用 **Harbor 管理员账号** 调用 API。

## Harbor 的 LDAP 配置

### 在 Harbor 端配置 LDAP

Harbor 需要单独配置连接到 LDAP：

1. **登录 Harbor Web 界面**（管理员账号）
2. **系统管理** → **配置** → **认证模式**
3. 选择 **LDAP** 认证
4. 配置 LDAP 连接参数：

```yaml
LDAP URL: ldap://192.168.x.x:389
LDAP Search DN: cn=admin,dc=example,dc=com
LDAP Search Password: your-ldap-password
LDAP Base DN: dc=example,dc=com
LDAP UID: uid
LDAP Scope: Subtree
LDAP Filter: (objectClass=posixAccount)
```

### Harbor 管理员账号

- **admin** 账号是 Harbor 的**本地管理员**
- 不依赖 LDAP，始终可用
- 用于：
  - 配置 Harbor 系统
  - 提供给 ComputeNook 后端使用
  - 应急管理

## ComputeNook 中 Harbor 的使用

### 后端使用场景

#### 1. 获取 Harbor 配置信息

```go
// handlers/registry.go: GetHarborConfig
func GetHarborConfig(c *gin.Context) {
    harborURL := os.Getenv("HARBOR_URL")
    // 返回配置给前端
    c.JSON(http.StatusOK, gin.H{
        "harbor_url": harborURL,
        "user_project": username,
        "public_projects": []string{"library", "base", "public"},
    })
}
```

#### 2. API 代理

```go
// handlers/registry.go: harborAdmin
func harborAdmin(method, path string, body io.Reader) (*http.Response, error) {
    harborURL := os.Getenv("HARBOR_URL")
    req.SetBasicAuth(
        os.Getenv("HARBOR_ADMIN_USER"), 
        os.Getenv("HARBOR_ADMIN_PASS")
    )
    // 以管理员身份调用 Harbor API
    return client.Do(req)
}
```

#### 3. 推送镜像

```go
// handlers/job.go: SaveJobAsImage
func SaveJobAsImage(c *gin.Context) {
    // 1. 从容器中导出镜像
    // 2. 标记镜像
    harborUser := os.Getenv("HARBOR_ADMIN_USER")
    harborPass := os.Getenv("HARBOR_ADMIN_PASS")
    // 3. 推送到 Harbor
}
```

#### 4. 注入凭据（Enroot）

```go
// handlers/job.go: injectEnrootCredentials
func injectEnrootCredentials(script string) string {
    harborURL := os.Getenv("HARBOR_URL")
    harborUser := os.Getenv("HARBOR_ADMIN_USER")
    harborPass := os.Getenv("HARBOR_ADMIN_PASS")
    // 在作业脚本中注入 Harbor 凭据
}
```

### 前端使用场景

#### 1. 选择镜像（作业提交）

```tsx
// frontend/src/pages/user/jobs/index.tsx
// 1. 获取 Harbor 项目列表
const res = await axios.get('/registry/projects')

// 2. 获取仓库列表
const res = await axios.get(`/registry/projects/${project}/repositories`)

// 3. 获取镜像标签
const res = await axios.get(`/registry/projects/${project}/repositories/${repo}/tags`)
```

#### 2. 保存容器镜像

```tsx
// 作业详情 → 保存镜像按钮
await axios.post(`/jobs/${jobId}/save-image`, {
  project: 'username',
  image_name: 'my-app',
  tag: 'v1.0'
})
```

## 配置步骤总结

### 1. 配置 LDAP（已有）

```bash
# .env
LDAP_HOST=192.168.x.x
LDAP_PORT=389
LDAP_BIND_DN=cn=admin,dc=example,dc=com
LDAP_BIND_PASSWORD=your-password
LDAP_BASE_DN=dc=example,dc=com
```

### 2. 配置 Harbor 使用 LDAP 认证

在 Harbor Web 界面中配置（一次性操作）：
- 系统管理 → 认证模式 → LDAP
- 填入 LDAP 连接信息

### 3. 配置 ComputeNook 连接 Harbor

```bash
# .env
HARBOR_URL=http://harbor.example.com
HARBOR_ADMIN_USER=admin
HARBOR_ADMIN_PASS=Harbor12345
```

## 权限说明

### LDAP 用户在 Harbor 中的权限

当用户用 LDAP 账号登录 Harbor 时：

1. **自动创建 Harbor 用户**
   - 首次登录自动创建
   - 用户名对应 LDAP uid

2. **默认权限**
   - 访问公共项目（library、public 等）
   - 创建自己的私有项目
   - 推拉自己项目的镜像

3. **不能做的事**
   - 查看其他用户的私有项目
   - 修改系统配置
   - 管理所有项目

### ComputeNook 管理员账号权限

- **完全权限**
- 可以访问所有项目
- 可以推拉任何镜像
- 可以为用户创建项目

## 安全建议

### 1. Harbor 管理员密码保护

```bash
# 使用强密码
HARBOR_ADMIN_PASS=YourVeryStrongPasswordHere123!@#

# 权限最小化原则：只在 ComputeNook 后端使用
# 不要分享给普通用户
```

### 2. Harbor 项目隔离

```
library/        # 公共基础镜像（只读）
public/         # 公共应用镜像（只读）
username/       # 用户私有项目（读写）
```

### 3. 网络隔离

```
用户浏览器 → ComputeNook 后端 → Harbor API
                  ↓
                LDAP

# 用户浏览器不直接访问 Harbor API
# 避免暴露管理员凭据
```

## 常见问题

### Q1: 为什么不让用户直接用自己的 LDAP 账号访问 Harbor API？

**A**: 有几个原因：
1. **跨域问题**：前端直接访问 Harbor 会有跨域限制
2. **权限控制**：某些操作需要管理员权限（如查看所有项目）
3. **统一认证**：用户只需登录 ComputeNook，无需再次输入 Harbor 密码
4. **审计日志**：所有操作经过后端，便于审计

### Q2: 如果 Harbor 配置了 LDAP，admin 账号还能用吗？

**A**: 可以！
- **admin** 是 Harbor 的本地管理员账号
- 不受 LDAP 配置影响
- 始终可用，用于：
  - 应急管理
  - 系统配置
  - ComputeNook 后端调用

### Q3: 用户需要知道 Harbor 管理员密码吗？

**A**: 不需要！
- 管理员密码只配置在 `.env` 中
- 只有 ComputeNook 后端使用
- 用户通过前端界面操作，无需知道密码

### Q4: 如何验证 Harbor 的 LDAP 配置是否正确？

**A**: 
1. 在 Harbor Web 界面点击"测试 LDAP 服务器"
2. 退出 admin 账号
3. 用一个 LDAP 普通用户账号登录 Harbor
4. 登录成功说明配置正确

## 总结

| 组件 | 认证方式 | 使用场景 |
|------|---------|---------|
| **LDAP** | N/A（认证提供者） | 存储用户信息 |
| **Harbor (LDAP模式)** | LDAP 账号密码 | 用户直接登录 Harbor |
| **Harbor (admin)** | 本地管理员密码 | 系统配置、后端调用 |
| **ComputeNook 后端** | Harbor 管理员账号 | API 代理、镜像管理 |
| **ComputeNook 前端** | 通过后端代理 | 用户界面操作 |

**关键点**：
- ✅ Harbor **支持** LDAP 认证（用户登录）
- ✅ Harbor **管理员账号**用于 API 调用（后端使用）
- ✅ 两者并存，各司其职
- ✅ 用户无需知道管理员密码

**配置文件说明**：
- `.env` 中的 Harbor 配置 = **ComputeNook 后端**连接 Harbor 所需
- Harbor Web 界面中的 LDAP 配置 = **用户**登录 Harbor 所需
