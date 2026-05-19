# 算力小筑

> 小而美的高性能计算集群管理平台

**算力小筑**是一个面向科研与工程团队的轻量级 HPC 集群管理平台，基于 Vue 3 + TypeScript + Go 构建，支持亮色/暗色双主题。

不追求大而全，只做好用的那几件事：提交作业、看日志、管文件、进容器、看监控。

> 更新日志见 [CHANGELOG.md](./CHANGELOG.md)

---

## 平台能做什么

### 🚀 作业管理
- 提交普通 Slurm 作业，内置 MPI / GPU / Python / 数组作业等模板
- 提交**容器作业**（Pyxis/Enroot），挂载目录、工作目录默认指向用户家目录
- 查看运行中/历史作业，支持取消、暂停、恢复
- **作业历史增强**：
  - 显示作业开始时间和结束时间
  - 支持按提交时间、开始时间、结束时间排序
  - 自选列功能，自定义显示的列
  - 导出Excel包含所有选中的列
- 作业详情：节点、资源、运行时长、实时监控进度条
- 一键**进入运行中容器**（`srun --overlap --pty bash`），直接在 Web Shell 里操作（仅容器作业显示）
- 一键**保存容器镜像**，异步推送到私有 Harbor 仓库（仅容器作业显示）

### 💻 Web Shell
- 浏览器内 SSH 终端，支持多节点切换
- SSH 密钥 / 密码双认证，支持 MFA 二次验证
- **会话持久化**：切换页面后 WebSocket 连接保持，回来时终端状态不丢失
- 所有输入行为记录审计日志，危险命令自动告警

### 🖥 远程桌面
- 通过 Slurm 申请计算节点，启动图形桌面（Xpra）
- 支持浏览器直连（HTML5）和本地客户端（hpc-client）两种方式
- 支持 VNC 客户端连接

### 📁 文件管理
- 浏览器内管理家目录文件，上传/下载/预览/重命名/删除
- **后台上传**：上传任务全局持续，切换页面不中断，右下角进度面板随时可见
- 支持 WebDAV 挂载，Windows/macOS 直接映射为本地磁盘

### 📊 集群监控
- 节点 CPU / 内存 / GPU 实时使用率
- Prometheus 历史曲线（作业维度）
- 机柜图可视化、网络拓扑

### 🤖 AI 助手
- 右下角悬浮入口，随时提问
- 支持 DeepSeek / MiniMax / GPT 等兼容 OpenAI API 的模型
- 内置 HPC 知识库（Obsidian Vault 兼容），RAG 检索增强
- AI 诊断：自动注入 Prometheus 实时数据，分析集群异常

### 🔐 用户与权限
- LDAP 统一认证，JWT 会话管理
- 管理员可管理用户、用户组、Slurm 账户、QoS、资源绑定
- QoS 资源限制（CPU / 内存 / 节点 / GPU / 总机时）per-user 精确控制
- 创建用户时自动绑定同名 QoS（如存在）
- 机时配额多 QoS 切换查看，仪表盘实时展示已用/剩余/使用率
- 存储配额管理（XFS / Lustre / NFS）
- 多因子认证（TOTP，可选 / 全局强制）
- 操作审计日志，SSH 行为记录

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + TypeScript + Vite |
| 后端 | Go + Gin |
| 认证 | LDAP + JWT |
| 调度 | Slurm REST API |
| 容器 | Pyxis / Enroot |
| 镜像仓库 | Harbor |
| 数据库 | SQLite（默认）/ MySQL |
| 缓存 | Redis（可选，高频查询加速 + 分布式锁） |
| 监控 | Prometheus + node_exporter |
| AI | 兼容 OpenAI API（DeepSeek / MiniMax / GPT 等） |
| 知识库 | 本地 Markdown（Obsidian Vault 兼容）+ 内存 2-gram 索引 |

---

## 项目结构

