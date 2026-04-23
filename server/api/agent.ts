import { Hono } from 'hono';
import { createAIClient } from '../../core/ai/client';
import { taskQueries, subtaskQueries, activityQueries } from '../db/index';

const app = new Hono();
const aiClient = createAIClient();

/**
 * POST /api/agent/analyze
 * 
 * User sends a request, AI analyzes and creates task with subtasks
 */
app.post('/analyze', async (c) => {
  const { message } = await c.req.json();
  
  if (!message) {
    return c.json({ error: 'Message is required' }, 400);
  }

  // Step 1: Analyze the request
  const analysis = await aiClient.analyzeTask(message);

  // Step 2: If not clear, return questions
  if (!analysis.isClear) {
    return c.json({
      needsClarification: true,
      questions: analysis.questions,
    });
  }

  // Step 3: Create main task
  const color = `hsl(${Math.random() * 360}, 70%, 60%)`;
  const mainTaskResult = taskQueries.insert(
    analysis.title || message.slice(0, 50),
    analysis.description || message,
    'inbox',
    null,
    color,
    analysis.tags || ['ai-generated'],
    analysis.estimatedTime || ''
  );
  const mainTaskId = mainTaskResult.lastInsertRowid as number;

  // Step 4: Create subtasks
  const subtaskIds: number[] = [];
  if (analysis.subtasks && analysis.subtasks.length > 0) {
    for (let i = 0; i < analysis.subtasks.length; i++) {
      const sub = analysis.subtasks[i];
      const result = subtaskQueries.insert(mainTaskId, sub.title, i);
      subtaskIds.push(result.lastInsertRowid as number);
    }
  }

  // Step 5: Log activity
  activityQueries.insert(mainTaskId, 'ai_message', 
    `Task analyzed. Created ${subtaskIds.length} subtasks.`);

  // Step 6: Check for missing tools
  if (analysis.needsNewTools && analysis.requiredTools && analysis.requiredTools.length > 0) {
    activityQueries.insert(mainTaskId, 'ai_message',
      `Missing tools: ${analysis.requiredTools.join(', ')}. These need to be developed.`);
  }

  // Step 7: Get the created task
  const task = taskQueries.getById(mainTaskId);
  const subtasks = subtaskQueries.getByTaskId(mainTaskId);

  return c.json({
    needsClarification: false,
    task,
    subtasks,
    analysis,
  });
});

/**
 * POST /api/agent/execute
 * 
 * Execute a specific task/subtask using AI
 */
app.post('/execute', async (c) => {
  const { taskId, context } = await c.req.json();
  
  const task = taskQueries.getById(taskId);
  if (!task) {
    return c.json({ error: 'Task not found' }, 404);
  }

  // Mark as doing
  taskQueries.updateStatus(taskId, 'doing');
  activityQueries.insert(taskId, 'status_change', 'Status changed to doing');

  // Execute with AI
  const prompt = `Task: ${task.title}\nDescription: ${task.description}\nContext: ${context || ''}\n\nPlease execute this task and provide the result.`;
  const result = await aiClient.execute(prompt);

  // Log result
  if (result.success) {
    activityQueries.insert(taskId, 'ai_message', result.text);
    taskQueries.markCompleted(taskId);
    activityQueries.insert(taskId, 'status_change', 'Status changed to done');
  } else {
    activityQueries.insert(taskId, 'ai_message', `Failed: ${result.error}`);
    taskQueries.updateStatus(taskId, 'todo');
  }

  return c.json({
    success: result.success,
    output: result.text,
    error: result.error,
  });
});

export default app;
