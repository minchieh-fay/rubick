import { Agent, Runner } from '@openai/agents-core';
import { OpenAIProvider, setOpenAIAPI } from '@openai/agents-openai';
import { setTracingDisabled } from '@openai/agents-core';
import { config } from '../../config/env';
import { z } from 'zod';

const orchestrationOutput = z.object({
  reply: z.string().describe('给用户看的简短答复，不包含内部日志或长篇执行输出'),
  needsExecution: z.boolean().describe('是否需要调用 Codex 或业务 Agent 执行实际工作'),
  executionPrompt: z.string().describe('需要执行时给 Codex 的完整任务说明；不需要执行时为空字符串'),
  targetNodeId: z.string().nullable().describe('从组织树中选择的语义上最匹配的可执行目标节点 ID；没有匹配的业务 Agent 时为 null'),
});

const provider = config.llmApiKey && config.llmBaseUrl
  ? new OpenAIProvider({ apiKey: config.llmApiKey, baseURL: config.llmBaseUrl, useResponses: true })
  : null;
if (provider) setOpenAIAPI('responses');
setTracingDisabled(true);

export function isConfigured() {
  return Boolean(provider);
}

export async function runOrchestrator(input: string, history: string, routeHint: string, organization: unknown[] = []) {
  if (!provider) throw new Error('LLM 未配置，请检查 LLM_API_KEY 和 LLM_BASE_URL');
  const agent = new Agent({
    name: 'Rubick 总协调 Agent',
    model: config.llmModel,
    outputType: orchestrationOutput,
    instructions: `你是 Rubick 的总协调 Agent，负责语义路由和执行决策。先理解用户需求，再根据当前组织树中每个 Agent 的 name、role、environmentName 和上下级关系判断业务归属。targetNodeId 与 needsExecution 是两个独立决策：只要存在语义上匹配的 executable=true 业务 Agent，就必须返回该节点的原始 id，即使问题很简单；只有没有匹配的业务 Agent 时 targetNodeId 才能为 null。需要让业务 Agent 使用其环境、AGENTS.md、脚本或工具完成任务时，needsExecution=true，并写出完整明确的 executionPrompt；普通闲聊或没有匹配业务 Agent 的直接问答才可以 needsExecution=false。若已选择 targetNodeId，平台会沿组织树执行从总协调 Agent 到该节点的完整链路。不要使用组织树之外的节点，不要根据固定关键词或预设领域猜测，必须以当前组织树语义为准。不要把内部日志、命令输出或长篇技术资料放入 reply。\n\n历史对话：\n${history || '无'}\n\n当前组织树（唯一可用的路由来源）：\n${JSON.stringify(organization)}\n\n平台路由提示：\n${routeHint || '未根据名称直接匹配节点，请根据组织树进行语义路由。'}`,
  });
  const runner = new Runner({ modelProvider: provider });
  const result = await runner.run(agent, input);
  return result.finalOutput ?? { reply: 'LLM 没有返回结果。', needsExecution: false, executionPrompt: '', targetNodeId: null };
}
