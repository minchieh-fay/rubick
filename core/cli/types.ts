/**
 * CLI Tool Interface
 * 
 * All tools must implement this interface.
 * Upper layers only know about this abstraction, not the underlying implementation (qodercli, etc.)
 */

export interface ToolContext {
  /** Working directory for the tool */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
}

export interface ToolResult {
  /** Exit code (0 = success) */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Whether the execution was successful */
  success: boolean;
}

export interface ToolDefinition {
  /** Unique tool name */
  name: string;
  /** Short description */
  description: string;
  /** Tool version */
  version?: string;
  
  /**
   * Execute the tool with given arguments
   */
  execute(args: string[], context?: ToolContext): Promise<ToolResult>;
  
  /**
   * Validate if the tool is available and properly configured
   */
  validate?(): Promise<boolean>;
}

/**
 * CLI Executor - abstracts away the underlying CLI implementation
 */
export async function executeCLI(
  command: string,
  args: string[],
  context: ToolContext = {}
): Promise<ToolResult> {
  const { cwd = process.cwd(), env = {}, timeout = 30000 } = context;
  
  const spawn = Bun.spawn;
  const process = spawn([command, ...args], {
    cwd,
    env: { ...process.env, ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const timeoutPromise = new Promise<ToolResult>((resolve) => {
    setTimeout(() => {
      process.kill();
      resolve({
        exitCode: -1,
        stdout: '',
        stderr: 'Execution timed out',
        success: false,
      });
    }, timeout);
  });

  const executionPromise = (async () => {
    const [stdout, stderr] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
    ]);
    
    const exitCode = await process.exited;
    
    return {
      exitCode,
      stdout,
      stderr,
      success: exitCode === 0,
    };
  })();

  return Promise.race([executionPromise, timeoutPromise]);
}
