# HPC Web 管理平台

基于 Vue 3 + TypeScript + Go 构建的高性能计算集群统一管理平台，支持亮色/暗色双主题。

> 更新日志见 [CHANGELOG.md](./CHANGELOG.md)

## 项目对接

| | |
|---|---|
| 对接人 | sunfx |
| QQ | 598824458 |
| 邮箱 | 59882445@qq.com |

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + TypeScript + Vite |
| 后端 | Go + Gin |
| 认证 | LDAP + JWT |
| 调度 | Slurm REST API |
| 监控 | Prometheus + node_exporter |
| AI | 兼容 OpenAI API（DeepSeek / MiniMax / GPT 等） |
| 知识库 | 本地 Markdown（Obsidian Vault 兼容）+ 内存 2-gram 索引 |

---

## 项目结构

```
├── src/                  # 前端源码
│   ├── views/            # 页面组件
│   ├── components/       # 通用组件（AIAssistant 等）
│   ├── api/              # axios 封装
│   ├── utils/            # 工具函数
│   └── styles/           # 全局样式
├── backend/
│   ├── handlers/         # API 处理器
│   ├── middleware/        # 认证、审计、CORS、只读模式、token 黑名单
│   ├── models/           # 数据模型
│   ├── audit/            # 审计日志
│   ├── knowledge/        # AI 知识库（Obsidian 写入 + RAG 检索）
│   └── main.go
└── scripts/              # 部署脚本
```

---

## 快速开始

### 前端

```bash
npm install
npm run dev        # 开发模式，访问 http://localhost:3000
npm run build      # 构建到 dist/
```

### 后端

```bash
cd backend
cp ../.env.example ../.env   # 复制配置文件并填写实际值
go run main.go               # 启动，默认端口 8080
```

后端自动查找前端静态文件：优先 `backend/static/`，其次 `../dist/`。

---

## 环境变量配置

完整配置见 [.env.example](./.env.example)，以下为各模块说明。

### 基础服务

```env
SERVER_PORT=8080          # 后端监听端口
JWT_SECRET=               # JWT 签名密钥，生产环境必须设置强随机值
                          # 生成方式：openssl rand -base64 48
```

### LDAP 认证

```env
LDAP_HOST=192.168.x.x
LDAP_PORT=389
LDAP_USE_SSL=false
LDAP_SKIP_VERIFY=false
LDAP_BIND_DN=cn=Manager,dc=example,dc=com
LDAP_BIND_PASSWORD=your-password
LDAP_BASE_DN=dc=example,dc=com
LDAP_USER_BASE_DN=ou=people,dc=example,dc=com
LDAP_GROUP_BASE_DN=ou=group,dc=example,dc=com
UID_MIN=1000              # 平台管理的 UID 范围
UID_MAX=65000
GID_MIN=1000
GID_MAX=65000
```

### Slurm REST API

```env
SLURM_REST_URL=http://slurm-host:6820   # slurmrestd 地址
SLURM_API_VERSION=v0.0.43               # API 版本，与 slurmrestd 一致
SLURM_ADMIN_USER=root                   # 用于生成 JWT 的 Slurm 用户
SLURM_JWT_KEY=your-slurm-jwt-key        # Slurm JWT 签名密钥
SLURM_JWT_LIFESPAN=86400                # JWT 有效期（秒）
# SLURM_CLUSTER_NAME=                   # 多集群时指定集群名
```

**slurmrestd 启动示例：**

```bash
slurmrestd -a rest_auth/jwt -s openapi/v0.0.43 0.0.0.0:6820
```

### Prometheus 监控

```env
PROMETHEUS_URL=http://localhost:9090
```

需要在各计算节点部署 `node_exporter`，并配置 Prometheus 抓取。

### Web Shell

```env
# JSON 数组，配置可连接的节点
WEBSHELL_NODES=[{"name":"ln0","host":"192.168.x.x","port":22,"description":"登录节点","enabled":true}]
```

后端通过 SSH 密钥连接节点，需确保后端服务器的 SSH 私钥对目标节点有访问权限。

### 文件管理 & 存储配额

