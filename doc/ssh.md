# SSH 子服务

SSH 子服务通过 HTTP 为 Agent 提供 Linux 主机命令执行能力。Agent 在每次短命令或会话创建请求中提供主机、端口、用户名和密码或私钥；服务不保存主机档案、SSH 密码或私钥。凭据只用于当前 SSH 握手，不进入会话状态。

## 配置和启动

在 `ssh/config.toml` 配置服务身份、Rubick 地址、短命令时限和会话空闲超时：

```toml
[common]
domain = "https://ssh.example.com"
port = 4200
id = "ssh"
rubick_domain = "http://rubick.internal:3000"

[ssh]
skill_dir = "skills"
short_command_timeout_seconds = 45
session_idle_timeout_seconds = 300
```

使用 `password` 进行密码认证，或使用 `private_key` 和可选的 `private_key_passphrase` 进行密钥认证。服务使用 Rust `russh` crate 实现 SSH 客户端，不依赖容器或目标主机上的 `ssh` 命令。服务自动接受未知或变化的服务器主机密钥；SSH 用户凭据仍必须有效。远端 PTY 支持 sudo/su 交互，目标主机仍按自身 sudoers、su 策略和 SSH 凭据执行授权。

所有短命令请求和会话创建请求都必须携带 `host`、`port`、`username` 及一种认证字段。密码或私钥随请求传入，仅用于该次连接；会话创建成功后，服务只保留 SSH 通道和终端 I/O 状态。

## 短命令

`POST /api/commands/execute` 执行预计能在短时限内完成的命令：

```json
{"host":"192.0.2.20","port":22,"username":"agent","password":"...","command":"uname -a","timeout_seconds":20}
```

`timeout_seconds` 可省略，实际值不会超过 `short_command_timeout_seconds`。超时返回 `504`；成功响应包含 `exit_code` 和 `output`。

## 持久会话

`POST /api/sessions` 创建 PTY 会话。可选 `command` 用于启动普通 shell 命令；省略时进入登录 shell。

```json
{"host":"192.0.2.20","port":22,"username":"agent","password":"...","command":"top"}
```

响应包含 `session_id` 和 `idle_timeout_seconds`。Agent 使用以下接口操作同一个终端：

| 方法与路径 | 用途 |
| --- | --- |
| `GET /api/sessions/{session_id}/output?since=0` | 读取新输出；使用响应的 `next_offset` 作为下次 `since`。 |
| `POST /api/sessions/{session_id}/input` | 写入终端输入，JSON 格式为 `{"input":"..."}`；可发送换行或控制字符。 |
| `DELETE /api/sessions/{session_id}` | 关闭 SSH 连接并回收会话。 |

`sudo`、`sudo -i` 和 `su root` 不做命令特判，均由远端 PTY 按标准终端交互。Agent 可以轮询输出并通过 input 接口回答密码提示；需要密码交互时使用会话接口，短命令接口不提供终端输入。会话超过 `session_idle_timeout_seconds` 没有读取输出或发送输入时，后台清理任务会终止 SSH 进程并移除会话。持续读取 `top` 输出会刷新活动时间。输出缓存上限为 1 MiB；当输出被覆盖时，响应的 `start_offset` 表示当前仍可读取的最早位置。

## 部署

部署到 Linux amd64 时，在构建机本地交叉编译二进制，再复制二进制、配置、Skill 和 Compose 文件到目标机：

```sh
CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER=x86_64-linux-gnu-gcc \
  cargo build --release --target x86_64-unknown-linux-gnu -p ssh
```

将 `target/x86_64-unknown-linux-gnu/release/ssh` 复制为部署目录中的 `ssh-service` 并赋予执行权限。Compose 使用已有的 `ubuntu:26.10` 基础镜像挂载该二进制，不在目标机编译程序或构建镜像。部署目录的 `.env` 可设置 `SSH_IMAGE` 覆盖基础镜像。运行 `docker-compose up -d` 启动服务，服务通过 `app-net` 的 `ssh.internal` 别名供其他容器访问，不发布宿主机端口。

生产部署应通过反向代理设置 API 访问策略，不要把远程命令接口直接暴露给未授权调用方。
