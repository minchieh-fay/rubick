import { rmSync } from 'node:fs';
import { config } from './config/env';
import './database/database';
import { getTree, createNode, updateNode, deleteNode } from './modules/agents/agent.service';
import { getAgentNode, getChildAgents, getPathNodeIds, getRoutingContext, routeInput, routeNode } from './modules/agents/router.service';
import { recordUsage } from './modules/agents/usage.service';
import { isAvailable as isCodexAvailable, runCodex } from './modules/codex/codex.service';
import { decideNextAgent, isConfigured as isLlmConfigured, runOrchestrator } from './modules/llm/llm.service';
import { createSession, createTurn, finishRun, getHistory, getSession, listSessions, setRunCurrent } from './modules/sessions/session.service';
import { createArchive, deleteEnvironment, importArchive, importDirectory, listEnvironments } from './modules/environments/environment.service';
import { appendLog, getLogs } from './modules/runs/run-log.service';
import { ensureAgentWorkspace, listSessionFiles, saveSessionUpload, sessionFilePath } from './modules/sessions/session-workspace.service';

const json = (data: unknown, status = 200) => Response.json(data, {
  status,
  headers: { 'Access-Control-Allow-Origin': '*' },
});

async function executeRun(runId: string, sessionId: string, input: string, targetNodeId?: string) {
  try {
    setRunCurrent(runId, '总协调 Agent');
    appendLog(runId, 'orchestrator', 'info', `收到用户请求：\n${input}`);
    const namedRoute = routeInput(input);
    const explicitPath = targetNodeId ? getPathNodeIds(targetNodeId) : [];
    const rootIndex = explicitPath.indexOf('root-orchestrator');
    const explicitFirstNodeId = rootIndex >= 0 ? explicitPath[rootIndex + 1] : undefined;
    if (targetNodeId && (!routeNode(targetNodeId) || !explicitFirstNodeId)) throw new Error('指定的 Agent 不存在或没有可执行环境');
    const history = getHistory(sessionId).map((item) => `${item.role}: ${item.content}`).join('\n');
    const routeHint = namedRoute ? `名称预匹配候选：${namedRoute.targetName}（仅供参考，不决定路由）` : '';
    appendLog(runId, 'router', 'info', routeHint || '未通过名称预匹配，交由总协调 Agent 进行语义路由');
    const rootCandidates = getChildAgents('root-orchestrator');
    const allowedInitialNodeIds = explicitFirstNodeId ? [explicitFirstNodeId] : rootCandidates.map((item) => item.id);
    const plan = await runOrchestrator(input, history, routeHint, getRoutingContext(), allowedInitialNodeIds);
    appendLog(runId, 'orchestrator', 'info', JSON.stringify(plan, null, 2));
    const firstNodeId = explicitFirstNodeId ?? plan.targetNodeId;
    const firstNode = getAgentNode(firstNodeId);
    if (!config.runCodex || (!firstNode && !plan.needsExecution)) {
      finishRun(runId, sessionId, 'completed', plan.reply);
      return;
    }
    if (plan.needsExecution && !firstNode) {
      throw new Error('总协调 Agent 未选择有效的可执行组织节点');
    }
    let currentNode = firstNode;
    let currentPrompt = plan.executionPrompt || input;
    let codexOutput = '';
    const executedNames = ['总协调 Agent'];
    const visited = new Set<string>();
    for (let stepIndex = 0; currentNode; stepIndex += 1) {
      const node = currentNode;
      if (stepIndex >= 20) throw new Error('动态调度超过最大 20 步，已停止以避免循环');
      if (visited.has(node.id)) throw new Error(`动态调度检测到重复节点：${node.name}`);
      visited.add(node.id);
      setRunCurrent(runId, node.name);
      const workspace = ensureAgentWorkspace(sessionId, node.id, node.environmentId ? (routeNode(node.id)?.cwd ?? null) : null);
      if (node.environmentId) recordUsage(sessionId, runId, node.id, node.environmentId);
      const prompt = `${currentPrompt}\n\n你是组织树中的 ${node.name}（${node.role}）。请严格按照当前工作目录中的 AGENTS.md 执行。本次 Session 的共享数据目录是当前工作目录下的 data/；用户输入位于 data/input/，所有需要让用户访问的最终文件必须写入 data/output/。完成本轮工作后，请在输出中明确说明结果，以及是否需要下级 Agent 继续处理。`;
      const promptWithOverride = node.prompt ? `${prompt}\n\n节点附加提示词：\n${node.prompt}` : prompt;
      const stepOutput = await runCodex(promptWithOverride, (level, content) => appendLog(runId, `codex:${node.name}`, level, content), workspace);
      codexOutput = stepOutput;
      executedNames.push(node.name);
      appendLog(runId, 'router', 'info', `实际调用链：${executedNames.join(' -> ')}`);

      const candidates = getChildAgents(node.id);
      if (candidates.length === 0) break;
      const explicitNextId = targetNodeId ? explicitPath[explicitPath.indexOf(node.id) + 1] : undefined;
      if (explicitNextId) {
        const nextNode = candidates.find((candidate) => candidate.id === explicitNextId);
        if (!nextNode) throw new Error(`显式 Agent 路径不包含直接下级节点：${explicitNextId}`);
        appendLog(runId, 'router', 'info', `显式路径：${node.name} -> ${nextNode.name}`);
        currentPrompt = `${input}\n\n上一个 Agent（${node.name}）的输出：\n${stepOutput}`;
        currentNode = nextNode;
        continue;
      }
      const decision = await decideNextAgent(input, history, node, stepOutput, candidates);
      appendLog(runId, 'orchestrator', 'info', JSON.stringify({ currentNodeId: node.id, ...decision }, null, 2));
      if (decision.completed || !decision.nextNodeId) break;
      const nextNode = candidates.find((candidate) => candidate.id === decision.nextNodeId);
      if (!nextNode) throw new Error(`动态调度选择了非直接下级节点：${decision.nextNodeId}`);
      appendLog(runId, 'router', 'info', `动态决策：${node.name} -> ${nextNode.name}`);
      currentPrompt = decision.executionPrompt || `${input}\n\n上一个 Agent（${node.name}）的输出：\n${stepOutput}`;
      currentNode = nextNode;
    }
    const publicOutput = `${plan.reply}\n\nCodex 已完成执行。\n\n${codexOutput.length > 2400 ? `${codexOutput.slice(0, 2400)}\n\n详细输出已保存到运行日志。` : codexOutput}`;
    finishRun(runId, sessionId, 'completed', publicOutput);
  } catch (error) {
    const message = `执行失败：${error instanceof Error ? error.message : String(error)}`;
    appendLog(runId, 'runtime', 'error', message);
    finishRun(runId, sessionId, 'failed', message);
  }
}