```env
FILEMANAGER_BASE_PATH=/home    # 文件管理根目录
HOME_BASE_PATH=/home           # 用户家目录基础路径
QUOTA_FS_TYPE=xfs              # 配额文件系统类型：xfs / nfs / lustre
QUOTA_PATH=/home               # 配额挂载点，必须与实际挂载路径一致
```

### 远程桌面

```env
DESKTOP_PARTITION=your-partition   # 提交桌面作业的 Slurm 分区
DESKTOP_SSH_KEY=/root/.ssh/id_rsa  # 后端连接计算节点的 SSH 私钥
DESKTOP_SSH_USER=root              # SSH 用户
DESKTOP_SSH_PORT=22
```

### AI 助手

```env
AI_API_URL=https://api.openai.com/v1/chat/completions
AI_API_KEY=your-api-key
AI_MODEL=gpt-4o-mini
AI_SYSTEM_PROMPT=你是一个 HPC 高性能计算集群的应用助手...
OBSIDIAN_VAULT_DIR=./knowledge/vault   # 问答记录写入目录
```

兼容任何 OpenAI API 格式的服务，推荐国内可用的 DeepSeek 或 MiniMax。

### 日志

```env
LOG_FILE=./logs/slurm-web.log
# AUDIT_LOG_DIR=./logs/audit     # 审计日志目录，默认 ./logs/audit
```

### 演示只读模式

```env
DEMO_READONLY=false   # 设为 true 时禁止修改用户信息和密码，其他功能正常
```

### 多因子认证（MFA）

```env
# MFA_ENABLED 可选值：
#   false    - 关闭（默认）
#   optional - 用户自选，自行绑定后生效
#   global   - 全局强制，所有用户必须绑定并使用 MFA
MFA_ENABLED=false
MFA_ISSUER=HPC Platform        # 显示在 Authenticator App 中的应用名称
# MFA_STORE_FILE=./mfa_secrets.json  # 密钥存储路径，默认与二进制同目录
```

> 注意：`.env` 中同行注释（`# ...`）会被自动去除，无需担心污染配置值。

**绑定流程（global 模式）：**

1. 用户输入账号密码 → 后端返回临时 token（5 分钟有效）
2. 前端跳转绑定页，扫描二维码（或手动输入密钥）
3. 输入 App 中的 6 位验证码确认绑定
4. 跳回登录页，再次登录时输入 TOTP 验证码进入系统

**管理员操作：**

- 用户管理页可查看所有用户 MFA 绑定状态
- 操作菜单「重置 MFA」可清除用户绑定，用户下次登录需重新绑定

### Token 有效期

```env
JWT_EXPIRE_HOURS=8   # Token 有效期（小时），默认 8 小时
```

### 开发模式

```env
DEV_MODE=false        # true 时跳过 LDAP 认证，使用下方虚拟用户
# DEV_USER=admin
# DEV_USER_UID=1000
# DEV_USER_IS_ADMIN=true
```

---

## 存储配额配置

### XFS

1. 编辑 `/etc/fstab`，挂载选项加入 `uquota,gquota`：

```
/dev/sda1  /home  xfs  defaults,uquota,gquota  0 0
```

2. 重新挂载：

```bash
mount -o remount /home
```

3. 验证：

```bash
xfs_quota -x -c "state" /home
# 看到 "User quota state on /home (ACTIVE)" 即成功
```

4. 安装工具：

```bash
yum install xfsprogs    # CentOS/RHEL
apt install xfsprogs    # Ubuntu/Debian
```

5. 若后端非 root 运行，配置 sudo：

```bash
# /etc/sudoers.d/hpc-backend
hpc-user ALL=(ALL) NOPASSWD: /usr/sbin/xfs_quota
```

### Lustre

```bash
# MGS 上开启配额
lctl conf_param fsname.quota.mdt=ug
lctl conf_param fsname.quota.ost=ug
```

```env
QUOTA_FS_TYPE=lustre
QUOTA_PATH=/lustre/home
```

### NFS

NFS 服务端需开启 quota，客户端安装 `quota` 工具包：

```bash
yum install quota    # CentOS/RHEL
apt install quota    # Ubuntu/Debian
```

