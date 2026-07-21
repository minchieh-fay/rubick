import { rmSync } from 'node:fs';
import { config } from './config/env';
import './database/database';
import { getTree, createNode, updateNode, deleteNode } from './modules/agents/agent.service';
import { isAvailable as isCodexAvailable } from './modules/codex/codex.service';
import { isConfigured as isLlmConfigured, runRuntimeAgent } from './modules/llm/llm.service';
import { createSession, createTurn, deleteSession, finishRun, getHistory, getSession, listSessions, setRunCurrent, setSessionStatus } from './modules/sessions/session.service';
import { createArchive, deleteEnvironment, importArchive, importDirectory, listEnvironments } from './modules/environments/environment.service';
import { appendLog, getLogs } from './modules/runs/run-log.service';
import { listSessionFiles, saveSessionUpload, sessionFilePath } from './modules/sessions/session-workspace.service';

const json = (data: unknown, status = 200) => Response.json(data, {
  status,
  headers: { 'Access-Control-Allow-Origin': '*' },
});

const runControllers = new Map<string, AbortController>();

async function executeRun(runId: string, sessionId: string, input: string, targetNodeId?: string, controller = new AbortController()) {
  runControllers.set(sessionId, controller);
  try {
    setRunCurrent(runId, '总协调 Agent');
    appendLog(runId, 'orchestrator', 'info', `收到用户请求：\n${input}`);
    const history = getHistory(sessionId).map((item) => `${item.role}: ${item.content}`).join('\n');
    const result = await runRuntimeAgent(input, history, { runId, sessionId, signal: controller.signal }, targetNodeId);
    const currentSession = getSession(sessionId).session as { status?: string } | null;
    if (currentSession?.status === 'waiting_user' || currentSession?.status === 'paused' || currentSession?.status === 'cancelled') return;
    setRunCurrent(runId, result.currentAgent);
    appendLog(runId, 'orchestrator', 'info', `SDK Agent 运行完成：${result.currentAgent}`);
    finishRun(runId, sessionId, 'completed', result.output);
  } catch (error) {
    const currentSession = getSession(sessionId).session as { status?: string } | null;
    if (currentSession?.status === 'waiting_user' || currentSession?.status === 'paused' || currentSession?.status === 'cancelled' || controller.signal.aborted) return;
    const message = `执行失败：${error instanceof Error ? error.message : String(error)}`;
    appendLog(runId, 'runtime', 'error', message);
    finishRun(runId, sessionId, 'failed', message);
  } finally {
    runControllers.delete(sessionId);
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
      const environmentPage = listEnvironments({ search: url.searchParams.get('environmentSearch') ?? '', page: 1, pageSize: 24 });
      return json({ tree: getTree(), environments: environmentPage.items, environmentsMeta: environmentPage, sessions: listSessions(), codexBin: config.codexBin, codexAvailable: isCodexAvailable(), llmConfigured: isLlmConfigured(), llmModel: config.llmModel });
    }
    if (url.pathname === '/api/sessions' && req.method === 'POST') {
      const body = await req.json() as { content?: string; targetNodeId?: string; templateId?: string };
      const content = body.content?.trim() ?? '';
      if (!content) return json({ error: 'content is required' }, 400);
      if (body.templateId && /\{[^{}]+\}/.test(content)) return json({ error: '模板变量尚未填写完整' }, 422);
      const created = createSession(content, body.targetNodeId);
      void executeRun(created.runId, created.sessionId, content, body.targetNodeId);
      return json(created);
    }
    const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
    if (sessionMatch && req.method === 'GET') return json(getSession(sessionMatch[1]));
    const turnMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/messages$/);
    if (turnMatch && req.method === 'POST') {
      const body = await req.json() as { content?: string; targetNodeId?: string; templateId?: string };
      const content = body.content?.trim() ?? '';
      if (!content) return json({ error: 'content is required' }, 400);
      if (body.templateId && /\{[^{}]+\}/.test(content)) return json({ error: '模板变量尚未填写完整' }, 422);
      const created = createTurn(turnMatch[1], content, body.targetNodeId);
      void executeRun(created.runId, turnMatch[1], content, body.targetNodeId);
      return json(created);
    }
    const resumeMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/resume$/);
    if (resumeMatch && req.method === 'POST') {
      const body = await req.json() as { content?: string };
      const content = body.content?.trim() ?? '';
      if (!content) return json({ error: 'content is required' }, 400);
      const created = createTurn(resumeMatch[1], content);
      void executeRun(created.runId, resumeMatch[1], content);
      return json(created);
    }
    const statusMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/(pause|cancel)$/);
    if (statusMatch && req.method === 'POST') {
      const controller = runControllers.get(statusMatch[1]);
      controller?.abort();
      setSessionStatus(statusMatch[1], statusMatch[2] === 'pause' ? 'paused' : 'cancelled');
      return json({ ok: true, status: statusMatch[2] === 'pause' ? 'paused' : 'cancelled' });
    }
    const deleteSessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
    if (deleteSessionMatch && req.method === 'DELETE') {
      runControllers.get(deleteSessionMatch[1])?.abort();
      deleteSession(deleteSessionMatch[1]);
      return json({ ok: true });
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
