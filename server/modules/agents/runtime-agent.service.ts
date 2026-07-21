import { Agent, handoff, tool, type RunContext } from '@openai/agents-core';
import { z } from 'zod';
import { config } from '../../config/env';
import { getRuntimeAgentNode, getRuntimeChildAgents, type AgentNode } from './router.service';
import { recordUsage } from './usage.service';
import { runCodex } from '../codex/codex.service';
import { appendLog } from '../runs/run-log.service';
import { ensureAgentWorkspace } from '../sessions/session-workspace.service';
import { setRunCurrent, setWaitingForUser } from '../sessions/session.service';
import { getEnvironmentPath } from '../environments/environment.service';

export type AgentRunContext = {
  runId: string;
  sessionId: string;
  signal?: AbortSignal;
  delegationDepth?: number;
  delegationPath?: string[];
  delegate?: (targetNodeId: string, task: string, sourceNodeId: string, current: AgentRunContext) => Promise<string>;
};

const platformInstruction = [
  '你是组织树中的一个工作节点。',
  '直属下级适合接管后，可以使用 handoff；如果发现需要一个不在直属下级中的能力，使用 delegate_task 请求平台协作。',
  '不要因为组织层级限制而放弃任务，也不要虚构 Agent。平台会校验目标是否存在、是否重复调用以及是否超过协作限制。',
  '需要在绑定环境中读写文件、运行脚本或使用环境内技能时，使用 codex_execute。',
  '不要声称已经执行了没有实际执行的工作。最终答复只说明真实结果和交付物。',
].join('\n');

function codexToolFor(node: AgentNode) {
  return tool({
    name: 'codex_execute',
    description: '在当前 Agent 绑定的 Codex 工作环境中执行实际工作。需要操作文件、运行脚本或使用环境资源时调用。',
    parameters: z.object({
      task: z.string().min(1).describe('需要 Codex 在当前工作环境中完成的具体任务'),
    }),
    timeoutMs: config.codexTimeoutMs,
    timeoutBehavior: 'raise_exception',
    execute: async ({ task }: { task: string }, runContext?: RunContext<AgentRunContext>) => {
      const context = runContext?.context;
      if (!context) throw new Error('Codex tool 缺少运行上下文');
      const route = node.environmentId ? getRuntimeAgentNode(node.id) : null;
      const workspace = ensureAgentWorkspace(context.sessionId, node.id, route?.environmentId ? getEnvironmentPath(route.environmentId) : null);
      if (!node.environmentId) throw new Error(`Agent ${node.name} 没有绑定 Codex 环境`);
      recordUsage(context.sessionId, context.runId, node.id, node.environmentId);
      appendLog(context.runId, 'agent', 'info', `${node.name} 调用 codex_execute`);
      return runCodex(
        `${task}\n\n这是执行工具调用。请只完成当前任务，不负责组织树路由或选择下级 Agent。严格遵循工作目录中的 AGENTS.md。`,
        (level, content) => appendLog(context.runId, `codex:${node.name}`, level, content),
        workspace,
        context.signal,
      );
    },
  });
}

function delegationToolFor(node: AgentNode) {
  return tool({
    name: 'delegate_task',
    description: '把当前任务中的一个独立子任务交给任意已注册的可执行 Agent。先使用 discover_agents 查询目标 ID、职责和环境；不要用它替代直属 handoff。',
    parameters: z.object({
      targetNodeId: z.string().min(1).describe('目标 Agent ID，必须来自可用目标列表'),
      task: z.string().min(1).describe('交给目标 Agent 的独立子任务和所需上下文'),
    }),
    timeoutMs: config.codexTimeoutMs,
    timeoutBehavior: 'raise_exception',
    execute: async ({ targetNodeId, task }: { targetNodeId: string; task: string }, runContext?: RunContext<AgentRunContext>) => {
      const context = runContext?.context;
      if (!context?.delegate) throw new Error('当前运行不支持 Agent 协作');
      if (targetNodeId === node.id || (context.delegationPath ?? []).includes(targetNodeId)) throw new Error('平台拒绝循环调用 Agent');
      appendLog(context.runId, 'router', 'info', `跨层级委派：${node.name} -> ${targetNodeId}`);
      return context.delegate(targetNodeId, task, node.id, context);
    },
  });
}

