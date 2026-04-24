# rubick — 终端运行端

## 产品定位

`rubick` 是终端用户使用的 work 主程序，承载 app 安装、会话执行、结果查看。

## 本地目录结构

用户本地 `data/` 下固定结构（与 hub 对应，但存储解压后的内容）：

```
data/
├── apps/{descriptive-name}/        # app 解压后的内容，每个 app 一个子目录
│   ├── index.html
│   ├── app.json
│   ├── prompt.md
│   └── sessions/                   # 该 app 的所有运行实例
├── skills/{descriptive-name}/      # skill 解压后的内容
└── mcps/{descriptive-name}/        # mcp 解压后的内容
```

说明：
- 从 hub 下载 zip 后在本地解压到对应目录，安装即解压，卸载即删除
- MCP 配置通过 `.mcp.json` 文件管理，指向目标服务文件（如 `mcp-db-server.ts`）
- 桌面程序的运行时为 `bun`，动态获取当前工具的运行时来执行 MCP 服务

## 页面结构

- **App 页面**：已安装 app、个人常用 app、会话入口
- **App 仓库页面**：从 hub 浏览可安装 app（支持排序、搜索、安装状态）

## 会话模型

- 同一 app 可开启多个 session（类似 web 聊天多会话）
- 每个 session 启动后：
  - 上半区为结构化表单输入（如 IP、环境、账号等）
  - 下半区为 chat 补充区（非结构化补充说明）
- 点击"执行"后，本 session 的结构化输入冻结；chat 区可继续追加
- session 需要可切换、可关闭（建议做一个会话栏，而不是系统 dock 式强拟物）

## qodercli 调用

- `rubick` 可直接调用 `qodercli` 执行 app 任务
- 调用命令格式：`qodercli --model "ultimate" --dangerously-skip-permissions -w {workdir} -p "{prompt}"`
- 按 session 维度保留执行上下文和结果记录

## Session 执行流程

1. 用户在界面启动 app(A) 的一个会话(session)
2. 创建目录：`./data/apps/A/sessions/{时间戳}/`
3. 读取 `./data/apps/A/prompt.md` 的提示词，待会和 qodercli 交互时带上
4. 读取 `./data/apps/A/app.json` 获取依赖信息
5. 根据 `app.json`，将依赖的 skill 复制到：`./data/apps/A/sessions/{时间戳}/.qoder/skills/`
6. 在 `./data/apps/A/sessions/{时间戳}/` 目录下生成 `.mcp.json`，根据依赖的 mcp 信息，将需要用到的相对路径写入
7. 提取 app 界面上的信息（表单填写的 + chat 框中写的），组成含 session 信息的提示词：`prompt.md + app 界面信息`
8. 启动 qodercli：`qodercli --model "ultimate" --dangerously-skip-permissions -w ./data/apps/A/sessions/{时间戳}/ -p "{提示词}"`
9. 界面上出结果，用户可以继续 chat，但同一 session 不允许二次修改 app 中的业务输入框

## 更新能力

- 可向 hub 查询 `rubick` 自身更新
- 支持标准化包名下载和升级
