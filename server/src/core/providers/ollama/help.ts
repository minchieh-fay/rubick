/**
 * Ollama 模块辅助逻辑
 * 存放不需要在主流程中展开阅读的辅助函数
 */

/**
 * 格式化 Ollama 接口返回的响应
 * @param response Ollama 原始 API 响应内容
 */
export function formatOllamaResponse(response: any) {
  if (!response) return '';
  return response.response || response.message?.content || '';
}

/**
 * 构造发送给 Ollama 的基础请求体
 * @param prompt 提示词
 * @param model 模型名称
 * @param options 其他生成选项
 */
export function buildOllamaRequestBody(prompt: string, model: string, options: Record<string, any> = {}) {
  return {
    model,
    prompt,
    stream: false,
    options: {
      temperature: 0.7,
      ...options
    }
  };
}

/**
 * 类辅助方法：用于构造对话请求体
 * 虽然这通常是类的一部分，但根据约定，我们可以把辅助构造逻辑放进 help.ts
 */
export function buildChatRequestBody(messages: any[], model: string, options: Record<string, any> = {}) {
  return {
    model,
    messages,
    stream: false,
    options: {
      temperature: 0.7,
      ...options
    }
  };
}
