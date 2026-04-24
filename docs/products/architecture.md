# Rubick 总体架构

## 产品定位

Rubick 是一个面向白领用户的 work 类桌面产品体系：

- **rubickhub** — 内部仓库与分发中心（存放 app/skill/mcp 包，提供列表、下载、更新协议）
- **rubicktool** — 面向开发者的可视化制作用具（用户描述 -> qodercli 生成 app）
- **rubick** — 面向终端使用者的运行端（安装 app、创建 session、执行任务）

## 技术基线

- 语言：`TypeScript`（全栈）
- 运行时：`bun`
- 桌面框架：`electrobun`
- AI 执行引擎：`qodercli`（`qodercli --model "ultimate" --dangerously-skip-permissions -p "{prompt}" -w {workdir}`）

说明：
- `rubicktool` 和 `rubick` 都可以调用 `qodercli`
- 调试阶段不启用 `electrobun`，保持 BS 结构便于调试
- 构建阶段加入 `BrowserWindow()` 函数，打包成桌面应用

---

## 术语约定

| 术语 | 说明 |
|------|------|
| app | 业务应用包，给终端用户安装和使用 |
| skill | 能力模板/提示词能力包 |
| mcp | 外部能力调用模块（工具服务） |
| session | 用户在某个 app 下的一次会话实例 |
| hub | 指 `rubickhub` |

---

## 与传统 work 产品的区别

1. **AI 调用方式**：不调用 LLM API，而是调用 `qodercli`（类似 claude code），用 TS 封装后通过 `spawn` 执行
2. **架构分离**：
   - **编排运行层**：含规则、agent 逻辑等，编译到桌面程序中
   - **外置文件包层**：mcp、skills、app、数据（含记忆等）存放在程序目录的 `plugins/` 和 `apps/` 目录
   - 外置文件包后续可从 hub 服务器下载

---

## 典型流程

1. 开发者在 `rubicktool` 中用自然语言描述需求
2. `rubicktool` 调用 `qodercli` 生成或修改 app 内容
3. 开发者本地预览/调试（rubicktool 内加载 `index.html`，启动临时 session 目录测试）
4. 打包成 zip 上传到 `rubickhub`
5. 终端用户在 `rubick` 的 app 仓库页浏览、下载、安装 app
6. 用户在 `rubick` 中启动 app session 执行任务，`rubick` 调用 `qodercli` 处理
7. `rubick` 将 app 的下载/使用统计上报到 `rubickhub`

---

## 三工程关系

```
开发者 ──> rubicktool（生成 app）──> 上传 ──> rubickhub（仓库）
                                                    │
终端用户 ──> rubick（运行端）  <── 下载 ──┘
```
