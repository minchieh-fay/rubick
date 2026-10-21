# 项目架构与开发约定

## 项目目标

Rubick 是一个技能发现与路由中心。工程使用 Rust Cargo Workspace，允许同时构建 Rubick 和多个独立子服务：

```text
./
├── doc/                 # 公共配置、HTTP 协议等文档
├── Cargo.toml           # Workspace 定义
├── common/              # 可选的跨程序公共库
├── rubick/              # Rubick 服务
├── box/                 # 可从外置目录加载 Skill 的通用子服务
├── app1/                # 子服务示例/服务一
└── app2/                # 子服务示例/服务二
```

各程序独立启动、独立配置和监听 HTTP；公共协议以 `doc/` 为准。Rubick 不提供静态页面，不管理 Cloudflare 隧道，不负责 API token 或权限保护。外部反向代理负责公网入口及 API 权限。

## 配置约定

- 每个程序通过 `{程序名} --config config.toml` 指定配置文件；所有程序采用相同的参数形式和 TOML 格式。
- 通用配置字段统一放在 `[common]`，程序专属字段放在以程序命名的独立 section。
- `[common]` 至少包含 `domain`、`port`、`id`。`domain` 是本服务的外网基础 URL，不是容器内地址；仅内网服务没有外网域名时保留字段并设为空。`port` 是本服务监听端口；`id` 是跨服务唯一且稳定的标识，也用于展示服务身份。
- 子服务间的详情转发走 `app-net` 内部地址 `{id}.internal:{port}`，不得把容器内部地址写进 `common.domain`。服务的实际业务 API 存在时，才在完整 Skill 末尾动态追加使用说明，并用 `common.domain` 生成 API 地址；没有业务 API 的 Skill 不追加虚构的接口说明。
- 每个服务都应在自己的代码目录中提供可直接编辑的 `config.toml`，端口等运行参数显式配置。不得依赖首次运行生成配置；配置缺失时应明确报错。不得在不同服务间复用相同 `id`。
- 子服务的 `[common]` 还包含 `rubick_domain`，即 Rubick 中心服务地址。字段定义及完整示例统一维护在 `doc/`，实现不得自行发明同义字段。
- Rubick 的专属配置包含 `heartbeat_interval_seconds`，默认 `30` 秒。Rubick 周期清理超过 `50` 秒没有心跳的子服务及其技能元数据。

## Skill 文件与内容

- Rubick 目录只维护一个外置 `SKILL.md`。它不得通过 `include_str!` 等方式编译进二进制，便于不改代码更新 Skill。
- Rubick 返回给 Agent 的完整 Skill 由外置 `SKILL.md` 与代码生成的动态段合成。动态段至少包含从 `config.toml` 的 `common.domain` 读取的服务地址和当前 API 地址；外置文件中不写服务地址或地址占位符。
- Rubick Skill 的 frontmatter 元数据和中文说明写在外置文件中。元数据要求 Agent 每次处理请求都读取当前 Skill 正文，并通过 Rubick API 实时获取技能列表、按需读取详情。
- Agent 获取的在线技能 ID 使用 `{common.id}_` 前缀，避免不同中心服务的技能 ID 冲突；磁盘上的子服务技能文件名不要求带该前缀。
- 子服务可以在自己的程序目录下维护多个 `SKILL_{字符串}.md` 文件，例如 `SKILL_短剧.md`、`SKILL_宣传视频.md`。文件 frontmatter 提供 `name` 和 `description`。
- `box` 是通用 Skill-only 子服务，从配置的 `box.skill_dir` 加载 `SKILL_{id}.md`，并按配置周期扫描目录，在元数据变化时重新注册。
- 子服务的每个外置 `SKILL_{字符串}.md` 都保存该 Skill 的 frontmatter 元数据和稳定的中文说明正文；这些内容不得编译进程序。服务启动或注册时从文件读取 `id`、`name`、`description` 并上报给 Rubick。
- 子服务返回给 Rubick 的完整 Skill 由对应外置文件与代码生成的动态段合成。Skill 有实际可调用的业务 API 时，动态段追加在正文末尾，描述接口用途、参数和必要的调用约束；地址从 `common.domain` 生成，不写死在外置说明中。没有业务 API 时不追加接口说明。
- Rubick 返回给 Agent 的子服务 Skill 时，必须返回合成后的完整 Markdown；在线列表仍只返回注册的 `id`、`name`、`description` 元数据，不包含正文或动态接口说明。
- 技能列表只返回技能 ID、名称和 description 元数据，不得内嵌技能正文。详情接口返回对应完整 Markdown。
- 子服务注册时上报每个 Skill 的 `id`、`name`、`description`。Rubick 按注册信息汇总元数据；读取详情时根据 Skill 所属服务转发到该服务。

## HTTP API 约定

所有服务使用 HTTP/JSON（Skill 正文使用 `text/markdown; charset=utf-8`），公共请求与响应结构及状态码记录在 `doc/`。除非协议文档明确要求，不增加 token、Cookie 等应用层认证；外部代理负责权限策略。

### Rubick 面向 Agent

