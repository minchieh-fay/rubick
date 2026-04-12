# Rubick Trae Project Rules

请先阅读：

- `docs/AI协作规范.md`
- `docs/目录结构说明.md`
- `docs/总体架构说明.md`
- `docs/编码约定.md`
- `docs/模块开发规范.md`
- `docs/通信与调用说明.md`

## 项目定位

Rubick 是一个带后端服务的客户端 work app，不是单纯的网页项目。

目录职责：

- `server/`：服务端
- `server/src/core/providers/`：核心模型适配层（ASR, TTS, Chat 等）
- `client/web/`：客户端页面
- `client/server/`：客户端本地后台
- `shared/`：共享层

## 规则

1. 客户端和服务端都遵守模块独立性优先的编码方式。
2. 一个 HTTP 业务模块尽量放在一个独立目录中。
3. 主业务逻辑保留在主业务文件里。
4. 不需要重点阅读的辅助函数、辅助方法和成员相关辅助逻辑统一放到模块自己的 `help.ts`。
5. 每个可独立运行的模块（如 `core/providers` 子目录、`modules` 子目录）必须维护一个 `api.md`，包含模块简述和 API 说明。
6. 服务端模块自己的 `.env` 和 sqlite 文件应尽量放在模块目录内。
7. 文档中的路径使用相对路径或普通仓库路径，不要写死本机绝对路径。

## 文档同步

如果任务涉及以下变化，必须同步更新文档：

- 架构变化
- 目录变化
- 设计规范变化
- 模块规范变化
- 通信调用关系变化

至少检查：

- `README.md`
- `docs/目录结构说明.md`
- `docs/总体架构说明.md`
- `docs/编码约定.md`
- `docs/模块开发规范.md`
- `docs/通信与调用说明.md`
- `docs/AI协作规范.md`