```env
QUOTA_FS_TYPE=nfs
QUOTA_PATH=/nfs/home
```

---

## 用户手册

### 登录

访问平台地址，使用 LDAP 账号密码登录。首次登录若管理员设置了强制改密，会跳转到修改密码页面。

**双因子认证（MFA）：**

若系统开启了 MFA（`MFA_ENABLED=global` 或 `optional`）：

- `global` 模式：首次登录自动跳转绑定页，使用 Google Authenticator / Authy 等 TOTP 应用扫码绑定
- `optional` 模式：可在个人设置中自行开启
- 绑定后每次登录需额外输入 6 位动态验证码
- 连续输错密码 3 次账户锁定 10 分钟，1 次失败后出现图形验证码

---

### 仪表盘

登录后默认进入仪表盘，展示：

- **集群概览**：节点总数/在线数、CPU 核数/使用率、GPU 卡数/使用中、内存总量/空闲
- **作业统计**：运行中/等待中/已完成/失败 作业数量及占比
- **账户配额**：当前用户在各 Slurm 账户下的 CPU 使用率、节点限额、作业上限，多账户可切换
- **机时信息**：已用/剩余/总配额核时，使用率进度条
- **存储配额**：已用空间/总配额/使用率，文件数统计（来自真实 quota 数据）
- **节点列表**：各节点 CPU/内存使用率、运行作业数、状态
- **运行中作业**：当前用户正在运行的作业列表

---

### 作业管理

**查看作业**

- 普通用户只能看自己的作业，管理员可查看所有用户作业
- 支持按状态、用户名筛选
- 点击作业行查看详情（节点、资源、脚本、输出路径等）

**提交作业**

1. 点击「提交作业」按钮
2. 选择模板（MPI/OpenMP/GPU/Python/MATLAB 等预设）或手动编写脚本
3. 填写分区、节点数、CPU 核数、内存、时间限制
4. 点击「提交」

**作业操作**

| 操作 | 说明 |
|---|---|
| 暂停 | 暂停 RUNNING 状态的作业 |
| 恢复 | 恢复 SUSPENDED 状态的作业 |
| 取消 | 取消 RUNNING 或 PENDING 状态的作业 |

---

### Web Shell

1. 进入「Web Shell」页面
2. 从节点列表选择目标节点（登录节点/计算节点）
3. 点击「连接」，浏览器内打开 SSH 终端
4. 支持多标签页同时连接不同节点
5. 所有输入行为会记录到审计日志

---

### 远程桌面

1. 进入「远程桌面」页面
2. 点击「新建桌面」，选择分区、CPU/内存资源
3. 点击「启动」，等待 Slurm 分配节点
4. 节点就绪后有两种连接方式：
   - **浏览器连接（Xpra HTML5）**：无需安装软件，通过后端 WebSocket 代理直接在浏览器打开
   - **hpc-client 隧道**：复制隧道命令在本地执行，然后用任意 VNC 客户端连接 `localhost:590x`
5. 浏览器连接需要在后端部署 xpra-html5 静态文件：

```bash
# 下载 xpra-html5
git clone https://github.com/Xpra-org/xpra-html5.git
# 放到后端 static/xpra 目录
cp -r xpra-html5/html5 /opt/hpc-platform/static/xpra
```

后端启动时会自动检测 `static/xpra` 目录并挂载到 `/xpra/` 路径。

---

### 文件管理

- 左侧目录树浏览文件系统（限制在用户家目录范围内）
- 支持上传、下载、新建文件夹、重命名、删除
- 支持在线预览文本文件
- 支持 WebDAV 挂载（Windows/macOS 原生挂载到本地磁盘）

**WebDAV 挂载地址：**

```
http://your-server/api/webdav/
```

Windows 映射网络驱动器时使用 Basic Auth（用户名/密码与平台账号相同）。

---

### 报表中心

- 查看个人或账户的机时使用统计
- 按时间范围筛选（日/周/月/自定义）
- 导出 CSV 报表

---

### 主机资产（CMDB）

- 查看集群所有主机的资产信息（型号、IP、CPU、内存、操作系统等）
- 支持 Excel 批量导入（下载模板 → 填写 → 上传）
- 支持多 IP 地址（业务口/管理口/IB口/BMC 分类）
- 一键同步到机柜图

