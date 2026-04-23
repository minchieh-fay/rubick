/**
 * AI Client Types
 * 
 * Unified interface for AI operations.
 * Upper layers (Agent, Tools) only know this interface, not the underlying provider.
 */

export interface AIOptions {
  /** Model name (default: configured default) */
  model?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Maximum tokens for response */
  maxTokens?: number;
  /** Temperature (0-1) */
  temperature?: number;
}

export interface AIResult {
  /** Whether the execution was successful */
  success: boolean;
  /** AI response text */
  text: string;
  /** Error message if failed */
  error?: string;
}

export interface SubTaskSpec {
  title: string;
  description?: string;
}

export interface TaskAnalysisResult {
  /** Whether the request is clear enough */
  isClear: boolean;
  /** Clarifying questions if not clear */
  questions?: string[];
  /** Task title (extracted/suggested) */
  title?: string;
  /** Task description */
  description?: string;
  /** Suggested subtasks */
  subtasks?: SubTaskSpec[];
  /** Estimated time */
  estimatedTime?: string;
  /** Suggested tags */
  tags?: string[];
  /** Whether this requires tools the AI doesn't have */
  needsNewTools?: boolean;
  /** What tools are needed */
  requiredTools?: string[];
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * AI Client Interface
 * All AI operations go through this interface.
 */
export interface AIClient {
  /** Execute arbitrary prompt, return raw text */
  execute(prompt: string, options?: AIOptions): Promise<AIResult>;
  
  /** Analyze user input and break down into subtasks */
  analyzeTask(userInput: string): Promise<TaskAnalysisResult>;
  
  /** Execute a specific tool/skill via AI */
  executeTool(toolName: string, context: string): Promise<ToolResult>;
}
