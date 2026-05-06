# Rubick - 桌面 Agent 应用套件

## 产品概述

Rubick 是一个桌面应用程序，定位为个人/团队内部的 Agent 工具平台（类似百宝盒）。
用户可以在其中安装、运行各种小型 Agent 应用（简称 app）。

**技术栈**: TypeScript + Bun
**桌面框架**: ElectronBun（Bun 作为运行时，支持动态执行 TS 脚本）
**LLM 调用方式**: 通过 qodercli 间接调用，不直接对接 LLM API
**MCP 服务**: 由 TS 脚本实现

---

## 整体架构

Rubick 主程序包含三大模块：

1. **App 运行时** — 加载并运行 `./apps/` 目录下的小程序
2. **App 列表** — 展示已安装的 app，类似苹果"启动台"，按使用频率排序（参考 `./menu.png`）
3. **设置** — 管理配置（如 app 仓库地址等，初期可简化）

---

## 运行界面

参考 `./app.png` 和 `./menu.png`（仅为示意，实际 UI 需专业设计）。

**整体布局**：

- 左侧栏 — 已打开的 app 列表 + 底部导航（app列表 / 设置）
- 主内容区 — 初始显示 app 的 `index.html`；用户点击"发送"后切换为聊天视图
- 底部输入区 — 通用文本输入 + "发送"按钮
- 窗口标题栏 — ElectronBun 自带的系统按钮（关闭、最小化、最大化）

**视图切换**：

| 左侧点击 | 主内容区显示 |
|----------|-------------|
| 某个已打开的 app | 该 app 的界面（index.html 或聊天视图） |
| "app列表" | 九宫格启动台，展示所有已安装的 app（类似 macOS Launchpad） |
| "设置" | 设置页面 |

**交互流程**:
1. 打开 app → 显示 `index.html`（用于收集基本信息）
2. 用户填写表单 → 在底部输入区补充说明 → 点击"发送"
3. 系统将 `prompt + 界面数据 + 用户输入文字` 一并发送给 qodercli 处理
4. 主内容区切换为聊天视图，展示对话内容（类似 ChatGPT 网页版，支持多轮对话，同一 session）

> 注意：点击"发送"后**不可返回** `index.html` 重新编辑。如需修改表单数据，需关闭 app 后重新打开（`last.json` 会恢复上次填写的数据）。

---

## 目录结构

```
rubick/                          # 主程序 (Windows 下可能为 rubick.exe)
setting.json                     # rubick 全局配置
apps/
  <app-name>/
    app.ico                      # app 图标，显示在启动台中
    app.json                     # app 元信息（开发者、开发时间、描述、版本号、调试器版本号）
    index.html                   # app 启动页面，用于信息收集
    prompt.txt                   # 系统提示词模板，如: "这是一个计算xxx的app，用户提供的信息如下: {表单数据}"
    .mcp.json                    # MCP 服务器配置
    last.json                    # 上次运行的表单数据，用于恢复界面状态
    .agent/
      skills/                    # 技能定义
      mcp-servers/               # MCP 服务器定义
    .run/                        # 运行时工作目录（每次运行前清理，仅允许单实例。用户关闭 app 或进程异常退出时自动清理）
    package.json                 # app 的 TS 依赖声明
    *.ts                         # 业务脚本，支撑 index.html 或提供额外功能
    ...                          # 其他 app 自有文件（可通过 HTTP 或本地读取访问）
```

---

## App 运行时需要提供的 API

Rubick 需向 app 的 TS 脚本注入一组 API，包括但不限于：

| 能力 | 说明 |
|------|------|
| LLM 调用 | 封装 qodercli 调用，对外暴露通用接口名（如 `runAgent(prompt)`），不暴露 "qoder" 字眼 |
| 文件读写 | 受限的文件系统操作 |
| HTTP 请求 | 发送网络请求 |
| HTTP 路由注册 | 允许 app 注册 HTTP 端点供 `index.html` 调用 |
| 状态持久化 | 读写 `last.json` |

> 设计原则：Clean Architecture，调用方无需关心底层是 qodercli 还是其他实现。

---

## 依赖管理

采用 **方案 C**：`bun install -g` 全局安装。所有 app 共享依赖，减少磁盘占用。
app 的 `package.json` 仅用于声明所需依赖，安装时统一执行全局安装。

---

## 调试器/开发工具（rubick-create-app）

为方便开发者在 IDE（Cursor / Claude Code / Trae / VSCode 等）中开发调试 app，提供独立工具：

```
rubick-create-app/
  index.ts              # 主文件，内置所有与 rubick 运行时一致的 API
  AGENT.md              # 给 Agent IDE 的说明文档
  .agent/
    skills/             # 技能定义
```

**使用方式**：
```bash
bun rubick-create-app/index.ts ./path/to/my-app
```

启动本地服务，浏览器打开 `index.html` 进行开发调试。每次只运行一个 app。

**特点**：
- 单文件设计，内置所有 API，无需额外引用
- 可直接分发（TS 源码），不依赖 npm 仓库或公网
- 自带 AGENT.md 和 skills，Agent IDE 打开即可理解项目结构并辅助开发
- 与 rubick 运行时共享同一 API 实现逻辑，保证行为一致

---

## 安全

无需特别处理安全性。账号密码等敏感信息可以直接写在 skill、MCP 配置中。
定位为个人工具或企业内部使用，不面向公网多租户场景。

---

## 待办清单

## 待办清单

所有设计决策已确认，可以开始开发。