const server = Bun.serve({
  port: config.port,
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
    if (!url.pathname.startsWith('/api')) {
      const filePath = url.pathname === '/' ? './index.html' : `./dist${url.pathname}`;
      return new Response(Bun.file(filePath));
    }
    if (url.pathname === '/api/bootstrap') {
      const environmentPage = listEnvironments({ page: 1, pageSize: 24 });
      return json({ tree: getTree(), environments: environmentPage.items, environmentsMeta: environmentPage, sessions: listSessions(), codexBin: config.codexBin, codexAvailable: isCodexAvailable(), llmConfigured: isLlmConfigured(), llmModel: config.llmModel });
    }
    if (url.pathname === '/api/sessions' && req.method === 'POST') {
      const body = await req.json() as { content?: string; targetNodeId?: string };
      const content = body.content?.trim() ?? '';
      if (!content) return json({ error: 'content is required' }, 400);
      const created = createSession(content, body.targetNodeId);
      void executeRun(created.runId, created.sessionId, content, body.targetNodeId);
      return json(created);
    }
    const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
    if (sessionMatch && req.method === 'GET') return json(getSession(sessionMatch[1]));
    const turnMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/messages$/);
    if (turnMatch && req.method === 'POST') {
      const body = await req.json() as { content?: string; targetNodeId?: string };
      const content = body.content?.trim() ?? '';
      if (!content) return json({ error: 'content is required' }, 400);
      const created = createTurn(turnMatch[1], content, body.targetNodeId);
      void executeRun(created.runId, turnMatch[1], content, body.targetNodeId);
      return json(created);
    }
    const sessionFilesMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/(input|output)$/);
    if (sessionFilesMatch && req.method === 'GET') return json({ files: listSessionFiles(sessionFilesMatch[1], sessionFilesMatch[2] as 'input' | 'output') });
    if (sessionFilesMatch && req.method === 'POST' && sessionFilesMatch[2] === 'input') {
      const form = await req.formData();
      const file = form.get('file');
      if (!(file instanceof File)) return json({ error: 'file is required' }, 400);
      const path = saveSessionUpload(sessionFilesMatch[1], file.name, await file.arrayBuffer());
      const name = path.split('/').pop() ?? file.name;
      return json({ name, url: `/api/sessions/${encodeURIComponent(sessionFilesMatch[1])}/input/${encodeURIComponent(name)}` });
    }
    const sessionFileMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/(input|output)\/([^/]+)$/);
    if (sessionFileMatch && req.method === 'GET') {
      const path = sessionFilePath(sessionFileMatch[1], sessionFileMatch[2] as 'input' | 'output', decodeURIComponent(sessionFileMatch[3]));
      return path ? new Response(Bun.file(path)) : json({ error: 'file not found' }, 404);
    }
    const logsMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/logs$/);
    if (logsMatch && req.method === 'GET') return json({ logs: getLogs(logsMatch[1]) });
    if (url.pathname === '/api/agents/nodes' && req.method === 'POST') {
      const body = await req.json() as { parentId?: string; name?: string; role?: string };
      if (!body.parentId || !body.name?.trim()) return json({ error: 'parentId and name are required' }, 400);
      const typedBody = body as { environmentId?: string; prompt?: string };
      return json({ id: createNode(body.parentId, body.name.trim(), body.role, typedBody.environmentId, typedBody.prompt) });
    }
    if (url.pathname === '/api/environments/import-path' && req.method === 'POST') {
      const body = await req.json() as { sourcePath?: string; name?: string };
      if (!body.sourcePath) return json({ error: 'sourcePath is required' }, 400);
      try { return json(importDirectory(body.sourcePath, body.name)); } catch (error) { return json({ error: error instanceof Error ? error.message : String(error) }, 400); }
    }
    if (url.pathname === '/api/environments/upload' && req.method === 'POST') {
      const form = await req.formData();
      const file = form.get('file');
      if (!(file instanceof File)) return json({ error: 'file is required' }, 400);
      const archivePath = `${config.dataDir}/agent-environments/.tmp/upload-${crypto.randomUUID()}.zip`;
      await Bun.write(archivePath, file);
      const displayName = form.get('name')?.toString() || file.name.replace(/\.(tar\.gz|tgz|zip)$/i, '');
      try { return json(await importArchive(archivePath, displayName)); } catch (error) { return json({ error: error instanceof Error ? error.message : String(error) }, 400); } finally { rmSync(archivePath, { force: true }); }
    }
    if (url.pathname === '/api/environments' && req.method === 'GET') return json(listEnvironments({ search: url.searchParams.get('search') ?? '', page: Number(url.searchParams.get('page') ?? 1), pageSize: Number(url.searchParams.get('pageSize') ?? 24) }));
    const environmentMatch = url.pathname.match(/^\/api\/environments\/([^/]+)$/);
    if (environmentMatch && req.method === 'DELETE') {
      try { return deleteEnvironment(environmentMatch[1]) ? json({ ok: true }) : json({ error: 'environment not found' }, 404); } catch (error) { return json({ error: error instanceof Error ? error.message : String(error) }, 409); }
    }
    if (environmentMatch && req.method === 'GET') {
      try { const archive = await createArchive(environmentMatch[1]); if (!archive) return json({ error: 'environment not found' }, 404); return new Response(Bun.file(archive.path), { headers: { 'Content-Disposition': `attachment; filename="${encodeURIComponent(archive.name)}"`, 'Content-Type': 'application/zip' } }); } catch (error) { return json({ error: error instanceof Error ? error.message : String(error) }, 500); }
    }
    const nodeMatch = url.pathname.match(/^\/api\/agents\/nodes\/([^/]+)$/);
    if (nodeMatch && req.method === 'PATCH') { updateNode(nodeMatch[1], await req.json()); return json({ ok: true }); }
    if (nodeMatch && req.method === 'DELETE') return deleteNode(nodeMatch[1]) ? json({ ok: true }) : json({ error: 'root agent cannot be deleted' }, 400);
    if (url.pathname === '/api/agents/tree' && req.method === 'GET') return json({ tree: getTree() });
    return json({ error: 'Not found' }, 404);
  },
});

console.log(`Rubick API listening on http://localhost:${server.port}`);
