# 设计文档 - 调整 TOP10 卡片尺寸

## 概述

管理员仪表板（AdminOverview）右侧有三个 TOP10 统计卡片和一个告警监控卡片。本次调整将三个 TOP10 卡片的高度统一为与告警监控卡片相同，实现视觉上的平衡对齐。

## 实现方案

### 统一高度常量

在 `frontend/src/pages/admin/overview/index.tsx` 中定义一个共享常量 `TOP10_HEIGHT`，所有卡片（TOP10 × 3 + 告警监控）都引用同一个值：

```tsx
const TOP10_HEIGHT = 320; // px
```

### Card 属性设置

每张卡片使用相同的 `style` 和 `bodyStyle`：

```tsx
<Card
  size="small"
  style={{ height: TOP10_HEIGHT }}
  bodyStyle={{ height: TOP10_HEIGHT - 56, overflow: 'auto', padding: '8px 12px' }}
>
```

其中 `56px` 是 antd Card `size="small"` 时标题栏的高度，body 高度 = 卡片总高度 - 标题高度。

### 响应式布局

三个 TOP10 卡片使用 `<Col xs={24} sm={8}>` 在小屏垂直堆叠、宽屏三列等宽排列。告警监控卡片使用 `<Col xs={24}>` 占满全行，但高度与 TOP10 卡片保持一致。

## 组件结构

```
AdminOverview
├── Row (顶部统计卡片 × 6)
├── Row (CPU / GPU 利用率)
├── Row (TOP10 × 3)                ← style.height = TOP10_HEIGHT
│   ├── Col sm=8: 用户活跃 TOP10
│   ├── Col sm=8: 节点使用 TOP10
│   └── Col sm=8: 分区作业 TOP10
├── Row (告警监控)                 ← style.height = TOP10_HEIGHT (同上)
│   └── Col xs=24: 告警监控卡片
└── Card (节点状态总览表格)
```

## 主题兼容性

使用 antd Card + inline style，不依赖自定义 CSS 变量，在 light / dark / ocean 三种主题下均保持一致的卡片高度。
