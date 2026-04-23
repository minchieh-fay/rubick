import { AIClient, AIOptions, AIResult, TaskAnalysisResult, ToolResult } from './types';
import { PROMPTS } from './prompts';

const DEFAULT_MODEL = 'mmodel';
const DEFAULT_TIMEOUT = 120000; // 2 minutes for AI calls

export interface QoderCLIConfig {
  /** Model name */
  model: string;
  /** Path to qodercli binary */
  binPath?: string;
  /** Default timeout */
  timeout?: number;
}

export class QoderCLIClient implements AIClient {
  private config: Required<QoderCLIConfig>;

  constructor(config?: QoderCLIConfig) {
    this.config = {
      model: config?.model || DEFAULT_MODEL,
      binPath: config?.binPath || 'qodercli',
      timeout: config?.timeout || DEFAULT_TIMEOUT,
    };
  }

  /**
   * Execute raw prompt against qodercli
   */
  async execute(prompt: string, options?: AIOptions): Promise<AIResult> {
    const model = options?.model || this.config.model;
    const timeout = options?.timeout || this.config.timeout;

    try {
      const command = this.config.binPath;
      const args = ['-model', model];

      const proc = Bun.spawn([command, ...args], {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
      });

      // Write prompt to stdin
      const encoder = new TextEncoder();
      const stdinData = encoder.encode(prompt);
      if (proc.stdin) {
        await proc.stdin.write(stdinData);
      }

      // Wait for result with timeout
      const result = await Promise.race([
        (async () => {
          const [stdout, stderr] = await Promise.all([
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text(),
          ]);
          const exitCode = await proc.exited;
          
          if (exitCode !== 0) {
            return {
              success: false,
              text: '',
              error: stderr || `Exit code: ${exitCode}`,
            };
          }

          return {
            success: true,
            text: stdout.trim(),
          };
        })(),
        new Promise<AIResult>((resolve) => {
          setTimeout(() => {
            proc.kill();
            resolve({
              success: false,
              text: '',
              error: 'Execution timed out',
            });
          }, timeout);
        }),
      ]);

      return result;
    } catch (error) {
      return {
        success: false,
        text: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Analyze user input and break down into subtasks
   */
  async analyzeTask(userInput: string): Promise<TaskAnalysisResult> {
    const prompt = PROMPTS.analyzeTask(userInput);
    const result = await this.execute(prompt);

    if (!result.success) {
      return {
        isClear: false,
        questions: ['AI service unavailable. Please provide more details.'],
      };
    }

    try {
      // Parse JSON response
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format');
      }
      
      const parsed = JSON.parse(jsonMatch[0]) as TaskAnalysisResult;
      return parsed;
    } catch {
      // If parsing fails, return a fallback analysis
      return {
        isClear: true,
        title: userInput.slice(0, 50),
        description: userInput,
        subtasks: [{ title: 'Research and planning' }, { title: 'Implementation' }],
        estimatedTime: '2h',
        tags: ['ai-generated'],
        needsNewTools: false,
        requiredTools: [],
      };
    }
  }

  /**
   * Execute a specific tool/skill via AI
   */
  async executeTool(toolName: string, context: string): Promise<ToolResult> {
    const prompt = `Execute tool: ${toolName}\nContext: ${context}\n\nPlease execute this tool and provide the result.`;
    const result = await this.execute(prompt);

    return {
      success: result.success,
      output: result.text,
      error: result.error,
    };
  }
}

/**
 * Create AI client from environment variables or defaults
 */
export function createAIClient(): AIClient {
  const model = process.env.AI_MODEL || DEFAULT_MODEL;
  const binPath = process.env.QODERCLI_PATH;
  
  return new QoderCLIClient({
    model,
    ...(binPath ? { binPath } : {}),
  });
}

export default createAIClient;
