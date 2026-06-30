# 样式系统参考（CSS 变量 + 设计规范）

## 主题系统

三套主题通过 `data-theme` 属性切换：

```html
<html data-theme="light">   <!-- 亮色（默认）-->
<html data-theme="dark">    <!-- 暗色 -->
<html data-theme="ocean">   <!-- 深海蓝绿 -->
```

切换代码：
```ts
document.documentElement.setAttribute('data-theme', theme)
localStorage.setItem('theme', theme)
```

主题切换顺序：light → dark → ocean → light（循环）

---

## CSS 变量完整清单

### 颜色变量（每个主题独立定义）

| 变量 | Light | Dark | Ocean | 用途 |
|------|-------|------|-------|------|
| --background | 白色 | 深蓝黑 | 深海蓝 | 页面背景 |
| --foreground | 深蓝黑 | 浅蓝灰 | 浅青白 | 主文字 |
| --card | 白色 | 深蓝 | 深蓝绿 | 卡片背景 |
| --card-foreground | 深蓝黑 | 浅蓝灰 | 浅青白 | 卡片文字 |
| --primary | 深蓝 | 白 | 亮青 | 主色 |
| --primary-foreground | 浅白 | 深蓝黑 | 深蓝 | 主色前景 |
| --secondary | 浅灰蓝 | 深蓝 | 深蓝绿 | 次色 |
| --muted | 浅灰蓝 | 深蓝 | 深蓝绿 | 弱化背景 |
| --muted-foreground | 中灰蓝 | 中蓝灰 | 中青灰 | 弱化文字 |
| --accent | 浅灰蓝 | 深蓝 | 深蓝绿 | 悬浮/强调背景 |
| --border | 浅蓝灰 | 深蓝 | 深蓝绿 | 边框 |
| --destructive | 红 | 暗红 | 红 | 危险/删除 |
| --success | 绿 | 亮绿 | 青绿 | 成功状态 |
| --warning | 橙 | 橙 | 橙 | 警告状态 |

### 侧边栏专用变量

| 变量 | 用途 |
|------|------|
| --sidebar-bg | 侧边栏背景 |
| --sidebar-border | 侧边栏边框 |
| --sidebar-foreground | 侧边栏文字 |
| --sidebar-accent | 侧边栏悬浮/激活背景 |
| --sidebar-accent-foreground | 侧边栏激活文字 |
| --sidebar-primary | 侧边栏主色（头像/Logo渐变） |
| --sidebar-primary-foreground | 侧边栏主色前景 |

### 通用变量（所有主题共享）

```css
/* 间距 */
--spacing-xs: 4px
--spacing-sm: 8px
--spacing-md: 16px
--spacing-lg: 24px
--spacing-xl: 32px
--spacing-2xl: 48px

/* 圆角 */
--radius: 0.5rem
--radius-sm: calc(var(--radius) - 4px)  /* 0.25rem */
--radius-md: calc(var(--radius) - 2px)  /* 0.375rem */
--radius-lg: var(--radius)              /* 0.5rem */
--radius-xl: calc(var(--radius) + 4px)  /* 0.75rem */
--radius-full: 9999px

/* 阴影 */
--shadow-sm:  0 1px 2px 0 rgb(0 0 0 / 0.05)
--shadow-md:  0 4px 6px -1px rgb(0 0 0 / 0.1)
--shadow-lg:  0 10px 15px -3px rgb(0 0 0 / 0.1)
--shadow-xl:  0 20px 25px -5px rgb(0 0 0 / 0.1)

/* 字体族 */
--font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto,
               'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif
--font-family-mono: 'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace

/* 字体大小（响应式，见下） */
--font-size-xs: 0.75rem
--font-size-sm: 0.875rem
--font-size-md: 1rem
--font-size-lg: 1.125rem
--font-size-xl: 1.25rem
--font-size-2xl: 1.5rem
--font-size-3xl: 1.875rem

/* 字重 */
--font-weight-normal: 400
--font-weight-medium: 500
--font-weight-semibold: 600
--font-weight-bold: 700

/* 过渡 */
--transition-fast:   150ms ease
--transition-normal: 250ms ease
--transition-slow:   350ms ease

/* z-index 层级 */
--z-dropdown:       1000
--z-sticky:         1020
--z-fixed:          1030
--z-modal-backdrop: 9998
--z-modal:          9999
--z-tooltip:        1070
```

