# Rubick 子服务开发指南

本文定义可接入 Rubick 的子服务协议和实现要求，不依赖特定编程语言或业务类型。按本文实现 HTTP API、配置和注册流程后，服务即可将自身 Skill 元数据注册给 Rubick，并由 Rubick 转发 Skill 详情请求。

## 服务职责

子服务负责读取并提供自己的 Skill，注册 Skill 元数据，并保持与 Rubick 的心跳。子服务可以实现自己的业务 API，也可以只提供描述 Agent 能力的 Skill 文件。

Rubick 只接收和展示子 Skill 的 `id`、`name`、`description` 元数据。Skill 正文由子服务按请求返回，不应在注册请求或列表响应中传输。

## 配置与启动

每个服务目录提供可编辑的 `config.toml`。配置缺失时启动必须报错，不得自动生成默认文件。所有服务使用相同的启动参数：

```sh
{service} --config config.toml
```

未指定 `--config` 时读取当前工作目录中的 `config.toml`。配置中的相对文件路径以配置文件所在目录为基准。

公共字段放在 `[common]`，服务自身设置放在以服务 ID 命名的 section。以下为语言无关的 TOML 示例：

```toml
[common]
domain = "https://example.com"
port = 4100
id = "example"
rubick_domain = "http://rubick.internal:3000"

[example]
skill_dir = "skills"
```

| 字段 | 要求 |
| --- | --- |
| `common.domain` | 服务的外网基础 URL，包含协议。仅内网服务可以设为 `""`。不能填容器地址、localhost 或内部 alias。 |
| `common.port` | 服务在容器内监听的端口，必须与实际 HTTP 监听端口一致。 |
| `common.id` | 全局稳定且唯一的服务 ID，同时用于容器网络 alias `{id}.internal`。 |
| `common.rubick_domain` | Rubick 可从该子服务所在网络访问的地址，通常为 `http://rubick.internal:3000`。 |

配置 section 名称及其私有字段由服务定义。服务 ID 与 Skill ID 必须可安全用于 HTTP 路径片段。不要在源代码或提交的配置中写入密钥。

## 网络和部署

子服务和 Rubick 加入外部 Docker 网络 `app-net`。每个服务设置 `{id}.internal` 网络 alias，例如服务 ID 为 `example` 时设置 `example.internal`。容器内监听 `0.0.0.0:{common.port}`，通常不需要发布宿主机端口。

Rubick 获取子服务详情时访问：

```text
http://{service_id}.internal:{port}/api/skills/{skill_id}
```

`common.domain` 专门表示外网地址，不参与容器间转发。只有当 Skill 实际要调用子服务业务 API 时，才在返回的完整 Skill 正文末尾动态生成 API 说明，并从 `common.domain` 生成外网 URL。没有业务 API 的 Skill 不添加 API 地址或占位符。

部署 Compose 文件应使用相对挂载路径，不得包含开发者机器或服务器的绝对目录。镜像名称应便于其他环境获取；具体服务器可以使用本地镜像覆盖部署配置。

网络配置示例：

```yaml
services:
  example:
    networks:
      app-net:
        aliases:
          - example.internal

networks:
  app-net:
    external: true
```

## Skill 文件

服务入口 Skill 和每个可单独发现的 Skill 都保存为外置 Markdown 文件，不得通过编译期嵌入方式打包。建议目录结构如下：

```text
example/
  config.toml
  SKILL.md
  skills/
    SKILL_sample.md
```

子 Skill 文件使用 `SKILL_{skill_id}.md` 命名。文件以 YAML frontmatter 开始，必须提供 `name` 和 `description`；正文保存稳定的能力说明：

```markdown
---
name: 示例能力
description: 用一句话说明此能力适用的任务。
---

# 示例能力

说明能力边界、输入要求、输出要求和必要约束。
```

服务以文件名后缀作为本地 `skill_id`，从 frontmatter 读取列表元数据。元数据列表不包含正文。新增、删除或修改元数据后，服务应更新 Rubick 注册；可在重启时更新，也可周期扫描目录。

## 必须提供的 Skill API

所有子服务都提供以下 HTTP API。JSON 使用 UTF-8；详情正文使用 `text/markdown; charset=utf-8`。

### `GET /api/skill`

返回服务入口 `SKILL.md` 的完整 Markdown。服务存在业务 API 时，可以在正文末尾追加从 `common.domain` 动态生成的接口用途、参数和调用约束。无业务 API 时直接返回外置文件内容，不增加伪造的接口说明。

### `GET /api/skills`

返回本服务所有 Skill 的元数据，不包含正文：

```json
{
  "skills": [
    {
      "id": "sample",
      "name": "示例能力",
      "description": "用一句话说明此能力适用的任务。"
    }
  ]
}
```

### `GET /api/skills/{skill_id}`

读取对应的 `SKILL_{skill_id}.md`，返回包含 frontmatter 和正文的完整 Markdown。若该 Skill 对应子服务的业务 API，则在末尾动态追加接口说明；没有业务 API 时不追加。每个 Skill 独立返回，禁止把多个 Markdown frontmatter 文档拼接成一个响应。未知 ID 返回 `404`。

## 注册 API

### `POST /api/works/register`

服务启动后扫描 Skill 元数据并向 Rubick 注册：

```json
{
  "id": "example",
  "domain": "https://example.com",
  "port": 4100,
  "skills": [
    {
      "id": "sample",
      "name": "示例能力",
      "description": "用一句话说明此能力适用的任务。"
    }
  ]
}
```

仅内网服务将 `domain` 设为 `""`。成功响应：

```json
{"registry_epoch":"center-epoch-..."}
```

相同 `id` 的新注册覆盖旧注册，并返回新的 Epoch。无效请求由 Rubick 返回 `400`。

### `POST /api/works/heartbeat`

注册成功后，保存响应中的 `registry_epoch`，并按 Rubick 最近一次响应指定的 `interval` 秒发送心跳：

```json
{"id":"example","registry_epoch":"center-epoch-..."}
```

注册仍有效时响应：

```json
{"status":"OK","interval":30}
```

注册丢失或 Epoch 失效时响应：

```json
{"status":"REGISTRATION_REQUIRED","interval":30}
```

收到 `REGISTRATION_REQUIRED` 后必须立即重新扫描 Skill 并调用注册 API，保存新 Epoch。不要把心跳周期写死为 30 秒，应采用 Rubick 返回的 `interval`。

## 建议的启动流程

1. 读取并校验显式配置；确认监听端口、服务 ID 和 Rubick 地址有效。
2. 读取入口 Skill 和所有 `SKILL_{id}.md`，校验 frontmatter 并生成只含元数据的技能列表。
3. 启动 HTTP 服务并向 Rubick 注册，保存返回的 `registry_epoch`。
4. 按 Rubick 指定的间隔发送心跳；服务端要求重新注册时立即重新注册。
5. 如果支持热加载，周期扫描文件。只有注册元数据有变化时才重新注册；详情正文可在每次详情请求时读取最新文件。

详情接口、注册接口和状态码的公共 wire format 另见 [HTTP API 协议](http-api.md)。公共配置字段另见[通用配置](configuration.md)。
