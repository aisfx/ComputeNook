# 前后端API对应关系文档

## 修复的API不匹配问题

### 1. 文件管理 API
**问题**: 前端使用 `/filemanager/*` 但后端定义的是 `/files/*`

**解决方案**: 在后端添加 `/filemanager/*` 别名路由

```go
// 主路由
files := auth.Group("/files") { ... }

// 别名路由(兼容前端)
filemanager := auth.Group("/filemanager") {
    filemanager.GET("/list", handlers.ListDirectory)
    filemanager.GET("/read", handlers.ReadFile)
    filemanager.GET("/download", handlers.DownloadFile)
    filemanager.POST("/write", handlers.WriteFile)
    filemanager.POST("/upload", handlers.UploadFile)
    filemanager.DELETE("/delete", handlers.DeleteFile)
    filemanager.POST("/mkdir", handlers.CreateDirectory)
    filemanager.POST("/rename", handlers.RenameFile)
    filemanager.POST("/copy", handlers.CopyFile)
}
```

前端调用:
```typescript
axios.get('/filemanager/list', { params: { path: targetPath } })
axios.post('/filemanager/write', { path, content })
axios.delete('/filemanager/delete', { params: { path } })
```

### 2. WebShell 密钥管理 API
**问题**: 前端使用简化路径,后端使用完整路径

**解决方案**: 添加别名路由

```go
webshell.GET("/keys/check", handlers.CheckPrivateKey)
webshell.GET("/has-key", handlers.CheckPrivateKey) // 别名

webshell.POST("/keys/upload", handlers.UploadPrivateKey)
webshell.POST("/upload-key", handlers.UploadPrivateKey) // 别名

webshell.POST("/keys/generate", handlers.GenerateKeyPair)
webshell.POST("/generate-key", handlers.GenerateKeyPair) // 别名
```

前端调用:
```typescript
await axios.get('/webshell/has-key')
await axios.post('/webshell/upload-key', formData)
await axios.post('/webshell/generate-key')
```

## 完整的API路由映射

### 用户认证 (公开路由)
| 前端调用 | 后端路由 | 说明 |
|---------|---------|------|
| POST `/api/login` | POST `/api/login` | ✅ 登录 |
| GET `/api/captcha/new` | GET `/api/captcha/new` | ✅ 获取验证码 |
| POST `/api/mfa/verify-login` | POST `/api/mfa/verify-login` | ✅ MFA验证 |

### 用户信息 (需认证)
| 前端调用 | 后端路由 | 说明 |
|---------|---------|------|
| GET `/api/me` | GET `/api/me` | ✅ 当前用户信息 |
| POST `/api/profile/change-password` | POST `/api/profile/change-password` | ✅ 修改密码 |
| PUT `/api/profile` | PUT `/api/profile` | ✅ 更新个人资料 |

### 文件管理 (需认证)
| 前端调用 | 后端路由 | 说明 |
|---------|---------|------|
| GET `/api/filemanager/list` | GET `/api/filemanager/list` | ✅ 列出目录 |
| GET `/api/filemanager/read` | GET `/api/filemanager/read` | ✅ 读取文件 |
| GET `/api/filemanager/download` | GET `/api/filemanager/download` | ✅ 下载文件 |
| POST `/api/filemanager/write` | POST `/api/filemanager/write` | ✅ 写入文件 |
| POST `/api/filemanager/upload` | POST `/api/filemanager/upload` | ✅ 上传文件 |
| DELETE `/api/filemanager/delete` | DELETE `/api/filemanager/delete` | ✅ 删除文件 |
| POST `/api/filemanager/mkdir` | POST `/api/filemanager/mkdir` | ✅ 创建目录 |
| POST `/api/filemanager/rename` | POST `/api/filemanager/rename` | ✅ 重命名 |

### 作业管理 (需认证)
| 前端调用 | 后端路由 | 说明 |
|---------|---------|------|
| GET `/api/jobs` | GET `/api/jobs` | ✅ 获取作业列表 |
| GET `/api/jobs/:id` | GET `/api/jobs/:id` | ✅ 获取作业详情 |
| POST `/api/jobs` | POST `/api/jobs` | ✅ 提交作业 |
| DELETE `/api/jobs/:id` | DELETE `/api/jobs/:id` | ✅ 取消作业 |
| POST `/api/jobs/:id/suspend` | POST `/api/jobs/:id/suspend` | ✅ 暂停作业 |
| POST `/api/jobs/:id/resume` | POST `/api/jobs/:id/resume` | ✅ 恢复作业 |
| GET `/api/jobs/partitions/list` | GET `/api/jobs/partitions/list` | ✅ 获取分区列表 |

