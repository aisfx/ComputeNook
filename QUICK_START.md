# Web Shell 快速启动指南

## 🚀 5分钟快速开始

### 1️⃣ 启动后端服务

```bash
cd slurm-web/backend
go run main.go
```

**确认启动成功**: 看到以下日志
```
Server starting on port 8080
API Documentation: http://localhost:8080/api
Listening and serving HTTP on :8080
```

### 2️⃣ 启动前端服务

```bash
cd slurm-web/hpcweb
npm run dev
```

**访问地址**: http://localhost:3000

### 3️⃣ 使用Web Shell

1. **登录系统** (开发模式自动登录为admin)
2. **上传SSH私钥**
   - 点击 "🔑 上传密钥"
   - 选择你的私钥文件 (通常是 `~/.ssh/id_rsa`)
3. **选择节点连接**
   - 点击 "📡 选择节点"
   - 选择一个可用节点
   - 开始使用终端

## ⚙️ 配置检查清单

### 必须配置项

- [ ] `.env` 文件中 `DEV_MODE=true` (开发环境)
- [ ] `WEBSHELL_NODES` 配置了至少一个节点
- [ ] 节点配置是单行JSON格式
- [ ] 后端运行在 8080 端口
- [ ] 前端运行在 3000 端口

### 节点配置示例

```bash
WEBSHELL_NODES=[{"name":"login-node","host":"192.168.5.250","port":22,"description":"登录节点","enabled":true}]
```

## 🔧 常见问题快速修复

### 问题: "User not authenticated"
**解决**: 确认 `.env` 中 `DEV_MODE=true`

### 问题: "Unexpected token '<'"
**解决**: 确认后端服务正在运行

### 问题: 无法连接节点
**解决**: 
1. 检查节点配置是否正确
2. 确认已上传SSH私钥
3. 验证公钥已添加到目标节点

## 📝 测试API

### 测试节点列表
```bash
curl http://localhost:8080/api/webshell/nodes
```

### 测试上传密钥
打开浏览器访问: `file:///path/to/slurm-web/test-webshell.html`

## 📚 更多文档

- 完整使用指南: `WEBSHELL_GUIDE.md`
- 问题修复总结: `WEBSHELL_FIX_SUMMARY.md`
- API文档: http://localhost:8080/api

## 🎯 生产环境部署

**重要**: 部署到生产环境前，必须修改 `.env`:

```bash
DEV_MODE=false
JWT_SECRET=your-strong-random-secret
```

然后重启后端服务。
