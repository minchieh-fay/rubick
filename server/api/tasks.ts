import { Hono } from 'hono';
import { taskQueries, subtaskQueries, activityQueries } from '../db/index';

const app = new Hono();

// Get all tasks (no parent)
app.get('/tasks', (c) => {
  const tasks = taskQueries.getAll();
  return c.json({ tasks });
});

// Get tasks by status
app.get('/tasks/status/:status', (c) => {
  const status = c.req.param('status');
  const tasks = taskQueries.getByStatus(status);
  return c.json({ tasks });
});

// Get single task with subtasks and activities
app.get('/tasks/:id', (c) => {
  const id = parseInt(c.req.param('id'));
  const task = taskQueries.getById(id);
  
  if (!task) {
    return c.json({ error: 'Task not found' }, 404);
  }
  
  const subtasks = subtaskQueries.getByTaskId(id);
  const activities = activityQueries.getByTaskId(id);
  
  return c.json({ task, subtasks, activities });
});

// Create task
app.post('/tasks', async (c) => {
  const body = await c.req.json();
  const {
    title,
    description = '',
    status = 'inbox',
    parentId = null,
    color = '#8b5cf6',
    tags = [],
    estimatedTime = '',
    subtasks = [],
  } = body;
  
  if (!title) {
    return c.json({ error: 'Title is required' }, 400);
  }
  
  // Get next order number
  const maxOrder = taskQueries.getNextOrder(status);
  const nextOrder = (maxOrder?.maxOrder ?? -1) + 1;
  
  const result = taskQueries.insert(title, description, status, parentId, color, tags, estimatedTime);
  const taskId = result.lastInsertRowid as number;
  
  // Create subtasks if provided
  if (subtasks.length > 0) {
    for (let i = 0; i < subtasks.length; i++) {
      subtaskQueries.insert(taskId, subtasks[i].title || subtasks[i], i);
    }
  }
  
  // Log activity
  activityQueries.insert(taskId, 'user_message', `Task created: ${title}`);
  
  return c.json({ 
    id: taskId, 
    title, 
    description, 
    status, 
    parentId, 
    color, 
    tags, 
    estimatedTime,
    order: nextOrder,
  }, 201);
});

// Update task
app.patch('/tasks/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const body = await c.req.json();
  
  const { status } = body;
  
  const existing = taskQueries.getById(id);
  if (!existing) {
    return c.json({ error: 'Task not found' }, 404);
  }
  
  // Update status if provided
  if (status) {
    taskQueries.updateStatus(id, status);
    activityQueries.insert(id, 'status_change', `Status changed to ${status}`);
    
    // Mark completed if status changed to done
    if (status === 'done' && existing.status !== 'done') {
      taskQueries.markCompleted(id);
    }
  }
  
  return c.json({ success: true });
});

// Move task (update status)
app.post('/tasks/:id/move', async (c) => {
  const id = parseInt(c.req.param('id'));
  const { status } = await c.req.json();
  
  if (!['inbox', 'todo', 'doing', 'done'].includes(status)) {
    return c.json({ error: 'Invalid status' }, 400);
  }
  
  const existing = taskQueries.getById(id);
  if (!existing) {
    return c.json({ error: 'Task not found' }, 404);
  }
  
  taskQueries.updateStatus(id, status);
  activityQueries.insert(id, 'status_change', `Status changed to ${status}`);
  
  return c.json({ success: true });
});

// Delete task
app.delete('/tasks/:id', (c) => {
  const id = parseInt(c.req.param('id'));
  
  const existing = taskQueries.getById(id);
  if (!existing) {
    return c.json({ error: 'Task not found' }, 404);
  }
  
  taskQueries.delete(id);
  return c.json({ success: true });
});

// Subtask routes
app.post('/tasks/:taskId/subtasks', async (c) => {
  const taskId = parseInt(c.req.param('taskId'));
  const { title, order } = await c.req.json();
  
  if (!title) {
    return c.json({ error: 'Title is required' }, 400);
  }
  
  const maxOrder = subtaskQueries.getByTaskId(taskId);
  const nextOrder = order ?? maxOrder.length;
  
  const result = subtaskQueries.insert(taskId, title, nextOrder);
  return c.json({ id: result.lastInsertRowid, taskId, title, order: nextOrder }, 201);
});

app.post('/tasks/:taskId/subtasks/:subtaskId/toggle', (c) => {
  const subtaskId = parseInt(c.req.param('subtaskId'));
  subtaskQueries.toggle(subtaskId);
  return c.json({ success: true });
});

// Activity routes
app.get('/tasks/:taskId/activities', (c) => {
  const taskId = parseInt(c.req.param('taskId'));
  const activities = activityQueries.getByTaskId(taskId);
  return c.json({ activities });
});

app.post('/tasks/:taskId/activities', async (c) => {
  const taskId = parseInt(c.req.param('taskId'));
  const { type, content } = await c.req.json();
  
  if (!type || !content) {
    return c.json({ error: 'Type and content are required' }, 400);
  }
  
  const result = activityQueries.insert(taskId, type, content);
  return c.json({ id: result.lastInsertRowid, type, content }, 201);
});

export default app;
