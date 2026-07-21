import { config } from '../../config/env';
import { resolve } from 'node:path';

export function isAvailable() {
  return Boolean(Bun.which(config.codexBin));
}

export type CodexLogWriter = (level: 'stdout' | 'stderr' | 'error', content: string) => void;
export type CodexMcpContext = { runId: string; sessionId: string; nodeId: string };

export async function runCodex(input: string, writeLog?: CodexLogWriter, cwd = config.codexCwd, mcpContext?: CodexMcpContext) {
  const args = [
    'exec', '--ephemeral', '--skip-git-repo-check',
    '--yolo', '--color', 'never',
    ...(mcpContext ? [
      '-c', 'mcp_servers.rubick.command="bun"',
      '-c', `mcp_servers.rubick.args=${JSON.stringify(['run', resolve(import.meta.dir, '../mcp/rubick-mcp.ts')])}`,
    ] : []),
    ...config.codexArgs, input,
  ];
  const environment = mcpContext ? {
    ...Bun.env,
    RUBICK_MCP_RUN_ID: mcpContext.runId,
    RUBICK_MCP_SESSION_ID: mcpContext.sessionId,
    RUBICK_MCP_NODE_ID: mcpContext.nodeId,
  } : undefined;
  writeLog?.('stderr', mcpContext ? `Rubick MCP 注入：run=${mcpContext.runId}, node=${mcpContext.nodeId}` : 'Rubick MCP 未注入');
  const child = Bun.spawn([config.codexBin, ...args], { stdout: 'pipe', stderr: 'pipe', cwd, env: environment });
  const [stdout, stderr] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()]);
  const exitCode = await child.exited;
  writeLog?.('stdout', stdout);
  writeLog?.('stderr', stderr);
  const output = stdout.trim();
  if (exitCode !== 0) {
    const error = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n\n') || `Codex exited with code ${exitCode}`;
    writeLog?.('error', error);
    throw new Error(error);
  }
  return output || 'Codex 已完成执行，但没有返回文本。';
}
