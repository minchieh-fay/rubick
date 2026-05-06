import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { streamSSE } from "hono/streaming";
import * as hub from "./services/hub";
import * as generator from "./services/generator";
import * as developer from "./services/developer";

const app = new Hono();

// CORS for dev
app.use("/*", cors());

// Static files for frontend
app.use("/*", serveStatic({ root: "./public" }));

// ========== API Routes ==========

// 从 hub 获取 app/skill/mcp 列表
app.get("/api/hub/apps", async (c) => {
  const apps = await hub.fetchApps();
  return c.json(apps);
});

app.get("/api/hub/skills", async (c) => {
  const skills = await hub.fetchSkills();
  return c.json(skills);
});

app.get("/api/hub/mcps", async (c) => {
  const mcps = await hub.fetchMcps();
  return c.json(mcps);
});

// 生成 app（SSE 流式输出）
app.post("/api/generate", async (c) => {
  const { prompt, skills, mcps } = await c.req.json();

  if (!prompt?.trim()) {
    return c.json({ error: "Prompt is required" }, 400);
  }

  return streamSSE(c, async (stream) => {
    try {
      const result = await generator.generateApp(prompt, undefined, (chunk) => {
        stream.writeSSE({ data: JSON.stringify({ type: "chunk", content: chunk }) });
      }, skills, mcps);

      stream.writeSSE({
        data: JSON.stringify({
          type: "done",
          success: result.success,
          output: result.output,
          sessionDir: result.sessionDir,
        }),
      });
    } catch (err) {
      stream.writeSSE({
        data: JSON.stringify({ type: "error", error: (err as Error).message }),
      });
    }
  });
});

// 预览生成的 app
app.get("/api/preview/:sessionDir/*", async (c) => {
  const sessionDir = c.req.param("sessionDir");
  const filePath = c.req.param("*") ?? "";
  return generator.serveFile(sessionDir, filePath, c);
});

// 获取已生成的 app 列表
app.get("/api/apps", async (c) => {
  const apps = generator.getGeneratedApps();
  return c.json(apps);
});

// 获取 app 的 manifest
app.get("/api/apps/:name/manifest", async (c) => {
  const name = c.req.param("name");
  const manifest = await generator.readAppManifest(name);
  if (!manifest) {
    return c.json({ error: "App not found" }, 404);
  }
  return c.json(manifest);
});

// 上传 app 到 hub
app.post("/api/apps/:name/upload", async (c) => {
  const name = c.req.param("name");
  const { developerName, developerEmail } = await c.req.json();

  try {
    const result = await generator.uploadApp(name, developerName, developerEmail);
    return c.json(result);
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 开发者信息管理
app.get("/api/developers", async (c) => {
  const dev = await developer.getDeveloper();
  if (!dev) {
    return c.json(null);
  }
  return c.json(dev);
});

app.post("/api/developers", async (c) => {
  const { name, email } = await c.req.json();
  if (!name?.trim()) {
    return c.json({ error: "Name is required" }, 400);
  }
  const info = { name: name.trim(), email: (email || "").trim() };
  await developer.saveDeveloper(info);
  return c.json(info);
});

// ========== Start Server ==========

const port = 3002;

console.log(`rubicktool server running on http://localhost:${port}`);

const server = Bun.serve({
  port,
  fetch: app.fetch,
});

export default server;
