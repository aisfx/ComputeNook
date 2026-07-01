---
name: Git Proxy Configuration
description: Git操作代理配置，用于解决GitHub连接问题
tags: [git, proxy, network]
---

# Git代理配置

## 网络代理设置

当需要进行git push/pull等远程操作时，使用以下代理配置：

```bash
export https_proxy=http://127.0.0.1:7897
export http_proxy=http://127.0.0.1:7897
export all_proxy=socks5://127.0.0.1:7897
```

## 使用场景

### 推送代码到远程仓库
在执行 `git push` 之前，先设置代理：

```bash
export https_proxy=http://127.0.0.1:7897 http_proxy=http://127.0.0.1:7897 all_proxy=socks5://127.0.0.1:7897
git push origin main
```

### 拉取远程代码
在执行 `git pull` 或 `git fetch` 之前，先设置代理：

```bash
export https_proxy=http://127.0.0.1:7897 http_proxy=http://127.0.0.1:7897 all_proxy=socks5://127.0.0.1:7897
git pull origin main
```

### 克隆仓库
在执行 `git clone` 时，先设置代理：

```bash
export https_proxy=http://127.0.0.1:7897 http_proxy=http://127.0.0.1:7897 all_proxy=socks5://127.0.0.1:7897
git clone https://github.com/user/repo.git
```

## 规则

- **所有涉及GitHub的git操作都必须先设置代理**
- 代理服务器地址：`127.0.0.1:7897`
- 支持HTTP/HTTPS和SOCKS5协议
- 确保本地代理服务正在运行

## 验证代理

设置代理后，可以测试连接：

```bash
curl -I https://github.com
```

如果返回HTTP 200，说明代理配置成功。

## GitHub认证

**当前配置：SSH认证 ✓**

本项目已配置SSH密钥认证，remote URL为：`git@github.com:aisfx/ComputeNook.git`

### SSH推送（当前使用）

SSH认证不需要HTTP代理，直接推送即可：

```bash
git push origin main
```

### 如果SSH认证失败

检查SSH密钥：
```bash
ssh -T git@github.com
```

如果提示"Hi aisfx! You've successfully authenticated"，说明SSH配置正确。

### 切换回HTTPS认证（不推荐）

如需使用HTTPS + Personal Access Token：

1. 访问 https://github.com/settings/tokens
2. 生成新token (选择repo权限)
3. 切换remote URL：
```bash
git remote set-url origin https://github.com/aisfx/ComputeNook.git
```
4. 推送时需要代理：
```bash
export https_proxy=http://127.0.0.1:7897 http_proxy=http://127.0.0.1:7897 all_proxy=socks5://127.0.0.1:7897
git push origin main
```

## 注意事项

1. 代理设置仅在当前shell会话有效
2. 如果代理服务未运行，git操作会失败
3. 可以通过 `unset https_proxy http_proxy all_proxy` 清除代理设置
4. **GitHub认证失败时，需要配置Personal Access Token或SSH密钥**
5. 使用HTTPS时，macOS会将凭证保存在钥匙串中
