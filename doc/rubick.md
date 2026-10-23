# Rubick 服务说明

Rubick 是 Skill 的发现和路由中心。它保存子服务注册信息和 Skill 元数据，在 Agent 请求详情时将请求转发给 Skill 所属的子服务。

Rubick 不提供静态页面，不管理 Cloudflare 隧道，也不实现 API token、Cookie 或用户权限。公网入口和访问控制由外部反向代理负责。

## 配置与启动

Rubick 使用 `rubick/config.toml`，也可以通过 `--config` 指定其他文件：

```sh
cargo run -p rubick -- --config rubick/config.toml
```

配置文件必须预先存在。`common.domain` 是 Rubick 的外网基础 URL，用于生成 Rubick 入口 Skill 中的 API 地址；生产环境应填写 Agent 实际访问的地址。`common.port` 是监听端口。

```toml
[common]
domain = "https://rubick.example.com"
port = 3000
id = "rubick"

[rubick]
heartbeat_interval_seconds = 30
expire_after_seconds = 50
skill_file = "SKILL.md"
```

Rubick 入口 Skill 位于外置 `rubick/SKILL.md`，运行时读取，不编译进程序。模板中的 `{{id}}` 会替换为 `common.id`；响应中还会追加由 `common.domain` 生成的服务地址和 API 说明。`common.id` 同时用于服务身份和公开 Skill ID 前缀。具体字段见[通用配置](configuration.md)。

## Agent 接口

- `GET /api/skill` 返回 Rubick 的入口 Skill，媒体类型为 `text/markdown; charset=utf-8`。
- `GET /api/skills` 返回所有有效注册中的 `id`、`name`、`description`，不返回 Skill 正文。
- `GET /api/skills/{namespaced_skill_id}` 根据 namespaced ID 找到子服务，将请求转发到其本地 `GET /api/skills/{skill_id}`，并返回完整 Markdown。

使用 `web_fetch` 调用 API 时，客户端应在每次请求 URL 上追加 `t=<当前 Unix 时间戳>`，例如 `/api/skills?t=1792575826`，以规避中间缓存返回旧列表。该参数仅用于缓存规避。

在线 ID 格式为 `{common.id}_{service_id}_{skill_id}`。不同 Rubick 实例应配置不同的 `common.id`，以避免公开 ID 冲突。未知或过期 ID 返回 `404`；子服务不可达或返回非成功状态时，Rubick 返回 `502`，子服务的 `404` 则保留为 `404`。

## 子服务注册

子服务通过 `POST /api/works/register` 注册，通过 `POST /api/works/heartbeat` 刷新注册。相同服务 ID 的新注册覆盖旧注册；每次注册返回新的 `registry_epoch`。Rubick 重启后注册状态会清空，子服务心跳应通过 `REGISTRATION_REQUIRED` 识别并重新注册。

心跳间隔由响应中的 `interval` 指定。Rubick 默认每 30 秒清理一次注册，并移除超过 50 秒未更新的服务和技能元数据。完整请求与响应见 [HTTP API 协议](http-api.md)，跨语言子服务实现要求见[子服务开发指南](subservice.md)。

## 网络转发

子服务与 Rubick 在 `app-net` 网络中通信。Rubick 根据服务 ID 和端口访问 `{service_id}.internal:{port}`；转发不使用子服务的外网 `common.domain`。子服务须在网络中设置对应 alias。部署示例见 [rubick/docker-compose.yaml](../rubick/docker-compose.yaml)。
