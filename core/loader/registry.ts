import { ToolDefinition } from '../cli/types';

export interface ToolRegistry {
  /** Register a tool */
  register(tool: ToolDefinition): void;
  
  /** Get a tool by name */
  get(name: string): ToolDefinition | undefined;
  
  /** List all registered tools */
  list(): ToolDefinition[];
  
  /** Check if a tool exists */
  has(name: string): boolean;
}

class InMemoryToolRegistry implements ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
  }
  
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }
  
  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }
  
  has(name: string): boolean {
    return this.tools.has(name);
  }
}

export const toolRegistry = new InMemoryToolRegistry();
