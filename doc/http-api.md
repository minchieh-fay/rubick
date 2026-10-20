# HTTP API 协议

所有路径相对于服务基础 URL。请求和成功响应使用 JSON，除技能详情外；技能详情使用 `text/markdown; charset=utf-8`。当前 API 不实现 token 或 Cookie 权限校验，公网部署的权限控制由反向代理承担。

## Agent 调用 Rubick

### `GET /api/skill`

返回 Rubick 自身的入口 Skill。Rubick 从外置 `SKILL.md` 读取元数据和稳定说明，从配置读取服务地址，再在文末追加地址与动态 API 说明。

### `GET /api/skills`

返回所有心跳有效子服务的技能元数据，不含正文：

```json
{
  "skills": [
    {
      "id": "rubick_video_short_drama",
      "name": "短剧制作",
      "description": "规划并制作短剧视频"
    }
  ]
}
```

公开 ID 由 `rubick_{service_id}_{skill_id}` 组成。磁盘文件名及服务上报的技能 ID 不需要 `rubick_` 前缀。

### `GET /api/skills/{rubick_skill_id}`

Rubick 查找 Skill 所属服务，将 namespaced ID 映射成子服务本地 ID，并转发到该子服务的 `GET /api/skills/{skill_id}`。成功时将子服务返回的完整 Markdown 正文转交 Agent。未知或已过期 ID 返回 `404`；上游不可用或返回非 2xx（除 404）时返回 `502`。

## 子服务注册到 Rubick

### `POST /api/works/register`

子服务启动后注册。服务 ID 相同的新注册覆盖旧记录，并获得新的 Epoch。

请求：

```json
{
  "id": "video",
  "name": "视频服务",
  "domain": "http://127.0.0.1:4100",
  "port": 4100,
  "skills": [
    {
      "id": "short_drama",
      "name": "短剧制作",
      "description": "规划并制作短剧视频"
    }
  ]
}
```

响应：

```json
{"registry_epoch":"center-epoch-..."}
```

`skills` 来自子服务目录中的 `SKILL_{字符串}.md` 文件。服务从文件名后缀读取 `id`，从 frontmatter 读取 `name` 和 `description`。

### `POST /api/works/heartbeat`

子服务按 Rubick 返回的 `interval` 秒数发送心跳：

```json
{"id":"video","registry_epoch":"center-epoch-..."}
```

正常响应：

```json
{"status":"OK","interval":30}
```

服务未注册或 Epoch 已失效时响应：

```json
{"status":"REGISTRATION_REQUIRED","interval":30}
```

子服务收到 `REGISTRATION_REQUIRED` 后必须重新注册并保存新 Epoch。Rubick 默认每 30 秒清理一次，删除超过 50 秒没有有效心跳的服务和技能。

## 子服务提供给 Rubick

### `GET /api/skill`

所有服务统一通过该接口返回本服务的入口 Skill。子服务入口 Skill 从其外置 `SKILL.md` 读取稳定说明，并在末尾追加服务地址及动态 HTTP API 说明。

### `GET /api/skills`

子服务返回本服务所提供的 Skill 元数据，字段为本地 `id`、`name` 和 `description`。Rubick 返回所有在线子服务的元数据，并将 ID 转换为带 `rubick_` 前缀的 namespaced ID。

### `GET /api/skills/{skill_id}`

子服务读取对应的外置 `SKILL_{字符串}.md`，并在末尾追加该 Skill 的动态 HTTP 接口说明，返回完整 Markdown。多个 Skill 通过各自 ID 单独读取，不合并成单个 Markdown/YAML 多文档流。Rubick 将 Agent 对 namespaced `/api/skills/{rubick_skill_id}` 的请求转发到归属服务的本地 ID 路径。

子服务自身面向 Agent 的业务 API 路径由子服务定义；Skill 的动态接口说明必须使用其配置生成实际地址，并描述用途、参数和调用约束。
