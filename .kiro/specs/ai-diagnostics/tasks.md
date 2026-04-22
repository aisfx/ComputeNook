# Implementation Plan

- [x] 1. 创建 AIDiagnostics.vue 组件骨架和数据层


  - 创建 `src/views/AIDiagnostics.vue`，定义 ClusterSnapshot、Message、Alert 接口类型
  - 实现 `fetchSnapshot()` 并行请求三个接口（stats、nodes、prom-alerts）
  - 实现 `buildSystemPrompt(snapshot)` 将快照序列化为结构化文本
  - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.2, 4.3_

- [ ]* 1.1 为 buildSystemPrompt 写属性测试
  - **Property 3: system prompt 包含快照数据**
  - **Property 4: 告警注入完整性**
  - **Property 5: 离线节点注入完整性**
  - **Property 6: Prometheus 不可用时快照仍有效**
  - **Validates: Requirements 4.1, 4.2, 4.3, 2.3**



- [ ] 2. 实现快照摘要展示区和快捷操作
  - 实现顶部集群快照摘要卡片（节点数、CPU%、内存%、告警数、GPU）
  - 实现「刷新上下文」按钮，点击重新调用 fetchSnapshot()
  - 实现 5 个预设快捷诊断按钮（QUICK_ACTIONS 列表）
  - 实现加载状态：fetchSnapshot 进行中时显示 loading，禁用发送按钮
  - _Requirements: 1.2, 1.3, 1.4, 2.4_

- [x]* 2.1 为快照摘要写属性测试

  - **Property 1: 快照摘要数字一致性**
  - **Validates: Requirements 1.2**

- [ ] 3. 实现对话区和消息发送逻辑
  - 实现消息列表渲染（用户/AI 气泡，时间戳）
  - 实现 `send(text)` 函数：截取最近10条历史 + 注入 snapshot system prompt，调用 `/api/ai/chat`
  - 实现 `renderContent(text)` Markdown 渲染：代码块高亮 + 复制按钮
  - 实现清空对话按钮（清空 messages，保留 snapshot）
  - 实现输入框 Enter 发送 / Shift+Enter 换行
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x]* 3.1 为对话逻辑写属性测试


  - **Property 2: 对话历史截断**
  - **Property 7: 清空对话保留快照**
  - **Validates: Requirements 3.1, 3.4**

- [x] 4. 注册到 AdminLayout 并添加导航入口



  - 在 `AdminLayout.vue` 中 import AIDiagnostics 组件
  - 在侧边栏添加「🤖 AI 诊断」独立导航项（adminTab = 'ai-diagnostics'）
  - 在 content-area 添加 `<AIDiagnostics v-else-if="adminTab === 'ai-diagnostics'" />`
  - 在 currentTitle map 中添加 'ai-diagnostics': 'AI 故障诊断'
  - _Requirements: 1.1_

- [ ] 5. 最终检查 - 确保所有测试通过
  - Ensure all tests pass, ask the user if questions arise.