function discoverAgentsTool() {
  return tool({
    name: 'discover_agents',
    description: '查询当前 Rubick 中可用于协作的 Agent。根据职责、环境和组织位置选择目标，不要根据固定关键词猜测。',
    parameters: z.object({ query: z.string().optional().describe('可选的职责或环境描述') }),
    execute: async ({ query }: { query?: string }) => {
      const normalized = query?.trim().toLocaleLowerCase();
      return getAllRuntimeAgents().filter((node) => node.environmentId && (!normalized || `${node.name} ${node.role} ${node.environmentName ?? ''}`.toLocaleLowerCase().includes(normalized))).map((node) => ({ id: node.id, name: node.name, role: node.role, environment: node.environmentName, parentId: node.parentId }));
    },
  });
}

function userInputTool() {
  return tool({
    name: 'request_user_input',
    description: '当前任务缺少继续执行所需的真实资料时调用。任务会暂停在等待用户状态，问题必须具体说明需要什么、格式是什么以及为什么需要。',
    parameters: z.object({ question: z.string().min(1).describe('需要用户补充的问题') }),
    execute: async ({ question }: { question: string }, runContext?: RunContext<AgentRunContext>) => {
      const context = runContext?.context;
      if (!context) throw new Error('请求用户补充资料时缺少运行上下文');
      setWaitingForUser(context.sessionId, context.runId, question);
      appendLog(context.runId, 'runtime', 'info', `等待用户补充：${question}`);
      throw new Error('RUBICK_WAITING_FOR_USER');
    },
  });
}

function getAllRuntimeAgents() {
  const result: AgentNode[] = [];
  const seen = new Set<string>();
  const visit = (parentId: string) => {
    for (const node of getRuntimeChildAgents(parentId)) {
      if (seen.has(node.id)) continue;
      seen.add(node.id); result.push(node); visit(node.id);
    }
  };
  visit('root-orchestrator');
  return result;
}

function nodeInstructions(node: AgentNode) {
  return `${platformInstruction}\n\n节点角色：${node.role}\n节点名称：${node.name}${node.prompt ? `\n\n用户配置的节点提示词：\n${node.prompt}` : ''}`;
}

export function buildRuntimeAgentGraph(context: AgentRunContext, targetNodeId?: string) {
  const cache = new Map<string, Agent<AgentRunContext>>();

  const build = (node: AgentNode): Agent<AgentRunContext> => {
    const cached = cache.get(node.id);
    if (cached) return cached;

    const children = getRuntimeChildAgents(node.id);
    const childAgents = children.map(build);
    const childHandoffs = childAgents.map((child, index) => handoff(child, {
      toolDescriptionOverride: `将任务交给直接下级 ${children[index].name}。仅当该下级更适合处理当前任务时使用。`,
      onHandoff: async (runContext) => {
        setRunCurrent(runContext.context.runId, children[index].name);
        appendLog(runContext.context.runId, 'router', 'info', `SDK handoff：${node.name} -> ${children[index].name}`);
      },
    }));

    const agent = new Agent<AgentRunContext>({
      name: node.name,
      handoffDescription: `${node.role}${node.environmentName ? `，使用 ${node.environmentName} 环境执行工作` : ''}`,
      model: config.llmModel,
      instructions: nodeInstructions(node),
      handoffs: childHandoffs,
      tools: [
        ...(config.runCodex && node.environmentId ? [codexToolFor(node)] : []),
        ...(context.delegate ? [delegationToolFor(node)] : []),
        ...(context.delegate ? [discoverAgentsTool()] : []),
        userInputTool(),
      ],
    });
    cache.set(node.id, agent);
    return agent;
  };

  const target = targetNodeId ? getRuntimeAgentNode(targetNodeId) : null;
  if (targetNodeId && !target) throw new Error('指定的 Agent 不存在');
  return build(target ?? {
    id: 'root-orchestrator',
    parentId: null,
    name: '总协调 Agent',
    role: '负责理解用户需求并协调组织树中的 Agent',
    environmentId: null,
    environmentName: null,
    prompt: '',
  });
}