```
├── src/                  # 前端源码
│   ├── views/            # 页面组件
│   ├── components/       # 通用组件
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

### 🎁 一键体验（Vagrant 单机环境）

**最快的体验方式！** 我们提供了集成 Slurm + LDAP + 所有依赖的 Vagrant Box，拉起来就能用。

#### 前置要求
- [VirtualBox](https://www.virtualbox.org/wiki/Downloads) 或其他虚拟化软件
- [Vagrant](https://www.vagrantup.com/downloads)

#### 启动步骤

**方式 1：使用 vagrant init**
```bash
vagrant init computenook/mn --box-version 1
vagrant up
```

**方式 2：创建 Vagrantfile**
```ruby
Vagrant.configure("2") do |config|
  config.vm.box = "computenook/mn"
  config.vm.box_version = "1"
  
  # 可选：配置网络和资源
  config.vm.network "forwarded_port", guest: 18080, host: 18080  # Web 界面
  config.vm.provider "virtualbox" do |vb|
    vb.memory = "4096"
    vb.cpus = 2
  end
end
```

然后启动：
```bash
vagrant up
```

#### 访问系统

虚拟机启动后，在浏览器访问：**http://localhost:18080**

默认账号：
- **管理员**：hpc-admin / hpc-admin
- **普通用户**：test1 / test1

> 💡 **提示**：Vagrant Box 已预装 Slurm、LDAP、Prometheus 等所有依赖，开箱即用！

---

### 在线体验

访问地址：http://202.189.51.151:18080/

测试账号：
- **普通用户**：test1 / test1
- **管理员**：hpc-admin / hpc-admin

---

### 本地开发

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
UID_MIN=1000
UID_MAX=65000
GID_MIN=1000
GID_MAX=65000
```

### Slurm REST API

```env
SLURM_REST_URL=http://slurm-host:6820
SLURM_API_VERSION=v0.0.43
SLURM_ADMIN_USER=root
SLURM_JWT_KEY=your-slurm-jwt-key
SLURM_JWT_LIFESPAN=86400
```

**slurmrestd 启动示例：**

```bash
slurmrestd -a rest_auth/jwt -s openapi/v0.0.43 0.0.0.0:6820
```

### Prometheus 监控

```env
PROMETHEUS_URL=http://localhost:9090
```

### Web Shell

```env
WEBSHELL_NODES=[{"name":"ln0","host":"192.168.x.x","port":22,"description":"登录节点","enabled":true}]
```

### 文件管理 & 存储配额

```env
FILEMANAGER_BASE_PATH=/home
HOME_BASE_PATH=/home
QUOTA_FS_TYPE=xfs              # xfs / nfs / lustre
QUOTA_PATH=/home
```

### 远程桌面

```env
DESKTOP_PARTITION=your-partition
DESKTOP_SSH_KEY=/root/.ssh/id_rsa
DESKTOP_SSH_USER=root
DESKTOP_SSH_PORT=22
```

### Harbor 镜像仓库

```env
HARBOR_URL=http://your-harbor
HARBOR_ADMIN_USER=admin
HARBOR_ADMIN_PASS=your-password
```

### AI 助手

```env
AI_API_URL=https://api.openai.com/v1/chat/completions
AI_API_KEY=your-api-key
AI_MODEL=gpt-4o-mini
AI_SYSTEM_PROMPT=你是一个 HPC 高性能计算集群的应用助手...
OBSIDIAN_VAULT_DIR=./knowledge/vault
```

### 多因子认证（MFA）

```env
# false / optional / global
MFA_ENABLED=false
MFA_ISSUER=算力小筑
```

### 数据库

```env
# sqlite（默认，无需额外配置）或 mysql
DB_TYPE=sqlite
DB_PATH=./data/hpc_platform.db

# MySQL 配置（DB_TYPE=mysql 时填写）
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your-password
DB_NAME=hpc_platform
```

### Redis 缓存（可选）

```env
REDIS_ENABLE=true
REDIS_ADDR=localhost:6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_POOL_SIZE=50
```

### 其他

```env
LOG_FILE=./logs/compute-nook.log
JWT_EXPIRE_HOURS=8
DEMO_READONLY=false   # true 时禁止修改用户信息，适合演示环境
DEV_MODE=false        # true 时跳过 LDAP，使用虚拟用户
```

---

## 存储配额配置

### XFS

```bash
# /etc/fstab 挂载选项加入 uquota,gquota
/dev/sda1  /home  xfs  defaults,uquota,gquota  0 0
mount -o remount /home
xfs_quota -x -c "state" /home
```

若后端非 root 运行：

