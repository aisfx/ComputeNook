# QoS 缓存刷新问题修复

## 问题描述

创建、更新或删除 QoS 后，前端列表没有立即显示最新数据，需要等待 5 分钟缓存过期。

## 根本原因

1. QoS 列表接口使用了 5 分钟的缓存：
   ```go
   auth.GET("/qos", cache.CacheMiddleware(cache.PrefixQoS+"list:", 5*time.Minute), handlers.GetQoSList)
   ```

2. 创建、更新、删除 QoS 的处理函数没有清除缓存，导致前端继续读取旧数据

## 修复方案

在 `backend/handlers/qos.go` 的三个函数中添加缓存清除逻辑：

### CreateQoS
```go
// 清除缓存
mgr := cache.NewManager()
mgr.DeletePattern(cache.PrefixQoS + "*")
```

### UpdateQoS
```go
// 清除缓存
mgr := cache.NewManager()
mgr.DeletePattern(cache.PrefixQoS + "*")
```

### DeleteQoS
```go
// 清除缓存
mgr := cache.NewManager()
mgr.DeletePattern(cache.PrefixQoS + "*")
```

## 关于 fs/disk TRES

你看到的 `fs/disk=10` 是 Slurm 的 TRES (Trackable RESources) 配置。

### 什么是 TRES？
TRES 是 Slurm 中可追踪的资源类型，包括：
- `cpu` - CPU 核心数
- `mem` - 内存
- `node` - 节点数
- `gres/gpu` - GPU 数量
- `fs/disk` - 文件系统磁盘配额（自定义 TRES）

### fs/disk 的来源
1. **集群配置**：你的 Slurm 集群可能在 `slurm.conf` 中定义了 `fs/disk` 作为自定义 TRES
2. **前端传值**：创建 QoS 时，前端可能传递了这个 TRES 限制
3. **默认模板**：可能从某个 QoS 模板继承了这个配置

### 如何查看 TRES 配置
```bash
# 查看集群支持的 TRES 类型
sacctmgr show tres

# 查看特定 QoS 的 TRES 限制
sacctmgr show qos test1 format=name,maxtres,maxtrespu
```

### 如何修改
如果不需要 `fs/disk` 限制，可以：
1. 在前端创建 QoS 时不设置这个字段
2. 或者使用 `sacctmgr` 命令修改：
   ```bash
   sacctmgr modify qos test1 set MaxTRES=cpu=1920,node=10
   ```

## 测试

1. 重启后端服务
2. 创建一个新的 QoS
3. 前端列表应该立即显示新创建的 QoS
4. 更新或删除 QoS 后，列表也应该立即刷新

## 相关文件

- `backend/handlers/qos.go` - QoS 管理处理器
- `backend/main.go` - 路由配置（缓存中间件）
- `backend/cache/manager.go` - 缓存管理器