### WebShell (需认证)
| 前端调用 | 后端路由 | 说明 |
|---------|---------|------|
| GET `/api/webshell/nodes` | GET `/api/webshell/nodes` | ✅ 获取节点列表 |
| GET `/api/webshell/has-key` | GET `/api/webshell/has-key` | ✅ 检查私钥 |
| POST `/api/webshell/upload-key` | POST `/api/webshell/upload-key` | ✅ 上传私钥 |
| POST `/api/webshell/generate-key` | POST `/api/webshell/generate-key` | ✅ 生成密钥 |
| WS `/api/webshell/connect` | WS `/api/webshell/connect` | ✅ WebSocket连接 |

### 远程桌面 (需认证)
| 前端调用 | 后端路由 | 说明 |
|---------|---------|------|
| GET `/api/desktop/sessions` | GET `/api/desktop/sessions` | ✅ 获取会话列表 |
| POST `/api/desktop/sessions` | POST `/api/desktop/sessions` | ✅ 创建会话 |
| POST `/api/desktop/sessions/:id/start` | POST `/api/desktop/sessions/:id/start` | ✅ 启动会话 |
| POST `/api/desktop/sessions/:id/stop` | POST `/api/desktop/sessions/:id/stop` | ✅ 停止会话 |
| DELETE `/api/desktop/sessions/:id` | DELETE `/api/desktop/sessions/:id` | ✅ 删除会话 |
| GET `/api/desktop/sessions/:id/status` | GET `/api/desktop/sessions/:id/status` | ✅ 获取状态 |
| GET `/api/desktop/sessions/:id/script` | GET `/api/desktop/sessions/:id/script` | ✅ 获取脚本 |
| GET `/api/desktop/sessions/:id/logs` | GET `/api/desktop/sessions/:id/logs` | ✅ 获取日志 |
| GET `/api/desktop/resource-presets` | GET `/api/desktop/resource-presets` | ✅ 资源预设 |
| GET `/api/desktop/apps` | GET `/api/desktop/apps` | ✅ 获取应用列表 |
| POST `/api/desktop/apps` | POST `/api/desktop/apps` | ✅ 创建应用 |
| DELETE `/api/desktop/apps/:id` | DELETE `/api/desktop/apps/:id` | ✅ 删除应用 |
| POST `/api/desktop/cleanup` | POST `/api/desktop/cleanup` | ✅ 清理空间 |

### 仪表盘 (需认证)
| 前端调用 | 后端路由 | 说明 |
|---------|---------|------|
| GET `/api/dashboard/stats` | GET `/api/dashboard/stats` | ✅ 统计数据 |
| GET `/api/dashboard/nodes` | GET `/api/dashboard/nodes` | ✅ 节点信息 |

### 报表中心 (需认证)
| 前端调用 | 后端路由 | 说明 |
|---------|---------|------|
| GET `/api/reports/jobs` | GET `/api/reports/jobs` | ✅ 作业统计 |
| GET `/api/reports/usage` | GET `/api/reports/usage` | ✅ 核时使用统计 |
| GET `/api/reports/storage` | GET `/api/reports/storage` | ✅ 存储配额统计 |
| GET `/api/reports/quota` | GET `/api/reports/quota` | ✅ 账户配额统计 |
| GET `/api/reports/qos-usage` | GET `/api/reports/qos-usage` | ✅ QoS使用统计 |

### AI助手 (需认证)
| 前端调用 | 后端路由 | 说明 |
|---------|---------|------|
| POST `/api/ai/chat` | POST `/api/ai/chat` | ✅ AI对话 |
| POST `/api/ai/admin/chat` | POST `/api/ai/admin/chat` | ✅ 管理员AI对话 |

### 用户管理 (需管理员)
| 前端调用 | 后端路由 | 说明 |
|---------|---------|------|
| GET `/api/users` | GET `/api/users` | ✅ 获取用户列表 |
| GET `/api/users/:username` | GET `/api/users/:username` | ✅ 获取用户详情 |
| POST `/api/users` | POST `/api/users` | ✅ 创建用户 |
| PUT `/api/users/:username` | PUT `/api/users/:username` | ✅ 更新用户 |
| DELETE `/api/users/:username` | DELETE `/api/users/:username` | ✅ 删除用户 |

### 用户组管理 (需管理员)
| 前端调用 | 后端路由 | 说明 |
|---------|---------|------|
| GET `/api/groups` | GET `/api/groups` | ✅ 获取用户组列表 |
| POST `/api/groups` | POST `/api/groups` | ✅ 创建用户组 |
| PUT `/api/groups/:gid` | PUT `/api/groups/:gid` | ✅ 更新用户组 |
| DELETE `/api/groups/:gid` | DELETE `/api/groups/:gid` | ✅ 删除用户组 |

### Slurm账户管理 (需管理员)
| 前端调用 | 后端路由 | 说明 |
|---------|---------|------|
| GET `/api/slurm/accounts` | GET `/api/slurm/accounts` | ✅ 获取账户列表 |
| POST `/api/slurm/accounts` | POST `/api/slurm/accounts` | ✅ 创建账户 |
| PUT `/api/slurm/accounts/:name` | PUT `/api/slurm/accounts/:name` | ✅ 更新账户 |
| DELETE `/api/slurm/accounts/:name` | DELETE `/api/slurm/accounts/:name` | ✅ 删除账户 |

