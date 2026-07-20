# Rubick

Rubick 是一个基于 Bun、TypeScript、OpenAI Agents SDK 和 Codex CLI 的内网 Agent 编排平台。

平台将用户请求交给总协调 Agent，由它判断是否需要执行任务，并沿着 Agent 组织树调度业务 Agent。每个业务 Agent 对应一个用户上传的 Codex 工作环境，环境包含 `AGENTS.md`、Skills、脚本和其他运行资源。

## 当前能力

- 使用 OpenAI Responses API 运行总协调 Agent
- 使用系统 `codex exec` 执行业务 Agent
- Agent 环境 ZIP 上传、下载和删除
- Agent 环境名称、上传时间和使用次数管理
- 服务端分页和搜索环境列表
- Agent 环境与组织树节点分离
- 同一个环境可以挂载到多个组织节点
- 组织树节点支持独立附加提示词
- 组织树拖拽挂载和节点选择挂载
- Session 多轮对话和历史记录
- 运行总耗时、当前 Agent 和当前 Agent 耗时
- LLM、路由、Codex stdout/stderr 独立运行日志
- Agent 环境使用流水统计

## 技术栈

- Bun
- TypeScript
- React
- Bun SQLite
- `@openai/agents`
- `@openai/agents-core`
- `@openai/agents-openai`
- Zod

## 快速开始

要求：

- Bun 1.3+
- 已安装并可以从 PATH 找到 `codex`
- Codex CLI 已完成登录和本地配置

安装依赖并启动：

```bash
bun install
bun run dev
```

打开：

```text
http://localhost:3000
```

检查类型和构建：

```bash
bun run typecheck
bun run build
```

## 配置

项目使用根目录 `.env`。`.env` 不会提交到 Git。

```env
LLM_BASE_URL=http://your-openai-compatible-endpoint
LLM_API_KEY=your-api-key
LLM_MODEL=gpt-5.6-luna

# 默认调用系统 PATH 中的 codex
CODEX_BIN=codex

# 可选：追加 Codex CLI 参数
CODEX_ARGS=

# Codex 的默认工作目录
CODEX_CWD=.

# 是否执行真实 Codex。默认 true
RUBICK_RUN_CODEX=true

# 数据目录，默认 ./data
RUBICK_DATA_DIR=./data
```

`LLM_BASE_URL` 使用 HTTP 或 HTTPS 均可，只要目标服务兼容 OpenAI Responses API。`CODEX_BIN` 可以改成 Codex 二进制的绝对路径。

## Agent 环境

环境 ZIP 至少需要包含：

```text
math-agent.zip
└── math-agent/
    ├── AGENTS.md
    ├── .agents/
    │   └── skills/
    ├── scripts/
    ├── bin/
    └── assets/
```

上传后平台会安装到：

```text
data/agent-environments/<environment-id>/
```

上传文件名会作为默认环境名称，例如 `数学老师.zip` 会显示为“数学老师”。环境可以被多个组织树节点重复挂载；节点上的附加提示词只影响该挂载点，不会修改共享环境。

正在组织树中使用的环境不能删除。需要先删除所有相关组织节点，再删除环境资产。

## 组织树

根节点是系统内置的“总协调 Agent”，不可删除。业务 Agent 以组织结构形式挂载：

```text
总协调 Agent
├── 学校校长
│   ├── 数学老师
│   └── 历史老师
└── 手机专家
```

一次任务的执行路径会记录在运行日志中，例如：

```text
总协调 Agent -> 学校校长 Agent -> 数学老师 Agent
```

节点使用次数按挂载节点统计。同一 Session 多次使用同一节点，会累计多次；同一个环境挂载在不同位置时，各位置分别统计。

## API

环境管理：

```text
GET    /api/environments?search=&page=1&pageSize=24
POST   /api/environments/upload
GET    /api/environments/:id
DELETE /api/environments/:id
```

组织树：

```text
GET    /api/agents/tree
POST   /api/agents/nodes
PATCH  /api/agents/nodes/:id
DELETE /api/agents/nodes/:id
```

Session 和运行：

```text
POST /api/sessions
GET  /api/sessions/:id
POST /api/sessions/:id/messages
GET  /api/runs/:runId/logs
```

## 模块结构

```text
server/
├── config/             配置读取
├── database/           SQLite 初始化和迁移
├── modules/
│   ├── agents/         Agent 节点、路由和使用统计
│   ├── codex/          Codex CLI 执行适配器
│   ├── environments/   Agent 环境上传、下载和生命周期
│   ├── llm/            Responses API 和总协调 Agent
│   ├── runs/           运行日志
│   └── sessions/       Session、消息和运行状态
└── index.ts            HTTP API 和顶层编排
```

前端入口在 `src/main.tsx`，样式在 `src/styles.css`。

## 数据目录

默认数据目录为 `./data`，建议 Docker 只挂载这一处：

```text
data/
├── rubick.sqlite
├── agent-environments/       # 全局 Agent 模板和环境资产
└── sessions/                 # 每次用户会话的工作区
```

数据库记录 Session、消息、Agent 节点、环境资产、运行日志和使用流水；全局 Agent 模板保存在 `data/agent-environments/`，Session 文件和运行产物保存在 `data/sessions/`。

每个 Session 也会在 `data/sessions/` 下创建独立的文件系统工作区。SQLite 保存结构化索引和对话记录，Session 目录保存用户输入、Agent 共享数据和可交付产物：

```text
data/sessions/<session-id>/
├── agent-<node-id>/       # 本次会话中 Agent 的工作目录，链接到共享环境
│   ├── AGENTS.md
│   ├── .agents/
│   ├── scripts/
│   └── data -> ../data     # 所有参与本次会话的 Agent 共享这里
└── data/
    ├── input/              # 用户原始需求和上传文件
    └── output/             # Agent 生成的可交付文件
```

Session 文件接口为 `GET /api/sessions/:id/input`、`POST /api/sessions/:id/input` 和 `GET /api/sessions/:id/output`；目录中的具体文件可通过返回的 URL 访问。

## 测试环境

仓库内的 `test-environments/` 提供学校校长、数学老师、历史老师和手机专家示例环境，用于验证环境导入、组织树路由、Codex 工作目录和多轮 Session。
