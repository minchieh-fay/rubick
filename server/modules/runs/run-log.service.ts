import { db } from '../../database/database';

const id = () => `log-${crypto.randomUUID().slice(0, 8)}`;
const now = () => new Date().toISOString();

export type LogLevel = 'info' | 'stdout' | 'stderr' | 'error';

export function appendLog(runId: string, source: string, level: LogLevel, content: string) {
  if (!content.trim()) return;
  db.query('INSERT INTO run_logs VALUES (?,?,?,?,?,?)').run(id(), runId, source, level, content, now());
}

export function getLogs(runId: string) {
  return db.query('SELECT id,source,level,content,created_at as createdAt FROM run_logs WHERE run_id=? ORDER BY created_at').all(runId);
}
