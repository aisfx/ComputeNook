# 后端 API 完整参考

## 认证机制

所有需要认证的接口在 Header 中携带：
```
Authorization: Bearer <JWT_TOKEN>
```

Token 存储在 `localStorage.token` 或 `sessionStorage.token`。

## 公开接口（无需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/login | 登录，返回 token + user |
| POST | /api/mfa/verify-login | MFA 第二步验证 |
| POST | /api/mfa/setup | 生成 MFA 密钥+二维码 |
| POST | /api/mfa/confirm | 确认 MFA 绑定 |
| GET  | /api/captcha/new | 获取验证码 ID |
| GET  | /api/captcha/:id | 获取验证码图片 |
| GET  | /config.js | 前端运行时配置注入 |
| GET  | /api | API 文档页面 |

### 登录请求/响应
```json
// POST /api/login
{ "username": "admin", "password": "xxx", "captchaId": "", "captchaVal": "", "rememberMe": false }

// 响应
{ "token": "eyJ...", "user": { "username": "admin", "cnName": "管理员", "isAdmin": true, ... } }
// MFA 场景下返回
{ "mfa_required": true, "temp_token": "xxx" }
```

## 用户与认证接口（需登录）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/me | 普通用户 | 获取当前用户信息 |
| GET | /api/me/resources | 普通用户 | 获取当前用户资源配额 |
| GET | /api/me/billing | 普通用户 | 获取机时余额 |
| POST | /api/logout | 普通用户 | 退出登录 |
| POST | /api/profile/change-password | 普通用户 | 修改密码（需旧密码） |
| PUT | /api/profile | 普通用户 | 更新个人信息(cnName/email/phone) |
| GET | /api/mfa/status | 普通用户 | 获取 MFA 绑定状态 |
| DELETE | /api/mfa | 普通用户 | 禁用 MFA（需 TOTP code） |
| POST | /api/mfa/setup-auth | 普通用户 | 已登录用户自助绑定 MFA |
| POST | /api/mfa/confirm-auth | 普通用户 | 已登录用户确认 MFA 绑定 |

## 用户管理（管理员）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/users | 获取所有 LDAP 用户 |
| GET | /api/users/next-uid | 获取下一可用 UID |
| GET | /api/users/:username | 获取单个用户 |
| POST | /api/users | 创建用户 |
| PUT | /api/users/:username | 更新用户 |
| DELETE | /api/users/:username | 删除用户 |
| POST | /api/users/:username/reset-password | 重置密码 |
| POST | /api/users/:username/set-disabled | 禁用/启用用户 |
| POST | /api/users/:username/set-password-must-change | 强制修改密码标记 |

### 用户结构（models.User）
```json
{
  "username": "zhangsan",
  "uid": 1001,
  "gid": 1001,
  "cnName": "张三",
  "email": "zhangsan@example.com",
  "phone": "13800000000",
  "shell": "/bin/bash",
  "homeDir": "/home/zhangsan",
  "groups": ["users", "hpc"],
  "isAdmin": false,
  "disabled": false,
  "passwordMustChange": false
}
```

## 用户组管理（管理员）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/groups | 获取所有 LDAP 用户组 |
| GET | /api/groups/next-gid | 获取下一可用 GID |
| GET | /api/groups/:gid | 获取单个用户组 |
| POST | /api/groups | 创建用户组 |
| PUT | /api/groups/:gid | 更新用户组 |
| DELETE | /api/groups/:gid | 删除用户组 |

## Slurm 账户管理（管理员）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/slurm/accounts | 获取所有 Slurm 账户 |
| GET | /api/slurm/accounts/:name | 获取单个账户 |
| POST | /api/slurm/accounts | 创建账户 |
| PUT | /api/slurm/accounts/:name | 更新账户 |
| DELETE | /api/slurm/accounts/:name | 删除账户 |

## Slurm 用户管理（管理员）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/slurm/users | 获取所有 Slurm 用户 |
| GET | /api/slurm/users/:name | 获取单个 Slurm 用户 |
| POST | /api/slurm/users | 创建 Slurm 用户 |
| PUT | /api/slurm/users/:name | 更新 Slurm 用户 |
| DELETE | /api/slurm/users/:name | 删除 Slurm 用户 |

