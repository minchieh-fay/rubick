/**
 * Prompt Templates for AI
 * Centralized management of all prompts sent to AI
 */

export const PROMPTS = {
  /**
   * Task Analysis Prompt
   * Used to analyze user input and break down into subtasks
   */
  analyzeTask: (userInput: string): string => `
You are a task analyzer for a personal AI assistant workspace.
Your job is to analyze the user's request and break it down into clear, actionable subtasks.

User request: "${userInput}"

Please respond in the following JSON format (only JSON, no additional text):
{
  "isClear": true/false,
  "questions": ["clarifying question 1", ...] or [],
  "title": "extracted task title",
  "description": "detailed description",
  "subtasks": [{"title": "subtask 1", "description": "..."}, ...],
  "estimatedTime": "estimated time like 2h or 30m",
  "tags": ["tag1", "tag2"],
  "needsNewTools": true/false,
  "requiredTools": ["tool1", ...]
}

Rules:
- If the request is vague, set isClear to false and provide clarifying questions
- Subtasks should be atomic and actionable
- Order subtasks logically
- Estimate time realistically
- Suggest relevant tags (max 3)
- Identify if new tools are needed
`,

  /**
   * Task Execution Prompt
   * Used when AI needs to execute a specific subtask
   */
  executeTask: (taskTitle: string, taskDescription: string, context: string): string => `
You are executing a task.

Task: ${taskTitle}
Description: ${taskDescription}
Context: ${context}

Please provide step-by-step instructions or code to complete this task.
Be specific and actionable.
`,

  /**
   * Tool Missing Prompt
   * Used when AI identifies a missing tool
   */
  toolMissing: (taskTitle: string, toolName: string, purpose: string): string => `
A task cannot proceed because a required tool is missing.

Task: ${taskTitle}
Missing Tool: ${toolName}
Purpose: ${purpose}

Please explain to the user what tool is needed and why.
Suggest whether the AI should try to build this tool automatically.
`,
};

export default PROMPTS;
