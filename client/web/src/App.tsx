import { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { KanbanBoard } from './components/kanban/KanbanBoard';
import { ChatBar } from './components/chat/ChatBar';
import { TaskDetail } from './components/detail/TaskDetail';
import { COLUMNS, type Task, type SubTask } from './types';
import { useStore } from './store/useStore';
import { taskApi, subtaskApi, agentApi } from './api/client';

function App() {
  const { tasks, setTasks, addTask, setSubTasks } = useStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Load tasks from API on mount
  useEffect(() => {
    Promise.all([
      taskApi.getAll(),
      taskApi.getAll().then(allTasks => 
        Promise.all(
          allTasks.map(task => 
            subtaskApi.getByTaskId(task.id).catch(() => [])
          )
        )
      )
    ])
      .then(([loadedTasks, allSubTasks]) => {
        setTasks(loadedTasks);
        // Set subtasks for each task
        allSubTasks.forEach((subTasks, idx) => {
          if (subTasks.length > 0 && loadedTasks[idx]) {
            setSubTasks(loadedTasks[idx].id, subTasks);
          }
        });
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
      // Use AI to analyze and create task
      const result = await agentApi.analyze(message);
      
      if (result.needsClarification) {
        // AI needs more info - show questions (future: display in chat)
        alert('AI has questions:\n' + (result.questions || []).join('\n'));
      } else if (result.task) {
        // Task created with subtasks
        const newTask = {
          ...result.task,
          parentId: result.task.parent_id,
          estimatedTime: result.task.estimated_time,
          actualTime: result.task.actual_time,
          createdAt: result.task.created_at,
          updatedAt: result.task.updated_at,
          completedAt: result.task.completed_at,
          isBlocked: !!result.task.is_blocked,
          blockReason: result.task.block_reason,
        };
        
        addTask(newTask);
        
        // Set subtasks in store
        if (result.subtasks?.length > 0) {
          setSubTasks(newTask.id, result.subtasks);
        }
      }
    } catch (err) {
      console.error('Failed to analyze message:', err);
      // Fallback: create simple task
      try {
        const newTask = await taskApi.create({
          title: message,
          description: 'Created from chat',
          status: 'inbox',
          color: `hsl(${Math.random() * 360}, 70%, 60%)`,
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
      } catch {
        console.error('Fallback also failed');
      }
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
