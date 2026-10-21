# Rubick 服务架构

```mermaid
flowchart LR
  agent[Agent] -->|GET /api/skills| rubick[Rubick]
  agent -->|GET /api/skills/{id}| rubick
  agent -->|GET /api/skill| rubick
  rubick -->|GET /api/skills/{local_id}| service[子服务]
  service -->|POST /api/works/register| rubick
  service -->|POST /api/works/heartbeat| rubick
  rubick -->|元数据列表与详情路由| agent
  rubickskill[外置 rubick/SKILL.md] -->|动态拼装| rubick
  skills[子服务 SKILL_*.md] -->|元数据注册与正文拼装| service
  proxy[反向代理 / CF] -->|公网入口和权限策略| rubick
```

Rubick 保存子服务的短期注册信息和 Skill 元数据。Agent 请求 Skill 详情时，Rubick 根据注册表转发至拥有该 Skill 的子服务；Skill 正文由子服务按外置文件与动态 API 说明合成。Rubick 自身 Skill 由独立外置文件与 Rubick API 动态说明合成。

Rubick 服务说明、跨语言子服务开发指南、公共配置和接口协议见 [`doc/rubick.md`](doc/rubick.md)、[`doc/subservice.md`](doc/subservice.md)、[`doc/configuration.md`](doc/configuration.md) 与 [`doc/http-api.md`](doc/http-api.md)。
