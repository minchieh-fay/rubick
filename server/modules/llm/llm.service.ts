import { Agent, Runner, setTracingDisabled } from '@openai/agents-core';
import { OpenAIProvider, setOpenAIAPI } from '@openai/agents-openai';
import { config } from '../../config/env';
import { z } from 'zod';

const delegationRule = '平台总规则：如果任意直接下级 Agent 比当前 Agent 更适合处理用户任务，当前 Agent 必须把任务交给该下级，不能自行结束或替代下级作答。只有没有更合适的下级，当前 Agent 才能完成任务。';

const orchestrationOutput = z.object({
  reply: z.string().describe('给用户看的简短答复，不包含内部日志或长篇执行输出'),
  needsExecution: z.boolean().describe('是否需要调用 Codex 或业务 Agent 执行实际工作'),
  executionPrompt: z.string().describe('需要执行时给 Codex 的完整任务说明；不需要执行时为空字符串'),
  targetNodeId: z.string().nullable().describe('从组织树中选择的本轮可执行目标节点 ID；没有匹配的业务 Agent 时为 null'),
});

const nextAgentOutput = z.object({
  completed: z.boolean().describe('当前 Agent 是否已经完成整个用户任务'),
  nextNodeId: z.string().nullable().describe('下一步要执行的直接下级 Agent ID；完成时必须为 null'),
  reply: z.string().describe('对当前判断的简短说明'),
  executionPrompt: z.string().describe('给下一 Agent 的完整任务说明；没有下一 Agent 时为空字符串'),
});

const provider = config.llmApiKey && config.llmBaseUrl
  ? new OpenAIProvider({ apiKey: config.llmApiKey, baseURL: config.llmBaseUrl, useResponses: true })
  : null;
if (provider) setOpenAIAPI('responses');
setTracingDisabled(true);

export function isConfigured() {
  return Boolean(provider);
}

export async function runOrchestrator(input: string, history: string, routeHint: string, organization: unknown[] = [], allowedNodeIds: string[] = []) {
  if (!provider) throw new Error('LLM 未配置，请检查 LLM_API_KEY 和 LLM_BASE_URL');
  const agent = new Agent({
    name: 'Rubick 总协调 Agent',
    model: config.llmModel,
    outputType: orchestrationOutput,
    instructions: `${delegationRule}\n你是 Rubick 的总协调 Agent，负责语义路由和执行决策。先理解用户需求，再根据当前组织树中每个 Agent 的 name、role、environmentName 和上下级关系判断业务归属。targetNodeId 与 needsExecution 是两个独立决策：只要存在语义上匹配的 executable=true 业务 Agent，就必须返回该节点的原始 id，即使问题很简单；只有没有匹配的业务 Agent 时 targetNodeId 才能为 null。需要让业务 Agent 使用其环境、AGENTS.md、脚本或工具完成任务时，needsExecution=true，并写出完整明确的 executionPrompt；普通闲聊或没有匹配业务 Agent 的直接问答才可以 needsExecution=false。若提供了“本轮允许选择的节点 ID”，targetNodeId 必须是其中一个，不能跨越组织树层级预判更深层 Agent。不要使用组织树之外的节点，不要根据固定关键词或预设领域猜测，必须以当前组织树语义为准。不要把内部日志、命令输出或长篇技术资料放入 reply。

历史对话：
${history || '无'}

当前组织树（唯一可用的路由来源）：
${JSON.stringify(organization)}

本轮允许选择的节点 ID：
${JSON.stringify(allowedNodeIds)}

平台路由提示：
${routeHint || '未根据名称直接匹配节点，请根据组织树进行语义路由。'}`,
  });
  const runner = new Runner({ modelProvider: provider });
  const result = await runner.run(agent, input);
  return result.finalOutput ?? { reply: 'LLM 没有返回结果。', needsExecution: false, executionPrompt: '', targetNodeId: null };
}

export async function decideNextAgent(input: string, history: string, currentAgent: unknown, currentOutput: string, candidates: unknown[]) {
  if (!provider) throw new Error('LLM 未配置，请检查 LLM_API_KEY 和 LLM_BASE_URL');
  const agent = new Agent({
    name: 'Rubick 动态调度 Agent',
    model: config.llmModel,
    outputType: nextAgentOutput,
    instructions: `${delegationRule}\n你是 Rubick 的动态调度器。当前 Agent 刚刚完成一轮实际工作，你必须根据原始需求、当前 Agent 的职责、真实输出和直接下级候选，决定任务是否结束，或者把任务交给一个直接下级 Agent。只能从候选节点中选择 nextNodeId，绝不能跨层级、猜测未来路径或使用候选之外的 ID。不要盲目相信当前 Agent 自己声称“完成”：如果当前节点有下级，并且某个下级在语义上更适合完成原始需求，必须转交该下级；协调节点直接给出的答案不能替代专业下级的处理。只有当前结果已经满足用户需求，且没有任何候选下级能提供必要的后续工作时，才允许 completed=true。若候选为空，只能 completed=true。executionPrompt 必须把原始需求、当前结果和下一步目标交代清楚。不要把内部日志放入 reply。

原始用户需求：
${input}

历史对话：
${history || '无'}

当前 Agent：
${JSON.stringify(currentAgent)}

当前 Agent 实际输出：
${currentOutput}

直接下级候选：
${JSON.stringify(candidates)}`,
  });
  const runner = new Runner({ modelProvider: provider });
  const result = await runner.run(agent, '请根据以上信息做出本轮动态调度决定。');
  return result.finalOutput ?? { completed: true, nextNodeId: null, reply: '当前 Agent 已完成。', executionPrompt: '' };
}
