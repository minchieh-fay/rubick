import { ToolDefinition } from '../cli/types';
import { toolRegistry } from './registry';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

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
      const entries = await readdir(dir);
      
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const entryStat = await stat(fullPath);
        
        if (!entryStat.isDirectory()) continue;
        
        const indexPath = join(fullPath, 'index.ts');
        try {
          await stat(indexPath);
          const mod = await import(indexPath);
          const toolDef = mod.default as ToolDefinition;
          
          if (isToolDefinition(toolDef)) {
            console.log(`Loading tool: ${toolDef.name} from ${indexPath}`);
            toolRegistry.register(toolDef);
          }
        } catch {
          // No index.ts in this directory, skip
          continue;
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