### 响应式字体断点

| 断点 | 屏幕宽度 | --font-size-base |
|------|---------|-----------------|
| 手机/竖屏 | < 768px | 0.9rem |
| 平板/小屏 | 768px ~ 1279px | 0.92rem |
| 标准屏 | 1280px ~ 1919px | 0.95rem（默认）|
| 大屏/2K/4K | ≥ 1920px | 1.05rem |

---

## 品牌颜色

Logo 渐变：`linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)`  
活跃菜单左边框：`hsl(262 83% 58%)` — 紫色（#7c3aed 附近）

---

## 布局尺寸规范

| 元素 | 尺寸 |
|------|------|
| Topbar 高度 | 56px |
| Sidebar 宽度（展开） | 220px |
| Sidebar 宽度（折叠） | 56px |
| Sidebar 宽度（平板） | 180px |
| 移动端 Sidebar 宽度 | 240px（fixed，滑入） |
| Nav 菜单项高度 | ~32px（padding 6-7px） |
| 用户头像 | 32px × 32px（圆形） |
| Logo 图标 | 36px × 36px（圆角 9px） |

---

## 常用 CSS 模式

### 卡片
```css
background: hsl(var(--card));
border: 1px solid hsl(var(--border));
border-radius: var(--radius-lg);
box-shadow: var(--shadow-sm);
```

### 按钮（主色）
```css
background: hsl(var(--primary));
color: hsl(var(--primary-foreground));
border-radius: var(--radius-md);
padding: 6px 14px;
font-size: var(--font-size-sm);
font-weight: var(--font-weight-medium);
transition: var(--transition-fast);
```

### 危险按钮
```css
background: hsl(var(--destructive));
color: hsl(var(--destructive-foreground));
```

### 图标按钮
```css
width: 34px; height: 34px;
border: none; background: none;
border-radius: var(--radius-md);
color: hsl(var(--muted-foreground));
transition: background var(--transition-fast);
/* hover */
background: hsl(var(--accent));
color: hsl(var(--accent-foreground));
```

### 活跃菜单项
```css
background: hsl(var(--sidebar-accent));
color: hsl(var(--sidebar-foreground));
font-weight: var(--font-weight-semibold);
box-shadow: inset 3px 0 0 hsl(262 83% 58%);
```

### 状态点（脉冲动画）
```css
width: 6px; height: 6px;
border-radius: 50%;
background: hsl(var(--success));
animation: pulse 2s infinite;

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

### 输入框
```css
background: hsl(var(--background));
border: 1px solid hsl(var(--border));
border-radius: var(--radius-md);
padding: 6px 10px;
font-size: var(--font-size-sm);
color: hsl(var(--foreground));
outline: none;
/* focus */
border-color: hsl(var(--ring));
box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
```

### Badge / 状态标签
```css
/* 成功 */
background: hsl(var(--success) / 0.1);
color: hsl(var(--success));
/* 危险 */
background: hsl(var(--destructive) / 0.1);
color: hsl(var(--destructive));
/* 警告 */
background: hsl(var(--warning) / 0.1);
color: hsl(var(--warning));
/* 通用 */
padding: 2px 8px;
border-radius: var(--radius-full);
font-size: var(--font-size-xs);
font-weight: var(--font-weight-medium);
```

---

## 移动端响应式规范

| 断点 | 行为 |
|------|------|
| < 768px | Sidebar 隐藏，顶栏显示汉堡菜单，点击遮罩关闭 |
| 768px ~ 1023px | Sidebar 宽度缩为 180px，隐藏部分顶栏文字 |
| ≥ 1024px | 完整布局 |

移动端隐藏元素：
- `.status-badge .status-text`（"集群在线"文字）
- `.btn-admin .btn-text`（按钮文字，只保留图标）
- 侧边栏折叠按钮

---

## 暗色主题子菜单激活样式

```css
/* Light */
.nav-sub-item.active {
  background: hsl(214 100% 97%);
  color: hsl(221 83% 53%);
}

/* Dark */
[data-theme="dark"] .nav-sub-item.active {
  background: hsl(214 60% 20%);
  color: hsl(214 100% 75%);
}
```