## 资源绑定 Association（管理员）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/slurm/associations | 获取所有绑定（?account=&user=&cluster=） |
| GET | /api/slurm/associations/single | 获取单个绑定 |
| POST | /api/slurm/associations | 创建绑定 |
| PUT | /api/slurm/associations | 更新绑定（query params 定位） |
| DELETE | /api/slurm/associations | 删除绑定（query params 定位） |

## QoS 管理

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/qos | 普通用户 | 获取所有 QoS（缓存5分钟） |
| GET | /api/qos/:name | 普通用户 | 获取单个 QoS |
| POST | /api/qos | 管理员 | 创建 QoS |
| PUT | /api/qos/:name | 管理员 | 更新 QoS |
| DELETE | /api/qos/:name | 管理员 | 删除 QoS |

### QoS 字段说明
```json
{
  "name": "normal",
  "description": "普通优先级",
  "priority": 100,
  "max_jobs_pu": 100,
  "max_submit_pu": 200,
  "max_wall_pj": 1440,
  "max_wall_pu": 10080,
  "max_nodes_pu": 10,
  "max_cpus_pu": 128,
  "max_gpus_pu": 4,
  "max_tres_pu": "gres/gpu=4,mem=256G",
  "grp_tres_mins": "1000000",
  "min_cpus_pj": 1,
  "min_nodes_pj": 1,
  "min_tres_pj": "gres/gpu=1",
  "preempt": ["low"],
  "preempt_mode": "requeue",
  "preempt_exempt_time": 3600,
  "usage_factor": 1.0,
  "usage_threshold": 0.8
}
```

> **注意**：`preempt` 字段前端发送 `[]string`，但 Slurm API 返回时是对象
> `{"list": [...], "mode": "..."}` — Go 端使用 `interface{}` 处理兼容性。

## 机时管理（Billing）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | /api/billing/recharge | 管理员 | 旧接口：按 QoS 充值 |
| GET | /api/billing/recharge/history | 管理员 | 充值历史 |
| GET | /api/billing/v2/accounts | 管理员 | 机时账户列表 |
| POST | /api/billing/v2/recharge | 管理员 | 新充值接口 |
| GET | /api/billing/v2/recharge/records | 管理员 | 充值记录 |
| GET | /api/billing/v2/records | 管理员 | 消费记录 |
| POST | /api/billing/v2/sync | 管理员 | 从 Slurm 同步机时数据 |

## 作业管理

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/jobs | 普通用户 | 获取作业列表（?user= 过滤） |
| GET | /api/jobs/:id | 普通用户 | 获取作业详情 |
| POST | /api/jobs | 普通用户 | 提交作业 |
| DELETE | /api/jobs/:id | 普通用户 | 取消作业 |
| POST | /api/jobs/:id/suspend | 普通用户 | 暂停作业 |
| POST | /api/jobs/:id/resume | 普通用户 | 恢复作业 |
| GET | /api/jobs/partitions/list | 普通用户 | 获取可用分区列表（缓存5分钟）|

## 机时使用统计

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/usage/user | 普通用户 | 查看自己的机时使用（?user=&start_time=&end_time=） |
| GET | /api/usage/account | 管理员 | 账户机时使用 |
| GET | /api/usage/account/user | 管理员 | 用户在账户下的使用 |
| GET | /api/usage/accounts | 管理员 | 所有账户使用情况 |
| GET | /api/usage/all-records | 管理员 | 所有用户使用记录 |
| GET | /api/usage/summary | 管理员 | 使用汇总 |
| GET | /api/usage/cluster | 管理员 | 集群整体使用情况 |

## 文件管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/files/list | 列出目录（?path=） |
| GET | /api/files/info | 获取文件信息 |
| GET | /api/files/read | 读取文件内容 |
| GET | /api/files/download | 下载文件 |
| POST | /api/files/write | 写入文件 |
| POST | /api/files/upload | 上传文件（multipart） |
| DELETE | /api/files/delete | 删除文件 |
| POST | /api/files/mkdir | 创建目录 |
| POST | /api/files/rename | 重命名/移动 |
| POST | /api/files/copy | 复制文件 |
| GET | /api/files/quota | 获取当前用户配额 |
| GET | /api/files/quota/fsinfo | 获取文件系统信息 |
| GET | /api/files/quota/all | 获取所有用户配额（管理员） |
| POST | /api/files/quota | 设置用户配额（管理员） |
| GET | /api/files/compress | 压缩下载（?path=） |

