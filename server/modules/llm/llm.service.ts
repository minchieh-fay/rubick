import { Agent, Runner } from '@openai/agents-core';
import { OpenAIProvider, setOpenAIAPI } from '@openai/agents-openai';
import { setTracingDisabled } from '@openai/agents-core';
import { config } from '../../config/env';
import { z } from 'zod';

const orchestrationOutput = z.object({
  reply: z.string().describe('给用户看的简短答复，不包含内部日志或长篇执行输出'),
  needsExecution: z.boolean().describe('是否需要调用 Codex 或业务 Agent 执行实际工作'),
  executionPrompt: z.string().describe('需要执行时给 Codex 的完整任务说明；不需要执行时为空字符串'),
});

const provider = config.llmApiKey && config.llmBaseUrl
  ? new OpenAIProvider({ apiKey: config.llmApiKey, baseURL: config.llmBaseUrl, useResponses: true })
  : null;
if (provider) setOpenAIAPI('responses');
setTracingDisabled(true);

export function isConfigured() {
  return Boolean(provider);
}

export async function runOrchestrator(input: string, history: string, routeHint: string) {
  if (!provider) throw new Error('LLM 未配置，请检查 LLM_API_KEY 和 LLM_BASE_URL');
  const agent = new Agent({
    name: 'Rubick 总协调 Agent',
    model: config.llmModel,
    outputType: orchestrationOutput,
    instructions: `你是 Rubick 的总协调 Agent。先判断用户是在闲聊/问答，还是需要实际执行任务。闲聊和简单问答必须 needsExecution=false，只给简短自然的 reply。需要执行时 needsExecution=true，reply 只说明即将做什么，executionPrompt 写给 Codex，必须包含完整、明确、可执行的任务。不要把内部日志、命令输出或长篇技术资料放入 reply。\n\n历史对话：\n${history || '无'}\n\n平台路由提示：\n${routeHint || '无，使用普通对话处理。'}`,
  });
  const runner = new Runner({ modelProvider: provider });
  const result = await runner.run(agent, input);
  return result.finalOutput ?? { reply: 'LLM 没有返回结果。', needsExecution: false, executionPrompt: '' };
}
