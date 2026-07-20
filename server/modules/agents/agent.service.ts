import { db } from '../../database/database';

export function getTree() {
  return db.query(`SELECT n.id,n.parent_id as parentId,n.name,n.role,n.kind,n.enabled,n.environment_id as environmentId,n.prompt_text as prompt,e.name as environmentName,COUNT(u.id) as usageCount
    FROM agent_nodes n LEFT JOIN agent_environments e ON e.id=n.environment_id LEFT JOIN agent_usages u ON u.node_id=n.id
    GROUP BY n.id ORDER BY n.name`).all();
}

export function createNode(parentId: string, name: string, role = '业务协作', environmentId?: string, prompt = '') {
  const id = `node-${crypto.randomUUID().slice(0, 8)}`;
  db.query('INSERT INTO agent_nodes (id,parent_id,name,role,kind,enabled,environment_id,prompt_text) VALUES (?,?,?,?,?,?,?,?)').run(id, parentId, name, role, 'business', 1, environmentId ?? null, prompt);
  return id;
}

export function updateNode(id: string, values: { name?: string; role?: string; enabled?: boolean; prompt?: string }) {
  db.query('UPDATE agent_nodes SET name=COALESCE(?,name),role=COALESCE(?,role),enabled=COALESCE(?,enabled),prompt_text=COALESCE(?,prompt_text) WHERE id=?').run(
    values.name ?? null, values.role ?? null, values.enabled === undefined ? null : Number(values.enabled), values.prompt ?? null, id,
  );
}

export function deleteNode(id: string) {
  if (id === 'root-orchestrator') return false;
  db.query('DELETE FROM agent_nodes WHERE id=? OR parent_id=?').run(id, id);
  return true;
}
