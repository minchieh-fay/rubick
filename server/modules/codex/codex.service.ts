import { config } from '../../config/env';

export function isAvailable() {
  return Boolean(Bun.which(config.codexBin));
}

export type CodexLogWriter = (level: 'stdout' | 'stderr' | 'error', content: string) => void;

export async function runCodex(input: string, writeLog?: CodexLogWriter, cwd = config.codexCwd) {
  const args = [
    'exec', '--ephemeral', '--skip-git-repo-check',
    '--sandbox', 'workspace-write', '--color', 'never',
    ...config.codexArgs, input,
  ];
  const process = Bun.spawn([config.codexBin, ...args], { stdout: 'pipe', stderr: 'pipe', cwd });
  const [stdout, stderr] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text()]);
  const exitCode = await process.exited;
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
