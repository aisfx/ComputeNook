# 实施计划 - 调整 TOP10 卡片尺寸

- [x] 1. 定义统一高度常量
  - 在 `frontend/src/pages/admin/overview/index.tsx` 顶部添加 `const TOP10_HEIGHT = 320`
  - _需求: 1_

- [x] 2. 统一三个 TOP10 卡片高度
  - 用户活跃 TOP10 卡片：`style={{ height: TOP10_HEIGHT }}`，`bodyStyle={{ height: TOP10_HEIGHT - 56, overflow: 'auto' }}`
  - 节点使用 TOP10 卡片：同上
  - 分区作业 TOP10 卡片：同上
  - _需求: 1, 2, 3_

- [x] 3. 统一告警监控卡片高度
  - 告警监控卡片同样使用 `style={{ height: TOP10_HEIGHT }}`
  - `bodyStyle={{ height: TOP10_HEIGHT - 56, overflow: 'auto' }}`
  - _需求: 1_

- [x] 4. 验证响应式布局
  - 三个 TOP10 卡片使用 `<Col xs={24} sm={8}>` 保持三列等宽
  - 告警监控卡片使用 `<Col xs={24}>` 占满全行
  - 调整窗口大小时布局保持正确
  - _需求: 5_

- [x] 5. 主题兼容性验证
  - 使用 antd inline style，不依赖自定义 CSS 变量
  - light / dark / ocean 三种主题下高度一致
  - _需求: 4_
