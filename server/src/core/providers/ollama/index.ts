import { OllamaService } from './services/ollama.service';

/**
 * Ollama Provider 入口
 * 负责导出核心服务类和初始化逻辑
 */

export * from './services/ollama.service';
export * from './help';

// 默认导出实例化后的服务
// 实际应用中，这里应该从配置系统中获取环境变量
const defaultBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const defaultModel = process.env.OLLAMA_MODEL || 'gemma4:e4b';

/**
 * 获取默认配置的 Ollama 服务实例
 */
export const ollamaProvider = new OllamaService(defaultBaseUrl, defaultModel);

/**
 * Provider 初始化逻辑 (如果需要)
 */
export async function initOllamaProvider() {
  console.log(`[OllamaProvider] Initialized with model: ${defaultModel} at ${defaultBaseUrl}`);
  // 这里可以做一些连接测试逻辑
  return true;
}
