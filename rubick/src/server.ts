import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import * as hub from "./services/hub";
import * as sessionService from "./services/session";
import * as appService from "./services/app_help";
import * as executor from "./services/executor";
import type { AppInfo } from "./types";

const app = new Hono();

// CORS for dev
app.use("/*", cors());

// Static files for frontend
app.use("/*", serveStatic({ root: "./public" }));

// ========== API Routes ==========

// App 列表（合并 hub 列表和本地安装状态）
app.get("/api/apps", async (c) => {
  const hubApps = await hub.fetchApps();
  const installedApps = appService.getInstalledApps();

  const merged: AppInfo[] = hubApps.map((h) => ({
    ...h,
    installed: installedApps.includes(h.name),
  }));

  return c.json(merged);
});

// 已安装的 app 列表（本地）
app.get("/api/apps/installed", (c) => {
  const installed = appService.getInstalledApps();
  return c.json(installed);
});

// 安装 app
app.post("/api/apps/install", async (c) => {
  const { fileName } = await c.req.json();
  try {
    const blob = await hub.downloadPackage(fileName);
    const appDir = await appService.installApp(fileName, blob);
    return c.json({ success: true, dir: appDir });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 获取 app 的 manifest
app.get("/api/apps/:name/manifest", async (c) => {
  const name = c.req.param("name");
  const manifest = await appService.readAppManifest(name);
  if (!manifest) {
    return c.json({ error: "App not found" }, 404);
  }
  return c.json(manifest);
});

// ========== Session API ==========

app.post("/api/sessions", async (c) => {
  const { appName } = await c.req.json();
  const session = sessionService.createSession(appName);
  return c.json(session);
});

app.get("/api/sessions", (c) => {
  return c.json(sessionService.getAllSessions());
});

app.get("/api/sessions/:id", (c) => {
  const id = c.req.param("id");
  const session = sessionService.getSession(id);
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }
  return c.json(session);
});

app.get("/api/sessions/app/:appName", (c) => {
  const appName = c.req.param("appName");
  return c.json(sessionService.getAppSessions(appName));
});

app.patch("/api/sessions/:id", async (c) => {
  const id = c.req.param("id");
  const updates = await c.req.json();
  const session = sessionService.updateSession(id, updates);
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }
  return c.json(session);
});

app.post("/api/sessions/:id/messages", async (c) => {
  const id = c.req.param("id");
  const { role, content } = await c.req.json();
  const session = sessionService.addChatMessage(id, { role, content });
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }
  return c.json(session);
});

app.delete("/api/sessions/:id", (c) => {
  const id = c.req.param("id");
  const deleted = sessionService.closeSession(id);
  return c.json({ success: deleted });
});

// 执行 session
app.post("/api/sessions/:id/execute", async (c) => {
  const id = c.req.param("id");
  const session = sessionService.getSession(id);
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  // 标记为 running
  sessionService.updateSession(id, {
    status: "running",
    startedAt: new Date().toISOString(),
  });

  try {
    const result = await executor.executeSession(session);
    sessionService.updateSession(id, {
      status: result.success ? "completed" : "error",
      result: result.output,
      completedAt: new Date().toISOString(),
    });

    // 上报使用统计
    await hub.reportUsage(session.appName);

    return c.json(result);
  } catch (err) {
    sessionService.updateSession(id, {
      status: "error",
      errorMessage: (err as Error).message,
      completedAt: new Date().toISOString(),
    });
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Hub proxy routes（前端直接请求可能会跨域，通过后端转发）
app.get("/api/hub/apps", async (c) => {
  const apps = await hub.fetchApps();
  return c.json(apps);
});

// 检查 rubick 自身更新
app.get("/api/self-update", async (c) => {
  try {
    const update = await hub.checkRubickUpdate();
    return c.json(update);
  } catch {
    return c.json(null);
  }
});

// ========== Start Server ==========

const port = 3001;
console.log(`rubick server running on http://localhost:${port}`);

export default { port, fetch: app.fetch };
