export type TaskStatus = 'inbox' | 'todo' | 'doing' | 'done';

export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  parentId: number | null;
  color: string;
  tags: string[];
  estimatedTime: string;
  actualTime: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  order: number;
  isBlocked: boolean;
  blockReason: string;
}

export interface SubTask {
  id: number;
  taskId: number;
  title: string;
  isCompleted: boolean;
  order: number;
}

export interface Activity {
  id: number;
  taskId: number;
  type: 'ai_message' | 'user_message' | 'status_change' | 'tool_executed';
  content: string;
  createdAt: string;
}

export interface Column {
  id: TaskStatus;
  title: string;
  icon: string;
}

export const COLUMNS: Column[] = [
  { id: 'inbox', title: 'Inbox', icon: '📥' },
  { id: 'todo', title: 'Todo', icon: '🔄' },
  { id: 'doing', title: 'Doing', icon: '🚧' },
  { id: 'done', title: 'Done', icon: '✅' },
];
