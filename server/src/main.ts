import { loadModules } from "./bootstrap/load-modules";

/**
 * 极简路由器实现，供模块 joinHTTP 使用
 */
class SimpleRouter {
  private handlers: Map<string, (req: Request) => Promise<Response>> = new Map();

  /**
   * 注册路由处理函数
   * @param path 相对路径 (如 /llm/chat)
   * @param handler 处理函数
   */
  handle(path: string, handler: (req: Request) => Promise<any>) {
    // 统一添加 /api 前缀
    const fullPath = `/api${path.startsWith('/') ? '' : '/'}${path}`;
    this.handlers.set(fullPath, async (req) => {
      try {
        const result = await handler(req);
        return Response.json(result);
      } catch (error: any) {
        return Response.json({ error: error.message }, { status: 500 });
      }
    });
    console.log(`[Router] Registered: ${fullPath}`);
  }

  async dispatch(req: Request): Promise<Response | null> {
    const url = new URL(req.url);
    const handler = this.handlers.get(url.pathname);
    if (handler) {
      return await handler(req);
    }
    return null;
  }
}

async function bootstrap() {
  const router = new SimpleRouter();
  const modules = await loadModules();

  console.log(`[server] Loading ${modules.length} module(s)...`);

  // 1. 调用每个模块的 joinHTTP
  for (const moduleDef of modules) {
    try {
      await moduleDef.joinHTTP(router);
      console.log(`[server] Module "${moduleDef.name}" joined HTTP.`);
    } catch (error) {
      console.error(`[server] Module "${moduleDef.name}" failed to join HTTP:`, error);
    }
  }

  // 2. 调用每个模块的 joinMCP (此处仅占位，后续可接入真实的 MCP Server)
  const mockMCPServer = {
    addTool: (tool: any) => console.log(`[MCP] Registered tool: ${tool.name}`)
  };
  for (const moduleDef of modules) {
    try {
      await moduleDef.joinMCP(mockMCPServer);
    } catch (error) {
      console.error(`[server] Module "${moduleDef.name}" failed to join MCP:`, error);
    }
  }

  const port = Number(Bun.env.PORT ?? 3000);

  Bun.serve({
    port,
    async fetch(request) {
      // 优先交给路由器处理
      const response = await router.dispatch(request);
      if (response) return response;

      const url = new URL(request.url);

      if (url.pathname === "/health") {
        return Response.json({
          ok: true,
          service: "rubick-server",
          modules: modules.map((m) => m.name),
        });
      }

      return Response.json(
        {
          message: "Rubick server is running.",
          endpoints: ["/health", "/api/..."],
        },
        { status: 200 },
      );
    },
  });

  console.log(
    `[server] listening on http://localhost:${port}`
  );
}

void bootstrap();
