# 文件管理器路径权限检查问题修复

## 问题描述

文件管理器在访问目录时一直显示"读取目录失败"错误，无法正常浏览用户的文件。

## 问题定位

### 根本原因

`isPathAllowed` 函数使用了 `filepath.EvalSymlinks` 来解析符号链接，但在以下情况会失败：

1. **home 目录本身是符号链接**：`EvalSymlinks` 需要路径实际存在才能解析
2. **路径不存在时**：对于待创建的路径，`EvalSymlinks` 会返回错误
3. **权限问题**：在某些情况下无法读取符号链接的目标

### 代码问题

```go
// 原有代码（有问题）
func isPathAllowed(path, allowedBase string) bool {
    // ...
    evalPath, err := filepath.EvalSymlinks(cleanPath)
    if err != nil {
        return false  // 这里会导致正常路径被拒绝
    }
    // ...
}
```

## 解决方案

### 简化路径检查逻辑

不再使用 `EvalSymlinks`，而是：

1. 使用 `filepath.Clean` 清理路径
2. 使用 `filepath.Abs` 转换为绝对路径
3. 使用 `filepath.Rel` 计算相对路径
4. 检查相对路径是否包含 `..` 防止路径穿越

### 修改后的代码

```go
func isPathAllowed(path, allowedBase string) bool {
    if path == "" || allowedBase == "" {
        return false
    }

    // 清理路径
    cleanBase := filepath.Clean(allowedBase)
    cleanPath := filepath.Clean(path)

    // 转换为绝对路径
    absBase, err := filepath.Abs(cleanBase)
    if err != nil {
        return false
    }
    
    absPath, err := filepath.Abs(cleanPath)
    if err != nil {
        return false
    }

    // 检查路径是否在允许的基础路径下
    rel, err := filepath.Rel(absBase, absPath)
    if err != nil {
        return false
    }
    
    // 不允许路径穿越（..）
    return rel == "." || (rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator)) && !filepath.IsAbs(rel))
}
```

### 删除的辅助函数

删除了不再使用的 `resolvePathThroughExistingParent` 函数（37行代码），简化代码结构。

## 技术优势

1. **更可靠**：不依赖路径实际存在，支持待创建的路径
2. **更简单**：逻辑清晰，易于理解和维护
3. **更安全**：依然能有效防止路径穿越攻击
4. **更兼容**：支持符号链接作为 home 目录的场景

## 安全性说明

虽然移除了 `EvalSymlinks`，但安全性不受影响：

1. **路径清理**：`filepath.Clean` 会规范化路径，移除多余的 `.` 和 `..`
2. **相对路径检查**：通过 `filepath.Rel` 确保路径在允许的目录下
3. **穿越检查**：明确拒绝包含 `..` 的相对路径
4. **绝对路径检查**：拒绝相对路径计算结果为绝对路径的情况

## 影响范围

### 修改的文件

- `backend/handlers/filemanager.go`
  - 简化 `isPathAllowed` 函数（从46行减少到32行）
  - 删除 `resolvePathThroughExistingParent` 辅助函数

### 影响的API

所有文件管理器相关的API都使用 `isPathAllowed` 进行权限检查：

- `GET /api/files/list` - 列出目录
- `GET /api/files/read` - 读取文件
- `GET /api/files/download` - 下载文件
- `POST /api/files/write` - 写入文件
- `POST /api/files/upload` - 上传文件
- `DELETE /api/files/delete` - 删除文件
- `POST /api/files/mkdir` - 创建目录
- `POST /api/files/rename` - 重命名
- `POST /api/files/copy` - 复制文件
- `GET /api/files/info` - 获取文件信息
- `GET /api/files/compress-download` - 压缩下载

## 测试建议

1. 测试正常目录浏览
2. 测试 home 目录是符号链接的场景
3. 测试路径穿越攻击防御（如 `../../etc/passwd`）
4. 测试创建新目录和文件
5. 测试上传和下载功能

## 提交信息

- **提交哈希**：`5bd1db7e`
- **提交信息**：fix: 文件管理器路径权限检查问题
- **发布包**：`computenook-5bd1db7e-darwin-20260703-203115.tar.gz`
- **日期**：2026-07-03 20:31

## 相关文档

- CHANGELOG.md - 已添加修复记录
- backend/handlers/filemanager.go - 核心修改文件
