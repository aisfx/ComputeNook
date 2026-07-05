# Git 跨平台换行符配置

## 问题背景

Windows 使用 CRLF (`\r\n`) 作为换行符，而 Mac/Linux 使用 LF (`\n`)。如果不正确配置，会导致：
- 在不同操作系统间协作时出现大量"文件被修改"的假象
- Shell 脚本在 Linux/Mac 上无法正常执行
- 代码审查时产生大量无意义的换行符差异

## 解决方案

### 1. 配置 Git 全局设置

在 Windows 开发环境中执行：

```bash
git config core.autocrlf input
```

这个设置的作用：
- **提交时**：自动将 CRLF 转换为 LF
- **检出时**：保持 LF 不变（不转换）

### 2. 创建/更新 .gitattributes 文件

在项目根目录创建 `.gitattributes` 文件，强制所有文本文件使用 LF：

```gitattributes
# 默认所有文本文件使用 LF
* text=auto eol=lf

# Shell 脚本强制 LF
*.sh text eol=lf
*.bash text eol=lf

# Go 源码
*.go text eol=lf
*.mod text eol=lf
*.sum text eol=lf

# 前端
*.ts  text eol=lf
*.tsx text eol=lf
*.vue text eol=lf
*.js  text eol=lf
*.jsx text eol=lf
*.css text eol=lf
*.scss text eol=lf
*.json text eol=lf
*.html text eol=lf
*.htm text eol=lf

# 配置文件
*.yml text eol=lf
*.yaml text eol=lf
*.toml text eol=lf
*.ini text eol=lf
*.conf text eol=lf
.env* text eol=lf
Makefile text eol=lf

# 文档
*.md text eol=lf
*.txt text eol=lf

# 二进制文件不转换
*.exe binary
*.dll binary
*.so binary
*.dylib binary
*.png binary
*.jpg binary
*.jpeg binary
*.gif binary
*.ico binary
*.db binary
*.sqlite binary
```

### 3. 重新规范化已存在的文件

配置完成后，需要重新规范化仓库中的所有文件：

```bash
# 重新规范化所有文件
git add --renormalize .

# 检查是否有变化
git status

# 如果有变化，提交它们
git commit -m "Normalize line endings for cross-platform compatibility"

# 推送到远程仓库
git push
```

## 验证配置

### 检查当前配置

```bash
# 查看当前的 autocrlf 设置
git config core.autocrlf

# 查看某个文件的换行符类型
git ls-files --eol
```

### 检查文件换行符

在 Windows PowerShell 中：

```powershell
# 检查文件中的换行符类型
(Get-Content -Raw filename.go) -match "`r`n"
# 返回 True 表示包含 CRLF，False 表示是 LF
```

在 Linux/Mac 中：

```bash
# 检查文件中的换行符类型
file filename.go
# 或
cat -A filename.go | head
```

## 最佳实践

1. **在项目开始时就配置好**：避免后期大量文件需要重新规范化
2. **团队统一配置**：确保所有开发者都进行相同的配置
3. **CI/CD 检查**：可以在 CI 流程中添加换行符检查，防止错误提交
4. **文档说明**：在项目 README 中说明换行符配置要求

## 常见问题

### Q: 为什么选择 LF 而不是 CRLF？

A: 
- Linux/Mac 原生使用 LF
- 大多数服务器运行 Linux
- Shell 脚本在 Linux 上必须使用 LF
- 现代 Windows 编辑器都支持 LF
- Git 仓库标准是 LF

### Q: 已经提交了 CRLF 的文件怎么办？

A: 按照上面"重新规范化已存在的文件"的步骤执行即可。

### Q: 如何防止 Windows 编辑器自动转换为 CRLF？

A: 
- VS Code：设置 `"files.eol": "\n"`
- 确保 `.gitattributes` 文件存在
- 使用 `git config core.autocrlf input`

## 本项目配置

ComputeNook 项目已经配置：
- ✅ `.gitattributes` 文件已创建并配置
- ✅ Git 配置 `core.autocrlf = input`
- ✅ 所有文件已重新规范化为 LF

开发者在 Windows 上克隆项目后，只需执行：

```bash
git config core.autocrlf input
```

即可确保跨平台兼容性。
