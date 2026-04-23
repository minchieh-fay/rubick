import { useState } from 'react';
import { Header } from './components/layout/Header';
import { KanbanBoard } from './components/kanban/KanbanBoard';
import { ChatBar } from './components/chat/ChatBar';
import { TaskDetail } from './components/detail/TaskDetail';
import { COLUMNS, type Task } from './types';
import { useStore } from './store/useStore';

// Demo data - will be replaced by API
const demoTasks: Task[] = [
  {
    id: 1,
    title: 'Build personal blog website',
    description: 'Create a personal blog with markdown support',
    status: 'inbox',
    parentId: null,
    color: '#8b5cf6',
    tags: ['dev', 'frontend'],
    estimatedTime: '4h',
    actualTime: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    order: 0,
    isBlocked: false,
    blockReason: '',
  },
  {
    id: 2,
    title: 'Setup CI/CD pipeline',
    description: 'Configure GitHub Actions for auto deployment',
    status: 'todo',
    parentId: null,
    color: '#3b82f6',
    tags: ['devops'],
    estimatedTime: '2h',
    actualTime: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    order: 0,
    isBlocked: false,
    blockReason: '',
  },
  {
    id: 3,
    title: 'Write API documentation',
    description: 'Document all REST endpoints',
    status: 'doing',
    parentId: null,
    color: '#22c55e',
    tags: ['docs'],
    estimatedTime: '3h',
    actualTime: '1h',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    order: 0,
    isBlocked: false,
    blockReason: '',
  },
  {
    id: 4,
    title: 'Research AI models',
    description: 'Compare different LLM options',
    status: 'done',
    parentId: null,
    color: '#f59e0b',
    tags: ['research'],
    estimatedTime: '2h',
    actualTime: '1.5h',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    order: 0,
    isBlocked: false,
    blockReason: '',
  },
];

function App() {
  const { tasks, setTasks } = useStore();
  const [isLoading, setIsLoading] = useState(false);

  // Initialize demo data
  useState(() => {
    setTasks(demoTasks);
  });

  const handleSend = (message: string) => {
    setIsLoading(true);
    
    // Simulate AI processing
    setTimeout(() => {
      const newTask: Task = {
        id: tasks.length + 1,
        title: message,
        description: 'Auto-created from chat',
        status: 'inbox',
        parentId: null,
        color: `hsl(${Math.random() * 360}, 70%, 60%)`,
        tags: ['ai-generated'],
        estimatedTime: '1h',
        actualTime: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
        order: 0,
        isBlocked: false,
        blockReason: '',
      };
      
      setTasks([...tasks, newTask]);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-primary)]">
      <Header />
      
      <main className="flex-1 overflow-hidden">
        <KanbanBoard columns={COLUMNS} tasks={tasks} />
      </main>
      
      <ChatBar onSend={handleSend} isLoading={isLoading} />
      
      <TaskDetail />
    </div>
  );
}

export default App;
