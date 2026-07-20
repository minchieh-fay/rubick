import { db } from '../../database/database';

export function recordUsage(sessionId: string, runId: string, nodeId: string, environmentId: string) {
  db.query('INSERT INTO agent_usages VALUES (?,?,?,?,?,?)').run(`usage-${crypto.randomUUID().slice(0, 8)}`, sessionId, runId, nodeId, environmentId, new Date().toISOString());
}
