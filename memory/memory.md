# memory.md — 长期记忆

## 用户偏好
- 人类技术能力一般，产品想法型角色
- 沟通风格：直接、简洁，不要废话
- 不喜欢复杂流程，追求简单高效

## 产品定位
- Rubick：内部局域网 Agent 工具平台（类似百宝盒）
- 用户安装、运行各种小型 Agent app
- 定位：个人/团队内部使用，非公网多租户
- 安全级别：局域网测试级，不做强安全控制

## 技术栈
- **语言**：TypeScript + Bun
- **HTTP 框架**：Hono
- **前端框架**：Vue 3 + Element Plus（rubick-createapp 全局安装，app 通过 /node_modules/ 引用）
- **桌面打包**：electrobun（仅 release，开发用 bun HTTP + 浏览器）
- **AI 执行**：qodercli，命令格式 `qodercli --model "ultimate" --dangerously-skip-permissions -p "{prompt}" -w {workdir}`
- **通信**：纯 HTTP，不走 IPC
- **包格式**：zip，含 package.json

## app 架构
- **shell.html**：通用壳页面，提供 iframe + 输入框 + 发送按钮 + 对话区
- **app/index.html**：表单层，通过 `/api/state` 保存和恢复数据（key-value-desc 格式）
- **backend/index.ts**：HTTP 后端，前端通过 `/api/backend/*` 调用
- **mcp/**：MCP 工具，AI agent 通过 qodercli 按需调用
- **prompt.txt**：AI 提示词模板，支持 `{form}`、`{input}`、`{formData}` 变量
- **数据流**：app 填写 → 实时存 `/api/state` → shell 发送时读 `/api/state` → qodercli（可选调用 MCP）→ 返回结果

## 目录结构
```
rubick/                          # 根目录
  AGENT.md                       # 架构师 + 执行者（我）
  .agent/skills/                 # 我的 skills
  memory/                        # 记忆体系
  rubick-createapp/              # app 开发调试工具
    AGENT.md                     # app 开发 agent 角色
    task.md                      # app 开发任务
    apps/                        # 所有开发的 app 存放在此目录下
  rubick/                        # 主程序（待开发）
```

## 工作流
- **模式 A**（工具自身）：人类 → 我（规划 + 编码）→ 验证 → 提交
- **模式 B**（app 开发）：人类 → 我（规划写 task.md）→ app 开发 agent → 我审查

## Skills
- 根目录：karpathy-guidelines, systematic-debugging, verification-before-completion, frontend-design
- rubick-createapp：karpathy-guidelines

## 关键约束
- task.md 在 .gitignore 中，仅本地跟踪
- 代码提交由我（架构师）负责
- 文档必须与代码同步
- 每次重启读取 memory/ 恢复上下文
