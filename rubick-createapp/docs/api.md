# rubick-createapp API 文档

## 概述

rubick-createapp 是 rubick 应用的本地开发调试工具。启动后提供 HTTP API 服务，前端页面通过 `fetch` 调用 API。

**启动方式**：
```bash
bun index.ts ./path/to/app
```

默认监听 `http://localhost:3000`，可通过 `PORT` 环境变量修改。

---

## 内置 API

### POST /api/llm/run

调用 LLM（通过 qodercli）。

**请求体**：
```json
{
  "prompt": "你的提示词"
}
```

**成功响应** (200)：
```json
{
  "result": "LLM 的输出内容"
}
```

**错误响应** (400/500)：
```json
{
  "error": "错误信息"
}
```

**示例**：
```bash
curl -X POST http://localhost:3000/api/llm/run \
  -H "Content-Type: application/json" \
  -d '{"prompt": "写一个斐波那契函数"}'
```

---

### GET /api/fs/read

读取 app 目录下的文件。

**查询参数**：
| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| path | string | 是 | 相对于 app 目录的文件路径 |

**成功响应** (200)：
```json
{
  "content": "文件内容"
}
```

**错误响应** (400/403/500)：
```json
{
  "error": "错误信息"
}
```

**示例**：
```bash
curl "http://localhost:3000/api/fs/read?path=prompt.txt"
```

**安全限制**：路径必须在 app 目录范围内，不允许访问外部目录。

---

### POST /api/fs/write

写入文件到 app 目录。

**请求体**：
```json
{
  "path": "目标文件路径（相对 app 目录）",
  "content": "文件内容"
}
```

**成功响应** (200)：
```json
{
  "success": true
}
```

**错误响应** (400/403/500)：
```json
{
  "error": "错误信息"
}
```

**示例**：
```bash
curl -X POST http://localhost:3000/api/fs/write \
  -H "Content-Type: application/json" \
  -d '{"path": "output.txt", "content": "hello world"}'
```

**安全限制**：路径必须在 app 目录范围内。

---

### GET /api/state

读取持久化状态（从 `last.json` 文件）。

**成功响应** (200)：
```json
{
  "state": { /* last.json 的内容，解析为对象 */ }
}
```

如果 `last.json` 不存在：
```json
{
  "state": null
}
```

**示例**：
```bash
curl http://localhost:3000/api/state
```

---

### POST /api/state

保存持久化状态（写入 `last.json` 文件）。

**请求体**：
```json
{
  "state": { "key": "value" }
}
```

**成功响应** (200)：
```json
{
  "success": true
}
```

**示例**：
```bash
curl -X POST http://localhost:3000/api/state \
  -H "Content-Type: application/json" \
  -d '{"state":{"counter":42,"lastRun":"2026-05-06"}}'
```

---

### POST /api/http/request

HTTP 代理请求。

**请求体**：
```json
{
  "url": "https://example.com/api",
  "method": "GET",
  "headers": { "Authorization": "Bearer xxx" },
  "body": { "key": "value" }
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| url | string | 是 | 目标 URL |
| method | string | 否 | HTTP 方法，默认 GET |
| headers | object | 否 | 请求头 |
| body | object | 否 | 请求体（会被 JSON.stringify） |

**成功响应** (200)：
```json
{
  "status": 200,
  "data": "响应内容"
}
```

**示例**：
```bash
curl -X POST http://localhost:3000/api/http/request \
  -H "Content-Type: application/json" \
  -d '{"url":"https://httpbin.org/get","method":"GET"}'
```

---

## Backend API（自定义路由）

### 路由注入机制

当 app 目录下存在 `backend/index.ts` 时，rubick-createapp 启动时会自动加载并注册其中的路由。所有自定义路由统一挂载在 `/api/backend/*` 命名空间下。

### app 目录结构

```
app/
  index.html          # 前端页面
  backend/
    index.ts          # 后端入口文件
    utils.ts          # 其他业务文件（可选）
```

### backend/index.ts 编写规范

```typescript
import type { Hono } from "hono";

export default function registerRoutes(app: Hono) {
  // 注册路由——注意路径是相对于 /api/backend 前缀
  app.get("/health", (c) => {
    return c.json({ status: "ok", ts: Date.now() });
  });

  app.post("/echo", async (c) => {
    const body = await c.req.json();
    return c.json({ echo: body });
  });

  app.get("/greet/:name", (c) => {
    const name = c.req.param("name");
    return c.json({ message: `Hello, ${name}!` });
  });
}
```

### 前端调用方式

```javascript
// 调用自定义后端路由
const res = await fetch("/api/backend/health");
const data = await res.json();

const echoRes = await fetch("/api/backend/echo", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ msg: "hello" }),
});
```

### 注意事项

1. **路由前缀**：backend 中定义的路径会自动加上 `/api/backend` 前缀。例如 `app.get("/health")` 实际访问路径为 `/api/backend/health`
2. **TS 无需编译**：Bun 原生支持 TypeScript，backend 中的 `.ts` 文件直接运行
3. **动态导入**：backend/index.ts 通过 `import()` 动态加载，支持热修改后重启服务

---

## 错误码说明

| HTTP 状态码 | 说明 |
|---|---|
| 200 | 请求成功 |
| 400 | 请求参数错误（缺少必填参数等） |
| 403 | 访问被拒绝（路径超出 app 目录等） |
| 404 | 路由不存在 |
| 500 | 服务器内部错误 |

**错误响应格式**（所有错误统一返回）：
```json
{
  "error": "错误描述信息"
}
```

---

## 前端调用示例

完整的 test 页面示例：

```html
<script>
  // 调用 LLM
  async function runLLM(prompt) {
    const res = await fetch("/api/llm/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    return res.json();
  }

  // 读取文件
  async function readFile(path) {
    const res = await fetch(`/api/fs/read?path=${encodeURIComponent(path)}`);
    return res.json();
  }

  // 写入文件
  async function writeFile(path, content) {
    const res = await fetch("/api/fs/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, content }),
    });
    return res.json();
  }

  // 读取状态
  async function getState() {
    const res = await fetch("/api/state");
    return res.json();
  }

  // 保存状态
  async function setState(state) {
    const res = await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });
    return res.json();
  }
</script>
```
