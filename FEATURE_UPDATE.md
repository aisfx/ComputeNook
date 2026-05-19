# 作业提交参数自动更新功能

## 更新说明

实现了作业提交表单参数与脚本内容的自动同步功能。当用户在表单中更改作业参数（如节点数、CPU核心数、内存、时间等）时，脚本内容中的 `#SBATCH` 指令会自动更新。

## 更新的组件

### 1. JobSubmit.vue (普通作业提交)
- 添加了 `updateScriptParams()` 函数来更新脚本中的 SBATCH 参数
- 使用 Vue 的 `watch` 监听表单参数变化
- 支持的参数：
  - 作业名称 (`-J`)
  - 分区 (`-p`)
  - 节点数 (`-N`)
  - CPU 核心数 (`-c`)
  - 内存 (`--mem`)
  - 时间限制 (`-t`)
  - GPU 卡数 (`--gres=gpu`)
  - QoS (`--qos`)

### 2. AIJobSubmit.vue (AI 作业提交)
- 添加了相同的参数自动更新功能
- 支持训练和推理任务的脚本参数同步

### 3. ContainerJobSubmit.vue (容器作业提交)
- 优化了 `generatedScript` 计算属性
- 确保时间格式正确（HH:00:00）
- 只在参数值大于 0 时添加相应的 SBATCH 指令

### 4. AITasks.vue (AI 任务管理)
- 在创建任务表单中添加了参数自动更新功能
- 支持训练和推理任务的参数同步

## 功能特性

### 智能更新
- 如果脚本中已存在某个参数，则更新其值
- 如果脚本中不存在某个参数，则在适当位置插入
- 如果参数值为 0 或空，则移除该参数行

### 参数处理
- **内存**: 值为 0 时移除 `--mem` 行
- **时间**: 值为 0 时移除 `-t` 行，否则格式化为 `HH:00:00`
- **GPU**: 值为 0 时移除 `--gres=gpu` 行
- **QoS**: 值为空时移除 `--qos` 行

### 脚本清理
- 自动清理多余的空行（连续 3 个以上空行合并为 2 个）
- 保持脚本格式整洁

## 使用示例

用户在表单中：
1. 将节点数从 1 改为 2
2. 将 CPU 核心数从 8 改为 16
3. 将内存从 0 改为 32GB

脚本内容会自动从：
```bash
#!/bin/bash
#SBATCH -J my_job
#SBATCH -p compute
#SBATCH -N 1
#SBATCH -c 8
```

更新为：
```bash
#!/bin/bash
#SBATCH -J my_job
#SBATCH -p compute
#SBATCH -N 2
#SBATCH -c 16
#SBATCH --mem=32G
```

## 技术实现

使用 Vue 3 的 `watch` API 监听表单参数变化：

```typescript
watch(
  () => [
    form.value.name,
    form.value.partition,
    form.value.nodes,
    form.value.cpus,
    form.value.memory,
    form.value.time,
    form.value.gpus,
    form.value.qos
  ],
  () => {
    updateScriptParams()
  },
  { deep: true }
)
```

## 注意事项

1. 只有当脚本内容包含 `#SBATCH` 指令时才会进行更新
2. 更新是基于正则表达式匹配，保持了脚本的其他内容不变
3. 用户手动编辑脚本后，参数更新仍会生效
4. 如果用户使用了非标准的 SBATCH 格式，可能需要手动调整

## 测试建议

1. 在各个作业提交表单中测试参数更改
2. 验证脚本内容是否正确更新
3. 测试边界情况（如参数为 0、空值等）
4. 确认用户手动编辑的脚本内容不会被意外覆盖