> 基础路径由 `FILEMANAGER_BASE_PATH` / `HOME_BASE_PATH` 控制，默认 `/home`。

## Web Shell

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/webshell/nodes | 获取可连接节点列表 |
| GET | /api/webshell/connect | WebSocket 连接（升级协议） |
| GET | /api/webshell/sessions | 获取活跃会话 |
| DELETE | /api/webshell/sessions/:session_id | 关闭会话 |
| GET | /api/webshell/logs | 获取会话日志列表 |
| GET | /api/webshell/logs/:log_file/download | 下载会话日志 |
| GET | /api/webshell/keys/check | 检查私钥是否存在 |
| POST | /api/webshell/keys/upload | 上传私钥 |
| POST | /api/webshell/keys/generate | 生成密钥对 |
| POST | /api/webshell/keys/deploy | 部署公钥到节点 |
| POST | /api/webshell/nodes/:node_name/test | 测试节点 SSH 连接 |

节点配置来自环境变量 `WEBSHELL_NODES`（JSON 数组）：
```json
[{"name":"ln0","host":"192.168.1.1","port":22,"description":"登录节点","enabled":true}]
```

## 远程桌面

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/desktop/sessions | 获取桌面会话列表 |
| POST | /api/desktop/sessions | 创建桌面会话 |
| POST | /api/desktop/sessions/:id/start | 启动会话（提交 Slurm 作业） |
| POST | /api/desktop/sessions/:id/stop | 停止会话 |
| GET | /api/desktop/sessions/:id/status | 查询会话状态 |
| DELETE | /api/desktop/sessions/:id | 删除会话 |
| GET | /api/desktop/sessions/:id/logs | 获取会话日志 |
| GET | /api/desktop/sessions/:id/script | 获取启动脚本 |
| GET | /api/desktop/sessions/:id/vnc-ws | VNC WebSocket 代理 |
| GET | /api/desktop/sessions/:id/xpra-ws | Xpra WebSocket 代理 |
| GET | /api/desktop/sessions/:id/xpra-html/* | Xpra HTML5 反代（无需JWT） |
| GET | /api/desktop/resource-presets | 资源预设列表 |
| POST | /api/desktop/cleanup | 清理用户空间 |
| GET | /api/desktop/apps | 应用列表 |
| POST | /api/desktop/apps | 创建应用 |
| DELETE | /api/desktop/apps/:id | 删除应用 |
| GET | /api/ssh/proxy | SSH WebSocket 隧道 |

## 仪表盘 & 监控

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/dashboard/stats | 普通用户 | 集群统计（缓存30s） |
| GET | /api/dashboard/nodes | 普通用户 | 节点状态（缓存30s） |
| GET | /api/user/dashboards | 普通用户 | 获取自定义看板配置 |
| POST | /api/user/dashboards | 普通用户 | 保存自定义看板配置 |
| GET | /api/monitoring/metrics | 管理员 | 节点指标（缓存15s） |
| GET | /api/monitoring/overview | 管理员 | 监控总览 |
| GET | /api/monitoring/node-metrics | 管理员 | Node Exporter 指标 |
| GET | /api/monitoring/local-metrics | 管理员 | 本机指标 |
| GET | /api/monitoring/mgmt-services | 管理员 | 管理服务状态 |
| GET | /api/monitoring/rack | 管理员 | 机柜布局 |
| POST | /api/monitoring/rack | 管理员 | 创建机柜 |
| PUT | /api/monitoring/rack/:id | 管理员 | 更新机柜 |
| DELETE | /api/monitoring/rack/:id | 管理员 | 删除机柜 |
| POST | /api/monitoring/rack/auto | 管理员 | 自动生成机柜 |
| GET | /api/monitoring/prom-alerts | 管理员 | Prometheus 告警 |
| GET | /api/monitoring/prom-targets | 管理员 | Prometheus 采集目标 |
| GET | /api/monitoring/prom-rules | 管理员 | 告警规则 |
| GET | /api/monitoring/promql | 管理员 | PromQL 即时查询 |
| GET | /api/monitoring/promql/range | 管理员 | PromQL 范围查询 |

## 分区配置（管理员）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/partitions | 获取所有分区配置 |
| GET | /api/partitions/:name | 获取单个分区 |
| POST | /api/partitions | 创建分区 |
| PUT | /api/partitions/:name | 更新分区 |
| DELETE | /api/partitions/:name | 删除分区 |
| POST | /api/partitions/generate | 生成 partition.conf |
| POST | /api/partitions/apply | 应用分区配置到 Slurm |
| POST | /api/partitions/reload | scontrol reconfigure |
| POST | /api/partitions/restart | 重启 slurmctld |
| GET | /api/partitions/export | 导出配置（JSON） |
| POST | /api/partitions/import | 导入配置（JSON） |
| POST | /api/partitions/import-conf | 从 partition.conf 导入 |

## 其他接口

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/reports/jobs | 普通用户 | 作业统计报表 |
| GET | /api/reports/usage | 普通用户 | 使用量报表 |
| GET | /api/reports/storage | 普通用户 | 存储报表 |
| GET | /api/reports/quota | 普通用户 | 配额报表 |
| GET | /api/reports/qos-usage | 普通用户 | QoS 使用报表 |
| POST | /api/ai/chat | 普通用户 | AI 助手问答 |
| POST | /api/ai/admin/chat | 管理员 | AI 管理员问答 |
| GET | /api/ai-tasks | 普通用户 | AI 任务列表 |
| POST | /api/ai-tasks | 普通用户 | 创建 AI 任务 |
| GET | /api/ai-tasks/:id | 普通用户 | 获取 AI 任务详情 |
| GET | /api/ai-tasks/:id/logs | 普通用户 | 获取任务日志 |
| POST | /api/ai-tasks/:id/stop | 普通用户 | 停止任务 |
| POST | /api/ai-tasks/:id/restart | 普通用户 | 重启任务 |
| DELETE | /api/ai-tasks/:id | 普通用户 | 删除任务 |
| POST | /api/ai-tasks/:id/endpoint | 普通用户 | 发布推理端口 |
| GET | /api/ai-tasks/:id/endpoint | 普通用户 | 获取推理端点 |
| DELETE | /api/ai-tasks/:id/endpoint | 普通用户 | 撤销端点 |
| GET | /api/registry/config | 普通用户 | Harbor 配置 |
| GET | /api/registry/projects | 普通用户 | 项目列表 |
| GET | /api/registry/projects/:p/repositories | 普通用户 | 镜像仓库列表 |
| GET | /api/cmdb/hosts | 管理员 | 主机资产列表 |
| POST | /api/cmdb/hosts | 管理员 | 添加主机 |
| GET | /api/audit/logs | 管理员 | 审计日志 |
| GET | /api/audit/stats | 管理员 | 审计统计 |
| GET | /api/audit/export | 管理员 | 导出审计日志 |
| POST | /api/audit/page-view | 普通用户 | 上报页面访问 |
| GET | /api/app-templates | 普通用户 | 作业模板列表 |
| POST | /api/app-templates | 普通用户 | 创建模板 |
| GET | /api/cache/metrics | 管理员 | Redis 缓存指标 |
| POST | /api/cache/clear | 管理员 | 清空缓存 |

## 统一响应格式

```json
// 成功（单条数据）
{ "data": { ... } }

// 成功（列表）
{ "data": [ ... ] }

// 成功（操作）
{ "message": "xxx successfully" }

// 失败
{ "error": "错误描述" }

// 失败（带业务码）
{ "error": "xxx", "code": "ACCOUNT_DISABLED" }
```

## HTTP 状态码约定

| 状态码 | 含义 |
|--------|------|
| 200 | 成功（GET/PUT/DELETE） |
| 201 | 创建成功（POST） |
| 400 | 请求参数错误 |
| 401 | 未认证/Token 失效 |
| 403 | 无权限（ACCOUNT_DISABLED / PASSWORD_MUST_CHANGE / DEMO_READONLY） |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
