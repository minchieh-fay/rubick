/**
 * Providers 统一导出入口
 * 这里决定了当前系统激活哪一个模型提供商 (Ollama, OpenAI, etc.)
 */

import { ollamaProvider, initOllamaProvider } from './ollama';

// 统一导出各个 provider 供特殊场景使用
export { ollamaProvider };

/**
 * 决定当前激活的 LLM 提供商
 * 实际应用中可以从环境变量 ACTIVE_LLM_PROVIDER 获取
 */
export const ACTIVE_PROVIDER = process.env.ACTIVE_LLM_PROVIDER || 'ollama';

/**
 * 统一的 LLM 生成接口
 * 用户不需要关心后台用的是哪个模型，服务端会根据配置自动注入模型信息
 */
export async function llmGenerate(prompt: string, options: Record<string, any> = {}): Promise<any> {
  // 根据 ACTIVE_PROVIDER 选择对应的 provider
  if (ACTIVE_PROVIDER === 'ollama') {
    // 服务端自动注入模型信息，用户请求里的 model 会被忽略或覆盖
    return ollamaProvider.generate(prompt, options);
  }
  
  throw new Error(`Unsupported provider: ${ACTIVE_PROVIDER}`);
}

/**
 * 统一的 LLM 对话接口
 */
export async function llmChat(messages: any[], options: Record<string, any> = {}): Promise<any> {
  if (ACTIVE_PROVIDER === 'ollama') {
    return ollamaProvider.chat(messages, options);
  }
  
  throw new Error(`Unsupported provider: ${ACTIVE_PROVIDER}`);
}

/**
 * 统一初始化当前激活的 Provider
 */
export async function initAllProviders() {
  console.log(`[Providers] Initializing active provider: ${ACTIVE_PROVIDER}...`);
  
  if (ACTIVE_PROVIDER === 'ollama') {
    await initOllamaProvider();
  }

  console.log('[Providers] Active core provider initialized.');
}

/**
 * 独立运行模式 (Providers 聚合服务)
 * 仅对外暴露统一的 /llm 接口，屏蔽底层 provider 细节
 */
/**
 * 满足 RubickModule 规范的默认导出
 */
export default {
  name: 'llm',
  async joinHTTP(router: any) {
    // 路由注册：将 /llm/chat 等路由挂载到全局 /api/llm 下
    // 这里的 router 假设是主 server 传递的一个带路由注册能力的实例
    // 模块内部可以根据需求定义更细致的子路径
    
    // 初始化 Provider
    await initAllProviders();
    
    // 注意：这里仅定义逻辑，具体的 router 类型取决于 server 的 HTTP 框架 (如 Elysia, Hono 等)
    // 假设 router 提供一个 handle 方法来注册具体的路径逻辑
    router.handle('/llm/chat', async (req: Request) => {
      const body = await req.json();
      const { messages, options = {} } = body;
      return await llmChat(messages || [], options);
    });

    router.handle('/llm/generate', async (req: Request) => {
      const body = await req.json();
      const { prompt, options = {} } = body;
      return await llmGenerate(prompt || '', options);
    });
  },

  async joinMCP(mcpServer: any) {
    // MCP 注册逻辑：将 LLM 能力暴露给 MCP 协议
    // mcpServer.addTool({ name: 'chat', description: '...', ... });
    console.log('[LLMProvider] Joining MCP...');
  }
};

/**
 * 独立运行模式逻辑 (保持不变)
 */
if (import.meta.main) {
  const port = Number(process.env.CORE_PROVIDERS_PORT) || 3000;
  
  await initAllProviders();
  
  console.log(`[Providers] Starting core capability aggregation server on port ${port}...`);
  
  Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);
      
      // 健康检查
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({ 
          status: 'ok', 
          activeProvider: ACTIVE_PROVIDER 
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 统一的 LLM 接口
      // 不管后台是 ollama 还是 openai，前端只调用 /llm 或 /llm/chat
      if (url.pathname.startsWith('/llm')) {
        if (req.method !== 'POST') {
          return new Response('Method Not Allowed', { status: 405 });
        }

        try {
          const body = await req.json();
          const { prompt, messages, options = {} } = body;
          
          let result: any;
          
          // 逻辑判定：如果是 /llm/chat 或者 body 包含 messages
          if (url.pathname === '/llm/chat' || (messages && Array.isArray(messages))) {
            result = await llmChat(messages || [], options);
          } else if (url.pathname === '/llm' || url.pathname === '/llm/generate' || prompt) {
            result = await llmGenerate(prompt || '', options);
          } else {
            return new Response(JSON.stringify({ error: 'Missing prompt or messages' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // 直接返回底层 Provider 返回的原始对象，不做额外的 { result: ... } 包装
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      return new Response('Rubick Core Providers Server - Unified LLM Interface', { status: 200 });
    }
  });

  console.log(`[Providers] Aggregation server is running at http://localhost:${port}`);
  console.log(`[Providers] Unified endpoint available at: http://localhost:${port}/llm/chat`);
}
