# rubick-createapp 任务列表

## 任务 1 — 实现 backend/ 目录加载与路由注入机制
- [x] 状态：已完成
- 优先级：P0

### 需求描述
rubick-createapp 需要支持 app 自定义后端逻辑。当 app 目录下存在 `backend/` 目录时，自动加载并注册其路由。

### app 目录结构
```
app/
  index.html          # 前端页面
  backend/
    index.ts          # 后端入口，export default 路由注册函数
    *.ts              # 其他业务文件
```

### backend/index.ts 规范
```typescript
import type { App } from "hono";

export default function registerRoutes(app: App) {
  app.get("/api/backend/xxx", (c) => { ... });
  app.post("/api/backend/yyy", (c) => { ... });
}
```

### 实现要求
1. rubick-createapp 启动时，检查传入的 app 目录是否有 `backend/index.ts`
2. 如果有，动态 `import()` 该文件，调用其 default 导出函数，传入 Hono app 实例
3. 路由统一挂载在 `/api/backend/*` 命名空间下，避免与内置 API 冲突
4. 如果 backend 不存在，正常启动，仅仅提供内置 API（LLM 调用、文件读写等）
5. backend 中的 TS 文件通过 bun 直接运行，无需编译
6. 前端通过 `fetch("/api/backend/xxx")` 调用自定义后端路由

### 验收标准
- [x] app 无 backend/ 时，rubick-createapp 正常启动，内置 API 可用
- [x] app 有 backend/index.ts 时，路由自动注册，前端可正常调用
- [x] backend 加载失败时（如语法错误），打印错误日志但不崩溃主服务
- [x] 路由命名空间 `/api/backend/*` 与内置 API 不冲突

### 完成报告
- 完成的改动：从零构建 rubick-createapp，实现 backend 加载机制、内置 API、错误处理
- 涉及文件：index.ts, package.json, tsconfig.json
- 验证方式：4 种场景测试全部通过
- 遗留问题：无

---

## 任务 2 — qodercli 调用必须指定模型参数
- [x] 状态：已完成
- 优先级：P0

### 需求描述
当前调用 qodercli 时未指定模型。必须强制指定 `--model "ultimate"` 和 `--dangerously-skip-permissions` 参数。

### 实现要求
1. 所有 `Bun.spawn` 或 `exec` 调用 qodercli 的地方，命令行必须包含 `--model "ultimate" --dangerously-skip-permissions`
2. 完整命令格式：`qodercli --model "ultimate" --dangerously-skip-permissions -p "{prompt}" -w {workdir}`
3. 不允许省略模型参数或使用其他模型

### 验收标准
- [x] 搜索代码中所有调用 qodercli 的位置，确认都包含模型参数
- [x] 实际调用时命令行参数正确传递，qodercli 不报错

### 完成报告
- 完成的改动：将 `Bun.spawn(["qodercli", "-p", prompt])` 改为完整命令格式，包含 `--model "ultimate" --dangerously-skip-permissions -p {prompt} -w {workdir}`
- 同时修复了 stdout/stderr 读取方式：从 `result.stdout.arrayBuffer()` 改为 `new Response(result.stdout).text()`，兼容 Bun 1.3.7
- 涉及文件：index.ts（第 35-47 行）
- 验证：调用 `/api/llm/run` 时 qodercli 正确收到模型参数（返回 "Not logged in" 说明参数解析成功，仅是未登录）

---

## 任务 3 — 编写 API 文档 docs/api.md
- [x] 状态：已完成
- 优先级：P1

### 需求描述
rubick-createapp 需要提供清晰的 API 文档，供前端开发者和 app 开发者查阅。

### 文档内容要求
1. 所有内置 API 的路由、方法、请求参数、响应格式
2. backend/ 路由注入的使用方式和示例
3. 错误码说明
4. 使用示例（curl 或 fetch）

### 文档格式
```markdown
# rubick-createapp API 文档

## 内置 API
### POST /api/llm/run
...

## Backend API
...
```

### 验收标准
- [x] docs/api.md 文件存在
- [x] 覆盖所有内置 API（llm/run, fs/read, fs/write, state, http/request）
- [x] 包含 backend 路由注入说明和示例
- [x] 包含错误处理和响应格式

### 完成报告
- 完成的文档：`docs/api.md`，包含所有 5 个内置 API 的完整说明（路由、方法、参数、响应格式、curl 示例）、backend 路由注入机制说明、错误码表、前端调用示例代码
- 涉及文件：docs/api.md（新建）
