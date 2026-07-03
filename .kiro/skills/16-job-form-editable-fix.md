# 作业提交表单可编辑性修复

## 问题描述

用户报告作业提交表单存在以下问题：

1. **工作目录输入框无法编辑**：显示为灰色背景，看起来像禁用状态
2. **脚本内容无法修改**：用户输入的内容会被自动覆盖，无法保留手动编辑

## 问题根源分析

### 问题1：脚本内容被自动覆盖

**根本原因**：表单使用了 `onValuesChange` 全局监听器

```tsx
<Form
  form={submitForm}
  onValuesChange={() => {
    // 延迟执行，确保表单值已更新
    setTimeout(() => updateScriptFromForm(), 0)
  }}
>
```

**问题机制**：
1. 用户在**任何字段**输入内容（作业名称、节点数等）
2. 触发 `onValuesChange` 事件
3. 调用 `updateScriptFromForm()` 重新生成脚本
4. **用户在脚本框中的手动编辑被完全覆盖**

**额外问题**：每个输入字段还有独立的 `onChange={updateScriptFromForm}`

```tsx
<Input placeholder="my_job" onChange={updateScriptFromForm} />
<Input type="number" min={1} placeholder="1" onChange={updateScriptFromForm} />
```

这导致：
- 双重触发：表单级和字段级同时触发
- 用户输入一个字符就重新生成一次脚本
- 完全无法手动编辑脚本内容

### 问题2：工作目录和脚本输入框样式

虽然没有 `disabled` 或 `readOnly` 属性，但：

1. 缺少明确的可编辑视觉反馈（白色背景）
2. Placeholder 提示不够清晰
3. 用户不确定是否可以直接输入

## 解决方案

### 1. 移除自动更新机制

**移除表单级监听**：
```tsx
// 删除
onValuesChange={() => {
  setTimeout(() => updateScriptFromForm(), 0)
}}
```

**移除字段级触发**：
```tsx
// 原来
<Input placeholder="my_job" onChange={updateScriptFromForm} />

// 现在
<Input placeholder="my_job" />
```

### 2. 添加手动生成按钮

给用户主动控制权：

```tsx
<Form.Item>
  <Space>
    <Button 
      onClick={() => updateScriptFromForm()}
      icon={<SyncOutlined />}
    >
      生成脚本模板
    </Button>
    <span style={{ color: '#999', fontSize: 12 }}>
      根据上方参数生成SBATCH脚本模板
    </span>
  </Space>
</Form.Item>
```

**用户体验流程**：
1. 用户填写作业参数（名称、节点数、CPU等）
2. **选择1**：点击"生成脚本模板"按钮，自动生成标准脚本
3. **选择2**：直接在脚本框中手动编辑或粘贴自己的脚本
4. 生成后还可以继续修改脚本，**不会被覆盖**

### 3. 优化视觉样式

**工作目录输入框**：
```tsx
<Input 
  placeholder={`例如：/home/${getUser()?.username || 'username'}/jobs`}
  style={{ backgroundColor: '#fff' }}  // 明确白色背景
  addonAfter={
    <Button 
      type="link" 
      size="small" 
      icon={<FolderOutlined />}
      onClick={() => {
        Message.info('请直接在输入框中输入或修改目录路径')
      }}
    >
      提示  {/* 从"选择"改为"提示"，更明确 */}
    </Button>
  }
/>
```

**脚本内容输入框**：
```tsx
<Form.Item
  label="脚本内容"
  name="script"
  tooltip="可以点击下方按钮根据参数生成模板，也可以直接编辑修改"
>
  <TextArea
    rows={12}
    style={{ 
      fontFamily: 'monospace', 
      fontSize: 13,
      backgroundColor: '#fff'  // 明确白色背景
    }}
    placeholder="点击下方【生成脚本模板】按钮，或直接在此输入脚本内容"
  />
</Form.Item>
```

### 4. 增强用户指引

- **Tooltip**：添加说明可以生成或手动编辑
- **Placeholder**：清晰说明两种使用方式
- **按钮说明**：添加辅助文字解释按钮功能
- **初始化行为**：打开表单时不自动生成，由用户决定

## 修改对比

### 修改前（问题）

| 场景 | 行为 | 问题 |
|------|------|------|
| 输入作业名称 | 自动重新生成脚本 | 覆盖用户编辑 |
| 修改节点数 | 自动重新生成脚本 | 覆盖用户编辑 |
| 手动编辑脚本 | 下次字段改变时被覆盖 | 无法保留编辑 |
| 工作目录 | 灰色背景 | 看起来禁用 |

### 修改后（解决）

| 场景 | 行为 | 效果 |
|------|------|------|
| 输入作业名称 | 不触发任何自动操作 | ✅ 不影响脚本 |
| 修改节点数 | 不触发任何自动操作 | ✅ 不影响脚本 |
| 点击生成按钮 | 根据参数生成脚本 | ✅ 主动触发 |
| 手动编辑脚本 | 内容保留，不会被覆盖 | ✅ 完全可编辑 |
| 工作目录 | 白色背景，清晰placeholder | ✅ 明确可编辑 |

