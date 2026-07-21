import { config } from '../../config/env';

export function isAvailable() {
  return Boolean(Bun.which(config.codexBin));
}

export type CodexLogWriter = (level: 'stdout' | 'stderr' | 'error', content: string) => void;
export async function runCodex(input: string, writeLog?: CodexLogWriter, cwd = config.codexCwd, signal?: AbortSignal) {
  const args = [
    'exec', '--ephemeral', '--skip-git-repo-check',
    '--yolo', '--color', 'never',
    ...config.codexArgs, input,
  ];
  const child = Bun.spawn([config.codexBin, ...args], { stdout: 'pipe', stderr: 'pipe', cwd, signal });
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