### Slurm用户管理 (需管理员)
| 前端调用 | 后端路由 | 说明 |
|---------|---------|------|
| GET `/api/slurm/users` | GET `/api/slurm/users` | ✅ 获取用户列表 |
| POST `/api/slurm/users` | POST `/api/slurm/users` | ✅ 创建用户 |
| PUT `/api/slurm/users/:name` | PUT `/api/slurm/users/:name` | ✅ 更新用户 |
| DELETE `/api/slurm/users/:name` | DELETE `/api/slurm/users/:name` | ✅ 删除用户 |

### QoS管理 (需管理员)
| 前端调用 | 后端路由 | 说明 |
|---------|---------|------|
| GET `/api/qos` | GET `/api/qos` | ✅ 获取QoS列表 |
| GET `/api/qos/:name` | GET `/api/qos/:name` | ✅ 获取QoS详情 |
| POST `/api/qos` | POST `/api/qos` | ✅ 创建QoS |
| PUT `/api/qos/:name` | PUT `/api/qos/:name` | ✅ 更新QoS |
| DELETE `/api/qos/:name` | DELETE `/api/qos/:name` | ✅ 删除QoS |

### 分区管理 (需管理员)
| 前端调用 | 后端路由 | 说明 |
|---------|---------|------|
| GET `/api/partitions` | GET `/api/partitions` | ✅ 获取分区列表 |
| POST `/api/partitions` | POST `/api/partitions` | ✅ 创建分区 |
| PUT `/api/partitions/:name` | PUT `/api/partitions/:name` | ✅ 更新分区 |
| DELETE `/api/partitions/:name` | DELETE `/api/partitions/:name` | ✅ 删除分区 |

### 资源绑定管理 (需管理员)
| 前端调用 | 后端路由 | 说明 |
|---------|---------|------|
| GET `/api/slurm/associations` | GET `/api/slurm/associations` | ✅ 获取绑定列表 |
| POST `/api/slurm/associations` | POST `/api/slurm/associations` | ✅ 创建绑定 |
| PUT `/api/slurm/associations` | PUT `/api/slurm/associations` | ✅ 更新绑定 |
| DELETE `/api/slurm/associations` | DELETE `/api/slurm/associations` | ✅ 删除绑定 |

### 机时管理 (需管理员)
| 前端调用 | 后端路由 | 说明 |
|---------|---------|------|
| GET `/api/billing/v2/accounts` | GET `/api/billing/v2/accounts` | ✅ 获取机时账户 |
| POST `/api/billing/v2/recharge` | POST `/api/billing/v2/recharge` | ✅ 充值 |
| GET `/api/billing/v2/recharge/records` | GET `/api/billing/v2/recharge/records` | ✅ 充值记录 |
| POST `/api/billing/v2/sync` | POST `/api/billing/v2/sync` | ✅ 同步Slurm数据 |

### 存储配额管理 (需管理员)
| 前端调用 | 后端路由 | 说明 |
|---------|---------|------|
| GET `/api/files/quota` | GET `/api/files/quota` | ✅ 获取配额 |
| POST `/api/files/quota` | POST `/api/files/quota` | ✅ 设置配额 |
| GET `/api/files/quota/all` | GET `/api/files/quota/all` | ✅ 获取所有配额 |

### 审计日志 (需管理员)
| 前端调用 | 后端路由 | 说明 |
|---------|---------|------|
| GET `/api/audit/logs` | GET `/api/audit/logs` | ✅ 获取审计日志 |
| GET `/api/audit/stats` | GET `/api/audit/stats` | ✅ 审计统计 |
| GET `/api/audit/ssh-logs` | GET `/api/audit/ssh-logs` | ✅ SSH日志 |

## 不在菜单中但存在的页面

### 用户页面
- `/dashboard/monitoring` - 监控页面 (未在菜单中,但页面文件存在)
- `/dashboard/ai` - AI助手页面 (未在菜单中,但页面文件存在)
- `/dashboard/profile` - 个人信息 (在用户头像下拉菜单中)
- `/dashboard/download` - 客户端下载 (在header中)

### 建议
1. **monitoring页面**: 如果需要,可以添加到用户菜单
2. **ai页面**: 已通过悬浮窗方式提供,不需要菜单项

## 已移除的功能
- ❌ CMDB主机资产管理 - 前后端都已移除

## 测试清单
- [ ] 文件管理所有操作正常
- [ ] WebShell密钥管理正常
- [ ] 作业提交和管理正常
- [ ] 远程桌面创建和连接正常
- [ ] 报表中心查询和导出正常
- [ ] 管理员用户管理正常
- [ ] 管理员账户管理正常
- [ ] 管理员QoS管理正常
- [ ] 管理员分区管理正常
- [ ] 管理员资源绑定正常
- [ ] 管理员机时管理正常
- [ ] 管理员审计日志正常

## 更新日期
2026-07-01
