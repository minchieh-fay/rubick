import { ToolDefinition } from '../cli/types';
import { toolRegistry } from './registry';

export interface LoaderConfig {
  /** Directories to scan for tools */
  directories: string[];
}

/**
 * Dynamically load tools from directories
 * Each tool directory should have an index.ts that exports a ToolDefinition
 */
export async function loadToolsFromDirectories(config: LoaderConfig): Promise<void> {
  for (const dir of config.directories) {
    try {
      const tools = await import.meta.glob(`${dir}/*/index.ts`, {
        eager: true,
        import: 'default',
      });
      
      for (const [path, module] of Object.entries(tools)) {
        if (isToolDefinition(module)) {
          const tool = module as ToolDefinition;
          console.log(`Loading tool: ${tool.name} from ${path}`);
          toolRegistry.register(tool);
        }
      }
    } catch (error) {
      console.warn(`Failed to load tools from ${dir}:`, error);
    }
  }
}

function isToolDefinition(obj: unknown): obj is ToolDefinition {
  if (!obj || typeof obj !== 'object') return false;
  const tool = obj as Record<string, unknown>;
  return (
    typeof tool.name === 'string' &&
    typeof tool.description === 'string' &&
    typeof tool.execute === 'function'
  );
}
