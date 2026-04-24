---
name: rubick-ui-design
description: Rubick 产品统一前端设计系统。所有工程（rubickhub、rubicktool、rubick）的前端界面必须遵守此规范，确保视觉一致性。
---

# Rubick UI Design System

Rubick 是面向白领用户的 work 类桌面产品体系。所有前端界面必须遵守以下设计系统。

## 设计原则

- **干净克制** — 不要花哨的装饰，信息密度合理
- **功能优先** — 表单、列表、按钮，清晰易用第一
- **保持一致** — 三个工程（rubickhub、rubicktool、rubick）使用同一套设计语言
- **不要过度设计** — 不需要动画特效、不需要创意排版、不需要品牌个性

## 设计令牌（Design Tokens）

### 色板

```css
/* 主色 */
--color-primary: #2563eb;        /* 按钮、链接、高亮 */
--color-primary-hover: #1d4ed8;  /* hover 状态 */
--color-primary-active: #1e40af; /* active 状态 */

/* 功能色 */
--color-success: #16a34a;
--color-warning: #d97706;
--color-error: #dc2626;

/* 文字 */
--color-text: #1f2937;           /* 主文字 */
--color-text-secondary: #6b7280; /* 次要文字（标签、提示） */
--color-text-disabled: #9ca3af;  /* 禁用 */

/* 背景 */
--color-bg: #ffffff;             /* 页面背景 */
--color-bg-secondary: #f9fafb;   /* 卡片/侧栏背景 */
--color-bg-tertiary: #f3f4f6;    /* 输入框背景 */

/* 边框 */
--color-border: #e5e7eb;
--color-border-hover: #d1d5db;

/* 分割线 */
--color-divider: #e5e7eb;
```

### 字体

```css
--font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
--font-mono: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", monospace;

--font-size-xs: 12px;
--font-size-sm: 13px;
--font-size-base: 14px;
--font-size-md: 16px;
--font-size-lg: 18px;
--font-size-xl: 20px;
--font-size-2xl: 24px;
--font-size-3xl: 30px;
```

### 间距

以 4px 为基础单位：

```css
--spacing-1: 4px;
--spacing-2: 8px;
--spacing-3: 12px;
--spacing-4: 16px;
--spacing-5: 20px;
--spacing-6: 24px;
--spacing-8: 32px;
--spacing-10: 40px;
--spacing-12: 48px;
```

### 圆角

```css
--radius-sm: 4px;   /* 小标签、badge */
--radius-md: 6px;   /* 按钮、输入框 */
--radius-lg: 8px;   /* 卡片、弹窗 */
--radius-xl: 12px;  /* 大容器 */
```

### 阴影

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06);
```

## 组件规范

### 按钮

```
主按钮：背景 --color-primary，白色文字，--radius-md，padding: 8px 16px
次按钮：白色背景，--color-primary 边框和文字，--radius-md
危险按钮：背景 --color-error，白色文字
小按钮：padding: 4px 12px，font-size: --font-size-sm
```

按钮状态：
- hover: 背景变深（--color-primary-hover）
- active: 背景更深（--color-primary-active）
- disabled: opacity 0.5，cursor: not-allowed

### 输入框

```
高度：36px（小）/ 40px（默认）
边框：1px solid --color-border
圆角：--radius-md
背景：--color-bg-tertiary
focus：边框变为 --color-primary，无外发光
placeholder：--color-text-disabled
```

### 卡片

```
背景：--color-bg
边框：1px solid --color-border
圆角：--radius-lg
内边距：--spacing-6
阴影：--shadow-sm（默认）/ --shadow-md（hover）
```

### 表格

```
表头背景：--color-bg-secondary，文字 --color-text-secondary
单元格：底部 1px solid --color-divider
行 hover：背景 --color-bg-tertiary
单元格内边距：--spacing-3 --spacing-4
```

### 标签页（Tabs）

```
未激活：文字 --color-text-secondary，无背景
激活：文字 --color-primary，底部 2px solid --color-primary
间距：--spacing-4
```

### 弹窗/对话框

```
背景：--color-bg
圆角：--radius-lg
阴影：--shadow-lg
遮罩：黑色 50% opacity
最大宽度：600px（小）/ 960px（大）
```

## 布局规范

### 页面布局

```
页面最大宽度：1200px，居中
内容内边距：--spacing-6（默认）
侧边栏宽度：240px（导航）/ 280px（会话栏）
```

### 表单布局

```
标签在输入框上方，间距 --spacing-2
表单字段垂直排列，间距 --spacing-4
表单按钮右对齐或居中，间距 --spacing-4
```

### 列表布局

```
列表项垂直排列，间距 --spacing-2
每项内水平 flex 布局，内容间距 --spacing-4
```

## 禁止事项

- 不要用 emoji 作为图标
- 不要用渐变背景（除非有特殊需求）
- 不要用超过 2 层的阴影
- 不要用自定义字体（只用系统字体）
- 不要用动画超过 200ms 的过渡效果
- 不要用超过 --radius-xl 的圆角
- 不要用紫色、粉色作为主色（只有 --color-primary 是蓝色）
