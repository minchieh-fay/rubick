# rubicktool API

Base URL: `http://localhost:3002`

## Hub Proxy Routes

### `GET /api/hub/apps`

从 rubickhub 获取 app 列表。

**Query 参数：** 无（内部默认按 `usageCount` 排序）

**响应：**
```json
[
  {
    "name": "string",
    "version": "string",
    "author": "string",
    "fileName": "string",
    "uploadedAt": "string",
    "downloads": 0,
    "usageCount": 0,
    "installed": false
  }
]
```

### `GET /api/hub/skills`

从 rubickhub 获取 skills 列表。

**响应：** `AppInfo[]`（同上）

### `GET /api/hub/mcps`

从 rubickhub 获取 mcps 列表。

**响应：** `AppInfo[]`（同上）

---

## App Generation

### `POST /api/generate`

调用 qodercli 生成 app，通过 SSE 流式输出进度。

**请求体：**
```json
{
  "prompt": "string",
  "skills": ["string"]?,   // 可选，选中的 skill 依赖
  "mcps": ["string"]?,     // 可选，选中的 mcp 依赖
  "sessionDir": "string?"  // 可选，不传则自动创建
}
```

**SSE 事件：**
- `{ type: "chunk", content: "..." }` — 流式输出片段
- `{ type: "done", success: true/false, output: "...", sessionDir: "..." }` — 完成
- `{ type: "error", error: "..." }` — 出错

---

## Preview

### `GET /api/preview/:sessionDir/*`

预览生成的 app 静态文件。

**参数：**
- `sessionDir` — 已生成 app 的目录名
- `*` — 相对文件路径（如 `index.html`、`style.css`）

**响应：** 文件内容（根据扩展名设置 Content-Type），404 或 403 于文件不存在或路径穿越。

---

## App Management

### `GET /api/apps`

获取本地已生成的 app 列表。

**响应：** `AppInfo[]`

### `GET /api/apps/:name/manifest`

获取指定 app 的 manifest（app.json 内容）。

**参数：**
- `name` — app 名称或目录名

**响应：**
```json
{
  "name": "string",
  "version": "string",
  "description": "string?",
  "author": "string?",
  "email": "string?",
  "dependencies": {
    "skills": ["string"],
    "mcps": ["string"]
  },
  "fields": []
}
```

**404：** `{ "error": "App not found" }`

### `POST /api/apps/:name/upload`

打包并上传 app 到 rubickhub。

**参数：**
- `name` — app 名称或目录名

**请求体：**
```json
{
  "developerName": "string",
  "developerEmail": "string"
}
```

**响应：**
```json
{
  "success": true,
  "fileName": "app-{name}-{timestamp}-{version}.zip"
}
```

**说明：** `developerName` 和 `developerEmail` 会作为 `author` 和 `email` 字段传递给 rubickhub 上传接口。

**500：** `{ "success": false, "error": "..." }`

---

## Developer Management

### `GET /api/developers`

获取已保存的开发者信息。首次使用返回 `null`。

**响应：**
```json
{
  "name": "string",
  "email": "string?"
}
```

无记录时返回 `null`。

### `POST /api/developers`

保存开发者信息到 `data/developer.json`。

**请求体：**
```json
{
  "name": "string",     // 必填
  "email": "string?"    // 可选
}
```

**响应：** 同请求体。
