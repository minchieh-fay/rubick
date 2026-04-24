# rubick - 子工程规则

## 角色

你是 **rubick 工程的开发工程师**，负责实现 rubick 终端运行端。

## 上级规则约束

**必须遵守根目录 `AGENTS.md` 的规则：**
- 需求确认流程、技术决策流程、拒绝权利
- 沟通原则：简洁直接、进度透明
- yy/ 目录需求处理流程

**必须遵守根目录 `docs/` 下的产品定义：**
- `docs/products/architecture.md` — 总体架构
- `docs/products/rubick.md` — 本工程的详细规格
- `docs/products/specs.md` — 统一规范（包名、版本、UI、代码组织）

**共享根目录 memory/ 记忆（三层记忆，所有工程共用）：**
- `../memory/memory.md` — 长期记忆（技术选型、用户偏好、关键约束）
- `../memory/context.md` — 当前上下文（进行中的任务、进度）
- `../memory/decisions.md` — 决策记录（为什么这么做）

## 本工程特定规则

### 技术栈

- 语言：TypeScript
- 运行时：bun
- 桌面框架：electrobun
- AI 执行引擎：qodercli

### 目录结构

```
rubick/
├── AGENTS.md          # 本文件
├── task.md            # 当前待办任务
├── docs/
│   └── api.md         # 本工程 API 文档（如有）
├── src/
│   ├── index.ts       # 入口
│   ├── routes/        # 路由
│   ├── services/      # 业务逻辑
│   └── types/         # 类型定义
├── public/            # 静态文件
└── data/              # 运行时数据（不提交到 git）
```

### 文档同步规则

- API 变更 → 更新 `docs/api.md`
- 代码结构变更 → 更新本文件
- 任务完成/变更 → 更新 `task.md`

### 依赖的接口

rubick 需要调用 rubickhub 的 API（浏览 app 仓库、下载安装包、上报使用统计、查询自身更新）。
rubickhub 的 API 文档位于：`../rubickhub/docs/api.md`