```bash
# /etc/sudoers.d/computenook
hpc-user ALL=(ALL) NOPASSWD: /usr/sbin/xfs_quota
```

### Lustre

```bash
lctl conf_param fsname.quota.mdt=ug
lctl conf_param fsname.quota.ost=ug
```

```env
QUOTA_FS_TYPE=lustre
QUOTA_PATH=/lustre/home
```

### NFS

```env
QUOTA_FS_TYPE=nfs
QUOTA_PATH=/nfs/home
```

---

## 部署

### nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /opt/computenook/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket（Web Shell）
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
[Unit]
Description=算力小筑 Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/computenook
ExecStart=/opt/computenook/computenook
EnvironmentFile=/opt/computenook/.env
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now computenook
```

---

## Bug 列表

> 修复后的 bug 会标记删除线

### 待修复
1. 远程桌面 - Xpra HTML5 客户端在部分 Chromium 版本下剪贴板同步失效
2. 文件管理 - 大文件（>2GB）上传进度条在 Safari 下不更新
3. 客户端 - Windows 建立隧道第一次可以打开，第二次异常，需手动杀掉客户端进程才能继续运行

### 待测试（需实际环境验证）
4. 作业提交 - 模板功能暂未完整测试
5. 集群监控 - 监控面板存在逻辑 bug，需实际集群环境验证
6. 网络拓扑 - 拓扑图渲染逻辑存在 bug，需实际环境测试
7. 主机资产 - 资产数据展示逻辑存在 bug，需实际环境验证
8. 客户端 - macOS、Ubuntu 客户端暂未测试

### 已知限制
9. Web Shell - 高并发连接时偶发 WebSocket 握手超时（需调大 nginx `proxy_read_timeout`）
10. 存储配额 - Lustre 配额读取依赖 `lctl`，非 root 用户需额外 sudo 配置

### 规划中
11. AI 助手 - RAG 检索使用内存 2-gram 索引，重启后需重新加载知识库
12. 报表 - 导出 Excel 时超过 10 万行数据可能导致浏览器内存溢出

### 需要资源支持
13. 需要赞助资源以做更多功能测试和环境验证


---

## 参与共建

**算力小筑**欢迎所有志同道合的伙伴加入，一起把它做得更好。

我们需要：

- **前端工程师** — Vue 3 / TypeScript，有 HPC 或科研工具使用经验更佳
- **后端工程师** — Go，熟悉 Slurm / Linux 系统管理 / 容器技术
- **系统架构师** — 有大规模集群或云原生架构经验
- **科研用户** — 计算化学、生物信息、AI/ML、CFD、物理模拟等领域，提需求、测功能、写文档都算贡献
- **运维 / DevOps** — 帮助完善部署方案、CI/CD、监控告警

无论是提 Issue、提 PR、完善文档，还是分享你的使用场景，都是对项目的贡献。

> 有意向请加 QQ 群 `2168069924`，或直接开 [Issue](../../issues) / 提 [PR](../../pulls)。

---

## 感谢

感谢以下单位和个人对本项目的支持与赞助：

### 赞助单位

| 单位 | 贡献 | 网站 |
|---|---|---|
| 天津市天河计算机技术有限公司 | 技术支持 | [tianhe-tech.com](https://www.tianhe-tech.com/) |

### 个人贡献者 / 赞助者

| 昵称 | 贡献 |
|---|---|
| 张小冬  | 设备&技术支持 |

> 如果本项目对你有帮助，欢迎 Star ⭐ 或通过 [Issues](../../issues) 反馈问题。

---

## 联系 & 赞助

<table>
  <tr>
    <td align="center">
      <b>项目发起人</b><br/>sunfx
    </td>
    <td align="center">
      <b>个人 QQ</b><br/>598824458
    </td>
    <td align="center">
      <b>技术交流群</b><br/>2168069924
    </td>
  </tr>
</table>

### 赞助项目

如果本项目对你有帮助，欢迎通过qq（搜索 `598824458`）赞助，支持持续开发 ☕

> 赞助后可备注你的名字或昵称，我们会将你加入感谢名单 🙏



---

## 开源协议

本项目基于 [MIT License](./LICENSE) 开源，欢迎自由使用、修改和分发。
