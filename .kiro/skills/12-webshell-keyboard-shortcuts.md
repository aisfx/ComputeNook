# WebShell 键盘快捷键指南

## 设计理念

WebShell 的快捷键设计遵循以下原则：
1. **跨平台一致性**：Mac 使用 Cmd，Windows/Linux 使用 Ctrl
2. **符合平台习惯**：遵循各平台的快捷键约定
3. **易于记忆**：使用常见的快捷键模式
4. **避免冲突**：不覆盖浏览器或系统的关键快捷键

## 平台检测

系统会自动检测用户的操作系统平台：
```typescript
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
const modifier = isMac ? e.metaKey : e.ctrlKey
```

- **Mac**: 使用 `metaKey` (Cmd 键)
- **其他平台**: 使用 `ctrlKey` (Ctrl 键)

## 完整快捷键列表

### Tab 管理

| 功能 | Mac | Windows/Linux | 说明 |
|------|-----|---------------|------|
| 切换到 Tab 1-9 | ⌘ + 1~9 | Ctrl + 1~9 | 快速切换到指定位置的 Tab |
| 新建 Tab | ⌘ + T | Ctrl + T | 打开认证弹窗，选择节点连接 |
| 关闭当前 Tab | ⌘ + W | Ctrl + W | 关闭当前活动的终端 Tab |
| 切换到上一个 Tab | ⌘ + [ | Ctrl + [ | Mac 风格的 Tab 切换 |
| 切换到下一个 Tab | ⌘ + ] | Ctrl + ] | Mac 风格的 Tab 切换 |
| 切换到上一个 Tab | ⌘ + ← | Ctrl + ← | 通用风格的 Tab 切换 |
| 切换到下一个 Tab | ⌘ + → | Ctrl + → | 通用风格的 Tab 切换 |

### 终端操作

| 功能 | Mac | Windows/Linux | 说明 |
|------|-----|---------------|------|
| 清屏 | ⌘ + K | Ctrl + K | 清除终端屏幕内容 |
| 全屏切换 | ⌘ + F | Ctrl + F | 进入/退出全屏模式 |

### 设置管理

| 功能 | Mac | Windows/Linux | 说明 |
|------|-----|---------------|------|
| 打开终端设置 | ⌘ + , | Ctrl + , | 打开终端设置弹窗 |
| 打开密钥管理 | ⌘ + Shift + K | Ctrl + Shift + K | 打开 SSH 密钥管理弹窗 |

## UI 显示

### 快捷键提示条

页面顶部会显示常用快捷键提示，修饰键符号根据平台自动调整：

**Mac 上显示：**
```
⌘+1~9 切换Tab | ⌘+[/] 前后Tab | ⌘+T 新建 | ⌘+W 关闭 | ⌘+K 清屏 | ⌘+F 全屏 | ⌘+, 设置
```

**Windows/Linux 上显示：**
```
Ctrl+1~9 切换Tab | Ctrl+[/] 前后Tab | Ctrl+T 新建 | Ctrl+W 关闭 | Ctrl+K 清屏 | Ctrl+F 全屏 | Ctrl+, 设置
```

### 按钮悬停提示

所有工具栏按钮的 `title` 属性也会动态显示正确的快捷键：
- 新建按钮: `新建终端 (⌘+T)` 或 `新建终端 (Ctrl+T)`
- 清屏按钮: `清屏 (⌘+K)` 或 `清屏 (Ctrl+K)`
- 全屏按钮: `全屏 (⌘+F)` 或 `全屏 (Ctrl+F)`
- 断开按钮: `断开 (⌘+W)` 或 `断开 (Ctrl+W)`

## 实现细节

### 1. 平台检测变量

在组件中定义平台检测常量：
```typescript
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
const modKey = isMac ? '⌘' : 'Ctrl'
```

### 2. 快捷键监听

使用统一的事件处理函数：
```typescript
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    // 检测平台修饰键
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const modifier = isMac ? e.metaKey : e.ctrlKey
    
    // 主修饰键未按下则返回
    if (!modifier) return
    
    // 处理各种快捷键...
  }
  
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}, [])
```

### 3. 阻止默认行为

所有自定义快捷键都调用 `e.preventDefault()` 防止浏览器默认行为：
```typescript
if (e.key === 't' || e.key === 'T') {
  e.preventDefault()
  setAuthOpen(true)
  return
}
```

### 4. 避免的快捷键冲突

以下浏览器/系统快捷键不应被覆盖：
- **Cmd/Ctrl + R**: 刷新页面
- **Cmd/Ctrl + Q**: 退出应用（Mac）
- **Cmd/Ctrl + N**: 新窗口
- **Cmd/Ctrl + Tab**: 切换浏览器标签
- **Cmd + H**: 隐藏窗口（Mac）
- **Cmd + M**: 最小化窗口（Mac）

