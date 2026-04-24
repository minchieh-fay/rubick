# rubickhub API 文档

Base URL: `http://localhost:3000`（开发环境）

## CORS

所有接口均支持跨域请求（CORS）。服务端自动添加以下响应头：

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS, DELETE, PUT
Access-Control-Allow-Headers: Content-Type
```

---

## 1. 包列表查询（含分页、搜索）

**GET** `/api/{apps|skills|mcps}`

查询参数：
- `sort` (可选): 排序方式，`usageCount`（默认）| `downloads`
- `q` (可选): 关键词搜索，匹配包名或作者名（模糊匹配）
- `author` (可选): 按作者名过滤（模糊匹配）
- `page` (可选): 页码，从 1 开始，默认 1
- `pageSize` (可选): 每页条数，默认 20，最大 100

示例：
- `/api/apps?sort=downloads` — 按下载量排序
- `/api/apps?q=ssh` — 搜索包含 "ssh" 的包
- `/api/apps?author=zhangsan` — 过滤 zhangsan 的包
- `/api/apps?page=1&pageSize=10` — 分页查询
- `/api/apps?q=ppt&sort=usageCount&page=2` — 搜索、排序、分页

响应：
```json
{
  "items": [
    {
      "name": "根据md制作ppt",
      "version": "1.0.0",
      "author": "testuser",
      "email": "test@test.com",
      "fileName": "app-根据md制作ppt-20260424153000-1.0.0.zip",
      "uploadedAt": "2026-04-24T06:25:49.158Z",
      "downloads": 0,
      "usageCount": 0
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

## 2. 包上传

**POST** `/api/{apps|skills|mcps}/upload`

Content-Type: `multipart/form-data`

字段：
- `file` (File, 必填): zip 包文件
- `author` (string, 必填): 开发者姓名
- `email` (string, 可选): 开发者邮箱

包文件名必须符合规范：`{type}-{descriptive-name}-{YYYYMMDDHHmmss}-{version}.zip`

响应（成功 200）：
```json
{ "success": true, "name": "根据md制作ppt", "version": "1.0.0" }
```

响应（错误）：
- 400: `{ "error": "Missing file" }`
- 400: `{ "error": "Invalid package filename format" }`
- 409: `{ "error": "Package \"xxx\" already exists" }`

---

## 3. 包下载

**GET** `/api/{apps|skills|mcps}/download/{fileName}`

响应：
- 200: 返回 zip 文件
- 404: `{ "error": "Package not found" }`

---

## 4. 包删除

**DELETE** `/api/{apps|skills|mcps}/{name}`

`name` 为包的 descriptive-name（URL 编码）。

响应（成功 200）：
```json
{ "success": true, "name": "根据md制作ppt" }
```

响应（错误）：
- 404: `{ "error": "Package not found" }`

---

## 5. 包更新（新版本）

**PUT** `/api/{apps|skills|mcps}/{name}`

Content-Type: `multipart/form-data`

`name` 为包的 descriptive-name（URL 编码）。

字段：
- `file` (File, 必填): 新版本 zip 包文件
- `author` (string, 可选): 新开发者姓名
- `email` (string, 可选): 新开发者邮箱

包文件名必须符合规范：`{type}-{descriptive-name}-{YYYYMMDDHHmmss}-{version}.zip`

响应（成功 200）：
```json
{ "success": true, "name": "根据md制作ppt", "version": "2.0.0" }
```

说明：
- 保留原有的 `downloads` 和 `usageCount` 统计
- 更新 `version`、`fileName`、`uploadedAt`
- 删除旧的 zip 文件

响应（错误）：
- 400: `{ "error": "Missing file" }`
- 400: `{ "error": "Invalid package filename format" }`
- 400: `{ "error": "Package name in filename does not match URL" }`
- 404: `{ "error": "Package not found" }`

---

## 6. 使用统计上报

**POST** `/api/usage/report`

Content-Type: `application/json`

Body：
```json
{ "appName": "根据md制作ppt" }
```

响应：
```json
{ "success": true }
```

---

## 7. 客户端版本查询

**GET** `/api/clients/latest?name=rubick|rubicktool`

响应：
```json
{
  "name": "rubick",
  "version": "1.0.0",
  "fileName": "rubick-1.0.0-mac.dmg",
  "platform": "mac",
  "downloadUrl": "/api/clients/rubick-1.0.0-mac.dmg"
}
```

不带参数时返回所有客户端列表：
```json
{ "clients": [...] }
```

---

## 8. 客户端下载列表

**GET** `/api/clients`

响应：
```json
{
  "clients": [
    {
      "name": "rubick",
      "version": "1.0.0",
      "fileName": "rubick-1.0.0-mac.dmg",
      "platform": "mac",
      "downloadUrl": "/api/clients/rubick-1.0.0-mac.dmg"
    }
  ]
}
```

---

## 9. 客户端文件下载

**GET** `/api/clients/{fileName}`

响应：返回对应平台的安装包文件

---

## 错误响应格式

所有错误响应均遵循以下格式：

```json
{ "error": "错误描述信息" }
```

未知路由返回 404：
```json
{ "error": "Not found", "path": "/unknown/path" }
```

服务器内部错误返回 500：
```json
{ "error": "Internal server error" }
```

---

## 包名规范

格式：`{type}-{descriptive-name}-{YYYYMMDDHHmmss}-{version}.zip`

示例：
- `app-根据md制作ppt-20260424153000-1.0.0.zip`
- `skill-linux-host-ssh登录-20260424153002-0.1.0.zip`

规则：
- `descriptive-name` 作为 hub 内部唯一键
- 时间戳精确到秒
- 禁止覆盖已存在的包（上传接口）
- 更新接口允许替换同一 name 的新版本
