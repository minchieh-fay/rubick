# 决策记录

## [2026-04-24] Skills 目录迁移：.qoder/ → .agent/

**决策：** 将所有 skills 从 `.qoder/skills/` 迁移到 `.agent/skills/`

**原因：** qodercli 更新后支持 `.agent` 目录，不再需要放在 `.qoder` 目录

**替代方案：** 保持 `.qoder/skills/`（但最终会被废弃）

**影响：** 更新了 3 个子工程的 AGENTS.md 引用和目录结构文档

---

## [2026-04-24] 桌面应用开发模式：BS 架构 + electrobun 仅用于 release

**决策：** 开发期间用 bun HTTP 服务 + 浏览器（BS 架构），release 构建时才用 electrobun BrowserWindow 包装

**原因：** 
- 避免开发期 IPC 复杂度
- 调试方便（浏览器 DevTools、刷新页面）
- electrobun 只是窗口壳，不参与业务逻辑
- 全程 HTTP 通信，不走 IPC

**替代方案：** 开发期也用电 robun（调试困难、热更新慢）

---

## [2026-04-24] 记忆架构：根目录共享，子工程不独立创建

**决策：** 所有 3 个子工程共享根目录 `memory/` 下的三层记忆，不在子工程内各自创建

**原因：** 避免信息碎片化，简化管理，3 个工程属于同一产品体系

---

## [2026-04-24] task.md 文件加入 .gitignore

**决策：** task.md 不提交到 git，仅本地跟踪

**原因：** task.md 是本地任务跟踪，不是团队共享文件，避免 git 污染

---

## [2026-04-24] rubicktool 需要重写

**决策：** 放弃之前 qodercli 生成的 rubicktool 代码，从零重写

**原因：** 之前的代码架构方向完全错误（用了 electrobun BrowserWindow 而非 bun HTTP 服务），功能缺失严重（只有空壳）

---

## [2026-04-24] rubick `/api/apps` 路由需要修复

**决策：** `/api/apps` 应返回本地已安装 app 列表，而非调用 `hub.fetchApps()` 返回仓库所有 app

**原因：** "我的 App" 页面应该展示本地安装的应用，当前实现混淆了本地和仓库概念
