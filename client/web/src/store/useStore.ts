import { create } from 'zustand';
import type { Task, SubTask, Activity, TaskStatus } from '../types';

interface TaskState {
  tasks: Task[];
  subTasks: Map<number, SubTask[]>;
  activities: Map<number, Activity[]>;
  selectedTask: Task | null;
  showDetail: boolean;

  // Actions
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: number, updates: Partial<Task>) => void;
  deleteTask: (id: number) => void;
  moveTask: (id: number, status: TaskStatus) => void;
  selectTask: (task: Task | null) => void;
  toggleDetail: (show: boolean) => void;
  setSubTasks: (taskId: number, tasks: SubTask[]) => void;
  toggleSubTask: (taskId: number, subTaskId: number) => void;
  addActivity: (taskId: number, activity: Activity) => void;
}

export const useStore = create<TaskState>((set, get) => ({
  tasks: [],
  subTasks: new Map(),
  activities: new Map(),
  selectedTask: null,
  showDetail: false,

  setTasks: (tasks) => set({ tasks }),
  
  addTask: (task) => set((state) => ({ 
    tasks: [...state.tasks, task] 
  })),
  
  updateTask: (id, updates) => set((state) => ({
    tasks: state.tasks.map((t) => 
      t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    ),
  })),
  
  deleteTask: (id) => set((state) => ({
    tasks: state.tasks.filter((t) => t.id !== id && t.parentId !== id),
    selectedTask: state.selectedTask?.id === id ? null : state.selectedTask,
  })),
  
  moveTask: (id, status) => set((state) => ({
    tasks: state.tasks.map((t) =>
      t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t
    ),
  })),
  
  selectTask: (task) => set({ selectedTask: task, showDetail: !!task }),
  
  toggleDetail: (show) => set({ showDetail: show }),
  
  setSubTasks: (taskId, tasks) => set((state) => {
    const newMap = new Map(state.subTasks);
    newMap.set(taskId, tasks);
    return { subTasks: newMap };
  }),
  
  toggleSubTask: (taskId, subTaskId) => set((state) => {
    const newMap = new Map(state.subTasks);
    const tasks = newMap.get(taskId)?.map((st) =>
      st.id === subTaskId ? { ...st, isCompleted: !st.isCompleted } : st
    );
    if (tasks) newMap.set(taskId, tasks);
    return { subTasks: newMap };
  }),
  
  addActivity: (taskId, activity) => set((state) => {
    const newMap = new Map(state.activities);
    const activities = newMap.get(taskId) || [];
    newMap.set(taskId, [...activities, activity]);
    return { activities: newMap };
  }),
}));
