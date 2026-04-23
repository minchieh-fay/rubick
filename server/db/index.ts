import { Database } from 'bun:sqlite';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '../../data');
mkdirSync(dataDir, { recursive: true });

const db = new Database(join(dataDir, 'rubick.db'));

// Initialize schema
db.run(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'inbox',
    parent_id INTEGER,
    color TEXT DEFAULT '#8b5cf6',
    tags TEXT DEFAULT '[]',
    estimated_time TEXT DEFAULT '',
    actual_time TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    "order" INTEGER DEFAULT 0,
    is_blocked INTEGER DEFAULT 0,
    block_reason TEXT DEFAULT '',
    FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE CASCADE
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    is_completed INTEGER DEFAULT 0,
    "order" INTEGER DEFAULT 0,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS tool_meta (
    name TEXT PRIMARY KEY,
    description TEXT DEFAULT '',
    source TEXT DEFAULT 'custom',
    usage_count INTEGER DEFAULT 0,
    last_used TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

// Helper to convert task row to frontend format
function toTask(task: any) {
  return {
    ...task,
    tags: JSON.parse(task.tags),
    isBlocked: !!task.is_blocked,
    blockReason: task.block_reason,
    parentId: task.parent_id,
    estimatedTime: task.estimated_time,
    actualTime: task.actual_time,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    completedAt: task.completed_at,
  };
}

// Task queries
export const taskQueries = {
  getAll: () => {
    const stmt = db.query('SELECT * FROM tasks WHERE parent_id IS NULL ORDER BY "order" ASC, created_at DESC');
    return stmt.all().map(toTask);
  },
  
  getById: (id: number) => {
    const stmt = db.query('SELECT * FROM tasks WHERE id = ?');
    const task = stmt.get(id);
    return task ? toTask(task) : null;
  },
  
  getByStatus: (status: string) => {
    const stmt = db.query('SELECT * FROM tasks WHERE status = ? AND parent_id IS NULL ORDER BY "order" ASC');
    return stmt.all(status).map(toTask);
  },
  
  getByParent: (parentId: number) => {
    const stmt = db.query('SELECT * FROM tasks WHERE parent_id = ? ORDER BY "order" ASC');
    return stmt.all(parentId).map(toTask);
  },
  
  insert: (title: string, description: string, status: string, parentId: number | null, 
           color: string, tags: string[], estimatedTime: string) => {
    const stmt = db.query(`
      INSERT INTO tasks (title, description, status, parent_id, color, tags, estimated_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(title, description, status, parentId, color, JSON.stringify(tags), estimatedTime);
  },
  
  updateStatus: (id: number, status: string) => {
    const stmt = db.query(`UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?`);
    stmt.run(status, id);
  },
  
  markCompleted: (id: number) => {
    const stmt = db.query(`UPDATE tasks SET status = 'done', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`);
    stmt.run(id);
  },
  
  delete: (id: number) => {
    const stmt = db.query('DELETE FROM tasks WHERE id = ?');
    stmt.run(id);
  },
  
  getNextOrder: (status: string) => {
    const stmt = db.query('SELECT MAX("order") as maxOrder FROM tasks WHERE status = ?');
    return stmt.get(status) as { maxOrder: number | null };
  },
};

// Subtask queries
export const subtaskQueries = {
  getByTaskId: (taskId: number) => {
    const stmt = db.query('SELECT * FROM subtasks WHERE task_id = ? ORDER BY "order" ASC');
    return stmt.all(taskId);
  },
  
  insert: (taskId: number, title: string, order: number) => {
    const stmt = db.query('INSERT INTO subtasks (task_id, title, "order") VALUES (?, ?, ?)');
    return stmt.run(taskId, title, order);
  },
  
  toggle: (id: number) => {
    const stmt = db.query('UPDATE subtasks SET is_completed = NOT is_completed WHERE id = ?');
    stmt.run(id);
  },
  
  delete: (id: number) => {
    const stmt = db.query('DELETE FROM subtasks WHERE id = ?');
    stmt.run(id);
  },
  
  deleteByTaskId: (taskId: number) => {
    const stmt = db.query('DELETE FROM subtasks WHERE task_id = ?');
    stmt.run(taskId);
  },
};

// Activity queries
export const activityQueries = {
  getByTaskId: (taskId: number) => {
    const stmt = db.query('SELECT * FROM activities WHERE task_id = ? ORDER BY created_at ASC');
    return stmt.all(taskId);
  },
  
  insert: (taskId: number, type: string, content: string) => {
    const stmt = db.query('INSERT INTO activities (task_id, type, content) VALUES (?, ?, ?)');
    return stmt.run(taskId, type, content);
  },
  
  deleteByTaskId: (taskId: number) => {
    const stmt = db.query('DELETE FROM activities WHERE task_id = ?');
    stmt.run(taskId);
  },
};

// Tool meta queries
export const toolMetaQueries = {
  getAll: () => {
    const stmt = db.query('SELECT * FROM tool_meta ORDER BY usage_count DESC');
    return stmt.all();
  },
  
  getByName: (name: string) => {
    const stmt = db.query('SELECT * FROM tool_meta WHERE name = ?');
    return stmt.get(name);
  },
  
  insert: (name: string, description: string, source: string) => {
    const stmt = db.query('INSERT OR IGNORE INTO tool_meta (name, description, source) VALUES (?, ?, ?)');
    stmt.run(name, description, source);
  },
  
  incrementUsage: (name: string) => {
    const stmt = db.query(`UPDATE tool_meta SET usage_count = usage_count + 1, last_used = datetime('now') WHERE name = ?`);
    stmt.run(name);
  },
};

export default db;
