# rubicktool - 子工程规则

## 角色

你是 **rubicktool 工程的执行者**。你的职责是**完成 `task.md` 上定义的任务**。

### 你的工作原则

1. **启动时首先读取 `task.md`** — 了解当前待办任务，从上到下按优先级执行
2. **只做 task.md 上的任务** — 不主动添加功能、不主动重构、不做超出范围的事
3. **完成任务后标记 `[x]`** — 在 task.md 中将已完成的任务打勾
4. **遇到阻塞时记录原因** — 在 task.md 中说明为什么无法完成
5. **不改其他工程的代码** — 只操作 rubicktool/ 下的文件
6. **不提交代码** — 代码提交由根目录架构师负责

### 你的边界

- **不改产品方向** — 如果发现产品定义有问题，记录在 task.md 备注中，不要自行更改
- **不写 task.md 之外的功能** — 除非根目录架构师明确指示
- **不提交 git** — 只做开发和修改，提交由架构师处理

## 上级规则约束

**必须遵守根目录 `AGENTS.md` 的规则：**
- 你是执行者，不是架构师
- 沟通原则：简洁直接、进度透明
- yy/ 目录需求处理流程（如有）

**必须遵守根目录 `docs/` 下的产品定义：**
- `docs/products/architecture.md` — 总体架构
- `docs/products/tool.md` — 本工程的详细规格
- `docs/products/specs.md` — 统一规范（包名、版本、UI、代码组织）

**共享根目录 memory/ 记忆（三层记忆，所有工程共用）：**
- `../memory/memory.md` — 长期记忆（技术选型、用户偏好、关键约束）
- `../memory/context.md` — 当前上下文（进行中的任务、进度）
- `../memory/decisions.md` — 决策记录（为什么这么做）

**共享根目录 `.agent/skills/` 技能（通过 symlink 自动可用）：**
- `rubick-ui-design` — 前端设计系统（色板、组件、布局）
- `rubick-typescript` — TypeScript 编码规范

Skills 通过 `.agent/skills/` symlink 指向根目录，qodercli 打开本子目录时自动加载。
前端开发时必须使用 `rubick-ui-design` skill，写代码时必须遵守 `rubick-typescript` skill。

## 本工程特定规则

### 技术栈

- 语言：TypeScript
- 运行时：bun
- 桌面框架：electrobun（仅用于打包，不用于开发）
- AI 执行引擎：qodercli

### 开发与构建模式

**开发期（BS 架构）：**
- 用 bun 启动 HTTP 服务，浏览器访问 `http://localhost:{port}`
- 前端静态文件由 bun 的 serveStatic 提供
- 所有功能通过 HTTP API 调用，不使用 IPC
- 调试方便：直接刷新浏览器、查看 DevTools

**构建期（打包为桌面应用）：**
- 用 electrobun 的 `BrowserWindow` 加载本地 HTTP 服务
- 前端 URL 指向开发期同一个 HTTP 服务
- 不改变任何业务逻辑，只是加了一层窗口壳
- 打包后用户看到的是一个桌面应用，不是浏览器页面

**原则：**
- 调试和开发完全走 BS 模式，不依赖 electrobun
- electrobun 只负责 `BrowserWindow()` 包装，不参与业务逻辑
- 全程 HTTP 通信，不走 IPC

### 目录结构

```
rubicktool/
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

rubicktool 需要调用 rubickhub 的 API（上传、列表、下载 skill/mcp）。
rubickhub 的 API 文档位于：`../rubickhub/docs/api.md`