---

### HPC 应用助手

页面右下角悬浮的「孙大圣」图标，点击展开 AI 对话框。

适合提问：
- MPI/OpenMP 并行程序编写和调试
- Python/R/MATLAB/GROMACS/VASP 等科学软件使用
- 作业脚本编写（SBATCH 参数、环境变量、模块加载）
- 编译环境配置、依赖安装

不适合提问：集群运维、硬件故障、系统管理（会触发拦截）。

---

## 管理员手册

### 用户管理

进入「系统管理 → 用户管理」：

- **新建用户**：填写用户名、姓名、邮箱、UID，自动同步到 LDAP
- **编辑用户**：修改邮箱、手机、所属组等信息
- **重置密码**：管理员直接设置新密码
- **禁用用户**：禁用后用户无法登录，不删除数据
- **强制改密**：下次登录时强制用户修改密码
- **重置 MFA**：清除用户的 MFA 绑定，用户下次登录需重新绑定（换手机时使用）
- **删除用户**：从 LDAP 删除用户

> 演示只读模式（`DEMO_READONLY=true`）下，用户信息和密码不可修改。

---

### 用户组管理

进入「系统管理 → 用户管理 → 用户组」：

- 新建/编辑/删除 LDAP 用户组
- 管理组成员

---

### Slurm 账户管理

进入「系统管理 → 账户管理」：

- 管理 Slurm 账户（对应 `sacctmgr` 中的 account）
- 管理 Slurm 用户（将 LDAP 用户关联到 Slurm 账户）

---

### QoS 配置

进入「系统管理 → 资源管理 → QoS 配置」：

- 新建/编辑 QoS，设置 CPU 核数上限、节点数上限、作业数上限、优先级
- 查看 QoS 绑定情况

---

### 资源绑定（Association）

进入「系统管理 → 资源管理 → 资源绑定」：

- 将用户绑定到账户和分区，分配 QoS
- 设置机时配额（billing 限制）

---

### 机时管理

进入「系统管理 → 资源管理 → 机时管理」：

- 查看各账户/用户的机时使用情况
- 设置机时配额上限

---

### 存储配额

进入「系统管理 → 资源管理 → 存储配额」：

- 查看所有用户的已用空间、软/硬限制、使用率
- 按状态筛选：正常 / 警告（≥75%）/ 超限（≥90%）/ 未设置
- 点击「设置」为用户配置配额，支持快速预设（50G/100G/200G/500G/1TB）
- 软限制：超过后有宽限期（通常 7 天）
- 硬限制：绝对上限，超过后无法写入

---

### 集群监控

进入「集群监控」：

- **节点状态**：实时查看各节点 CPU/内存/GPU 使用率
- **Prometheus 指标**：自定义 PromQL 查询
- **告警规则**：查看当前触发的告警
- **机柜图**：可视化机柜布局，显示设备主机名
- **网络拓扑**：节点间连接关系

---

### AI 诊断

进入「AI 诊断」：

- 前端自动从 Prometheus 拉取实时监控数据注入上下文
- 直接提问集群状态、性能瓶颈、告警根因
- 适合运维场景：节点异常、作业失败分析、资源瓶颈排查

---

### 数据审计

进入「系统管理 → 数据审计」：

- **操作日志**：所有 API 写操作记录（用户、时间、操作类型、资源、结果）
- **页面访问**：用户访问各页面的记录
- **SSH 行为日志**：Web Shell 中用户输入的命令记录
- 支持按用户名、操作类型、时间范围筛选
- 支持导出 CSV

---

## 部署说明

### 生产部署（nginx 反向代理）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /opt/hpc-platform/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket（Web Shell / VNC）
    location /api/webshell/connect {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }

    location /api/desktop/sessions/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }
}
```

### systemd 服务

```ini
# /etc/systemd/system/hpc-backend.service
[Unit]
Description=HPC Platform Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/hpc-platform
ExecStart=/opt/hpc-platform/hpc-backend
EnvironmentFile=/opt/hpc-platform/.env
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now hpc-backend
```
