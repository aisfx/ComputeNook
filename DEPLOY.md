# 容器作业识别功能 - 部署说明

## 📋 修改内容

### 1. 后端修改
**文件：** `backend/slurm/job.go`
- ✅ 增强 `IsContainerJob()` 函数 - 支持三种识别方式
- ✅ 增强 `GetContainerImage()` 函数 - 支持多种镜像获取方式

### 2. 前端修改
**文件：** `frontend/src/pages/user/jobs/index.tsx`
- ✅ 修复容器作业脚本生成逻辑
- ✅ 完善容器模板应用功能
- ✅ 增强容器作业标识和进入容器按钮

## 🚀 部署步骤

### 方案 A：本地编译后部署到服务器

```bash
# 1. 在本地编译后端
cd /Users/sunfx/workspace/ComputeNook/backend
go build -o computenook

# 2. 停止远程服务器上的后端服务
ssh root@192.168.18.150 "systemctl stop computenook"
# 或
ssh root@192.168.18.150 "pkill -f computenook"

# 3. 备份旧的二进制文件
ssh root@192.168.18.150 "cp /path/to/computenook /path/to/computenook.backup"

# 4. 上传新的二进制文件
scp computenook root@192.168.18.150:/path/to/computenook

# 5. 重启服务
ssh root@192.168.18.150 "systemctl start computenook"
# 或
ssh root@192.168.18.150 "cd /path/to && ./computenook &"
```

### 方案 B：直接在服务器上编译

```bash
# 1. SSH 登录到服务器
ssh root@192.168.18.150

# 2. 进入项目目录
cd /path/to/ComputeNook/backend

# 3. 备份当前代码
cp slurm/job.go slurm/job.go.backup

# 4. 更新代码（上传修改后的 job.go 文件）
# 可以使用 scp 或者直接编辑

# 5. 编译
go build -o computenook

# 6. 停止旧服务
systemctl stop computenook
# 或
pkill -f computenook

# 7. 启动新服务
systemctl start computenook
# 或
./computenook &
```

### 方案 C：使用 Git 同步代码

```bash
# 1. 提交本地修改
cd /Users/sunfx/workspace/ComputeNook
git add backend/slurm/job.go frontend/src/pages/user/jobs/index.tsx
git commit -m "增强容器作业识别和修复脚本生成"
git push

# 2. 在服务器上拉取更新
ssh root@192.168.18.150
cd /path/to/ComputeNook
git pull

# 3. 重新编译和重启后端
cd backend
go build -o computenook
systemctl restart computenook

# 4. 重新构建和部署前端
cd ../frontend
npm run build
# 复制 dist 目录到 nginx/apache 服务器
```

## 📝 验证步骤

### 1. 检查后端API
```bash
# 登录并获取 token
TOKEN=$(curl -s -X POST http://192.168.18.150:8081/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  | jq -r '.token')

# 查看作业列表，检查是否有 is_container 字段
curl -s -X GET "http://192.168.18.150:8081/api/jobs?page=1&page_size=5" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.data[] | {job_id, name, is_container, container_image}'
```

### 2. 检查前端
- 刷新浏览器（Cmd+Shift+R 强制刷新）
- 查看容器作业是否显示 🐳 标识
- 检查"进入容器"按钮是否显示
- 测试容器筛选功能

## ⚠️ 注意事项

1. **后端部署后必须重启服务**才能生效
2. **前端需要清除缓存**才能看到最新代码
3. 确保远程服务器上有 Go 编译环境
4. 备份重要数据和配置文件
5. 检查服务器上的项目路径是否正确

## 🔍 故障排查

### 问题：API 还是没有返回 is_container 字段

**可能原因：**
1. 后端服务没有重启
2. 使用了错误的二进制文件
3. 代码没有正确部署

**解决方案：**
```bash
# 检查运行中的进程
ps aux | grep computenook

# 查看进程启动时间和路径
ls -la /proc/$(pgrep computenook)/exe

# 检查二进制文件的编译时间
ls -l /path/to/computenook

# 强制重启服务
killall -9 computenook
./computenook &
```

### 问题：前端还是看不到容器标识

**可能原因：**
1. 浏览器缓存
2. 前端代码没有重新构建
3. 使用了旧的静态文件

**解决方案：**
- 清除浏览器缓存（Cmd+Shift+Delete）
- 强制刷新页面（Cmd+Shift+R）
- 重新构建前端：`npm run build`
- 检查 nginx/apache 配置的静态文件路径

## 📞 联系信息

如果部署过程中遇到问题，请检查：
1. 后端日志：`tail -f /path/to/logs/backend.log`
2. 前端控制台：浏览器开发者工具 Console
3. 网络请求：浏览器开发者工具 Network

