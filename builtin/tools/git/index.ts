import { ToolDefinition } from '../../../core/cli/types';
import { createCLITool } from '../../../core/cli/wrapper';

/**
 * Example Tool - Git Operations
 * Wraps git CLI commands into the Tool interface
 */
const gitTool: ToolDefinition = createCLITool({
  name: 'git',
  description: 'Execute git commands',
  command: 'git',
});

export default gitTool;