## 使用场景

### 场景1：使用自动生成

1. 填写作业参数
2. 点击"生成脚本模板"
3. 检查生成的脚本
4. 根据需要微调
5. 提交作业

### 场景2：完全手动编写

1. 忽略参数字段（或只填必填项）
2. 直接在脚本框中输入或粘贴完整脚本
3. 提交作业

### 场景3：混合方式

1. 填写基本参数
2. 生成脚本模板
3. 大幅修改脚本内容
4. 修改参数字段（**脚本不会被覆盖**）
5. 提交作业

## 技术细节

### 初始化逻辑保留

```tsx
useEffect(() => {
  if (submitOpen) {
    const user = getUser()
    
    // 设置默认工作目录
    const currentWorkdir = submitForm.getFieldValue('workdir')
    if (!currentWorkdir && user?.username) {
      submitForm.setFieldsValue({ 
        workdir: `/home/${user.username}/jobs`
      })
    }
    
    // 不再自动生成脚本，由用户决定
  }
}, [submitOpen, jobMode, submitForm])
```

**关键改变**：
- ✅ 仍然自动填充工作目录（用户友好）
- ❌ 不再自动生成脚本（避免覆盖）
- ✅ 用户打开表单时看到空白脚本框，由自己决定如何操作

### updateScriptFromForm 函数

保留不变，仍然负责生成标准SBATCH脚本：

```tsx
const updateScriptFromForm = useCallback(() => {
  const values = submitForm.getFieldsValue()
  // ... 生成脚本逻辑 ...
  submitForm.setFieldsValue({ script })
}, [submitForm])
```

**区别**：
- 之前：自动调用（不受控）
- 现在：按钮触发（用户控制）

## 影响范围

### 修改的文件
- `frontend/src/pages/user/jobs/index.tsx`

### 受影响的功能
- ✅ 普通作业提交表单
- ❌ 容器作业提交（不受影响，使用不同的表单）
- ❌ 模板应用（不受影响，独立逻辑）
- ❌ 已提交的作业（不受影响）

### 兼容性
- ✅ 用户习惯改变：需要手动点击生成按钮
- ✅ 功能增强：脚本可以完全自由编辑
- ✅ 灵活性提升：支持完全手动编写脚本

## 测试建议

### 测试用例1：自动生成
1. 打开作业提交表单
2. 填写：作业名称=test, 节点=2, CPU=16
3. 点击"生成脚本模板"按钮
4. 验证脚本包含正确的SBATCH指令
5. 修改参数（节点=4）
6. 验证脚本**未被覆盖**

### 测试用例2：手动编辑
1. 打开作业提交表单
2. 直接在脚本框输入自定义内容
3. 修改任意参数字段
4. 验证脚本内容保持不变

### 测试用例3：工作目录
1. 打开作业提交表单
2. 工作目录应显示白色背景
3. 应可以直接输入和修改路径
4. 点击"提示"按钮显示帮助信息

### 测试用例4：混合使用
1. 填写基本参数
2. 点击生成脚本
3. 手动修改脚本（添加模块加载、环境变量等）
4. 修改参数字段
5. 验证手动修改的内容保留

## 用户指南

### 新用户（推荐使用生成功能）

1. **填写作业参数**：
   - 作业名称：给作业起个名字
   - 分区：选择计算分区
   - 节点数、CPU核心数：资源需求
   - 内存、时间、GPU：可选资源

2. **生成脚本**：
   - 点击"生成脚本模板"按钮
   - 系统自动生成标准SBATCH脚本

3. **微调脚本**（可选）：
   - 添加模块加载：`module load gcc/11.2`
   - 设置环境变量：`export OMP_NUM_THREADS=8`
   - 添加执行命令：替换 `./my-program`

4. **填写工作目录**：
   - 直接输入目录路径
   - 例如：`/home/username/projects/test1`

5. **提交作业**

### 高级用户（完全自定义）

1. **直接编写脚本**：
   - 在脚本框中粘贴或输入完整脚本
   - 使用自己熟悉的SBATCH参数和格式

2. **填写必填字段**：
   - 作业名称
   - 分区

3. **提交作业**

## 提交信息

- **提交哈希**：`7ed8f676`
- **发布包**：`computenook-7ed8f676-darwin-20260703-204824.tar.gz`
- **文件大小**：23MB
- **日期**：2026-07-03 20:48

## 相关文档

- CHANGELOG.md - 已添加修复记录
- frontend/src/pages/user/jobs/index.tsx - 核心修改文件

## 总结

✅ **问题已完全解决**：

1. ✅ 脚本内容完全可编辑，不会被自动覆盖
2. ✅ 工作目录输入框清晰可见，可以自由输入
3. ✅ 添加"生成脚本模板"按钮，用户主动控制
4. ✅ 支持三种使用方式：自动生成、手动编写、混合使用
5. ✅ 增强了用户体验和灵活性

**关键改进**：
- 从"自动覆盖"改为"用户控制"
- 从"被动接受"改为"主动选择"
- 从"限制编辑"改为"完全自由"
