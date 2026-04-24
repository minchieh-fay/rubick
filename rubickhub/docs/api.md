# rubickhub API 文档

Base URL: `http://localhost:3000`（开发环境）

---

## 1. 包列表查询

**GET** `/api/{apps|skills|mcps}`

查询参数：
- `sort` (可选): 排序方式，`usageCount`（默认）| `downloads`

响应：
```json
[
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
]
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
- 400: `{ "error": "Invalid package filename format" }`
- 409: `{ "error": "Package \"xxx\" already exists" }`

---

## 3. 包下载

**GET** `/api/{apps|skills|mcps}/download/{fileName}`

响应：
- 200: 返回 zip 文件
- 404: `{ "error": "Package not found" }`

---

## 4. 使用统计上报

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

## 5. 客户端版本查询

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

## 6. 客户端下载列表

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

## 7. 客户端文件下载

**GET** `/api/clients/{fileName}`

响应：返回对应平台的安装包文件

---

## 包名规范

格式：`{type}-{descriptive-name}-{YYYYMMDDHHmmss}-{version}.zip`

示例：
- `app-根据md制作ppt-20260424153000-1.0.0.zip`
- `skill-linux-host-ssh登录-20260424153002-0.1.0.zip`

规则：
- `descriptive-name` 作为 hub 内部唯一键
- 时间戳精确到秒
- 禁止覆盖已存在的包
