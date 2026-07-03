# 容器作业自动填充挂载目录和工作目录

## 问题描述

容器作业使用Enroot运行，需要正确的挂载目录配置。之前的实现：
1. 挂载目录和工作目录只显示placeholder，不自动填充
2. 工作目录使用 `/home/username/jobs`，与实际路径 `/fs/home/username` 不一致
3. 用户需要手动填写，容易出错

## 解决方案

### 1. 修改初始化逻辑

修改作业提交表单的初始化useEffect，为容器作业自动填充默认值：

```tsx
// 初始化作业提交表单的脚本内容和工作目录
useEffect(() => {
  if (submitOpen) {
    const user = getUser()
    
    if (user?.username) {
      // 设置默认工作目录
      const currentWorkdir = submitForm.getFieldValue('workdir')
      if (!currentWorkdir) {
        submitForm.setFieldsValue({ 
          workdir: `/fs/home/${user.username}`
        })
      }
      
      // 容器作业需要初始化挂载目录
      if (jobMode === 'container') {
        const currentMountDir = submitForm.getFieldValue('mountDir')
        if (!currentMountDir) {
          submitForm.setFieldsValue({
            mountDir: `/fs/home/${user.username}:/fs/home/${user.username}`
          })
        }
      }
    }
    
    // 只有普通作业需要初始化脚本
    if (jobMode === 'normal') {
      setTimeout(() => {
        const currentScript = submitForm.getFieldValue('script')
        if (!currentScript) {
          updateScriptFromForm()
        }
      }, 100)
    }
  }
}, [submitOpen, jobMode, submitForm, updateScriptFromForm])
```

### 2. 默认值说明

#### 挂载目录（容器作业专有）
- **默认值**: `/fs/home/${username}:/fs/home/${username}`
- **格式**: `宿主机路径:容器内路径`
- **用途**: 让容器可以访问用户的家目录
- **Enroot要求**: 需要明确指定挂载点

#### 工作目录（普通作业和容器作业通用）
- **默认值**: `/fs/home/${username}`
- **之前的错误值**: `/home/${username}/jobs`
- **修正原因**: 实际系统中用户家目录在 `/fs/home/` 下

### 3. 用户体验优化

1. **自动填充**: 打开提交表单时自动填入正确的默认值
2. **可编辑**: 用户仍可根据需要修改这些值
3. **智能判断**: 只在字段为空时填充，不覆盖用户已输入的内容
4. **模式感知**: 根据作业模式（normal/container）填充不同的字段

## Enroot容器说明

Enroot是NVIDIA开发的容器运行时，特点：
- 轻量级，专为HPC设计
- 与Slurm集成良好
- 需要明确指定挂载目录（不像Docker有默认行为）
- 挂载格式：`宿主机路径:容器内路径`

## 技术细节

### 字段关系

| 字段 | 普通作业 | 容器作业 | 默认值 |
|------|---------|---------|--------|
| 工作目录(workdir) | ✓ | ✓ | `/fs/home/${username}` |
| 挂载目录(mountDir) | ✗ | ✓ | `/fs/home/${username}:/fs/home/${username}` |
| 脚本内容(script) | ✓ | ✗ | 自动生成 |
| 运行命令(command) | ✗ | ✓ | 可选 |

### 初始化时机

- **触发条件**: `submitOpen` 变为 `true` 且有用户信息
- **填充条件**: 对应字段当前值为空
- **依赖字段**: `jobMode`（normal/container）

### 路径规范

系统路径结构：
```
/fs/home/
├── admin/
├── user1/
└── user2/
```

挂载示例：
```
# 单个挂载
/fs/home/admin:/fs/home/admin

# 多个挂载（逗号分隔）
/fs/home/admin:/fs/home/admin,/data:/data
```

## 相关文件

- `frontend/src/pages/user/jobs/index.tsx` - 作业提交表单

## 提交信息

```
fix: 容器作业自动填充挂载目录和工作目录

- 容器作业打开时自动填充挂载目录为家目录挂载
  格式：/fs/home/username:/fs/home/username
- 工作目录统一为 /fs/home/username（普通作业和容器作业一致）
- 之前的路径 /home/username/jobs 改为 /fs/home/username
- 确保使用Enroot时有正确的默认挂载配置
```

提交哈希：`725edbb2`
