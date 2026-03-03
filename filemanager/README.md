# 文件管理服务

独立的文件管理服务，提供文件浏览、上传、下载、编辑等功能。

## 功能特性

- 📁 目录浏览和导航
- 📄 文件读取和查看
- ⬆️ 文件上传
- ⬇️ 文件下载
- ✏️ 文件编辑
- 🗑️ 文件删除
- 📝 创建文件和文件夹
- 🔄 文件重命名
- 📋 文件复制
- 🔒 路径安全验证

## 安装和运行

### 1. 安装依赖

```bash
cd filemanager
go mod download
```

### 2. 配置环境变量

编辑 `.env` 文件：

```env
# 服务端口
FILEMANAGER_PORT=8081

# 基础路径（文件管理的根目录）
FILEMANAGER_BASE_PATH=/home
```

### 3. 运行服务

```bash
# 开发模式
go run .

# 编译并运行
go build -o filemanager
./filemanager
```

### 4. Windows 运行

```cmd
go build -o filemanager.exe
filemanager.exe
```

## API 接口

### 基础 URL

```
http://localhost:8081/api/files
```

### 接口列表

#### 1. 列出目录内容

```
GET /api/files/list?path=/home/username
```

响应：
```json
{
  "path": "/home/username",
  "files": [
    {
      "name": "document.txt",
      "path": "/home/username/document.txt",
      "size": 1024,
      "is_dir": false,
      "mod_time": "2024-01-01 12:00:00",
      "permissions": "-rw-r--r--"
    }
  ]
}
```

#### 2. 读取文件内容

```
GET /api/files/read?path=/home/username/file.txt
```

响应：
```json
{
  "path": "/home/username/file.txt",
  "content": "文件内容...",
  "size": 1024
}
```

#### 3. 下载文件

```
GET /api/files/download?path=/home/username/file.txt
```

#### 4. 上传文件

```
POST /api/files/upload
Content-Type: multipart/form-data

file: [文件]
path: /home/username
```

#### 5. 写入文件

```
POST /api/files/write
Content-Type: application/json

{
  "path": "/home/username/file.txt",
  "content": "文件内容"
}
```

#### 6. 删除文件

```
DELETE /api/files/delete?path=/home/username/file.txt
```

#### 7. 创建目录

```
POST /api/files/mkdir
Content-Type: application/json

{
  "path": "/home/username/newfolder"
}
```

#### 8. 重命名文件

```
POST /api/files/rename
Content-Type: application/json

{
  "old_path": "/home/username/old.txt",
  "new_path": "/home/username/new.txt"
}
```

#### 9. 复制文件

```
POST /api/files/copy
Content-Type: application/json

{
  "source_path": "/home/username/source.txt",
  "target_path": "/home/username/target.txt"
}
```

#### 10. 获取文件信息

```
GET /api/files/info?path=/home/username/file.txt
```

## 安全特性

1. **路径验证**：所有路径都会进行安全验证，防止目录遍历攻击
2. **基础路径限制**：只能访问配置的基础路径及其子目录
3. **文件大小限制**：读取文件限制为 10MB
4. **系统目录保护**：禁止删除系统关键目录

## 集成到主服务

文件管理服务可以作为独立服务运行，也可以集成到主 HPC 后端服务中。

### 独立运行（推荐）

优点：
- 服务隔离，互不影响
- 可以部署到不同的服务器
- 更好的安全性和可维护性

### 集成运行

如果需要集成到主服务，可以将 handlers.go 中的函数导入到主服务的 handlers 包中。

## 部署建议

1. **生产环境**：建议使用 systemd 或 supervisor 管理服务
2. **反向代理**：建议使用 Nginx 作为反向代理
3. **HTTPS**：生产环境必须启用 HTTPS
4. **权限控制**：建议添加用户认证和权限验证

## 示例：Systemd 服务配置

创建 `/etc/systemd/system/filemanager.service`：

```ini
[Unit]
Description=File Manager Service
After=network.target

[Service]
Type=simple
User=filemanager
WorkingDirectory=/opt/filemanager
ExecStart=/opt/filemanager/filemanager
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable filemanager
sudo systemctl start filemanager
```

## 许可证

MIT
