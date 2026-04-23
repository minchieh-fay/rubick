import { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { KanbanBoard } from './components/kanban/KanbanBoard';
import { ChatBar } from './components/chat/ChatBar';
import { TaskDetail } from './components/detail/TaskDetail';
import { COLUMNS, type Task } from './types';
import { useStore } from './store/useStore';
import { taskApi } from './api/client';

const colors = ['#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'];

function App() {
  const { tasks, setTasks, addTask, moveTask } = useStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Load tasks from API on mount
  useEffect(() => {
    taskApi.getAll()
      .then((loadedTasks) => {
        setTasks(loadedTasks);
        setIsInitializing(false);
      })
      .catch((err) => {
        console.error('Failed to load tasks:', err);
        setIsInitializing(false);
      });
  }, []);

  const handleSend = async (message: string) => {
    setIsLoading(true);
    
    try {
      // Create task via API
      const newTask = await taskApi.create({
        title: message,
        description: 'Created from chat',
        status: 'inbox',
        color: colors[Math.floor(Math.random() * colors.length)],
        tags: ['ai-generated'],
        estimatedTime: '1h',
      });
      
      addTask({
        ...newTask,
        parentId: newTask.parentId,
        estimatedTime: newTask.estimatedTime,
        actualTime: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
        isBlocked: false,
        blockReason: '',
      });
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-[var(--text-secondary)] animate-pulse">
          Loading...
        </div>
      </div>
    );
  }

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
