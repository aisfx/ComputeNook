# Requirements Document

## Introduction

为 HPC 平台管理后台新增 AI 故障诊断工具。该工具能自动采集集群实时状态（节点、作业、告警、资源使用率），将上下文注入 AI，让管理员通过自然语言对话诊断集群故障、分析异常、获取解决方案建议。与现有的通用 AI 悬浮助手不同，该工具专为管理员设计，具备集群感知能力。

## Glossary

- **DiagnosticsContext（诊断上下文）**：发送给 AI 前自动采集的集群快照数据，包含节点状态、活跃告警、作业队列、资源使用率
- **AIChat（AI 对话）**：基于 `/api/ai/chat` 接口的多轮对话，每次请求携带诊断上下文
- **ClusterSnapshot（集群快照）**：某一时刻的集群状态摘要，用于构建 AI system prompt 的动态部分
- **AdminLayout（管理后台布局）**：`src/views/AdminLayout.vue`，管理员专用界面
- **Prometheus**：集群监控系统，提供节点指标和告警数据
- **Slurm**：HPC 作业调度系统，提供节点状态和作业队列数据

## Requirements

### Requirement 1

**User Story:** 作为集群管理员，我想在管理后台有一个专用的 AI 诊断面板，以便快速诊断集群故障并获取解决方案。

#### Acceptance Criteria

1. WHEN 管理员进入管理后台，THE AdminLayout SHALL 在侧边栏显示「AI 诊断」入口，仅管理员可见
2. WHEN 管理员打开 AI 诊断页面，THE DiagnosticsPanel SHALL 展示当前集群快照摘要（节点总数/在线/离线、活跃告警数、运行作业数、CPU/内存使用率）
3. WHEN 管理员打开 AI 诊断页面，THE DiagnosticsPanel SHALL 提供预设的诊断快捷问题按钮（如「分析当前告警」「诊断离线节点」「分析资源瓶颈」）
4. WHILE 集群快照加载中，THE DiagnosticsPanel SHALL 显示加载状态，禁用发送按钮

### Requirement 2

**User Story:** 作为集群管理员，我想让 AI 自动获取集群实时数据作为上下文，以便 AI 能给出准确的诊断建议而不是泛泛的回答。

#### Acceptance Criteria

1. WHEN 管理员发送诊断请求，THE AIChat SHALL 自动将 ClusterSnapshot 注入为对话上下文的第一条 system 消息
2. WHEN 构建 ClusterSnapshot，THE DiagnosticsPanel SHALL 并行请求节点状态（`/api/dashboard/nodes`）、活跃告警（`/api/monitoring/prom-alerts`）、集群统计（`/api/dashboard/stats`）三个接口
3. WHEN Prometheus 未连接，THE ClusterSnapshot SHALL 仍包含 Slurm 节点状态数据，并标注「监控数据不可用」
4. WHEN 管理员点击「刷新上下文」，THE DiagnosticsPanel SHALL 重新采集 ClusterSnapshot 并更新摘要显示

### Requirement 3

**User Story:** 作为集群管理员，我想通过自然语言与 AI 多轮对话，以便深入分析问题并获取具体的操作命令建议。

#### Acceptance Criteria

1. WHEN 管理员发送消息，THE AIChat SHALL 保持最近 10 条对话历史作为上下文发送给 AI
2. WHEN AI 返回包含代码块的响应，THE DiagnosticsPanel SHALL 渲染代码高亮并提供一键复制按钮
3. WHEN 管理员点击预设快捷问题，THE DiagnosticsPanel SHALL 将该问题填入输入框并自动发送
4. WHEN 管理员点击「清空对话」，THE DiagnosticsPanel SHALL 清除所有消息历史但保留当前 ClusterSnapshot

### Requirement 4

**User Story:** 作为集群管理员，我想 AI 诊断工具使用专门针对 HPC 运维的 system prompt，以便获得更专业的故障诊断建议。

#### Acceptance Criteria

1. WHEN 发送 AI 请求，THE AIChat SHALL 使用包含集群实时数据的动态 system prompt，格式为：基础角色描述 + ClusterSnapshot 文本摘要
2. WHEN ClusterSnapshot 包含活跃告警，THE system prompt SHALL 将告警列表以结构化文本形式注入，包含告警名称、级别、实例、触发时间
3. WHEN ClusterSnapshot 包含离线节点，THE system prompt SHALL 将离线节点名称列表注入 system prompt
4. THE AIChat SHALL 复用现有的 `/api/ai/chat` 后端接口，不新增后端接口
