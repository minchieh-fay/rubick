import { Hono } from 'hono';
import { createAIClient } from '../../core/ai/client';
import { taskQueries, subtaskQueries, activityQueries, toolMetaQueries } from '../db/index';
import { executeTool, getAvailableTools, isToolAvailable } from '../../core/executor/index';

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
    const missingTools = analysis.requiredTools.filter(t => !isToolAvailable(t));
    if (missingTools.length > 0) {
      activityQueries.insert(mainTaskId, 'ai_message',
        `Missing tools: ${missingTools.join(', ')}. These need to be developed.`);
    }
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

/**
 * POST /api/agent/tool
 * 
 * Execute a specific tool by name
 */
app.post('/tool', async (c) => {
  const { toolName, args, context, taskId } = await c.req.json();
  
  if (!toolName) {
    return c.json({ error: 'toolName is required' }, 400);
  }

  // Log tool start
  if (taskId) {
    activityQueries.insert(taskId, 'tool_start', `Executing tool: ${toolName}`);
  }

  // Execute the tool
  const result = await executeTool(toolName, args || [], context);

  // Log tool result
  if (taskId) {
    if (result.success) {
      activityQueries.insert(taskId, 'tool_success', `Tool ${toolName} succeeded`);
      // Increment usage count
      toolMetaQueries.incrementUsage(toolName);
    } else {
      activityQueries.insert(taskId, 'tool_error', `Tool ${toolName} failed: ${result.stderr}`);
    }
  }

  return c.json({
    success: result.success,
    output: result.stdout,
    error: result.stderr,
    exitCode: result.exitCode,
  });
});

/**
 * GET /api/agent/tools
 * 
 * List all available tools
 */
app.get('/tools', (c) => {
  const tools = getAvailableTools();
  return c.json({
    count: tools.length,
    tools: tools.map(t => ({
      name: t.name,
      description: t.description,
      version: t.version,
    })),
  });
});

/**
 * POST /api/agent/auto-execute
 * 
 * Automatically execute all subtasks of a task in sequence
 * This is the core AI automation loop
 */
app.post('/auto-execute', async (c) => {
  const { taskId } = await c.req.json();
  
  const task = taskQueries.getById(taskId);
  if (!task) {
    return c.json({ error: 'Task not found' }, 404);
  }

  const subtasks = subtaskQueries.getByTaskId(taskId);
  if (!subtasks || subtasks.length === 0) {
    return c.json({ error: 'No subtasks to execute' }, 400);
  }

  // Mark main task as doing
  taskQueries.updateStatus(taskId, 'doing');
  activityQueries.insert(taskId, 'status_change', 'Auto-execution started');

  const results: Array<{ subtaskId: number; success: boolean; output: string; error: string }> = [];

  for (const subtask of subtasks as Array<{ id: number; title: string; is_completed: number }>) {
    // Mark subtask as doing (via activity)
    activityQueries.insert(taskId, 'subtask_start', `Starting: ${subtask.title}`);

    try {
      // Execute with AI
      const prompt = `Task: ${task.title}\nSubtask: ${subtask.title}\n\nPlease execute this subtask and provide the result.`;
      const result = await aiClient.execute(prompt);

      results.push({
        subtaskId: subtask.id,
        success: result.success,
        output: result.text || '',
        error: result.error || '',
      });

      if (result.success) {
        activityQueries.insert(taskId, 'subtask_success', `${subtask.title} completed`);
      } else {
        activityQueries.insert(taskId, 'subtask_error', `${subtask.title} failed: ${result.error}`);
      }
    } catch (error) {
      results.push({
        subtaskId: subtask.id,
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      });
      activityQueries.insert(taskId, 'subtask_error', `${subtask.title} exception: ${error}`);
    }
  }

  // Check if all succeeded
  const allSuccess = results.every(r => r.success);
  if (allSuccess) {
    taskQueries.markCompleted(taskId);
    activityQueries.insert(taskId, 'status_change', 'Auto-execution completed');
  } else {
    taskQueries.updateStatus(taskId, 'todo');
    activityQueries.insert(taskId, 'status_change', 'Auto-execution failed - some subtasks failed');
  }

  return c.json({
    taskId,
    status: allSuccess ? 'completed' : 'failed',
    results,
  });
});

export default app;
