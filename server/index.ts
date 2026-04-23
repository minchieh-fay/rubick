import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { toolRegistry } from '../core/loader/registry';
import { loadToolsFromDirectories } from '../core/loader/loader';
import tasksApi from './api/tasks';
import agentApi from './api/agent';

const app = new Hono();

// CORS for frontend development
app.use('/*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}));

// Load builtin and custom tools on startup
await loadToolsFromDirectories({
  directories: ['builtin/tools', 'custom/tools'],
});

// Health check
app.get('/api/health', (c) => {
  return c.json({ 
    status: 'ok', 
    tools: toolRegistry.list().length,
    timestamp: new Date().toISOString(),
  });
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

// Mount API routes
app.route('/api', tasksApi);
app.route('/api/agent', agentApi);

const port = 3000;
console.log(`Server running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
