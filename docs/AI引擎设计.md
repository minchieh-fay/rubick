# AI 引擎设计

## 需求来源

用户提出：调用 qodercli 时必须指定模型，且需要封装成基础设施，其他模块只认 CLI 不感知底层实现。

## 设计目标

1. **统一 CLI 接口** - 所有 AI 调用通过统一入口，不直接调用 qodercli
2. **模型可配置** - 默认使用 `mmodel`，可通过配置切换
3. **上层解耦** - Agent 和工具只认识 `cli`，不知道是 qodercli
4. **可替换** - 未来可以替换底层 AI provider（OpenAI、Ollama 等）

## 架构

```
┌─────────────────────────────────────────┐
│              Agent / Tools               │
│         (只认 cli,不感知底层)             │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│            AI CLI Wrapper                │
│  - 统一接口                              │
│  - 模型配置 (默认 mmodel)                │
│  - Prompt 管理                           │
│  - 错误处理/重试                         │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│            qodercli                      │
│  qodercli -model "mmodel" <prompt>       │
└─────────────────────────────────────────┘
```

## 接口定义

```typescript
interface AIClient {
  /** 执行 AI 任务，返回文本结果 */
  execute(prompt: string, options?: AIOptions): Promise<AIResult>;
  
  /** 分析用户需求，拆解为子任务 */
  analyzeTask(userInput: string): Promise<TaskAnalysisResult>;
  
  /** 执行具体工具/技能 */
  executeTool(toolName: string, context: string): Promise<ToolResult>;
}
```

## 实现要点

1. 封装 `core/ai/client.ts` - AI 客户端
2. 封装 `core/ai/prompts.ts` - Prompt 模板
3. 配置 `config.json` 或 `.env` 中指定模型
4. Agent 和工具通过依赖注入获取 AI Client
