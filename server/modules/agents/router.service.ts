import { db } from '../../database/database';
import { getEnvironmentPath } from '../environments/environment.service';

type NodeRow = { id: string; parent_id: string | null; name: string; role: string; environment_id: string | null; environment_name: string | null; prompt_text: string };
export type AgentNode = {
  id: string;
  parentId: string | null;
  name: string;
  role: string;
  environmentId: string | null;
  environmentName: string | null;
  prompt: string;
};

export type AgentStep = AgentNode & { cwd: string | null };

function matchesNodeName(input: string, name: string) {
  const normalizedInput = input.toLocaleLowerCase();
  const normalizedName = name.trim().toLocaleLowerCase();
  if (!normalizedName) return false;
  if (/^[a-z0-9_-]+$/i.test(normalizedName)) {
    return new RegExp(`(^|[^a-z0-9_-])${normalizedName.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}($|[^a-z0-9_-])`, 'i').test(input);
  }
  return normalizedInput.includes(normalizedName);
}

function nodes() {
  return db.query('SELECT n.id,n.parent_id,n.name,n.role,n.environment_id,n.prompt_text,e.name as environment_name FROM agent_nodes n LEFT JOIN agent_environments e ON e.id=n.environment_id').all() as NodeRow[];
}

function toAgentNode(row: NodeRow): AgentNode {
  return { id: row.id, parentId: row.parent_id, name: row.name, role: row.role, environmentId: row.environment_id, environmentName: row.environment_name, prompt: row.prompt_text };
}

export function getAgentNode(nodeId: string | null | undefined) {
  if (!nodeId) return null;
  const row = nodes().find((item) => item.id === nodeId && item.environment_id);
  return row ? toAgentNode(row) : null;
}

export function getChildAgents(parentId: string) {
  return nodes().filter((item) => item.parent_id === parentId && item.environment_id && item.environment_name).map(toAgentNode);
}

export function routeInput(input: string) {
  const all = nodes();
  const mountedLeaves = all.filter((item) => item.environment_id && item.environment_name);
  const namedLeaf = mountedLeaves
    .filter((item) => matchesNodeName(input, item.environment_name!) || matchesNodeName(input, item.name))
    .sort((left, right) => (right.environment_name?.length ?? 0) - (left.environment_name?.length ?? 0))[0];
  return namedLeaf ? buildRoute(all, namedLeaf) : null;
}

export function routeNode(nodeId: string | null | undefined) {
  if (!nodeId) return null;
  const all = nodes();
  const target = all.find((item) => item.id === nodeId && item.environment_id);
  return target ? buildRoute(all, target) : null;
}

export function getPathNodeIds(nodeId: string | null | undefined) {
  if (!nodeId) return [];
  const all = nodes();
  const byId = new Map(all.map((item) => [item.id, item]));
  const path: string[] = [];
  let current = byId.get(nodeId);
  while (current) {
    path.unshift(current.id);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return path;
}

export function getRoutingContext() {
  return nodes().map((item) => ({
    id: item.id,
    parentId: item.parent_id,
    name: item.name,
    role: item.role,
    environmentName: item.environment_name,
    executable: Boolean(item.environment_id),
  }));
}

function buildRoute(all: NodeRow[], leaf: NodeRow) {
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
