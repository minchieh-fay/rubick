# 通用配置

所有程序从 TOML 配置文件读取设置，命令行形式统一为 `{程序} --config config.toml`。每个服务的代码目录应包含自己的 `config.toml`；未指定参数时读取当前工作目录中的该文件，文件不存在时启动失败并提示路径，不自动生成配置。

公共字段放在 `[common]`，程序专属字段放在独立 section。Rubick 的配置示例：

```toml
[common]
domain = "http://127.0.0.1:3000"
port = 3000
id = "rubick"

[rubick]
heartbeat_interval_seconds = 30
expire_after_seconds = 50
skill_file = "SKILL.md"
```

| 字段 | 含义 |
| --- | --- |
| `common.domain` | 本服务的外网基础 URL，包含协议；没有外网域名的纯内网服务设为空字符串 |
| `common.port` | 本服务监听的 TCP 端口 |
| `common.id` | 全局唯一且稳定的服务 ID |
| `rubick.heartbeat_interval_seconds` | 清理注册记录的周期，默认 30 秒 |
| `rubick.expire_after_seconds` | 注册心跳超时秒数，默认 50 秒，必须大于检查周期 |
| `rubick.skill_file` | Rubick 外置入口 Skill 路径，相对配置文件目录解析 |

子服务也使用 `[common]`，另需配置 `rubick_domain` 指向中心服务，例如 `http://rubick.internal:3000`。子服务可在自己的 section 配置私有字段。`domain` 表示外网地址，只用于生成 Skill 中实际存在的业务 API 说明；没有外网域名时设为空。子服务必须加入 `app-net` 并设置 `{id}.internal` 网络别名；Rubick 使用该别名和注册的 `port` 转发详情请求。语言无关的配置与接入示例见[子服务开发指南](subservice.md)。

通用子服务配置结构示例：

```toml
[common]
domain = "https://example.com"
port = 4100
id = "example"
rubick_domain = "http://rubick.internal:3000"

[example]
# 服务自定义配置项
```
