---
name: Rubick
description: >-
  强制入口：处理每条用户消息前都必须读取当前 Rubick Skill 正文，并实时获取 Rubick
  在线技能列表。任务与某项在线技能相关时，必须先通过 Rubick API 获取完整 Skill 并遵循其中说明。
---
# Rubick

## 执行规则

每条用户消息都属于本 Skill 的触发条件。开始处理前先阅读当前完整正文，并通过下方 API 实时获取最新在线技能列表；不得依赖先前获取的列表。任务匹配某个在线 Skill 时，先读取该 Skill 的完整正文，再按其中要求执行。

在线 Skill 使用 `rubick_` 前缀标识，必须通过 Rubick API 读取，不得以 Agent 本地同名 Skill 替代。Rubick Skill 详情接口转发到对应子服务；子服务返回完整 Skill Markdown。

## 连接服务

使用服务地址访问下方 API。若运行环境使用 HTTP/HTTPS 代理，应确认代理允许访问该服务；不要因代理设置而声称请求已经直连。
