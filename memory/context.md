# 当前上下文

## 当前状态（2026-04-24 最新）

**阶段：** 代码质量审查完成，task.md 已更新，skills 迁移到 .agent/ 目录

### 三个工程进度

| 工程 | 完成度 | 状态 |
|------|--------|------|
| **rubickhub** | ~95% | 基本完成，所有 API 可用，剩前端完善 |
| **rubick** | ~80% | 后端完整，前端有 5 个 bug 待修 |
| **rubicktool** | ~15% | 架构方向错误，需要重写 |

### rubicktool 问题

之前的 qodercli 实例完全误解了产品定位：
- 错误地用了 electrobun BrowserWindow（开发期不应该用，应该用 bun HTTP + 浏览器）
- generateApp() 里是 setTimeout 模拟，没有集成 qodercli
- 缺少所有核心功能：开发者信息管理、skill/mcp 选择、依赖检查、预览调试、上传到 hub
- 只有一个 textarea + 按钮的空壳

### rubick 待修 Bug（优先级最高）

1. **`/api/apps` 路由错误**（server.ts:22-32）— 调用 `hub.fetchApps()` 返回仓库所有 app，应该返回本地已安装 app。"我的 App"页面显示错误
2. **前端 EventSource 混乱**（app.js:82-89）— 创建 EventSource 后立即关闭，应该直接用 fetch
3. **`loadAppSessions` 未检查 `currentApp`** — null 时会报错
4. **`runQodercli` stderr 输出** — stderr 包含非用户友好错误，应过滤
5. **缺少 session 历史加载初始化**

### rubickhub 待办

- 验证 deletePackage 和 updatePackage 在 data.ts 中的实现（是否同时删除了 JSON 索引和物理文件）
- 前端完善：上传表单、搜索框、分页控件、删除按钮

## 下一步计划（按优先级）

1. **修 rubick 的 bug**（最快出效果，让整个产品能跑通基础流程）
2. **完善 rubickhub 前端**（让仓库管理可用）
3. **重写 rubicktool**（最大工作量，按 task.md 中 4 个 Phase 逐步来）

## 如何启动子项目开发

在子项目目录中打开 qodercli，用以下指令：

- **rubickhub：** `请按 task.md 中的待办列表执行，优先验证删除/更新接口的 data.ts 实现，然后完善前端`
- **rubick：** `请按 task.md 中的 Bug 修复列表执行，优先修复 /api/apps 路由错误，然后修前端 EventSource 和 null guard`
- **rubicktool：** `请按 task.md 中的 Phase 1 开始：改用 bun HTTP 服务模式，重建目录结构`

## 目录结构（重要）

```
rubick/
├── AGENTS.md              # AI 角色定义
├── docs/                  # 产品文档
├── memory/                # 三层记忆
├── .agent/
│   └── skills/            # AI Skills（3个）
│       ├── rubick-ui-design/
│       ├── rubick-typescript/
│       └── karpathy-guidelines/
├── rubickhub/             # 仓库分发（~95% 完成）
├── rubicktool/            # App 生成（~15%，需要重写）
└── rubick/                # 运行端（~80%，有 bug 待修）
```

## 已知问题/阻塞

无阻塞，按计划推进即可。
