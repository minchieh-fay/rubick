import { ToolDefinition, ToolResult, ToolContext } from '../cli/types';
import { toolRegistry } from '../loader/registry';

/**
 * Tool Execution Engine
 * 
 * This is the bridge between AI and actual tools.
 * AI can request to execute a tool by name, and this engine finds and runs it.
 */

export interface ToolExecutionRequest {
  /** Tool name to execute */
  toolName: string;
  /** Arguments to pass to the tool */
  args?: string[];
  /** Additional context for the tool */
  context?: ToolContext;
}

/**
 * Execute a specific tool by name
 */
export async function executeTool(
  toolName: string,
  args: string[] = [],
  context?: ToolContext
): Promise<ToolResult> {
  const tool = toolRegistry.get(toolName);
  
  if (!tool) {
    return {
      exitCode: -1,
      stdout: '',
      stderr: `Tool '${toolName}' not found. Available tools: ${toolRegistry.list().map(t => t.name).join(', ')}`,
      success: false,
    };
  }

  // Validate tool if it has a validate method
  if (tool.validate) {
    const isValid = await tool.validate();
    if (!isValid) {
      return {
        exitCode: -2,
        stdout: '',
        stderr: `Tool '${toolName}' validation failed`,
        success: false,
      };
    }
  }

  try {
    const result = await tool.execute(args, context);
    return result;
  } catch (error) {
    return {
      exitCode: -3,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
      success: false,
    };
  }
}

/**
 * Get all available tools
 */
export function getAvailableTools(): ToolDefinition[] {
  return toolRegistry.list();
}

/**
 * Check if a specific tool is available
 */
export function isToolAvailable(toolName: string): boolean {
  return toolRegistry.get(toolName) !== undefined;
}

/**
 * Execute multiple tools in sequence
 */
export async function executeToolsInSequence(
  requests: ToolExecutionRequest[]
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];
  
  for (const req of requests) {
    const result = await executeTool(req.toolName, req.args, req.context);
    results.push(result);
    
    // Stop on failure
    if (!result.success) {
      break;
    }
  }
  
  return results;
}

export default executeTool;
