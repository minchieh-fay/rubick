import type { Session, ChatMessage } from "../types";

// Session 存储（内存，后续可持久化）
const sessions: Map<string, Session> = new Map();

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
  sessions.set(id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function getAllSessions(): Session[] {
  return Array.from(sessions.values());
}

export function getAppSessions(appName: string): Session[] {
  return getAllSessions().filter((s) => s.appName === appName);
}

export function updateSession(id: string, updates: Partial<Session>): Session | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;
  Object.assign(session, updates);
  return session;
}

export function addChatMessage(id: string, message: Omit<ChatMessage, "id" | "timestamp">): Session | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;
  session.chatMessages.push({
    ...message,
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
  });
  return session;
}

export function closeSession(id: string): boolean {
  return sessions.delete(id);
}
