import { ToolDefinition, ToolContext, ToolResult } from '../../../core/cli/types';

/**
 * Example Tool - File Reader
 * Demonstrates how to create a simple tool
 */
const fileReaderTool: ToolDefinition = {
  name: 'file-reader',
  description: 'Read file contents and return as string',
  version: '1.0.0',
  
  async execute(args: string[], context?: ToolContext): Promise<ToolResult> {
    const filePath = args[0];
    if (!filePath) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: 'Usage: file-reader <filepath>',
        success: false,
      };
    }
    
    try {
      const content = await Bun.file(filePath).text();
      return {
        exitCode: 0,
        stdout: content,
        stderr: '',
        success: true,
      };
    } catch (error) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        success: false,
      };
    }
  },
};

export default fileReaderTool;
