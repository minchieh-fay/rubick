import { ToolDefinition, ToolContext, ToolResult, executeCLI } from './types';

/**
 * Create a CLI-based tool from command template
 * This wraps any CLI command into the Tool interface
 */
export function createCLITool(config: {
  name: string;
  description: string;
  command: string;
  version?: string;
}): ToolDefinition {
  return {
    name: config.name,
    description: config.description,
    version: config.version,
    
    async execute(args: string[], context?: ToolContext): Promise<ToolResult> {
      return executeCLI(config.command, args, context);
    },
    
    async validate(): Promise<boolean> {
      try {
        const result = await executeCLI(config.command, ['--version'], {});
        return result.success;
      } catch {
        return false;
      }
    },
  };
}