## Mac 特有的快捷键约定

### 1. Cmd 键优先
Mac 用户习惯使用 Cmd 键而不是 Ctrl 键进行快捷操作。

### 2. 方括号切换
- `Cmd + [` 和 `Cmd + ]` 是 Mac 上常见的前进/后退或切换操作
- 例如：浏览器后退/前进、IDE 切换编辑器标签

### 3. 逗号键设置
- `Cmd + ,` 是 Mac 应用打开偏好设置的标准快捷键
- 几乎所有 Mac 原生应用都遵循这个约定

### 4. Cmd + K 清屏
- 很多 Mac 终端应用（Terminal.app、iTerm2）使用 `Cmd + K` 清屏
- 符合 Mac 终端用户的使用习惯

## Windows/Linux 快捷键约定

### 1. Ctrl 键为主
Windows 和 Linux 用户习惯使用 Ctrl 键。

### 2. 通用快捷键
- `Ctrl + T`: 新建标签（浏览器、文件管理器）
- `Ctrl + W`: 关闭标签
- `Ctrl + Tab`: 切换标签
- `Ctrl + F`: 查找或全屏

### 3. 数字键切换
`Ctrl + 1~9` 在很多应用中用于切换标签页。

## 用户体验优化

### 1. 实时反馈
所有快捷键操作立即生效，无需额外确认。

### 2. 视觉提示
- 快捷键提示条常驻显示（有 Tab 时）
- 按钮悬停显示快捷键
- 修饰键符号清晰易认（⌘ vs Ctrl）

### 3. 一致性
- 同一功能在不同平台使用相同的键位，只是修饰键不同
- 例如：新建 Tab 在所有平台都是 `修饰键 + T`

### 4. 可发现性
- 页面顶部的提示条帮助用户发现可用快捷键
- 按钮的 title 提示强化记忆

## 测试场景

### Mac 平台测试
1. 打开 WebShell 页面
2. 验证快捷键提示条显示 "⌘"
3. 测试 `Cmd + T` 新建终端
4. 测试 `Cmd + 1` 切换到第一个 Tab
5. 测试 `Cmd + [` 和 `Cmd + ]` 切换 Tab
6. 测试 `Cmd + K` 清屏
7. 测试 `Cmd + ,` 打开设置
8. 测试 `Cmd + Shift + K` 打开密钥管理
9. 测试 `Cmd + F` 全屏切换
10. 测试 `Cmd + W` 关闭 Tab

### Windows/Linux 平台测试
1. 打开 WebShell 页面
2. 验证快捷键提示条显示 "Ctrl"
3. 使用 `Ctrl` 代替 `Cmd` 测试上述所有功能

### 跨平台一致性测试
1. 同一用户在不同平台使用
2. 验证功能行为一致
3. 验证 UI 提示正确显示

## 扩展建议

### 未来可添加的快捷键

1. **搜索功能**
   - `Cmd/Ctrl + F`: 在终端输出中搜索
   - 当前 F 键用于全屏，可考虑改为 `Cmd/Ctrl + Shift + F`

2. **复制粘贴**
   - 终端自带的选择复制功能
   - `Cmd/Ctrl + C/V` 可能与终端信号冲突

3. **历史记录**
   - `Cmd/Ctrl + H`: 打开命令历史

4. **标签重命名**
   - `Cmd/Ctrl + R`: 重命名当前 Tab

5. **会话管理**
   - `Cmd/Ctrl + S`: 保存当前会话
   - `Cmd/Ctrl + O`: 恢复保存的会话

### 自定义快捷键

未来可考虑允许用户自定义快捷键配置：
```typescript
interface ShortcutConfig {
  newTab: string;      // 默认: 'Cmd+T' / 'Ctrl+T'
  closeTab: string;    // 默认: 'Cmd+W' / 'Ctrl+W'
  clearScreen: string; // 默认: 'Cmd+K' / 'Ctrl+K'
  // ...
}
```

## 相关文件

- `frontend/src/pages/user/webshell/index.tsx` - WebShell 主组件
- `.kiro/skills/12-webshell-keyboard-shortcuts.md` - 本文档

## 修改历史

- **2026-07-03 20:00**: 初始版本，实现跨平台快捷键支持
- 版本：33e3a988

## 参考资料

1. [Mac 键盘快捷键规范](https://developer.apple.com/design/human-interface-guidelines/keyboards)
2. [Web 应用快捷键最佳实践](https://web.dev/keyboard-shortcuts/)
3. [终端应用快捷键约定](https://en.wikipedia.org/wiki/Terminal_emulator#Keyboard_shortcuts)
