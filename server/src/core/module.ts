/**
 * 模块基础接口定义
 * 每个 core 或 modules 下的子模块 index.ts 必须遵循此规范
 */
export interface RubickModule {
  name: string;
  /**
   * 将模块的 HTTP 路由挂载到服务器
   * @param router 路由实例或挂载函数
   */
  joinHTTP: (router: any) => Promise<void> | void;
  /**
   * 将模块的功能注册到 MCP 服务
   * @param mcpServer MCP 服务实例
   */
  joinMCP: (mcpServer: any) => Promise<void> | void;
}
