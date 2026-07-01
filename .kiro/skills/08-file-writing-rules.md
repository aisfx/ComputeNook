# 文件写入规范 —— 防止超长截断错误

## 核心规则

当需要写入或重写一个较长的文件时，**必须分块操作**，不能一次性写入超过 50 行的内容。

---

## 操作步骤

### 新建文件
1. 用 `fs_write` 写入前 40-50 行（imports + 类型定义 + 常量）
2. 用 `fs_append` 依次追加后续内容，每次不超过 50 行
3. 写完后用 `getDiagnostics` 或 `get_process_output` 验证编译是否通过

### 重写已有文件
1. 先用 `fs_write` 覆盖写入第一块（前 40-50 行）
2. 再用 `fs_append` 多次追加剩余内容
3. **不要** 用一个超长的 `str_replace` 替换整个文件

---

## 分块策略建议

| 块编号 | 内容 | 行数估算 |
|--------|------|---------|
| 块 1 | imports + interface/type 定义 + 常量 | 30-50 行 |
| 块 2 | 工具函数 / 子组件 | 30-50 行 |
| 块 3 | 主组件 state + useEffect + 业务逻辑 | 40-50 行 |
| 块 4 | render return 上半部分（页面头部 + 左侧） | 40-50 行 |
| 块 5 | render return 下半部分（右侧 + 弹窗）+ 结尾 `}` | 40-50 行 |

---

## 常见错误示例

```
❌ 错误：一次 fs_write 写入 300 行
→ 报错：aborted. The agent has seen this error and will try a different approach

✅ 正确：
  fs_write  → 前 50 行
  fs_append → 中间 50 行
  fs_append → 中间 50 行
  fs_append → 最后 50 行（含闭合括号）
```

---

## JSX 嵌套注意事项

分块写 JSX 时，每块结尾必须保持语法完整（不要在 JSX 标签中间断开）。
建议在每块追加前先确认上一块结尾的括号层级，防止出现未闭合错误。

---

## 验证方法

每次追加完成后执行：
```
get_process_output → 检查 Vite HMR 是否有报错
getDiagnostics     → 检查 TypeScript 错误
```

如果出现 `Unterminated JSX contents` 类错误，通常是某块末尾 JSX 没有正确闭合，
用 `str_replace` 定位并修复，不要整体重写。
