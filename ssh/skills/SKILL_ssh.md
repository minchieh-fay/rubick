---
name: SSH 远程 Linux 服务器
description: 通过 SSH 连接并远程操作 Linux 服务器，执行命令、查看系统信息、管理进程和交互式终端任务。
---

# SSH 远程 Linux 服务器

使用本 Skill 末尾动态提供的服务地址调用以下接口。每次建立连接时在请求中提供 `host`、`port`、`username` 和 `password` 或 `private_key`；SSH 服务不会预存主机档案或账号密码。认证信息只用于建立该次连接，不会写入配置或会话记录。一次性短命令调用短命令接口；需要交互输入、持续输出或运行长任务时使用持久会话。

## 短命令

调用 `POST /api/commands/execute`，请求体必须提供 `host`、`port`、`username`、一种认证信息和 `command`，`timeout_seconds` 可选：

```json
{"host":"<host>","port":22,"username":"<username>","password":"<password>","command":"whoami && date"}
```

响应包含 `exit_code` 和 `output`。超时时间由服务端配置限制。需要密码提示或运行时间较长的命令不要用短命令接口。

## 持久会话

调用 `POST /api/sessions` 创建 PTY 会话。连接字段与短命令相同；`command` 可选，省略时进入 shell：

```json
{"host":"<host>","port":22,"username":"<username>","password":"<password>","command":"sudo -i"}
```

保存响应中的 `session_id`。调用 `GET /api/sessions/{session_id}/output?since=0` 读取输出；后续请求使用上次响应的 `next_offset` 作为 `since`。没有新输出时等待约 1 秒再轮询，避免紧密循环请求。

通过 `POST /api/sessions/{session_id}/input` 发送终端输入，请求体为 `{"input":"..."}`。仅在终端出现密码提示后发送对应密码，例如 `{"input":"<password>\\n"}`。确认工作结束后调用 `DELETE /api/sessions/{session_id}` 关闭会话。对 `top` 等交互程序，可通过 input 发送 `q\\n` 退出。

会话空闲超时由服务端配置；读取输出或发送输入会刷新活动时间。会话超时后服务会自动清理。

缺少必需字段会返回 422；连接参数无效返回 400；SSH 认证失败返回 401；连接失败返回 502；短命令或 SSH 连接超时返回 504。会话 ID 不存在返回 404。错误响应可能只有 HTTP 状态码而没有正文。调用失败时检查 HTTP 状态；使用 curl 调试时加 `-i` 或 `-w 'HTTP %{http_code}\\n'`，不要把空响应体误判为命令无输出。遇到错误先判断结果，不要重复创建会话或重复执行可能有副作用的命令。收到 429 时遵循 `Retry-After`；没有该响应头时等待 2 秒后只重试一次。

不要在命令、输入或输出中暴露 SSH 私钥。此服务只在远端主机执行命令，不负责在 Agent 本地与目标主机之间传输文件。