- `GET /api/skill`：返回 Rubick 自身的入口 Skill。该 Skill 从 Rubick 外置 `SKILL.md` 读取，追加当前服务地址和动态 API 说明后返回。
- `GET /api/skills`：返回在线技能元数据列表，字段至少包括 namespaced `id`、`name`、`description`。
- `GET /api/skills/{namespaced_skill_id}`：定位技能所属子服务，将 namespaced ID 映射为子服务本地 ID，并转发到其 `GET /api/skills/{skill_id}`。该接口不得读取 Rubick 自己的 `SKILL.md`。

### 子服务注册与心跳

- `POST /api/works/register`：子服务启动后注册，携带服务 `id`、监听 `port` 和 Skills 元数据列表。相同服务 `id` 的新注册覆盖旧注册。成功响应返回 `registry_epoch`，供后续心跳校验。
- `POST /api/works/heartbeat`：携带服务 `id` 与注册时获得的 `registry_epoch`。成功响应返回 `interval`（秒）。
- 如果 Rubick 重启或注册状态丢失，心跳响应使用 `REGISTRATION_REQUIRED`，子服务应重新注册并保存新 Epoch。
- 心跳的有效期按 Rubick 配置清理；默认建议间隔为 30 秒，超过 50 秒未更新时移除服务。

### 子服务提供给 Rubick

- 所有服务统一提供 `GET /api/skill`，返回本服务的入口 Skill。子服务从自己的外置 `SKILL.md` 读取稳定说明；实际存在业务 API 时才追加配置生成的外网地址及动态 API 说明。
- 子服务提供 `GET /api/skills` 返回本服务的 Skill 元数据，以及 `GET /api/skills/{skill_id}` 返回单个子 Skill 的完整 Markdown。多个 Skill 必须分别读取，不得将多个 frontmatter 文档用 `---` 拼接成一个 Skill 响应。
- Rubick 将 Agent 对 `/api/skills/{namespaced_skill_id}` 的详情请求转发到所属子服务的 `GET /api/skills/{skill_id}`，其中 `{skill_id}` 是注册时上报的子服务本地 ID。
- 子服务面向 Agent 的其他业务 API 由子服务自行定义，但必须通过 HTTP 提供。

### 文档

- 开发或修改 Rubick 时遵守 `./doc/rubick.md`；开发或修改任意子服务时遵守 `./doc/subservice.md`。
- Rubick、子服务或公共协议规则发生变化时，及时同步更新对应指南、`./design.md` 和相关公共协议文档，并保持 `README.md` 链接有效。
- 修改 API 或配置字段时，同步更新协议文档与本文件；本文件只保留架构和开发时必须遵循的概要。

## 编码规则

### 1. 函数注释

- 新建函数、类、结构体或等价类型时，必须在定义上方用中文注释说明用途。
- 每个 `help_*` 调用点都必须有中文注释，说明该调用在当前业务中的作用。
- 函数超过 20 行时，必须在函数内部用中文 `step` 注释概括业务逻辑。
- `step` 表示业务层级，而不是代码执行顺序或控制流层级：
  - `step.1`、`step.2`：一级业务目标。
  - `step.1.1`、`step.1.2`：对应目标的二级业务内容。
  - 更深层级按同样规则递增。
- `step` 的层级必须根据业务意图划分，不能简单地把 `if`、循环等代码块当作子步骤。
- 读完所有 `step` 注释后，应能理解函数的完整业务逻辑，而无需阅读具体实现。

调用点示例：

```text
login(user, pwd):
  // step.1 获取用户在数据库中的密码
  // 调用辅助函数查询用户密码。
  dbpwd = help_getUserpwdFromDB(user)
  // step.2 比较密码并返回结果
  return pwd == dbpwd
```

### 2. 使用 `help` 文件隐藏实现细节

- 所有 `help_*` 辅助函数必须定义在所属业务代码目录中的语言专属 `help` 文件里。严禁在业务文件中定义 `help_*` 函数，即使函数很短或只有一个调用者也不例外。
- 文件名为 `help` 加当前语言惯用扩展名，例如 Rust 使用 `help.rs`，Go 使用 `help.go`，TypeScript 使用 `help.ts`。
- 先确认业务代码所在目录；`help` 文件与调用方位于同一目录。不得放入父目录、其他目录或全局共享目录。
- `help` 文件中的函数只能由同一目录内的代码调用，禁止跨目录调用。其他目录需要相似逻辑时，在其自身 `help` 文件中定义本地辅助函数。
- 主业务函数包含多层 `step` 时，应检查是否能提取实现细节。可独立提取的多行实现，或连续多行最终只生成一个供后续业务使用的值，都应放入 `help` 文件。
- `help` 文件中的辅助函数也必须有中文用途注释；超过 20 行时必须添加符合业务层级的 `step` 注释。

### 3. 代码行宽

- TypeScript 单行不得超过 120 个字符；不要为了减少行数把长表达式挤在一行。
- 其他语言遵循项目格式化工具和现有风格，避免难以阅读的超长行。

## LLM 测试环境

编写或测试 Agent 时可以使用以下环境变量，不得把密钥写入代码或提交到仓库：

```text
AGENT_API_BASE
AGENT_API_KEY
AGENT_MODEL
```
