import { db } from '../../database/database';
import { getEnvironmentPath } from '../environments/environment.service';

type NodeRow = { id: string; parent_id: string | null; name: string; role: string; environment_id: string | null; environment_name: string | null; prompt_text: string };

const routeRules = [
  { pattern: /手机|苹果|iphone|安卓|华为|小米|人脸|解锁/i, env: '手机专家' },
  { pattern: /数学|计算|加法|减法|乘法|除法|等于|\d+\s*[+\-*/]\s*\d+/i, env: '数学老师' },
  { pattern: /历史|朝代|战争|皇帝|历史人物/i, env: '历史老师' },
];

function nodes() {
  return db.query('SELECT n.id,n.parent_id,n.name,n.role,n.environment_id,n.prompt_text,e.name as environment_name FROM agent_nodes n LEFT JOIN agent_environments e ON e.id=n.environment_id').all() as NodeRow[];
}

export function routeInput(input: string) {
  const all = nodes();
  const rule = routeRules.find((item) => item.pattern.test(input));
  if (!rule) return null;
  const leaf = all.find((item) => item.environment_name === rule.env || item.name === rule.env);
  if (!leaf) return { targetName: rule.env, path: [], steps: [], cwd: null, missing: true };
  const byId = new Map(all.map((item) => [item.id, item]));
  const path: string[] = [];
  const chain: NodeRow[] = [];
  let current: NodeRow | undefined = leaf;
  while (current) {
    path.unshift(current.name);
    chain.unshift(current);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return { targetName: leaf.name, path, steps: chain.filter((item) => item.environment_id).map((item) => ({ nodeId: item.id, environmentId: item.environment_id, name: item.name, cwd: getEnvironmentPath(item.environment_id), prompt: item.prompt_text })), cwd: getEnvironmentPath(leaf.environment_id), missing: false };
}
