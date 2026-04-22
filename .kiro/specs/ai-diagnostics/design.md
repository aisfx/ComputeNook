# Design Document: AI 故障诊断工具

## Overview

在 HPC 平台管理后台新增一个专用的 AI 故障诊断面板（`AIDiagnostics.vue`）。与现有的通用悬浮助手不同，该面板会在每次对话前自动采集集群实时快照（节点状态、活跃告警、资源使用率），将其注入 AI 上下文，使 AI 能给出针对当前集群状态的精准诊断建议。

整个功能纯前端实现，复用现有的 `/api/ai/chat` 后端接口，无需新增后端代码。

## Architecture

```
AdminLayout.vue
  └── AIDiagnostics.vue (新增)
        ├── ClusterSnapshot 采集层
        │     ├── GET /api/dashboard/stats      (节点/CPU/内存统计)
        │     ├── GET /api/dashboard/nodes      (节点详情列表)
        │     └── GET /api/monitoring/prom-alerts (活跃告警)
        ├── SnapshotSummary 摘要展示区
        ├── QuickActions 快捷诊断按钮
        └── ChatPanel 对话区
              └── POST /api/ai/chat             (复用现有接口)
```

## Components and Interfaces

### AIDiagnostics.vue

单文件组件，挂载在 `AdminLayout.vue` 的 `adminTab === 'ai-diagnostics'` 分支下。

**Props:** 无

**内部状态:**
```typescript
interface ClusterSnapshot {
  stats: { totalNodes: number; onlineNodes: number; downNodes: number; cpuUsage: number; memUsage: number; totalGPUs: number; allocGPUs: number }
  downNodeNames: string[]       // 离线节点名称列表
  alerts: Alert[]               // 活跃告警列表
  promConnected: boolean        // Prometheus 是否连通
  fetchedAt: string             // 采集时间
}

interface Alert {
  name: string
  severity: string
  instance: string
  summary: string
  activeAt: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  time: string
}
```

**关键方法:**
- `fetchSnapshot()` — 并行请求三个接口，构建 ClusterSnapshot
- `buildSystemPrompt(snapshot)` — 将 ClusterSnapshot 序列化为结构化文本，注入 AI system prompt
- `send(text)` — 发送消息，携带最近10条历史 + snapshot 上下文
- `renderContent(text)` — Markdown 渲染，代码块加复制按钮

### buildSystemPrompt 格式

```
你是一个 HPC 高性能计算集群的专业运维 AI，具备故障诊断和解决方案建议能力。

【当前集群状态快照 - {fetchedAt}】
节点: 总计{total}个，在线{online}个，离线{down}个
CPU使用率: {cpuUsage}%
内存使用率: {memUsage}%
GPU: 总计{totalGPUs}个，已分配{allocGPUs}个

【离线节点】
{downNodeNames 列表，无则显示"无"}

【活跃告警 ({count}条)】
{每条告警: [级别] 名称 | 实例 | 摘要 | 触发时间}

【Prometheus监控】{已连接/未连接}

请基于以上实时数据，帮助管理员诊断问题并给出具体的操作建议（包括 Slurm 命令）。
```

## Data Models

```typescript
// 快捷诊断问题
const QUICK_ACTIONS = [
  { label: '🔴 分析当前告警', prompt: '请分析当前所有活跃告警，判断严重程度并给出处理建议' },
  { label: '📴 诊断离线节点', prompt: '请分析离线节点的可能原因，给出排查步骤和恢复命令' },
  { label: '📊 分析资源瓶颈', prompt: '请分析当前集群资源使用情况，判断是否存在瓶颈并给出优化建议' },
  { label: '⚡ 作业调度优化', prompt: '请根据当前资源状态，给出 Slurm 作业调度配置优化建议' },
  { label: '🔍 集群健康检查', prompt: '请对当前集群做全面健康评估，列出需要关注的问题' },
]
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

**Property 1: 快照摘要数字一致性**
*For any* ClusterSnapshot，摘要区域显示的节点数、CPU使用率、告警数应与 snapshot 对象中的数据完全一致，不存在显示值与数据值不符的情况
**Validates: Requirements 1.2**

**Property 2: 对话历史截断**
*For any* 消息列表，当消息数量超过10条时，发送给 `/api/ai/chat` 的 messages 数组长度不超过10；当消息数量不超过10条时，发送全部历史
**Validates: Requirements 3.1**

**Property 3: system prompt 包含快照数据**
*For any* ClusterSnapshot，`buildSystemPrompt(snapshot)` 返回的字符串必须包含：节点总数、在线节点数、CPU使用率、内存使用率字段的实际数值
**Validates: Requirements 4.1**

**Property 4: 告警注入完整性**
*For any* 包含 N 条告警的 ClusterSnapshot（N > 0），`buildSystemPrompt(snapshot)` 返回的字符串必须包含每条告警的 alertname 字段值
**Validates: Requirements 4.2**

**Property 5: 离线节点注入完整性**
*For any* 包含离线节点的 ClusterSnapshot，`buildSystemPrompt(snapshot)` 返回的字符串必须包含每个离线节点的名称
**Validates: Requirements 4.3**

**Property 6: Prometheus 不可用时快照仍有效**
*For any* Prometheus 接口返回失败的情况，fetchSnapshot() 返回的 ClusterSnapshot 中 stats.totalNodes 应大于等于 0，downNodeNames 应为有效数组（非 null/undefined）
**Validates: Requirements 2.3**

**Property 7: 清空对话保留快照**
*For any* 已有快照和消息的状态，调用 clearMessages() 后，messages 数组长度为 0，但 snapshot 对象不为 null
**Validates: Requirements 3.4**

## Error Handling

| 场景 | 处理方式 |
|------|---------|
| 三个采集接口全部失败 | 显示"集群数据获取失败，AI 将在无上下文模式下工作"，仍允许对话 |
| Prometheus 未配置 | snapshot.promConnected = false，system prompt 中标注"监控数据不可用" |
| AI 接口返回错误 | 在对话区显示错误消息气泡，不中断对话 |
| AI 未配置（502） | 显示"AI 服务未配置，请联系管理员配置 AI_API_URL 和 AI_API_KEY" |

## Testing Strategy

### Unit Tests
- `buildSystemPrompt()` 函数：验证各字段正确注入
- `renderContent()` 函数：验证代码块渲染包含复制按钮
- 消息历史截断逻辑：验证超过10条时正确截断

### Property-Based Tests (使用 fast-check)

每个属性测试运行 100 次随机输入：

- **Property 1**: 生成随机 ClusterSnapshot，渲染摘要组件，验证显示值与数据一致
- **Property 2**: 生成随机长度(1-50)的消息列表，验证发送时截断到10条
- **Property 3/4/5**: 生成随机 ClusterSnapshot（含随机告警和离线节点），验证 buildSystemPrompt 输出包含所有必要字段
- **Property 6**: mock Prometheus 接口失败，验证 fetchSnapshot 返回有效结构
- **Property 7**: 生成随机消息列表和快照，调用 clearMessages，验证后置条件

测试框架: **Vitest + fast-check**
