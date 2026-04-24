import { join } from "path";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import type { Session, ChatMessage } from "../types";

const DATA_DIR = join(process.cwd(), "data");
const SESSIONS_DIR = join(DATA_DIR, "sessions");

// 确保目录存在
function ensureSessionsDir(): void {
  if (!existsSync(SESSIONS_DIR)) {
    mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

function sessionFilePath(id: string): string {
  return join(SESSIONS_DIR, `${id}.json`);
}

// 保存 session 到文件
function saveSession(session: Session): void {
  ensureSessionsDir();
  writeFileSync(sessionFilePath(session.id), JSON.stringify(session, null, 2));
}

// 从文件加载 session
function loadSession(id: string): Session | undefined {
  const path = sessionFilePath(id);
  if (!existsSync(path)) return undefined;
  const content = readFileSync(path, "utf-8");
  return JSON.parse(content);
}

export function createSession(appName: string): Session {
  const id = Date.now().toString();
  const session: Session = {
    id,
    appName,
    status: "idle",
    formData: {},
    chatMessages: [],
    createdAt: new Date().toISOString(),
  };
  saveSession(session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return loadSession(id);
}

export function getAllSessions(): Session[] {
  ensureSessionsDir();
  const files = readdirSync(SESSIONS_DIR).filter((f) => f.endsWith(".json"));
  return files
    .map((f) => {
      try {
        return loadSession(f.replace(".json", ""));
      } catch {
        return undefined;
      }
    })
    .filter((s): s is Session => s !== undefined)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getAppSessions(appName: string): Session[] {
  return getAllSessions().filter((s) => s.appName === appName);
}

export function updateSession(id: string, updates: Partial<Session>): Session | undefined {
  const session = loadSession(id);
  if (!session) return undefined;
  Object.assign(session, updates);
  saveSession(session);
  return session;
}

export function addChatMessage(id: string, message: Omit<ChatMessage, "id" | "timestamp">): Session | undefined {
  const session = loadSession(id);
  if (!session) return undefined;
  session.chatMessages.push({
    ...message,
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
  });
  saveSession(session);
  return session;
}

export function closeSession(id: string): boolean {
  const path = sessionFilePath(id);
  if (!existsSync(path)) return false;
  unlinkSync(path);
  return true;
}
