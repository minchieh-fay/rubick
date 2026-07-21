import { db } from '../../database/database';
import { createSessionWorkspace, ensureSessionWorkspace, writeSessionInput, writeSessionOutput } from './session-workspace.service';

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

export function listSessions() {
  const active = db.query(`SELECT id,title,status,waiting_question as waitingQuestion,created_at as createdAt,updated_at as updatedAt
    FROM sessions WHERE deleted_at IS NULL AND status <> 'completed' ORDER BY updated_at DESC LIMIT 100`).all();
  const completed = db.query(`SELECT id,title,status,waiting_question as waitingQuestion,created_at as createdAt,updated_at as updatedAt
    FROM sessions WHERE deleted_at IS NULL AND status='completed' ORDER BY updated_at DESC LIMIT 20`).all();
  return [...active, ...completed];
}

export function createSession(content: string, targetNodeId?: string) {
  const workspace = createSessionWorkspace();
  const sessionId = workspace.sessionId;
  const timestamp = now();
  db.query('INSERT INTO sessions (id,title,status,created_at,updated_at,waiting_question,deleted_at) VALUES (?,?,?,?,?,?,?)').run(sessionId, content.split('\n')[0].slice(0, 80) || '新建任务', 'running', timestamp, timestamp, null, null);
  return { sessionId, ...createTurn(sessionId, content, targetNodeId) };
}

export function createTurn(sessionId: string, content: string, targetNodeId?: string) {
  ensureSessionWorkspace(sessionId);
  const timestamp = now();
  db.query('INSERT INTO messages VALUES (?,?,?,?,?)').run(id('msg'), sessionId, 'user', content, timestamp);
  db.query('UPDATE sessions SET status=?,waiting_question=NULL,updated_at=? WHERE id=? AND deleted_at IS NULL').run('running', timestamp, sessionId);
  const runId = id('run');
  db.query('INSERT INTO runs (id,session_id,node_id,status,input,output,started_at,finished_at,current_agent,current_started_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(runId, sessionId, 'root-orchestrator', 'running', content, null, timestamp, null, null, null);
  writeSessionInput(sessionId, runId, content);
  return { runId };
}

export function getHistory(sessionId: string) {
  return db.query('SELECT role,content FROM messages WHERE session_id=? ORDER BY created_at').all(sessionId) as Array<{ role: string; content: string }>;
}

export function getSession(sessionId: string) {
  ensureSessionWorkspace(sessionId);
  return {
    workspace: { id: sessionId, dataPath: `data/sessions/${sessionId}/data`, inputUrl: `/api/sessions/${encodeURIComponent(sessionId)}/input`, outputUrl: `/api/sessions/${encodeURIComponent(sessionId)}/output` },
    session: db.query('SELECT id,title,status,waiting_question as waitingQuestion,created_at as createdAt,updated_at as updatedAt FROM sessions WHERE id=? AND deleted_at IS NULL').get(sessionId),
    messages: db.query('SELECT id,role,content,created_at as createdAt FROM messages WHERE session_id=? ORDER BY created_at').all(sessionId),
    runs: db.query('SELECT id,node_id as nodeId,status,input,output,started_at as startedAt,finished_at as finishedAt,current_agent as currentAgent,current_started_at as currentStartedAt FROM runs WHERE session_id=? ORDER BY started_at DESC').all(sessionId),
  };
}

export function setWaitingForUser(sessionId: string, runId: string, question: string) {
  const timestamp = now();
  db.query('UPDATE sessions SET status=?,waiting_question=?,updated_at=? WHERE id=?').run('waiting_user', question, timestamp, sessionId);
  db.query('UPDATE runs SET status=?,current_agent=?,finished_at=? WHERE id=?').run('waiting_user', '等待用户', timestamp, runId);
}

export function setSessionStatus(sessionId: string, status: 'paused' | 'cancelled') {
  const timestamp = now();
  db.query('UPDATE sessions SET status=?,updated_at=? WHERE id=? AND deleted_at IS NULL').run(status, timestamp, sessionId);
  db.query("UPDATE runs SET status=?,finished_at=? WHERE session_id=? AND status='running'").run(status, timestamp, sessionId);
}

export function deleteSession(sessionId: string) {
  const timestamp = now();
  db.query('UPDATE sessions SET deleted_at=?,updated_at=? WHERE id=?').run(timestamp, timestamp, sessionId);
}

export function setRunCurrent(runId: string, agentName: string, startedAt = new Date().toISOString()) {
  db.query('UPDATE runs SET current_agent=?,current_started_at=? WHERE id=?').run(agentName, startedAt, runId);
}

export function finishRun(runId: string, sessionId: string, status: 'completed' | 'failed', output: string) {
  const timestamp = now();
  const current = db.query('SELECT status FROM sessions WHERE id=?').get(sessionId) as { status: string } | null;
  if (current?.status === 'waiting_user' || current?.status === 'paused' || current?.status === 'cancelled') return;
  db.query('UPDATE runs SET status=?,output=?,finished_at=? WHERE id=?').run(status, output, timestamp, runId);
  db.query('UPDATE sessions SET status=?,waiting_question=NULL,updated_at=? WHERE id=?').run(status, timestamp, sessionId);
  db.query('INSERT INTO messages VALUES (?,?,?,?,?)').run(id('msg'), sessionId, 'assistant', output, timestamp);
  writeSessionOutput(sessionId, runId, output);
}
