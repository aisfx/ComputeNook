# 资源绑定（Association）问题修复

## 问题 1: 修改资源绑定后 QoS 还是显示 "normal"

### 原因
更新 association 后，只清除了列表缓存，没有清除所有相关缓存，导致前端继续读取旧数据。

### 修复
在 `backend/handlers/slurm_account.go` 的 `UpdateAssociation` 函数中，改为清除所有 association 相关缓存：

```go
// 清除所有 association 相关缓存
mgr := cache.NewManager()
mgr.DeletePattern(cache.PrefixAssociation + "*")
```

### 测试
1. 重启后端服务
2. 编辑一个资源绑定，修改 QoS
3. 保存后，列表应该立即显示新的 QoS 值

---

## 问题 2: 账户（account）没办法修改

### 这不是 Bug，而是设计限制

在 Slurm 中，**资源绑定（Association）的主键是 `(user, account, cluster)` 三元组**。

这意味着：
- ✅ 可以修改：QoS、分区（partition）、资源限制等
- ❌ 不能修改：用户（user）、账户（account）、集群（cluster）

### 为什么不能修改？

修改主键字段相当于删除旧的 association 并创建新的 association，这会导致：
1. 历史作业记录丢失关联
2. 机时统计数据错乱
3. 可能破坏账户层级结构

### 如何更改用户的账户？

如果需要将用户从一个账户移到另一个账户：

**方法 1: 通过界面（推荐）**
1. 删除旧的资源绑定（user + 旧 account）
2. 创建新的资源绑定（user + 新 account）

**方法 2: 使用命令行**
```bash
# 删除旧绑定
sacctmgr delete user test1 account=old-account

# 创建新绑定
sacctmgr add user test1 account=new-account
```

### 前端实现

前端代码在编辑模式下禁用了这些字段（`src/views/AdminAssociations.vue` 第 91 行）：

```vue
<select v-model="newAssociation.account" :disabled="isEditing">
```

这是正确的设计，防止用户误操作。

---

## 问题 3: 关于 fs/disk TRES

这个问题已在 `QOS_CACHE_FIX.md` 中说明。简单来说：
- `fs/disk=10` 是 Slurm 集群配置的自定义 TRES
- 不是前端或后端添加的
- 如果不需要，可以用 `sacctmgr` 命令修改

---

## 总结

### 已修复
- ✅ 更新 association 后缓存刷新问题

### 不是问题
- ℹ️ 账户字段不能修改是 Slurm 的设计限制，需要删除旧绑定并创建新绑定

### 操作建议

**修改 QoS 或分区：**
1. 点击"编辑"按钮
2. 修改 QoS 或分区字段
3. 点击"保存"

**更换账户：**
1. 点击"删除"按钮删除旧绑定
2. 点击"创建资源绑定"
3. 选择用户和新账户
4. 设置 QoS 和分区
5. 点击"创建"

---

## 相关文件

- `backend/handlers/slurm_account.go` - Association 管理处理器
- `src/views/AdminAssociations.vue` - 前端资源绑定管理页面
- `backend/cache/keys.go` - 缓存 key 定义
