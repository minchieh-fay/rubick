import { rmSync } from 'node:fs';
import { config } from './config/env';
import './database/database';
import { getTree, createNode, updateNode, deleteNode } from './modules/agents/agent.service';
import { getRoutingContext, routeInput, routeNode } from './modules/agents/router.service';
import { recordUsage } from './modules/agents/usage.service';
import { isAvailable as isCodexAvailable, runCodex } from './modules/codex/codex.service';
import { isConfigured as isLlmConfigured, runOrchestrator } from './modules/llm/llm.service';
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
    let route = targetNodeId ? routeNode(targetNodeId) : routeInput(input);
    if (targetNodeId && !route) throw new Error('指定的 Agent 不存在或没有可执行环境');
    const history = getHistory(sessionId).map((item) => `${item.role}: ${item.content}`).join('\n');
    const routeHint = route ? `目标 Agent：${route.targetName}\n路由链：${route.path.join(' -> ')}\n工作目录：${route.cwd ?? '未绑定'}\n共享会话数据目录：data/` : '';
    appendLog(runId, 'router', 'info', routeHint || '未命中业务路由，保持总协调 Agent 对话');
    const plan = await runOrchestrator(input, history, routeHint, getRoutingContext());
    appendLog(runId, 'orchestrator', 'info', JSON.stringify(plan, null, 2));
    if (!route && plan.targetNodeId) route = routeNode(plan.targetNodeId);
    if (route && !routeHint) appendLog(runId, 'router', 'info', `语义路由目标：${route.targetName}\n路由链：${route.path.join(' -> ')}\n工作目录：${route.cwd ?? '未绑定'}\n共享会话数据目录：data/`);
    if (!config.runCodex || (!route && !plan.needsExecution)) {
      finishRun(runId, sessionId, 'completed', plan.reply);
      return;
    }
    if (plan.needsExecution && !route && getRoutingContext().some((item) => item.executable)) {
      throw new Error('总协调 Agent 未选择有效的可执行组织节点');
    }
    if (route) {
      for (const step of route.steps) step.cwd = ensureAgentWorkspace(sessionId, step.nodeId, step.cwd);
      route.cwd = route.steps.at(-1)?.cwd ?? route.cwd;
    }
    let codexOutput = '';
    if (route) {
      for (let index = 0; index < route.steps.length; index += 1) {
        const step = route.steps[index];
        setRunCurrent(runId, step.name);
        const isLeaf = index === route.steps.length - 1;
        const prompt = isLeaf
          ? `${plan.executionPrompt || input}\n\n请严格按照当前工作目录中的 AGENTS.md 执行。本次 Session 的共享数据目录是当前工作目录下的 data/；用户输入位于 data/input/，所有需要让用户访问的最终文件必须写入 data/output/。`
          : `用户需求：${input}\n\n你是组织链中的 ${step.name}。请根据当前目录中的 AGENTS.md 判断应该把任务交给哪个下级 Agent，并返回简短的调度确认，不要直接解决最终问题。`;
        const promptWithOverride = step.prompt ? `${prompt}\n\n节点附加提示词：\n${step.prompt}` : prompt;
        if (step.environmentId) recordUsage(sessionId, runId, step.nodeId, step.environmentId);
        const stepOutput = await runCodex(promptWithOverride, (level, content) => appendLog(runId, `codex:${step.name}`, level, content), step.cwd ?? undefined);
        if (isLeaf) codexOutput = stepOutput;
      }
    } else if (plan.needsExecution) {
      codexOutput = await runCodex(
        `${plan.executionPrompt || input}\n\n请严格按照当前工作目录中的 AGENTS.md 执行。`,
        (level, content) => appendLog(runId, 'codex:总协调 Agent', level, content),
      );
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
