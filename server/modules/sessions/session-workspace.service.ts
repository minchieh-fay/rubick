import { existsSync, lstatSync, mkdirSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { config } from '../../config/env';

const sessionsRoot = resolve(config.dataDir, 'sessions');
mkdirSync(sessionsRoot, { recursive: true });

function timestampId() {
  const now = new Date();
  const parts = [now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()];
  return parts.map((part, index) => String(part).padStart(index === 0 ? 4 : index === 6 ? 3 : 2, '0')).join('');
}

function uniqueSessionId() {
  const base = timestampId();
  let candidate = base;
  let suffix = 1;
  while (existsSync(join(sessionsRoot, candidate))) candidate = `${base}-${suffix++}`;
  return candidate;
}

export function sessionPath(sessionId: string) {
  return join(sessionsRoot, sessionId);
}

export function createSessionWorkspace() {
  const sessionId = uniqueSessionId();
  const root = sessionPath(sessionId);
  mkdirSync(join(root, 'data', 'input'), { recursive: true });
  mkdirSync(join(root, 'data', 'output'), { recursive: true });
  return { sessionId, root };
}

export function ensureSessionWorkspace(sessionId: string) {
  const root = sessionPath(sessionId);
  mkdirSync(join(root, 'data', 'input'), { recursive: true });
  mkdirSync(join(root, 'data', 'output'), { recursive: true });
  return root;
}

function agentDirectoryName(nodeId: string) {
  return `agent-${nodeId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function ensureLink(target: string, linkPath: string) {
  if (existsSync(linkPath) || lstatSync(linkPath, { throwIfNoEntry: false })) return;
  symlinkSync(relative(join(linkPath, '..'), target), linkPath, 'junction');
}

export function ensureAgentWorkspace(sessionId: string, nodeId: string, environmentPath: string | null) {
  const sessionRoot = ensureSessionWorkspace(sessionId);
  const agentRoot = join(sessionRoot, agentDirectoryName(nodeId));
  mkdirSync(agentRoot, { recursive: true });

  if (environmentPath && existsSync(environmentPath)) {
    for (const entry of readdirSync(environmentPath)) {
      if (entry === 'data') continue;
      ensureLink(join(environmentPath, entry), join(agentRoot, entry));
    }
  }
  ensureLink(join(sessionRoot, 'data'), join(agentRoot, 'data'));
  return agentRoot;
}

function safeFileName(name: string) {
  const cleaned = basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned || 'request.txt';
}

export function writeSessionInput(sessionId: string, runId: string, content: string) {
  const path = join(ensureSessionWorkspace(sessionId), 'data', 'input', `${runId}.md`);
  writeFileSync(path, content, 'utf8');
  return path;
}

export function writeSessionOutput(sessionId: string, runId: string, content: string) {
  const path = join(ensureSessionWorkspace(sessionId), 'data', 'output', `${runId}.md`);
  writeFileSync(path, content, 'utf8');
  return path;
}

export function saveSessionUpload(sessionId: string, name: string, data: ArrayBuffer) {
  const path = join(ensureSessionWorkspace(sessionId), 'data', 'input', safeFileName(name));
  writeFileSync(path, Buffer.from(data));
  return path;
}

export function listSessionFiles(sessionId: string, scope: 'input' | 'output') {
  const directory = join(ensureSessionWorkspace(sessionId), 'data', scope);
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => ({ name: entry.name, url: `/api/sessions/${encodeURIComponent(sessionId)}/${scope}/${encodeURIComponent(entry.name)}` }));
}

export function sessionFilePath(sessionId: string, scope: 'input' | 'output', name: string) {
  const directory = resolve(ensureSessionWorkspace(sessionId), 'data', scope);
  const path = resolve(directory, name);
  if (!path.startsWith(`${directory}/`) || !existsSync(path)) return null;
  return path;
}
