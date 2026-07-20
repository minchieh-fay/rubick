import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { db } from '../../database/database';
import { config } from '../../config/env';

const environmentsRoot = resolve(config.dataDir, 'environments');
mkdirSync(environmentsRoot, { recursive: true });
const now = () => new Date().toISOString();
const tempRoot = resolve(config.dataDir, 'tmp-environments');
mkdirSync(tempRoot, { recursive: true });

export function listEnvironments(options: { search?: string; page?: number; pageSize?: number } = {}) {
  const search = options.search?.trim() ?? '';
  const pageSize = Math.min(Math.max(options.pageSize ?? 24, 1), 100);
  const page = Math.max(options.page ?? 1, 1);
  const pattern = `%${search}%`;
  const total = (db.query('SELECT COUNT(*) as count FROM agent_environments WHERE name LIKE ?').get(pattern) as { count: number }).count;
  const items = db.query(`SELECT e.id,e.name,e.source_path as sourcePath,e.installed_path as installedPath,e.created_at as createdAt,COUNT(u.id) as usageCount
    FROM agent_environments e LEFT JOIN agent_usages u ON u.environment_id=e.id
    WHERE e.name LIKE ? GROUP BY e.id ORDER BY e.created_at DESC LIMIT ? OFFSET ?`).all(pattern, pageSize, (page - 1) * pageSize);
  return { items, total, page, pageSize, totalPages: Math.max(Math.ceil(total / pageSize), 1) };
}

export function importDirectory(sourcePath: string, displayName?: string) {
  const source = resolve(sourcePath);
  if (!existsSync(`${source}/AGENTS.md`)) throw new Error('环境目录必须包含 AGENTS.md');
  const name = displayName?.trim() || basename(source);
  const id = `env-${crypto.randomUUID().slice(0, 8)}`;
  const destination = resolve(environmentsRoot, id);
  cpSync(source, destination, { recursive: true, force: false });
  db.query('INSERT INTO agent_environments VALUES (?,?,?,?,?)').run(id, name, source, destination, now());
  return { id, name, installedPath: destination, files: readdirSync(destination) };
}

export async function importArchive(archivePath: string, displayName?: string) {
  const extraction = resolve(tempRoot, `extract-${crypto.randomUUID()}`);
  mkdirSync(extraction, { recursive: true });
  const process = Bun.spawn(['unzip', '-q', archivePath, '-d', extraction], { stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text()]);
  if (await process.exited !== 0) throw new Error(stderr || stdout || 'zip 解压失败');
  const queue = [extraction];
  let environmentRoot: string | undefined;
  while (queue.length) {
    const current = queue.shift()!;
    if (existsSync(`${current}/AGENTS.md`)) { environmentRoot = current; break; }
    for (const entry of readdirSync(current, { withFileTypes: true })) if (entry.isDirectory()) queue.push(resolve(current, entry.name));
  }
  if (!environmentRoot) throw new Error('压缩包内必须包含 AGENTS.md');
  try { return importDirectory(environmentRoot, displayName || basename(archivePath, '.zip')); } finally { rmSync(extraction, { recursive: true, force: true }); }
}

export function deleteEnvironment(environmentId: string) {
  const usage = db.query('SELECT COUNT(*) as count FROM agent_nodes WHERE environment_id=?').get(environmentId) as { count: number };
  if (usage.count > 0) throw new Error(`该环境正在被 ${usage.count} 个组织节点使用，解除挂载后才能删除`);
  const row = db.query('SELECT installed_path as path FROM agent_environments WHERE id=?').get(environmentId) as { path: string } | null;
  if (!row) return false;
  rmSync(row.path, { recursive: true, force: true });
  db.query('DELETE FROM agent_environments WHERE id=?').run(environmentId);
  return true;
}

export async function createArchive(environmentId: string) {
  const row = db.query('SELECT name,installed_path as path FROM agent_environments WHERE id=?').get(environmentId) as { name: string; path: string } | null;
  if (!row) return null;
  const archivePath = resolve(tempRoot, `${environmentId}.zip`);
  rmSync(archivePath, { force: true });
  const process = Bun.spawn(['zip', '-qr', archivePath, '.'], { cwd: row.path, stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text()]);
  if (await process.exited !== 0) throw new Error(stderr || stdout || 'zip 打包失败');
  return { path: archivePath, name: `${row.name}.zip` };
}

export function getEnvironmentPath(environmentId: string | null | undefined) {
  if (!environmentId) return null;
  const row = db.query('SELECT installed_path as path FROM agent_environments WHERE id=?').get(environmentId) as { path: string } | null;
  return row?.path ?? null;
}
