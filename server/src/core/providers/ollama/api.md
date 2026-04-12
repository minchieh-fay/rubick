# Ollama Provider Module API

## 模块简要描述

Ollama Provider 是 Rubick 模型层的基础适配器，专门用于对接本地运行的 [Ollama](https://ollama.com/) 服务。它实现了对 Ollama 原生 API 的封装和简化，是核心能力供应层（Core Providers）的一个具体实现模块。

该模块负责与本地 `11434` 端口通信，并根据服务端配置自动处理模型名称（如 `gemma4:e4b`）。

## 对外提供的 API 说明

该模块目前作为内部适配器，其能力通过核心调度层（Core Providers）统一对外暴露。在**独立运行模式**下，它也会监听 `OLLAMA_PORT`（默认 `3101`）并提供以下接口。

### 1. 生成接口 (Generate)

#### `POST /generate`

直接调用 Ollama 的生成接口。

- **请求参数 (JSON)**:
  - `prompt` (string): 提示词内容。
  - `options` (object, 可选): 传递给模型的生成参数（如 temperature, num_predict 等）。
- **响应参数 (JSON)**:
  - `result` (string): Ollama 返回的生成结果。
  - `error` (string, 仅出错时): 错误描述。

### 2. 健康检查

#### `GET /health`

获取 Ollama Provider 运行状态。

- **响应参数 (JSON)**:
  - `status`: "ok"
  - `model`: 当前使用的模型名称。

## 内部导出的类与函数 (TypeScript)

### `OllamaService` 类

核心逻辑实现类，提供以下方法：

- `generate(prompt: string, options?: Record<string, any>): Promise<string>`: 调用生成 API。
- `chat(messages: any[], options?: Record<string, any>): Promise<string>`: 调用对话 API。
- `getModelName(): string`: 返回当前配置的模型名称。

### 导出函数

- `formatOllamaResponse(response: any): string`: 将原始响应格式化为文本结果。
- `buildOllamaRequestBody(prompt: string, model: string, options?: any): object`: 构建生成请求体。
- `buildChatRequestBody(messages: any[], model: string): object`: 构建对话请求体。

## 维护要求

- 每次 Ollama API 更新或本项目适配逻辑变更，必须同步更新本文件。
- 修改默认模型配置或端口配置时，需在文档中同步说明。
