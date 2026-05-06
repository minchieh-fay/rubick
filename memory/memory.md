# 长期记忆

## 用户偏好

- **桌面框架：** electrobun（用户明确要求继续使用）
- **优先级：** 简单和可读性 > 安全、性能
- **沟通风格：** 直接、简洁、不迎合
- **用户角色：** 销售，非技术背景

## 技术选型

- 语言：TypeScript（全栈）
- 运行时：bun
- 桌面框架：electrobun（仅用于 release 打包）
- AI 执行引擎：qodercli
- 命令格式：`qodercli --model "ultimate" --dangerously-skip-permissions -p "{prompt}" -w {workdir}`
- 前端框架：Hono（rubick 后端）、bun HTTP（rubickhub）
- AI Skills 目录：`.agent/skills/`（不是 `.qoder/`）

## 产品关键约束

- **定位：** 面向白领用户的 work 类桌面产品体系
- **架构：** 三工程分离（rubickhub 仓库 / rubicktool 生成 / rubick 运行）
- **安全级别：** 局域网测试级，不做复杂账号体系和权限控制
- **范围：** 内部局域网协作，不面向公网
- **开发模式：** 开发期 BS 架构（bun HTTP + 浏览器），release 才套 electrobun BrowserWindow
- **通信方式：** 全程 HTTP，不走 IPC

## 产品核心流程

开发者用 rubicktool 描述需求 → qodercli 生成 app → 预览调试 → 上传到 hub → 终端用户用 rubick 下载安装 → 执行 session 任务

## 三个工程职责

| 工程 | 职责 | 端口 |
|------|------|------|
| rubickhub | 仓库分发（上传/下载/列表/统计） | 3000 |
| rubicktool | 可视化 App 生成工具（开发者用） | 3002（目标） |
| rubick | 终端用户运行端（安装 app、创建 session、执行） | 3001 |

## rubickhub 包命名规范

格式：`{type}-{descriptive-name}-{YYYYMMDDHHmmss}-{version}.zip`

例：`app-data-report-20260424150000-1.0.0.zip`

## rubick session 执行流程

1. 创建 session（idle 状态）
2. 用户填写表单数据 + 补充说明
3. 点击执行 → 标记 running
4. 创建 work 目录，复制 skills，生成 .mcp.json
5. 调用 qodercli（prompt = prompt.md + 表单数据 + chat 消息）
6. 流式输出结果（SSE）
7. 更新状态 completed/error，上报使用统计

## 文档体系

- `docs/products/` — 产品定义（architecture, hub, tool, rubick, specs）
- `docs/目录结构说明.md` — 目录结构
- `memory/` — 三层记忆（memory.md, context.md, decisions.md）
- `.agent/skills/` — AI Skills（rubick-ui-design, rubick-typescript, karpathy-guidelines）

## AGENTS.md 角色

AI 是"全周期复杂产品负责人"，不是纯编码工具。职责包括产品定义、设计、开发、测试、部署、风险把控。有权利拒绝不合理需求。
