# ComputeNook 发布说明

## 📦 最新发布包

**版本**: `b5d5b64a-darwin-20260703-193605`  
**文件**: `release/computenook-b5d5b64a-darwin-20260703-193605.tar.gz`  
**大小**: 14M  
**日期**: 2026-07-03 19:36:05  

### 本次更新内容

#### ✨ 新增功能
- **作业提交表单智能脚本同步功能**
  - 表单参数修改时自动更新脚本内容中的SBATCH指令
  - 监听字段：作业名称、分区、节点数、CPU核数、内存、时间、GPU卡数、QOS
  - 脚本自动包含：作业信息输出、时间戳、hostname等基础信息
  - 时间支持小数（如1.5小时自动转换为01:30:00）
  - 内存从GB自动转换为SBATCH格式
  - GPU自动转换为--gres=gpu:N格式
  - 用户可在自动生成的脚本基础上继续手动编辑

- **分区详情查看功能**
  - 用户仪表盘分区表格增加"详情"操作按钮
  - 新增分区详情弹窗，显示完整分区信息（状态、节点数量、时间限制、节点限制等）
  - 时间和节点限制支持"无限制"标签显示

- **作业日志查看和AI分析功能**
  - 作业详情弹窗增加"查看日志"按钮
  - 新增作业日志查看弹窗，支持标准输出/错误输出切换
  - 日志内容以终端样式显示（深色背景，等宽字体）
  - 支持下载日志文件到本地
  - 集成AI分析功能：点击"AI分析问题"自动诊断日志中的错误和问题
  - AI会识别资源限制、依赖问题、代码错误等，并提供解决建议

- **作业模板查看和编辑功能**
  - 实现作业模板库的"查看"和"编辑"按钮功能
  - 添加查看模板弹窗：显示完整模板信息（资源配置、容器镜像、模块加载等）
  - 添加编辑模板弹窗：支持修改模板所有字段
  - 只有管理员或模板所有者可以编辑/删除模板

---

## 🚀 自动发布流程

### 1. Git 提交自动触发构建

每次 `git commit` 后，会自动触发构建流程（通过 Git post-commit hook）：

```bash
git add .
git commit -m "your message"
# 自动触发构建，生成 release/ 目录和压缩包
git push
```

### 2. 手动构建

如果需要手动构建发布包：

```bash
npm run release
```

## 📦 发布包内容

构建完成后，`release/` 目录包含：

```
release/
├── computenook-<version>-<platform>-<timestamp>.tar.gz       # 压缩包
├── computenook-<version>-<platform>-<timestamp>.tar.gz.sha256 # 校验和
├── computenook                   # Linux AMD64 可执行文件
├── computenook-darwin-amd64      # macOS Intel 可执行文件
├── computenook-darwin-arm64      # macOS Apple Silicon 可执行文件
├── static/                       # 前端静态文件
│   ├── index.html
│   └── assets/
├── install.sh                    # 一键安装脚本
├── .env.example                  # 环境变量配置示例
├── nginx.conf                    # Nginx 反向代理配置
├── computenook.service           # systemd 服务文件
├── data/                         # 数据目录
├── logs/                         # 日志目录
├── VERSION.txt                   # 版本信息
└── README.md                     # 安装说明
```

## 📤 分发安装包

将 `release/` 目录下的 `.tar.gz` 文件分发给用户：

```bash
# 压缩包位置
release/computenook-<version>-<platform>-<timestamp>.tar.gz

# 校验和
release/computenook-<version>-<platform>-<timestamp>.tar.gz.sha256
```

## 💾 用户安装步骤

### 快速安装（推荐）

```bash
# 1. 解压安装包
tar -xzf computenook-*.tar.gz
cd computenook/

# 2. 编辑配置
cp .env.example .env
vi .env  # 修改数据库、端口等配置

# 3. 运行安装脚本
sudo ./install.sh

# 4. 查看服务状态
sudo systemctl status computenook
```

### 手动安装

```bash
# 1. 解压到指定目录
sudo mkdir -p /opt/computenook
sudo tar -xzf computenook-*.tar.gz -C /opt/ --strip-components=1

# 2. 配置环境
cd /opt/computenook
sudo cp .env.example .env
sudo vi .env

# 3. 配置 systemd 服务
sudo cp computenook.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable computenook
sudo systemctl start computenook

# 4. 配置 Nginx（可选）
sudo cp nginx.conf /etc/nginx/conf.d/computenook.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 🔄 升级流程

```bash
# 1. 停止服务
sudo systemctl stop computenook

# 2. 备份
sudo cp /opt/computenook/computenook /opt/computenook/computenook.bak
sudo cp /opt/computenook/.env /opt/computenook/.env.bak

# 3. 解压新版本
sudo tar -xzf computenook-*.tar.gz
cd computenook/
sudo cp computenook /opt/computenook/
sudo cp -r static /opt/computenook/

# 4. 重启服务
sudo systemctl start computenook
```

## 🛠️ 开发说明

### 构建脚本位置

- **主脚本**: `scripts/build-release.sh`
- **Git Hook**: `.git/hooks/post-commit`
- **前端配置**: `frontend/vite.config.release.ts`

### 修改构建流程

编辑 `scripts/build-release.sh` 文件，根据需要调整：

- 编译参数
- 文件复制逻辑
- 压缩包命名
- 版本号生成

### 禁用自动构建

如果不需要每次提交都自动构建：

```bash
# 删除或重命名 Git hook
rm .git/hooks/post-commit
# 或
mv .git/hooks/post-commit .git/hooks/post-commit.disabled
```

### 重新启用自动构建

```bash
npm run setup-hooks
```

## 🔍 故障排查

### 构建失败

```bash
# 查看详细错误
npm run release

# 检查 Go 环境
go version

# 检查 Node 环境
node --version
npm --version
```

### 压缩包损坏

```bash
# 验证校验和
sha256sum -c computenook-*.tar.gz.sha256

# 测试解压
tar -tzf computenook-*.tar.gz | head -20
```

### Git hook 不工作

```bash
# 检查 hook 权限
ls -la .git/hooks/post-commit

# 添加执行权限
chmod +x .git/hooks/post-commit

# 手动测试 hook
.git/hooks/post-commit
```

## 📊 版本管理

### 创建版本标签

```bash
# 创建版本标签
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# 构建会自动使用 tag 作为版本号
npm run release
# 生成: computenook-v1.0.0-*.tar.gz
```

### 查看版本历史

```bash
# 查看所有标签
git tag -l

# 查看当前版本
git describe --tags --always
```

## 📝 发布检查清单

发布新版本前的检查项：

- [ ] 所有功能测试通过
- [ ] 前端构建无错误
- [ ] 后端编译成功（多平台）
- [ ] 配置文件更新（.env.example）
- [ ] 更新 CHANGELOG.md
- [ ] 创建版本标签
- [ ] 生成发布包
- [ ] 验证压缩包完整性
- [ ] 测试安装流程
- [ ] 更新文档

## 🔗 相关文件

- `package.json` - 根目录构建脚本
- `frontend/package.json` - 前端构建脚本
- `scripts/build-release.sh` - 发布构建主脚本
- `scripts/install.sh` - 用户安装脚本
- `.gitignore` - release/ 目录已被忽略
