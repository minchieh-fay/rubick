import { Runner, setTracingDisabled } from '@openai/agents-core';
import { OpenAIProvider, setOpenAIAPI } from '@openai/agents-openai';
import { config } from '../../config/env';
import { buildRuntimeAgentGraph, type AgentRunContext } from '../agents/runtime-agent.service';

const provider = config.llmApiKey && config.llmBaseUrl
  ? new OpenAIProvider({ apiKey: config.llmApiKey, baseURL: config.llmBaseUrl, useResponses: true })
  : null;
if (provider) setOpenAIAPI('responses');
setTracingDisabled(true);

export function isConfigured() {
  return Boolean(provider);
}

export async function runRuntimeAgent(input: string, history: string, context: AgentRunContext, targetNodeId?: string) {
  if (!provider) throw new Error('LLM 未配置，请检查 LLM_API_KEY 和 LLM_BASE_URL');
  const runner = new Runner({ modelProvider: provider });
  const delegate = async (target: string, task: string, source: string, current: AgentRunContext) => {
    const depth = current.delegationDepth ?? 0;
    if (depth >= 4) throw new Error('平台协作已达到最大 4 层，避免任务无限递归');
    const nextContext: AgentRunContext = {
      ...context,
      delegationDepth: depth + 1,
      delegationPath: [...(current.delegationPath ?? []), source, target],
      delegate,
    };
    const targetAgent = buildRuntimeAgentGraph(nextContext, target);
    const result = await runner.run(targetAgent, task, { context: nextContext });
    return String(result.finalOutput ?? `${target} 未返回文本结果。`);
  };
  const rootContext: AgentRunContext = { ...context, delegationDepth: 0, delegationPath: ['root-orchestrator'], delegate };
  const agent = buildRuntimeAgentGraph(rootContext, targetNodeId);
  const request = history ? `历史对话：\n${history}\n\n本轮用户请求：\n${input}` : input;
  const result = await runner.run(agent, request, { context: rootContext });
  return { output: String(result.finalOutput ?? 'Agent 没有返回结果。'), currentAgent: result.lastAgent?.name ?? agent.name };
}
