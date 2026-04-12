import { 
  buildOllamaRequestBody, 
  buildChatRequestBody, 
  formatOllamaResponse 
} from '../help';

/**
 * Ollama 核心服务
 * 处理与本地 Ollama API 的通信
 */
export class OllamaService {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string, model: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.model = model;
  }

  /**
   * 基础生成 (generate)
   */
  async generate(prompt: string, options: Record<string, any> = {}): Promise<any> {
    const body = buildOllamaRequestBody(prompt, this.model, options);
    
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Ollama generate error:', error);
      throw error;
    }
  }

  /**
   * 对话生成 (chat)
   */
  async chat(messages: any[], options: Record<string, any> = {}): Promise<any> {
    const body = buildChatRequestBody(messages, this.model, options);
    
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Ollama chat error:', error);
      throw error;
    }
  }

  /**
   * 获取当前配置的模型
   */
  getModelName(): string {
    return this.model;
  }
}
