# Core Providers Module API

## 模块简要描述

Core Providers 模块是 Rubick 服务端的核心能力供应层。它负责整合和调度底层的所有基础模型能力（如 LLM、ASR、TTS 等），并为上层业务模块（Modules）提供统一、抽象的调用接口。

该模块的核心设计原则是：**屏蔽底层实现细节，对外提供统一的业务接口**。

## 对外提供的 API 说明

### 1. 统一 LLM 接口

该接口根据服务端配置自动选择并调用当前激活的模型提供商。

#### `POST /llm/chat`

统一的 LLM 对话接口。

- **请求参数 (JSON)**:
  - `messages` (Array<any>): 对话模式的消息列表。
  - `options` (object, 可选): 额外的生成选项（如 temperature 等）。
- **响应参数 (JSON)**:
  - `result` (string): 模型生成的文本结果。
  - `error` (string, 仅出错时): 错误描述信息。

#### `POST /llm/generate` 或 `POST /llm`

统一的 LLM 基础生成接口。

- **请求参数 (JSON)**:
  - `prompt` (string): 提示词内容。
  - `options` (object, 可选): 额外的生成选项。
- **响应参数 (JSON)**:
  - `result` (string): 模型生成的文本结果。
  - `error` (string, 仅出错时): 错误描述信息。

### 2. 健康检查

#### `GET /health`

获取 Providers 模块的运行状态及当前激活的提供商。

- **响应参数 (JSON)**:
  - `status`: "ok"
  - `activeProvider`: 当前激活的提供商名称（如 "ollama"）。

## 内部导出的函数/方法 (TypeScript)

除了 HTTP 接口，该模块在内部也导出以下核心函数供 `server` 其他部分直接调用：

- `llmGenerate(prompt: string, options?: any): Promise<string>`
- `llmChat(messages: any[], options?: any): Promise<string>`
- `initAllProviders(): Promise<void>` (初始化所有激活的 Providers)

## 维护要求

- 每次新增、删除或修改核心 Provider 时，必须更新本文件。
- 修改 `/llm` 接口的参数或响应结构时，必须同步更新说明。
