# 通用配置

所有程序从 TOML 配置文件读取设置，命令行形式统一为 `{程序} --config config.toml`。每个服务的代码目录应包含自己的 `config.toml`；未指定参数时读取当前工作目录中的该文件，文件不存在时启动失败并提示路径，不自动生成配置。

公共字段放在 `[common]`，程序专属字段放在独立 section。Rubick 的配置示例：

```toml
[common]
domain = "http://127.0.0.1:3000"
port = 3000
id = "rubick"
name = "rubick"

[rubick]
heartbeat_interval_seconds = 30
expire_after_seconds = 50
skill_file = "SKILL.md"
```

| 字段 | 含义 |
| --- | --- |
| `common.domain` | 本服务对外使用的基础 URL，包含协议 |
| `common.port` | 本服务监听的 TCP 端口 |
| `common.id` | 全局唯一且稳定的服务 ID |
| `common.name` | 服务展示名称，默认填入程序名 |
| `rubick.heartbeat_interval_seconds` | 清理注册记录的周期，默认 30 秒 |
| `rubick.expire_after_seconds` | 注册心跳超时秒数，默认 50 秒，必须大于检查周期 |
| `rubick.skill_file` | Rubick 外置入口 Skill 路径，相对配置文件目录解析 |

子服务也使用 `[common]`，另需配置 `rubick_domain` 指向中心服务，例如 `http://127.0.0.1:3000`。子服务可在自己的 section 配置私有字段。服务注册时提交自身 `domain` 和 `port`，供 Rubick 构造转发地址；转发时以 `port` 为实际监听端口。
