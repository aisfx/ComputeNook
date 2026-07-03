# 作业提交脚本CPU参数修正

## 问题描述

用户报告作业提交时脚本中使用的CPU参数有误：

1. **CPU核心数参数错误**：脚本使用的是 `-c`，应该使用 `-n`
2. **脚本内容可编辑性**：需要确认脚本输入框是否可以自由编辑

## 问题定位

### CPU参数问题

在SBATCH（Slurm）中，CPU相关参数有两种：

- `-c` 或 `--cpus-per-task`：每个任务的CPU核心数
- `-n` 或 `--ntasks`：总任务数（通常等于总核心数）

对于大多数作业提交场景，应该使用 `-n` 指定总核心数，而不是 `-c`。

### 代码问题

在三个地方发现了 `-c` 的错误使用：

1. ✅ `updateScriptFromForm` 函数（已正确使用 `-n`）
2. ❌ `applyTemplate` 函数（使用了错误的 `-c`）
3. ❌ 模板创建表单的初始脚本示例（使用了错误的 `-c`）

## 解决方案

### 修改applyTemplate函数

```typescript
// 原代码（错误）
scriptContent += `#SBATCH -c ${tpl.cpus}\n`

// 修改后（正确）
scriptContent += `#SBATCH -n ${tpl.cpus}\n`
```

### 修改模板初始值

```typescript
// 原代码（错误）
initialValue={`#!/bin/bash
#SBATCH -J my_job
#SBATCH -p compute
#SBATCH -N 1
#SBATCH -c 4
...`}

// 修改后（正确）
initialValue={`#!/bin/bash
#SBATCH -J my_job
#SBATCH -p compute
#SBATCH -N 1
#SBATCH -n 4
...`}
```

### 脚本可编辑性确认

脚本内容使用的是标准的 `TextArea` 组件，完全支持用户自由编辑：

```tsx
<Form.Item
  label="脚本内容"
  name="script"
  rules={[{ required: true, message: '请输入作业脚本' }]}
>
  <TextArea
    rows={12}
    style={{ fontFamily: 'monospace', fontSize: 13 }}
    placeholder="脚本内容将根据上方参数自动生成，您也可以直接编辑修改"
  />
</Form.Item>
```

**特点**：
- 没有 `readOnly` 或 `disabled` 属性限制
- placeholder 明确提示可以直接编辑修改
- 使用等宽字体，便于查看和编辑脚本
- 12行高度，足够显示完整的脚本内容

## SBATCH参数说明

### 常用参数对比

| 参数 | 全称 | 说明 | 使用场景 |
|------|------|------|----------|
| `-n` | `--ntasks` | 总任务数 | 指定MPI任务数或总核心数（推荐） |
| `-c` | `--cpus-per-task` | 每任务CPU数 | OpenMP多线程程序 |
| `-N` | `--nodes` | 节点数 | 指定使用的节点数量 |

### 使用建议

**一般作业（推荐）**：
```bash
#SBATCH -N 1       # 1个节点
#SBATCH -n 8       # 8个任务（8核）
```

**MPI并行作业**：
```bash
#SBATCH -N 2       # 2个节点
#SBATCH -n 32      # 32个MPI任务
```

**OpenMP多线程作业**：
```bash
#SBATCH -N 1       # 1个节点
#SBATCH -n 1       # 1个任务
#SBATCH -c 16      # 每任务16个线程
```

**混合MPI+OpenMP**：
```bash
#SBATCH -N 2       # 2个节点
#SBATCH -n 4       # 4个MPI任务
#SBATCH -c 8       # 每MPI任务8个OpenMP线程
```

## 修改影响

### 影响范围

- **普通作业提交**：自动生成的脚本使用正确的 `-n` 参数
- **模板应用**：从模板应用到表单时使用正确的 `-n` 参数
- **模板创建**：新建模板时的示例脚本使用正确的 `-n` 参数
- **用户编辑**：用户可以自由编辑脚本内容，包括修改所有参数

### 不影响的部分

- 已提交的作业不受影响
- 已保存的模板不受影响（可以通过编辑功能手动修正）
- 用户手动编写的脚本不受影响

## 测试建议

1. **测试自动生成脚本**
   - 打开作业提交表单
   - 填写基本参数（节点数、CPU核心数等）
   - 检查生成的脚本是否使用 `-n` 参数

2. **测试模板应用**
   - 选择一个快速模板
   - 点击应用
   - 检查填充的脚本是否使用 `-n` 参数

3. **测试脚本编辑**
   - 在脚本输入框中自由编辑内容
   - 修改参数值
   - 添加新的SBATCH指令
   - 确认所有修改都能保存和提交

4. **测试实际提交**
   - 提交一个测试作业
   - 使用 `scontrol show job <jobid>` 查看作业详情
   - 确认CPU核心数设置正确

## 提交信息

- **提交哈希**：`7e19d8bd`
- **提交信息**：fix: 作业提交脚本CPU参数修正
- **发布包**：`computenook-7e19d8bd-darwin-20260703-204324.tar.gz`
- **日期**：2026-07-03 20:43

## 相关文档

- CHANGELOG.md - 已添加修复记录
- frontend/src/pages/user/jobs/index.tsx - 核心修改文件
- [Slurm sbatch文档](https://slurm.schedmd.com/sbatch.html)

## 总结

1. ✅ CPU参数已从 `-c` 修正为 `-n`
2. ✅ 影响了模板应用和模板创建两个场景
3. ✅ 自动生成脚本函数本来就是正确的
4. ✅ 脚本内容完全支持用户自由编辑
5. ✅ placeholder明确提示可以编辑修改

用户现在可以：
- 使用正确的SBATCH参数提交作业
- 自由编辑脚本内容，修改任何参数
- 根据实际需求选择合适的CPU参数（`-n`、`-c`或两者组合）
