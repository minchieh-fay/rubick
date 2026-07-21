import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod/v3';
import { appendLog } from '../runs/run-log.service';
import { getAgentNode, getChildAgents } from '../agents/router.service';

const runId = process.env.RUBICK_MCP_RUN_ID ?? '';
const sessionId = process.env.RUBICK_MCP_SESSION_ID ?? '';
const currentNodeId = process.env.RUBICK_MCP_NODE_ID ?? '';
const currentNode = getAgentNode(currentNodeId);
const source = `mcp:${(currentNode?.name ?? currentNodeId) || 'unknown'}`;

function debug(event: string, details: Record<string, unknown> = {}) {
  const payload = { event, runId, sessionId, currentNodeId, ...details };
  process.stderr.write(`[rubick-mcp] ${JSON.stringify(payload)}\n`);
  if (runId) appendLog(runId, source, 'info', JSON.stringify(payload));
}

function result(payload: Record<string, unknown>) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }] };
}

if (!runId || !sessionId || !currentNodeId || !currentNode) {
  debug('invalid_context');
  throw new Error('Rubick MCP 缺少有效的运行上下文');
}

const server = new McpServer({ name: 'rubick', version: '1.0.0' });

server.registerTool('rubick_list_next_agents', {
  description: '列出当前 Agent 的直接下级候选。只能把任务交给这里返回的 Agent。',
}, async () => {
  const candidates = getChildAgents(currentNodeId).map((agent) => ({ id: agent.id, name: agent.name, role: agent.role, environmentName: agent.environmentName }));
  debug('list_next_agents', { candidates });
  return result({ currentAgent: currentNode.name, candidates });
});

const handoffSchema: any = { targetNodeId: z.string(), task: z.string(), reason: z.string() };
server.tool('rubick_handoff', '把当前任务交给一个更适合的直接下级 Agent。targetNodeId 必须来自 rubick_list_next_agents。', handoffSchema, async ({ targetNodeId, task, reason }: any) => {
  const candidate = getChildAgents(currentNodeId).find((agent) => agent.id === targetNodeId);
  if (!candidate) {
    debug('handoff_rejected', { targetNodeId, reason: 'not_a_direct_child' });
    return result({ accepted: false, error: '目标不是当前 Agent 的直接下级', allowed: getChildAgents(currentNodeId).map((agent) => agent.id) });
  }
  debug('handoff_requested', { targetNodeId, targetName: candidate.name, task, reason });
  return result({ accepted: true, status: 'handoff', targetNodeId: candidate.id, targetName: candidate.name, task, reason });
});

const completeSchema: any = { result: z.string() };
server.tool('rubick_complete', '声明当前分支已经完成，不需要任何直接下级继续处理。', completeSchema, async ({ result: output }: any) => {
  const candidates = getChildAgents(currentNodeId);
  debug('completion_requested', { output, candidateCount: candidates.length });
  return result({ accepted: true, status: 'completed', result: output });
});

debug('started', { agentName: currentNode.name, candidateCount: getChildAgents(currentNodeId).length });
const transport = new StdioServerTransport();
await server.connect(transport);
