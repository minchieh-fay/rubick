import { Hono } from 'hono';
import { toolRegistry } from '../core/loader/registry';
import { loadToolsFromDirectories } from '../core/loader/loader';

const app = new Hono();

// Load builtin and custom tools on startup
await loadToolsFromDirectories({
  directories: ['builtin/tools', 'custom/tools'],
});

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', tools: toolRegistry.list().length });
});

// List all available tools
app.get('/api/tools', (c) => {
  const tools = toolRegistry.list().map((t) => ({
    name: t.name,
    description: t.description,
    version: t.version,
  }));
  return c.json({ tools });
});

// Execute a tool
app.post('/api/tools/:name/execute', async (c) => {
  const { name } = c.req.param();
  const body = await c.req.json();
  const { args = [], context = {} } = body;
  
  const tool = toolRegistry.get(name);
  if (!tool) {
    return c.json({ error: `Tool "${name}" not found` }, 404);
  }
  
  const result = await tool.execute(args, context);
  return c.json(result);
});

const port = 3000;
console.log(`Server running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
