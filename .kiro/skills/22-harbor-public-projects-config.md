# Harbor公共项目配置

## 问题描述

作业提交页面的容器镜像下拉框显示"暂无数据"，但镜像仓库页面能正常显示镜像（如jupyter/base-notebook）。

## 根本原因

后端`ListProjects` API有权限过滤逻辑：

```go
canSee := isAdmin || isPublic || name == username.(string)
```

普通用户只能看到：
1. 公共项目（`isPublic`）
2. 自己的私有项目（`name == username`）

如果用户不是管理员，也不是项目所有者，且项目未标记为公共，就无法访问该项目的镜像。

## 解决方案

在`.env`文件中添加`HARBOR_PUBLIC_PROJECTS`配置，指定哪些项目应该被视为公共项目：

```bash
# 镜像仓库（Harbor）
HARBOR_URL=http://hpc.hpcweb.local:8080
HARBOR_ADMIN_USER=admin
HARBOR_ADMIN_PASS=Harbor12345
# Harbor公共项目列表（逗号分隔）
HARBOR_PUBLIC_PROJECTS=library,jupyter,base,public
```

## 配置说明

### HARBOR_PUBLIC_PROJECTS

- **格式**：逗号分隔的项目名称列表
- **默认值**：如果未配置，默认为 `library,base,public`
- **作用**：指定哪些项目应被视为公共项目，所有用户都可访问

### 示例配置

```bash
# 单个项目
HARBOR_PUBLIC_PROJECTS=library

# 多个项目
HARBOR_PUBLIC_PROJECTS=library,jupyter,pytorch,tensorflow

# 包含常见的公共镜像项目
HARBOR_PUBLIC_PROJECTS=library,jupyter,base,public,nvidia,pytorch
```

## 代码逻辑

后端 `backend/handlers/registry.go` 中的 `isPublicProject` 函数：

```go
func isPublicProject(name string) bool {
	raw := os.Getenv("HARBOR_PUBLIC_PROJECTS")
	var list []string
	if raw == "" {
		list = []string{"library", "base", "public"}
	} else {
		list = strings.Split(raw, ",")
	}
	for _, p := range list {
		if strings.TrimSpace(p) == name {
			return true
		}
	}
	return false
}
```

## Harbor项目权限机制

### Harbor原生的public属性

Harbor项目本身有`public`属性（在Harbor Web界面设置）：
- `public: true` - 任何人都可以pull镜像（无需登录）
- `public: false` - 需要登录且有权限才能访问

### ComputeNook的权限控制

ComputeNook在Harbor之上又加了一层权限控制：
- 使用 `HARBOR_PUBLIC_PROJECTS` 配置哪些项目对所有ComputeNook用户可见
- 即使Harbor项目是`public: false`，只要在`HARBOR_PUBLIC_PROJECTS`中配置，用户就能在ComputeNook中看到

### 为什么需要两层权限？

1. **Harbor层面**：控制外部访问和docker pull权限
2. **ComputeNook层面**：控制平台用户在Web界面中的可见性

这样设计的好处：
- Harbor项目可以保持private（外部无法访问）
- 但ComputeNook平台用户可以浏览和使用这些镜像
- 更细粒度的权限控制

## 配置步骤

1. **编辑 `.env` 文件**：
   ```bash
   vi /root/test/computenook/.env
   ```

2. **添加或修改配置**：
   ```bash
   HARBOR_PUBLIC_PROJECTS=library,jupyter,base,public
   ```

3. **重启后端服务**：
   ```bash
   systemctl restart computenook
   # 或
   ./computenook restart
   ```

4. **验证配置**：
   - 打开作业提交页面
   - 选择容器作业
   - 点击容器镜像下拉框
   - 应该能看到配置的公共项目中的镜像

## 常见问题

### Q: 配置后仍然看不到镜像？

**可能原因**：
1. 后端服务未重启（配置不会热更新）
2. 项目名称拼写错误（区分大小写）
3. Harbor服务连接失败
4. Harbor管理员账号密码错误

**排查方法**：
```bash
# 检查后端日志
tail -f /root/test/computenook/logs/compute-nook.log

# 检查Harbor配置
curl -u admin:Harbor12345 http://hpc.hpcweb.local:8080/api/v2.0/projects
```

### Q: 如何查看Harbor项目列表？

```bash
# 方法1：使用Harbor API
curl -u admin:Harbor12345 http://hpc.hpcweb.local:8080/api/v2.0/projects

# 方法2：登录Harbor Web界面
http://hpc.hpcweb.local:8080
```

### Q: 配置了jupyter但下拉框还是空的？

检查：
1. 项目名称是否正确（jupyter而不是Jupyter）
2. 项目中是否有仓库和标签
3. 浏览器控制台是否有错误信息
4. 后端日志中是否有API调用失败的记录

## 相关文件

- `.env` - Harbor配置文件（不在git中）
- `.env.example` - 配置样例文件
- `backend/handlers/registry.go` - Harbor API代理和权限控制

## 生产环境配置建议

```bash
# 基础镜像项目
HARBOR_PUBLIC_PROJECTS=library,base,public

# 添加常用的科学计算镜像项目
HARBOR_PUBLIC_PROJECTS=library,base,public,jupyter,pytorch,tensorflow,cuda,nvidia

# 添加机构自定义的公共镜像项目
HARBOR_PUBLIC_PROJECTS=library,base,public,org-common,org-ml,org-hpc
```

## 安全注意事项

1. **谨慎配置公共项目**：
   - 只将确实需要公开的项目添加到列表中
   - 避免将包含敏感镜像的项目设为公共

2. **Harbor管理员密码**：
   - `HARBOR_ADMIN_PASS`存储在`.env`中
   - 确保`.env`文件权限设置为600
   - 不要将`.env`提交到git

3. **定期审查**：
   - 定期检查公共项目列表是否合理
   - 删除不再需要的公共项目配置
