import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";

// --- Config ---
const appDir = process.argv[2];
if (!appDir) {
  console.error("Usage: bun index.ts <app-directory>");
  process.exit(1);
}

const resolvedAppDir = resolve(appDir);
if (!existsSync(resolvedAppDir)) {
  console.error(`App directory not found: ${resolvedAppDir}`);
  process.exit(1);
}

const PORT = parseInt(process.env.PORT || "3000", 10);

// --- Hono App ---
const app = new Hono();

// --- Built-in API Routes ---

// 1. LLM Call (wraps qodercli abstractly)
app.post("/api/llm/run", async (c) => {
  try {
    const { prompt } = await c.req.json();
    if (!prompt) {
      return c.json({ error: "prompt is required" }, 400);
    }

    // Execute qodercli with the prompt
    const result = await Bun.spawn([
      "qodercli",
      "--model", "ultimate",
      "--dangerously-skip-permissions",
      "-p", prompt,
      "-w", resolvedAppDir,
    ], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(result.stdout).text();
    const stderr = await new Response(result.stderr).text();

    if (result.exitCode !== 0) {
      return c.json({ error: stderr || stdout }, 500);
    }

    return c.json({ result: stdout });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: `LLM call failed: ${message}` }, 500);
  }
});

// 2. File Read
app.get("/api/fs/read", async (c) => {
  try {
    const filePath = c.req.query("path");
    if (!filePath) {
      return c.json({ error: "path query param is required" }, 400);
    }
    const fullPath = join(resolvedAppDir, filePath);
    if (!fullPath.startsWith(resolvedAppDir)) {
      return c.json({ error: "access denied: path outside app directory" }, 403);
    }
    const content = readFileSync(fullPath, "utf-8");
    return c.json({ content });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

// 3. File Write
app.post("/api/fs/write", async (c) => {
  try {
    const { path: filePath, content } = await c.req.json();
    if (!filePath) {
      return c.json({ error: "path is required" }, 400);
    }
    const fullPath = join(resolvedAppDir, filePath);
    if (!fullPath.startsWith(resolvedAppDir)) {
      return c.json({ error: "access denied: path outside app directory" }, 403);
    }
    writeFileSync(fullPath, content ?? "", "utf-8");
    return c.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

// 4. State Persistence (last.json)
app.get("/api/state", (c) => {
  try {
    const statePath = join(resolvedAppDir, "last.json");
    if (!existsSync(statePath)) {
      return c.json({ state: null });
    }
    const state = JSON.parse(readFileSync(statePath, "utf-8"));
    return c.json({ state });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

app.post("/api/state", async (c) => {
  try {
    const { state } = await c.req.json();
    const statePath = join(resolvedAppDir, "last.json");
    writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
    return c.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

// 5. HTTP Request proxy
app.post("/api/http/request", async (c) => {
  try {
    const { url, method = "GET", headers, body } = await c.req.json();
    if (!url) {
      return c.json({ error: "url is required" }, 400);
    }
    const res = await fetch(url, {
      method,
      headers: headers as Record<string, string>,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.text();
    return c.json({ status: res.status, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

// --- Backend/ Directory Loading ---
async function loadBackend(backendDir: string, honoApp: Hono): Promise<void> {
  const indexPath = join(backendDir, "index.ts");

  if (!existsSync(indexPath)) {
    console.log("[backend] No backend/index.ts found, skipping custom routes");
    return;
  }

  try {
    // Dynamic import of the backend module
    const modulePath = `file://${indexPath}`;
    const mod = await import(modulePath);

    if (typeof mod.default !== "function") {
      console.error("[backend] Error: backend/index.ts must export a default function");
      return;
    }

    // Create a scoped router under /api/backend prefix
    const backendRouter = new Hono();
    mod.default(backendRouter);
    honoApp.route("/api/backend", backendRouter);

    console.log("[backend] Successfully loaded backend/index.ts");
    console.log("[backend] Custom routes registered under /api/backend/*");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[backend] Failed to load backend/index.ts: ${message}`);
  }
}

// --- Static File Serving ---
// Serve index.html and other static files from app directory
app.get("/*", serveStatic({ root: resolvedAppDir }));

// --- Start Server ---
async function main() {
  // Load backend routes before starting
  const backendDir = join(resolvedAppDir, "backend");
  await loadBackend(backendDir, app);

  console.log(`[rubick-createapp] Serving app: ${resolvedAppDir}`);
  console.log(`[rubick-createapp] Server running on http://localhost:${PORT}`);

  // Start the HTTP server
  const server = Bun.serve({
    port: PORT,
    fetch: app.fetch,
  });

  // Open browser
  try {
    Bun.spawn(["open", `http://localhost:${PORT}`]);
  } catch {
    // Ignore if open command fails
  }

  // Keep the process alive
  await new Promise(() => {});
}

main();
